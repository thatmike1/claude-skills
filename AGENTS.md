# claude-skills

A collection of custom skills for Claude Code and compatible agent harnesses.

## Repo Structure

```
install.mjs              — interactive CLI installer (Node.js, zero deps)
morning/                  — daily briefing skill (CC + Codex session parsing)
goblin/                   — neurodivergent thought structuring (compile/decompose/estimate/decide)
capacities/               — Capacities.io PKM integration
invoice-subjects/         — invoice subject + newsletter generator from git history
ai-cv-scanner/            — mine conversation history for AI experience evidence
```

## Skill Format

Each skill follows the Claude Code skill convention:
- `SKILL.md` — main instructions with YAML frontmatter (`name`, `description`). Keep under 100 lines, delegate detail to references.
- `plugin.json` — optional package metadata
- `references/` — detailed docs split by topic/mode
- `scripts/` — utility scripts for deterministic operations (parsing, indexing)
- `config.json.example` — template for user-specific config (actual config.json is gitignored)

## Code Conventions

- Scripts are Node.js ESM (`.mjs`) with zero npm dependencies — only built-in modules
- Exception: `ai-cv-scanner` uses Python 3 scripts (legacy, should be ported to Node)
- Use kebab-case for all file and folder names
- JSDoc comments for functions, lowercase first letter
- No `any` types, no unnecessary abstractions

## Config Pattern

Skills that need user-specific values (API keys, git author, repo paths) use a `config.json` file:
- `config.json.example` is committed (template with placeholder values)
- `config.json` is gitignored (created by installer or manually)
- Scripts load config with defaults fallback so they don't crash without it

## Installer

`install.mjs` handles:
- Interactive skill selection
- Symlink vs copy install to `~/.claude/skills/`
- Per-skill setup prompts (morning: git author/repos, capacities: API token, invoice-subjects: repo list)
- Removing existing installs before re-installing

## Testing

Scripts can be tested directly:
```bash
node morning/scripts/parse-cc-sessions.mjs --from 2026-05-11 --to 2026-05-12
node morning/scripts/parse-codex-sessions.mjs --from 2026-05-11 --to 2026-05-12
node morning/scripts/gather-context.mjs --mode global --range 1day
python3 ai-cv-scanner/scripts/build-index.py
python3 ai-cv-scanner/scripts/scan-setup.py
```
