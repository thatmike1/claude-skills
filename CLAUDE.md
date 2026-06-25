# claude-skills

A collection of custom skills for Claude Code and compatible agent harnesses.

## Repo Structure

```
install.mjs              — installer entry: env guards, npm self-bootstrap, loads src/app.jsx via tsx
src/                      — installer ink (React terminal) app: components/ (UI screens), lib/ (discovery, install, setup writers)
morning/                  — daily briefing skill (CC + Codex session parsing)
evening/                  — end-of-day receipts: what actually got done today (reuses morning's gather script)
goblin/                   — neurodivergent thought structuring (compile/decompose/estimate/decide)
invoice-subjects/         — invoice subject + newsletter generator from git history
ai-cv-scanner/            — mine conversation history for AI experience evidence
cc-audit/                 — audit CC setup and usage patterns, flag anti-patterns
live-prompt/              — write handoff prompts for attended fresh-instance sessions (collaborative / off-the-leash)
afk-prompt/               — write autonomous-run prompts + pick tasks safe to run unattended
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
node shared/cc-parser.mjs --from 2026-05-11 --to 2026-05-12
node shared/codex-parser.mjs --from 2026-05-11 --to 2026-05-12
node ai-cv-scanner/scripts/build-index.mjs
node ai-cv-scanner/scripts/scan-setup.mjs
node ai-cv-scanner/scripts/build-index.mjs | node ai-cv-scanner/scripts/extract-evidence.mjs
```
