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

The walkthrough set is covered, and the review/recap blocks below landed 2026-07-02.
Remaining blocks from BuilderIO's catalog worth adding:

- ~~`<Diff>` — before/after code for review readouts (unified `patch` or
  `oldText`/`newText`, optional `filename`/`split`, shiki-highlighted at build).~~
  Shipped 2026-07-02.
- ~~`<FileTree>` — touched-files map for plans and recaps.~~ Shipped 2026-07-02.
- ~~`<Checklist>` — verification steps with checked state.~~ Shipped 2026-07-02.
- ~~`<Timeline>` — session/incident chronology.~~ Shipped 2026-07-02.
- ~~`<StatTiles>` — small KPI row for recap-style readouts.~~ Shipped 2026-07-02.
- ~~Higher-fidelity diagrams via a `<Diagram html={...}>` variant with helper classes
  (panels, lanes, layers, arrows, labels) for swimlanes and layered stacks, without
  abandoning mermaid for simple flows.~~ Shipped 2026-07-02.
- `<AnnotatedCode>` — line-annotated code for review readouts.
- `<QuestionForm>` — open questions with options; answers post into
  `readout_comments` under the question's anchor, so the existing readback loop
  collects decisions, not just prose comments.
- `<ApiEndpoint>` / `<DataModel>` — structured request/response and schema blocks.

## 3. Layout & style evolution

- Top canvas: BuilderIO opens UI plans with an artboard canvas (static wireframe
  screens, annotations pinned to frames). A readout equivalent: a `<Canvas>` +
  `<Artboard>` component pair rendering fixed-size frames in a horizontal lane above
  the document. Start with hand-authored HTML wireframes inside artboards; an
  excalidraw-style freeform sketch is a later, heavier step.
- Wide/breakout layout rules per block type (diff and annotated code want more than
  prose width).
- ~~A light/dark toggle per theme; themes currently pick one mode.~~ Shipped
  2026-07-02: the four dark-only themes were replaced by a single stylesheet with
  light+dark token sets, an OS `prefers-color-scheme` default, and a persisted
  masthead toggle button. The `cfg.theme` config key is gone. See the new
  "style-from-host-project" item for the deferred custom-branding idea.

## 4. Comment anchoring: text ranges

Today comments pin to blocks (`data-anchor`). The "select text → comment" flow needs
range anchoring: store the quoted text + surrounding context (the
textQuote/contextBefore/contextAfter model), re-attach by search on load, flag
detached threads instead of dropping them. Block-level already covers most review
comments — do this only after real usage shows block pins are too coarse. Prereq for
it either way: thread metadata (below).

## 5. Comment workflow (from the comparison)

Shipped 2026-07-02 except notifications: `readout_comments` gained `resolved`,
`consumed`, `audience` (agent|human), `parent_id`; the widget posts audience +
replies and dims resolved threads; `read-comments.mjs` defaults to unresolved,
with `--new`, `--all`, `--consume`, and `--resolve <ids>`.

- Remaining: some notification path (currently poll-only): simplest is a `--watch`
  mode or a morning-skill hook that checks for new comments across recent readouts.

## 6. Feature comparison: readout vs BuilderIO visual-plan

| Feature | readout | BuilderIO visual-plan |
| --- | --- | --- |
| Hosting | self-hosted (own VPS, own domain, own data) | their SaaS (hosted editor + DB), plus a first-class offline path: portable `plan.mdx`/`canvas.mdx` with `import`/`export`/`patch-source` tools and a `plan local serve/verify` bridge |
| Authoring | MDX + JSX components, compiled to static HTML | MDX against a hosted block registry (`get-plan-blocks`), rendered by their app; source is portable MDX |
| Viewer requirements | any browser, no account | account for commenting; guest editing |
| Block catalog | sections, keypoints, callouts, chips, code, mermaid, tables, history | larger: + diff, annotated-code, file-tree, checklist, question-form, api-endpoint, data-model, openapi, json-explorer, tabs, columns, callout, custom-html — and a `diagram` block with a full HTML/CSS/inline-SVG authoring path (panels, layers, swimlanes, matrices, arrows), not just mermaid |
| Visual surface | document only | top canvas (wireframe artboards), live prototype tab, design tab |
| Comments | block-anchored pins, public, no accounts | rich anchors (text quotes, coordinates, wireframe nodes), routing, resolve/consume states, detached-thread handling |
| Agent feedback loop | `read-comments.mjs` (poll) | MCP `get-plan-feedback` with consumed/resolved bookkeeping |
| Versions | full MDX snapshot per publish in PocketBase | version list + restore in their app; granular source patches by stable block id (`patch-visual-plan-source`) |
| Theming | one stylesheet, light+dark token sets, OS-default with a persisted masthead toggle (custom per-project branding = roadmap #7) | one product look, but a real themeable renderer: `--wf-*` tokens, dark mode, and a sketch/clean (rough.js) toggle |
| Sharing controls | public link (auth gating = roadmap #1) | visibility scopes + per-user shares |
| Editing by reviewers | none (comments only) | reviewers can edit blocks in the hosted editor |

The durable differences to keep (not gaps): self-hosted and account-free viewing.
The gaps worth closing are #1–#5 and #7 above; reviewer *editing* is deliberately out —
readouts are the agent's document, feedback flows through comments.

## 7. Style from host project

Now that there's one stylesheet instead of four themes, the "pick a look" knob is gone —
but the richer idea it gestured at is worth keeping: a subskill that reads the host
project's branding (logo colors, a `tailwind.config`/`theme.css`, brand guidelines, or a
sampled screenshot) and emits a custom token override the readout loads on top of the
base stylesheet. The output is a small `--token: value` sheet per project, not a fork of
the whole CSS, so the light/dark structure and all block styling stay intact. Deferred:
the single stylesheet covers the common case; this is a nice-to-have for readouts that
need to look like the product they document.

## Parked / out of scope

- Live functional prototypes (their prototype tab) — wrong tool for this skill's
  document-first shape.
- Reviewer block editing — see above.
- Multi-tenant / team accounts — it's a personal publishing surface.
