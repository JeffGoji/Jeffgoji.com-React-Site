---
name: feature-template
description: Work item content template for Feature work items. Consumed by /generate-features. Authored by spec-lead from a Resolved Spec; populated with the Constituent Parts and Acceptance Criteria subset this Feature owns. Rendered with format conversion applied at the boundary per the connection profile's `mapping.field_formats.description`.
---

> Content template for Feature (and, where the connection profile supports it, Enhancement) work items. The skill renders this template with values supplied by `spec-lead` and the lifecycle-metadata block populated by the dev-lead at persistence time. A Feature is a cross-layer deliverable; it is never split by domain. Constituent Parts and Acceptance Criteria carried here are SUBSETS of the parent Spec's full lists -- this Feature owns these specific pieces of the Spec.

| Field        | Value                       |
|--------------|-----------------------------|
| Authored By  | {{ authored_by }}           |
| Authored At  | {{ authored_at }}           |
| Completed By | {{ completed_by }}          |
| Completed At | {{ completed_at }}          |

---

# {{ feature.title }}

## Description

What this Feature delivers from a user-or-operator-visible standpoint. Brief enough to scan; detailed enough that a senior developer reading the Feature alone understands the scope and the value being shipped.

{{ feature.description }}

## Linked Spec

The parent Spec this Feature is generated from. The link is `related` (the Feature is parented to the Features-epic id declared at `mapping.default_parents.feature` in the connection profile, not to the Spec, per the STRAP linking convention).

**Spec:** {{ feature.linked_spec }}

## Constituent Parts assigned

The subset of the parent Spec's Constituent Parts table that this Feature owns. Other Features generated from the same Spec own the remaining parts. Each row references the Spec's Constituent Part label so traceability holds.

| Part | Domain | Owner agent type | Summary |
|---|---|---|---|
{{ feature.constituent_parts }}

## Acceptance Criteria subset

The specific Acceptance Criteria from the parent Spec that this Feature owns. Use the parent Spec's stable IDs (`AC-NNN`) verbatim -- this Feature does NOT renumber. `dev-lead` and `test-strategist` rely on these IDs to trace Story coverage back to Spec criteria.

{{ feature.acceptance_criteria }}

{{#mockups_in_play}}
## Mockup References

Mockup directory paths and the enumerated file list relevant to this Feature. Read from the actual filesystem at generation time -- never fabricated. The implementation agent reads these mockup files directly during decomposition.

{{ feature.mockup_references }}
{{/mockups_in_play}}

## Out of scope

What this Feature explicitly does NOT cover, even when related. Sibling Features generated from the same Spec may own these items; truly out-of-Spec items belong in a separate Spec or Requirement. Sharp boundaries here prevent decomposition drift in `/decompose-feature`.

{{ feature.out_of_scope }}

## Dependencies

Other Features, Specs, or external systems this Feature depends on. Cross-Feature dependencies become predecessor/successor links via the adapter when the Feature is decomposed.

{{ feature.dependencies }}

## Quality Checklist

Gates `spec-lead` verifies before handing the Feature off to `dev-lead` for decomposition.

- [ ] Description is concrete enough that a senior developer understands the scope.
- [ ] Linked Spec is in `resolved` state.
- [ ] Constituent Parts assigned reference real rows from the Spec's table -- no invented domains.
- [ ] Acceptance Criteria use the parent Spec's stable IDs verbatim, no renumbering.
- [ ] Out-of-scope is populated and protects against decomposition drift.
- [ ] Dependencies on other Features or external systems are explicit.
{{#mockups_in_play}}
- [ ] Mockup References enumerate real files from the configured mockup paths.
{{/mockups_in_play}}
