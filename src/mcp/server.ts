/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { buildGraph } from "../lib/engine/graph-builder.js";
import { QueryEngine } from "../lib/engine/query-engine.js";
import path from "path";

/**
 * ReactPrune MCP Server
 * Exposes the Graph Memory Engine as tools for AI models.
 */

async function main() {
  const rootDir = process.env.TARGET_DIR
    ? path.resolve(process.env.TARGET_DIR)
    : process.cwd();
  let graph = await buildGraph(rootDir);
  let engine = new QueryEngine(graph);

  const server = new Server(
    {
      name: "reactprune",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  /**
   * List available tools to the AI
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "get_minimal_context",
          description: `ALWAYS call this tool first before answering ANY question about this React/Next.js codebase — bugs, features, refactors, or architecture. Do NOT read source files directly. This tool uses a behavioral graph to return only the relevant structural context (hooks, state, props, render tree, impact) at a fraction of the token cost of reading files. Pass the developer's question or the component name as the query.`,
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "The developer's question or component name (e.g. 'Navbar login button', 'fix auth bug')" },
            },
            required: ["query"],
          },
        },
        {
          name: "get_impact_analysis",
          description: `Call this before making ANY change to a shared component. Returns which components will re-render and the blast radius (LOW/MEDIUM/HIGH). Prevents unintended regressions. Use after get_minimal_context identifies the target component.`,
          inputSchema: {
            type: "object",
            properties: {
              componentName: { type: "string", description: "Name of the component you are about to change" },
            },
            required: ["componentName"],
          },
        },
        {
          name: "trace_state_flow",
          description: `Call this when the developer asks about state, data flow, or why something re-renders. Traces a state variable from its owner component through all components that will re-render when it changes. More accurate than reading files manually.`,
          inputSchema: {
            type: "object",
            properties: {
              stateName: { type: "string", description: "Name (or partial name) of the state variable to trace (e.g. 'isOpen', 'user', 'cart')" },
            },
            required: ["stateName"],
          },
        },
        {
          name: "get_component_tree",
          description: `Call this when the developer asks about component structure, hierarchy, or render relationships. Returns the full nested render tree for a component without reading any files.`,
          inputSchema: {
            type: "object",
            properties: {
              componentName: { type: "string", description: "Name of the root component to build the tree from" },
              depth: { type: "number", description: "Maximum depth to traverse (default 4)" },
            },
            required: ["componentName"],
          },
        },
        {
          name: "list_components",
          description: `Call this when you need to discover what components exist in the project before querying a specific one. Returns all components with their file paths.`,
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      ],
    };
  });

  /**
   * Handle tool execution
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === "get_impact_analysis") {
        const analysis = engine.getImpactAnalysis(args?.componentName as string);
        return {
          content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }],
        };
      }

      if (name === "get_minimal_context") {
        const context = await engine.getAIReadyContext(args?.query as string);
        return {
          content: [{ type: "text", text: JSON.stringify(context, null, 2) }],
        };
      }

      if (name === "list_components") {
        const components = graph.nodes.filter(n => n.type === "COMPONENT").map(n => ({
          name: n.name,
          path: n.filePath
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(components, null, 2) }],
        };
      }

      if (name === "trace_state_flow") {
        const result = engine.traceStateFlow(args?.stateName as string);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      if (name === "get_component_tree") {
        const result = engine.getComponentTree(args?.componentName as string, args?.depth as number | undefined);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      throw new Error(`Tool not found: ${name}`);
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`ReactPrune MCP Server running — targeting: ${rootDir}`);
  console.error(`Tip: copy the matching rules file from node_modules/reactprune/templates/ into your project root to enforce graph-first context automatically.`);
}

main().catch((error) => {
  console.error("Fatal error in MCP server:", error);
  process.exit(1);
});
