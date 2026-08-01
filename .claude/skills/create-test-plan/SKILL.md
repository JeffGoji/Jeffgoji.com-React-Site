---
name: /create-test-plan
description: Author an end-to-end test plan for a Spec or Feature and (optionally) scaffold initial test files. The dev-lead dispatches ux-test-engineer as a serial-Task specialist to read the Spec / Feature, the codebase under the active e2e domain's Source-of-truth paths, and the project-profile.md Conventions; produce a structured test plan covering scope, scenarios, fixtures, and risks; and optionally scaffold runnable test files in the configured test paths. CPO approval at every gate. Re-runnable.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
---

# /create-test-plan

## Purpose

Drive the test-plan-as-contract workflow for a Spec or Feature with end-to-end test scope. The dev-lead dispatches the ux-test-engineer specialist to read the source-of-truth artifacts (Spec body, linked Requirement, current codebase under the active e2e domain's `Source-of-truth` paths), produce a structured test plan covering scope / scenarios / fixtures / risks, and (optionally) scaffold initial runnable test files in the configured test paths. The CPO approves the plan; the dev-lead writes the persisted test-plan section back to the Spec (or Feature) on Approve.

This skill is the **e2e equivalent of `/create-mockups`**: same dispatch shape (serial-Task specialist with read-write tools palette inside a configured output path), same approval gate, same re-runnable iteration loop. The ux-test-engineer becomes the third closing-phase write-exception alongside designer (in `/create-mockups`) and tech-writer (in `/strap-in` + `/strap-refresh` Section 9). Outside this skill, ux-test-engineer runs read-only like every other specialist.

The skill ships portable. Stack-specific concerns resolve at runtime from `project-profile.md`'s active e2e domain entry: `Source-of-truth` paths declare where production e2e tests already live (ux-test-engineer reads them for naming + structure consistency), `Conventions` declares framework + test-runner command + selector idioms + multi-tenant test discipline, and an optional `Test plan paths` field tells the skill where to write scaffolded test files. Absent declared paths, the skill falls back to the active e2e domain's first `Source-of-truth` path joined with a `test-plans/spec-<id>/` or `test-plans/feature-<id>/` subdirectory.

## Owner

**dev-lead.** When the skill is invoked the orchestrator IS the dev-lead. The ux-test-engineer is dispatched as a serial-Task specialist for the read / draft / iterate / present work. Per the agent-devs single-curator rule, only the dev-lead writes the persisted test-plan section back to the host; ux-test-engineer reports the structured plan content as a SendMessage payload and the dev-lead persists it on CPO approval.

## Inputs

- `$ARGUMENTS` -- either a Spec work item id, a Feature work item id, or a feature name (free-text), optionally followed by a directive in quotes. Examples:
  - `/create-test-plan 12345` (Spec or Feature id)
  - `/create-test-plan 12345 "focus on multi-tenant isolation scenarios"`
  - `/create-test-plan "audit log search and export"` (feature-name mode -- no work item yet)
- `.claude/strap/contexts/project-profile.md` -- source of truth for the active e2e domain entry (specialists, `Source-of-truth` paths, `Conventions`, optional `Test plan paths`, optional multi-tenant flag).
- `.claude/strap/state/devops-connection.yaml` -- connection profile. Required fields: `mapping.work_item_types.{spec,feature}.host_type`, `mapping.field_formats.description`, `operation_templates.{work_item_read,work_item_update,work_item_comment_add}`. Required only in Spec / Feature id modes; the feature-name mode does not persist back to the host.
- `.claude/strap/state/usage.yaml` -- runtime budget state. Read at workflow start; see [Budget enforcement](#budget-enforcement).
- `.claude/strap/templates/work-items/specification.template.md` -- the body template used when re-rendering on Spec persist. The Feature body re-renders via `.claude/strap/templates/work-items/feature.template.md` when Feature mode is in play.

## Pre-flight

1. **devops-connection.yaml present** (Spec / Feature id modes only). If missing, redirect to `/connect-devops-project`. Feature-name mode (no id) skips this check.
2. **Active e2e domain in `project-profile.md`.** The `Domains` section must carry a `Status: active` H3 entry whose `Specialists` field includes `ux-test-engineer`. The e2e domain entry's `Conventions` must declare the test framework and the test-runner command. If absent (no e2e domain, or the domain is dormant), redirect to `/strap-refresh` so the dev-lead can run the domain-activation gate with the CPO.
3. **`project-profile.md` is curated** (sentinel stripped). If scaffold, redirect to `/strap-in`.

## Workflow

### Phase 1: Resolve the target

Identify what the test plan is for:

- **Spec id mode**: render `operation_templates.work_item_read` with `id=<spec-id>` and execute. Capture title, type, state, description, linked Requirement, tags. Validate that the item is a `spec` (via `strap:spec` tag or `mapping.work_item_types.spec.host_type` match) AND in `mapping.states.resolved`. If not Resolved, refuse and recommend `/refine-spec <spec-id>` first.
- **Feature id mode**: same read; validate as `feature`. Feature state may be `new` / `active` / `resolved` -- all acceptable since test plans frequently land alongside Feature decomposition.
- **Feature-name mode** (no id): the CPO is exploring scope before any work item exists. The test plan lands as a markdown file on disk (`<test-plan-paths>/feature-name-<slug>.md` or `.claude/strap/test-plans/feature-name-<slug>.md` as fallback); no host persistence happens. Useful for pre-Spec test-thinking that informs Requirement drafting.

For Spec mode: also read the linked Requirement (via the `related` link) for the original problem framing -- ux-test-engineer's scenario brainstorming benefits from the upstream user-need context.

### Phase 2: Detect first-run vs iteration mode

Resolve the test plan target path:

1. Look up the active e2e domain entry in `project-profile.md`. If it declares a `Test plan paths` field, use the first declared path joined with `spec-<spec-id>/` (or `feature-<feature-id>/` or `feature-name-<slug>/`).
2. Otherwise, fall back to the first declared `Source-of-truth` path on the e2e domain joined with `test-plans/spec-<spec-id>/`.
3. If no `Source-of-truth` paths are declared (rare; suggests the e2e domain is mis-curated), fall back to `.claude/strap/test-plans/spec-<spec-id>/`.

Check whether the directory exists and contains a `test-plan.md` file or scaffolded test files:

- **First-run mode**: directory absent or empty. The skill runs the full flow: read source-of-truth -> draft plan -> optionally scaffold -> present.
- **Iteration mode**: directory present with prior plan content. The skill skips the source-of-truth re-read (ux-test-engineer reuses the prior plan as the starting point). The directive from `$ARGUMENTS` (when supplied) is the brief; if no directive is supplied, the skill enters the approval gate asking the CPO what to change.

Tell the CPO which mode the skill is running in and the target path.

### Phase 3: Dispatch ux-test-engineer

Dispatch ux-test-engineer via `Task` (serial; read-write tools palette this time: `Read, Grep, Glob, Bash, Edit, Write` -- the third closing-phase write-exception alongside designer in `/create-mockups` and tech-writer in `/strap-in` + `/strap-refresh` Section 9). The brief depends on mode.

#### First-run brief

- ux-test-engineer's role contract path (`.claude/agents/agent-ops/ux-test-engineer.md`) and operating-context paths (its rules, memory, project-profile.md, the active e2e domain entry).
- The target work item context:
  - Spec / Feature id, title, body, acceptance criteria.
  - Linked Requirement (Spec mode): the Desired Outcome + Stakeholders.
  - The Spec's Constituent Parts (the slices of work the e2e plan must cover; user-facing ACs translate to UI scenarios, backend ACs to API contract scenarios).
- The active e2e domain's `Source-of-truth` paths -- the existing e2e test suite is the prior art; ux-test-engineer reads it to match naming conventions, file structure, helper usage, and selector discipline.
- The active e2e domain's `Conventions` -- framework (Playwright / Cypress / WebdriverIO / etc.), test-runner command, mock-data idioms, multi-tenant test discipline if declared. ux-test-engineer scaffolds in the framework's idioms, not a generic one.
- The multi-tenant flag (when set in `project-profile.md` Architecture or Conventions): when on, every persisted-data scenario must include a tenant-isolation assertion. ux-test-engineer surfaces this as a structural section in the plan.
- The target test-plan path.
- The mandate to produce a structured test plan with these sections:
  - **Scope**: in-scope and explicitly out-of-scope (e2e tests cannot cover everything; surface the trade-offs).
  - **Test scenarios**: one per AC + cross-AC integration paths + key error/edge paths. Each scenario has a name, preconditions, steps, expected outcomes.
  - **Fixtures and seed data**: what mock data shapes need to exist; how they're seeded; tenant scoping if multi-tenant.
  - **Risks and gaps**: what the e2e tier can't safely cover (timing-sensitive, third-party dependency, environment-specific) and why; recommendations for unit-tier or integration-tier coverage instead.
  - **Open questions**: where the Spec / Feature didn't supply enough intent; ux-test-engineer made a best-effort call worth surfacing.
- The mandate to optionally scaffold initial test files in the framework's idiom: one file per major scenario, with the structure (describe / it blocks, page-object patterns, selector helpers) in place and the assertions stubbed. The CPO sees both the markdown plan and the scaffolded code at the approval gate.
- The mandate to NOT write to the Spec / Feature host item. The dev-lead writes the persisted test-plan section on CPO approval -- ux-test-engineer reports the persisted content as a structured payload.
- The required `SendMessage` finishing report:
  - One-line summary of the plan.
  - Files written (full paths).
  - Run instructions (literal command per the active e2e domain's `Conventions`).
  - Plan walkthrough (one short line per scenario describing what it covers).
  - Test-design decisions (non-obvious choices: selector strategy, mock-vs-real-API, parallel-vs-serial, retries, multi-tenant scoping).
  - Fixture / seed-data plan summary.
  - Risks / gaps summary.
  - Open questions.
  - Anything to curate (rule or memory entry the dev-lead should consider after the run).
  - `tokens_used: ~XXk` line.

#### Iteration brief

- ux-test-engineer's role contract + operating context (same as first-run).
- The Spec / Feature id + body (so the specialist has the prior test plan in hand from a previous run's persisted section).
- The directive from `$ARGUMENTS` (or the directive the CPO provides at the gate -- see Phase 5).
- The target test-plan path with the existing files.
- The mandate to iterate the existing plan + scaffolded files against the directive. Preserve everything else; change only what the directive requires plus any unavoidable consequences.
- The mandate to NOT re-survey the source-of-truth tests unless the directive requires it.
- The same `SendMessage` finishing report shape, with two additional fields:
  - Files changed (diff summary, not full file contents).
  - Why each change was made.

### Budget enforcement

Per [`budget-discipline.md`](../../strap/contexts/budget-discipline.md), `/create-test-plan` operates against two budgets pulled from `.claude/strap/state/usage.yaml` at workflow start. Defaults from `budget-discipline.md`'s defaults table: per-agent **200K**, session aggregate **1M**. The CPO can override via [`/revise-token-budget`](../revise-token-budget/SKILL.md).

**Dispatch-time budget pull.** After Phase 2 completes (mode detected, target path resolved) and before Phase 3 begins (ux-test-engineer dispatch):

1. Read `.claude/strap/state/usage.yaml`. Pull `budgets.create-test-plan.per_agent` and `budgets.create-test-plan.session_aggregate`. Also pull `budgets.create-test-plan.agent_overrides` if present -- per-agent overrides established via `/revise-token-budget --agent <name>` take precedence over the workflow default per `budget-discipline.md` "Dispatch-time resolution". If the `budgets.create-test-plan` row is missing (adopter installed STRAP before v2.3 and has not yet refreshed), fall back to `budget-discipline.md`'s defaults silently AND write the row to `usage.yaml` so subsequent runs honor it -- this is the same pattern `/strap-refresh` uses at Section 7 for the per-workflow budget lookup. If `usage.yaml` itself is missing, surface the gap and stop with a recommendation to run `/strap-in` or `/strap-refresh`.
2. Initialize the `session` block:
   - `session.workflow: create-test-plan`
   - `session.workflow_instance: create-test-plan-<spec-id-or-feature-id-or-slug>` (matches the per-skill instance naming convention)
   - `session.started_at: <ISO-8601 timestamp>`
   - `session.specialists_used: 0`
3. Reset `agents.ux-test-engineer.used_in_current` to `0` (preserve `agents.ux-test-engineer.last_dispatch`). Only ux-test-engineer is dispatched by this skill, so no other specialists need resetting.

**Per-agent budget in the dispatch brief.** Append a budget line to the ux-test-engineer brief (mirroring `/strap-in` Section 6). The effective `<per-agent-budget>` value resolves per `budget-discipline.md` "Dispatch-time resolution": `agent_overrides.ux-test-engineer.per_agent` if present, else `per_agent`:

> "Your budget for this dispatch is `<per-agent-budget>` tokens. Include `tokens_used: ~XXk` as the final line of your finishing summary."

**Token accounting.** When ux-test-engineer's `SendMessage` finishing report returns at Phase 4 presentation time, parse the `tokens_used: ~XXk` line. Add to `agents.ux-test-engineer.used_in_current`; sum into `session.specialists_used`. Update `agents.ux-test-engineer.last_dispatch`. Persist after each iteration completes.

**60% session-aggregate checkpoint.** When `session.specialists_used` crosses 60% of the configured session aggregate (typically after 3-4 deep iteration rounds with a heavy specialist run):

1. Surface to the CPO: "Specialists have consumed ~`<X>`K of the `<Y>`K session aggregate. Recommending checkpoint."
2. Run `/context-prep create-test-plan-<workflow-instance>` to capture in-flight workflow state (the current draft plan, scaffolded files, prior CPO feedback) in a continuation.
3. Instruct the CPO: "Run `/usage` to confirm your own window; then `/clear` and start a fresh session. On resume, run `/context-fetch create-test-plan-<workflow-instance>` first."
4. The CPO confirms or overrides.

**Per-agent exhaustion.** When `agents.ux-test-engineer.used_in_current` reaches its per-agent budget mid-workflow:

- Do NOT re-dispatch ux-test-engineer within this workflow instance.
- Work with the last landed iteration; the CPO decides whether to Approve as-is, Cancel and re-run with a higher budget via `/revise-token-budget`, or hand-edit the plan / tests directly.
- Note the exhaustion under `agents.ux-test-engineer` in `usage.yaml` (add `exhausted_at: <ISO-timestamp>`).

**Workflow-completion close-out.** At the end of Phase 7 (Hand-off), after the persisted section landed (Approve) OR the skill exited cleanly (Cancel):

- Write `session.completed_at: <ISO-8601 timestamp>` to `usage.yaml`.
- Preserve `agents.ux-test-engineer.used_in_current` as the closing value -- it gets reset at the next workflow instance's dispatch-time budget pull.

**Per-skill tuning.** `/create-test-plan` runs an interactive iteration loop with a single specialist. Per-agent exhaustion is the realistic constraint; the session aggregate binds only when a CPO drives many iteration rounds on the same plan. The 200K per-agent default suits a typical plan (~5-10 scenarios + scaffolded files in a familiar framework); large multi-tenant Specs with 20+ scenarios may benefit from a per-agent override via `/revise-token-budget --agent ux-test-engineer` for the workflow.

### Phase 4: Present the test plan to the CPO

When ux-test-engineer returns via `SendMessage`, the dev-lead presents:

```
Test plan ready at <target path>.

Plan summary: <one-line summary from the specialist's report>

Run: <literal test-runner command from the active e2e domain's Conventions>

Files:
  <full path list -- markdown plan + scaffolded test files>

Scenarios:
  - <Scenario A>: <one line>
  - <Scenario B>: <one line>
  ...

Test-design decisions:
  - <decision 1>
  - <decision 2>
  ...

Fixtures / seed data:
  - <summary>

Risks / gaps the specialist surfaced:
  - <if any>

Open questions for you:
  - <if any>

Iteration directive applied (iteration mode only):
  - <directive>
  - Files changed: <diff summary>
```

The CPO reads the plan markdown (and the scaffolded test files if scaffolding was included) and either runs the suite to validate it executes, or reviews statically.

### Phase 5: CPO approval gate

Use `AskUserQuestion`. Options (nominal labels):

- **Approve and write test-plan section** -- the plan is the contract; the dev-lead writes the persisted section to the Spec / Feature (id modes) or finalizes the on-disk path (feature-name mode).
- **Iterate -- I'll describe the changes** -- CPO provides directive feedback; the skill loops back to Phase 3 with the directive in hand (iteration-mode brief). The Approve / Iterate / Cancel loop is the working session.
- **Cancel** -- no host persistence; exit cleanly. Plan files remain on disk -- a future `/create-test-plan <id>` invocation will resume in iteration mode.

For trivial touch-ups (a scenario rename, a fixture tweak) where the CPO doesn't want full specialist ceremony, the CPO can also tell the dev-lead conversationally and the dev-lead edits the plan / scaffolded files directly without re-dispatching ux-test-engineer. The skill stays at the gate until the CPO picks `Approve` or `Cancel`.

### Phase 6: Persist the test-plan section (on Approve)

On `Approve`, persist per mode:

**Spec / Feature id modes**: the dev-lead writes a `## Test Plan` section to the work item body via `operation_templates.work_item_update`. The section includes:

1. **Pointer**: full path to the on-disk plan markdown (the implementation team reads it from there; the section body is a structured summary, not the full plan).
2. **Scope**: in-scope / out-of-scope.
3. **Scenario list**: one bullet per scenario with a one-line summary.
4. **Fixtures and seed data**: one-paragraph summary.
5. **Risks and gaps**: bullet list of e2e-tier limitations and recommended coverage tiers.
6. **Run command**: literal command from the active e2e domain's `Conventions`.
7. **Last updated**: ISO-8601 timestamp.

Parse the existing work item body's metadata block to preserve `Authored By` / `Authored At`. Re-render the appropriate template (`specification.template.md` for Spec; `feature.template.md` for Feature) with the existing metadata plus the new section. Convert markdown to HTML at the boundary if `mapping.field_formats.description` is `html`. Execute `operation_templates.work_item_update`. Apply the `strap:test-plan` tag to the work item (additive; preserves existing tags) so `/dora-collect` can identify test-plan-bearing items.

Post an audit comment via `operation_templates.work_item_comment_add`:

> `[STRAP/agent:dev-lead] Test plan approved (via /create-test-plan). Files at <target path>. Iteration count: <N>. Next: implementation will read the plan from the on-disk path.`

**Feature-name mode (no id)**: no host persistence. The on-disk plan file is the artifact; the CPO references it when the Requirement / Spec / Feature is eventually filed. The skill prints the on-disk path and a reminder to attach it to whatever work item is later created.

### Phase 7: Hand-off

Recommend the next step depending on mode:

- **Spec mode**: the Mockup Wiring Guide (from `/analyze-mockups`) and now the Test Plan are both on the Spec. `/generate-features` can run when the Spec is ready.
- **Feature mode**: `/execute-sprint <feature-id>` will pick up the test plan as part of the Feature body when the Feature decomposes into Tasks; backend-engineer / frontend-engineer Tasks reference the plan during implementation; ux-test-engineer-authored tests land alongside production code.
- **Feature-name mode**: drive the idea through `/new-requirement` (or `/quick` for small scope); when a work item is created, re-run `/create-test-plan <new-id>` to persist the plan section against it.

## Outputs

- A markdown test plan at the resolved target path (`<Test plan paths>/spec-<id>/test-plan.md` or fallback).
- Optionally scaffolded initial test files in the framework's idiom alongside the plan markdown.
- On Approve (Spec / Feature modes):
  - `Test Plan` section persisted on the Spec / Feature body via `operation_templates.work_item_update`.
  - `strap:test-plan` tag applied to the work item.
  - `[STRAP/agent:dev-lead]` audit comment on the work item recording approval + iteration count.
- On Approve (feature-name mode): no host persistence; the on-disk plan is the artifact.
- `.claude/strap/state/usage.yaml` updated with `session.completed_at`, the final `agents.ux-test-engineer.used_in_current` value, and any `exhausted_at` marker.
- A CPO-facing summary at the end with the run command, iteration count, and the recommended next step.

## Quality gates

The skill is successful when all of the following hold:

- `devops-connection.yaml` was present (Spec / Feature id modes) and the active e2e domain was active in `project-profile.md` at pre-flight.
- The target Spec was in `mapping.states.resolved` (Spec mode) OR the target Feature was in any open state (Feature mode) OR no work item was required (feature-name mode).
- Mode detection landed correctly (first-run when directory absent / empty; iteration when existing files present).
- ux-test-engineer was dispatched with the read-write tools palette into the configured test-plan path (no production code touched outside that path -- the role contract enforces this).
- Every iteration loop returned to the CPO approval gate; no host persistence landed without an explicit `Approve`.
- On Approve (Spec / Feature modes): the existing work item's `Authored By` / `Authored At` were preserved; the Test Plan section names real files (not placeholders); the audit comment landed.
- The `strap:test-plan` tag was applied (Spec / Feature modes).
- Markdown-to-HTML conversion was applied for HTML-flavored hosts.
- `tokens_used: ~XXk` reporting was captured for every ux-test-engineer dispatch (or its absence noted as a budget-tracking warning per Failure handling).
- The session aggregate stayed within budget OR the 60% checkpoint was offered to the CPO when crossed.

## Failure handling

- **`devops-connection.yaml` missing** (Spec / Feature id modes): stop. Redirect to `/connect-devops-project`.
- **Active e2e domain absent in `project-profile.md`**: stop. Redirect to `/strap-refresh` so the domain-activation gate runs cleanly with the CPO.
- **Active e2e domain present but `Conventions` does not declare the test framework or test-runner command**: surface the gap; recommend `/strap-refresh` to update the domain entry's Conventions before re-invoking.
- **Target is not a Spec or Feature, or Spec is not in Resolved state**: refuse with a clear message naming the actual type / state. For non-Resolved Specs, recommend `/refine-spec <spec-id>`.
- **ux-test-engineer fails to call `SendMessage`**: treat extended silence as wedged; recover via `/team-cleanup`; iteration files on disk are preserved for the next run.
- **Test-plan files written to an unexpected path** (specialist disregards the target-path brief): surface the deviation; reject and re-dispatch with a tighter brief.
- **CPO declines all options at the gate (Cancel)**: exit cleanly. Plan files on disk are preserved so a future `/create-test-plan <id>` invocation resumes in iteration mode.
- **`operation_templates` rendering produces malformed requests**: surface the failing template path and request body; do not execute.
- **HTML conversion fails**: surface the offending content; do not post raw markdown into an HTML-flavored field.
- **ux-test-engineer returns without the `tokens_used: ~XXk` line**: treat as a budget-tracking warning; the run continues but the dev-lead estimates consumption manually and notes the gap under `agents.ux-test-engineer` in `usage.yaml`.
- **ux-test-engineer exhausts its per-agent budget mid-workflow**: do not redispatch within this workflow instance; work with the last landed iteration; surface to the CPO so the budget can be revised via `/revise-token-budget --agent ux-test-engineer` for the next instance.
- **`.claude/strap/state/usage.yaml` missing**: surface the gap; recommend `/strap-in` or `/strap-refresh` to restore.

## References

- Source work item (Spec or Feature mode): `$ARGUMENTS` (logical type `spec` or `feature`).
- ux-test-engineer role contract: [`../../agents/agent-ops/ux-test-engineer.md`](../../agents/agent-ops/ux-test-engineer.md).
- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- dev-lead guardrails: [`../../strap/rules/agents/dev-lead.md`](../../strap/rules/agents/dev-lead.md).
- agent-ops team rules: [`../../strap/rules/agent-ops.md`](../../strap/rules/agent-ops.md) -- the dispatch contract for ux-test-engineer's `tokens_used` self-reporting and SendMessage discipline.
- Project profile (active e2e domain + Source-of-truth + Conventions + Test plan paths): [`../../strap/contexts/project-profile.md`](../../strap/contexts/project-profile.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Spec / Feature templates: `.claude/strap/templates/work-items/specification.template.md`, `.claude/strap/templates/work-items/feature.template.md`.
- Sibling reference-pattern skills (same closing-phase write-exception shape):
  - [`../create-mockups/SKILL.md`](../create-mockups/SKILL.md) -- designer dispatch + Write at local mockup paths.
  - [`../strap-in/SKILL.md`](../strap-in/SKILL.md) Section 9 -- tech-writer dispatch + Write at local doc paths.
- Budget discipline (cross-cutting): [`../../strap/contexts/budget-discipline.md`](../../strap/contexts/budget-discipline.md).
- Budget tuning surface: [`../revise-token-budget/SKILL.md`](../revise-token-budget/SKILL.md).
- Recovery primitive for wedged teammates: [`../team-cleanup/SKILL.md`](../team-cleanup/SKILL.md).
- Upstream skills: [`../refine-spec/SKILL.md`](../refine-spec/SKILL.md), [`../generate-features/SKILL.md`](../generate-features/SKILL.md).
- Downstream skill: [`../execute-sprint/SKILL.md`](../execute-sprint/SKILL.md) -- consumes the persisted Test Plan section during Feature implementation.
