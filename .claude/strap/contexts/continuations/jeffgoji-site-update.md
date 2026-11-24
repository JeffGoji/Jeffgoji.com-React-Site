---
topic: jeffgoji-site-update
last_updated: 2026-11-24T22:51:23Z
last_author: dev-lead
status: parked
linked_work_items: []
---

# jeffgoji.com V2 site update

## What this is

The V2 initiative for jeffgoji.com: a full "new everything" redesign — modern dark motorsport-editorial look, image-loading/performance overhaul, and a self-documenting What's New page. Features A, B, C, and D are all fully resolved and merged to `main` (Spec 00002 itself is `resolved`). Post-launch, this initiative has settled into a tail of one-off Bug fixes and small feature/content additions, all handled directly (no Requirement/Spec ceremony) given their scope. No active work items remain in `.claude/strap/work/` — this continuation exists for the loose ends below, not for in-flight execution.

## Where we left off

Session ended cleanly at the CPO's request. Every site change is on `main` and **verified live on prod**; the only unmerged work is this notes update.

**Shipped and verified on prod this session** (details live in git log and What's New):
- Hero banner: 14 frames (was 5), equal chance per car via `pickShot.js`, per-frame `focus` crops — `46195ec`.
- Lightbox on phones: arrows bottom-pinned so they no longer cover the download button at 360x640; caption padded and centred — `d4506d7`.
- Car card photos: `scripts/build-car-cards.mjs` webp ladder from `Cars.json`; five cards at 2.25x dropped from 1.9 MB to 274 KB — `ff6b954`.
- Home strips: all 5 cars (`PREVIEW_COUNT`), 4 videos (`TEASER_COUNT`) — `ff6b954`, `e8c67d8`.
- What's New entries for each of the above.
- `.claude/settings.json` allowlist: three read-only `PowerShell(...)` rules — `0d4e945` (rule form unverified; harmless if wrong).

**Workflow switched to branch-per-change + one release PR** (CPO, 2026-11-24; see Critical context). First release under it: PR #33 (notes only), merged by Claude at the CPO's explicit request as `099fbb8`; its branches were then deleted.

**Branch cleanup** (CPO-approved, every deletion verified against `main` or an archive tag first):
- Deleted 21 branches already merged into `main` (6 on GitHub, 15 local `task/*` + `feature/strap-onboarding`).
- `main` was restarted on **2026-05-27** as a history-less copy of `strap_v1`; the old history (Jan 2024 – Feb 2026) is preserved as tag **`archive/pre-2026-05-27`**, and the 11 old-lineage branches it contains were deleted.
- `Thumbnail-resize-project` and `new-intro-page-idea` were archived as tags `archive/<name>` and deleted.
- `blog-updates` and `Kasumi-blog-update-branch` held two drafts of one unpublished Kasumi tire-swap entry (Azenis → Continentals, 6/18 and 8/1/2025). The CPO said both were drafts to disregard; branches and their archive tags were deleted, so the drafts no longer exist.
- GitHub now has only `main` and `original_design_backup_only` (left alone; fully merged, name suggests a deliberate backup).

## Files in flight

- `chore/context-prep-2026-11-24-wrap` — this continuation update, merged into **`release/2026-11-24-2`**.
- Both branches are **local only, not pushed, no PR yet**; `main` is synced with origin at `099fbb8`.
- Outside the repo: the CPO's Claude Code status line (`~/.claude/statusline.js`) — see Critical context.

## Open decisions

- **Two Netlify sites build this repo** (`nimble-tulumba-f93157`, `effervescent-chaja-1a8580`); both build every PR and every merge and serve identical code. One may be a stale duplicate doubling build minutes — the CPO can check which owns jeffgoji.com in Netlify's Domain management. Not yet decided.
- **`original_design_backup_only`** is fully merged into `main`; delete or keep is the CPO's call (not yet asked to act).
- **No lightweight tracking record (Bug/Task YAML) exists** for the ten recent untracked changes (video hub, Miatas-at-the-Gap photo upload, dynamic CTA, NB Autocross gallery, lightbox download-button fix, What's New redesign, hero photos, lightbox mobile fix, car card renditions + five-car strip, four-video strip). `.claude/strap/work/.next-id` is still `81`. The CPO hasn't said whether to backfill.
- **Two Lighthouse numbers remain un-transcribed** (carried over). `.claude/strap/project-docs/v1-perf-baseline.md`'s Phase-3 section is incomplete.
- **The archived V2 launch page's metric tiles are stale** (carried over, low priority). `src/components/WhatsNew/data/metrics.js` only feeds `/whats-new/v2-launch`.
- **Two AC gaps remain open, unfiled** (carried over): home mobile LCP (6543ms vs. 2500ms target) and gallery desktop's 49.9%-vs-50% image-byte-reduction miss.
- **Where the CPO wants the GoPro video** (`GOPR0466_1.mp4`) — belongs on YouTube/the video hub playlist, not in the repo.

## Open work items

None active. All Feature/Story/Task/Bug work items in `.claude/strap/work/` are `resolved` (`.next-id` is `81`).

## Quick resume

1. `git switch main && git pull`, then confirm `release/2026-11-24-2` and `chore/context-prep-2026-11-24-wrap` still exist locally (`git branch`).
2. Ask the CPO what's next. Start each change with `git switch -c <feat|fix|chore>/<slug> main`, then `git switch release/2026-11-24-2 && git merge --no-ff <branch>`.
3. When the CPO says the batch is ready: push the change branches and the release branch, `gh pr create --base main --head release/2026-11-24-2`, wait on `gh pr checks <n> --watch`, verify the deploy preview, then tell the CPO it's ready to merge. After the merge, watch prod and delete that release's branches.

## Critical context

- **Branch/PR convention (CPO, 2026-11-24) — nothing is committed to `main` directly.** Each change gets its own branch off `main` (`feat/…`, `fix/…`, `chore/…`, including `/context-prep` notes); finished branches merge `--no-ff` into a shared `release/<YYYY-MM-DD>` branch with exactly one PR to `main`. Claude opens the PR; **the CPO merges it** unless they explicitly ask Claude to merge that specific PR.
- **After a release PR merges, delete that release's branches** (release + every change branch in it) on GitHub and locally without asking — confirm each with `git merge-base --is-ancestor origin/<b> main` first; never touch branches outside that release.
- **Netlify reports deploy-preview checks on PRs** (`gh pr checks <n>`, preview URL `https://deploy-preview-<n>--<site>.netlify.app`) but **no status on merges to `main`** — confirm a production deploy by the hashed `assets/index-*.js` name changing, then grep it for the new content.
- **A notes-only release produces a byte-identical bundle**, so its production deploy can't be detected from outside — say so rather than claiming it finished.
- **Netlify serves the SPA's HTML with HTTP 200 for ANY unknown path** — check `content-type` is `image/webp` (or decode in the browser) before calling an asset live.
- **One production build at a time** — before telling the CPO a release PR is ready to merge, confirm the live bundle already carries `main`'s newest user-visible change.
- **`main` has no history before 2026-05-27** — anything older lives only in tag `archive/pre-2026-05-27`; old branches share no merge base with `main`, so `git cherry`/merge checks against `main` report them as entirely unmerged.
- **Two notes branches in one release always conflict on `last_updated`** — keep the newer timestamp.
- **In Git Bash, `git show <rev>:<path>` is mangled by path conversion** — prefix with `MSYS_NO_PATHCONV=1`.
- **Shipping anything user-visible = add a `recentUpdates.js` entry** at the top of the array (date = commit date, one of `CATEGORIES`, title, summary, links). `App.test.jsx` fails if a link's route doesn't exist; a summary's numbers must hold on every device.
- **Blog entries are ordered by `id`** (newest first), and the blog banner's ODO chip reads the highest id — inserting a back-dated entry means renumbering later ids and fixing `#post-<id>` links (What's New links `/nd-blog#post-9`).
- **Car card photos come from `Cars.json` alone** — `cars:build` picks up any `img` change; the bundled JPG stays the fallback when `public/cars/` is absent.
- **Home strip counts are product choices**: `PREVIEW_COUNT` (cars, 5) in `pages/Home.jsx` and `TEASER_COUNT` (videos, 4) in `YouTube/VideoTeaser.jsx`; tests pin both.
- **Adding a hero frame = two lists**: `SHOTS` in `src/components/Hero/heroes.js` and `HEROES` in `scripts/build-heroes.mjs`, with identical `key`s; then `npm run hero:build`.
- **Hero frames group by `name`** — every frame of one car must spell `name` and `car` identically (a test enforces it); keep each car's designer frame first, and `nightHero` is key `na`.
- **Hero crop on phones is portrait** (~393×613): off-centre cars need a `focus` x value.
- **Verifying a random hero pick or a phone layout on prod**: load the page in a same-origin `<iframe>` sized to the target viewport and read the real DOM — no code override needed.
- **Checking the lightbox at phone sizes**: probe six points on `.lightbox__download` with `elementFromPoint` (after ~900ms per slide), also after scrolling `.lightbox` to its bottom — the centre alone passed while the ends were covered.
- **On ≤768px the lightbox arrows are bottom-pinned and the overlay is padded** — tests in `GalleryLightbox.test.jsx` guard the compiled ≤768px block.
- **Chrome may have DevTools device emulation on**, and screenshots can lag a resize — re-read `innerWidth`/`devicePixelRatio` before trusting a layout.
- **TaskStop on a backgrounded `npx vite` can orphan the node process** — check `netstat -ano | grep :5179` and stop the PID (confirm its command line is vite first).
- **Python 3.12 has no PIL and `jq` is not installed** — use the project's `sharp` and `node`; write multi-line scripts to the scratchpad rather than inline heredocs.
- **The CPO's status line is user-level, not in this repo**: `~/.claude/settings.json` runs `node "C:/Users/viper.DESKTOP-PMANIC7/.claude/statusline.js"` → `<model> | Context: <n>%`; the `statusline-setup` agent can't run commands, so test its work yourself.
- **`nd/TOTD2025` contains at least one JPEG with bad SOS parameters** — `sharp` needs `{ failOn: 'none' }`.
- **Adding a gallery = four edits**: `GALLERIES` in `build-gallery.mjs`, `GALLERY_SETS` in `gallerySets.js` (needs a `legacyPath` starting with `/`), a NavMenu `Dropdown.Item`, and `SUBMENU_FOR_SLUG` in `App.test.jsx`.
- **Build a single gallery without the 13-minute full run**: `node --input-type=module -e "import {GALLERIES,buildGallery} from './scripts/build-gallery.mjs'; await buildGallery(GALLERIES.find(g=>g.id==='<id>'))"`.
- **GitHub rejects files over 100 MB** — check source-folder drops before `git add`; `*.mp4` under `src/assets/images/` is gitignored.
- **Overriding react-image-gallery CSS needs more than three classes** — its rules load after `styles.scss`.
- **`.media--editorial` isolates a white-centred `multiply` overlay** — give graded wrappers an opaque dark background.
- **An older duplicate checkout exists at `Documents\WebProjects\Jeffgoji.com-React-Site`** — not this repo; don't edit it unless the CPO asks.
- **`public/gallery/latest.json` is derived from git commit history**, and the hero's ghost CTA repoints to the most recently committed gallery.
- **YouTube's playlist RSS feed caps at 15 items** and never includes duration or view count.
- **TOML requires quoted string values** — an unquoted value breaks `netlify.toml`.
- **`gallery:build` takes ~13 minutes**; plain `npm run dev` does NOT rebuild galleries (it does run `hero:build` and `cars:build`).
- **Build scripts carry pre-existing `no-undef` lint errors on `process`**, and `CarCard.jsx` has 11 pre-existing prop-types errors — not regressions.
- **Vitest double-counts tests if a worktree still exists** — `git worktree remove` first.
- **`CreateTeam` is unavailable in this harness** — use `git worktree add -b <branch>` + named background `Agent` dispatch.
- **react-bootstrap derives selection `eventKey` from `href`, not react-router's `to`** — nav items need an explicit `eventKey`.
- **Don't forget `/context-prep` before ending a session.**

## Source-of-truth pointers

- `src/components/Hero/heroes.js` + `pickShot.js` + `index.jsx` — hero shot list, equal-chance pick, render/fallback/focus.
- `scripts/build-heroes.mjs` — `HEROES` rendition list (480/960/1600 webp → `public/hero/`).
- `scripts/build-car-cards.mjs` + `src/components/common/carImages.js` — car card webp ladder (`public/cars/`) and its consumer.
- `scripts/build-gallery.mjs` — gallery build pipeline.
- `src/components/common/GalleryLightbox.jsx` + `src/scss/styles.scss` (`.lightbox*`, `.hero*`, `ru-*`) — lightbox, hero and What's New styles.
- `src/scss/_grade.scss` — editorial grade (`.media--editorial*`).
- `src/components/common/gallerySets.js` — `GALLERY_SETS` + `galleryHubPath(slug)`.
- `src/components/common/BlogList.jsx` + `src/assets/Data/*Blog.json` — build logs, ordered by `id`.
- `src/App.test.jsx` — `SUBMENU_FOR_SLUG`, route and redirect tests.
- `src/components/WhatsNew/data/recentUpdates.js` — the live What's New timeline content.
- `src/components/YouTube/` — video hub and home teaser.
- `netlify.toml` — `VIDEOS_PLAYLIST_ID` committed here (not secret).
- Tag `archive/pre-2026-05-27` — all site history before `main` was restarted.
- `.claude/strap/project-docs/v1-perf-baseline.md` — V1 comparison doc; Phase-3 section incomplete.
- `.claude/strap/state/{code,devops}-connection.yaml` — GitHub + local strap-agile connection profiles.
