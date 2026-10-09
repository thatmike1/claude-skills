# Style pack: Industrial Brutalist

Swiss typographic print fused with military terminal aesthetics: rigid grids, extreme type-scale contrast, utilitarian color, simulated analog degradation. Projects raw functionality and mechanical precision.

## Pick ONE mode per project — never mix

1. **Swiss Industrial Print (light)** — 1960s corporate identity / machinery blueprints. Newsprint substrate, monolithic heavy sans, visible grid lines, asymmetric negative space punctured by viewport-bleeding numerals.
2. **Tactical Telemetry (dark)** — declassified military database / aerospace HUD. Dark-mode exclusive, dense tabular data, monospace dominance, ASCII framing, phosphor glow and scanlines.

## Typography is the architecture

- **Macro (structural headers):** heavy neo-grotesque — Neue Haas Grotesk Black, Archivo Black, Monument Extended, Inter Black. `clamp(4rem, 10vw, 15rem)`, tracking `-0.03em` to `-0.06em`, leading `0.85–0.95`, uppercase only.
- **Micro (data/telemetry):** monospace — JetBrains Mono, IBM Plex Mono, Space Mono, VT323. 10–14px, generous tracking (`0.05–0.1em`), uppercase, for all metadata, nav, unit IDs, coordinates.
- **Textural serif (rare):** Playfair, EB Garamond — only heavily degraded (halftone, 1-bit dither) as textural disruption.

## Color: uncompromising

Gradients, soft shadows, and translucency have no place here.

- **Swiss Print:** background `#F4F4F0`/`#EAE8E3` (matte paper), ink `#050505–#111111`, accent `#E61919`/`#FF2A2A` (hazard red) — the only accent, for strikethroughs, structural rules, vital highlights.
- **Telemetry:** background `#0A0A0A`/`#121212` (not pure black), foreground `#EAEAEA` (white phosphor), same hazard red. Terminal green `#4AF626` for at most ONE status element, or omit.

## Layout: engineered, not arranged

- Strict CSS Grid; elements anchor to tracks and intersections, nothing floats.
- Visible compartmentalization: 1–2px solid borders delineating zones; full-width `<hr>` rules segregating units. Trick: `display: grid; gap: 1px;` with contrasting parent/child backgrounds yields razor-thin dividers.
- Bimodal density: tightly packed monospace clusters against vast negative space framing macro type.
- `border-radius: 0` absolutely everywhere. 90° corners enforce the rigidity.

## Symbology

- ASCII framing: `[ DELIVERY SYSTEMS ]`, `< RE-IND >`, `>>>`, `///`.
- `®` `©` `™` as structural geometric elements; crosshairs `+` at grid intersections; barcode line clusters; randomized process strings (`REV 2.6`, `UNIT / D-01`).
- Semantic tags for the telemetry: `<data>`, `<samp>`, `<kbd>`, `<output>`, `<dl>`.

## Analog degradation

- Halftone / 1-bit dither on images and oversized serifs (`mix-blend-mode: multiply` + SVG dot patterns).
- CRT scanlines for terminal mode: `repeating-linear-gradient(0deg, transparent 2px, rgba(0,0,0,0.1) 2px 4px)`.
- Global low-opacity SVG noise on the root for unified physical grain.

## Ship check

One mode, committed · zero border-radius · hazard red as sole accent · macro type clamps aggressively · monospace metadata uppercase everywhere · at least one degradation texture grounding the digital surface.
