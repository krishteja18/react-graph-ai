# 🛰️ ReactGraph AI — MCP Guide

ReactGraph AI uses the **Model Context Protocol (MCP)** to allow AI models in your IDE (like Cursor, Claude Desktop, or Windsurf) to directly query your project's architectural graph.

This drastically reduces token usage by sending only relevant component slices instead of full files.

## 🚀 How to use in your IDE

### 1. In Claude Desktop
Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "reactscope": {
      "command": "npx",
      "args": ["-y", "tsx", "path/to/reactgraph-ai/src/mcp/server.ts"],
      "cwd": "path/to/your/project"
    }
  }
}
```

### 2. In Cursor (using MCP)
Go to **Settings > Features > MCP** and add a new MCP server:
- **Name:** ReactGraph
- **Type:** command
- **Command:** `npx -y tsx src/mcp/server.ts`

---

## 🛠️ Available AI Tools

Once connected, your AI can automatically use these tools:

### `get_impact_analysis`
**Usage:** "What happens if I change the Button component?"
**Result:** AI identifies all rendering parents and state dependencies, allowing it to write safer code.

### `get_minimal_context`
**Usage:** "Fix the bug in the Navbar login flow."
**Result:** Instead of reading 10 files, ReactScope tells the AI exactly which 2 components are involved in the flow, saving ~90% tokens.

### `list_components`
**Usage:** "Show me all components in this project."
**Result:** Returns a clean list of all identified React components.

---

## 🧠 Why this reduces tokens?
Typically, an AI "Chat with Code" feature reads entire files or uses simple keyword search.
**ReactGraph AI** uses a **Behavioral Graph**. It knows that `Button` is used by `Navbar`, and `Navbar` is used by `Dashboard`. 

When you ask to change `Button`, it only sends the `Button` code + the relevant interfaces of its parents, ensuring the AI has the "architectural map" without the "token bloat".
