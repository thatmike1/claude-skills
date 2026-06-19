---
name: artifact
description: Generate and update a polished single-page HTML "session artifact" — a shareable document (warm dark editorial theme) that captures work from a Claude Code session: walkthroughs, plans, comparisons, investigations, changelogs. Stores under an external artifacts directory (git-versioned, with an auto-generated gallery) and opens in the browser. Use when the user asks to "make/create/generate an artifact", wants session output as a viewable HTML page/document, or asks to update/add to an existing artifact (it is a living document).
---

# Artifact

Turn session work into a self-contained HTML page the user reviews in a browser. Warm dark
editorial theme, single column. The theme lives in a shared stylesheet so generation is fast
and restyling is global. The artifacts directory is a local git repo (real version history) and
carries an auto-generated gallery.

## Paths

- Read `config.json` next to this SKILL.md for `artifactsRoot`. If missing, default to
  `~/git/artifacts`. `<skill-dir>` is the directory holding this SKILL.md.
- Project name: `basename "$(git -C . rev-parse --show-toplevel 2>/dev/null || pwd)"`.
- Artifact path: `<artifactsRoot>/<project>/<slug>.html` (`<slug>` = kebab-case of the title).
- Shared assets: `<artifactsRoot>/_shared/{style.css,artifact.js}`.
- Galleries (auto-generated): `<artifactsRoot>/<project>/index.html` lists a project's
  artifacts; `<artifactsRoot>/index.html` lists projects.
- Artifacts are **external to the work repo** — never write them inside the project repo.

## Generate

1. **Seed shared assets if missing.** If `<artifactsRoot>/_shared/style.css` or `artifact.js`
   doesn't exist, copy both from `<skill-dir>/assets/`. `mkdir -p` `_shared/` and `<project>/`.
2. **Build the HTML** from this skeleton, replacing the `<main>` content with the real material
   using the class vocabulary below:
   ```html
   <!DOCTYPE html><html lang="en"><head>
   <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
   <title>TITLE</title>
   <link rel="stylesheet" href="../_shared/style.css" />
   </head><body>
   <main class="page"> … content … </main>
   <script src="../_shared/artifact.js"></script>
   </body></html>
   ```
   Use `assets/template.html` as the worked example. For a multi-page set, add an
   `.artifact-nav` back-link near the top (see Gallery & multi-page).
3. **Rebuild the galleries:**
   `node <skill-dir>/scripts/build-gallery.mjs <artifactsRoot>/<project> <artifactsRoot>` then
   `node <skill-dir>/scripts/build-gallery.mjs <artifactsRoot> <artifactsRoot>`.
4. **Commit** (see Version history).
5. **Open it:** `xdg-open <path>` (Linux) or `open <path>` (macOS).

The shared CSS `<link>` and the **classic** `<script>` both load over `file://`. Do NOT use
`<script type="module">` for the local asset — ES modules are CORS-blocked over `file://`, so
mermaid/highlighting/tables would silently fail when the file is opened from disk.

## Update (living document)

Re-runs edit the existing artifact in place — same path, no new file.

1. Find the target: the named slug, else the most-recently-modified non-`index.html` `.html` in
   `<artifactsRoot>/<project>/`.
2. Edit the content in place.
3. Bump the masthead **version chip** (`Version N`) and **prepend** a new `<li>` to the
   `.history` footer list describing the change.
4. Rebuild the galleries (step 3 above), commit, re-open if useful.

## Version history (git)

The artifacts directory is a **local** git repo — no remote, just real version history + restore.

- On first run, if `<artifactsRoot>/.git` is missing: `git -C <artifactsRoot> init`.
- After each generate/update (and gallery rebuild):
  `git -C <artifactsRoot> add -A && git -C <artifactsRoot> commit -m "<project>/<slug>: <what changed>"`.
- Restore a prior version: `git -C <artifactsRoot> log -- <project>/<slug>.html`, then
  `git -C <artifactsRoot> checkout <sha> -- <project>/<slug>.html`.

## Gallery & multi-page

- `build-gallery.mjs` writes a themed `index.html` for a directory: project dirs list their
  artifacts, the root lists projects. Always rebuild after writing an artifact.
- A feature with multiple parts = **multiple `.html` pages in one project dir**, each carrying an
  `.artifact-nav` link back to `index.html` (the project gallery is the hub). Prefer several
  focused pages over one giant page when the material has distinct parts.

## Self-contained mode

When the user asks to "make it self-contained" (to share one file): inline `_shared/style.css`
into a `<style>` tag and `_shared/artifact.js` into a `<script>` tag, replacing the `<link>` and
`<script src>`. CDN deps (fonts, mermaid, highlight.js) stay external.

## Component vocabulary

Copy exemplars from `assets/template.html`. Single column; **never use emoji as icons** (inline
SVG only).

- **Nav (multi-page):** `.artifact-nav` with an `<a href="index.html">` back-link, above the masthead.
- **Masthead:** `.eyebrow`, `h1` (`<em>` for the accented half), `.meta` with `.version-chip`, `.lead`.
- **Section:** `<section>` + `h2` with `<span class="marker">01</span>` + a `.section-intro` line.
- **Lists:** `ul.keypoints` (diamond markers) or plain `ul`/`ol`.
- **Callouts:** `.callouts` → `.callout.success|.info|.warning|.danger` = `.ico` (SVG) + `.body` (`.label` + `.text`).
- **Severity pills:** `.chips` → `.chip.blocker|.risk|.fyi`.
- **Code:** `.codewrap` → `.langtag` + `<pre><code class="language-ts">…` (language class drives highlight.js).
- **Diagram:** `.diagram` → `<pre class="mermaid">flowchart TD …</pre>`.
- **Table:** `.tablewrap` → `<table>`; `<span class="mark yes|no">✓|✕</span>` for marks. Add
  `class="sortable"` to the `<table>` for click-to-sort headers (mark a non-sortable column with
  `<th data-nosort>`), and `data-filter="placeholder text"` on the `.tablewrap` for a live row filter.
- **Footer:** `footer` → `h2` "Version history" + `ul.history` (`.v`/`.d`/`.what` per row) + `.smallprint`.

## Notes

- Fonts (Fraunces + Inter) and the highlight.js theme load via `@import` inside `style.css`.
- Restyle every artifact at once by editing `<artifactsRoot>/_shared/style.css`. To re-theme the
  seed for new installs too, also update `<skill-dir>/assets/style.css`.
