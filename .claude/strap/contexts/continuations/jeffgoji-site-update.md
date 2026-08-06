---
topic: jeffgoji-site-update
last_updated: 2026-08-05T14:50:00Z
last_author: dev-lead
status: parked
linked_work_items: ["00044", "00045", "00075", "00076", "00006"]
---

# jeffgoji.com V2 site update

## What this is

The V2 initiative for jeffgoji.com: a full "new everything" redesign — modern dark motorsport-editorial look, image-loading/performance overhaul, and a self-documenting "V2 What's New" page. Run through the STRAP pipeline with the agent team. **Features A, B, and C are all fully resolved and live on `main`.** Two small follow-up Tasks from Feature C are mid-execution, paused intentionally. Feature D (What's New page) is the one remaining Feature, not yet started, and should not be picked up until the follow-ups below close.

## Where we left off

Session parked intentionally — human had to leave for the airport mid-dispatch. Immediately prior: merged PR #26 and PR #27 (Feature C fully live on `main`), then executed **Task 00074** end to end (devops-lead, mozjpeg re-encode of `dist/gallery/*/original/`, real measured **-55.78%**, 879.5 MiB → 388.9 MiB, merged into `feature/strap-onboarding` at `a5825a9`). That Task's closing report flagged two gaps, CPO confirmed both should be fixed now: **Task 00075** (frontend-engineer — no UI currently exposes the shrunk `full` rendition for download/wallpaper use) and **Task 00076** (devops-lead — the same 17 EXIF-rotated source photos are *already* live-broken in the `thumb`/`display` renditions today, a pre-existing bug found as a side effect).

Both were dispatched into separate worktrees off `feature/strap-onboarding` (`a4daa1b`). Told to stop and checkpoint when the pause request came in:

- **Task 00076 checkpointed successfully**: commit `48b694f` on `task/00076-gallery-thumb-rotation-fix`. Done: added `.rotate()` to the `outThumb`/`outDisplay` sharp chains in `processOne()` (`scripts/build-gallery.mjs` ~line 148-166), before `.resize()`, consolidated the rationale comment. **Not done**: the agent's own `npm run gallery:build` was killed ~4min into a ~13min run, so the worktree's `public/gallery/` is a partial, gitignored, mixed-state tree — must rebuild from scratch, not resume. Also not done: delete two scratch verification scripts (`t76-probe.mjs`, `t76-verify.mjs`) left in the WIP commit only to preserve the verification approach — they must NOT land in the final commit; re-run the 17-file pixel-level rotation check (dimensions alone miss the 5 files that are 180°-rotated); `npm test`; `npm run build`; resolve the YAML.
- **Task 00075 had NOT checkpointed** when the session ended — no WIP commit, just uncommitted edits sitting in the worktree (`.worktrees/task-00075`, branch `task/00075-gallery-download-affordance`): `GalleryHub.jsx`, `GalleryHub.test.jsx`, `GalleryLightbox.jsx`, `GalleryLightbox.test.jsx`, `src/scss/styles.scss` all modified. These survive the shutdown fine (ordinary files on disk), but there's no commit message summarizing progress — read the raw diff cold to assess how far it got.

A real data-quality bug surfaced during Task 00076's pre-fix verification, not yet corrected anywhere: the "17 rotated files" split quoted in both Task 00074's comment c2 and Task 00076's own description (nd-hillcountry×10, nc-eastcoast15×4, nd-totd2025×1, nc-yellowstone15×1) sums to 16, not 17. The devops-lead agent's actual measured split is **nd-hillcountry×11** (not 10) — sums to 17, matches the 12×90°/5×180° orientation-type breakdown. Fix this in `00076.yaml` when it resolves; leave the already-resolved `00074.yaml` alone.

## Files in flight

- `.worktrees/task-00075/src/components/common/GalleryHub.jsx`, `GalleryHub.test.jsx`, `GalleryLightbox.jsx`, `GalleryLightbox.test.jsx`, `src/scss/styles.scss` — uncommitted, in-progress download/wallpaper affordance, unknown completeness.
- `.worktrees/task-00076/scripts/build-gallery.mjs` — committed at `48b694f` (WIP), `.rotate()` added to thumb/display, verified working via diff review but NOT via a full rebuild.
- `.worktrees/task-00076/t76-probe.mjs`, `t76-verify.mjs` — committed into the WIP checkpoint, must be deleted before the final resolve commit.
- `.worktrees/task-00076/public/gallery/` — gitignored, currently a partial/killed build, needs a from-scratch rebuild.

## Open decisions

- No CPO decisions are pending — both follow-up Tasks were explicitly approved before the pause (AskUserQuestion, both "recommended" options chosen). This is purely an execution resume, not a re-litigation point.
- Whether to merge Tasks 00075/00076 into `feature/strap-onboarding` together or as they each individually finish — no strong reason to force them together; merge each as soon as it's independently green, same as every other Task this project.

## Open work items

- `#00005` — resolved — Feature C (image pipeline overhaul), fully live on `main` (PRs #26 + #27 merged).
- `#00044` — active — Story: gallery pipeline overhaul, reopened for Task 00076's tail work.
- `#00045` — active — Story: client-side responsive delivery, reopened for Task 00075's tail work.
- `#00074` — resolved — Task: re-encode gallery originals (mozjpeg, -55.78%), merged.
- `#00075` — new, WIP uncommitted — Task: download/wallpaper affordance for the gallery lightbox.
- `#00076` — new, WIP checkpointed (`48b694f`) — Task: fix pre-existing sideways-photo defect in thumb/display renditions.
- `#00006` — active, not started — Feature D (What's New page). Stories 00061-00063, Tasks 00064-00073. Do not start until 00075/00076 both clear.

## Quick resume

1. `git -C .worktrees/task-00076 status --short` and `git -C .worktrees/task-00075 status --short` first, to confirm nothing changed since this file was written (in case either agent kept working past the checkpoint request).
2. **Task 00076**: in `.worktrees/task-00076`, delete `t76-probe.mjs`/`t76-verify.mjs`, run `npm run gallery:build` fresh (~13min, let it finish), re-verify the corrected 17-file split (11+4+1+1) is upright in both renditions, `npm test -- --run`, `npm run build`, update `.claude/strap/work/task/00076.yaml` to resolved with the corrected file-count and real numbers, commit, merge into `feature/strap-onboarding` from the main checkout.
3. **Task 00075**: in `.worktrees/task-00075`, read the uncommitted diff cold (`git diff`), assess what's done vs. left against the Task's Definition of Done in `.claude/strap/work/task/00075.yaml`, finish the download affordance, verify tests/build, resolve the YAML, commit, merge into `feature/strap-onboarding`.
4. Once both are merged and verified, open a fresh PR `feature/strap-onboarding` → `main` (no PR currently open for this tail work — #27 already merged/closed) — this closes Feature C entirely, including its post-close follow-ups.
5. Clean up both worktrees from the **main checkout** (`git worktree remove .worktrees/task-0007X --force`, `git branch -d task/0007X-...`) once merged.
6. Then, and only then, start Feature D — read Stories 00061-00063 / Tasks 00064-00073 fresh against current file layout.

## Critical context

- **Uncommitted worktree edits survive a host machine shutdown** — ordinary files on disk, not memory-only. What's NOT guaranteed is whether an agent's own `git commit` finished in time; always verify via `git log`/`git status` in the worktree directly, never trust a Task YAML's `state` field alone for in-progress work.
- **The `.rotate()` fix pattern is proven and consistent** — same idiom on `outOriginal` (Task 00074, merged) and `outThumb`/`outDisplay` (Task 00076, WIP): a bare `.rotate()` before `.resize()`/`.jpeg()`/`.webp()`, no argument, bakes EXIF orientation into pixels since this pipeline deliberately never calls `.withMetadata()`.
- **`GalleryHub.jsx` has a docblock explaining why `full` is deliberately dropped** from normalized frames (avoiding accidental eager/srcset fetch of multi-MB files) — Task 00075 needs to thread `full` through as an inert, click-gated-only URL and update that docblock to describe the new deliberate exception, not leave it claiming `full` is dropped entirely.
- **`gallery:build` takes ~13 minutes** (mozjpeg re-encoding 286 photos), up from ~3 minutes pre-Task-00074. Affects local iteration speed and will affect Netlify build minutes once shipped.
- **Vitest double-counts tests if a worktree still exists when running from the main checkout** (939 → 1878 seen this session) — not a real failure, just noise; remove/ignore worktrees before trusting the centralized test-pass number.
- **PR/merge convention**: task/feature branches → `feature/strap-onboarding` (stacked, `--merge`, `--delete-branch` on the head) → separate PR `feature/strap-onboarding` → `main` when shipping (also `--merge`, but NEVER `--delete-branch` — that branch is the standing integration branch).
- **Netlify reports zero PR status checks on this repo** across every PR so far (#24-#27) — normal here, not a red flag. Use `gh pr view --json mergeable,mergeStateStatus` as the real merge-readiness signal.
- **PUSH BEFORE YOU PR/merge** — local commits after a branch's last push are silently invisible to `gh`.
- **`CreateTeam` is unavailable in this harness.** Workaround: manual `git worktree add -b <task-branch> <path> <feature-branch>` + named background `Agent` dispatch, `node_modules` linked via PowerShell `New-Item -ItemType Junction`. Confirmed reliable across ~45 dispatches this project.
- **LCP/Lighthouse re-measurement has never been done anywhere in this project** (no browser tool available to any dispatched agent) — flagged repeatedly across Features B and C, still open, still not blocking.
- **Verify agent-reported numbers against the actual artifact before merging further** — this session caught the 17-file split's off-by-one this way; it's the standing bar, not optional.

## Source-of-truth pointers

- `.claude/strap/work/task/00074.yaml` comment c2 — devops-lead's full verification report for the merged re-encode (real numbers, EXIF-rotation catch); note its 17-file split is off-by-one, corrected in this file above.
- `.claude/strap/work/task/00075.yaml`, `00076.yaml` — read these for full Task briefs; their `state` fields do not yet reflect actual worktree progress, see Quick resume.
- `.claude/strap/work/story/00044.yaml` comment c4, `.claude/strap/work/story/00045.yaml` comment c3 — most current per-Story audit trail.
- `scripts/build-gallery.mjs` at commit `a5825a9` on `feature/strap-onboarding` — Task 00074's merged `.rotate()`/mozjpeg pattern, the reference Task 00076 mirrors.
- `src/components/common/GalleryHub.jsx`, `GalleryLightbox.jsx` — Task 00075's target files; read GalleryHub's existing docblock before touching.
- PRs #24-#27 (all merged) — reference examples of the two-stage stacked promotion flow.
- `.claude/strap/state/{code,devops}-connection.yaml` — GitHub (JeffGoji/Jeffgoji.com-React-Site) + local strap-agile profiles.
