---
name: find-out
description: >
  Research/discovery orchestrator for open-ended questions whose answer may span multiple current,
  external, historical, or authenticated sources and where choosing the research surface is part of
  the task. Use when the user explicitly invokes /find-out or asks for broad, current, multi-source
  research. Do not trigger for ordinary codebase, issue-tracker, document, or conversation-history
  investigation with a known local source, even if the user says "find out", "look into", "dig into",
  or "explore"; use the relevant local tool directly. Sibling of /find-skills (skills only) and
  /deep-research (heavy multi-source reports).
---

# /find-out

Turn an open-ended research question into a deliberate, multi-tool pass. The value is **routing** when the answer surface is genuinely uncertain, not wrapping routine local investigation in a research workflow.

## Activation

Use this skill when at least one applies:

- the user explicitly invokes `/find-out`
- the question asks for broad or current research across multiple source types
- the correct research surface is unclear and selecting it is a meaningful part of the task
- the answer needs external citations, authenticated pages, or a combination of code, history, and current documentation

Do not use it when a named repository, issue tracker, document set, or conversation history is the obvious source. A phrase such as "find out", "look into", "dig into", or "explore" is not sufficient by itself.

## The toolbox

| Tool | Reach for it when |
|---|---|
| **context7** (`resolve-library-id` → `query-docs`) | library / framework / SDK / API / CLI docs — even well-known ones. Beats web search for anything versioned. |
| **perplexity_ask** | quick web-grounded answer with citations; "current state of X", recent facts |
| **perplexity_research** | deep multi-source investigation (slow, 30s+); literature-review depth |
| **perplexity_reason** | analysis needing step-by-step logic over sources |
| **WebSearch** | fast general lookup, finding candidate URLs |
| **WebFetch** | a specific known URL's content |
| **playwright** (`/playwright-cli`) | pages the above can't reach — JS-rendered, interactive, logged-in, click-gated — or when you need to *see* the rendered page / screenshot it |
| **find-skills** | the need might already be solvable by an existing skill |
| **scan / morning** | the answer is in the user's own past CC/Codex conversations |
| **Explore agent / grep** | the answer is in the user's own codebase |
| **deep-research** | hand off for a genuinely heavy, fact-checked, multi-source report |

## Workflow

1. **Classify the question** — docs? current facts? own code? own history? needs a real browser? Pick the matching tool(s). Most questions hit only 1–2.
2. **Say what you're doing** — one line naming the tool(s) and why. This is also how the user learns the routing.
3. **Run in parallel** — independent lookups go in one batch, not sequentially.
4. **Synthesize** — lead with the answer, cite sources, flag where sources disagree, separate fact from inference.
5. **Flag skill candidates** — if this looks like a recurring need (or the user says it isn't the first time), note it: "this could be a /write-a-skill candidate."

## Routing heuristics

- Default to **context7 over web search** for any library/API/framework question.
- Use **playwright only after** web fetch fails or content is clearly behind JS/auth — it's heavier and slower.
- "Is there a tool for X" → **find-skills**, not a generic web search.
- Don't reach for **perplexity_research / deep-research** unless depth is actually wanted — they're slow.
- Answering from memory is the fallback, not the default. If a claim is checkable, check it.

## Examples

- *"find out the current best way to do X in `<library>`"* → context7 (docs) + perplexity_ask (community practice), in parallel, then synthesize.
- *"research approaches for keeping responses engaging"* → perplexity_ask (high context) + find-skills, in parallel.
- *"what does this dashboard actually show"* → playwright, because web fetch can't render it.
- *"look into this Facebook login issue in the current repo and task tracker"* → do not invoke this skill; search the repo and tracker directly.
