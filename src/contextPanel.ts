import * as vscode from 'vscode';
import { FileContext } from './contextAggregator';

export interface Relationship {
    from: string;
    to: string;
    type: 'import' | 'export' | 'related';
    strength: number;
}

export interface PanelData {
    files: FileContext[];
    relationships: Relationship[];
    tokenUsage: {
        used: number;
        total: number;
        available: number;
    };
}

export class ContextPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'copilotContextPlus.contextPanel';

    private _view?: vscode.WebviewView;
    private _currentData: PanelData = {
        files: [],
        relationships: [],
        tokenUsage: { used: 0, total: 6000, available: 6000 }
    };

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'refresh':
                    vscode.commands.executeCommand('copilotContextPlus.refresh');
                    break;
                case 'inject':
                    vscode.commands.executeCommand('copilotContextPlus.inject');
                    break;
                case 'clear':
                    vscode.commands.executeCommand('copilotContextPlus.clearInjection');
                    break;
                case 'openFile':
                    if (data.filePath) {
                        const doc = await vscode.workspace.openTextDocument(data.filePath);
                        await vscode.window.showTextDocument(doc);
                    }
                    break;
            }
        });

        // Initial render
        this._updateContent();
    }

    public updateContent(data: PanelData) {
        this._currentData = data;
        this._updateContent();
    }

    private _updateContent() {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'update',
                data: this._currentData
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Copilot Context Plus</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    padding: 10px;
                    line-height: 1.4;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                .header h3 {
                    margin: 0;
                    font-size: 13px;
                    font-weight: 600;
                }
                .actions {
                    display: flex;
                    gap: 4px;
                }
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 4px 8px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 11px;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                button.secondary {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                button.secondary:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }
                .icon-button {
                    padding: 4px 6px;
                    font-size: 12px;
                }
                .stats {
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    padding: 8px;
                    border-radius: 4px;
                    margin-bottom: 12px;
                    font-size: 12px;
                }
                .stats-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 4px;
                }
                .stats-row:last-child {
                    margin-bottom: 0;
                }
                .token-bar {
                    width: 100%;
                    height: 4px;
                    background: var(--vscode-progressBar-background);
                    border-radius: 2px;
                    margin-top: 6px;
                    overflow: hidden;
                }
                .token-bar-fill {
                    height: 100%;
                    background: var(--vscode-button-background);
                    transition: width 0.3s ease;
                }
                .token-bar-fill.warning {
                    background: var(--vscode-editorWarning-foreground);
                }
                .section {
                    margin-bottom: 12px;
                }
                .section-header {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-weight: 600;
                    font-size: 11px;
                    text-transform: uppercase;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 6px;
                    cursor: pointer;
                }
                .section-header:hover {
                    color: var(--vscode-foreground);
                }
                .file-list {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .file-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 6px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                }
                .file-item:hover {
                    background: var(--vscode-list-hoverBackground);
                }
                .file-item.active {
                    background: var(--vscode-list-activeSelectionBackground);
                    color: var(--vscode-list-activeSelectionForeground);
                }
                .file-icon {
                    font-size: 12px;
                }
                .file-name {
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .file-badge {
                    font-size: 10px;
                    padding: 1px 4px;
                    border-radius: 2px;
                    background: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                }
                .relationships {
                    font-size: 11px;
                }
                .relationship-item {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 3px 6px;
                    color: var(--vscode-descriptionForeground);
                }
                .empty-state {
                    text-align: center;
                    padding: 20px;
                    color: var(--vscode-descriptionForeground);
                    font-size: 12px;
                }
                .hidden {
                    display: none;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h3>Copilot Context</h3>
                <div class="actions">
                    <button class="icon-button" id="refreshBtn" title="Refresh">↻</button>
                </div>
            </div>

            <div class="stats">
                <div class="stats-row">
                    <span>Tokens:</span>
                    <span id="tokenText">0 / 6,000</span>
                </div>
                <div class="token-bar">
                    <div class="token-bar-fill" id="tokenBar" style="width: 0%"></div>
                </div>
            </div>

            <div class="section" id="filesSection">
                <div class="section-header" id="filesHeader">
                    <span>📁</span>
                    <span id="filesTitle">Context Files (0)</span>
                </div>
                <div class="file-list" id="fileList">
                    <div class="empty-state">No files in context</div>
                </div>
            </div>

            <div class="section" id="relsSection">
                <div class="section-header" id="relsHeader">
                    <span>🔗</span>
                    <span id="relsTitle">Relationships (0)</span>
                </div>
                <div class="relationships" id="relList"></div>
            </div>

            <div class="actions" style="margin-top: 12px;">
                <button id="injectBtn">Inject Context</button>
                <button class="secondary" id="clearBtn">Clear</button>
            </div>

            <script>
                (function() {
                    const vscode = acquireVsCodeApi();

                    // Elements
                    const tokenText = document.getElementById('tokenText');
                    const tokenBar = document.getElementById('tokenBar');
                    const filesTitle = document.getElementById('filesTitle');
                    const fileList = document.getElementById('fileList');
                    const relsTitle = document.getElementById('relsTitle');
                    const relList = document.getElementById('relList');

                    // Buttons
                    document.getElementById('refreshBtn').addEventListener('click', () => {
                        vscode.postMessage({ type: 'refresh' });
                    });
                    document.getElementById('injectBtn').addEventListener('click', () => {
                        vscode.postMessage({ type: 'inject' });
                    });
                    document.getElementById('clearBtn').addEventListener('click', () => {
                        vscode.postMessage({ type: 'clear' });
                    });

                    // Toggle sections
                    document.getElementById('filesHeader').addEventListener('click', () => {
                        fileList.classList.toggle('hidden');
                    });
                    document.getElementById('relsHeader').addEventListener('click', () => {
                        relList.classList.toggle('hidden');
                    });

                    // Handle messages from extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'update') {
                            updateContent(message.data);
                        }
                    });

                    function updateContent(data) {
                        // Update token stats
                        const { used, total, available } = data.tokenUsage;
                        tokenText.textContent = `${used.toLocaleString()} / ${total.toLocaleString()}`;
                        const percent = total > 0 ? (used / total) * 100 : 0;
                        tokenBar.style.width = `${Math.min(percent, 100)}%`;
                        tokenBar.classList.toggle('warning', percent > 80);

                        // Update files
                        filesTitle.textContent = `Context Files (${data.files.length})`;
                        fileList.innerHTML = '';

                        if (data.files.length === 0) {
                            fileList.innerHTML = '<div class="empty-state">No files in context</div>';
                        } else {
                            data.files.forEach(file => {
                                const item = document.createElement('div');
                                item.className = 'file-item' + (file.isActive ? ' active' : '');
                                item.innerHTML = `
                                    <span class="file-icon">${getFileIcon(file.language)}</span>
                                    <span class="file-name" title="${file.path}">${file.name}</span>
                                    <span class="file-badge">${file.tokenCount}</span>
                                `;
                                item.addEventListener('click', () => {
                                    vscode.postMessage({ type: 'openFile', filePath: file.path });
                                });
                                fileList.appendChild(item);
                            });
                        }

                        // Update relationships
                        relsTitle.textContent = `Relationships (${data.relationships.length})`;
                        relList.innerHTML = '';

                        if (data.relationships.length === 0) {
                            relList.innerHTML = '<div class="empty-state">No relationships detected</div>';
                        } else {
                            data.relationships.slice(0, 10).forEach(rel => {
                                const item = document.createElement('div');
                                item.className = 'relationship-item';
                                const arrow = rel.type === 'import' ? '→' : rel.type === 'export' ? '←' : '⇄';
                                item.innerHTML = `${getFileName(rel.from)} ${arrow} ${getFileName(rel.to)}`;
                                relList.appendChild(item);
                            });
                        }
                    }

                    function getFileIcon(language) {
                        const icons = {
                            typescript: '📘',
                            javascript: '📒',
                            python: '🐍',
                            go: '🔵',
                            rust: '🦀',
                            java: '☕',
                            default: '📄'
                        };
                        return icons[language] || icons.default;
                    }

                    function getFileName(path) {
                        return path.split('/').pop();
                    }
                })();
            </script>
        </body>
        </html>`;
    }
}
