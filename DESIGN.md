# DESIGN.md - Copilot Context Plus

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    VS Code Extension Host                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Extension  │  │  Context     │  │    Context Panel     │  │
│  │   (Main)     │→ │  Aggregator  │→ │    (Webview)         │  │
│  │              │  │              │  │                      │  │
│  │ Activates    │  │ Collects     │  │ Displays context     │  │
│  │ on startup   │  │ file data    │  │ tree & relationships │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────┘  │
│         │                 │                                      │
│         ↓                 ↓                                      │
│  ┌──────────────┐  ┌──────────────┐                             │
│  │ File Rel.    │  │  Context     │                             │
│  │ Detector     │  │  Injector    │                             │
│  │              │  │              │                             │
│  │ Parses AST   │  │ Injects to   │                             │
│  │ for imports  │  │ Copilot      │                             │
│  └──────────────┘  └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

## Context Aggregation Algorithm

### 1. File Collection
```
Input: activeEditor, allVisibleEditors
Output: prioritized file list

Algorithm:
1. Get active file (highest priority)
2. Get all open text editors
3. Sort by:
   - Active editor (weight: 10)
   - Recently modified (weight: timestamp-based)
   - Visible in group (weight: 5)
4. Return sorted list with metadata
```

### 2. Token Budget Allocation
```
Total Budget: 8000 tokens (Copilot limit)
Reserve: 2000 tokens (for prompt + response)
Available for Context: 6000 tokens

Allocation Strategy:
- Active file: 40% (2400 tokens)
- Related files: 35% (2100 tokens)
- Open files: 25% (1500 tokens)

Truncation Rules:
- Always keep full active file
- Truncate related files from end
- If over budget, remove lowest priority files first
```

### 3. Content Extraction
```
For each file:
1. Read full content
2. If within token budget, include all
3. If exceeds budget, include:
   - First N lines (imports/exports)
   - File signature/exports
   - Truncated marker "// ... truncated"
```

## File Relationship Detection

### Import/Export Parsing
```typescript
// Supported patterns:
// JavaScript/TypeScript:
import { foo } from './bar';
const baz = require('./qux');
export { something };
export default Component;

// Python:
from module import something
import module

// Go:
import "package/path"
```

### Relationship Graph
```
File A (active)
├── imports: [File B, File C]
├── exports: [Function1, Class2]
└── related: [File D (imports from A)]

Building the graph:
1. Parse AST of all open files
2. Extract import statements
3. Map file dependencies
4. Calculate relationship strength:
   - Direct import: 1.0
   - Shared import: 0.7
   - Same directory: 0.3
```

## Webview Panel Architecture

### Panel Structure
```
┌─────────────────────────────────────┐
│ Copilot Context Plus           [↻] │  ← Header + Refresh
├─────────────────────────────────────┤
│ Active: src/main.ts                 │  ← Active file highlight
│ Tokens: 2,400 / 6,000 used          │  ← Token usage indicator
├─────────────────────────────────────┤
│ 📁 Context Files (5)                │  ← Collapsible sections
│   ├─ 📄 main.ts [ACTIVE]            │
│   ├─ 📄 utils.ts [imported]         │
│   ├─ 📄 types.ts [imported]         │
│   └─ ...                            │
├─────────────────────────────────────┤
│ 🔗 Relationships                    │  ← Relationship graph
│   main.ts → utils.ts                │
│   main.ts → types.ts                │
├─────────────────────────────────────┤
│ [Inject Context] [Clear]            │  ← Action buttons
└─────────────────────────────────────┘
```

### Communication Flow
```
Extension ←→ Webview
  │           │
  ├── postMessage({type: 'updateContext', data: {...}}) →┤
  │←── postMessage({type: 'refresh', data: null}) ───────┤
  └── postMessage({type: 'inject', data: {fileIds: []}}) →┘
```

## Context Injection Strategy

### Method: VS Code Comment Commands
Copilot reads comments as context. We inject via:

```typescript
// Injected at cursor position or file top:
// @context-plus-begin
// Context from related files:
// --- File: utils.ts ---
// export function helper() {...}
// --- File: types.ts ---
// export interface Config {...}
// @context-plus-end
```

### Injection Points
1. **At Cursor**: When user triggers completion
2. **File Header**: Persistent context block at top of active file
3. **On Demand**: Manual trigger via command palette

### Cleanup
- Automatically remove injected blocks after completion
- Or keep for session with visual indicator (ghost text style)

## Performance Limits

### Aggregation Performance
| Operation | Target | Max |
|-----------|--------|-----|
| File read | 5ms | 20ms |
| AST parse | 10ms | 50ms |
| Token count | 5ms | 15ms |
| Total aggregation | 20ms | 50ms |

### Debouncing Strategy
```
Trigger Events:
- Editor change: immediate
- File save: debounce 100ms
- Bulk operations: debounce 500ms
- Manual refresh: immediate
```

### Memory Limits
- Max cached files: 50
- Max tokens per file cache: 10,000
- Cache TTL: 5 minutes

## Error Handling

### Graceful Degradation
1. **File read fails**: Skip file, log warning
2. **AST parse fails**: Treat as plain text, no relationships
3. **Token count fails**: Use line count estimation
4. **Injection fails**: Show notification, allow retry

### User Feedback
- Status bar indicator during aggregation
- Toast notification on injection success
- Error log panel for debugging
