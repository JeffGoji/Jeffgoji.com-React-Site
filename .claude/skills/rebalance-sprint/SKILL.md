---
name: /rebalance-sprint
description: Rebalance the current sprint at sprint boundaries or mid-sprint. Detects mode from iteration end_date; calculates velocity in boundary mode; re-projects remaining capacity in mid-sprint mode; moves incomplete items to the next sprint with CPO approval; produces a sprint report at boundaries. The sole authoritative place where cross-sprint flow happens. Dev-lead dispatches sprint-planner serial-Task read-only for the rebalance proposal and velocity calculation; CPO approves; dev-lead persists iteration_path moves and audit comments via the work-tracking connection profile.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
---

# /rebalance-sprint

## Purpose

Re-distribute work in the current sprint when reality has diverged from the plan. The skill handles two scenarios with the same machinery:

- **Sprint boundary rebalance.** Triggered at the end of an iteration to move incomplete items into the next sprint, compute velocity from the last N closed iterations, and emit a sprint report.
- **Mid-sprint rebalance.** Triggered when circumstances change (a developer is unavailable, priorities shift, blockers emerge). Re-projects remaining capacity in the current sprint and shifts items forward.

**/rebalance-sprint is the sole authoritative place where cross-sprint flow happens.** /plan-sprint enforces a strict single-sprint allocation constraint and refuses to pre-allocate into successor sprints. When items don't fit, they stay unallocated until a future /plan-sprint run; when items are allocated but don't get done, /rebalance-sprint is what moves them forward.

The skill never silently moves work. Every transition is proposed, presented to the CPO, and applied only after approval -- per the dev-lead's human-authority discipline.

Use [`/plan-sprint`](../plan-sprint/SKILL.md) instead to allocate decomposed-but-unallocated work into the current sprint.

The skill ships portable. Every adopter-specific concern resolves at runtime:

- Iteration model, capacity, and velocity queries render through `operation_templates.<op>` in `.claude/strap/state/devops-connection.yaml`
- Sprint cadence and naming convention come from `project-profile.md`'s `Conventions` section
- Capacity fallback (when `iteration_get_capacity` is unsupported) reads from `project-profile.md`'s `Conventions` section
- Pair topology framing comes from `project-profile.md`
- State and field mappings come from `mapping.*` in the connection profile
- Carry-over audit lives in `[STRAP/agent:dev-lead]` comments on each moved item's parent Feature (rollup) and on each moved Bug

## Owner

**dev-lead.** sprint-planner is dispatched as a serial-Task specialist for the rebalance proposal + velocity calculation. The dev-lead owns the CPO conversation, the persistence calls, and the (optional) sprint-report authoring directly.

## Inputs

- `$ARGUMENTS` -- optional free-form reason text. Examples: empty (assume routine boundary rebalance), `developer out sick`, `priority shift`, `blocked on infra`. The reason text appears in the proposal and the post-rebalance report.
- `.claude/strap/contexts/project-profile.md` -- source of truth for sprint cadence, naming convention, pair topology, capacity assumptions, and docs publishing convention.
- `.claude/strap/state/devops-connection.yaml` -- work-tracking connection profile. Required fields used by this skill: `mapping.work_item_types.{story,task,bug,feature}.host_type`, `mapping.states.{new,active,resolved,closed}`, `mapping.fields.{original_estimate,completed_work,remaining_work,iteration,assigned_to,area}`, `mapping.field_formats.description`, `operation_templates.{work_item_read,work_item_query,work_item_update,work_item_comment_add,iteration_list,iteration_get_capacity}`, `capabilities.{iteration_list,iteration_get_capacity,work_item_query}`.

## Pre-flight

1. **devops-connection.yaml present.** If missing, redirect to `/connect-devops-project`.
2. **`iteration_list` capability supported.** This skill cannot operate without an iteration model. If `capabilities.iteration_list: unsupported`, stop and surface the gap.

## Workflow

### Phase 1: Detect rebalance mode and identify the current iteration

Render `operation_templates.iteration_list` with `timeframe: current` and execute. Take the single returned iteration; capture `iteration_path`, `start_date`, `end_date`, and display name.

Compare today's date against `end_date`:

- **On or after `end_date`**: **boundary mode**. The skill computes velocity over the last N iterations and produces a sprint report at the end.
- **Before `end_date`**: **mid-sprint mode**. The skill re-projects remaining capacity and skips velocity computation and the sprint report.

