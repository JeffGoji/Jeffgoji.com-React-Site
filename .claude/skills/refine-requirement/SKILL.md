---
name: /refine-requirement
description: Resume iterative refinement on an existing Requirement work item and drive it toward Resolved. Dev-lead dispatches req-lead to assess gaps, generate probe questions, and (on CPO approval) drives the Requirement to resolved with v2.2 state-transition discipline.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
---

# /refine-requirement

## Purpose

Pick up an existing Requirement and drive it toward `resolved`. The skill activates the Requirement on first refinement (`new -> active`), iterates with the CPO until the quality checklist passes, then (on CPO approval) transitions the Requirement to `resolved`.

Use when the Requirement already exists in the host work-tracker. Use `/new-requirement` for the initial creation pass.

## Owner

**dev-lead.** req-lead is dispatched as a serial-Task specialist for assessment + probe-question generation + body updates. The dev-lead owns the CPO conversation, the persistence calls, and the state transitions directly.

## Inputs

- `$ARGUMENTS` -- the work item id of the Requirement to refine. Required.
- `.claude/strap/contexts/project-profile.md` -- project context.
- `.claude/strap/state/devops-connection.yaml` -- connection profile. Required fields: `mapping.work_item_types.requirement.host_type`, `mapping.field_formats.description`, `mapping.states.{new,active,resolved}`, `mapping.state_asymmetries` (consulted if the host state machine collapses), `operation_templates.work_item_read`, `operation_templates.work_item_update`, `operation_templates.work_item_comment_add`.
- `.claude/strap/templates/work-items/requirement.template.md` -- the quality-checklist anchor and the body template for updates.

## Workflow

### Phase 1: Read the current state

Render `operation_templates.work_item_read` with `id=$ARGUMENTS`; execute. Capture: title, current state, description, linked items, tags.

Validate the item is logically a `requirement` (via `strap:requirement` tag or `mapping.work_item_types.requirement.host_type` match). Refuse if not.

### Phase 2: Activate if needed

If the current host state is `mapping.states.new`, transition to `mapping.states.active` (or to the state_asymmetries collapse if the host state machine can't represent `active` for this type):

1. Render `operation_templates.work_item_update` with `id`, `state` -> `mapping.states.active`. When the host collapses (e.g., ADO Issue type has no native `active` distinct from `new`), apply the `strap:active` tag as the logical-state fallback.
2. Post a state-change audit comment via `operation_templates.work_item_comment_add`:

   > `[STRAP/agent:req-lead] State: new -> active (via /refine-requirement). Refinement session opened.`

The CPO choosing to refine is the activation signal -- no permission prompt for this transition.

### Phase 3: Dispatch req-lead for assessment

Dispatch req-lead via `Task` (serial) with read-only tools palette. The brief:

- Read the current Requirement body (passed in the prompt).
- Compare against the quality checklist in `requirement.template.md`:
  - Which sections are populated vs partial vs stub?
  - Which Open Questions are unresolved?
- Identify the next-priority gap to address.
- Surface 1-3 probe questions targeting that gap.
- Return: section-by-section status (3-5 line summary), recommended next gap, probe questions.

### Phase 4: Status summary + refinement conversation

Surface req-lead's status summary to the CPO. Then ask the next-priority probe question conversationally (no AskUserQuestion -- the discipline is one or two questions at a time).

When the CPO answers:

1. Dispatch req-lead with: "Update the Requirement body for these answers: <answers>. Append a Refinement History entry. Surface the next gap."
2. Parse the existing description's metadata table to preserve `authored_by` and `authored_at` (those are creation-time facts and stay immutable).
3. Render the updated `requirement.template.md` with the existing `authored_by` / `authored_at` and the new body content.
4. Execute `operation_templates.work_item_update` with `id` + revised `description`.
5. Continue iteratively.

### Phase 5: Readiness check on demand

When the CPO asks "is this ready?", run the full quality checklist from `requirement.template.md`:

- Problem Statement specific.
- Business Justification names measurable value or cost-of-inaction.
- Success Criteria observable + measurable + stable-IDed.
- Stakeholders identified by role.
- Scope boundaries sharp on both sides.
- Existing System Context populated.
- Constraints captured.
- No implementation prescription.
- Open Questions all resolved or explicitly deferred.
- Refinement History captures the change trail.

Present pass/fail item by item. No soft-pedaling.

### Phase 6: Resolve on CPO approval

When the CPO explicitly approves moving to `resolved`:

1. Render `operation_templates.work_item_update` with `id`, `state` -> `mapping.states.resolved`. Apply `strap:resolved` tag if the host state machine collapses resolved into closed (per `mapping.state_asymmetries`).
2. Render the description one more time with `completed_by` -> `req-lead (CPO-approved)` and `completed_at` -> ISO-8601 timestamp. Execute another `operation_templates.work_item_update` with the revised description.
3. Post a resolution audit comment:

   > `[STRAP/agent:req-lead] State: active -> resolved (via /refine-requirement). CPO approved at <timestamp>. Ready for /create-spec.`

### Phase 7: Hand-off

- If the Requirement is now `resolved`: recommend `/create-spec <id>` as the next step.
- If the session ended mid-refinement: recommend re-invoking `/refine-requirement <id>` to resume.

## Outputs

- An updated Requirement with incrementally refined description, every CPO answer reflected.
- Refinement History entries capturing each meaningful change.
- State transitions recorded both in the host state machine AND as `[STRAP/agent:req-lead]` comments.
- On resolve: `Completed By: req-lead (CPO-approved)` + `Completed At: <ts>` in the metadata block; `strap:resolved` tag if applicable.

## Quality gates

- The Requirement state was accurately read at the start of the session.
- The `new -> active` transition happened if needed, with a state-change comment.
- Every CPO answer was reflected in the description, not just the conversation.
- Refinement History captures the change trail.
- The `authored_by` / `authored_at` from creation were preserved across all updates.
- On resolve: full quality checklist passed AND CPO explicitly approved.
- Metadata block `completed_by` and `completed_at` populated on resolve.
- req-lead ran read-only throughout.

## Failure handling

- **Work item not found / not a Requirement**: surface; stop.
- **Host state machine rejects a required transition**: surface verbatim; do not retry silently.
- **CPO requests `resolved` but checklist has open items**: refuse; list the gaps.
- **`operation_templates` rendering produces malformed requests**: surface; do not execute.
- **HTML conversion fails**: surface; do not post raw markdown into an HTML-flavored field.
- **Cannot parse `authored_by` / `authored_at` from the existing description**: the metadata block was tampered with or the item predates v2.2. Surface to the CPO; ask whether to (a) preserve as-is by leaving the metadata block intact for this update, (b) backfill with `authored_by: unknown` + the current timestamp.

## References

- Source Requirement: `$ARGUMENTS` (logical type `requirement`).
- req-lead role contract: [`../../agents/agent-ops/req-lead.md`](../../agents/agent-ops/req-lead.md).
- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- Creation skill: [`../new-requirement/SKILL.md`](../new-requirement/SKILL.md).
- Downstream skill: [`../create-spec/SKILL.md`](../create-spec/SKILL.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Requirement template: `.claude/strap/templates/work-items/requirement.template.md`.
