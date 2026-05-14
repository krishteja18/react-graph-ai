/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Search, Info, Zap, Code, Layout, GitBranch, RefreshCw, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NodeType, EdgeType } from './lib/engine/types';

const nodeColors: Record<NodeType, string> = {
  [NodeType.COMPONENT]: '#06b6d4', // cyan
  [NodeType.HOOK]: '#10b981', // green
  [NodeType.STATE]: '#f59e0b', // amber
  [NodeType.PROP]: '#8b5cf6', // violet
  [NodeType.FILE]: '#6b7280', // gray
};

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [impactData, setImpactData] = useState<any>(null);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [graphStats, setGraphStats] = useState({ nodes: 0, edges: 0, files: 0, totalRawTokens: 0 });
  const [lastOptimization, setLastOptimization] = useState<any>(null);

  const fetchGraph = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/graph');
      const data = await res.json();
      
      setGraphStats({
        nodes: data.nodes.length,
        edges: data.edges.length,
        files: data.metadata.totalFiles,
        totalRawTokens: data.metadata.totalRawTokens ?? 0,
      });

      const reactFlowNodes = data.nodes.map((n: any, idx: number) => ({
        id: n.id,
        data: { label: n.name, ...n },
        position: { x: Math.random() * 800, y: Math.random() * 600 },
        style: {
          background: '#0D0F14',
          color: nodeColors[n.type as NodeType] || '#eee',
          borderRadius: '2px',
          border: `1px solid ${nodeColors[n.type as NodeType]}50`,
          fontSize: '10px',
          fontWeight: 'bold',
          padding: '8px',
          width: 150,
          fontFamily: 'monospace',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
        },
      }));

      const reactFlowEdges = data.edges.map((e: any, idx: number) => ({
        id: `e-${idx}`,
        source: e.source,
        target: e.target,
        label: e.type,
        animated: e.type === EdgeType.RENDERS,
        style: { stroke: '#1F2937', strokeWidth: 1 },
        labelStyle: { fill: '#4b5563', fontSize: 8, fontWeight: 'bold' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#1F2937' },
      }));

      setNodes(reactFlowNodes);
      setEdges(reactFlowEdges);
    } catch (error) {
      console.error('Failed to fetch graph', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const onNodeClick = async (_: any, node: any) => {
    setSelectedNode(node.data);
    setImpactData(null);
    try {
      const res = await fetch(`/api/impact/${encodeURIComponent(node.id)}`);
      const data = await res.json();
      setImpactData(data);
    } catch (e) {
      console.error(e);
    }
  };

  const askAI = async () => {
    if (!aiQuery) return;
    setAiResponse('// OPTIMIZING_CONTEXT...\n// TRAVERSING_GRAPH...\n...');
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiQuery }),
      });
      const data = await res.json();
      setAiResponse(data.answer);
      if (data.optimization) setLastOptimization(data.optimization);
    } catch (e) {
      setAiResponse('// ERROR: ENGINE_CONNECTION_FAILED');
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0A0B0E] text-[#E2E8F0] font-mono select-none overflow-hidden uppercase">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-[#1F2937] flex items-center justify-between px-6 bg-[#0D0F14]">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4] animate-pulse"></div>
          <h1 className="text-sm font-bold tracking-widest text-cyan-400">REACTSCOPE AI // GRAPH ENGINE</h1>
          <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-500">v1.0.4-BETA</span>
        </div>
        <div className="flex items-center gap-8 text-[11px] opacity-60 hidden md:flex">
          <div className="flex gap-2"><span>MCP_SERVER:</span><span className="text-green-400">CONNECTED</span></div>
          <div className="flex gap-2"><span>WORKER_THREADS:</span><span className="text-white">8/8</span></div>
          <div className="flex gap-2"><span>STATUS:</span><span className="text-white">READY</span></div>
        </div>
      </header>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-4 border-b border-[#1F2937] bg-[#0A0B0E]">
        <div className="p-4 border-r border-[#1F2937] flex flex-col gap-1">
          <span className="text-[9px] uppercase tracking-tighter opacity-40">Semantic Nodes</span>
          <span className="text-2xl font-light text-white">{graphStats.nodes.toLocaleString()}</span>
          <div className="w-full bg-[#1F2937] h-1 mt-2">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: '66%' }}
              className="bg-cyan-500 h-full" 
            />
          </div>
        </div>
        <div className="p-4 border-r border-[#1F2937] flex flex-col gap-1">
          <span className="text-[9px] uppercase tracking-tighter opacity-40">Edges / Relations</span>
          <span className="text-2xl font-light text-green-400">{graphStats.edges.toLocaleString()}</span>
          <span className="text-[10px] opacity-50">Behavioral mapping active</span>
        </div>
        <div className="p-4 border-r border-[#1F2937] flex flex-col gap-1">
          <span className="text-[9px] uppercase tracking-tighter opacity-40">Context Reduction</span>
          <span className="text-2xl font-light text-white">
            {lastOptimization ? `-${lastOptimization.tokenSavingsPct}` : '--'}
          </span>
          <span className="text-[10px] opacity-50 text-cyan-500">
            {lastOptimization
              ? `${lastOptimization.contextTokens} / ${lastOptimization.totalRepoTokens} tokens`
              : 'Run a query to measure'}
          </span>
        </div>
        <div className="p-4 flex flex-col gap-1">
          <span className="text-[9px] uppercase tracking-tighter opacity-40">File Memory</span>
          <span className="text-2xl font-light text-white">{graphStats.files} Files</span>
          <span className="text-[10px] opacity-50">
            {graphStats.totalRawTokens > 0
              ? `~${graphStats.totalRawTokens.toLocaleString()} repo tokens`
              : 'Indexed in graph memory'}
          </span>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar Left: Explorer/Details */}
        <aside className="w-72 border-r border-[#1F2937] bg-[#0D0F14] flex flex-col overflow-hidden">
          <div className="p-3 text-[10px] border-b border-[#1F2937] font-bold text-gray-500 uppercase tracking-widest">Architectural Analysis</div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
            <AnimatePresence mode="wait">
              {selectedNode ? (
                <motion.div 
                  key={selectedNode.id}
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="p-3 bg-black/40 border border-[#1F2937] rounded">
                    <div className="text-[9px] text-gray-500 mb-1">NODE_TYPE: {selectedNode.type}</div>
                    <div className="text-sm font-bold text-cyan-400 mb-2 truncate">{selectedNode.name}</div>
                    <div className="text-[10px] text-gray-500 font-mono break-all lowercase">{selectedNode.filePath}</div>
                  </div>

                  {impactData && (
                    <div className="space-y-4">
                      <div>
                        <div className="text-[9px] text-gray-500 mb-2">DETECTOR: IMPACT_LEVEL</div>
                        <div className={`p-2 text-xs font-bold border ${
                          impactData.impactLevel === 'HIGH' ? 'bg-red-500/10 border-red-500/30 text-red-500' :
                          'bg-cyan-500/10 border-cyan-500/30 text-cyan-500'
                        }`}>
                          {impactData.impactLevel} // PROPAGATION_RISK
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="text-[9px] text-gray-500 mb-1 uppercase">Dependents [{impactData.dependents.length}]</div>
                        <div className="flex flex-wrap gap-1">
                          {impactData.dependents.map((dep: string) => (
                            <span key={dep} className="px-1.5 py-0.5 bg-[#1F2937] text-[9px] rounded text-gray-300">
                              {dep}
                            </span>
                          ))}
                          {impactData.dependents.length === 0 && <span className="text-[10px] opacity-30 italic">No external dependents</span>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[9px] text-gray-500 mb-1 uppercase">Trace Paths</div>
                        <div className="space-y-1">
                          {impactData.affectedTree.map((path: string, i: number) => (
                            <div key={i} className="text-[9px] font-mono text-gray-400 bg-black/30 p-2 border border-[#1F2937] leading-tight lowercase">
                              {path}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-10 opacity-30 group">
                  <Layout className="w-10 h-10 mb-4 group-hover:scale-110 transition-transform" />
                  <p className="text-[10px] tracking-widest font-bold">AWAITING_INPUT<br/>SELECT_GRAPH_NODE</p>
                </div>
              )}
            </AnimatePresence>
          </div>

          <div className="p-4 border-t border-[#1F2937] bg-black/40">
            <button 
              onClick={fetchGraph}
              disabled={isAnalyzing}
              className="w-full py-2 bg-[#1F2937] text-white rounded text-[10px] font-bold tracking-widest hover:bg-[#374151] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
              {isAnalyzing ? 'REBUILDING_GRAPH...' : 'FORCE_RE-INDEX'}
            </button>
          </div>
        </aside>

        {/* Center: Graph Area */}
        <main className="flex-1 relative bg-[#0A0B0E]">
          <div className="absolute top-4 left-4 z-10 flex gap-2">
            <div className="px-3 py-1 bg-[#1F2937] border border-cyan-500/20 text-[10px] font-bold text-cyan-400 shadow-xl">
              MODE: IMPACT_ANALYSIS
            </div>
          </div>
          
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            colorMode="dark"
          >
            <Background color="#1F2937" gap={20} size={1} />
            <Controls className="bg-[#0D0F14] border-[#1F2937] fill-[#E2E8F0]" />
          </ReactFlow>

          {/* Legend Overlay */}
          <div className="absolute bottom-6 right-6 p-3 bg-[#0D0F14]/80 backdrop-blur border border-[#1F2937] shadow-2xl z-10 space-y-2">
            <div className="text-[8px] opacity-40 font-bold mb-1 uppercase tracking-widest">Node Schema</div>
            {Object.entries(nodeColors).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <div className="w-2 h-2" style={{ background: color }} />
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">{type}</span>
              </div>
            ))}
          </div>
        </main>

        {/* Sidebar Right: AI Context Panel */}
        <aside className="w-80 border-l border-[#1F2937] bg-[#0D0F14] flex flex-col overflow-hidden">
          <div className="p-3 text-[10px] border-b border-[#1F2937] font-bold text-gray-500 uppercase flex justify-between items-center">
            <span>AI Minimal Context</span>
            <span className="text-green-500 text-[8px] animate-pulse">READY_FOR_MCP</span>
          </div>

          <div className="flex-1 p-4 flex flex-col gap-4 overflow-hidden">
            <div className="text-[9px] opacity-40 uppercase tracking-widest">Model Context Optimizer</div>
            <div className="flex-1 bg-black border border-[#1F2937] p-3 text-[11px] font-mono leading-relaxed overflow-y-auto lowercase text-gray-400 custom-scrollbar">
              <span className="text-cyan-500 font-bold uppercase">$ reactscope context --q "{aiQuery || 'idle'}"</span><br/><br/>
              {aiResponse ? (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {aiResponse}
                </div>
              ) : (
                <div className="opacity-20 flex flex-col gap-1">
                  <div className="h-2 w-full bg-[#1F2937]"></div>
                  <div className="h-2 w-3/4 bg-[#1F2937]"></div>
                  <div className="h-2 w-1/2 bg-[#1F2937]"></div>
                  <div className="mt-4 text-[9px] uppercase tracking-widest">Awaiting query for token optimization...</div>
                </div>
              )}
            </div>
            
            <div className="flex gap-2 bg-black border border-[#1F2937] p-1">
              <input 
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="PROMPT AI..."
                className="flex-1 bg-transparent border-none focus:outline-none px-2 py-1.5 text-xs placeholder:text-[#1F2937]"
                onKeyPress={(e) => e.key === 'Enter' && askAI()}
              />
              <button 
                onClick={askAI}
                className="p-1 px-2 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors border border-cyan-500/30"
              >
                <MessageSquare className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="p-4 border-t border-[#1F2937] bg-[#0A0B0E]">
            <div className="flex gap-2 mb-2 items-center">
              <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse"></div>
              <div className="text-[8px] opacity-40 uppercase tracking-widest">Monitoring Stream</div>
            </div>
            <div className="text-[9px] text-gray-500 font-mono space-y-1">
              <div>15:04:12 - GRAPH_UPDATED</div>
              <div>15:04:15 - MCP_QUERY: "IMPACT_ANALYSIS"</div>
              <div>15:04:16 - STATUS_OK_200 (0.2MS)</div>
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-8 border-t border-[#1F2937] bg-black flex items-center px-4 justify-between text-[10px] text-gray-500">
        <div className="flex gap-6 items-center">
          <span className="text-cyan-600 font-bold">npx reactscope analyze</span>
          <div className="flex gap-1 items-center">
            <span className="w-1 h-1 bg-green-500"></span>
            <span>INDEXER: IDLE</span>
          </div>
          <div className="flex gap-1 items-center">
            <span className="w-1 h-1 bg-cyan-500"></span>
            <span>FS_WATCHER: ON</span>
          </div>
        </div>
        <div className="flex gap-6">
          <div className="flex gap-2 italic">
            <span>MEM: 142.1MB</span>
            <span>//</span>
            <span>PID: 84920</span>
          </div>
          <span className="text-cyan-800">UTC: {new Date().toISOString().split('T')[1].slice(0, 8)}</span>
        </div>
      </footer>
    </div>
  );
}
