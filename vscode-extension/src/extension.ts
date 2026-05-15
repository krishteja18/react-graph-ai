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
  statusBarItem.command = 'react-graph-ai.rebuildGraph';
  statusBarItem.text = '$(loading~spin) React Graph AI: Indexing...';
  statusBarItem.tooltip = 'React Graph AI: Click to rebuild graph index';
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
    vscode.commands.registerCommand('react-graph-ai.copyContext', cmdCopyContext),
    vscode.commands.registerCommand('react-graph-ai.analyzeImpact', cmdAnalyzeImpact),
    vscode.commands.registerCommand('react-graph-ai.rebuildGraph', rebuildGraph),
  );

  // Register chat participant — @reactgraph in Copilot Chat
  try {
    const participant = vscode.chat.createChatParticipant('react-graph-ai.context', handleChat);
    participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');
    context.subscriptions.push(participant);
  } catch (err) {
    console.warn('Chat participant API unavailable — Copilot Chat may not be installed:', err);
  }

  // Register language model tools — Copilot can auto-call these during edits/answers
  try {
    context.subscriptions.push(
      vscode.lm.registerTool('react-graph-ai_get_context', new GetContextTool()),
      vscode.lm.registerTool('react-graph-ai_get_impact', new GetImpactTool()),
    );
  } catch (err) {
    console.warn('Language Model Tool API unavailable — requires VS Code 1.95+:', err);
  }
}

// ─── Graph management ────────────────────────────────────────────────────────

async function rebuildGraph() {
  if (!workspaceRoot) return;
  statusBarItem.text = '$(loading~spin) React Graph AI: Indexing...';
  try {
    const graph = await buildGraph(workspaceRoot);
    engine = new QueryEngine(graph);
    totalRawTokens = graph.metadata.totalRawTokens;
    const componentCount = graph.nodes.filter(n => n.type === 'COMPONENT').length;
    statusBarItem.text = `$(graph) React Graph AI: ${componentCount} components`;
    statusBarItem.tooltip = [
      `React Graph AI — ${graph.metadata.totalFiles} files indexed`,
      `~${totalRawTokens.toLocaleString()} repo tokens`,
      `Click to rebuild`,
    ].join('\n');
  } catch (err: any) {
    statusBarItem.text = '$(error) React Graph AI: Index failed';
    vscode.window.showErrorMessage(`React Graph AI: Failed to build graph — ${err.message}`);
  }
}

function scheduleRebuild() {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(rebuildGraph, 500);
}

// ─── Command: Copy AI Context ─────────────────────────────────────────────────

async function cmdCopyContext() {
  if (!engine) {
    vscode.window.showWarningMessage('React Graph AI: Graph is still indexing, please wait.');
    return;
  }

  // Pre-fill query from the active file name
  const editor = vscode.window.activeTextEditor;
  const defaultQuery = editor
    ? path.basename(editor.document.fileName, path.extname(editor.document.fileName))
    : '';

  const query = await vscode.window.showInputBox({
    title: 'React Graph AI: Copy AI Context',
    prompt: 'Enter a component name or describe what you want to fix',
    value: defaultQuery,
    placeHolder: 'e.g. Navbar login button',
  });
  if (!query) return;

  const context = await engine.getAIReadyContext(query);

  if (context.error) {
    const pick = await vscode.window.showQuickPick(
      (context.suggestions ?? []).map((s: any) =>
        typeof s === 'string'
          ? { label: s }
          : { label: s.name, description: s.path }
      ),
      { title: `React Graph AI: No match for "${query}" — pick a component` }
    );
    if (!pick) return;
    return cmdCopyContextWithQuery(pick.label as string);
  }

  await vscode.env.clipboard.writeText(context.contextSummary);

  const action = await vscode.window.showInformationMessage(
    `React Graph AI: Copied! ${context.optimization.contextTokens} tokens sent vs ${totalRawTokens.toLocaleString()} in repo — saved ${context.optimization.tokenSavingsPct}`,
    'Open in Copilot Chat',
    'Preview'
  );

  if (action === 'Open in Copilot Chat') {
    try {
      await vscode.commands.executeCommand('workbench.action.chat.open', {
        query: `${context.contextSummary}\n\n# Question\n`,
      });
    } catch {
      vscode.window.showWarningMessage(
        'Copilot Chat not available. Context is already in your clipboard — paste with Ctrl+V into any AI tool.'
      );
    }
  } else if (action === 'Preview') {
    const doc = await vscode.workspace.openTextDocument({
      content: context.contextSummary,
      language: 'markdown',
    });
    await vscode.window.showTextDocument(doc, { preview: true });
  }
}

async function cmdCopyContextWithQuery(query: string) {
  if (!engine) return;
  const context = await engine.getAIReadyContext(query);
  if (context.error) {
    vscode.window.showErrorMessage(`React Graph AI: ${context.error}`);
    return;
  }
  await vscode.env.clipboard.writeText(context.contextSummary);
  vscode.window.showInformationMessage(
    `React Graph AI: Copied ${query} — ${context.optimization.contextTokens} tokens (saved ${context.optimization.tokenSavingsPct})`
  );
}

// ─── Command: Analyze Impact ──────────────────────────────────────────────────

