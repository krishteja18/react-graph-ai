/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { buildGraph } from "./src/lib/engine/graph-builder";
import { QueryEngine } from "./src/lib/engine/query-engine";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json());

// Gap 3 fix: configurable target directory via env var or CLI arg
const TARGET_DIR = process.env.TARGET_DIR
  ? path.resolve(process.env.TARGET_DIR)
  : process.argv[2]
  ? path.resolve(process.argv[2])
  : process.cwd();

console.log(`React Graph AI: Targeting directory → ${TARGET_DIR}`);

let memoizedGraph: any = null;
let queryEngine: QueryEngine | null = null;
let isRebuilding = false;

async function buildEngine() {
  isRebuilding = true;
  try {
    memoizedGraph = await buildGraph(TARGET_DIR);
    queryEngine = new QueryEngine(memoizedGraph);
    console.log(
      `Graph built: ${memoizedGraph.nodes.length} nodes, ${memoizedGraph.metadata.totalRawTokens} raw tokens`
    );
  } finally {
    isRebuilding = false;
  }
}

async function getEngine() {
  if (!memoizedGraph) await buildEngine();
  return { graph: memoizedGraph, engine: queryEngine! };
}

// Gap 4 fix: watch TARGET_DIR for changes and rebuild graph
let rebuildTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRebuild(changedFile: string) {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(async () => {
    console.log(`File changed: ${changedFile} — rebuilding graph...`);
    await buildEngine();
  }, 500);
}

try {
  fs.watch(TARGET_DIR, { recursive: true }, (_, filename) => {
    if (!filename) return;
    if (!/\.(tsx?|jsx?)$/.test(filename)) return;
    if (filename.includes("node_modules") || filename.includes("dist")) return;
    scheduleRebuild(filename);
  });
  console.log(`Watching ${TARGET_DIR} for changes...`);
} catch (err) {
  console.warn("File watching unavailable:", err);
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", engine: "React Graph AI", targetDir: TARGET_DIR });
});

app.get("/api/graph", async (req, res) => {
  try {
    const { graph } = await getEngine();
    res.json(graph);
  } catch (error: any) {
    console.error("API Error /api/graph:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/analyze", async (req, res) => {
  try {
    await buildEngine();
    res.json({ status: "success", metadata: memoizedGraph.metadata });
  } catch (error: any) {
    console.error("API Error /api/analyze:", error);
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

// Gap 1 fix: use getAIReadyContext to build a focused, token-minimal prompt
app.post("/api/ask", async (req, res) => {
  const { query } = req.body;
  if (!process.env.GEMINI_API_KEY) {
    return res.status(400).json({ error: "GEMINI_API_KEY not configured" });
  }

  try {
    const { engine } = await getEngine();
    const context = await engine.getAIReadyContext(query);

    if (context.error) {
      return res.json({ answer: `No matching component found. Try one of: ${context.suggestions?.join(", ")}`, optimization: null });
    }

    // Build prompt from structural summaries — the actual token-optimized representation
    const prompt = `You are React Graph AI, a React architectural assistant.

The developer asked: "${query}"

Structural context (${context.optimization.contextTokens} tokens used vs ${context.optimization.totalRepoTokens} total repo tokens — ${context.optimization.tokenSavingsPct} saved):

${context.contextSummary}

Answer the developer's question based on the structural context above. Be concise and specific.`;

    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const answer = result.text || "Unable to generate an answer.";

    res.json({ answer, optimization: context.optimization });
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
    console.log(`React Graph AI Engine running on http://localhost:${PORT}`);
    console.log(`Target directory: ${TARGET_DIR}`);
  });
}

startServer().catch((err) => {
  console.error("CRITICAL: Failed to start server", err);
  process.exit(1);
});
