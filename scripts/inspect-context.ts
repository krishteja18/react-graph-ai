import { buildGraph } from '../src/lib/engine/graph-builder';
import { QueryEngine } from '../src/lib/engine/query-engine';

async function run() {
  const target = process.argv[2] || '.';
  const query = process.argv[3] || 'UserAuthForm';
  const graph = await buildGraph(target);
  const engine = new QueryEngine(graph);
  const ctx = await engine.getMinimalContext(query);
  console.log(JSON.stringify(ctx, null, 2));
}
run();
