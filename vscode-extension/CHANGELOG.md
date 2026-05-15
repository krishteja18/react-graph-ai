# Changelog

## 1.1.1

- Fix: the "Paste into AI" button on the success notification did nothing. Replaced with two working actions: **Open in Copilot Chat** (opens VS Code's chat panel pre-loaded with the copied context) and **Preview** (opens a new markdown editor showing exactly what was copied).

## 1.1.0

- **Major: pruned context now includes source code, not just structural summary** — AI can answer "how does X work" questions, not just relationship questions
- **Tokenized query scoring** — multi-word queries like "auth form" now match correctly without an AI provider key
- **Utility function support** — exported non-component functions (e.g. `getCurrentUser` in `lib/session.ts`) are now captured and surfaced as UTILITY nodes
- **Import-following** — when a component is matched, the source of utility functions it imports is included automatically (e.g. querying `DashboardLayout` pulls in `getCurrentUser` + config files)
- Improved fallback suggestions when a query has no match — shows component name + file path

## 1.0.0

Initial release.

- Copy AI Context command — emit token-optimized structural summaries to the clipboard
- Analyze Component Impact command — show dependents and re-render blast radius
- Rebuild Graph Index command — force a workspace re-scan
- Status bar indicator with live component count
- Activates on workspaces containing `.tsx` or `.jsx` files
