import * as vscode from "vscode";

export type StepKeyword = "Given" | "When" | "Then" | "And" | "But" | "*";

export interface FeatureStep {
  keyword: StepKeyword;
  text: string;
  line: number;
  uri: vscode.Uri;
  scenarioName: string;
  featureName: string;
}

export interface StepDefinition {
  pattern: string;
  kind: "expression" | "regex";
  regexFlags?: string;
  keyword: StepKeyword | "any";
  uri: vscode.Uri;
  range: vscode.Range;
  functionName?: string;
}

export interface MatchResult {
  step: FeatureStep;
  matches: StepDefinition[];
  status: "matched" | "undefined" | "ambiguous";
}

export interface WorkspaceStats {
  totalFeatures: number;
  totalScenarios: number;
  totalSteps: number;
  undefinedSteps: number;
  ambiguousSteps: number;
  unusedDefinitions: number;
}

export interface Feature {
  name: string;
  uri: vscode.Uri;
  scenarios: Scenario[];
  tags: string[];
}

export interface Scenario {
  name: string;
  steps: FeatureStep[];
  line: number;
  tags: string[];
}

export type MatchMode = "both" | "regex" | "expression";
