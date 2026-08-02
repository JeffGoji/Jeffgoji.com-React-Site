# designer memory

Your accumulated tradecraft for this project. Captures what you have learned about how to do your job well on THIS codebase.

Curated by the dev-lead. You read; you do not write. When you finish a task and notice something worth persisting, report it to the dev-lead in your finishing summary -- the dev-lead decides what gets added here.

Activated 2026-08-01 for the V2 initiative (Spec 00002).

## Project tradecraft

- **jeffgoji.com** is a single-author car-enthusiast site (Mazda Miata builds NA/MSM/ND, Corvette C8, autocross, tuning, suspension articles, photo galleries, YouTube). Audience: visually-driven, brand-literate car enthusiasts + autocross / great-drives fans. Client-only React 18 + Vite SPA; React-Bootstrap 2.10 + Bootstrap 5.3; no backend.
- **V2 design language (LOCKED, Requirement 00001):** **dark motorsport-editorial** — deep charcoal/black canvas, bold typography, big edge-to-edge hero imagery, race-inspired accents; imagery is the star. Premium car-magazine feel, NOT a generic Bootstrap template.
- **Palette (LOCKED FINAL — "Softer Dark", 2026-08-01):** charcoal + premium racing red, softened for reading comfort (pure black/white was too harsh). Canvas `#141418`; deep chrome (nav/hero/footer) `#0F0F12`; ink ramp `#1A1A1F / #202027 / #26262E / #33333B / #45454E`; **reading panel `#202027`** (elevated charcoal for long-form prose, ~17px / 1.7 leading / 68ch). Text warm off-whites: `#F1EEE9` headings (~16:1) / `#D8D4CD` body (~12:1) / `#9C978D` muted (~6:1). Brand red **`#E10600`** (hover `#FF1A0E`, pressed `#B00500`, oxblood `#3A0705`) unchanged — ~3.7:1 on charcoal, still the only saturated hue, passes AA for display/UI. The old `#050506` canvas + `#F6F6F4` body + `#ff0000` + off-brand blues are RETIRED. New prose tokens `--fs-read 1.0625rem` / `--lh-read 1.7`. Tokens source-of-truth: `.claude/strap/mockups/spec-00002/assets/tokens.css`. Deliberate exceptions (not stragglers): nav/hero scrims + gallery index chip keep deep `rgba(5,5,6,…)` over photos; the logo SVG keeps its `#F6F6F4` wordmark.
- **"New everything":** new logo LOCKED — **"The Goji Line"** (racing line through a corner apex bent into a "G" with a white apex dot + "JEFFGOJI" wordmark, GOJI in red), delivered as SVG at `.claude/strap/mockups/spec-00002/assets/logo.svg`. New layout + components per the mockups.
- **Mobile-first**, breakpoints ~360 / 768 / 1024 / 1440. The navbar collapses to a mobile menu.
- **Fonts (LOCKED FINAL):** **Archivo** (display/headings, uppercase tight-tracked), **Inter** (body/blog), **Space Mono** (telemetry chips: date/mileage/cost). Self-host in production. Replaces the old Bangers/Cinzel/Praise.
- **Performance is a co-equal goal (goal 2):** design for lean image delivery — hero/gallery imagery will be webp with responsive `srcset` + lazy-loading. Don't design layouts that demand huge always-loaded imagery above the fold on mobile.

## V2 mockup outcomes (LOCKED — CPO-approved 2026-08-01, 5 iterations)

Mockups at `.claude/strap/mockups/spec-00002/` are the approved visual contract. Key locked patterns:

- **Car roster + names (for captions/nameplates):** NA = Miyoshi, MSM = Kiryu (lives in the `nb/` image dir), NC = Ryoko, ND = Kasumi, C8 = Panda.
- **Best per-car hero source frames:** `na/night1.jpg` (night skyline), `nb/HoosierWet01.jpg` (wet-autocross spray — most dramatic frame in the library), `nd/nd-001.jpg` (solo ND beauty), `c8/c8-002.jpg` (crepe-myrtle evening). **NC has NO well-sized dramatic shot** — all `nc/15east/*` + `nc/yellowstone/*` originals are 2–9MB; needs a webp re-encode.
- **Rotating hero pattern:** home hero random-picks one of 5 per-car shots on load (production: `heroes[]` + `useState(() => heroes[random])` — session-stable). This IS the repo's "Random-Background-Feature." A "TODAY IN THE GARAGE" Space-Mono nameplate names the car.
- **Editorial image-grade technique (reusable):** `.media--editorial` = `filter(brightness/contrast/desaturate)` on the `<img>` + a single `mix-blend-mode:multiply` `::after` overlay for tone-lean + vignette (use `::after` NOT `::before` so it survives child stacking like index chips / number tags; container `isolation:isolate` so the blend can't leak). Keyed off `:root` grade vars; `--hero` (heavier) / `--soft` (lightbox, preserves detail) modifiers. Restrained (saturate 0.90) so cars stay true-color. This fixes bright-snapshot-vs-dark-design mood mismatch on ANY future photo.
- **Nameplate pattern:** Space-Mono telemetry voice reused as a hero caption — a reusable device.
- **Image inventory gotcha:** the light/usable curated shots live under `src/assets/images/` (`nbEdit`/`ncEdit` ~200–280K, `nd/nd-0xx` ~250–590K, `c8/*s.jpg` ~285K) and `src/assets/images/c8/autocross/174276xxxx.jpg` (~50–86K, ideal thumbs). The per-car `public/images/{na,nd,nb,c8}` originals are mostly multi-MB. Autocross/action frames carry a "© David Leung Photography" watermark; static beauty shots don't.

## Surfaces to cover (mockups)

Design system first, then key surfaces: **home** (hero + composed Intro/Garage/YouTube), **garage / car-blogs hub**, a **build blog** (markdown-in-JSON posts: date/mileage/cost/entry + image, paginated 3/page), a **gallery** (react-image-gallery), and the new **"V2 What's New" page** (permanent nav item; audience = enthusiasts + autocross/great-drives fans; tone = exciting/entertaining, Top Gear / Jeremy Clarkson voice). Keep the existing AdSense wiring intact-but-inert (no ad slots in the design).

## Anti-patterns to avoid

- The current site's biggest visual problem is three overlapping/uncoordinated styling systems (Bootstrap utils + a separately-compiled SCSS + legacy `assets/css/style.css` + inline styles). Your mockups define ONE coherent system so the frontend can collapse the rest onto it.
- The current SCSS `$theme-colors` override is INEFFECTIVE (Bootstrap is imported before the map is defined in `src/scss/styles.scss`). If you prescribe Bootstrap theme-map overrides, note the correct import order.
- Don't design ad-heavy layouts — AdSense is OUT of V2 (slots stay off).

## Tool / environment quirks

- Mockups are deployable code the frontend ports VERBATIM (mockup-as-contract). Follow the client-ui Conventions in project-profile.md (React 18 + Vite, JSX, React-Bootstrap idioms) so the port is faithful. Windows dev host.
