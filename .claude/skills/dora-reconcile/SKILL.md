---
name: /dora-reconcile
description: Daily data-quality janitor for DORA. Auto-cascades forward (Story -> Resolved when all child Tasks Resolved; Story -> Closed when parent already Closed) and surfaces hygiene gaps across 8 passes (state mismatches, stale items, unlinked PRs, AI-tag inheritance, date hygiene, CompletedWork hygiene, Bug-specific hygiene, parent-child structure). With --auto-fix, derivable fields (state-transition timestamps + AI-tag inheritance + wall-clock CompletedWork) get stamped; without it, only Pass A cascades land. Never invents data. Run log at .claude/strap/state/dora-reconcile-runs/.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion
argument-hint: [--dry-run] [--auto-fix] [--days <N>]
---

# /dora-reconcile

## Purpose

The STRAP pipeline skills auto-transition work-item states when they finish their work. But edge cases happen: a developer manually closes a Task outside the pipeline; an agent halts mid-flow leaving inconsistent state; a Feature lingers in Active when all its Stories are Resolved; a description carries `Authored By: dev-lead` but the work item is missing the `AI` tag. `/dora-reconcile` catches those gaps.

Without this skill, the v2.2 lifecycle-metadata + `AI` tag wiring sits idle -- nothing enforces or backfills it. `/dora-reconcile` is the load-bearing skill that makes the metadata wiring actually pay off: DORA queries through `/dora-collect` and `/dora-report` rely on the `AI` tag to distinguish AI-authored work, and on accurate `StartDate` / `FinishDate` / `CompletedWork` for wall-clock AI Efficiency Ratio. This skill is what keeps those signals honest on a daily cadence.

Designed to run daily (or before each `/dora-report` run). The default behavior is conservative -- forward cascades that have no decision content (Pass A) get applied automatically; everything else is surface-only. `--auto-fix` opts into stamping derivable hygiene fields where the value is mechanically computable from existing state-transition timestamps and parent-chain inheritance. The skill NEVER invents data.

The skill ships portable. Every adopter-specific concern resolves at runtime:

- Work-tracking operations render through `operation_templates.<op>` in `.claude/strap/state/devops-connection.yaml`
- Type, state, field, and link mappings come from `mapping.*`; `state_asymmetries` covers host collapses (a `strap:<logical-state>` tag stands in where the host state machine cannot represent the transition)
- Markdown-to-HTML conversion is applied at the boundary for description re-renders
- Audit trail is `[STRAP/agent:dev-lead]` comments via `operation_templates.work_item_comment_add`
- Run log lands under `.claude/strap/state/dora-reconcile-runs/` (protected by `/strap-upgrade` because the entire `state/` directory is adopter-owned)

## Owner

**dev-lead.** This is dev-lead-direct work -- mechanical reconciliation, no analysis judgment needed at the per-item level. No specialist dispatch. The dev-lead reads the work items, computes the changes, applies (with `--auto-fix`) or surfaces them, and writes the audit log.

dora-analyst operates the heavier-touch DORA skills (`/dora-collect`, `/dora-report`) where interpretation is involved. `/dora-reconcile` is the upstream data-quality step that those skills depend on.

## Inputs

- `$ARGUMENTS` -- optional flags in any order. Examples:
  - `/dora-reconcile` -- daily default: applies Pass A cascades; surfaces everything else.
  - `/dora-reconcile --auto-fix` -- weekly: applies Pass A + stamps derivable hygiene (Passes F-1/F-2/F-3, G, H).
  - `/dora-reconcile --dry-run` -- preview without modifying any work item.
  - `/dora-reconcile --days 7 --auto-fix` -- scan only items changed in the last 7 days; apply both cascades and derivable hygiene.
- Recognized flags:
  - `--dry-run` -- scan and report what WOULD be reconciled; do not modify any work item, do not write a run log file (dry-run is a preview, not an audit record).
  - `--auto-fix` -- for hygiene violations with **derivable** fixes (missing StartDate/FinishDate, missing CompletedWork on ai-tagged Resolved items, missing `AI` tag inferable from description metadata or parent chain), stamp the value. Without `--auto-fix`, hygiene violations are surfaced only.
  - `--days <N>` -- scan items changed within the last N days. Default: 30.
