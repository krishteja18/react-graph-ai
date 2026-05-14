/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { buildGraph } from '../lib/engine/graph-builder';
import { QueryEngine } from '../lib/engine/query-engine';
import path from 'path';

async function runCli() {
  const args = process.argv.slice(2);
  const command = args[0] || 'analyze';
  const target = args[1] || '.';

  const absoluteRoot = path.resolve(process.cwd(), target);

  console.log(`🚀 ReactPrune: Analyzing ${absoluteRoot}...`);

  try {
    const graph = await buildGraph(absoluteRoot);
    const engine = new QueryEngine(graph);

    if (command === 'analyze') {
      console.log('\n📊 Repository Statistics:');
      console.log(`- Total Files: ${graph.metadata.totalFiles}`);
      console.log(`- Total Nodes: ${graph.nodes.length}`);
      console.log(`- Total Edges: ${graph.edges.length}`);
      
      const components = graph.nodes.filter(n => n.type === 'COMPONENT');
      console.log(`- Components found: ${components.length}`);

      console.log('\n🔥 Critical Components (Highest Impact):');
      const impactResults = components.map(c => engine.getImpactAnalysis(c.id))
        .sort((a, b) => b.dependents.length - a.dependents.length)
        .slice(0, 5);

      impactResults.forEach(res => {
        console.log(`\n- ${res.componentName}`);
        console.log(`  Impact: ${res.impactLevel}`);
        console.log(`  Dependents: ${res.dependents.join(', ') || 'None'}`);
      });
    }

    if (command === 'impact') {
      const nodeName = args[2];
      if (!nodeName) {
        console.log('Usage: npx reactscope impact . <ComponentName>');
        return;
      }
      const result = engine.getImpactAnalysis(nodeName);
      console.log('\n🔍 Impact Analysis for', nodeName);
      console.log(JSON.stringify(result, null, 2));
    }

    if (command === 'trace') {
      const nodeName = args[2];
      if (!nodeName) {
        console.log('Usage: npx tsx src/cli/index.ts trace . <stateName>');
        return;
      }
      const result = engine.traceStateFlow(nodeName);
      console.log(JSON.stringify(result, null, 2));
    }

    if (command === 'tree') {
      const nodeName = args[2];
      if (!nodeName) {
        console.log('Usage: npx tsx src/cli/index.ts tree . <componentName>');
        return;
      }
      const result = engine.getComponentTree(nodeName);
      console.log(JSON.stringify(result, null, 2));
    }

  } catch (err: any) {
    console.error('Analysis failed:', err.message);
  }
}

runCli();
