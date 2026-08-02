# Project profile

_The curated record of what this project IS. Refine over the project's lifetime: onboarding inferences, learnings from active work, and CPO corrections all land here. When the project shape evolves -- a new tech, a changed convention, a discovered sensitivity -- update this file before doing anything else._

_Onboarded via `/strap-in` on 2026-08-01 (single-project mode). Deep-dive by frontend-engineer, security-reviewer, test-strategist, devops-lead._

## Identity

- **Project name**: jeffgoji.com
- **Company**: Personal project -- Jeff "Goji" Anderson-Lester
- **Description**: A single-author car-enthusiast blog & showcase SPA -- Mazda Miata builds (NA / MSM / ND), Corvette C8, autocross recaps, tuning + suspension technical articles, photo galleries, and YouTube embeds.
- **Public URL**: https://jeffgoji.com/
- **Repository**: https://github.com/JeffGoji/Jeffgoji.com-React-Site (GitHub, public; owner `JeffGoji`)
- **Default branch**: main _(never committed to directly -- all work via feature/task branches + reviewed PR)_

## Sub-repos

_Single-project install -- no polyrepo sub-repos. Section intentionally empty; the schema sentinel below is preserved for `/strap-upgrade` detection._

<!-- strap-schema: sub-repos-v2.4 -->

## Stack

- **Framework**: React 18.2 (plain JSX, **no TypeScript** -- `@types/react*` are declared but unused) + Vite 4.4.
- **Routing**: React Router DOM v6, single `<BrowserRouter>`, flat route table in `src/App.jsx`. Client-only SPA (no SSR/SSG in effect).
- **UI**: React-Bootstrap 2.10 + Bootstrap 5.3 utility classes. Styling is a **three-way split** (see Architecture notes): Bootstrap, custom SCSS (`src/scss/styles.scss`, compiled via a separate `<script>` tag), and legacy `src/assets/css/style.css`.
- **Content model (JSON-as-CMS)**: Blog posts are arrays of objects in `src/assets/Data/{naBlog,MsmBlog,ndBlog,c8Blog}.json` with fields `id / date / mileage / picture / cost / entry`. The `entry` field is **markdown**, rendered client-side by `react-markdown` v10 + `remark-gfm` with custom `p/img/a` renderers. Client-side pagination (sort by `id` desc, 3 posts/page).
- **Galleries**: `react-image-gallery`, wired **three different ways** (see Architecture notes). One gallery (`nd-totd2025`) consumes a build-time `sharp` image pipeline (`scripts/build-gallery.mjs`) that emits webp thumbs/display + a `manifest.json` into `public/gallery/`.
- **Ads**: Google AdSense global script in `index.html` + an `AdSenseSlot` component -- but **every ad slot is currently commented out** (inert).
- **Rendering entry**: `src/main.jsx` (`ReactDOM.createRoot`). This is authoritative.
- **Deploy**: Netlify (`netlify.toml`) -- `npm run build` chains gallery build -> `vite build` -> publishes `dist/`.

**Declared-but-unused dependencies** (safe-to-remove candidates): `firebase` (^10.7.1 -- never imported), `react-image-file-resizer` (never imported). `vite-react-ssg` is _referenced_ by `src/entry-ssr.jsx` but **not declared** in `package.json` (dead/broken).

## Domains

### client-ui

- **Status**: active
- **Specialists**: frontend-engineer, security-reviewer, test-strategist, designer, tech-writer
- **Activated additions**: designer + tech-writer activated 2026-08-01 for the V2 initiative (Spec 00002) — designer owns the V2 visual system + mockups; tech-writer owns the "V2 What's New" page content.
- **Stack**: React 18.2 + Vite 4.4, JSX, React Router v6, React-Bootstrap + Bootstrap 5.3, react-markdown + remark-gfm, react-image-gallery.
- **Conventions**:
  - Real entry is `src/main.jsx`; `App.jsx` route table (`App.jsx:47-68`) is the source of truth for routes. Ignore/quarantine `src/entry-ssr.jsx` (dead, broken).
  - Folder-per-component layout (`components/<Name>/index.jsx`); some flat single-file components.
  - Local `useState` only -- no Redux/Context/store (appropriate for size).
  - Blog content authored as markdown inside JSON data files; render only via `react-markdown` + `remark-gfm` (see security rule -- do NOT add raw-HTML rendering without sanitization).
