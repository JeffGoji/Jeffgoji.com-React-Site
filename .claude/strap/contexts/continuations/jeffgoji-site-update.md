---
topic: jeffgoji-site-update
last_updated: 2026-08-04T01:10:00Z
last_author: dev-lead
status: active
linked_work_items: ["00003", "00004", "00005", "00006"]
---

# jeffgoji.com V2 site update

## What this is

The V2 initiative for jeffgoji.com: a full "new everything" redesign with three goals — (1) a modern dark motorsport-editorial look, (2) image-loading/performance overhaul, (3) a self-documenting "V2 What's New" page. Run through the STRAP pipeline with the agent team. Planning is fully done (Requirement → Spec → mockups → 4 Features → all Stories/Tasks decomposed). Execution is underway across two Features in parallel tracks: Feature C's (00005) baseline slice merged first, now Feature A (00003) has landed its own foundational slice. Full durable detail lives in dev-lead memory `v2-initiative.md` (stale as of this checkpoint — needs a refresh pass).

## Where we left off

**Feature 00003 (Feature A) Story 00007 is fully resolved; Story 00008 is partially resolved.** `/plan-sprint 00003` allocated Story 00007 (whole, 3 Tasks, 10h) + Task 00015 (split from Story 00008, 4h) into Sprint 2026.08.A's remaining 16h. `/execute-sprint 00003` ran 2 waves (00012 solo, then 00013/00014/00015 in parallel), dev-lead reviewed and merged every Task branch, ran independent build+test passes after each merge (245/245 tests green, `vite build` clean), and opened PR #17 (`feature/00003-design-foundation-shell` → `feature/strap-onboarding`, stacked mode). CPO asked me to review/merge PR #17 directly — done. **Post-merge, discovered PR #17 had been opened from a stale local push**: two commits (Task 00013 + Story 00007 resolution, and the Feature close-out audit comment) were never pushed before `gh pr create` ran, so they weren't in the PR's diff. Fixed via a follow-up branch (`fix/00003-finalize-work-item-state`, cherry-picked the two missing commits) → PR #18, reviewed and merged. Both PRs are now merged into `feature/strap-onboarding`; local checkout is clean on that branch.

**Sprint 2026.08.A capacity is now exhausted.** 42h total, 40h allocated (14h Feature A + 26h Feature C), all of it resolved. Only 2h nominally unused — not enough for anything. Ran `/rebalance-sprint` (mid-sprint mode, since today is before the 2026-08-08 end date): nothing to move, everything allocated is already done. Ran `/plan-sprint 00003` again hoping to pull Task 00016 (3h, finalize the logo SVG, the only dependency-unblocked candidate left under Feature 00003) — doesn't fit in 2h. CPO confirmed: leave it for the next sprint.

## Files in flight

