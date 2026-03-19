import * as vscode from 'vscode';
import { AggregatedContext } from './contextAggregator';

export class ContextInjector {
    private readonly INJECTION_START = '// @context-plus-begin';
    private readonly INJECTION_END = '// @context-plus-end';
    private readonly TRUNCATED_MARKER = '// ... [truncated for token limit]';

    async injectContext(editor: vscode.TextEditor, context: AggregatedContext): Promise<void> {
        // Clear any existing injection first
        await this.clearInjection(editor);

        // Build context content
        const contextContent = this.buildContextContent(context);

        // Get the document
        const document = editor.document;
        const firstLine = document.lineAt(0);
        const lastLine = document.lineAt(document.lineCount - 1);
        const range = new vscode.Range(0, 0, 0, 0);

        // Create the injection text
        const injectionText = [
            this.INJECTION_START,
            `// Context from ${context.files.length} related file(s):`,
            '',
            ...contextContent,
            '',
            this.INJECTION_END,
            ''
        ].join('\n');

        // Insert at the top of the file
        const edit = new vscode.WorkspaceEdit();
        edit.insert(document.uri, new vscode.Position(0, 0), injectionText);
        await vscode.workspace.applyEdit(edit);

        // Move cursor to after the injection for better UX
        const newCursorPos = new vscode.Position(injectionText.split('\n').length, 0);
        editor.selection = new vscode.Selection(newCursorPos, newCursorPos);
    }

    async clearInjection(editor: vscode.TextEditor): Promise<boolean> {
        const document = editor.document;
        const text = document.getText();

        // Find injection markers
        const startIndex = text.indexOf(this.INJECTION_START);
        const endIndex = text.indexOf(this.INJECTION_END);

        if (startIndex === -1 || endIndex === -1) {
            return false; // No injection found
        }

        // Calculate ranges
        const startLine = document.positionAt(startIndex).line;
        const endLine = document.positionAt(endIndex).line;

        // Include the end marker line and trailing newline
        const endPos = new vscode.Position(
            endLine,
            document.lineAt(endLine).text.length + 1
        );

        const range = new vscode.Range(
            new vscode.Position(startLine, 0),
            endPos
        );

        // Delete the injection
        const edit = new vscode.WorkspaceEdit();
        edit.delete(document.uri, range);
        await vscode.workspace.applyEdit(edit);

        return true;
    }

    private buildContextContent(context: AggregatedContext): string[] {
        const lines: string[] = [];

        for (const file of context.files) {
            if (file.isActive) {
                continue; // Skip active file as it's already visible
            }

            const fileHeader = this.formatFileHeader(file);
            lines.push(fileHeader);

            // Add truncated content if needed
            const contentLines = file.content.split('\n');
            const maxLines = 50; // Limit lines per included file

            if (contentLines.length > maxLines) {
                lines.push(...contentLines.slice(0, maxLines));
                lines.push(this.TRUNCATED_MARKER);
            } else {
                lines.push(...contentLines);
            }

            lines.push(''); // Blank line between files
        }

        return lines;
    }

    private formatFileHeader(file: { name: string; path: string; tokenCount: number }): string[] {
        return [
            `// --- File: ${file.name} ---`,
            `// Path: ${file.path}`,
            `// Tokens: ~${file.tokenCount}`,
            ''
        ];
    }

    hasInjection(editor: vscode.TextEditor): boolean {
        const text = editor.document.getText();
        return text.includes(this.INJECTION_START) && text.includes(this.INJECTION_END);
    }
}
