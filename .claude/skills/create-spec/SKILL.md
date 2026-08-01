---
name: /create-spec
description: Create a new Spec work item from a Resolved Requirement and stage it for detailed specification. Dev-lead dispatches spec-lead to author the initial Spec outline grounded in codebase research and project-profile.md's active domains, applies v2.2 lifecycle metadata + tags at persistence time, and links the Spec to its source Requirement.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
---

# /create-spec

## Purpose

Promote an approved Requirement into a Spec work item that captures the technical depth needed for downstream Feature generation and decomposition. The skill creates the Spec, links it to the parent Requirement via the `related` link type, derives an initial Constituent Parts outline from active domains in `project-profile.md`, and hands off to `/refine-spec` for the detailed specification phase.

Invoke once a Requirement has been driven to `resolved` and the CPO is ready to begin specification.

## Owner

**dev-lead.** spec-lead is dispatched as a serial-Task specialist for Spec outline authoring and initial Constituent Parts mapping. The dev-lead owns persistence, the CPO conversation, and state transitions directly.

## Inputs

- `$ARGUMENTS` -- the work item id of the Resolved Requirement.
- `.claude/strap/contexts/project-profile.md` -- source of truth for active domains and their owning specialists.
- `.claude/strap/state/devops-connection.yaml` -- connection profile. Required fields: `mapping.work_item_types.spec.host_type`, `mapping.field_formats.description`, `mapping.states.new`, `mapping.default_parents.spec`, `mapping.link_types.related`, `operation_templates.work_item_read`, `operation_templates.work_item_create`, `operation_templates.work_item_link_add`, `operation_templates.work_item_comment_add`.
- `.claude/strap/templates/work-items/specification.template.md` -- Spec description body template.

## Workflow

### Phase 1: Read the source Requirement

Render `operation_templates.work_item_read` with `id=$ARGUMENTS`; execute. Capture: title, current state, description, linked items, tags.

Validate the item is logically a `requirement` AND in `mapping.states.resolved` (or carries the `strap:resolved` tag if the host state machine collapsed). If not:

- Surface the gap (current state vs required).
- Recommend `/refine-requirement <id>` to drive to resolved.
- Stop.

### Phase 2: Dispatch spec-lead for outline authoring

Dispatch spec-lead via `Task` (serial -- no CreateTeam) with read-only tools palette (`Read, Grep, Glob, Bash`). The brief:

- Read the Requirement description (passed in the prompt) including Success Criteria, Stakeholders, Existing System Context, Scope, Constraints.
- Read `project-profile.md`'s `Domains` section to learn which canonical domains are active and their stack particulars.
- Survey the codebase using Glob and Grep to identify specific files, services, components, entities relevant to the Requirement.
- Derive a Spec title (action-oriented; typically references the Requirement title with a contextual prefix or suffix). Confirm with the CPO if uncertain.
- Map each Requirement Success Criterion to one or more preliminary Acceptance Criteria with stable IDs (`AC-001`, `AC-002`, ...).
- Build the Constituent Parts outline: which sections (`client-ui`, `api`, `core`, `data`, `infrastructure`, `integrations`, etc.) are in scope for this Spec. Each section is labeled with the active domain that owns it.
- **Polyrepo annotation (polyrepo umbrellas only).** If `project-profile.md` carries a populated `Sub-repos` section with the current schema sentinel, annotate each Constituent Part section heading with `[sub-repo: <slug>]` or `[sub-repos: <slug-a>, <slug-b>]` per the format documented in `specification.template.md`'s Sub-repo intent section. Suggest each annotation by matching the Constituent Part's owner agent type against each sub-repo's `Active domains` field -- the sub-repo whose `Active domains` includes the owner agent is the natural target. Cross-sub-repo Parts (e.g., a DTO contract section consumed by web-frontend AND api-backend) use the multi-slug variant. Surface the suggested annotations to the CPO for confirmation. Single-repo umbrellas (empty or absent `Sub-repos` section) skip the annotation step entirely; absence of annotations IS the single-repo signal.
- Compose the Spec body content matching the placeholder structure of `specification.template.md`. Each Constituent Part section is a stub awaiting refinement in `/refine-spec`.
- Flag any Spec section that implies a domain not yet active in `project-profile.md`'s `Domains` section -- forward-reference that the `/decompose-feature` activation gate will surface this later.
- Return: title candidate, content placeholders (per the template), Constituent Parts outline, AC mapping, not-yet-active-domain flags, polyrepo annotation set (when applicable), anything that should become a rule or be curated into memory.

### Phase 3: Title confirmation

Surface the candidate title to the CPO via `AskUserQuestion`. Options: `Approve`, `Modify (free-text rewrite)`, `Reject and re-dispatch`.

### Phase 4: Persistence

On title approval:

1. **Render the description body** using `specification.template.md`. Pass:
   - `authored_by` -> `spec-lead`
   - `authored_at` -> ISO-8601 timestamp at the moment of persistence
   - `completed_by` -> `_(set at resolution)_`
   - `completed_at` -> `_(set at resolution)_`
   - `mockups_in_play` -> boolean; true when the client-ui domain entry in `project-profile.md` declares mockup paths AND the Spec touches the client-ui domain
   - `polyrepo_umbrella` -> boolean; true when `project-profile.md` carries a populated `Sub-repos` section with the current schema sentinel (`<!-- strap-schema: sub-repos-v2.4 -->` or above). When true, every Constituent Part section heading in the Spec body MUST carry a `[sub-repo: <slug>]` or `[sub-repos: ...]` annotation.
   - `specification.sub_repo_annotation_summary` -> when `polyrepo_umbrella`, a markdown table mapping each Constituent Part to its annotated sub-repo(s) with one row per Part; otherwise omitted by the conditional in the template.
   - Plus the spec-lead-supplied placeholders (`specification.title`, `specification.overview`, `specification.linked_requirement`, `specification.constituent_parts`, `specification.constituent_part_details`, `specification.acceptance_criteria`, `specification.mockup_paths` / `specification.mockup_wiring_table` / `specification.mockup_gaps` when `mockups_in_play`, `specification.assembly_order`, `specification.test_strategy`, `specification.dependencies`, `specification.open_questions`).

