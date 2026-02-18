import * as vscode from "vscode";
import { IndexerService } from "./indexer";
import { Config } from "./config";
import { OverviewTreeProvider } from "./views/overviewTreeProvider";
import { UndefinedStepsTreeProvider } from "./views/undefinedStepsTreeProvider";
import { UnusedDefsTreeProvider } from "./views/unusedDefsTreeProvider";
import { AmbiguousStepsTreeProvider } from "./views/ambiguousStepsTreeProvider";
import { DiagnosticsProvider } from "./diagnosticsProvider";
import { CodeActionProvider } from "./codeActionProvider";
import { StubGenerator } from "./stubGenerator";

let indexer: IndexerService;
let diagnosticsProvider: DiagnosticsProvider;

export async function activate(context: vscode.ExtensionContext) {
  console.log("Cucumber Dashboard extension is now active");

  // Initialize indexer service
  indexer = new IndexerService();

  // Register tree view providers
  const overviewProvider = new OverviewTreeProvider(indexer);
  const undefinedStepsProvider = new UndefinedStepsTreeProvider(indexer);
  const unusedDefsProvider = new UnusedDefsTreeProvider(indexer);
  const ambiguousStepsProvider = new AmbiguousStepsTreeProvider(indexer);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "cucumberDash.overviewView",
      overviewProvider,
    ),
    vscode.window.registerTreeDataProvider(
      "cucumberDash.undefinedStepsView",
      undefinedStepsProvider,
    ),
    vscode.window.registerTreeDataProvider(
      "cucumberDash.unusedDefsView",
      unusedDefsProvider,
    ),
    vscode.window.registerTreeDataProvider(
      "cucumberDash.ambiguousStepsView",
      ambiguousStepsProvider,
    ),
  );

  // Register diagnostics provider
  diagnosticsProvider = new DiagnosticsProvider(indexer);
  context.subscriptions.push(diagnosticsProvider);

  // Register code action provider
  const codeActionProvider = new CodeActionProvider(indexer);
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { language: "gherkin", scheme: "file" },
      codeActionProvider,
      {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
      },
    ),
  );

  // Register stub generator
  const stubGenerator = new StubGenerator(indexer);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("cucumberDash.reindex", async () => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Reindexing Cucumber workspace...",
          cancellable: false,
        },
        async () => {
          await indexer.reindex();
          vscode.window.showInformationMessage(
            "Cucumber workspace reindexed successfully",
          );
        },
      );
    }),

    vscode.commands.registerCommand("cucumberDash.openDashboard", () => {
      vscode.commands.executeCommand("cucumberDash.overviewView.focus");
    }),

    vscode.commands.registerCommand(
      "cucumberDash.generateStepStub",
      async (uri?: vscode.Uri, line?: number) => {
        if (!uri || line === undefined) {
          // Called without arguments - use active editor
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            vscode.window.showErrorMessage("No active editor");
            return;
          }
          uri = editor.document.uri;
          line = editor.selection.active.line;
        }
        await stubGenerator.generateStepStub(uri, line);
      },
    ),

    vscode.commands.registerCommand(
      "cucumberDash.showMatchingDefs",
      async (uri: vscode.Uri, line: number) => {
        // Find ambiguous step at this line
        const ambiguousSteps = indexer.getIndex().getAmbiguousSteps();
        const stepResult = ambiguousSteps.find(
          (r) =>
            r.step.uri.toString() === uri.toString() &&
            r.step.line === line + 1,
        );

        if (!stepResult) {
          vscode.window.showErrorMessage(
            "No ambiguous step found at this location",
          );
          return;
        }

        // Show quick pick with matching definitions
        const items = stepResult.matches.map((def) => {
          const pattern =
            def.kind === "regex" ? `/${def.pattern}/` : def.pattern;
          const fileName = def.uri.fsPath.split(/[\\/]/).pop();
          return {
            label: pattern,
            description: `${def.keyword} in ${fileName}`,
            detail: def.uri.fsPath,
            def,
          };
        });

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: "Select a step definition to view",
        });

        if (selected) {
          const doc = await vscode.workspace.openTextDocument(selected.def.uri);
          await vscode.window.showTextDocument(doc, {
            selection: selected.def.range,
          });
        }
      },
    ),
  );

  // Listen for configuration changes
  context.subscriptions.push(
    Config.onDidChange(async () => {
      indexer.updateMatchMode(Config.getMatchMode());
      await indexer.reindex();
      diagnosticsProvider.updateDiagnostics();
    }),
  );

  // Start initial indexing
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Indexing Cucumber workspace...",
      cancellable: false,
    },
    async () => {
      await indexer.initialize();
    },
  );
}

export function deactivate() {
  if (indexer) {
    indexer.dispose();
  }
}
