---
topic: jeffgoji-site-update
last_updated: 2026-11-24T00:03:20Z
last_author: dev-lead
status: parked
linked_work_items: []
---

# jeffgoji.com V2 site update

## What this is

The V2 initiative for jeffgoji.com: a full "new everything" redesign — modern dark motorsport-editorial look, image-loading/performance overhaul, and a self-documenting What's New page. Features A, B, C, and D are all fully resolved and merged to `main` (Spec 00002 itself is `resolved`). Post-launch, this initiative has settled into a tail of one-off Bug fixes and small feature/content additions, all handled directly (no Requirement/Spec ceremony) given their scope. No active work items remain in `.claude/strap/work/` — this continuation exists for the loose ends below, not for in-flight execution.

## Where we left off

Session parked at a natural stopping point, not mid-task. The home hero banner gained nine new photos and was pushed straight to `main` as `46195ec` ("feat: add autocross and Tail of the Dragon shots to the home hero"), at the CPO's request. Full suite 1261 passing after rebasing onto origin. Netlify prod deploy was not checked from this session.

**Hero banner update** (CPO request: more pictures, preferring autocross action and Kasumi on the Tail of the Dragon).
- 14 frames now (was 5): +4 Kasumi Dragon action shots (`nd/TOTD2025/action/5065071`, `5065082`; `nd/MiatasAtTheGap2026/5411760`, `5411766`), +3 Kiryu autocross (`nb/Autocross/FB_IMG_1549249769761`, `…1606693558455`, `…1537141551937`), +2 Panda autocross (`c8/autocross/BMWCCAAutoX Feb-4057`, `Feb-4163`). Picked from contact sheets; the CPO approved all nine.
- **Equal chance per car** (CPO choice): new `src/components/Hero/pickShot.js` groups frames by `name`, picks a car, then a frame within it — from one `Math.random()` roll, so "one roll per mount" still holds. Each car = 1/5; Kasumi's 5 frames are 1/25 each.
- **Per-frame `focus`** (CSS `object-position`, `"x% y%"`): 7 new frames set one, tuned by eye in Chrome at 393px and 1568px. Desktop hero is wider than the photo so only y matters; phone hero is taller so only x does. Hero applies it from `shown`, so a fallback swap to `nightHero` drops it.
- On phones the car still sits behind the lead copy in most frames — unfixable by focus (photo fills full height); the original 5 frames behave the same.
- Tests in `Hero/index.test.jsx`: per-car equality sweep, every frame reachable, unique keys, one chassis label per car, focus applied / absent / dropped on fallback / well-formed.

