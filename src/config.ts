import * as vscode from "vscode";
import { MatchMode } from "./types";

export class Config {
  private static readonly SECTION = "cucumberDash";

  static getFeatureGlobs(): string[] {
    return this.get<string[]>("featureGlobs", [
      "features/**/*.feature",
      "**/*.feature",
    ]);
  }

  static getStepDefGlobs(): string[] {
    return this.get<string[]>("stepDefGlobs", [
      "**/*.{steps,step,stepdefs}.{ts,js}",
      "**/*steps*/**/*.{ts,js}",
    ]);
  }

  static getExcludeGlobs(): string[] {
    return this.get<string[]>("excludeGlobs", [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
    ]);
  }

  static getEnableDiagnostics(): boolean {
    return this.get<boolean>("enableDiagnostics", true);
  }

  static getMatchMode(): MatchMode {
    return this.get<MatchMode>("matchMode", "both");
  }

  private static get<T>(key: string, defaultValue: T): T {
    const config = vscode.workspace.getConfiguration(this.SECTION);
    return config.get<T>(key, defaultValue);
  }

  static onDidChange(callback: () => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(this.SECTION)) {
        callback();
      }
    });
  }
}