None — working tree is clean on `feature/strap-onboarding`, everything from this session is committed and merged (through PR #18).

## Open decisions

- **When Sprint 2026.08.A ends (2026-08-08):** run `/rebalance-sprint` (boundary mode this time — will actually stand up the next sprint) then `/plan-sprint 00003` to pull Task 00016 in. That unblocks Story 00008 → unblocks Story 00009 (needs both 00007 AND 00008 complete) → Story 00010 → Story 00011, per Feature 00003's locked dependency chain.
- **Plausible account provisioning** — CPO said "I'll provision an account later," still open. Blocks the V1 engagement-baseline capture window (`v1-engagement-baseline.md`).
- **`feature/strap-onboarding` → `main` merge** — still not done; `main` still has no STRAP install or any V2 work. CPO's call on timing, no urgency signaled.
- **designer specialist's per-agent budget**: ended Feature 00003's execution run at 266K tokens against its 200K budget (4 dispatches: 48K/62K/78K/78K). Worth `/revise-token-budget --agent designer` before the next Feature 00003 pass, since Stories 00009/00010/00011 will likely dispatch it again.

## Open work items

- `#00001` — resolved — Requirement: V2 (3 goals).
- `#00002` — resolved — Spec: dark motorsport-editorial V2 (9 Parts, 18 ACs, mockups wired).
- `#00003` — active, **PARTIALLY EXECUTED** — Feature A (design foundation + shell). Story 00007 ✅resolved (Tasks 00012-00014). Story 00008 partial: Task 00015 ✅resolved, Task 00016 (3h, logo) still `new`/unallocated. Stories 00009/00010/00011 (37h) `new`, blocked on the 00007+00008 dependency chain, unallocated.
- `#00004` — active, not yet sprint-allocated — Feature B (per-surface redesign). Stories 00026-00029, Tasks 00030-00041. Predecessor 00003.
- `#00005` — active, **PARTIALLY EXECUTED** — Feature C. Stories 00042 ✅resolved + 00043 ✅resolved (7 Tasks, PR #16 merged). Stories 00044/00045 (8 Tasks) still `new`, unallocated overflow — need Feature B's surfaces to exist first (00045) and more sprint capacity.
- `#00006` — active, not yet sprint-allocated — Feature D (What's New page). Stories 00061-00063, Tasks 00064-00073. Predecessors 00003/4/5 (LAST).

## Quick resume

1. `/context-fetch jeffgoji-site-update` to reload this context.
2. When Sprint 2026.08.A's boundary is reached (2026-08-08) or the CPO wants to jump ahead: `/rebalance-sprint` (boundary mode) then `/plan-sprint 00003` to pull Task 00016 in and continue Feature A's dependency chain.
3. Periodically remind the CPO about Plausible account provisioning (blocks `v1-engagement-baseline.md`'s capture window) and the eventual `feature/strap-onboarding` → `main` merge — neither is urgent but both are easy to forget.

## Critical context

- **PUSH BEFORE YOU PR.** Hit this directly in this session: local commits made after a Task's last `git push` (e.g., a resolution commit right before opening the PR) are silently absent from `gh pr create`'s diff if you forget to push first. `gh pr create` uses whatever is on origin, not the local working tree. Always `git push origin <feature-branch>` immediately before `gh pr create`, or verify `git log origin/<branch>..<branch>` is empty. The fix when missed is a small cherry-pick follow-up branch + PR (see PR #18) — do NOT commit the fix directly to the target branch.
- **Estimates are human senior-dev hours for planning/velocity — NOT pipeline wall-clock.** Agents execute each task in minutes.
- **`CreateTeam` is unavailable in this harness/session** despite `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` + `CLAUDE_CODE_SPAWN_BACKEND=auto` both being set correctly. Established workaround: dev-lead creates git worktrees manually (`git worktree add --detach <path> <feature-branch>`) and dispatches specialists via background `Agent` calls (give them a `name` so `SendMessage` keeps working) instead of `CreateTeam` teammates.
- **Windows long-path limit** hit once on the first-ever `git worktree add` in this repo. Fixed via `git config core.longpaths true` — already set, persisted cleanly through Feature A's worktree ops too.
- **`npm install --prefix <path>` (run from outside the target dir) silently injects a self-referential `file:` dependency** plus lockfile churn. Always `cd`/target the directory directly; never use `--prefix`.
- **Worktrees ship with no `node_modules`.** Specialists borrow the main checkout's install via a temporary directory junction (Windows), run tests, then delete the junction — verified safe (main install unaffected) across 4 dispatches this session. Standardize this in agent-ops tradecraft.
- **`esbuild`'s `build.target` downlevels syntax only — it never polyfills built-ins.** Keep the explicit `build.target` pin in `vite.config.js`; don't trust Vite's default (caught a real regression here once already).
- **Plausible's default `script.js` auto-tracks SPA navigation via `pushState` patching.** This project uses `script.manual.js` + a hand-rolled `usePageviews()` hook instead — don't revert the script src without also removing the hook.
- **Background specialist agents sometimes finish and go idle without a `SendMessage`.** Watch for stale idle-notifications (teammate already reported and was cleaned up) vs. genuinely-stuck agents — check whether the worktree/branch was already reviewed before assuming a wedge.
- **STRAP work-item YAML edits (state transitions, audit comments) must be committed AND PUSHED periodically**, not batched until the end — local strap-agile's git commit IS the persistence layer, and un-pushed commits are invisible to PR creation (see the PUSH BEFORE YOU PR gotcha above).
- **Token-budget tracking (`usage.yaml`) was updated incrementally after every specialist report this session** (unlike Feature C's after-the-fact reconstruction) — keep doing this; it caught designer's budget overrun in real time.
- **PR review/merge convention**: Feature branches target `feature/strap-onboarding`, not `main` (stacked mode). Merge strategy: `--merge` (not squash, preserves Task-level audit commits), `--delete-branch` to clean up. Small housekeeping fixes (like PR #18) get their own tiny branch+PR rather than a direct commit to the target branch, even for `.claude/strap/work/*` YAML-only changes.
- **Locked V2 palette** (softer-dark): charcoal `#141418`, reading panel `#202027`, red `#E10600`, warm off-white text; Archivo/Inter/Space Mono (now self-hosted as of Task 00015); "Goji Line" logo. Full detail in `designer.md` memory + `mockups/spec-00002/assets/tokens.css`.
- CPO preference: never commit to `main`; all work via feature/task branches + reviewed PR.

## Source-of-truth pointers

- `.claude/strap/memory/dev-lead/v2-initiative.md` — the durable V2 map; **stale, last updated mid-Feature-C** — refresh next session with Feature A's progress + the PUSH BEFORE YOU PR lesson.
- `.claude/strap/state/usage.yaml` — per-agent/session token budget tracking; designer is over budget (266K/200K) for the execute-00003 workflow instance.
- `.claude/strap/work/feature/00003.yaml` — Feature A's audit trail; shows the partial-execution + dependency-chain-blocked pattern.
- `.claude/strap/project-docs/v1-perf-baseline.md` + `v1-engagement-baseline.md` — the V1 before-state Phase-3 work measures against; cross-linked to each other.
- PR #17 (merged, `feature/00003-design-foundation-shell`) + PR #18 (merged, `fix/00003-finalize-work-item-state`): `https://github.com/JeffGoji/Jeffgoji.com-React-Site/pulls?q=is%3Apr+17+OR+18`. PR #16 (Feature C baseline, merged): reference for the original partial-execution PR pattern.
- `.claude/strap/work/spec/00002.yaml` — the Spec: Constituent Parts, 18 ACs, Mockup Reference + Wiring Guide.
- `.claude/strap/mockups/spec-00002/` — approved visual contract (open `index.html`); `assets/tokens.css` = design-token source of truth.
- `.claude/strap/memory/agents/{designer,devops-lead,frontend-engineer,spec-lead}.md` — per-domain tradecraft, actively curated during Feature A/C's execution.
- `.claude/strap/state/{code,devops}-connection.yaml` — GitHub (JeffGoji/Jeffgoji.com-React-Site) + local strap-agile profiles.
