# Stack

This document describes what jeffgoji.com is built with. It is the human-readable companion to `.claude/strap/contexts/project-profile.md`, which is the agent-facing canonical record.

## Languages

**JavaScript / JSX only.** There is no TypeScript, despite `@types/react` and `@types/react-dom` being declared in `devDependencies` -- those type packages are present but unused. Styling is authored in a mix of SCSS (`src/scss/styles.scss`), plain CSS (`src/assets/css/style.css`), and Bootstrap utility classes. The build-time gallery script (`scripts/build-gallery.mjs`) is plain ESM `.mjs`.

## Frameworks

Per active domain. Pulled from each `Domains` entry's `Stack` field in `project-profile.md`.

### client-ui

- **React 18.2** (plain JSX, no TypeScript), rendered via `ReactDOM.createRoot` in `src/main.jsx`.
- **Vite 4.4** as the build tool and dev server (`@vitejs/plugin-react`, `vite-plugin-eslint`).
- **React Router DOM v6** -- a single `<BrowserRouter>` with a flat route table in `src/App.jsx`. Client-only routing; no SSR/SSG in effect.
- **React-Bootstrap 2.10 + Bootstrap 5.3** for UI components and utility classes.
- **react-markdown v10 + remark-gfm v4** for rendering markdown blog content client-side with custom `p/img/a` renderers.
- **react-image-gallery 1.3** for photo galleries.

### infrastructure

- **Vite build** producing static assets into `dist/`.
- **Custom Node build script** (`scripts/build-gallery.mjs`) using **sharp 0.34** (native image processing) + **fast-glob 3.3** to generate webp gallery derivatives and a manifest.
- **Netlify** static hosting with per-push builds.

## Data stores

**None.** There is no database, no key-value store, and no server-side persistence. The closest thing to a datastore is the "JSON-as-CMS" content model: blog posts are stored as arrays of objects in `src/assets/Data/{naBlog,MsmBlog,ndBlog,c8Blog}.json`, bundled into the app at build time. There is no runtime write path and no user data.

## Package managers and dependency management

**npm** (a `package-lock.json` is committed). Dependencies are declared in `package.json`.

Be aware of three dependency oddities:

- **`firebase` (^10.7.1)** -- declared but never imported. Dead supply-chain surface; a safe-to-remove candidate.
- **`react-image-file-resizer` (^0.1.0)** -- declared but never imported. Also a safe-to-remove candidate.
- **`vite-react-ssg`** -- *referenced* by the dead `src/entry-ssr.jsx` but **not declared** in `package.json` at all, which is one reason that SSG entry is broken and non-functional.

