# ⚡ ReactPrune — Stop Wasting Tokens on Your React Codebase

> **Cut LLM token usage by 90%+ on every AI request. Works with GitHub Copilot, Claude, ChatGPT, Cursor, Windsurf, and every AI tool you already use.**

ReactPrune builds a **Behavioral Graph** of your React/Next.js codebase and delivers only the precise structural context an AI needs — not the entire repo. Your AI gets smarter answers. You pay a fraction of the cost.

![npm](https://img.shields.io/badge/npm-reactprune-red)
![MCP](https://img.shields.io/badge/MCP-Claude%20%7C%20Cursor%20%7C%20Windsurf-green)
![VS Code](https://img.shields.io/badge/VS%20Code-Extension-blue)
![License](https://img.shields.io/badge/License-Apache%202.0-blue)

---

## 💸 The Problem: You Are Overpaying for Every AI Request

Every time you ask Copilot, Claude, or ChatGPT a question about your React app, your tool dumps thousands of lines of irrelevant code into the prompt. You pay for every token.

| Scenario | Without ReactPrune | With ReactPrune |
|---|---|---|
| Fix a bug in `Navbar` | ~15,000 tokens | ~300 tokens |
| Refactor an auth component | ~40,000 tokens | ~600 tokens |
| Trace a state bug | ~20,000 tokens | ~400 tokens |
| **Cost per day (100 queries)** | **~$12–36/day** | **~$0.05–0.20/day** |

Token counts are measured from real structural graph output — not estimated.

---

## 🧠 How It Works

Standard AI tools send full files. ReactPrune sends **structural summaries**.

Instead of shipping 80 lines of raw `Navbar.tsx`:

```
// What other tools send (1,200+ tokens):
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
// ... 80 lines of JSX, styles, handlers ...
```

ReactPrune sends a compressed behavioral summary (~80 tokens):

```
[COMPONENT] Navbar · src/components/Navbar.tsx:12-95
directive: use client
state: isOpen
hooks: useAuth · useState
context: AuthContext
renders: Logo · MobileMenu · LoginButton
passes: LoginButton{onClick,disabled} · Logo{size}
impact: HIGH · dependents: App, DashboardLayout, AdminShell
```

**Same signal. 15x fewer tokens. Every single query.**

---

## 🚀 5-Minute Setup

### Option 1 — VS Code Extension (Recommended for Copilot users)

Install from the VS Code Marketplace:

```
ext install reactprune.reactprune
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
    "reactprune": {
      "command": "npx",
      "args": ["-y", "reactprune"],
      "cwd": "/path/to/your-react-app"
    }
  }
}
```

Then drop the matching rules file into your project root to make token reduction **fully automatic** — your AI calls the graph tools without being asked:

```bash
# Claude Code / Antigravity
cp node_modules/reactprune/templates/CLAUDE.md .

# Cursor
cp node_modules/reactprune/templates/.cursorrules .

# Windsurf
cp node_modules/reactprune/templates/.windsurfrules .
```

### Option 3 — CLI

```bash
# Analyze your entire React project
npx reactprune analyze ./your-app

# Get token-optimized context for any query
npx reactprune context ./your-app "Navbar login button"

# Check blast radius before changing a component
npx reactprune impact ./your-app Button

# Trace state propagation
npx reactprune trace ./your-app isOpen
```

---

## 🔥 What Makes ReactPrune Different

### React-Aware — Not Generic RAG

Generic AI tools use semantic search or file chunking. ReactPrune understands **React relationships**:

- **Component render hierarchy** — who renders what, how deep
- **Props flow** — exactly which props are passed between which components
- **Hook dependencies** — `useEffect` dep arrays, `useContext` consumers
- **State propagation** — trace any `useState`/`useReducer` value through every re-render path
- **Next.js boundaries** — `'use client'` / `'use server'` directives, `page.tsx`, `layout.tsx`, `loading.tsx`

When you say *"fix the login bug"*, ReactPrune doesn't send `Footer.tsx`. It sends `Navbar`, `LoginButton`, `useAuth`, and their structural relationships. Nothing else.

### Blast Radius Analysis — Before You Break Anything

```bash
npx reactprune impact Button
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

ReactPrune measures actual token savings on every query — not a made-up percentage. The dashboard and VS Code extension both show you live numbers: `312 tokens used vs 94,000 in repo`.

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

When keyword search isn't enough, ReactPrune falls back to semantic reasoning. Set your preferred provider:

```env
AI_PROVIDER="anthropic"   # options: gemini, openai, anthropic
ANTHROPIC_API_KEY="sk-ant-..."
```

---

## 📦 Use as a Library

Embed the graph engine directly into your own tools:

```typescript
import { buildGraph, QueryEngine } from 'reactprune';

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
