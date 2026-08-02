# frontend-engineer memory

Your accumulated tradecraft for this project. Captures what you have learned about how to do your job well on THIS codebase.

Curated by the dev-lead. You read; you do not write. When you finish a task and notice something worth persisting, report it to the dev-lead in your finishing summary -- the dev-lead decides what gets added here.

## Project tradecraft

- **jeffgoji.com** is a small single-author car-blog SPA: React 18.2 + Vite 4.4, plain JSX (no TypeScript), React Router v6, React-Bootstrap 2.10 + Bootstrap 5.3. Local `useState` only -- no state library, and none is warranted at this size.
- **Real entry is `src/main.jsx`.** `src/App.jsx:47-68` is the authoritative flat route table. Ignore `src/entry-ssr.jsx` -- it is a dead, broken SSG entry (imports `vite-react-ssg` which is not in `package.json`, wrong component paths, stale route list). Do not wire against it.
- **Blog content is JSON-as-CMS.** Posts live in `src/assets/Data/{naBlog,MsmBlog,ndBlog,c8Blog}.json` as arrays of `{id,date,mileage,picture,cost,entry}`. `entry` is markdown, rendered by `react-markdown` + `remark-gfm` with custom `p/img/a` renderers. Pagination sorts by `id` desc, 3/page. `id` must be a unique number (sort + React key depend on it).
- **The four blog components (`blog/{Panda,Miyoshi,Kiryu,Kasumi}/index.jsx`) are near-identical** -- differ only by JSON import and `<h2>`. #1 refactor target: one data-driven `<BlogList data title />`. (Note `Miyoshi`/NA blog names its map var `ndBlogList` -- copy-paste leftover.)
- **Galleries are wired three ways** (static `images.js`; `images.js` + `_thumbs/chunk.js` + client canvas thumbnailing; or `fetch` of a build-time `manifest.json`). Only ND/TailOfTheDragon uses the sharp build pipeline. Consolidation is desirable -- the build pipeline is the "right" direction. `import.meta.globEager` (ND/HillCountry `images.js:7`) is deprecated and breaks on Vite 5.
- **Styling is a three-way split**: Bootstrap utilities + custom SCSS (`src/scss/styles.scss` via a separate script tag) + legacy `src/assets/css/style.css`. The SCSS `$theme-colors` override (`styles.scss:2`) is ineffective (Bootstrap imported before the map is defined); custom colors survive only because also hand-declared. Reconcile these before any theming work.
- **AdSense is entirely inert** -- every slot call site is commented out, and `AdSense/AdSenseSlot.jsx:7` takes no props / reads undefined `VITE_AD_*` env while the commented call sites pass `client=/slot=` props. Fix the prop contract before re-enabling.
- **Picture paths in blog JSON are root-relative without a leading slash** (`"images/na/..."`), served from `public/images/`. Works only because every route is a single path segment -- keep routes single-segment or fix the paths.
- **Analytics vendor is Plausible, manual-tracking mode** (`index.html` loads `script.manual.js`, not the default `script.js`). Plausible's default build auto-patches `history.pushState` and fires its own pageview on every SPA navigation -- combined with a manual `usePageviews()` hook that double-counts every route change. Settled shape (as of Task 00050): `src/lib/analytics.js` (vendor seam, `trackPageview()`) is the ONLY reporter; `src/hooks/usePageviews.js` + `src/components/CustomComponents/PageviewTracker.js` (null-render, mounted once inside `<BrowserRouter>` since `App` itself sits outside router context) drive it on `useLocation().pathname` change.
- **`src/lib/` and `src/hooks/` are new shared-module directories** (introduced by Task 00050; didn't exist before). Home for cross-component non-UI code (vendor seams, custom hooks) -- use them rather than inventing a third location.

## Anti-patterns to avoid

- Duplicate DOM ids in `NavMenu/index.jsx` (`id="basic-nav-dropdown"` twice at :22,25; `id="dropdown-basic"` x4 at :28,36,45,54) -- invalid HTML / a11y. Give unique ids when touching that file.
- `Navbar.Brand href="#home"` (`NavMenu/index.jsx:12`) is a hash anchor, not a router link -- the logo does not route Home. Use a router `Link`.
- Generic alt text (`alt="this post's pic"`, `blog/Panda/index.jsx:31`). Prefer descriptive alt.
- Redundant scroll handling: global `ScrollToTop` on route change AND per-blog `useEffect(scrollTo, [page])`.
- Garage data/image mismatch: `Garage/Cards.jsx:10,19` maps a 6th car image (Fireball id 6) but `Cars.json` has only 5 -- Fireball is unreachable; NC car (id 3) `bloglink` is `/`.
- Duplicate route `/totdtrip` (`App.jsx:61`) is orphaned; only `/totdgallery` is linked.

## Tool / environment quirks

- Windows dev host. Git repo since 2026-08-01 (`/connect-code-repo`); origin `https://github.com/JeffGoji/Jeffgoji.com-React-Site.git`, `gh` CLI auth. Watch for Windows path-length limits in deeply nested worktrees (long legacy image filenames) -- `git config core.longpaths true` fixes it.
- `scripts/build-gallery.mjs` helpers (`parseDateAlt`, `sortKeys`, `cleanName`) are not exported -- they must be exported (and `main()` guarded behind an entry check) before they're unit-testable. That refactor is frontend-owned.
- **Test runner bootstrapped 2026-08-01 (Task 00052): Vitest 1.6.1 + jsdom + @testing-library/react.** `npm test` = `vitest run`. Pinned to Vitest 1.x deliberately -- the repo is locked to Vite 4.4 (`import.meta.globEager` in `Gallery/HillCountry` breaks on Vite 5) and Vitest 2/3 pull a newer Vite peer. No project-wide Vitest config file exists or is needed -- each test file pins its own environment via a `@vitest-environment jsdom` docblock. Conventions: co-located `<Module>.test.js(x)` next to the module it tests (no `__tests__/` folders anywhere in this repo); repo-wide static assertions not about one module (e.g. an `index.html` meta guard) live in a top-level `test/` directory instead. Both are picked up by Vitest's default include glob.
- **Under jsdom, `import.meta.url` is a document-relative `http://` URL, not `file://`.** `fileURLToPath(new URL(..., import.meta.url))` throws `ERR_INVALID_URL_SCHEME`. Resolve fixture/file paths from `process.cwd()` instead (Vitest sets it to the project root).
- **`vite-plugin-eslint` is a dead devDependency -- it is never registered in `vite.config.js`.** Correction to this project's actual state (project-profile.md previously claimed "ESLint runs only as a Vite plugin"): **no lint enforcement runs anywhere in this project currently.** Don't assume an ESLint-vs-Vitest conflict exists without checking `vite.config.js` first -- the dependency's mere presence in `package.json` is not evidence it's wired up.
