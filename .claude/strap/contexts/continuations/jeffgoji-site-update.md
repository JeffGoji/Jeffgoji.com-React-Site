---
topic: jeffgoji-site-update
last_updated: 2026-11-24T01:48:39Z
last_author: dev-lead
status: parked
linked_work_items: []
---

# jeffgoji.com V2 site update

## What this is

The V2 initiative for jeffgoji.com: a full "new everything" redesign — modern dark motorsport-editorial look, image-loading/performance overhaul, and a self-documenting What's New page. Features A, B, C, and D are all fully resolved and merged to `main` (Spec 00002 itself is `resolved`). Post-launch, this initiative has settled into a tail of one-off Bug fixes and small feature/content additions, all handled directly (no Requirement/Spec ceremony) given their scope. No active work items remain in `.claude/strap/work/` — this continuation exists for the loose ends below, not for in-flight execution.

## Where we left off

Session parked at a natural stopping point, not mid-task. Everything from this session is pushed and **verified live on prod**.

**Hero banner update** — `46195ec`, live on jeffgoji.com ~6 min after push.
- 14 frames now (was 5): +4 Kasumi Dragon action shots (`nd/TOTD2025/action/5065071`, `5065082`; `nd/MiatasAtTheGap2026/5411760`, `5411766`), +3 Kiryu autocross (`nb/Autocross/FB_IMG_1549249769761`, `…1606693558455`, `…1537141551937`), +2 Panda autocross (`c8/autocross/BMWCCAAutoX Feb-4057`, `Feb-4163`). The CPO approved all nine from contact sheets.
- **Equal chance per car** (CPO choice): `src/components/Hero/pickShot.js` groups frames by `name`, picks a car, then a frame — from one `Math.random()` roll. Each car = 1/5.
- **Per-frame `focus`** (CSS `object-position`, `"x% y%"`): 7 new frames set one, tuned by eye at 393px and 1568px. Desktop crop uses only y; phone crop uses only x. Applied from `shown`, so a fallback swap to `nightHero` drops it.
- On phones the car still sits behind the lead copy in most frames — unfixable by focus; the original 5 frames behave the same.

**What's New entry** — `dc5c7ee`, live ~18 min after push. "Nine new action shots in the home page banner" (2026-11-23, Site, link `/`) is the Latest card; counts now 15 updates / 5 Site.

**Prod verification (2026-11-24)** at 1568px desktop and 393px phone: c8-turn-in, nd-dragon-sweeper, msm-braking (desktop) and msm-wet-spray, c8-pan, nd-gap-lean (phone) all loaded with the expected `object-position`; `/whats-new` Latest card and timeline correct at both widths; no horizontal overflow anywhere. The What's New redesign (PR #32) is also confirmed live.

**Lightbox mobile fix** — `d4506d7`, live ~9 min after push. The CPO's phone spot-check request found two bugs on prod:
- At 360x640 the nav arrows (pinned `top: 50%` on ≤768px) covered both ends of the download button — taps there changed slide. Arrows now sit at `bottom: var(--space-5)`, and `.lightbox` reserves `calc(52px + 2 * var(--space-5))` bottom padding so content scrolls clear of them.
- A wrapping caption touched the screen edge (no inline padding). `.lightbox` now pads `var(--space-4)` inline, `.lightbox__stage` is `width: 100%` on ≤768px (92vw + padding caused sideways scroll), and `.lightbox__cap` is `text-align: center`.
- Verified on prod at 320x568, 360x640, 393x852, 740x360 (incl. scrolled): 0/6 probe points on the button covered, no horizontal scroll, caption ≥26px from each edge, full-res download returns 200. Desktop unchanged.
- What's New entry "Gallery arrows no longer cover the download button on phones" (2026-11-23, Fixes, link `/galleries`) — `58c2f24`, live ~9 min after push and verified on prod at 393px and 1568px: Latest card, first in timeline, link to `/galleries`, no horizontal overflow.

**Permission allowlist** — `0d4e945`. `/fewer-permission-prompts` scanned all 14 transcripts (2 projects) and added `PowerShell(Get-ChildItem *)`, `PowerShell(Get-Content *)`, `PowerShell(Test-Path *)` to `.claude/settings.json`. The file was rewritten from PowerShell's odd JSON indentation to standard 4-space JSON; all prior keys and 18 rules are unchanged. The `PowerShell(...)` rule form is unverified — if prompts persist for those cmdlets, the form is wrong (harmless either way).