- `.claude/strap/contexts/project-profile.md` -- source of truth for area-path root.
- `.claude/strap/state/devops-connection.yaml` -- connection profile. Required fields: `mapping.work_item_types.{feature,enhancement,bug,story,task,spec,requirement}.host_type`, `mapping.field_formats.description`, `mapping.states.{new,active,resolved,closed,removed}`, `mapping.state_asymmetries`, `mapping.fields.{severity,resolved_reason,original_estimate,completed_work,start_date,finish_date,activated_date,resolved_date,closed_date}`, `mapping.area_path_root`, `operation_templates.{work_item_query,work_item_read,work_item_update,work_item_comment_add}`.

## Pre-flight

1. **devops-connection.yaml present.** If missing, redirect to `/connect-devops-project`.
2. **`mapping.states.resolved` declared.** Required for cascade logic. If missing, this is a configuration defect -- stop and surface.
3. **Record start time.** The run log captures `started:` and `finished:` timestamps for the audit trail.
4. **Ensure `.claude/strap/state/dora-reconcile-runs/` exists.** Create if absent.

## Workflow

### Phase 1: Survey work items in window

Render `operation_templates.work_item_query` to fetch every work item changed in the last `--days` days (default 30) under `mapping.area_path_root`:

- `filters: [{field: changed_date, op: gte, value: <now - N days>}, {field: area_path, op: under, value: <mapping.area_path_root>}]`

For each returned id, render `operation_templates.work_item_read` to capture:

- Type, state, title, assignee.
- Tags (especially `AI`, `strap:<logical-type>`, `strap:<logical-state>`, `defer:*`, `rework`).
- Description (used by Pass F to parse `Authored By:` / `Target Agent:` / `Producing Agent:` lines).
- Parent linkage (System.Parent or host equivalent via `mapping.link_types.parent`).
- State-transition timestamps: `ActivatedDate`, `ResolvedDate`, `ClosedDate`, `StateChangeDate` (read via `mapping.fields.{activated_date,resolved_date,closed_date}` when declared; fall back to the host's standard date-field layout when absent).
- For Tasks: `OriginalEstimate`, `CompletedWork`, `StartDate`, `FinishDate`.
- For Bugs: `ResolvedReason`, `Severity`, `env:*` tag.
- For Features/Enhancements: `pr_url` (when `mapping.fields.pr_url` is declared) -- informational; the cascade gate at Pass A does not auto-Resolve these because portable PR-merged-state checks are out of scope (see Pass A discussion).

Group items by parent id so Pass A and Pass J can iterate parent->children chains efficiently. Cache the read responses in-session -- the reconciliation passes operate on the same item set; never re-query mid-run.

### Phase 2: Reconciliation passes

Run each pass in order. Items found by an earlier pass may resolve issues a later pass would have surfaced. With `--dry-run`, log every would-be change without applying. Without `--auto-fix`, only Pass A auto-applies; the rest are surface-only.

**Note: Pass C (retroactive OriginalEstimate population) is intentionally absent.** STRAP adopters start clean -- the workflow skills (`/quick`, `/execute-sprint`, `/fix-bugs`) populate OE at creation, so no retroactive backfill is needed. The pass letters skip from B to D to preserve audit-log numbering stability across releases.

#### Pass A: Forward cascades

The state machine permits these cascade rules; each fires only when ALL preconditions are met. Apply automatically by default (`--dry-run` logs without applying).

| Trigger condition | Cascade action |
|---|---|
| All child Tasks of a Story are `mapping.states.resolved` AND Story is `mapping.states.active` | Story -> `mapping.states.resolved`. Roll up `FinishDate` = max child FinishDate. Re-render description with `Completed By: dev-lead`, `Completed At: <now>`. Audit comment. |
| Story is `mapping.states.resolved` AND parent Feature/Enhancement is `mapping.states.closed` | Story -> `mapping.states.closed`. Apply `strap:closed` tag if host state machine collapses. Audit comment. |
| Spec is `mapping.states.resolved` AND at least one linked Feature is in a sprint (iteration_path populated, not the backlog) AND linked Requirement is `mapping.states.resolved` | Requirement -> `mapping.states.closed`. Audit comment. |
| Feature/Enhancement `Active` AND cluster discovery (v2.4 F5 cluster manifest -- see below) finds N>=1 sibling PRs AND ALL siblings have status `completed` (merged) per `pull_request_get` | Feature/Enhancement -> `mapping.states.resolved`. Roll up `FinishDate` = max sibling PR merge timestamp. Re-render description with `Completed By: dev-lead`, `Completed At: <now>`. Audit comment cites cluster_pr_ids. |

The new Feature-cluster-merged cascade is the v2.4 polyrepo extension. It uses F5's cluster discovery to identify all sibling PRs of a Feature, walks each host's `pull_request_get` to confirm merge status, and cascades Feature -> Resolved only when the entire cluster has merged. Single-PR Features (cluster_pr_count=1) also flow through this rule -- the single PR merged is the same condition as "all siblings merged", so the cascade applies cleanly. See the cluster-discovery + integrity logic in Pass K.

**Cascades NEVER auto-applied by this skill** (each requires a human gate elsewhere):

- Feature/Enhancement `Active` -> `Resolved` *when no cluster manifest exists* (pre-F5 PR pattern or adopters who never enabled clusters): requires PR-merged state confirmation, which is not portably checkable without `pull_request_get` on a known PR set. Surface as a candidate for `/close-ceremony` instead. The new cluster-merged cascade above covers Features WITH cluster manifests; this fallback covers everything else.
- Feature/Enhancement `Resolved` -> `Closed`: the CPO value-acceptance gate via `/close-ceremony`.
- Bug `Active` -> `Resolved`: lands inside `/fix-bugs` or `/quick`; the dev-lead populated `ResolvedReason` at that moment. `/dora-reconcile` does not re-evaluate.
- Bug `Resolved` -> `Closed`: QA/CPO verification gate via `/close-ceremony`.
- Spec / Requirement `Active` -> `Resolved`: CPO refinement signoff gates inside `/refine-spec` / `/refine-requirement`.
- Any backward transition (Resolved -> Active, Closed -> Active): manual via `/close-ceremony` reject path only.

For each applied cascade, post the audit comment via `operation_templates.work_item_comment_add`:

> `[STRAP/agent:dev-lead] State: <old> -> <new> (via /dora-reconcile cascade). Trigger: <cascade rule>. Children: <#<ids> in <state>>.`

#### Pass B: State-mismatch detection (surface only; never auto-modify)

Per the state machine, parents should not be ahead of their children. Surface but never auto-correct -- mismatches indicate something went sideways and need human review.

| Mismatch | Surface message |
|---|---|
| Story `mapping.states.resolved` with a child Task in `mapping.states.active` or `mapping.states.new` | `Story #<id> resolved but child Task #<id> is <state>; was the Story closed prematurely or the Task reopened?` |
| Feature `mapping.states.resolved` with a child Story in `mapping.states.active` or `mapping.states.new` | `Feature #<id> resolved but child Story #<id> is <state>` |
| Feature `mapping.states.closed` with a non-Closed/Removed child | `Feature #<id> closed but child #<id> is <state>; CPO closed too early or child reopened` |
| `mapping.states.removed` parent with a non-Removed/Closed child | `Removed parent #<id> has non-Removed child #<id>; cascade Removed downward if work obsolete` |
| Task in `mapping.states.resolved` AND host treats Resolved as a Task-valid state per `state_asymmetries` | OK -- not a mismatch. Skip. |
| Task in `mapping.states.resolved` AND host treats Task transitions as `active -> closed` directly per `state_asymmetries` | `Task #<id> in Resolved; the host's task state machine expects Active -> Closed direct. Transition to Closed.` |

The operator decides resolution; surface in the run log.

#### Pass D: Stale items (surface only)

For each item, compute `days_since_state_change` and flag against type-specific thresholds.

**Items stuck in progress:**

| Type | Threshold | Signal |
|---|---|---|
| Task | Active > 3 days | possibly stalled; investigate |
| Story | Active > 5 days | possibly under-scoped or blocked |
| Feature | New > 14 days | not picked up; consider /plan-sprint or /reset-feature |
| Spec | Active > 14 days | refinement stalled; consider /refine-spec |
| Requirement | Active > 7 days | refinement stalled; consider /refine-requirement |

**Items pending Closed (awaiting human gate):**

| Type | Threshold | Signal |
|---|---|---|
| Feature | Resolved > 14 days | CPO acceptance lagging |
| Enhancement | Resolved > 14 days | CPO acceptance lagging |
| Bug | Resolved > 14 days | QA/CPO verification lagging |
| Spec | Resolved > 30 days | terminal but cross-check on extreme outliers |

For each, surface item id, title, days stale, assignee, current state.

**Recommendation hint when pending-Closed count is material**: if Pass D surfaces >= 5 items pending Closed across Features/Enhancements/Bugs, append a recommendation to the run log and stdout summary:

```
RECOMMEND: <n> items have been in Resolved > 14 days awaiting close.
           Run /close-ceremony to walk through them and decide close / reject / defer per item.
```

#### Pass E: Untracked PRs (surface only)

For each PR merged in the window (read via `code-connection.yaml`'s `operation_templates.pull_request_list` if declared; skip this pass entirely when the profile doesn't expose a list operation), check that at least one work item is linked. PRs without a linked work item indicate either drive-by commits (against STRAP convention -- they should go through `/quick`) or automation that didn't link.

Surface the unlinked PR ids for operator review.

When `code-connection.yaml` does not expose a `pull_request_list` operation, skip this pass and note `Pass E skipped: pull_request_list not supported by source-control profile` in the run log.

#### Pass F: Hygiene tags

Validates that AI-authored work items carry the `AI` tag. Three sub-phases, all derivable from existing description content + parent-chain structure -- no human classification needed.

STRAP convention: work items carry the `AI` tag (binary signal -- "this item was authored by an AI agent in the STRAP pipeline") plus a `strap:<logical-type>` tag. Per-role attribution is NOT carried as tags -- it lives in the `Authored By:` / `Target Agent:` / `Producing Agent:` description metadata, so tag cardinality stays bounded.

**F-1: Direct extraction from description**

The workflow skills write structured attribution into work-item descriptions:

- Tasks include `Target Agent: <role>` (e.g., `Target Agent: backend-engineer`).
- Stories include `Producing Agent: dev-lead`.
- The lifecycle-metadata block at the top of every persisted description includes `Authored By: <role>`.

Parse the description (strip HTML if `mapping.field_formats.description` is `html`), match any of:

- `/Authored By\s*[:|]\s*([a-z-]+)/i`
- `/Target Agent\s*[:|]\s*([a-z-]+)/i`
- `/Producing Agent\s*[:|]\s*([a-z-]+)/i`

If any match returns a role string AND the item lacks the `AI` tag, propose adding `AI`.

| Check | Default | With `--auto-fix` |
|---|---|---|
| Description carries one of the three role-attribution lines AND `AI` tag missing | Surface | Add `AI` |

**F-2: Upward propagation (parent inherits `AI` from any ai-tagged descendant)**

After F-1, walk every item without an `AI` tag. If any of its descendants (via `mapping.link_types.parent` chain -- Tasks under Stories, Stories under Features/Enhancements/Bugs) has the `AI` tag, propose adding `AI`. Iterate the parent-walk until no new items are added (typically 2-3 passes).

This is how Features and Enhancements pick up the tag when their description doesn't carry an attribution line itself -- the existence of an AI-tagged Task or Story below them is the signal.

| Check | Default | With `--auto-fix` |
|---|---|---|
| Item has any ai-tagged descendant AND `AI` tag missing | Surface | Add `AI` |

**F-3: Downward propagation (children inherit `AI` from parent)**

After F-1 and F-2, walk every item without an `AI` tag. If its parent has `AI`, propose adding `AI`. Catches edge cases where a child Task was created without the attribution line but the parent chain is clearly AI-authored.

| Check | Default | With `--auto-fix` |
|---|---|---|
| Item's parent has `AI` tag AND item's `AI` tag missing | Surface | Add `AI` |

#### Pass G: Date hygiene (auto-fixable with `--auto-fix`)

Validate `StartDate` and `FinishDate` against state-transition timestamps. Auto-fix derives values from existing transition dates -- never invents.

| Check | With `--auto-fix` |
|---|---|
| Active item missing `StartDate` AND `ActivatedDate` set | Stamp `StartDate = ActivatedDate` |
| Closed item missing `FinishDate` AND `ClosedDate` set | Stamp `FinishDate = ClosedDate` |
| Resolved item missing `FinishDate` AND `ResolvedDate` set (used for item types whose terminal stop is Resolved) | Stamp `FinishDate = ResolvedDate` |
| `StartDate` after `FinishDate` (planning artifact from manual edits) | Stamp `StartDate = ActivatedDate, FinishDate = ClosedDate or null` |
| Story/Feature Closed with `FinishDate` not matching max child FinishDate | Re-derive from children; stamp |

For each stamped change, audit comment:

> `[STRAP/agent:dev-lead] Date hygiene: stamped <field> from <source-field> (via /dora-reconcile --auto-fix).`

#### Pass H: CompletedWork hygiene (auto-fixable with `--auto-fix`)

Wall-clock `CompletedWork` for AI-tagged items where the value is missing or suspiciously equal to `OriginalEstimate`.

| Check | With `--auto-fix` |
|---|---|
| Resolved/Closed `AI`-tagged item missing `CompletedWork` AND `ActivatedDate` set AND (`ResolvedDate` or `ClosedDate`) set | Stamp `CompletedWork = (ResolvedDate or ClosedDate) - ActivatedDate` in hours |
| Resolved/Closed item with `CompletedWork == OriginalEstimate` exactly AND tagged `AI` | Replace `CompletedWork` with wall-clock value; audit comment captures the change |
| Resolved/Closed item WITHOUT `AI` tag and missing `CompletedWork` | Surface only -- a human enters the actual hours; the skill never stamps non-AI items |

For each stamped or replaced change:

> `[STRAP/agent:dev-lead] CompletedWork hygiene: stamped <h>h wall-clock (via /dora-reconcile --auto-fix). Source: (ResolvedDate or ClosedDate) - ActivatedDate.`

The CW==OE replacement is the most aggressive auto-fix; it overwrites a value that was set incorrectly (a well-known data-entry artifact in workflows where reviewers stamp `CompletedWork` equal to `OriginalEstimate` at close-time). The audit comment makes the change transparent.

#### Pass I: Bug-specific hygiene (surface only)

| Check | Surface message |
|---|---|
| Closed/Resolved Bug missing `ResolvedReason` | `Bug #<id> resolved without ResolvedReason; operator: Fixed / Cannot Reproduce / By Design / Deferred` |
| Bug missing `Severity` | `Bug #<id> missing Severity per mapping.fields.severity` |
| Bug missing `env:*` tag (where `mapping.fields.environment` is declared) | `Bug #<id> missing env:* tag; operator: confirm env` |

#### Pass J: Parent-child structure (surface only)

| Check | Surface message |
|---|---|
| Feature with no Story children AND Feature in `mapping.states.active` or `mapping.states.new` | `Feature #<id> has no Stories; decompose via /decompose-feature or reset via /reset-feature` |
| Enhancement with no Story OR Task children AND Enhancement in `mapping.states.active` or `mapping.states.new` | `Enhancement #<id> has no child work items; create Story+Task via /quick` |
| Story with no Task children AND Story in `mapping.states.active` | `Story #<id> has no Tasks; decompose or remove` |
| Task with no parent | `Orphan Task #<id> -- link to a Story or convert to Story` |

Note: STRAP Bugs are atomic (no child Task convention) per `/file-bugs` + `/fix-bugs` + `/quick` Shape 3a. A Bug without children is normal, not an anomaly -- do NOT flag.

#### Pass K: Multi-PR Feature cluster integrity (v2.4 polyrepo)

Walks Features and Enhancements in `mapping.states.active` to discover their PR clusters and reconcile merge state. Produces two outputs:

1. Per-Feature cluster-merged input to Pass A's new "Feature cluster merged" cascade rule (so Pass A can auto-apply the cascade for fully-merged clusters).
2. Surface-only entries in the run log for broken or in-flight clusters that need CPO arbitration.

##### Cluster discovery (mirrors /dora-collect Step 5b)

For each Active Feature/Enhancement, enumerate linked PRs via the work-tracking adapter's `operation_templates.work_item_linked_prs` (or the equivalent host walk). For each linked PR, read its body for the cluster marker:

```
<!-- strap-pr-cluster: feature-id=<id> sub-repo=<slug> [merge-order=<N>-of-<total>] -->
```

When present, this PR is one of N siblings; capture the feature_id + sub_repo. The marker's feature_id should match this Feature's id (mismatch surfaces as data-quality warning -- a PR clusters to a different Feature than the work-tracker says).

When absent, fall through:

- **Cluster-summary comment** (secondary signal): a top-level PR comment authored by /execute-sprint Phase 6 step 3 containing the cluster manifest in human-readable form.
- **Tertiary fallback**: no marker AND no comment -> treat as single-PR Feature (cluster_pr_count=1). Pass A's existing single-PR-via-work-tracking handling applies (cascade only when the host exposes pull_request_get OR the linked PR is observably merged in source-control state).

##### Cross-host walk

When the umbrella's `code-connection.yaml` declares heterogeneous-host sub_repos: map (per F3), walk each declared host's `operation_templates.pull_request_list` to find siblings (filter by feature-id in body). Mirrors /dora-collect Step 5b's cross-host logic. Single-host umbrellas: degenerate to one adapter query.

##### Merge-status check + cluster state computation

For each Feature with a discovered cluster, walk every sibling PR via the per-host `operation_templates.pull_request_get` and capture status:

- `completed` (merged) -- the PR is fully landed.
- `active` -- still open.
- `abandoned` -- closed without merge.
- `unknown` -- adapter returned an unexpected state.

Compute `cluster_state` per Feature:

- **`all-merged`** -- every sibling has status `completed`. Feeds Pass A's cluster-merged cascade rule; Pass A applies the Feature -> Resolved transition.
- **`in-flight`** -- at least one sibling is `active`, none abandoned. Cluster is still in progress; no cascade. Surface as "Feature #<id> cluster in-flight: <N> of <total> PRs merged".
- **`broken`** -- at least one sibling is `abandoned` (irrespective of others). Surface as "Feature #<id> cluster BROKEN: PR #<id> abandoned while siblings <list> are <state>. CPO arbitration needed via /close-ceremony (close Feature manually as scope cut) OR re-open abandoned PR (complete the original cluster intent)".
- **`unresolved`** -- at least one sibling is `unknown`. Surface as "Feature #<id> cluster unresolved: cannot determine merge status for PR #<id>. Verify adapter or re-run /dora-reconcile after host transient recovers". No cascade.

Broken and unresolved clusters DO NOT auto-resolve under any circumstances -- /dora-reconcile surfaces; the CPO decides via /close-ceremony or manual intervention.

##### Performance

Pass K costs N adapter calls per Active multi-PR Feature per /dora-reconcile run (one `pull_request_get` per sibling). For adopters with many in-flight clusters, this multiplies host API calls. Known acceptable cost for v2.4. Future optimization candidates (batching, caching, opt-in cluster polling) are v2.5+ concerns. Adopters can reduce the cost by running /dora-reconcile less frequently (default is daily; weekly is reasonable for low-cluster-velocity teams).

##### Single-repo umbrellas

Skip Pass K entirely on single-repo umbrellas (no cluster markers ever exist; v2.3 single-PR-per-Feature cascade gap surfaces as before via Pass A's existing "Cascades NEVER auto-applied" framing for non-cluster Features).

### Phase 3: Apply changes (when --auto-fix)

For each proposed auto-fix from Passes A, F-1, F-2, F-3, G, H, render `operation_templates.work_item_update` with the specific change. Read existing tags before mutation (Pass F appends; never replaces). Read existing description before re-rendering (Pass A's Story cascade preserves `Authored By`/`Authored At` and adds completion metadata).

For each successful application, log to the in-session change-log. For each failure, capture item id + host error verbatim, continue with the rest, surface failures at the end.

With `--dry-run`: log every would-be change without applying.

### Phase 4: Write the run log

Path: `.claude/strap/state/dora-reconcile-runs/<YYYYMMDD>-<HHMMSS>.md`. Atomic write (temp file + move).

```markdown
---
run_id: <YYYYMMDD-HHMMSS>
started: <ISO>
finished: <ISO>
mode: <dry-run | apply | apply+auto-fix>
window_days: <N>
items_scanned: <count>
items_modified: <count>
---

# Reconciliation Run

## Pass A: Cascades applied

- Story #<id> moved to Resolved (children: #<id1>, #<id2>, ...)
- Story #<id> moved to Closed (parent Feature #<id> already Closed)
- Requirement #<id> moved to Closed (linked Spec #<id> Resolved + Feature in sprint)

## Pass B: State mismatches (operator action needed)

- Story #<id> is Resolved but child Task #<id> is still Active (assignee: <name>)

## Pass D: Stale items

- Task #<id> (assignee <name>): Active 5 days
- Story #<id> (assignee <name>): Active 8 days
- Feature #<id>: New 21 days
- Spec #<id> (assignee <name>): Active 18 days
- Requirement #<id> (assignee <name>): Active 12 days
- Feature #<id>: Resolved 16 days (pending Closed)
- ...

RECOMMEND: <n> items have been in Resolved > 14 days awaiting close.
           Run /close-ceremony to walk through them and decide.

## Pass E: PRs without linked work items

- PR <id>: merged <date> (operator: investigate provenance)
  ... or
- Pass E skipped: pull_request_list not supported by source-control profile

## Pass F: Hygiene tags

- F-1: Item #<id> added `AI` tag (extracted from `Authored By: dev-lead` in description)   [auto-fix]
- F-2: Feature #<id> added `AI` tag (inherited from ai-tagged Story #<id>)                 [auto-fix]
- F-3: Task #<id> added `AI` tag (inherited from parent Story #<id>)                       [auto-fix]
- Item #<id> -- candidate for `AI` tag inheritance (Pass F-1 match)                        [surface; --auto-fix to apply]

## Pass G: Date hygiene

- Task #<id> stamped StartDate from ActivatedDate                                          [auto-fix]
- Story #<id> stamped FinishDate from max child Task FinishDate                            [auto-fix]
- Feature #<id> had StartDate after FinishDate; cleared planning dates                     [auto-fix]
- Item #<id> -- candidate for date stamping                                                [surface; --auto-fix to apply]

## Pass H: CompletedWork hygiene

- Resolved AI Task #<id> stamped CompletedWork = <h>h from wall-clock                      [auto-fix]
- Resolved AI Task #<id> had CW==OE; replaced with <h>h wall-clock                         [auto-fix, audit comment posted]
- Resolved non-AI Task #<id> missing CompletedWork                                         [surface; human enters hours]

## Pass I: Bug-specific

- Bug #<id> closed without ResolvedReason (operator: set Fixed / Cannot Repro / By Design)
- Bug #<id> missing Severity per mapping.fields.severity

## Pass J: Parent-child structure

- Feature #<id> has no Stories (operator: /decompose-feature or /reset-feature)
- Enhancement #<id> has no child work items (operator: /quick)
- Orphan Task #<id> (operator: link to a Story or convert)

## Pass K: Multi-PR Feature cluster integrity

- Feature #<id> cluster all-merged (<N> siblings): cascade applied via Pass A (see above)
- Feature #<id> cluster in-flight (<merged>/<total>): not yet ready for Resolved cascade
- Feature #<id> cluster BROKEN: PR #<id> abandoned; siblings <list> in <state>. CPO arbitration needed (close Feature as scope cut OR re-open abandoned PR)
- Feature #<id> cluster unresolved: cannot determine merge status for PR #<id>; retry or verify adapter

## Apply failures (<n> items)

- Item #<id>: <host error>
  ... (only present when failures occurred during apply)
```

If mode was `dry-run`: do NOT write the run log -- dry-run is a preview, not an audit record.

### Phase 5: Print summary

```
/dora-reconcile complete: <run-id>
  mode:                  <dry-run | apply | apply+auto-fix>
  items scanned:         <count>
  cascades applied:      <count>            (Pass A -- includes v2.4 multi-PR Feature cluster-merged)
  state mismatches:      <count>            (Pass B -- operator action)
  stale items:           <count>            (Pass D -- triage)
  unlinked prs:          <count>            (Pass E -- provenance)
  hygiene auto-fixed:    <count>            (Passes F/G/H -- derivable)
  hygiene surfaced:      <count>            (Passes F/I/J -- needs human)
  clusters in-flight:    <count>            (Pass K -- multi-PR Features still mid-merge)
  clusters BROKEN:       <count>            (Pass K -- CPO arbitration needed)
  apply failures:        <count>            (preserved; see run log)

Run log: .claude/strap/state/dora-reconcile-runs/<run-id>.md

Recommended next:
  - /dora-collect + /dora-report to refresh metrics with the reconciled state
  - /close-ceremony if Pass D surfaced >= 5 items pending Closed
  - Review Pass B state mismatches manually -- the skill never auto-corrects these
```

## Recommended cadence

- **Daily** -- `/dora-reconcile` (default; applies Pass A cascades; surfaces everything else).
- **Weekly** -- `/dora-reconcile --auto-fix` (also stamps derivable hygiene -- dates, `AI` tag inheritance, wall-clock `CompletedWork`).
- **Pre-DORA-report** -- `/dora-reconcile --auto-fix` (ensures the snapshot has clean states + hygiene).
- **Pre-release** -- `/dora-reconcile --dry-run` (see everything outstanding before the release window closes).

## Outputs

- Pass A cascade transitions applied via `operation_templates.work_item_update` (Story -> Resolved when all child Tasks Resolved; Story -> Closed when parent already Closed; Requirement -> Closed when linked Spec Resolved + Feature in sprint).
- With `--auto-fix`: Pass F (AI-tag inheritance via three sub-phases), Pass G (date stamping from state-transition timestamps), Pass H (wall-clock `CompletedWork` for ai-tagged Resolved items).
- Surfaces (not auto-modified): Pass B (state mismatches), Pass D (stale items + close-ceremony recommendation when count crosses 5), Pass E (unlinked PRs when source-control profile exposes list operation), Pass I (Bug hygiene gaps), Pass J (parent-child structure anomalies).
- `[STRAP/agent:dev-lead]` audit comments on every applied transition.
- A run log at `.claude/strap/state/dora-reconcile-runs/<run-id>.md` capturing every change applied and every gap surfaced. Not written on `--dry-run`.

## Quality gates

The skill is successful when all of the following hold:

- devops-connection.yaml was present at pre-flight; `mapping.states.resolved` declared.
- Pass A modifications are conservative -- cascades fire only when ALL preconditions are met (every child in terminal state).
- Pass B never auto-modifies (mismatches always need human review).
- Passes D, E, I, J are surface-only; no modifications.
- Passes F, G, H auto-fix only with explicit `--auto-fix` flag, and only derivable values (state-transition timestamps, parent-chain inheritance, regex-extracted role attribution). Never invent.
- The CW==OE replacement (Pass H) always leaves an audit comment on the work item explaining the change.
- Every cascade carries a `[STRAP/agent:dev-lead]` audit comment via `operation_templates.work_item_comment_add`.
- The `strap:<logical-state>` tag is applied at each transition where the host state machine collapses per `state_asymmetries`.
- `--dry-run` previewed without modifying any work item and without writing a run log file.
- Individual transition failures are captured in the run log's "Apply failures" section without halting the batch.
- The `AI` tag is the binary signal -- the skill never invents per-role `agent:<role>` tags (STRAP does not use that pattern).

## Failure handling

- **devops-connection.yaml missing**: stop. Recommend `/connect-devops-project`.
- **`mapping.states.resolved` undeclared**: stop. Configuration defect; cannot reconcile without state definitions.
- **WIQL or pagination issues**: retry once; surface if persistent. The skill is read-heavy -- query failure halts the run before any apply.
- **Individual work-item update fails** (host conflict, permission, transient): log the failure; continue with the rest of the batch; surface in the "Apply failures" section of the run log.
- **`operation_templates` rendering produces malformed requests**: surface the failing template path and request body; do not execute. Halt the reconcile.
- **HTML conversion fails on a description re-render** (Pass A Story cascade): surface the offending content; do not post raw markdown into an HTML-flavored field. Skip that specific cascade; continue the batch.
- **Pass E source-control profile lacks `pull_request_list`**: skip Pass E entirely with a note in the run log; do NOT fail the run.

## References

- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- dev-lead guardrails: [`../../strap/rules/agents/dev-lead.md`](../../strap/rules/agents/dev-lead.md).
- agent-ops team rules: [`../../strap/rules/agent-ops.md`](../../strap/rules/agent-ops.md).
- dora-analyst role contract: [`../../agents/agent-ops/dora-analyst.md`](../../agents/agent-ops/dora-analyst.md) -- the analyst that operates `/dora-collect` and `/dora-report` against the data this skill keeps honest.
- Project profile (area-path root): [`../../strap/contexts/project-profile.md`](../../strap/contexts/project-profile.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Source-control connection profile: `.claude/strap/state/code-connection.yaml` (Pass E consults `operation_templates.pull_request_list` when declared).
- Work-item templates: `.claude/strap/templates/work-items/*.template.md` (Pass F-1 parses `Authored By:` / `Target Agent:` / `Producing Agent:` lines embedded in these templates).
- Upstream signals: `/execute-sprint`, `/fix-bugs`, `/quick`, `/refine-pr`, `/file-bugs`, `/refine-spec`, `/refine-requirement` -- the workflow skills whose lifecycle metadata + tags this skill backfills when gaps appear.
- Downstream consumer: `/close-ceremony` -- triggered by Pass D recommendation when items pending Closed > 14d count crosses 5.
- Downstream consumers: `/dora-collect`, `/dora-report` -- the DORA snapshot + render pair whose data quality this skill maintains.
- Onboarding design (connection-profile schema source-of-truth): [`../../strap/contexts/onboarding-design.md`](../../strap/contexts/onboarding-design.md).
