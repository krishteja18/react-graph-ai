# 🧠 How LLMs interact with ReactGraph AI

When you install `reactgraph-ai` as an NPM package, LLMs (like Claude, GPT-4, or Gemini) interact with it in three main ways depending on the environment:

## 1. Tool Use (via MCP) — *The Standard Way*
This is the most "intelligent" way. Modern IDEs like **Cursor**, **Windsurf**, and **Claude Desktop** allow LLMs to "see" external tools.
- **The Flow**: You ask: "What happens if I change the UserProfile component?"
- **The LLM**: It sees a tool called `get_impact_analysis` available from ReactGraph.
- **The Action**: The LLM calls that tool behind the scenes.
- **The Result**: It receives a JSON map of all dependents. It then tells you: "Changing UserProfile will affect the Dashboard and Settings page. Should I update those as well?"
- **Token Benefit**: The LLM doesn't have to read the whole repo to figure this out. It just gets the answer.

## 2. CLI Execution — *The Claude Code / Antigravity Way*
Agents that have access to your terminal (like Claude Code or any shell-enabled AI) can simply run the CLI.
- **The Flow**: You say "Extract a token-optimized context for the Login flow."
- **The LLM**: Executes `npx reactgraph-ai analyze "Login flow"`.
- **The Action**: The CLI prints a specialized "AI-Ready" XML or Markdown block containing only the relevant code slices.
- **The Result**: The LLM reads that output from the terminal and uses it as its primary context.
- **Token Benefit**: Instead of feeding 50 files into the chat, the CLI feeds only the 3 files actually involved in the logic.

## 3. Library Integration — *The 'Agent Builder' Way*
If you are building your own AI agent (e.g., using LangChain or Vercel AI SDK), you import our logic to "pre-filter" what you send to the LLM.
- **The Flow**: 
  1. User asks a question in your custom IDE.
  2. Your backend runs `QueryEngine.getAIReadyContext(query)`.
  3. You take that small context and append it as a "System Message" or "User Context" to your LLM call.
- **The Result**: The LLM remains "thin" and fast because you aren't bloating its prompt with irrelevant code.

---

### Comparison of Methods

| Method | Best For | Level of Integration |
| :--- | :--- | :--- |
| **MCP** | Cursor, Claude Desktop | High (LLM chooses when to use it) |
| **CLI** | Claude Code, Terminal UIs | Medium (LLM runs it as a command) |
## 🔑 Do users need to provide an API Key?
It depends on how they use it:

1. **Passive Mode (No Key Required)**: 
   If they use it via **MCP** in an IDE like Cursor, the IDE's internal LLM (which they already pay for) does all the "thinking." ReactGraph just provides the raw architectural data.
   
2. **Active Semantic Mode (Key Required)**:
   If they want the library itself to perform semantic reasoning (e.g., mapping a query like "how does auth work" to the specific `useAuth.ts` file without them knowing the file name), they provide an `AI_PROVIDER` key in their environment.
   - We support **Gemini, OpenAI, and Anthropic**.
   - This allows ReactGraph to work as a standalone "Smart CLI".
