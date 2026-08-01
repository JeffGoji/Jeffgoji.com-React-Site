---
name: /generate-features
description: Generate Features from a Resolved Spec, then orchestrate decomposition into Stories and Tasks. Dev-lead dispatches spec-lead to author Feature briefs, applies v2.2 lifecycle metadata + tags at persistence time, then per-Feature invokes /decompose-feature to drive decomposition.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
---

# /generate-features

## Purpose

Take a Resolved Spec to a populated backlog. The skill runs three phases:

1. **Phase A.** Dispatch spec-lead to author Feature (and Enhancement, when supported by the host) briefs. Dev-lead applies the v2.2 lifecycle-metadata block, `AI` tag, and `strap:feature` (or `strap:enhancement`) tag at persistence time.
2. **Phase B.** For each Feature created in Phase A, invoke `/decompose-feature`. The activation gate inside `/decompose-feature` handles any new domains the Spec requires.
3. **Phase C.** Summary report to the CPO.

## Owner

**dev-lead.** spec-lead is dispatched as a serial-Task specialist for Phase A. The dev-lead owns persistence (metadata blocks, tags, host calls), Phase B orchestration, and Phase C reporting directly.

## Inputs

- `$ARGUMENTS` -- the Spec work item id.
- `.claude/strap/contexts/project-profile.md` -- source of truth for active domains.
- `.claude/strap/state/devops-connection.yaml` -- connection profile. Required fields used by this skill: `mapping.work_item_types.feature.host_type`, `mapping.field_formats.description`, `mapping.states.new`, `mapping.link_types.related`, `mapping.default_parents.feature`, `operation_templates.work_item_read`, `operation_templates.work_item_create`, `operation_templates.work_item_query`, `operation_templates.work_item_link_add`.
- `.claude/strap/templates/work-items/feature.template.md` -- Feature description body template.

## Workflow

### Phase A: Feature generation

#### A.0: Pre-dispatch precondition checks (dev-lead direct, before any specialist)

Render `operation_templates.work_item_read` with `id=$ARGUMENTS` and execute. Capture the Spec body. Validate three preconditions before dispatching spec-lead:

1. **Spec state is `resolved`.** If `new` or `active`, refuse and recommend `/refine-spec <spec-id>` to drive the Spec to Resolved first.
2. **Spec is logically a `spec`** (via `strap:spec` tag or `mapping.work_item_types.spec.host_type` match). Refuse otherwise.
3. **Mockup pre-decomposition gate (user-facing scope only).** Inspect the Spec body for client-ui Constituent Part(s):
   - If the Spec carries no client-ui Constituent Part, skip this check and proceed.
   - If the Spec carries at least one client-ui Constituent Part, the Spec body MUST contain BOTH a `Mockup Reference (authoritative for implementation)` section (written by `/create-mockups` on CPO approval) AND a `Mockup Wiring Guide` section (written by `/analyze-mockups` on CPO approval). If either is missing, refuse and recommend the appropriate hand-off:
     - Mockup Reference missing -> `/create-mockups <spec-id>`
     - Mockup Reference present but Wiring Guide missing -> `/analyze-mockups <spec-id>`
   - Surface the gate to the CPO with the precise missing section so the next-step recommendation is unambiguous.

The pre-dispatch checks live in the dev-lead because they govern whether spec-lead should run at all. Specialists do not gate themselves.

#### A.1: Dispatch spec-lead

On precondition pass, dispatch spec-lead via `Task` (serial -- no CreateTeam, no parallel) with read-only tools palette (`Read, Grep, Glob, Bash`). The spec-lead's brief:

- The Spec body (already captured in A.0) including the user-facing scope, the Mockup Reference section, and the Mockup Wiring Guide section when present. Spec-lead reads the Spec body as input; it does NOT re-fetch from the host.
- Determine Feature shape:
  - One or more new **Features** (cross-layer deliverables; never split by domain alone, never split by sub-repo alone on polyrepo umbrellas).
  - One or more **Enhancements** against existing Features. Permitted only when the connection profile declares `mapping.work_item_types.enhancement` and the corresponding `host_type`; otherwise fall back to a new Feature linked `related` to the existing one.
  - Use `operation_templates.work_item_query` to discover prior Features this work would extend.
  - **Cross-sub-repo Feature shape (polyrepo umbrellas only)**: when the source Spec carries cross-sub-repo dependency language (Constituent Part sub-repo annotations spanning multiple slugs AND Assembly Order phrasing like "X lands first; Y depends on X" or "consumers import from X"), the natural shape is ONE cross-sub-repo Feature whose Stories map to the Spec's Constituent Parts. Decomposing into N per-sub-repo Features fragments F5 cluster-mode coordination: each Feature would open its own PR with a distinct `feature-id` marker in the cluster manifest, preventing `/refine-pr`'s cluster-discovery from recognizing siblings; F6 S2 merge-order surfacing and F6 S3 ordered-merge enforcement bypass entirely (those activate per-Feature on cross-sub-repo Tasks); F8 propagation testing degrades to per-Feature single-sub-repo runs. The single-Feature-spanning-sub-repos shape is what v2.4's polyrepo execution surfaces were designed for. Default to ONE cross-sub-repo Feature in this case; split only when the Constituent Parts genuinely represent independent atomic deliverables with no cross-sub-repo dependencies.
- Produce a **decision brief** for each candidate Feature/Enhancement:
  - Title
  - Scope summary
  - Rationale (Feature vs Enhancement; why this scope grouping)
  - Active-domain notes -- which canonical domains the Spec sections imply, per project-profile.md's `Domains` section. Flag any domain the Spec implies that is NOT yet active; that's a signal to the dev-lead that /decompose-feature will trigger the activation gate in Phase B.
  - Mockup-as-contract notes (user-facing scope only): copy the relevant rows from the Spec's Mockup Reference table and Wiring Guide that this Feature consumes. Do not invent file lists; the Spec body is authoritative.
- Return the briefs to the dev-lead. Do NOT create work items -- that's the dev-lead's persistence pass.

#### A.2: CPO approval gate

Present the briefs to the CPO via `AskUserQuestion`. Options per Feature: `Approve`, `Modify`, `Reject`. `Modify` re-dispatches spec-lead with directive feedback. `Reject` drops the Feature from the run.

When the spec-lead surfaced any not-yet-active domain in its briefs, mention this in the CPO summary so the CPO is forewarned that /decompose-feature will hit the activation gate in Phase B.

**Cross-sub-repo Feature-shape sanity check (polyrepo umbrellas only)**: before the CPO approval gate fires, the dev-lead inspects the spec-lead's proposed Feature briefs against the source Spec. When the proposed shape is **N per-sub-repo Features** (each Feature's sub-repo annotations cover exactly one sub-repo slug) AND the source Spec carries **cross-sub-repo dependency language** (Assembly Order phrases like "X lands first; Y depends on X", inheritance phrases like "consumers import from X", Constituent Parts whose sub-repo annotations collectively span multiple slugs), surface a structured warning to the CPO BEFORE the Approve / Modify / Reject options render:

```
Warning: F5 cluster-mode incompatibility detected.

The proposed shape is N per-sub-repo Features. The source Spec
#<id> carries cross-sub-repo dependency language. Consequences if
approved as-is:

- F5 cluster manifest will NOT activate (each Feature opens its
  own PR with a distinct feature-id marker; /refine-pr cluster
  discovery cannot recognize siblings).
- F6 S2 merge-order surfacing in /execute-sprint will NOT fire
  (no Feature spans multiple sub-repos).
- F6 S3 ordered-merge enforcement in /refine-pr will NOT fire
  (no N-PR cluster from one Feature).
- F8 cross-sub-repo test propagation will NOT exercise (per-
  Feature single-sub-repo runs only).

If the validation intent is to exercise v2.4 polyrepo
coordination, choose Modify with directive:
  "Re-produce as ONE cross-sub-repo Feature whose Stories map to
  the Spec's Constituent Parts. F5 cluster-mode validation requires
  the single-Feature-spanning-sub-repos shape."

Approve as-is only when each Constituent Part IS genuinely an
independent atomic deliverable with no cross-sub-repo dependencies.
```

