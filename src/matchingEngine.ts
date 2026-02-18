import {
  FeatureStep,
  StepDefinition,
  MatchResult,
  MatchMode,
  StepKeyword,
} from "./types";

export class MatchingEngine {
  constructor(private matchMode: MatchMode) {}

  matchSteps(
    steps: FeatureStep[],
    definitions: StepDefinition[],
  ): MatchResult[] {
    // Early exit if no work to do
    if (steps.length === 0) {
      return [];
    }

    if (definitions.length === 0) {
      return steps.map((step) => ({
        step,
        matches: [],
        status: "undefined" as const,
      }));
    }

    return steps.map((step) => this.matchStep(step, definitions));
  }

  private matchStep(
    step: FeatureStep,
    definitions: StepDefinition[],
  ): MatchResult {
    const matches: StepDefinition[] = [];

    for (const def of definitions) {
      // Check keyword compatibility
      if (!this.isKeywordCompatible(step.keyword, def.keyword)) {
        continue;
      }

      // Check pattern match based on kind and mode
      if (this.isMatch(step.text, def)) {
        matches.push(def);
      }
    }

    let status: "matched" | "undefined" | "ambiguous";
    if (matches.length === 0) {
      status = "undefined";
    } else if (matches.length === 1) {
      status = "matched";
    } else {
      status = "ambiguous";
    }

    return { step, matches, status };
  }

  private isKeywordCompatible(
    stepKeyword: StepKeyword,
    defKeyword: StepKeyword | "any",
  ): boolean {
    if (defKeyword === "any") {
      return true;
    }

    // And/But can match any keyword
    if (stepKeyword === "And" || stepKeyword === "But" || stepKeyword === "*") {
      return true;
    }

    return stepKeyword === defKeyword;
  }

  private isMatch(stepText: string, def: StepDefinition): boolean {
    if (def.kind === "regex") {
      if (this.matchMode === "expression") {
        return false;
      }
      return this.matchRegex(stepText, def.pattern, def.regexFlags);
    } else {
      if (this.matchMode === "regex") {
        return false;
      }
      return this.matchCucumberExpression(stepText, def.pattern);
    }
  }

  private matchRegex(
    stepText: string,
    pattern: string,
    flags?: string,
  ): boolean {
    try {
      const regex = new RegExp(pattern, flags);
      return regex.test(stepText);
    } catch (error) {
      console.error(`Invalid regex pattern: ${pattern}`, error);
      return false;
    }
  }

  private matchCucumberExpression(stepText: string, pattern: string): boolean {
    try {
      const regexPattern = this.convertCucumberExpressionToRegex(pattern);
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(stepText);
    } catch (error) {
      console.error(`Failed to match cucumber expression: ${pattern}`, error);
      return false;
    }
  }

  private convertCucumberExpressionToRegex(expression: string): string {
    let regex = expression;

    // Escape special regex characters except for parameter types
    regex = regex.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Convert Cucumber expression parameter types to regex
    // {int} -> any integer (positive or negative)
    regex = regex.replace(/\\\{int\\\}/g, "(-?\\d+)");

    // {float} -> any float (positive or negative)
    regex = regex.replace(/\\\{float\\\}/g, "(-?\\d+(?:\\.\\d+)?)");

    // {word} -> any single word (no spaces)
    regex = regex.replace(/\\\{word\\\}/g, "(\\S+)");

    // {string} -> quoted string or single word
    regex = regex.replace(
      /\\\{string\\\}/g,
      "(?:\"([^\"]*)\"|'([^']*)'|(\\S+))",
    );

    // {} -> any text (greedy)
    regex = regex.replace(/\\\{\\\}/g, "(.+)");

    return regex;
  }

  updateMatchMode(mode: MatchMode) {
    this.matchMode = mode;
  }
}
