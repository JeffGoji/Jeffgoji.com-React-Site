---
name: story-template
description: Work item content template for Story work items. Consumed by /decompose-feature. Authored by domain agents and reconciled by dev-lead; rendered with format conversion applied at the boundary per the connection profile's `mapping.field_formats.description`.
---

> Content template for Story work items. Each Story is created during `/decompose-feature` -- a domain agent drafts the content, `dev-lead` reconciles overlap and sequencing across agents, then renders this template and persists the work item parented to the Feature. The lifecycle-metadata block is populated by the dev-lead at persistence time. A Story scopes to one layer in the layer-aligned strategy or to one vertical slice in the vertical-slice strategy. Tasks live as children under the Story.

| Field        | Value                       |
|--------------|-----------------------------|
| Authored By  | {{ authored_by }}           |
| Authored At  | {{ authored_at }}           |
| Completed By | {{ completed_by }}          |
| Completed At | {{ completed_at }}          |

---

# {{ story.title }}

## Description

What this Story delivers from a user-or-operator-visible standpoint (vertical slice) or from a layer-internal standpoint (layer-aligned). Concrete enough that the assigned developer can pick up the Story and know what done looks like without re-reading the Spec.

{{ story.description }}

## Linked Feature

The parent Feature this Story is decomposed from. The Story is parented to the Feature in the host tool -- this section names the Feature for human readers.

**Feature:** {{ story.linked_feature }}

## Linked Spec section

The Spec's Constituent Part this Story implements (or contributes to, in the vertical-slice case). Reference the Spec by ID and name the Constituent Part label verbatim from the Spec's table so traceability holds.

**Spec:** {{ story.linked_spec }}
**Constituent Part:** {{ story.linked_spec_section }}

## Acceptance Criteria subset

The specific Acceptance Criteria this Story owns. Use the parent Spec's stable IDs (`AC-NNN`) verbatim -- this Story does NOT renumber. Coverage of every assigned AC is verified by `dev-lead` during reconciliation; `test-strategist` validates the assertions.

{{ story.acceptance_criteria }}

## Implementation notes

`dev-lead`'s decomposition guidance for the Story's Tasks: which interfaces, services, files, or components are involved; which patterns from the agent-devs rules apply; any sequencing constraints between Tasks; mockup-as-contract directives when applicable. These notes feed the Task descriptions and shape the original-estimate values.

{{ story.implementation_notes }}

## Dependencies

Other Stories, Tasks, or external systems this Story depends on. Cross-Story dependencies are persisted as `predecessor`/`successor` links by `/decompose-feature`. External-system dependencies name the system and the touchpoint.

{{ story.dependencies }}

## Quality Checklist

Gates `dev-lead` verifies during reconciliation before persisting the Story.

- [ ] Description is concrete enough that the assigned developer can identify done without re-reading the Spec.
- [ ] Linked Feature and Linked Spec section are correctly populated.
- [ ] Every assigned Acceptance Criterion uses the parent Spec's stable ID -- no renumbering.
- [ ] Implementation notes name real interfaces, services, files, or components -- no generic placeholders.
- [ ] Dependencies are explicit and persisted as adapter links where cross-Story.
- [ ] Story has at most four Tasks (sizing guardrail) -- if exceeded, the Story is split.