**This checkout was behind origin** at session start (missing PR #32, the What's New redesign). The first push was rejected; the single local commit was rebased onto `origin/main` (no file overlap) and re-tested before pushing.

## Files in flight

None. `main` synced with origin at `46195ec`. `public/hero/` (gitignored) was rebuilt locally with 27 new renditions; Netlify regenerates it during `npm run build`.

## Open decisions

- **No `recentUpdates.js` entry was added for the hero update** — the Critical-context rule below says it should have been. Ask the CPO whether to add one (category likely "Site"/"Home"; link `/`).
- **No lightweight tracking record (Bug/Task YAML) exists** for the seven recent untracked changes (video hub, Miatas-at-the-Gap photo upload, dynamic CTA, NB Autocross gallery, lightbox download-button fix, What's New redesign, hero photos). `.claude/strap/work/.next-id` is still `81`. The CPO hasn't said whether to backfill.
- **Two Lighthouse numbers remain un-transcribed** (carried over). `.claude/strap/project-docs/v1-perf-baseline.md`'s Phase-3 section is incomplete.
- **The archived V2 launch page's metric tiles are stale** (carried over, low priority). `src/components/WhatsNew/data/metrics.js` only feeds `/whats-new/v2-launch`.
- **Two AC gaps remain open, unfiled** (carried over): home mobile LCP (6543ms vs. 2500ms target) and gallery desktop's 49.9%-vs-50% image-byte-reduction miss. Note: the hero's new frames are 1600w webp like the old ones, so LCP payload is unchanged in kind.
- **Where the CPO wants the GoPro video** (`GOPR0466_1.mp4`) — belongs on YouTube/the video hub playlist, not in the repo.

## Open work items

None active. All Feature/Story/Task/Bug work items in `.claude/strap/work/` are `resolved` (`.next-id` is `81`).

## Quick resume

1. `git pull` first — this checkout has drifted behind origin before.
2. Ask the CPO about a `recentUpdates.js` entry for the hero photos; if yes, add it at the top of the array and run `npx vitest run src/App.test.jsx src/components/WhatsNew`.
3. Confirm prod after the Netlify deploy: reload `/` several times; a new frame should load `/hero/<key>-1600.webp` and, for focused frames, carry an inline `object-position`. Also still unconfirmed: the What's New redesign on prod and the lightbox download button at phone width.
4. If the CPO wants tracking consistency: file Bug/Task YAML for the seven untracked changes, mirroring Task 00081's after-the-fact pattern.

## Critical context

- **Shipping anything user-visible = add a `recentUpdates.js` entry** at the top of the array (date, one of `CATEGORIES`, title, summary, links). Gallery links go through `galleryHubPath(slug)`; blog posts via `/<blog>#post-<id>`. `App.test.jsx` fails if a link's route doesn't exist.
- **Adding a hero frame = two lists**: `SHOTS` in `src/components/Hero/heroes.js` and `HEROES` in `scripts/build-heroes.mjs`, with identical `key`s (a test enforces it); then `npm run hero:build`.
- **Hero frames group by `name`** — every frame of one car must spell `name` and `car` identically or pickShot treats it as a separate car (a test enforces one chassis per name).
- **Keep each car's designer frame first** in `SHOTS`; `nightHero` is looked up by key `na`, and tests rely on 0.5 landing on the NC frame (car index 2 of 5).
- **Hero crop on phones is portrait** (~393×613): frames with the car off-centre need a `focus` x value or only the middle of the car shows.
- **Chrome may have DevTools device emulation pinned on** (393×852 @3x): `resize_window` then has no effect; check `innerWidth`, and for desktop render the page in a 1568px iframe scaled with `transform`.
- **Chrome automation screenshots can lag a resize** — re-read `innerWidth` before trusting a screenshot's layout.
- **Python 3.12 is installed but has no PIL**; use the project's `sharp` (Node) for image work. Write multi-line scripts to the scratchpad and run them — inline heredocs with mixed quotes break in Git Bash.
- **Adding a gallery = four edits**: `GALLERIES` in `build-gallery.mjs`, `GALLERY_SETS` in `gallerySets.js` (needs a `legacyPath` starting with `/`), a NavMenu `Dropdown.Item`, and `SUBMENU_FOR_SLUG` in `App.test.jsx`.
- **Build a single gallery without the 13-minute full run**: `node --input-type=module -e "import {GALLERIES,buildGallery} from './scripts/build-gallery.mjs'; await buildGallery(GALLERIES.find(g=>g.id==='<id>'))"` (does not rewrite `latest.json`).
- **The gallery glob is case-insensitive** — upper-case `.JPG` exports are included; output filenames keep the original case.
- **`nd/TOTD2025` contains at least one JPEG with bad SOS parameters** — `sharp` needs `{ failOn: 'none' }` to read the whole folder.
- **GitHub rejects files over 100 MB** — check source-folder drops before `git add`; `*.mp4` under `src/assets/images/` is gitignored.
- **Overriding react-image-gallery CSS needs more than three classes** — its rules load after `styles.scss`, so a specificity tie silently loses.
- **`.media--editorial` isolates a white-centred `multiply` overlay** — give graded wrappers an opaque dark background.
- **Prod deploys are Netlify (no GitHub Actions)** — to confirm one, poll the hashed `assets/index-*.css` name until it changes.
- **Lightbox hit-testing in Chrome automation**: wait ~700ms after a slide nav before `elementFromPoint`.
- **An older duplicate checkout exists at `Documents\WebProjects\Jeffgoji.com-React-Site`** — not this repo; don't edit it unless the CPO asks.
- **`public/gallery/latest.json` is derived from git commit history**, not mtime — Netlify clones fresh.
- **The home hero's ghost CTA is 100% data-driven** — it repoints to whichever gallery was committed most recently.
- **YouTube's playlist RSS feed caps at 15 items** and never includes duration or view count.
- **TOML requires quoted string values** — an unquoted value breaks `netlify.toml`.
- **`gallery:build` takes ~13 minutes**; plain `npm run dev` does NOT rebuild galleries (it does run `hero:build`).
- **Vitest double-counts tests if a worktree still exists** — `git worktree remove` first.
- **`scripts/build-heroes.mjs` has 3 pre-existing `no-undef` lint errors on `process`** — not a regression.
- **PR/merge convention**: small changes go direct to `main`; larger ones go through a PR the CPO reviews. Push or merge only when the CPO says so.
- **`CreateTeam` is unavailable in this harness** — use `git worktree add -b <branch>` + named background `Agent` dispatch.
- **react-bootstrap derives selection `eventKey` from `href`, not react-router's `to`** — nav items need an explicit `eventKey`.
- **Don't forget `/context-prep` before ending a session.**

## Source-of-truth pointers

- `src/components/Hero/heroes.js` — hero shot list (`SHOTS`, `focus`, `nightHero`, `withRenditions`).
- `src/components/Hero/pickShot.js` — equal-chance-per-car pick.
- `src/components/Hero/index.jsx` — hero render, fallback swap, focus application, dynamic CTA.
- `scripts/build-heroes.mjs` — `HEROES` rendition list (480/960/1600 webp → `public/hero/`).
- `scripts/build-gallery.mjs` — gallery build pipeline: `GALLERIES`, `buildGallery()`, `pickLatest()`, `writeLatest()`.
- `src/components/common/GalleryLightbox.jsx` + `src/scss/styles.scss` (`.lightbox*`, `.hero*`) — lightbox and hero styles.
- `src/scss/_grade.scss` — editorial grade (`.media--editorial*`).
- `src/components/common/gallerySets.js` — `GALLERY_SETS` + `galleryHubPath(slug)`.
- `src/components/NavMenu/index.jsx` — per-chassis gallery submenus.
- `src/App.test.jsx` — `SUBMENU_FOR_SLUG`, route and redirect tests.
- `src/components/WhatsNew/data/recentUpdates.js` — the live What's New timeline content.
- `src/components/WhatsNew/V2Launch.jsx` — archived V2 launch page (`/whats-new/v2-launch`).
- `src/components/YouTube/` — video hub; `videoManifest.js` is the fetch pattern `latestGallery.js` mirrors.
- `netlify.toml` — `VIDEOS_PLAYLIST_ID` committed here (not secret).
- `.claude/strap/project-docs/v1-perf-baseline.md` — V1 comparison doc; Phase-3 section incomplete.
- `.claude/strap/state/{code,devops}-connection.yaml` — GitHub + local strap-agile connection profiles.
