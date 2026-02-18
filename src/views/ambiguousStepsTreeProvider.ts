import * as vscode from "vscode";
import { IndexerService } from "../indexer";
import { FeatureStep, StepDefinition } from "../types";

type TreeNode = FeatureNode | ScenarioNode | StepNode | DefinitionNode;

class FeatureNode {
  constructor(
    public featureName: string,
    public uri: vscode.Uri,
  ) {}
}

class ScenarioNode {
  constructor(
    public scenarioName: string,
    public featureName: string,
    public uri: vscode.Uri,
  ) {}
}

class StepNode {
  constructor(
    public step: FeatureStep,
    public matches: StepDefinition[],
  ) {}
}

class DefinitionNode {
  constructor(
    public definition: StepDefinition,
    public index: number,
    public total: number,
  ) {}
}

export class AmbiguousStepsTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    TreeNode | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private indexer: IndexerService) {
    indexer.onDidIndexChange(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    if (element instanceof FeatureNode) {
      const item = new vscode.TreeItem(
        element.featureName,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.iconPath = new vscode.ThemeIcon("file");
      item.contextValue = "feature";
      return item;
    } else if (element instanceof ScenarioNode) {
      const item = new vscode.TreeItem(
        element.scenarioName,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.iconPath = new vscode.ThemeIcon("symbol-event");
      item.contextValue = "scenario";
      return item;
    } else if (element instanceof StepNode) {
      const step = element.step;
      const item = new vscode.TreeItem(
        `${step.keyword} ${step.text}`,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.iconPath = new vscode.ThemeIcon(
        "warning",
        new vscode.ThemeColor("editorWarning.foreground"),
      );
      item.description = `${element.matches.length} matches`;
      item.command = {
        command: "vscode.open",
        title: "Open",
        arguments: [
          step.uri,
          { selection: new vscode.Range(step.line - 1, 0, step.line - 1, 0) },
        ],
      };
      item.contextValue = "ambiguousStep";
      item.tooltip = `Line ${step.line}: ${element.matches.length} matching definitions found`;
      return item;
    } else {
      const def = element.definition;
      const label =
        def.kind === "regex"
          ? `/${def.pattern}/${def.regexFlags || ""}`
          : def.pattern;

      const fileName = def.uri.fsPath.split(/[\\/]/).pop() || def.uri.fsPath;
      const item = new vscode.TreeItem(
        label,
        vscode.TreeItemCollapsibleState.None,
      );
      item.iconPath = new vscode.ThemeIcon("symbol-method");
      item.description = `${fileName} (${element.index}/${element.total})`;
      item.command = {
        command: "vscode.open",
        title: "Open",
        arguments: [def.uri, { selection: def.range }],
      };
      item.contextValue = "matchingDefinition";
      item.tooltip = `${def.keyword}: ${label}\n${def.uri.fsPath}`;
      return item;
    }
  }

  getChildren(element?: TreeNode): Thenable<TreeNode[]> {
    if (!element) {
      // Root level - return features
      const ambiguousSteps = this.indexer.getIndex().getAmbiguousSteps();
      const featureMap = new Map<string, { name: string; uri: vscode.Uri }>();

      ambiguousSteps.forEach((result) => {
        const key = result.step.uri.toString();
        if (!featureMap.has(key)) {
          featureMap.set(key, {
            name: result.step.featureName,
            uri: result.step.uri,
          });
        }
      });

      const features = Array.from(featureMap.values()).map(
        (f) => new FeatureNode(f.name, f.uri),
      );
      return Promise.resolve(features);
    } else if (element instanceof FeatureNode) {
      // Return scenarios for this feature
      const ambiguousSteps = this.indexer.getIndex().getAmbiguousSteps();
      const scenarioMap = new Map<string, ScenarioNode>();

      ambiguousSteps
        .filter((r) => r.step.uri.toString() === element.uri.toString())
        .forEach((result) => {
          const key = `${result.step.featureName}::${result.step.scenarioName}`;
          if (!scenarioMap.has(key)) {
            scenarioMap.set(
              key,
              new ScenarioNode(
                result.step.scenarioName,
                result.step.featureName,
                result.step.uri,
              ),
            );
          }
        });

      return Promise.resolve(Array.from(scenarioMap.values()));
    } else if (element instanceof ScenarioNode) {
      // Return steps for this scenario
      const ambiguousSteps = this.indexer.getIndex().getAmbiguousSteps();
      const steps = ambiguousSteps
        .filter(
          (r) =>
            r.step.uri.toString() === element.uri.toString() &&
            r.step.scenarioName === element.scenarioName,
        )
        .map((r) => new StepNode(r.step, r.matches));

      return Promise.resolve(steps);
    } else if (element instanceof StepNode) {
      // Return matching definitions
      const defNodes = element.matches.map(
        (def, idx) => new DefinitionNode(def, idx + 1, element.matches.length),
      );
      return Promise.resolve(defNodes);
    }

    return Promise.resolve([]);
  }
}
