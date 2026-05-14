import * as vscode from 'vscode';
import * as path from 'path';
import { buildGraph } from '../../src/lib/engine/graph-builder';
import { QueryEngine } from '../../src/lib/engine/query-engine';

let engine: QueryEngine | null = null;
let totalRawTokens = 0;
let statusBarItem: vscode.StatusBarItem;
let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
let workspaceRoot: string | null = null;

export async function activate(context: vscode.ExtensionContext) {
  workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
  if (!workspaceRoot) return;

  // Status bar — shows index state and component count
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'reactprune.rebuildGraph';
  statusBarItem.text = '$(loading~spin) ReactPrune: Indexing...';
  statusBarItem.tooltip = 'ReactPrune: Click to rebuild graph index';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Initial graph build
  await rebuildGraph();

  // Watch for file changes — debounce 500ms
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceRoot, '**/*.{ts,tsx,js,jsx}')
  );
  const onFileChange = () => scheduleRebuild();
  watcher.onDidChange(onFileChange);
  watcher.onDidCreate(onFileChange);
  watcher.onDidDelete(onFileChange);
  context.subscriptions.push(watcher);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('reactprune.copyContext', cmdCopyContext),
    vscode.commands.registerCommand('reactprune.analyzeImpact', cmdAnalyzeImpact),
    vscode.commands.registerCommand('reactprune.rebuildGraph', rebuildGraph),
  );
}

// ─── Graph management ────────────────────────────────────────────────────────

async function rebuildGraph() {
  if (!workspaceRoot) return;
  statusBarItem.text = '$(loading~spin) ReactPrune: Indexing...';
  try {
    const graph = await buildGraph(workspaceRoot);
    engine = new QueryEngine(graph);
    totalRawTokens = graph.metadata.totalRawTokens;
    const componentCount = graph.nodes.filter(n => n.type === 'COMPONENT').length;
    statusBarItem.text = `$(graph) ReactPrune: ${componentCount} components`;
    statusBarItem.tooltip = [
      `ReactPrune — ${graph.metadata.totalFiles} files indexed`,
      `~${totalRawTokens.toLocaleString()} repo tokens`,
      `Click to rebuild`,
    ].join('\n');
  } catch (err: any) {
    statusBarItem.text = '$(error) ReactPrune: Index failed';
    vscode.window.showErrorMessage(`ReactPrune: Failed to build graph — ${err.message}`);
  }
}

function scheduleRebuild() {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(rebuildGraph, 500);
}

// ─── Command: Copy AI Context ─────────────────────────────────────────────────

async function cmdCopyContext() {
  if (!engine) {
    vscode.window.showWarningMessage('ReactPrune: Graph is still indexing, please wait.');
    return;
  }

  // Pre-fill query from the active file name
  const editor = vscode.window.activeTextEditor;
  const defaultQuery = editor
    ? path.basename(editor.document.fileName, path.extname(editor.document.fileName))
    : '';

  const query = await vscode.window.showInputBox({
    title: 'ReactPrune: Copy AI Context',
    prompt: 'Enter a component name or describe what you want to fix',
    value: defaultQuery,
    placeHolder: 'e.g. Navbar login button',
  });
  if (!query) return;

  const context = await engine.getAIReadyContext(query);

  if (context.error) {
    const pick = await vscode.window.showQuickPick(
      (context.suggestions ?? []).map((s: string) => ({ label: s })),
      { title: `ReactPrune: No match for "${query}" — pick a component` }
    );
    if (!pick) return;
    return cmdCopyContextWithQuery(pick.label as string);
  }

  await vscode.env.clipboard.writeText(context.contextSummary);

  vscode.window.showInformationMessage(
    `ReactPrune: Copied! ${context.optimization.contextTokens} tokens sent vs ${totalRawTokens.toLocaleString()} in repo — saved ${context.optimization.tokenSavingsPct}`,
    'Paste into AI'
  );
}

async function cmdCopyContextWithQuery(query: string) {
  if (!engine) return;
  const context = await engine.getAIReadyContext(query);
  if (context.error) {
    vscode.window.showErrorMessage(`ReactPrune: ${context.error}`);
    return;
  }
  await vscode.env.clipboard.writeText(context.contextSummary);
  vscode.window.showInformationMessage(
    `ReactPrune: Copied ${query} — ${context.optimization.contextTokens} tokens (saved ${context.optimization.tokenSavingsPct})`
  );
}

// ─── Command: Analyze Impact ──────────────────────────────────────────────────

async function cmdAnalyzeImpact() {
  if (!engine) {
    vscode.window.showWarningMessage('ReactPrune: Graph is still indexing, please wait.');
    return;
  }

  const editor = vscode.window.activeTextEditor;
  const defaultName = editor
    ? path.basename(editor.document.fileName, path.extname(editor.document.fileName))
    : '';

  const componentName = await vscode.window.showInputBox({
    title: 'ReactPrune: Analyze Impact',
    prompt: 'Which component are you about to change?',
    value: defaultName,
    placeHolder: 'e.g. Button',
  });
  if (!componentName) return;

  try {
    const result = engine.getImpactAnalysis(componentName);
    const dependentList = result.dependents.slice(0, 5).join(', ');
    const more = result.dependents.length > 5 ? ` +${result.dependents.length - 5} more` : '';

    if (result.impactLevel === 'HIGH') {
      vscode.window.showWarningMessage(
        `⚠️ ReactPrune: ${componentName} has HIGH impact — ${result.dependents.length} dependents will re-render: ${dependentList}${more}`,
        'Copy Full Analysis'
      ).then(action => {
        if (action === 'Copy Full Analysis') {
          vscode.env.clipboard.writeText(JSON.stringify(result, null, 2));
        }
      });
    } else if (result.impactLevel === 'MEDIUM') {
      vscode.window.showWarningMessage(
        `ReactPrune: ${componentName} has MEDIUM impact — ${result.dependents.length} dependents: ${dependentList}${more}`
      );
    } else {
      vscode.window.showInformationMessage(
        `ReactPrune: ${componentName} has LOW impact — ${result.dependents.length === 0 ? 'no dependents' : dependentList}`
      );
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(`ReactPrune: ${err.message}`);
  }
}

export function deactivate() {
  if (rebuildTimer) clearTimeout(rebuildTimer);
}
