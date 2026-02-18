# Cucumber Dashboard

A powerful VS Code extension that provides a comprehensive dashboard for Cucumber BDD projects in JavaScript/TypeScript. Turn your Cucumber workspace into a "daily driver" with real-time diagnostics, smart quick fixes, and powerful search capabilities.

## Features

### 📊 Enhanced Sidebar Dashboard

The extension adds a "Cucumber" view container to your activity bar with four interactive views:

- **Overview**: Shows workspace statistics with counts and last indexed timestamp
  - Features, Scenarios, and Steps counts
  - Undefined/Ambiguous Steps with error/warning indicators
  - Unused Definitions tracking
  - Last indexed time ("just now", "5m ago", etc.)

- **Undefined Steps**: Lists all steps without matching definitions
  - Organized by feature → scenario → step
  - Shows **step counts** on features and scenarios
  - Displays **line numbers** (L42) on each step
  - Click to jump to the exact line

- **Unused Step Definitions**: Shows step definitions that aren't used
  - Grouped by file with counts
  - Shows line numbers for each definition

- **Ambiguous Steps**: Displays steps that match multiple definitions
  - Shows **step counts** on features and scenarios
  - Displays **line numbers** and match counts
  - Expandable to see all matching definitions

### 🔍 Real-time Indexing & Status

- Automatically indexes `.feature` files and step definition files on activation
- Watches for file changes and updates incrementally (debounced for performance)
- **Indexing status** shown in Overview: "Indexing...", "Last indexed: just now"
- **Refresh button** in toolbar for manual refresh
- Fast and non-blocking - works smoothly on large workspaces

### 🐛 Diagnostics & Quick Fixes

- **Error diagnostics** for undefined steps in the Problems panel
- **Warning diagnostics** for ambiguous steps (with details of matching definitions)
- **Quick Fix**: "Generate step definition stub" for undefined steps (💡)
- **Quick Fix**: "Show matching definitions" for ambiguous steps
- Diagnostics update automatically when files change

### ⚡ Enhanced Step Definition Generation

Generate step definition stubs with **smart features**:

- **Advanced parameter mapping**:
  - Floats → `{float}` (e.g., "3.14" → `{float}`, parameter: `value`)
  - Integers → `{int}` (e.g., "42" → `{int}`, parameter: `count`)
  - Quoted strings → `{string}` (e.g., "hello" → `{string}`, parameter: `text`)
  - Multiple params properly numbered: `value1`, `count1`, `text1`, etc.

- **Keyword inference**: `And`/`But` steps inherit keyword from previous step
  - Example: `Given I login` → `And I see dashboard` generates `Given("I see dashboard", ...)`

- **DataTable & DocString detection**:
  - Automatically adds `dataTable` parameter when step has a table
  - Adds `docString` parameter when step has triple-quoted strings

- **Modern async format**: Generates `async ({ text, count }) => { ... }`
- Choose target file from existing step definitions or create a new file
- Supports both TypeScript and JavaScript with proper imports

### 🔎 Quick Search Command

**New!** Powerful search for steps and definitions:

- Press `Ctrl+Shift+P` → "Cucumber: Search Steps & Definitions"
- Or click the **search icon** (🔍) in the Overview toolbar
- Two modes:
  1. **Search Feature Steps**: Find any step across all .feature files
     - Shows: `Given I login` with line number and location
     - Description: `admin.feature · Login scenario`
  2. **Search Step Definitions**: Find definitions in code
     - Shows pattern (regex or Cucumber expression)
     - Description: keyword, line number, and file name
- Fuzzy matching on labels, descriptions, and file names
- Click result to jump directly to the code

### 🔧 Flexible Configuration

Customize via `settings.json`:

```json
{
  "cucumberDash.featureGlobs": [
    "features/**/*.feature",
    "**/*.feature"
  ],
  "cucumberDash.stepDefGlobs": [
    "**/*.{steps,step,stepdefs}.{ts,js}",
    "**/*steps*/**/*.{ts,js}"
  ],
  "cucumberDash.excludeGlobs": [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.git/**"
  ],
  "cucumberDash.enableDiagnostics": true,
  "cucumberDash.matchMode": "both"
}
```

### 🎯 Smart Pattern Matching

Supports both matching modes:

- **Cucumber Expressions**: `{int}`, `{float}`, `{word}`, `{string}`
- **Regular Expressions**: Full regex support with flags
- **Match Mode**: Configure to use `"both"`, `"regex"`, or `"expression"`

## Usage

### Getting Started

1. Install the extension
2. Open a workspace with Cucumber feature files
3. The extension automatically activates and indexes your workspace
4. Open the "Cucumber" view in the activity bar
5. See indexed timestamp in Overview

### Commands

Access via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- `Cucumber: Search Steps & Definitions` - Quick search across all steps and definitions
- `Cucumber: Open Dashboard` - Focus the Cucumber sidebar
- `Cucumber: Reindex Workspace` - Manually trigger a full reindex
- `Cucumber: Refresh Views` - Refresh the tree views
- `Cucumber: Generate Step Definition Stub` - Generate stub for current line (or use 💡)

