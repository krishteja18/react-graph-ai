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
 * ReactScope MCP Server
 * Exposes the Graph Memory Engine as tools for AI models.
 */

async function main() {
  const rootDir = process.cwd();
  let graph = await buildGraph(rootDir);
  let engine = new QueryEngine(graph);

  const server = new Server(
    {
      name: "reactgraph-ai",
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
          name: "get_impact_analysis",
          description: "Analyze the architectural impact of changing a specific React component.",
          inputSchema: {
            type: "object",
            properties: {
              componentName: { type: "string", description: "Name of the component to analyze" },
            },
            required: ["componentName"],
          },
        },
        {
          name: "get_minimal_context",
          description: "Retrieve token-optimized code context and dependency graph for a specific query.",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "What are you trying to fix or build? (e.g., 'Navbar login button')" },
            },
            required: ["query"],
          },
        },
        {
          name: "list_components",
          description: "List all components discovered in the project graph.",
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
  console.error("ReactScope AI MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in MCP server:", error);
  process.exit(1);
});
