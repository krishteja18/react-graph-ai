# ⚛️ ReactGraph AI — Behavioral Graph Engine

ReactGraph AI is a graph-aware architectural assistant designed to drastically reduce token usage in AI-powered development. Instead of feeding entire repositories into an LLM, ReactGraph extracts a **Behavioral Graph** of your React components, allowing AIs to understand impact and context with 90% fewer tokens.

![Architecture](https://img.shields.io/badge/Architecture-Graph--Authoritative-06b6d4)
![Protocol](https://img.shields.io/badge/Protocol-MCP-green)

## 🚀 Core Features

-   **Behavioral Graph Engine**: Uses Babel to statically analyze components, hooks, and props relationships.
-   **Impact Analysis**: Instantly visualize how a change in a low-level component (e.g., `Button`) propagates through the entire application.
-   **AI Context Optimizer**: Generates "Minimal Viable Context" for LLMs, ensuring they only see the code they need to fix the specific bug or build the requested feature.
-   **MCP Server**: Built-in support for the Model Context Protocol, allowing **Claude Desktop**, **Cursor**, and **Windsurf** to treat your codebase as a queryable database.

## 🛠️ Getting Started

### 1. Installation
```bash
git clone https://github.com/your-username/reactgraph-ai.git
cd reactgraph-ai
npm install
```

### 2. Analyze a Project
Point ReactGraph at any React directory to generate a graph:
```bash
npm run analyze -- ./path/to/your/react-app
```

### 3. Run the Dashboard
Visualize your project's architectural health and impact zones:
```bash
npm run dev
```
Open `http://localhost:3000` to see the technical dashboard.

## 🛰️ Using as an MCP Server (IDE Integration)

ReactGraph exposes tools directly to your AI agent (Claude, Cursor, etc.).

Add this to your MCP configuration:
```json
{
  "mcpServers": {
    "reactgraph": {
      "command": "npx",
      "args": ["-y", "tsx", "src/mcp/server.ts"],
      "cwd": "/path/to/reactgraph-ai"
    }
  }
}
```

### 🧰 Available AI Tools:
- **`get_impact_analysis`**: Tells the AI which parents will re-render if a component changes.
- **`get_minimal_context`**: Provides code snippets for only the relevant slice of the repo.
- **`list_components`**: Lists architectural nodes discovered in the graph.

## 📦 Use as an NPM Library
You can embed the logic directly into your own tools:

```typescript
import { buildGraph, QueryEngine } from 'reactgraph-ai';

// 1. Build the architectural graph
const graph = await buildGraph('./src');

// 2. Query for AI-ready context
const engine = new QueryEngine(graph);
const context = await engine.getAIReadyContext('How does Auth work?');

console.log(context.impactAnalysis); // Returns what will break if Auth changes
```

## 🛠️ Other IDE Integration Methods

Besides MCP, here are other ways to use ReactGraph with AIs:

1. **CLI for Claude Code / Antigravity**:
   AIs can execute shell commands. Simply run:
   ```bash
   npx reactgraph-ai analyze "Navbar login button"
   ```
   This outputs a token-shrunk text slice that the AI can immediately process.

2. **VS Code Extension (Custom Sidebar)**:
   By importing this library into a VS Code Extension, you can show the **Impact Tree** in a custom sidebar, allowing you to "Send Context to Chat" with one click.

3. **REST API (Local Server)**:
   Keep the ReactGraph server running in the background. Your IDE plugin can send a `POST` to `http://localhost:3000/api/analyze` to get real-time graph updates without reloading the repo.

4. **Git Hook (Pre-commit Analysis)**:
   Run an impact report before committing:
   ```bash
   npx reactgraph-ai --impact-only
   ```
   If a change in `utils.ts` affects more than 20% of the project, it can warn the developer to check the architectural map.

## 🧠 Why ReactGraph?
Standard AI tools use "RAG" or full-file reading. This is expensive and noisy. ReactGraph understands **React relationships**. If you say "Fix the Navbar login," ReactGraph doesn't send the `Footer.tsx` — it sends the `Navbar`, its `useAuth` hook, and the `LoginButton`.

## 🧠 Multi-Provider Semantic Search
ReactGraph supports semantic reasoning via multiple LLM providers. If you provide an API key, the library can map complex queries (e.g. "How does authentication flow work?") to code without needing exact file names.

Set your preferred provider in your environment:
```env
AI_PROVIDER="openai" # options: gemini, openai, anthropic
OPENAI_API_KEY="sk-..."
```

## 📜 License
Apache License 2.0. See [LICENSE](LICENSE) for details.
