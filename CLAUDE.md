# claude-skills

A collection of custom skills for Claude Code and compatible agent harnesses.

## Repo Structure

```
install.mjs              — installer entry: env guards, npm self-bootstrap, loads src/app.jsx via tsx
src/                      — installer ink (React terminal) app: components/ (UI screens), lib/ (discovery, install, setup writers)
morning/                  — daily briefing skill (CC + Codex session parsing)
evening/                  — end-of-day receipts: what actually got done today (reuses morning's gather script)
goblin/                   — neurodivergent thought structuring (compile/decompose/estimate/decide)
wonder-pill/              — divergent ideation (assumption audit -> inverted what-ifs -> local html mind map); ported from ara-mkr/Wonder-Pill, MIT
invoice-subjects/         — invoice subject + newsletter generator from git history
ai-cv-scanner/            — mine conversation history for AI experience evidence
cc-audit/                 — audit CC setup and usage patterns, flag anti-patterns
live-prompt/              — write handoff prompts for attended fresh-instance sessions (collaborative / off-the-leash)
afk-prompt/               — write autonomous-run prompts + pick tasks safe to run unattended
peek/                     — read another running CC session's transcript from disk (live roster via /proc + session-env, incremental --since cursor)
jarvis/                   — ask one session about all the others; built on peek, launches --bg jobs
warden/                   — all-day accountability loop: plan interview, then /loop ticks over ActivityWatch + peek, desktop nudge on drift
readout/                  — MDX-authored session docs published to readout.ssscribe.app with anchored comments (has npm deps for the MDX compile, like the installer)
shared/                   — Claude Code + Codex JSONL discovery, parsing, search; imported by morning, evening, scan, peek, cc-audit, ai-cv-scanner
```

## Skill Format

Each skill follows the Claude Code skill convention:
- `SKILL.md` — main instructions with YAML frontmatter (`name`, `description`). Keep under 100 lines, delegate detail to references.
- `plugin.json` — optional package metadata
- `references/` — detailed docs split by topic/mode
- `scripts/` — utility scripts for deterministic operations (parsing, indexing)
- `config.json.example` — template for user-specific config (actual config.json is gitignored)

## Code Conventions

- Skill scripts are Node.js ESM (`.mjs`) with zero npm dependencies — only built-in modules (they get symlinked/copied to `~/.claude/skills/` without node_modules)
- The installer is the one exception: an ink (React terminal) app with npm deps, Node 22+
- Use kebab-case for all file and folder names
- JSDoc comments for functions, lowercase first letter
- No `any` types, no unnecessary abstractions

## Shared Parsers

- **Enumeration lists the directory.** `discoverSessionsFromDisk` walks `~/.claude/projects` itself; `sessions-index.json` is ignored because Claude Code stopped maintaining it — trusting it enumerated a months-old snapshot and hid ~1,000 sessions. Titles and first prompts are read out of the JSONL. `discoverSessionsFromIndex` survives only as a deprecated alias.
- **Subagent transcripts** under `<project>/<session>/subagents/` attach to their parent as `session.subagents` records (`agentId`, `name`, `description`, `agentType`, `model`, `spawnDepth`, `workflowId`, `filePath`), with metadata from the `<name>.meta.json` sidecar. Two things the data does not advertise: a subagent's JSONL records its *parent's* sessionId, so identity has to come from the file path; and nested spawns are written flat into the same directory, so no recursion is needed — `workflows/wf_*/` is the one nested case, walked exactly one level deep, and `journal.jsonl` is bookkeeping rather than a transcript.
- **cc-browse is an optional accelerator.** `shared/cc-browse-source.mjs` shells out to [cc-browse](https://github.com/thatmike1/cc-browse), a separate tool that indexes the same logs into SQLite; with it `cc-search` answers in ~0.3s instead of ~20s and gains `--mode semantic|both`. No cc-browse code is vendored and every call falls back to the pure-Node scan when it is absent. Resolution: `CCBROWSE_PY` → `ccbrowse.py` on PATH → `~/git/cc-browse/ccbrowse.py`; `CC_SKILLS_NO_CCBROWSE=1` disables it.

A Rust rewrite of the indexing was considered and deferred — the index is the win, not the language. Treat it as a decided question rather than unexplored ground.

## Config Pattern

Skills that need user-specific values (API keys, git author, repo paths) use a `config.json` file:
- `config.json.example` is committed (template with placeholder values)
- `config.json` is gitignored (created by installer or manually)
- Scripts load config with defaults fallback so they don't crash without it

## Installer

An ink (React terminal) app. `install.mjs` is a thin entry (Node 22+ guard, TTY guard, npm self-bootstrap, tsx JSX loading); the app lives in `src/`. It handles:
- Skill auto-discovery — scans repo dirs for `SKILL.md`, no hardcoded list (new skills appear automatically)
- Checkbox multi-select with installed markers, symlink vs copy install to `~/.claude/skills/`
- Per-skill setup forms driven by field definitions in `src/lib/setup-fields.js` (morning: git author/repos, invoice-subjects: repo list)
- Installing `shared/` alongside when a selected skill imports from it (copy mode would otherwise break `../../shared/*.mjs` imports)
- Removing existing installs before re-installing

## Testing

Scripts can be tested directly:
```bash
node morning/scripts/parse-cc-sessions.mjs --from 2026-05-11 --to 2026-05-12
node morning/scripts/parse-codex-sessions.mjs --from 2026-05-11 --to 2026-05-12
node morning/scripts/gather-context.mjs --mode global --range 1day
node peek/scripts/peek.mjs live
node shared/cc-parser.mjs --from 2026-05-11 --to 2026-05-12
node shared/cc-search.mjs "search term" --global --limit 5
node shared/cc-search.mjs "search term" --global --no-accelerate   # force the pure-Node scan
node shared/codex-parser.mjs --from 2026-05-11 --to 2026-05-12
node ai-cv-scanner/scripts/build-index.mjs
node ai-cv-scanner/scripts/scan-setup.mjs
node ai-cv-scanner/scripts/build-index.mjs | node ai-cv-scanner/scripts/extract-evidence.mjs
```
