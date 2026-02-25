import * as vscode from "vscode";
import { WorkspaceIndex } from "./workspaceIndex";
import { Feature, FeatureStep, StepDefinition, MatchResult } from "./types";

export interface DashboardData {
  metadata: {
    workspaceName: string;
    workspaceFolderUri: string;
    lastIndexed: string;
  };
  totals: {
    totalFeatures: number;
    totalScenarios: number;
    totalSteps: number;
    undefinedSteps: number;
    ambiguousSteps: number;
    unusedDefinitions: number;
    matchRate: number;
  };
  tags: {
    allTags: string[];
    undefinedByTag: Array<{ tag: string; count: number }>;
    stepsByTag: Array<{ tag: string; count: number }>;
  };
  features: Array<{
    id: string;
    name: string;
    uri: string;
    tags: string[];
    undefinedCount: number;
  }>;
  steps: Array<{
    id: string;
    keyword: string;
    text: string;
    status: "matched" | "undefined" | "ambiguous";
    featureId: string;
    featureName: string;
    scenarioName: string;
    uri: string;
    line: number;
    matchDefIds: string[];
    effectiveTags: string[];
  }>;
  definitions: Array<{
    id: string;
    kind: "expression" | "regex";
    pattern: string;
    uri: string;
    line: number;
    usageCount: number;
  }>;
}

export class DashboardDataBuilder {
  constructor(private index: WorkspaceIndex) {}

  build(): DashboardData {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const workspaceName = workspaceFolder?.name || "Workspace";
    const workspaceFolderUri = workspaceFolder?.uri.toString() || "";

    const stats = this.index.getStats();
    const matchRate =
      stats.totalSteps > 0
        ? Math.round(
            ((stats.totalSteps - stats.undefinedSteps - stats.ambiguousSteps) /
              stats.totalSteps) *
              100,
          )
        : 100;

    const allTags = this.getAllTags();
    const undefinedByTag = this.getUndefinedByTag();
    const stepsByTag = this.getStepsByTag();

    const features = this.buildFeaturesArray();
    const steps = this.buildStepsArray();
    const definitions = this.buildDefinitionsArray();

    return {
      metadata: {
        workspaceName,
        workspaceFolderUri,
        lastIndexed: new Date().toISOString(),
      },
      totals: {
        totalFeatures: stats.totalFeatures,
        totalScenarios: stats.totalScenarios,
        totalSteps: stats.totalSteps,
        undefinedSteps: stats.undefinedSteps,
        ambiguousSteps: stats.ambiguousSteps,
        unusedDefinitions: stats.unusedDefinitions,
        matchRate,
      },
      tags: {
        allTags,
        undefinedByTag,
        stepsByTag,
      },
      features,
      steps,
      definitions,
    };
  }

  private getAllTags(): string[] {
    const tagSet = new Set<string>();
    const features = this.index.getFeatures();

    features.forEach((feature) => {
      feature.tags?.forEach((tag) => tagSet.add(this.normalizeTag(tag)));
      feature.scenarios.forEach((scenario) => {
        scenario.tags?.forEach((tag) => tagSet.add(this.normalizeTag(tag)));
      });
    });

    return Array.from(tagSet).sort();
  }

  private getUndefinedByTag(): Array<{ tag: string; count: number }> {
    const tagCounts = new Map<string, number>();
    const undefinedResults = this.index.getUndefinedSteps();

    undefinedResults.forEach((result) => {
      const tags = this.getEffectiveTags(result.step);
      tags.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  private getStepsByTag(): Array<{ tag: string; count: number }> {
    const tagCounts = new Map<string, number>();
    const matchResults = this.index.getMatchResults();

    matchResults.forEach((result) => {
      const tags = this.getEffectiveTags(result.step);
      tags.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  private buildFeaturesArray() {
    const features = this.index.getFeatures();
    const undefinedResults = this.index.getUndefinedSteps();

    return features.map((feature, index) => {
      const undefinedCount = undefinedResults.filter(
        (r) => r.step.uri.toString() === feature.uri.toString(),
      ).length;

      return {
        id: `feature-${index}`,
        name: feature.name,
        uri: feature.uri.toString(),
        tags: feature.tags || [],
        undefinedCount,
      };
    });
  }

  private buildStepsArray() {
    const matchResults = this.index.getMatchResults();
    const features = this.index.getFeatures();
    const featureMap = new Map(
      features.map((f, i) => [f.uri.toString(), { ...f, id: `feature-${i}` }]),
    );

    return matchResults.map((result, index) => {
      const feature = featureMap.get(result.step.uri.toString());
      const effectiveTags = this.getEffectiveTags(result.step);

      return {
        id: `step-${index}`,
        keyword: result.step.keyword,
        text: result.step.text,
        status: result.status,
        featureId: feature?.id || "",
        featureName: result.step.featureName || "",
        scenarioName: result.step.scenarioName || "",
        uri: result.step.uri.toString(),
        line: result.step.line,
        matchDefIds: result.matches.map((m, i) => `def-${i}`),
        effectiveTags,
      };
    });
  }

  private buildDefinitionsArray() {
    const allDefs = this.index.getAllStepDefinitions();
    const matchResults = this.index.getMatchResults();

    // Count usage for each definition
    const usageCounts = new Map<StepDefinition, number>();
    matchResults.forEach((result) => {
      if (result.status === "matched" || result.status === "ambiguous") {
        result.matches.forEach((def) => {
          usageCounts.set(def, (usageCounts.get(def) || 0) + 1);
        });
      }
    });

    return allDefs.map((def, index) => ({
      id: `def-${index}`,
      kind: def.kind,
      pattern: def.pattern,
      uri: def.uri.toString(),
      line: def.range.start.line + 1,
      usageCount: usageCounts.get(def) || 0,
    }));
  }

  private getEffectiveTags(step: FeatureStep): string[] {
    const features = this.index.getFeatures();
    const feature = features.find(
      (f) => f.uri.toString() === step.uri.toString(),
    );

    if (!feature) return [];

    const scenario = feature.scenarios.find(
      (s) => s.name === step.scenarioName,
    );
    const featureTags = feature.tags || [];
    const scenarioTags = scenario?.tags || [];

    const allTags = [...featureTags, ...scenarioTags];
    return Array.from(new Set(allTags.map((t) => this.normalizeTag(t))));
  }

  private normalizeTag(tag: string): string {
    // Ensure tag starts with @
    const normalized = tag.trim().startsWith("@")
      ? tag.trim()
      : `@${tag.trim()}`;
    // Keep original case for display
    return normalized;
  }
}
