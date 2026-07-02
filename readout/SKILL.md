---
name: readout
description: Generate, update, and publish a "readout" — an MDX-authored, themed session document (walkthrough, plan, comparison, investigation, changelog) compiled to HTML and published to readout.ssscribe.app, where teammates leave anchored comments the agent reads back into the session. Successor to the artifact skill, built for sharing. Use when the user asks to "make/create/publish a readout", wants session output as a shareable link, asks to update an existing readout, asks to read/check comments on a readout, or asks to change the readout theme.
---

# Readout

Turn session work into a shareable web page. You author **MDX with JSX components**
(never raw HTML), compile it to a themed static page, and publish it to a PocketBase
instance that serves the site, stores comments, and keeps version history — all on
one origin. Reviewers pin comments to any block; you read them back with a script.

## Paths & config

- Read `config.json` next to this SKILL.md: `root` (default `~/git/readouts`), `theme`
  (default `dossier`), `publicBaseUrl`, `pbUrl`, `pbToken`, `deployCmd`.
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
   Plain markdown works everywhere. Never use emoji as icons.
2. **Publish:** `node <skill-dir>/scripts/publish.mjs <slug> --note "<what changed>"`.
   It compiles (fix your MDX if the compile step fails and re-run), refreshes `_shared`,
   rebuilds galleries, rsyncs to the server, and records the version in PocketBase
   (skipped with a warning when `pbToken` is empty). Compile alone:
   `node <skill-dir>/scripts/compile.mjs <file.mdx>`.
3. **Hand over the printed URL** — that link is the deliverable. Optionally also open
   the local HTML.

## Update (living document)

Re-runs edit the existing `.mdx` in place — same path, no new file. Bump `version` in
the frontmatter, prepend an `<Entry>` to `<History>`, and re-publish with a `--note`.
Comment anchors derive from section titles, so keep titles stable when revising or
existing comment threads detach.

## Comments (the feedback loop)

Reviewers hover a block on the published page and pin a comment (no login; name is
remembered locally). Read them back:

```bash
node <skill-dir>/scripts/read-comments.mjs [<project>/<slug> | <slug>] [--since <ISO>] [--json]
```

Anchors map to the document: `masthead`, `s-<section-slug>`, or
`<section-slug>-<type>-<n>` (callout|diagram|code|table|keypoints, ordinal within the
section). When the user asks "any comments on the readout?", run the script and act on
what it returns. There is no notification path — check when asked or before updating.

## Version history

Each publish stores the full MDX snapshot in the `readout_versions` collection
(`doc_id = <project>/<slug>`). To inspect or restore, fetch versions from
`<pbUrl>/api/collections/readout_versions/records?filter=(doc_id='<id>')&sort=-version`
and write the `mdx` field back to the source file. This replaces v1's local git repo.

## Themes

Same four stylesheets as the artifact skill (`assets/themes/`): **dossier** (default),
**editorial**, **terminal**, **brutalist**. All style one class vocabulary, so the theme
is a global swap: set `"theme"` in `config.json` and re-run publish — it copies
`themes/<name>.css` over `_shared/style.css` for the whole site.

## Server

PocketBase on the Hetzner VPS (`readout-pb.service`, port 8091, `/opt/readout`) serves
`pb_public` at https://readout.ssscribe.app and hosts the two collections. One-time
setup, collection import, and the `pbToken` minting procedure live in
`server/setup.md`. The hetzner-vps skill documents the box itself.

## Notes

- The compile pipeline has npm deps — run `npm install` in `<skill-dir>` once per machine.
- `artifact.js` (mermaid theming, highlight.js, sortable/filterable tables) and
  `comments.js` load on every page; comments no-op when the file is opened from disk.
- The old artifact skill stays untouched for local-first, zero-dep documents.
