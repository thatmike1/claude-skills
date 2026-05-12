# Shared parsing infrastructure + ai-cv-scanner refactor

## The big picture

Two skills in this repo parse Claude Code conversation history independently:

- **morning** — has solid Node.js JSONL parsers for both CC and Codex, extracts clean signal (user messages, assistant text, AI titles), filters noise. Uses `~/.claude/history.jsonl` for session discovery.
- **ai-cv-scanner** — has Python scripts for session indexing, then makes subagents read raw JSONL at runtime (wasteful, burns context tokens on noise). Uses `~/.claude/projects/*/sessions-index.json` for discovery, which actually has *richer* metadata (summaries, first prompts) than history.jsonl.

Neither skill knows about the other's strengths. This refactor creates a shared parsing layer that both skills use, combines the best discovery approach from each, and ports ai-cv-scanner from Python to Node.

## Step 1: Create `shared/` module

Create `shared/cc-parser.mjs` — the single source of truth for CC conversation parsing. Extract and consolidate from both skills:

### From morning's `parse-cc-sessions.mjs`:
- `parseSessionFile(filePath)` — extracts AI title, git branch, user messages (filtered), assistant text blocks from a session JSONL
- `findSessionFile(sessionId)` — locates the JSONL file across `~/.claude/projects/*/`
- Noise filtering: skips `<local-command-caveat>`, `<command-name>`, `<command-message>`, `<local-command-stdout>` tags in user messages
- Signal extraction: `type: "user"` where `message.content` is string (not tool result array), `type: "assistant"` where `content[].type === "text"`
- Truncation: configurable max length per message

### From ai-cv-scanner's `build-index.py`:
- `discoverSessionsFromIndex()` — reads `~/.claude/projects/*/sessions-index.json` for summaries + first prompts. This is a *better* discovery mechanism than history.jsonl because it has pre-generated summaries. Keep it.
- `decodeProjectName(dirname)` — converts `-home-username-git-projectname` back to readable form. Use dynamic username via `os.homedir()`.

### From morning's `parse-cc-sessions.mjs` (keep as alternative):
- `discoverSessionsFromHistory(fromMs, toMs, projectFilter)` — reads `~/.claude/history.jsonl`, filters by timestamp + project. Essential for date-range queries that `sessions-index.json` can't do (it has no timestamps, only file mtimes).

### Combined discovery API:
```js
/**
 * discovers sessions, merging data from both sources.
 * sessions-index.json provides summaries; history.jsonl provides timestamps.
 * returns: [{ sessionId, project, summary, firstPrompt, timestamp, filePath }]
 */
export async function discoverSessions(opts = {}) {
  // opts.from, opts.to — date range filter (optional)
  // opts.project — project path filter (optional)
  // If date range given: use history.jsonl for filtering, enrich with sessions-index.json summaries
  // If no date range: use sessions-index.json as primary source
}
```

### Also create `shared/codex-parser.mjs`:
Extract from morning's `parse-codex-sessions.mjs`:
- `discoverCodexSessions(fromDate, toDate, projectFilter)` — date-dir scanning
- `parseCodexSession(filePath, sessionIndex)` — extracts user messages, agent messages, rollout summaries
- Noise filtering for Codex: skips `<skill>`, `<turn_aborted>`, `<command-message>`, `<image>`, system/environment injections

Both shared modules should:
- Export named functions for programmatic use
- Work standalone as CLI when invoked directly (`node shared/cc-parser.mjs --from X --to Y`)
- Use the same output format (structured objects that callers can format as markdown or JSON)

## Step 2: Port ai-cv-scanner scripts to Node

### `ai-cv-scanner/scripts/build-index.mjs`
Port from `build-index.py`. But now it's thin — just calls `discoverSessions()` from `shared/cc-parser.mjs` (no date filter) and outputs JSON to stdout. The heavy lifting is in the shared module.

### `ai-cv-scanner/scripts/scan-setup.mjs`
Port from `scan-setup.py`. This one stays self-contained — it scans `~/.claude/` for config evidence (skills, MCP servers, hooks, CLAUDE.md files, history.jsonl stats). No JSONL parsing, just filesystem scanning.

Current Python script checks for:
- Installed skills in `~/.claude/skills/`
- MCP server configs in settings.json files (global + project-level)
- Hooks configuration
- CLAUDE.md files (global `~/.claude/CLAUDE.md`, per-project `~/.claude/projects/*/CLAUDE.md`, repo-level)
- `history.jsonl` stats: total prompts, unique projects, earliest/latest timestamps

Preserve all of this in Node.

