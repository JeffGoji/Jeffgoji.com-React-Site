---
name: /reset-feature
description: Permanently delete a Feature and all its child Stories and Tasks so /generate-features can be re-run from the linked Spec. Preserves the Requirement and Spec. Dev-lead reads the Feature subtree via the work-tracking connection profile, presents a deletion plan, captures CPO double-confirmation, executes deletes leaf-to-root, and posts an audit comment on the linked Spec recording what was destroyed. Degrades gracefully when the host does not support work_item_delete.
allowed-tools: Read, Glob, Grep, Bash, AskUserQuestion
---

# /reset-feature

## Purpose

Wipe a Feature subtree so the CPO can re-run [`/generate-features`](../generate-features/SKILL.md) from the linked Spec without orphaned child work items polluting the board. The dev-lead destroys the Feature and all descendant Stories and Tasks via `operation_templates.work_item_delete` from `devops-connection.yaml`. The Requirement and Spec are preserved; the destruction is recorded as an audit comment on the linked Spec so the reset survives the loss of the Feature.

This is a destructive operation. The skill stages a deletion plan, requires explicit CPO confirmation via `AskUserQuestion` showing the irreversible language and the per-item counts, and only then executes the deletes.

The skill ships portable. Every adopter-specific concern resolves at runtime:

- Work-tracking operations render through `operation_templates.<op>` in `.claude/strap/state/devops-connection.yaml`
- Type and link mappings come from `mapping.work_item_types.{feature,story,task}.host_type` and `mapping.link_types.{parent_child,related}`
- Delete semantics are whatever the host's `operation_templates.work_item_delete` encodes (e.g., Azure DevOps `--destroy` flag for permanent destruction; Local strap-agile filesystem `rm` -- the skill simply executes the template). Hosts that hold a recycle bin and don't bypass it on delete are documented per the operation template; the CPO sees the behavior in the plan presentation.
- Audit trail lives in an `[STRAP/agent:dev-lead]` comment on the linked Spec posted BEFORE the deletes (so the audit survives a partial-failure that leaves the Feature destroyed mid-flight).

## Owner

**dev-lead.** Runs directly in the top-level session -- no specialist dispatch. Destructive single-target operations are tight conversational CPO loops; a sub-agent boundary adds latency without benefit.

## Inputs

- `$ARGUMENTS` -- the Feature work item id. Required.
- `.claude/strap/state/devops-connection.yaml` -- connection profile. Required fields used by this skill: `mapping.work_item_types.{feature,story,task}.host_type`, `mapping.link_types.{parent_child,related}`, `capabilities.{work_item_read,work_item_query,work_item_delete,work_item_comment_add}`, `operation_templates.{work_item_read,work_item_query,work_item_delete,work_item_comment_add}`.

## Pre-flight

1. **devops-connection.yaml present.** If missing, redirect to `/connect-devops-project`.
2. **`work_item_delete` capability supported.** If `capabilities.work_item_delete: unsupported`, the skill cannot proceed -- surface the gap and recommend manual deletion in the host UI (with the per-id list the skill would have deleted) followed by re-running `/generate-features <spec-id>`. Do not partial-execute.

## Workflow

### Phase 1: Read the Feature and its descendants

