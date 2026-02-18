import * as vscode from "vscode";
import * as Gherkin from "@cucumber/gherkin";
import * as Messages from "@cucumber/messages";
import { Feature, Scenario, FeatureStep, StepKeyword } from "./types";

export class GherkinParser {
  async parseFeature(
    uri: vscode.Uri,
    content: string,
  ): Promise<Feature | null> {
    try {
      const uuidFn = Messages.IdGenerator.uuid();
      const builder = new Gherkin.AstBuilder(uuidFn);
      const matcher = new Gherkin.GherkinClassicTokenMatcher();

      const parser = new Gherkin.Parser(builder, matcher);
      const gherkinDocument = parser.parse(content);

      return this.convertToFeature(gherkinDocument, uri);
    } catch (error) {
      console.error(`Failed to parse feature file ${uri.fsPath}:`, error);
      return null;
    }
  }

  private convertToFeature(
    gherkinDocument: Messages.GherkinDocument,
    uri: vscode.Uri,
  ): Feature | null {
    if (!gherkinDocument.feature) {
      return null;
    }

    const gherkinFeature = gherkinDocument.feature;
    const scenarios: Scenario[] = [];

    for (const child of gherkinFeature.children) {
      if (child.scenario) {
        const scenario = child.scenario;
        const steps: FeatureStep[] = scenario.steps.map((step: any) => ({
          keyword: this.normalizeKeyword(step.keyword.trim()),
          text: step.text,
          line: step.location.line,
          uri,
          scenarioName: scenario.name,
          featureName: gherkinFeature.name,
        }));

        scenarios.push({
          name: scenario.name,
          steps,
          line: scenario.location.line,
        });
      } else if (child.background) {
        // Handle background steps
        const background = child.background;
        const steps: FeatureStep[] = background.steps.map((step: any) => ({
          keyword: this.normalizeKeyword(step.keyword.trim()),
          text: step.text,
          line: step.location.line,
          uri,
          scenarioName: "Background",
          featureName: gherkinFeature.name,
        }));

        scenarios.push({
          name: "Background",
          steps,
          line: background.location.line,
        });
      }
    }

    return {
      name: gherkinFeature.name,
      uri,
      scenarios,
    };
  }

  private normalizeKeyword(keyword: string): StepKeyword {
    const normalized = keyword.replace(/\s+/g, "");
    switch (normalized) {
      case "Given":
      case "When":
      case "Then":
      case "And":
      case "But":
      case "*":
        return normalized as StepKeyword;
      default:
        return "Given"; // Default fallback
    }
  }
}
