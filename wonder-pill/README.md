# wonder-pill

Divergent ideation that hands back a thought-space instead of a shortlist. It audits the
load-bearing assumptions inside a request, inverts each one into a sharp what-if, branches those
outward through fixed dimensions, keeps the discarded threads with their cause of death, and
refuses to converge.

Ported from **[ara-mkr/Wonder-Pill](https://github.com/ara-mkr/Wonder-Pill)** — MIT, © 2026
ara-mkr, licence kept in `LICENSE`. The method is the author's; this port only replaces the two
claude.ai host tools Claude Code does not have.

## What changed from upstream

| Upstream | Here |
|---|---|
| Stage 0 asks through `ask_user_input_v0` (tappable options) | the same three questions as a plain numbered list |
| Stage 5 renders inline via `visualize:read_me` with the `diagram` module | `scripts/render-map.mjs` injects the map data into `assets/map-shell.html` and writes a standalone file |
| Colours come from the host's CSS variables | the shell carries its own light and dark palettes plus a theme button |
| A *go deeper* button calling `sendPrompt()` | a button that copies `Go deeper on the thread: …` to the clipboard |

Stages 1–4 and 6 are unchanged: the assumption audit, the rule that a what-if may only be derived by
inverting a named premise, hard constraints exempt from inversion, the fixed tendril dimensions,
scraps kept with derivation / flaw / judgment, the per-branch gut-check, and the refusal to rank.

## The map

```bash
node ~/.claude/skills/wonder-pill/scripts/render-map.mjs /tmp/wp-topic.json --open
```

Writes `<repo-root>/wonder-pill/<kebab-slug-of-topic>-<yyyy-mm-dd>.html` and opens it with
`xdg-open`. The data file is `{ topic, nodes, edges }`; the node and edge tuple formats, the layout
rules, and the pre-flight checklist live in `references/mindmap.md`.

The page is a 2000×1350 canvas at 0.55 scale: drag to pan, buttons to zoom between 0.3 and 1.4,
click a node for its gut-check in the strip below. Node types are distinguished by border style
rather than colour — solid branch, dashed feral and scrapped, dotted seed, left-ruled tendril — and
cross-links between branches that hit the same tension are dashed. Edges are clipped at each box's
border so no line appears to run through a node.

The renderer validates before it writes: unknown node types, edges pointing at missing nodes, a
scrapped node missing its judgment call, a branch with no premise, or a node off-canvas are all
rejected, and probable box overlaps are warned about.

## Install

```bash
ln -s /path/to/claude-skills/wonder-pill ~/.claude/skills/wonder-pill
```

No dependencies; `render-map.mjs` is plain Node ESM.
