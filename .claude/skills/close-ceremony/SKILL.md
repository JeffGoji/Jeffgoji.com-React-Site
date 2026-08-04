---
name: /close-ceremony
description: CPO-run ritual for transitioning Resolved work items to Closed. The deliberate value-acceptance moment where the CPO walks Resolved Features, Enhancements, Bugs, and lingering Stories and decides per item -- close (value accepted), reject (back to Active with rework tag), defer (stay Resolved with reason tag), or skip. Adapter-mediated; produces a ceremony report. The only authoritative place where Resolved -> Closed transitions land manually; PR merge cascades land via /dora-reconcile.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion
argument-hint: [--type <feature|enhancement|bug|story>] [--owner <name>] [--days <N>] [--dry-run]
---

# /close-ceremony

## Purpose

STRAP v2.2 defines `Resolved` as "code/content done" and `Closed` as "value accepted." The transition between them is the **value-acceptance moment** -- the CPO (or, for Bugs, the QA/CPO pair) verifies the work delivered what was intended, in the target environment. Workflow skills like `/execute-sprint`, `/fix-bugs`, and `/quick` stop at Resolved by design; `/close-ceremony` is the explicit ritual that converts Resolved into Closed.

For each Resolved item the CPO decides:

- **close** -- verified, value delivered, accept; transitions `Resolved -> Closed`
- **reject** -- does not deliver value, or is broken; transitions back to `Active` with the `rework` tag and an audit reason
- **defer** -- leave at Resolved with a `defer:<reason>` tag (e.g., awaiting customer feedback, external dependency, regulatory review)
- **skip** -- no decision now; revisit next ceremony

The skill batches decisions for efficiency and writes a ceremony report on apply.

The skill ships portable. Every adopter-specific concern resolves at runtime:

- Work-tracking operations render through `operation_templates.<op>` in `.claude/strap/state/devops-connection.yaml`
- Type, state, field, and link mappings come from `mapping.*`; `state_asymmetries` covers host collapses (a `strap:closed` tag is applied where the host state machine cannot distinguish Closed from Resolved)
- Markdown-to-HTML conversion is applied at the boundary for HTML-flavored description fields
- The audit trail is `[STRAP/agent:dev-lead]` comments recorded via `operation_templates.work_item_comment_add`
- The ceremony report lands under `.claude/strap/state/close-ceremonies/` (protected by `/strap-upgrade` because the entire `state/` directory is adopter-owned)

## Owner

**dev-lead.** The CPO is the decider; the dev-lead is the operator. The dev-lead reads the Resolved set, presents per-item context, asks the CPO for the action via `AskUserQuestion`, records the decision, and (on the final confirmation gate) applies transitions via the connection profile. No specialists are dispatched -- this is a CPO-orchestrated review ritual.

Recommended cadence: weekly, or whenever Resolved items accumulate past comfort. `/dora-reconcile` Pass D surfaces "items pending Closed > 14 days" and recommends invoking this skill when the count crosses 5.

## Inputs

- `$ARGUMENTS` -- optional filter flags in any order. Examples:
  - `/close-ceremony` -- all Resolved items
  - `/close-ceremony --type bug` -- only Resolved Bugs
  - `/close-ceremony --owner shane.corrallo --days 7` -- items aged 7+ days owned by Shane
  - `/close-ceremony --dry-run` -- preview decisions without applying transitions
- Recognized flags:
  - `--type <feature|enhancement|bug|story>` -- filter to one logical type. Run separate ceremonies per type when the CPO prefers focused decision blocks.
  - `--owner <name>` -- filter to items where the assignee matches (host-side name match per `mapping.fields.assigned_to`).
  - `--days <N>` -- only items in Resolved for at least N days (against `mapping.fields.resolved_date` or `Microsoft.VSTS.Common.ResolvedDate` per the field map). Default: 0 (show all).
  - `--dry-run` -- list and walk through decisions but do NOT apply transitions. Useful for previewing.
