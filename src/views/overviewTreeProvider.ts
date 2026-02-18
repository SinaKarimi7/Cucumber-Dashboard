import * as vscode from "vscode";
import { IndexerService } from "../indexer";

export class OverviewTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    TreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private lastIndexedTime: Date | null = null;

  constructor(private indexer: IndexerService) {
    indexer.onDidIndexChange(() => {
      this.lastIndexedTime = new Date();
      this.refresh();
    });
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
    const items: TreeItem[] = [];

    // Show indexing status if available
    if (this.lastIndexedTime) {
      const timeStr = this.formatTime(this.lastIndexedTime);
      items.push(
        new TreeItem(
          `Last indexed: ${timeStr}`,
          "",
          vscode.TreeItemCollapsibleState.None,
          "none",
          "clock",
        ),
      );
    }

    items.push(
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
    );

    return Promise.resolve(items);
  }

  private formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) {
      return "just now";
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return date.toLocaleTimeString();
    }
  }
}

class TreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly count: number | string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly severity: "error" | "warning" | "info" | "none" = "none",
    public readonly iconName?: string,
  ) {
    super(label, collapsibleState);

    if (typeof count === "number") {
      this.description = count.toString();
    } else {
      this.description = count;
    }

    if (iconName) {
      this.iconPath = new vscode.ThemeIcon(iconName);
    } else if (severity === "error") {
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
