# Architecture

This document describes how jeffgoji.com is structured. It is the human-readable companion to `.claude/strap/contexts/project-profile.md`, which is the agent-facing canonical record.

## System shape

jeffgoji.com is a **client-only React single-page application**. There is no backend, no database, no authentication, and no user input -- the entire application runs in the visitor's browser and is served as static files from Netlify's CDN.

`index.html` is the HTML shell. It loads two things: `/src/main.jsx` (the React application) and `/src/scss/js/main.js` (which pulls in Bootstrap's CSS/JS and compiles the custom SCSS). `main.jsx` mounts the app via `ReactDOM.createRoot`. `App.jsx` wraps everything in a single `<BrowserRouter>`, renders a `<Header/>`, and dispatches to a **flat `<Routes>` table** (`App.jsx:47-68`) that is the single source of truth for routing. The `Home` route composes `Intro + Garage + YouTube` directly as components rather than as nested routes.

Content is not fetched from a server. Blog posts live as markdown-in-JSON inside the bundle, and galleries are either bundled image arrays or static assets fetched from the CDN. The only runtime network calls to third parties are the Google AdSense script (currently inert) and static YouTube embed iframes.

## Active domains

The logical concerns the codebase is decomposed into. Each domain has a defined specialist roster (in `project-profile.md`'s `Domains` section) and a `Source-of-truth` set of paths where that domain's code lives.

### client-ui

**Status:** active. **Specialists:** frontend-engineer, security-reviewer, test-strategist.

The browser-facing React application: routing, page composition, the blog renderer, galleries, navigation, and styling. Built with React 18.2 + Vite 4.4, plain JSX (no TypeScript), React Router v6, React-Bootstrap 2.10 + Bootstrap 5.3, `react-markdown` + `remark-gfm` for blog content, and `react-image-gallery` for photo galleries. State is local `useState` only -- there is no Redux, Context store, or global state library, which is appropriate at this size.

Conventions that matter here: the real entry is `src/main.jsx` and the authoritative route table is `App.jsx:47-68` (ignore `src/entry-ssr.jsx`, which is dead). Components follow a folder-per-component layout (`components/<Name>/index.jsx`). Blog content is authored as markdown inside JSON data files and must be rendered **only** through `react-markdown` + `remark-gfm` -- do not introduce raw-HTML rendering without sanitization (see [Anti-patterns and gotchas](#anti-patterns-and-gotchas)).

Source of truth: `src/App.jsx`, `src/main.jsx`, `src/components/blog/*/index.jsx`, `src/assets/Data/*Blog.json`, `src/components/Gallery/`.

### infrastructure

**Status:** active. **Specialists:** devops-lead.

The build and deploy layer: the Vite build, the custom Node gallery pipeline, and Netlify static hosting. Built around Vite build, a custom Node build script (`scripts/build-gallery.mjs`, using `sharp` + `fast-glob`), and Netlify's static hosting with per-push builds.

The key convention: **Netlify's own per-push build is the CI/CD** -- do not add GitHub Actions, which would duplicate the build and create a second config to drift. The build chain is `gallery:build` (sharp image resize) -> `vite build` -> `dist/`. `sharp` is a native binary and is the single most fragile link in the build.

Source of truth: `netlify.toml`, `public/_redirects`, `public/_headers`, `scripts/build-gallery.mjs`, `vite.config.js`.

### Dormant domains

No signal at onboarding, so these are not activated: backend-engineer, database-engineer, integration-specialist, designer, ux-test-engineer. They can be activated later via `/strap-refresh` if the project grows into them.

## Data flow

How information moves through the system. Request paths, event paths, batch paths.

There is no server round-trip -- all data flow is client-side and build-time. Three paths matter:

- **Client render.** `main.jsx` boots React; `App.jsx` reads the current URL and renders the matching route from its flat table. Pages compose presentational components directly.
- **Blog content (markdown-in-JSON).** Each blog component imports its JSON data file (`src/assets/Data/{naBlog,MsmBlog,ndBlog,c8Blog}.json`), an array of `{id, date, mileage, picture, cost, entry}` objects. Posts are sorted by `id` descending, paginated client-side (3 per page), and each post's markdown `entry` field is rendered by `react-markdown` + `remark-gfm` with custom `p/img/a` renderers. `picture` paths are root-relative without a leading slash and resolve against `public/images/`.
- **Gallery manifest fetch.** The ND/TailOfTheDragon gallery fetches `/gallery/nd-totd2025/manifest.json` at runtime -- a file produced at build time by the `sharp` pipeline in `scripts/build-gallery.mjs`, which emits webp thumbs/display derivatives plus the manifest into `public/gallery/`. Other galleries do not use this path (see [Architectural conventions](#architectural-conventions-worth-knowing)).

## Key boundaries

Where one part of the system hands off to another. Internal service boundaries, external integration surfaces, trust boundaries, transactional boundaries.

- **Build-time vs. runtime.** The `sharp` gallery pipeline runs at build time and writes static webp assets + a manifest into `public/gallery/`; the browser consumes those artifacts at runtime via `fetch`. This is the only real producer/consumer handoff in the system.
- **Content-authoring boundary.** Blog content enters the system only by hand-editing JSON data files in the repo -- an owner-only path. There is no runtime write path, so no user-supplied content reaches the DOM.
- **External integration surface.** Two outbound third-party surfaces: Google AdSense (`pagead2.googlesyndication.com`, script in `index.html`, currently inert) and hardcoded YouTube embed iframes (`src/components/YouTube/index.jsx`). Both use hardcoded, non-user-controlled URLs.
- **Trust boundary.** Effectively none internal to the app: no backend, no auth, no database, no user input, no secrets in source. The markdown blog renderer is the one place content becomes DOM, and it is safe only as long as it stays configured without raw-HTML rendering.

## Layering

The system is a single deployable: static assets built by Vite and served by Netlify. There is no service tier, no API layer, and no persistence tier. The meaningful layering is thin -- a presentation layer (React components + styling) sitting on top of a bundled content layer (JSON data + image assets), with a build-time asset-generation step feeding the CDN. DORA and multi-layer reporting degrade gracefully to this single Netlify deploy target.

## Architectural conventions worth knowing

Patterns that recur across the codebase and inform new work. Pulled from the curated `Architecture notes` in `project-profile.md` and from specialist deep-dives.

### JSON-as-CMS blog content

Blog posts are arrays of objects in `src/assets/Data/{naBlog,MsmBlog,ndBlog,c8Blog}.json` with fields `id / date / mileage / picture / cost / entry`. The `entry` field is markdown, rendered client-side. The `id` must be a **unique number** -- both the sort (`b.id - a.id`) and the React `key={data.id}` depend on it, and a duplicate id silently breaks rendering. Pagination sorts by `id` descending, 3 posts per page.

### Local state only

The app uses local `useState` exclusively -- no Redux, no Context store, no external state library. This is deliberate and appropriate for the site's size; do not introduce a state library without a clear driver.

### Folder-per-component layout

Components predominantly follow `components/<Name>/index.jsx`, with some flat single-file components. New components should follow the folder-per-component pattern.

### Markdown-only content rendering

Blog markdown is rendered strictly through `react-markdown` + `remark-gfm` with custom `p/img/a` renderers -- no `rehype-raw`, no `dangerouslySetInnerHTML`, no `DOMPurify`. This keeps raw HTML in a JSON `entry` escaped as text. Outbound links from the blog renderers correctly set `target="_blank" rel="noreferrer"`, with props spread before target/rel so markdown cannot override them.

## Anti-patterns and gotchas

Things the codebase has been bitten by before. Surfaces inferred from history, from specialist findings, from CPO correction.

### `entry-ssr.jsx` is a trap

`src/entry-ssr.jsx` looks like the SSR/SSG entry but is **dead and broken**: it imports `vite-react-ssg` (which is not declared in `package.json`), uses wrong component paths, and carries a stale route list. Nothing loads it. The real entry is `main.jsx`. Do not wire against `entry-ssr.jsx` without a deliberate decision to revive SSG (add the dep, fix paths, restore route parity). Vestiges of this abandoned prerender attempt remain across the codebase: the `Object.hasOwn` polyfill (`main.jsx:1-5`), the `custom-render-ready` dispatch (`App.jsx:38-40`), and `vite.config.js:8` forcing `target:'es2015'` "so JSDOM can parse it" -- which now just ships a larger down-transpiled bundle to every real visitor for a prerender that never runs.

### Three unconsolidated gallery-wiring patterns

Galleries use `react-image-gallery` wired three different ways: (a) a static `images.js` array of Vite-imported jpgs; (b) `images.js` + `_thumbs/chunk.js` + client-side canvas thumbnailing (ND/HillCountry); (c) a `fetch('/gallery/nd-totd2025/manifest.json')` from the sharp build pipeline (ND/TailOfTheDragon). Only (c) consumes the build pipeline. Worse, `nd-hillcountry` is configured in `build-gallery.mjs` but its component ignores the built output -- wasted build time and CDN storage -- and it relies on the **deprecated** `import.meta.globEager`, removed in Vite 5. Consolidating toward the build-pipeline approach (c) is the desirable direction.

### Three styling systems

Styling is a three-way split: Bootstrap utilities (primary) + custom SCSS (`src/scss/styles.scss`, loaded via a separate script tag) + legacy `src/assets/css/style.css` (imported at `App.jsx:34`), plus scattered inline `style={{}}`. The SCSS `$theme-colors` override at `styles.scss:2` is **ineffective** (it imports Bootstrap before defining the map); custom colors work only because they are also hand-declared. Reconcile these before any theming work.

### Duplicate / orphaned route

`App.jsx:61` (`/totdtrip`) and `App.jsx:67` (`/totdgallery`) both render `TailOfTheDragonGallery`, but only `/totdgallery` is linked in `NavMenu`. `/totdtrip` is orphaned.

### AdSense is 100% inert

Every `AdSenseSlot` call site is commented out. `AdSenseSlot.jsx` reads `VITE_AD_CLIENT` / `VITE_AD_SLOT` env vars (undefined -- there is no `.env`), while the commented call sites pass `client=` / `slot=` props. The prop contract is mismatched -- reconcile `AdSenseSlot.jsx` to accept props (or add a `.env`) before re-enabling any slot.

### Four near-identical blog components

`blog/{Panda,Miyoshi,Kiryu,Kasumi}/index.jsx` differ only by JSON import and `<h2>` heading. `Miyoshi` (the NA blog) even names its map variable `ndBlogList` -- a copy-paste leftover. The top refactor target is collapsing these to a single data-driven `<BlogList data title />`.

### Dead files to be aware of

Verify with the owner before deleting: `src/entry-ssr.jsx`, `components/Footer/` (fully built, never rendered), `Gallery/NB/index.jsx` (unreferenced switcher), `src/assets/images/{nb,nd}/HillCountry/index.jsx` (gallery components misplaced in the assets tree), `Articles/2025/tailofthedragon.jsx` (import + route commented out), the root `ads.txt` (only `public/ads.txt` is published), the `/totdtrip` route, and the `firebase` / `react-image-file-resizer` dependencies.

### Security hardening (Low)

No Critical or High findings at onboarding. Open low-risk items: `public/_headers` sets only `Cache-Control` -- no CSP, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, or HSTS. A CSP is non-trivial because of the Google ad stack; introduce it in report-only mode first, tuned against `pagead2.googlesyndication.com` + `youtube.com/embed`, before enforcing. The unused `firebase` SDK is a dead supply-chain surface (tree-shaken out today) and a candidate for removal.

## Diagrams

_To be populated in a future /strap-refresh once an architecture diagram is authored. The system is small enough that the [System shape](#system-shape) and [Data flow](#data-flow) prose describe it fully in the interim._

## Where to learn more

- **Project orientation**: [`PROJECT.md`](./PROJECT.md) -- what this project IS and who it serves.
- **Stack**: [`STACK.md`](./STACK.md) -- languages, frameworks, build commands.
- **Agent context**: [`.claude/strap/contexts/project-profile.md`](../strap/contexts/project-profile.md) -- the canonical record agents read on every invocation; source of truth for active domains, conventions, build/test, layers.

---

_Maintained by the STRAP `tech-writer` agent through `/strap-in` (initial population) and `/strap-refresh` (surgical updates when project shape drifts). Edit through the dev-lead per the single-curator rule._
