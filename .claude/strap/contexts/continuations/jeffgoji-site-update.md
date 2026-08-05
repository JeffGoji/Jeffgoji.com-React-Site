---
topic: jeffgoji-site-update
last_updated: 2026-08-04T13:50:00Z
last_author: dev-lead
status: active
linked_work_items: ["00004", "00005", "00006"]
---

# jeffgoji.com V2 site update

## What this is

The V2 initiative for jeffgoji.com: a full "new everything" redesign with three goals — (1) a modern dark motorsport-editorial look, (2) image-loading/performance overhaul, (3) a self-documenting "V2 What's New" page. Run through the STRAP pipeline with the agent team. Planning is fully done (Requirement → Spec → mockups → 4 Features → all Stories/Tasks decomposed). **Feature 00003 (Feature A, design foundation + app shell) is now fully RESOLVED and deployed to `main` — the entire V2 shell (palette, fonts, logo, nav, header, footer) is visually live on production.** Three Features remain: B (per-surface redesign), C (image pipeline, partially done), D (What's New page).

## Where we left off

**Feature 00003 closed out across two CPO-directed capacity-override execution rounds**, both bypassing `/plan-sprint`'s normal single-sprint gate at explicit CPO direction (urgency: get the redesign visibly live). Round 1 (Story 00008 completion + Stories 00009/00010, 7 Tasks) landed the palette, fonts, logo, nav, and header — merged via PR #20 → #21 (main). Round 2 (Story 00011, 3 Tasks) landed the Footer, removed the orphaned `/totdtrip` route, and added a shell-composition regression guard — merged via PR #22 → #23 (main, commit `1d4701f`). All 5 Stories (00007-00011), all 14 Tasks (00012-00025) resolved. AC-002 and AC-018 (this Feature's owned ACs) fully satisfied and regression-tested. 396 tests passing; production `vite build` verified clean at every merge step throughout both rounds; the live site was fetched and spot-checked directly (not just build logs) — confirmed `--bs-primary: #E10600`, 54 occurrences of the brand red, in the actual deployed CSS.

**Two real regressions were caught and fixed mid-execution, not deferred**: a `position: sticky` bug where a naive Header wrapper would have silently broken the nav bar's stickiness (fixed via `display: contents`), and a genuine rendering bug in the CPO-approved mockup's logo SVG (a zero-height-bbox gradient silently drops the "G" crossbar in every renderer — fixed in production, not yet backported to the locked mockup file).

**A scheduled cloud routine is still pending**: `rebalance-sprint-00003-boundary-proposal` (routine id `trig_01QwxT3oQpFxFD9CudL52Ey7`) fires once at 2026-08-08T14:00:00Z UTC to produce a read-only `/rebalance-sprint` proposal for Sprint 2026.08.A's boundary. It was scheduled before the capacity-override rounds happened, so its proposal will likely be stale/moot by the time it fires (Feature 00003 is done, so Task 00016 — the reason it was scheduled — is long since resolved). Check its output when it fires anyway; if irrelevant, just note that and move on.

## Files in flight

None — working tree is clean on `feature/strap-onboarding`, in sync with origin. `main` is also fully up to date (`1d4701f`).

## Open decisions

- **Which Feature next?** Per the locked execution order (C baseline → A → B → C-perf/D), Feature A is now done. Next up is **Feature B (00004, per-surface redesign)** — predecessor was Feature A, now satisfied. Feature C's Phase-3 overflow (Stories 00044/00045) and Feature D (What's New page) remain after. No CPO decision yet on which to tackle next.
- **Sprint 2026.08.A capacity is deeply over its 42h nominal total** (two capacity-override rounds added 28h + 12h on top of the original 40h = 80h total booked). This is fine under the established precedent (estimates are a planning fiction, not a real constraint on agent execution speed) but worth knowing before running `/plan-sprint` again — the nominal-capacity math is essentially moot until the sprint boundary resets it.
- **Plausible account provisioning** — still open, CPO deferred. Blocks the V1 engagement-baseline capture window (`v1-engagement-baseline.md`). Code-side is fully wired and waiting (`index.html`, `src/lib/analytics.js`) — verified 2026-08-04, no further engineering action needed.
- **Two non-blocking cleanup candidates flagged during Feature 00003's execution**, not yet actioned: (1) the inline logo SVG's gradient `id="gr"` (or similar) collides between NavMenu and Footer — renders correctly today since both copies are identical, but is invalid HTML; clean fix is a shared `<Logo/>` component with an instance-suffixed id. (2) `topLevelDeclarationsOf`, a SCSS-compile test helper, is now copy-pasted into three test files (`styles.test.js`, `Header/index.test.jsx`, `Footer/index.test.jsx`) — worth hoisting into a shared test util before a fourth copy exists.
- **`v2-initiative.md` (dev-lead memory) is stale again** — last refreshed mid-way through Feature 00003's first execution round, doesn't reflect Story 00011 or the Feature's full resolution. Refresh next session if `/memory-refine dev-lead` or similar comes up.

