# Contributing to ReactGraph AI

Welcome! ReactGraph is a tool designed to bridge the gap between complex React architecture and LLM context.

## 🛠 Development Setup

1. **Clone the repo**
2. **Install dependencies**: `npm install`
3. **Set up environment**: Copy `.env.example` to `.env` and add your keys.
4. **Run build**: `npm run build`

## 🚀 How it Works

- **Parser**: Uses Babel to walk through TS/JS files and identify React components (`NodeType.COMPONENT`).
- **Graph Builder**: Resolves relationships like `RENDERS` (JSX usage) and `IMPORTS`.
- **Query Engine**: Uses semantic reasoning (Gemini/OpenAI/Anthropic) to map user questions to specific graph nodes.

## 🧪 Testing your changes

You can test the analyzer on the local codebase itself:
```bash
npx tsx src/cli/index.ts analyze ./src
```

## 🗺 Roadmap
- [ ] Support for Vue and Svelte.
- [ ] VS Code Extension integration.
- [ ] Visualization exports (SVG/PNG).

Thank you for contributing!
