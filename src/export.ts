import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { DashboardData } from "./dashboardData";

export class ExportService {
  constructor(private context: vscode.ExtensionContext) {}

  async exportJSON(data: DashboardData): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found");
      return;
    }

    const vscodeDir = path.join(workspaceFolder.uri.fsPath, ".vscode");
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    const jsonPath = path.join(vscodeDir, "cucumber-dashboard-report.json");

    // Add computed aggregates
    const exportData = {
      ...data,
      computed: {
        topUndefinedFeatures: this.getTopUndefinedFeatures(data),
        usageHistogram: this.getUsageHistogram(data),
      },
    };

    fs.writeFileSync(jsonPath, JSON.stringify(exportData, null, 2), "utf8");
    vscode.window.showInformationMessage(
      `Report exported to ${path.relative(workspaceFolder.uri.fsPath, jsonPath)}`,
    );
  }

  async exportHTML(data: DashboardData): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found");
      return;
    }

    const vscodeDir = path.join(workspaceFolder.uri.fsPath, ".vscode");
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    const htmlPath = path.join(vscodeDir, "cucumber-dashboard-report.html");
    const html = this.generateHTMLReport(data);

    fs.writeFileSync(htmlPath, html, "utf8");
    vscode.window.showInformationMessage(
      `HTML report exported to ${path.relative(workspaceFolder.uri.fsPath, htmlPath)}`,
    );
  }

  async persistHistory(data: DashboardData): Promise<void> {
    const config = vscode.workspace.getConfiguration("cucumberDash");
    const persistHistory = config.get<boolean>("persistHistory", false);

    if (!persistHistory) {
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }

    const vscodeDir = path.join(workspaceFolder.uri.fsPath, ".vscode");
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    const historyPath = path.join(vscodeDir, "cucumber-dashboard-history.json");

    let history: any[] = [];
    if (fs.existsSync(historyPath)) {
      try {
        const content = fs.readFileSync(historyPath, "utf8");
        history = JSON.parse(content);
      } catch (error) {
        console.error("Failed to read history:", error);
      }
    }

    const record = {
      timestamp: data.metadata.lastIndexed,
      matchRate: data.totals.matchRate,
      undefinedCount: data.totals.undefinedSteps,
      ambiguousCount: data.totals.ambiguousSteps,
      unusedCount: data.totals.unusedDefinitions,
      topUndefinedTags: data.tags.undefinedByTag.slice(0, 5),
    };

    history.push(record);

    // Keep last 30 records
    if (history.length > 30) {
      history = history.slice(-30);
    }

    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), "utf8");
  }

  readHistory(): any[] {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return [];
    }

    const historyPath = path.join(
      workspaceFolder.uri.fsPath,
      ".vscode",
      "cucumber-dashboard-history.json",
    );

    if (!fs.existsSync(historyPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(historyPath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      console.error("Failed to read history:", error);
      return [];
    }
  }

  private getTopUndefinedFeatures(data: DashboardData) {
    return data.features
      .filter((f) => f.undefinedCount > 0)
      .sort((a, b) => b.undefinedCount - a.undefinedCount)
      .slice(0, 10)
      .map((f) => ({
        feature: f.name,
        count: f.undefinedCount,
      }));
  }

  private getUsageHistogram(data: DashboardData) {
    const buckets = {
      "0": 0,
      "1": 0,
      "2-5": 0,
      "6-20": 0,
      "20+": 0,
    };

    data.definitions.forEach((def) => {
      const count = def.usageCount;
      if (count === 0) buckets["0"]++;
      else if (count === 1) buckets["1"]++;
      else if (count <= 5) buckets["2-5"]++;
      else if (count <= 20) buckets["6-20"]++;
      else buckets["20+"]++;
    });

    return buckets;
  }

  private generateHTMLReport(data: DashboardData): string {
    const topUndefinedFeatures = this.getTopUndefinedFeatures(data);
    const usageHistogram = this.getUsageHistogram(data);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cucumber Dashboard Report - ${data.metadata.workspaceName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #f5f5f5;
      color: #333;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #2c3e50; margin-bottom: 10px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 30px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .metric-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; }
    .metric-card.success { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
    .metric-card.warning { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .metric-card.info { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    .metric-value { font-size: 36px; font-weight: bold; margin-bottom: 5px; }
    .metric-label { font-size: 14px; opacity: 0.9; }
    .section { margin-bottom: 40px; }
    h2 { color: #2c3e50; margin-bottom: 20px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: 600; color: #2c3e50; }
    tr:hover { background: #f8f9fa; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge.matched { background: #d4edda; color: #155724; }
    .badge.undefined { background: #f8d7da; color: #721c24; }
    .badge.ambiguous { background: #fff3cd; color: #856404; }
    .tag { display: inline-block; padding: 3px 8px; margin: 2px; background: #e9ecef; border-radius: 3px; font-size: 11px; }
    .chart-container { margin: 30px 0; }
    canvas { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Cucumber Dashboard Report</h1>
    <div class="meta">
      <strong>Workspace:</strong> ${data.metadata.workspaceName}<br>
      <strong>Generated:</strong> ${new Date(data.metadata.lastIndexed).toLocaleString()}
    </div>

    <div class="metrics">
      <div class="metric-card info">
        <div class="metric-value">${data.totals.totalFeatures}</div>
        <div class="metric-label">Total Features</div>
      </div>
      <div class="metric-card info">
        <div class="metric-value">${data.totals.totalScenarios}</div>
        <div class="metric-label">Total Scenarios</div>
      </div>
      <div class="metric-card info">
        <div class="metric-value">${data.totals.totalSteps}</div>
        <div class="metric-label">Total Steps</div>
      </div>
      <div class="metric-card warning">
        <div class="metric-value">${data.totals.undefinedSteps}</div>
        <div class="metric-label">Undefined Steps</div>
      </div>
      <div class="metric-card warning">
        <div class="metric-value">${data.totals.ambiguousSteps}</div>
        <div class="metric-label">Ambiguous Steps</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${data.totals.unusedDefinitions}</div>
        <div class="metric-label">Unused Definitions</div>
      </div>
      <div class="metric-card success">
        <div class="metric-value">${data.totals.matchRate}%</div>
        <div class="metric-label">Match Rate</div>
      </div>
    </div>

    <div class="section">
      <h2>Top Undefined Features</h2>
      <table>
        <thead>
          <tr>
            <th>Feature</th>
            <th>Undefined Steps</th>
          </tr>
        </thead>
        <tbody>
          ${topUndefinedFeatures.map((f) => `<tr><td>${f.feature}</td><td>${f.count}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Step Definition Usage Distribution</h2>
      <table>
        <thead>
          <tr>
            <th>Usage Count</th>
            <th>Definitions</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(usageHistogram)
            .map(
              ([bucket, count]) =>
                `<tr><td>${bucket}</td><td>${count}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Top Tags with Undefined Steps</h2>
      <table>
        <thead>
          <tr>
            <th>Tag</th>
            <th>Undefined Steps</th>
          </tr>
        </thead>
        <tbody>
          ${data.tags.undefinedByTag
            .slice(0, 10)
            .map((t) => `<tr><td>${t.tag}</td><td>${t.count}</td></tr>`)
            .join("")}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>All Steps</h2>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Step</th>
            <th>Tags</th>
            <th>Feature</th>
            <th>Scenario</th>
            <th>Line</th>
          </tr>
        </thead>
        <tbody>
          ${data.steps
            .slice(0, 500)
            .map(
              (s) => `
            <tr>
              <td><span class="badge ${s.status}">${s.status}</span></td>
              <td>${s.keyword} ${s.text}</td>
              <td>${s.effectiveTags.map((t) => `<span class="tag">${t}</span>`).join("")}</td>
              <td>${s.featureName}</td>
              <td>${s.scenarioName}</td>
              <td>${s.line}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
      ${data.steps.length > 500 ? `<p style="margin-top: 10px; color: #666;">Showing first 500 of ${data.steps.length} steps</p>` : ""}
    </div>

    <div class="section">
      <h2>Unused Step Definitions</h2>
      <table>
        <thead>
          <tr>
            <th>Pattern</th>
            <th>File</th>
            <th>Line</th>
          </tr>
        </thead>
        <tbody>
          ${data.definitions
            .filter((d) => d.usageCount === 0)
            .map(
              (d) => `
            <tr>
              <td>${d.pattern}</td>
              <td>${vscode.Uri.parse(d.uri).fsPath}</td>
              <td>${d.line}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
  }
}
