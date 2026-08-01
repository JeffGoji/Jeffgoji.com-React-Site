---
name: /dora-collect
description: Read-only snapshot acquisition for DORA reporting. Queries work items + revisions, pipeline runs (bucketed by project-profile.md's Layers section), pull requests (split by integration target vs intermediate per code-connection.yaml), reverts, and agent memory counts. Writes a structured JSON snapshot at .claude/strap/state/dora-snapshots/ that /dora-report consumes. Idempotent; never mutates work items, PRs, branches, or pipelines.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
argument-hint: [--since <YYYY-MM-DD>] [--sprint <iteration-name>] [--out <path>]
---

# /dora-collect

## Purpose

Acquire every signal needed to compute the DORA report and write it as a structured JSON snapshot. `/dora-report` consumes the snapshot to render the HTML output. The snapshot/render separation lets the report re-render without re-querying the host, keeps the data-fetch logic cleanly testable, and lets multi-sprint trend analysis aggregate across a series of snapshots taken over time.

**Read-only against every data source.** The skill does not modify any work item, pipeline run, branch, or PR. Safe to re-run as often as needed -- idempotent.

The skill ships portable. Every adopter-specific concern resolves at runtime:

- Work-tracking queries render through `operation_templates.<op>` in `.claude/strap/state/devops-connection.yaml`
- PR queries render through `operation_templates.<op>` in `.claude/strap/state/code-connection.yaml`
- Pipeline-bucket classification is driven by the `Layers` section in `.claude/strap/contexts/project-profile.md` -- adopters with multi-product / multi-federation setups declare their pipeline patterns there; adopters with a single pipeline can leave the section empty and the snapshot reports single-layer
- Integration-target vs intermediate-stream PR split is keyed off `code-connection.yaml`'s `default_branch`
- Markdown-to-HTML conversion is NOT applied here (snapshot is JSON, not HTML)
- Snapshot path defaults to `.claude/strap/state/dora-snapshots/` (protected by `/strap-upgrade` because the entire `state/` directory is adopter-owned)

## Owner

**dev-lead.** Read-only mechanical data acquisition; no specialist dispatch needed. The dev-lead reads work items, pipeline runs, PRs, and skill log files, classifies them per the Layers configuration, computes data-quality coverage, and writes the JSON snapshot.

dora-analyst consumes the snapshot via `/dora-report` for interpretive analysis (per-developer signatures, trend deltas, momentum). `/dora-collect` is the upstream signal-acquisition step.

## Inputs

- `$ARGUMENTS` -- optional flags in any order. Examples:
  - `/dora-collect` -- default window (14 days back through now); writes to default path.
  - `/dora-collect --sprint Hadrosaurus` -- collect for a specific sprint by iteration name.
  - `/dora-collect --since 2026-05-01 --out /tmp/snapshot.json` -- explicit window + output path.
- Recognized flags:
  - `--since <YYYY-MM-DD>` -- collection window start. Default: 14 days ago.
  - `--sprint <iteration-name>` -- collect for the named sprint by iteration name. When provided, overrides `--since` and uses the sprint's iteration date range read via `operation_templates.iteration_list`.
  - `--out <path>` -- explicit output path. Default: `.claude/strap/state/dora-snapshots/<YYYYMMDD>-<HHMMSS>.json`.
  - `--with-git-diff-weight` (v2.5-polish #39720) -- opt-in PR-size enrichment that computes `commits`, `files_changed`, `lines_added`, `lines_deleted`, `lines_total`, `commit_authors`, and `work_items_count` per merged integration PR via local git-diff against the integration target. Default off (the iteration-count proxy is sufficient for most operational use). Default on when `mapping.pr_weight_default: "enabled"` is set in `code-connection.yaml`. Cached at `.claude/strap/state/dora-collect-cache/pr-weights.json` keyed by `<host>:<pr_id>:<last_merge_commit>` so re-runs amortize the cost. See Step 5a.
- `.claude/strap/contexts/project-profile.md` -- source of truth for area-path root and the `Layers` section (pipeline-bucket classification, federation patterns, excluded layers).
- `.claude/strap/state/devops-connection.yaml` -- work-tracking connection profile. Required fields: `mapping.work_item_types.{feature,enhancement,bug,story,task,spec,requirement}.host_type`, `mapping.field_formats.description`, `mapping.states.{new,active,resolved,closed}`, `mapping.fields.{severity,environment,original_estimate,completed_work,activated_date,resolved_date,closed_date,assigned_to,pr_url}`, `mapping.area_path_root`, `operation_templates.{work_item_query,work_item_read,iteration_list,work_item_revisions}` (the latter optional; data-quality coverage flags absence).
- `.claude/strap/state/code-connection.yaml` -- source-control connection profile. Required fields: `host`, `default_branch`, `operation_templates.{pull_request_list,pull_request_show}` (the latter optional; data-quality coverage flags absence; size proxy degrades to iteration-count-only when threads aren't reachable).

## Pre-flight

1. **devops-connection.yaml present.** If missing, redirect to `/connect-devops-project`.
2. **code-connection.yaml present.** If missing, redirect to `/connect-code-repo`. PR-stream collection requires it.
3. **Ensure output directory exists.** Create `.claude/strap/state/dora-snapshots/` if absent.
4. **Read the Layers section from project-profile.md.** Parse each `### <layer-name>` block; capture `Status`, `Pipeline pattern`, `Product layer` (optional), `Federation pattern` (optional), `Excluded from DORA` (boolean; default false). When the section is empty: degrade to single-layer mode (all pipelines bucket to "default").

## Workflow

### Step 1: Resolve the collection window

When `--sprint <name>` is supplied:

1. Render `operation_templates.iteration_list` and find the iteration matching `<name>` (host-specific name semantics; case-sensitive).
2. Capture the iteration's `start_date` and `finish_date` per the host's response.
3. Use these as the collection window. The `metadata.sprint_name` field in the snapshot records the name.

When `--since <YYYY-MM-DD>` is supplied (and `--sprint` is not): use `<since>` through `now()` as the window.

Otherwise: default to `now() - 14 days` through `now()`.

Print the resolved window to the operator: `Collection window: <start> to <end>`.

### Step 2: Query work items in window

Render `operation_templates.work_item_query` to fetch every work item whose `changed_date` falls in the window under `mapping.area_path_root`:

- `filters: [{field: changed_date, op: gte, value: <window_start>}, {field: changed_date, op: lte, value: <window_end>}, {field: area_path, op: under, value: <mapping.area_path_root>}]`

For each returned id, render `operation_templates.work_item_read` to capture the full work item. When the host supports a batch read (preferred when present), the dev-lead uses `work_item_read_batch` instead -- significantly faster than per-id reads for windows that return many items. Surface batch-vs-per-id timing in the snapshot's `metadata.batch_used` boolean for downstream observability.

Capture per item:

- Type, state, title.
- All state-transition timestamps (`ActivatedDate`, `ResolvedDate`, `ClosedDate`, `StateChangeDate`) via the field map.
- `AssignedTo`, `CreatedBy`, `CreatedDate`, `AreaPath`, `IterationPath`.
- Parent id (via `mapping.link_types.parent`).
- Tags (`AI`, `strap:<logical-type>`, `strap:<logical-state>`, `defer:*`, `rework`, custom adopter tags).
- For Tasks: `OriginalEstimate`, `CompletedWork`, `RemainingWork`.
- For Bugs: `Severity`, `ResolvedReason`, `env:*` tag.
- For Features/Enhancements: `pr_url` field (when declared) -- captured for PR-linkage reconstruction.

Walk the parent chain for each work item and record lineage depth (Task -> Story -> Feature -> Spec -> Requirement). The depth signal is used by `/dora-report`'s Pipeline Funnel section.

### Step 3: Query work-item revisions (for rework rate + gate dwell)

When `operation_templates.work_item_revisions` is declared in the connection profile: for each closed work item in the window, fetch revisions and parse for:

- All state transitions with timestamps (used by `/dora-report`'s Pipeline Funnel hops).
- Backward transitions (e.g., `Resolved -> Active`) -- the **rework rate** signal.
- Post-Resolved content edits on Specs -- the **Spec revision rate** signal.

When `work_item_revisions` is NOT declared: skip this step and record a data-quality flag (`revisions_unavailable: true`) in the snapshot. The Pipeline Funnel section in `/dora-report` then degrades to state-change-date-only timing (less granular but still informative).

### Step 4: Query pipeline runs in window

Render the host's pipeline-runs query for runs finishing in the window. The exact mechanism depends on the host -- typically a date-range filter on the host's CI/CD list endpoint. Capture per run:

- id, definition name, status (`succeeded` / `failed` / `canceled`), `startTime`, `finishTime`, duration.
- Triggering commit SHA (when the host surfaces it).

Classify each run by name against the Layers section (`Pipeline pattern` glob/regex):

1. Walk the Layers entries in order.
2. For each layer, match the pipeline name against the layer's `Pipeline pattern`.
3. First match wins. Record the layer name + `Product layer` (if declared) on the run.
4. Skip runs flagged `Excluded from DORA: true` from any aggregate DORA-4 computation (but keep them in the snapshot for completeness).
5. Runs that match no Layers pattern get bucketed as `unclassified` -- the data-quality section warns when this count is material.

When the Layers section is empty: every run buckets to `default`. The Layer Metrics section in `/dora-report` then shows a single layer.

#### Per-sub-repo + per-deployment-target attribution (v2.4 polyrepo)

When polyrepo umbrella (Sub-repos section present in `project-profile.md`), additionally attribute each pipeline_run to a sub-repo + deployment_target. The attribution feeds the unified pipeline-funnel aggregation in Step 4b below. Best-effort attribution; unattributed runs surface as a data-quality count.

##### Empty-patterns short-circuit (v2.5-polish #39708)

Before querying the host's pipeline-runs endpoint for this step, evaluate the empty-patterns short-circuit guard. The guard skips both the host round-trip AND the per-run attribution pass when re-collection is provably a no-op for attribution, saving the API cost on every run for adopters in the umbrella-shares-ADO-project posture (Pace v2.4.0 Phase E finding -- recommendation #5).

**Guard conditions (all must hold):**

1. The umbrella is polyrepo (Sub-repos section non-empty in `project-profile.md`).
2. Every sub-repo entry in `devops-connection.yaml`'s `sub_repos:` map has `pipeline_match_patterns` either present-and-empty (`[]`) OR absent. The two are treated equivalently here -- both signal "no explicit attribution patterns to apply".
3. A prior snapshot exists at `.claude/strap/state/dora-snapshots/` whose collection window overlaps the current window's start by at least 50% (i.e., the prior snapshot still covers most of the window we're about to re-collect). Read the most-recent snapshot's `metadata.window` to evaluate.
4. The prior snapshot's `funnels[]` entry for the synthetic `__unattributed__` per-sub-repo aggregation has a count equal to total `pipeline_runs[]` in that snapshot. This is the deterministic "every run was unattributed" signal -- the inevitable outcome when all patterns are empty + name-substring fallback also yielded zero matches.

**When the guard fires:**

1. Skip the pipeline-runs host query entirely. The new snapshot reuses the prior snapshot's `pipeline_runs[]` array verbatim AND its `funnels[]` aggregation for the per-sub-repo + per-deployment-target scopes. Per-layer aggregation IS still re-derived (cheap; computed from the inherited `pipeline_runs[]` plus the current Layers section in case the section changed).
2. Stamp `metadata.attribution_short_circuit: true` and `metadata.attribution_short_circuit_source: <prior-snapshot-path>` on the new snapshot for transparency.
3. Print a one-line operator note:
   ```
   No patterns captured across all sub-repos; attribution unchanged from prior snapshot.
   Reusing pipeline_runs[] + per-sub-repo funnels from <prior-snapshot-path>.
   (To re-prompt for patterns, run /connect-devops-project; see #39706.)
   ```
4. Continue with the remaining /dora-collect steps (PR queries, deploy events, etc.). The short-circuit ONLY skips the pipeline-runs collection and per-sub-repo attribution -- it does NOT skip the rest of the snapshot.

**When the guard does NOT fire:** proceed with the normal pipeline-runs query and per-run attribution below. This is the default path for fresh installs, adopters with at least one non-empty `pipeline_match_patterns`, and the first /dora-collect on any newly-configured umbrella.

Adopters whose posture changes (the umbrella adds a sub-repo whose pipelines DO live in the host project, and the F10 capture lands non-empty patterns for it) automatically exit the short-circuit on the next run because condition (2) fails.

For each pipeline_run, attempt sub-repo attribution in this order (first match wins):

1. **Explicit pipeline-pattern match (v2.4 F10, PRIMARY)**: read `devops-connection.yaml`'s `sub_repos.<slug>.pipeline_match_patterns: [...]` array per sub-repo. Each entry is a glob-or-regex pattern (`/.../` denotes regex; otherwise glob). Match each pipeline-run name against each declared pattern in declaration order. First sub-repo whose pattern matches wins. Adopters whose CI pipeline names pre-date STRAP onboarding (no slug substring match available) declare patterns once at `/connect-devops-project` Step 5b and pipelines attribute cleanly thereafter.
2. **Path-based (when host surfaces triggering paths)**: some hosts attach the changed-file paths or source path scope to the run record. When available, match each Sub-repos `Path` against the run's path scope (longest match wins). Attribute the run to that sub-repo.
3. **Name-substring (best-effort fallback)**: match each Sub-repos `Slug` against the pipeline-run name case-insensitively. Substring match (e.g., a run named `web-frontend-prod-build` matches sub-repo slug `web-frontend`). When multiple sub-repos match, prefer the longest-substring slug.
4. **Unattributed**: when none of the above signals resolves, leave `sub_repo: null` on the run. The data-quality section captures `pipeline_runs_with_subrepo` coverage; low coverage prompts the CPO to declare `pipeline_match_patterns` per sub-repo via `/connect-devops-project` re-run.

After sub-repo attribution, derive `deployment_target`: read the attributed sub-repo's `Deployment target` field from `project-profile.md`'s Sub-repos block. When the sub-repo declares it AND the value resolves to an entry in `devops-connection.yaml`'s `deployment_targets:` list, store the target name on the run. Un-attributed sub-repos OR sub-repos without `Deployment target` leave `deployment_target: null` on the run.

Single-repo umbrellas (no Sub-repos section) skip this attribution entirely; pipeline_runs carry layer attribution only.

### Step 4b: Pipeline-funnel aggregation (unified scope discriminator)

After Step 4's per-run attribution completes, aggregate runs into the unified `funnels[]` view. Three scopes share a common shape; the `scope` field is the discriminator that `/dora-report` reads to render each subsection.

#### Funnel stages

Each funnel entry carries the same stage counts derived from pipeline_run status:

- `total_runs` -- count of all runs in the snapshot window matching this scope+identifier.
- `succeeded` -- count of runs with status `succeeded`.
- `failed` -- count of runs with status `failed`.
- `canceled` -- count of runs with status `canceled`.

The stages are a coarse progression rather than a stage-by-stage drilldown -- pipeline runs carry status as a single terminal state, not per-stage instrumentation. Funnel charts in `/dora-report` render the progression `total_runs -> succeeded` (success rate) as the dominant signal, with failed + canceled as the breakdown.

#### Aggregation logic

Three aggregations land in `funnels[]`:

1. **Per-layer aggregation** (existing v2.3 view, preserved unchanged): one entry per declared layer in `project-profile.md` Layers section. Identifier = layer name. Counts aggregated from runs whose `layer` attribution matches.
2. **Per-sub-repo aggregation** (new v2.4 view): one entry per declared sub-repo in `project-profile.md` Sub-repos section. Identifier = sub-repo slug. Counts aggregated from runs whose `sub_repo` attribution matches. Sub-repos with zero runs in the window still appear with all counts = 0 (preserves stable shape for the report renderer). Un-attributed runs aggregate to a synthetic `__unattributed__` entry surfaced for transparency.
3. **Per-deployment-target aggregation** (new v2.4 view): one entry per declared target in `devops-connection.yaml` `deployment_targets:` list. Identifier = target name. Counts aggregated from runs whose `deployment_target` attribution matches. Targets with zero runs still appear with all counts = 0. The implicit "un-attributed" group (runs whose sub-repo had no Deployment target) does NOT get a synthetic entry here -- the sub-repo aggregation already surfaces them.

Single-repo umbrellas (no Sub-repos section) emit ONLY per-layer entries in `funnels[]` -- no per-sub-repo, no per-target. Backwards-compat: v2.3 snapshots without polyrepo data look identical to v2.4 single-repo snapshots.

When no `deployment_targets:` declared (polyrepo or single-repo): per-target entries are omitted from `funnels[]`. Per-sub-repo entries still emit when Sub-repos section is populated.

#### Snapshot field structure

`funnels[]` lives at the top level of the snapshot (sibling of `pipeline_runs[]`, etc.):

```json
{
  "funnels": [
    {
      "scope": "layer",
      "identifier": "ci",
      "total_runs": 120,
      "succeeded": 115,
      "failed": 4,
      "canceled": 1
    },
    {
      "scope": "sub-repo",
      "identifier": "web-frontend",
      "total_runs": 45,
      "succeeded": 43,
      "failed": 2,
      "canceled": 0
    },
    {
      "scope": "sub-repo",
      "identifier": "__unattributed__",
      "total_runs": 8,
      "succeeded": 6,
      "failed": 2,
      "canceled": 0
    },
    {
      "scope": "deployment-target",
      "identifier": "vercel-prod",
      "total_runs": 65,
      "succeeded": 63,
      "failed": 2,
      "canceled": 0
    }
  ]
}
```

The unified shape lets `/dora-report` (F9 S5) render three subsections (per-layer, per-sub-repo, per-deployment-target) under the layer-metrics section with the same chart type per row -- one rendering path serves all three scopes.

### Step 5: Query PRs in window

Render `operation_templates.pull_request_list` from `code-connection.yaml` to fetch PRs with `createdDate` or `closedDate` in the window.

**Split into two streams**:

1. **Integration stream**: PRs with `targetRefName` matching `code-connection.yaml`'s `default_branch`. These are the cumulative velocity signal. All primary DORA metrics in `/dora-report` compute from this set.
2. **Intermediate stream**: PRs targeting any other branch (feature branches, task branches). These represent intermediate merges; reported separately in `/dora-report` only when their count is material (`>20%` of total in-window PRs).

For each PR (both streams), capture:

- id, title, status (`active` / `completed` / `abandoned`), `creationDate`, `closedDate`.
- `sourceRefName`, `targetRefName`.
- `createdBy`.
- Linked work item ids via `operation_templates.pull_request_linked_work_items` when declared (or via parsing the PR description for `Closes #<id>` / `Related: AB#<id>` tokens when the operation isn't declared).

When `operation_templates.pull_request_show` is declared (and the host exposes per-PR thread data), also fetch PR threads to capture:

- **Iteration count**: number of push events to the PR's source branch after creation (proxy for PR size; no diff API calls needed). Read from thread type indicators per the host's convention.
- **Vote count**: reviewer engagement signal.
- **Discussion comment count**: non-system thread comments.

When per-PR thread fetching is unsupported by the source-control profile: skip the per-PR thread fetch entirely. Record `pr_threads_unavailable: true` in data quality. The size-proxy degrades to "intermediate-stream count only" in the report.

**Default PR-size proxy is iteration-count only.** Files-per-PR + lines-changed are expensive to compute (require fetching merge commits + running `git diff` against the local clone, which can take 60+ seconds for repos with deep history) and the iteration-count proxy is sufficient for most operational use. Adopters who want the richer signal opt in via the `--with-git-diff-weight` flag (v2.5-polish #39720; see below).

#### Step 5a: Opt-in git-diff weight capture (v2.5-polish #39720)

When `--with-git-diff-weight` is passed on the CLI, augment each merged-status integration PR with a `weight` block computed from the local git clone. Default-off because of the wall-clock cost; default-on for adopters who configure `mapping.pr_weight_default: "enabled"` in `code-connection.yaml` (escape hatch for adopters who always want the rich signal).

**Per merged PR in the integration stream:**

1. **Resolve the merge commit.** Read `last_merge_commit.commitId` from the host's PR detail (Azure DevOps surfaces it via `pull_request_show`; GitHub via `pulls/{n}` `merge_commit_sha`; Bitbucket via `pullrequests/{id}` `merge_commit.hash`). When the host doesn't surface it OR the surfaced SHA isn't present in the local clone (squash merges that rewrote history, force-pushed branches, very recent merges not yet fetched), classify as **uncomputable** and set `weight: null` for this PR -- continue with the next PR.

2. **Resolve the merge-base.** The PR's effective diff base is the merge-commit's first-parent grandparent in the integration stream (i.e., the integration-branch state immediately before the merge). Compute via:
   ```
   git merge-base <last_merge_commit>^1 <last_merge_commit>^2
   ```
   When the merge-base cannot resolve (rebase-merge with rewritten history, missing local refs), fall back to the merge-commit's first parent (`<last_merge_commit>^1`) as a conservative approximation. Record `weight.merge_base_method: 'fallback-first-parent'` on the weight block when the fallback fires; `'merge-base'` when the primary path succeeds.

3. **Compute the diff stats.** Run:
   ```
   git diff --numstat <merge_base>..<last_merge_commit>
   ```
   Parse each line as `<added> <deleted> <path>`; sum `added`, sum `deleted`, count distinct paths. Run `git log --format=%H <merge_base>..<last_merge_commit>` to count commits and `git log --format=%an <merge_base>..<last_merge_commit> | sort -u` to extract distinct authors.

4. **Assemble the weight block:**
   ```json
   "weight": {
     "commits":         12,
     "commit_authors":  ["scorrallo", "Claude Opus 4.7"],
     "files_changed":   18,
     "lines_added":     642,
     "lines_deleted":   89,
     "lines_total":     731,
     "work_items":      [39720, 39709],
     "work_items_count": 2,
     "merge_base":      "<short-sha>",
     "merge_base_method": "merge-base",
     "last_merge_commit": "<short-sha>",
     "computed_at":     "2026-06-01T11:30:00Z",
     "computation_method": "git-diff-numstat"
   }
   ```
   `work_items` mirrors the PR's `work_item_refs` for self-contained downstream consumption (the per-developer profile-card "heaviest PR" widget reads from `weight.work_items` rather than re-joining against `prs_integration[].work_item_refs`). `work_items_count` is its cardinality.

5. **Cache aggressively.** PR weight is immutable once merged. Persist resolved weights to `.claude/strap/state/dora-collect-cache/pr-weights.json`:
   ```json
   {
     "schema_version": "1",
     "entries": {
       "<host>:<pr_id>:<last_merge_commit>": { /* weight block */ }
     }
   }
   ```
   The cache key is `<host>:<pr_id>:<last_merge_commit>` -- the commit-SHA component invalidates the cache when a merge is force-pushed or amended (rare). On every PR, check the cache first; only fall through to `git diff` when the cache misses. Cache misses log a one-line note (`weight computed for PR #<id> in <ms>ms`) so operators can see throughput.

**Aggregate data-quality flag.** When `--with-git-diff-weight` is set, count the PRs that resolved cleanly vs the uncomputable set:
- Set `data_quality.pr_weight_capture: { computed: N, uncomputable: M, cached: K, total: N+M, pct: N/(N+M) }`
- When `pct < 0.80`, surface a Data Quality warning ("PR weight coverage is below 80%; consider running `git fetch --all` before re-running OR audit the uncomputable list").
- The `prs_integration[].weight = null` case (no opt-in) does NOT surface this DQ flag -- absence of the flag means absence of opt-in, not data degradation.

**When `--with-git-diff-weight` is NOT set.** Each PR's `weight` field is set to `null` explicitly. The /dora-report engine handles null weights gracefully -- the PR-weight gradient block renders a "git-diff weight not captured" callout pointing operators at this flag.

**Local-clone preconditions.** The git-diff path assumes the local clone has the integration target branch fetched and up-to-date. Surface a one-line preflight check before the capture loop:
```
[git-diff-weight] Preflight: ensuring origin/<default-branch> is fetched...
```
Run `git fetch origin <default-branch>` (read-only operation -- no merging into local branches). When the fetch fails (offline, auth lapsed), surface the error + a fallback prompt: "Continue without git-diff-weight? (the run completes with weight: null for all PRs) / Cancel and retry after fixing the fetch."

**Polyrepo umbrella variation.** When the umbrella is polyrepo, each sub-repo carries its own clone path. The weight capture runs per sub-repo against its respective clone. PRs whose `sub_repo` attribution is unset (per Step 4's per-sub-repo attribution) classify as uncomputable -- we don't know which clone to run `git diff` against.

### Step 5b: PR-cluster discovery + Feature aggregation + cycle-time math (v2.4 polyrepo)

When the umbrella is polyrepo (Sub-repos section present in `project-profile.md`) OR cluster markers are detected in any PR body, run cluster discovery. Single-repo umbrellas with no detected markers skip this step entirely (each PR is its own implicit "single-PR Feature" via Step 5 work-item linking; v2.3 cycle-time math unchanged).

#### Cluster discovery (mirrors /refine-pr Story 5.4's three-signal logic)

For each PR captured in Step 5, scan the body for the cluster marker added by `/execute-sprint` Phase 6:

```
<!-- strap-pr-cluster: feature-id=<id> sub-repo=<slug> [merge-order=<N>-of-<total>] -->
```

Parse fields with this regex (optionally capturing the F6 merge-order field):

```
<!--\s*strap-pr-cluster:\s*feature-id=(\d+)\s+sub-repo=(\S+)(?:\s+merge-order=(\S+))?\s*-->
```

When present, the PR is a cluster member:

- Capture `feature_id` (the parent Feature work-item id) and `sub_repo` (the sub-repo slug, FK to project-profile.md Sub-repos).
- Capture `merge_order` when present (F6 emits `<N>-of-<total>` for ordered clusters; `parallel-of-<total>` for independent clusters).

When absent, fall through to the secondary signal:

- **Cluster-summary comment**: a top-level PR comment authored by `/execute-sprint` Phase 6 step 3 containing the cluster manifest in human-readable form. Less reliable than the body marker (CPO comments can dilute the comment stream), but present when the body marker was lost (rare; squash-and-merge can strip body content in some hosts).

When neither signal is present, fall through to the tertiary signal:

- **Pre-F5 PRs / single-PR Features**: treat the PR as its own cluster with `cluster_pr_count=1`, `feature_id` from Step 5's linked-work-item resolution, `sub_repo` left absent. Preserves v2.3 single-PR-per-Feature behavior for any PR created before F5 shipped OR for adopters who never enabled the cluster pattern.

#### Cross-host cluster walk

When `code-connection.yaml` declares heterogeneous-host sub-repos via the `sub_repos:` map (v2.4 first-class via F3), cluster discovery walks each declared host's adapter to enumerate sibling PRs. For each cluster member found in the primary-host PR pool:

- Read its `feature_id` from the marker.
- Query EACH other declared host's `operation_templates.pull_request_list` for PRs whose body matches `strap-pr-cluster: feature-id=<id>` in the same snapshot window.
- Aggregate matched sibling PRs into the cluster regardless of host.

Each sibling PR record carries its host attribution (`host: github`, `host: azure-repos`, etc.) so downstream report rendering can disambiguate.

When the umbrella declares only one code host (the typical v2.4 case), cross-host walk degenerates to a single adapter query -- the same logic, just one pool.

#### PR-to-Feature aggregation

Build a `feature_clusters[]` aggregate list keyed by `feature_id`. For each cluster:

```json
{
  "feature_id": 39230,
  "cluster_pr_ids": [
    {"id": 1234, "host": "github", "sub_repo": "web-frontend", "merge_order": "1-of-3"},
    {"id": 5678, "host": "azure-repos", "sub_repo": "api-backend", "merge_order": "2-of-3"},
    {"id": 9012, "host": "azure-repos", "sub_repo": "shared-lib", "merge_order": "3-of-3"}
  ],
  "cluster_pr_count": 3,
  "cluster_open_at": "2026-05-25T10:00:00Z",
  "cluster_merge_at": "2026-05-26T15:30:00Z",
  "cluster_cycle_time_seconds": 106200
}
```

Field semantics:

- **`feature_id`** -- the parent Feature work-item id from the cluster marker.
- **`cluster_pr_ids[]`** -- per-PR entries with id, host attribution, sub_repo slug, merge_order (F6; null when absent).
- **`cluster_pr_count`** -- N. For N=1, the per-Feature object still exists -- single-PR Features degenerate cleanly into one-entry clusters.
- **`cluster_open_at`** -- `min(creationDate)` across all cluster PRs.
- **`cluster_merge_at`** -- `max(closedDate)` across all merged cluster PRs. Null when ANY cluster PR is not yet merged (status != `completed`) -- the cluster is in-flight.
- **`cluster_cycle_time_seconds`** -- `(cluster_merge_at - cluster_open_at)` as seconds. Null when `cluster_merge_at` is null (in-flight). No synthetic projection from snapshot moment -- the in-flight invariant is "we don't know yet" not "estimate it now".

#### Validation-cycle exclusion (v2.4-polish)

Some clusters represent STRAP self-validation cycles -- intentionally non-shipping work that exercises the polyrepo pipeline end-to-end (Path B: PRs opened, validated, then abandoned without merging). Including these clusters in DORA-4 aggregates permanently skews metrics (zero deploys credited, 0/N change-failure-rate, lead-time stuck in abandoned state). The exclusion convention preserves the data without polluting the math.

**Tag convention**: `strap:validation-cycle` applied to either (a) the Feature work item OR (b) any cluster PR. Either signal moves the entire cluster into the excluded set.

**Snapshot shape**:

- `feature_clusters[]` -- production clusters. Drive DORA-4 aggregate math. Same shape as before.
- `excluded_clusters[]` -- new top-level array (sibling of `feature_clusters[]`). Same per-cluster shape, plus an `exclusion_reason` field carrying the tag signal source (e.g., `"strap:validation-cycle (Feature tag)"`, `"strap:validation-cycle (PR #2843 tag)"`).

**Step 5b classification**: for each cluster discovered, before adding to `feature_clusters[]`:

1. Read the Feature work item's tags. If `strap:validation-cycle` present, capture as the exclusion source.
2. Otherwise, walk the cluster's PR descriptions / labels (host-dependent) for the same tag. First match captures the exclusion source.
3. On match: append the cluster object to `excluded_clusters[]` with `exclusion_reason` set; do NOT add to `feature_clusters[]`.
4. On no match: append to `feature_clusters[]` per the standard flow.

The exclusion is binary -- a cluster is either in or out. No partial credit for partial validation cycles (the tag means "treat the whole thing as not real shipment").

**Downstream impact**:

- DORA-4 aggregates (deploy freq, CFR, lead-time, MTTR) computed from `feature_clusters[]` only.
- Per-Feature cluster cycle-time aggregates from `feature_clusters[]` only.
- `/dora-report` renders `excluded_clusters[]` as an appendix section (transparency: adopters can verify what was excluded and why).
- `/dora-reconcile` Pass A cascade applies to BOTH `feature_clusters[]` and `excluded_clusters[]` -- the exclusion is for aggregate math, not for lifecycle state.

When no cluster carries the tag, `excluded_clusters[]` is `[]` (empty array preserves stable shape). When all clusters in window are excluded (validation-only sprint), `feature_clusters[]` is `[]` and DORA-4 aggregates fall back to v2.3 per-layer signals OR report explicit no-signal pills per the renderer's no-signal rule (see [`dora-report/SKILL.md`](../dora-report/SKILL.md)).

**Adopter operational note**: tag the Feature at creation time when the work is intentional STRAP self-validation. Retroactive tagging works too -- a tag applied after `/dora-collect` ran will move the cluster on the next snapshot.

#### Cycle-time formula edge cases

- **N=1 single-PR Feature**: formula degenerates to `closedDate - creationDate`, exactly matching the v2.3 single-repo per-PR cycle-time. /dora-report renders this in the same cycle-time series as multi-PR Feature cluster cycle-times (the value is comparable; the unit of attribution is "one Feature" in both cases).
- **N>1, all merged**: full formula applies.
- **N>1, any PR unmerged**: cluster_merge_at + cluster_cycle_time_seconds both null. Snapshot entry preserved with the in-flight status; downstream report sees the null and renders the row as "in-flight" without polluting the cycle-time chart.
- **N>1, any PR abandoned + others merged**: cluster is BROKEN. Capture `cluster_state: broken` on the feature_cluster entry and set cluster_merge_at + cluster_cycle_time_seconds to null. /dora-reconcile (F9 S4) surfaces broken clusters for CPO arbitration; /dora-collect just records the state.
- **Revert PRs**: a revert PR carries its own cluster marker when /execute-sprint authored it (separate cluster, separate Feature) OR no marker when manually filed (treated as its own N=1 single-PR cluster via tertiary-signal fallback). The original Feature's cluster_cycle_time is NOT updated by the revert -- reverts don't retroactively change cycle-time of the reverted Feature.

#### PR-size distribution stays per-PR (not aggregated)

PR-size buckets (small / medium / large derived from iteration_count / vote_count / discussion_count) remain per-PR. Do NOT aggregate per-Feature. Rationale: a small PR in repo-A and a large PR in repo-B are different reviewer experiences even within one Feature; reviewer-effort framing requires per-PR granularity. /dora-report renders the per-PR distribution alongside the per-Feature cycle-time distribution as complementary views.

### Step 5c: Deployment-target attribution + deploy-event emission (v2.4 polyrepo)

When the umbrella declares `deployment_targets:` in `devops-connection.yaml` (per F7 S1 schema), resolve per-cluster deployment events. Skip Step 5c when `deployment_targets:` is absent OR empty -- falls through to v2.3 single-target deploy-freq aggregation (each cluster fully-merged = 1 deploy, no target attribution).

#### Per-PR target resolution

For each PR in every `feature_clusters[]` entry from Step 5b:

1. Read the PR's `sub_repo` (from the cluster marker via Step 5b).
2. Look up the sub-repo's `Deployment target` field in `project-profile.md`'s `Sub-repos` section H3 entry.
3. Three states per PR:
   - **Target resolved**: sub-repo declares `Deployment target: <name>` and `<name>` resolves to an entry in `deployment_targets:`. Store the target name on the PR record. Validate the reference; if unresolved, emit a data-quality warning and treat as un-attributed.
   - **Sub-repo un-attributed**: sub-repo H3 has no `Deployment target` bullet (absent-is-valid per F7 S1). Store `target: null` on the PR record. The PR's cluster still aggregates normally; this PR contributes to per-sub-repo funnels but not to per-target deploy events.
   - **No cluster marker / tertiary fallback**: pre-F5 single-PR clusters have no `sub_repo` either. Treat as un-attributed for deploy events (same handling as sub-repo un-attributed).

#### Deploy-event aggregation (cluster-fully-merged semantics)

A deploy event emits ONLY when a cluster fully merges (all PRs in `cluster_pr_ids` have status `completed`). Partial-merge clusters (any PR active / abandoned / unknown) emit NO deploy events for the cluster yet -- preserves the atomicity semantic from F5's coordination model.

For each fully-merged cluster:

1. Group cluster PRs by their resolved `target`. PRs with `target: null` (un-attributed) form their own implicit "un-attributed" group.
2. For each distinct target represented in the cluster (excluding the un-attributed group): emit ONE deploy event with:
   - `target` -- the target name
   - `timestamp` -- `max(closedDate)` across the cluster PRs targeting this deployment_target (the moment that target's slice of the cluster fully merged)
   - `feature_id` -- the parent Feature work-item id
   - `pr_ids` -- subset of cluster_pr_ids whose target == this target
3. **Un-attributed PRs in the cluster**: capture `un_attributed_pr_count` on the feature_cluster entry (from Step 5b) so the count surfaces in the snapshot for transparency. No event emitted for the un-attributed slice.

Examples:

- **Single-target cluster** (all PRs share one target): one deploy event when cluster fully merges.
- **Multi-target cluster** (PRs span N distinct targets): N deploy events emitted simultaneously when cluster fully merges.
- **Mixed-attribution cluster** (some PRs target, some don't): events emitted only for the attributed slice; un_attributed_pr_count carries the rest.
- **All-un-attributed cluster**: zero events emitted; un_attributed_pr_count = cluster_pr_count.

#### Revert PR handling

Each revert PR is its own deploy event when ITS cluster fully merges (the revert PR's cluster, NOT the reverted Feature's). When the revert is single-PR (manual filing), it forms a one-entry cluster and emits one event for its target on merge. When the revert is multi-PR (auto-generated by /execute-sprint), the cluster aggregates per the standard rules.

Revert events DO inflate deploy-freq for their target -- intentional, since deploy-freq measures all deployment activity including remediation. /dora-report can optionally filter reverts when rendering "successful deploys" vs "total deploys" views, but the raw deploy-event count includes them.

#### Snapshot field structure

Step 9 carries deploy events under a new `deployments[]` top-level field:

```json
{
  "deployments": [
    {
      "target": "vercel-prod",
      "events": [
        {
          "timestamp": "2026-05-26T15:30:00Z",
          "feature_id": 39230,
          "pr_ids": [1234]
        },
        {
          "timestamp": "2026-05-27T09:15:00Z",
          "feature_id": 39231,
          "pr_ids": [4567]
        }
      ]
    },
    {
      "target": "azure-prod-eus",
      "events": [
        {
          "timestamp": "2026-05-26T15:30:00Z",
          "feature_id": 39230,
          "pr_ids": [5678, 9012]
        }
      ]
    }
  ]
}
```

Targets with zero events in the window still appear in `deployments[]` with an empty `events[]` array (preserves consistent shape for `/dora-report` rendering). Targets declared but never referenced by any sub-repo also appear with empty events.

The per-Feature `un_attributed_pr_count` lives on each `feature_clusters[]` entry (added by this step alongside the target resolution).

### Step 6: Detect PR reverts

For PRs merged in the window, scan subsequent git history for revert commits:

```bash
git log --grep="^Revert " --since=<merge-date> --until=<window-end> --oneline
```

Map revert commits back to the original PR they reverted (parse `Revert` subject + referenced commit SHA from the commit body). Capture revert relationships in the snapshot. The Change Failure Rate computation in `/dora-report` uses these.

When `git log` is unavailable (e.g., the connection profile is host-only with no local git working tree): skip Step 6 with `reverts_unavailable: true` in data quality.

### Step 7: Load skill log files

Read auxiliary log files written by adopter-side STRAP runs. STRAP's v2.2 convention is that lifecycle metadata + audit comments are the primary DORA evidence (no separate log files for individual workflows like `/quick`). Three secondary sources do exist:

- `.claude/strap/state/dora-reconcile-runs/*.md` -- run logs from `/dora-reconcile` (count of cascade applications, hygiene-gap surfaces per pass).
- `.claude/strap/state/close-ceremonies/*.md` -- ceremony reports from `/close-ceremony` (counts of close/reject/defer/skip per ceremony).
- `.claude/strap/memory/agents/*.md` and `.claude/strap/memory/dev-lead/*` -- per-agent memory counts (rough adoption signal for the persistence-stack curation cadence).

Parse counts (not content) into structured numbers per the window. The agent-memory parse is a simple "lines per file, files modified in window" pair -- not a content scan.

### Step 8: Compute data-quality coverage

For each metric category that `/dora-report` will compute, calculate what percentage of items in the window have the required fields populated. This is the honest-uncertainty signal -- low coverage means the metric is low-confidence.

```json
{
  "data_quality": {
    "tasks_with_activated_date":      {"covered": 47, "total": 50, "pct": 0.94},
    "tasks_with_original_estimate":   {"covered": 36, "total": 50, "pct": 0.72},
    "tasks_with_completed_work":      {"covered": 9, "total": 50, "pct": 0.18},
    "tasks_with_wallclock_computable": {"covered": 41, "total": 50, "pct": 0.82},
    "bugs_with_environment":          {"covered": 15, "total": 17, "pct": 0.88},
    "bugs_with_resolved_reason":      {"covered": 17, "total": 17, "pct": 1.00},
    "ai_tagged_items":                {"covered": 38, "total": 67, "pct": 0.57},
    "items_with_authored_by_in_desc": {"covered": 35, "total": 67, "pct": 0.52},
    "pr_threads_available":           {"covered": 22, "total": 28, "pct": 0.79},
    "pipeline_runs_classified":       {"covered": 14, "total": 16, "pct": 0.88},
    "overall_pct":                    0.74
  }
}
```

**Auto-detect data-entry artifacts**:

- If 50%+ of in-window Tasks have `CompletedWork == OriginalEstimate` exactly: flag `cw_oe_degeneracy: true`. `/dora-report` surfaces this prominently and switches the AI Efficiency Ratio to wall-clock-only.
- If <30% of Tasks have a wall-clock-computable AI Efficiency: flag the AI-Eff metric as `low_confidence` inline (the report shows it but with a warning).

### Step 9: Write the snapshot

Assemble all collected data into a single JSON document with this top-level structure:

```json
{
  "metadata": {
    "snapshot_id": "<YYYYMMDD-HHMMSS>",
    "collected_at": "<ISO 8601 UTC>",
    "collected_by": "dev-lead",
    "skill_version": "v2.2",
    "window": {"start": "<ISO>", "end": "<ISO>"},
    "sprint_name": "<name or null>",
    "layers_resolved": [
      {"name": "ASA UAT", "pipeline_pattern": "TM-UAT-*", "product_layer": "ASA",
       "federation_pattern": "src/Federations/TM/**", "excluded_from_dora": false},
      ...
    ],
    "batch_used": true
  },
  "work_items": [...],
  "revisions": [...],
  "pipeline_runs": [...],
  "funnels": [...],
  "prs_integration": [...],
  "prs_intermediate": [...],
  "feature_clusters": [...],
  "deployments": [...],
  "reverts": [...],
  "skill_logs": {
    "dora_reconcile_runs": <count>,
    "close_ceremonies": <count>,
    "agent_memory_modifications": <count>
  },
  "data_quality": {...}
}
```

Write atomically (temp file + move). If the resulting file exceeds 5 MB, compress with gzip and write `<file>.json.gz` instead -- `/dora-report` recognizes both extensions.

### Step 10: Print confirmation

```
Snapshot collected: <path>
  window:        <start> to <end>
  sprint:        <name or "(none, default window)">
  work items:    <count>
  pipeline runs: <count>
  integration PRs: <count>
  intermediate PRs: <count>
  layers used:   <count> declared, <count> matched
  data quality:  <overall %>
  size:          <KB>

Next: /dora-report --snapshot <path>
```

## Outputs

- A single JSON snapshot at `.claude/strap/state/dora-snapshots/<date>-<HHMMSS>.json` (or `--out` path) capturing the in-window work-item set, revisions (when supported), pipeline runs (bucketed by Layers), PRs (integration + intermediate streams), reverts, skill-log counts, and data-quality coverage.
- A stdout confirmation summarizing the collection.

## Quality gates

The skill is successful when all of the following hold:

- Both connection profiles were present at pre-flight.
- The skill ran read-only against every data source -- no work item, pipeline, branch, or PR was modified.
- The snapshot file is valid JSON (or valid gzip-of-JSON when over 5 MB).
- Every top-level field in the snapshot schema is present (even when its array is empty).
- The snapshot was written atomically (temp file + move).
- Data-quality coverage was computed honestly for every metric category -- low-coverage values are reported as 0% rather than hidden.
- Layers classification ran per project-profile.md's `Layers` section; unclassified pipeline runs are bucketed as `unclassified` and surfaced in data quality.
- Pre-flight failures (auth, missing profile) surface clearly with an actionable instruction; the skill never writes a partial snapshot file when the run failed mid-stream.

## Failure handling

- **Either connection profile missing**: stop. Recommend `/connect-devops-project` or `/connect-code-repo` per the gap.
- **Auth failure on either profile**: stop; surface the host-specific auth hint verbatim. Common causes: expired token, missing `az login`, expired GitHub PAT.
- **Iteration not found** (with `--sprint <name>`): list available iterations from `iteration_list`; stop.
- **`work_item_revisions` undeclared**: skip Step 3; record `revisions_unavailable: true` in data quality; continue.
- **`pull_request_list` undeclared**: stop. The PR-stream split is core to DORA-4 lead-time + change-failure metrics; without it the snapshot is missing fundamental signal. Surface verbatim.
- **`pull_request_show` undeclared OR per-PR threads inaccessible**: skip the iteration-count proxy; record `pr_threads_unavailable: true` in data quality; continue. PR size distribution in the report degrades to "intermediate-stream count only".
- **`git log` unavailable for revert detection**: skip Step 6; record `reverts_unavailable: true` in data quality; continue. The CFR computation in the report degrades to "bug-tagged-prod within 48h" only.
- **Pipeline-runs query unsupported by host**: stop. Without pipeline data, Deployment Frequency, Lead Time, MTTR cannot be computed and the report is fundamentally incomplete.
- **Atomic write fails**: surface the FS error; leave the temp file in place for the operator to inspect.
- **Layers section in project-profile.md is malformed** (missing required `Pipeline pattern` field on an active layer): stop; surface the offending entry; recommend a project-profile.md fix.

## References

- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- dora-analyst role contract: [`../../agents/agent-ops/dora-analyst.md`](../../agents/agent-ops/dora-analyst.md).
- Project profile (Layers section, area-path root): [`../../strap/contexts/project-profile.md`](../../strap/contexts/project-profile.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Source-control connection profile: `.claude/strap/state/code-connection.yaml`.
- Upstream signal: `/dora-reconcile` -- the daily data-quality janitor whose `--auto-fix` pass keeps the work-item field set complete enough for this collection to produce a high-quality snapshot.
- Downstream consumer: `/dora-report` -- renders the snapshot as a self-contained HTML report.
- Onboarding design (connection-profile schema, Layers schema): [`../../strap/contexts/onboarding-design.md`](../../strap/contexts/onboarding-design.md).
