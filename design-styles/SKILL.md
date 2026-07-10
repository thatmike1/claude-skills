---
name: design-styles
description: Aesthetic direction + UX baseline for frontend work without prior design setup. Use when building a landing page, portfolio, or marketing site; when the user names a style (premium/high-end, minimalist/editorial, brutalist/industrial); when redesigning an existing site's look; or for a quick UX/UI review of a screen, mock, or PR.
---

# Design Styles

One skill, four branches. Every branch starts with a design read and loads only its own reference files.

## Step 1 — The design read

Before any code or critique, state in one line what you are reading the brief as:

> "Reading this as: \<page kind> for \<audience>, \<vibe> language, leaning \<style pack or system>."

Signals to read: page kind, vibe words the user used, linked references, audience, existing brand assets, regulatory/accessibility constraints (these override aesthetics). If the read genuinely diverges into two directions, ask exactly one clarifying question. Otherwise declare and proceed.

## Step 2 — Route

| Task | Load |
|---|---|
| Build a landing page / portfolio / marketing site | one `styles/*.md` pack + [landing-craft.md](landing-craft.md) |
| Apply a named aesthetic to any surface | the matching `styles/*.md` pack |
| Redesign / upgrade an existing site | [redesign.md](redesign.md) + [ux.md](ux.md) |
| UX/UI review of a screen, mock, or PR | [review.md](review.md) + [ux.md](ux.md) |
| Product UI needing functional UX (forms, flows, dashboards) | [ux.md](ux.md) |

Style packs:

- [styles/high-end.md](styles/high-end.md) — expensive-agency: haptic depth, cinematic motion, Apple/Linear-tier. For premium SaaS, luxury consumer, agency sites.
- [styles/minimalist.md](styles/minimalist.md) — editorial document-style: warm monochrome, typographic hierarchy, flat surfaces. For tools, workspaces, calm brands.
- [styles/brutalist.md](styles/brutalist.md) — Swiss print / tactical terminal: rigid grids, extreme type scale, utilitarian color. For data-heavy dashboards, edgy portfolios, editorial.

Pick ONE style pack per project. When a pack's rule conflicts with a shared rule below or with landing-craft.md, the pack wins — packs are deliberate overrides.

## Shared hard rules (every branch)

- Verify dependencies before importing: check `package.json` first, output the install command if missing.
- Animate only `transform` and `opacity`. Scroll effects via IntersectionObserver, Motion `useScroll()`, or ScrollTrigger — a raw `scroll` event listener is broken code.
- Honor `prefers-reduced-motion`: loops, parallax, and scroll-hijacks collapse to static.
- WCAG AA contrast on all text, buttons, and form elements. Audit every CTA against its background.
- Icons from one library per project, one stroke width. Emoji are never icons.
- `min-h-[100dvh]`, never `h-screen`, for full-height sections.
- Real images (generation tool → seeded placeholder → labeled TODO slot), never div-built fake screenshots.

## Output discipline (every branch)

The reader has ADHD. Format for scanning, then stop:

- Verdict or design read first, one line, before anything else.
- Findings as one-liners: `location — problem → fix`. Full sentences live in the fix, not around it.
- Severity tags (`P0/P1/P2`), hard caps per tier (see review.md). Overflow goes in one "also noticed" line, not more bullets.
- Short chunks with bold mini-headers over long paragraphs. A wall of prose is a failed output even when its content is right.
