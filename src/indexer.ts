import * as vscode from "vscode";
import { WorkspaceIndex } from "./workspaceIndex";
import { GherkinParser } from "./gherkinParser";
import { StepDefinitionExtractor } from "./stepDefinitionExtractor";
import { MatchingEngine } from "./matchingEngine";
import { Config } from "./config";
import { FeatureStep } from "./types";

export class IndexerService {
  private index: WorkspaceIndex;
  private gherkinParser: GherkinParser;
  private stepDefExtractor: StepDefinitionExtractor;
  private matchingEngine: MatchingEngine;
  private watchers: vscode.FileSystemWatcher[] = [];
  private indexDebounceTimer?: NodeJS.Timeout;
  private onDidIndexChangeEmitter = new vscode.EventEmitter<void>();
  readonly onDidIndexChange = this.onDidIndexChangeEmitter.event;
  private isIndexing = false;
  private indexCancellation?: vscode.CancellationTokenSource;

  // Performance limits
  private readonly MAX_FILE_SIZE = 1024 * 1024; // 1MB
  private readonly BATCH_SIZE = 10; // Process 10 files at a time
  private readonly DEBOUNCE_DELAY = 500; // ms

  constructor() {
    this.index = new WorkspaceIndex();
    this.gherkinParser = new GherkinParser();
    this.stepDefExtractor = new StepDefinitionExtractor();
    this.matchingEngine = new MatchingEngine(Config.getMatchMode());
  }

  async initialize() {
    await this.reindex();
    this.setupWatchers();
  }

  async reindex() {
    // Cancel previous indexing if running
    if (this.indexCancellation) {
      this.indexCancellation.cancel();
      this.indexCancellation.dispose();
    }

    this.indexCancellation = new vscode.CancellationTokenSource();
    const token = this.indexCancellation.token;

    try {
      this.isIndexing = true;
      this.index.clear();

      await this.indexFeatures(token);
      if (token.isCancellationRequested) return;

      await this.indexStepDefinitions(token);
      if (token.isCancellationRequested) return;

      this.performMatching();
      this.notifyIndexChanged();
    } finally {
      this.isIndexing = false;
      this.indexCancellation?.dispose();
      this.indexCancellation = undefined;
    }
  }

  private async indexFeatures(token: vscode.CancellationToken) {
    const featureGlobs = Config.getFeatureGlobs();
    const excludeGlobs = Config.getExcludeGlobs();

    for (const glob of featureGlobs) {
      if (token.isCancellationRequested) return;

      const files = await vscode.workspace.findFiles(
        glob,
        `{${excludeGlobs.join(",")}}`,
      );

      // Process files in batches to avoid blocking
      await this.processBatch(
        files,
        (uri) => this.indexFeatureFile(uri, token),
        token,
      );
    }
  }

