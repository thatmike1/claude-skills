# claude-skills

```
 ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗      ███████╗██╗  ██╗██╗██╗     ██╗     ███████╗
██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝      ██╔════╝██║ ██╔╝██║██║     ██║     ██╔════╝
██║     ██║     ███████║██║   ██║██║  ██║█████╗  █████╗███████╗█████╔╝ ██║██║     ██║     ███████╗
██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝  ╚════╝╚════██║██╔═██╗ ██║██║     ██║     ╚════██║
╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗      ███████║██║  ██╗██║███████╗███████╗███████║
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝      ╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚══════╝
```

> **The installer is being rewritten as a React app. In the terminal. Using [ink](https://github.com/vadimdemedes/ink). Because we can.**
>
> Web. Mobile. Desktop. **Terminal.** The React world domination arc is nearly complete.

A collection of custom skills for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Each skill is a self-contained directory that can be installed independently.

## Skills

### morning

Daily briefing that aggregates yesterday's work context from Claude Code conversations, Codex CLI sessions, git history, and memory files into an actionable morning plan with checkboxes, time estimates, and sequencing.

- Two modes: **repo** (deep single-project) and **global** (cross-project overview)
- Flexible date ranges: yesterday (auto-detects Friday on Mondays), 3 days, week
- Parses CC JSONL + Codex JSONL conversation history, filters noise, extracts signal
- Tags repos as work/personal based on remote URL patterns
- Output inspired by the goblin skill's compile+estimate format

### goblin

Neurodivergent thought structuring tool inspired by [goblin.tools](https://goblin.tools). Four modes:

- **compile** — braindump in, structured tasks out (no limbo items)
- **decompose** — break overwhelming tasks into steps (spiciness dial 1-4)
- **estimate** — realistic time estimates with ADHD-aware multipliers
- **decide** — break analysis paralysis with a recommendation (always picks a side)

### capacities

Integration with [Capacities.io](https://capacities.io) PKM system. Save to daily notes, save weblinks, search/lookup content. Write-only (Capacities API doesn't support reading content yet).

### invoice-subjects

Generate monthly invoice subjects and newsletter blurb from git commit history across repos. Currently Czech-language specific — see `invoice-subjects/TODO.md` for generalization plans.

## Install

### ai-cv-scanner

Mine your full Claude Code and Codex conversation history to answer questions about your AI experience. Bring your own questionnaire or get a general AI experience summary. Pre-parses clean evidence before spawning parallel subagents to extract concrete examples (projects, tools, impact).

### engagement styles (panels / detective / punchy)

A small wardrobe of response-formatting styles that keep work output engaging to read — built for ADHD attention, where any single fixed style goes stale. Rotate between them when one stops registering; the switch itself restores the novelty. Each preserves full technical accuracy and keeps code/commits clean — the style governs prose only. Stays active every response until you say "normal mode" or switch styles (same mechanism as caveman).

- **panels** — comic-book layout: bold mini-headers, short chunks, `[BLOCKER]/[RISK]/[FYI]` severity tags, Spine outline for long pieces. Best for code reviews, implementation plans, long output.
- **detective** — debugging as a case log: titled episodes moving clue → hypothesis → ruled-out → culprit → fix, over real diagnosis discipline. Best for bugs and investigations.
- **punchy** — hot-take-first, rhythm-switching, filler cut, minimal. Best for everyday quick work.

These are skills rather than [output styles](https://code.claude.com/docs/en/output-styles) on purpose: skills hot-swap instantly mid-session (output styles only load at session start), and they're purely additive so they never strip Claude Code's built-in coding behavior.

## Install

Requires Node.js 18+.

```bash
git clone https://github.com/thatmike1/claude-skills.git
cd claude-skills
node install.mjs
```

The installer will:
1. Show available skills and let you pick which to install
2. Ask whether to **symlink** (edits here update the skill) or **copy** (standalone)
3. Run setup for skills that need configuration (morning asks for git author, repo directory; capacities asks for API token)
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
/morning              # repo-specific briefing for yesterday
/morning global       # cross-project briefing
/morning global week  # cross-project, last 7 days

/goblin               # auto-detects mode from your input
/goblin compile       # force compile mode
/goblin estimate      # force estimate mode

/capacities           # triggered by mentioning daily note, PKM, etc.

/invoice-subjects     # generate invoice subjects for a given month

/ai-cv-scanner        # mine history to answer AI experience questions

/panels               # comic-book layout for reviews/plans/long output
/detective            # debugging as a case log
/punchy               # hot-take-first, minimal — everyday work
```

## Structure

```
claude-skills/
  install.mjs              # interactive CLI installer
  morning/
    SKILL.md               # skill definition (<100 lines)
    plugin.json
    config.json.example    # template for user config
    references/            # detailed mode docs + output format
    scripts/               # node.js parsers (zero npm deps)
  shared/
    cc-parser.mjs          # shared Claude Code discovery + parsing
    codex-parser.mjs       # shared Codex discovery + parsing
  goblin/
    SKILL.md
    plugin.json
    references/            # one file per mode (compile, decompose, estimate, decide)
  capacities/
    SKILL.md
    plugin.json
    references/            # auth template
  invoice-subjects/
    SKILL.md
    EXAMPLES.md            # past output for style reference
    config.json.example
  ai-cv-scanner/
    SKILL.md
    QUESTIONNAIRE.md       # example questionnaire template
    scripts/               # node.js evidence indexing scripts
```
