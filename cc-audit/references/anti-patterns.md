# Anti-Pattern Catalog

Each pattern has a detection signal (from the gathered data) and a fix. Map gathered data to these patterns during synthesis.

## Directory Issues

### system-directory-launch
**Severity:** CRITICAL
**Signal:** Sessions with project path matching system directories (C:\Windows\*, /usr/*, etc.)
**Impact:** No project context, CLAUDE.md files ignored, memories stored under a system path, Claude has no codebase awareness without explicit instructions each session.
**Fix:** Always `cd` into the project directory before launching Claude Code. On Windows, configure terminal to open in a project-friendly default (e.g. ~/projects or C:\Users\X\repos).

### home-root-launch
**Severity:** WARNING
**Signal:** Sessions with project path equal to the home directory root.
**Impact:** Same as system-directory but less severe — global CLAUDE.md still works, but project-level context is missing. Memories accumulate in one bucket.
**Fix:** `cd` into the specific project before launching. If working across multiple projects, use separate terminal tabs per project.

### scattered-project-dirs
**Severity:** SUGGESTION
**Signal:** Many unique project paths with 1-2 sessions each, suggesting inconsistent launch locations.
**Impact:** Fragmented memory and context. Claude treats each path as a separate project.
**Fix:** Standardize on one parent directory for repos (e.g. ~/git/ or ~/projects/). Always launch from the repo root, not a subdirectory.

## Context Management

### context-bloat
**Severity:** CRITICAL (if >5MB / 200+ msgs without compaction) or WARNING (if >1MB / 100+ msgs)
**Signal:** Large session files, high message counts, no compaction markers.
**Impact:** Output quality degrades significantly past ~200-300k tokens. The model loses track of earlier context, contradicts itself, and misses instructions. Worse on some models than others.
**Fix:** Start new conversations for new tasks. Use `/compact` when a session gets long. Aim for <100 messages per session for complex work.

### no-compaction
**Severity:** WARNING (if sessions regularly exceed 50 messages)
**Signal:** Low compaction rate (<10%) combined with high median message counts.
**Impact:** Unnecessarily large context windows. Compaction preserves key decisions while freeing context space.
**Fix:** Use `/compact` periodically in long sessions, or enable auto-compaction in settings.

## Memory Issues

### orphaned-memories
**Severity:** WARNING
**Signal:** Memory files stored under system or home-root project directories.
**Impact:** These memories are associated with the wrong project context. They won't be loaded when working in the actual project directory.
**Fix:** Move memory files to the correct project's memory directory under ~/.claude/projects/. Or recreate them in the right context.

### missing-memory-index
**Severity:** SUGGESTION
**Signal:** Memory directory has .md files but no MEMORY.md index.
**Impact:** Memories exist but may not be discovered or loaded properly.
**Fix:** Create a MEMORY.md index file with pointers to each memory file.

### memory-sprawl
**Severity:** SUGGESTION
**Signal:** Very high memory file count (>20) in a single project.
**Impact:** Too many memories can bloat the system prompt. Consider consolidating related memories.
**Fix:** Review and merge related memories. Remove outdated ones.

## Configuration

### missing-project-claude-md
**Severity:** WARNING (for active repos)
**Signal:** Repos with CC session activity but no CLAUDE.md file.
**Impact:** Claude starts each session with no project context — coding conventions, architecture decisions, key patterns all need to be re-explained.
**Fix:** Create a CLAUDE.md in the repo root with project-specific instructions, conventions, and context.

### claude-md-bypass
**Severity:** CRITICAL
**Signal:** CLAUDE.md files exist in repos, but sessions are launched from non-project directories.
**Impact:** The CLAUDE.md files exist but are never loaded. All the effort put into writing them is wasted.
**Fix:** Launch Claude Code from the project directory where the CLAUDE.md lives.

### missing-global-claude-md
**Severity:** SUGGESTION
**Signal:** No ~/.claude/CLAUDE.md file.
**Impact:** No cross-project preferences or instructions. Each project starts from scratch on personal conventions.
**Fix:** Create ~/.claude/CLAUDE.md with personal coding preferences, commit style, response format preferences, etc.

### no-skills-installed
**Severity:** SUGGESTION
**Signal:** Empty or missing ~/.claude/skills/ directory.
**Impact:** Missing out on reusable workflows. Not critical, but skills can significantly improve common tasks.
**Fix:** Explore available skills at the claude-skills repo or community resources.
