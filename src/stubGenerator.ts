import * as vscode from "vscode";
import { IndexerService } from "./indexer";
import { FeatureStep, StepKeyword } from "./types";
import { Config } from "./config";

export class StubGenerator {
  constructor(private indexer: IndexerService) {}

  async generateStepStub(featureUri: vscode.Uri, line: number) {
    // Find the undefined step at this line
    const undefinedSteps = this.indexer.getIndex().getUndefinedSteps();
    const stepResult = undefinedSteps.find(
      (r) =>
        r.step.uri.toString() === featureUri.toString() &&
        r.step.line === line + 1,
    );

    if (!stepResult) {
      vscode.window.showErrorMessage(
        "No undefined step found at this location",
      );
      return;
    }

    const step = stepResult.step;

    // Check if step has data table or docstring
    const hasDataTable = await this.hasDataTable(featureUri, line);
    const hasDocString = await this.hasDocString(featureUri, line);

    // Ask user for target file
    const targetFile = await this.selectTargetFile();
    if (!targetFile) {
      return;
    }

    // Generate stub code
    const stubCode = this.generateStubCode(step, hasDataTable, hasDocString);

    // Insert stub into target file
    await this.insertStub(targetFile, stubCode);

    vscode.window.showInformationMessage(
      `Step definition stub generated in ${targetFile.fsPath}`,
    );
  }