1. Render `operation_templates.work_item_read` with `id=$ARGUMENTS` and execute. Validate the item is logically a `feature` (via `strap:feature` tag or `mapping.work_item_types.feature.host_type` match). Refuse if not -- this skill is Feature-scoped; deleting a Bug or other type is a CPO-driven host-UI operation outside this skill's scope.
2. Capture: title, state, assigned developer, tags, and the linked Spec id (via the `related` link from Feature to Spec). Also capture the Requirement id when the Spec has a `related` link upstream to a Requirement (best-effort; just for the presentation).
3. Walk children: render `operation_templates.work_item_query` (or `work_item_list` per the host's query primitive) with `parent_id=$ARGUMENTS` to list direct child Stories. For each Story, list its child Tasks the same way. Build the complete descendant set.
4. If the Feature has no children, the reset still proceeds (the Feature itself is deleted) -- but note this to the CPO so they can confirm intent (a Feature with no children is typically one that has not yet been decomposed; the CPO should confirm they want it gone rather than running `/decompose-feature`).

### Phase 2: Capture the host's delete semantics for CPO awareness

Inspect `operation_templates.work_item_delete` in the connection profile. Capture a one-line summary of what it does on this host so the CPO sees the actual behavior at the confirmation gate:

- Azure DevOps with `destroy=true`: "permanent destruction (bypasses ADO Recycle Bin)"
- Azure DevOps without `destroy=true`: "logical delete (item moves to ADO Recycle Bin; CPO must purge separately for full removal)"
- Local strap-agile filesystem: "filesystem `rm` (file removed from `.claude/strap/work/`; recoverable only from git history)"
- Other hosts: derive from the template's apparent action (REST DELETE, CLI subcommand flags, etc.)

When the behavior is ambiguous (the operation_template encodes a recycle-style delete on a host that also has a permanent-delete option not modeled), surface the ambiguity to the CPO in the plan presentation.

### Phase 3: Present the deletion plan

Present to the CPO:

```
Feature to delete (PERMANENT on this host):
  #<feature-id> - <title> (<state>) assigned: <developer>

Linked Spec (preserved):
  #<spec-id> - <spec-title>

Linked Requirement (preserved, best-effort):
  #<req-id> - <req-title>   (or "no linked Requirement")

Items to be destroyed (counts and full id list):
  Tasks:    <N>   (#<id1>, #<id2>, ...)
  Stories:  <M>   (#<id1>, #<id2>, ...)
  Feature:  1     (#<feature-id>)
  ----
  Total:    <total>

Host delete semantics (from devops-connection.yaml operation_templates.work_item_delete):
  <one-line summary captured in Phase 2>

Audit trail:
  An [STRAP/agent:dev-lead] comment will be posted on Spec #<spec-id>
  BEFORE deletion executes, recording what is about to be destroyed.
  This survives partial-failure mid-deletion.

After deletion:
  Re-run: /generate-features <spec-id>   (regenerates Features + decomposition)
```

Use `AskUserQuestion` for the approval gate. Options (nominal-label decision; no previews):

- `Confirm and delete <total> items`
- `Cancel`

The label carries the count so the CPO sees what's being destroyed in the click target itself. No re-prompt unless the CPO picks `Other` to ask a clarifying question -- the plan presentation is the full context.

### Phase 4: Post the pre-deletion audit comment on the Spec

BEFORE any deletion executes, render `operation_templates.work_item_comment_add` against the linked Spec with body:

> `[STRAP/agent:dev-lead] Reset (via /reset-feature): destroying Feature #<feature-id> - <title> and <N> Tasks + <M> Stories (total <total> child items). Triggered at <ISO-timestamp>. Re-run /generate-features #<spec-id> to regenerate.`

Execute via the connection profile's transport. If the Spec link cannot be resolved or the comment post fails, surface and ask the CPO whether to proceed without the audit (last-resort fallback -- the CPO loses the post-mortem signal but the destruction proceeds) or abort.

### Phase 5: Execute deletes leaf-to-root

On confirmation, delete in dependency-correct order to avoid orphan errors on hosts that reject deletion of items with live children:

1. **Tasks first** (leaves). For each Task id: render `operation_templates.work_item_delete` and execute.
2. **Stories next** (Task parents).
3. **Feature last** (Story parent).

Per-host idempotency: `work_item_delete` on an already-deleted id should succeed (no-op) on most hosts. When it doesn't, treat the second attempt's failure as benign and continue.

When a single delete fails with a permanent error (illegal state, missing permission, host rejection), **stop and surface the partial state**. The skill does NOT roll back deletes that have already succeeded -- that is generally not recoverable through the host API and rolling back would risk further data loss. Instead the skill reports exactly which items remain and what the CPO must do manually.

### Phase 6: Confirm

Report to the CPO:

```
Reset complete.
  Tasks deleted:    <N>
  Stories deleted:  <M>
  Feature deleted:  1
  Total destroyed:  <total>

Preserved:
  Spec:        #<spec-id> (audit comment posted before deletion)
  Requirement: #<req-id>  (when applicable)

Host delete semantics:
  <one-line summary -- if logical-delete-only, remind the CPO to purge
   the host's recycle bin separately for full removal>

Re-run:
  /generate-features <spec-id>
```

If the host executed logical-only deletion (recycle bin retains the items), call that out so the CPO knows whether to purge separately.

## Outputs

- The Feature and all descendant Stories and Tasks deleted from the host work-tracker (per the host's delete semantics).
- A pre-deletion `[STRAP/agent:dev-lead]` audit comment on the linked Spec recording the destruction (survives the Feature's deletion).
- A CPO-facing summary capturing counts, preserved upstream items, host delete semantics, and the re-run command.
- No mutation to the linked Spec or Requirement bodies/states, regardless of outcome.

## Quality gates

The skill is successful when all of the following hold:

- devops-connection.yaml was present and `work_item_delete` was supported at pre-flight.
- The target item was confirmed to be a Feature (logical type).
- The full descendant set was enumerated before any delete executed.
- The host's delete semantics were surfaced to the CPO in the plan presentation.
- The CPO confirmed via `AskUserQuestion` before any deletion.
- The pre-deletion audit comment landed on the linked Spec before any delete executed (or the CPO explicitly accepted proceeding without it).
- Deletes proceeded leaf-to-root (Tasks -> Stories -> Feature).
- The Spec and Requirement bodies were never modified.
- The final report named the re-run command (`/generate-features <spec-id>`).

## Failure handling

- **devops-connection.yaml missing**: stop. Redirect to `/connect-devops-project`.
- **`work_item_delete` unsupported**: stop. Surface the per-id list and recommend manual deletion in the host UI followed by `/generate-features <spec-id>`. Do not partial-execute.
- **Target is not a Feature**: refuse with a clear message naming the actual logical type. The CPO can delete other types via the host UI.
- **Target Feature has no linked Spec**: surface the gap; warn that re-run will require the CPO to know the Spec id (which the Feature carried in `related` link). Offer to proceed without the audit comment (since there's no Spec to comment on) or stop and let the CPO investigate first.
- **Audit comment post fails**: ask the CPO whether to proceed without it or abort.
- **A single delete fails with a permanent error mid-flight**: stop and report the partial state. Do NOT roll back; surface exactly which items remain.
- **`operation_templates` rendering produces malformed requests**: surface the failing template path and request body; do not execute.
- **The CPO declines at the confirmation gate**: exit cleanly. The audit comment is NOT posted; no items are deleted.

## References

- Source Feature: `$ARGUMENTS` (logical type `feature`).
- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- dev-lead guardrails: [`../../strap/rules/agents/dev-lead.md`](../../strap/rules/agents/dev-lead.md).
- agent-devs team rules: [`../../strap/rules/agent-devs.md`](../../strap/rules/agent-devs.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Companion regenerator: [`../generate-features/SKILL.md`](../generate-features/SKILL.md).
- Upstream skills (produce the Spec that is preserved): [`../create-spec/SKILL.md`](../create-spec/SKILL.md), [`../refine-spec/SKILL.md`](../refine-spec/SKILL.md).
- Connection-profile schema source-of-truth: [`../connect-devops-project/SKILL.md`](../connect-devops-project/SKILL.md).