- `.claude/strap/contexts/project-profile.md` -- source of truth for the area-path root used in queries.
- `.claude/strap/state/devops-connection.yaml` -- connection profile. Required fields used by this skill: `mapping.work_item_types.{feature,enhancement,bug,story}.host_type`, `mapping.field_formats.description`, `mapping.states.{active,resolved,closed}`, `mapping.state_asymmetries`, `mapping.fields.{assigned_to,resolved_date,resolved_reason,pr_url}` (the latter two optional; `resolved_reason` is consulted on Bug-Close confirmation, `pr_url` is consulted for the linked-PR informational display), `mapping.area_path_root`, `operation_templates.{work_item_query,work_item_read,work_item_update,work_item_comment_add}`.

## Pre-flight

1. **devops-connection.yaml present.** If missing, redirect to `/connect-devops-project`.
2. **`mapping.states.closed` declared.** If absent, the host has no distinct Closed state -- the skill still runs but applies the `strap:closed` tag (per `state_asymmetries`) instead of a state-machine transition. Surface this to the CPO at start so they know the asymmetry is in play.
3. **Capture invoker.** Read the CPO's name from git config or the host identity (whichever the profile exposes). The invoker name lands in audit comments and the ceremony report.

## Workflow

### Phase 1: Query Resolved items

Render `operation_templates.work_item_query` to fetch every work item in `mapping.states.resolved` under `mapping.area_path_root` (or `--owner` filter applied). The query filter shape:

- `filters: [{field: state, op: eq, value: <mapping.states.resolved>}, {field: area_path, op: under, value: <mapping.area_path_root>}]`
- When `--owner` is supplied, add `{field: assigned_to, op: eq, value: <name>}` per `mapping.fields.assigned_to`.

For each returned id, render `operation_templates.work_item_read` to capture:

- Type, title, assignee.
- `ResolvedDate` (from `mapping.fields.resolved_date`); compute `days_in_resolved = now - ResolvedDate`.
- Tags (especially `testing:*` if present; the testing-gate behavior is documented below as optional).
- Parent linkage (for Stories: parent Feature/Enhancement and its current state; for Bugs: standalone or under a Feature).
- Linked PR references (read from the description footer or `mapping.fields.pr_url` if declared; informational display only -- the skill does not gate on PR state).
- For Bugs: `mapping.fields.resolved_reason` value (Fixed, Cannot Reproduce, By Design, Deferred) and the `env:*` tag.
- Children state for parent items (Feature with all child Stories Closed becomes a candidate for inline cascade-close suggestion).

Apply the `--days` filter: drop items where `days_in_resolved < N`.

Apply the `--type` filter: keep only items whose host type matches `mapping.work_item_types.<flag>.host_type`.

### Phase 2: Categorize and present summary

Group items by decision context so the CPO can focus on one class at a time:

1. **Features and Enhancements** -- CPO value-acceptance decision.
2. **Bugs** -- QA/CPO env-verification decision.
3. **Stories with parent Feature/Enhancement already Closed** -- cascade-eligible (recommend close).
4. **Independent Stories in Resolved** (no parent Feature, or parent in a different state) -- standalone decision.

Print the categorized summary to the CPO:

```
=== CLOSE CEREMONY: <date> ===
Invoker: <name>

Resolved items found:
  Features / Enhancements:    <n>  (<n> aged > 14d in Resolved)
  Bugs:                       <n>  (<n> aged > 14d)
  Stories (cascade-eligible): <n>  (parent already Closed)
  Stories (independent):      <n>

Filter applied:
  type:  <none | <type>>
  owner: <none | <name>>
  days:  <0 | N>

Total items: <count>
```

If `total == 0`: print "Nothing to close. Inbox zero." and exit cleanly.

### Phase 3: Choose the walkthrough mode

Use `AskUserQuestion` to decide how to capture decisions. Options (nominal-label decision; no previews):

- `Walk item by item` -- for small ceremonies or when the CPO wants focused review.
- `Batch decide in one response` -- for large ceremonies where the CPO can decide multiple items at once (e.g., "close 1, 2, 4; reject 3 with reason X; defer 5 because Y").
- `Abort` -- exit cleanly without any decisions or transitions.

### Phase 4: Per-item walkthrough (mode A)

For each item, oldest-Resolved first within each category, display the item details:

