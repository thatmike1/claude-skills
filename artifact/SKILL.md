---
name: artifact
description: Generate and update a polished single-page HTML "session artifact" — a shareable document (warm dark editorial theme) that captures work from a Claude Code session: walkthroughs, plans, comparisons, investigations, changelogs. Stores under an external artifacts directory and opens in the browser. Use when the user asks to "make/create/generate an artifact", wants session output as a viewable HTML page/document, or asks to update/add to an existing artifact (it is a living document).
---

# Artifact

Turn session work into a self-contained HTML page the user reviews in a browser. Warm dark
editorial theme, single column. The theme lives in a shared stylesheet so generation is fast
and restyling is global.

## Paths

- Read `config.json` next to this SKILL.md for `artifactsRoot`. If it's missing, default to
  `~/git/artifacts`.
- Project name: `basename "$(git -C . rev-parse --show-toplevel 2>/dev/null || pwd)"`.
- Artifact path: `<artifactsRoot>/<project>/<slug>.html` (`<slug>` = kebab-case of the title).
- Shared assets: `<artifactsRoot>/_shared/style.css` and `<artifactsRoot>/_shared/artifact.js`.
- Artifacts are **external to the work repo** — never write them inside the project repo.

## Generate

1. **Seed shared assets if missing.** If `<artifactsRoot>/_shared/style.css` or `artifact.js`
   doesn't exist, copy both from this skill's `assets/` folder. `mkdir -p` the `_shared/` and
   `<project>/` dirs. (The installer usually seeds these already.)
2. **Build the HTML.** Copy `assets/template.html` as the structural reference and replace the
   content inside `<main class="page">` with the real material, keeping the class vocabulary
   below. Skeleton:
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
3. **Open it:** `xdg-open <path>` (Linux) or `open <path>` (macOS).

The shared CSS `<link>` and the **classic** `<script>` both load over `file://`. Do NOT use
`<script type="module">` for the local asset — ES modules are CORS-blocked over `file://`, so
mermaid/highlighting would silently fail when the file is opened from disk.

## Update (living document)

Re-runs edit the existing artifact in place — same path, no new file.

1. Find the target: the named slug, else the most-recently-modified `.html` in
   `<artifactsRoot>/<project>/`.
2. Edit the content in place with the new/changed material.
3. Bump the masthead **version chip** (`Version N`) and **prepend** a new `<li>` to the
   `.history` list in the footer describing what changed.
4. Re-open if useful.

## Self-contained mode

When the user asks to "make it self-contained" (to share one file): inline
`_shared/style.css` into a `<style>` tag and `_shared/artifact.js` into a `<script>` tag,
replacing the `<link>` and `<script src>`. CDN deps (fonts, mermaid, highlight.js) stay
external — full offline isn't a goal.

## Component vocabulary

Copy exemplars from `assets/template.html`. Single column; **never use emoji as icons**
(inline SVG only).

- **Masthead:** `.eyebrow`, `h1` (use `<em>` for the accented half), `.meta` with
  `.version-chip`, `.lead`.
- **Section:** `<section>` + `h2` containing `<span class="marker">01</span>` + a
  `.section-intro` sentence.
- **Lists:** `ul.keypoints` (diamond markers) or plain `ul`/`ol`.
- **Callouts:** `.callouts` → `.callout.success|.info|.warning|.danger`, each an `.ico`
  (inline SVG) + `.body` (`.label` + `.text`). Rounded, tinted, no left bar.
- **Severity pills:** `.chips` → `.chip.blocker|.risk|.fyi`.
- **Code:** `.codewrap` → `.langtag` + `<pre><code class="language-ts">…`. The language class
  drives highlight.js.
- **Diagram:** `.diagram` → `<pre class="mermaid">flowchart TD …</pre>`.
- **Table:** `.tablewrap` → `<table>`; `<span class="mark yes|no">✓|✕</span>` for marks.
- **Footer:** `footer` → `h2` "Version history" + `ul.history` (`.v` / `.d` / `.what` per row)
  + `.smallprint`.

## Notes

- Fonts (Fraunces + Inter) and the highlight.js theme load via `@import` inside `style.css` —
  no extra `<head>` links needed.
- Restyle every artifact at once by editing `<artifactsRoot>/_shared/style.css`. To re-theme
  the canonical seed for new installs too, also update this skill's `assets/style.css`.
