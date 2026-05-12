# ai-cv-scanner refactor: port to Node.js + shared parsers

## Context

The `ai-cv-scanner` skill mines Claude Code conversation history to answer user-provided questions about their AI experience. It currently uses:

1. **Two Python scripts** (`scripts/build-index.py` and `scripts/scan-setup.py`) for data gathering
2. **Subagents that read raw JSONL files** at runtime, burning context tokens on noise (tool calls, thinking blocks, attachments, system tags)

The `morning` skill already has battle-tested Node.js parsers that extract clean signal from CC and Codex session JSONL files. The ai-cv-scanner should reuse these instead of its own approach.

## What to do

### 1. Port `build-index.py` → `build-index.mjs`

Rewrite `ai-cv-scanner/scripts/build-index.py` as `ai-cv-scanner/scripts/build-index.mjs` (Node.js ESM, zero npm deps).

The script builds a lightweight index of all CC sessions. Current approach:
- Reads `~/.claude/projects/*/sessions-index.json` for summaries + first prompts
- Falls back to reading first user message from JSONL if no index exists
- Outputs JSON array sorted by date

Keep the same logic but in Node. Key things to preserve:
- The `sessions-index.json` primary path (this is actually a useful optimization morning doesn't have)
- The JSONL fallback for projects without an index
- The project name decoding (`-home-username-git-` → readable name) — the Python version already uses dynamic username detection via `Path.home().name`, do the same with `os.homedir()`
- Stats output to stderr
- JSON output to stdout

### 2. Port `scan-setup.py` → `scan-setup.mjs`

Rewrite `ai-cv-scanner/scripts/scan-setup.py` as `ai-cv-scanner/scripts/scan-setup.mjs`.

This script scans `~/.claude/` for evidence of advanced AI usage:
- Installed skills (list names from `~/.claude/skills/`)
- MCP server configs (from settings.json files)
- Hooks
- CLAUDE.md files (global, project-level, repo-level)
- `history.jsonl` stats (total prompts, unique projects, date range)

Same logic in Node. No JSONL conversation parsing here, just filesystem scanning.

### 3. Add a pre-parse step using morning's parsers

The biggest improvement: instead of making subagents read raw JSONL at runtime, pre-parse relevant sessions into clean text.

Create `ai-cv-scanner/scripts/extract-evidence.mjs` that:
- Takes the session index (from build-index.mjs output) as input
- For each session, calls the parsing logic from `morning/scripts/parse-cc-sessions.mjs` to extract user messages + assistant text (filtered, truncated)
- Outputs pre-parsed session data that subagents can consume directly

**Important**: Don't copy-paste the parsing code. Import or require the functions from the morning parser. Both skills live in the same repo, so relative imports work:
```js
// something like:
import { parseSessionFile, findSessionFile } from '../../morning/scripts/parse-cc-sessions.mjs';
```

This means `parse-cc-sessions.mjs` needs its core functions exported (they're currently just internal). Add named exports for `parseSessionFile`, `findSessionFile`, and `discoverSessions` without breaking the existing CLI behavior (the `main()` function should still run when invoked directly).

### 4. Update SKILL.md

Update the Phase 1 instructions to use the new `.mjs` scripts instead of Python:
```bash
node <skill-dir>/scripts/build-index.mjs > /tmp/cc-session-index.json
node <skill-dir>/scripts/scan-setup.mjs > /tmp/cc-setup-scan.json
node <skill-dir>/scripts/extract-evidence.mjs < /tmp/cc-session-index.json > /tmp/cc-evidence.json
```

Update Phase 2 to tell subagents they receive pre-parsed evidence instead of needing to open raw JSONL files. Remove all the JSONL parsing instructions from the subagent briefings — they should get clean text, not raw data.

### 5. Delete old Python scripts

Remove `scripts/build-index.py` and `scripts/scan-setup.py` after the Node ports are verified.

## Constraints

- Zero npm dependencies — only Node.js built-in modules (`fs`, `path`, `os`, `readline`, `child_process`)
- ESM format (`.mjs` files) — consistent with morning skill
- Keep the existing output formats (JSON to stdout) so the SKILL.md changes are minimal
- Don't break morning's parsers — only add exports, don't restructure
- Test the scripts against real data in `~/.claude/` before considering done

## Files to modify

- `morning/scripts/parse-cc-sessions.mjs` — add named exports for core functions
- `ai-cv-scanner/scripts/build-index.mjs` — new file (port from .py)
- `ai-cv-scanner/scripts/scan-setup.mjs` — new file (port from .py)
- `ai-cv-scanner/scripts/extract-evidence.mjs` — new file (pre-parser using morning's functions)
- `ai-cv-scanner/SKILL.md` — update script paths and subagent instructions
- `ai-cv-scanner/scripts/build-index.py` — delete
- `ai-cv-scanner/scripts/scan-setup.py` — delete