```
[ <n> of <total> ]  <Type> #<id> "<title>"
  Assignee:        <name>
  Resolved:        <YYYY-MM-DD> (<n> days ago)
  Tags:            <tag list>
  Parent:          <#<id> -- <state> -- <title>>      (when applicable)
  Children:        <count Closed of total>            (Features and Enhancements)
  Linked PRs:      <url or "(none recorded)">
  ResolvedReason:  <value>                            (Bugs only)
  env tag:         <env:*>                            (Bugs only)

  Description summary:
    > <first paragraph or 2-3 lines of the description body>

  Recommendation: <close (cascade from parent Closed) | none>
```

Use `AskUserQuestion` to capture the action:
- Question 1: `Action for #<id>?` with options `close`, `reject`, `defer`, `skip`.
- Question 2 (when reject): `Reason for reject?` -- free-form one-line text via the Other option; record the reason.
- Question 2 (when defer): `Defer reason tag suffix?` (e.g., `awaiting-customer-feedback`, `external-dependency`, `regulatory-review`) -- free-form via Other; the tag will be `defer:<suffix>`.

Record the decision in an in-session table; do NOT apply transitions yet. After every item is reviewed, proceed to Phase 5.

### Phase 4 (alt): Batch decide (mode B)

Print the full numbered table of items and ask the CPO to type the decisions in a single response. Accepted format:

```
close 1, 2, 4, 7
reject 3: panel layout broken on mobile
reject 5: testing surfaced a regression in the auth flow
defer 6 awaiting-customer-feedback
skip 8
```

Parse the response. For each item: capture (action, reason) tuple. Items not mentioned default to `skip`. If parsing fails (ambiguous mapping, missing reason for reject, missing tag suffix for defer), surface the issue and re-ask.

Record decisions in the same in-session table as mode A. Proceed to Phase 5.

### Phase 5: Confirm and apply transitions

Present the batch decisions for final confirmation:

```
=== CLOSE CEREMONY DECISIONS ===

Close (transitioning to <mapping.states.closed>):
  Feature #20204 -- 6d in Resolved -- "Barcode Scanning"
  Bug #38400     -- 4d in Resolved -- "GTX deep-link missing"
  Story #38276   -- cascade from parent Feature #20198 Closed
  ... (count: <n> items)

Reject (transitioning to <mapping.states.active>, tag: rework):
  Feature #20206 -- "panel layout broken on mobile"
  ... (count: <n> items)

Defer (stays Resolved, tag: defer:<reason-suffix>):
  Feature #20210 -- defer:awaiting-customer-feedback
  ... (count: <n> items)

Skip (no change):
  Bug #38405 ... (count: <n> items)

Total: <count> items reviewed; <n> closing, <n> rejecting, <n> deferring, <n> skipping.
```

Use `AskUserQuestion` for the apply gate:
- `Apply all decisions`
- `Modify -- revisit specific items` (the CPO names which; dev-lead loops back to Phase 4 for those)
- `Abort -- no transitions, no report`

If `--dry-run` was set, skip the apply gate entirely: print the would-be transitions and exit without modifying any work item and without writing a ceremony report (dry-run preserves "no record of a non-decision").

On `Apply all decisions`, the dev-lead executes the transitions per item:

#### Close transition

1. Render `operation_templates.work_item_update`: state -> `mapping.states.closed`. When `state_asymmetries` indicates the host collapses Closed into Resolved, set the host state to its closest equivalent (typically the same Resolved state) and also apply the `strap:closed` tag.
2. Audit comment via `operation_templates.work_item_comment_add`:

   > `[STRAP/agent:dev-lead] State: resolved -> closed (via /close-ceremony). Closed By: <invoker>. Verified value delivered.`

#### Reject transition

1. Read existing tags via `operation_templates.work_item_read`. Append `rework`.
2. Render `operation_templates.work_item_update`: state -> `mapping.states.active`, tags -> the augmented list. Apply `strap:active` tag if `state_asymmetries` indicates collapse.
3. Audit comment:

   > `[STRAP/agent:dev-lead] State: resolved -> active (via /close-ceremony). Reason: <reason>. Tag rework added. Returning to Active for repair.`

#### Defer transition

1. Read existing tags. Append `defer:<reason-suffix>`.
2. Render `operation_templates.work_item_update`: tags -> the augmented list. State stays at `mapping.states.resolved` (no state change).
3. Audit comment:

   > `[STRAP/agent:dev-lead] Resolved (deferred via /close-ceremony). Reason: <reason>. Tag defer:<reason-suffix> added. Item stays at Resolved.`

