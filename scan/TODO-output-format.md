# scan output format improvement

Current scan.mjs dumps all sessions into one massive text file. At 100 sessions / ~256KB, this is unusable for targeted lookups — the consumer (Claude) either bloats context reading it all or has to spawn subagents just to search.

## Problem

- Single flat file, no structure beyond markdown headers
- No machine-readable metadata (date, project, branch, model) — everything is inline prose
- Truncates at ~25 sessions worth of content, silently dropping the rest
- No way to grep for a specific session or filter by project without reading everything

## Proposed changes

- **One file per session** (or chunked by project) instead of one monolith
- **Frontmatter per session** with date, project, branch, model (if detectable) so consumers can filter/grep without loading content
- **Index file** listing all sessions with their metadata, so the consumer can decide which ones to read in full
- Consider JSONL as an alternative to markdown for machine consumption
