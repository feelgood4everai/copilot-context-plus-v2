# SPEC.md - Copilot Context Plus

## Problem Statement (GitHub #6792)

GitHub Copilot in VS Code has a critical limitation: **it only sees the currently active file**. This significantly reduces its effectiveness because:

- Copilot lacks awareness of related files in the workspace
- It cannot understand imports, exports, or cross-file dependencies
- Developers must manually copy-paste context from other files
- Multi-file refactors and complex features are poorly supported

## Solution

Copilot Context Plus extends VS Code to automatically aggregate context from all open files and inject it into Copilot's context window.

## Features

### Core Features
1. **Aggregate All Open Files** - Collect content from all open editor tabs
2. **Detect File Relationships** - Parse imports/exports to find related files
3. **Context Panel** - Visualize aggregated context in a dedicated sidebar
4. **Context Injection** - Seamlessly inject context into Copilot prompts

### Additional Features
- Smart token limit management (respects Copilot's 8k context window)
- Configurable file inclusion/exclusion patterns
- Relationship graph visualization
- Performance-optimized aggregation (debounced updates)

## Success Criteria

- [x] Copilot receives context from related open files automatically
- [x] No manual copy-pasting required
- [x] Works with all file types Copilot supports
- [x] Does not exceed Copilot's token limits
- [x] Minimal performance impact (<50ms aggregation time)
- [x] Clean, non-intrusive UI integration

## Scope

**In Scope:**
- VS Code extension for Copilot enhancement
- Open file aggregation
- Import/export relationship detection
- Sidebar context panel
- Context injection mechanism

**Out of Scope:**
- Full workspace indexing (only open files)
- Copilot API modifications (uses existing interfaces)
- Multi-workspace support (single workspace only)
- Remote development support (phase 2)
