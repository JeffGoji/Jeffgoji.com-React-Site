---
name: /new-requirement
description: Create a new Requirement work item from a raw idea and begin iterative refinement with the CPO. Dev-lead dispatches req-lead to author the initial Requirement body + probe questions, applies v2.2 lifecycle metadata + tags at persistence time, then drives the first refinement pass conversationally.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
---

# /new-requirement

## Purpose

Convert a raw idea, customer need, or business problem from the CPO into a structured Requirement work item, then start the iterative refinement loop that drives the Requirement toward `resolved`.

Invoke when the CPO has unshaped input that needs to become a spec-ready Requirement. Use `/refine-requirement` when the Requirement already exists.

## Owner

**dev-lead.** req-lead is dispatched as a serial-Task specialist for initial body authoring + first-pass probe-question generation. The dev-lead owns persistence (metadata blocks, tags, host calls), the CPO conversation, and state transitions directly.

## Inputs

- `$ARGUMENTS` -- the CPO's raw input describing the idea, problem, or need. Free-form prose. Required.
- `.claude/strap/contexts/project-profile.md` -- project context that grounds req-lead's authoring.
- `.claude/strap/state/devops-connection.yaml` -- connection profile. Required fields: `mapping.work_item_types.requirement.host_type`, `mapping.field_formats.description`, `mapping.states.new`, `mapping.default_parents.requirement`, `operation_templates.work_item_create`, `operation_templates.work_item_update`, `operation_templates.work_item_comment_add`.
- `.claude/strap/templates/work-items/requirement.template.md` -- Requirement description body template.

## Workflow

### Phase 1: Dispatch req-lead for initial authoring

Dispatch req-lead via `Task` (serial -- no CreateTeam) with read-only tools palette (`Read, Grep, Glob, Bash`). The brief:

- Derive a candidate title from `$ARGUMENTS`. Action-oriented, scoped, no marketing language.
- Survey the codebase for related existing features, services, entities, UI components (the "Existing System Context" section in the Requirement template). Use Glob and Grep over the project source tree. Capture WHAT exists; do not propose architecture (that is Spec territory).
- Compose the Requirement body content matching the placeholder structure of `requirement.template.md`. Populate sections that can be populated from `$ARGUMENTS`; explicitly mark sections needing refinement.
- Surface 5-10 probe questions for the CPO, prioritized by criticality. Typical top-priority gaps: Problem Statement clarity, Stakeholders, Success Criteria.
- Return: title candidate, content placeholders, gap list, probe questions, anything that should become a rule or be curated into memory.

### Phase 2: Title confirmation

Surface the candidate title to the CPO via `AskUserQuestion`. Options: `Approve`, `Modify (free-text rewrite)`, `Reject and re-dispatch`.

### Phase 3: Persistence

On title approval:

1. **Render the description body** using `requirement.template.md`. The template embeds the v2.2 lifecycle-metadata block via Mustache placeholders. Pass:
   - `authored_by` -> `req-lead`
   - `authored_at` -> ISO-8601 timestamp at the moment of persistence
   - `completed_by` -> `_(set at resolution)_`
   - `completed_at` -> `_(set at resolution)_`
   - Plus the req-lead-supplied placeholders (`requirement.title`, `requirement.problem`, `requirement.justification`, `requirement.success_criteria`, `requirement.stakeholders`, `requirement.open_questions`, `requirement.existing_system_context`, `requirement.in_scope`, `requirement.out_of_scope`, `requirement.constraints`, `requirement.refinement_history`).

2. **Convert markdown to HTML at the boundary** if `mapping.field_formats.description` is `html`; pass through if `markdown`.

3. **Render `operation_templates.work_item_create`** with placeholders:
   - `{{host_type}}` -> `mapping.work_item_types.requirement.host_type`
   - `{{title}}` -> CPO-confirmed title
   - `{{description}}` -> rendered body
   - `{{parent_id}}` -> resolved from `mapping.default_parents.requirement` per the three-state semantic (introduced in v2.4 Step 5c of `/connect-devops-project`):
     - **integer id**: auto-parent the new Requirement under that Epic (typical when adopter chose "Create new STRAP Epics" or "Use existing Epics" at onboarding)
     - **explicit `~` / null**: CPO chose top-level filing at onboarding; SKIP the parent link entirely and file the Requirement as top-level (do NOT re-prompt for an ad-hoc parent)
     - **key missing entirely** (legacy / pre-Step-5c install): surface the gap per the existing failure-handling and ask the CPO ad-hoc for a parent id OR confirmation to file top-level
   - `{{area_path}}` -> per profile or as overridden by the CPO
   - `{{state}}` -> `mapping.states.new`
   - `{{tags}}` -> `AI; strap:requirement`

