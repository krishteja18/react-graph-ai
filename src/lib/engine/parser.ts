/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';
import path from 'path';
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

function detectNextjsType(filePath: string): NodeData['nextjsType'] | undefined {
  const base = path.basename(filePath, path.extname(filePath));
  if (base === 'page') return 'page';
  if (base === 'layout') return 'layout';
  if (base === 'loading') return 'loading';
  if (base === 'error') return 'error';
  if (base === 'template') return 'template';
  return undefined;
}

export function parseReactFile(code: string, filePath: string, fileLines?: string[]): ParserResult {
  const nodes: NodeData[] = [];
  const edges: EdgeData[] = [];

  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
    });

    // Detect 'use client' / 'use server' directive
    let fileDirective: 'use client' | 'use server' | undefined;
    const program = ast.program;

    // Check program.directives (Babel's directive nodes)
    if (program.directives && program.directives.length > 0) {
      for (const dir of program.directives) {
        const val = dir.value.value;
        if (val === 'use client' || val === 'use server') {
          fileDirective = val;
          break;
        }
      }
    }

    // Also check if first statement is ExpressionStatement with StringLiteral
    if (!fileDirective && program.body.length > 0) {
      const first = program.body[0];
      if (
        t.isExpressionStatement(first) &&
        t.isStringLiteral(first.expression)
      ) {
        const val = first.expression.value;
        if (val === 'use client' || val === 'use server') {
          fileDirective = val;
        }
      }
    }

    const nextjsType = detectNextjsType(filePath);

    // Stack-based component tracking for nested/multi-component files
    const componentStack: string[] = [];
    // Map from component name -> NodeData reference for mutation
    const componentNodeMap = new Map<string, NodeData>();

    const getCurrentComponent = (): string | null =>
      componentStack.length > 0 ? componentStack[componentStack.length - 1] : null;

    const getCurrentComponentNode = (): NodeData | null => {
      const name = getCurrentComponent();
      return name ? componentNodeMap.get(name) ?? null : null;
    };

    traverse(ast, {
      // Find Component Definitions (Function Declarations or Arrow Functions)
      FunctionDeclaration: {
        enter(path) {
          if (path.node.id && /^[A-Z]/.test(path.node.id.name)) {
            const name = path.node.id.name;
            const lineStart = path.node.loc?.start.line;
            const lineEnd = path.node.loc?.end.line;
            const node: NodeData = {
              id: `${filePath}:${name}`,
              name,
              type: NodeType.COMPONENT,
              filePath,
              lineStart,
              lineEnd,
              codeSnippet: extractSnippet(fileLines, lineStart, lineEnd),
              directive: fileDirective,
              nextjsType,
              contextReads: [],
              effectDeps: [],
            };
            nodes.push(node);
            componentNodeMap.set(name, node);
            componentStack.push(name);
          }
        },
        exit(path) {
          if (path.node.id && /^[A-Z]/.test(path.node.id.name)) {
            componentStack.pop();
          }
        },
      },

      VariableDeclarator: {
        enter(path) {
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
            const node: NodeData = {
              id: `${filePath}:${name}`,
              name,
              type: NodeType.COMPONENT,
              filePath,
              lineStart,
              lineEnd,
              codeSnippet: extractSnippet(fileLines, lineStart, lineEnd),
              directive: fileDirective,
              nextjsType,
              contextReads: [],
              effectDeps: [],
            };
            nodes.push(node);
            componentNodeMap.set(name, node);
            componentStack.push(name);
          }
        },
        exit(path) {
          if (
            t.isIdentifier(path.node.id) &&
            /^[A-Z]/.test(path.node.id.name) &&
            (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init))
          ) {
            componentStack.pop();
          }
        },
      },

      // Find Hook Usage (useState, useContext, useEffect, etc.)
      CallExpression(path) {
        if (t.isIdentifier(path.node.callee)) {
          const hookName = path.node.callee.name;
          const currentComponent = getCurrentComponent();
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

            const currentNode = getCurrentComponentNode();

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

            // useContext extraction
            if (hookName === 'useContext' && currentNode) {
              const firstArg = path.node.arguments[0];
              if (firstArg && t.isIdentifier(firstArg)) {
                currentNode.contextReads = currentNode.contextReads ?? [];
                currentNode.contextReads.push(firstArg.name);
              }
            }

            // useEffect dep extraction
            if (hookName === 'useEffect' && currentNode) {
              const secondArg = path.node.arguments[1];
              if (secondArg && t.isArrayExpression(secondArg)) {
                const deps = secondArg.elements
                  .filter((el): el is t.Identifier => t.isIdentifier(el))
                  .map(el => el.name);
                currentNode.effectDeps = currentNode.effectDeps ?? [];
                currentNode.effectDeps.push(deps);
              } else {
                // No dep array (runs every render) — push empty array to signal existence
                currentNode.effectDeps = currentNode.effectDeps ?? [];
                currentNode.effectDeps.push([]);
              }
            }
          }
        }
      },

      // Find Component Rendering (JSX) and PASSES_PROP edges
      JSXOpeningElement(path) {
        if (t.isJSXIdentifier(path.node.name)) {
          const renderedName = path.node.name.name;
          const currentComponent = getCurrentComponent();
          // If it starts with uppercase, it's likely a custom component
          if (/^[A-Z]/.test(renderedName) && currentComponent) {
            edges.push({
              source: `${filePath}:${currentComponent}`,
              target: renderedName, // We'll resolve this later in Graph Builder
              type: EdgeType.RENDERS,
            });

            // Extract prop names from JSXAttributes (skip spread)
            const propNames: string[] = [];
            for (const attr of path.node.attributes) {
              if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
                propNames.push(attr.name.name);
              }
            }

            if (propNames.length > 0) {
              edges.push({
                source: `${filePath}:${currentComponent}`,
                target: renderedName, // resolved in graph-builder
                type: EdgeType.PASSES_PROP,
                metadata: { props: propNames },
              });
            }
          }
        }
      },

      // Exported utility functions / consts that aren't React components.
      // Captures top-level `export function foo()`, `export const foo = ...`, `export async function foo()`.
      // We only emit a UTILITY node if the name is lowerCamelCase (not a component) and there is no enclosing component scope.
      ExportNamedDeclaration(path) {
        if (componentStack.length > 0) return; // skip nested exports
        const decl = path.node.declaration;
        if (!decl) return;

        const recordUtility = (name: string, locStart?: number, locEnd?: number) => {
          if (!name || /^[A-Z]/.test(name)) return; // skip components
          nodes.push({
            id: `${filePath}:${name}`,
            name,
            type: NodeType.UTILITY,
            filePath,
            lineStart: locStart,
            lineEnd: locEnd,
            codeSnippet: extractSnippet(fileLines, locStart, locEnd),
            directive: fileDirective,
            nextjsType,
          });
        };

        if (t.isFunctionDeclaration(decl) && decl.id) {
          recordUtility(decl.id.name, decl.loc?.start.line, decl.loc?.end.line);
        } else if (t.isVariableDeclaration(decl)) {
          for (const d of decl.declarations) {
            if (t.isIdentifier(d.id)) {
              recordUtility(
                d.id.name,
                path.node.loc?.start.line,
                path.node.loc?.end.line
              );
            }
          }
        }
      },

      // Default-exported utility / function (e.g. `export default function getX()`).
      // Components are caught by FunctionDeclaration / VariableDeclarator above; this catches plain utilities.
      ExportDefaultDeclaration(path) {
        if (componentStack.length > 0) return;
        const decl = path.node.declaration;
        if (t.isFunctionDeclaration(decl) && decl.id && /^[a-z]/.test(decl.id.name)) {
          const name = decl.id.name;
          nodes.push({
            id: `${filePath}:${name}`,
            name,
            type: NodeType.UTILITY,
            filePath,
            lineStart: decl.loc?.start.line,
            lineEnd: decl.loc?.end.line,
            codeSnippet: extractSnippet(fileLines, decl.loc?.start.line, decl.loc?.end.line),
            directive: fileDirective,
            nextjsType,
          });
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
