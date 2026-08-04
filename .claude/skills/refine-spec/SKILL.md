---
name: /refine-spec
description: Resume detailed specification on an existing Spec, populate Constituent Parts with technical depth, and drive toward Resolved. Dev-lead dispatches spec-lead section-by-section to research the codebase, surface gaps, and (on CPO approval) drives the Spec to resolved with v2.2 state-transition discipline.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
---

# /refine-spec

## Purpose

Pick up an existing Spec and drive it toward `resolved`. The skill activates the Spec on first refinement (`new -> active`), iterates with the CPO section-by-section to populate each Constituent Part with concrete technical depth, then (on CPO approval) transitions the Spec to `resolved`. A `resolved` Spec is the precondition for `/generate-features`.

Use when the Spec already exists in the host work-tracker. Use `/create-spec` for the initial creation pass.

## Owner

**dev-lead.** spec-lead is dispatched as a serial-Task specialist for assessment + section-by-section research + body updates. The dev-lead owns the CPO conversation, the persistence calls, and the state transitions directly.

## Inputs

- `$ARGUMENTS` -- the work item id of the Spec to refine. Required.
- `.claude/strap/contexts/project-profile.md` -- source of truth for active domains.
- `.claude/strap/state/devops-connection.yaml` -- connection profile. Required fields: `mapping.work_item_types.spec.host_type`, `mapping.field_formats.description`, `mapping.states.{new,active,resolved}`, `mapping.state_asymmetries` (consulted on collapse), `operation_templates.work_item_read`, `operation_templates.work_item_update`, `operation_templates.work_item_comment_add`.
- `.claude/strap/templates/work-items/specification.template.md` -- the completeness-checklist anchor and the body template for updates.

## Workflow

### Phase 1: Read the current state

Render `operation_templates.work_item_read` with `id=$ARGUMENTS`; execute. Capture: title, current state, description, linked items (especially the source Requirement), tags.

Validate the item is logically a `spec` (via `strap:spec` tag or `mapping.work_item_types.spec.host_type` match). Refuse if not.

### Phase 2: Activate if needed

If the current host state is `mapping.states.new`, transition to `mapping.states.active`:

1. Render `operation_templates.work_item_update` with `id`, `state` -> `mapping.states.active`. Apply `strap:active` tag if the host state machine collapses.
2. Post a state-change audit comment via `operation_templates.work_item_comment_add`:

   > `[STRAP/agent:spec-lead] State: new -> active (via /refine-spec). Specification session opened.`

The CPO choosing to refine is the activation signal -- no permission prompt.

### Phase 3: Dispatch spec-lead for assessment

Dispatch spec-lead via `Task` (serial) with read-only tools palette. The brief:

