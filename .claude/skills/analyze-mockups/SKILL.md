---
name: /analyze-mockups
description: Audit an approved mockup set against the Spec's acceptance criteria, extract mockup data shapes, map them to the Spec's backend API declarations, and write the Mockup Wiring Guide section back to the Spec. The verification step that closes the pre-decomposition gate after /create-mockups locks in. Dev-lead dispatches spec-lead serial-Task read-only; CPO approves the Wiring Guide before it persists.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
---

# /analyze-mockups

## Purpose

Verify the approved mockup set against the Spec's acceptance criteria and produce the Mockup Wiring Guide that the implementation team will consume during decomposition and execution. The Wiring Guide is the bridge between mockup-as-visual-contract (what `/create-mockups` produced) and the backend API contract declared in the Spec.

This is the second half of the pre-decomposition gate. `/create-mockups` writes the Mockup Reference section to the Spec on CPO approval; `/analyze-mockups` reads that approved mockup set, audits coverage, extracts data shapes, maps them to backend declarations, and writes the Mockup Wiring Guide. Once both sections are on the Spec, `/generate-features` is unblocked for Specs with user-facing scope.

```
/refine-spec (Resolved) -> /create-mockups (CPO-approved) -> /analyze-mockups (Wiring Guide written) -> /generate-features
```

The skill does NOT extract UI details into the Spec. The mockup code IS the UI specification. The Wiring Guide records which backend endpoints map to which mockup data sources, which existing services replace mockup-only stubs, and which production concerns the implementation agents must wire when porting -- it does not duplicate mockup content. This preserves the mockup-port-verbatim discipline.

## Owner

**dev-lead.** spec-lead is dispatched as a serial-Task specialist with a read-only tools palette (`Read, Grep, Glob, Bash`). The spec-lead audits the mockup files and the Spec's backend API declarations; the dev-lead presents findings to the CPO and persists the Wiring Guide on approval.

## Inputs

- `$ARGUMENTS` -- the Spec work item id.
- `.claude/strap/contexts/project-profile.md` -- source of truth for the `client-ui` domain entry's `Conventions` (framework, file extensions, mock-data idioms) and `Source-of-truth` paths (the existing project services spec-lead can suggest as replacements for mockup-only stubs).
- `.claude/strap/state/devops-connection.yaml` -- connection profile. Required fields: `mapping.work_item_types.spec.host_type`, `mapping.field_formats.description`, `operation_templates.{work_item_read,work_item_update,work_item_comment_add}`.

## Pre-flight

1. **devops-connection.yaml present.** If missing, redirect to `/connect-devops-project`.
2. **`client-ui` domain is active in `project-profile.md`.** If absent, redirect to `/strap-refresh`.

## Workflow

### Phase 1: Read the Spec and validate

Render `operation_templates.work_item_read` with `id=<spec-id>` and execute. Capture title, state, description, linked Requirement, tags. Validate:

- The item is logically a `spec` and in `mapping.states.resolved`. Refuse otherwise.
- The Spec body contains a **Mockup Reference (authoritative for implementation)** section produced by `/create-mockups`. If absent, refuse and recommend running `/create-mockups <spec-id>` first.
- Capture the mockup file paths table, the run command, and the key design decisions from that section.

### Phase 2: Dispatch spec-lead for the audit

Dispatch spec-lead via `Task` (serial, read-only palette: `Read, Grep, Glob, Bash`). The brief:

- spec-lead role contract + operating context (rules, memory, project-profile.md).
- The Spec body (acceptance criteria + backend Constituent Parts + the Mockup Reference section).
- The mockup file path list from the Mockup Reference table.
- The `client-ui` domain entry's `Conventions` (so spec-lead knows the framework-idiomatic source for data-shape extraction -- TypeScript interfaces, JSON fixtures, framework-specific shape declarations, etc.).
- The `client-ui` domain entry's `Source-of-truth` paths (so spec-lead can suggest existing project services to replace mockup-only stubs).
- The audit mandate:
  1. **Completeness check.** For every acceptance criterion with user-facing implications, confirm the mockup covers it. Walk loading / error / empty / populated / edge states. Flag every gap with the AC id and the missing path.
  2. **Data-shape extraction.** Read each mockup data file (per the `Conventions` idiom). Extract every shape -- field names, types, nesting, optionality.
  3. **Data-shape mapping.** For each extracted shape, find the matching backend declaration in the Spec's backend Constituent Parts. Build a mapping table with one row per mockup field: `mockup field | backend field | status` (match / rename-needed / missing-on-backend / type-mismatch).
  4. **Existing-service replacement list.** Walk the mockup imports. For every mockup-only stub (a fake service, an in-memory store, a hardcoded URL), find the production service that should replace it during porting. The replacement candidates come from the `client-ui` domain's `Source-of-truth` paths -- spec-lead reads representative files there to identify the canonical services.
  5. **Production concerns.** Identify what the mockup intentionally doesn't show but the implementation must handle: feature-flag gating, multi-tenant scoping (when project-profile.md declares multi-tenancy), authorization rules, telemetry obligations.
- The required `SendMessage` finishing report:
  - Completeness verdict (pass/gaps-flagged) with the gap list (AC id -> missing path).
  - Data-shape mapping table (full).
  - Mismatch summary (count + per-row severity).
  - Existing-service replacement list (mockup stub -> production service).
  - Production concerns list (feature-flag / multi-tenant / authz / telemetry).
  - Anything to curate (rule or memory entry the dev-lead should consider).
  - `tokens_used: ~XXk` line.

### Phase 3: Present findings to the CPO

When spec-lead returns, present:

```
Mockup completeness: <pass | gaps-flagged>
  Gaps:
    - AC-NNN: <missing path / state / interaction>
    - ...

Data-shape mapping (<N> fields total):
  | Mockup field | Backend field | Status |
  ...
  Mismatches: <count> (<rename-needed: N> | <missing-on-backend: N> | <type-mismatch: N>)

Existing services to use during porting:
  - <mockup stub> -> <production service>
  - ...

Production concerns the implementation must wire:
  - <feature-flag / multi-tenant / authz / telemetry items>
```

Use `AskUserQuestion`. Options:

- **Approve and write Wiring Guide** -- spec-lead's audit becomes the Wiring Guide section on the Spec; recommend `/generate-features`.
- **Refuse: blocking gaps** -- spec-lead flagged gaps that warrant a mockup revision. Recommend `/create-mockups <spec-id> "<gap directive>"` to iterate the mockup before re-running `/analyze-mockups`.
- **Refuse: Spec backend needs revision** -- the data-shape mismatches indicate the Spec's backend declarations are wrong, not the mockup. Recommend `/refine-spec <spec-id>` to fix the backend Constituent Parts; the Spec re-enters Active until re-Resolved, after which `/analyze-mockups` can re-run.
- **Cancel** -- exit cleanly; no Spec mutation.

### Phase 4: Write the Wiring Guide (on Approve)

On `Approve`, persist the Mockup Wiring Guide section to the Spec body under the client-ui Constituent Part. The Guide contains:

1. **Mockup directory path** (already in the Mockup Reference section; restated here for skim convenience).
2. **Data-shape-to-API-endpoint mapping table** (the spec-lead's full mapping output, with backend field names and statuses).
3. **Existing-service replacement list** (mockup stub -> production service from the `client-ui` `Source-of-truth`).
4. **Production concerns** (feature-flag gating, multi-tenant scoping, authz, telemetry -- the items the mockup intentionally elides).
5. **Open gaps** (when the CPO approved despite flagged gaps -- spec-lead's completeness verdict landed as `gaps-flagged` but the CPO chose to proceed; the gaps stay on the Spec as known-shortcomings for the implementation team to surface during decomposition).

The Guide does NOT contain colors, chart configs, layout classes, style rules, or template structure. That content lives in the mockup files and will be ported verbatim during implementation. Preserve mockup-port-verbatim discipline.

Parse the existing Spec body's metadata block to preserve `Authored By` / `Authored At`. Re-render the Spec template with the existing metadata + the new Wiring Guide section + the existing Mockup Reference section. Convert markdown to HTML at the boundary if `mapping.field_formats.description` is `html`. Execute `operation_templates.work_item_update`.

Post an audit comment via `operation_templates.work_item_comment_add`:

> `[STRAP/agent:spec-lead] Mockup Wiring Guide written (via /analyze-mockups). Completeness: <pass | N gaps surfaced>. Data-shape mismatches: <count>. Spec is now ready for /generate-features.`

### Phase 5: Hand-off

Recommend `/generate-features <spec-id>` next. The Wiring Guide closes the pre-decomposition gate for user-facing-scope Specs.

## Outputs

- On Approve only:
  - `Mockup Wiring Guide` section persisted on the Spec under the client-ui Constituent Part.
  - `[STRAP/agent:spec-lead]` audit comment on the Spec recording the completeness verdict + mismatch count.
- A CPO-facing findings report at the gate (always, regardless of CPO choice).
- No mockup file mutation (this skill is read-only against the mockups).

## Quality gates

The skill is successful when all of the following hold:

- devops-connection.yaml was present and the `client-ui` domain was active at pre-flight.
- The target Spec was `resolved` AND carried a Mockup Reference section produced by `/create-mockups`.
- spec-lead ran read-only -- no production code or mockup files were modified.
- The audit produced a structured findings report covering completeness + data-shape mapping + existing-service replacements + production concerns.
- The CPO chose explicitly at the gate (Approve / Refuse-blocking-gaps / Refuse-Spec-revision / Cancel).
- On Approve: the existing Spec's `Authored By` / `Authored At` were preserved; the Mockup Reference section was preserved unchanged; the Wiring Guide section names real backend fields and real production services (not placeholders); the audit comment landed.
- Markdown-to-HTML conversion was applied for HTML-flavored hosts.

## Failure handling

- **devops-connection.yaml missing**: stop. Redirect to `/connect-devops-project`.
- **`client-ui` domain not active**: stop. Redirect to `/strap-refresh`.
- **Target is not a Spec or not Resolved**: refuse with a clear message naming the actual type/state.
- **Spec lacks the Mockup Reference section**: refuse. Recommend `/create-mockups <spec-id>` first.
- **spec-lead fails to call `SendMessage`**: treat extended silence as wedged; recover via `/team-cleanup`.
- **Mockup files referenced in the Mockup Reference table do not exist on disk** (mockup directory deleted between `/create-mockups` and this run): surface the gap; recommend re-running `/create-mockups <spec-id>` to restore the mockup set.
- **CPO chooses Refuse-blocking-gaps**: exit cleanly with the gap list; no Wiring Guide write. The CPO re-runs `/create-mockups` to iterate.
- **CPO chooses Refuse-Spec-revision**: exit cleanly with the mismatch list; no Wiring Guide write. The CPO re-runs `/refine-spec` to fix the backend Constituent Parts.
- **`operation_templates` rendering produces malformed requests**: surface the failing template path and request body; do not execute.
- **HTML conversion fails**: surface the offending content; do not post raw markdown into an HTML-flavored field.

## References

- Source Spec: `$ARGUMENTS` (logical type `spec`, state `resolved`, with Mockup Reference section present).
- spec-lead role contract: [`../../agents/agent-ops/spec-lead.md`](../../agents/agent-ops/spec-lead.md).
- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- dev-lead guardrails: [`../../strap/rules/agents/dev-lead.md`](../../strap/rules/agents/dev-lead.md).
- Project profile (active `client-ui` domain + Conventions + Source-of-truth): [`../../strap/contexts/project-profile.md`](../../strap/contexts/project-profile.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Spec template: `.claude/strap/templates/work-items/specification.template.md`.
- Upstream skill: [`../create-mockups/SKILL.md`](../create-mockups/SKILL.md) -- writes the Mockup Reference section this skill audits against.
- Downstream skill: [`../generate-features/SKILL.md`](../generate-features/SKILL.md) -- consumes the Wiring Guide; refuses to run for user-facing-scope Specs missing this Guide.
- Recovery primitive for wedged teammates: [`../team-cleanup/SKILL.md`](../team-cleanup/SKILL.md).
