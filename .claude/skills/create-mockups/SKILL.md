---
name: /create-mockups
description: Translate Spec-level user-experience intent into deployable mockup code that the implementation team will port verbatim. Re-runnable: first invocation runs the designer through interview + build + present; subsequent invocations (with or without a directive argument) detect existing mockup files and iterate. CPO approval at every gate. Spec Handoff written only on Approve.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
---

# /create-mockups

## Purpose

Drive the mockup-as-contract workflow for a Spec with user-facing scope. The dev-lead dispatches the designer specialist to interview the CPO on intent, build deployable mockup code in the configured paths, present the running artifact with design decisions, and (on CPO approval) write a Mockup Reference section back to the Spec. Iterations are cheap: re-running the skill with directive feedback re-dispatches the designer against the existing mockup files until the CPO approves.

This skill is the pre-decomposition gate for Specs with user-facing scope. `/generate-features` refuses to author Feature briefs against a Spec that has client-ui Constituent Parts but no Mockup Wiring Guide section in the body. The flow that closes that gate is:

```
/refine-spec (Resolved) -> /create-mockups (CPO-approved) -> /analyze-mockups (Wiring Guide written) -> /generate-features
```

The skill ships portable. Stack-specific concerns resolve at runtime from `project-profile.md`'s `client-ui` domain entry: `Source-of-truth` paths declare where production frontend code lives (the designer reads it for design consistency), `Conventions` declares framework + file-extension + component-library + mock-data idioms the designer follows, and an optional `Mockup paths` field tells the skill where to write mockup files. Absent declared mockup paths, the skill falls back to `.claude/strap/mockups/spec-<spec-id>/`.

## Owner

**dev-lead.** When the skill is invoked the orchestrator IS the dev-lead. The designer is dispatched as a serial-Task specialist for the interview / build / iterate / present work. Per the agent-devs single-curator rule, only the dev-lead writes the Spec Handoff section back to the host; the designer reports the structured handoff content and the dev-lead persists it on CPO approval.

## Inputs

- `$ARGUMENTS` -- the Spec work item id, optionally followed by a directive in quotes. Examples:
  - `/create-mockups 12345`
  - `/create-mockups 12345 "minimal dashboard with sparklines"`
  - `/create-mockups 12345 "add a dark/light toggle in the navigation bar"`
- `.claude/strap/contexts/project-profile.md` -- source of truth for the `client-ui` domain entry (specialists, `Source-of-truth` paths, `Conventions`, optional `Mockup paths`).
- `.claude/strap/state/devops-connection.yaml` -- connection profile. Required fields: `mapping.work_item_types.spec.host_type`, `mapping.field_formats.description`, `operation_templates.{work_item_read,work_item_update,work_item_comment_add}`.
- `.claude/strap/templates/work-items/specification.template.md` -- the body template used when re-rendering on Spec Handoff write.

## Pre-flight

1. **devops-connection.yaml present.** If missing, redirect to `/connect-devops-project`.
2. **`client-ui` domain is active in `project-profile.md`.** The `Domains` section must carry a `Status: active` H3 entry whose `Specialists` field includes `designer`. If absent, redirect to `/strap-refresh` so the dev-lead can run the domain-activation gate with the CPO.
3. **`project-profile.md` is curated** (sentinel stripped). If scaffold, redirect to `/strap-in`.

## Workflow

### Phase 1: Read the Spec and validate

Render `operation_templates.work_item_read` with `id=<spec-id>` and execute. Capture title, current state, description, linked Requirement, tags. Validate:

- The item is logically a `spec` (via `strap:spec` tag or `mapping.work_item_types.spec.host_type` match). Refuse if not.
- The Spec is in `mapping.states.resolved`. If it's still `new` or `active`, refuse and recommend `/refine-spec <spec-id>` to drive Spec content to Resolved first.
- The Spec carries at least one client-ui Constituent Part. If the Spec is pure backend / data / infra, refuse and recommend skipping the skill -- /generate-features will proceed directly.

### Phase 2: Detect first-run vs iteration mode

Resolve the mockup target path:

1. Look up the `client-ui` domain entry in `project-profile.md`. If it declares a `Mockup paths` field, use the first declared path joined with `spec-<spec-id>/`.
2. Otherwise, fall back to the default: `.claude/strap/mockups/spec-<spec-id>/`.

Check whether the directory exists and contains any files:

- **First-run mode**: directory absent or empty. The skill runs the full flow: interview -> build -> present.
- **Iteration mode**: directory present with mockup files. The skill skips the interview phase (intent is captured from the existing Spec's Interview Summary section, written by the previous run). The directive from `$ARGUMENTS` (when supplied) is the brief; if no directive is supplied, the skill enters the gate asking the CPO what to change.

Tell the CPO which mode the skill is running in and the target path.

### Phase 3: Dispatch the designer

Dispatch designer via `Task` (serial, read-write tools palette this time: `Read, Grep, Glob, Bash, Edit, Write` -- mockup file creation is real work). The brief depends on mode.

#### First-run mode brief

- Designer's role contract + operating context (rules, memory, project-profile.md, the `client-ui` domain entry).
- The Spec id, title, body (especially the user-facing Constituent Parts and the linked Requirement's Desired Outcome + Stakeholders -- the designer needs to know WHO the users are and WHAT they need to accomplish).
- The Spec's acceptance criteria.
- The target mockup path.
- The mandate to run the interview-first discipline per the designer role contract:
  1. Capture intent, audience, scope, constraints, existing patterns, fidelity tier (Tier 1 verbatim = default; Tier 2 close-with-adjustments; Tier 3 sketch).
  2. Present interview questions to the dev-lead (which the dev-lead forwards to the CPO; answers flow back the same way -- specialists do not talk to the CPO directly).
  3. On answers, write a brief Interview Summary that will later land on the Spec under a `## Mockup Interview Summary` section.
- The mandate to build mockup code in the target path:
  - Deployable and interactive per the `client-ui` domain's `Conventions` (framework, file extensions, component-library usage, mock-data idioms).
  - Self-contained within the target path; no imports from production code except where the `Conventions` permits.
  - Exhaustive in states (loading, error, empty, populated, edge cases that map to Acceptance Criteria).
  - Mock-data structured to match the eventual API contract.
- The mandate to NOT write to the Spec. The dev-lead writes the Spec Handoff on CPO approval -- the designer reports the handoff content as a structured payload.
- The required `SendMessage` finishing report:
  - Interview summary (paragraph or bullets).
  - Files written (full paths).
  - Run instructions (literal command per the `Conventions`).
  - Walkthrough (one short line per view describing what it shows).
  - Design decisions and trade-offs (non-obvious choices not visible in the code: layout structure, interaction patterns, theming approach, color palette with values, conditional rendering rules, deviations from existing patterns + justifications).
  - Mock-data shape summary mapping to the eventual API.
  - Open gaps (where the Spec didn't supply enough intent; the designer made a best-effort call worth surfacing).
  - Anything to curate (rule or memory entry the dev-lead should consider after the run).
  - `tokens_used: ~XXk` line.

#### Iteration mode brief

- Designer's role contract + operating context (same as first-run).
- The Spec id + the existing Spec body (so the designer has the prior Interview Summary in hand).
- The directive from `$ARGUMENTS` (or the directive the CPO provides at the gate -- see Phase 5).
- The target mockup path with the existing files.
- The mandate to iterate the existing mockup files against the directive. Preserve everything else; change only what the directive requires plus any unavoidable consequences.
- The mandate to NOT re-interview the CPO unless the directive is genuinely ambiguous.
- The same `SendMessage` finishing report shape, with two additional fields:
  - Files changed (diff summary, not full file contents).
  - Why each change was made.

### Phase 4: Present the mockup to the CPO

When the designer returns via `SendMessage`, the dev-lead presents:

```
Mockup ready at <target path>.

Run: <literal command from the designer's report>

Files:
  <full path list>

Walkthrough:
  - View A: <one line>
  - View B: <one line>
  ...

Key design decisions:
  - <decision 1>
  - <decision 2>
  ...

Mock-data shapes (for downstream wiring):
  - <shape summary>

Open gaps the designer surfaced:
  - <if any>

Iteration directive applied (iteration mode only):
  - <directive>
  - Files changed: <diff summary>
```

The CPO opens the running mockup in a browser (or per the run command) and reviews.

### Phase 5: CPO approval gate

Use `AskUserQuestion`. Options (nominal labels):

- **Approve and write Spec Handoff** -- the mockup is the contract; the dev-lead writes the Mockup Reference section to the Spec.
- **Iterate -- I'll describe the changes** -- CPO provides directive feedback; the skill loops back to Phase 3 with the directive in hand (iteration-mode brief). The Approve/Iterate/Cancel loop is the working session.
- **Cancel** -- no Spec mutation; exit cleanly. The mockup files remain on disk -- a future `/create-mockups <spec-id>` invocation will resume in iteration mode.

For trivial touch-ups (a color tweak, a label rename) where the CPO doesn't want full designer ceremony, the CPO can also tell the dev-lead conversationally and the dev-lead edits the mockup file directly without re-dispatching the designer. The skill stays at the gate until the CPO picks `Approve` or `Cancel`.

### Phase 6: Write the Spec Handoff (on Approve)

On `Approve`, the dev-lead persists three additions to the Spec body via `operation_templates.work_item_update`:

1. **Mockup Interview Summary section** (or update it if already present from a prior run). Captures intent, audience, scope, fidelity tier, constraints.
2. **Mockup Reference (authoritative for implementation) section** under the client-ui Constituent Part:
   - **Mockup file paths table**: every file path the implementation team will read, and what each contributes.
   - **Run command**: the literal command from the designer's report.
   - **Key design decisions**: non-obvious choices (layout structure, interaction patterns, theming, color palette, conditional rendering, deviations from existing patterns).
3. **Mock-data shape summary**: a stub the spec-lead's `/analyze-mockups` pass will deepen into the full Wiring Guide.

Parse the existing Spec body's metadata block to preserve `Authored By` / `Authored At`. Re-render the Spec template with the existing metadata plus the new sections. Convert markdown to HTML at the boundary if `mapping.field_formats.description` is `html`. Execute `operation_templates.work_item_update`.

Post an audit comment via `operation_templates.work_item_comment_add`:

> `[STRAP/agent:dev-lead] Mockup approved (via /create-mockups). Files at <target path>. Iteration count: <N>. Next: /analyze-mockups <spec-id> to write the Wiring Guide.`

### Phase 7: Hand-off

Recommend the CPO run `/analyze-mockups <spec-id>` next. The spec-lead audit produces the Mockup Wiring Guide that closes the pre-decomposition gate.

## Outputs

- Deployable mockup code under the resolved target path (`<Mockup paths>/spec-<spec-id>/` or `.claude/strap/mockups/spec-<spec-id>/`).
- Mock-data files alongside the mockups, structured to match the eventual API contract.
- On Approve only:
  - `Mockup Interview Summary` section persisted on the Spec.
  - `Mockup Reference (authoritative for implementation)` section persisted on the Spec with file paths table, run command, key design decisions.
  - Mock-data shape stub persisted on the Spec (deepened later by `/analyze-mockups`).
  - `[STRAP/agent:dev-lead]` audit comment on the Spec recording approval + iteration count.
- A CPO-facing summary at the end with the run command, iteration count, and the recommended next step.

## Quality gates

The skill is successful when all of the following hold:

- devops-connection.yaml was present and the `client-ui` domain was active at pre-flight.
- The target Spec was a `spec` in `mapping.states.resolved` carrying at least one client-ui Constituent Part.
- Mode detection landed correctly (first-run when directory absent/empty; iteration when existing files present).
- The designer was dispatched read-write into the configured mockup path (no production code touched -- the designer's role contract enforces this).
- Every iteration loop returned to the CPO approval gate; no Spec mutation landed without an explicit `Approve`.
- On Approve: the existing Spec's `Authored By` / `Authored At` were preserved; the Mockup Reference section names real files (not placeholders); the audit comment landed.
- Markdown-to-HTML conversion was applied for HTML-flavored hosts.

## Failure handling

- **devops-connection.yaml missing**: stop. Redirect to `/connect-devops-project`.
- **`client-ui` domain not active**: stop. Redirect to `/strap-refresh` so the activation gate runs cleanly.
- **Target is not a Spec or not in Resolved state**: refuse with a clear message naming the actual type/state.
- **Spec has no client-ui Constituent Part**: refuse and recommend skipping the skill.
- **Designer fails to call `SendMessage`**: treat extended silence as wedged; recover via `/team-cleanup`; iteration files on disk are preserved for the next run.
- **Mockup files written to an unexpected path** (designer disregards the target-path brief): surface the deviation; reject and re-dispatch with a tighter brief.
- **CPO declines all options at the gate (Cancel)**: exit cleanly. Mockup files on disk are preserved so a future `/create-mockups <spec-id>` invocation resumes in iteration mode.
- **`operation_templates` rendering produces malformed requests**: surface the failing template path and request body; do not execute.
- **HTML conversion fails**: surface the offending content; do not post raw markdown into an HTML-flavored field.

## References

- Source Spec: `$ARGUMENTS` (logical type `spec`, state `resolved`).
- designer role contract: [`../../agents/agent-ops/designer.md`](../../agents/agent-ops/designer.md).
- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- dev-lead guardrails: [`../../strap/rules/agents/dev-lead.md`](../../strap/rules/agents/dev-lead.md).
- Project profile (active domains + client-ui Source-of-truth + Conventions + Mockup paths): [`../../strap/contexts/project-profile.md`](../../strap/contexts/project-profile.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Spec template: `.claude/strap/templates/work-items/specification.template.md`.
- Upstream skill: [`../refine-spec/SKILL.md`](../refine-spec/SKILL.md) -- recommends `/create-mockups` at resolution for Specs with user-facing scope.
- Companion skill: [`../analyze-mockups/SKILL.md`](../analyze-mockups/SKILL.md) -- the spec-lead-driven verification + Wiring Guide write that closes the pre-decomposition gate.
- Downstream skill: [`../generate-features/SKILL.md`](../generate-features/SKILL.md) -- refuses for user-facing-scope Specs missing the Mockup Wiring Guide.
- Recovery primitive for wedged teammates: [`../team-cleanup/SKILL.md`](../team-cleanup/SKILL.md).