### Toolbar Actions

In the Overview view title bar:

- 🔄 **Refresh** - Refresh all views
- 🔍 **Search** - Quick search for steps/definitions
- ⚙️ **Reindex** - Full workspace reindex (in dropdown menu)

### Workflow

1. Write your feature files with scenarios and steps
2. View **undefined steps** in the sidebar (with counts and line numbers)
3. Click a step to jump to it in the feature file
4. Use the **quick fix** (💡) or command to generate a stub
   - Select target file or create new
   - Stub includes proper parameters based on step text
5. Implement the step definition
6. See the step turn from red (undefined) to matched!
7. Use **Search** to quickly find any step or definition across the workspace

## Step Definition Stub Examples

### Simple step
```gherkin
When I click the login button
```
Generates:
```typescript
When("I click the login button", async () => {
  // TODO: Implement step
});
```

### Step with parameters
```gherkin
Then I should see "Welcome" message with 5 items and total of 99.99
```
Generates:
```typescript
Then("I should see {string} message with {int} items and total of {float}", async ({ text, count, value }) => {
  // TODO: Implement step
});
```

### Step with DataTable
```gherkin
Given the following users:
  | name  | email         |
  | Alice | alice@example.com |
```
Generates:
```typescript
Given("the following users:", async ({ dataTable }) => {
  // TODO: Implement step
});
```

### And/But keyword inference
```gherkin
Given I am logged in
And I navigate to settings    # Infers "Given" from previous step
When I click save
But I see an error           # Infers "When" from previous step
```

## Step Definition Format

The extension recognizes these patterns:

```typescript
// Standard Cucumber format
Given('I am on the homepage', () => {});
When(/^I click the "([^"]*)" button$/, (buttonName) => {});
Then('I see {int} items', (count) => {});

// Modern async with destructured parameters
Given('I have {int} apples', async ({ count }) => {});
When('I add {string} to cart', async ({ text }) => {});

// Generic step functions
defineStep('some pattern', () => {});
Step('another pattern', () => {});
```

## Requirements

- VS Code 1.85.0 or higher
- JavaScript/TypeScript project with Cucumber
- Node.js or Bun runtime

## Extension Settings

### `cucumberDash.featureGlobs`

Array of glob patterns to find feature files.

**Default**: `["features/**/*.feature", "**/*.feature"]`

### `cucumberDash.stepDefGlobs`

Array of glob patterns to find step definition files.

**Default**: `["**/*.{steps,step,stepdefs}.{ts,js}", "**/*steps*/**/*.{ts,js}"]`

### `cucumberDash.excludeGlobs`

Array of glob patterns to exclude from indexing.

**Default**: `["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**"]`

### `cucumberDash.enableDiagnostics`

Enable/disable diagnostics in the Problems panel.

**Default**: `true`

### `cucumberDash.matchMode`

Pattern matching mode for step definitions.

**Options**: `"both"`, `"regex"`, `"expression"`
**Default**: `"both"`

## Known Issues

- Template literals with expressions (`${variable}`) in step definitions are not supported
- Background steps are indexed but may not infer keywords perfectly for And/But steps

## Release Notes

### 0.2.0 (Current)

**Major upgrade to "daily driver" status**:

- **Enhanced Tree Views**:
  - Added step counts on feature and scenario nodes
  - Added line numbers (L42) on all step items
  - Shortened step labels with full text in tooltips
  - Better descriptions with file names and match counts

- **Search Command**:
  - New `Cucumber: Search Steps & Definitions` command
  - Quick search across all steps and definitions
  - Fuzzy matching on text, descriptions, and file names
  - Search icon in Overview toolbar

- **Improved Stub Generation**:
  - Better parameter naming: `text`, `count`, `value`
  - Support for `{float}` detection (not just `{int}`)
  - DataTable and DocString detection with auto-parameters
  - Modern async format with destructured parameters: `async ({ text, count }) => {}`
  - Enhanced And/But keyword inference from previous steps

- **Refresh & Status**:
  - Refresh button in Overview toolbar
  - "Last indexed" timestamp shown in Overview
  - Relative time display ("just now", "5m ago")
  - Better indexing progress notifications

- **UX Improvements**:
  - Toolbar icons for common actions
  - Better command palette integration
  - Improved tree view icons and colors
  - More informative tooltips

### 0.1.0

Initial release of Cucumber Dashboard:

- Feature file parsing with Gherkin
- Step definition extraction from TS/JS files
- Pattern matching (Cucumber expressions + regex)
- Sidebar dashboard with 4 views
- Diagnostics for undefined/ambiguous steps
- Quick fixes and stub generation
- File watching and incremental updates
- Configurable via settings

## Contributing

Found a bug or have a feature request? Please open an issue on GitHub.

## License

MIT