**Home strips filled out + car card renditions** — CPO noticed the home page showed 3 of everything while a wide screen's grids lay out 4 columns.
- **Car cards**: new `scripts/build-car-cards.mjs` reads `Cars.json` directly (no duplicated list) and writes a 400/800/1200w webp ladder (capped at source width, quality 74) plus `public/cars/manifest.json`, gitignored, run by `npm run build`/`dev` as `cars:build`. `carImages.js` reads the manifest via `import.meta.glob` (`resolveCarSrcSet`, `CAR_CARD_SIZES` matching the garage grid's 1/2/3/4 columns); `CarCard` passes srcSet + sizes. Five cards at 2.25x went from 1.9 MB of full-size JPGs (Panda's alone 714 KB) to 274 KB; ~73 KB at 1x. Applies to `/garage` too. — `ff6b954`
- **Home car strip shows all five** (`PREVIEW_COUNT` 3 → 5, CPO choice): four across on wide screens, Panda wraps to its own row (CPO explicitly fine with that). — `ff6b954`
- **Home video strip shows four** (`TEASER_COUNT` 3 → 4). — `e8c67d8`
- What's New entries: "The home page shows the whole garage, and car photos load faster" (Site, `1e4cdf7`) and "Four of the latest videos on the home page" (Videos, `cdc8f0e`, now the Latest card).
- All verified on prod at 1568px and 393px: 5 cards loading 800w webp, 4 videos, What's New order correct, no horizontal overflow. Deploys took 3 and 9 min.

## Files in flight

None. `main` synced with origin at `cdc8f0e` (plus this continuation commit). The CPO's Claude Code status line was also set up this session, outside the repo — see Critical context.

## Open decisions

