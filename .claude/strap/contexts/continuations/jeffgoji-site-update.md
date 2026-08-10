---
topic: jeffgoji-site-update
last_updated: 2026-08-10T23:15:00Z
last_author: dev-lead
status: parked
linked_work_items: []
---

# jeffgoji.com V2 site update

## What this is

The V2 initiative for jeffgoji.com: a full "new everything" redesign — modern dark motorsport-editorial look, image-loading/performance overhaul, and a self-documenting "V2 What's New" page. Run through the STRAP pipeline with the agent team. **Features A, B, C, and D are all fully resolved and merged to `main`** (Spec 00002 itself is `resolved`). Post-launch, this initiative has settled into a tail of one-off Bug fixes surfaced by real Lighthouse audits and CPO manual testing. No active or new Feature/Bug/Task work items remain in `.claude/strap/work/` as of this writing — this continuation exists for the loose ends below, not for in-flight execution.

## Where we left off

Session parked at a natural stopping point, not mid-task. Prior session: ran a real Lighthouse audit, filed and fixed Bugs 00077/00078/00079 (CLS regression, perf-harness URL bug, gallery nav dropdown selection), PRs #30/#31, all merged. This session: CPO interrupted an unrelated `/context-fetch` to report the mobile nav accordion never retracts on selection — investigated directly (no specialist dispatch), traced the root cause through `react-bootstrap`/`@restart/ui` source (every nav item derives a `null` event key because it uses react-router's `to` prop instead of `href`, so both `NavItem` and `Nav`'s select handlers bail out before reaching `Navbar`'s `collapseOnSelect`), fixed by adding explicit `eventKey` props throughout `NavMenu/index.jsx`, added two regression tests (29/29 passing), and filed/resolved **Bug 00080** directly on `main` (commit `294bb4b` fix + `0e41440` tracking record, no PR, no branch). Verified live on production; CPO independently confirmed. **Session then ended without running `/context-prep`** — this pass is a catch-up, not new work.

**Final measured state**: gallery desktop CLS 1.024→0.003, Perf 75→99 (beats V1's 93) as of Bugs 00077-00079. Mobile nav accordion now correctly retracts on direct-link and gallery-leaf selection while staying open through Galleries/submenu toggles (Bug 00080, verified live). Two items remain open — see below — that predate this tail of work and are unrelated to any of the four Bugs fixed so far.

## Files in flight

None. Working tree is clean; `main` is fully synced with origin; no worktrees or scratch branches remain (all worktrees created this session were cleaned up after each merge).

## Open decisions

- **Two Lighthouse numbers were left un-transcribed.** `project-docs/v1-perf-baseline.md` says a measurement only counts as durable once it lands in that doc's "Phase-3 re-measurement" section (Bug 00073's own finding — `lh-baseline.mjs` prints to stdout and writes no artifact). This session ran the harness three times post-fix but never wrote the results into the doc. If anyone runs `/dora-report`-style perf tracking or a future agent asks "has V2 been measured?", the honest answer is still "not durably" until this is done. Quick to do — the numbers are in this conversation's final comparison table.
- **What's New page's metric tiles are stale relative to reality.** `src/components/WhatsNew/data/metrics.js`'s image-payload tile is still `target: true` (TARGET, not SHIPPED) at `-50%`. This session's real numbers show gallery mobile alone hit -96%, and home desktop/mobile both now clear 50%+ — genuinely flippable now, at least partially. CPO has not yet said whether to update the tiles or file a Task for it.
- **Two AC gaps are open, unfiled, and pre-date this session's bug fixes** (confirmed not caused or fixable by Bugs 00077/00078/00079):
  - Home mobile: Perf 73 (<80), LCP 6543ms (>2500ms target) — known root cause per earlier investigation is the CSS-background hero image lacking `fetchpriority`/preload; Lighthouse's `prioritize-lcp-image` audit already named this.
  - Gallery desktop: image-byte reduction is 49.9%, just short of the 50% AC-006 bar — essentially a rounding-distance gap, not something either bug fix touched.
  - CPO has not indicated whether either is worth filing as a Bug/Task.

## Open work items

None active. All Feature/Story/Task/Bug work items in `.claude/strap/work/` are `resolved` (`.next-id` is `80`, matching Bug 00080 as the latest). PRs #28-#31 are all merged to `main`; Bug 00080 shipped without a PR (direct-to-main, per this tail of work's convention). If the two items above get actioned, they'd be new `/file-bugs` or `/new-requirement` intake, not a resume of existing work.

## Quick resume

