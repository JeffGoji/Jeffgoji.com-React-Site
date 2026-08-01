---
name: requirement-template
description: Work item content template for Requirement work items. Consumed by /new-requirement and /refine-requirement. Authored by req-lead from CPO conversation; rendered into the description field with format conversion (markdown to HTML) applied at the boundary per the connection profile's `mapping.field_formats.description`.
---

> Content template for Requirement work items. The skill renders this template with values supplied by `req-lead` and the lifecycle-metadata block populated by the dev-lead at persistence time. Sections marked with placeholder blocks are populated from the CPO refinement conversation. Sections without populated content MUST be marked explicitly as needing refinement -- never silently omitted, never fabricated.

| Field        | Value                       |
|--------------|-----------------------------|
| Authored By  | {{ authored_by }}           |
| Authored At  | {{ authored_at }}           |
| Completed By | {{ completed_by }}          |
| Completed At | {{ completed_at }}          |

---

# {{ requirement.title }}

## Problem Statement

What problem does this Requirement solve, who is affected, and why does it matter now? Describe the pain in concrete terms. Quote customers or operators where possible. Avoid solution language; the focus here is the problem, not the fix.

{{ requirement.problem }}

## Business Justification

Why is this worth doing? Capture the cost of inaction (revenue, churn, operational overhead, compliance risk) and the value of solving (efficiency, retention, growth, regulatory posture). Include how success will be measured at the business level -- this informs the Success Criteria below but lives at a higher altitude.

{{ requirement.justification }}

## Success Criteria

What outcomes mean this Requirement is "done"? Each criterion MUST be measurable and observable -- a downstream agent reading this section should be able to derive at least one testable Acceptance Criterion from each entry. Use stable identifiers (`SC-001`, `SC-002`, ...) so the Spec can map Acceptance Criteria back to specific Success Criteria.

{{ requirement.success_criteria }}

## Stakeholders

Who needs to weigh in on this Requirement? Identify the roles, not just the named individuals -- named individuals change but roles persist. The product owner is the CPO by convention; list additional stakeholders whose input or sign-off is required (engineering leads, security, compliance, ops, customer-facing teams, integration partners).

{{ requirement.stakeholders }}

## Open Questions

Issues `req-lead` surfaced during refinement that the CPO must resolve before this Requirement can be moved to `resolved`. Each entry should be tagged with a stable identifier (`Q-001`, `Q-002`, ...), the date raised, and the owner expected to answer.

When a question is resolved, mark it with the answer and the resolution date in the Refinement History section rather than deleting it -- the audit trail matters downstream.

{{ requirement.open_questions }}

## Existing System Context

What already exists in the codebase, the host tool, or the operational environment that relates to this Requirement? Captured by `req-lead` during refinement using `Glob` and `Grep` over the project source tree. This section documents WHAT exists; it does NOT propose architecture or prescribe implementation.

{{ requirement.existing_system_context }}

## Scope

### In Scope

What this Requirement covers. Sharp boundaries here prevent scope creep during specification.

{{ requirement.in_scope }}

### Out of Scope

What this Requirement explicitly does NOT cover, even if related. Items here protect against scope drift and signal where sibling Requirements may be warranted.

{{ requirement.out_of_scope }}

## Constraints

Platform, timeline, compliance, integration, or operational constraints the Spec must respect. Constraints are guardrails, not goals.

{{ requirement.constraints }}

## Refinement History

Append-only audit trail of meaningful changes during refinement. Each entry includes date, action, and a short description.

{{ requirement.refinement_history }}

## Quality Checklist

`req-lead`'s drive-to-Resolved gates. Every box must be checkable before recommending the Requirement for `resolved`. Incomplete Requirements produce bad Specs, which produce bad Features.

- [ ] Problem Statement is specific: who is affected, what they do today, what the pain costs.
- [ ] Business Justification names a measurable value or cost-of-inaction.
- [ ] Success Criteria are observable and measurable -- each entry has a stable ID and is specific enough to derive a testable Acceptance Criterion.
- [ ] Stakeholders are identified by role; the product-owner role is named.
- [ ] Scope boundaries are sharp -- both In Scope and Out of Scope are populated.
- [ ] Existing System Context documents what already exists in the codebase or environment.
- [ ] Constraints are captured (platform, timeline, compliance, integration).
- [ ] No implementation prescription -- no file names, class names, technology choices, or architectural decisions appear in any section.
- [ ] Every Open Question is resolved or explicitly deferred with CPO approval recorded in Refinement History.
- [ ] Refinement History captures the meaningful changes that brought this Requirement to its current state.
