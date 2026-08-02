---
topic: jeffgoji-site-update
last_updated: 2026-08-02T03:05:00Z
last_author: dev-lead
status: active
linked_work_items: ["00003", "00004", "00005", "00006"]
---

# jeffgoji.com V2 site update

## What this is

The V2 initiative for jeffgoji.com: a full "new everything" redesign with three goals — (1) a modern dark motorsport-editorial look, (2) image-loading/performance overhaul, (3) a self-documenting "V2 What's New" page. Run through the STRAP pipeline with the agent team. Planning is fully done (Requirement → Spec → mockups → 4 Features → all Stories/Tasks decomposed). Execution has started: Feature C's Phase-0 baseline slice is built, tested, PR-reviewed, and merged. Full durable detail lives in dev-lead memory `v2-initiative.md`.

## Where we left off

**Feature 00005 (Feature C) Phase-0 baseline is done and merged.** `/plan-sprint 00005` allocated Stories 00042+00043 into Sprint 2026.08.A (7 Tasks, 26h); `/execute-sprint 00005` ran all 3 waves, dev-lead reviewed and merged every Task branch, ran an independent build+test pass, walked AC traceability (AC-003/004/012/013/017), and opened PR #16 (`feature/00005-image-perf-analytics-baseline` → `feature/strap-onboarding`, stacked mode since `main` still lacks the STRAP install). CPO reviewed PR #16 interactively (walked the browser-floor fix and the `_headers` rewrite), then approved and merged it — merge commit `de2d4a0` on `feature/strap-onboarding`, source branch deleted, local checkout fast-forwarded and cleaned up. Feature 00005 stays `active` (not resolved) — Stories 00044/00045 (Phase-3 image-pipeline overhaul, AC-006..011) remain unallocated overflow. CPO was last asked whether to run `/plan-sprint 00003` (Feature A, next in execution order) — no answer yet when this checkpoint was written.

## Files in flight

None — working tree is clean, everything from Feature C's execution is committed and merged. Two real-world (non-code) actions remain open:
- **Plausible account provisioning** — CPO said "I'll provision an account later." Blocks the V1 engagement-baseline capture window (`v1-engagement-baseline.md`).
- **`feature/strap-onboarding` → `main` merge** — not yet done; `main` still has no STRAP install and none of the V2 work. Timing is CPO's call, no urgency signaled.

## Open decisions

- **Next Feature to execute?** Per the locked order (Feature C baseline → Feature A → Feature B + Feature C perf → Feature D), Feature A (00003, design foundation + app shell) is next. Sprint 2026.08.A (ends 2026-08-08) still has ~16h of unused capacity — `/plan-sprint 00003` could pull some of Feature A into the current sprint rather than waiting for a new one. CPO hasn't decided yet.
- **When to merge `feature/strap-onboarding` → `main`?** No blocker, just a CPO timing call.
- **Plausible account** — CPO will provision later; no ETA given.

## Open work items

