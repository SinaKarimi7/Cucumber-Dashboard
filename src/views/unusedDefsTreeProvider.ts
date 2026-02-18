import * as vscode from "vscode";
import { IndexerService } from "../indexer";
import { StepDefinition } from "../types";

type TreeNode = FileNode | DefinitionNode;

class FileNode {
  constructor(
    public uri: vscode.Uri,
    public definitions: StepDefinition[],
  ) {}
}

class DefinitionNode {
  constructor(public definition: StepDefinition) {}
}

export class UnusedDefsTreeProvider implements vscode.TreeDataProvider<TreeNode> {
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
    if (element instanceof FileNode) {
      const fileName =
        element.uri.fsPath.split(/[\\/]/).pop() || element.uri.fsPath;
      const item = new vscode.TreeItem(
        fileName,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = new vscode.ThemeIcon("file-code");
      item.description = `${element.definitions.length} unused`;
      item.tooltip = element.uri.fsPath;
      item.contextValue = "file";
      return item;
    } else {
      const def = element.definition;
      const label =
        def.kind === "regex"
          ? `/${def.pattern}/${def.regexFlags || ""}`
          : def.pattern;

      const item = new vscode.TreeItem(
        label,
        vscode.TreeItemCollapsibleState.None,
      );
      item.iconPath = new vscode.ThemeIcon("symbol-method");
      item.description = def.keyword === "any" ? "Step" : def.keyword;
      item.command = {
        command: "vscode.open",
        title: "Open",
        arguments: [def.uri, { selection: def.range }],
      };
      item.contextValue = "unusedDefinition";
      item.tooltip = `${def.keyword}: ${label}`;
      return item;
    }
  }

  getChildren(element?: TreeNode): Thenable<TreeNode[]> {
    if (!element) {
      // Root level - return files with unused definitions
      const unusedDefs = this.indexer.getIndex().getUnusedDefinitions();
      const fileMap = new Map<string, StepDefinition[]>();

      unusedDefs.forEach((def) => {
        const key = def.uri.toString();
        if (!fileMap.has(key)) {
          fileMap.set(key, []);
        }
        fileMap.get(key)!.push(def);
      });

      const files = Array.from(fileMap.entries()).map(
        ([uriStr, defs]) => new FileNode(vscode.Uri.parse(uriStr), defs),
      );

      return Promise.resolve(files);
    } else if (element instanceof FileNode) {
      // Return definitions for this file
      const defNodes = element.definitions.map(
        (def) => new DefinitionNode(def),
      );
      return Promise.resolve(defNodes);
    }

    return Promise.resolve([]);
  }
}
