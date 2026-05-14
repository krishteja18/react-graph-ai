/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum NodeType {
  COMPONENT = 'COMPONENT',
  HOOK = 'HOOK',
  STATE = 'STATE',
  PROP = 'PROP',
  FILE = 'FILE',
}

export enum EdgeType {
  IMPORTS = 'IMPORTS',
  RENDERS = 'RENDERS',
  PASSES_PROP = 'PASSES_PROP',
  USES_STATE = 'USES_STATE',
  UPDATES_STATE = 'UPDATES_STATE',
  DEPENDS_ON = 'DEPENDS_ON',
}

export interface NodeData {
  id: string;
  name: string;
  type: NodeType;
  filePath: string;
  codeSnippet?: string;
  lineStart?: number;
  lineEnd?: number;
  directive?: 'use client' | 'use server';
  contextReads?: string[];
  effectDeps?: string[][];
  nextjsType?: 'page' | 'layout' | 'loading' | 'error' | 'template';
}

export interface EdgeData {
  source: string;
  target: string;
  type: EdgeType;
  metadata?: Record<string, any>;
}

export interface ReactScopeGraph {
  nodes: NodeData[];
  edges: EdgeData[];
  metadata: {
    parsedAt: string;
    rootPath: string;
    totalFiles: number;
    totalRawTokens: number;
  };
}

export interface ImpactAnalysis {
  componentName: string;
  dependents: string[];
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  affectedTree: string[]; // e.g. ["App -> Navbar -> Button"]
}

export interface AIContextResult {
  query: string;
  relevantNodes: NodeData[];
  explanation: string;
  tokenOptimizedSnippet: string;
}
