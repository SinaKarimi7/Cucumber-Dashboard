import * as vscode from "vscode";
import { IndexerService } from "./indexer";
import { DashboardDataBuilder, DashboardData } from "./dashboardData";
import { ExportService } from "./export";

export class DashboardWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private exportService: ExportService;

  constructor(
    private context: vscode.ExtensionContext,
    private indexer: IndexerService,
  ) {
    this.exportService = new ExportService(context);

    // Listen for theme changes
    vscode.window.onDidChangeActiveColorTheme(() => {
      if (this.panel) {
        this.panel.webview.postMessage({ type: "themeChanged" });
      }
    });
  }

  public async openDashboard() {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      await this.sendDashboardData();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "cucumberDashboard",
      "Cucumber Dashboard",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.context.extensionUri],
      },
    );

    this.panel.iconPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      "resources",
      "icon.png",
    );

    this.panel.webview.html = this.getWebviewContent(this.panel.webview);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleMessage(message);
      },
      undefined,
      this.context.subscriptions,
    );

    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      undefined,
      this.context.subscriptions,
    );

    await this.sendDashboardData();
  }

  private async handleMessage(message: any) {
    switch (message.type) {
      case "reindex":
        await this.indexer.reindex();
        await this.sendDashboardData();
        break;

      case "openStep":
        await this.openFile(message.uri, message.line);
        break;

      case "openDefinition":
        await this.openFile(message.uri, message.line);
        break;

      case "generateStub":
        await this.generateStub(message.stepId);
        break;

      case "showMatches":
        await this.showMatches(message.stepId);
        break;

      case "exportJson":
        const jsonData = this.buildDashboardData();
        await this.exportService.exportJSON(jsonData);
        break;

      case "exportHtml":
        const htmlData = this.buildDashboardData();
        await this.exportService.exportHTML(htmlData);
        break;

      case "ready":
        await this.sendDashboardData();
        break;
    }
  }

  private async sendDashboardData() {
    if (!this.panel) return;

    const data = this.buildDashboardData();
    const history = this.exportService.readHistory();

    this.panel.webview.postMessage({
      type: "dashboardData",
      data,
      history,
    });

    // Persist history if enabled
    await this.exportService.persistHistory(data);
  }

  private buildDashboardData(): DashboardData {
    const builder = new DashboardDataBuilder(this.indexer.getIndex());
    return builder.build();
  }

  private async openFile(uriString: string, line: number) {
    try {
      const uri = vscode.Uri.parse(uriString);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);
      const position = new vscode.Position(line - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter,
      );
    } catch (error) {
      console.error("Failed to open file:", error);
      vscode.window.showErrorMessage(`Failed to open file: ${error}`);
    }
  }

  private async generateStub(stepId: string) {
    const data = this.buildDashboardData();
    const step = data.steps.find((s) => s.id === stepId);

    if (!step || step.status !== "undefined") {
      vscode.window.showErrorMessage("Step not found or already defined");
      return;
    }

    // Execute the existing generate stub command
    await vscode.commands.executeCommand(
      "cucumberDash.generateStub",
      vscode.Uri.parse(step.uri),
      step.line - 1,
    );
  }

  private async showMatches(stepId: string) {
    const data = this.buildDashboardData();
    const step = data.steps.find((s) => s.id === stepId);

    if (!step || step.status !== "ambiguous") {
      vscode.window.showErrorMessage("Step not found or not ambiguous");
      return;
    }

    const matchDefs = data.definitions.filter((d) =>
      step.matchDefIds.includes(d.id),
    );

    const items = matchDefs.map((def) => ({
      label: def.pattern,
      description: `${vscode.Uri.parse(def.uri).fsPath}:${def.line}`,
      def,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a matching step definition to view",
    });

    if (selected) {
      await this.openFile(selected.def.uri, selected.def.line);
    }
  }

  private getWebviewContent(webview: vscode.Webview): string {
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cucumber Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      padding: 20px;
      overflow-x: hidden;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .header-left h1 {
      font-size: 24px;
      margin-bottom: 8px;
    }

    .header-left .meta {
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
    }

    .header-right {
      display: flex;
      gap: 10px;
    }

    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-family: var(--vscode-font-family);
      font-weight: 500;
    }

    button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    button:active {
      opacity: 0.8;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }

    .metric-card {
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 20px;
      cursor: pointer;
      transition: transform 0.2s, border-color 0.2s;
    }

    .metric-card:hover {
      transform: translateY(-2px);
      border-color: var(--vscode-focusBorder);
    }

    .metric-value {
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 5px;
    }

    .metric-label {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
    }

    .metric-card.error .metric-value {
      color: var(--vscode-errorForeground);
    }

    .metric-card.warning .metric-value {
      color: var(--vscode-notificationsWarningIcon-foreground);
    }

    .metric-card.success .metric-value {
      color: var(--vscode-terminal-ansiGreen);
    }

    .filters {
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 30px;
    }

    .filter-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 15px;
      margin-bottom: 15px;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .filter-group label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      font-weight: 600;
    }

    input, select {
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 6px 10px;
      border-radius: 4px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
    }

    input:focus, select:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }

    .tag-filter {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .tag-controls {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
    }

    .tag-controls select {
      flex: 1;
    }

    .tag-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
      min-height: 30px;
    }

    .chip {
      background: #0078d4;
      color: #ffffff;
      padding: 5px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .chip button {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: #ffffff;
      padding: 0;
      width: 18px;
      height: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-weight: bold;
      font-size: 14px;
    }

    .chip button:hover {
      background: rgba(255, 255, 255, 0.4);
    }

    .filter-actions {
      display: flex;
      gap: 10px;
      justify-content: space-between;
      margin-top: 15px;
    }

    .section {
      margin-bottom: 40px;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .section-header h2 {
      font-size: 18px;
      border-bottom: 2px solid var(--vscode-focusBorder);
      padding-bottom: 8px;
    }

    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .chart-container {
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 20px;
    }

    .chart-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 15px;
      color: var(--vscode-editor-foreground);
    }

    canvas {
      max-width: 100%;
      display: block;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      overflow: hidden;
    }

    thead {
      background: var(--vscode-editorWidget-background);
    }

    th {
      text-align: left;
      padding: 12px;
      font-weight: 600;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      font-size: 13px;
    }

    tbody tr {
      cursor: pointer;
    }

    tbody tr:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge.matched {
      background: #4ade80;
      color: #000000;
    }

    .badge.undefined {
      background: #ef4444;
      color: #ffffff;
    }

    .badge.ambiguous {
      background: #f59e0b;
      color: #000000;
    }

    .tag {
      display: inline-block;
      padding: 3px 8px;
      margin: 2px;
      background: #0078d4;
      color: #ffffff;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
    }

    .actions {
      display: flex;
      gap: 8px;
    }

    .action-btn {
      padding: 4px 10px;
      font-size: 12px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-family: var(--vscode-font-family);
      font-weight: 500;
    }

    .action-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
      margin-top: 20px;
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: var(--vscode-descriptionForeground);
    }

    .trend-chart {
      grid-column: 1 / -1;
    }

    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 40px;
      color: var(--vscode-descriptionForeground);
    }

    .tag-stats {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 10px;
      margin-bottom: 20px;
    }

    .tag-stat-card {
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 12px;
      cursor: pointer;
      transition: transform 0.2s;
    }

    .tag-stat-card:hover {
      transform: translateY(-2px);
      border-color: var(--vscode-focusBorder);
    }

    .tag-stat-name {
      font-weight: 600;
      color: var(--vscode-editor-foreground);
      margin-bottom: 4px;
    }

    .tag-stat-count {
      font-size: 20px;
      font-weight: bold;
      color: var(--vscode-charts-blue);
    }

    .expand-chart-btn {
      padding: 4px 10px;
      font-size: 16px;
      float: right;
      background: #0078d4;
      color: #ffffff;
      font-weight: bold;
      border: none;
      cursor: pointer;
      border-radius: 4px;
    }

    .expand-chart-btn:hover {
      background: #106ebe;
    }

    .chart-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 1000;
      justify-content: center;
      align-items: center;
    }

    .chart-modal.show {
      display: flex;
    }

    .chart-modal-content {
      background: var(--vscode-editor-background);
      border: 2px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 20px;
      max-width: 90%;
      max-height: 90%;
      position: relative;
    }

    .chart-modal-close {
      position: absolute;
      top: 10px;
      right: 10px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      cursor: pointer;
      border-radius: 4px;
      font-size: 16px;
    }

    .chart-modal canvas {
      max-width: 100%;
      max-height: 70vh;
    }

    .chart-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .tag {
      cursor: pointer;
    }

    .tag:hover {
      opacity: 0.8;
      text-decoration: underline;
    }

    tbody tr {
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1 id="workspaceName">Cucumber Dashboard</h1>
      <div class="meta">
        Last indexed: <span id="lastIndexed">-</span>
      </div>
    </div>
    <div class="header-right">
      <button id="reindexBtn">🔄 Reindex</button>
      <button id="exportJsonBtn">📄 Export JSON</button>
      <button id="exportHtmlBtn">🌐 Export HTML</button>
    </div>
  </div>

  <div class="metrics" id="metrics">
    <!-- Populated by JS -->
  </div>

  <div class="section">
    <div class="section-header">
      <h2>Tag Statistics</h2>
    </div>
    <div class="tag-stats" id="tagStats">
      <!-- Populated by JS -->
    </div>
  </div>

  <div class="filters">
    <div class="filter-row">
      <div class="filter-group">
        <label for="searchInput">Search Steps</label>
        <input type="text" id="searchInput" placeholder="Type to filter step text...">
      </div>
      <div class="filter-group">
        <label for="featureFilter">Feature File</label>
        <select id="featureFilter">
          <option value="">All Features</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="statusFilter">Status</label>
        <select id="statusFilter">
          <option value="">All Statuses</option>
          <option value="undefined">Undefined</option>
          <option value="ambiguous">Ambiguous</option>
          <option value="matched">Matched</option>
        </select>
      </div>
    </div>

    <div class="tag-filter">
      <div class="filter-group">
        <label>Tags</label>
        <div class="tag-controls">
          <select id="tagSelect">
            <option value="">Select a tag...</option>
          </select>
          <button id="addTagBtn">Add Tag</button>
          <select id="tagMode">
            <option value="OR">Any selected tags (OR)</option>
            <option value="AND">All selected tags (AND)</option>
          </select>
        </div>
        <div class="tag-chips" id="selectedTags"></div>
      </div>
    </div>

    <div class="filter-actions">
      <button id="clearFiltersBtn">Clear Filters</button>
      <span id="filterCount">Showing 0 steps</span>
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <h2>Steps</h2>
    </div>
    <table id="stepsTable">
      <thead>
        <tr>
          <th>Status</th>
          <th>Step</th>
          <th>Tags</th>
          <th>Feature</th>
          <th>Scenario</th>
          <th>Line</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="stepsTableBody">
        <!-- Populated by JS -->
      </tbody>
    </table>
    <div class="pagination" id="stepsPagination"></div>
  </div>

  <div class="section">
    <div class="section-header">
      <h2>Charts</h2>
    </div>
    <div class="charts-grid">
      <div class="chart-container">
        <div class="chart-title">
          Undefined Steps by Feature (Top 10)
          <button class="expand-chart-btn" type="button" onclick="expandChart('undefinedByFeatureChart'); event.stopPropagation();">⛶</button>
        </div>
        <canvas id="undefinedByFeatureChart"></canvas>
      </div>
      <div class="chart-container">
        <div class="chart-title">
          Step Definition Usage Distribution
          <button class="expand-chart-btn" type="button" onclick="expandChart('usageHistogramChart'); event.stopPropagation();">⛶</button>
        </div>
        <canvas id="usageHistogramChart"></canvas>
      </div>
      <div class="chart-container">
        <div class="chart-title">
          Step Status Distribution
          <button class="expand-chart-btn" type="button" onclick="expandChart('statusPieChart'); event.stopPropagation();">⛶</button>
        </div>
        <canvas id="statusPieChart"></canvas>
      </div>
      <div class="chart-container">
        <div class="chart-title">
          Undefined Steps by Tag (Top 10)
          <button class="expand-chart-btn" type="button" onclick="expandChart('undefinedByTagChart'); event.stopPropagation();">⛶</button>
        </div>
        <canvas id="undefinedByTagChart"></canvas>
      </div>
      <div class="chart-container trend-chart" id="trendChartContainer" style="display: none;">
        <div class="chart-title">
          Match Rate Trend (Last 30 Indexes)
          <button class="expand-chart-btn" type="button" onclick="expandChart('trendChart'); event.stopPropagation();">⛶</button>
        </div>
        <canvas id="trendChart"></canvas>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <h2>Unused Step Definitions</h2>
    </div>
    <table id="unusedDefsTable">
      <thead>
        <tr>
          <th>Pattern</th>
          <th>File</th>
          <th>Line</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="unusedDefsTableBody">
        <!-- Populated by JS -->
      </tbody>
    </table>
  </div>

  <div class="chart-modal" id="chartModal">
    <div class="chart-modal-content">
      <button class="chart-modal-close" onclick="closeChartModal()">✕ Close</button>
      <div style="margin-top: 40px;">
        <canvas id="expandedChart"></canvas>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    ${this.getWebviewScript()}
  </script>
</body>
</html>`;
  }

  private getWebviewScript(): string {
    return `
    const vscode = acquireVsCodeApi();

    let dashboardData = null;
    let history = [];
    let selectedTags = [];
    let currentPage = 0;
    const PAGE_SIZE = 500;

    // Initialize
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'dashboardData':
          dashboardData = message.data;
          history = message.history || [];
          render();
          break;
        case 'themeChanged':
          renderCharts();
          break;
      }
    });

    window.addEventListener('load', () => {
      vscode.postMessage({ type: 'ready' });
    });

    // Event listeners
    document.getElementById('reindexBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'reindex' });
    });

    document.getElementById('exportJsonBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'exportJson' });
    });

    document.getElementById('exportHtmlBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'exportHtml' });
    });

    document.getElementById('addTagBtn').addEventListener('click', () => {
      const select = document.getElementById('tagSelect');
      const tag = select.value;
      if (tag && !selectedTags.includes(tag)) {
        selectedTags.push(tag);
        renderSelectedTags();
        filterSteps();
      }
    });

    document.getElementById('clearFiltersBtn').addEventListener('click', () => {
      document.getElementById('searchInput').value = '';
      document.getElementById('featureFilter').value = '';
      document.getElementById('statusFilter').value = '';
      selectedTags = [];
      renderSelectedTags();
      filterSteps();
    });

    document.getElementById('searchInput').addEventListener('input', filterSteps);
    document.getElementById('featureFilter').addEventListener('change', filterSteps);
    document.getElementById('statusFilter').addEventListener('change', filterSteps);
    document.getElementById('tagMode').addEventListener('change', filterSteps);

    function render() {
      if (!dashboardData) return;

      document.getElementById('workspaceName').textContent = dashboardData.metadata.workspaceName;
      document.getElementById('lastIndexed').textContent = formatDate(dashboardData.metadata.lastIndexed);

      renderMetrics();
      renderTagStats();
      populateFilters();
      renderCharts();
      renderStepsTable();
      renderUnusedDefinitions();
      filterSteps();
    }

    function renderTagStats() {
      const tagStats = dashboardData.tags.stepsByTag.slice(0, 20);
      const statsEl = document.getElementById('tagStats');

      if (tagStats.length === 0) {
        statsEl.innerHTML = '<div class="empty-state">No tags found</div>';
        return;
      }

      statsEl.innerHTML = tagStats.map(t => \`
        <div class="tag-stat-card" onclick="filterByTag('\${escapeHtml(t.tag)}')">
          <div class="tag-stat-name">\${escapeHtml(t.tag)}</div>
          <div class="tag-stat-count">\${t.count} steps</div>
        </div>
      \`).join('');
    }

    function filterByTag(tag) {
      if (!selectedTags.includes(tag)) {
        selectedTags.push(tag);
        renderSelectedTags();
        filterSteps();
      }
      document.getElementById('stepsTable').scrollIntoView({ behavior: 'smooth' });
    }

    function renderMetrics() {
      const metrics = [
        { label: 'Total Features', value: dashboardData.totals.totalFeatures, filter: '' },
        { label: 'Total Scenarios', value: dashboardData.totals.totalScenarios, filter: '' },
        { label: 'Total Steps', value: dashboardData.totals.totalSteps, filter: '' },
        { label: 'Undefined Steps', value: dashboardData.totals.undefinedSteps, filter: 'undefined', class: 'error' },
        { label: 'Ambiguous Steps', value: dashboardData.totals.ambiguousSteps, filter: 'ambiguous', class: 'warning' },
        { label: 'Unused Definitions', value: dashboardData.totals.unusedDefinitions, filter: '', class: 'warning' },
        { label: 'Match Rate', value: dashboardData.totals.matchRate + '%', filter: 'matched', class: 'success' },
      ];

      const metricsEl = document.getElementById('metrics');
      metricsEl.innerHTML = metrics.map(m => \`
        <div class="metric-card \${m.class || ''}" onclick="filterByStatus('\${m.filter}')">
          <div class="metric-value">\${m.value}</div>
          <div class="metric-label">\${m.label}</div>
        </div>
      \`).join('');
    }

    function populateFilters() {
      const featureFilter = document.getElementById('featureFilter');
      featureFilter.innerHTML = '<option value="">All Features</option>' +
        dashboardData.features.map(f => \`<option value="\${f.id}">\${f.name}</option>\`).join('');

      const tagSelect = document.getElementById('tagSelect');
      tagSelect.innerHTML = '<option value="">Select a tag...</option>' +
        dashboardData.tags.allTags.map(t => \`<option value="\${t}">\${t}</option>\`).join('');
    }

    function renderSelectedTags() {
      const container = document.getElementById('selectedTags');
      container.innerHTML = selectedTags.map(tag => \`
        <span class="chip">
          \${tag}
          <button onclick="removeTag('\${tag}')">✕</button>
        </span>
      \`).join('');
    }

    function removeTag(tag) {
      selectedTags = selectedTags.filter(t => t !== tag);
      renderSelectedTags();
      filterSteps();
    }

    function filterByStatus(status) {
      if (status) {
        document.getElementById('statusFilter').value = status;
        filterSteps();
        document.getElementById('stepsTable').scrollIntoView({ behavior: 'smooth' });
      }
    }

    function filterSteps() {
      if (!dashboardData) return;

      const searchText = document.getElementById('searchInput').value.toLowerCase();
      const featureId = document.getElementById('featureFilter').value;
      const status = document.getElementById('statusFilter').value;
      const tagMode = document.getElementById('tagMode').value;

      let filtered = dashboardData.steps.filter(step => {
        if (searchText && !step.text.toLowerCase().includes(searchText)) return false;
        if (featureId && step.featureId !== featureId) return false;
        if (status && step.status !== status) return false;

        if (selectedTags.length > 0) {
          if (tagMode === 'AND') {
            if (!selectedTags.every(tag => step.effectiveTags.includes(tag))) return false;
          } else {
            if (!selectedTags.some(tag => step.effectiveTags.includes(tag))) return false;
          }
        }

        return true;
      });

      document.getElementById('filterCount').textContent = \`Showing \${filtered.length} steps\`;
      renderStepsTable(filtered);
    }

    function renderStepsTable(filtered = null) {
      const steps = filtered || dashboardData.steps;
      const start = currentPage * PAGE_SIZE;
      const end = Math.min(start + PAGE_SIZE, steps.length);
      const pageSteps = steps.slice(start, end);

      const tbody = document.getElementById('stepsTableBody');
      if (pageSteps.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No steps found</td></tr>';
        return;
      }

      tbody.innerHTML = pageSteps.map(step => \`
        <tr>
          <td><span class="badge \${step.status}">\${step.status}</span></td>
          <td onclick="openStep('\${step.uri}', \${step.line})" style="cursor: pointer;">\${step.keyword} \${escapeHtml(step.text)}</td>
          <td>\${step.effectiveTags.map(t => \`<span class="tag" onclick="event.stopPropagation(); filterByTag('\${escapeHtml(t)}')">\${escapeHtml(t)}</span>\`).join('')}</td>
          <td onclick="openStep('\${step.uri}', \${step.line})" style="cursor: pointer;">\${escapeHtml(step.featureName)}</td>
          <td onclick="openStep('\${step.uri}', \${step.line})" style="cursor: pointer;">\${escapeHtml(step.scenarioName)}</td>
          <td onclick="openStep('\${step.uri}', \${step.line})" style="cursor: pointer;">\${step.line}</td>
          <td class="actions" onclick="event.stopPropagation();">
            \${step.status === 'undefined' ? \`<button class="action-btn" onclick="generateStub('\${step.id}')">Generate Stub</button>\` : ''}
            \${step.status === 'ambiguous' ? \`<button class="action-btn" onclick="showMatches('\${step.id}')">Show Matches</button>\` : ''}
            \${step.status === 'matched' && step.matchDefIds.length > 0 ? \`<button class="action-btn" onclick="goToDefinition('\${step.matchDefIds[0]}')">Go to Definition</button>\` : ''}
          </td>
        </tr>
      \`).join('');

      renderPagination(steps.length);
    }

    function goToDefinition(defId) {
      const def = dashboardData.definitions.find(d => d.id === defId);
      if (def) {
        vscode.postMessage({ type: 'openDefinition', uri: def.uri, line: def.line });
      }
    }

    function renderPagination(totalSteps) {
      const totalPages = Math.ceil(totalSteps / PAGE_SIZE);
      if (totalPages <= 1) {
        document.getElementById('stepsPagination').innerHTML = '';
        return;
      }

      let html = \`<button \${currentPage === 0 ? 'disabled' : ''} onclick="goToPage(\${currentPage - 1})">Previous</button>\`;
      html += \`<span>Page \${currentPage + 1} of \${totalPages}</span>\`;
      html += \`<button \${currentPage >= totalPages - 1 ? 'disabled' : ''} onclick="goToPage(\${currentPage + 1})">Next</button>\`;

      document.getElementById('stepsPagination').innerHTML = html;
    }

    function goToPage(page) {
      currentPage = page;
      filterSteps();
    }

    function renderUnusedDefinitions() {
      const unusedDefs = dashboardData.definitions.filter(d => d.usageCount === 0);
      const tbody = document.getElementById('unusedDefsTableBody');

      if (unusedDefs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No unused definitions</td></tr>';
        return;
      }

      tbody.innerHTML = unusedDefs.map(def => \`
        <tr onclick="openDefinition('\${def.uri}', \${def.line})">
          <td>\${escapeHtml(def.pattern)}</td>
          <td>\${formatUri(def.uri)}</td>
          <td>\${def.line}</td>
          <td class="actions">
            <button class="action-btn" onclick="event.stopPropagation(); alert('Find similar not yet implemented')">Find Similar</button>
          </td>
        </tr>
      \`).join('');
    }

    function renderCharts() {
      if (!dashboardData) return;

      renderUndefinedByFeatureChart();
      renderUsageHistogramChart();
      renderStatusPieChart();
      renderUndefinedByTagChart();

      if (history.length > 1) {
        document.getElementById('trendChartContainer').style.display = 'block';
        renderTrendChart();
      }
    }

    function renderUndefinedByFeatureChart() {
      const canvas = document.getElementById('undefinedByFeatureChart');
      const ctx = canvas.getContext('2d');

      const topFeatures = dashboardData.features
        .filter(f => f.undefinedCount > 0)
        .sort((a, b) => b.undefinedCount - a.undefinedCount)
        .slice(0, 10);

      renderBarChart(ctx, canvas,
        topFeatures.map(f => f.name),
        topFeatures.map(f => f.undefinedCount),
        'Undefined Steps'
      );
    }

    function renderUsageHistogramChart() {
      const canvas = document.getElementById('usageHistogramChart');
      const ctx = canvas.getContext('2d');

      const buckets = { '0': 0, '1': 0, '2-5': 0, '6-20': 0, '20+': 0 };
      dashboardData.definitions.forEach(def => {
        const count = def.usageCount;
        if (count === 0) buckets['0']++;
        else if (count === 1) buckets['1']++;
        else if (count <= 5) buckets['2-5']++;
        else if (count <= 20) buckets['6-20']++;
        else buckets['20+']++;
      });

      renderBarChart(ctx, canvas,
        Object.keys(buckets),
        Object.values(buckets),
        'Definitions'
      );
    }

    function renderStatusPieChart() {
      const canvas = document.getElementById('statusPieChart');
      const ctx = canvas.getContext('2d');

      const matched = dashboardData.steps.filter(s => s.status === 'matched').length;
      const undefined = dashboardData.steps.filter(s => s.status === 'undefined').length;
      const ambiguous = dashboardData.steps.filter(s => s.status === 'ambiguous').length;

      renderPieChart(ctx, canvas,
        ['Matched', 'Undefined', 'Ambiguous'],
        [matched, undefined, ambiguous],
        ['#4ade80', '#ef4444', '#f59e0b']
      );
    }

    function renderUndefinedByTagChart() {
      const canvas = document.getElementById('undefinedByTagChart');
      const ctx = canvas.getContext('2d');

      const topTags = dashboardData.tags.undefinedByTag.slice(0, 10);

      renderBarChart(ctx, canvas,
        topTags.map(t => t.tag),
        topTags.map(t => t.count),
        'Undefined Steps'
      );
    }

    function renderTrendChart() {
      const canvas = document.getElementById('trendChart');
      const ctx = canvas.getContext('2d');

      const labels = history.map((h, i) => i + 1);
      const data = history.map(h => h.matchRate);

      renderLineChart(ctx, canvas, labels, data, 'Match Rate %');
    }

    function renderBarChart(ctx, canvas, labels, data, yLabel) {
      const width = canvas.width = canvas.offsetWidth * 2;
      const height = canvas.height = 300;
      ctx.clearRect(0, 0, width, height);

      if (data.length === 0 || data.every(d => d === 0)) {
        renderEmptyChart(ctx, width, height);
        return;
      }

      const style = getComputedStyle(document.body);
      const fgColor = style.getPropertyValue('--vscode-editor-foreground');
      const gridColor = style.getPropertyValue('--vscode-panel-border');

      const padding = { top: 20, right: 20, bottom: 60, left: 60 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;
      const maxValue = Math.max(...data);
      const barWidth = chartWidth / data.length * 0.8;
      const barSpacing = chartWidth / data.length * 0.2;

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 5; i++) {
        const y = padding.top + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
      }

      data.forEach((value, i) => {
        const barHeight = (value / maxValue) * chartHeight;
        const x = padding.left + i * (barWidth + barSpacing);
        const y = height - padding.bottom - barHeight;

        ctx.fillStyle = '#007acc';
        ctx.fillRect(x, y, barWidth, barHeight);
      });

      ctx.fillStyle = fgColor;
      ctx.font = '12px var(--vscode-font-family)';
      ctx.textAlign = 'center';

      labels.forEach((label, i) => {
        const x = padding.left + i * (barWidth + barSpacing) + barWidth / 2;
        const y = height - padding.bottom + 20;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(label.length > 20 ? label.substring(0, 18) + '...' : label, 0, 0);
        ctx.restore();
      });

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let i = 0; i <= 5; i++) {
        const value = Math.round((maxValue / 5) * (5 - i));
        const y = padding.top + (chartHeight / 5) * i;
        ctx.fillText(value.toString(), padding.left - 10, y);
      }
    }

    function renderPieChart(ctx, canvas, labels, data, colors) {
      const width = canvas.width = canvas.offsetWidth * 2;
      const height = canvas.height = 300;
      ctx.clearRect(0, 0, width, height);

      const total = data.reduce((sum, val) => sum + val, 0);
      if (total === 0) {
        renderEmptyChart(ctx, width, height);
        return;
      }

      const centerX = width / 2 - 100;
      const centerY = height / 2;
      const radius = Math.min(width / 3, height / 2.5);

      let startAngle = -Math.PI / 2;
      data.forEach((value, i) => {
        const sliceAngle = (value / total) * 2 * Math.PI;

        ctx.fillStyle = colors[i];
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fill();

        const textAngle = startAngle + sliceAngle / 2;
        const textX = centerX + Math.cos(textAngle) * (radius * 0.7);
        const textY = centerY + Math.sin(textAngle) * (radius * 0.7);

        if (value > 0) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 16px var(--vscode-font-family)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(value.toString(), textX, textY);
        }

        startAngle += sliceAngle;
      });

      // Draw legend on the right side
      const style = getComputedStyle(document.body);
      const fgColor = style.getPropertyValue('--vscode-editor-foreground');
      ctx.font = 'bold 16px var(--vscode-font-family)';

      const legendX = centerX + radius + 80;
      let legendY = centerY - (labels.length * 35) / 2;

      labels.forEach((label, i) => {
        // Draw colored box
        ctx.fillStyle = colors[i];
        ctx.fillRect(legendX, legendY - 12, 24, 24);

        // Draw border around box for visibility
        ctx.strokeStyle = fgColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(legendX, legendY - 12, 24, 24);

        // Draw text
        ctx.fillStyle = fgColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(\`\${label}: \${data[i]}\`, legendX + 34, legendY);
        legendY += 40;
      });
    }

    function renderLineChart(ctx, canvas, labels, data, yLabel) {
      const width = canvas.width = canvas.offsetWidth * 2;
      const height = canvas.height = 300;
      ctx.clearRect(0, 0, width, height);

      const style = getComputedStyle(document.body);
      const fgColor = style.getPropertyValue('--vscode-editor-foreground');
      const gridColor = style.getPropertyValue('--vscode-panel-border');

      const padding = { top: 20, right: 20, bottom: 40, left: 60 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;
      const maxValue = Math.max(...data, 100);

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 5; i++) {
        const y = padding.top + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
      }

      ctx.strokeStyle = '#007acc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      data.forEach((value, i) => {
        const x = padding.left + (i / (data.length - 1)) * chartWidth;
        const y = height - padding.bottom - (value / maxValue) * chartHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.fillStyle = '#007acc';
      data.forEach((value, i) => {
        const x = padding.left + (i / (data.length - 1)) * chartWidth;
        const y = height - padding.bottom - (value / maxValue) * chartHeight;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      ctx.fillStyle = fgColor;
      ctx.font = '12px var(--vscode-font-family)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let i = 0; i <= 5; i++) {
        const value = Math.round((maxValue / 5) * (5 - i));
        const y = padding.top + (chartHeight / 5) * i;
        ctx.fillText(value.toString(), padding.left - 10, y);
      }
    }

    function renderEmptyChart(ctx, width, height) {
      const style = getComputedStyle(document.body);
      const fgColor = style.getPropertyValue('--vscode-descriptionForeground');
      ctx.fillStyle = fgColor;
      ctx.font = '14px var(--vscode-font-family)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No data available', width / 2, height / 2);
    }

    window.expandChart = function(chartId) {
      const modal = document.getElementById('chartModal');
      const expandedCanvas = document.getElementById('expandedChart');
      const sourceCanvas = document.getElementById(chartId);

      if (!modal || !expandedCanvas) {
        console.error('Modal or canvas not found');
        return;
      }

      // Set larger size for expanded view
      expandedCanvas.width = 1400;
      expandedCanvas.height = 700;

      // Re-render the chart in the modal
      const ctx = expandedCanvas.getContext('2d');

      // Determine which chart to render based on ID
      if (chartId === 'undefinedByFeatureChart') {
        const topFeatures = dashboardData.features
          .filter(f => f.undefinedCount > 0)
          .sort((a, b) => b.undefinedCount - a.undefinedCount)
          .slice(0, 10);
        renderBarChart(ctx, expandedCanvas,
          topFeatures.map(f => f.name),
          topFeatures.map(f => f.undefinedCount),
          'Undefined Steps'
        );
      } else if (chartId === 'usageHistogramChart') {
        const buckets = { '0': 0, '1': 0, '2-5': 0, '6-20': 0, '20+': 0 };
        dashboardData.definitions.forEach(def => {
          const count = def.usageCount;
          if (count === 0) buckets['0']++;
          else if (count === 1) buckets['1']++;
          else if (count <= 5) buckets['2-5']++;
          else if (count <= 20) buckets['6-20']++;
          else buckets['20+']++;
        });
        renderBarChart(ctx, expandedCanvas,
          Object.keys(buckets),
          Object.values(buckets),
          'Definitions'
        );
      } else if (chartId === 'statusPieChart') {
        const matched = dashboardData.steps.filter(s => s.status === 'matched').length;
        const undefined = dashboardData.steps.filter(s => s.status === 'undefined').length;
        const ambiguous = dashboardData.steps.filter(s => s.status === 'ambiguous').length;
        renderPieChart(ctx, expandedCanvas,
          ['Matched', 'Undefined', 'Ambiguous'],
          [matched, undefined, ambiguous],
          ['#4ade80', '#ef4444', '#f59e0b']
        );
      } else if (chartId === 'undefinedByTagChart') {
        const topTags = dashboardData.tags.undefinedByTag.slice(0, 10);
        renderBarChart(ctx, expandedCanvas,
          topTags.map(t => t.tag),
          topTags.map(t => t.count),
          'Undefined Steps'
        );
      } else if (chartId === 'trendChart') {
        const labels = history.map((h, i) => i + 1);
        const data = history.map(h => h.matchRate);
        renderLineChart(ctx, expandedCanvas, labels, data, 'Match Rate %');
      }

      modal.classList.add('show');
    };

    window.closeChartModal = function() {
      const modal = document.getElementById('chartModal');
      if (modal) {
        modal.classList.remove('show');
      }
    };

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeChartModal();
      }
    });

    // Close modal on background click
    document.getElementById('chartModal').addEventListener('click', (e) => {
      if (e.target.id === 'chartModal') {
        closeChartModal();
      }
    });

    // Expose functions to window for inline onclick handlers
    window.openStep = function(uri, line) {
      vscode.postMessage({ type: 'openStep', uri, line });
    };

    window.openDefinition = function(uri, line) {
      vscode.postMessage({ type: 'openDefinition', uri, line });
    };

    window.generateStub = function(stepId) {
      vscode.postMessage({ type: 'generateStub', stepId });
    };

    window.showMatches = function(stepId) {
      vscode.postMessage({ type: 'showMatches', stepId });
    };

    window.goToDefinition = function(defId) {
      const def = dashboardData.definitions.find(d => d.id === defId);
      if (def) {
        vscode.postMessage({ type: 'openDefinition', uri: def.uri, line: def.line });
      }
    };

    window.filterByTag = function(tag) {
      if (!selectedTags.includes(tag)) {
        selectedTags.push(tag);
        renderSelectedTags();
        filterSteps();
      }
      document.getElementById('stepsTable').scrollIntoView({ behavior: 'smooth' });
    };

    window.removeTag = function(tag) {
      selectedTags = selectedTags.filter(t => t !== tag);
      renderSelectedTags();
      filterSteps();
    };

    window.filterByStatus = function(status) {
      if (status) {
        document.getElementById('statusFilter').value = status;
        filterSteps();
        document.getElementById('stepsTable').scrollIntoView({ behavior: 'smooth' });
      }
    };

    window.goToPage = function(page) {
      currentPage = page;
      filterSteps();
    };

    function openStep(uri, line) {
      vscode.postMessage({ type: 'openStep', uri, line });
    }

    function openDefinition(uri, line) {
      vscode.postMessage({ type: 'openDefinition', uri, line });
    }

    function generateStub(stepId) {
      vscode.postMessage({ type: 'generateStub', stepId });
    }

    function showMatches(stepId) {
      vscode.postMessage({ type: 'showMatches', stepId });
    }

    function formatDate(isoString) {
      const date = new Date(isoString);
      return date.toLocaleString();
    }

    function formatUri(uriString) {
      try {
        const uri = uriString.replace(/^file:\\/\\/\\//, '');
        const parts = uri.split('/');
        return parts.slice(-2).join('/');
      } catch {
        return uriString;
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    `;
  }

  private getNonce(): string {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
