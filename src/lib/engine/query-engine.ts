/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactScopeGraph, ImpactAnalysis, EdgeType, NodeType } from './types';
import { AIService } from '../services/ai-service';
import { estimateTokens } from './graph-builder';

export class QueryEngine {
  private graph: ReactScopeGraph;
  private renderAdjacency: Map<string, string[]> = new Map(); // source -> [targets]
  private reverseRenderAdjacency: Map<string, string[]> = new Map(); // target -> [sources]

  constructor(graph: ReactScopeGraph) {
    this.graph = graph;
    this.buildAdjacency();
  }

  private buildAdjacency() {
    this.graph.edges.forEach(edge => {
      if (edge.type === EdgeType.RENDERS) {
        // Forward
        const targets = this.renderAdjacency.get(edge.source) || [];
        this.renderAdjacency.set(edge.source, [...targets, edge.target]);
        
        // Backward
        const sources = this.reverseRenderAdjacency.get(edge.target) || [];
        this.reverseRenderAdjacency.set(edge.target, [...sources, edge.source]);
      }
    });
  }

  public getComponentDependents(nodeId: string): string[] {
    const dependents = new Set<string>();
    const queue = [nodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const parents = this.reverseRenderAdjacency.get(current) || [];
      parents.forEach(p => {
        dependents.add(p);
        queue.push(p);
      });
    }

    return Array.from(dependents);
  }

  public getImpactAnalysis(nodeId: string): ImpactAnalysis {
    const node = this.graph.nodes.find(n => n.id === nodeId || n.name === nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    const dependents = this.getComponentDependents(node.id);
    
    // Impact level heuristic
    let impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (dependents.length > 5) impactLevel = 'HIGH';
    else if (dependents.length > 2) impactLevel = 'MEDIUM';

    // Build sample affected paths
    const affectedTree: string[] = dependents.slice(0, 5).map(depId => {
      const depNode = this.graph.nodes.find(n => n.id === depId);
      return `${depNode?.name || depId} -> ${node.name}`;
    });

    return {
      componentName: node.name,
      dependents: dependents.map(id => this.graph.nodes.find(n => n.id === id)?.name || id),
      impactLevel,
      affectedTree,
    };
  }

  /**
   * Generates a token-optimized context block for an AI query.
   * Returns actual code snippets for:
   * 1. The target component
   * 2. Its immediate render dependencies
   * 3. The hooks it uses
   * Token savings are measured against the full-repo baseline.
   */
  public async getAIReadyContext(query: string): Promise<any> {
    const search = query.toLowerCase();
    const aiService = new AIService();

    // 1. Find the primary node of interest
    let targetNode = this.graph.nodes.find(n =>
      n.name.toLowerCase() === search ||
      n.name.toLowerCase().includes(search)
    );

    // Semantic fallback if a key is configured
    if (!targetNode && (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY)) {
      try {
        const miniContext = await this.getMinimalContext(query);
        if (miniContext.relevantNodes.length > 0) {
          targetNode = miniContext.relevantNodes[0];
          console.log(`Semantic match found: ${targetNode.name} for query "${query}"`);
        }
      } catch (err) {
        console.error('Semantic match failed during AI context prep:', err);
      }
    }

    if (!targetNode) {
      return {
        error: "No matching component found for query.",
        suggestions: this.graph.nodes.filter(n => n.type === NodeType.COMPONENT).slice(0, 5).map(n => n.name)
      };
    }

    // 2. Collect relevant nodes: target + its render deps + its hooks
    const renderDepIds = this.renderAdjacency.get(targetNode.id) || [];
    const dependentIds = this.reverseRenderAdjacency.get(targetNode.id) || [];

    const hookIds = this.graph.edges
      .filter(e => e.source === targetNode!.id && e.type === EdgeType.DEPENDS_ON)
      .map(e => e.target);

    const contextNodeIds = new Set<string>([targetNode.id, ...renderDepIds, ...hookIds]);
    const contextNodes = Array.from(contextNodeIds)
      .map(id => this.graph.nodes.find(n => n.id === id))
      .filter(Boolean) as typeof this.graph.nodes;

    // 3. Build the code context string from real snippets
    const snippetParts: string[] = [];
    for (const node of contextNodes) {
      if (node.codeSnippet) {
        snippetParts.push(`// ${node.filePath} — ${node.name}\n${node.codeSnippet}`);
      }
    }
    const contextCode = snippetParts.join('\n\n');

    // 4. Measure actual token counts
    const totalRepoTokens = this.graph.metadata.totalRawTokens;
    const contextTokens = estimateTokens(contextCode);
    const savedTokens = Math.max(0, totalRepoTokens - contextTokens);
    const savingsPct = totalRepoTokens > 0
      ? ((savedTokens / totalRepoTokens) * 100).toFixed(1)
      : '0';

    return {
      target: {
        name: targetNode.name,
        path: targetNode.filePath,
        type: targetNode.type,
        snippet: targetNode.codeSnippet ?? null,
      },
      context: {
        renderDependencies: renderDepIds.map(id => {
          const n = this.graph.nodes.find(x => x.id === id);
          return { name: n?.name, path: n?.filePath, snippet: n?.codeSnippet ?? null };
        }),
        hooksUsed: hookIds.map(id => {
          const n = this.graph.nodes.find(x => x.id === id);
          return n?.name;
        }),
        affectedByChange: dependentIds.map(id => this.graph.nodes.find(n => n.id === id)?.name),
        impactAnalysis: this.getImpactAnalysis(targetNode.id),
      },
      optimization: {
        totalRepoTokens,
        contextTokens,
        savedTokens,
        tokenSavingsPct: `${savingsPct}%`,
        contextNodes: contextNodes.length,
        totalRepoFiles: this.graph.metadata.totalFiles,
      },
    };
  }

  public async getMinimalContext(query: string): Promise<any> {
    const aiService = new AIService();
    let explanation = `Found based on simple text match.`;
    let relevantNodes = this.graph.nodes.filter(n => 
      n.name.toLowerCase().includes(query.toLowerCase()) || 
      n.filePath.toLowerCase().includes(query.toLowerCase())
    );

    // Try AI reasoning if any key is present
    if (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
      try {
        const nodeList = this.graph.nodes.map(n => `ID: ${n.id}, Name: ${n.name}, File: ${n.filePath}`).join('\n');
        const prompt = `Given the following React components in a graph:\n${nodeList}\n\nQuery: "${query}"\n\nIdentify the top 3 most relevant component IDs for this query. Return ONLY the IDs separated by commas.`;
        
        const response = await aiService.complete(prompt);
        const suggestedIds = response.content.split(',').map(id => id.trim());
        
        const aiNodes = this.graph.nodes.filter(n => suggestedIds.includes(n.id));
        if (aiNodes.length > 0) {
          relevantNodes = aiNodes;
          explanation = `Identified via ${response.provider} semantic reasoning.`;
        }
      } catch (e) {
        console.error('AI Reasoning failed, falling back to keyword search:', e);
      }
    }

    return {
      query,
      relevantNodes: relevantNodes.slice(0, 10),
      explanation,
    };
  }
}
