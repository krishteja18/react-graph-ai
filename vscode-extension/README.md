# React Graph AI — Token-Slim AI Context for React

Stop wasting tokens. React Graph AI builds a **behavioral graph** of your React/Next.js codebase and sends only the precise structural context an AI needs — not the entire repo. **First-class GitHub Copilot integration** plus support for any AI tool that reads your clipboard.

## How Copilot uses it (v1.2+)

Two integration paths, both automatic once installed:

**1. `@reactgraph` chat participant** — In Copilot Chat, type:

> @reactgraph UserAuthForm
>
> How does the GitHub sign-in flow work, and what would break if I require the password to be 8+ characters?

You get a token-optimized summary inline, then Copilot answers using it.

Subcommands: `/impact <Name>` for blast radius, `/tree <Name>` for the render hierarchy.

**2. Auto-invoked language model tools** — Two tools (`reactGraph`, `reactImpact`) register themselves so Copilot calls them on its own. When you ask Copilot to fix a bug or refactor a component, it reads our tool descriptions and decides to grab graph context before answering — no `@` mention needed. Works inside Copilot Chat, inline edits, and any prompt where Copilot is allowed to invoke tools.

You can also explicitly nudge Copilot with `#reactGraph` in your message.

## Manual commands (for non-Copilot users)

- **Copy AI Context (Token-Optimized)** — Right-click any `.tsx` / `.jsx` file or run from the command palette. Pruned context goes to your clipboard, ready to paste into Claude, ChatGPT, Cursor, Windsurf — any AI tool.
- **Analyze Component Impact** — Before refactoring a shared component, see what breaks: dependents, re-render paths, impact level (LOW/MEDIUM/HIGH).
- **Rebuild Graph Index** — Force re-scan after major file changes.

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