2. **Convert markdown to HTML at the boundary** per `mapping.field_formats.description`.

3. **Render `operation_templates.work_item_create`** with placeholders:
   - `{{host_type}}` -> `mapping.work_item_types.spec.host_type`
   - `{{title}}` -> CPO-confirmed title
   - `{{description}}` -> rendered body
   - `{{parent_id}}` -> resolved from `mapping.default_parents.spec` per the three-state semantic (introduced in v2.4 Step 5c of `/connect-devops-project`):
     - **integer id**: auto-parent the new Spec under that Epic
     - **explicit `~` / null**: CPO chose top-level filing at onboarding; SKIP the parent link entirely and file the Spec as top-level (do NOT re-prompt)
     - **key missing entirely** (legacy / pre-Step-5c install): surface the gap and ask ad-hoc per existing failure-handling
   - `{{area_path}}` -> per profile
   - `{{state}}` -> `mapping.states.new`
   - `{{tags}}` -> `AI; strap:spec`

4. Execute via the connection profile's transport. Capture the host id.

5. **Link to the source Requirement.** Render `operation_templates.work_item_link_add` with:
   - `{{source_id}}` -> the new Spec's host id
   - `{{target_id}}` -> `$ARGUMENTS` (the Requirement id)
   - `{{link_type}}` -> `mapping.link_types.related`

6. **Post a creation audit comment** via `operation_templates.work_item_comment_add`:

   > `[STRAP/agent:spec-lead] Spec authored from /create-spec on Requirement <req-id>. Initial state: new. Constituent Parts outlined: <count>. Not-yet-active domains flagged: <list or none>.`

### Phase 5: Present the outline + hand-off

Present to the CPO:

- Spec id and title
- Constituent Parts in scope, with the active domain that owns each
- On polyrepo umbrellas: the per-Part sub-repo annotation summary (which Constituent Parts target which sub-repo(s))
- Preliminary AC mapping (Requirement Success Criterion -> Acceptance Criterion)
- Not-yet-active-domain flags, if any (forward-reference that `/decompose-feature` will trigger the activation gate)
- Areas where the Requirement leaves room for interpretation that need CPO input during `/refine-spec`
- Recommended next step: `/refine-spec <spec-id>` to populate Constituent Parts with technical depth

## Outputs

- A new Spec work item under `mapping.default_parents.spec`, in `mapping.states.new`.
- A `related` link to the source Requirement.
- Lifecycle-metadata block at the top of the description (`Authored By: spec-lead`).
- Tags `AI; strap:spec` at creation.
- A `[STRAP/agent:spec-lead]` audit comment recording the creation.

## Quality gates

- The Requirement was in `resolved` state when the skill ran.
- The Spec was created with the host id captured.
- The Spec is linked `related` to the source Requirement.
- The Constituent Parts outline references domains that are either already active in `project-profile.md` or explicitly flagged as not-yet-active.
- Every Requirement Success Criterion has at least one preliminary Acceptance Criterion mapped to it.
- `AI` and `strap:spec` tags present.
- Metadata block populated with `Authored By: spec-lead` and the creation timestamp.
- A creation audit comment was posted.
- spec-lead ran read-only.

## Failure handling

- **Requirement not in `resolved`**: refuse; recommend `/refine-requirement <id>`.
- **`mapping.default_parents.spec` key missing entirely** (legacy / pre-v2.4 install): surface the gap; ask the CPO to specify ad-hoc OR re-run `/connect-devops-project` Step 5c. **Distinct from explicit-null** -- when the key is present with value `~` / null, file the Spec top-level without re-prompting.
- **A Constituent Part references a domain not in project-profile.md's Domains section**: flag the gap and proceed -- `/decompose-feature` will hit the activation gate later. Do not refuse on this alone.
- **`operation_templates` rendering produces malformed requests**: surface; do not execute.
- **HTML conversion fails**: surface; do not post raw markdown into an HTML-flavored field.
- **No active domain matches any Spec section**: produce a single-section "to-be-decomposed" Spec rather than fabricating sections; surface to the CPO.
- **`work_item.create` returns a transient error with no confirmation**: render `operation_templates.work_item_query` against parent + title before retrying.

## References

- Source Requirement: `$ARGUMENTS` (logical type `requirement`, state `resolved`).
- spec-lead role contract: [`../../agents/agent-ops/spec-lead.md`](../../agents/agent-ops/spec-lead.md).
- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- Continuation skill: [`../refine-spec/SKILL.md`](../refine-spec/SKILL.md).
- Downstream skill: [`../generate-features/SKILL.md`](../generate-features/SKILL.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Spec template: `.claude/strap/templates/work-items/specification.template.md`.
- Prerequisite skill: [`../refine-requirement/SKILL.md`](../refine-requirement/SKILL.md).
