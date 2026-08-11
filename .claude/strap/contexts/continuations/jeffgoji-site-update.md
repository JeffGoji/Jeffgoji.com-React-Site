---
topic: jeffgoji-site-update
last_updated: 2026-08-11T21:05:00Z
last_author: dev-lead
status: parked
linked_work_items: []
---

# jeffgoji.com V2 site update

## What this is

The V2 initiative for jeffgoji.com: a full "new everything" redesign — modern dark motorsport-editorial look, image-loading/performance overhaul, and a self-documenting "V2 What's New" page. Features A, B, C, and D are all fully resolved and merged to `main` (Spec 00002 itself is `resolved`). Post-launch, this initiative has settled into a tail of one-off Bug fixes and small feature/content additions, all handled directly (no Requirement/Spec ceremony) given their scope. No active work items remain in `.claude/strap/work/` — this continuation exists for the loose ends below, not for in-flight execution.

## Where we left off

Session parked at a natural stopping point, not mid-task. Two pieces of work landed, both pushed direct-to-main, working tree clean:

1. **9 new photos added to the Miatas at the Gap 2026 gallery.** CPO dropped the files into `src/assets/images/nd/MiatasAtTheGap2026/`; ran `gallery:build` (confirmed 40 items, up from 31), ran the full suite (1183 passed), committed and pushed (`8da09bd`).
2. **Home hero's gallery CTA made dynamic.** CPO's ask: the ghost button next to "Enter the garage" should always point at whichever gallery was most recently updated, with text like "Miatas at the Gap 2026 gallery" — not a hardcoded Tail of the Dragon link. Implemented and pushed (`4b43f26`):
   - `scripts/build-gallery.mjs`'s `buildGallery()` now computes `updatedAt` per gallery via `git log -1 --format=%aI -- <srcDir>` (new `lastCommitDate()`), falling back to newest source-file mtime (`newestMtimeIso()`) only when git has nothing for the path. `main()` collects each gallery's `{id, label, updatedAt}` and `writeLatest()` picks the newest (`pickLatest()`) and writes `public/gallery/latest.json` — gitignored, same pattern as every other gallery/video manifest.
   - New `src/components/common/latestGallery.js` — `loadLatestGallery()` fetches `/gallery/latest.json` at runtime, mirroring `YouTube/videoManifest.js`'s ok/fallback shape. `LATEST_GALLERY_FALLBACK` = `{slug: 'nd-totd2025', label: 'Tail of the Dragon 2025'}`, shown until the fetch resolves and on any failure.
   - `Hero/index.jsx` fetches on mount, sets the ghost CTA's `to={galleryHubPath(latestGallery.slug)}` and text to `` `${latestGallery.label} gallery` `` — switched off the legacy `/totdgallery` path onto the same `galleryHubPath()` helper NavMenu already uses.
   - 12 new tests (6 in `build-gallery.test.js` for `lastCommitDate`/`pickLatest`/`writeLatest`/`buildGallery`'s return shape, 6 in `Hero/index.test.jsx` for the fallback/resolved/failure states) — full suite now 1195 passing.
   - Verified live: ran `npm run gallery:build` for real data, started `npm run dev`, used claude-in-chrome to confirm the home page actually renders "MIATAS AT THE GAP 2026 GALLERY" linking to `/galleries?set=nd-miatasatthegap2026`, and clicked through to confirm the gallery itself renders correctly (the 40-item set, `01`–`12` visible above the fold). Dev server stopped afterward.

**Current state**: both pieces are live in production once Netlify's next build runs (not yet confirmed deployed as of this writing — see Quick resume). `latest.json` currently resolves to `nd-miatasatthegap2026` because it's the most recently git-committed gallery source directory.

## Files in flight

None. Working tree clean; `main` synced with origin (`4b43f26`); no worktrees or scratch branches remain.

## Open decisions

- **No lightweight tracking record (Bug/Task YAML) was created for either piece of work this session**, continuing the precedent set by the video-hub work (still no backfill for that either). `.claude/strap/work/.next-id` is still `81`. CPO hasn't said whether tracking consistency matters enough to backfill any of these three untracked changes.
- **Two Lighthouse numbers remain un-transcribed** (carried over, untouched across three sessions now). `.claude/strap/project-docs/v1-perf-baseline.md`'s Phase-3 section is still incomplete.
- **What's New page's metric tiles are stale relative to reality** (carried over, untouched). `src/components/WhatsNew/data/metrics.js`'s image-payload tile is still `target: true` at `-50%`.
- **Two AC gaps remain open, unfiled** (carried over, predate all recent work): home mobile LCP (6543ms vs. 2500ms target, CSS-background hero image lacking `fetchpriority`/preload) and gallery desktop's 49.9%-vs-50% image-byte-reduction miss.
- **New-gallery registration is still a manual two-file step** (`GALLERIES` in `build-gallery.mjs` + `GALLERY_SETS` in `gallerySets.js`), unchanged by the dynamic-CTA work — flagged to the CPO as a reminder, not a defect; the dynamic CTA only decides *which already-registered* gallery is newest.

## Open work items

None active. All Feature/Story/Task/Bug work items in `.claude/strap/work/` are `resolved` (`.next-id` is still `81`).

## Quick resume

1. **Confirm the Netlify deploy** picked up both commits (`8da09bd`, `4b43f26`) and that production's home page actually shows the dynamic CTA and the 40-photo gallery — this session verified locally via dev server, not against production.
2. If CPO wants tracking consistency: file Bug/Task YAML entries for the three untracked changes (video hub, photo upload, dynamic CTA), mirroring Task 00081's after-the-fact pattern.
3. If picking up the perf-baseline-doc gap: re-run `LH_DIR=/c/lh/node_modules node scripts/perf/lh-baseline.mjs` against a fresh `npm run build` + `vite preview --port 4173`, transcribe into `v1-perf-baseline.md`'s Phase-3 section.
4. Otherwise: if CPO doesn't want to action any open item above, this topic can likely go to `status: done` next pass — nothing left undone that isn't already a known, accepted gap.

## Critical context

- **`public/gallery/latest.json` is derived from git commit history on the gallery's `srcDir`, not filesystem mtime** — deliberate, because Netlify clones fresh for every build and mtime would stamp every file with checkout time, erasing any real difference between galleries. `lastCommitDate()` in `build-gallery.mjs` runs `git log -1 --format=%aI -- <path>` via `execFileSync` (never a shelled string, to survive spaces in the repo's own path). Falls back to newest source-file mtime only when git has no history for that path at all.
- **The home hero's ghost CTA is now 100% data-driven** — it will silently repoint itself to whatever gallery was git-committed most recently, including a gallery nobody intended as "featured." If the CPO ever wants a *pinned* gallery instead of "most recent," that requires a product decision, not a bug fix.
- **YouTube's playlist RSS feed caps at 15 items and returns playlist order, not upload-date order** — `build-videos.mjs` sorts; a 16th video added to the playlist will silently not appear on the site without the paid Data API.
- **That RSS feed never includes video duration or view count** — don't design any future video-hub feature assuming they're available without hand-maintaining them.
- **TOML requires quoted string values** — an unquoted value in `netlify.toml` breaks the parser for the *entire file*.
- **`scripts/perf/lh-baseline.mjs` prints to stdout, writes no artifact** — durability requires manual transcription into `v1-perf-baseline.md`.
- **Lighthouse must be installed out-of-tree** (`C:\lh`) — short path required on Windows.
- **`gallery:build` takes ~13 minutes** (mozjpeg re-encoding); `videos:build` is a cheap network fetch, safe to chain into `npm run dev`. Plain `npm run dev` does NOT rebuild galleries — run `gallery:build` explicitly first if you need fresh manifests/`latest.json` locally.
- **Vitest double-counts tests if a worktree still exists when running from the main checkout** — always `git worktree remove` first.
- **PR/merge convention for this tail of work**: task/fix branches → `main` directly, no standing integration branch, no PR ceremony.
- **`CreateTeam` is unavailable in this harness.** Workaround: manual `git worktree add -b <branch>` + named background `Agent` dispatch.
- **Netlify reports pending-not-failing PR checks** (`UNSTABLE` mergeStateStatus is normal) — confirm via `mergeable: MERGEABLE`.
- **Push before you PR/merge** — local commits after last push are invisible to `gh`.
- **Verify agent-reported numbers/claims against the actual artifact before merging** — standing discipline.
- **react-bootstrap/`@restart/ui` derive selection `eventKey` from `href`, not react-router's `to`** — any nav item using `to=` alone gets `null` and silently no-ops on select.
- **Browser automation (claude-in-chrome) is useful for both live external lookups and live-reviewing a running dev server** — used this session to confirm the dynamic CTA actually renders and links correctly before pushing.
- **Don't forget `/context-prep` before ending a session.**

