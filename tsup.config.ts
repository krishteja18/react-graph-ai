import { defineConfig } from 'tsup';

export default defineConfig([
  // Unified CLI + MCP bin entry (the reactprune executable)
  {
    entry: { bin: 'src/bin.ts' },
    outDir: 'dist',
    format: ['esm'],
    target: 'node18',
    splitting: false,
    clean: false,
    banner: { js: '#!/usr/bin/env node' },
  },
  // Internal modules — no shebang, no banner
  {
    entry: {
      'mcp/server': 'src/mcp/server.ts',
      'cli/index': 'src/cli/index.ts',
    },
    outDir: 'dist',
    format: ['esm'],
    target: 'node18',
    splitting: false,
    clean: true,
  },
]);
