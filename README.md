# Copilot Context Plus

Enhance GitHub Copilot with intelligent context from all open files in VS Code.

## Features

- **Multi-file Context Aggregation** - Automatically collect content from all open editor tabs
- **Smart Relationship Detection** - Parse imports/exports to understand file dependencies
- **Context Panel** - Visualize aggregated context with token usage in a dedicated sidebar
- **Context Injection** - Seamlessly inject context into Copilot prompts via comments
- **Token Budget Management** - Respects Copilot's 8k context window with intelligent truncation

## Installation

1. Install from VS Code marketplace (coming soon)
2. Or install from VSIX:
   ```bash
   code --install-extension copilot-context-plus-1.0.0.vsix
   ```

## Usage

### Commands

- `Copilot Context Plus: Refresh Context` - Manually refresh context aggregation
- `Copilot Context Plus: Inject Context at Cursor` - Inject aggregated context as comments
- `Copilot Context Plus: Clear Injected Context` - Remove injected context comments
- `Copilot Context Plus: Open Context Panel` - Show the context sidebar

### Context Panel

The sidebar panel shows:
- Token usage indicator
- List of files in context
- File relationships
- Quick actions (Refresh, Inject, Clear)

### Configuration

```json
{
  "copilotContextPlus.enabled": true,
  "copilotContextPlus.maxTokens": 6000,
  "copilotContextPlus.includePatterns": [
    "**/*.ts",
    "**/*.tsx", 
    "**/*.js",
    "**/*.jsx",
    "**/*.py",
    "**/*.go"
  ],
  "copilotContextPlus.excludePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/*.test.ts"
  ],
  "copilotContextPlus.debounceMs": 100,
  "copilotContextPlus.showRelationships": true
}
```

## How It Works

1. **Aggregation** - Collects files from open editors, sorted by priority (active file > visible > background tabs)
2. **Budgeting** - Allocates tokens: 40% active file, 35% related files, 25% other open files
3. **Injection** - Adds context as comments at the top of the active file
4. **Detection** - Parses imports/exports to build relationship graph

## Supported Languages

- TypeScript / JavaScript
- Python
- Go
- Java
- Rust (basic support)

## Requirements

- VS Code 1.85.0 or higher
- GitHub Copilot extension

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a PR

## License

MIT

## Changelog

### 1.0.0 (2025-03-19)
- Initial release
- Multi-file context aggregation
- File relationship detection
- Context injection
- Sidebar panel with token usage
