import * as vscode from "vscode";
import {
  Feature,
  FeatureStep,
  StepDefinition,
  MatchResult,
  WorkspaceStats,
} from "./types";

export class WorkspaceIndex {
  private features: Map<string, Feature> = new Map();
  private stepDefinitions: Map<string, StepDefinition[]> = new Map();
  private matchResults: MatchResult[] = [];

  clear() {
    this.features.clear();
    this.stepDefinitions.clear();
    this.matchResults = [];
  }

  // Feature management
  setFeature(uri: vscode.Uri, feature: Feature) {
    this.features.set(uri.toString(), feature);
  }

  removeFeature(uri: vscode.Uri) {
    this.features.delete(uri.toString());
  }

  getFeatures(): Feature[] {
    return Array.from(this.features.values());
  }

  getFeature(uri: vscode.Uri): Feature | undefined {
    return this.features.get(uri.toString());
  }

  // Step definition management
  setStepDefinitions(uri: vscode.Uri, definitions: StepDefinition[]) {
    this.stepDefinitions.set(uri.toString(), definitions);
  }

  removeStepDefinitions(uri: vscode.Uri) {
    this.stepDefinitions.delete(uri.toString());
  }

  getAllStepDefinitions(): StepDefinition[] {
    const allDefs: StepDefinition[] = [];
    for (const defs of this.stepDefinitions.values()) {
      allDefs.push(...defs);
    }
    return allDefs;
  }

  getStepDefinitionsByFile(): Map<string, StepDefinition[]> {
    return new Map(this.stepDefinitions);
  }

  // Match results
  setMatchResults(results: MatchResult[]) {
    this.matchResults = results;
  }

  /**
   * Update match results for a specific feature (incremental)
   */
  updateFeatureMatchResults(uri: vscode.Uri, newResults: MatchResult[]) {
    // Remove old results for this feature
    this.matchResults = this.matchResults.filter(
      (r) => r.step.uri.toString() !== uri.toString(),
    );
    // Add new results
    this.matchResults.push(...newResults);
  }

  getMatchResults(): MatchResult[] {
    return this.matchResults;
  }

  getUndefinedSteps(): MatchResult[] {
    return this.matchResults.filter((r) => r.status === "undefined");
  }

  getAmbiguousSteps(): MatchResult[] {
    return this.matchResults.filter((r) => r.status === "ambiguous");
  }

  getUnusedDefinitions(): StepDefinition[] {
    const usedDefs = new Set<StepDefinition>();
    this.matchResults.forEach((r) => {
      if (r.status === "matched" || r.status === "ambiguous") {
        r.matches.forEach((def) => usedDefs.add(def));
      }
    });

    const allDefs = this.getAllStepDefinitions();
    return allDefs.filter((def) => !usedDefs.has(def));
  }

  // Statistics
  getStats(): WorkspaceStats {
    const features = this.getFeatures();
    let totalScenarios = 0;
    let totalSteps = 0;

    features.forEach((f) => {
      totalScenarios += f.scenarios.length;
      f.scenarios.forEach((s) => {
        totalSteps += s.steps.length;
      });
    });

    return {
      totalFeatures: features.length,
      totalScenarios,
      totalSteps,
      undefinedSteps: this.getUndefinedSteps().length,
      ambiguousSteps: this.getAmbiguousSteps().length,
      unusedDefinitions: this.getUnusedDefinitions().length,
    };
  }

  getAllSteps(): FeatureStep[] {
    const steps: FeatureStep[] = [];
    this.features.forEach((feature) => {
      feature.scenarios.forEach((scenario) => {
        steps.push(...scenario.steps);
      });
    });
    return steps;
  }
}