The `@types/react*` packages are also present but unused (no TypeScript). See [`ARCHITECTURE.md`](./ARCHITECTURE.md#dead-files-to-be-aware-of) for the full dead-code inventory.

## Build and test

Commands the team runs locally and the pipeline runs in CI. Source of truth: `project-profile.md`'s `Build and test` section.

**Build:**

- `npm run build` = `npm run gallery:build && vite build` -- runs the sharp gallery pipeline, then produces the static bundle in `dist/`.
- `npm run gallery:build` = `node scripts/build-gallery.mjs` -- generates webp thumbs/display derivatives + `manifest.json` into `public/gallery/` (gitignored, rebuilt from scratch each run).
- `npm run dev` -- Vite dev server without rebuilding galleries.
- `npm run dev:gallery` -- rebuild galleries, then start the dev server.
- `npm run preview` -- serve a production build locally.

**Lint:** ESLint is configured (`.eslintrc.cjs`) but runs **only as a Vite plugin** -- there is no standalone `lint` npm script.

**Tests:** **None currently.** There is no test runner, no test files, and no `test` script. The recommended stack (per the test-strategist) is **Vitest + React Testing Library + jsdom** -- a native fit for Vite 4, able to run the `.mjs` build script and pure ESM helpers directly. Target scope is proportional: roughly 15-20 targeted tests, no e2e (Playwright/Cypress), no coverage-threshold gates, no snapshot testing. Highest-value targets, ranked:

1. Pure helpers in `scripts/build-gallery.mjs` (`parseDateAlt`, `sortKeys`, `cleanName`) -- highest ROI, but they must be exported and `main()` guarded behind an entry check first.
2. `src/components/Gallery/_thumbs/chunk.js` (`chunkItems` / `buildChunkMap`).
3. Blog JSON data-integrity across the four data files (every entry has all fields; `id` is a unique number; `picture` is non-empty and convention-consistent).
4. Route-parity guard (keep `App.jsx` routes in sync, or formally retire `entry-ssr.jsx`).
5. Blog pagination behavior (3/page, newest-id-first, Prev/Next disabling).

Once tests exist, the centralized-execution gate is `npm test` (= `vitest run`), run only by the dev-lead.

## Dev environment setup

What a new contributor needs to do to get a working local environment from a fresh clone.

1. Install a recent **Node 18+** (Node 20 recommended). The `sharp` native binary requires **Node >= 18.17** -- this is the one hard version constraint, and it is currently **unpinned** (no `.nvmrc`, no `NODE_VERSION` in `netlify.toml`).
2. `npm install` -- pulls all dependencies, including the `sharp` native binary and `fast-glob`.
3. `npm run dev` to start the app, or `npm run dev:gallery` to build galleries first.

Notes: this is a Windows dev host and is **not currently a git repository** (`/connect-code-repo` will establish this). `.env` files are gitignored and absent; none are required to run the site (the only env vars referenced -- `VITE_AD_CLIENT` / `VITE_AD_SLOT` for AdSense -- are unused because every ad slot is commented out).

## CI/CD overview

How code moves from a developer's branch through to deployable artifacts.

**Netlify's own per-push build is the CI/CD** -- there is no separate CI service, no GitHub Actions, no containers, and no IaC, which is correct for a personal SPA. Do **not** add GitHub Actions: it would duplicate the per-push build and create a second config to drift.

The pipeline: a `git push` triggers a Netlify build image that runs `npm install` (pulling the `sharp` native binary + `fast-glob`), then `npm run build` (`gallery:build` sharp resize -> `public/gallery/`, then `vite build` -> `dist/`), then publishes `dist/`. `netlify.toml` sets the command (`npm run build`) and publish directory (`dist`). SPA routing fallback comes from `public/_redirects` (`/* /index.html 200`).

`sharp` is the single most fragile link -- a native, Node-version-sensitive binary -- and Node is unpinned, so pinning the Node version (`[build.environment] NODE_VERSION="20"` or a `.nvmrc`) is the highest-value hardening for the pipeline.

_Work-tracking / DevOps integration is not yet wired; `/connect-devops-project` is pending. DORA and release-window reporting will populate once that connection exists._

## Hosting and infrastructure

Where the code runs in production (and lower environments). IaC tooling. Cloud surface.

**Netlify**, single static deploy target. The site is served as static files from Netlify's CDN at https://jeffgoji.com/. There is no server, no container, no lower environment, and no infrastructure-as-code -- the entire "infrastructure" is `netlify.toml` plus two static config files:

- `public/_redirects` -- `/* /index.html 200` SPA fallback (correct).
- `public/_headers` -- currently sets **cache policy only** (no security headers yet; see [`ARCHITECTURE.md`](./ARCHITECTURE.md#security-hardening-low)). Note the `immutable` cache header is applied to `/gallery/*` including non-content-hashed `original/` filenames, which can serve stale for a year -- `immutable` is only safe on the hashed `thumbs/` + `display/` webp derivatives.

## External integrations

Third-party services, SDKs, APIs, and external systems the codebase depends on.

### Google AdSense (inert)

The Google AdSense script (`pagead2.googlesyndication.com`) is loaded globally in `index.html`, and there is an `AdSenseSlot` component. However, **every ad slot call site is currently commented out**, so AdSense is 100% inert at runtime. The publisher IDs (`ca-pub-*`) in `index.html` and `public/ads.txt` are public by design. Before re-enabling any slot, reconcile the prop contract: `AdSenseSlot.jsx` reads `VITE_AD_CLIENT`/`VITE_AD_SLOT` env vars (undefined), while the commented call sites pass `client=`/`slot=` props.

### YouTube embeds

Static YouTube embed iframes in `src/components/YouTube/index.jsx`. URLs are hardcoded and not user-controlled.

### Firebase (declared but unused)

`firebase` (^10.7.1) is declared in `package.json` but **never imported** -- it is not an active integration. It is tree-shaken out of the bundle today (zero runtime surface) but remains a dead supply-chain dependency and a future footgun (someone could paste a Firebase config with keys). Recommended for removal.

## Where to learn more

- **Project orientation**: [`PROJECT.md`](./PROJECT.md) -- what this project IS and who it serves.
- **Architecture**: [`ARCHITECTURE.md`](./ARCHITECTURE.md) -- how the pieces fit together.
- **Agent context**: [`.claude/strap/contexts/project-profile.md`](../strap/contexts/project-profile.md) -- the canonical record agents read on every invocation; source of truth for `Stack`, `Build and test`, `DevOps integration`.
- **DevOps integration profile**: [`.claude/strap/state/devops-connection.yaml`](../strap/state/devops-connection.yaml), [`.claude/strap/state/code-connection.yaml`](../strap/state/code-connection.yaml) -- host wire-up details (read-only references; credentials live in env vars only).

---

_Maintained by the STRAP `tech-writer` agent through `/strap-in` (initial population) and `/strap-refresh` (surgical updates when project shape drifts). Edit through the dev-lead per the single-curator rule._
