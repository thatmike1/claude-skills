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

## Skills at a glance

| Skill | What it does |
|---|---|
| **Publish** | |
| ⭐ [readout](#readout) | Publish session work as a shareable, commentable web page |
| **Orchestration** | |
| ⭐ [orchestrate](#orchestrate) | Frontier lead plans, routes, verifies — cheaper Claude/Codex workers execute |
| **Daily rhythm** | |
| [morning](#morning--evening) | Daily briefing: yesterday's context → today's actionable plan |
| [evening](#morning--evening) | End-of-day receipts: what actually got done today |
| [scan](#scan) | Ask any question about your past Claude Code conversations |
| **Sessions** | |
| [peek](#peek--jarvis) | Read another running session's transcript from disk, zero footprint |
| [jarvis](#peek--jarvis) | Ask one session about all your others: what is open, what to touch next |
| **Thinking** | |
| [goblin](#goblin) | Neurodivergent thought structuring: compile, decompose, estimate, decide |
| [find-out](#find-out) | Research orchestrator: picks the surface, fans out, reconciles sources |
| **Handoffs** | |
| [live-prompt](#live-prompt--afk-prompt) | Prompt for a fresh instance you'll actively steer |
| [afk-prompt](#live-prompt--afk-prompt) | Prompt for an unattended run while you're away |
| **Meta** | |
| [cc-audit](#cc-audit) | Audit your Claude Code setup, flag anti-patterns with ranked fixes |
| **Frontend** | |
| [design-styles](#design-styles) | Aesthetic direction + UX baseline: style packs, landing craft, redesign, reviews |
| **Niche** | |
| invoice-subjects | Monthly invoice subjects + newsletter blurb from git history (Czech-specific) |
| ai-cv-scanner | Mine conversation history for AI experience questionnaire answers |

## Highlights

### readout

The flagship. Artifact on steroids: session output authored as **MDX with JSX components**, compiled to a themed HTML page, and **published to the web** (readout.ssscribe.app) instead of sitting on disk.

- Document types: walkthroughs, plans, comparisons, investigations, changelogs
- Rich components: diffs, checklists, timelines, stat tiles, file trees, diagrams, docshelf
- **Anchored comments** — teammates comment on specific parts of the page, and the agent reads the comments back into the session to act on them
- Password-protected readouts (encrypted at publish, comments encrypted too)
- Living documents: re-publishing updates the same page

### orchestrate

Multi-agent delegation with the economics built in. The session model becomes the conductor — it plans, routes, and verifies but does not implement; implementation goes to the cheapest model that clears the task's quality bar (Claude subagents, or OpenAI Codex CLI workers when installed and consented).

- **Routing by measured data, not vibes** — bundles a model × reasoning-effort comparison table (cost per finished task, tokens per task) plus the `refresh.py` that regenerates it from Artificial Analysis
- **Delegation tickets** — every dispatch is a self-contained 7-section ticket with a declared write set; parallel work requires provably disjoint write sets
- **Blind verification** — a fresh-context verifier gets the original task verbatim, never the worker's narrative, and assumes the work is broken until proven otherwise
- **Durable state** — a ledger file survives compaction and restarts; escalation and retries follow one precedence table
- Ships three subagent definitions (`orchestra-scout` / `orchestra-worker` / `orchestra-verifier`) which the installer places in `~/.claude/agents/`

### morning / evening

Bookends for the workday.

- **morning** plans the day forward: aggregates yesterday's Claude Code conversations, Codex sessions, git history, and memory files into a plan with checkboxes, time estimates, and sequencing. Repo mode (deep single-project) or global mode (cross-project). Flexible ranges — yesterday, 3 days, week.
- **evening** proves the day backward: today's sessions, commits, and issue-tracker activity as an honest accomplishment log. Built for the "I did nothing today" feeling — it shows the receipts.

### scan

Question-driven search over your Claude Code history. Where morning builds a fixed daily plan, scan answers a specific question: "find where I said X", "what did I do in project Y this week", "recap that migration". Searches full message bodies (keyword/regex), lists sessions as an index, or dumps per-session digests, then reasons over the result. Subagent transcripts count as part of their parent session, so delegated work is searchable too.

Install [cc-browse](https://github.com/thatmike1/cc-browse) and search gets an accelerator for free: it keeps the same logs in a SQLite index, which drops a corpus-wide search from ~20s to ~0.3s and adds semantic search (`--mode semantic|both`). Entirely optional — without it everything falls back to the pure-Node scan.

### peek / jarvis

Every Claude Code session writes its transcript to disk as it goes, and reading that file is invisible to the session that owns it. **peek** is the tool: `peek live` lists the sessions running right now (project, quiet-for, session id, last exchange), `peek <id> --last 6` reads one, and every render ends with a `--since N` cursor so you can follow a session incrementally. Peek before you `SendMessage` another session and you skip the ask-then-instruct round trip; run a coach session that peeks a driver session and the driver's transcript stays clean.

**jarvis** is the skill built on it: the session you talk to *about* the others. "I have six open and an hour left, where do I start", "what is this session on about", "tell session X to do Y", "launch a background job on Z". It answers with a pick and a reason rather than a list to re-triage. `live` is Linux-only (it reads `/proc`).

### goblin

Thought structuring inspired by [goblin.tools](https://goblin.tools). Four modes:

- **compile** — braindump in, structured tasks out (no limbo items)
- **decompose** — break overwhelming tasks into steps (spiciness dial 1-4)
- **estimate** — realistic time estimates with ADHD-aware multipliers
- **decide** — break analysis paralysis with a recommendation (always picks a side)

### live-prompt / afk-prompt

Both write a copy-paste prompt that hands a task (usually an issue-tracker ticket) to a fresh Claude instance. The difference is who's watching:

- **live-prompt** — you'll be there. Collaborative (discuss approach first) or off-the-leash (implement end-to-end) mode. Short prompt: point at the ticket, don't re-explain it.
- **afk-prompt** — nobody's there. Picks which tasks are safe to run unattended and writes an explicit, no-questions prompt for one or more of them.

### cc-audit

Analyzes your Claude Code setup and usage patterns — wrong launch directories, context bloat, orphaned memories, missing CLAUDE.md files — and produces a severity-ranked report with actionable fixes.

### design-styles

Six frontend skills merged into one with internal routing. A thin SKILL.md does a "design read" of the brief, then loads only what the branch needs:

- **Style packs** — high-end agency, editorial minimalist, industrial brutalist (one per project, pack rules win)
- **landing-craft** — anti-slop methodology for landing pages/portfolios: dials, layout hard rules, AI-tell bans, mechanical pre-flight (distilled from [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill))
- **redesign** — audit-first upgrades of existing sites without breaking them
- **ux + review** — functional UX baseline and a capped, scannable review format (verdict first, `location — problem → fix` one-liners, max 3 P0 / 5 P1 / 5 P2)

Built as the ungated sibling of heavyweight design skills that require per-project setup.

### find-out

A research orchestrator for open-ended questions where *choosing the research surface* is part of the work — current web, external docs, your own conversation history, authenticated sources. It picks surfaces, fans the question out across them, and reconciles what comes back rather than trusting one source. Search and page reads route through the token-cheap `oc` CLI by default, falling back to `WebSearch` when a query needs domain filtering.

Deliberately narrow: ordinary codebase, issue-tracker or history lookups with a known local source should use the local tool directly, even when you say "find out" or "dig into".

## Install

Requires Node.js 22+ (the installer is an [ink](https://github.com/vadimdemedes/ink) app; skill scripts themselves stay zero-dep — readout is the other exception, it needs npm deps for the MDX compile).

```bash
git clone https://github.com/thatmike1/claude-skills.git
cd claude-skills
node install.mjs
```

First run installs the installer's npm dependencies automatically. The installer will:
1. Auto-discover available skills (anything with a `SKILL.md`) and let you pick with checkboxes
2. Ask whether to **symlink** (edits here update the skill) or **copy** (standalone — also copies the `shared/` parser helpers)
3. Run setup for skills that need configuration (e.g. morning asks for git author and repo directory)
4. Install to `~/.claude/skills/`

### Manual install

Symlink or copy any skill directory to `~/.claude/skills/`:

```bash
# symlink (recommended if you cloned the repo)
ln -s /path/to/claude-skills/morning ~/.claude/skills/morning

# or copy
cp -r /path/to/claude-skills/goblin ~/.claude/skills/goblin
```

For skills that need config, copy the example and fill it in:

```bash
cp morning/config.json.example morning/config.json
# edit morning/config.json with your git email, repo dir, etc.
```

## Usage

After installing, restart Claude Code. Skills are available as slash commands:

```
/readout              # publish session work as a shareable web page
/readout comments     # read back anchored comments from teammates

/morning              # repo-specific briefing for yesterday
/morning global week  # cross-project, last 7 days
/evening              # what actually got done today

/scan                 # answer a question about past conversations

/goblin               # auto-detects mode from your input
/goblin decompose     # force a specific mode

/live-prompt <id>     # handoff prompt for an attended session
/afk-prompt           # handoff prompt(s) for an unattended run

/cc-audit             # audit your Claude Code setup

/find-out             # multi-source research on an open question

/invoice-subjects     # invoice subjects for a given month
/ai-cv-scanner        # mine history for AI experience answers
```

## Skill anatomy

Every skill follows the same convention:

```
<skill>/
  SKILL.md               # instructions + YAML frontmatter (<100 lines, detail lives in references/)
  plugin.json            # optional package metadata
  config.json.example    # template for user-specific config (config.json is gitignored)
  references/            # detailed docs split by topic/mode
  scripts/               # node.js utilities for deterministic work (zero npm deps)
```

Shared conversation parsers (Claude Code + Codex JSONL discovery) live in `shared/` and are used by morning, evening, scan, peek, cc-audit, and ai-cv-scanner. They enumerate sessions by listing `~/.claude/projects` directly and pick up each session's subagent transcripts along with it.
