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
| **`oc`** (`/web-browsing-cli`) | **first line for both search and page reading** — see oc below |
| **context7** (`resolve-library-id` → `query-docs`) | library / framework / SDK / API / CLI docs — even well-known ones. Beats web search for anything versioned. |
| **Exa** (`./exa.py`) | semantic search when a keyword query misses the concept; second fetch path when `oc` exits 2 |
| **perplexity_ask** | quick web-grounded answer with citations; "current state of X", recent facts. **Costs prepaid credits** — not free |
| **perplexity_research** | deep multi-source investigation (slow, 30s+); literature-review depth. Costs credits |
| **perplexity_reason** | analysis needing step-by-step logic over sources. Costs credits |
| **WebSearch** | `oc ddg search` came back empty or wrong, or the query needs `allowed_domains` / `blocked_domains` |
| **WebFetch** | third fetch path after `oc` and Exa both fail |
| **Jina Reader** (`curl`) | fourth fetch path — see Raw content below |
| **Reddit `.rss`** (`curl`) | what people actually said — threads, search, comments. See Raw content below |
| **browser** (`/agent-browser`) | pages the above can't reach — JS-rendered, interactive, logged-in, click-gated — or when you need to *see* the rendered page / screenshot it |
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

## oc: the default surface

`oc` renders a page or a result list as ~500 tokens of numbered text, in about two seconds, on the local machine. `WebSearch` bills roughly 13.5k input tokens to the session-leading model per call, so a search that `oc` can answer costs about a fifteenth as much. Command reference lives in `/web-browsing-cli`; only the routing is here.

- **Search** is `oc ddg search <words>` — no quoting, ~15 results with snippets. Six back-to-back queries ran clean, so a fan-out does not need pacing.
- **Reading a page** is `oc open <url>` then `oc find <term>`, as two calls. On a docs site or a GitHub repo the first render is often all sidebar, and `find` is what returns the actual passage — including code and config blocks verbatim, which is the reason to prefer it over any summarizing fetcher when exact wording or a copyable snippet is the point.
- **Exit 2 is final for that URL.** It means `oc` cannot read the page, not that the page is empty. Move to Exa, then WebFetch, then Jina; do not re-run `oc` on it.

Verified boundaries: `oc open https://x.com/<handle>` returns real logged-out post text. Reddit does not work at all — every `oc reddit` verb lands on the login wall, so use the `.rss` endpoints below.

## Exa: free search, no key

`exa.py` (next to this file) talks to Exa's hosted MCP with no account and no API key:

```bash
./exa.py search "query" [n]   # semantic web search, default 5 results
./exa.py fetch <url>          # full page as clean markdown
```

Free tier is roughly **150 calls/day at 3 QPS per IP**, unauthenticated. Perplexity by contrast bills prepaid credits per call, and the user's Pro subscription does not cover it — API access is a separate service. So spend perplexity credits only when the question genuinely needs its depth or reasoning.

Exa's semantic ranking is what it adds over `oc ddg search`: reach for it when the question describes a concept the page would not name in those words. `exa.py fetch` is also a fetch path that has retrieved pages returning 403 to both WebFetch and Jina Reader.

If Exa starts refusing calls, the daily cap is the likely cause — tell the user, since a free account raises the limit.

## Raw content: pages and Reddit

WebFetch and WebSearch return a *summary* produced by a small model. When the actual wording matters — quotes, exact steps, someone's real phrasing, a long doc you want to read yourself — fetch the raw text instead.

`oc find` is the cheap way to get exact wording out of one page. The paths below are for a whole document you want in full, and for Reddit, which `oc` cannot reach.

**Any web page → markdown.** No key, no install:

```bash
curl -s "https://r.jina.ai/https://example.com/some/article"
```

Returns the full page as markdown (verified: ~100KB for a long Wikipedia article). The URL you request is visible to Jina AI, a third party — so never point it at internal, private, or authenticated pages. For those use playwright.

**Reddit is blocked to anonymous HTTP** (403 on both `.json` and via Jina) **but the RSS endpoints are open.** Append `.rss`:

```bash
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"
R="curl -sS --retry 5 --retry-delay 25 --retry-all-errors -A $UA"

$R "https://www.reddit.com/r/<sub>/top/.rss?t=week"          # subreddit listing
$R "https://www.reddit.com/search.rss?q=<query>&sort=top&t=year"  # site-wide search
$R "<full-post-url>.rss"                                      # whole comment thread
```

The post-URL form is the valuable one — it returns the entire thread (verified: 133 entries of real comment text on one post). Parse the Atom `<entry>` blocks; comment bodies sit in `<content type="html">` and are double HTML-escaped.

Two operational facts: the browser User-Agent is required, and Reddit rate-limits hard — several requests in a row return `429` with an empty body. The retry flags above are not optional, and batching many Reddit calls in parallel will just get them all throttled. Run them sequentially.

**Twitter/X reads through `oc`.** `oc open https://x.com/<handle>` returns the logged-out timeline as real post text with dates and links, where Jina returns only the bio and follower counts. Replies and anything past the first page still need a logged-in playwright session.

## Routing heuristics

- Default to **context7 over web search** for any library/API/framework question.
- Default to **`oc ddg search` over WebSearch** for general search, and to `oc open` + `oc find` over any fetcher, on cost.
- Escalate to **perplexity** when depth or reasoning is the actual need, and say so — it burns prepaid credits.
- **Blocked page?** The fetchers fail independently: `oc`, `exa.py fetch`, WebFetch, Jina Reader. Try the others before reporting failure.
- Use **playwright only after** the fetchers fail or content is clearly behind JS/auth — it's heavier and slower.
- Wanting *what people said* (opinions, experiences, "is X any good") → Reddit `.rss`, not a web search that returns SEO blog spam.
- Needing exact wording, a code block, or a config snippet → `oc find`, not a summarizing fetcher.
- "Is there a tool for X" → **find-skills**, not a generic web search.
- Don't reach for **perplexity_research / deep-research** unless depth is actually wanted — they're slow.
- Answering from memory is the fallback, not the default. If a claim is checkable, check it.

## Examples

- *"find out the current best way to do X in `<library>`"* → context7 (docs) + perplexity_ask (community practice), in parallel, then synthesize.
- *"research approaches for keeping responses engaging"* → perplexity_ask (high context) + find-skills, in parallel.
- *"what does this dashboard actually show"* → playwright, because web fetch can't render it.
- *"look into this Facebook login issue in the current repo and task tracker"* → do not invoke this skill; search the repo and tracker directly.
