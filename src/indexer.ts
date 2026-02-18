import * as vscode from "vscode";
import { WorkspaceIndex } from "./workspaceIndex";
import { GherkinParser } from "./gherkinParser";
import { StepDefinitionExtractor } from "./stepDefinitionExtractor";
import { MatchingEngine } from "./matchingEngine";
import { Config } from "./config";

export class IndexerService {
  private index: WorkspaceIndex;
  private gherkinParser: GherkinParser;
  private stepDefExtractor: StepDefinitionExtractor;
  private matchingEngine: MatchingEngine;
  private watchers: vscode.FileSystemWatcher[] = [];
  private indexDebounceTimer?: NodeJS.Timeout;
  private onDidIndexChangeEmitter = new vscode.EventEmitter<void>();
  readonly onDidIndexChange = this.onDidIndexChangeEmitter.event;

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
    this.index.clear();
    await this.indexFeatures();
    await this.indexStepDefinitions();
    this.performMatching();
    this.notifyIndexChanged();
  }

  private async indexFeatures() {
    const featureGlobs = Config.getFeatureGlobs();
    const excludeGlobs = Config.getExcludeGlobs();

    for (const glob of featureGlobs) {
      const files = await vscode.workspace.findFiles(
        glob,
        `{${excludeGlobs.join(",")}}`,
      );

      for (const uri of files) {
        await this.indexFeatureFile(uri);
      }
    }
  }

  private async indexFeatureFile(uri: vscode.Uri) {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      const content = document.getText();
      const feature = await this.gherkinParser.parseFeature(uri, content);

      if (feature) {
        this.index.setFeature(uri, feature);
      }
    } catch (error) {
      console.error(`Failed to index feature file ${uri.fsPath}:`, error);
    }
  }

  private async indexStepDefinitions() {
    const stepDefGlobs = Config.getStepDefGlobs();
    const excludeGlobs = Config.getExcludeGlobs();

    for (const glob of stepDefGlobs) {
      const files = await vscode.workspace.findFiles(
        glob,
        `{${excludeGlobs.join(",")}}`,
      );

      for (const uri of files) {
        await this.indexStepDefinitionFile(uri);
      }
    }
  }

  private async indexStepDefinitionFile(uri: vscode.Uri) {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      const content = document.getText();
      const definitions = await this.stepDefExtractor.extractDefinitions(
        uri,
        content,
      );
      this.index.setStepDefinitions(uri, definitions);
    } catch (error) {
      console.error(
        `Failed to index step definition file ${uri.fsPath}:`,
        error,
      );
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
      this.performMatching();
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
      this.performMatching();
    });
  }

  private onStepDefFileDeleted(uri: vscode.Uri) {
    this.debounceReindex(() => {
      this.index.removeStepDefinitions(uri);
      this.performMatching();
    });
  }

  private debounceReindex(action: () => void | Promise<void>) {
    if (this.indexDebounceTimer) {
      clearTimeout(this.indexDebounceTimer);
    }

    this.indexDebounceTimer = setTimeout(async () => {
      await action();
      this.notifyIndexChanged();
    }, 500);
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
  }
}
