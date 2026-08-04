---
name: /file-bugs
description: Investigate informal Bug or Enhancement descriptions, classify them, draft tickets, and create Bug or Enhancement work items in the host work-tracker. Dev-lead dispatches spec-lead (or req-lead) serial-Task read-only for investigation + classification + drafting; dev-lead persists with v2.2 lifecycle metadata (Authored By, AI tag, strap:<logical-type> tag) via the configured work-tracking connection profile.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
---

# /file-bugs

## Purpose

Convert informal CPO input -- a list of issues, a screenshot of a broken UI, a one-line gripe -- into structured Bug and Enhancement work items in the host work-tracker. The dev-lead dispatches an intake specialist (typically spec-lead) read-only to investigate the codebase, identify root causes, classify each item, and draft tickets against the bug template. The dev-lead persists with v2.2 lifecycle metadata + tags after CPO approval.

This is the lightweight intake path for defects and additive changes that do not need to traverse the full Requirement/Spec pipeline. Use [`/new-requirement`](../new-requirement/SKILL.md) instead when the input describes a business need that warrants a Requirement-Spec-Feature decomposition.

The skill ships portable. Every adopter-specific concern resolves at runtime:

- Work-tracking operations render through `operation_templates.<op>` in `.claude/strap/state/devops-connection.yaml`
- Type, state, field, link, and parent mappings come from `mapping.*` in the same profile
- Enhancement support is gated on `mapping.work_item_types.enhancement` presence; absent -> degrade to Bug with explicit marker
- Severity and (when supported) environment fields are persisted via `mapping.fields.severity` / `mapping.fields.environment`
- Markdown-to-HTML conversion is applied at the boundary for HTML-flavored description fields
- Lifecycle authorship metadata (`Authored By`, `Authored At`) is rendered into the bug description body at creation; creation audit lives in a work-item comment tagged `[STRAP/agent:dev-lead]`

## Owner

**dev-lead.** spec-lead is dispatched as a serial-Task specialist for investigation + classification + drafting. (req-lead may be substituted when the input is closer to a Requirement-shaped intake and the CPO explicitly directs the substitution; default is spec-lead.) The dev-lead owns the CPO conversation, the persistence calls, and the state transitions directly.

## Inputs

- `$ARGUMENTS` -- the CPO's informal description of bugs, enhancements, or visual evidence. Free-form prose. Required. May reference attached screenshots; the dispatched specialist reads them via `Read`.
- `.claude/strap/contexts/project-profile.md` -- source of truth for active domains (informs which areas of the codebase to investigate).
- `.claude/strap/state/devops-connection.yaml` -- connection profile. Required fields used by this skill: `mapping.work_item_types.bug.host_type`, `mapping.work_item_types.enhancement` (optional -- presence drives Enhancement support), `mapping.field_formats.description`, `mapping.states.new`, `mapping.fields.severity`, `mapping.fields.environment` (optional), `mapping.default_parents.bug` (optional; falls back to `mapping.default_parents.feature`), `operation_templates.work_item_create`, `operation_templates.work_item_comment_add`, `operation_templates.iteration_list` (when capabilities declare supported).
- `.claude/strap/templates/work-items/bug.template.md` -- description body template.

## Pre-flight

1. **devops-connection.yaml present.** If missing, redirect to `/connect-devops-project`.
2. **Bug logical type supported.** Check `mapping.work_item_types.bug.host_type`. Bug is universally supported; absence indicates a configuration defect -- surface verbatim and stop.

## Workflow

### Phase 1: Establish context

1. **Resolve the bug parent.** Read `mapping.default_parents.bug` from devops-connection.yaml. If absent, fall back to `mapping.default_parents.feature` (the documented default). If both are absent, surface the gap and ask the CPO whether to set the parent now (one-line edit to devops-connection.yaml) or specify per-Bug ad-hoc for this run.

