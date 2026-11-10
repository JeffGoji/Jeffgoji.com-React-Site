---
topic: jeffgoji-site-update
last_updated: 2026-11-10T18:05:00Z
last_author: dev-lead
status: parked
linked_work_items: []
---

# jeffgoji.com V2 site update

## What this is

The V2 initiative for jeffgoji.com: a full "new everything" redesign — modern dark motorsport-editorial look, image-loading/performance overhaul, and a self-documenting "V2 What's New" page. Features A, B, C, and D are all fully resolved and merged to `main` (Spec 00002 itself is `resolved`). Post-launch, this initiative has settled into a tail of one-off Bug fixes and small feature/content additions, all handled directly (no Requirement/Spec ceremony) given their scope. No active work items remain in `.claude/strap/work/` — this continuation exists for the loose ends below, not for in-flight execution.

## Where we left off

Session parked at a natural stopping point, not mid-task. The What's New page was redesigned and merged to `main` via PR #32 (merge commit `c31a8f5`, feature commit `bcfb917`) after the CPO reviewed screenshots and approved. Both Netlify deploy previews built green before merge; the production deploy itself was not checked from this session.

**What's New redesign** (CPO request: showcase the last 6 months of site updates with direct links, keep the old page as a backup).
- `/whats-new` is now `src/components/WhatsNew/index.jsx`: a dated timeline, newest first, grouped by month, with a "Latest" feature card, per-category counts and filter chips (`aria-pressed`). Content is `src/components/WhatsNew/data/recentUpdates.js` — 14 entries, 2026-05-27 to 2026-11-10, each with one or more in-site links. Styles are the `ru-*` block at the end of `src/scss/styles.scss`; the `.wn-dash` band and `.wn-ledger__inner` measure are reused.
- **Backup**: the previous V2 launch ledger is kept unchanged as `WhatsNew/V2Launch.jsx` (+ `V2Launch.test.jsx`, the old `index.test.jsx` renamed), served at `/whats-new/v2-launch`. `Changelog.jsx`, `InstrumentCluster.jsx`, `data/whatsNew.js`, `data/metrics.js` are untouched and now only feed the archive page.
- **Deep links to blog posts**: `BlogList` puts `id="post-<id>"` on each post (`scroll-margin-top` clears the sticky nav) and `ScrollToTop` now scrolls to a `#hash` target (instant, not smooth) instead of always to the top. Used by `/nd-blog#post-9`.
- Tests: new `WhatsNew/index.test.jsx` and `data/recentUpdates.test.js`; `App.test.jsx` asserts every `recentUpdates` link resolves to a served route (verified it fails on a bogus path) and that `/whats-new/v2-launch` is served. Full suite 1251 passing; `vite build` green. Checked at 1366px and 390px in Playwright: no horizontal overflow.

Prior session's lightbox download-button fix (`986d7e0`) is live; its phone-width prod spot-check is still unconfirmed (see Quick resume).

## Files in flight

None. `main` synced with origin; the feature branch was deleted after merge.

## Open decisions

