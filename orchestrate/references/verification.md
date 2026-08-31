# Verification: cheap checks first, then a blind reviewer

Orchestration's bottleneck isn't coordination — it's validation. This is where the skill spends its rigor.

## When the verifier is required

In Full, Codex-boosted, Codex-only, and Delegate-only modes: every accepted change, **except** single-file changes with no logic content (pure formatting, comments, docs). In Delegate-only mode the verifier still runs, but deterministic checks nobody could execute remain **UNVERIFIED** until the user supplies their results — a verifier verdict cannot substitute for an unrun check, so acceptance waits on both. In the Discipline modes there is no blind verifier — the disclosed reduced-assurance rule in SKILL.md replaces this section, and acceptances are labeled "self-reviewed, not blind-verified." That's the whole rule. "It seemed straightforward" is not an exemption — straightforward-looking changes are where unreviewed regressions live. If you are tempted to skip the verifier, that impulse is itself a signal the change deserves one.

## Layer 1 — Deterministic checks (free, always first)

Run the project's **real** gate yourself via Bash before paying for model judgment:

- The actual build/test command the project ships (`npm run build`, `make test`, CI's exact command). **Never a weaker proxy** — a bare `tsc --noEmit` can pass while the real `tsc -b` build fails. Unsure what the real gate is? Read `package.json` scripts / CI config; don't invent one.
- In delegate-only mode (no real shell): you cannot run these — mark them **UNVERIFIED**, ask the user to run them, and never count an unrun check as passed.

A failing deterministic check needs no verifier — it goes straight into a fix ticket.

## Layer 2 — The blind verifier (`orchestra-verifier`)

Dispatch with:

1. **The original task, verbatim** — the user's words, never the worker's restatement. Workers narrow problems in self-serving ways ("customer #4012" becomes "some customers").
2. The diff or changed-file paths.
3. The acceptance criteria from the ticket, inline.
4. **Nothing else.** No worker reasoning, no summaries. Anchoring the verifier on the builder's narrative defeats the point.

The verifier assumes the work is broken until it personally reproduces evidence otherwise: re-runs checks itself, walks the diff, and checks the *goal*, not just the checklist — "checks pass but the goal is broken" is a FAIL. It runs on a *denylist*, not an allowlist: everything the session has minus `Edit`, `Write`, `NotebookEdit`, and `Agent`. That is deliberate — an allowlist silently excludes every MCP server, which is how a verifier ends up checking a Figma-derived task against numbers copied out of the code instead of against the file. Read-only is enforced by contract, not by the tool list: Bash is check-only, and MCP calls must read, never write.

**The mutation backstop** (be honest about what it is): **commit the candidate change** so it is in the tree and the tree is clean *before* dispatching the verifier — never stash it, which would remove the very change under verification and leave the verifier validating the baseline. When the verifier returns, `git status --porcelain` must be empty and `git rev-parse HEAD` unchanged. That detects mutations to tracked content and refs — it does not catch ignored files or external state, so this is contract-plus-detection, not a sandbox. Any detected mutation voids the verification and is itself a finding. For hard isolation, run the verifier as a Codex read-only reviewer (`--sandbox read-only`) or, once the change is committed, in a worktree.

Verdicts: `PASS` / `FAIL` / `PASS_WITH_NOTES` — the first line of the verifier's report, whichever provider runs it (a Codex read-only reviewer acting as verifier uses this vocabulary, not the worker statuses). Per-criterion evidence table; everything unexamined goes under **Not checked** and counts as NOT verified. `PASS_WITH_NOTES` is legal only when every *required* criterion passed and the notes concern non-required observations — a required criterion under a note is a `FAIL`.

## External sources of truth

When the task's definition of "correct" lives outside the repo — a Figma frame, a live page, an API response, a row in a database — the verifier must read that source itself. Numbers recorded in code, beads, or a worker's report are the *claim under test*; checking them against each other proves internal consistency and nothing more.

So before dispatch: name the surface in the ticket, name the MCP server or skill that reaches it, and confirm that bridge is actually live (a Figma plugin bridge with no connected file answers nothing). If the surface is unreachable, the verifier says so and those criteria come back **internally consistent, not verified** — they are never counted as PASS, and the disclosure to the user says which criteria were never measured against the real thing.

## Disagreement and flakiness rules

- **A reproduced deterministic failure is authoritative.** If the conductor's check fails and the verifier says PASS (or vice versa), the failing run wins until explained.
- Suspected flaky test: at most **3 reruns** to characterize it. Inconsistent results = treat as failing; report the flake itself as a finding. Never rerun-until-green.
- Verifier verdict vs deterministic evidence still unresolved after that → the change is **blocked**, not accepted. Report both artifacts to the user.

## Cross-family pairing

When both providers are available, verify across families: Codex built it → Claude verifies; Claude built it → a Codex read-only reviewer is a strong second opinion. Same-family reviewers share the builder's blind spots. This matters most at the frontier — independent pre-deployment evaluation in 2026 measured record rates of frontier models gaming checks (exploiting eval-environment bugs, extracting hidden test code). Worker self-reports from any provider's top tier are precisely what you don't trust.

**Independence has two axes — context and model — and they are not equal.** `orchestra-verifier` runs `model: inherit`, so it holds the LEAD seat's model: a frontier lead gets a frontier verifier, which is the right default for catching real defects. What it does not get is model diversity. Rank the options honestly: cross-family (Codex reviews Claude) > same-family, different tier > **same model, fresh context** > same context. The last is worthless; the third is genuinely useful — blind context still strips the builder's reasoning, its restatement of the task, and its motivated conclusion, which is where most bad accepts come from. So keep verifying, and keep the disclosure accurate: when verifier and conductor resolve to the same model, say "blind-verified (same model, independent context)" rather than implying an independent second opinion you did not obtain. If a shared blind spot would be expensive — subtle concurrency, security boundaries, anything the whole run hinges on — that is when to reach for a Codex reviewer or ask the user for one.

## Acceptance rules for the conductor

- Trust flows from artifacts: diffs, command output, file:line citations. Narrative counts for nothing.
- A worker claiming a test passed is a claim; you or the verifier re-running it is a fact.
- Findings batch into **one** fix ticket (delegation.md), and the fix re-enters this same path. Two consecutive failed fix waves on the same findings → precedence table row 5: stop, escalate to the user with the evidence.