  private async hasDataTable(
    uri: vscode.Uri,
    stepLine: number,
  ): Promise<boolean> {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      const nextLine = stepLine + 1;
      if (nextLine < document.lineCount) {
        const nextLineText = document.lineAt(nextLine).text.trim();
        return nextLineText.startsWith("|");
      }
    } catch (error) {
      console.error("Error checking for data table:", error);
    }
    return false;
  }

  private async hasDocString(
    uri: vscode.Uri,
    stepLine: number,
  ): Promise<boolean> {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      const nextLine = stepLine + 1;
      if (nextLine < document.lineCount) {
        const nextLineText = document.lineAt(nextLine).text.trim();
        return nextLineText.startsWith('"""') || nextLineText.startsWith("'''");
      }
    } catch (error) {
      console.error("Error checking for docstring:", error);
    }
    return false;
  }

  private async selectTargetFile(): Promise<vscode.Uri | undefined> {
    // Get existing step definition files
    const stepDefsByFile = this.indexer.getIndex().getStepDefinitionsByFile();
    const existingFiles = Array.from(stepDefsByFile.keys()).map((uriStr) =>
      vscode.Uri.parse(uriStr),
    );

    const items: vscode.QuickPickItem[] = existingFiles.map((uri) => ({
      label: uri.fsPath.split(/[\\/]/).pop() || uri.fsPath,
      description: uri.fsPath,
      detail: uri.fsPath,
    }));

    items.unshift({
      label: "$(new-file) Create new file...",
      description: "Create a new step definition file",
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select target file for step definition",
    });

    if (!selected) {
      return undefined;
    }

    if (selected.label.includes("Create new file")) {
      return this.createNewStepDefFile();
    }

    return vscode.Uri.file(selected.detail!);
  }

  private async createNewStepDefFile(): Promise<vscode.Uri | undefined> {
    const fileName = await vscode.window.showInputBox({
      prompt: "Enter file name (e.g., mySteps.steps.ts)",
      value: "steps.steps.ts",
      validateInput: (value) => {
        if (!value || value.trim() === "") {
          return "File name cannot be empty";
        }
        if (!value.match(/\.(ts|js)$/)) {
          return "File must have .ts or .js extension";
        }
        return null;
      },
    });

    if (!fileName) {
      return undefined;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found");
      return undefined;
    }

    const uri = vscode.Uri.joinPath(workspaceFolder.uri, fileName);

    // Create the file with basic imports
    const isTypeScript = fileName.endsWith(".ts");
    const template = this.getStepDefFileTemplate(isTypeScript);

    const edit = new vscode.WorkspaceEdit();
    edit.createFile(uri, { ignoreIfExists: true });
    edit.insert(uri, new vscode.Position(0, 0), template);
    await vscode.workspace.applyEdit(edit);

    return uri;
  }

  private getStepDefFileTemplate(isTypeScript: boolean): string {
    if (isTypeScript) {
      return `import { Given, When, Then } from '@cucumber/cucumber';\n\n`;
    } else {
      return `const { Given, When, Then } = require('@cucumber/cucumber');\n\n`;
    }
  }

  private generateStubCode(
    step: FeatureStep,
    hasDataTable: boolean,
    hasDocString: boolean,
  ): string {
    const keyword = this.resolveKeyword(step);
    const pattern = this.generatePattern(step.text);
    const paramList = this.generateParameterList(
      step.text,
      hasDataTable,
      hasDocString,
    );

    return `${keyword}("${pattern}", async ${paramList} => {\n  // TODO: Implement step\n});\n\n`;
  }

  private resolveKeyword(step: FeatureStep): StepKeyword {
    if (
      step.keyword === "And" ||
      step.keyword === "But" ||
      step.keyword === "*"
    ) {
      // Try to infer from context - for MVP, default to Given
      // A more sophisticated implementation would look at previous steps in the scenario
      return this.inferKeywordFromScenario(step);
    }
    return step.keyword;
  }

  private inferKeywordFromScenario(step: FeatureStep): StepKeyword {
    // Simple heuristic: look at the feature to find previous step in same scenario
    const feature = this.indexer.getIndex().getFeature(step.uri);
    if (!feature) {
      return "Given";
    }

    const scenario = feature.scenarios.find(
      (s) => s.name === step.scenarioName,
    );
    if (!scenario) {
      return "Given";
    }

    const stepIndex = scenario.steps.findIndex((s) => s.line === step.line);
    if (stepIndex > 0) {
      // Look at previous step
      const prevStep = scenario.steps[stepIndex - 1];
      if (
        prevStep.keyword === "Given" ||
        prevStep.keyword === "When" ||
        prevStep.keyword === "Then"
      ) {
        return prevStep.keyword;
      }
    }

    return "Given";
  }

  private generatePattern(stepText: string): string {
    let pattern = stepText;

    // Replace floats first (before integers)
    pattern = pattern.replace(/\b\d+\.\d+\b/g, "{float}");

    // Replace integers with {int}
    pattern = pattern.replace(/\b\d+\b/g, "{int}");

    // Replace quoted strings with {string}
    pattern = pattern.replace(/"[^"]*"/g, "{string}");
    pattern = pattern.replace(/'[^']*'/g, "{string}");

    return pattern;
  }

  private generateParameterList(
    stepText: string,
    hasDataTable: boolean,
    hasDocString: boolean,
  ): string {
    const params: string[] = [];

    // Count floats (must check before integers)
    const floats = stepText.match(/\b\d+\.\d+\b/g);
    const floatCount = floats ? floats.length : 0;

    // Count integers (excluding floats)
    let textWithoutFloats = stepText;
    if (floats) {
      floats.forEach((f) => {
        textWithoutFloats = textWithoutFloats.replace(f, "");
      });
    }
    const integers = textWithoutFloats.match(/\b\d+\b/g);
    const intCount = integers ? integers.length : 0;

    // Add number parameters
    for (let i = 0; i < floatCount; i++) {
      params.push(floatCount === 1 ? "value" : `value${i + 1}`);
    }
    for (let i = 0; i < intCount; i++) {
      params.push(intCount === 1 ? "count" : `count${i + 1}`);
    }

    // Count strings
    const strings = stepText.match(/["'][^"']*["']/g);
    if (strings) {
      if (strings.length === 1) {
        params.push("text");
      } else {
        strings.forEach((_, i) => params.push(`text${i + 1}`));
      }
    }

    // Add DataTable parameter if present
    if (hasDataTable) {
      params.push("dataTable");
    }

    // Add DocString parameter if present
    if (hasDocString) {
      params.push("docString");
    }

    if (params.length === 0) {
      return "()";
    }

    return `({ ${params.join(", ")} })`;
  }

  private async insertStub(uri: vscode.Uri, stubCode: string) {
    const document = await vscode.workspace.openTextDocument(uri);
    const lastLine = document.lineCount;
    const edit = new vscode.WorkspaceEdit();

    edit.insert(uri, new vscode.Position(lastLine, 0), stubCode);
    await vscode.workspace.applyEdit(edit);

    // Open the file and move cursor to the stub
    const editor = await vscode.window.showTextDocument(document);
    const newPosition = new vscode.Position(lastLine + 1, 0);
    editor.selection = new vscode.Selection(newPosition, newPosition);
    editor.revealRange(new vscode.Range(newPosition, newPosition));
  }
}