Record the mode in the proposal so the CPO sees which scenario the skill is operating under. Surface the reason text from `$ARGUMENTS` (when supplied) in both the proposal and any sprint report.

### Phase 2: Read current sprint state

Render `operation_templates.work_item_query`:

- `types: [<mapping.work_item_types.{story,task,bug}.host_type>]`
- `filters: [{field: iteration_path, op: eq, value: <current iteration path>}]`

Categorize each returned item by current state and progress:

- `mapping.states.resolved` or `mapping.states.closed`: complete; no action needed.
- `mapping.states.active` with progress (`completed_work` > 0 when the field is supported): in flight; assess via remaining-work heuristic.
- `mapping.states.active` with no progress: not started; rebalance candidate.
- `mapping.states.new`: not started; rebalance candidate.
- Blocked (`strap:blocked` tag, or a blocked-state tag declared by the host): flag for CPO; do not auto-move.

When `mapping.fields.completed_work` and `mapping.fields.remaining_work` are declared, use them. When absent, degrade to a binary done/not-done view and flag the limitation in the proposal.

### Phase 3: Identify the next iteration

Render `operation_templates.iteration_list` with `timeframe: future` and select the iteration with the earliest `start_date` strictly after the current iteration's `end_date`.

If no future iteration exists, stop and tell the CPO to create the next iteration in the host first; do not invent one. Carry-over has nowhere to land without an iteration.

### Phase 4: Pull capacity

**Boundary mode**: render `operation_templates.iteration_get_capacity` against the next sprint to project where carry-over lands.

**Mid-sprint mode**: render `operation_templates.iteration_get_capacity` against the current sprint, then derive remaining capacity per developer:

```
remaining_capacity = (end_date - today) * daily_capacity_hours - completed_work
```

Subtract any approved time-off the CPO surfaces interactively.

When `capabilities.iteration_get_capacity: unsupported`, fall back to a flat baseline derived from project-profile.md's `Conventions` section (sprint cadence + daily productive-hours assumption + pair topology). Flag the fallback in the proposal so the CPO sees that capacity is approximate.

### Phase 5: Calculate velocity (boundary mode only)

Render `operation_templates.work_item_query`:

- `types: [<mapping.work_item_types.task.host_type>]`
- `filters: [{field: state, op: eq, value: <mapping.states.resolved>}, {field: iteration_path, op: under, value: <iteration root>}]`
- `order_by: [{field: iteration_path, direction: desc}]`

Aggregate the last three completed iterations to compute:

- Average resolved-Task hours per sprint per developer (velocity baseline).
- Estimate accuracy ratio: sum of `original_estimate` divided by sum of `completed_work`. A ratio far from 1.0 signals systemic over- or under-estimation.
- Velocity trend across the three sprints: accelerating, stable, decelerating.

When `mapping.fields.completed_work` is unsupported, report velocity as item-count-per-sprint instead of hours-per-sprint and flag the limitation.

When fewer than three completed iterations exist in the host history, compute over what's available and flag the small sample.

### Phase 6: Dispatch sprint-planner for the rebalance proposal

Dispatch sprint-planner via `Task` (serial, read-only palette: `Read, Grep, Glob, Bash`). The brief includes:

- The detected mode (boundary or mid-sprint) and the reason text from `$ARGUMENTS`.
- The current iteration (path, dates, name) and next iteration (path, dates, name).
- The categorized current-sprint state (completed / in-progress / not-started / blocked).
- Capacity numbers per developer for the relevant iteration (current remaining in mid-sprint mode; next-sprint available in boundary mode).
- Velocity readings + trend + estimate-accuracy ratio (boundary mode only).
- The pair topology framing from project-profile.md.
- The mandate: propose item-level moves (Story / Task / Bug -> next iteration) with explicit reasons (not started, blocked, over remaining capacity). Do NOT propose moving in-progress items unless the CPO's reason text directs it (a developer being out sick is the canonical case).
- The mandate: when a Feature ends up split across sprints (some children complete, others moved), explicitly flag it so the CPO knows the Feature timeline shifted.
- The required return shape: per-item move recommendations, items staying in current sprint, capacity-after-rebalance per developer for the next sprint, Feature-timeline impact summary, warnings.
- The `tokens_used: ~XXk` finishing-summary line.

sprint-planner returns the proposal; the dev-lead surfaces it to the CPO.

### Phase 7: Present the rebalance proposal and await CPO approval

Render the proposal to the CPO:

