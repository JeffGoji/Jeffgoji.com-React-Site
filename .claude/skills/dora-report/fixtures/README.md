# dora-report engine fixtures

Snapshots used by phase 7 end-to-end verification of #39709 (v2.5 `/dora-report` SPA refactor) and as regression coverage for future engine changes.

## Fixtures

### `pace-real.json`

Real-adopter snapshot copied verbatim from Pace's v2.4.0 Phase E validation cycle:
`C:\Users\ShaneCorrallo\source\repos\Pace\yp-agent-teams\.claude\strap\state\dora-snapshots\20260531-061500.json`

What it exercises:
- **Polyrepo umbrella** with 3 `feature_clusters[]` (1 merged in window, 2 in flight)
- **No `Layers` section** in source project-profile.md (Pace's umbrella shares the ADO project with multiple sibling pipelines)
- **No `deployment_targets:`** declared in source devops-connection.yaml
- **Pace label-honesty rule** -> `pipelineRunRateMode: "pipeline-run-rate"` + callout warn rendered
- **5 funnel scopes** populated (layer + sub-repo entries)
- **218 work items**, 364 pipeline runs, 5 integration PRs
- **UTF-8 BOM** at the start of the JSON file (PowerShell-collected snapshots on Windows). The builder's BOM-tolerant `readSnapshot` handles this.
- **Snake-case + `parent_id`** field naming (vs camelCase `parent`). The normalizer's `firstDefined(w.parent, w.parent_id, w.parentId)` handles this.

Bugs surfaced by this fixture during phase 7 validation:
1. `readSnapshot` was BOM-intolerant -- `JSON.parse` threw on the leading `﻿`. Fixed by stripping BOM before parse.
2. `normalizeWorkItem` only read `w.parent`, ignoring `w.parent_id` -- broke `isAiExecuted` propagation for higher-order types on adopters using snake_case parent fields. Fixed by aliasing `parent_id` and `parentId`.

Both fixes are portable -- every adopter benefits.

### `raptor-real.json`

Real-adopter snapshot from Raptor, the **original source project STRAP was extracted from**. Copied verbatim from:
`C:\Users\ShaneCorrallo\source\repos\OMNI\OmniCore\Raptor\.claude\contexts\dora-snapshots\20260531-074251.json`

Raptor is the canonical second real-adopter test bed: an active enterprise Azure DevOps install with a 14-day collection window covering the Hippodraco sprint plus a recent `/close-ceremony` cascade. STRAP doctrine is built FROM Raptor patterns, so this fixture validates that the engine handles its own ancestor cleanly.

What it exercises:
- **594 work items, 364 pipeline runs, 46 integration PRs, 8 intermediate PRs** -- the largest fixture in the set (2.7x Pace by work-item volume)
- **14-day window** (`2026-05-17T07:42:51Z` to `2026-05-31T07:42:51Z`) -- typical default `/dora-collect` window
- **Mixed work-item type cardinality**: 315 Tasks, 155 Stories, 22 Features, 67 Bugs, 15 Enhancements, 13 Specs, 3 Requirements -- the most-realistic distribution in the fixture set
- **Heavy AI-share**: throughput partitions read Story 19/20 AI, Task 59/60 AI, Bug 15/16 AI -- Raptor operates at high AI-share, surfaces the AI-vs-Human partitioning code paths well
- **Close-ceremony cascade baked in**: the recent ceremony's Resolved -> Closed transitions inflate the closed-Task count for the window (60 closed Tasks). This is by design as a fixture characteristic; the engine renders the data honestly
- **No `Layers` section + no `deployment_targets:`** declared in the source profile -- Raptor uses a single-pipeline shape, exercises the layer-omitted fallback path
- **All Bugs lack `environment` field** (`bugsByEnv: { unspecified: 67 }`) -- MTTR computes to zero prod Bugs in window and renders "no signal" pills correctly. **This fixture is the canonical example of why `dora-tuning.md` recommends environment-tagging discipline.**
- **`revisions` + `rework_item_ids` populated** -- v2.4+ snapshot format with full state-transition history; quality cycle-times compute granularly

Bugs surfaced: zero. The Pace work already taught the engine the resilience patterns (UTF-8 BOM, snake_case parent_id), so Raptor flowed through cleanly on first attempt. 6/6 verify-then-write gates pass.

Renders 18 `section.block` elements -- below Pace (19) and synthetic (21) because Raptor has neither `excluded_clusters` nor `deployment_targets` blocks.

### Raptor 5-sprint chain (`raptor-sprint-{1..5}-*.json`)

Chronological non-overlapping 5-sprint chain from Raptor's snapshot history, covering the **Giganotosaurus → Graciliraptor → Hadrosaurus → Harpymimus → Hippodraco** cadence (2026-04-20 through 2026-05-22). The canonical multi-sprint comparison view in the fixture set -- exercises every cross-sprint aggregation code path the engine ships.

Per-sprint files in chronological order:

| File | Sprint | Window | Work items | PRs |
|---|---|---|---|---|
| `raptor-sprint-1-giganotosaurus.json` | Giganotosaurus | 2026-04-20 to 2026-04-24 | 77 | 33 |
| `raptor-sprint-2-graciliraptor.json` | Graciliraptor | 2026-04-27 to 2026-05-01 | 270 | 33 |
| `raptor-sprint-3-hadrosaurus.json` | Hadrosaurus | 2026-05-04 to 2026-05-08 | 267 | 25 |
| `raptor-sprint-4-harpymimus.json` | Harpymimus | 2026-05-11 to 2026-05-15 | 157 | 45 |
| `raptor-sprint-5-hippodraco.json` | Hippodraco | 2026-05-18 to 2026-05-22 | 93 | 29 |

Combined output: `raptor-multi-sprint.payload.json` + `raptor-multi-sprint.report.html`.

What it exercises (uniquely vs the single-sprint fixtures):
- **5-sprint `series` arrays** across `tasksClosed`, `prsInt`, `aiP50`, `prCycleP50`, `abandonPct`, etc. -- the cross-sprint trend sparklines + multi-sprint comparison view render in full
- **`movement` aggregation** (last sprint vs prior) -- the auto-verdict generator picks improvements + regressions from this; this fixture has both populated (AI Efficiency P50 climbed; Abandoned PR rate regressed)
- **Per-developer `trendByDev` + `devTotals`** across 5 sprints -- the Per-developer spine appendix (H) renders with full multi-sprint trajectories
- **Direction-aware auto-verdict wording** -- this fixture surfaced and validated a fix to the auto-verdict headline: regressions on inverse-direction metrics (e.g., Abandoned PR rate going up) now read "up N%" instead of the hardcoded "down N%". Without this fixture chain, the bug would have shipped unnoticed
- **66 `section.block` elements rendered** -- the largest section count in the fixture set (per-sprint blocks across 5 sprints plus comparison appendices A through H)

Regenerate the combined output:

```bash
node .claude/skills/dora-report/build-payload.js \
  --sprint .claude/skills/dora-report/fixtures/raptor-sprint-1-giganotosaurus.json \
  --sprint .claude/skills/dora-report/fixtures/raptor-sprint-2-graciliraptor.json \
  --sprint .claude/skills/dora-report/fixtures/raptor-sprint-3-hadrosaurus.json \
  --sprint .claude/skills/dora-report/fixtures/raptor-sprint-4-harpymimus.json \
  --sprint .claude/skills/dora-report/fixtures/raptor-sprint-5-hippodraco.json \
  --out .claude/skills/dora-report/fixtures/raptor-multi-sprint.payload.json

node .claude/skills/dora-report/assemble-report.js \
  --payload .claude/skills/dora-report/fixtures/raptor-multi-sprint.payload.json \
  --out .claude/skills/dora-report/fixtures/raptor-multi-sprint.report.html
```

### `synthetic-full-coverage.json`

Hand-authored synthetic snapshot exercising adopter shapes Pace doesn't.

What it exercises:
- **Explicit `Layers` section**: `web-prod` + `api-prod` -> KPI cards per layer rendered
- **Explicit `deployment_targets`**: `vercel-prod` + `azure-prod` -> per-target deploy-frequency block rendered, label switches from "Pipeline runs" to "Deployment Frequency"
- **`excluded_clusters[]` non-empty**: validation-cycle Feature #600 tagged `strap:validation-cycle` -> excluded-clusters appendix renders with reason and Feature link
- **`metadata.strap_adoption_date: 2026-02-01`** + pre-STRAP backlog: 3 Stories created in Jan 2026 -> `pre_strap_human_backlog_share = 43%` -> auto-verdict context card fires ("Human metrics include 43% pre-STRAP backlog")
- **Multiple DQ flags set**: `cw_oe_degeneracy: true`, `revisions_unavailable: true` -> both surface as callouts in Data Quality section
- **AI Feature + Human Feature** with descendants for `isAiExecuted` propagation across both Tracks
- **Populated `weight` blocks on completed PRs** (per Feature #39720 schema): AI PR carries 24 files / 672 lines / 8 commits / 2 commit_authors; Human PR carries 6 files / 180 lines / 3 commits / 1 commit_author; abandoned PR carries `weight: null`. Exercises the full PR-weight gradient block + per-developer profile-card "heaviest PR" widget + `avgFiles` / `avgLines` columns when the upcoming visual-parity work lands. Pace and Raptor's most-recent snapshots intentionally keep null weights (matching real adopter state today; graceful-degradation path is exercised by those fixtures)

Renders 21 `section.block` elements (vs 19 for Pace -- the extra 2 are the per-target deploy frequency block + the excluded-clusters appendix).

## Files per fixture

Each fixture produces three files in this directory:

- `<name>.json` -- the source snapshot (input)
- `<name>.payload.json` -- the PAYLOAD JSON produced by `build-payload.js`
- `<name>.report.html` -- the final self-contained HTML report produced by `assemble-report.js`

Regenerate any fixture:

```bash
node .claude/skills/dora-report/build-payload.js \
  --sprint .claude/skills/dora-report/fixtures/<name>.json \
  --out .claude/skills/dora-report/fixtures/<name>.payload.json

node .claude/skills/dora-report/assemble-report.js \
  --payload .claude/skills/dora-report/fixtures/<name>.payload.json \
  --out .claude/skills/dora-report/fixtures/<name>.report.html
```

All six `assemble-report.js` verify-then-write gates should pass without `--strict`.

## Coverage summary

| Engine capability | Pace fixture | Raptor fixture | Synthetic fixture |
|---|---|---|---|
| Polyrepo `feature_clusters[]` | ✓ | — | ✓ |
| `excluded_clusters[]` appendix | — | — | ✓ |
| `Layers` iteration (2+ layers) | — | — | ✓ |
| `deployment_targets` block | — | — | ✓ |
| Pace label-honesty (pipeline-run-rate) | ✓ | ✓ | — |
| Deployment Frequency mode | — | — | ✓ |
| `pre_strap_human_backlog_share` >30% | — | — | ✓ |
| `cw_oe_degeneracy` flag | — | — | ✓ |
| `revisions_unavailable` flag | — | — | ✓ |
| BOM-tolerant snapshot parse | ✓ | — | — |
| snake_case `parent_id` alias | ✓ | ✓ | — |
| `isAiExecuted` propagation | ✓ | ✓ | ✓ |
| AI vs Human at-a-glance | ✓ | ✓ | ✓ |
| AI badges on tables | ✓ | ✓ | ✓ |
| Auto-verdicts | ✓ | ✓ | ✓ |
| Partition toggles | ✓ | ✓ | ✓ |
| Heavy AI-share data shape (>90%) | — | ✓ | — |
| All-Bugs-missing-environment no-signal | — | ✓ | — |
| `revisions` + `rework_item_ids` populated | — | ✓ | — |
| Close-ceremony cascade in window | — | ✓ | — |
| Largest work-item set (500+) | — | ✓ | — |

## Known gaps (deferred to follow-on polish)

- `aiVsHumanGlance.deploys` counts use `deployByLayer.byMode.{ai,human}` (which are pipeline-run-based). For adopters with `deployments[]` populated, the more accurate count is the per-target events. The displayed number is still meaningful (AI vs Human deploy-pipeline activity), but the label "Deploys" could read "Pipeline runs" when the deploy-event count diverges. Worth a future tightening.
- `runLineageIsAi` falls back to `false` when a pipeline run has no `sub_repo` attribution. Adopters without F10 `pipeline_match_patterns` declarations will see all such runs classify as Human, under-counting AI deploys. Documented; F10 + #39707 addresses the underlying attribution gap.
- Excluded-clusters appendix renders the cluster's PR sub-repos but doesn't currently include PR ids or per-PR statuses. Could be enriched in a future polish.
