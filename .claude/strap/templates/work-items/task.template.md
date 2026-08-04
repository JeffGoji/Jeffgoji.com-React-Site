---
name: task-template
description: Work item content template for Task work items. Consumed by /decompose-feature. Authored by domain agents and reconciled by dev-lead; rendered with format conversion applied at the boundary per the connection profile's `mapping.field_formats.description`. Original Estimate is mandatory per agent-devs rules.
---

> Content template for Task work items. Each Task is the smallest unit of decomposition -- minimum 3 hours of senior-developer effort, maximum 4 Tasks per parent Story (sizing guardrails per `/decompose-feature`). Tasks group tightly-coupled artifacts: tests live inside the implementation Task that creates the code under test, except E2E and dedicated load tests. The Original Estimate field is REQUIRED on every Task. The lifecycle-metadata block is populated by the dev-lead at persistence time.

| Field        | Value                       |
|--------------|-----------------------------|
| Authored By  | {{ authored_by }}           |
| Authored At  | {{ authored_at }}           |
| Completed By | {{ completed_by }}          |
| Completed At | {{ completed_at }}          |

---

# {{ task.title }}

## Description

What this Task delivers. One or two paragraphs at most -- a Task that needs more description than that probably wants to be split.

{{ task.description }}

## Linked Story

The parent Story this Task is decomposed under. The Task is parented to the Story in the host tool -- this section names the Story for human readers.

**Story:** {{ task.linked_story }}

## Original Estimate

Senior-developer hours required to deliver this Task. MANDATORY per agent-devs rules. Minimum 3 hours; Tasks below that threshold are folded into adjacent Tasks during `dev-lead` reconciliation. The estimate is persisted to the host field declared at `mapping.fields.original_estimate` via the connection profile's `operation_templates.work_item_create`.

**Hours (senior-developer):** {{ task.original_estimate_hours }}

## Implementation guidance

Specific approach hints from `dev-lead`'s decomposition: which file(s) to modify, which patterns from the agent-devs rules apply, which existing components to extend, which test cases the implementation must cover, any mockup-as-contract fidelity rules that apply. The assigned domain agent uses this as the starting point; it does not relitigate decomposition.

{{ task.implementation_guidance }}

## Dependencies

Other Tasks (within or across Stories) this Task depends on. Cross-Task dependencies are persisted as `predecessor`/`successor` links by `/decompose-feature` or surfaced for the assigned developer to satisfy in execution order.

{{ task.dependencies }}

## Definition of Done

Testable outcome criteria for this specific Task. Distinct from the parent Story's Acceptance Criteria -- the DoD is the Task-level signal that the Task is complete and ready for review. Examples: code compiles and the agent-devs build command succeeds locally, the unit tests added by this Task pass, the documented interface change is reflected in any consumer Tasks' implementation guidance, the migration runs forward and reverse cleanly.

{{ task.definition_of_done }}

## Quality Checklist

Gates `dev-lead` verifies during reconciliation before persisting the Task.

- [ ] Description fits in one or two paragraphs -- larger descriptions signal a Task that should be split.
- [ ] Linked Story is correctly populated.
- [ ] Original Estimate is set and at least 3 hours of senior-developer effort.
- [ ] Implementation guidance names real files, components, or interfaces -- no generic placeholders.
- [ ] Dependencies are explicit and persisted as adapter links where cross-Task.
- [ ] Definition of Done lists testable outcomes specific to this Task.
- [ ] Tightly-coupled artifacts (code + its unit tests) are grouped into this single Task per the sizing guardrails.
