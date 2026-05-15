# Answer-Quality Test Protocol

Validates whether the pruned context is *sufficient* to produce correct AI answers, not just smaller.

## Setup

Target repo: `/tmp/taxonomy` (Next.js 13 app from shadcn-ui).

For each test below, run two prompts against Claude (or Copilot / GPT-4):

- **Path A — full file paste:** open the relevant files, copy their full contents, paste into Claude, ask the question.
- **Path B — pruned paste:** run the inspect-context script, paste the JSON, ask the same question.

Compare:
- **Token count** (Claude's UI shows input tokens in the message bar)
- **Answer quality** (rate 1-5: did the AI give a correct, actionable, complete answer?)
- **Hallucinations** (did it invent functions/props that don't exist?)

## Test 1 — Simple lookup

**Question:** "How does the UserAuthForm component handle GitHub sign-in?"

- Path A files to paste: `components/user-auth-form.tsx`
- Path B command:
  ```
  npx tsx scripts/inspect-context.ts /tmp/taxonomy UserAuthForm
  ```

Expected: Both should answer correctly. Path B win = same answer, fewer tokens.

## Test 2 — Cross-component refactor

**Question:** "If I change UserAccountNav to require a `compact` prop, what else might break?"

- Path A files to paste: every file that imports UserAccountNav (find with grep first — this is the labor the tool is supposed to save)
- Path B command:
  ```
  npx tsx scripts/inspect-context.ts /tmp/taxonomy UserAccountNav
  ```

Expected failure mode: Path B may miss callers because `getMinimalContext` doesn't walk import edges. If the AI in Path B can't list dependents, that's a gap in the tool.

## Test 3 — Cross-cutting concern

**Question:** "Explain how a logged-in user's session is checked in the dashboard layout."

- Path A files to paste: relevant auth + layout files (you'd have to grep to find them)
- Path B command:
  ```
  npx tsx scripts/inspect-context.ts /tmp/taxonomy session
  npx tsx scripts/inspect-context.ts /tmp/taxonomy dashboard
  ```

Expected failure mode: Single-keyword queries miss the actual flow. The pruned context may be smaller but incomplete — AI answers may be vague or wrong.

## Recording results

| Test | Path A tokens | Path A quality | Path B tokens | Path B quality | Notes |
|------|---|---|---|---|---|
| 1    |   |   |   |   |       |
| 2    |   |   |   |   |       |
| 3    |   |   |   |   |       |

## What "success" looks like

- Test 1: Path B should match Path A (small, contained, name-based query is the tool's sweet spot)
- Test 2: Path B likely falls short — flag this as a known gap, fix in v1.1 by including import edges
- Test 3: Path B likely falls short — flag as a known gap, fix in v1.1 by adding relationship traversal

If Path B wins all three, you have credible numbers for the README. If it loses 2+, your value prop needs sharpening before the next marketing push.
