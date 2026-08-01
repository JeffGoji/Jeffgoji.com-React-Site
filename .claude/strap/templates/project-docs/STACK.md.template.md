<!--
Template for the human-facing tech-stack-orientation document. Rendered by
tech-writer from synthesized specialist findings + `project-profile.md`'s
`Stack`, `Build and test`, `DevOps integration`, and per-domain `Stack` /
`Conventions` fields. Mustache placeholders are filled at render time. Sections
without populated content are marked explicitly as stubs awaiting refinement --
never silently omitted, never fabricated.

Tech-writer note: do NOT carry this HTML comment block (or any meta header) into
the rendered output. Start the rendered file with the first `# heading`.

H3 subsection discipline: when a section spans multiple distinct topics -- e.g.,
multiple external integrations under `## External integrations`, multiple
sub-repos under `## Per-sub-repo summary` -- author each topic as a `### <topic>`
subsection rather than running prose. Readers navigate via the sidebar.
-->

# Stack

This document describes what {{ project.name }} is built with. It is the human-readable companion to `.claude/strap/contexts/project-profile.md`, which is the agent-facing canonical record.

## Languages

{{ stack.languages }}

## Frameworks

Per active domain. Pulled from each `Domains` entry's `Stack` field in `project-profile.md`.

{{ stack.frameworks }}

## Data stores

{{ stack.data_stores }}

## Package managers and dependency management

{{ stack.package_managers }}

## Build and test

Commands the team runs locally and the pipeline runs in CI. Source of truth: `project-profile.md`'s `Build and test` section.

{{ stack.build_and_test }}

## Dev environment setup

What a new contributor needs to do to get a working local environment from a fresh clone.

{{ stack.dev_environment }}

## CI/CD overview

How code moves from a developer's branch through to deployable artifacts.

{{ stack.cicd }}

## Hosting and infrastructure

Where the code runs in production (and lower environments). IaC tooling. Cloud surface.

{{ stack.infrastructure }}

## External integrations

Third-party services, SDKs, APIs, and external systems the codebase depends on.

{{ stack.integrations }}

## Where to learn more

- **Project orientation**: [`PROJECT.md`](./PROJECT.md) -- what this project IS and who it serves.
- **Architecture**: [`ARCHITECTURE.md`](./ARCHITECTURE.md) -- how the pieces fit together.
- **Agent context**: [`.claude/strap/contexts/project-profile.md`](../strap/contexts/project-profile.md) -- the canonical record agents read on every invocation; source of truth for `Stack`, `Build and test`, `DevOps integration`.
- **DevOps integration profile**: [`.claude/strap/state/devops-connection.yaml`](../strap/state/devops-connection.yaml), [`.claude/strap/state/code-connection.yaml`](../strap/state/code-connection.yaml) -- host wire-up details (read-only references; credentials live in env vars only).

---

_Maintained by the STRAP `tech-writer` agent through `/strap-in` (initial population) and `/strap-refresh` (surgical updates when project shape drifts). Edit through the dev-lead per the single-curator rule._
