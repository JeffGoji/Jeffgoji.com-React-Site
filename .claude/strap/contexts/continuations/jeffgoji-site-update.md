---
topic: jeffgoji-site-update
last_updated: 2026-11-10T17:33:34Z
last_author: dev-lead
status: parked
linked_work_items: []
---

# jeffgoji.com V2 site update

## What this is

The V2 initiative for jeffgoji.com: a full "new everything" redesign — modern dark motorsport-editorial look, image-loading/performance overhaul, and a self-documenting "V2 What's New" page. Features A, B, C, and D are all fully resolved and merged to `main` (Spec 00002 itself is `resolved`). Post-launch, this initiative has settled into a tail of one-off Bug fixes and small feature/content additions, all handled directly (no Requirement/Spec ceremony) given their scope. No active work items remain in `.claude/strap/work/` — this continuation exists for the loose ends below, not for in-flight execution.

## Where we left off

Session parked at a natural stopping point, not mid-task. One Bug fix landed, pushed direct-to-main (`986d7e0`), and the Netlify deploy is confirmed live (`assets/index-20f62d2d.css`). Working tree clean apart from this continuation file.

**Bug: lightbox "Download full resolution" button unclickable** (CPO report, NB Autocross gallery).
- Root cause: a specificity tie, not a viewport or portrait-photo issue. react-image-gallery 1.3.0's `.image-gallery-content .image-gallery-slide .image-gallery-image { max-height: calc(100vh - 80px) }` tied our three-class `.lightbox__stage .image-gallery-slide .image-gallery-image { max-height: 78vh }` and won on stylesheet order (the library CSS is imported from `GalleryLightbox.jsx`, so it lands later in the bundle).
- Effect: the frame grew past the 78vh stage and its `<img>` overlaid the caption and download anchor, swallowing clicks on wide/short viewports — 75 of 79 Autocross frames on a 1707x769 desktop window. The earlier mobile fix (`94c34f5`) addressed a different overflow and did not touch this.
- Fix (`src/scss/styles.scss`): both the desktop and the `max-width: 768px` image rules now use `.lightbox__stage .image-gallery-content .image-gallery-slide .image-gallery-image` (four classes).
- Side effect fixed in the same commit: frames now letterbox inside the stage, and the editorial grade's white-centred `multiply` `::after` painted the transparent letterbox white. `.lightbox__frame` now has `background: rgb(3, 3, 4)`.
- Tests: `GalleryLightbox.test.jsx` selector assertion updated, plus a new regression test asserting the four-class 78vh cap. Full suite 1201 passing.
- Verified on production: all 79 Autocross frames have the download anchor on screen and hit-testable (`elementFromPoint`) at desktop size; the letterbox renders dark.
- **Not verified**: phone-width behaviour on prod. The Chrome window would not resize below desktop width (likely maximized). The CPO was asked to spot-check on a real phone.

Also confirmed this session: the production gallery hub lists `nb-autox` ("NB — Autocross 2008 - 2019", 79 frames), closing the prior session's deploy check for the gallery itself. The NB nav submenu entry and the home hero CTA text were not explicitly checked.

## Files in flight

None besides this continuation file (uncommitted). `main` synced with origin at `986d7e0`; no worktrees or scratch branches.

## Open decisions

- **No lightweight tracking record (Bug/Task YAML) has been created** for the five recent untracked changes (video hub, Miatas-at-the-Gap photo upload, dynamic CTA, NB Autocross gallery, lightbox download-button fix). `.claude/strap/work/.next-id` is still `81`. The CPO hasn't said whether tracking consistency matters enough to backfill.
- **Two Lighthouse numbers remain un-transcribed** (carried over). `.claude/strap/project-docs/v1-perf-baseline.md`'s Phase-3 section is still incomplete.
- **What's New page's metric tiles are stale relative to reality** (carried over). `src/components/WhatsNew/data/metrics.js`'s image-payload tile is still `target: true` at `-50%`.
- **Two AC gaps remain open, unfiled** (carried over): home mobile LCP (6543ms vs. 2500ms target, CSS-background hero image lacking `fetchpriority`/preload) and gallery desktop's 49.9%-vs-50% image-byte-reduction miss.
- **New-gallery registration is still a manual four-file step** (`GALLERIES`, `GALLERY_SETS`, NavMenu item, `SUBMENU_FOR_SLUG` in `App.test.jsx`) — reminder, not a defect.
- **Where the CPO wants the GoPro video** (`GOPR0466_1.mp4`) — if it should appear on the site, it belongs on YouTube/the video hub playlist, not in the repo.

## Open work items

None active. All Feature/Story/Task/Bug work items in `.claude/strap/work/` are `resolved` (`.next-id` is `81`).

## Quick resume

1. **Ask the CPO whether the phone spot-check passed** for the lightbox download button on prod (open any gallery photo, scroll the overlay, tap "Download full resolution"). If it failed, debug at 390px with a non-maximized Chrome window or DevTools device mode.
2. **Finish the old deploy check**: the prod NB nav submenu lists "Autocross 2008 - 2019" and the home hero ghost CTA reads "Autocross 2008 - 2019 gallery".
3. If the CPO wants tracking consistency: file Bug/Task YAML entries for the five untracked changes, mirroring Task 00081's after-the-fact pattern.

## Critical context

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
- **PR/merge convention for this tail of work**: direct to `main`, no PR ceremony, but push only when the CPO says so.
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
- `src/components/WhatsNew/data/metrics.js` — What's New metric tiles.
- `.claude/strap/state/{code,devops}-connection.yaml` — GitHub (JeffGoji/Jeffgoji.com-React-Site) + local strap-agile connection profiles.
