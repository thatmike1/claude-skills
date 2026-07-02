# readout roadmap

Where the skill goes after the v1 ship (2026-07-02). Items are roughly ordered by
value-for-effort; the comparison table at the bottom is the source for most of them.

## 1. Auth-gated output

Published readouts are public-with-the-link. Some content shouldn't be.

- Cheapest: Caddy `basic_auth` on `readout.ssscribe.app` (one shared password for
  reviewers) — zero code, all-or-nothing.
- Better: per-project gating. PocketBase already fronts every request; a small
  `pb_hooks` JS route could require a signed cookie for configured project prefixes
  while leaving others public. Comments API stays same-origin either way.
- Decide: is the unit of privacy the whole site, a project, or a single readout?

## 2. More MDX components (by use-case)

The current set covers walkthroughs. Missing blocks that BuilderIO's catalog proves
useful:

- `<Diff>` / `<AnnotatedCode>` — before/after and line-annotated code for review
  readouts (their diff blocks render wider than prose; our themes need a `.breakout`
  variant, which `Code`/`Diagram` already have).
- `<FileTree>` — touched-files map for plans and recaps.
- `<Checklist>` — verification steps with checked state.
- `<QuestionForm>` — open questions with options; answers post into
  `readout_comments` under the question's anchor, so the existing readback loop
  collects decisions, not just prose comments.
- `<ApiEndpoint>` / `<DataModel>` — structured request/response and schema blocks.
- `<Timeline>` — session/incident chronology.
- `<StatTiles>` — small KPI row for recap-style readouts.

## 3. Layout & style evolution

- Top canvas: BuilderIO opens UI plans with an artboard canvas (static wireframe
  screens, annotations pinned to frames). A readout equivalent: a `<Canvas>` +
  `<Artboard>` component pair rendering fixed-size frames in a horizontal lane above
  the document. Start with hand-authored HTML wireframes inside artboards; an
  excalidraw-style freeform sketch is a later, heavier step.
- Wide/breakout layout rules per block type (diff and annotated code want more than
  prose width).
- A light/dark toggle per theme; themes currently pick one mode.

## 4. Comment anchoring: text ranges

Today comments pin to blocks (`data-anchor`). The "select text → comment" flow needs
range anchoring: store the quoted text + surrounding context (the
textQuote/contextBefore/contextAfter model), re-attach by search on load, flag
detached threads instead of dropping them. Block-level already covers most review
comments — do this only after real usage shows block pins are too coarse. Prereq for
it either way: thread metadata (below).

## 5. Comment workflow (from the comparison)

- Resolved/consumed state per comment thread, so `read-comments.mjs` can show only
  what's new and the agent can mark what it addressed (two extra fields on
  `readout_comments`, superuser-token update from the script).
- Routing: a comment is *for the agent* or *for a human* — BuilderIO treats this as
  the only routing signal. One select field.
- Replies (`parent_id`) to make threads actual threads.
- Some notification path (currently poll-only): simplest is a `--watch` mode or a
  morning-skill hook that checks for new comments across recent readouts.

## 6. Feature comparison: readout vs BuilderIO visual-plan

| Feature | readout | BuilderIO visual-plan |
| --- | --- | --- |
| Hosting | self-hosted (own VPS, own domain, own data) | their SaaS (hosted editor + DB), local-files escape hatch |
| Authoring | MDX + JSX components, compiled to static HTML | MDX against a hosted block registry, rendered by their app |
| Viewer requirements | any browser, no account | account for commenting; guest editing |
| Block catalog | sections, keypoints, callouts, chips, code, mermaid, tables, history | larger: + diff, annotated-code, file-tree, checklist, question-form, api-endpoint, data-model, openapi, json-explorer, tabs, custom-html |
| Visual surface | document only | top canvas (wireframe artboards), live prototype tab, design tab |
| Comments | block-anchored pins, public, no accounts | rich anchors (text quotes, coordinates, wireframe nodes), routing, resolve/consume states, detached-thread handling |
| Agent feedback loop | `read-comments.mjs` (poll) | MCP `get-plan-feedback` with consumed/resolved bookkeeping |
| Versions | full MDX snapshot per publish in PocketBase | version list + restore in their app |
| Theming | 4 interchangeable themes, one CSS swap sitewide | their product look |
| Sharing controls | public link (auth gating = roadmap #1) | visibility scopes + per-user shares |
| Editing by reviewers | none (comments only) | reviewers can edit blocks in the hosted editor |

The durable differences to keep (not gaps): self-hosted and account-free viewing.
The gaps worth closing are #1–#5 above; reviewer *editing* is deliberately out —
readouts are the agent's document, feedback flows through comments.

## Parked / out of scope

- Live functional prototypes (their prototype tab) — wrong tool for this skill's
  document-first shape.
- Reviewer block editing — see above.
- Multi-tenant / team accounts — it's a personal publishing surface.