  private async indexFeatureFile(
    uri: vscode.Uri,
    token?: vscode.CancellationToken,
  ) {
    if (token?.isCancellationRequested) return;

    try {
      // Check file size limit
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.size > this.MAX_FILE_SIZE) {
        console.warn(
          `Skipping large feature file (${stat.size} bytes): ${uri.fsPath}`,
        );
        return;
      }

      const document = await vscode.workspace.openTextDocument(uri);
      if (token?.isCancellationRequested) return;

      const content = document.getText();
      const feature = await this.gherkinParser.parseFeature(uri, content);

      if (feature && !token?.isCancellationRequested) {
        this.index.setFeature(uri, feature);
      }
    } catch (error) {
      console.error(`Failed to index feature file ${uri.fsPath}:`, error);
    }
  }

  private async indexStepDefinitions(token: vscode.CancellationToken) {
    const stepDefGlobs = Config.getStepDefGlobs();
    const excludeGlobs = Config.getExcludeGlobs();

    for (const glob of stepDefGlobs) {
      if (token.isCancellationRequested) return;

      const files = await vscode.workspace.findFiles(
        glob,
        `{${excludeGlobs.join(",")}}`,
      );

      // Process files in batches
      await this.processBatch(
        files,
        (uri) => this.indexStepDefinitionFile(uri, token),
        token,
      );
    }
  }

  private async indexStepDefinitionFile(
    uri: vscode.Uri,
    token?: vscode.CancellationToken,
  ) {
    if (token?.isCancellationRequested) return;

    try {
      // Check file size limit
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.size > this.MAX_FILE_SIZE) {
        console.warn(
          `Skipping large step def file (${stat.size} bytes): ${uri.fsPath}`,
        );
        return;
      }

      const document = await vscode.workspace.openTextDocument(uri);
      if (token?.isCancellationRequested) return;

      const content = document.getText();
      const definitions = await this.stepDefExtractor.extractDefinitions(
        uri,
        content,
      );

      if (!token?.isCancellationRequested) {
        this.index.setStepDefinitions(uri, definitions);
      }
    } catch (error) {
      console.error(
        `Failed to index step definition file ${uri.fsPath}:`,
        error,
      );
    }
  }

  /**
   * Process files in batches to avoid blocking the main thread
   */
  private async processBatch<T>(
    items: T[],
    processor: (item: T) => Promise<void>,
    token?: vscode.CancellationToken,
  ): Promise<void> {
    for (let i = 0; i < items.length; i += this.BATCH_SIZE) {
      if (token?.isCancellationRequested) return;

      const batch = items.slice(i, i + this.BATCH_SIZE);

      // Process batch in parallel
      await Promise.all(
        batch.map((item) =>
          processor(item).catch((err) => {
            console.error("Batch processing error:", err);
          }),
        ),
      );

      // Yield to event loop between batches
      if (i + this.BATCH_SIZE < items.length) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
  }

  private performMatching() {
    const steps = this.index.getAllSteps();
    const definitions = this.index.getAllStepDefinitions();
    const results = this.matchingEngine.matchSteps(steps, definitions);
    this.index.setMatchResults(results);
  }

  private setupWatchers() {
    // Clean up existing watchers
    this.watchers.forEach((w) => w.dispose());
    this.watchers = [];

    // Watch feature files
    const featureGlobs = Config.getFeatureGlobs();
    featureGlobs.forEach((glob) => {
      const watcher = vscode.workspace.createFileSystemWatcher(glob);

      watcher.onDidCreate((uri) => this.onFeatureFileChanged(uri));
      watcher.onDidChange((uri) => this.onFeatureFileChanged(uri));
      watcher.onDidDelete((uri) => this.onFeatureFileDeleted(uri));

      this.watchers.push(watcher);
    });

    // Watch step definition files
    const stepDefGlobs = Config.getStepDefGlobs();
    stepDefGlobs.forEach((glob) => {
      const watcher = vscode.workspace.createFileSystemWatcher(glob);

      watcher.onDidCreate((uri) => this.onStepDefFileChanged(uri));
      watcher.onDidChange((uri) => this.onStepDefFileChanged(uri));
      watcher.onDidDelete((uri) => this.onStepDefFileDeleted(uri));

      this.watchers.push(watcher);
    });
  }

  private onFeatureFileChanged(uri: vscode.Uri) {
    this.debounceReindex(async () => {
      await this.indexFeatureFile(uri);
      this.performIncrementalMatching(uri);
    });
  }

  private onFeatureFileDeleted(uri: vscode.Uri) {
    this.debounceReindex(() => {
      this.index.removeFeature(uri);
      this.performMatching();
    });
  }

  private onStepDefFileChanged(uri: vscode.Uri) {
    this.debounceReindex(async () => {
      await this.indexStepDefinitionFile(uri);
      // Step def changes affect all steps, need full re-match
      this.performMatching();
    });
  }

  private onStepDefFileDeleted(uri: vscode.Uri) {
    this.debounceReindex(() => {
      this.index.removeStepDefinitions(uri);
      this.performMatching();
    });
  }

  /**
   * Incremental matching - only re-match steps from changed feature file
   */
  private performIncrementalMatching(changedUri: vscode.Uri) {
    const feature = this.index.getFeature(changedUri);
    if (!feature) {
      return;
    }

    const definitions = this.index.getAllStepDefinitions();
    const featureSteps: FeatureStep[] = [];

    feature.scenarios.forEach((scenario) => {
      scenario.steps.forEach((step) => {
        featureSteps.push({
          ...step,
          uri: feature.uri,
          featureName: feature.name,
          scenarioName: scenario.name,
        });
      });
    });

    // Only match steps from this feature
    const newResults = this.matchingEngine.matchSteps(
      featureSteps,
      definitions,
    );

    // Update only the results for this feature
    this.index.updateFeatureMatchResults(changedUri, newResults);
  }

  private debounceReindex(action: () => void | Promise<void>) {
    if (this.indexDebounceTimer) {
      clearTimeout(this.indexDebounceTimer);
    }

    this.indexDebounceTimer = setTimeout(async () => {
      try {
        await action();
        this.notifyIndexChanged();
      } catch (error) {
        console.error("Debounced reindex error:", error);
      }
    }, this.DEBOUNCE_DELAY);
  }

  private notifyIndexChanged() {
    this.onDidIndexChangeEmitter.fire();
  }

  getIndex(): WorkspaceIndex {
    return this.index;
  }

  updateMatchMode(mode: string) {
    this.matchingEngine.updateMatchMode(mode as any);
    this.performMatching();
    this.notifyIndexChanged();
  }

  dispose() {
    this.watchers.forEach((w) => w.dispose());
    this.onDidIndexChangeEmitter.dispose();
    if (this.indexDebounceTimer) {
      clearTimeout(this.indexDebounceTimer);
    }
    if (this.indexCancellation) {
      this.indexCancellation.cancel();
      this.indexCancellation.dispose();
    }
  }

  isCurrentlyIndexing(): boolean {
    return this.isIndexing;
  }
}
