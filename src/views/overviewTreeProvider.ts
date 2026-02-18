import * as vscode from "vscode";
import { IndexerService } from "../indexer";

export class OverviewTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    TreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private indexer: IndexerService) {
    indexer.onDidIndexChange(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    const stats = this.indexer.getIndex().getStats();

    return Promise.resolve([
      new TreeItem(
        "Features",
        stats.totalFeatures,
        vscode.TreeItemCollapsibleState.None,
      ),
      new TreeItem(
        "Scenarios",
        stats.totalScenarios,
        vscode.TreeItemCollapsibleState.None,
      ),
      new TreeItem(
        "Steps",
        stats.totalSteps,
        vscode.TreeItemCollapsibleState.None,
      ),
      new TreeItem(
        "Undefined Steps",
        stats.undefinedSteps,
        vscode.TreeItemCollapsibleState.None,
        stats.undefinedSteps > 0 ? "error" : "none",
      ),
      new TreeItem(
        "Ambiguous Steps",
        stats.ambiguousSteps,
        vscode.TreeItemCollapsibleState.None,
        stats.ambiguousSteps > 0 ? "warning" : "none",
      ),
      new TreeItem(
        "Unused Definitions",
        stats.unusedDefinitions,
        vscode.TreeItemCollapsibleState.None,
        stats.unusedDefinitions > 0 ? "info" : "none",
      ),
    ]);
  }
}

class TreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly count: number,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly severity: "error" | "warning" | "info" | "none" = "none",
  ) {
    super(label, collapsibleState);
    this.description = count.toString();

    if (severity === "error") {
      this.iconPath = new vscode.ThemeIcon(
        "error",
        new vscode.ThemeColor("errorForeground"),
      );
    } else if (severity === "warning") {
      this.iconPath = new vscode.ThemeIcon(
        "warning",
        new vscode.ThemeColor("editorWarning.foreground"),
      );
    } else if (severity === "info") {
      this.iconPath = new vscode.ThemeIcon(
        "info",
        new vscode.ThemeColor("editorInfo.foreground"),
      );
    } else {
      this.iconPath = new vscode.ThemeIcon(
        "check",
        new vscode.ThemeColor("terminal.ansiGreen"),
      );
    }
  }
}
