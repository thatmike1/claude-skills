# Routing: resolving capability classes to live models

The skill's policy never names dated model IDs. This file is the procedure for resolving FRONTIER / WORKHORSE / FAST to what exists on the user's account **today**.

## The LEAD seat

The session model is the **LEAD seat** — it runs you, the conductor. Do not assume it is frontier-class: sessions start on mid-tier models, org fallbacks, and cost-capped configs. If FRONTIER-class judgment work is on the plan and you cannot establish that the LEAD seat is frontier-class (from the session's own model identity), say so and suggest the user switch models — routing architecture decisions to a mid-tier seat while calling it FRONTIER violates the First Law with extra steps.

**Frontier is a class, not a single model.** The test is whether the LEAD seat clears the frontier bar, never whether it is the *most* capable model in the lineup. Every current top-tier Claude family qualifies, and the conductor behaves identically in each: same classes, same gates, same tickets, same verification. A frontier LEAD must never recommend switching to a *different* frontier model — that is churn dressed up as rigor. Reserve the switch recommendation for a LEAD seat that is actually mid-tier or below.

**The seat can change under you.** Claude Code may move a session to a different model mid-run — safety-classifier fallback (which can also pin the session to the new model for its remainder), quota exhaustion, org policy, or the user typing `/model`. Treat the Step 0 probe as cache with an invalidation rule, not a one-time fact. On any signal the identity moved, re-probe and write one ledger line: `LEAD seat changed: <old class> → <new class> — <trigger>`. Then:

- **Frontier → frontier** (e.g. a fallback between top-tier families): nothing to re-plan. Finish the run; in-flight tickets stay valid, because tickets are written against classes.
- **Frontier → mid-tier** (a real downgrade): stop before the next FRONTIER-class dispatch, tell the user the seat dropped, and let them choose — restore the seat, re-route that work to a frontier subagent, or accept a documented reduction. Never quietly keep making frontier-class calls from a mid-tier seat.

## Claude seats

- **FRONTIER** is normally the LEAD seat itself, but frontier-class *workers* are dispatchable too — the Agent tool's `model` parameter accepts frontier aliases (`opus`, `fable`) alongside `sonnet` and `haiku`. Aliases track the latest release in each family automatically — new releases require zero skill edits.
- **WORKHORSE and FAST resolve from data, not from aliases.** On the current map: Claude-side FAST = **Sonnet at high effort** (`orchestra-scout`, or `orchestra-worker` with `model: sonnet`); Claude-side WORKHORSE = **Opus at high effort** (`orchestra-worker` as shipped). `haiku` has no cell worth routing to. Which ticket shapes go to which seat is in "Sonnet or Opus" below. Effort, not ticket wording, sets how much a worker thinks; a "do not deliberate" line in a ticket changes nothing on a model whose thinking is always on.
- **When to spend a frontier worker** (the First Law still applies — this is the expensive seat): genuinely independent frontier-judgment workstreams that must run in parallel; a blind verifier for a frontier-class change when no Codex counterpart exists; or a second opinion on a decision the run hinges on. Not for implementation a WORKHORSE clears. An Opus lead dispatching Opus workers is ordinary routing, not an escalation — but it is the priciest ensemble you can field, so announce it like any other fan-out.
- **Fable vs Opus inside FRONTIER** (when both are on the account): the two seats are not interchangeable in cost. Fable drains a separate, fast-emptying weekly cap; Opus matches or beats it on pure code quality. So frontier *workers* default to `opus` even when Fable holds the LEAD seat — a worker inheriting the session model silently spends the scarcest quota on typing. Spend a `fable` worker only where deep design judgment or broad world knowledge is the task's actual content: an architecture bake-off, the second opinion a run hinges on, genuinely ambiguous debugging. The "when to spend a frontier worker" gate above still applies first.
- **Effort before tier.** Within a class, the real dial is effort, not model — and effort does not substitute for class in the other direction: a WORKHORSE at xhigh does not become FRONTIER, while a frontier seat at medium effort typically beats a cheaper seat at xhigh, in fewer tokens. A WORKHORSE or FAST seat earns its place on class-appropriate work and wide fan-outs where per-seat cost multiplies, not as a high-effort stand-in for judgment.

## The model map — measured seat resolution

[references/model-map.md](model-map.md) compares model × effort on **cost per finished task** and **tokens per task** (Artificial Analysis data, plus design and web-dev preference Elo). It is a synced copy of a canonical map maintained elsewhere; `refresh.py` beside it re-copies it (`--fetch` regenerates the canonical first). Consult it before planning any big run — it is the source of truth for seat resolution, and the condensation below says what it showed when this file was last edited (index v4.3, 2026-09-29). If the map's date looks stale, sync it or say so rather than routing on old numbers.

- **Claude lineup**: FRONTIER = `fable` (Mythos-class, gated by its own fast-draining weekly cap on Max plans) and `opus`. **Effort is the real Claude dial.** On Opus, medium is the value rung and high the knee; xhigh roughly doubles the cost of high for a couple of points, and max is a quota trap. Read the current numbers from the map, not from this file.
- **Sonnet sits on the cost frontier at high effort only.** Sonnet at high is a few index points under Opus at medium for less money per task; Sonnet at medium loses to Opus at low, Sonnet at xhigh to Opus at high, and Sonnet at max ties Opus at xhigh on the most tokens of any row. Sonnet streams faster per token but thinks far more, so a task takes about the same wall clock: the win is price and parallel width, not speed. Cache reads cost the same on both, so a long agentic session on Sonnet ends up costing about what Opus does.
- **Never low or max on either Claude model.** Low falls off a cliff; max multiplies tokens for a point or two.
- **GPT (Codex seats) scales far harder with effort than Claude**, so a GPT seat named without an effort level is meaningless. Specify effort on every Codex dispatch, and pick the Codex WORKHORSE/FAST seat and the cross-family verifier from the map's current rows.
- Caveats travel with the map: the index is not agentic-coding-in-CC (the `agentic` column ranks differently), and $/task is API pricing — on subscription quota, read **tokens per task** instead; it orders the same conclusions.
- Pass the model per dispatch via the Agent tool's `model` parameter (overrides agent-file frontmatter). Treat it as a *request*: runtimes may substitute if the org disallows a tier. If a dispatch behaves far above or below its class, log the seat as "unverified" rather than asserting it.
- The built-in `Explore` agent inherits the session model — from any frontier LEAD that is an expensive default for background scanning, and when LEAD and `Explore` resolve to the same model you are paying frontier rates to grep. Dispatch `orchestra-scout` (FAST, Sonnet at high) instead.

## Sonnet or Opus — by ticket shape

Classify by what the ticket asks the seat to *do*, then by how long the session will run.

- **Sonnet at high** — read-and-report and short bulk work, where per-seat price multiplies across a fan-out:
  - reconnaissance: locating files and symbols, extracting facts, codebase analysis (`orchestra-scout`);
  - research sweeps across docs or sources that end in a report;
  - fully specified bulk edits a ticket can state as a rule (rename across files, apply one given pattern, regenerate fixtures) — `orchestra-worker` with `model: sonnet`;
  - running a test or build suite and reporting results, no fixing.
- **Opus at high** (the worker's default) — anything where judgment is the content or the session runs long:
  - implementation that makes design choices, however small;
  - debug-fix-rerun loops and long iterative edit sessions (cache reads erase Sonnet's price gap);
  - review and verification (`orchestra-verifier` pins `opus`);
  - any bulk ticket that turned out to need judgment — a Sonnet worker reporting `NEEDS_CONTEXT` or `BLOCKED` on scope is re-dispatched to Opus, not retried on Sonnet.
- Unsure → Opus (First Law: one seat up).

## Effort — use the controls that actually exist

Effort is a real dial, but only where a mechanism exists to set it. Per surface:

- **Codex workers**: set it explicitly per invocation — `-c model_reasoning_effort=<level>` (see codex-workers.md).
- **Claude subagents**: Claude Code's Agent tool takes a `model` per dispatch but no effort, so the agent file's `effort` is what applies. The bundled role files pin scout `sonnet`/`high`, worker `opus`/`high`, verifier `opus`/`high` — every one of them a frontier cell, and overriding the worker's model to `sonnet` lands on Sonnet at high, the one Sonnet cell worth paying for. If your harness does offer a per-invocation effort control, it overrides these; if a model/effort combination isn't supported, the runtime falls back to the model's default — log what actually applied. Describe the task's nature in the ticket and leave depth to effort.
- Heuristics (where effort is settable per dispatch, i.e. Codex): medium for mechanical work; provider default for normal work; deep effort only for hard verification and design. For a *borderline* task, raising effort on a cheap seat is often better economics than raising the tier — try it first (precedence table row 2). This is the retry economics for tasks near a class boundary; it does not override the class-substitution rule in "Effort before tier" for tasks that clearly need judgment.

## Codex seats

**UI and UX never go to a Codex seat — sketches, mockups and first drafts included.** A GPT draft polished by Claude is still a GPT design at its core, so anything a person looks at or clicks is built by Claude from the start. Codex seats take backend, research, data and verification work; a Codex reviewer may check UI code for defects, but never proposes or judges the design.

Follow codex-workers.md: probe → consent → **discover the account's actual tiers** (config.toml preference, `/model`, or asking the user; documentation ≠ entitlement; IDs differ by auth mode) → verify each tier you intend to use with one tiny call → map verified tiers to classes by the provider's published positioning → record the mapping in the ledger.

Providers commonly ship flagship / workhorse / economy tiers, but treat that as a pattern to check, not an invariant. The user's configured default model is their *preference* — identify what it is before classifying it; a user who pinned the flagship as default did not thereby make the flagship your WORKHORSE.

> **Dated example — not policy.** As of 2026-07 the Codex flagship family was GPT-5.6: Sol (flagship), Terra (positioned "everyday workhorse"), Luna ("clear repeatable tasks"), with ChatGPT-account logins using suffixed IDs (`gpt-5.6-sol`) where API-key auth used bare ones (`gpt-5.6`). By the time you read this, assume the lineup has changed — run the discovery procedure.

## Choosing the seat for a task

1. Classify the task's *judgment content*, not its size. A 500-line mechanical rename is FAST; a 10-line concurrency fix is FRONTIER.
2. Apply the First Law: cheapest seat that clearly clears the bar; unsure → one seat up.
3. Claude vs Codex within a class: UI and UX work is Claude-only (see Codex seats); otherwise prefer the provider under less quota pressure; prefer cross-family pairing for build/verify; respect explicit user preference.
4. Log every routing decision in one ledger line: `task → class → seat (+effort if applied) — why`.

## Currency rule

If anything suggests your model knowledge is stale — an unfamiliar name from the user, an alias resolving oddly, an entitlement error on dispatch — verify against live provider docs or the account itself before routing. This repo's own first Codex dispatch failed on exactly this: a day-old model family, a CLI predating it, and an auth-mode ID split no static document had caught yet.
