# Changelog

All notable changes to the Copilot Context Plus extension.

## [1.0.0] - 2025-03-19

### Added
- Initial release of Copilot Context Plus
- Multi-file context aggregation from all open editors
- Smart file relationship detection via import/export parsing
- Visual context panel with token usage indicator
- Context injection as comments at cursor position
- Configuration options for token limits, include/exclude patterns
- Support for TypeScript, JavaScript, Python, Go, and Java
- Debounced updates for performance optimization
- Commands: Refresh, Inject Context, Clear Injection, Open Panel

### Technical
- VS Code 1.85.0+ compatibility
- Token budget management (6000 tokens default)
- Regex-based parsing for fast performance
- Webview-based sidebar panel
- Comprehensive file type support with language icons
