/**
 * Token-reduction benchmark for react-graph-ai.
 *
 * Compares three context strategies for a set of queries:
 *   1. full-repo:       concat every .ts/.tsx/.jsx source file (naive "send everything")
 *   2. component-files: concat only files that define React components
 *   3. graph-pruned:    the JSON output of getMinimalContext()
 *
 * Token counts use a 4-chars-per-token approximation (close to GPT-4/Claude
 * tokenizers for English/code; off by ~5-15% but consistent across strategies).
 *
 * Run: npx tsx scripts/benchmark.ts [path-to-react-project]
 */

import { buildGraph } from '../src/lib/engine/graph-builder';
import { QueryEngine } from '../src/lib/engine/query-engine';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

const APPROX_CHARS_PER_TOKEN = 4;
const estimateTokens = (s: string) => Math.ceil(s.length / APPROX_CHARS_PER_TOKEN);

async function readAllSourceFiles(root: string): Promise<{ file: string; content: string }[]> {
  const patterns = ['**/*.tsx', '**/*.jsx', '**/*.ts', '**/*.js'];
  const ignore = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/coverage/**'];
  const files = (await Promise.all(patterns.map(p => glob(p, { cwd: root, absolute: true, ignore })))).flat();
  const unique = [...new Set(files)];
  const out: { file: string; content: string }[] = [];
  for (const f of unique) {
    try { out.push({ file: f, content: await fs.readFile(f, 'utf-8') }); } catch {}
  }
  return out;
}

async function run() {
  const target = path.resolve(process.cwd(), process.argv[2] || '.');
  console.log(`\n📊 react-graph-ai token benchmark`);
  console.log(`Target: ${target}\n`);

  const allFiles = await readAllSourceFiles(target);
  const fullRepoTokens = estimateTokens(allFiles.map(f => f.content).join('\n'));

  const graph = await buildGraph(target);
  const engine = new QueryEngine(graph);

  const componentFiles = new Set(
    graph.nodes.filter(n => n.type === 'COMPONENT').map(n => path.resolve(target, n.filePath))
  );
  const componentFileTokens = estimateTokens(
    allFiles.filter(f => componentFiles.has(f.file)).map(f => f.content).join('\n')
  );

  // Pull real component names from the graph so queries actually match
  const componentNames = graph.nodes.filter(n => n.type === 'COMPONENT').map(n => n.name);
  const queries = componentNames.slice(0, 5);
  if (queries.length === 0) queries.push('Navbar');

  console.log(`Repo stats: ${allFiles.length} source files, ${graph.nodes.length} graph nodes, ${graph.nodes.filter(n => n.type === 'COMPONENT').length} components\n`);
  console.log(`Baselines:`);
  console.log(`  full-repo:        ~${fullRepoTokens.toLocaleString()} tokens (every source file)`);
  console.log(`  component-files:  ~${componentFileTokens.toLocaleString()} tokens (component files only)\n`);
  console.log(`Per-query graph-pruned context:`);
  console.log(`${'Query'.padEnd(28)} ${'pruned'.padStart(10)} ${'vs full'.padStart(10)} ${'vs comp'.padStart(10)}`);
  console.log('-'.repeat(60));

  for (const q of queries) {
    const ctx = await engine.getAIReadyContext(q);
    const ctxJson = ctx.contextSummary ?? JSON.stringify(ctx, null, 2);
    const ctxTokens = estimateTokens(ctxJson);
    const fullPct = ((1 - ctxTokens / fullRepoTokens) * 100).toFixed(1);
    const compPct = ((1 - ctxTokens / componentFileTokens) * 100).toFixed(1);
    console.log(`${q.padEnd(28)} ${ctxTokens.toString().padStart(10)} ${(fullPct + '%').padStart(10)} ${(compPct + '%').padStart(10)}`);
  }

  console.log('\nNotes:');
  console.log('- Token counts are estimates (4 chars/token). Real Claude/GPT counts differ ~5-15%.');
  console.log('- "vs full" = savings vs pasting every source file. "vs comp" = vs pasting just component files.');
  console.log('- Pruned context includes structural summary + source code of matched components + imported utility sources.');
}

run().catch(e => { console.error(e); process.exit(1); });