- **Source-of-truth**: `src/App.jsx`, `src/main.jsx`, `src/components/blog/*/index.jsx`, `src/assets/Data/*Blog.json`, `src/components/Gallery/`.
- **Activated**: 2026-08-01 by jeff.lester01

### infrastructure

- **Status**: active
- **Specialists**: devops-lead
- **Stack**: Vite build, custom Node build script (`scripts/build-gallery.mjs`, `sharp` + `fast-glob`), Netlify static hosting.
- **Conventions**:
  - Netlify's own per-push build IS the CI/CD -- do NOT add GitHub Actions (would duplicate and drift).
  - Build chain: `gallery:build` (sharp) -> `vite build` -> `dist/`. `sharp` is a native binary and the single most fragile build link.
- **Source-of-truth**: `netlify.toml`, `public/_redirects`, `public/_headers`, `scripts/build-gallery.mjs`, `vite.config.js`.
- **Activated**: 2026-08-01 by jeff.lester01

_Dormant (no signal at onboarding; activate later via `/strap-refresh` if the project grows into them): backend-engineer, database-engineer, integration-specialist, ux-test-engineer._

## Build and test

- **Build**: `npm run build` (= `npm run gallery:build && vite build`). `gallery:build` = `node scripts/build-gallery.mjs`. Dev server: `npm run dev` (or `npm run dev:gallery` to rebuild galleries first).
- **Deploy**: Netlify reads `netlify.toml` (command `npm run build`, publish `dist`). SPA fallback via `public/_redirects` (`/* /index.html 200`). Gallery cache headers in `public/_headers`.
- **Tests**: **NONE currently** -- no test runner, no test files, no `test` script. Recommended stack (per test-strategist): **Vitest + React Testing Library + jsdom** (native fit for Vite; ~15-20 targeted tests). Highest-value targets: pure helpers in `scripts/build-gallery.mjs` (needs export-refactor first) and `Gallery/_thumbs/chunk.js`; blog JSON data-integrity; route-parity guard; blog pagination behavior. Once tests exist, the centralized-execution gate is `npm test` (= `vitest run`), run only by the dev-lead.
- **Lint**: ESLint configured (`.eslintrc.cjs`) but runs only as a Vite plugin -- no standalone lint script.

## Conventions

- **Sprint cadence**: 1-week sprints (e.g. `Sprint 2026.08.A`, 2026-08-01 -> 2026-08-08). Pair topology: solo CPO (JeffGoji) + agent execution team. Capacity fallback (iteration_get_capacity unsupported on strap-agile): **6 productive hours/day**, set 2026-08-01.
- **Language**: JavaScript/JSX only. No TypeScript despite `@types/*` being present.
- **Content authoring**: blog entries are hand-edited markdown strings inside JSON; `picture` paths are root-relative _without_ a leading slash (e.g. `"images/na/20250130.jpg"`), served from `public/images/`.
- **Components**: `components/<Name>/index.jsx` folder pattern predominates.
- **Git**: git repository since 2026-08-01 via `/connect-code-repo`; origin `https://github.com/JeffGoji/Jeffgoji.com-React-Site.git`, `gh` CLI auth (account JeffGoji).

## Architecture notes

- **Client-only SPA.** `index.html` loads `/src/main.jsx` (React app) and `/src/scss/js/main.js` (Bootstrap CSS/JS + SCSS compile). `App.jsx` mounts `<Header/>` + a flat `<Routes>` table under one `<BrowserRouter>`. `Home` composes `Intro + Garage + YouTube` directly (not nested routes).
- **Abandoned SSG layer (dead code).** `src/entry-ssr.jsx` imports `vite-react-ssg` (NOT in `package.json`), with wrong component paths and a stale route list. Nothing loads it. Vestiges of this abandoned prerender attempt remain: the `Object.hasOwn` polyfill (`main.jsx:1-5`), the `custom-render-ready` dispatch (`App.jsx:38-40`), and `vite.config.js:8` forcing `target:'es2015'` "so JSDOM can parse it" -- which now just ships a larger down-transpiled bundle for a prerender that never runs.
- **Three gallery-wiring patterns (unconsolidated).** (a) static `images.js` array of Vite-imported jpgs; (b) `images.js` + `_thumbs/chunk.js` + client-side canvas thumbnailing (`_thumbs/thumbs.js`, ND/HillCountry); (c) `fetch('/gallery/nd-totd2025/manifest.json')` from the sharp build pipeline (ND/TailOfTheDragon). Only (c) consumes the build pipeline. `nd-hillcountry` is configured in `build-gallery.mjs` but its component ignores the built output -- wasted build time + CDN storage, and it relies on the **deprecated** `import.meta.globEager` (removed in Vite 5).
- **Three styling systems.** Bootstrap utilities (primary) + custom SCSS (`src/scss/styles.scss` via a separate script tag) + legacy `src/assets/css/style.css` (imported in `App.jsx:34`) + scattered inline `style={{}}`. The SCSS `$theme-colors` override at `styles.scss:2` is _ineffective_ (imports Bootstrap before defining the map); custom colors work only because also hand-declared.
- **No backend, no database, no auth, no user input.** No forms, no fetch-to-backend, no PII/credentials anywhere. `.env` files are gitignored and absent from the tree. Content-authoring path is owner-only.