#### Skip transition

No change. No audit comment.

For each transition, log a one-line entry in the in-session apply log. If any individual transition fails: capture the failure with item id + host error verbatim, continue with the rest of the batch, surface the failures at the end so the CPO can investigate.

### Phase 6: Write the ceremony report

Path: `.claude/strap/state/close-ceremonies/<YYYYMMDD>-<HHMMSS>.md`. Create the directory if absent. Atomic write (temp file + move).

```markdown
---
ceremony_date: <YYYY-MM-DD>
invoker: <name>
mode: <apply | dry-run>
items_reviewed: <count>
filters: type=<v>, owner=<v>, days=<v>
---

# Close Ceremony -- <date>

## Closed (<count> items)

- <Type> #<id> "<title>" -- <n>d in Resolved [, testing:<tag> if present]
- ...

## Rejected (<count> items)

- <Type> #<id> "<title>" -- Reason: <reason>
- ...

## Deferred (<count> items)

- <Type> #<id> "<title>" -- defer:<reason-suffix>
- ...

## Skipped (<count> items)

- <Type> #<id> "<title>"
- ...

## Apply failures (<count> items)

- <Type> #<id>: <host error>
  ... (only present when failures occurred)

## Value delivered this ceremony

- Closed: <n> Features + <n> Enhancements + <n> Bugs + <n> Stories = <total> items
- Median days-in-Resolved at close: <n>d
- Longest age closed: <Type> #<id> at <n>d

## Next ceremony

Recommended in 7 days. Run `/close-ceremony --days 7` to see only items aged at least a week.
```

If mode was `dry-run`: do NOT write the report -- dry-run is a preview, not an audit record.

If mode was `apply` but the CPO aborted at Phase 5: also do NOT write the report (no record of a non-decision).

### Phase 7: Print summary

```
/close-ceremony complete: <closed> closed, <rejected> rejected, <deferred> deferred, <skipped> skipped.

Closed value:
  Features:       <n>
  Enhancements:   <n>
  Bugs:           <n>
  Stories:        <n>

Items returning to Active for rework:
  #<id> -- <reason>
  ...

Items deferred (stay at Resolved with tag):
  #<id> -- defer:<reason>
  ...

Ceremony report: .claude/strap/state/close-ceremonies/<file>.md

Recommended next:
  - /dora-collect && /dora-report to refresh metrics with the new closures (when those skills are wired)
  - Items returning to Active appear in the next sprint's Active queue; consider /plan-sprint to re-allocate
  - Deferred items: revisit when the deferral reason resolves (track in a CPO follow-up)
```

## Cascade behavior

`/close-ceremony` does NOT auto-cascade. Each item is decided individually by the CPO. Two specific cascade hints surface in the per-item view but require explicit CPO action:

- **Story under already-Closed Feature**: the per-item display flags this with `Recommendation: close (cascade from parent Closed)`. The CPO still chooses the action; the recommendation is informational.
- **Feature with all child Stories Closed**: the per-item display flags `Children: <n>/<n> Closed` so the CPO sees the chain is complete. The Feature still requires explicit close.

The `/dora-reconcile` Pass A daily cascade lands the forward-only "all children Closed -> parent Resolved" relationships separately. `/close-ceremony` is the manual Resolved -> Closed gate that complements that daily reconcile.

## Optional `testing:*` gate (deferred; documented but not enforced in v2.2)

A future iteration can soft-gate close decisions on `testing:*` tags:

- Feature/Enhancement without `testing:uat-passed` -> warn before closing.
- Bug with `env:prod` and without `testing:prod-passed` -> warn before closing.
- Bug with `env:uat` and without `testing:uat-passed` -> warn before closing.

The gate is soft -- the CPO can override with explicit confirmation. v2.2 documents the pattern but does not enforce it; the testing-tag set is project-specific and adopters declare their own conventions. When ready to enforce, add a `--gate-testing` flag that opts in.

## Outputs

