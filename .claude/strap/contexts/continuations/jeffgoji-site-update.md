---
topic: jeffgoji-site-update
last_updated: 2026-08-11T02:07:59Z
last_author: dev-lead
status: parked
linked_work_items: []
---

# jeffgoji.com V2 site update

## What this is

The V2 initiative for jeffgoji.com: a full "new everything" redesign — modern dark motorsport-editorial look, image-loading/performance overhaul, and a self-documenting "V2 What's New" page. Run through the STRAP pipeline with the agent team. **Features A, B, C, and D are all fully resolved and merged to `main`** (Spec 00002 itself is `resolved`). Post-launch, this initiative has settled into a tail of one-off Bug fixes and small feature/content additions, all handled directly (no Requirement/Spec ceremony) given their scope. No active work items remain in `.claude/strap/work/` as of this writing — this continuation exists for the loose ends below, not for in-flight execution.

## Where we left off

Session parked at a natural stopping point, not mid-task. This session's work: replaced the hand-curated 3-video `/youtube` page with a real video hub synced from the CPO's YouTube channel. Ruled out the paid YouTube Data API v3 (CPO didn't want the cost/key management) in favor of a free playlist-RSS-feed build step, mirroring `build-gallery.mjs`'s build-time-manifest pattern. Discovered mid-session that the CPO's channel is a personal account mixing private/unlisted music and movie-soundtrack playlists with car content — not a dedicated car channel — so "sync the whole channel" was wrong; CPO created a new public playlist ("jeffgoji.com", id `PLEXzlfrTFhoQ`, 13 real autocross videos) as the single source instead. A designer subagent explored 3 layout options (mockups preserved at `src/components/YouTube/mockups/`, never wired into routes/build); CPO picked "Filter Grid + featured hero," which a frontend-engineer subagent then ported to production. CPO reviewed the real build live in browser (desktop + mobile, played several videos) and approved. Committed and pushed direct-to-main (`c0d17ac`), then caught and fixed a TOML syntax bug in the CPO's own `netlify.toml` edit (unquoted string value would have broken every future Netlify build) in a follow-up commit (`ab3cb44`). A first `/context-prep` pass followed that push, committed as `a5dbe05`. CPO then confirmed the Netlify production deploy succeeded and fully tested the live site — the one open item from that pass is now resolved; this is the follow-up pass recording that.

**Current state**: `/youtube` is a real hub, live in production and CPO-tested — featured hero, 13-video grid, newest/oldest sort, single shared overlay player (never more than one iframe mounted at once), all fed by `public/videos/manifest.json` (git-ignored, build-generated). Home's `#videos` teaser now sources the same manifest (3 newest) instead of a hardcoded list. `VIDEOS_PLAYLIST_ID` is committed in `netlify.toml` (not a secret, just a public playlist id) rather than requiring a manual Netlify UI env-var step. Verified end-to-end: local build passes, all 1183 Vitest tests pass, live dev-server review, and now the actual Netlify production deploy and live site, all confirmed working by the CPO.

## Files in flight

None. Working tree clean; `main` synced with origin; no worktrees or scratch branches remain.

## Open decisions

- **No lightweight tracking record (Bug/Task YAML) was created for the video-hub work**, unlike the ND-gallery addition which got Task 00081's "chore: resolve" commit. `.claude/strap/work/.next-id` is still `81`. Inconsistent with this tail of work's own precedent — CPO hasn't said whether that consistency matters enough to backfill one now.
- **Two Lighthouse numbers were left un-transcribed** (carried over, untouched this session). `project-docs/v1-perf-baseline.md` only counts a measurement as durable once it lands in the "Phase-3 re-measurement" section. Numbers exist in an earlier session's conversation, not this file — a fresh harness run may be simpler than digging them up.
- **What's New page's metric tiles are stale relative to reality** (carried over, untouched this session). `src/components/WhatsNew/data/metrics.js`'s image-payload tile is still `target: true` at `-50%`, when real numbers clear that. CPO hasn't said whether to update.
- **Two AC gaps remain open, unfiled** (carried over, untouched this session, predate all recent bug fixes): home mobile LCP (6543ms vs. 2500ms target, root cause is the CSS-background hero image lacking `fetchpriority`/preload) and gallery desktop's 49.9%-vs-50% image-byte-reduction miss.

## Open work items

None active. All Feature/Story/Task/Bug work items in `.claude/strap/work/` are `resolved` (`.next-id` is still `81`). The video-hub work this session was handled entirely outside work-item tracking (see Open decisions above).

## Quick resume

1. If CPO wants tracking consistency: file a quick Bug/Task YAML for the already-shipped video-hub work, mirroring Task 00081's after-the-fact pattern.
2. If picking up the perf-baseline-doc gap: re-run `LH_DIR=/c/lh/node_modules node scripts/perf/lh-baseline.mjs` against a fresh `npm run build` + `vite preview --port 4173`, transcribe into `.claude/strap/project-docs/v1-perf-baseline.md`'s Phase-3 section.
3. Otherwise: if CPO doesn't want to action any open item above, this topic can likely go to `status: done` next `/context-prep` pass — nothing left undone that isn't already tracked as a known, accepted gap.

## Critical context

- **YouTube's playlist RSS feed (`youtube.com/feeds/videos.xml?playlist_id=<id>`) caps at 15 items and returns playlist order, not upload-date order** — `build-videos.mjs` sorts; a 16th video added to the playlist will silently not appear on the site without the paid Data API.
- **That RSS feed never includes video duration or view count**, confirmed against live data — don't design any future video-hub feature (sort-by-duration, sort-by-views) assuming they're available without hand-maintaining them.
- **TOML requires quoted string values** — an unquoted value in `netlify.toml` breaks the parser for the *entire file*, not just that key, failing every build. Caught this in the CPO's own edit this session.
- **The CPO's YouTube channel (`@jeffgoji673`) is a personal account, not a dedicated car channel** — it mixes private/unlisted music and movie-soundtrack playlists with public car content. Never assume a playlist is public or on-topic; verify by loading the actual playlist page before wiring anything to it.
- **`scripts/perf/lh-baseline.mjs` prints to stdout, writes no artifact** — durability requires manual transcription into `v1-perf-baseline.md`.
- **Lighthouse must be installed out-of-tree** (`C:\lh`) — short path required on Windows (~66-char nested-package-json read fails past that).
- **`gallery:build` takes ~13 minutes** (mozjpeg re-encoding); unlike it, `videos:build` is a cheap network fetch and is safe to chain directly into `npm run dev`.
- **Vitest double-counts tests if a worktree still exists when running from the main checkout** — always `git worktree remove` first.
- **PR/merge convention for this tail of work**: task/fix branches → `main` directly, no standing integration branch, no PR ceremony.
- **`CreateTeam` is unavailable in this harness.** Workaround: manual `git worktree add -b <branch>` + named background `Agent` dispatch, `node_modules` linked via junction. Never `git checkout -b` in the primary checkout then `git worktree add -b` the same branch name.
- **Netlify reports pending-not-failing PR checks** (`UNSTABLE` mergeStateStatus is normal) — confirm via `mergeable: MERGEABLE`.
- **Push before you PR/merge** — local commits after last push are invisible to `gh`.
- **Verify agent-reported numbers/claims against the actual artifact before merging** — standing discipline, caught real issues before in this tail of work.
- **react-bootstrap/`@restart/ui` derive selection `eventKey` from `href`, not react-router's `to`** — any nav item using `to=` alone gets `null` and silently no-ops on select; any future nav/dropdown addition needs an explicit `eventKey`.
- **Browser automation (claude-in-chrome) operates the user's actual Chrome session** — useful for looking up real external data (e.g. this session's YouTube playlist lookup) and for live-reviewing a running dev server together with the CPO, not just for testing.
- **Don't forget `/context-prep` before ending a session** — this continuation went stale once already when a prior session skipped it.

