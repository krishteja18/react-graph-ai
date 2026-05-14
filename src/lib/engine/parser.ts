/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';
import { NodeType, NodeData, EdgeData, EdgeType } from './types';

// Handle ESM/CJS import quirks for @babel/traverse
const traverse = (typeof (_traverse as any).default === 'function' 
  ? (_traverse as any).default 
  : _traverse) as typeof _traverse;

export interface ParserResult {
  nodes: NodeData[];
  edges: EdgeData[];
}

function extractSnippet(lines: string[] | undefined, start: number | undefined, end: number | undefined): string | undefined {
  if (!lines || start == null || end == null) return undefined;
  // loc lines are 1-based
  return lines.slice(start - 1, end).join('\n');
}

export function parseReactFile(code: string, filePath: string, fileLines?: string[]): ParserResult {
  const nodes: NodeData[] = [];
  const edges: EdgeData[] = [];

  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
    });

    let currentComponent: string | null = null;

    traverse(ast, {
      // Find Component Definitions (Function Declarations or Arrow Functions)
      FunctionDeclaration(path) {
        if (path.node.id && /^[A-Z]/.test(path.node.id.name)) {
          const name = path.node.id.name;
          const lineStart = path.node.loc?.start.line;
          const lineEnd = path.node.loc?.end.line;
          nodes.push({
            id: `${filePath}:${name}`,
            name,
            type: NodeType.COMPONENT,
            filePath,
            lineStart,
            lineEnd,
            codeSnippet: extractSnippet(fileLines, lineStart, lineEnd),
          });
          currentComponent = name;
        }
      },
      VariableDeclarator(path) {
        if (
          t.isIdentifier(path.node.id) &&
          /^[A-Z]/.test(path.node.id.name) &&
          (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init))
        ) {
          const name = path.node.id.name;
          // Include the parent VariableDeclaration for the full `export const X = ...`
          const declNode = path.parentPath?.node ?? path.node;
          const lineStart = declNode.loc?.start.line;
          const lineEnd = declNode.loc?.end.line;
          nodes.push({
            id: `${filePath}:${name}`,
            name,
            type: NodeType.COMPONENT,
            filePath,
            lineStart,
            lineEnd,
            codeSnippet: extractSnippet(fileLines, lineStart, lineEnd),
          });
          currentComponent = name;
        }
      },

      // Find Hook Usage (useState, etc.)
      CallExpression(path) {
        if (t.isIdentifier(path.node.callee)) {
          const hookName = path.node.callee.name;
          if (hookName.startsWith('use') && currentComponent) {
            const hookId = `${filePath}:${currentComponent}:${hookName}:${path.node.loc?.start.line || 'unknown'}`;
            
            nodes.push({
              id: hookId,
              name: hookName,
              type: NodeType.HOOK,
              filePath,
            });

            edges.push({
              source: `${filePath}:${currentComponent}`,
              target: hookId,
              type: EdgeType.DEPENDS_ON,
            });

            // If it's useState, track state definition
            if (hookName === 'useState' && t.isVariableDeclarator(path.parent)) {
              const pattern = path.parent.id;
              if (t.isArrayPattern(pattern) && pattern.elements.length > 0) {
                const stateVar = pattern.elements[0];
                if (t.isIdentifier(stateVar)) {
                  const stateId = `${filePath}:${currentComponent}:state:${stateVar.name}`;
                  nodes.push({
                    id: stateId,
                    name: stateVar.name,
                    type: NodeType.STATE,
                    filePath,
                  });
                  edges.push({
                    source: `${filePath}:${currentComponent}`,
                    target: stateId,
                    type: EdgeType.USES_STATE,
                  });
                }
              }
            }
          }
        }
      },

      // Find Component Rendering (JSX)
      JSXOpeningElement(path) {
        if (t.isJSXIdentifier(path.node.name)) {
          const renderedName = path.node.name.name;
          // If it starts with uppercase, it's likely a custom component
          if (/^[A-Z]/.test(renderedName) && currentComponent) {
            edges.push({
              source: `${filePath}:${currentComponent}`,
              target: renderedName, // We'll resolve this later in Graph Builder
              type: EdgeType.RENDERS,
            });
          }
        }
      },

      // Find Imports
      ImportDeclaration(path) {
        const source = path.node.source.value;
        path.node.specifiers.forEach(spec => {
          if (t.isImportSpecifier(spec) || t.isImportDefaultSpecifier(spec)) {
            const localName = spec.local.name;
            edges.push({
              source: filePath,
              target: source,
              type: EdgeType.IMPORTS,
              metadata: { localName }
            });
          }
        });
      }
    });

  } catch (err) {
    console.error(`Error parsing ${filePath}:`, err);
  }

  return { nodes, edges };
}