### `ai-cv-scanner/scripts/extract-evidence.mjs` (new)
The key improvement. This script:
1. Reads the session index from stdin (piped from build-index.mjs)
2. For each session, uses `parseSessionFile()` from `shared/cc-parser.mjs` to extract clean text
3. Also scans Codex sessions via `shared/codex-parser.mjs` (the current scanner misses Codex entirely!)
4. Outputs pre-parsed evidence as JSON — each session becomes `{ sessionId, project, summary, userMessages: [...], assistantTexts: [...] }`
5. Subagents receive this clean data instead of parsing raw JSONL themselves

This is where the biggest token savings come from: subagents get signal, not noise.

## Step 3: Rewire morning to use shared modules

Update morning's scripts to import from `shared/` instead of having their own parsing logic:

### `morning/scripts/parse-cc-sessions.mjs`
Replace the inline parsing functions with imports from `shared/cc-parser.mjs`. Keep the markdown output formatting here (that's morning-specific). The script becomes:
```js
import { discoverSessions, parseSessionFile } from '../../shared/cc-parser.mjs';
// ... morning-specific markdown formatting + CLI arg parsing stays here
```

### `morning/scripts/parse-codex-sessions.mjs`
Same pattern — import from `shared/codex-parser.mjs`, keep markdown formatting local.

### `morning/scripts/gather-context.mjs`
No changes needed — it already calls the other scripts via `execFileSync`. As long as the script interfaces don't change, this keeps working.

## Step 4: Update ai-cv-scanner SKILL.md

Replace Phase 1 with:
```bash
node <skill-dir>/scripts/build-index.mjs > /tmp/cc-session-index.json
node <skill-dir>/scripts/scan-setup.mjs > /tmp/cc-setup-scan.json
node <skill-dir>/scripts/extract-evidence.mjs < /tmp/cc-session-index.json > /tmp/cc-evidence.json
```

Rewrite Phase 2 subagent instructions — remove all JSONL parsing guidance. Subagents now receive:
- `/tmp/cc-evidence.json` — pre-parsed conversations (clean user + assistant text per session)
- `/tmp/cc-setup-scan.json` — config evidence
- `/tmp/cc-session-index.json` — session index for keyword scanning

Tell subagents: "Search the evidence JSON for relevant sessions by keyword matching on the user/assistant text fields. Do NOT open raw JSONL files — everything you need is already extracted."

## Step 5: Cleanup

- Delete `ai-cv-scanner/scripts/build-index.py`
- Delete `ai-cv-scanner/scripts/scan-setup.py`
- Update CLAUDE.md testing section with new script paths
- Update README.md if needed

## Constraints

- Zero npm dependencies — only Node.js built-in modules (`fs`, `path`, `os`, `readline`, `child_process`)
- ESM format (`.mjs`) everywhere
- Shared modules must work both as imports AND as standalone CLI scripts
- Don't break morning's existing behavior — same CLI args, same output format
- Don't break the installer
- Test all scripts against real data in `~/.claude/` and `~/.codex/` before considering done
- Use kebab-case for filenames
- JSDoc comments on exported functions, lowercase first letter

## File map

### New files
```
shared/
  cc-parser.mjs          — CC session discovery + JSONL parsing (merged from both skills)
  codex-parser.mjs       — Codex session discovery + JSONL parsing (extracted from morning)
ai-cv-scanner/scripts/
  build-index.mjs        — thin wrapper around shared/cc-parser discoverSessions()
  scan-setup.mjs         — port from Python, scans ~/.claude/ config
  extract-evidence.mjs   — pre-parses sessions for subagents using shared parsers
```

### Modified files
```
morning/scripts/
  parse-cc-sessions.mjs    — replace inline parsing with shared/cc-parser imports
  parse-codex-sessions.mjs — replace inline parsing with shared/codex-parser imports
ai-cv-scanner/
  SKILL.md                 — update script paths, rewrite subagent instructions
CLAUDE.md                  — update testing section
```

### Deleted files
```
ai-cv-scanner/scripts/build-index.py
ai-cv-scanner/scripts/scan-setup.py
```

## Verification

After the refactor, all of these must work:

```bash
# shared modules standalone
node shared/cc-parser.mjs --from 2026-05-11 --to 2026-05-12
node shared/cc-parser.mjs --from 2026-05-11 --to 2026-05-12 --project /home/$USER/git/pracino
node shared/codex-parser.mjs --from 2026-05-11 --to 2026-05-12

# morning skill (unchanged behavior)
node morning/scripts/parse-cc-sessions.mjs --from 2026-05-11 --to 2026-05-12
node morning/scripts/parse-codex-sessions.mjs --from 2026-05-11 --to 2026-05-12
node morning/scripts/gather-context.mjs --mode global --range 1day

# ai-cv-scanner (new Node scripts)
node ai-cv-scanner/scripts/build-index.mjs | head -20
node ai-cv-scanner/scripts/scan-setup.mjs | head -20
node ai-cv-scanner/scripts/build-index.mjs | node ai-cv-scanner/scripts/extract-evidence.mjs | head -50
```
