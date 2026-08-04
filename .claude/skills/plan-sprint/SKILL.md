---
name: /plan-sprint
description: Allocate Stories, Tasks, and Bugs into the CURRENT sprint only. Single-sprint allocation -- no pre-allocation across successor sprints (overflow is /rebalance-sprint's responsibility). Dev-lead dispatches sprint-planner serial-Task read-only for capacity analysis and allocation proposal; CPO approves; dev-lead persists iteration_path updates and audit comments via the work-tracking connection profile.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
---

# /plan-sprint

## Purpose

Allocate Stories, Tasks, and Bugs into the **current sprint only** -- the bridge between [`/decompose-feature`](../decompose-feature/SKILL.md) (which produces decomposed Stories and Tasks under an active Feature) and [`/execute-sprint`](../execute-sprint/SKILL.md) (which begins implementation against a sprint-allocated Feature). Bug allocation also runs here, picking up items produced by [`/file-bugs`](../file-bugs/SKILL.md).

**Single-sprint constraint (hard rule).** /plan-sprint allocates items into the CURRENT sprint only. It does not pre-allocate work into successor sprints, even when capacity is available across multiple iterations. Pre-allocation creates a planning fiction that has to be unwound at every sprint boundary or mid-sprint shift; /rebalance-sprint is the single authoritative place where cross-sprint flow happens. This constraint was learned the hard way in the Parafin cycle 1 smoke test, where v1's pre-allocation behavior produced surprising and incorrect over-the-horizon assignments.

Invoke this skill when one or more Features have been decomposed and the CPO is ready to commit work to the current iteration. Use [`/rebalance-sprint`](../rebalance-sprint/SKILL.md) when the work is already in flight and needs to be re-distributed, or at sprint boundaries to roll incomplete work forward.

The skill ships portable. Every adopter-specific concern resolves at runtime:

- Iteration model and capacity come from `operation_templates.iteration_list` / `iteration_get_capacity` in `.claude/strap/state/devops-connection.yaml`; fallback per-developer capacity from `project-profile.md` when `iteration_get_capacity` is unsupported
- Pair topology and capacity assumptions come from `project-profile.md`'s `Conventions` section (e.g., human-plus-agent-dev hours per day per pair)
- Work-tracking queries and updates render through `operation_templates.<op>`
- Type, state, field, and link mappings come from `mapping.*` in the same profile
- Sprint cadence and naming convention come from `project-profile.md`'s `Conventions` section
- Allocation audit lives in a single `[STRAP/agent:dev-lead]` comment on each allocated Feature; iteration_path moves on Stories/Tasks/Bugs are persisted as field updates (no per-item comment churn)

## Owner

**dev-lead.** sprint-planner is dispatched as a serial-Task specialist for capacity analysis + Ready-Feature identification + allocation proposal. The dev-lead owns the CPO conversation, the persistence calls, and the proposal-presentation directly.

## Inputs

- `$ARGUMENTS` -- one of:
  - empty: allocate every decomposition-ready Feature (active Feature whose child Stories/Tasks have no iteration_path) plus every open Bug, up to remaining capacity.
  - a single Feature work item identifier: allocate only that Feature.
  - a Feature identifier followed by a developer identifier (the developer's host-identity, e.g., email): allocate the Feature AND assign the Feature plus all child Stories and Tasks to that developer before allocation.
  - a single Bug work item identifier: allocate only that Bug (with optional developer assignment as the second arg).
- `.claude/strap/contexts/project-profile.md` -- source of truth for sprint cadence, naming convention, pair topology, capacity assumptions, and active domains.
- `.claude/strap/state/devops-connection.yaml` -- work-tracking connection profile. Required fields used by this skill: `mapping.work_item_types.{feature,story,task,bug}.host_type`, `mapping.states.{new,active}`, `mapping.fields.{original_estimate,iteration,assigned_to,area}`, `operation_templates.{work_item_read,work_item_query,work_item_update,work_item_comment_add,iteration_list,iteration_get_capacity}`, `capabilities.{iteration_list,iteration_get_capacity}`.

## Pre-flight

1. **devops-connection.yaml present.** If missing, redirect to `/connect-devops-project`.
2. **`iteration_list` capability supported.** This skill cannot operate without an iteration model. If `capabilities.iteration_list: unsupported`, stop and surface the gap; the host is fundamentally non-sprint-shaped and the work flow that follows /plan-sprint does not apply.

## Workflow

### Phase 1: Identify the current sprint

Render `operation_templates.iteration_list` with `timeframe: current` (per the host's "current" semantics) and execute. Take the single returned iteration.

- If the operation returns an empty list, stop and tell the CPO no current sprint exists -- do not invent one. Direct the CPO to create the iteration in the host first.
- If multiple iterations match "current", surface the ambiguity with the candidate list and ask the CPO to pick one via `AskUserQuestion`.

Capture the iteration's path (`iteration_path`), `start_date`, `end_date`, and (for naming) the iteration's display name. Render the sprint's STRAP-side name via the convention in project-profile.md's `Conventions` section (e.g., `Sprint 2026.05.A`), for use in CPO-facing summaries; the host's iteration_path is what gets persisted to work items.

### Phase 2: Pull team capacity

Render `operation_templates.iteration_get_capacity` with the iteration identifier and team (from `mapping.team_id` or project-profile.md's `DevOps integration` section) and execute.

**When `capabilities.iteration_get_capacity: supported`:** Use the returned per-developer capacity (available hours, time-off, existing commitments).

**When `capabilities.iteration_get_capacity: unsupported`:** Fall back to a flat per-developer capacity baseline derived from:
- Sprint cadence (days) from project-profile.md's `Conventions` section
- Daily productive-hours assumption from project-profile.md's `Conventions` section (the default to suggest when project-profile.md doesn't yet declare one is 6 productive hours per day per developer-pair; the CPO can override at curation time)
- Subtract any approved time-off the CPO surfaces interactively

Flag the fallback in the Phase 5 proposal so the CPO sees that capacity is approximate.

### Phase 3: Identify allocation candidates

**Feature candidates (when `$ARGUMENTS` is empty or names a Feature):**

If `$ARGUMENTS` names a single Feature, render `operation_templates.work_item_read` with `expand_links=true` and walk children. Otherwise, render `operation_templates.work_item_query` for decomposition-ready Features:

- `types: [<mapping.work_item_types.feature.host_type>]`
- `filters: [{field: state, op: eq, value: <mapping.states.active>}, {field: area_path, op: under, value: <mapping.area_path_root from profile or project-profile.md>}]`
- `order_by: [{field: priority, direction: asc}]` (when `mapping.fields.priority` is declared)

For each candidate Feature, fetch its child Stories and each Story's child Tasks via the host's parent/child links. Collect `original_estimate`, `assigned_to`, current `iteration_path` (if any), and tags. A Feature is **decomposition-ready** when:
- Its state is `active` (decomposed by `/decompose-feature`, not yet allocated to a sprint)
- Every child Task has `original_estimate` populated
- At least one child Story/Task has no `iteration_path` set (otherwise it's already allocated)

Skip Features that don't meet decomposition-readiness; surface them in the proposal with the reason.

**Bug candidates (always, when `$ARGUMENTS` is empty or names a Bug):**

Render `operation_templates.work_item_query`:
- `types: [<mapping.work_item_types.bug.host_type>]`
- `filters: [{field: state, op: in, value: [<mapping.states.new>, <mapping.states.active>]}, {field: area_path, op: under, value: <area path>}]`
- `order_by: [{field: severity, direction: asc}, {field: priority, direction: asc}]` (when those fields are declared)

Each Bug carries its own effort estimate (typically read from `mapping.fields.original_estimate` if Bugs are estimated, or a default-per-severity assumption from project-profile.md). Bugs without estimates surface as "estimate-needed" -- the CPO can fix at the proposal gate or defer.

### Phase 4: Read existing sprint commitment

Render `operation_templates.work_item_query` to find work already allocated to the current sprint:

- `types: [<mapping.work_item_types.{story,task,bug}.host_type>]`
- `filters: [{field: iteration_path, op: eq, value: <current iteration path>}]`

Sum hours per developer (or per pair) from the returned items' `original_estimate` and `assigned_to`. Subtract from Phase 2's capacity to derive **remaining capacity per developer**. This is what new allocations consume.

### Phase 5: Dispatch sprint-planner for allocation proposal

Dispatch sprint-planner via `Task` (serial, read-only palette: `Read, Grep, Glob, Bash`). The brief includes:

- The current iteration (path, dates, name).
- The per-developer capacity table (available, already allocated, remaining).
- The Feature + Bug candidates (with hours, assignees, parent links, dependency graph from /decompose-feature).
- The pair topology and capacity assumptions from project-profile.md.
- The mandate: **single-sprint allocation only.** Propose what fits in the CURRENT sprint's remaining capacity. Items that don't fit do NOT get pre-allocated to a successor sprint -- they stay unallocated (no iteration_path) and the proposal flags them as backlog overflow for the next /plan-sprint run or for /rebalance-sprint to handle.
- The mandate: propose allocations at the Story / Task / Bug level, never at the Feature level (Features span sprints by design; the Feature's children are what get iteration_path).
- The mandate: respect dependency graphs from /decompose-feature -- allocating a Task whose predecessor lives in a future sprint is incoherent; either both fit this sprint or both stay unallocated.
- The required return shape: per-Feature allocation summary, per-Bug allocation summary, per-developer capacity-after-allocation table, overflow list with reasons, capacity warnings.
- The `tokens_used: ~XXk` finishing-summary line.

sprint-planner returns the proposal; the dev-lead surfaces it to the CPO.

### Phase 6: Apply optional developer assignment

When `$ARGUMENTS` includes a developer identifier:

- For a Feature: render `operation_templates.work_item_update` to set `assigned_to=<developer>` on the Feature AND on every descendant Story and Task. Apply this BEFORE proposing capacity numbers so the proposal reflects the post-assignment view.
- For a Bug: same update applied to the Bug only (Bugs do not have descendants in the v2.2 work-item hierarchy).
- If the item already has a different developer assigned, ask the CPO to confirm the override via `AskUserQuestion` before issuing the update.

This phase is folded into Phase 5's proposal preparation when an assignment is requested; otherwise it is skipped.

### Phase 7: Present the proposal and await CPO approval

Render the proposal to the CPO using the language of the configured pair topology (from project-profile.md's `Conventions`):

```
Sprint:   <STRAP-rendered name> (<host iteration path>)
Window:   <start_date> -- <end_date>
Capacity: <pair-topology one-liner>; <iteration_get_capacity supported | fallback from project-profile.md>

Per-developer capacity (hours):
| Developer      | Available | Already allocated | Proposed new | Total | Over/Under |
|----------------|-----------|-------------------|--------------|-------|------------|
| dev@example    | 60        | 12                | 36           | 48    | -12        |

Per-Feature allocation (in priority order):
| Feature id | Title    | Stories  | Tasks  | Hours | Assignee |
| #12345     | <title>  | 3        | 8      | 36    | dev@...  |

Per-Bug allocation:
| Bug id     | Title    | Sev | Hours | Assignee |
| #12350     | <title>  | 2   | 4     | dev@...  |

Backlog overflow (NOT allocated to this sprint -- candidates for the next /plan-sprint):
| Item id    | Type     | Title    | Reason                                                    |
| #12347     | Feature  | <title>  | 24h does not fit remaining capacity (12h available)       |
| #12351     | Bug      | <title>  | Predecessor Task #12349 not in this sprint                |

Warnings:
- dev@... is over capacity by 0h (at limit; no buffer for unplanned work)
- Bug #12352 has no estimate -- defer to next sprint or estimate now
```

Use `AskUserQuestion` for the approval gate. Options (nominal-label decision):
- `Approve and allocate`
- `Modify before allocating` -- the CPO names which items to add, drop, or reassign. Apply edits to the proposal and re-present.
- `Cancel` -- exit cleanly with no persistence.

Per the dev-lead's human-authority rule, no state-changing call lands without explicit CPO approval.

### Phase 8: Apply the allocation

On approval, for each Story, Task, and Bug the CPO accepted:

1. Render `operation_templates.work_item_update` to set:
   - `iteration_path` -> the current iteration's `iteration_path`
   - `assigned_to` -> the developer from the proposal (if assignment was requested AND not already set in Phase 6)
2. Execute. Apply changes in dependency-respecting order: Tasks first, then Stories (so a Story's children are all allocated before the Story itself is touched), then Bugs.

If any update fails with a permanent error (illegal field, missing permission), stop and report the partial state -- do not retry destructively. The proposal is the recovery anchor: a re-run reproduces the same proposal and the CPO can re-approve.

**Feature state does NOT change.** Features stay `active` (set by `/decompose-feature`). Sprint allocation is a child-level concern; Features intentionally span sprints.

### Phase 9: Post the allocation audit comment

For each allocated Feature, post one `[STRAP/agent:dev-lead]` comment via `operation_templates.work_item_comment_add`:

> `[STRAP/agent:dev-lead] Sprint allocation (via /plan-sprint): <N> Stories, <M> Tasks moved to <sprint name>. Developer: <assignee>. Remaining backlog Stories/Tasks under this Feature: <K> (next /plan-sprint or /rebalance-sprint).`

For each allocated Bug, post one comment:

> `[STRAP/agent:dev-lead] Sprint allocation (via /plan-sprint): moved to <sprint name>. Severity: <n>. Developer: <assignee>.`

Iteration_path moves on Stories / Tasks themselves are field updates without per-item comments (the per-Feature comment captures the rollup and avoids comment churn on the leaves).

### Phase 10: Report back

Present the final summary to the CPO:

- Sprint name and host iteration path.
- Counts: Features touched, Stories allocated, Tasks allocated, Bugs allocated.
- Developer assignments (or "unchanged" when none was requested).
- Capacity-after-allocation per developer.
- Overflow list with reasons (these survive into the next /plan-sprint run).
- Recommended next step:
  - `/execute-sprint <feature-id>` per allocated Feature to begin implementation.
  - `/fix-bugs <bug-ids>` for the allocated Bugs (or grouped per developer).
  - `/rebalance-sprint` if overflow or warnings need addressing before execution starts.

## Outputs

- All allocated Stories, Tasks, and Bugs updated with the current sprint's `iteration_path`.
- Optional `assigned_to` updates on Feature, child Stories, child Tasks, or Bug as directed.
- One `[STRAP/agent:dev-lead]` allocation comment per touched Feature and per allocated Bug.
- A proposal table presented to the CPO before any write, and a final confirmation summary after.
- The overflow list (carried forward for the next /plan-sprint or /rebalance-sprint).

## Quality gates

The skill is successful when all of the following hold:

- devops-connection.yaml was present and `iteration_list` was supported at pre-flight.
- The current sprint was unambiguously identified (or the CPO disambiguated via `AskUserQuestion`).
- Every allocated Task and Bug had an `original_estimate` populated; no Story / Task was allocated with un-estimated work.
- **Single-sprint constraint honored**: no item was given an iteration_path other than the current sprint's. Overflow items remained unallocated.
- Dependency coherence honored: no Task was allocated whose predecessor stayed in the overflow.
- The CPO approved the proposal before any work item was modified.
- The proposal explicitly flagged any over-allocation, missing estimate, or dependency-blocked item rather than silently rounding or skipping.
- Feature state was NOT modified (Features stay `active`; sprint allocation is a child-level concern).
- Each touched Feature carries a `[STRAP/agent:dev-lead]` allocation audit comment.
- Each allocated Bug carries a `[STRAP/agent:dev-lead]` allocation audit comment.

## Failure handling

- **devops-connection.yaml missing**: stop. Redirect to `/connect-devops-project`.
- **`iteration_list` unsupported**: stop. Surface the host's non-sprint shape; the work flow that follows /plan-sprint does not apply on this host.
- **`iteration_list` returns no current iteration**: stop. Direct the CPO to create the iteration in the host first -- do not invent one.
- **`iteration_list` returns multiple "current" matches**: ask the CPO to disambiguate via `AskUserQuestion`.
- **A Task is missing `original_estimate`**: the parent Feature is held back; the CPO is told which Tasks need estimates. Recommend `/decompose-feature <feature-id>` to add the missing estimates.
- **A Bug is missing `original_estimate`**: surface in the proposal as estimate-needed; the CPO can fix at the gate or defer.
- **A Feature is in state `new`** (not yet decomposed): recommend `/decompose-feature <feature-id>` and skip.
- **A Feature has every child already allocated**: skip with a note ("already in sprint <name>"); recommend `/rebalance-sprint` if reallocation is needed.
- **`operation_templates` rendering produces malformed requests**: surface the failing template path and request body; do not execute.
- **`iteration_get_capacity` unsupported**: fall back to the project-profile.md capacity assumption with the fallback flagged in the proposal.
- **The CPO declines the proposal**: report the declined proposal and stop -- no partial commits.
- **A work-item update fails permanently mid-apply**: stop and report the partial state; the proposal is the recovery anchor for a re-run.

## References

- Source items: `$ARGUMENTS` (optional Feature or Bug id with optional developer assignment).
- sprint-planner role contract: [`../../agents/agent-ops/sprint-planner.md`](../../agents/agent-ops/sprint-planner.md).
- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- dev-lead guardrails: [`../../strap/rules/agents/dev-lead.md`](../../strap/rules/agents/dev-lead.md).
- agent-ops team rules: [`../../strap/rules/agent-ops.md`](../../strap/rules/agent-ops.md) -- human-authority rule, work-item creation standards.
- Project profile (sprint cadence, naming, pair topology, capacity assumptions): [`../../strap/contexts/project-profile.md`](../../strap/contexts/project-profile.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Upstream skills: [`../decompose-feature/SKILL.md`](../decompose-feature/SKILL.md), [`../file-bugs/SKILL.md`](../file-bugs/SKILL.md).
- Sibling skill: [`../rebalance-sprint/SKILL.md`](../rebalance-sprint/SKILL.md) -- the boundary / mid-sprint counterpart.
- Downstream skills: [`../execute-sprint/SKILL.md`](../execute-sprint/SKILL.md), [`../fix-bugs/SKILL.md`](../fix-bugs/SKILL.md).
- Connection-profile schema source-of-truth: [`../connect-devops-project/SKILL.md`](../connect-devops-project/SKILL.md).
