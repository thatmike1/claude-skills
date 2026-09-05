# claude-skills

```
 ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗      ███████╗██╗  ██╗██╗██╗     ██╗     ███████╗
██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝      ██╔════╝██║ ██╔╝██║██║     ██║     ██╔════╝
██║     ██║     ███████║██║   ██║██║  ██║█████╗  █████╗███████╗█████╔╝ ██║██║     ██║     ███████╗
██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝  ╚════╝╚════██║██╔═██╗ ██║██║     ██║     ╚════██║
╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗      ███████║██║  ██╗██║███████╗███████╗███████║
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝      ╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚══════╝
```

> **The installer is a React app. In the terminal. Using [ink](https://github.com/vadimdemedes/ink). Because we can.**
>
> Web. Mobile. Desktop. **Terminal.** The React world domination arc is complete.

A collection of custom skills for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Each skill is a self-contained directory that can be installed independently.

## Skills

| Skill | What it does | Invoke |
|---|---|---|
| **Sessions** | | |
| [morning](#morning--evening) | Daily briefing: yesterday's context, today's plan with estimates | `/morning`, `/morning global week` |
| [evening](#morning--evening) | End-of-day receipts: what actually got done today | `/evening` |
| [scan](#scan) | Ask any question about your past Claude Code conversations | `/scan` |
| ⭐ [peek](#peek--jarvis) | Read another running session's transcript from disk, zero footprint | `/peek live`, `/peek <id> --last 6` |
| ⭐ [jarvis](#peek--jarvis) | Ask one session about all your others: what is open, what to touch next | `/jarvis` |
| [warden](#warden) | All-day accountability loop: plan interview, then nudge on drift | `/warden` |
| **Delegate** | | |
| ⭐ [orchestrate](#orchestrate) | Frontier lead plans, routes, verifies; cheaper Claude/Codex workers execute | `/orchestrate` |
| [find-out](#find-out) | Research orchestrator: picks the surface, fans out, reconciles sources | `/find-out` |
| **Publish** | | |
| ⭐ [readout](#readout) | Publish session work as a shareable, commentable web page | `/readout`, `/readout comments` |
| **Think & design** | | |
| [goblin](#goblin) | Neurodivergent thought structuring: compile, decompose, estimate, decide | `/goblin`, `/goblin decompose` |
| [wonder-pill](#wonder-pill) | Divergent ideation: invert the hidden assumptions, branch them, render the thought-space as a local map | `/wonder`, "help me brainstorm" |
| [design-styles](#design-styles) | Aesthetic direction + UX baseline: style packs, landing craft, redesign, reviews | triggers on frontend work |

<details>
<summary><b>Deprecated (8)</b> — kept in <code>deprecated/</code>, still installable, no longer recommended</summary>

| Skill | What it was | Why it is here |
|---|---|---|
| live-prompt, afk-prompt | Handoff prompts for a fresh instance, attended or unattended | Superseded by Matt Pocock's `/handoff` |
| cc-audit | Audit a Claude Code setup for anti-patterns | One-off; checks never revisited against current Claude Code |
| ai-cv-scanner | Mine conversation history for AI-experience questionnaire answers | Built for one questionnaire, which is done |
| invoice-subjects | Czech freelancer invoice subjects from git history | Only useful with the exact setup it was written against |
| panels, detective, punchy | Rotating response styles for ADHD reading | The novelty was the point, and it wore off |

See [`deprecated/README.md`](deprecated/README.md). The installer lists them under a collapsed group (`d` to expand).
</details>

## Highlights

### readout

The flagship. Artifact on steroids: session output authored as **MDX with JSX components**, compiled to a themed HTML page, and **published to the web** (readout.ssscribe.app) instead of sitting on disk.

- Document types: walkthroughs, plans, comparisons, investigations, changelogs
- Rich components: diffs, checklists, timelines, stat tiles, file trees, diagrams, docshelf
- **Anchored comments** — teammates comment on specific parts of the page, and the agent reads the comments back into the session to act on them
- Password-protected readouts (encrypted at publish, comments encrypted too)
- Living documents: re-publishing updates the same page

### peek / jarvis

Every Claude Code session writes its transcript to disk as it goes, and reading that file is invisible to the session that owns it. **peek** is the tool: `peek live` lists the sessions running right now (project, quiet-for, session id, last exchange), `peek <id> --last 6` reads one, and every render ends with a `--since N` cursor so you can follow a session incrementally. Peek before you `SendMessage` another session and you skip the ask-then-instruct round trip; run a coach session that peeks a driver session and the driver's transcript stays clean.

**jarvis** is the skill built on it: the session you talk to *about* the others. "I have six open and an hour left, where do I start", "what is this session on about", "tell session X to do Y", "launch a background job on Z". It answers with a pick and a reason rather than a list to re-triage. jarvis does not work without peek installed. `live` is Linux-only (it reads `/proc`).

### orchestrate

Multi-agent delegation with the economics built in. The session model becomes the conductor — it plans, routes, and verifies but does not implement; implementation goes to the cheapest model that clears the task's quality bar (Claude subagents, or OpenAI Codex CLI workers when installed and consented).

- **Routing by measured data, not vibes** — bundles a model × reasoning-effort comparison table (cost per finished task, tokens per task) plus the `refresh.py` that regenerates it from Artificial Analysis
- **Delegation tickets** — every dispatch is a self-contained 7-section ticket with a declared write set; parallel work requires provably disjoint write sets
- **Blind verification** — a fresh-context verifier gets the original task verbatim, never the worker's narrative, and assumes the work is broken until proven otherwise
- **Durable state** — a ledger file survives compaction and restarts; escalation and retries follow one precedence table
- Ships three subagent definitions (`orchestra-scout` / `orchestra-worker` / `orchestra-verifier`) which the installer places in `~/.claude/agents/`

<details>
<summary><b>morning / evening</b></summary>

Bookends for the workday.

- **morning** plans the day forward: aggregates yesterday's Claude Code conversations, Codex sessions, git history, and memory files into a plan with checkboxes, time estimates, and sequencing. Repo mode (deep single-project) or global mode (cross-project). Flexible ranges — yesterday, 3 days, week.
- **evening** proves the day backward: today's sessions, commits, and issue-tracker activity as an honest accomplishment log. Built for the "I did nothing today" feeling — it shows the receipts.
</details>

<details>
<summary><b>warden</b></summary>

A standing session that holds you to the day. It interviews you into a short checklist with time anchors, then runs the `loop` skill self-paced: every tick it reads ActivityWatch (window focus and afk state) plus `peek live`, decides on-plan / break / drift, and on drift fires a desktop notification naming the single next physical action. Declared breaks are part of the plan and are never nudged. Needs ActivityWatch running locally and `peek` installed; `config.json` carries the machine's sound target for setups where the default sink is inaudible.
</details>

<details>
<summary><b>scan</b></summary>

Question-driven search over your Claude Code history. Where morning builds a fixed daily plan, scan answers a specific question: "find where I said X", "what did I do in project Y this week", "recap that migration". Searches full message bodies (keyword/regex), lists sessions as an index, or dumps per-session digests, then reasons over the result. Subagent transcripts count as part of their parent session, so delegated work is searchable too.

Install [cc-browse](https://github.com/thatmike1/cc-browse) and search gets an accelerator for free: it keeps the same logs in a SQLite index, which drops a corpus-wide search from ~20s to ~0.3s and adds semantic search (`--mode semantic|both`). Entirely optional — without it everything falls back to the pure-Node scan.
</details>

<details>
<summary><b>find-out</b></summary>

A research orchestrator for open-ended questions where *choosing the research surface* is part of the work — current web, external docs, your own conversation history, authenticated sources. It picks surfaces, fans the question out across them, and reconciles what comes back rather than trusting one source. Search and page reads route through the token-cheap `oc` CLI by default, falling back to `WebSearch` when a query needs domain filtering.

Deliberately narrow: ordinary codebase, issue-tracker or history lookups with a known local source should use the local tool directly, even when you say "find out" or "dig into".
</details>

<details>
<summary><b>goblin</b></summary>

Thought structuring inspired by [goblin.tools](https://goblin.tools). Four modes:

- **compile** — braindump in, structured tasks out (no limbo items)
- **decompose** — break overwhelming tasks into steps (spiciness dial 1-4)
- **estimate** — realistic time estimates with ADHD-aware multipliers
- **decide** — break analysis paralysis with a recommendation (always picks a side)
</details>

<details>
<summary><b>wonder-pill</b></summary>

Ported from [ara-mkr/Wonder-Pill](https://github.com/ara-mkr/Wonder-Pill) (MIT, attribution and
licence kept in the skill directory). Brainstorming that refuses to hand over a shortlist: it names
3-5 load-bearing assumptions inside the request, inverts each one into a what-if that has an actual
hook, branches those outward through fixed dimensions, keeps the discarded threads with their cause
of death, and does not rank anything at the end.

Two stages are rewritten for Claude Code, which has neither of the claude.ai host tools the original
leans on. Intake asks its three questions as plain text instead of a tappable-options widget, and the
map is written as a standalone html file into `<repo>/wonder-pill/` and opened with `xdg-open`
instead of rendering inline through the Visualizer. `scripts/render-map.mjs` injects the nodes and
edges into a static shell that carries its own light and dark palettes: drag to pan, zoom between
0.3 and 1.4, click a node for its gut-check, node types told apart by border style rather than
colour, dashed cross-links where two branches hit the same tension.
</details>

<details>
<summary><b>design-styles</b></summary>

Six frontend skills merged into one with internal routing. A thin SKILL.md does a "design read" of the brief, then loads only what the branch needs:

- **Style packs** — high-end agency, editorial minimalist, industrial brutalist (one per project, pack rules win)
- **landing-craft** — anti-slop methodology for landing pages/portfolios: dials, layout hard rules, AI-tell bans, mechanical pre-flight (distilled from [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill))
- **redesign** — audit-first upgrades of existing sites without breaking them
- **ux + review** — functional UX baseline and a capped, scannable review format (verdict first, `location — problem → fix` one-liners, max 3 P0 / 5 P1 / 5 P2)

Built as the ungated sibling of heavyweight design skills that require per-project setup.
</details>

## Install

Requires Node.js 22+ for the installer (an [ink](https://github.com/vadimdemedes/ink) app). The skills themselves need no npm install, with one exception: readout compiles MDX and carries its own `package.json`.

```bash
git clone https://github.com/thatmike1/claude-skills.git
cd claude-skills
node install.mjs
```

First run installs the installer's npm dependencies automatically. The installer:

1. Discovers every directory with a `SKILL.md` (root and `deprecated/`) and shows them grouped by category
2. Asks whether to **symlink** (edits here update the skill) or **copy** (standalone; also copies the `shared/` parser helpers)
3. Runs setup for skills that need configuration (morning asks for git author and repo directory)
4. Installs to `~/.claude/skills/`, and copies any `agents/*.md` a skill ships into `~/.claude/agents/`

Restart Claude Code afterwards. `node install.mjs --dry-run` previews without writing.

### Manual install

Symlink or copy any skill directory to `~/.claude/skills/`:

```bash
ln -s /path/to/claude-skills/morning ~/.claude/skills/morning     # symlink: edits in the repo are live
cp -r /path/to/claude-skills/goblin ~/.claude/skills/goblin         # copy: standalone
```

For skills that need config, copy the example and fill it in: `cp morning/config.json.example morning/config.json`.

## Skill anatomy

```
<skill>/
  SKILL.md               # instructions + YAML frontmatter; short, with detail pushed into references/
  plugin.json            # optional package metadata
  config.json.example    # template for user-specific config (config.json is gitignored)
  references/            # detailed docs split by topic/mode
  scripts/               # node.js utilities for deterministic work, no npm deps
  agents/                # optional subagent definitions, copied to ~/.claude/agents on install
```

Shared conversation parsers (Claude Code + Codex JSONL discovery) live in `shared/` and are imported by morning, evening, scan and peek as `../../shared/*.mjs`. They enumerate sessions by listing `~/.claude/projects` directly and pick up each session's subagent transcripts along with it.
