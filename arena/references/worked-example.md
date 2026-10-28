# Worked example: deriving the installer's shared/ consumers

The first real arena run, 28 Oct 2026, on this repo. Small on purpose: one file, a computable right answer, and enough room for the candidates to differ.

## Frame

**Artifact.** A diff to `src/lib/skills.js`. `SHARED_CONSUMERS` was a hardcoded list of skills whose scripts import `../../shared/`; the installer copies `shared/` alongside a copy install only for those. It had gone stale: `evening`, `jarvis` and `warden` were missing, and a copy-installed `evening` died with `ERR_MODULE_NOT_FOUND`.

**Ground truth**, computed before spawning:

```bash
grep -rlE "(from|import\()\s*['\"](\.\./)+shared/" --include="*.mjs" --exclude-dir=node_modules . \
  | grep -v "^shared/" | awk -F/ '{print ($1=="deprecated")?$2:$1}' | sort -u
# ai-cv-scanner cc-audit evening jarvis morning peek scan warden
```

**Rubric** (`rubric.md`, never shown to candidates):

1. Correct today: `needsShared` true for exactly the ground-truth skills.
2. Can't go stale: no list left; a new importer is picked up with zero edits.
3. Precise: a static or dynamic import counts; a comment that names the path does not.
4. Bounded: skips `node_modules` and dot dirs, no symlink loops, no noticeable slowdown.
5. Fits: house style, sync fs, no new deps, one helper at most.

Criteria 3 and 4 got a fixture repo, a skill each: `a` (static import), `b` (path in a comment), `c` (dynamic `import()`), `d` (import inside `node_modules/`), `e` (import inside `.cache/`). Right answer: `a c`.

**Contract.** One paragraph naming the file and the stale list, "derived from the skill's files on disk", Node built-ins only, house style, a verify snippet, do not commit. Return shape: `pwd`, full `git diff`, the verify command with its output, and three to five sentences on rejected alternatives.

**Seats.** Three `claude-haiku-5-5` at medium, `isolation: "worktree"`: generation-bound work, so one model three times.

## Score

| | c1 | c2 | c3 |
|---|---|---|---|
| 1 correct today | pass | pass | pass |
| 2 can't go stale | pass | pass | pass |
| 3 precise (fixture `a c`) | `a`: misses dynamic | `a b c`: comment counts | `a c`: pass |
| 4 bounded | walks `node_modules`, dot dirs | pass | walks `node_modules`, dot dirs |
| 5 fits | no JSDoc | pass | pass |

Every candidate cost about 4 ms on top of the 16 ms discovery baseline.

**Judge.** None this run: the proof was capped at three children, so the cross-judge seat was not exercised and the pick is the lead's alone.

## Pick, graft, reject

- **Base: c2.** Bounded walk, the regex as a named constant with a comment, JSDoc on the helper. Its one failure was precision.
- **Graft from c3:** anchor the match on `from` / `import(`. Merged by hand with c2's relative-path form into `/\b(?:from|import)\s*\(?\s*["'](?:\.\.?\/)+shared\//`, which drops c3's `[^"']*shared/` (that would also match `./unshared/` or a package path).
- **c1 rejected:** static `from` only, and its walk enters `node_modules`; c3's anchor already covers what it got right.

## Verify

Fixture repo `a c`, real repo matches the ground truth, `pnpm test` 93/93, and a copy install of `evening` now carries `shared/` and runs.

## What the run taught

Two of three candidates reported that the change was "already in the worktree, written by someone else". Their own transcripts showed their first `Edit` calls failing with "string not found" against a file that had already changed. Our best guess, unconfirmed: a retried model request whose first tool calls had already landed. Either way the diff on disk was sound. Grade `git -C <worktree> diff` and run the checks yourself. Read a candidate's account of its own work as a claim, not as the result.