- Resolved -> Closed transitions for every item the CPO chose to close, applied via `operation_templates.work_item_update`. `strap:closed` tag applied where the host state machine collapses per `state_asymmetries`.
- Resolved -> Active transitions for every rejected item, with `rework` tag added and the CPO's reason captured in a `[STRAP/agent:dev-lead]` audit comment.
- Deferred items stay at Resolved with a `defer:<reason-suffix>` tag and an audit comment recording the deferral.
- A ceremony report at `.claude/strap/state/close-ceremonies/<date>-<HHMMSS>.md` capturing every decision and the closure value delivered.
- A structured stdout summary delivered to the CPO with counts per decision class and recommended next steps.

## Quality gates

The skill is successful when all of the following hold:

- devops-connection.yaml was present at pre-flight.
- The CPO explicitly approved the apply gate (Phase 5) before any transitions landed -- the skill never auto-closes.
- `--dry-run` previewed without modifying any work item and without writing a ceremony report.
- Every rejected item carries a non-empty reason (one-line text); no silent rejects.
- Every deferred item carries a non-empty `defer:<reason-suffix>` tag; no silent defers.
- Every transition has a corresponding `[STRAP/agent:dev-lead]` audit comment via `operation_templates.work_item_comment_add`.
- The `strap:closed` tag was applied to closed items where the host state machine collapses per `state_asymmetries`.
- The ceremony report exists at the canonical path when mode was `apply` (and was NOT written for `dry-run` or aborted runs).
- Individual transition failures are captured in the report's "Apply failures" section without halting the batch.

## Failure handling

- **devops-connection.yaml missing**: stop. Recommend `/connect-devops-project`.
- **`mapping.states.closed` undeclared**: warn at start, proceed using the state-asymmetry tag fallback (`strap:closed`). Do not refuse.
- **`mapping.states.resolved` undeclared**: stop. This is a configuration defect -- Resolved must be representable for the ceremony to make sense.
- **Zero Resolved items returned**: print "Nothing to close. Inbox zero." and exit cleanly. No report written.
- **Batch parsing failure** (mode B response is ambiguous or missing reasons): surface the specific issue, re-ask for that subset of items, do not guess.
- **Individual transition fails** (host error, conflict, permission): log the failure inline, continue with the remaining batch, surface all failures at end. The ceremony report's "Apply failures" section captures them.
- **CPO aborts at Phase 5 confirmation**: no transitions applied; no ceremony report written; exit cleanly.
- **`operation_templates` rendering produces malformed requests**: surface the failing template path and request body; do not execute. Halt the ceremony.
- **HTML conversion fails on an audit comment**: surface the offending content; do not post raw markdown into an HTML-flavored field. Continue the batch by recording the failure and proceeding.

## Recommended cadence

- **Weekly** -- the default. `/close-ceremony` with no filters; walks every Resolved item across types.
- **Sprint boundary** -- after `/rebalance-sprint` runs, if it surfaces Resolved items aged > 14 days. Run `/close-ceremony --days 14` before sprint planning so the new sprint starts with a clean Resolved set.
- **Pre-release** -- `/close-ceremony --dry-run` to preview everything outstanding that should be closed before a release window. Then run apply mode against the items the CPO is willing to commit to closing.
- **On `/dora-reconcile` recommendation** -- Pass D surfaces "items pending Closed > 14 days" and explicitly recommends invoking this skill when the count crosses 5.

## References

- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- dev-lead guardrails: [`../../strap/rules/agents/dev-lead.md`](../../strap/rules/agents/dev-lead.md).
- agent-ops team rules: [`../../strap/rules/agent-ops.md`](../../strap/rules/agent-ops.md).
- Project profile (area-path root, conventions): [`../../strap/contexts/project-profile.md`](../../strap/contexts/project-profile.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Upstream signals: `/execute-sprint`, `/fix-bugs`, `/quick`, `/refine-pr` -- the workflow skills that transition items to Resolved.
- Downstream skill: `/dora-reconcile` -- daily cascade (Stories -> Resolved when all child Tasks Resolved; Features/Enhancements -> Resolved when child Stories Resolved AND PR merged); also surfaces "items pending Closed > 14d" as a hint to invoke this skill.
- Companion DORA skills: `/dora-collect`, `/dora-report` -- consume the closed-items set this ceremony produces.
- Onboarding design (connection-profile schema source-of-truth): [`../../strap/contexts/onboarding-design.md`](../../strap/contexts/onboarding-design.md).
- Connection-profile authoring skill: [`../connect-devops-project/SKILL.md`](../connect-devops-project/SKILL.md).