```
Mode:   <boundary | mid-sprint>
Reason: <free-form text or "routine">
Sprint: <STRAP-rendered name> (<current iteration path>)
Window: <start_date> -- <end_date> (today: <date>)
Next:   <STRAP-rendered name> (<next iteration path>) <start_date> -- <end_date>

Sprint status:
| Bucket          | Count | Hours |
|-----------------|-------|-------|
| Completed       | 12    | 48    |
| In progress     | 3     | 14    |
| Not started     | 4     | 18    |
| Blocked         | 1     | 6     |

Velocity check (boundary mode):
| Sprint    | Capacity | Completed | Carry-over | Estimate-accuracy |
| Sp 04.A   | 80h      | 64h       | 12h        | 0.92              |
| Sp 04.B   | 80h      | 72h       | 8h         | 0.97              |
| Sp 05.A   | 80h      | 48h       | 22h        | 0.79              |
Trend: decelerating; estimate accuracy degraded sprint over sprint.

Recommended moves to <next sprint>:
| Id     | Type  | Title    | Reason                     | Assignee | Feature impact     |
| #12345 | Task  | <title>  | not started                | dev@...  | parent Feature #11990 timeline +1 sprint |
| #12346 | Bug   | <title>  | blocked (waiting on infra) | dev@...  | n/a                |

Items staying in current sprint:
| Id     | Type  | Title    | Reason                       |
| #12347 | Task  | <title>  | in progress; expected to finish today |
| #12348 | Story | <title>  | high priority; CPO retained  |

Capacity impact on <next sprint>:
| Developer | Available | Carry-over | New available |
| dev@...   | 60h       | 24h        | 36h           |

Warnings:
- Feature #11990 splits across sprints (1 of 3 Stories carries over)
- Blocked item #12346 needs CPO intervention before re-allocation can succeed
- Decelerating velocity trend (Sp 05.A): consider reducing /plan-sprint commitment next iteration
```

Use `AskUserQuestion` for the approval gate. Options (nominal-label decision):
- `Approve and apply`
- `Modify before applying` -- the CPO names items to retain, move, or further investigate. Re-present after edits.
- `Cancel` -- exit cleanly with no persistence.

### Phase 8: Apply the rebalance

On approval, for each item the CPO accepted:

1. Render `operation_templates.work_item_update` to set:
   - `iteration_path` -> the next sprint's `iteration_path`
   - When `remaining_work` differs from `original_estimate` (carry-over partial work) AND `mapping.fields.remaining_work` is supported: update `remaining_work` with the carry-over estimate. Do NOT zero out `original_estimate` -- it stays as the historical record.
2. Execute in dependency-respecting order: Tasks first, then Stories, then Bugs.

### Phase 9: Post rebalance audit comments

For each touched parent Feature, post one `[STRAP/agent:dev-lead]` rollup comment via `operation_templates.work_item_comment_add`:

> `[STRAP/agent:dev-lead] Sprint rebalance (via /rebalance-sprint, mode: <boundary | mid-sprint>): <N> Stories, <M> Tasks moved from <current sprint> to <next sprint>. Reason: <reason>. Feature now split across sprints: <yes | no>.`

For each moved Bug, post one comment:

> `[STRAP/agent:dev-lead] Sprint rebalance (via /rebalance-sprint, mode: <boundary | mid-sprint>): moved from <current sprint> to <next sprint>. Reason: <reason>.`

### Phase 10: Sprint report (boundary mode only)

After applying moves in boundary mode, author the sprint report. Render to a temp file via the `Write` tool (per the agent-devs shell-environment rule, formatted descriptions never go through shell heredocs). The report covers:

- Sprint name, window, mode, reason text.
- Features planned vs completed (count + hours).
- Stories completed vs carried over.
- Tasks completed vs carried over.
- Bugs found and fixed in the sprint.
- Total estimated vs actual hours; estimate-accuracy ratio.
- Velocity reading with trend (per Phase 5).
- Carry-over list with reasons.
- Blockers and resolutions; any Features split across sprints.
- Recommended next steps: `/plan-sprint` for the next iteration, /execute-sprint continuation for in-flight Features.

Present the report to the CPO. When project-profile.md's `Conventions` or `Docs` section declares a sprint-report publishing convention (e.g., tech-writer to an internal wiki, append to a release-notes doc), surface the option to publish via `AskUserQuestion` (publish now / save locally / skip). When no publishing convention is declared, save the report at `.claude/strap/state/sprint-reports/<sprint-name>.md` for the CPO to handle.

