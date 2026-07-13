---
name: readout
description: Generate, update, and publish a "readout" — an MDX-authored, themed session document (walkthrough, plan, comparison, investigation, changelog) compiled to HTML and published to readout.ssscribe.app, where teammates leave anchored comments the agent reads back into the session. Successor to the artifact skill, built for sharing. Use when the user asks to "make/create/publish a readout", wants session output as a shareable link, asks to update an existing readout, or asks to read/check comments on a readout.
---

# Readout

Turn session work into a shareable web page. You author **MDX with JSX components**
(never raw HTML), compile it to a themed static page, and publish it to a PocketBase
instance that serves the site, stores comments, and keeps version history — all on
one origin. Reviewers pin comments to any block; you read them back with a script.

## Paths & config

- Read `config.json` next to this SKILL.md: `root` (default `~/git/readouts`),
  `publicBaseUrl`, `pbUrl`, `pbToken`, `deployCmd`.
- Project name: `basename "$(git -C . rev-parse --show-toplevel 2>/dev/null || pwd)"`.
- Source: `<root>/<project>/<slug>.mdx` (slug = kebab-case of the title). Compiled HTML
  lands next to it; galleries and `_shared/` assets are managed by the scripts.
- Readouts are **external to the work repo** — never write them inside the project repo.

## Generate & publish

1. **Write the MDX** at `<root>/<project>/<slug>.mdx`. Copy the component usage from
   `<skill-dir>/assets/example.mdx` — it exercises every component and the frontmatter
   (`title` required; `|…|` inside the title becomes the accented `<em>`; plus `eyebrow`,
   `lead`, `version`, `date`). Available components: `Section` (auto-numbered), `KeyPoints`,
   `Callouts`/`Callout` (success|info|warning|danger), `Chips`/`Chip` (blocker|risk|fyi),
   `Code` / fenced blocks, `Diagram` (mermaid), `DataTable` (+`Mark`), `History`/`Entry`.
   For review/recap readouts: `Diff` (`patch` = one full-file git diff with headers, not
   a bare hunk — or `oldText`+`newText`; opt. `filename`/`split`) shows a change; `Diagram html={…}` swaps mermaid for rich HTML
   (helpers `diagram-panel`/`-lane`/`-layer`/`-arrow`/`-label`) for swimlanes and layers;
   `Checklist`/`Check done` for verification; `Timeline`/`Event` (`time`, `title`) for
   chronology; `StatTiles`/`Stat` (`label`, `value`, `delta?`, `trend?`=up|down|flat) for
   a KPI row; `FileTree` (`paths={[{path, status, note}]}`) for a touched-files map;
   `DocShelf`/`Doc` (`path` required, `title?`, `note?`; children = the doc's markdown)
   for embedding several full documents — file-tree sidebar, one doc visible at a time,
   h2 sections collapsible (first open), per-doc expand-all. Anchor per pane:
   `doc-<kebab-of-path>`.
   Plain markdown works everywhere. Never use emoji as icons.
2. **Publish:** `node <skill-dir>/scripts/publish.mjs <slug> --note "<what changed>"`.
   It compiles (fix your MDX if the compile step fails and re-run), refreshes `_shared`,
   rebuilds galleries, rsyncs to the server, and records the version in PocketBase
   (skipped with a warning when `pbToken` is empty). Compile alone:
   `node <skill-dir>/scripts/compile.mjs <file.mdx>`.
3. **Hand over the printed URL** — that link is the deliverable.

## Protected readouts (password)

To password-gate a readout (or when the frontmatter has `protected: true`), see
[references/protected.md](references/protected.md) — encryption model, publish flags,
encrypted comments, and trade-offs.

## Update (living document)

Re-runs edit the existing `.mdx` in place — same path, no new file. Bump `version` in
the frontmatter, prepend an `<Entry>` to `<History>`, and re-publish with a `--note`.
Comment anchors derive from section titles, so keep titles stable when revising or
existing comment threads detach.

## Comments (the feedback loop)

Reviewers hover a block on the published page and pin a comment (no login). Each routes
to an audience (**for the agent** — default — or **for a human**) and can reply to another.
Read them back:

```bash
node <skill-dir>/scripts/read-comments.mjs [<project>/<slug> | <slug>] \
  [--since <ISO>] [--new] [--all] [--consume] [--json]
```

Default output is unresolved comments only, threaded, each with its record id. `--new`
narrows to comments you haven't consumed yet; `--all` includes resolved ones. Writes need
`pbToken`: pass `--consume` to mark what you read as seen, and after addressing one mark it
resolved with `read-comments.mjs --resolve <id>[,<id>...]`.

## Visits (who viewed, when)

Every published page beacons one visit per tab-session into `readout_visits` (viewer =
the name the comment widget remembered, else "anonymous"). Reads need `pbToken`:

```bash
node <skill-dir>/scripts/read-visits.mjs [<project>/<slug> | <slug>] [--since <ISO>] [--days <n>] [--json]
```

No doc argument = summary across all docs. Bot user-agents are hidden by default
(`--bots` includes them). When the user asks "who viewed/opened my readout", run this.

Comments tagged `[for human]` are not yours to resolve — surface them to the user.
Anchors map to the document: `masthead`, `s-<section-slug>`, or `<section-slug>-<type>-<n>`
(type = callout|diagram|code|table|keypoints|diff|checklist|timeline|stattiles|filetree,
ordinal in the section). When the user asks "any comments?", run the script and act on
what it returns. No notification path — check when asked or before updating.

## Server

PocketBase on the Hetzner VPS (`readout-pb.service`, port 8091, `/opt/readout`) serves
`pb_public` at https://readout.ssscribe.app and hosts the two collections. One-time setup,
collection import, and the `pbToken` minting procedure live in `server/setup.md`. The
hetzner-vps skill documents the box itself.

## Notes

- Theme: one stylesheet, light+dark via `prefers-color-scheme` plus a masthead toggle.
- Every publish snapshots the full MDX in PocketBase (restore procedure:
  [references/protected.md](references/protected.md)).
- The compile pipeline has npm deps — run `npm install` in `<skill-dir>` once per machine.
- `artifact.js` (theming, highlight.js, tables), `comments.js`, and `visits.js` load on
  every page; comments and visits no-op when the file is opened from disk.
- The old artifact skill stays untouched for local-first, zero-dep documents.
