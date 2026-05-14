import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { extension: 'src/extension.ts' },
  outDir: 'dist',
  format: ['cjs'],       // VS Code extension host requires CommonJS
  target: 'node18',
  external: ['vscode'],  // vscode is provided by the host — never bundle it
  splitting: false,
  clean: true,
  sourcemap: true,
});
