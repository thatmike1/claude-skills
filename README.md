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
| ⭐ [readout](#readout) | Publish session work as a shareable, commentable web page — artifact v2 |
| [artifact](#artifact) | Local HTML session documents (readout's predecessor) |
| **Daily rhythm** | |
| [morning](#morning--evening) | Daily briefing: yesterday's context → today's actionable plan |
| [evening](#morning--evening) | End-of-day receipts: what actually got done today |
| [scan](#scan) | Ask any question about your past Claude Code conversations |
| **Thinking** | |
| [goblin](#goblin) | Neurodivergent thought structuring: compile, decompose, estimate, decide |
| **Handoffs** | |
| [live-prompt](#live-prompt--afk-prompt) | Prompt for a fresh instance you'll actively steer |
| [afk-prompt](#live-prompt--afk-prompt) | Prompt for an unattended run while you're away |
| **Meta** | |
| [cc-audit](#cc-audit) | Audit your Claude Code setup, flag anti-patterns with ranked fixes |
| [panels / detective / punchy](#engagement-styles) | Rotating response styles that keep output readable |
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

### morning / evening

Bookends for the workday.

- **morning** plans the day forward: aggregates yesterday's Claude Code conversations, Codex sessions, git history, and memory files into a plan with checkboxes, time estimates, and sequencing. Repo mode (deep single-project) or global mode (cross-project). Flexible ranges — yesterday, 3 days, week.
- **evening** proves the day backward: today's sessions, commits, and issue-tracker activity as an honest accomplishment log. Built for the "I did nothing today" feeling — it shows the receipts.

### scan

Question-driven search over your Claude Code history. Where morning builds a fixed daily plan, scan answers a specific question: "find where I said X", "what did I do in project Y this week", "recap that migration". Searches full message bodies (keyword/regex), lists sessions as an index, or dumps per-session digests, then reasons over the result.

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

### artifact

Readout's predecessor, still useful when you want a local file instead of a published page. Generates a polished single-page HTML document (typography-led, mermaid diagrams, syntax highlighting, version-history footer) into an external artifacts directory. Living document: re-running updates it in place.

### engagement styles

A small wardrobe of response-formatting styles (**panels**, **detective**, **punchy**) that keep work output engaging to read — built for ADHD attention, where any single fixed style goes stale. Rotate when one stops registering. Each preserves full technical accuracy; the style governs prose only, code and commits stay clean.

- **panels** — comic-book layout: bold mini-headers, short chunks, `[BLOCKER]/[RISK]/[FYI]` tags. Best for reviews, plans, long output.
- **detective** — debugging as a case log: clue → hypothesis → ruled-out → culprit → fix. Best for bugs and investigations.
- **punchy** — hot-take-first, rhythm-switching, filler cut. Best for everyday quick work.

These are skills rather than [output styles](https://code.claude.com/docs/en/output-styles) on purpose: skills hot-swap instantly mid-session, and they're purely additive so they never strip Claude Code's built-in coding behavior.

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

/panels               # comic-book layout for reviews/plans/long output
/detective            # debugging as a case log
/punchy               # hot-take-first, minimal — everyday work

/artifact             # local HTML session artifact
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

Shared conversation parsers (Claude Code + Codex JSONL discovery) live in `shared/` and are used by morning, evening, scan, and ai-cv-scanner.