## Open work items

- `#00001` — resolved — Requirement: V2 (3 goals).
- `#00002` — resolved — Spec: dark motorsport-editorial V2 (9 Parts, 18 ACs, mockups wired).
- `#00003` — **RESOLVED** — Feature A (design foundation + shell). All 5 Stories, 14 Tasks complete. Deployed to `main`.
- `#00004` — active, not yet sprint-allocated — Feature B (per-surface redesign). Stories 00026-00029, Tasks 00030-00041. Predecessor (00003) now satisfied — **next up**.
- `#00005` — active, partially executed — Feature C. Stories 00042 ✅resolved + 00043 ✅resolved (PR #16 merged). Stories 00044/00045 (8 Tasks) still `new`, unallocated overflow — needs Feature B's surfaces to exist first (00045).
- `#00006` — active, not yet sprint-allocated — Feature D (What's New page). Stories 00061-00063, Tasks 00064-00073. Predecessors 00003 (done)/4/5.

## Quick resume

1. `/context-fetch jeffgoji-site-update` to reload this context.
2. Ask the CPO which Feature to tackle next — Feature B (00004) is the locked-order default now that A is done, but confirm rather than assume given how much ad-hoc redirection happened this session.
3. Whichever Feature starts, expect to need the same CPO-directed capacity-override pattern if urgency continues — Sprint 2026.08.A's nominal capacity is exhausted regardless of the boundary-mode `/rebalance-sprint` routine's outcome.

## Critical context

- **CPO-directed capacity override is now an established, repeatable pattern.** When the CPO wants work done now regardless of nominal sprint capacity: allocate directly (set `iteration` on the Stories/Tasks, skip `/plan-sprint`'s gate), log an explicit audit comment on the Feature explaining the override and justification, then run the normal `/execute-sprint` worktree+dispatch+review+merge loop. Used twice successfully in Feature 00003's execution.
- **PUSH BEFORE YOU PR.** Local commits made after a Task's last `git push` are silently absent from `gh pr create`'s diff if you forget to push first. Always `git push origin <branch>` immediately before `gh pr create`, or verify `git log origin/<branch>..<branch>` is empty. Cost one follow-up PR (#17/#18) earlier this session.
- **Always operate git commands from the correct worktree/checkout.** Mid-review, running `git merge`/`git push` from inside a *specialist's* worktree (instead of the main REPO_ROOT checkout) silently no-ops or pushes the wrong ref. Confirm `pwd` + `git branch --show-current` before merge commands if there's any doubt.
- **`CreateTeam` is unavailable in this harness/session.** Workaround: manual `git worktree add --detach <path> <feature-branch>` + background `Agent` calls (named, so `SendMessage`/follow-ups work) instead of `CreateTeam` teammates. Confirmed reliable across ~15 dispatches this session.
- **Specialists sometimes finish and go idle without sending a `SendMessage` finishing report** — check the worktree's local git log/status directly (commits present + clean tree = likely done, just push the branch yourself if needed) rather than waiting indefinitely. Also: reports can arrive several minutes *after* you've already reviewed/merged from the branch contents directly — treat delayed reports as confirmation, not a re-trigger, and correct any estimated `usage.yaml` figures with the real self-reported numbers when they land.
- **A transient network failure (`API ENOTFOUND`) crashed one dispatch (Task 00017) with zero work done.** Recovery: verify nothing landed (no branch, clean worktree), redispatch fresh into the same worktree. No special handling needed beyond confirming the clean slate first.
- **Mid-flight `SendMessage` to a still-running specialist works** and is useful for relaying a gotcha discovered by a sibling dispatch (e.g., warning Task 00023 about `import.meta.globEager` breaking App-level test renders, discovered by parallel Task 00024) — but the message can arrive *after* the specialist has already finished and pushed. Always verify by checking the actual pushed diff, not just the specialist's self-report, when relaying time-sensitive info this way.
- **`import.meta.globEager` (in `Gallery/ND/HillCountry/images.js` and `.../TailOfTheDragon/images.js`) breaks any test that renders `<App/>`** under Vitest's SSR transform — needs `vi.mock(...)` on those modules. Also: `window.scrollTo` isn't implemented in jsdom and `ScrollToTop` calls it on every nav — needs `vi.stubGlobal('scrollTo', vi.fn())`. Both now handled in `src/App.test.jsx`'s shared scaffolding — extend that file for future App-level tests rather than starting a new one.
- **Worktrees ship with no `node_modules`.** Standard recipe (Windows): `New-Item -ItemType Junction` to the main checkout's `node_modules`, run tests, then delete via `(Get-Item .\node_modules).Delete()` — NOT `rm -rf`, which would recurse into and destroy the junction's target. Confirmed safe across ~10 dispatches.
- **Netlify auto-deploys both `main` and PR previews** (two connected sites: `effervescent-chaja-1a8580`, `nimble-tulumba-f93157`). Always wait for PR deploy-preview checks to go green before merging into `main` — poll via `gh pr view --json statusCheckRollup` in a background Bash loop, don't block synchronously.
- **Verify production claims against the real deployed site, not just build logs.** After merging to `main`, fetched `jeffgoji.com` directly and grepped the compiled CSS/JS for the brand color and logo string — caught nothing wrong, but this is the standing verification bar now, not "the build succeeded."
- **PR review/merge convention**: feature branches → `feature/strap-onboarding` (not `main`), stacked mode. Then a second PR `feature/strap-onboarding` → `main` when ready to actually deploy. `--merge` (not squash), no `--delete-branch` for `feature/strap-onboarding` itself (it's the long-lived stacking base).
- **Locked V2 palette**: charcoal `#141418`, reading panel `#202027`, red `#E10600`, warm off-white text; Archivo/Inter/Space Mono (self-hosted); "Goji Line" logo. Full detail in `designer.md` memory + `mockups/spec-00002/assets/tokens.css`.
- CPO preference: never commit to `main` directly; all work via feature/task branches + reviewed PR (respected throughout — every main change went through a PR, even the two-step stacked flow).

## Source-of-truth pointers

- `.claude/strap/memory/dev-lead/v2-initiative.md` — the durable V2 map; **stale as of this checkpoint**, doesn't reflect Story 00011 or Feature 00003's full resolution — refresh next session.
- `.claude/strap/state/usage.yaml` — per-agent/session token budget tracking; frontend-engineer and designer both regularly exceeded their 200K per-agent budgets across Feature 00003's execution (accepted, tracked, not blocking — consider `/revise-token-budget` before Feature B if this pattern continues).
- `.claude/strap/work/feature/00003.yaml` — Feature A's full audit trail; the canonical example of the CPO-capacity-override pattern + two-round partial-then-complete execution.
- PRs #17-#23 (all merged) — the full sequence for Feature 00003's execution, review, and two-stage (`feature/strap-onboarding` → `main`) deploy pattern.
- `.claude/strap/work/spec/00002.yaml` — the Spec: Constituent Parts, 18 ACs, Mockup Reference + Wiring Guide.
- `.claude/strap/mockups/spec-00002/` — approved visual contract; **note**: `assets/logo.svg`'s gradient has a known rendering bug (fixed in production, not backported here yet).
- `src/App.test.jsx` — shell-composition-level test file (route-parity + footer-mount guards); extend rather than duplicate for future App-level tests.
- `.claude/strap/state/{code,devops}-connection.yaml` — GitHub (JeffGoji/Jeffgoji.com-React-Site) + local strap-agile profiles.