The warning fires before Approve / Modify / Reject. CPO retains final say; the warning is informative, not blocking. When CPO approves anyway, the run proceeds with the N-Feature shape (the warning is recorded in the dev-lead's audit trail for the run).

#### A.3: Persistence

On CPO approval, for each Feature/Enhancement, the dev-lead persists:

1. **Render the description body** using `feature.template.md`. The template embeds the v2.2 lifecycle-metadata block via Mustache placeholders followed by the Feature-specific content sections. Pass these values to the render call:

   - `authored_by` -> `spec-lead`
   - `authored_at` -> ISO-8601 timestamp at the moment of persistence
   - `completed_by` -> `_(set at resolution)_`
   - `completed_at` -> `_(set at resolution)_`
   - `mockups_in_play` -> boolean; true when the client-ui domain entry in project-profile.md declares mockup paths AND a Spec section references them
   - Plus the Feature-specific placeholders the spec-lead supplied (title, description, linked_spec, constituent_parts, acceptance_criteria, mockup_references when applicable, out_of_scope, dependencies).

2. **Convert markdown to HTML at the boundary.** If `mapping.field_formats.description` is `html`, convert the rendered body. If `markdown`, pass through unchanged. The conversion mechanism is a runtime detail; the contract is that what reaches the host renders cleanly.

3. **Render `operation_templates.work_item_create`** with placeholders:
   - `{{host_type}}` -> `mapping.work_item_types.feature.host_type` (or `enhancement.host_type` when supported)
   - `{{title}}` -> Feature title
   - `{{description}}` -> rendered description body (HTML or markdown per the conversion rule)
   - `{{parent_id}}` -> resolved from `mapping.default_parents.feature` per the three-state semantic (introduced in v2.4 Step 5c of `/connect-devops-project`):
     - **integer id**: auto-parent new Features under that Epic
     - **explicit `~` / null**: CPO chose top-level filing at onboarding; SKIP the parent link entirely and file Features as top-level (do NOT re-prompt)
     - **key missing entirely** (legacy / pre-Step-5c install): surface the gap per existing failure-handling and ask the CPO ad-hoc
   - `{{area_path}}` -> per profile or as overridden by the CPO
   - `{{iteration_path}}` -> per profile root (sprint allocation happens later via `/plan-sprint`)
   - `{{state}}` -> `mapping.states.new`
   - `{{tags}}` -> `AI; strap:feature` (or `AI; strap:enhancement` when supported)

4. Execute via the connection profile's transport. Capture the host work-item id from the response.

5. **Link to the source Spec.** Render `operation_templates.work_item_link_add` with:
   - `{{source_id}}` -> the new Feature's host id
   - `{{target_id}}` -> $ARGUMENTS (the Spec id)
   - `{{link_type}}` -> `mapping.link_types.related`

6. **For Enhancements:** also link to the original Feature via the same operation with `{{link_type}}` -> `mapping.link_types.related`.

#### A.4: Return the Feature list

Return the created Feature ids and titles to Phase B.

### Phase B: Per-Feature decomposition

For each Feature created in Phase A:

1. Invoke `/decompose-feature` with the Feature id. The decomposition skill owns:
   - Reading the Feature and its linked Spec
   - The **domain-activation gate** (CPO-approved activation of any domains the Spec requires that aren't already in `project-profile.md`'s `Domains` section)
   - Dispatching active-domain specialists via `CreateTeam` for read-only planning
   - Reconciliation, dependency linking, gap analysis
   - Persisting Stories and Tasks with v2.2 lifecycle metadata + tags
   - Transitioning the Feature to `active`
   - Posting a `[STRAP/agent:dev-lead]` state-change comment on the Feature

2. This skill does not duplicate decomposition logic. Iterate the Feature list; invoke once per Feature.

### Phase C: Summary

After all Features are decomposed, present to the CPO:

- Per Feature: id, title, total Stories, total Tasks, total estimated hours
- Aggregate totals across all generated Features
- Host-resolved links for board review (rendered from `host_url` + work-item id)
- Domain-activation summary: any domains activated during decomposition (cumulative across all Features in this run; cross-references the project-profile.md `Domains` section state after this run)
- Recommended next step: `/plan-sprint <feature-id>` per Feature to allocate to a sprint, then `/execute-sprint <feature-id>` to begin implementation

## Outputs

- One or more `feature` (or `enhancement`) work items under the configured Features-epic parent, linked `related` to the source Spec.
- Each Feature carries the v2.2 lifecycle-metadata block at the top of its description (`Authored By: spec-lead`).
- Each Feature carries the `AI` tag and the `strap:feature` (or `strap:enhancement`) tag.
- For each Feature, a fully decomposed Story/Task tree (produced by `/decompose-feature`).
- A summary report to the CPO with ids, titles, totals, board review links, and domain-activation outcomes.

## Quality gates

The skill is successful when all of the following hold:

- The Spec was in `resolved` state when the skill ran.
- spec-lead was dispatched read-only; no production code was modified during brief generation.
- The v2.2 metadata block + `AI` tag + `strap:<logical-type>` tag were applied by the dev-lead at persistence time. Specialists do not generate metadata blocks themselves (single-curator rule).
- `enhancement` degrades gracefully: when the connection profile declares the logical type unsupported, the skill fell back to a new `feature` linked `related`.
- Mockup references reflect the actual filesystem; no file list was fabricated.
- CPO approval landed between Phase A's brief and the persistence step.
- Markdown-to-HTML conversion was applied for HTML-flavored hosts.
- Every persisted Feature carries the metadata block and the appropriate tags.
- /decompose-feature's quality gates apply per Feature in Phase B.

## Failure handling

- **Linked Spec not in `resolved`**: spec-lead refuses; dev-lead surfaces and recommends `/refine-spec <spec-id>`.
- **`mapping.default_parents.feature` key missing entirely** (legacy / pre-v2.4 install): surface the gap; ask the CPO to specify per-Feature ad-hoc for this run OR re-run `/connect-devops-project` Step 5c to set durably. **Distinct from explicit-null** -- when the key is present with value `~` / null, file new Features top-level without re-prompting.
- **`operation_templates` rendering produces malformed requests**: surface the failing template path and request body; do not execute the call.
- **HTML conversion fails**: surface the offending content; do not post raw markdown into an HTML-flavored field.
- **`work_item.create` returns a transient error with no confirmation**: render `operation_templates.work_item_query` against parent + title to check for partial creation before retrying (avoids duplicates).
- **CPO declines all Features at the approval gate**: exit cleanly with no persistence.
- **/decompose-feature fails on one Feature in Phase B**: report the failure; offer to continue with the remaining Features or stop and resume manually with `/decompose-feature <feature-id>` once the root cause is addressed.

## References

- Source Spec: `$ARGUMENTS` (logical type `spec`).
- spec-lead role contract: [`../../agents/agent-ops/spec-lead.md`](../../agents/agent-ops/spec-lead.md).
- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- Decomposition skill: [`../decompose-feature/SKILL.md`](../decompose-feature/SKILL.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Feature template: `.claude/strap/templates/work-items/feature.template.md`.
- Onboarding design (connection-profile shape, canonical operation set): [`../../strap/contexts/onboarding-design.md`](../../strap/contexts/onboarding-design.md).
- /connect-devops-project (schema source-of-truth): [`../connect-devops-project/SKILL.md`](../connect-devops-project/SKILL.md).
