<!--
Template for the human-facing project-orientation document. Rendered by
tech-writer from synthesized specialist findings + the curated `project-profile.md`.
Mustache placeholders are filled at render time. Sections without populated content
are marked explicitly as stubs awaiting refinement -- never silently omitted, never
fabricated. The rendered output lives at the first declared `Project docs paths`
entry (or `.claude/strap/project-docs/PROJECT.md` when the path field is absent).

Tech-writer note: do NOT carry this HTML comment block (or any meta header) into
the rendered output. Start the rendered file with the first `# heading`.
-->

# {{ project.name }}

{{ project.tagline }}

## What this project is

{{ project.what_it_is }}

## Who it serves

{{ project.audiences }}

## How to get started

{{ project.quickstart }}

## Repository layout

{{ project.repo_layout }}

## Where to learn more

- **Architecture**: [`ARCHITECTURE.md`](./ARCHITECTURE.md) -- how the code is structured, how the pieces fit together, key boundaries and data flows.
- **Stack**: [`STACK.md`](./STACK.md) -- languages, frameworks, runtimes, build/test commands, dev environment setup.
- **Agent context**: [`.claude/strap/contexts/project-profile.md`](../strap/contexts/project-profile.md) -- the canonical record every STRAP agent reads on every invocation. The source of truth this document is distilled from.
- **Onboarding the dev pipeline**: [`CLAUDE.md`](../../CLAUDE.md) -- the super-pair model + how the agent stack works on this project.

## Status

{{ project.status }}

---

_This document is maintained by the STRAP `tech-writer` agent through `/strap-in` (initial population) and `/strap-refresh` (surgical updates when project shape drifts). Edit through the dev-lead per the single-curator rule; direct in-place edits will surface on the next `/strap-refresh` drift detection._