1. If picking up the perf-baseline-doc gap: read this conversation's final Lighthouse comparison table (or re-run `LH_DIR=/c/lh/node_modules node scripts/perf/lh-baseline.mjs` against a fresh `npm run build` + `vite preview --port 4173`) and transcribe into `.claude/strap/project-docs/v1-perf-baseline.md`'s Phase-3 section.
2. If picking up the What's New metric tiles: read `src/components/WhatsNew/data/metrics.js`'s existing `SOURCING` docblock (written by Tasks 00069/00073) before touching values — it documents exactly which numbers are safe to flip and why the other two aren't yet.
3. If the CPO wants either open AC gap (home mobile LCP, gallery desktop's 49.9%-vs-50%) turned into real work: `/file-bugs` or `/new-requirement`, dev-lead's call per severity — home mobile is the more user-visible of the two.
4. Otherwise: this topic can likely go to `status: done` next `/context-prep` pass if the CPO doesn't want to action either open item — the V2 initiative itself has nothing left undone.

## Critical context

- **`scripts/perf/lh-baseline.mjs` prints to stdout and writes no artifact.** A perf run that isn't manually transcribed into `v1-perf-baseline.md` leaves no durable record — confirmed as a real gap this session (see Open decisions).
- **Lighthouse must be installed out-of-tree** (`C:\lh` this session) — it's a ~200MB dep deliberately excluded from `package.json`. On Windows the install path must be short (~66-char nested-package-json read fails past that). See `lh-baseline.mjs`'s own header comment for the exact install command.
- **`gallery:build` takes ~13 minutes** (mozjpeg re-encoding 286 photos) — every `npm run build` this session paid that cost; budget for it when planning perf work.
- **Vitest double-counts tests if a worktree still exists when running from the main checkout** — always `git worktree remove` before trusting a centralized test count.
- **PR/merge convention for this tail of work**: task/fix branches → `main` directly (NOT via `feature/strap-onboarding`, which was Feature A-D's staging branch and has served its purpose — Bugs 00077/00078/00079 all branched straight off `main`). No standing integration branch is currently in play; `main` is the live trunk.
- **`CreateTeam` is unavailable in this harness.** Workaround, confirmed reliable across ~50+ dispatches this project: manual `git worktree add -b <branch> <path> <base>` + named background `Agent` dispatch, `node_modules` linked via PowerShell `New-Item -ItemType Junction`. **One real trap hit this session**: never `git checkout -b <branch>` in the *primary* checkout and then try to `git worktree add -b <same-branch>` for a specialist — git can't check out one branch in two places, so it silently creates a different branch than intended. Cut the worktree's branch first, or use a distinct scratch name and rebase after.
- **Netlify reports pending-not-failing PR checks on this repo** (`Header rules`, `Pages changed`, `Redirect rules`, `netlify/.../deploy-preview`) — `mergeStateStatus: UNSTABLE` from these alone is normal, not a merge blocker; confirm via `mergeable: MERGEABLE` instead.
- **PUSH BEFORE YOU PR/merge** — local commits after a branch's last push are silently invisible to `gh`.
- **Verify agent-reported numbers against the actual artifact before merging** — standing discipline all session; caught real issues in Bug 00070's content (a "six mechanisms" claim that should've been three) and Bug 00072's metric copy (an invented LCP baseline).
- **react-bootstrap/`@restart/ui` derive selection `eventKey` from `href`, not react-router's `to`.** Any nav item using `to=` alone gets a `null` derived key, and both `NavItem` and `Nav`'s select handlers silently no-op on `null` — this is what made `collapseOnSelect` fully inert since the nav first shipped (Bug 00080). Any future nav/dropdown addition must set an explicit `eventKey` or it will silently fail to participate in selection.
- **Don't forget `/context-prep` before ending a session** — this continuation itself went one full session stale (missed Bug 00080) because the prior session ended without running it; the committed and working-tree copies had drifted apart as a result.

## Source-of-truth pointers

- `.claude/strap/project-docs/v1-perf-baseline.md` — the authoritative V1 comparison doc; Phase-3 section is where this session's numbers still need to land (see Open decisions).
- `scripts/perf/lh-baseline.mjs` — the re-runnable Lighthouse harness; now correctly targets canonical `/galleries` (Bug 00078's fix).
- `src/components/common/gallerySets.js` — `galleryHubPath(slug)`, the single mechanism both the nav and legacy redirects now use to preserve gallery-set identity (Bug 00079).
- `src/components/NavMenu/index.jsx` — nav's `eventKey` props (Bug 00080) and `galleryHubPath()`-based `to=` targets (Bug 00079) now coexist on the same Dropdown.Items without conflict.
- `src/components/WhatsNew/data/metrics.js` — What's New page's metric tiles; docblock explains current TARGET/SHIPPED sourcing, relevant to the open decision above.
- `.claude/strap/work/bug/0007{7,8,9,80}.yaml` — full investigation + fix record for this tail of work's four Bugs, including root-cause chains and verification numbers.
- `.claude/strap/state/{code,devops}-connection.yaml` — GitHub (JeffGoji/Jeffgoji.com-React-Site) + local strap-agile profiles.
- PRs #28-#31 (all merged); Bug 00080 shipped direct-to-main with no PR.
