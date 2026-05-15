# ⚡ React Graph AI — Stop Wasting Tokens on Your React Codebase

> **Cut LLM token usage by 95%+ on component-level queries. Works with GitHub Copilot, Claude, ChatGPT, Cursor, Windsurf, and any AI tool that accepts pasted context.**

React Graph AI builds a **Behavioral Graph** of your React/Next.js codebase and delivers only the precise structural context an AI needs — not the entire repo. Your AI gets smarter answers. You pay a fraction of the cost.

[![npm version](https://img.shields.io/npm/v/react-graph-ai.svg)](https://www.npmjs.com/package/react-graph-ai)
![MCP](https://img.shields.io/badge/MCP-Claude%20%7C%20Cursor%20%7C%20Windsurf-green)
![VS Code](https://img.shields.io/badge/VS%20Code-Extension-blue)
![License](https://img.shields.io/badge/License-Apache%202.0-blue)

---

## 💸 The Problem: You Are Overpaying for Every AI Request

Every time you ask Copilot, Claude, or ChatGPT a question about your React app, your tool dumps thousands of lines of irrelevant code into the prompt. You pay for every token.

| Scenario | Without React Graph AI | With React Graph AI |
|---|---|---|
| Look up `UserAuthForm` (incl. source + utilities) | ~60,000 tokens | ~1,500 tokens |
| Look up `UserAvatar` | ~60,000 tokens | ~1,700 tokens |
| `UserAccountNav` refactor (incl. callers) | ~60,000 tokens | ~1,260 tokens |
| `DashboardLayout` (incl. `getCurrentUser` source + config) | ~60,000 tokens | ~1,420 tokens |

Numbers from a 129-file Next.js codebase (`shadcn-ui/taxonomy`). Pruned context includes structural summary + full source code of the matched component + source of every utility/hook it imports. Reproduce with the included [benchmark](scripts/benchmark.ts). Token counts are estimated at 4 chars/token; real Claude/GPT counts differ by ~5–15%.

---

## 🧠 How It Works

Standard AI tools send full files — including unrelated ones. React Graph AI parses your codebase into a behavioral graph and sends **only the components your query is actually about**, with:

1. **Structural summary** — props flow, state, hooks, render edges, dependents, impact level
2. **Full source code** of the matched component(s) — so the AI can read the actual logic, not just the shape
3. **Source of every utility/hook the matched component imports** — automatically pulled in via import-following

This is what makes cross-cutting questions actually work. When you query `DashboardLayout`, you also get the source of `getCurrentUser` from `lib/session.ts`, `dashboardConfig` from `config/dashboard.ts`, and `cn` from `lib/utils.ts` — without naming any of them.

Measured on a real 129-file Next.js codebase (see [benchmark](scripts/benchmark.ts)):

| Query type | Pruned context | Full repo |
|---|---|---|
| Component lookup (`UserAuthForm`) | ~1,500 tokens | 60,144 tokens |
| Refactor analysis (`UserAccountNav` + callers) | ~1,260 tokens | 60,144 tokens |
| Cross-cutting (`DashboardLayout` + session + config) | ~1,420 tokens | 60,144 tokens |

Token reduction averages **97–98% on real questions** — and the AI can actually answer them, because source code is included.

---

## 🚀 5-Minute Setup

### Option 1 — VS Code Extension (Recommended for Copilot users)

Install from the VS Code Marketplace:

```
ext install react-graph-ai.react-graph-ai
```

- Status bar shows your indexed component count instantly
- Right-click any component file → **"Copy AI Context (Token-Optimized)"**
- Paste into Copilot Chat, ChatGPT, Claude — any AI tool
- Token savings shown in every notification: *"Copied! 312 tokens vs 94,000 in repo — saved 99.7%"*
- Auto-rebuilds graph on every file save

### Option 2 — MCP Server (Best for Claude Desktop, Cursor, Windsurf)

Add 4 lines to your MCP config. Zero cloning required:

```json
{
  "mcpServers": {
    "react-graph-ai": {
      "command": "npx",
      "args": ["-y", "react-graph-ai"],
      "cwd": "/path/to/your-react-app"
    }
  }
}
```

Then drop the matching rules file into your project root to make token reduction **fully automatic** — your AI calls the graph tools without being asked:

```bash
# Claude Code / Antigravity
cp node_modules/react-graph-ai/templates/CLAUDE.md .

# Cursor
cp node_modules/react-graph-ai/templates/.cursorrules .

# Windsurf
cp node_modules/react-graph-ai/templates/.windsurfrules .
```

### Option 3 — CLI

```bash
# Analyze your entire React project (overview + top dependents)
npx react-graph-ai analyze ./your-app

# Check blast radius before changing a shared component
npx react-graph-ai impact ./your-app Button

# Trace state propagation
npx react-graph-ai trace ./your-app isOpen

# Show the render tree under a component
npx react-graph-ai tree ./your-app App
```

For token-optimized AI context, use the MCP server (Option 2) or the VS Code extension (Option 1) — both call `get_minimal_context` automatically when the AI needs it.

---

## 🔥 What Makes React Graph AI Different

### React-Aware — Not Generic RAG

Generic AI tools use semantic search or file chunking. React Graph AI understands **React relationships**:

- **Component render hierarchy** — who renders what, how deep
- **Props flow** — exactly which props are passed between which components
- **Hook dependencies** — `useEffect` dep arrays, `useContext` consumers
- **State propagation** — trace any `useState`/`useReducer` value through every re-render path
- **Next.js boundaries** — `'use client'` / `'use server'` directives, `page.tsx`, `layout.tsx`, `loading.tsx`

When you ask about `UserAuthForm`, React Graph AI sends that component's full source, its `'use client'` directive, hooks, dependents, and the source of any utility it imports — not the 128 other files in your repo.

Multi-word queries are tokenized and scored (`"auth form login"` matches `UserAuthForm` and related utilities). For ambiguous flow questions, set an AI provider key (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY`) to enable semantic re-ranking on top of the keyword scoring.

### Blast Radius Analysis — Before You Break Anything

```bash
npx react-graph-ai impact Button
```

```json
{
  "componentName": "Button",
  "impactLevel": "HIGH",
  "dependents": ["Navbar", "LoginForm", "CheckoutFlow", "AdminPanel", "..."],
  "affectedTree": ["App → Navbar → Button", "App → CheckoutFlow → Button"]
}
```

Know exactly what will break **before** you change a shared component. Your AI gets this context automatically via MCP.

### Real Token Measurement

The VS Code extension and dashboard show live token deltas on every query: pruned context size vs. full-repo size. The repo also ships a reproducible [benchmark script](scripts/benchmark.ts) you can run against any codebase to verify the savings yourself before adopting.

```bash
npx tsx scripts/benchmark.ts /path/to/your-react-app
```

---

## ⚠️ Limitations & roadmap

What works today (v1.1):

- ✅ Component-name lookups (single or multi-word, tokenized matching)
- ✅ Source code included in pruned output (not just structural summary)
- ✅ Utility/hook source pulled in via import-following
- ✅ Refactor analysis with caller/dependent info
- ✅ Cross-cutting queries when a primary component is named

Known gaps tracked for future versions:

- **Pure flow questions without a component name** (e.g. *"how does logout work?"*) — best results with `ANTHROPIC_API_KEY` set for semantic re-ranking
- **Plain JS / JSX** — works but loses some TypeScript-level edges
- **`'use client'` / `'use server'` boundary filtering** — detected but not yet used as a query filter
- **No persistent index yet** — the graph is rebuilt on every MCP server startup. For very large repos this can take 5–15 s. A caching layer is planned.

PRs welcome at https://github.com/krishteja18/react-graph-ai

---

## 🛠️ Available AI Tools (MCP)

| Tool | When Claude uses it | What it returns |
|---|---|---|
| `get_minimal_context` | Before answering any codebase question | Structural summaries for relevant components |
| `get_impact_analysis` | Before changing a shared component | Blast radius, dependent list, impact level |
| `trace_state_flow` | When asked about state or re-renders | Owner component + full propagation path |
| `get_component_tree` | When asked about hierarchy or structure | Full nested render tree |
| `list_components` | When discovering the codebase | All components with file paths |

---

## 📊 Dashboard

Run the visual dashboard to explore your project's architectural health:

```bash
TARGET_DIR=/path/to/your-react-app npm run dev
```

Open `http://localhost:3000`:

- **Interactive graph** — every component, hook, and state node visualized
- **Live impact analysis** — click any node to see its blast radius
- **AI context panel** — query the graph and see real token savings live
- **Auto-rebuild** — graph updates within 500ms of any file change

---

## 🔌 Multi-Provider Semantic Search

When keyword search isn't enough, React Graph AI falls back to semantic reasoning. Set your preferred provider:

```env
AI_PROVIDER="anthropic"   # options: gemini, openai, anthropic
ANTHROPIC_API_KEY="sk-ant-..."
```

---

## 📦 Use as a Library

Embed the graph engine directly into your own tools:

```typescript
import { buildGraph, QueryEngine } from 'react-graph-ai';

const graph = await buildGraph('./src');
const engine = new QueryEngine(graph);

// Get token-optimized structural context
const context = await engine.getAIReadyContext('How does auth work?');
console.log(context.contextSummary);       // Compact structural summaries
console.log(context.optimization.tokenSavingsPct); // e.g. "97.2%"

// Analyze blast radius
const impact = engine.getImpactAnalysis('Button');
console.log(impact.impactLevel); // "HIGH"

// Trace state propagation
const flow = engine.traceStateFlow('isOpen');

// Get full render tree
const tree = engine.getComponentTree('App', 4);
```

---

## 🤝 IDE & Tool Coverage

| Tool | Integration | Token Reduction |
|---|---|---|
| **GitHub Copilot (VS Code)** | VS Code Extension | Manual copy-paste |
| **Claude Desktop** | MCP + CLAUDE.md | ✅ Automatic |
| **Claude Code / Antigravity** | CLAUDE.md | ✅ Automatic |
| **Cursor** | MCP + .cursorrules | ✅ Automatic |
| **Windsurf** | MCP + .windsurfrules | ✅ Automatic |
| **Continue.dev** | MCP | ✅ Automatic |
| **ChatGPT / Any AI** | VS Code Extension (clipboard) | Manual copy-paste |

---

## 📜 License

Apache License 2.0. See [LICENSE](LICENSE) for details.