2. **Resolve the current iteration (optional).** When `capabilities.iteration_list: supported`, render `operation_templates.iteration_list` and identify the current iteration (host-defined "current" semantics). New Bugs and Enhancements default to the current iteration unless the CPO directs otherwise. When `iteration_list` is unsupported, skip -- the items are filed without iteration assignment and the CPO can allocate later via `/plan-sprint`.

3. **Check Enhancement support.** Inspect `mapping.work_item_types.enhancement`. Presence -> Enhancement logical type is available. Absence -> the Phase 2 classification degrades any Enhancement to a Bug with an explicit marker (see Enhancement degradation).

4. **Check environment-field support.** Inspect `mapping.fields.environment`. The presence/absence of this field changes WHICH signals get populated, but does NOT change WHETHER environment is captured -- per v2.5-polish #39919, environment is ALWAYS captured via an `env:<value>` tag added to every Bug by Phase 4, regardless of `mapping.fields.environment` declaration. The env-tag is the universal signal that drives the DORA-4 takeaway block (Change Failure Rate + Mean Time To Restore) in `/dora-report`; tags work on every host. The field-existence check now determines:
   - **`mapping.fields.environment` present**: the captured environment is written to both the `env:<value>` tag AND the `Custom.Environment` field. Adopters with the field declared get both signals.
   - **`mapping.fields.environment` absent**: the captured environment is written ONLY to the `env:<value>` tag. STRAP never polyfills the field; the tag is the load-bearing signal for downstream `/dora-report` consumption.

### Phase 2: Dispatch the intake specialist for investigation + classification + drafting

Dispatch spec-lead via `Task` (serial, no CreateTeam, no parallel) with read-only tools palette (`Read, Grep, Glob, Bash` -- no `Write`, no `Edit`). The brief includes:

- The CPO's free-form input (`$ARGUMENTS`) verbatim, plus any referenced screenshots.
- The active domains in project-profile.md (`Status: active` entries) so the specialist knows which areas to investigate.
- The bug template (`bug.template.md`) for the body shape.
- The severity rubric.
- The Enhancement-support and environment-support flags from Phase 1.
- The required return shape.

The specialist must produce, for each issue in the input:

1. **Parsed structured understanding** -- the symptom in concrete terms (visible behavior, system state, observed output). When screenshots are referenced, capture what the screenshot shows.
2. **Codebase investigation** -- identify affected files with line numbers, the root cause OR the strongest hypothesis (explicitly distinguishing confirmed cause from hypothesis -- never present a guess as a finding), and the impact scope.
3. **Classification** as `bug` or `enhancement`:
   - `bug`: the system produces incorrect output, crashes, shows wrong data, or behaves contrary to its declared specification.
   - `enhancement`: a new capability or behavioral change that adds functionality the spec did not previously describe.
4. **Severity** (Bug) or **priority** (Enhancement), using the same 1-4 scale:
   - `1 - Critical`: data loss, security defect, full system unavailability, no workaround. (Enhancement framing: business-critical capability gap.)
   - `2 - High`: major feature broken, significant user impact, painful workaround. (Enhancement: high business value, blocked stakeholder.)
   - `3 - Medium`: feature partially broken, moderate impact, reasonable workaround. (Enhancement: moderate value, non-blocking.)
   - `4 - Low`: cosmetic issue, minor inconvenience, easy workaround. (Enhancement: nice-to-have, polish.)
