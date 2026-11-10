---
topic: jeffgoji-site-update
last_updated: 2026-11-10T17:00:33Z
last_author: dev-lead
status: parked
linked_work_items: []
---

# jeffgoji.com V2 site update

## What this is

The V2 initiative for jeffgoji.com: a full "new everything" redesign — modern dark motorsport-editorial look, image-loading/performance overhaul, and a self-documenting "V2 What's New" page. Features A, B, C, and D are all fully resolved and merged to `main` (Spec 00002 itself is `resolved`). Post-launch, this initiative has settled into a tail of one-off Bug fixes and small feature/content additions, all handled directly (no Requirement/Spec ceremony) given their scope. No active work items remain in `.claude/strap/work/` — this continuation exists for the loose ends below, not for in-flight execution.

## Where we left off

Session parked at a natural stopping point, not mid-task. One piece of work landed, pushed direct-to-main (`24be52a`), working tree clean:

**New gallery: NB "Autocross 2008 - 2019"** (79 photos). CPO dropped the photos into `src/assets/images/nb/Autocross/` and asked for a gallery named "Autocross 2008 - 2019".
- Registered in all four places a gallery must be:
  - `scripts/build-gallery.mjs` `GALLERIES`: `{ id: "nb-autox", label: "Autocross 2008 - 2019", srcDir: "src/assets/images/nb/Autocross" }` (placed after `nb-hillcountry`).
  - `src/components/common/gallerySets.js` `GALLERY_SETS`: slug `nb-autox`, car `NB Mazdaspeed Miata`, label `NB — Autocross 2008 - 2019` (car-prefix convention), `legacyPath: '/nb-autox'` (no real pre-V2 route existed; mirrors `c8-autox`'s pattern — `App.jsx` builds a redirect from every `legacyPath`).
  - `src/components/NavMenu/index.jsx`: new `Dropdown.Item` "Autocross 2008 - 2019" in the NB submenu.
  - `src/App.test.jsx` `SUBMENU_FOR_SLUG`: `'nb-autox': 'nb-gallery-dropdown-toggle'`.
- **Fixed a latent pipeline gap**: the fast-glob in `buildGallery()` was case-sensitive, so `DSC02132.JPG` and `P2010075.JPG` were silently dropped (77 of 79). Added `caseSensitiveMatch: false`. Verified no other gallery source dir has upper-case extensions, so no other gallery's count changes.
- **Gitignored video in gallery sources**: `src/assets/images/**/*.mp4` added to `.gitignore` — the folder contained `GOPR0466_1.mp4` (129 MB, over GitHub's 100 MB per-file limit, and not consumed by the photo pipeline). The file remains on disk locally, untracked.
- Verified: full suite 1200 passing (up from 1195); single-gallery build run directly via `buildGallery(GALLERIES.find(g => g.id === 'nb-autox'))` → 79 items, 0 skipped.
- **Not verified**: Netlify production deploy of `24be52a`; no browser check of the new gallery was done this session (local or prod).
- Expected side effect: the home hero's dynamic CTA (`latest.json`) should now resolve to `nb-autox` / "Autocross 2008 - 2019 gallery", since its srcDir is now the most recently git-committed gallery source.

Also noted: the CPO initially referred to a `msmautocross` folder — that exists only in a different, older checkout (`Documents\WebProjects\Jeffgoji.com-React-Site\src\assets\images\nb\msmautocross`), not this repo. The CPO then clarified the folder is `nb/Autocross` in this repo.

## Files in flight

None. Working tree clean; `main` synced with origin (`24be52a`); no worktrees or scratch branches.

## Open decisions

- **No lightweight tracking record (Bug/Task YAML) has been created** for the four recent untracked changes (video hub, Miatas-at-the-Gap photo upload, dynamic CTA, NB Autocross gallery). `.claude/strap/work/.next-id` is still `81`. CPO hasn't said whether tracking consistency matters enough to backfill.
- **Two Lighthouse numbers remain un-transcribed** (carried over). `.claude/strap/project-docs/v1-perf-baseline.md`'s Phase-3 section is still incomplete.
- **What's New page's metric tiles are stale relative to reality** (carried over). `src/components/WhatsNew/data/metrics.js`'s image-payload tile is still `target: true` at `-50%`.
- **Two AC gaps remain open, unfiled** (carried over): home mobile LCP (6543ms vs. 2500ms target, CSS-background hero image lacking `fetchpriority`/preload) and gallery desktop's 49.9%-vs-50% image-byte-reduction miss.
- **New-gallery registration is still a manual four-file step** (`GALLERIES`, `GALLERY_SETS`, NavMenu item, `SUBMENU_FOR_SLUG` in `App.test.jsx`) — reminder, not a defect.
- **Where the CPO wants the GoPro video** (`GOPR0466_1.mp4`) — if it should appear on the site, it belongs on YouTube/the video hub playlist, not in the repo.

## Open work items

None active. All Feature/Story/Task/Bug work items in `.claude/strap/work/` are `resolved` (`.next-id` is `81`).

## Quick resume

1. **Confirm the Netlify deploy** of `24be52a`: production `/galleries?set=nb-autox` shows 79 photos, the NB nav submenu lists "Autocross 2008 - 2019", and the home hero ghost CTA reads "Autocross 2008 - 2019 gallery".
2. If CPO wants tracking consistency: file Bug/Task YAML entries for the four untracked changes, mirroring Task 00081's after-the-fact pattern.
3. If picking up the perf-baseline-doc gap: re-run `LH_DIR=/c/lh/node_modules node scripts/perf/lh-baseline.mjs` against a fresh `npm run build` + `vite preview --port 4173`, transcribe into `v1-perf-baseline.md`'s Phase-3 section.

## Critical context

- **Adding a gallery = four edits**: `GALLERIES` in `build-gallery.mjs`, `GALLERY_SETS` in `gallerySets.js` (needs a `legacyPath` starting with `/` — a test enforces it, and `App.jsx` redirects from it), a NavMenu `Dropdown.Item`, and `SUBMENU_FOR_SLUG` in `App.test.jsx`.
- **Build a single gallery without the 13-minute full run**: `node --input-type=module -e "import {GALLERIES,buildGallery} from './scripts/build-gallery.mjs'; await buildGallery(GALLERIES.find(g=>g.id==='<id>'))"` (does not rewrite `latest.json`).
- **The gallery glob is now case-insensitive** (`caseSensitiveMatch: false`) — upper-case `.JPG` camera exports are included; output filenames keep the original case (`DSC02132.JPG.webp`).
- **GitHub rejects files over 100 MB** — check source-folder drops for videos/huge files before `git add`; `*.mp4` under `src/assets/images/` is now gitignored.
- **No Python on this machine** — use Node or the Edit tool for scripted edits.
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
- `src/components/common/gallerySets.js` — `GALLERY_SETS` + `galleryHubPath(slug)`; must stay in sync with `GALLERIES`.
- `src/components/NavMenu/index.jsx` — per-chassis gallery submenus.
- `src/App.test.jsx` — `SUBMENU_FOR_SLUG` and legacy-path redirect tests.
- `src/components/common/latestGallery.js` + `src/components/Hero/index.jsx` — dynamic newest-gallery CTA.
- `src/components/YouTube/` — video hub; `videoManifest.js` is the fetch pattern `latestGallery.js` mirrors.
- `netlify.toml` — `VIDEOS_PLAYLIST_ID` committed here (not secret).
- `.claude/strap/project-docs/v1-perf-baseline.md` — V1 comparison doc; Phase-3 section incomplete.
- `src/components/WhatsNew/data/metrics.js` — What's New metric tiles.
- `.claude/strap/state/{code,devops}-connection.yaml` — GitHub (JeffGoji/Jeffgoji.com-React-Site) + local strap-agile connection profiles.
