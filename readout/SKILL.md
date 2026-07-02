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

Publish with `--password <pw>` (or `READOUT_PASSWORD` env) to gate a readout: the
compiled HTML is encrypted at publish time (PBKDF2-SHA256 → AES-256-GCM) and served
as a static unlock shell — decryption happens in the reader's browser, plaintext
never reaches the server. Share either the bare URL (reader types the password) or
`<url>#pw=<password>` for auto-unlock (fragments never leave the browser).

- Add `protected: true` to the frontmatter — publish then refuses to run without the
  password, so an accidental plaintext republish can't happen.
- The password is stored nowhere; every republish needs it again. Ask the user for it
  rather than inventing one silently.
- Comments still work, end-to-end encrypted: the widget (active only after the reader
  unlocks the page in that tab) encrypts bodies and hashes anchors with keys derived
  from the same password, so the public comments API stores only ciphertext. Read them
  with `read-comments.mjs --password <pw>` (or `READOUT_PASSWORD`). Changing the
  password orphans earlier comments — widget and CLI skip them and the CLI reports the
  count. Anyone with the URL can still post junk ciphertext; timestamps/counts are visible.
- Remaining trade-offs, applied automatically: skipped by galleries (title/lead would
  leak), version snapshots stored encrypted — restore via
  `node <skill-dir>/scripts/protect.mjs decrypt --password <pw> <file>`
  with the snapshot's `mdx` field as input.

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

Comments tagged `[for human]` are not yours to resolve — surface them to the user.
Anchors map to the document: `masthead`, `s-<section-slug>`, or `<section-slug>-<type>-<n>`
(type = callout|diagram|code|table|keypoints|diff|checklist|timeline|stattiles|filetree,
ordinal in the section). When the user asks "any comments?", run the script and act on
what it returns. No notification path — check when asked or before updating.

## Version history

Each publish stores the full MDX snapshot in the `readout_versions` collection
(`doc_id = <project>/<slug>`). To inspect or restore, fetch versions from
`<pbUrl>/api/collections/readout_versions/records?filter=(doc_id='<id>')&sort=-version`
and write the `mdx` field back to the source file.

## Theme

One stylesheet with light+dark token sets — no theme to pick or configure. It defaults
to the reader's OS `prefers-color-scheme`; a masthead toggle button flips modes and
persists the choice in `localStorage`. Publish ships the one stylesheet sitewide.

## Server

PocketBase on the Hetzner VPS (`readout-pb.service`, port 8091, `/opt/readout`) serves
`pb_public` at https://readout.ssscribe.app and hosts the two collections. One-time setup,
collection import, and the `pbToken` minting procedure live in `server/setup.md`. The
hetzner-vps skill documents the box itself.

## Notes

- The compile pipeline has npm deps — run `npm install` in `<skill-dir>` once per machine.
- `artifact.js` (theming, highlight.js, sortable/filterable tables, mode toggle) and
  `comments.js` load on every page; comments no-op when the file is opened from disk.
- The old artifact skill stays untouched for local-first, zero-dep documents.