- Read the current Spec body (passed in the prompt).
- Compare against the completeness checklist in `specification.template.md`:
  - Which Constituent Parts have technical depth (real files / services / interfaces / entities)?
  - Which are still stubs?
  - Are Acceptance Criteria specific and testable?
  - Does each section identify its target active domain (per `project-profile.md`'s `Domains` section)?
  - Are dependencies between sections documented?
- Identify the next-priority section to deepen.
- Surface 1-3 probe questions targeting that section.
- Return: section-by-section status (3-5 line summary), recommended next section, probe questions.

### Phase 4: Section-by-section deepening

For each section that needs depth:

1. Dispatch spec-lead with: "Research the codebase for the `<section-name>` Constituent Part of this Spec. Brief: identify the specific files / services / interfaces / entities involved; apply the conventions declared for the `<domain>` domain in project-profile.md; document dependencies on other sections. **Polyrepo umbrellas only:** verify the section heading carries a `[sub-repo: <slug>]` or `[sub-repos: ...]` annotation per the format documented in `specification.template.md`'s Sub-repo intent section. If missing, propose one based on which sub-repo's `Active domains` covers the section's owner agent; if present, validate the slug(s) resolve to entries in `project-profile.md`'s `Sub-repos` section. Cross-sub-repo sections use the multi-slug variant. Return the populated section body (with annotation preserved or added) along with anything that should become a rule or be curated into memory."
2. spec-lead returns the populated section body, including the section heading with annotation (when applicable).
3. Surface findings to the CPO; confirm or adjust. On polyrepo umbrellas, explicitly surface any newly proposed or modified sub-repo annotations.
4. Parse the existing description's metadata table to preserve `authored_by` and `authored_at` (those are creation-time facts).
5. Render the updated `specification.template.md` with the existing `authored_by` / `authored_at`, the deepened section body, and -- on polyrepo umbrellas -- the refreshed `specification.sub_repo_annotation_summary` table.
6. Execute `operation_templates.work_item_update` with `id` + revised `description`.
7. Move to the next section.

### Phase 5: Readiness check on demand

When the CPO asks "is this ready?", run the full completeness checklist from `specification.template.md`:

- All relevant Constituent Parts populated with technical depth (real artifacts named).
- Acceptance Criteria specific and testable; stable IDs preserved.
- Each section identifies its target active domain.
- **Polyrepo umbrellas only:** every Constituent Part section heading carries a `[sub-repo: <slug>]` or `[sub-repos: ...]` annotation; every slug referenced resolves to a current `Sub-repos` entry in `project-profile.md`. Cross-sub-repo sections use the multi-slug variant.
- Dependencies between sections explicit.
- Test Strategy specified per Constituent Part.
- Open Questions all resolved or explicitly deferred.

Present pass/fail item by item. No soft-pedaling.

### Phase 6: Resolve on CPO approval

When the CPO explicitly approves moving to `resolved`:

1. Render `operation_templates.work_item_update` with `state` -> `mapping.states.resolved`. Apply `strap:resolved` tag if needed.
2. Render the description once more with `completed_by` -> `spec-lead (CPO-approved)` and `completed_at` -> ISO-8601 timestamp. Execute another `operation_templates.work_item_update` with the revised description.
3. Post a resolution audit comment:

   > `[STRAP/agent:spec-lead] State: active -> resolved (via /refine-spec). CPO approved at <timestamp>. Ready for /generate-features.`

### Phase 7: Hand-off

- If `resolved` AND the Spec carries at least one client-ui Constituent Part (user-facing scope): recommend `/create-mockups <id>` next. The mockup tier is the pre-decomposition gate for Specs with user-facing scope -- `/generate-features` will refuse to run until the Mockup Wiring Guide section is present on the Spec. The full hand-off chain for user-facing Specs is `/create-mockups <id>` -> `/analyze-mockups <id>` -> `/generate-features <id>`.
- If `resolved` AND the Spec has no client-ui Constituent Part (pure backend / data / infra): recommend `/generate-features <id>` to fan out to Features + decomposition directly.
- If mid-refinement: recommend `/refine-spec <id>` to resume.

## Outputs

- A Spec with every relevant Constituent Part populated with concrete technical depth.
- State transitions recorded both in the host state machine AND as `[STRAP/agent:spec-lead]` comments.
- On resolve: `Completed By: spec-lead (CPO-approved)` + `Completed At: <ts>` in the metadata block; `strap:resolved` tag if applicable.

## Quality gates

- Spec state accurately read at session start.
- The `new -> active` transition happened if needed, with a state-change comment.
- Every populated section names real files / interfaces / components / entities -- no generic placeholders.
- Each section is labeled with its target active domain from `project-profile.md`'s `Domains` section.
- Dependencies between sections are explicit.
- The `authored_by` / `authored_at` from creation were preserved across all updates.
- On resolve: full completeness checklist passed AND CPO explicitly approved.
- Metadata block `completed_by` and `completed_at` populated on resolve.
- spec-lead ran read-only throughout.

## Failure handling

- **Work item not found / not a Spec**: surface; stop.
- **Host state machine rejects a required transition**: surface verbatim; do not retry silently.
- **CPO requests `resolved` but checklist has open items**: refuse; list gaps.
- **A Constituent Part references a domain not in project-profile.md's Domains section**: flag the gap and continue -- the not-yet-active domain will be addressed by `/decompose-feature`'s activation gate.
- **`operation_templates` rendering produces malformed requests**: surface; do not execute.
- **HTML conversion fails**: surface; do not post raw markdown.
- **Cannot parse `authored_by` / `authored_at` from the existing description**: surface to the CPO; ask whether to (a) preserve the metadata block intact by leaving it untouched for this update, (b) backfill with `authored_by: unknown` + current timestamp.

## References

- Source Spec: `$ARGUMENTS` (logical type `spec`).
- spec-lead role contract: [`../../agents/agent-ops/spec-lead.md`](../../agents/agent-ops/spec-lead.md).
- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- Creation skill: [`../create-spec/SKILL.md`](../create-spec/SKILL.md).
- Downstream skill: [`../generate-features/SKILL.md`](../generate-features/SKILL.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Spec template: `.claude/strap/templates/work-items/specification.template.md`.
