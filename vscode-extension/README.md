# React Graph AI — Token-Slim AI Context for React

Stop wasting tokens. React Graph AI builds a **behavioral graph** of your React/Next.js codebase and sends only the precise structural context an AI needs — not the entire repo. Works with GitHub Copilot, Claude, ChatGPT, and any AI tool that accepts context from your clipboard.

## Features

- **Copy AI Context (Token-Optimized)** — Right-click any `.tsx` / `.jsx` / `.ts` / `.js` file or run from the command palette. Copies a compressed structural summary of the relevant components to your clipboard, ready to paste into your AI tool. Typical savings: **90%+ vs. pasting the raw files.**
- **Analyze Component Impact** — Before refactoring, see the blast radius: which components re-render, which routes break, how many dependents.
- **Rebuild Graph Index** — Re-scans your workspace after major changes. Shown in the status bar.

## How it works

React Graph AI parses your codebase with Babel, builds a directed graph of components / hooks / state, and emits structural summaries — not raw source. A typical query goes from ~94,000 tokens (full repo) to ~300 tokens (graph context).

## Requirements

- A React or Next.js workspace (`.tsx` or `.jsx` files present)
- VS Code 1.80 or newer

## Commands

| Command | Description |
|---|---|
| `React Graph AI: Copy AI Context` | Copy token-optimized context for the current file or a queried component |
| `React Graph AI: Analyze Impact` | Show dependents and re-render impact for a component |
| `React Graph AI: Rebuild Graph Index` | Force a rebuild of the workspace graph |

## Related

- npm package: [`react-graph-ai`](https://www.npmjs.com/package/react-graph-ai) — the CLI / MCP server that powers this extension
- Source: https://github.com/krishteja18/react-graph-ai

## License

Apache-2.0
