import * as vscode from 'vscode';
import { ContextAggregator } from './contextAggregator';
import { ContextPanelProvider } from './contextPanel';
import { ContextInjector } from './contextInjector';
import { FileRelationshipDetector } from './fileRelationshipDetector';

let contextAggregator: ContextAggregator;
let contextPanel: ContextPanelProvider;
let contextInjector: ContextInjector;
let relationshipDetector: FileRelationshipDetector;
let disposables: vscode.Disposable[] = [];

export function activate(context: vscode.ExtensionContext) {
    console.log('Copilot Context Plus is now active');

    // Initialize core components
    contextAggregator = new ContextAggregator();
    contextInjector = new ContextInjector();
    relationshipDetector = new FileRelationshipDetector();
    contextPanel = new ContextPanelProvider(context.extensionUri);

    // Register the webview provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ContextPanelProvider.viewType,
            contextPanel
        )
    );

    // Register commands
    registerCommands(context);

    // Setup event listeners
    setupEventListeners();

    // Set context for view visibility
    vscode.commands.executeCommand('setContext', 'copilotContextPlus.enabled', true);

    // Initial context aggregation
    refreshContext();

    console.log('Copilot Context Plus initialization complete');
}

function registerCommands(context: vscode.ExtensionContext) {
    // Refresh command
    const refreshCmd = vscode.commands.registerCommand('copilotContextPlus.refresh', () => {
        refreshContext();
        vscode.window.showInformationMessage('Copilot Context Plus: Context refreshed');
    });

    // Inject context command
    const injectCmd = vscode.commands.registerCommand('copilotContextPlus.inject', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }

        const aggregatedContext = contextAggregator.getAggregatedContext();
        await contextInjector.injectContext(editor, aggregatedContext);
        vscode.window.showInformationMessage('Copilot Context Plus: Context injected');
    });

    // Clear injection command
    const clearCmd = vscode.commands.registerCommand('copilotContextPlus.clearInjection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        await contextInjector.clearInjection(editor);
        vscode.window.showInformationMessage('Copilot Context Plus: Context cleared');
    });

    // Open panel command
    const openPanelCmd = vscode.commands.registerCommand('copilotContextPlus.openPanel', () => {
        vscode.commands.executeCommand('copilotContextPlus.contextPanel.focus');
    });

    context.subscriptions.push(refreshCmd, injectCmd, clearCmd, openPanelCmd);
}

function setupEventListeners() {
    const config = vscode.workspace.getConfiguration('copilotContextPlus');
    const debounceMs = config.get<number>('debounceMs', 100);

    let debounceTimer: NodeJS.Timeout | undefined;

    // Listen for active editor changes
    const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(() => {
        debouncedRefresh(debounceMs);
    });

    // Listen for document changes
    const docChangeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
        // Only refresh if the change is in the active editor
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && e.document === activeEditor.document) {
            debouncedRefresh(debounceMs);
        }
    });

    // Listen for visible editors changes
    const visibleEditorsDisposable = vscode.window.onDidChangeVisibleTextEditors(() => {
        debouncedRefresh(debounceMs);
    });

    disposables.push(editorChangeDisposable, docChangeDisposable, visibleEditorsDisposable);

    function debouncedRefresh(ms: number) {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            refreshContext();
        }, ms);
    }
}

async function refreshContext() {
    try {
        const activeEditor = vscode.window.activeTextEditor;
        const visibleEditors = vscode.window.visibleTextEditors;

        if (!activeEditor) {
            contextPanel.updateContent({ files: [], relationships: [], tokenUsage: { used: 0, total: 0 } });
            return;
        }

        // Aggregate context from all open files
        const aggregatedContext = await contextAggregator.aggregate(activeEditor, visibleEditors);

        // Detect relationships
        const relationships = relationshipDetector.detectRelationships(
            aggregatedContext.files.map(f => ({ path: f.path, content: f.content }))
        );

        // Update the panel
        contextPanel.updateContent({
            files: aggregatedContext.files,
            relationships,
            tokenUsage: aggregatedContext.tokenUsage
        });

    } catch (error) {
        console.error('Error refreshing context:', error);
    }
}

export function deactivate() {
    // Clean up disposables
    disposables.forEach(d => d.dispose());
    disposables = [];

    vscode.commands.executeCommand('setContext', 'copilotContextPlus.enabled', false);
    console.log('Copilot Context Plus is now deactivated');
}
