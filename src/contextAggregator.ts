import * as vscode from 'vscode';
import * as path from 'path';

export interface FileContext {
    path: string;
    name: string;
    content: string;
    language: string;
    isActive: boolean;
    tokenCount: number;
    priority: number;
}

export interface AggregatedContext {
    files: FileContext[];
    tokenUsage: {
        used: number;
        total: number;
        available: number;
    };
}

export class ContextAggregator {
    private config: vscode.WorkspaceConfiguration;
    private maxTokens: number;
    private includePatterns: string[];
    private excludePatterns: string[];

    constructor() {
        this.config = vscode.workspace.getConfiguration('copilotContextPlus');
        this.maxTokens = this.config.get<number>('maxTokens', 6000);
        this.includePatterns = this.config.get<string[]>('includePatterns', [
            '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', 
            '**/*.py', '**/*.go', '**/*.rs', '**/*.java'
        ]);
        this.excludePatterns = this.config.get<string[]>('excludePatterns', [
            '**/node_modules/**', '**/dist/**', '**/build/**', 
            '**/*.test.ts', '**/*.spec.ts'
        ]);
    }

    async aggregate(
        activeEditor: vscode.TextEditor,
        visibleEditors: vscode.TextEditor[]
    ): Promise<AggregatedContext> {
        this.refreshConfig();

        const files: FileContext[] = [];
        const processedPaths = new Set<string>();

        // Always include active file first
        const activeContext = await this.createFileContext(activeEditor, true);
        if (activeContext) {
            files.push(activeContext);
            processedPaths.add(activeEditor.document.uri.fsPath);
        }

        // Add visible editors
        for (const editor of visibleEditors) {
            const filePath = editor.document.uri.fsPath;
            if (processedPaths.has(filePath)) {
                continue;
            }

            if (!this.shouldIncludeFile(filePath)) {
                continue;
            }

            const fileContext = await this.createFileContext(editor, false);
            if (fileContext) {
                files.push(fileContext);
                processedPaths.add(filePath);
            }
        }

        // Add other open tabs
        const allTabs = vscode.window.tabGroups.all
            .flatMap(group => group.tabs)
            .filter(tab => tab.input instanceof vscode.TabInputText);

        for (const tab of allTabs) {
            if (tab.input instanceof vscode.TabInputText) {
                const uri = tab.input.uri;
                const filePath = uri.fsPath;

                if (processedPaths.has(filePath)) {
                    continue;
                }

                if (!this.shouldIncludeFile(filePath)) {
                    continue;
                }

                // Get document if already open
                const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === filePath);
                if (doc) {
                    const fileContext = await this.createFileContextFromDocument(doc, false);
                    if (fileContext) {
                        files.push(fileContext);
                        processedPaths.add(filePath);
                    }
                }
            }
        }

        // Sort files by priority
        files.sort((a, b) => b.priority - a.priority);

        // Apply token budget
        const budgetedFiles = this.applyTokenBudget(files);
        const totalUsed = budgetedFiles.reduce((sum, f) => sum + f.tokenCount, 0);

        return {
            files: budgetedFiles,
            tokenUsage: {
                used: totalUsed,
                total: this.maxTokens,
                available: this.maxTokens - totalUsed
            }
        };
    }

    getAggregatedContext(): AggregatedContext {
        // Return the last aggregated context
        // This is called by the injector
        return {
            files: [],
            tokenUsage: { used: 0, total: this.maxTokens, available: this.maxTokens }
        };
    }

    private refreshConfig(): void {
        this.config = vscode.workspace.getConfiguration('copilotContextPlus');
        this.maxTokens = this.config.get<number>('maxTokens', 6000);
        this.includePatterns = this.config.get<string[]>('includePatterns', []);
        this.excludePatterns = this.config.get<string[]>('excludePatterns', []);
    }

    private shouldIncludeFile(filePath: string): boolean {
        // Check exclude patterns first
        for (const pattern of this.excludePatterns) {
            if (this.matchesPattern(filePath, pattern)) {
                return false;
            }
        }

        // Check include patterns
        for (const pattern of this.includePatterns) {
            if (this.matchesPattern(filePath, pattern)) {
                return true;
            }
        }

        return false;
    }

    private matchesPattern(filePath: string, pattern: string): boolean {
        // Simple glob matching
        const regex = new RegExp(
            '^' + 
            pattern
                .replace(/\*\*/g, '{{GLOBSTAR}}')
                .replace(/\*/g, '[^/]*')
                .replace(/\?/g, '.')
                .replace(/{{GLOBSTAR}}/g, '.*')
                .replace(/\./g, '\\.') + 
            '$'
        );
        return regex.test(filePath);
    }

    private async createFileContext(
        editor: vscode.TextEditor,
        isActive: boolean
    ): Promise<FileContext | null> {
        return this.createFileContextFromDocument(editor.document, isActive);
    }

    private async createFileContextFromDocument(
        document: vscode.TextDocument,
        isActive: boolean
    ): Promise<FileContext | null> {
        try {
            const filePath = document.uri.fsPath;
            const content = document.getText();
            const tokenCount = this.estimateTokenCount(content);
            const language = document.languageId;

            // Calculate priority
            let priority = 0;
            if (isActive) {
                priority += 100;
            }
            // Recently modified files get higher priority
            const stat = await vscode.workspace.fs.stat(document.uri);
            const age = Date.now() - stat.mtime;
            priority += Math.max(0, 50 - age / 60000); // Decay over 50 minutes

            return {
                path: filePath,
                name: path.basename(filePath),
                content,
                language,
                isActive,
                tokenCount,
                priority
            };
        } catch (error) {
            console.error(`Error creating file context for ${document.uri.fsPath}:`, error);
            return null;
        }
    }

    private applyTokenBudget(files: FileContext[]): FileContext[] {
        if (files.length === 0) {
            return files;
        }

        const result: FileContext[] = [];
        let remainingTokens = this.maxTokens;

        // Always keep active file in full
        const activeFile = files.find(f => f.isActive);
        if (activeFile) {
            result.push(activeFile);
            remainingTokens -= activeFile.tokenCount;
        }

        // Add other files within budget
        for (const file of files) {
            if (file.isActive) {
                continue;
            }

            if (file.tokenCount <= remainingTokens) {
                result.push(file);
                remainingTokens -= file.tokenCount;
            } else if (remainingTokens > 100) {
                // Truncate file to fit remaining budget
                const truncatedContent = this.truncateContent(file.content, remainingTokens);
                result.push({
                    ...file,
                    content: truncatedContent,
                    tokenCount: remainingTokens
                });
                remainingTokens = 0;
            }

            if (remainingTokens <= 0) {
                break;
            }
        }

        return result;
    }

    private truncateContent(content: string, maxTokens: number): string {
        // Rough estimation: 1 token ≈ 4 characters
        const maxChars = maxTokens * 4;
        
        if (content.length <= maxChars) {
            return content;
        }

        // Try to truncate at a reasonable point
        const lines = content.split('\n');
        let result = '';
        let charCount = 0;

        for (const line of lines) {
            if (charCount + line.length > maxChars - 50) {
                result += '\n// ... [truncated for token limit]';
                break;
            }
            result += line + '\n';
            charCount += line.length + 1;
        }

        return result;
    }

    private estimateTokenCount(content: string): number {
        // Rough estimation: 1 token ≈ 4 characters for code
        return Math.ceil(content.length / 4);
    }
}