4. Execute via the connection profile's transport. Capture the host id.

5. **Post a creation audit comment** via `operation_templates.work_item_comment_add`:

   > `[STRAP/agent:req-lead] Authored from /new-requirement. Initial state: new. Probe questions surfaced: <N>.`

### Phase 4: First refinement pass

Surface the first 1-2 probe questions to the CPO directly (no AskUserQuestion -- this is conversational). Apply the conversational discipline: never a wall of questions; one or two at a time.

When the CPO answers:

1. Dispatch req-lead with: "Update the Requirement body for these CPO answers: <answers>. Append a Refinement History entry. Surface the next-priority gap or question."
2. Render the updated template (preserving the existing `authored_by` / `authored_at` -- those are creation-time facts).
3. Execute `operation_templates.work_item_update` with `id` + revised `description`.
4. Continue iteratively.

If the CPO signals "stop for now," the skill ends with the Requirement in `new` state and the CPO can resume via `/refine-requirement <id>`.

### Phase 5: Hand-off

Report the Requirement id, the confirmed title, the section status (populated / partial / refinement-needed), the open probe questions, and the recommended next step:

- If refinement complete in this session: `/refine-requirement <id>` to drive to `resolved`, then `/create-spec <id>`.
- If refinement ongoing: `/refine-requirement <id>` to resume.

## Outputs

- A new Requirement work item under `mapping.default_parents.requirement`, in `mapping.states.new`.
- Lifecycle-metadata block at the top of the description (`Authored By: req-lead`).
- Tags `AI; strap:requirement` at creation.
- A `[STRAP/agent:req-lead]` audit comment recording the creation.
- A first-pass set of refinement questions delivered to the CPO conversationally.

## Quality gates

- A work item was created and the host id was captured.
- The description renders cleanly (no broken markdown / HTML).
- Every section that wasn't populated was explicitly marked as `_(needs refinement)_` -- no silent assumptions.
- `AI` and `strap:requirement` tags present at creation.
- Metadata block populated with `Authored By: req-lead` and the creation timestamp.
- A creation audit comment was posted.
- req-lead ran read-only -- production code was not modified.

## Failure handling

- **`mapping.default_parents.requirement` key missing entirely** (legacy / pre-v2.4 install): surface the gap; ask the CPO whether to specify ad-hoc for this run OR re-run `/connect-devops-project` Step 5c to set durably for the install. **Distinct from explicit-null** -- when the key is present with value `~` / null, that's a deliberate top-level-filing choice from onboarding; honor it without re-prompting.
- **`operation_templates` rendering produces malformed requests**: surface the failing template + body; do not execute.
- **HTML conversion fails for a markdown body**: surface the offending content; do not post raw markdown into an HTML-flavored field.
- **CPO declines all proposed titles and offers no replacement**: stop; do not invent a title.
- **req-lead's initial body has zero populated content**: signal that `$ARGUMENTS` was too thin; surface to the CPO and ask for more input rather than persisting an all-stub Requirement.
- **`work_item.create` returns a transient error with no confirmation**: render `operation_templates.work_item_query` against parent + title before retrying (avoids duplicates).

## References

- Source CPO input: `$ARGUMENTS`.
- req-lead role contract: [`../../agents/agent-ops/req-lead.md`](../../agents/agent-ops/req-lead.md).
- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- Continuation skill: [`../refine-requirement/SKILL.md`](../refine-requirement/SKILL.md).
- Downstream skill: [`../create-spec/SKILL.md`](../create-spec/SKILL.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Requirement template: `.claude/strap/templates/work-items/requirement.template.md`.
- Connection-profile schema source-of-truth: [`../connect-devops-project/SKILL.md`](../connect-devops-project/SKILL.md).
