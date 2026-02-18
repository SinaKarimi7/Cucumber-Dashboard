# Cucumber Dashboard - Development Guide

## Project Structure

```
bdd-dashboard/
├── src/
│   ├── extension.ts                  # Main extension entry point
│   ├── types.ts                      # Type definitions
│   ├── config.ts                     # Configuration management
│   ├── workspaceIndex.ts             # In-memory index model
│   ├── indexer.ts                    # Indexing service with file watching
│   ├── gherkinParser.ts              # Feature file parser (using @cucumber/gherkin)
│   ├── stepDefinitionExtractor.ts    # TS/JS step definition extractor
│   ├── matchingEngine.ts             # Pattern matching (expressions + regex)
│   ├── diagnosticsProvider.ts        # VS Code diagnostics
│   ├── codeActionProvider.ts         # Quick fixes
│   ├── stubGenerator.ts              # Step definition stub generator
│   └── views/
│       ├── overviewTreeProvider.ts           # Overview statistics view
│       ├── undefinedStepsTreeProvider.ts     # Undefined steps view
│       ├── unusedDefsTreeProvider.ts         # Unused definitions view
│       └── ambiguousStepsTreeProvider.ts     # Ambiguous steps view
├── example/                          # Sample workspace for testing
│   ├── features/
│   │   └── shopping.feature
│   └── steps/
│       └── shopping.steps.ts
├── resources/
│   └── cucumber-icon.svg             # Extension icon
├── package.json                      # Extension manifest
├── tsconfig.json                     # TypeScript configuration
└── README.md                         # User documentation

## Running the Extension

### Development Mode

1. **Install dependencies:**
   ```bash
   # With Bun (recommended - faster)
   bun install

   # Or with npm
   npm install
   ```

2. **Compile the TypeScript:**
   ```bash
   # With Bun
   bun run compile

   # Or with npm
   npm run compile
   ```

3. **Launch in debug mode:**
   - Press `F5` in VS Code
   - This opens the Extension Development Host with the extension loaded

4. **Test with example workspace:**
   - In the Extension Development Host, open the `example` folder
   - The extension will automatically activate and index the files
   - Open the "Cucumber" view in the activity bar

### Watch Mode

For continuous development:

```bash
# With Bun (faster)
bun run watch

# Or with npm
npm run watch
```

This will automatically recompile when you save TypeScript files.

## Key Features Implemented

### 1. Indexing Engine (`indexer.ts`)
- Discovers feature files and step definitions based on configurable globs
- Uses FileSystemWatcher for incremental updates
- Debounced reindexing (500ms) for performance
- Async operations to avoid blocking the UI

### 2. Gherkin Parser (`gherkinParser.ts`)
- Uses official `@cucumber/gherkin` library
- Parses feature files into structured model
- Extracts:
  - Feature name
  - Scenarios (including Background)
  - Steps with keyword, text, line number

### 3. Step Definition Extractor (`stepDefinitionExtractor.ts`)
- Uses TypeScript Compiler API for AST traversal
- Recognizes: `Given()`, `When()`, `Then()`, `defineStep()`, `Step()`
- Supports:
  - String literals: `Given('pattern', ...)`
  - Regex literals: `When(/^pattern$/i, ...)`
  - Template literals without expressions
- Stores pattern type (expression vs regex) and location

### 4. Matching Engine (`matchingEngine.ts`)
- Supports both Cucumber expressions and regex
- Cucumber expression parameters:
  - `{int}` → `(-?\d+)`
  - `{float}` → `(-?\d+(?:\.\d+)?)`
  - `{word}` → `(\S+)`
  - `{string}` → quoted strings or words
- Keyword compatibility checking
- Configurable match mode: `"both"`, `"regex"`, `"expression"`

### 5. Tree Views
- **Overview**: Shows statistics (features, scenarios, steps, issues)
- **Undefined Steps**: Hierarchical view (Feature → Scenario → Step)
- **Unused Definitions**: Grouped by file
- **Ambiguous Steps**: Shows all matching definitions

### 6. Diagnostics & Quick Fixes
- Error diagnostics for undefined steps
- Warning diagnostics for ambiguous steps
- Quick Fix: Generate step definition stub
- Quick Fix: Show matching definitions

### 7. Stub Generator (`stubGenerator.ts`)
- Smart parameter detection:
  - Numbers → `{int}`
  - Quoted strings → `{string}`
- Keyword inference (And/But → previous step's keyword)
- Choose target file or create new one
- Supports both TypeScript and JavaScript

## Configuration

All settings under `cucumberDash.*`:

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

## Commands

Registered commands:
- `cucumberDash.reindex` - Manual reindex trigger
- `cucumberDash.openDashboard` - Focus sidebar
- `cucumberDash.generateStepStub` - Generate stub for undefined step
- `cucumberDash.showMatchingDefs` - Show definitions for ambiguous step

## Architecture Highlights

### Separation of Concerns
- **Model Layer**: `types.ts`, `workspaceIndex.ts`
- **Parsing Layer**: `gherkinParser.ts`, `stepDefinitionExtractor.ts`
- **Business Logic**: `matchingEngine.ts`, `indexer.ts`
- **UI Layer**: `views/*`, `diagnosticsProvider.ts`, `codeActionProvider.ts`
- **Config Layer**: `config.ts`

### Performance Optimizations
- Debounced file watching (500ms)
- Incremental updates (only reparse changed files)
- Async operations throughout
- Efficient in-memory indexing with Maps

### VS Code Integration
- TreeDataProvider pattern for views
- DiagnosticCollection for problems
- CodeActionProvider for quick fixes
- FileSystemWatcher for file changes
- Progress notifications for long operations

## Testing the Extension

1. **Open example workspace:**
   - Press F5 to launch Extension Development Host
   - Open `example` folder

2. **Verify indexing:**
   - Check "Cucumber" sidebar appears
   - Overview should show counts
   - Some undefined steps should appear

3. **Test diagnostics:**
   - Open `example/features/shopping.feature`
   - Should see error squiggles on undefined steps

4. **Test stub generation:**
   - Click an undefined step
   - Use quick fix (💡) or Command Palette
   - Select target file
   - Verify stub is generated

5. **Test navigation:**
   - Click steps in sidebar → jumps to feature file
   - Click definitions → jumps to step definition file

## Packaging

To create a `.vsix` package:

```bash
# Install vsce globally
bun install -g @vscode/vsce
# or: npm install -g @vscode/vsce

vsce package
```

Install with:
```bash
code --install-extension cucumber-dashboard-0.1.0.vsix
```

## Known Limitations

1. Template literals with expressions (`${var}`) are not supported
2. Very complex regex patterns might not match correctly
3. Background step keyword inference is basic

## Future Enhancements

- Better keyword inference for And/But steps
- Step usage statistics
- Go to definition from feature step
- Auto-complete for steps in feature files
- Support for Scenario Outlines and Examples
- Multi-root workspace support
- Configuration per workspace folder
