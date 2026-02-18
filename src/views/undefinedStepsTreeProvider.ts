import * as vscode from "vscode";
import { IndexerService } from "../indexer";
import { FeatureStep } from "../types";

type TreeNode = FeatureNode | ScenarioNode | StepNode;

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
  constructor(public step: FeatureStep) {}
}

export class UndefinedStepsTreeProvider implements vscode.TreeDataProvider<TreeNode> {
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
      // Count undefined steps in this feature
      const undefinedSteps = this.indexer.getIndex().getUndefinedSteps();
      const count = undefinedSteps.filter(
        (r) => r.step.uri.toString() === element.uri.toString(),
      ).length;

      const item = new vscode.TreeItem(
        element.featureName,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.description = count.toString();
      item.iconPath = new vscode.ThemeIcon("file");
      item.contextValue = "feature";
      item.tooltip = `${count} undefined step${count !== 1 ? "s" : ""}`;
      return item;
    } else if (element instanceof ScenarioNode) {
      // Count undefined steps in this scenario
      const undefinedSteps = this.indexer.getIndex().getUndefinedSteps();
      const count = undefinedSteps.filter(
        (r) =>
          r.step.uri.toString() === element.uri.toString() &&
          r.step.scenarioName === element.scenarioName,
      ).length;

      const item = new vscode.TreeItem(
        element.scenarioName,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.description = count.toString();
      item.iconPath = new vscode.ThemeIcon("symbol-event");
      item.contextValue = "scenario";
      item.tooltip = `${count} undefined step${count !== 1 ? "s" : ""}`;
      return item;
    } else {
      const step = element.step;
      const label =
        step.text.length > 50 ? step.text.substring(0, 50) + "..." : step.text;

      const item = new vscode.TreeItem(
        `${step.keyword} ${label}`,
        vscode.TreeItemCollapsibleState.None,
      );
      item.description = `L${step.line}`;
      item.iconPath = new vscode.ThemeIcon(
        "error",
        new vscode.ThemeColor("errorForeground"),
      );
      item.command = {
        command: "vscode.open",
        title: "Open",
        arguments: [
          step.uri,
          { selection: new vscode.Range(step.line - 1, 0, step.line - 1, 0) },
        ],
      };
      item.contextValue = "undefinedStep";
      item.tooltip = `Line ${step.line}: ${step.keyword} ${step.text}`;
      return item;
    }
  }

  getChildren(element?: TreeNode): Thenable<TreeNode[]> {
    if (!element) {
      // Root level - return features
      const undefinedSteps = this.indexer.getIndex().getUndefinedSteps();
      const featureMap = new Map<string, { name: string; uri: vscode.Uri }>();

      undefinedSteps.forEach((result) => {
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
      const undefinedSteps = this.indexer.getIndex().getUndefinedSteps();
      const scenarioMap = new Map<string, ScenarioNode>();

      undefinedSteps
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
      const undefinedSteps = this.indexer.getIndex().getUndefinedSteps();
      const steps = undefinedSteps
        .filter(
          (r) =>
            r.step.uri.toString() === element.uri.toString() &&
            r.step.scenarioName === element.scenarioName,
        )
        .map((r) => new StepNode(r.step));

      return Promise.resolve(steps);
    }

    return Promise.resolve([]);
  }
}
