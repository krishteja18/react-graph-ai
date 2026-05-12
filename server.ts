/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { buildGraph } from "./src/lib/engine/graph-builder";
import { QueryEngine } from "./src/lib/engine/query-engine";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json());

let memoizedGraph: any = null;
let queryEngine: QueryEngine | null = null;

async function getEngine() {
  if (!memoizedGraph) {
    memoizedGraph = await buildGraph(process.cwd());
    queryEngine = new QueryEngine(memoizedGraph);
  }
  return { graph: memoizedGraph, engine: queryEngine! };
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", engine: "ReactGraph AI" });
});

app.get("/api/graph", async (req, res) => {
  try {
    const { graph } = await getEngine();
    res.json(graph);
  } catch (error: any) {
    console.error('API Error /api/graph:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/analyze", async (req, res) => {
  try {
    memoizedGraph = await buildGraph(process.cwd());
    queryEngine = new QueryEngine(memoizedGraph);
    res.json({ status: 'success', metadata: memoizedGraph.metadata });
  } catch (error: any) {
    console.error('API Error /api/analyze:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/impact/:nodeId", async (req, res) => {
  try {
    const { engine } = await getEngine();
    const impact = engine.getImpactAnalysis(req.params.nodeId);
    res.json(impact);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ask", async (req, res) => {
  const { query } = req.body;
  if (!process.env.GEMINI_API_KEY) {
    return res.status(400).json({ error: "GEMINI_API_KEY not configured" });
  }

  try {
    const { graph } = await getEngine();
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Simplify graph for prompt context
    const graphSummary = graph.nodes.map((n: any) => `- ${n.name} (${n.type}) in ${n.filePath}`).join('\n');
    
    const prompt = `
      You are ReactGraph AI, a graph-aware architectural assistant.
      User Query: "${query}"
      
      Project Structure:
      ${graphSummary}
      
      Based on this graph structure, identify the most relevant components/files for this request.
      Explain why they are relevant and how they might be affected.
      Be concise. Focus on React-specific implications.
    `;

    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    const text = result.text || "I was unable to generate an answer for that query based on the graph.";
    
    res.json({ answer: text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ReactGraph AI Engine running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("CRITICAL: Failed to start server", err);
  process.exit(1);
});
