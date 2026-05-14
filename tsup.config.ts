import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'mcp/server': 'src/mcp/server.ts',
    'cli/index': 'src/cli/index.ts',
  },
  outDir: 'dist',
  format: ['esm'],
  target: 'node18',
  splitting: false,
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
});