## Source-of-truth pointers

- `scripts/build-videos.mjs` — the RSS-feed build script; hand-parses YouTube's Atom feed (no XML dependency added), writes `public/videos/manifest.json`.
- `src/components/YouTube/` — `index.jsx` (hub), `VideoTeaser.jsx` (Home's teaser), `FeaturedVideo.jsx`, `VideoPlayerModal.jsx`, `VideoCard.jsx`, `videoManifest.js` (runtime fetch), `videoFormat.js`, `videoCopy.js` (all user-visible strings, this repo's copy-indirection pattern in lieu of i18n).
- `src/components/YouTube/mockups/` — the 3 design-exploration layout options, preserved for reference; never imported by production code or `vite build`.
- `netlify.toml` — `VIDEOS_PLAYLIST_ID` now lives here (committed, not secret) rather than Netlify's UI env-var store.
- `.claude/strap/project-docs/v1-perf-baseline.md` — authoritative V1 comparison doc; Phase-3 section still needs prior session's numbers transcribed.
- `scripts/perf/lh-baseline.mjs` — re-runnable Lighthouse harness, targets canonical `/galleries`.
- `src/components/common/gallerySets.js` / `GalleryHub.jsx` / `scripts/build-gallery.mjs` — the photo-gallery pattern the video hub's build-time-manifest approach mirrors.
- `src/components/WhatsNew/data/metrics.js` — metric tiles, docblock explains TARGET/SHIPPED sourcing.
- `.claude/strap/state/{code,devops}-connection.yaml` — GitHub (JeffGoji/Jeffgoji.com-React-Site) + local strap-agile connection profiles.
