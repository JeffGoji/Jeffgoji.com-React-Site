---
topic: jeffgoji-site-update
last_updated: 2026-08-05T14:45:00Z
last_author: dev-lead
status: active
linked_work_items: ["00005", "00006"]
---

# jeffgoji.com V2 site update

## What this is

The V2 initiative for jeffgoji.com: a full "new everything" redesign — modern dark motorsport-editorial look, image-loading/performance overhaul, and a self-documenting "V2 What's New" page. Run through the STRAP pipeline with the agent team. **Features A, B, and C are all fully resolved and live on `main`** (PR #27 merged this session). One Feature remains: D (What's New page, not started) — but two small follow-up Tasks from Feature C are still open first (see below). **Session paused mid-work** — human had to shut down the machine (airport) with two agents mid-task; this file was updated as an emergency checkpoint, not a natural stopping point.

## Where we left off — READ THIS FIRST, mid-session pause

This session (continuing from a prior one): merged **PR #26** (`6eaf7c6`) and **PR #27** (`c0d2218`) — Feature C is now live on `main`. Then executed **Task 00074** (re-encode `dist/gallery/*/original/` via mozjpeg, no resize) end to end: devops-lead resolved it, merged into `feature/strap-onboarding` (`a5825a9`), real measured result **879.5 MiB → 388.9 MiB (-55.78%)** across all 286 files. It caught and fixed a real regression along the way: 17 source photos carry non-identity EXIF orientation, and the re-encode (which deliberately strips EXIF) would have shipped them rotated without an added `.rotate()` call.

Task 00074's own report flagged two gaps, and the CPO (via AskUserQuestion) said fix both now:
1. **No UI exposes the shrunk `full` rendition at all** — `GalleryHub.framesFrom` drops the `full` field, `GalleryLightbox` never renders it. → filed **Task 00075** (frontend-engineer): add a user-initiated download/wallpaper link in the lightbox wired to `frame.full`, without violating `GalleryHub`'s existing no-eager-fetch design intent.
2. **The same 17 sideways photos are ALSO already live-broken today** in the `thumb`/`display` renditions (pre-existing bug, not introduced this session, just discovered as a side effect) — → filed **Task 00076** (devops-lead): mirror the `.rotate()` fix onto `outThumb`/`outDisplay` in the same `processOne()` function.

Both dispatched in parallel worktrees (`.worktrees/task-00075`, `.worktrees/task-00076`) off current `feature/strap-onboarding` (`a4daa1b`, includes Task 00074). **THEN THE HUMAN HAD TO SHUT DOWN FOR THE AIRPORT MID-DISPATCH.** Both agents were told to immediately checkpoint-commit whatever they had (marked `WIP:`) rather than finish cleanly, and NOT to flip their Task YAML to resolved. Whether they actually got a WIP commit in before the process died is **unconfirmed** — check first thing next session (see Quick resume).

**UPDATE, both agents reported back before the machine actually went down:**

**Task 00076 (devops-lead) checkpointed successfully**: commit `48b694f` "WIP: Task 00076 in progress, rotate() added to thumb/display, verification not yet complete" on `task/00076-gallery-thumb-rotation-fix`, tree clean. What's actually done: added a bare `.rotate()` to the `outThumb` and `outDisplay` sharp chains in `processOne()` (`.worktrees/task-00076/scripts/build-gallery.mjs`, ~lines 148-166), placed BEFORE `.resize()` so the width bound applies to the already-upright frame; consolidated the rotate-rationale comment to cover all three renditions instead of just `original`. **What's left, in order**: (1) delete `t76-probe.mjs`/`t76-verify.mjs` from the worktree root before any real commit — the agent left them committed into the WIP checkpoint ONLY to preserve the verification approach, they must not land in the final commit; (2) re-run the full `npm run gallery:build` from scratch — the agent's own run was killed ~4min into a ~13min run, so **the worktree's `public/gallery/` is currently a partial, mixed-state, gitignored tree and must be rebuilt from zero next session, not resumed**; (3) re-run the 17-file programmatic verification (dimension + pixel-level rotation check — dimensions alone don't catch the 5 files that are 180°-rotated, only the pixel-level check does, per the agent's own note on why `t76-verify.mjs` exists); (4) `npm test -- --run`; (5) `npm run build`; (6) update `.claude/strap/work/task/00076.yaml` to resolved with real numbers.

**Pre-fix verification already confirmed the underlying defect is real** (this part doesn't need redoing): probed the main checkout's already-built gallery output directly — all 17 non-identity-orientation source files DO have sideways `thumb`/`display` output today in production, e.g. `nc-eastcoast15/nc-17.jpg` (source as-displayed 2988x5312 portrait) currently ships as a 320x180 landscape thumb. That raw probe data lived at `<scratchpad>/before.json` and will NOT survive the session — **next session must re-probe the main checkout's current `public/gallery/` fresh before rebuilding the worktree's**, there's no saved baseline to diff against otherwise.

**Data-quality correction surfaced by the re-probe, not yet applied anywhere**: Task 00074's comment c2 and Task 00076's own description both state the 17-file split as nd-hillcountry×10, nc-eastcoast15×4, nd-totd2025×1, nc-yellowstone15×1 (sums to 16, not 17 — an existing off-by-one). The devops-lead agent's actual measured split is nd-hillcountry×**11**, nc-eastcoast15×4, nd-totd2025×1, nc-yellowstone15×1 (sums to 17, and the 12×90°/5×180° orientation-type split checks out against this version). **Correct this in `00076.yaml` when it resolves**, and note `00074.yaml`'s comment c2 also carries the wrong number (leave that one alone, it's a closed/resolved record — just don't propagate the error further).

**Task 00075 (frontend-engineer) had NOT checkpointed as of the last check** — still just uncommitted modified files sitting in the worktree, no WIP commit landed: `.worktrees/task-00075` (branch `task/00075-gallery-download-affordance`) shows `src/components/common/GalleryHub.jsx`, `GalleryHub.test.jsx`, `GalleryLightbox.jsx`, `GalleryLightbox.test.jsx`, `src/scss/styles.scss` all modified, no new commit beyond `a4daa1b`. These are real file edits sitting on local disk — shutting the machine down does NOT lose them (not memory-only) — but unlike 00076 there's no commit message summarizing what's actually done vs. left, so next session will need to read the raw diff cold to assess progress. If a message from that agent arrives after this file was written, it supersedes this paragraph — check the conversation for a later report before assuming this is still accurate.

## Quick resume — do this first, in order

1. `/context-fetch jeffgoji-site-update` to reload this context.
2. **Check both worktrees' actual state before doing anything else:**
   ```
   git -C .worktrees/task-00075 log --oneline -3
   git -C .worktrees/task-00075 status --short
   git -C .worktrees/task-00076 log --oneline -3
   git -C .worktrees/task-00076 status --short
   ```
   - If a `WIP:` commit is there: good, the agent checkpointed. Read the diff, assess how much is left, and either resume the same agent (SendMessage to its name if a fresh session still has the harness state) or just pick up the work directly yourself from the WIP commit.
   - If `git status` still shows the same uncommitted modified files listed above with NO new commit: the process died before it could commit. The file edits are still there on disk (check `git diff` to see how far the agent actually got) — read them, judge whether they're salvageable or should be discarded (`git checkout -- <file>` per-file if you want to start that file over), and continue the Task fresh from that assessment.
   - Either way, **do not trust `.claude/strap/work/task/00075.yaml` / `00076.yaml`'s `state` field alone** — they were explicitly told not to flip to resolved, so `state: new` there does NOT necessarily mean no progress was made; check the worktree, not just the YAML.
3. Once 00075 and 00076 are both actually resolved and merged into `feature/strap-onboarding`, that closes out Feature C's tail entirely (Story 00044 → resolved again, Story 00045 → resolved again) — a fresh small PR `feature/strap-onboarding` → `main` is needed to ship them (no open PR exists for this yet, PR #27 already merged/closed).
4. **Then** Feature D (What's New page) is the next and last Feature in the V2 initiative — read Stories 00061-00063 / Tasks 00064-00073 fresh, they haven't been touched or reconciled against current file layout yet.
5. Clean up worktrees once their Tasks are merged: `git worktree remove .worktrees/task-00075 --force`, `git worktree remove .worktrees/task-00076 --force`, then `git branch -d task/00075-gallery-download-affordance task/00076-gallery-thumb-rotation-fix`. **Do this from the MAIN checkout, never from inside a worktree.**

## Open work items

- `#00001`-`#00004` — resolved, live on `main`.
- `#00005` — Feature stays **resolved**, fully live on `main` (PR #26 + #27 both merged). Two child Stories reopened for tail work: **Story 00044** (active) — Task 00074 resolved+merged, **Task 00076 in progress (unconfirmed state, see above)**. **Story 00045** (active) — **Task 00075 in progress (unconfirmed state, see above)**.
- `#00006` — active, not yet touched — Feature D (What's New page). Stories 00061-00063, Tasks 00064-00073. Blocked on 00075/00076 clearing first (not a hard predecessor, just the sane order — don't context-switch mid-cleanup).

## Critical context

- **CPO-directed capacity override remains the default execution mode.** Used successfully across Features A, B, C in full, and this session's Task 00074/00075/00076 follow-ons. No exceptions this project.
- **A subagent's uncommitted worktree edits survive a host machine shutdown** — they're ordinary files on disk, not in-memory state. What does NOT reliably survive is the agent process finishing its own `git commit` in time, and possibly the harness's live conversation/task state for that agent depending on how the session was terminated. Always verify via `git log`/`git status` in the worktree directly; never assume a WIP commit landed just because it was requested.
- **`GalleryHub.jsx` has a docblock explaining why the manifest's `full` field is deliberately dropped** (avoiding accidental eager/srcset fetch of multi-MB files) — Task 00075 needs to thread `full` through as an inert URL (fine, since the risk was always eager-loading behavior, not the string's mere presence) and should update that docblock's reasoning to note the new deliberate click-gated exception, not leave it claiming `full` is dropped entirely once it isn't.
- **The `.rotate()` fix pattern is already proven** — Task 00074's merged diff to `outOriginal` in `scripts/build-gallery.mjs` (commit `a5825a9`) is the exact idiom Task 00076 mirrors onto `outThumb`/`outDisplay`. No new design decision needed there, just apply the same fix to two more `sharp` chains in the same function.
- **`gallery:build` is expensive**: mozjpeg re-encoding across all 286 source photos took ~13 minutes wall time in Task 00074 (vs ~3 minutes for the old byte-copy). This affects local iteration speed on both 00075 and 00076's verification passes, and will affect Netlify build minutes once shipped — worth keeping in mind, not yet flagged to Netlify/CI config.
- **Vitest picks up `.worktrees/*` as a second copy of the repo if you run tests from the main checkout while a worktree still exists** — doubles the reported test count (939 → 1878 seen this session). Not a real failure, just noise; either ignore the doubled count or remove/ignore the worktree before running the centralized test pass for a clean number.
- **`CreateTeam` is unavailable in this harness.** Workaround: manual `git worktree add -b <task-branch> <path> <feature-branch>` + named background `Agent` calls, `node_modules` linked via PowerShell `New-Item -ItemType Junction`. Confirmed reliable across ~45 dispatches this project.
- **PR/merge convention**: feature/task branches → `feature/strap-onboarding` (stacked, `--merge` not squash) → separate PR `feature/strap-onboarding` → `main` when ready to deploy (also `--merge`, no `--delete-branch` on this one — never delete `feature/strap-onboarding` itself). Stage-1 branches get `--delete-branch`; the integration branch never does.
- **Netlify does not report PR status checks on this repo** (`gh pr checks` has come back empty on every PR this project, #24 through #27) — this is normal here, not a red flag; `mergeStateStatus`/`mergeable` via `gh pr view --json` is the real signal to check instead.
- **PUSH BEFORE YOU PR / merge.** Local commits after a branch's last push are silently absent from `gh`'s view of that branch.
- **Always operate git commands from the correct checkout** — never from inside a specialist's worktree unless deliberately inspecting that worktree's own state.
- **Standing verification bar, still open**: LCP/Lighthouse re-measurement has never been done anywhere in this project (no browser tool available to any dispatched agent) — flagged repeatedly across Features B and C, still not actioned.
- **Verify agent-reported numbers against the actual artifact, not just the report.** This session independently re-confirmed Task 00074's size/dimension/EXIF claims by reviewing its actual merged diff before merging further; this is the standing bar for every agent report, not optional.

## Source-of-truth pointers

- `.claude/strap/work/feature/00005.yaml` — Feature C's full audit trail, comment c7 is the most recent (notes Task 00074 filed, does not yet reflect 00074's completion or 00075/00076 — update when this tail work closes).
- `.claude/strap/work/story/00044.yaml` comment c4, `.claude/strap/work/story/00045.yaml` comment c3 — the most current per-Story state, written right before the pause.
- `.claude/strap/work/task/00074.yaml` — resolved, comment c2 has devops-lead's full verification report (real numbers, the EXIF-rotation defect catch, the two flags that spawned 00075/00076).
- `.claude/strap/work/task/00075.yaml`, `00076.yaml` — **state likely still shows `new`/in-progress regardless of actual worktree progress** — see Quick resume step 2, check the worktree not just the YAML.
- `scripts/build-gallery.mjs` — commit `a5825a9` on `feature/strap-onboarding` has Task 00074's merged `.rotate()`/mozjpeg fix on `outOriginal` — the reference pattern for Task 00076.
- `src/components/common/GalleryHub.jsx`, `GalleryLightbox.jsx` — Task 00075's target files; read GalleryHub's existing docblock (~lines 55-56, ~89) before touching.
- PRs #24-#27 (all merged) — reference examples of the two-stage stacked promotion flow.
- `.claude/strap/state/{code,devops}-connection.yaml` — GitHub (JeffGoji/Jeffgoji.com-React-Site) + local strap-agile profiles.
