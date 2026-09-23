---
name: oocl
description: Out-of-constrained-layout — recompose a page that sits in a narrow centred column (big empty gutters on wide screens, a list you scroll forever) so the width carries content. Use on "OOCL", "too constrained", "use the whole screen", "too much scrolling", when building or reviewing a page, dashboard or landing meant for a wide monitor, or when a design pass reaches for a max-width container.
---

# OOCL — out of the constrained layout

The web default is one centred column, `max-width` somewhere between 960 and 1300px. On a 2560px ultrawide that leaves half the window as empty gutter and turns everything into vertical scroll: a list of thirty rows that could be three columns of ten, sections stacked that could sit side by side.

OOCL is the recompose, and its failure mode is the opposite one: everything stretched to the window edge, a demo on the left and its controls on the far right, the eye crossing a thousand pixels to connect a button with what it changes. Both come from treating width as the unit. The unit is the **group**: things the eye reads as one task (a demo and its controls, a form and its running summary, a heading and its lead line, a list). Two rules decide every layout:

- **Groups stay compact.** A group keeps its natural size and its parts sit close together (proximity); a control lives next to the thing it changes. Stretching a group to fill space adds eye travel and says nothing.
- **Width goes to more groups, never to bigger ones.** Extra width is spent on placing independent groups side by side, or it stays whitespace. Whitespace around a compact group is fine; a dead half of the screen is not.

The reference composition is a letter plus a grid: a narrow left zone (about a fifth) holding identity, heading and intro, and the rest a rows-by-two-columns grid where each row is a heading with a one-line lead on the left and its content on the right. Width gets used by placement and whitespace, not by stretching lines.

## 1. Measure

Screenshot the page at 1440, 2560 and 390 wide (`google-chrome --headless --window-size=2560,4000 --screenshot=...` works for a local file or server). For each wide shot, list the groups and note: where the screen is dead (a whole side empty while the page scrolls), which groups are stretched past their natural size, and the longest jump between a control and its target. Find the rule doing the constraining (usually one container `max-width`) and name it.

Done when you can say, per width, which zones are dead, which groups are stretched, and which selector caps the page.

## 2. Recompose

Pick the moves the content supports; each one is reference, not a checklist.

- **Heading-left rows.** Each section becomes a row: heading plus one takeaway line in a left track, the content in a right track (`grid-template-columns: minmax(16rem, 1fr) 3fr`). The right track may end well before the frame when its content is small.
- **Independent groups side by side.** Two things a reader compares or scans in either order (price card and the next product, two FAQ columns, steps 1-2-3) sit next to each other. Things read in sequence (demo, then controls, then readout) stack within their group.
- **Lists flow into columns.** A long homogeneous list goes to `grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr))` or CSS `columns: 22rem`. Grid reads row-major, `columns` column-major; pick by how the eye scans the list and keep keyboard navigation (arrows, type-to-filter, Enter) matching the visual order.
- **Caps per group.** Prose caps at about 70ch, a form at the width its fields need, a demo at the size that shows it clearly. The outer frame can be wide (`width: min(100% - 2 * var(--pad), 2200px)`, `--pad: clamp(1rem, 3vw, 4rem)`) because groups carry their own caps.
- **One scroll.** Everything lives in the page scroll; a panel with its own inner scrollbar is the constrained layout in disguise.

Below about 1000px, tracks collapse to fewer columns; at 390 it is one column and nothing overflows horizontally.

## 3. Prove it

Re-shoot at 1440, 2560 and 390 and compare with step 1.

Done when, at 2560, no screen-height stretch leaves a whole side dead; every control sits beside or directly under the thing it changes; no group is wider than its content needs; no prose line runs past about 80ch; the page is fewer screens tall than before; and at 390 nothing overflows or is cut off.
