# Getting the most from DORA reports

The DORA report STRAP renders via `/dora-report` is the deepest single instrument the pipeline exposes for evaluating how the team is performing. It draws on every work item, every pull request, every pipeline run, and every commit STRAP's adapters can reach. This document walks adopters through the operational disciplines that make the report sharp instead of noisy -- what feeds each metric, where data quality matters, the cadence to keep, and the configurability the report exposes.

Audience: any CPO running STRAP whose team has crossed the first few sprints and wants the DORA surface to be measuring something true. New adopters should run `/strap-in` first, complete a sprint, then return here.

## The DORA-4 instruments

The report computes the four canonical DORA metrics plus a small set of STRAP-specific instruments that complement them. Each draws on a specific set of fields STRAP records on work items, pull requests, and pipeline runs.

### Deployment Frequency

**What it measures.** Production deployments per unit time. STRAP counts pipeline runs that hit the configured deployment targets (see `deployment_targets:` in `devops-connection.yaml`) in the report window.

**What feeds it.** Pipeline runs whose definition name matches `pipeline_match_patterns` for the sub-repo AND target a deployment target whose `environment: prod` declaration. The report splits by `deployment_targets[].environment` so non-prod runs surface separately for context.

**Where it gets noisy.**
- Pipelines that fire on every PR (not just merges) inflate counts. The fix: pattern-match per pipeline name in `sub_repos.<slug>.pipeline_match_patterns` and exclude PR pipelines OR add a downstream filter on `pipeline_runs.reason: 'merge'`.
- Pipelines that run on every commit to a feature branch get attributed to whichever sub-repo's patterns match. Confirm pattern specificity at `/connect-devops-project` Step 6 substep 3 -- the multi-select probe (v2.5 #39703) is the right surface for this.

### Lead Time for Changes

**What it measures.** Wall-clock from first commit on a feature branch to that branch's merge into the integration target. STRAP measures from `pull_request.creationDate` to `pull_request.closedDate` for status `completed` PRs by default; teams that want commit-to-merge lead time can substitute via a configurable signal (see Configurable thresholds below).

**What feeds it.** Pull requests in the report window with `targetRefName == default_branch` (the integration stream). Intermediate-target PRs (e.g., `feature/X -> integration/Y`) are tracked separately and surfaced in the secondary funnel but are NOT counted toward DORA-4 Lead Time. The integration target is configured per-repo in `code-connection.yaml`'s `default_branch` field.

**Where it gets noisy.**
- Long-lived feature branches inflate lead time. The report exposes a P50 / P90 split + the per-PR distribution so single outliers don't dominate the picture.
- Hotfix-style PRs (zero review time, urgent merges) deflate lead time. The report flags small-iteration-count PRs (the Iteration Count proxy from `pull_request_show`) so they're visible.

### Change Failure Rate (CFR)

**What it measures.** Percentage of production deployments that resulted in a defect Bug filed within the failure window (default: 72 hours).

