# Rendering the mind map

The map is **interactive html**, fully expanded, explored by panning and zooming — not a static
image and not a progressive reveal. Everything exists at once; the person moves around inside it.

You do not hand-write the page. `assets/map-shell.html` is a finished static shell — palette,
pan, zoom, node styling, click-to-detail, edge clipping — and `scripts/render-map.mjs` injects your
nodes and edges into it. Your whole job is the two arrays and where the boxes sit.

```bash
node ~/.claude/skills/wonder-pill/scripts/render-map.mjs /tmp/wp-<slug>.json --open
```

It prints the written path: `<repo-root>/wonder-pill/<kebab-slug-of-topic>-<yyyy-mm-dd>.html`, where
repo root is `git rev-parse --show-toplevel` from the working directory (`--out-dir` overrides it).
`--open` calls `xdg-open`. The shell carries its own light and dark palettes and a theme button, so
it does not depend on anything the host page defines.

## The data file

```json
{
  "topic": "self-healing concrete",
  "nodes": [
    ["topic",  "topic",   900, 620, 240, "self-healing concrete"],
    ["b1",     "branch",  380, 430, 260, "what if it fed on the environment?", "assumes: durability means resisting it", "the hard part is controlling the reaction, not starting it"],
    ["b1t1",   "tendril", 130, 380, 220, "seawater as a curing agent"],
    ["s1",     "seed",    120, 200, 240, "roman marine concrete got stronger in seawater"],
    ["b2",     "feral",  1320, 380, 260, "what if the building healed on a human schedule?", "assumes: repair should be invisible", "only interesting if the wait is the point, not the delay"],
    ["x1",     "scrapped", 90, 1120, 250, "what if it floated?",
      "inverts: a bridge has to be a fixed structure",
      "trades a 500-year erosion problem for a 5-year mooring-maintenance problem",
      "scrapped for generativity, not plausibility — buildable, but the thread stops once you name the trade"]
  ],
  "edges": [
    ["topic", "b1", "solid"],
    ["s1", "b1", "dotted"],
    ["b1", "b1t1", "solid"],
    ["b1", "b2", "cross"]
  ]
}
```

Node tuple: `[id, type, x, y, width, title, field7, field8]`.

| Type | Fields 7 and 8 | Look |
|---|---|---|
| `topic` | — | solid border, `--surface-2`, 14px medium |
| `branch` | premise, gut-check | solid border, accent tint, premise line 11px muted above the what-if |
| `feral` | premise, gut-check | same as branch but **dashed** border and a `feral` tag |
| `tendril` | optional note, optional gut-check | no border, single accent left rule, 12px |
| `seed` | optional note | **dotted** border, muted text, small `seed` label |
| `scrapped` | derivation, flaw, **plus field 9 judgment** | **dashed** border, 0.5 opacity, title struck through; derivation shows on the node, flaw and judgment in the detail strip |

Edge tuple: `[from, to, style]` where style is `solid` (default), `dotted` (a seed feeding its
branch), or `cross` (a dashed accent cross-link). Edges are drawn centre to centre and clipped at
each box's border, so they never appear to pierce a node they connect.

The renderer rejects: an unknown node type, an edge pointing at a node that does not exist, a
scrapped node missing any of its three fields, a branch or feral node with no premise, a node
outside the 2000×1350 canvas, and duplicate ids. It warns on boxes that look like they overlap,
estimating each box's height from its text.

## Layout: radial but deliberately uneven

A tidy ring of equidistant branches is the thing to avoid — it implies every thread got equal
attention, which is false and throws away information.

- Canvas is **2000 × 1350**. Topic near the center.
- Place each branch in its own **angular sector**, at whatever radius suits it — 300px for a short
  thread, 600px for one that ran long. Vary it.
- **Tendrils continue outward** in the same sector, or tangentially when the sector is against a
  canvas edge.
- **Seeds sit further out than the branch they caused.** The map then reads both inward (why) and
  outward (where it went).
- **Scrapped nodes float in an unused margin**, connected by nothing or by a faint dotted stub.
- Keep each branch's cluster inside its own zone. Overlap between clusters is the main failure —
  sketch the zone bounds before placing nodes. A box is about `22 + ceil(chars / (width/6.4)) * 17`
  pixels tall; leave 40px of air.

### Cross-links

Two or three, dashed, connecting branches that landed on the same underlying tension. These are the
most interesting edges on the map, because a pure tree structurally cannot show convergence.

Cross-links may cross other **lines** — that reads as a web and is fine. They must never pass
through a **box**. Check the straight-line path against every node's rectangle before committing;
nudge a node if it clips one.

## Interaction the shell already provides

1. **Drag to pan**, mouse and touch.
2. **Zoom buttons** stepping scale between 0.3 and 1.4, plus reset. No wheel-zoom: it hijacks page
   scrolling and irritates more than it helps.
3. **Click a node** for its detail in the strip below the viewport, with the selected node outlined.
   Clicking empty canvas clears the selection.
4. **Copy go-deeper prompt** in the detail strip, putting `Go deeper on the thread: <title>` on the
   clipboard. This replaces the claude.ai `sendPrompt()` button, which has no equivalent locally.
5. **Theme button** flipping light and dark; the initial state follows `prefers-color-scheme`.

Initial scale is 0.55 and the map is centred on load — enough that the shape reads immediately,
close enough that labels are legible when they pan in.

## Writing rules for node text

- Sentence case everywhere, including node labels.
- No emoji.
- Nothing below 11px, and the shell sets the sizes — do not try to fit more text by shrinking type.
  Shorten the label instead and let the detail strip carry the sentence.
- Never rely on colour alone: every category is already distinguished by border style, so keep the
  types honest rather than inventing new ones.

## Pre-flight checklist

- [ ] Every branch shows both its premise and its what-if
- [ ] Every scrapped node carries all three fields — derivation, flaw, and judgment — and the
      judgment names generativity, not plausibility, as the reason it died
- [ ] Seeds sit outside their branches; scrapped nodes are detached
- [ ] Branch radii and depths are visibly uneven
- [ ] No cross-link passes through a node box
- [ ] The renderer printed no overlap warnings
- [ ] Two or three cross-links exist
- [ ] The file opened and you said its path
