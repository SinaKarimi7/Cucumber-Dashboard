import * as vscode from "vscode";
import * as ts from "typescript";
import { StepDefinition, StepKeyword } from "./types";

export class StepDefinitionExtractor {
  private readonly STEP_FUNCTION_NAMES = [
    "Given",
    "When",
    "Then",
    "defineStep",
    "Step",
  ];

  async extractDefinitions(
    uri: vscode.Uri,
    content: string,
  ): Promise<StepDefinition[]> {
    const definitions: StepDefinition[] = [];

    try {
      const sourceFile = ts.createSourceFile(
        uri.fsPath,
        content,
        ts.ScriptTarget.Latest,
        true,
      );

      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
          const def = this.extractFromCallExpression(node, uri, sourceFile);
          if (def) {
            definitions.push(def);
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    } catch (error) {
      console.error(
        `Failed to parse step definition file ${uri.fsPath}:`,
        error,
      );
    }

    return definitions;
  }

  private extractFromCallExpression(
    node: ts.CallExpression,
    uri: vscode.Uri,
    sourceFile: ts.SourceFile,
  ): StepDefinition | null {
    // Check if this is a step definition call
    const functionName = this.getFunctionName(node.expression);
    if (!functionName || !this.STEP_FUNCTION_NAMES.includes(functionName)) {
      return null;
    }

    // First argument should be pattern (string or regex)
    if (node.arguments.length === 0) {
      return null;
    }

    const firstArg = node.arguments[0];
    const pattern = this.extractPattern(firstArg);

    if (!pattern) {
      return null;
    }

    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    return {
      pattern: pattern.pattern,
      kind: pattern.kind,
      regexFlags: pattern.flags,
      keyword: this.mapKeyword(functionName),
      uri,
      range: new vscode.Range(
        new vscode.Position(start.line, start.character),
        new vscode.Position(end.line, end.character),
      ),
      functionName,
    };
  }

  private getFunctionName(expr: ts.Expression): string | null {
    if (ts.isIdentifier(expr)) {
      return expr.text;
    }
    if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) {
      return expr.name.text;
    }
    return null;
  }

  private extractPattern(
    node: ts.Node,
  ): { pattern: string; kind: "expression" | "regex"; flags?: string } | null {
    // String literal
    if (ts.isStringLiteral(node)) {
      return { pattern: node.text, kind: "expression" };
    }

    // Template literal without expressions
    if (
      ts.isTemplateExpression(node) ||
      ts.isNoSubstitutionTemplateLiteral(node)
    ) {
      if (ts.isNoSubstitutionTemplateLiteral(node)) {
        return { pattern: node.text, kind: "expression" };
      }
      // Skip template literals with expressions
      return null;
    }

    // Regex literal
    if (ts.isRegularExpressionLiteral(node)) {
      const text = node.text;
      const lastSlash = text.lastIndexOf("/");
      const pattern = text.substring(1, lastSlash);
      const flags = text.substring(lastSlash + 1);
      return { pattern, kind: "regex", flags: flags || undefined };
    }

    return null;
  }

  private mapKeyword(functionName: string): StepKeyword | "any" {
    switch (functionName) {
      case "Given":
        return "Given";
      case "When":
        return "When";
      case "Then":
        return "Then";
      default:
        return "any";
    }
  }
}