### Phase 11: Report back

Present the final summary to the CPO:

- Rebalance mode and reason.
- Counts: items moved, items retained, Features flagged as split.
- Bugs requiring CPO intervention (blocked items not auto-moved).
- Capacity-after-rebalance summary for the next sprint.
- Sprint report status (saved to file / published / skipped) -- boundary mode only.
- Recommended next step:
  - Boundary mode: `/plan-sprint` to top up the next sprint with new decomposed work.
  - Mid-sprint mode: `/execute-sprint <feature-id>` continuation for in-flight Features; `/fix-bugs <bug-ids>` if Bug allocation shifted.

## Outputs

- Per-item `iteration_path` updates moving incomplete work to the next sprint.
- Per-item `remaining_work` updates for carry-over partial work (when supported).
- One `[STRAP/agent:dev-lead]` rebalance comment per touched Feature (rollup) and per moved Bug.
- A proposal table presented to the CPO before any write, and a final confirmation summary after.
- A sprint report at `.claude/strap/state/sprint-reports/<sprint-name>.md` (boundary mode only), optionally published per project-profile.md convention.

## Quality gates

The skill is successful when all of the following hold:

- devops-connection.yaml was present and `iteration_list` was supported at pre-flight.
- The current iteration was unambiguously identified.
- The rebalance mode (boundary vs mid-sprint) was correctly detected from `end_date`.
- A next iteration existed (boundary mode) before any moves were proposed.
- The CPO approved the proposal before any work item was modified.
- Every moved item now points at the next iteration's `iteration_path`.
- Every Feature split across sprints is explicitly flagged in the proposal AND in the per-Feature audit comment.
- In-progress items were not moved unless the CPO's reason text directed it.
- In boundary mode, a sprint report was produced (whether or not it was published).
- Each touched Feature carries a `[STRAP/agent:dev-lead]` rebalance audit comment.
- Each moved Bug carries a `[STRAP/agent:dev-lead]` rebalance audit comment.

## Failure handling

- **devops-connection.yaml missing**: stop. Redirect to `/connect-devops-project`.
- **`iteration_list` unsupported**: stop. Surface the host's non-sprint shape.
- **No current iteration**: stop. Direct the CPO to create the iteration.
- **No next iteration in boundary mode**: stop. Direct the CPO to create the next iteration before re-running.
- **`work_item_query` unsupported**: degrade -- velocity is reported as item counts only; categorization may be coarser. Flag the limitation.
- **`iteration_get_capacity` unsupported**: fall back to project-profile.md capacity assumptions with the fallback flagged in the proposal.
- **`mapping.fields.completed_work` / `remaining_work` unsupported**: degrade to binary done/not-done view; report velocity as item-count instead of hours. Flag in the proposal.
- **Fewer than three completed iterations in boundary-mode velocity**: compute over what's available with the small sample flagged.
- **`operation_templates` rendering produces malformed requests**: surface the failing template path and request body; do not execute.
- **The CPO declines the proposal**: report the declined proposal and stop -- no partial moves.
- **A work-item update fails permanently mid-apply**: stop and report the partial state; the proposal is the recovery anchor for a re-run.
- **The sprint-report publish step fails**: save the report locally and surface the failure; do not block the rebalance completion on report publication.

## References

- Source input: `$ARGUMENTS` (optional reason text).
- sprint-planner role contract: [`../../agents/agent-ops/sprint-planner.md`](../../agents/agent-ops/sprint-planner.md).
- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- dev-lead guardrails: [`../../strap/rules/agents/dev-lead.md`](../../strap/rules/agents/dev-lead.md).
- agent-ops team rules: [`../../strap/rules/agent-ops.md`](../../strap/rules/agent-ops.md) -- human-authority rule, work-item creation standards.
- Project profile (sprint cadence, naming, pair topology, capacity assumptions, docs convention): [`../../strap/contexts/project-profile.md`](../../strap/contexts/project-profile.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Sibling skill: [`../plan-sprint/SKILL.md`](../plan-sprint/SKILL.md) -- the initial allocation skill (single-sprint constraint).
- Downstream skills: [`../execute-sprint/SKILL.md`](../execute-sprint/SKILL.md), [`../fix-bugs/SKILL.md`](../fix-bugs/SKILL.md).
- Connection-profile schema source-of-truth: [`../connect-devops-project/SKILL.md`](../connect-devops-project/SKILL.md).
