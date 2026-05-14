/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactScopeGraph, ImpactAnalysis, EdgeType, NodeType, NodeData } from './types';
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
   * Generates a compact structural summary for a component node.
   * This replaces raw code snippets for AI context — dramatically reduces tokens.
   */
  private generateStructuralSummary(nodeId: string): string {
    const node = this.graph.nodes.find(n => n.id === nodeId);
    if (!node) return `[NOT FOUND] ${nodeId}`;

    const lines: string[] = [];

    // Header line
    const locationPart = (node.lineStart != null && node.lineEnd != null)
      ? `${node.filePath}:${node.lineStart}-${node.lineEnd}`
      : node.filePath;
    lines.push(`[${node.type}] ${node.name} · ${locationPart}`);

    // Directive
    if (node.directive) {
      lines.push(`directive: ${node.directive}`);
    }

    // Next.js type
    if (node.nextjsType) {
      lines.push(`nextjs: ${node.nextjsType}`);
    }

    // State variables (via USES_STATE edges)
    const stateEdges = this.graph.edges.filter(e => e.source === nodeId && e.type === EdgeType.USES_STATE);
    if (stateEdges.length > 0) {
      const stateNames = stateEdges.map(e => {
        const stateNode = this.graph.nodes.find(n => n.id === e.target);
        return stateNode?.name ?? e.target.split(':').pop() ?? e.target;
      });
      lines.push(`state: ${stateNames.join(' · ')}`);
    }

    // Hooks (via DEPENDS_ON edges targeting HOOK nodes)
    const hookEdges = this.graph.edges.filter(e => e.source === nodeId && e.type === EdgeType.DEPENDS_ON);
    if (hookEdges.length > 0) {
      const hookNames = hookEdges.map(e => {
        const hookNode = this.graph.nodes.find(n => n.id === e.target);
        return hookNode?.name ?? e.target;
      });
      // Deduplicate hook names
      const uniqueHooks = Array.from(new Set(hookNames));
      lines.push(`hooks: ${uniqueHooks.join(' · ')}`);
    }

    // Context reads
    if (node.contextReads && node.contextReads.length > 0) {
      lines.push(`context: ${node.contextReads.join(' · ')}`);
    }

    // Effect deps
    if (node.effectDeps && node.effectDeps.length > 0) {
      const effectParts = node.effectDeps.map(deps =>
        deps.length > 0 ? `deps=[${deps.join(',')}]` : 'deps=[]'
      );
      lines.push(`effects: ${effectParts.join(' · ')}`);
    }

    // Renders (via RENDERS edges)
    const rendersEdges = this.graph.edges.filter(e => e.source === nodeId && e.type === EdgeType.RENDERS);
    if (rendersEdges.length > 0) {
      const renderNames = rendersEdges.map(e => {
        const targetNode = this.graph.nodes.find(n => n.id === e.target);
        return targetNode?.name ?? e.target;
      });
      lines.push(`renders: ${renderNames.join(' · ')}`);
    }

    // Passes props (via PASSES_PROP edges)
    const passesPropEdges = this.graph.edges.filter(e => e.source === nodeId && e.type === EdgeType.PASSES_PROP);
    if (passesPropEdges.length > 0) {
      const propParts = passesPropEdges.map(e => {
        const targetNode = this.graph.nodes.find(n => n.id === e.target);
        const targetName = targetNode?.name ?? e.target;
        const props: string[] = e.metadata?.props ?? [];
        return props.length > 0 ? `${targetName}{${props.join(',')}}` : targetName;
      });
      lines.push(`passes: ${propParts.join(' · ')}`);
    }

    // Impact analysis
    const dependentIds = this.getComponentDependents(nodeId);
    if (dependentIds.length > 0) {
      const dependentNames = dependentIds
        .map(id => this.graph.nodes.find(n => n.id === id)?.name ?? id)
        .slice(0, 5);
      let impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (dependentIds.length > 5) impactLevel = 'HIGH';
      else if (dependentIds.length > 2) impactLevel = 'MEDIUM';
      lines.push(`impact: ${impactLevel} · dependents: ${dependentNames.join(', ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Recursively builds the render tree for a component up to the given depth.
   */
  public getComponentTree(nodeId: string, depth: number = 4): any {
    const visited = new Set<string>();

    const buildTree = (id: string, currentDepth: number): any => {
      // Try lookup by id first, then by name
      const node = this.graph.nodes.find(n => n.id === id || n.name === id);
      if (!node) return null;

      if (visited.has(node.id)) {
        return { name: node.name, cycleRef: true };
      }
      visited.add(node.id);

      const result: any = {
        name: node.name,
        type: node.type,
        filePath: node.filePath,
        directive: node.directive,
        nextjsType: node.nextjsType,
        children: [],
      };

      if (currentDepth <= 0) {
        result.truncated = true;
        visited.delete(node.id);
        return result;
      }

      const childIds = this.renderAdjacency.get(node.id) || [];
      for (const childId of childIds) {
        const child = buildTree(childId, currentDepth - 1);
        if (child) result.children.push(child);
      }

      visited.delete(node.id);
      return result;
    };

    return buildTree(nodeId, depth);
  }

  /**
   * Traces how a named state variable propagates through the component tree.
   */
  public traceStateFlow(stateName: string): any {
    const search = stateName.toLowerCase();

    // Find all STATE nodes whose name contains stateName
    const stateNodes = this.graph.nodes.filter(
      n => n.type === NodeType.STATE && n.name.toLowerCase().includes(search)
    );

    if (stateNodes.length === 0) {
      return { error: `No state found matching "${stateName}"` };
    }

    return stateNodes.map(stateNode => {
      // Find owner component: component that has USES_STATE edge to this state node
      const ownerEdge = this.graph.edges.find(
        e => e.type === EdgeType.USES_STATE && e.target === stateNode.id
      );
      const ownerNode = ownerEdge
        ? this.graph.nodes.find(n => n.id === ownerEdge.source)
        : undefined;

      // Find all components that will re-render due to owner change
      const propagatesTo: string[] = ownerNode
        ? this.getComponentDependents(ownerNode.id).map(
            id => this.graph.nodes.find(n => n.id === id)?.name ?? id
          )
        : [];

      return {
        state: stateNode.name,
        ownedBy: ownerNode?.name ?? null,
        ownerFile: ownerNode?.filePath ?? null,
        propagatesTo,
      };
    });
  }

  /**
   * Generates a token-optimized context block for an AI query.
   * Uses structural summaries instead of raw code snippets.
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
          console.error(`Semantic match found: ${targetNode.name} for query "${query}"`);
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

    // 2. Collect relevant component nodes: target + its immediate render deps.
    //    Hooks are captured inside each component's structural summary — not as separate nodes.
    const renderDepIds = this.renderAdjacency.get(targetNode.id) || [];
    const dependentIds = this.reverseRenderAdjacency.get(targetNode.id) || [];

    const hookIds = this.graph.edges
      .filter(e => e.source === targetNode!.id && e.type === EdgeType.DEPENDS_ON)
      .map(e => e.target);

    const contextNodeIds = new Set<string>([targetNode.id, ...renderDepIds]);
    const contextNodes = Array.from(contextNodeIds)
      .map(id => this.graph.nodes.find(n => n.id === id))
      .filter((n): n is NodeData => !!n && n.type === NodeType.COMPONENT);

    // 3. Build structural summaries — compact representations, no raw code
    const summaryParts: string[] = contextNodes.map(n => this.generateStructuralSummary(n.id));
    const contextSummary = summaryParts.join('\n\n---\n\n');

    // 4. Measure actual token counts against full-repo baseline
    const totalRepoTokens = this.graph.metadata.totalRawTokens;
    const contextTokens = estimateTokens(contextSummary);
    const savedTokens = Math.max(0, totalRepoTokens - contextTokens);
    const savingsPct = totalRepoTokens > 0
      ? ((savedTokens / totalRepoTokens) * 100).toFixed(1)
      : '0';

    return {
      target: {
        name: targetNode.name,
        path: targetNode.filePath,
        type: targetNode.type,
      },
      context: {
        renderDependencies: renderDepIds.map(id => {
          const n = this.graph.nodes.find(x => x.id === id);
          return { name: n?.name, path: n?.filePath };
        }),
        hooksUsed: hookIds.map(id => this.graph.nodes.find(x => x.id === id)?.name),
        affectedByChange: dependentIds.map(id => this.graph.nodes.find(n => n.id === id)?.name),
        impactAnalysis: this.getImpactAnalysis(targetNode.id),
      },
      contextSummary,
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