## Source-of-truth pointers

- `scripts/build-gallery.mjs` — gallery build pipeline; now also owns `lastCommitDate()`, `pickLatest()`, `writeLatest()` and writes `public/gallery/latest.json`.
- `src/components/common/latestGallery.js` — runtime fetch of `latest.json`, mirrors `YouTube/videoManifest.js`.
- `src/components/Hero/index.jsx` — home hero; ghost CTA now reads `latestGallery` state.
- `src/components/common/gallerySets.js` — `GALLERY_SETS` + `galleryHubPath(slug)`; must stay in sync with `GALLERIES` in `build-gallery.mjs` (enforced by a test in `build-gallery.test.js`).
- `src/components/YouTube/` — video hub components; `videoManifest.js`'s fetch pattern is what `latestGallery.js` mirrors.
- `netlify.toml` — `VIDEOS_PLAYLIST_ID` committed here (not secret).
- `.claude/strap/project-docs/v1-perf-baseline.md` — authoritative V1 comparison doc; Phase-3 section still needs prior-session numbers transcribed.
- `scripts/perf/lh-baseline.mjs` — re-runnable Lighthouse harness, targets canonical `/galleries`.
- `src/components/WhatsNew/data/metrics.js` — metric tiles, docblock explains TARGET/SHIPPED sourcing.
- `.claude/strap/state/{code,devops}-connection.yaml` — GitHub (JeffGoji/Jeffgoji.com-React-Site) + local strap-agile connection profiles.
