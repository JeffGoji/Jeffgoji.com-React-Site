---
name: specification-template
description: Work item content template for Spec work items. Consumed by /create-spec and /refine-spec. Authored by spec-lead from the source Requirement and codebase research; rendered into the description field with format conversion applied at the boundary per the connection profile's `mapping.field_formats.description`.
---

> Content template for Spec work items. The skill renders this template with values supplied by `spec-lead` and the lifecycle-metadata block populated by the dev-lead at persistence time. The Constituent Parts table, Acceptance Criteria, and per-section technical depth are populated by `spec-lead` from codebase research and CPO conversation. Sections without populated content MUST be marked explicitly as stubs awaiting refinement -- never silently omitted, never fabricated. Stable Acceptance Criterion IDs (`AC-001`, `AC-002`, ...) and Constituent Part labels are load-bearing -- downstream Features, Stories, and Tasks reference them.

| Field        | Value                       |
|--------------|-----------------------------|
| Authored By  | {{ authored_by }}           |
| Authored At  | {{ authored_at }}           |
| Completed By | {{ completed_by }}          |
| Completed At | {{ completed_at }}          |

---

# {{ specification.title }}

## Overview

High-level summary of what this Spec covers. One paragraph that orients a senior developer who reads this Spec cold. Includes a link back to the source Requirement (`related` link in the host tool) so the WHY is one click away from the WHAT.

{{ specification.overview }}

**Source Requirement:** {{ specification.linked_requirement }}

## Constituent Parts

The implementable decomposition of this Spec. Each row is owned by a specific domain agent active in `project-profile.md`'s `Domains` section. The set of rows is driven by the active specialist roster, not a fixed list -- if no active domain claims a section, that section is not in the table. The /decompose-feature activation gate adds new domains as the Spec requires them.

| Part | Domain | Owner agent type | Summary | Acceptance Criteria covered |
|---|---|---|---|---|
{{ specification.constituent_parts }}

Per-section technical depth follows below. Each Constituent Part section names actual files, services, components, schema entities, or interfaces from codebase research -- vague stubs are unacceptable when the artifacts can be named.

