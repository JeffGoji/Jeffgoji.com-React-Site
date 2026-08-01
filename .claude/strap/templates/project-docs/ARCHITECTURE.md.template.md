<!--
Template for the human-facing architecture-orientation document. Rendered by
tech-writer from synthesized specialist findings + `project-profile.md`'s
`Domains` and `Architecture notes` sections. Mustache placeholders are filled at
render time. Sections without populated content are marked explicitly as stubs
awaiting refinement -- never silently omitted, never fabricated.

Tech-writer note: do NOT carry this HTML comment block (or any meta header) into
the rendered output. Start the rendered file with the first `# heading`.

H3 subsection discipline: when a section spans multiple distinct topics -- per-domain
summaries under `## Active domains`, integration categories under `## External
integrations`, security findings under `## Anti-patterns and gotchas`, etc. -- author
each topic as a `### <topic>` subsection rather than running prose. Readers navigate
via the sidebar; dense prose with no H3 anchors all-runs-together and forces a full
read instead of a scoped jump.
-->

# Architecture

This document describes how {{ project.name }} is structured. It is the human-readable companion to `.claude/strap/contexts/project-profile.md`, which is the agent-facing canonical record.

## System shape

{{ architecture.system_shape }}

## Active domains

The logical concerns the codebase is decomposed into. Each domain has a defined specialist roster (in `project-profile.md`'s `Domains` section) and a `Source-of-truth` set of paths where that domain's code lives.

{{ architecture.active_domains }}

## Data flow

How information moves through the system. Request paths, event paths, batch paths.

{{ architecture.data_flow }}

## Key boundaries

Where one part of the system hands off to another. Internal service boundaries, external integration surfaces, trust boundaries, transactional boundaries.

{{ architecture.key_boundaries }}

## Layering

{{ architecture.layering }}

## Architectural conventions worth knowing

Patterns that recur across the codebase and inform new work. Pulled from the curated `Architecture notes` in `project-profile.md` and from specialist deep-dives.

{{ architecture.conventions }}

## Anti-patterns and gotchas

Things the codebase has been bitten by before. Surfaces inferred from history, from specialist findings, from CPO correction.

{{ architecture.gotchas }}

## Diagrams

{{ architecture.diagrams }}

## Where to learn more

- **Project orientation**: [`PROJECT.md`](./PROJECT.md) -- what this project IS and who it serves.
- **Stack**: [`STACK.md`](./STACK.md) -- languages, frameworks, build commands.
- **Agent context**: [`.claude/strap/contexts/project-profile.md`](../strap/contexts/project-profile.md) -- the canonical record agents read on every invocation; source of truth for active domains, conventions, build/test, layers.

---

_Maintained by the STRAP `tech-writer` agent through `/strap-in` (initial population) and `/strap-refresh` (surgical updates when project shape drifts). Edit through the dev-lead per the single-curator rule._