- **No lightweight tracking record (Bug/Task YAML) exists** for the ten recent untracked changes (video hub, Miatas-at-the-Gap photo upload, dynamic CTA, NB Autocross gallery, lightbox download-button fix, What's New redesign, hero photos, lightbox mobile fix, car card renditions + five-car strip, four-video strip). `.claude/strap/work/.next-id` is still `81`. The CPO hasn't said whether to backfill.
- **Two Lighthouse numbers remain un-transcribed** (carried over). `.claude/strap/project-docs/v1-perf-baseline.md`'s Phase-3 section is incomplete.
- **The archived V2 launch page's metric tiles are stale** (carried over, low priority). `src/components/WhatsNew/data/metrics.js` only feeds `/whats-new/v2-launch`.
- **Two AC gaps remain open, unfiled** (carried over): home mobile LCP (6543ms vs. 2500ms target) and gallery desktop's 49.9%-vs-50% image-byte-reduction miss. The new hero frames are 1600w webp like the old ones, so LCP payload is unchanged in kind.
- **Where the CPO wants the GoPro video** (`GOPR0466_1.mp4`) — belongs on YouTube/the video hub playlist, not in the repo.

## Open work items

None active. All Feature/Story/Task/Bug work items in `.claude/strap/work/` are `resolved` (`.next-id` is `81`).

## Quick resume

1. `git pull` first — this checkout has drifted behind origin before.
2. Ask the CPO what's next — every prod item from this session is shipped and verified; nothing is pending.
3. If the CPO wants tracking consistency: file Bug/Task YAML for the ten untracked changes, mirroring Task 00081's after-the-fact pattern.

## Critical context

- **Shipping anything user-visible = add a `recentUpdates.js` entry** at the top of the array (date = commit date, one of `CATEGORIES`, title, summary, links). Gallery links via `galleryHubPath(slug)`; blog posts via `/<blog>#post-<id>`. `App.test.jsx` fails if a link's route doesn't exist.
- **Car card photos come from `Cars.json` alone** — adding or changing a car's `img` needs no pipeline edit; `cars:build` picks it up. The bundled JPG stays the `src` fallback when `public/cars/` is absent (fresh clone, tests).
- **Home strip counts are product choices**: `PREVIEW_COUNT` (cars, 5) in `pages/Home.jsx` and `TEASER_COUNT` (videos, 4) in `YouTube/VideoTeaser.jsx`; tests pin both.
- **Adding a hero frame = two lists**: `SHOTS` in `src/components/Hero/heroes.js` and `HEROES` in `scripts/build-heroes.mjs`, with identical `key`s (a test enforces it); then `npm run hero:build`.
- **Hero frames group by `name`** — every frame of one car must spell `name` and `car` identically or pickShot treats it as a separate car (a test enforces one chassis per name).
- **Keep each car's designer frame first** in `SHOTS`; `nightHero` is looked up by key `na`, and tests rely on 0.5 landing on the NC frame (car index 2 of 5).
- **Hero crop on phones is portrait** (~393×613): frames with the car off-centre need a `focus` x value or only the middle of the car shows.
- **Verifying a random hero pick on prod**: put a same-origin `<iframe>` over the page and reload it until `.hero__media img`'s `currentSrc` names the wanted key — real pick, real focus, no code override. Size the iframe to 393×852 for phone, full window for desktop.
- **Chrome may have DevTools device emulation on** (393×852 @3x) — `resize_window` then does nothing; check `innerWidth`/`devicePixelRatio` before trusting a layout. It was off at session end.
- **Chrome automation screenshots can lag a resize** — re-read `innerWidth` before trusting a screenshot's layout.
- **Netlify serves the SPA's HTML with HTTP 200 for ANY unknown path** — a 200 on `/cars/x.webp` or `/hero/x.webp` proves nothing; check `content-type` is `image/webp` (or decode it in the browser) before calling an asset live.
- **Push only when nothing is building**: before a push, confirm the live bundle already contains origin/main's newest user-visible commit; hold new commits locally until then.
- **Netlify gives no GitHub commit status here** — confirm a deploy by polling prod: the hashed `assets/index-*.js` (or `.css`) name changes, then grep it (or `/hero/manifest.json`) for the new content. Recent deploys took 3-18 minutes. The CPO was told how to enable Netlify's "GitHub commit status" deploy notification (Site configuration → Notifications) but has not set it up yet.
- **Checking the lightbox at phone sizes**: in a same-origin iframe at the target size, open `/galleries`, click `button.thumb`, then probe six points on `.lightbox__download` with `elementFromPoint` (after ~900ms per slide) and also after scrolling `.lightbox` to its bottom — the centre alone passed while the ends were covered.
- **On ≤768px the lightbox arrows are bottom-pinned and the overlay is padded** — moving them back toward mid-screen re-covers the download button on short phones; tests in `GalleryLightbox.test.jsx` guard the compiled ≤768px block.
- **TaskStop on a backgrounded `npx vite` kills the shell but can orphan the node process** — check `netstat -ano | grep :5179` and stop the PID (confirm its command line is vite first).
- **Push one change at a time when watching a deploy** — a second push mid-build can cancel or queue the first.
- **Python 3.12 is installed but has no PIL**; use the project's `sharp` (Node) for image work. Write multi-line scripts to the scratchpad and run them — inline heredocs with mixed quotes break in Git Bash.
- **`jq` is not installed on this machine** — anything that shells out to `jq` silently produces empty output; use `node` to parse JSON instead.
- **The CPO's status line is user-level, not in this repo**: `~/.claude/settings.json` `statusLine` runs `node "C:/Users/viper.DESKTOP-PMANIC7/.claude/statusline.js"`, printing `<model> | Context: <n>%`. Auto mode can't be shown (the status-line JSON has no permission-mode field), so the CPO had the placeholder removed.
- **The `statusline-setup` agent has only Read/Edit** — it cannot run or test its own command; test it yourself by piping sample JSON into the script.
- **`nd/TOTD2025` contains at least one JPEG with bad SOS parameters** — `sharp` needs `{ failOn: 'none' }` to read the whole folder.
- **Adding a gallery = four edits**: `GALLERIES` in `build-gallery.mjs`, `GALLERY_SETS` in `gallerySets.js` (needs a `legacyPath` starting with `/`), a NavMenu `Dropdown.Item`, and `SUBMENU_FOR_SLUG` in `App.test.jsx`.
- **Build a single gallery without the 13-minute full run**: `node --input-type=module -e "import {GALLERIES,buildGallery} from './scripts/build-gallery.mjs'; await buildGallery(GALLERIES.find(g=>g.id==='<id>'))"` (does not rewrite `latest.json`).
- **The gallery glob is case-insensitive** — upper-case `.JPG` exports are included; output filenames keep the original case.
- **GitHub rejects files over 100 MB** — check source-folder drops before `git add`; `*.mp4` under `src/assets/images/` is gitignored.
- **Overriding react-image-gallery CSS needs more than three classes** — its rules load after `styles.scss`, so a specificity tie silently loses.
- **`.media--editorial` isolates a white-centred `multiply` overlay** — give graded wrappers an opaque dark background.
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
- `scripts/build-car-cards.mjs` + `src/components/common/carImages.js` — car card webp ladder (`public/cars/`) and its consumer (`resolveCarSrcSet`, `CAR_CARD_SIZES`).
- `src/components/Hero/index.jsx` — hero render, fallback swap, focus application, dynamic CTA.
- `scripts/build-heroes.mjs` — `HEROES` rendition list (480/960/1600 webp → `public/hero/`).
- `scripts/build-gallery.mjs` — gallery build pipeline: `GALLERIES`, `buildGallery()`, `pickLatest()`, `writeLatest()`.
- `src/components/common/GalleryLightbox.jsx` + `src/scss/styles.scss` (`.lightbox*`, `.hero*`, `ru-*`) — lightbox, hero and What's New styles.
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
