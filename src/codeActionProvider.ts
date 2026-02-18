import * as vscode from "vscode";
import { IndexerService } from "./indexer";

export class CodeActionProvider implements vscode.CodeActionProvider {
  constructor(private indexer: IndexerService) {}

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken,
  ): vscode.CodeAction[] | undefined {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source === "cucumber") {
        if (diagnostic.code === "undefined-step") {
          const action = new vscode.CodeAction(
            "Generate step definition stub",
            vscode.CodeActionKind.QuickFix,
          );
          action.command = {
            command: "cucumberDash.generateStepStub",
            title: "Generate step definition stub",
            arguments: [document.uri, range.start.line],
          };
          action.diagnostics = [diagnostic];
          action.isPreferred = true;
          actions.push(action);
        } else if (diagnostic.code === "ambiguous-step") {
          const action = new vscode.CodeAction(
            "Show matching definitions",
            vscode.CodeActionKind.QuickFix,
          );
          action.command = {
            command: "cucumberDash.showMatchingDefs",
            title: "Show matching definitions",
            arguments: [document.uri, range.start.line],
          };
          action.diagnostics = [diagnostic];
          actions.push(action);
        }
      }
    }

    return actions;
  }
}