- **No lightweight tracking record (Bug/Task YAML) has been created** for the six recent untracked changes (video hub, Miatas-at-the-Gap photo upload, dynamic CTA, NB Autocross gallery, lightbox download-button fix, What's New redesign). `.claude/strap/work/.next-id` is still `81`. The CPO hasn't said whether tracking consistency matters enough to backfill.
- **Two Lighthouse numbers remain un-transcribed** (carried over). `.claude/strap/project-docs/v1-perf-baseline.md`'s Phase-3 section is still incomplete.
- **The archived V2 launch page's metric tiles are stale** (carried over, lower priority now). `src/components/WhatsNew/data/metrics.js` only feeds `/whats-new/v2-launch`; its image-payload tile is still `target: true` at `-50%`.
- **Two AC gaps remain open, unfiled** (carried over): home mobile LCP (6543ms vs. 2500ms target, CSS-background hero image lacking `fetchpriority`/preload) and gallery desktop's 49.9%-vs-50% image-byte-reduction miss.
- **New-gallery registration is still a manual four-file step** (`GALLERIES`, `GALLERY_SETS`, NavMenu item, `SUBMENU_FOR_SLUG` in `App.test.jsx`) — reminder, not a defect.
- **Where the CPO wants the GoPro video** (`GOPR0466_1.mp4`) — if it should appear on the site, it belongs on YouTube/the video hub playlist, not in the repo.

## Open work items

None active. All Feature/Story/Task/Bug work items in `.claude/strap/work/` are `resolved` (`.next-id` is `81`).

## Quick resume

1. **Ask the CPO whether the phone spot-check passed** for the lightbox download button on prod (open any gallery photo, scroll the overlay, tap "Download full resolution"). If it failed, debug at 390px with a non-maximized Chrome window or DevTools device mode.
2. **Finish the old deploy check**: the prod NB nav submenu lists "Autocross 2008 - 2019" and the home hero ghost CTA reads "Autocross 2008 - 2019 gallery".
3. **Confirm the What's New redesign is live on prod**: `/whats-new` shows the timeline, `/whats-new/v2-launch` shows the old ledger, and the Kasumi entry's link lands on that post.
4. If the CPO wants tracking consistency: file Bug/Task YAML entries for the six untracked changes, mirroring Task 00081's after-the-fact pattern.

## Critical context

- **Shipping anything user-visible = add a `recentUpdates.js` entry** at the top of the array (date, one of `CATEGORIES`, title, summary, links). Gallery links go through `galleryHubPath(slug)`; blog posts via `/<blog>#post-<id>`. `App.test.jsx` fails if a link's route doesn't exist. Plain text only.
- **Adding a gallery = four edits**: `GALLERIES` in `build-gallery.mjs`, `GALLERY_SETS` in `gallerySets.js` (needs a `legacyPath` starting with `/` — a test enforces it, and `App.jsx` redirects from it), a NavMenu `Dropdown.Item`, and `SUBMENU_FOR_SLUG` in `App.test.jsx`.
- **Build a single gallery without the 13-minute full run**: `node --input-type=module -e "import {GALLERIES,buildGallery} from './scripts/build-gallery.mjs'; await buildGallery(GALLERIES.find(g=>g.id==='<id>'))"` (does not rewrite `latest.json`).
- **The gallery glob is case-insensitive** (`caseSensitiveMatch: false`) — upper-case `.JPG` camera exports are included; output filenames keep the original case (`DSC02132.JPG.webp`).
- **GitHub rejects files over 100 MB** — check source-folder drops for videos/huge files before `git add`; `*.mp4` under `src/assets/images/` is gitignored.
- **Overriding react-image-gallery CSS needs more than three classes** — its `.image-gallery-content .image-gallery-slide .image-gallery-image` rules load after `styles.scss`, so a specificity tie silently loses.
- **`.media--editorial` isolates a white-centred `multiply` overlay** — any transparent area inside a graded wrapper paints near-white, so give the wrapper an opaque dark background.
- **Prod deploys are Netlify (no GitHub Actions)** — to confirm one, poll the hashed `assets/index-*.css` name on `/galleries` until it changes, then grep it for the new rule.
- **Lightbox hit-testing in Chrome automation**: wait ~700ms after a slide nav before `elementFromPoint`, or the mid-transition slide reads as a false overlap.
- **No Python on this machine** — use Node or the Edit tool for scripted edits; avoid long inline `node -e` scripts in Bash (nested quoting breaks).
- **An older duplicate checkout exists at `Documents\WebProjects\Jeffgoji.com-React-Site`** — not this repo; don't edit or pull assets from it unless the CPO asks.
- **`public/gallery/latest.json` is derived from git commit history on each gallery's `srcDir`, not filesystem mtime** — Netlify clones fresh, so mtime would be meaningless.
- **The home hero's ghost CTA is 100% data-driven** — it silently repoints to whichever gallery was committed most recently; a pinned gallery would be a product decision.
- **YouTube's playlist RSS feed caps at 15 items, returns playlist order, and never includes duration or view count**.
- **TOML requires quoted string values** — an unquoted value in `netlify.toml` breaks the whole file.
- **`scripts/perf/lh-baseline.mjs` prints to stdout, writes no artifact**; Lighthouse must be installed out-of-tree (`C:\lh`).
- **`gallery:build` takes ~13 minutes** (mozjpeg); plain `npm run dev` does NOT rebuild galleries.
- **Vitest double-counts tests if a worktree still exists** — `git worktree remove` first.
- **PR/merge convention for this tail of work**: small fixes go direct to `main`; larger changes (like the What's New redesign) go through a PR the CPO reviews. Push or merge only when the CPO says so.
- **`CreateTeam` is unavailable in this harness** — use `git worktree add -b <branch>` + named background `Agent` dispatch.
- **react-bootstrap derives selection `eventKey` from `href`, not react-router's `to`** — nav items need an explicit `eventKey`.
- **Don't forget `/context-prep` before ending a session.**

## Source-of-truth pointers

- `scripts/build-gallery.mjs` — gallery build pipeline: `GALLERIES`, `buildGallery()`, `lastCommitDate()`, `pickLatest()`, `writeLatest()`.
- `src/components/common/GalleryLightbox.jsx` + `src/scss/styles.scss` (`.lightbox*` block) — lightbox overlay, download anchor, stage/frame sizing.
- `src/scss/_grade.scss` — editorial grade (`.media--editorial*`).
- `src/components/common/gallerySets.js` — `GALLERY_SETS` + `galleryHubPath(slug)`; must stay in sync with `GALLERIES`.
- `src/components/NavMenu/index.jsx` — per-chassis gallery submenus.
- `src/App.test.jsx` — `SUBMENU_FOR_SLUG` and legacy-path redirect tests.
- `src/components/common/latestGallery.js` + `src/components/Hero/index.jsx` — dynamic newest-gallery CTA.
- `src/components/YouTube/` — video hub; `videoManifest.js` is the fetch pattern `latestGallery.js` mirrors.
- `netlify.toml` — `VIDEOS_PLAYLIST_ID` committed here (not secret).
- `.claude/strap/project-docs/v1-perf-baseline.md` — V1 comparison doc; Phase-3 section incomplete.
- `src/components/WhatsNew/data/recentUpdates.js` — the live What's New timeline content.
- `src/components/WhatsNew/V2Launch.jsx` — archived V2 launch page (`/whats-new/v2-launch`); `data/metrics.js` + `data/whatsNew.js` feed only it.
- `src/components/CustomComponents/ScrollToTop.js` — route-change scroll, honours `#hash`.
- `.claude/strap/state/{code,devops}-connection.yaml` — GitHub (JeffGoji/Jeffgoji.com-React-Site) + local strap-agile connection profiles.
