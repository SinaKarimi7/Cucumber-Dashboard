# Cucumber Dashboard

A powerful VS Code extension that provides a comprehensive dashboard for Cucumber BDD projects in JavaScript/TypeScript.

## Features

### 📊 Sidebar Dashboard

The extension adds a "Cucumber" view container to your activity bar with four interactive views:

- **Overview**: Shows workspace statistics (features, scenarios, steps, undefined/ambiguous steps, unused definitions)
- **Undefined Steps**: Lists all steps without matching definitions, organized by feature and scenario
- **Unused Step Definitions**: Shows step definitions that aren't used by any feature file
- **Ambiguous Steps**: Displays steps that match multiple definitions

### 🔍 Real-time Indexing

- Automatically indexes `.feature` files and step definition files on activation
- Watches for file changes and updates incrementally (debounced for performance)
- Fast and non-blocking - works smoothly on large workspaces

### 🐛 Diagnostics & Quick Fixes

- **Error diagnostics** for undefined steps
- **Warning diagnostics** for ambiguous steps (with details of matching definitions)
- **Quick Fix**: "Generate step definition stub" for undefined steps
- **Quick Fix**: "Show matching definitions" for ambiguous steps

### ⚡ Step Definition Generation

Generate step definition stubs with smart features:

- Automatically detects parameters in step text (numbers → `{int}`, quoted strings → `{string}`)
- Infers correct keyword (Given/When/Then) from context
- Choose target file from existing step definitions or create a new file
- Supports both TypeScript and JavaScript

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

### Commands

Access via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- `Cucumber: Open Dashboard` - Focus the Cucumber sidebar
- `Cucumber: Reindex Workspace` - Manually trigger a full reindex
- `Cucumber: Generate Step Definition Stub` - Generate stub for current line

### Workflow

1. Write your feature files with scenarios and steps
2. View undefined steps in the sidebar
3. Click a step to jump to it in the feature file
4. Use the quick fix (💡) or command to generate a stub
5. Implement the step definition
6. See the step turn from red (undefined) to matched!

## Step Definition Format

The extension recognizes these patterns:

```typescript
// Standard Cucumber format
Given('I am on the homepage', () => {});
When(/^I click the "([^"]*)" button$/, (buttonName) => {});
Then('I see {int} items', (count) => {});

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
