---
name: bug-template
description: Work item content template for Bug work items. Consumed by /file-bugs. Authored by an intake agent (typically spec-lead) from CPO input and codebase investigation; rendered with format conversion applied at the boundary per the connection profile's `mapping.field_formats.description`.
---

> Content template for Bug work items. The `/file-bugs` skill investigates the codebase, classifies the issue, and renders this template with the lifecycle-metadata block populated by the dev-lead at persistence time. Severity is persisted via the host field at `mapping.fields.severity`. The Environment section is conditional on the connection profile declaring environment-field support (`environment_supported` true when `mapping.fields.environment` is set); STRAP MUST NOT polyfill custom fields the profile does not declare. When the issue is an Enhancement filed against a host that does not support the `enhancement` logical type, `/file-bugs` prepends a clearly marked degradation block above the Repro Steps section per the skill's Enhancement Degradation behavior.

| Field        | Value                       |
|--------------|-----------------------------|
| Authored By  | {{ authored_by }}           |
| Authored At  | {{ authored_at }}           |
| Completed By | {{ completed_by }}          |
| Completed At | {{ completed_at }}          |

---

# {{ bug.title }}

## Repro Steps

Numbered, deterministic steps to reproduce the defect. Each step is one user-visible or system-visible action -- the level of granularity at which a downstream agent can replay the failure without ambiguity.

{{ bug.repro_steps }}

## Expected vs Actual

What the system should do (anchored to the Spec or to a documented behavior contract) versus what it actually does (the symptom the CPO observed). Concrete on both sides; no hedging.

**Expected:** {{ bug.expected }}

**Actual:** {{ bug.actual }}

## Severity

Persisted via the host field declared at `mapping.fields.severity` in the connection profile. Severity is set per the project rubric:

- `1 - Critical`: data loss, security defect, full system unavailability, no workaround.
- `2 - High`: major feature broken, significant user impact, painful workaround.
- `3 - Medium`: feature partially broken, moderate impact, reasonable workaround.
- `4 - Low`: cosmetic issue, minor inconvenience, easy workaround.

**Severity:** {{ bug.severity }}

{{#environment_supported}}
## Environment

Where the defect was observed. Persisted via the host field declared at `mapping.fields.environment` in the connection profile. Includes the host environment (production, staging, integration, development), build or release identifier, runtime version, and any tenant context relevant for multi-tenant projects.

{{ bug.environment }}
{{/environment_supported}}

## Linked artifacts

Related work items that contextualize this Bug:

- Specs whose Acceptance Criteria the actual behavior violates.
- Features that own the affected functionality.
- Recent Stories that may have introduced the regression -- identified during `/file-bugs` investigation by reading the relevant change history.

{{ bug.linked_artifacts }}

## Root cause

The root cause or strongest hypothesis identified during `/file-bugs` investigation. Names affected files with line numbers where possible. Explicitly distinguishes confirmed root cause from hypothesis -- never present a guess as a finding.

{{ bug.root_cause }}

## Affected files

Files identified during investigation as the locus of the defect. Each entry includes path and, when applicable, line numbers or function names. Downstream `/fix-bugs` consumes this list as its starting point.

{{ bug.affected_files }}

## Impact

Who is affected by this defect, the size of the affected population, and the blast radius if the defect is left unaddressed. Captures both end-user impact and operational impact (e.g., support burden, data integrity risk, downstream-system exposure).

{{ bug.impact }}

## Quality Checklist

Gates `/file-bugs` verifies before presenting the draft to the CPO.

- [ ] Repro Steps are numbered and deterministic.
- [ ] Expected vs Actual is concrete on both sides; Expected is anchored to a Spec or documented contract.
- [ ] Severity is set per the project rubric and persisted through `mapping.fields.severity`.
{{#environment_supported}}
- [ ] Environment is captured (host environment, build/release, runtime version, tenant context where applicable).
{{/environment_supported}}
- [ ] Linked artifacts identify the affected Spec, Feature, and any recent Story that may have introduced the regression.
- [ ] Root cause distinguishes confirmed cause from hypothesis -- no guesses presented as findings.
- [ ] Affected files include paths and, where applicable, line numbers or function names.
- [ ] Impact captures who is affected, the size of the affected population, and the blast radius.
