# tech-writer memory

Your accumulated tradecraft for this project. Captures what you have learned about how to do your job well on THIS codebase.

Curated by the dev-lead. You read; you do not write. When you finish a task and notice something worth persisting, report it to the dev-lead in your finishing summary -- the dev-lead decides what gets added here.

## Project tradecraft

- **Project-orientation docs vs `project-profile.md`**: the canonical record agents read on every invocation is `.claude/strap/contexts/project-profile.md` -- compact, list-driven, agent-tuned. The project-orientation docs at `Project docs paths` (default `.claude/strap/project-docs/`) are the distilled human-facing companions. Same source of truth; different audience; different shape. Do not duplicate the agent-facing file verbatim into the human-facing one.
- **Dispatch is serial Task at `/strap-in` closing phase**: the dev-lead invokes you sequentially (one Task call, full read-write-local-only palette) -- not via `CreateTeam`. There is no parallel fan-out value here; the work is sequential authoring of three related documents from a single synthesized brief.
- **Templates as scaffolding**: render the three project-docs templates from `.claude/strap/templates/project-docs/`. Fill every Mustache placeholder. When a section has no source material, write a one-line stub note ("`_To be populated in a future /strap-refresh once <signal> arrives._`"). Never fabricate.
- **Refresh-mode surgical edits**: at `/strap-refresh`, the dev-lead's brief identifies which sections drifted. Edit only those sections. Whole-file rewrites at refresh time are a defect -- they overwrite curated adopter content the refresh did not invalidate.

## Anti-patterns to avoid

- **Duplicating `project-profile.md` verbatim**: the project-orientation docs are distillations for humans, not copies. If a section reads like a bulleted fact list pulled directly from `project-profile.md`, rewrite as prose with named-file references.
- **Fabricating to fill template placeholders**: every Mustache placeholder MUST resolve from the curated persistence stack, the dev-lead's brief, or codebase observation. If no source material exists, the placeholder gets a stub note -- never an invented fact.
- **Wholesale rewrites at refresh**: at `/strap-refresh`, preserve unchanged sections byte-for-byte. CPO edits, narrative additions, and prior-refresh curation all live in the file; a wholesale rewrite overwrites them.
- **Publishing project-orientation docs through the docs adapter**: these are local-file-only artifacts in the install's adopter-owned tree. The docs adapter is for community pages, release notes, and code-audience hosted pages -- never `PROJECT.md` / `ARCHITECTURE.md` / `STACK.md`.

## Tool / environment quirks

- **Write palette during codebase-discovery dispatch is local-only**: the dev-lead invokes you with `Read, Grep, Glob, Bash, Write` -- `Write` is enabled but only for the configured `Project docs paths`. Writing outside the docs paths is a defect equivalent to a specialist writing production code during onboarding.
- **Mustache placeholders**: the project-docs templates use the same `{{ var }}` syntax as work-item templates. Fill every placeholder; an unfilled `{{ var }}` rendering through to the output file is a defect.
- **Directory creation**: the fallback `.claude/strap/project-docs/` directory does not exist by default on a fresh install -- create it via `Bash` (`mkdir -p`) before writing the rendered docs.
