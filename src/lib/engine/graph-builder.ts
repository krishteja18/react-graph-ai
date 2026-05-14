/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import { parseReactFile } from './parser';
import { ReactScopeGraph, NodeData, EdgeData, NodeType, EdgeType } from './types';

// Approximation: 1 token ≈ 4 characters (standard GPT-4 heuristic)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function buildGraph(rootPath: string): Promise<ReactScopeGraph> {
  const files = await glob('**/*.{ts,tsx,js,jsx}', { cwd: rootPath, absolute: true, ignore: ['**/node_modules/**', '**/dist/**'] });
  
  const allNodes: NodeData[] = [];
  const allEdges: EdgeData[] = [];
  let totalRawTokens = 0;

  // 1. Parse all files
  for (const file of files) {
    const code = await fs.readFile(file, 'utf-8');
    totalRawTokens += estimateTokens(code);
    const relativePath = path.relative(rootPath, file);
    const fileLines = code.split('\n');
    const { nodes, edges } = parseReactFile(code, relativePath, fileLines);
    
    allNodes.push(...nodes);
    allEdges.push(...edges);

    // Add file node
    allNodes.push({
      id: relativePath,
      name: path.basename(file),
      type: NodeType.FILE,
      filePath: relativePath,
    });
  }

  // 2. Resolve RENDERS edges with Import-Awareness
  const resolvedEdges: EdgeData[] = [];
  
  // Create a map of filePath -> Set of Imports (source -> localName)
  const fileImports = new Map<string, Array<{ source: string, localName: string }>>();
  allEdges.filter(e => e.type === EdgeType.IMPORTS).forEach(e => {
    const list = fileImports.get(e.source) || [];
    list.push({ source: e.target, localName: e.metadata?.localName });
    fileImports.set(e.source, list);
  });

  // Create a map of ComponentName -> List of IDs where it's defined
  const componentMap = new Map<string, string[]>();
  allNodes.filter(n => n.type === NodeType.COMPONENT).forEach(n => {
    const existing = componentMap.get(n.name) || [];
    componentMap.set(n.name, [...existing, n.id]);
  });

  for (const edge of allEdges) {
    if (edge.type === EdgeType.RENDERS || edge.type === EdgeType.PASSES_PROP) {
      const sourceNode = allNodes.find(n => n.id === edge.source);
      if (!sourceNode) continue;

      const targetName = edge.target;
      const imports = fileImports.get(sourceNode.filePath) || [];

      // Try to find the target based on imports first
      const matchingImport = imports.find(i => i.localName === targetName);
      let resolvedId: string | undefined;

      if (matchingImport) {
        // Resolve relative path to full relative path from root
        // Note: Simple resolution for MVP
        const possibleTargets = componentMap.get(targetName) || [];
        resolvedId = possibleTargets.find(id => id.startsWith(matchingImport.source.replace(/^\.\//, ''))) || possibleTargets[0];
      } else {
        // Fallback to global search
        resolvedId = (componentMap.get(targetName) || [])[0];
      }

      if (resolvedId) {
        resolvedEdges.push({
          ...edge,
          target: resolvedId
        });
      }
    } else if (edge.type !== EdgeType.IMPORTS) { // Keep other edges but maybe skip raw imports in the final graph view
      resolvedEdges.push(edge);
    }
  }

  return {
    nodes: allNodes,
    edges: resolvedEdges,
    metadata: {
      parsedAt: new Date().toISOString(),
      rootPath,
      totalFiles: files.length,
      totalRawTokens,
    }
  };
}
