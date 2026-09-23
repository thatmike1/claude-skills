---
name: oocl
description: Out-of-constrained-layout — recompose a page that sits in a narrow centred column (big empty gutters on wide screens, a list you scroll forever) so the width carries content. Use on "OOCL", "too constrained", "use the whole screen", "too much scrolling", when building or reviewing a page, dashboard or landing meant for a wide monitor, or when a design pass reaches for a max-width container.
---

# OOCL — out of the constrained layout

The web default is one centred column, `max-width` somewhere between 960 and 1300px. On a 2560px ultrawide that leaves half the window as empty gutter and turns everything into vertical scroll: a list of thirty rows that could be three columns of ten, sections stacked that could sit side by side. OOCL is the recompose: **the width carries content, the measure caps prose**. A readable line length is a property of a text block, never of the page.

The reference composition is a letter plus a grid: a narrow left zone (about a fifth) holding identity, heading and intro, and the rest a rows-by-two-columns grid where each row is a heading with a one-line lead on the left and its content on the right, controls pinned to the far window edge. Width gets used by placement and whitespace, not by stretching lines.

## 1. Measure the constraint

Screenshot the page at 1440, 2560 and 390 wide (`google-chrome --headless --window-size=2560,4000 --screenshot=...` works for a local file or server). For each wide shot note: content width as a share of the viewport, the gutter each side, and page height in viewports. Find the rule doing the constraining (usually one container `max-width`, sometimes a `ch` cap on a wrapper) and name it.

Done when you can say, per width, "content is N% of the window, the page is M screens tall, `<selector>` caps it".

## 2. Recompose

Pick the moves the content supports; each one is reference, not a checklist.

- **Zones, not a column.** Split the page into unequal regions: a narrow rail (identity, heading, intro, filters) beside a wide working area. The rail can be `position: sticky` inside the one page scroll.
- **Heading-left rows.** Each section becomes a row: heading plus one takeaway line in a left track, the content in a right track (`grid-template-columns: minmax(16rem, 1fr) 3fr`). Kills the "heading, then a full-width block, then a heading" stack.
- **Lists flow into columns.** A long homogeneous list goes to `grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr))` or CSS `columns: 22rem`. Grid reads row-major, `columns` reads column-major; pick by how the eye scans the list and keep keyboard navigation (arrows, type-to-filter, Enter) matching the visual order.
- **Pair what belongs together.** Sequential steps go horizontal, a thing and its explanation sit side by side, a demo sits beside its controls and readout instead of above them.
- **Prose keeps its measure where it lands.** Text blocks cap at about 70ch *inside* their track; the track is placed, the lines are not stretched.
- **Fluid frame.** The outer container is `width: min(100% - 2 * var(--pad), 2400px)` or uncapped, with `--pad: clamp(1rem, 3vw, 4rem)`. Display type scales with `clamp(..., Nvw, ...)` so a hero reads as large on 2560 as it does on 1440.
- **One scroll.** Everything lives in the page scroll; a panel with its own inner scrollbar is the constrained layout in disguise.

Below about 1000px, tracks collapse to fewer columns; at 390 it is one column and nothing overflows horizontally.

## 3. Prove it

Re-shoot at 1440, 2560 and 390 and put the before and after numbers side by side.

Done when, at 2560, no gutter is wider than about 12% of the window, the page is measurably fewer screens tall, no prose line runs past about 80ch, and at 390 there is no horizontal overflow and nothing is cut off.
