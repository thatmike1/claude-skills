# Style pack: Editorial Minimalist

Document-style refinement in the vein of top-tier workspace tools (Notion-adjacent). Warm monochrome, typographic contrast, ultra-flat surfaces, muted pastel accents. This pack deliberately allows display serifs — that override wins over landing-craft's serif discipline.

## Typography

- **Body/UI sans:** `SF Pro Display`, `Geist Sans`, `Switzer`, `Helvetica Neue`.
- **Editorial serif for hero headings and quotes:** `Lyon Text`, `Newsreader`, `Playfair Display`, `Instrument Serif`. Tight tracking (`-0.02em` to `-0.04em`), tight leading (`1.1`).
- **Mono for code, keystrokes, metadata:** `Geist Mono`, `SF Mono`, `JetBrains Mono`.
- Body text is off-black (`#111111` / `#2F3437`), never `#000000`, `line-height: 1.6`. Secondary text `#787774`.

## Color: warm monochrome + spot pastels

Color is scarce, spent only on meaning.

- Canvas: `#FFFFFF` or warm bone `#F7F6F3` / `#FBFBFA`. Cards: `#FFFFFF` / `#F9F9F8`.
- Borders/dividers: `#EAEAEA` or `rgba(0,0,0,0.06)` — exactly 1px, everywhere.
- Accents: washed-out pastels only — pale red `#FDEBEC`/`#9F2F2D`, pale blue `#E1F3FE`/`#1F6C9F`, pale green `#EDF3EC`/`#346538`, pale yellow `#FBF3DB`/`#956400`.
- Flat by definition: no gradients, no neon, no glassmorphism beyond a subtle navbar blur, shadows ultra-diffuse below 0.05 opacity or absent.

## Components

- **Bento grids** — asymmetric CSS Grid, `1px solid #EAEAEA` borders, radius 8–12px max, padding 24–40px.
- **Primary CTA** — solid `#111111`, white text, radius 4–6px, no shadow. Hover: `#333333` or `scale(0.98)`. Large containers and primary buttons stay rectangular — pills are reserved for tags.
- **Tags/badges** — pill-shaped, `text-xs` uppercase wide-tracked, pastel backgrounds.
- **Accordions** — no boxes; items separated by `border-bottom` only, sharp `+`/`−` toggles.
- **Keystrokes** — `<kbd>` rendered as physical keys: 1px border, 4px radius, `#F7F6F3` fill, mono font.
- **Faux-OS chrome** — software mockups get a white top bar with three light-gray circles.

## Icons and imagery

- Icons: Phosphor (Bold/Fill) or Radix — slightly thicker technical strokes, one weight everywhere.
- Illustrations: monochrome continuous-line ink sketches with one pastel-filled geometric offset shape.
- Photography: desaturated, warm-toned, subtle warm grain overlay. Sections get depth from low-opacity imagery, soft radial light spots (`opacity: 0.03`), or minimal line patterns — flat empty sections read unfinished.
- Copy: realistic contextual content. Plain specific language instead of AI cliché verbs ("Elevate", "Seamless", "Unleash").

## Motion: invisible sophistication

- Scroll entry: `translateY(12px)` + fade over 600ms, `cubic-bezier(0.16, 1, 0.3, 1)`, IntersectionObserver.
- Hover: shadow shift from none to `0 2px 8px rgba(0,0,0,0.04)` over 200ms; `:active` scale 0.98.
- Staggered reveals: `animation-delay: calc(var(--index) * 80ms)`.
- Optional single ambient blob behind the hero: 20s+ duration, opacity 0.02–0.04, on a fixed pointer-events-none layer.

## Ship check

Macro-whitespace first (`py-24`+) · content constrained to `max-w-4xl/5xl` · every border exactly `1px #EAEAEA` · scroll entries on major blocks · sections have subtle depth · palette stays monochrome + pastel spots.
