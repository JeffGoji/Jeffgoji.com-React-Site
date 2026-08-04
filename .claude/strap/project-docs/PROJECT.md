# jeffgoji.com

A single-author car-enthusiast blog and showcase, built as a client-only React single-page app.

## What this project is

jeffgoji.com is the personal website of Jeff "Goji" Anderson-Lester -- a car-enthusiast blog and showcase covering Mazda Miata builds (NA / MSM / ND), a Corvette C8, autocross recaps, tuning and suspension technical articles, photo galleries, and embedded YouTube videos. It is live at https://jeffgoji.com/.

Technically, it is a small React 18 + Vite single-page application with **no backend, no database, and no authentication**. Blog content is authored as markdown strings inside JSON data files (a "JSON-as-CMS" model) and rendered client-side. Photo galleries are served from static assets, with one gallery consuming a build-time image pipeline. The site is deployed as static files to Netlify.

Because there is no server, no user input, and no stored data, the trust surface is small: this is a public content site, not an application with an internal trust boundary.

## Who it serves

Two audiences, both simple:

- **Readers** -- car enthusiasts and visitors browsing build logs, technical articles, galleries, and videos. No accounts, no interaction beyond navigation.
- **The author** -- Jeff, the sole content author and maintainer. Content is added by hand-editing the JSON data files; there is no admin UI or CMS. The authoring path is owner-only.

This is a personal site with a single maintainer; there is no team, no external contributor pipeline, and no customer-facing SLA.

## How to get started

From a fresh checkout:

```bash
npm install        # pulls sharp (native binary) + fast-glob for the gallery pipeline
npm run dev        # start the Vite dev server
```

`npm run dev` serves the app without rebuilding galleries. Use `npm run dev:gallery` to run the sharp gallery build first, then start the dev server. A full production build is `npm run build` (gallery build -> `vite build` -> `dist/`).

Note: the `sharp` native binary requires **Node >= 18.17**. The project does not currently pin a Node version, so use a recent Node 18+ (Node 20 recommended). See [`STACK.md`](./STACK.md) for the full dev-environment walkthrough.

## Repository layout

```
/
├── index.html              # HTML shell; loads /src/main.jsx and the SCSS/Bootstrap bundle; hosts the (inert) AdSense script
├── netlify.toml            # Netlify build config (command: npm run build, publish: dist)
├── package.json            # deps + npm scripts (dev / build / gallery:build)
├── vite.config.js          # Vite config (react plugin, eslint plugin, target es2015)
├── scripts/
│   └── build-gallery.mjs   # sharp + fast-glob build-time image pipeline -> public/gallery/
├── public/
│   ├── _redirects          # SPA fallback: /* /index.html 200
│   ├── _headers            # cache headers (security headers not yet set)
│   ├── images/             # blog + car photos, served root-relative
│   └── gallery/            # generated webp thumbs/display + manifest.json (gitignored, rebuilt)
└── src/
    ├── main.jsx            # REAL entry point (ReactDOM.createRoot) -- authoritative
    ├── App.jsx             # <BrowserRouter> + flat route table (source of truth for routes)
    ├── entry-ssr.jsx       # DEAD/broken SSG entry -- do not wire against it (see ARCHITECTURE.md)
    ├── assets/
    │   ├── Data/           # blog JSON (naBlog/MsmBlog/ndBlog/c8Blog) + Cars.json
    │   ├── css/            # legacy style.css
    │   └── images/         # bundled image assets
    ├── scss/               # custom SCSS (styles.scss) compiled via a separate script tag
    └── components/         # AdSense, Articles, blog, CustomComponents, Footer, Gallery,
                            #   Garage, Header, NavMenu, pages, Suspension, YouTube
```

Components predominantly follow a folder-per-component layout (`components/<Name>/index.jsx`), with some flat single-file components.

## Where to learn more

- **Architecture**: [`ARCHITECTURE.md`](./ARCHITECTURE.md) -- how the code is structured, how the pieces fit together, key boundaries and data flows.
- **Stack**: [`STACK.md`](./STACK.md) -- languages, frameworks, runtimes, build/test commands, dev environment setup.
- **Agent context**: [`.claude/strap/contexts/project-profile.md`](../strap/contexts/project-profile.md) -- the canonical record every STRAP agent reads on every invocation. The source of truth this document is distilled from.
- **Onboarding the dev pipeline**: [`CLAUDE.md`](../../CLAUDE.md) -- the super-pair model + how the agent stack works on this project.

## Status

Live in production at https://jeffgoji.com/, deployed via Netlify. Actively authored by a single owner. STRAP onboarding completed 2026-08-01 with deep-dives by the frontend, security, test, and devops specialists.

Not yet wired: this is **not yet a git repository** (`/connect-code-repo` will establish this) and DevOps/work-tracking integration is pending (`/connect-devops-project`). There are **no automated tests** today; a Vitest + React Testing Library stack is recommended (see [`STACK.md`](./STACK.md)). Known cleanup targets (dead SSG code, a duplicate route, inert AdSense, three unconsolidated gallery patterns, three styling systems, unused dependencies, and an unpinned Node version) are documented in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

_This document is maintained by the STRAP `tech-writer` agent through `/strap-in` (initial population) and `/strap-refresh` (surgical updates when project shape drifts). Edit through the dev-lead per the single-curator rule; direct in-place edits will surface on the next `/strap-refresh` drift detection._