5. **Repro Steps** (Bug) -- numbered, deterministic, replayable without ambiguity.
6. **Expected vs Actual** (Bug) -- concrete on both sides; Expected anchored to a Spec or documented contract.
7. **Environment** (Bug; always required as of v2.5-polish #39919) -- the specialist INFERS the environment per-Bug from the CPO's input + referenced screenshots + codebase context when evident (e.g., a screenshot of the prod URL, an error message mentioning a staging tenant, a stack trace from a dev-local container). Inference shapes:
   - Confident inference -> set `bug.environment` to one of `production` / `staging` / `development` (or a custom string when the input clearly names a non-standard slot like `uat`, `integration`, `tenant-foo`).
   - No signal in the input -> set `bug.environment: null`. The dev-lead's Phase 3.5 gate will ask the CPO explicitly.
   The specialist's inference is a Recommended pre-selection only; the CPO confirms or overrides in the Phase 3.5 environment-confirmation gate before persistence. Include build/release identifier, runtime version, and tenant context in the description body when the input mentions them.
8. **Linked artifacts** -- Specs whose ACs the actual behavior violates; Features that own the affected functionality; recent Stories that may have introduced a regression (identified by reading the relevant change history).
9. **Clarifying questions** -- batched, when intent is ambiguous. The specialist must NOT guess at desired behavior; ambiguity surfaces to the dev-lead, who surfaces to the CPO.
10. The `tokens_used: ~XXk` finishing-summary line.

For Enhancements: the specialist produces a lighter description (Overview, Business Case, Current Behavior, Desired Behavior, Affected Files) and uses the priority scale instead of severity. (The bug template is not rendered for Enhancements; the description is rendered inline by the dev-lead at Phase 4.)

The dispatch is serial -- one specialist invocation that covers all items in the input. Drafting is a tight conversational pass; parallelizing across items rarely pays off and complicates reconciliation.

### Phase 3: Present draft tickets for CPO approval

Present every drafted ticket to the CPO in a single summary table BEFORE creating any work item:

```
| # | Type        | Title                                  | Sev/Pri | Inferred env | Root cause summary | Affected files |
|---|-------------|----------------------------------------|---------|--------------|--------------------|----------------|
| 1 | Bug         | <title>                                | Sev 2   | production   | <one-line>         | <list>         |
| 2 | Enhancement | <title>                                | Pri 3   | -            | <one-line>         | <list>         |
| 3 | Bug (degraded from Enhancement) | <title>    | Sev 3   | (unknown)    | <one-line>         | <list>         |
```

The Inferred env column shows the spec-lead's per-Bug inference (or `(unknown)` when no signal was available in the input). This is a Recommended pre-selection; the CPO confirms or overrides in the per-Bug environment-confirmation gate at Phase 3.5. Surface degraded items prominently (see Enhancement degradation). Surface any clarifying questions the specialist returned.

Use `AskUserQuestion` for the approval gate. Options (nominal-label decision; no previews):
- `Approve all and create`
- `Modify before creating` -- the CPO names which items to adjust (reclassify, change severity, rewrite title/description, merge, split, remove). Re-dispatch the specialist with directive feedback if codebase re-investigation is needed; otherwise the dev-lead applies the edit directly. Re-present the table after edits.
- `Reject all` -- exit cleanly with no persistence.

### Phase 3.5: Environment-confirmation gate (v2.5-polish #39919)

After Phase 3 approval, before Phase 4 persistence, the dev-lead runs an `AskUserQuestion` per Bug to confirm the environment value that will be tagged. The Bug being asked about is identified by id + title; the spec-lead's inference (when available) is the Recommended pre-selection.

```yaml
AskUserQuestion:
  header: "Bug environment"
  question: "Which environment does '<title>' belong to? Used to tag the Bug with `env:<value>`, which drives MTTR + Change Failure Rate in /dora-report."
  options:
    - label: "Production (Recommended)"           # Recommended marker applied to the spec-lead's inference when present, else to Production by default since prod Bugs drive the DORA-4 takeaway metrics
      description: "Tag as env:production. Bugs in this environment count toward Change Failure Rate + MTTR. Pick when the issue was observed in your live production environment."
    - label: "Staging"
      description: "Tag as env:staging. Use for pre-prod environments (UAT, staging slot, release-candidate testing)."
    - label: "Development"
      description: "Tag as env:development. Use for dev-local issues, CI failures, local environment bugs. Not counted toward DORA-4 metrics."
```

The CPO's choice is the final `bug.environment` value, overriding any spec-lead inference. `AskUserQuestion`'s built-in `Other` option accepts free-text input for non-standard environment names (`uat`, `integration`, `tenant-foo`, custom slot names). The dev-lead normalizes the typed value into a tag-safe slug: lower-case, alphanumeric + hyphens only, e.g., `Tenant Foo` -> `env:tenant-foo`.

Recommended marker logic:
- When the spec-lead inferred production / staging / development -> the matching option gets the marker.
- When the spec-lead inferred a non-standard value (`uat`, etc.) -> NO Recommended marker on Production / Staging / Development; the CPO either picks one of those or types the spec-lead's inference via Other.
- When the spec-lead returned null inference -> Production gets the marker (DORA-default; the CPO either confirms or picks another).

For a batch of N Bugs, the dev-lead runs N AskUserQuestion invocations sequentially. The reduction in friction comes from spec-lead's per-Bug inference being correct most of the time -- the CPO clicks through Recommended for the bugs where inference was right and only intervenes on the ones where it wasn't.

### Phase 4: Persist work items with v2.2 lifecycle metadata

On approval, for each approved ticket the dev-lead persists:

1. **Render the description body.**

   - **Bugs**: render `bug.template.md` with the lifecycle-metadata placeholders and the bug-specific placeholders the specialist supplied. The template embeds the v2.2 lifecycle-metadata block via Mustache placeholders followed by the type-specific content sections.

     - `authored_by` -> `spec-lead` (or `req-lead` if the substitution was used)
     - `authored_at` -> ISO-8601 timestamp at the moment of persistence
     - `completed_by` -> `_(set at resolution)_`
     - `completed_at` -> `_(set at resolution)_`
     - `environment_supported` -> the boolean from Phase 1
     - Bug-specific placeholders: `bug.title`, `bug.repro_steps`, `bug.expected`, `bug.actual`, `bug.severity`, `bug.environment` (when supported), `bug.linked_artifacts`, `bug.root_cause`, `bug.affected_files`, `bug.impact`

   - **Enhancements**: render an inline description with the lifecycle-metadata table at the top (same `authored_by` / `authored_at` / `completed_by` / `completed_at` placeholders), followed by sections for Overview, Business Case, Current Behavior, Desired Behavior, Affected Files, and Priority.

2. **Convert markdown to HTML at the boundary.** If `mapping.field_formats.description` is `html`, convert the rendered body. If `markdown`, pass through unchanged. Conversion mechanism is a runtime detail; the contract is that what reaches the host renders cleanly.

3. **Render `operation_templates.work_item_create`** with placeholders:
   - `{{host_type}}` -> `mapping.work_item_types.bug.host_type` (or `enhancement.host_type` when the type is Enhancement and supported)
   - `{{title}}` -> the CPO-confirmed title
   - `{{description}}` -> the rendered description body (HTML or markdown per the conversion rule)
   - `{{parent_id}}` -> the resolved Bug parent from Phase 1 (or the per-Bug override from CPO)
   - `{{area_path}}` -> from devops-connection.yaml's `mapping.area_path_root` or as overridden by the CPO
   - `{{iteration_path}}` -> the resolved current iteration from Phase 1 (or unset if `iteration_list` is unsupported or the CPO declined the default)
   - `{{state}}` -> `mapping.states.new`
   - `{{tags}}` -> `AI; strap:bug; file-bugs; env:<value>` for Bugs (or `AI; strap:enhancement; file-bugs; env:<value>` when supported; or `AI; strap:bug; strap:degraded-enhancement; file-bugs; env:<value>` for degraded items). The **`file-bugs`** source-attribution tag marks the proper structured-intake path (mirrors `quick` on `/quick`-filed Bugs and `full-auto` on `/execute-sprint-full-auto`-created chains; absence-of-all-three is the manual-entry signal for downstream `/dora-report` intake-hygiene breakdown). The `env:<value>` tag is the CPO-confirmed environment from Phase 3.5, normalized to a tag-safe slug. This tag is the universal signal /dora-report reads to attribute Bugs to environments for Change Failure Rate + MTTR computation (per v2.5-polish #39919); it lands on every Bug filed through this skill regardless of host capabilities.
   - Additional fields: `mapping.fields.severity` populated for Bugs; `mapping.fields.environment` populated for Bugs when environment-supported, using the same CPO-confirmed value that landed on the env:* tag. Field + tag carry redundant signals when both exist; downstream `/dora-collect` reads either.

4. **Execute via the connection profile's transport.** Capture the host work-item id on the response.

5. **Post the creation audit comment** via `operation_templates.work_item_comment_add`:

   > `[STRAP/agent:dev-lead] State: <none> -> new (via /file-bugs). Authored By: spec-lead. <Bug | Enhancement | Degraded Enhancement>; Severity/Priority: <n>.`

6. **Link to artifacts the specialist identified.** For each linked Spec / Feature / Story in `bug.linked_artifacts`, render `operation_templates.work_item_link_add` with `link_type` -> `mapping.link_types.related` and execute.

### Phase 5: Assignment and summary

After every work item is created, ask the CPO who each ticket should be assigned to (single assignee per ticket; default unassigned). For each ticket with an assignment, render `operation_templates.work_item_update` with the `assigned_to` field populated per `mapping.fields.assigned_to`.

Present the final summary table:

```
| Id     | Type        | Title    | Sev/Pri | Env (tag)         | Assignee | Iteration | Host URL |
|--------|-------------|----------|---------|-------------------|----------|-----------|----------|
| 12345  | Bug         | <title>  | Sev 2   | env:production    | <user>   | <sprint>  | <url>    |
```

The Env column shows the captured `env:<value>` tag so the CPO can spot-check which Bugs will count toward MTTR + CFR in the next `/dora-report` run. Bugs tagged `env:production` drive the DORA-4 takeaway block; other environments stay in the snapshot for completeness but don't pull through to the headline DORA cards.

When any Bug landed with `env:production` (the DORA-impact case), surface a one-line note:

> N Bug(s) tagged env:production. These will count toward Change Failure Rate + Mean Time To Restore in the next `/dora-report`.

Recommend next steps:
- `/fix-bugs <ids>` to implement the bug fixes in a coordinated pass.
- `/plan-sprint <feature-id>` if the Bugs are scoped under a Feature that needs sprint allocation.

## Enhancement degradation

When `mapping.work_item_types.enhancement` is absent from the connection profile, every item classified as an Enhancement in Phase 2 is degraded:

1. **File the item as a Bug** with severity inferred from the assessed Enhancement priority (Pri 1 -> Sev 1, Pri 2 -> Sev 2, etc.).
2. **Prepend an explicit degradation block to the description**, above the Repro Steps section, clearly marked:

   ```
   > **Degraded Enhancement.** The host work-tracker does not support the `enhancement` logical type.
   > This item is filed as a Bug to preserve traceability. Original classification: Enhancement
   > (Priority <n>). Downstream agents should treat the Repro Steps as Current Behavior, Expected as
   > Desired Behavior, and Actual as the gap to close.
   ```

3. **Tag with `strap:bug; strap:degraded-enhancement`** so downstream agents and reports can distinguish degraded items.
4. **Surface the degradation prominently to the CPO** in the Phase 3 draft table. The CPO sees the substitution and can override (split, change scope, drop) before approving.

The skill never silently rewrites Enhancements as Bugs. Every degradation is visible at the approval gate and in the persisted artifact.

## Outputs

- One work item per approved ticket in the host work-tracker, parented to the Bug parent (or per CPO override), in `mapping.states.new`.
- Each item carries the v2.2 lifecycle-metadata block at the top of its description (`Authored By: spec-lead` or `req-lead`; `Authored At: <ts>`).
- Each item carries the `AI` tag, the appropriate `strap:<logical-type>` tag (`strap:bug`, `strap:enhancement`, or `strap:bug; strap:degraded-enhancement`), the **`file-bugs`** source-attribution tag (marks the structured-intake path; symmetric with `quick` on `/quick`-filed Bugs and `full-auto` on `/execute-sprint-full-auto` chains), AND -- for Bugs -- the CPO-confirmed `env:<value>` tag (v2.5-polish #39919; universal signal that drives DORA-4 Change Failure Rate + MTTR computation in `/dora-report`).
- Severity persisted via `mapping.fields.severity` for Bugs; environment persisted via `mapping.fields.environment` when supported (in addition to the env:* tag).
- Linked-artifact relations recorded via `operation_templates.work_item_link_add`.
- A `[STRAP/agent:dev-lead]` creation comment on every persisted item.
- A final summary table delivered to the CPO with ids, titles, severities/priorities, assignees, iteration, and host URLs.

## Quality gates

The skill is successful when all of the following hold:

- devops-connection.yaml was present and Bug logical type was supported at pre-flight.
- The dispatched specialist ran read-only (no Write, no Edit). Investigation is planning, not implementation.
- Every approved ticket has a corresponding work item with the CPO-confirmed title.
- Every Bug description includes Repro Steps, Expected vs Actual, root cause (distinguishing confirmed from hypothesis), and affected files with line numbers where possible -- actionable tickets that `/fix-bugs` can implement without re-investigating.
- Every Enhancement filed against an Enhancement-supporting host uses the `enhancement` logical type; every Enhancement filed against a non-supporting host is degraded with the explicit marker and `strap:degraded-enhancement` tag.
- Every persisted item carries the v2.2 metadata block at the top of its description.
- Every persisted item carries the `AI` tag, the appropriate `strap:<logical-type>` tag, AND the `file-bugs` source-attribution tag.
- Markdown-to-HTML conversion was applied for HTML-flavored hosts.
- Every persisted item has a `[STRAP/agent:dev-lead]` creation comment recording the authorship and the classification.
- The CPO has the final summary table with all work item ids.

## Failure handling

- **devops-connection.yaml missing**: stop. Redirect to `/connect-devops-project`.
- **`mapping.work_item_types.bug.host_type` missing**: stop. Bug is universally supported; absence is a configuration defect. Surface verbatim.
- **Bug parent unresolved** (`default_parents.bug` and `default_parents.feature` both missing): ask the CPO whether to set `default_parents.bug` now (one-line edit) or specify per-Bug ad-hoc for this run.
- **`operation_templates` rendering produces malformed requests**: surface the failing template path and request body; do not execute the malformed call.
- **HTML conversion fails**: surface the offending content; do not post raw markdown into an HTML-flavored field.
- **`work_item_create` returns a transient error with no confirmation**: render `operation_templates.work_item_query` against parent + title to check for partial creation before retrying (avoids duplicates).
- **The CPO declines all drafted tickets**: exit cleanly with no persistence.
- **Specialist times out or errors during dispatch**: surface the gap; offer to re-dispatch with a tightened brief.

## References

- Source input: `$ARGUMENTS` (CPO's free-form bug/enhancement description).
- spec-lead role contract: [`../../agents/agent-ops/spec-lead.md`](../../agents/agent-ops/spec-lead.md).
- req-lead role contract (optional substitute): [`../../agents/agent-ops/req-lead.md`](../../agents/agent-ops/req-lead.md).
- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- dev-lead guardrails: [`../../strap/rules/agents/dev-lead.md`](../../strap/rules/agents/dev-lead.md).
- agent-ops team rules: [`../../strap/rules/agent-ops.md`](../../strap/rules/agent-ops.md).
- Project profile (active domains): [`../../strap/contexts/project-profile.md`](../../strap/contexts/project-profile.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Bug template: `.claude/strap/templates/work-items/bug.template.md`.
- Downstream skills: [`../fix-bugs/SKILL.md`](../fix-bugs/SKILL.md), [`../plan-sprint/SKILL.md`](../plan-sprint/SKILL.md).
- Connection-profile schema source-of-truth: [`../connect-devops-project/SKILL.md`](../connect-devops-project/SKILL.md).
- Onboarding design (connection-discovery model + profile shape): [`../../strap/contexts/onboarding-design.md`](../../strap/contexts/onboarding-design.md).