- `#00001` — resolved — Requirement: V2 (3 goals).
- `#00002` — resolved — Spec: dark motorsport-editorial V2 (9 Parts, 18 ACs, mockups wired).
- `#00003` — active, **not yet sprint-allocated** — Feature A (design foundation + shell). Stories 00007-00011, Tasks 00012-00025. Next up per execution order.
- `#00004` — active, not yet sprint-allocated — Feature B (per-surface redesign). Stories 00026-00029, Tasks 00030-00041. Predecessor 00003.
- `#00005` — active, **PARTIALLY EXECUTED** — Feature C. Stories 00042 ✅resolved + 00043 ✅resolved (7 Tasks, all merged via PR #16). Stories 00044/00045 (8 Tasks) still `new`, unallocated overflow — need Feature B's surfaces to exist first (00045) and more sprint capacity.
- `#00006` — active, not yet sprint-allocated — Feature D (What's New page). Stories 00061-00063, Tasks 00064-00073. Predecessors 00003/4/5 (LAST).

## Quick resume

1. `/context-fetch jeffgoji-site-update` to reload this context.
2. Ask the CPO: run `/plan-sprint 00003` (Feature A) now, or wait? If yes, dispatch sprint-planner the same way as Feature C's run — current sprint has ~16h headroom.
3. Periodically remind the CPO about Plausible account provisioning (blocks `v1-engagement-baseline.md`'s capture window) and the eventual `feature/strap-onboarding` → `main` merge — neither is urgent but both are easy to forget.

## Critical context

- **Estimates are human senior-dev hours for planning/velocity — NOT pipeline wall-clock.** Agents execute each task in minutes.
- **`CreateTeam` is unavailable in this harness/session** despite `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` + `CLAUDE_CODE_SPAWN_BACKEND=auto` both being set correctly. Workaround (now the established pattern here): dev-lead creates git worktrees manually (`git worktree add --detach <path> <feature-branch>`) and dispatches specialists via background `Agent` calls (give them a `name` so `SendMessage` keeps working) instead of `CreateTeam` teammates.
- **Windows long-path limit hits on the first `git worktree add`** in this repo (long nested worktree paths + long legacy image filenames). Fixed once via `git config core.longpaths true` — already set on this repo, should persist, but verify if worktree creation fails again.
- **`npm install --prefix <path>` (run from outside the target dir) silently injects a self-referential `file:` dependency into `package.json`** plus lockfile churn. Always `cd` into the target dir first; never use `--prefix`. This is the one exception to the general "prefer absolute paths over compound `cd &&`" shell habit.
- **`esbuild`'s `build.target` downlevels syntax only — it never polyfills built-ins.** Caught a real regression from this: deleting a hand-written `Object.hasOwn` polyfill (labelled dead SSR residue, but actually load-bearing for `react-markdown` v10 at render time) would have shipped a browser-support gap invisible on any modern browser. Fixed by pinning an explicit `build.target` in `vite.config.js` instead of trusting Vite's default.
- **Plausible's default `script.js` auto-tracks SPA navigation via `pushState` patching.** This project uses `script.manual.js` + a hand-rolled `usePageviews()` hook instead — the default build would double-count every route change. Don't revert the script src without also removing the hook.
- **Background specialist agents sometimes finish and push without sending the required finishing `SendMessage`.** Happened once (Task 00051) — the agent had already committed, pushed, and gone idle with no report. If a dispatched agent goes quiet, check `git worktree list` / `git ls-remote` for its task branch before assuming it's stuck — it may have already finished.
- **STRAP work-item YAML edits (state transitions, audit comments) must be committed periodically, not left sitting in the working tree.** Caught this mid-session — several Task/Story resolutions had accumulated uncommitted for a while. Local strap-agile has no separate persistence layer; the git commit IS the persistence.
- **Token-budget tracking (`usage.yaml`) needs updating after each specialist report, not just reconstructed at session end.** Missed this during Feature C's execution — devops-lead ended up at 289K against its 200K per-agent budget, only caught when backfilling `usage.yaml` at close-out. Nothing broke, but check incrementally next time.
- **PR review/merge convention**: Feature branches target `feature/strap-onboarding`, not `main` (stacked mode, since `main` lacks the STRAP install). CPO reviews interactively (asks to see specific diffs) before approving merge. Merge strategy used: `--merge` (not squash) to preserve the Task-level audit-trail commits; `--delete-branch` to clean up after.
- **Locked V2 palette** (softer-dark): charcoal `#141418`, reading panel `#202027`, red `#E10600`, warm off-white text; Archivo/Inter/Space Mono; "Goji Line" logo. Full detail in `designer.md` memory + `mockups/spec-00002/assets/tokens.css`.
- CPO preference: never commit to `main`; all work via feature/task branches + reviewed PR.

## Source-of-truth pointers

- `.claude/strap/memory/dev-lead/v2-initiative.md` — the durable V2 map: locked decisions, pipeline progress, PR links, open CPO actions.
- `.claude/strap/state/usage.yaml` — per-agent/session token budget tracking; check before dispatching more specialists.
- `.claude/strap/work/feature/00005.yaml` — Feature C's audit trail; shows the partial-execution pattern for future Features that span multiple sprints.
- `.claude/strap/project-docs/v1-perf-baseline.md` + `v1-engagement-baseline.md` — the V1 before-state Phase-3 work measures against; cross-linked to each other.
- PR #16: `https://github.com/JeffGoji/Jeffgoji.com-React-Site/pull/16` — merged, `de2d4a0`. First reference for how a Feature-C-shaped PR review/merge went.
- `.claude/strap/work/spec/00002.yaml` — the Spec: Constituent Parts, 18 ACs, Mockup Reference + Wiring Guide.
- `.claude/strap/mockups/spec-00002/` — approved visual contract (open `index.html`); `assets/tokens.css` = design-token source of truth.
- `.claude/strap/memory/agents/{designer,devops-lead,frontend-engineer,spec-lead}.md` — per-domain tradecraft, actively curated during Feature C's execution.
- `.claude/strap/state/{code,devops}-connection.yaml` — GitHub (JeffGoji/Jeffgoji.com-React-Site) + local strap-agile profiles.
