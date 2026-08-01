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

## Anti-patterns to avoid

- Duplicate DOM ids in `NavMenu/index.jsx` (`id="basic-nav-dropdown"` twice at :22,25; `id="dropdown-basic"` x4 at :28,36,45,54) -- invalid HTML / a11y. Give unique ids when touching that file.
- `Navbar.Brand href="#home"` (`NavMenu/index.jsx:12`) is a hash anchor, not a router link -- the logo does not route Home. Use a router `Link`.
- Generic alt text (`alt="this post's pic"`, `blog/Panda/index.jsx:31`). Prefer descriptive alt.
- Redundant scroll handling: global `ScrollToTop` on route change AND per-blog `useEffect(scrollTo, [page])`.
- Garage data/image mismatch: `Garage/Cards.jsx:10,19` maps a 6th car image (Fireball id 6) but `Cars.json` has only 5 -- Fireball is unreachable; NC car (id 3) `bloglink` is `/`.
- Duplicate route `/totdtrip` (`App.jsx:61`) is orphaned; only `/totdgallery` is linked.

## Tool / environment quirks

- Windows dev host. Not currently a git repo.
- `scripts/build-gallery.mjs` helpers (`parseDateAlt`, `sortKeys`, `cleanName`) are not exported -- they must be exported (and `main()` guarded behind an entry check) before they're unit-testable. That refactor is frontend-owned.