{{#polyrepo_umbrella}}
**Polyrepo umbrella:** every Constituent Part section heading below carries a `[sub-repo: <slug>]` annotation declaring which sub-repo(s) the section targets. See the "Sub-repo intent" section immediately after the Constituent Part details for the format and authoring discipline.
{{/polyrepo_umbrella}}

{{ specification.constituent_part_details }}

{{#polyrepo_umbrella}}
## Sub-repo intent (polyrepo umbrellas only)

When `project-profile.md`'s `Sub-repos` section is populated (polyrepo umbrella), every Constituent Part section heading carries an annotation declaring which sub-repo(s) the section targets. Single-repo umbrellas (no `Sub-repos` section, or an empty one) omit this section AND the annotations entirely -- the absence of annotations IS the single-repo signal; there is no implicit default.

**Annotation format:**

- **Single sub-repo:** `[sub-repo: <slug>]` -- e.g., `## API surface [sub-repo: api-backend]`
- **Multi sub-repo:** `[sub-repos: <slug-a>, <slug-b>]` -- e.g., `## DTO contracts [sub-repos: shared-types, api-backend]`

The annotation appears at the END of the heading text, separated from the section name by a space. The slug list inside the brackets references sub-repo slugs from `project-profile.md`'s `Sub-repos` section.

**How it's consumed:**

- `/decompose-feature` reads each Constituent Part section's annotation when generating Stories and Tasks. Tasks inherit the sub_repo intent -- a Task generated from a `[sub-repo: api-backend]` section lands with `sub_repo: api-backend` set, routing it to the api-backend sub-repo's worktree at execution time.
- Multi-slug annotations produce one Task per sub-repo by default; the specialist may split during decomposition with CPO approval. See the v2.4 atomic cross-sub-repo execution Feature for how cross-sub-repo Tasks coordinate.
- `spec-lead` populates annotations during Spec authoring (interview with CPO; suggestions from existing Sub-repos schema fields like `active_domains` and `role`).
- Validation that the slug resolves to an actual sub-repo is execution-time (the routing Feature); Spec authoring trusts the spec-lead + CPO contract.

**Why it lives in the heading, not the body:**

- Surfaces in any TOC scan (markdown TOC tools, HTML rendering, plain-text terminal).
- Renders cleanly in ADO HTML rendering, Outline markdown rendering, and plain markdown.
- Parser-friendly: a regex like `\[sub-repos?:\s*([^\]]+)\]` captures the slug list reliably.
- Co-located with the section title rather than buried in body prose.

**Annotations on this Spec:**

{{ specification.sub_repo_annotation_summary }}
{{/polyrepo_umbrella}}

## Acceptance Criteria

Spec-wide acceptance criteria with stable identifiers. Every Success Criterion from the source Requirement maps to at least one Acceptance Criterion here. Each Acceptance Criterion is testable by `test-strategist` and assignable to one or more Constituent Parts in the table above.

Format: `AC-NNN: <observable, testable statement of done>`.

{{ specification.acceptance_criteria }}

{{#mockups_in_play}}
## Mockup Analysis

Mockups are in play for this Spec (the client-ui domain entry in `project-profile.md` declares mockup paths). The `designer` agent's mockup wiring table maps the mockup data shapes to backend API endpoints and identifies which existing project services the implementation must reuse rather than reimplementing.

The implementation agent reads the mockup source files directly for visual fidelity (styling, layout, element configuration). This section captures only the WHAT-CONNECTS-TO-WHAT contract, not the visual surface -- the mockup IS the visual contract.

**Mockup source paths:** {{ specification.mockup_paths }}

**Wiring table (data shape to backend contract):**

{{ specification.mockup_wiring_table }}

**Gaps and discrepancies between mockup and backend contract:**

{{ specification.mockup_gaps }}
{{/mockups_in_play}}

## Assembly Order

Which Constituent Parts ship in which order, and which depend on which. This section drives `dev-lead`'s sequencing during `/decompose-feature`. Schema first, then domain, then API, then client-ui is the default progression; security and tests parallelize with their target layer. Document explicit cross-part predecessors and successors here.

{{ specification.assembly_order }}

## Test Strategy

How the `test-strategist` will validate this Spec. Coverage expectations per Constituent Part, the test types involved (unit, integration, end-to-end, contract), the data the suite needs, and any environmental requirements that go beyond the project's standard test commands.

Per the STRAP-wide centralized-test-execution convention, only `dev-lead` invokes the test command. This section describes WHAT gets tested, not WHO runs the suite.

{{ specification.test_strategy }}

## Dependencies

External systems this Spec touches, other Specs whose output this Spec consumes, and infrastructure prerequisites that must exist before implementation begins. External-system entries name the system, the touchpoint (API endpoint, message queue, file drop, etc.), and the contract or version constraint.

Federation-style cross-product dependencies are explicitly out of scope. When the work touches a sibling product, file a Requirement against that product's STRAP install rather than referencing it here.

{{ specification.dependencies }}

## Open Questions

Issues `spec-lead` surfaced during specification that the CPO must resolve before this Spec can move to `resolved`. Each entry has a stable identifier (`SQ-001`, `SQ-002`, ...), the date raised, and the role expected to answer (CPO, tech lead, security owner, named domain agent).

{{ specification.open_questions }}

## Quality Checklist

`spec-lead`'s drive-to-Resolved gates. Every box must be checkable before recommending the Spec for `resolved`.

- [ ] Overview orients a senior developer in one paragraph and links back to the source Requirement.
- [ ] Every Constituent Part in the table has a domain owner agent active in `project-profile.md`'s `Domains` section -- no orphan sections.
- [ ] Per-section technical depth names real files, services, components, schema entities, or interfaces -- no generic placeholders.
{{#polyrepo_umbrella}}
- [ ] Every Constituent Part section heading carries a `[sub-repo: <slug>]` or `[sub-repos: ...]` annotation referencing slugs in `project-profile.md`'s `Sub-repos` section. Cross-sub-repo Parts use the multi-slug variant.
{{/polyrepo_umbrella}}
- [ ] Every Requirement Success Criterion maps to at least one Acceptance Criterion in this Spec.
- [ ] Every Acceptance Criterion has a stable ID (`AC-NNN`) and is testable.
{{#mockups_in_play}}
- [ ] Mockup Analysis section is populated -- wiring table maps every relevant data shape to a backend endpoint, gaps are surfaced.
{{/mockups_in_play}}
- [ ] Assembly Order documents predecessors and successors between Constituent Parts -- no implicit sequencing.
- [ ] Test Strategy specifies coverage expectations per Constituent Part and names the test types involved.
- [ ] Dependencies on external systems and other Specs are explicit; no Federation/cross-product entries appear.
- [ ] Every Open Question is resolved or explicitly deferred with CPO approval recorded.
- [ ] A senior developer with no prior context could implement from this Spec alone.
