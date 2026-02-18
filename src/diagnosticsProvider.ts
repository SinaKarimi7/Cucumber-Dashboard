import * as vscode from "vscode";
import { IndexerService } from "./indexer";
import { Config } from "./config";

export class DiagnosticsProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor(private indexer: IndexerService) {
    this.diagnosticCollection =
      vscode.languages.createDiagnosticCollection("cucumber");
    indexer.onDidIndexChange(() => this.updateDiagnostics());
  }

  updateDiagnostics() {
    if (!Config.getEnableDiagnostics()) {
      this.diagnosticCollection.clear();
      return;
    }

    const diagnosticsByFile = new Map<string, vscode.Diagnostic[]>();

    // Undefined steps
    const undefinedSteps = this.indexer.getIndex().getUndefinedSteps();
    undefinedSteps.forEach((result) => {
      const uri = result.step.uri.toString();
      if (!diagnosticsByFile.has(uri)) {
        diagnosticsByFile.set(uri, []);
      }

      const line = result.step.line - 1;
      const range = new vscode.Range(line, 0, line, 1000);
      const diagnostic = new vscode.Diagnostic(
        range,
        `Undefined step: ${result.step.keyword} ${result.step.text}`,
        vscode.DiagnosticSeverity.Error,
      );
      diagnostic.code = "undefined-step";
      diagnostic.source = "cucumber";
      diagnosticsByFile.get(uri)!.push(diagnostic);
    });

    // Ambiguous steps
    const ambiguousSteps = this.indexer.getIndex().getAmbiguousSteps();
    ambiguousSteps.forEach((result) => {
      const uri = result.step.uri.toString();
      if (!diagnosticsByFile.has(uri)) {
        diagnosticsByFile.set(uri, []);
      }

      const line = result.step.line - 1;
      const range = new vscode.Range(line, 0, line, 1000);
      const matchInfo = result.matches
        .map((m) => {
          const pattern = m.kind === "regex" ? `/${m.pattern}/` : m.pattern;
          const file = m.uri.fsPath.split(/[\\/]/).pop();
          return `  - ${pattern} in ${file}`;
        })
        .join("\n");

      const diagnostic = new vscode.Diagnostic(
        range,
        `Ambiguous step matches ${result.matches.length} definitions:\n${matchInfo}`,
        vscode.DiagnosticSeverity.Warning,
      );
      diagnostic.code = "ambiguous-step";
      diagnostic.source = "cucumber";
      diagnosticsByFile.get(uri)!.push(diagnostic);
    });

    // Apply diagnostics
    this.diagnosticCollection.clear();
    diagnosticsByFile.forEach((diagnostics, uriStr) => {
      this.diagnosticCollection.set(vscode.Uri.parse(uriStr), diagnostics);
    });
  }

  dispose() {
    this.diagnosticCollection.dispose();
  }
}