**What feeds it.** Bug work items filed in the failure window after a prod deployment, with `environment: prod` (the `env:prod` tag derived from the Bug's `environment` field). The 72-hour window is configurable per project; the report exposes the actual window via the methodology section.

**Where it gets noisy.**
- Bugs filed without an `environment` value are uncounted (they can't be attributed). v2.5 #39919 closes this gap by making `/file-bugs` always capture environment via `AskUserQuestion`; pre-v2.5 Bugs without `env:*` tags are surfaced in `/dora-reconcile`'s hygiene pass for backfill.
- Bugs filed against a long-prior deployment (legitimate post-window regression) inflate CFR if the window is set too generously. Tune via `mapping.dora_confidence_thresholds.cfr_window_hours`.

### Mean Time to Restore (MTTR)

**What it measures.** Median time from a `env:prod` Bug being filed to its Resolved (or Closed, when no Resolved state exists in the host's state machine) transition.

**What feeds it.** Bug work items with `environment: prod` AND a Resolved/Closed state transition timestamp within the report window. The report uses the wall-clock between `Microsoft.VSTS.Common.CreatedDate` and `Microsoft.VSTS.Common.ResolvedDate` (or the host-specific equivalents from the connection profile's `mapping.fields`).

**Where it gets noisy.**
- Bugs Resolved after the report window ends (long-tail restorations) are not counted in the current window; they'll surface in a later report. The report exposes the count of in-window-filed-not-yet-resolved Bugs as the in-flight indicator.
- Bugs marked Resolved as "duplicate" or "not a bug" inflate the count of "restored" without an actual fix. The `resolved_reason` field carries the disposition; `/dora-collect` filters `not a bug` / `duplicate` by default. Configure via `mapping.dora_confidence_thresholds.mttr_resolution_reasons`.

### STRAP-specific instruments

Beyond the DORA-4, the report computes:

- **AI Efficiency Ratio.** Sum of `OriginalEstimate` hours across Tasks closed in-window, divided by sum of `CompletedWork` hours. >1.0 means STRAP-assisted execution beat the original estimate; <1.0 means it took longer. Required field: `OriginalEstimate` set at Task creation time (see OriginalEstimate discipline below).
- **PR Iteration Count.** From `pull_request_show`'s RefUpdate event count (when the host exposes thread data); buckets PRs into Small / Medium / Large / XL. Useful as a "review intensity" proxy.
- **Agent vs Human attribution.** Tasks tagged `AI` (set automatically by STRAP at creation) vs untagged. Surfaces the AI-authored share of the sprint's output.
- **Aging Alerts.** Stale work items (Tasks not updated in > N days). v2.5 #39700 splits STRAP-instrumented (via `mapping.strap_instrumentation_signals`) from inherited so adopters can see whether STRAP's process is actually accelerating the stuck items or just inheriting the same backlog patterns.
- **Cycle Time per developer.** Per-developer sprint-over-sprint trend bars + roll-up totals.
- **PR Weight gradient (optional).** When `/dora-collect --with-git-diff-weight` runs, the report renders a Small / Medium / Large / XL distribution by lines-changed. Tradeoff: the weight collection adds ~5-10 minutes per snapshot for a 100-PR window.

## Operational disciplines

The instruments above are only as sharp as the data they consume. Six adopter disciplines keep the data clean.

### Environment-tagging discipline (Bugs)

CFR + MTTR both depend on Bug work items carrying an `environment` value. Pre-v2.5, capture was per-/file-bugs-invocation and adopters frequently forgot. v2.5 #39919 closes the gap: `/file-bugs` now always prompts for environment via `AskUserQuestion`, with the result persisted both as the `environment` field AND as an `env:<value>` tag.

**Recommended environment values:** `prod`, `staging`, `dev`, `local`. Adopters can extend the list per project. The DORA report counts CFR/MTTR only against `env:prod`; other environments surface in the methodology section's "by environment" breakdown.

**Backfill.** For Bugs filed before v2.5, run `/dora-reconcile --auto-fix` -- Pass G stamps state-transition timestamps and Pass H (Bug hygiene) flags Bugs missing `environment` for CPO backfill. The report's data-quality flags surface the count.

### OriginalEstimate discipline (Tasks)

The AI Efficiency Ratio requires `OriginalEstimate` set at Task creation time. STRAP's `/decompose-feature` skill prompts for estimates per Task during decomposition. Adopters who skip estimates leave the ratio incomputable for those Tasks.

**Recommended values.** Half-day increments (0.5, 1, 2, 4 hours per Task) work well at the Story-decomposition level. Larger Tasks suggest re-decomposition. The estimate is committed-effort, not wall-clock; CompletedWork captures wall-clock.

**Hygiene.** `/dora-reconcile` Pass F surfaces in-flight Tasks without OriginalEstimate; backfill or accept the gap (the Task gets excluded from the ratio).

### CompletedWork discipline (Tasks + Bugs)

The wall-clock side of AI Efficiency. STRAP's `/execute-sprint` and `/fix-bugs` skills stamp CompletedWork at Resolved transition automatically; manually-resolved items need the field set. `/dora-reconcile --auto-fix` Pass G stamps CompletedWork from `Resolved - Active` wall-clock when the field is missing AND state-transition timestamps exist.

### Layers + Sub-repos + deployment_targets (polyrepo)

For polyrepo umbrellas, the report can show per-layer metrics when three pieces of configuration align:

1. **`project-profile.md` Sub-repos** with declared `Role` + `Active domains` per sub-repo.
2. **`devops-connection.yaml` deployment_targets:** list with `name` + `cloud` + `environment` + `region`.
3. **`project-profile.md` Sub-repos' `Deployment target:`** field pointing at one of the declared targets.

With all three, the report computes Deployment Frequency per target, Lead Time per layer (when layers are declared in `project-profile.md`'s Layers section), and CFR scoped by `env:prod` against the matching target. Without them, the report falls back to umbrella-wide aggregates.

### `/dora-reconcile` cadence

Run `/dora-reconcile --auto-fix` weekly. The skill walks eight passes (state mismatches, stale items, unlinked PRs, AI-tag inheritance, date hygiene, CompletedWork hygiene, Bug-specific hygiene, parent-child structure) and:

- Auto-fixes derivable fields (state-transition timestamps, AI-tag inheritance, wall-clock CompletedWork).
- Surfaces non-derivable gaps for CPO decision (state mismatches, structural issues).
- Logs a run report at `.claude/strap/state/dora-reconcile-runs/`.

The weekly cadence catches drift early; monthly is fine for small teams. Daily is overkill except when actively investigating a discrepancy.

### `/close-ceremony` per sprint

At sprint boundary, run `/close-ceremony` to walk Resolved work items and decide per item: Close (value accepted), Reject (back to Active), Defer (stay Resolved), or Skip. The Closed transition is the authoritative state for "value delivered"; PR-merge cascades (via `/dora-reconcile`) handle some transitions automatically, but `/close-ceremony` is the deliberate CPO acceptance moment.

**Why it matters for DORA.** Lead Time + CFR both count Closed items per the configured window. Stale Resolved items that never transition to Closed inflate the in-flight count and depress the "closed-this-sprint" view. Running the ceremony at each sprint boundary keeps the closure cadence aligned with the value-delivery cadence.

## Configurability

The DORA report honors three configurable surfaces in `devops-connection.yaml`'s `mapping:` block. None are required; sensible defaults apply when absent.

### `mapping.dora_confidence_thresholds`

Per-metric thresholds the report uses to mark confidence (the colored pill next to each DORA-4 metric). v2.5 #39701 made these configurable per project. Defaults (v2.5):

```yaml
mapping:
  dora_confidence_thresholds:
    deployment_frequency:
      high_min: 7        # deploys per week
      medium_min: 1      # deploys per week
    lead_time:
      high_max: 24       # hours
      medium_max: 168    # hours (1 week)
    cfr:
      low_max: 0.15      # 15%
      medium_max: 0.45   # 45%
      cfr_window_hours: 72
      mttr_resolution_reasons: [fixed, by-design, configuration]
    mttr:
      high_max: 1        # hour
      medium_max: 24     # hours
```

Tune by team norms. A team that ships once a quarter and considers that healthy will set `deployment_frequency.high_min: 0.25` (per week, ~once per month) without the report misclassifying their cadence as "Low".

### `mapping.strap_instrumentation_signals`

The Aging Alerts split between STRAP-instrumented and inherited items (v2.5 #39700). Configurable signals identify which Tasks are STRAP-tracked vs pre-STRAP backlog:

```yaml
mapping:
  strap_instrumentation_signals:
    tags_any:
      - "AI"             # STRAP creates Tasks with this tag by default
      - "strap:*"        # logical-type prefix tags
    fields_any:
      - "Custom.STRAPVersion"   # set when /decompose-feature creates the Task
    title_prefix_any: []         # rarely needed; tags are usually sufficient
```

Without configuration, the default is `tags_any: ["AI"]`. Adopters with custom workflows can extend.

### `mapping.cross_version_field_aliases` (v2.5 #39702)

Honors field renames detected during cross-version checks. When a host renames a field (e.g., `Custom.PullRequestUrl` -> `Custom.PRUrl`), `/connect-devops-project` re-run flow asks the CPO to confirm + records the rename in `mapping.field_renames`. The report reads through the alias when computing metrics that reference renamed fields.

## `--with-git-diff-weight` for the PR weight gradient

By default, `/dora-collect` does NOT compute per-PR git-diff line counts (it's slow and most reports don't need it). Pass `--with-git-diff-weight` to add the PR Weight gradient block (Small / Medium / Large / XL distribution by lines-changed).

**When to use.** Sprint-over-sprint comparisons where review velocity is a hypothesis (e.g., "did the team get faster on large PRs after the refactor wave?"). The block surfaces both per-bucket counts AND per-bucket lead-time medians.

**Cost.** ~5-10 minutes for a 100-PR window on Azure DevOps; longer on hosts that require per-commit file fetching. Cache hits accelerate re-runs of the same window.

**Schema.** v2.5 #39720 introduced the Raptor-shape weight schema for cross-adopter portability. Each PR captures `lines_added`, `lines_removed`, `files_touched`. The renderer reads these into the gradient block.

## What the report cannot tell you

A few questions the DORA report cannot answer alone:

- **Did this sprint produce value for end users?** The report measures pipeline + work-item state. Whether the shipped features moved a business metric is product-side analysis.
- **Is the team happy?** Velocity health and engagement are different signals. Pair the report with retros, 1:1s, eNPS.
- **Should we add headcount?** The report shows what the current team is producing. Capacity decisions require projecting against business priorities.

Use the DORA report as one of several instruments. It is sharp when the disciplines above are kept; it is dull when the data layer is leaky.

## References

- [`../skills/dora-report/SKILL.md`](../../skills/dora-report/SKILL.md) -- the report generator
- [`../skills/dora-collect/SKILL.md`](../../skills/dora-collect/SKILL.md) -- the snapshot collector
- [`../skills/dora-reconcile/SKILL.md`](../../skills/dora-reconcile/SKILL.md) -- the weekly janitor
- [`../skills/close-ceremony/SKILL.md`](../../skills/close-ceremony/SKILL.md) -- the per-sprint acceptance ceremony
- [`../skills/file-bugs/SKILL.md`](../../skills/file-bugs/SKILL.md) -- Bug creation flow (v2.5 #39919 environment capture)
- [`../skills/connect-devops-project/SKILL.md`](../../skills/connect-devops-project/SKILL.md) -- `mapping.*` configuration surfaces
- [`./architecture.md`](./architecture.md) -- broader STRAP context
- [`./walkthrough.md`](./walkthrough.md) -- E2E STRAP walkthrough for a new adopter
