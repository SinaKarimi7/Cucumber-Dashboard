# Quick Start Guide

## 🚀 Running the Extension

### 1. Build the Extension

```bash
# With Bun (recommended - faster)
bun install
bun run compile

# Or with npm
npm install
npm run compile
```

### 2. Launch in Debug Mode

Press **F5** in VS Code. This will:
- Compile the extension
- Open a new VS Code window (Extension Development Host)
- Load the extension automatically

### 3. Test with Sample Workspace

In the Extension Development Host window:
1. File → Open Folder → Select the `example` folder
2. Look for the "Cucumber" icon in the activity bar (left sidebar)
3. Click it to see the dashboard

You should see:
- **Overview**: Statistics about features and steps
- **Undefined Steps**: Steps without matching definitions (e.g., "the total is $45.00", "the cart is empty")
- **Unused Definitions**: Currently none (all are used)
- **Ambiguous Steps**: Currently none

### 4. Try the Features

#### View Diagnostics
- Open `example/features/shopping.feature`
- Look for red squiggles on undefined steps
- Hover to see the error message

#### Generate a Step Definition
1. Click on an undefined step in the sidebar OR place cursor on a red-squiggled step
2. Click the 💡 (light bulb) that appears
3. Select "Generate step definition stub"
4. Choose a target file (or create new)
5. The stub will be generated!

#### Navigate
- Click any step in the sidebar → jumps to the feature file
- Click any definition in "Unused Definitions" → jumps to code

#### Reindex
- Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
- Type "Cucumber: Reindex Workspace"

## 📁 Using in Your Own Project

To use this in your own Cucumber project:

1. Copy the compiled extension or install the `.vsix` package
2. Open your project workspace
3. Make sure you have `.feature` files and step definitions
4. The extension automatically detects and indexes them

## ⚙️ Customize Settings

Create/edit `.vscode/settings.json` in your workspace:

```json
{
  "cucumberDash.featureGlobs": ["tests/**/*.feature"],
  "cucumberDash.stepDefGlobs": ["tests/steps/**/*.ts"],
  "cucumberDash.matchMode": "expression"
}
```

## 🔧 Troubleshooting

### Extension doesn't activate?
- Make sure you have at least one `.feature` file in the workspace
- Check the Output panel (View → Output) and select "Cucumber Dashboard"

### Steps aren't matched?
- Check `matchMode` setting
- Verify step definition patterns syntax
- Try "Cucumber: Reindex Workspace" command

### Performance issues?
- Exclude unnecessary folders in `excludeGlobs`
- Reduce the scope of `featureGlobs` and `stepDefGlobs`

## 📦 Package for Distribution

```bash
# Install vsce globally
bun install -g @vscode/vsce
# or: npm install -g @vscode/vsce

vsce package
```

This creates `cucumber-dashboard-0.1.0.vsix`.

Install with:
```bash
code --install-extension cucumber-dashboard-0.1.0.vsix
```

## 🎯 Next Steps

- Read [DEVELOPMENT.md](DEVELOPMENT.md) for architecture details
- Check [README.md](README.md) for full documentation
- Customize the extension for your needs
- Share feedback and improvements!
