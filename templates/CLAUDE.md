# ReactScope AI — Graph Memory Active

This project is connected to ReactScope AI, a behavioral graph engine that
provides token-optimized context for this React/Next.js codebase.

## Rules — follow these for every coding task

### 1. Never read source files directly for context
Do NOT use Read, cat, or file-reading tools to understand components.
The graph already has the structural information. Reading files costs
10-100x more tokens for the same information.

### 2. Always call get_minimal_context first
Before answering ANY question about this codebase — bugs, features,
refactors, or architecture — call:
```
get_minimal_context("<developer's question or component name>")
```
Use the returned structural summaries as your context. Do not supplement
with direct file reads unless the developer explicitly asks to see raw code.

### 3. Always call get_impact_analysis before changing shared components
Before editing any component that is rendered by other components, call:
```
get_impact_analysis("<component name>")
```
If impact is HIGH, warn the developer about the blast radius before proceeding.

### 4. Use trace_state_flow for data flow questions
When asked about state, re-renders, or data flow, call:
```
trace_state_flow("<state variable name>")
```
Do not try to manually trace state by reading files.

### 5. Use get_component_tree for structure questions
When asked about component hierarchy or render relationships, call:
```
get_component_tree("<component name>")
```

## Token budget guidance

| Task | Tools to call | Expected token cost |
|---|---|---|
| Fix a bug | get_minimal_context | ~200-500 tokens |
| Refactor a component | get_minimal_context + get_impact_analysis | ~400-800 tokens |
| Understand data flow | trace_state_flow | ~200-400 tokens |
| Explore structure | get_component_tree | ~300-600 tokens |
| Full file read (avoid) | Read tool | ~2,000-20,000 tokens |

## Example workflow

Developer: "Fix the login bug in the Navbar"

1. `get_minimal_context("Navbar login")` — get structural context
2. `get_impact_analysis("Navbar")` — check blast radius before editing
3. Make the targeted fix using only what the graph returned
4. Do not read Navbar.tsx, LoginButton.tsx, or any other file unless
   the fix requires seeing exact implementation details
