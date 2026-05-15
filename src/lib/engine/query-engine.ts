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
   * Tokenize a query into lowercase word fragments.
   * Splits on whitespace, punctuation, and camelCase/PascalCase boundaries.
   * "UserAuthForm github login" -> ["user", "auth", "form", "github", "login"]
   */
  private tokenizeQuery(query: string): string[] {
    return query
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase split
      .replace(/[^a-zA-Z0-9]+/g, ' ')      // punctuation to space
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length >= 2);          // drop single letters / empties
  }

  /**
   * Score a node against tokenized query terms.
   * Higher score = more relevant. Returns 0 if no match.
   */
  private scoreNodeForQuery(node: NodeData, terms: string[], fullQuery: string): number {
    if (terms.length === 0) return 0;
    const nameLower = node.name.toLowerCase();
    const pathLower = node.filePath.toLowerCase();
    const fullQueryLower = fullQuery.toLowerCase();
    const nameTokens = this.tokenizeQuery(node.name);
    let score = 0;

    // Whole-query exact name match — strongest signal
    if (nameLower === fullQueryLower) score += 200;
    else if (nameLower.includes(fullQueryLower)) score += 100;

    for (const term of terms) {
      if (nameLower === term) score += 80;
      else if (nameTokens.includes(term)) score += 40;
      else if (nameLower.includes(term)) score += 20;
      if (pathLower.includes(term)) score += 10;
    }

    // Bias toward components and utilities (the things AI actually needs)
    if (node.type === NodeType.COMPONENT) score += 5;
    else if (node.type === NodeType.UTILITY) score += 3;
    else if (node.type === NodeType.FILE) score -= 5; // FILE nodes are too generic

    return score;
  }

  /**
   * Generates a token-optimized context block for an AI query.
   * Includes both structural summaries AND source code of matched components/utilities,
   * so AI can answer "how does X work" questions, not just "what depends on X".
   */
  public async getAIReadyContext(query: string, opts: { compact?: boolean; maxNodes?: number } = {}): Promise<any> {
    const { compact = false, maxNodes = 3 } = opts;
    const terms = this.tokenizeQuery(query);
    const aiService = new AIService();

    // 1. Score all nodes and pick top matches
    const scored = this.graph.nodes
      .filter(n => n.type === NodeType.COMPONENT || n.type === NodeType.UTILITY)
      .map(node => ({ node, score: this.scoreNodeForQuery(node, terms, query) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);

    // Semantic AI fallback if no good keyword match
    let primaryMatches: NodeData[] = scored.slice(0, maxNodes).map(x => x.node);
    let matchExplanation = `Matched via tokenized scoring (top ${primaryMatches.length}).`;

    if (primaryMatches.length === 0 && (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY)) {
      try {
        const candidates = this.graph.nodes
          .filter(n => n.type === NodeType.COMPONENT || n.type === NodeType.UTILITY)
          .map(n => `ID: ${n.id}, Name: ${n.name}, File: ${n.filePath}`)
          .join('\n');
        const prompt = `Given these React components and utilities:\n${candidates}\n\nQuery: "${query}"\n\nReturn the top 3 most relevant IDs as a comma-separated list. IDs only.`;
        const response = await aiService.complete(prompt);
        const suggestedIds = response.content.split(',').map(id => id.trim());
        primaryMatches = this.graph.nodes.filter(n => suggestedIds.includes(n.id)).slice(0, maxNodes);
        if (primaryMatches.length > 0) matchExplanation = `Semantic match via ${response.provider}.`;
      } catch (err) {
        console.error('Semantic fallback failed:', err);
      }
    }

    if (primaryMatches.length === 0) {
      return {
        error: `No matching component or utility found for "${query}".`,
        suggestions: this.graph.nodes
          .filter(n => n.type === NodeType.COMPONENT)
          .slice(0, 8)
          .map(n => ({ name: n.name, path: n.filePath })),
      };
    }

    // 2. For each primary match, gather: render dependencies (component-only) + structural summary + source
    const targetNode = primaryMatches[0];
    const renderDepIds = targetNode.type === NodeType.COMPONENT
      ? (this.renderAdjacency.get(targetNode.id) || [])
      : [];
    const dependentIds = targetNode.type === NodeType.COMPONENT
      ? (this.reverseRenderAdjacency.get(targetNode.id) || [])
      : [];

    const hookIds = this.graph.edges
      .filter(e => e.source === targetNode.id && e.type === EdgeType.DEPENDS_ON)
      .map(e => e.target);

    // 3. Build the components/utilities block
    // Primary matches always include source. Render dependencies get structural summary only (kept compact).
    const seen = new Set<string>();
    const codeBlocks: string[] = [];

    for (const match of primaryMatches) {
      if (seen.has(match.id)) continue;
      seen.add(match.id);
      const summary = match.type === NodeType.COMPONENT
        ? this.generateStructuralSummary(match.id)
        : `[UTILITY] ${match.name} · ${match.filePath}${match.lineStart ? `:${match.lineStart}-${match.lineEnd}` : ''}`;
      const block = compact
        ? summary
        : `${summary}\n\nsource:\n\`\`\`\n${match.codeSnippet ?? '// (no source captured)'}\n\`\`\``;
      codeBlocks.push(block);
    }

    // Render dependencies — structural summary only (no source, to keep token count down)
    for (const depId of renderDepIds) {
      if (seen.has(depId)) continue;
      const depNode = this.graph.nodes.find(n => n.id === depId);
      if (!depNode || depNode.type !== NodeType.COMPONENT) continue;
      seen.add(depId);
      codeBlocks.push(this.generateStructuralSummary(depId));
    }

    // Imported utilities — for each primary match, follow its IMPORTS edges to find
    // utility nodes that share the imported localName. Include their source.
    // This is what makes cross-cutting queries work (e.g. "session check" pulls in getCurrentUser).
    const utilityByName = new Map<string, NodeData>();
    for (const n of this.graph.nodes) {
      if (n.type === NodeType.UTILITY) utilityByName.set(n.name, n);
    }
    const matchFilePaths = new Set(primaryMatches.map(m => m.filePath));
    const importedUtilityIds = new Set<string>();
    for (const edge of this.graph.edges) {
      if (edge.type !== EdgeType.IMPORTS) continue;
      if (!matchFilePaths.has(edge.source)) continue;
      const localName = edge.metadata?.localName;
      if (!localName) continue;
      const util = utilityByName.get(localName);
      if (util && !seen.has(util.id)) {
        importedUtilityIds.add(util.id);
      }
    }
    for (const utilId of importedUtilityIds) {
      const util = this.graph.nodes.find(n => n.id === utilId);
      if (!util) continue;
      seen.add(util.id);
      const summary = `[UTILITY] ${util.name} · ${util.filePath}${util.lineStart ? `:${util.lineStart}-${util.lineEnd}` : ''}`;
      const block = compact
        ? summary
        : `${summary}\n\nsource:\n\`\`\`\n${util.codeSnippet ?? '// (no source captured)'}\n\`\`\``;
      codeBlocks.push(block);
    }

    const contextSummary = codeBlocks.join('\n\n---\n\n');

    // 4. Token math
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
      matches: primaryMatches.map(n => ({ name: n.name, type: n.type, path: n.filePath })),
      matchExplanation,
      context: {
        renderDependencies: renderDepIds
          .map(id => this.graph.nodes.find(x => x.id === id))
          .filter((n): n is NodeData => !!n)
          .map(n => ({ name: n.name, path: n.filePath })),
        hooksUsed: hookIds.map(id => this.graph.nodes.find(x => x.id === id)?.name).filter(Boolean),
        affectedByChange: dependentIds
          .map(id => this.graph.nodes.find(n => n.id === id)?.name)
          .filter(Boolean),
        impactAnalysis: targetNode.type === NodeType.COMPONENT
          ? this.getImpactAnalysis(targetNode.id)
          : null,
      },
      contextSummary,
      optimization: {
        totalRepoTokens,
        contextTokens,
        savedTokens,
        tokenSavingsPct: `${savingsPct}%`,
        contextNodes: seen.size,
        totalRepoFiles: this.graph.metadata.totalFiles,
        includesSource: !compact,
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