async function cmdAnalyzeImpact() {
  if (!engine) {
    vscode.window.showWarningMessage('React Graph AI: Graph is still indexing, please wait.');
    return;
  }

  const editor = vscode.window.activeTextEditor;
  const defaultName = editor
    ? path.basename(editor.document.fileName, path.extname(editor.document.fileName))
    : '';

  const componentName = await vscode.window.showInputBox({
    title: 'React Graph AI: Analyze Impact',
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
        `⚠️ React Graph AI: ${componentName} has HIGH impact — ${result.dependents.length} dependents will re-render: ${dependentList}${more}`,
        'Copy Full Analysis'
      ).then(action => {
        if (action === 'Copy Full Analysis') {
          vscode.env.clipboard.writeText(JSON.stringify(result, null, 2));
        }
      });
    } else if (result.impactLevel === 'MEDIUM') {
      vscode.window.showWarningMessage(
        `React Graph AI: ${componentName} has MEDIUM impact — ${result.dependents.length} dependents: ${dependentList}${more}`
      );
    } else {
      vscode.window.showInformationMessage(
        `React Graph AI: ${componentName} has LOW impact — ${result.dependents.length === 0 ? 'no dependents' : dependentList}`
      );
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(`React Graph AI: ${err.message}`);
  }
}

// ─── Chat Participant: @reactgraph in Copilot Chat ────────────────────────────

async function handleChat(
  request: vscode.ChatRequest,
  _context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  _token: vscode.CancellationToken
): Promise<void> {
  if (!engine) {
    stream.markdown('⏳ React Graph AI is still indexing this workspace. Try again in a moment.');
    return;
  }

  const query = request.prompt.trim();
  if (!query) {
    stream.markdown(
      [
        '**React Graph AI** — token-optimized React/Next.js context.',
        '',
        'Usage:',
        '- `@reactgraph <ComponentName>` — get pruned context with source',
        '- `@reactgraph /impact <ComponentName>` — show blast radius',
        '- `@reactgraph /tree <ComponentName>` — show render tree',
        '',
        'Or just describe what you\'re working on and I\'ll find the relevant components.',
      ].join('\n')
    );
    return;
  }

  // Subcommand routing
  if (request.command === 'impact') {
    try {
      const result = engine.getImpactAnalysis(query);
      stream.markdown(`**Impact: ${result.impactLevel}** for \`${result.componentName}\`\n\n`);
      stream.markdown(`Dependents (${result.dependents.length}): ${result.dependents.join(', ') || '_none_'}\n\n`);
      stream.markdown(`\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``);
    } catch (err: any) {
      stream.markdown(`❌ ${err.message}`);
    }
    return;
  }

  if (request.command === 'tree') {
    const tree = engine.getComponentTree(query, 4);
    stream.markdown(`**Render tree from \`${query}\`:**\n\n\`\`\`json\n${JSON.stringify(tree, null, 2)}\n\`\`\``);
    return;
  }

  // Default: get_minimal_context style query
  const ctx = await engine.getAIReadyContext(query);
  if (ctx.error) {
    stream.markdown(`❌ ${ctx.error}\n\nDid you mean one of these?\n`);
    for (const s of (ctx.suggestions ?? []).slice(0, 6)) {
      const label = typeof s === 'string' ? s : `\`${s.name}\` — _${s.path}_`;
      stream.markdown(`- ${label}\n`);
    }
    return;
  }

  stream.markdown(
    `**Matched** \`${ctx.target.name}\` (${ctx.target.type}). ` +
    `Context: **${ctx.optimization.contextTokens} tokens** vs ${ctx.optimization.totalRepoTokens.toLocaleString()} full repo (saved ${ctx.optimization.tokenSavingsPct}).\n\n`
  );
  stream.markdown(`\`\`\`\n${ctx.contextSummary}\n\`\`\``);
}

// ─── Language Model Tools — Copilot can auto-call these ──────────────────────

class GetContextTool implements vscode.LanguageModelTool<{ query: string }> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<{ query: string }>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    if (!engine) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('React Graph AI is still indexing. Try again in a moment.'),
      ]);
    }
    const ctx = await engine.getAIReadyContext(options.input.query);
    if (ctx.error) {
      const suggestions = (ctx.suggestions ?? [])
        .map((s: any) => typeof s === 'string' ? s : `${s.name} (${s.path})`)
        .join(', ');
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `No match for "${options.input.query}". Candidates: ${suggestions}`
        ),
      ]);
    }
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(
        `# React Graph context for "${options.input.query}"\n` +
        `Tokens: ${ctx.optimization.contextTokens} (saved ${ctx.optimization.tokenSavingsPct} vs reading raw files)\n\n` +
        ctx.contextSummary
      ),
    ]);
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<{ query: string }>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Fetching React graph context for "${options.input.query}"…`,
    };
  }
}

class GetImpactTool implements vscode.LanguageModelTool<{ componentName: string }> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<{ componentName: string }>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    if (!engine) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('React Graph AI is still indexing. Try again in a moment.'),
      ]);
    }
    try {
      const result = engine.getImpactAnalysis(options.input.componentName);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `# Impact analysis: ${result.componentName}\n` +
          `Impact level: ${result.impactLevel}\n` +
          `Dependents (${result.dependents.length}): ${result.dependents.join(', ') || 'none'}\n\n` +
          'Affected render paths:\n' +
          (result.affectedTree.map(p => `- ${p}`).join('\n') || '_none_')
        ),
      ]);
    } catch (err: any) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error: ${err.message}`),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<{ componentName: string }>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Analyzing impact of ${options.input.componentName}…`,
    };
  }
}

export function deactivate() {
  if (rebuildTimer) clearTimeout(rebuildTimer);
}