## DevOps integration

- **Host**: strap-agile (Local, work-item-tracking-as-code). Work items are YAML files under `.claude/strap/work/<type>/<id>.yaml`, versioned in git alongside the code. No remote host, no credentials.
- **Types**: requirement, spec, feature, story, task, bug, enhancement. Four-state machine (new → active → resolved → closed).
- **Ids**: monotonic zero-padded (00001…), counter at `.claude/strap/work/.next-id`.
- Details in `.claude/strap/state/devops-connection.yaml`; schema at `.claude/strap/work/schema.yaml`.
- Wired 2026-08-01. No capacity model (sprint-planner reads MEMORY.md preferences); PR creation owned by the GitHub code-connection profile.

## Layers

_Empty -- single Netlify deploy target. DORA reports degrade gracefully to single-layer._

## Project docs paths

_Empty -- using the default fallback `.claude/strap/project-docs/`._

## Project-specific behaviors

- **`entry-ssr.jsx` is a trap.** It looks like the SSR/SSG entry but is dead and broken (missing dep, wrong paths, stale routes). The real entry is `main.jsx`. Do not wire against `entry-ssr.jsx` without a deliberate decision to revive SSG (add `vite-react-ssg`, fix paths + route parity) -- and if you do, remove the `target:'es2015'` de-optimization only when SSG is retired, not while both coexist.
- **Duplicate route.** `App.jsx:61` (`/totdtrip`) and `App.jsx:67` (`/totdgallery`) both render `TailOfTheDragonGallery`; only `/totdgallery` is linked in `NavMenu`. `/totdtrip` is orphaned.
- **AdSense is 100% inert.** Every `AdSenseSlot` call site is commented out; `AdSenseSlot.jsx` reads `VITE_AD_CLIENT`/`VITE_AD_SLOT` env (undefined -- no `.env`) while the commented call sites pass `client=/slot=` props. The prop contract is mismatched -- reconcile `AdSenseSlot.jsx` to accept props (or add `.env`) before re-enabling any slot.
- **Four near-identical blog components** (`blog/{Panda,Miyoshi,Kiryu,Kasumi}/index.jsx`) differ only by JSON import + `<h2>`. `Miyoshi` (the NA blog) even names its map var `ndBlogList` (copy-paste leftover). #1 refactor target: collapse to a single data-driven `<BlogList data title />`.
- **Blog `id` must be a unique number** -- both the sort (`b.id - a.id`) and React `key={data.id}` assume it. A duplicate id silently breaks rendering.
- **Node version is unpinned** on Netlify (no `.nvmrc`, no `NODE_VERSION`). `sharp@0.34` needs Node >= 18.17. Pin Node to remove the biggest latent "worked last month, breaks on rebuild" risk.
- **Dead files to be aware of** (verify with owner before deleting): `src/entry-ssr.jsx`, `components/Footer/` (fully built, never rendered), `Gallery/NB/index.jsx` (unreferenced switcher), `src/assets/images/{nb,nd}/HillCountry/index.jsx` (gallery components misplaced in the assets tree), `Articles/2025/tailofthedragon.jsx` (import + route commented out), root `ads.txt` (only `public/ads.txt` is published), the `/totdtrip` route, and the `firebase` / `react-image-file-resizer` deps.
