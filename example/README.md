# Cucumber Dashboard - Sample Workspace

This directory contains a sample Cucumber project to test the extension.

## Structure

- `features/` - Contains `.feature` files
- `steps/` - Contains step definition files

## Testing the Extension

1. Press F5 to launch the extension in debug mode
2. Open this `example` folder as a workspace in the Extension Development Host
3. The extension should automatically index the feature file and step definitions
4. Open the Cucumber sidebar to see:
   - Overview statistics
   - Undefined steps (e.g., "the total is", "the cart is empty")
   - Ambiguous steps (if any patterns match multiple definitions)
   - Unused step definitions (if any)

## Try These Features

### View Diagnostics
- Open `features/shopping.feature`
- Look for error/warning squiggles on undefined or ambiguous steps
- Hover over them to see the diagnostic message

### Generate Step Stub
- Click on an undefined step in the sidebar or feature file
- Use the quick fix (light bulb) or Command Palette: "Cucumber: Generate Step Definition Stub"
- Choose a target file
- The stub will be generated with proper parameters

### Navigate
- Click any step in the sidebar to jump to its location
- Click any definition to see where it's defined

### Reindex
- Run "Cucumber: Reindex Workspace" from the Command Palette
- Edit files and watch the dashboard update automatically
