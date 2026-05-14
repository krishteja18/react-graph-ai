/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Unified entry point:
//   no args  → start MCP server (used by Claude Desktop, Cursor, Windsurf)
//   with args → run CLI commands (analyze, impact, trace, tree, context)

const args = process.argv.slice(2);
const firstArg = args[0];

const CLI_COMMANDS = new Set(['analyze', 'impact', 'trace', 'tree', 'context', 'list']);

if (!firstArg || !CLI_COMMANDS.has(firstArg)) {
  // Start MCP server — import dynamically so the CLI path pays no cost
  import('./mcp/server.js');
} else {
  import('./cli/index.js');
}
