import * as vscode from "vscode";
import { IndexerService } from "./indexer";
import { FeatureStep, StepDefinition } from "./types";

export class SearchCommand {
  constructor(private indexer: IndexerService) {}

  async execute() {
    // First, ask user what to search
    const searchType = await vscode.window.showQuickPick(
      [
        {
          label: "$(search) Search Feature Steps",
          description: "Find steps in .feature files",
          value: "steps",
        },
        {
          label: "$(symbol-method) Search Step Definitions",
          description: "Find step definitions in code",
          value: "definitions",
        },
      ],
      {
        placeHolder: "What do you want to search?",
      },
    );

    if (!searchType) {
      return;
    }

    if (searchType.value === "steps") {
      await this.searchSteps();
    } else {
      await this.searchDefinitions();
    }
  }

  private async searchSteps() {
    const allSteps = this.getAllFeatureSteps();

    if (allSteps.length === 0) {
      vscode.window.showInformationMessage(
        "No feature steps found in workspace",
      );
      return;
    }

    const items = allSteps.map((step) => {
      const fileName = step.uri.fsPath.split(/[\\/]/).pop() || step.uri.fsPath;
      return {
        label: `${step.keyword} ${step.text}`,
        description: `L${step.line}`,
        detail: `${fileName} · ${step.scenarioName}`,
        step,
      };
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Search for a step...",
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (selected) {
      const doc = await vscode.workspace.openTextDocument(selected.step.uri);
      await vscode.window.showTextDocument(doc, {
        selection: new vscode.Range(
          selected.step.line - 1,
          0,
          selected.step.line - 1,
          0,
        ),
      });
    }
  }

  private async searchDefinitions() {
    const allDefs = this.getAllStepDefinitions();

    if (allDefs.length === 0) {
      vscode.window.showInformationMessage(
        "No step definitions found in workspace",
      );
      return;
    }

    const items = allDefs.map((def) => {
      const fileName = def.uri.fsPath.split(/[\\/]/).pop() || def.uri.fsPath;
      const pattern =
        def.kind === "regex"
          ? `/${def.pattern}/${def.regexFlags || ""}`
          : def.pattern;
      const keyword = def.keyword === "any" ? "Step" : def.keyword;

      return {
        label: pattern,
        description: `${keyword} · L${def.range.start.line + 1}`,
        detail: fileName,
        def,
      };
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Search for a step definition...",
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (selected) {
      const doc = await vscode.workspace.openTextDocument(selected.def.uri);
      await vscode.window.showTextDocument(doc, {
        selection: selected.def.range,
      });
    }
  }

  private getAllFeatureSteps(): FeatureStep[] {
    const allSteps: FeatureStep[] = [];
    const features = this.indexer.getIndex().getFeatures();

    features.forEach((feature) => {
      feature.scenarios.forEach((scenario) => {
        scenario.steps.forEach((step) => {
          allSteps.push({
            ...step,
            uri: feature.uri,
            featureName: feature.name,
            scenarioName: scenario.name,
          });
        });
      });
    });

    return allSteps;
  }

  private getAllStepDefinitions(): StepDefinition[] {
    const allDefs: StepDefinition[] = [];
    const defsByFile = this.indexer.getIndex().getStepDefinitionsByFile();

    defsByFile.forEach((defs) => {
      allDefs.push(...defs);
    });

    return allDefs;
  }
}
