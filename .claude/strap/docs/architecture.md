# STRAP Architecture

System architecture for STRAP contributors and the curious adopter. STRAP is a portable agentic SDLC pipeline that ships as a `.claude/` tree, drops into any project, and brings a coordinated team of fifteen AI specialists online under one human's authority. This document is the contributor-facing complement to [`strap-in.md`](./strap-in.md) -- where that narrative explains what STRAP feels like to use, this one explains why it is built the way it is.

The audience is a contributor extending STRAP, or an adopter who wants a deeper mental model than the customization guide provides. For the operational walk-through of installing STRAP and curating it post-install, see [`strap-in.md`](./strap-in.md). For the canonical session-startup orientation, see [`../../../CLAUDE.md`](../../../CLAUDE.md).

## Design principles

Four principles run through every architectural choice. They are stable across releases; they explain most decisions.

1. **Single-curator persistence.** Only the dev-lead writes to rules and memory. Specialists report findings; the dev-lead decides what gets persisted. This is what makes the persistence stack coherent over time -- there is exactly one editor, and everyone else inherits.
2. **Canonical roster, project-tuned context.** Fifteen agents ship with STRAP; the same fifteen ship to every adopter; the roster does not change per install. What changes per install is the persistence stack -- per-agent rules, per-agent memory, project-profile -- that the dev-lead curates over the project's lifetime. Agents stay simple. Intelligence accumulates in the persistence stack.
3. **Connection-discovery model.** STRAP does not ship a fixed adapter per host. It probes the host live during a per-project `/connect-*` flow, models the host's actual capabilities against STRAP's logical operations, validates with the CPO, and persists a per-project connection profile that the pipeline reads at runtime. The skill catalog stays portable; the per-host details live in the profile, not in the skill body.
4. **Code immutability during onboarding.** Section 6 specialists dispatched during `/strap-in` or `/strap-refresh` run read-only. The adopter's production code is not modified during persistence-stack curation. Three narrow exceptions exist for closing-phase specialists that write local-only artifacts: `tech-writer` writes the project-orientation docs (`PROJECT.md`, `ARCHITECTURE.md`, `STACK.md`) to the configured `Project docs paths` at the closing phase of both `/strap-in` and `/strap-refresh`; `designer` writes mockup files to the configured `Mockup paths` in `/create-mockups`; `ux-test-engineer` writes test plans + scaffolded test files to the configured test paths in `/create-test-plan`. All three exceptions are scoped narrowly -- writes target adopter-owned local paths, never production source. The full invariant releases when `/connect-code-repo` clears its satisfied gate -- the deliberate transition from onboarding mode to operational mode.

## Package layout

STRAP is distributed as a directory of markdown artifacts the Claude Code runtime loads. No binaries, no compiled stages, no server. Every artifact is text and the agent runtime is the only execution surface.

```
STRAP/
  README.md                top-level orientation
  INSTALL.md               install flow STRAP exposes to adopters
  CHANGELOG.md             release history
  CLAUDE.md                per-session identity grounding
  .claude/
    agents/
      agent-ops/           7 ops-team role contracts
      agent-devs/          8 dev-team role contracts (including dev-lead)
    skills/                slash-command skills covering the full SDLC pipeline + onboarding
    strap/
      rules/
        agent-ops.md       team-wide rules
        agent-devs.md      team-wide rules
        agents/            per-agent guardrails (15 files)
      memory/
        agents/            per-agent accumulated tradecraft (15 seed files)
      templates/
        work-items/        Mustache-templated work-item description bodies (7 types incl. Enhancement)
        connection-templates/  per-host accelerator templates (optional)
        project-profile.scaffold.md  scaffold the installer writes; /strap-in populates + strips the sentinel
        project-docs/      PROJECT.md / ARCHITECTURE.md / STACK.md Mustache templates for tech-writer
      contexts/
        onboarding-design.md   v2 design source-of-truth
        budget-discipline.md   cross-cutting budget pattern (incl. polyrepo aggregation)
        ...                    other contributor-facing design docs
      docs/                this directory; contributor + CPO narratives
      tools/
        html-render/       markdown-to-HTML pipeline (project-docs HTML companion + Welcome HTML)
  infra/
    install/               installer + smoke runbook
    pipeline/              CI/CD scripts
```

The tarball excludes STRAP-source state that should never propagate to adopter installs: `.strap-version.json` (the installer writes a fresh per-install copy), `project-profile.md` (the installer copies a separate scaffold from `templates/project-profile.scaffold.md` at first install), and `contexts/continuations/` (STRAP-source session bookkeeping). Everything else under `.claude/` DOES ship -- including `memory/MEMORY.md` and `memory/dev-lead/`, which carry STRAP-source-curated universal operating learnings that apply to every adopter dev-lead. `/strap-upgrade`'s seeded-then-curated category preserves adopter customizations on upgrade while still applying new package-only adds. The html-render pipeline at `.claude/strap/tools/html-render/` IS bundled (it is adopter-runtime tooling invoked at every `/strap-in` and `/strap-refresh` closing phase); a `package.json` declares `marked` as the only runtime dep, resolved at first invocation via `npm install --no-save`.

## The canonical 15-agent roster

The **default** roster is fifteen agents. The same fifteen ship to every adopter, every install; the package does not rename or regenerate them. Adopters can extend the roster with their own agents (cross-cutting reviewers, project-specific governance, stack-tier specialists STRAP doesn't ship by default) by dropping a role contract under `.claude/agents/agent-{ops,devs}/`, seeding the persistence-stack files for it, and asking the dev-lead to wire the new agent into `project-profile.md`'s `Domains` Specialists fields. The integration is curation-only -- no package code changes -- and `/strap-upgrade` naturally protects adopter additions. See [`customization-guide.md`](./customization-guide.md) for the three-step ceremony.

| Team | Agent | Layer |
|---|---|---|
| agent-ops | `req-lead` | Authoring -- Requirement lifecycle |
| agent-ops | `spec-lead` | Authoring -- Spec authoring + Feature generation |
| agent-ops | `designer` | Authoring -- UI/UX mockups |
| agent-ops | `tech-writer` | Documentation across audiences |
| agent-ops | `sprint-planner` | Iteration cadence + velocity |
| agent-ops | `dora-analyst` | DORA metrics + release governance |
| agent-ops | `ux-test-engineer` | E2E + load testing |
| agent-devs | `dev-lead` | Top-level Claude session; not a subagent |
| agent-devs | `backend-engineer` | Server-side implementation |
| agent-devs | `frontend-engineer` | Client-side UI -- web / desktop / mobile / native / server-rendered |
| agent-devs | `database-engineer` | Schema + migrations |
| agent-devs | `integration-specialist` | External-system integration |
| agent-devs | `security-reviewer` | OWASP-aligned audit gate |
| agent-devs | `devops-lead` | IaC + cloud + pipelines |
| agent-devs | `test-strategist` | Test strategy + triage |

The two-team split mirrors the SDLC handoff: agent-ops produces; agent-devs consumes; the Spec is the contract between them. The split is reflected in two team-wide rules files (`.claude/strap/rules/agent-ops.md`, `.claude/strap/rules/agent-devs.md`) that ship verbatim and apply STRAP-wide.

**The super-pair invariant.** The CPO is the human typing the prompts. The dev-lead is the top-level Claude session -- never a subagent. They form the super-pair: every STRAP session is operated through this one relationship, and every skill runs under it.

## The persistence stack

Four kinds of source-controlled state inform every agent. The dev-lead is the sole writer for rules and memory; agents only read.

| Layer | Purpose | Editor | Lifetime |
|---|---|---|---|
| Team rules (`.claude/strap/rules/agent-{ops,devs}.md`) | Cross-cutting team guardrails | dev-lead | Stable; STRAP-wide |
| Per-agent rules (`.claude/strap/rules/agents/<name>.md`) | Per-agent guardrails added reactively when something needs preventing | dev-lead | Reactive growth |
| Per-agent memory (`.claude/strap/memory/agents/<name>.md`) | Accumulated tradecraft for THIS project | dev-lead | Grows over time |
| Dev-lead memory (`.claude/strap/memory/MEMORY.md` index + `memory/dev-lead/<topic>.md` files) | The dev-lead's own categorized notes | dev-lead (the session itself) | Grows over time |
| Project profile (`.claude/strap/contexts/project-profile.md`) | What THIS project IS -- stack, domains, conventions, build/test commands | dev-lead | Refined over project lifetime |
| Continuations (`.claude/strap/contexts/continuations/<topic>.md`) | Cross-session topic-scoped runbooks | Any session via `/context-prep` | Topic-scoped |
| Connection profiles (`.claude/strap/state/{devops,code}-connection.yaml`) | Per-project work-tracking + source-control wire-up | `/connect-*` skills | Per-host, per-install |

Every specialist agent loads the team rules, its own rules, its own memory, and the project profile on every invocation. The dev-lead curates everything; specialists report findings.

The **active-domain model** in `project-profile.md` is what makes the canonical roster project-tuned. The `Domains` section enumerates which logical concerns (client-ui, api, core, data, infrastructure, integrations, etc.) are active on this project, names the specialists each domain dispatches to, and carries the per-domain `Source-of-truth` paths + `Conventions` the specialists read. A specialist isn't "deleted" from the roster when its domain is dormant -- it's just not dispatched. The same specialist becomes active the moment its domain shows up in the project, with a deep-dive seeded by the dev-lead during `/strap-refresh`.

## Polyrepo support

When the install root contains multiple peer sub-repos at depth-1 (each with its own `.git/`), `/strap-in` recognizes the umbrella shape. The pipeline supports two structural models from a single install:

- **Single-project**: the canonical case. `/strap-in` runs against one repo; one `Domains` section drives specialist activation; one project-profile, one persistence stack.
- **Polyrepo umbrella**: STRAP installs once at the umbrella root (`<root>/.claude/`); a new `Sub-repos` H2 section in `project-profile.md` carries one H3 entry per detected sub-repo with 7 fields (`Path`, `Purpose`, `Stack`, `Conventions`, `Source-of-truth`, `Runtime dependencies`, `Activated`). Sub-repos can coexist with Domains -- a Domain can declare paths spanning multiple sub-repos. Pre-existing `.claude/` directories inside sub-repos are bystanders at non-overlapping paths; never touched by the umbrella install.

**Detection.** `/strap-in` Section 2 runs a depth-1 scan (`find -maxdepth 2 -mindepth 2 -type d -name .git`). When N >= 2 sub-repos are detected (each with their own `.git/` directory at depth-1), the dev-lead surfaces a **three-way CPO choice** via `AskUserQuestion`: proceed as polyrepo umbrella, exit cleanly with guidance to install per sub-repo separately, or continue as single-project at root with an explicit caution. The detection does NOT pre-filter on whether the install root has its own `.git/` or its own source manifests (`.sln`, `package.json`, `pyproject.toml`, etc.) -- ambiguous cases (umbrella workspace manifests; root projects vendoring sub-repos as sibling clones) could go either way, and the CPO is the authority on the interpretation. The `--polyrepo` flag forces umbrella mode without prompting. STRAP never silently switches modes.

**Polyrepo discovery flow** (when umbrella mode is selected). Section 4 runs the shallow scan once per detected sub-repo, narrating per-sub-repo progress. A manifest cross-reference pass detects cross-sub-repo dependency hints (e.g., `package.json` `dependencies` referencing a sibling sub-repo by name, `requirements.txt` editable installs, `*.csproj` ProjectReferences, `go.mod` replace directives) -- the first stage of a three-stage runtime-dependency funnel.

**Mixed specialist dispatch in Section 6.** Per-sub-repo briefs (dispatched in parallel via `CreateTeam`) for `backend-engineer`, `frontend-engineer`, `database-engineer` when each is relevant to multiple sub-repos -- their findings are inherently sub-repo-scoped (different language/framework per sub-repo would mush together in a single brief). Umbrella briefs for `security-reviewer`, `test-strategist`, `integration-specialist`, `devops-lead` -- their findings are inherently cross-cutting and only make sense viewed across the system.

**Three-stage runtime-dep funnel.** Manifest-cross-reference (Section 4) seeds the dependency edges; per-sub-repo specialist code-level confirm (Section 6) refines with observed imports + cross-service contracts; CPO confirmation at synthesis (Section 8) closes the gate via `AskUserQuestion` before the `Runtime dependencies` field lands in each `Sub-repos` entry. Stage 3 also surfaces negative findings explicitly ("no cross-sub-repo runtime deps detected; confirm or edit") so curated absence is recorded.

**Budget aggregation.** The session-aggregate budget grows additively in polyrepo mode: `projected_aggregate = session_aggregate + (N - 1) * per_sub_repo_increment` where `per_sub_repo_increment` comes from `budget-discipline.md` (300K for `/strap-in`, 200K for `/strap-refresh`). The math is shown to the CPO at the Section 3 budget prompt -- no hidden multipliers.

**`/strap-refresh` polyrepo path.** Mode is detected from the existing populated `Sub-repos` section in `project-profile.md`; no re-prompting. Structural diffs (sub-repo added on disk but not declared; sub-repo declared but missing on disk; per-sub-repo stack drift) surface explicitly at Section 6's diff-summary gate with defer / ignore / accept options.

**Per-sub-repo project-docs rendering is out of scope** for v2.3's initial polyrepo Feature; the umbrella `PROJECT.md` / `ARCHITECTURE.md` / `STACK.md` capture the system view, with per-sub-repo summaries plus a per-sub-repo Stack table. A future Feature in the polyrepo Epic adds per-sub-repo project-docs alongside the umbrella set.

## The connection-discovery model

STRAP runs against host systems (work tracking + source control) that vary per adopter. Hardcoding `az boards` or `gh issue` into skills would foreclose the portability that motivates STRAP. Instead of shipping a fixed adapter per host, STRAP probes each host live and persists a per-project profile.

Two `/connect-*` skills drive this. Each follows the same five-step flow:

1. **CPO names the host** via `AskUserQuestion` (Azure DevOps / Jira / GitHub Issues / Local / Other for work-tracking; Azure Repos / GitHub / Bitbucket / Local Git / Other for source-control).
2. **Dev-lead authenticates** -- env-var REFERENCES only; credential values never enter any tracked file.
3. **Dev-lead explores** the host's capabilities: types, states, fields, links, iterations, PR-feedback surface. Write probes only with explicit CPO consent.
4. **Dev-lead models** the host as a connection profile: logical-to-host type mappings, state mappings (with `state_asymmetries` fallback for hosts where the state machine collapses), field mappings, capability declarations, and `operation_templates.<op>` -- per-operation Mustache-templated request bodies for create / read / update / delete / query / link / comment / etc.
5. **Dev-lead validates with the CPO and persists.**

Every production-workflow skill reads `operation_templates.<op>` from the profile at runtime, substitutes placeholders from the call site, and executes via the appropriate transport (Bash/curl for HTTP hosts, `az` / `gh` CLIs, filesystem writes for Local strap-agile). Deterministic templates over reasoned-on-the-fly execution. New hosts ship as accelerator templates under `.claude/strap/templates/connection-templates/`; the discovery flow uses them as priors if present, runs from scratch if absent.

**Local mode (strap-agile).** One of `/connect-devops-project`'s host options is `Local`. Work items live as markdown files under `.claude/strap/work/<type>/<id>-<slug>.md`. Each carries YAML frontmatter (id, type, state, parent links, assignee, timestamps); the body is the work-item content. State transitions update frontmatter. This is **work-item-tracking-as-code**: PR-reviewable, diffable in git history, branch-aware, no external service. Operations execute as filesystem writes; capabilities like `iteration_get_capacity` are unsupported (no calendar / team-capacity model in flat files) and the skills that consume capacity degrade per the documented fallback (read assumptions from project-profile.md).

## Dispatch model

The dev-lead is the only fan-out layer. Specialists never spawn other specialists.

Two primitives, two scenarios:

| Primitive | Use case | Return channel |
|---|---|---|
| `Task` / `Agent` (serial) | Authoring chains where one specialist's output feeds the next; single-target read-only investigations; review interactions where the dev-lead needs the result before continuing | Tool result |
| `CreateTeam` + parallel `Task` invocations + `SendMessage` (parallel) | Sprint execution waves; PR-feedback rounds; onboarding deep-dives; any case where 2+ specialists work on genuinely independent slices | Team channel via explicit `SendMessage` calls; specialists must call `SendMessage` or the dev-lead waits indefinitely |

`CreateTeam` is gated behind two harness env keys (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and a valid `CLAUDE_CODE_SPAWN_BACKEND`); the installer seeds these in `settings.json` at install time. Skills that depend on parallel fan-out check for these keys at pre-flight and surface an actionable error if absent.

Teammate shutdown via `SendMessage` is unreliable; `/team-cleanup` is the documented recovery primitive when team state wedges.

## Work-item lifecycle metadata convention

Every STRAP-created work item carries three pieces of metadata that survive across host conventions:

1. **Lifecycle metadata block** at the top of the description body -- a table with `Authored By` / `Authored At` / `Completed By` / `Completed At` fields populated via Mustache placeholders in the type-specific template (`requirement.template.md`, `spec.template.md`, etc.). Set at create (Authored half) and at resolution (Completed half) by the relevant skill. Template re-rendering on resolution preserves the original Authored half.
2. **`AI` tag** distinguishing AI-authored work from human-authored work. Surfaces in DORA queries (Agent Efficiency Ratio compares `AI`-tagged Tasks' original estimate against actual cycle time) and in adopter reporting.
3. **`strap:<logical-type>` tag** (e.g., `strap:requirement`, `strap:bug`) for findability when the host's type mapping collapses (e.g., Azure DevOps' `Issue` is shared by Requirements and Bugs in some process templates). The `strap:<logical-state>` tag (e.g., `strap:resolved`) plays the parallel role when the host state machine collapses (ADO Task has no Resolved; the tag preserves the logical state).

State transitions are audited via `[STRAP/agent:<name>]` comments posted through `operation_templates.work_item_comment_add` so the logical actor is identifiable even when the host's native actor identity is always the human's `az` credential. Markdown-to-HTML conversion happens at the boundary for HTML-flavored hosts (declared by `mapping.field_formats.description`); markdown-flavored hosts (Local strap-agile) pass through unchanged.

## End-to-end pipeline run

Once installed and connected, STRAP drives features from idea to PR through a stable sequence:

```
1. CPO has an idea.
   /new-requirement -> req-lead drafts Requirement; CPO refines via /refine-requirement
                       until Resolved.

2. Requirement is Resolved.
   /create-spec -> spec-lead drafts Spec outline.
   /refine-spec drives Constituent Parts toward Resolved.

3. Spec is Resolved.
   For Specs with user-facing scope (any client-ui Constituent Part):
   /create-mockups -> designer interviews CPO, builds mockup code in the
                      configured paths, iterates until CPO approves, writes
                      the Mockup Reference section back to the Spec.
   /analyze-mockups -> spec-lead audits coverage + extracts data shapes +
                       maps to backend API declarations, writes the
                       Mockup Wiring Guide back to the Spec.
   /generate-features refuses if a user-facing Spec is missing either
   section; otherwise:

   /generate-features -> spec-lead authors Feature briefs; dev-lead persists
                         with v2.2 metadata.
   /decompose-feature -> per-Feature; activates any required domains (CPO-gated
                         structural precondition); dispatches active-domain
                         specialists in parallel via CreateTeam for read-only
                         planning; reconciles; persists Stories + Tasks.

4. Features ready.
   /plan-sprint -> single-sprint allocation (hard rule; overflow stays unallocated).
   /rebalance-sprint -> cross-sprint flow at sprint boundaries or mid-sprint.

5. Sprint executes.
   /execute-sprint -> dev-lead creates feature branch + per-agent worktrees.
                      Tasks sequenced by dependency, dispatched in waves via
                      CreateTeam. Dev-lead reviews each task branch, runs the
                      centralized test pass, sets Completed By / At at
                      resolution, prepares the PR.

6. PR opens. Reviewers comment; CI runs.
   /refine-pr -> dev-lead reads comments + failed checks via the source-control
                 connection profile, categorizes by domain, dispatches relevant
                 specialists, pushes fixes to the existing feature branch.
                 Thread resolution stays with the human reviewer.

7. PR merges.
   Work items reach Resolved via the v2.2 state convention -- execution
   skills stop at Resolved by design. The next /dora-reconcile run's Pass A
   cascade lands Feature/Enhancement -> Resolved when their child Stories
   are all Resolved and the linked PR has merged.

8. /close-ceremony.
   The deliberate CPO ritual that walks Resolved Features, Enhancements,
   Bugs, and lingering Stories and decides per item: close (Resolved ->
   Closed, value accepted), reject (back to Active with `rework` tag),
   defer (stays Resolved with `defer:<reason>` tag), or skip.
   Cycle complete.

Companion paths:
- /quick: single-motion CPO orchestration lever. Free-form description ->
  classification -> work-item chain creation -> specialist routing ->
  implementation -> centralized test pass -> draft PR, all in one
  invocation. Five chain shapes adapt to the ask; never refuses for size.
  Bypasses the deliberate Requirement -> Spec ceremony for DO-NOW work.
- /file-bugs / /fix-bugs: lighter-weight intake + targeted fix for Bug +
  Enhancement items, same v2.2 metadata + state-transition discipline.
- /reset-feature: destructive Feature subtree delete; pre-deletion audit
  comment posted on the linked Spec so the trail survives.
- /context-prep / /context-fetch: cross-session continuation runbooks.
- /team-cleanup: recovery primitive for wedged team state.
```

Every operation runs through `operation_templates.<op>` from one of the two connection profiles. Skills are portable across adopters because their dispatch logic references logical types and active-domain specialists; the per-host details live in the connection profile and the project-profile, not in the skill body.

## DORA governance and close ceremony

v2.2 introduces an explicit governance + metrics layer on top of the production pipeline. The convention separates **execution** (workflow skills that stop at Resolved by design) from **value acceptance** (the CPO ritual that closes Resolved work) from **data quality** (the daily janitor that keeps lifecycle metadata honest) from **interpretation** (the snapshot/render pair that turns data into reports).

**`/close-ceremony`** -- the deliberate CPO ritual for Resolved -> Closed transitions. The execution skills (`/execute-sprint`, `/fix-bugs`, `/quick`, `/refine-pr`) all stop at Resolved by design; `/close-ceremony` is the only authoritative manual gate that converts Resolved into Closed. CPO walks Resolved items one at a time (or in batch via text response) and decides per item: **close** (value accepted), **reject** (back to Active with `rework` tag + audit reason), **defer** (stays Resolved with `defer:<reason>` tag), or **skip**. Filter by `--type`, `--owner`, `--days`; `--dry-run` previews without applying. Produces a ceremony report at `.claude/strap/state/close-ceremonies/`.

**`/dora-reconcile`** -- the daily data-quality janitor. Auto-cascades forward (Story -> Resolved when all child Tasks are Resolved; Story -> Closed when parent Feature/Enhancement is already Closed; Requirement -> Closed when linked Spec is Resolved and a Feature is in a sprint) and surfaces hygiene gaps across eight passes (state mismatches, stale items, unlinked PRs, AI-tag inheritance, date hygiene, CompletedWork hygiene, Bug-specific hygiene, parent-child structure). With `--auto-fix`, derivable fields (state-transition timestamps + `AI`-tag inheritance from description metadata + wall-clock `CompletedWork` for AI-authored items) get stamped. The skill never invents data. Run log at `.claude/strap/state/dora-reconcile-runs/`. The load-bearing piece of the governance layer -- without daily reconcile, the lifecycle-metadata wiring sits idle.

**`/dora-collect`** + **`/dora-report`** -- the snapshot/render pair. `/dora-collect` writes a structured JSON snapshot of work items, work-item revisions (when supported), pipeline runs (bucketed by `project-profile.md`'s `Layers` section -- the adopter-configurable partitioning that drives per-layer DORA-4 breakdowns), PRs (split into integration vs intermediate streams per `code-connection.yaml`'s `default_branch`), reverts, and skill-log counts. The snapshot is read-only against every data source. `/dora-report` consumes the snapshot and renders a self-contained HTML report with embedded Chart.js: ten sections including Per-Developer Profile (active-developer set computed as UNION across seven output sources so mid-Story developers on feature branches don't show as "did nothing"), Pipeline Funnel, Layer Metrics, PR Health (size distribution by RefUpdate iteration count -- no diff API calls), Skill Calibration, Quality, Aging. **Wall-clock as primary AI Efficiency Ratio** (sidesteps the well-known OE/CW data-entry artifact where `CompletedWork` gets stamped equal to `OriginalEstimate` at close-time, making the ratio read 1.00x universally). Supports `--compare` for side-by-side prior-sprint analysis and `--last-n N` for multi-sprint trend charts, with `--quality-threshold` filtering low-quality snapshots from trend math.

**`dora-analyst`** -- the interpretation specialist dispatched by the dev-lead when the CPO asks for analysis on top of a rendered DORA report. The analyst reads the snapshot + HTML, performs interpretive analysis (anomaly investigation, trend explanation, release-readiness recommendations, governance-compliance assessment, per-developer load-balance interpretation), and produces a structured analysis report at `.claude/strap/state/dora-analyses/`. **The analyst is the interpretation layer, not the operator** -- the dev-lead runs the data-acquisition skills (collect, report, reconcile) directly because they're mechanical; the analyst's value-add is interpretation atop the data, never raw queries.

The four skills + the agent form a self-reinforcing governance loop: execution lands work at Resolved -> reconcile keeps the metadata honest -> collect snapshots the cleaned state -> report renders the evidence -> analyst interprets when the CPO asks -> close-ceremony converts Resolved to Closed when the CPO has accepted the value. The `AI` tag and `strap:<logical-type>` tag are the load-bearing convention that lets all five distinguish AI-authored from human-authored work and route correctly across the loop.

## Onboarding and upgrade

Three skills carry the install + maintenance lifecycle.

**`/strap-in`** -- the first-encounter onboarding skill the CPO runs after install. The dev-lead reads the codebase at a shallow scope, dispatches relevant specialists in parallel via `CreateTeam` for read-only deep-dive, and curates the persistence stack (`project-profile.md`, per-agent memory, per-agent rules) so the canonical roster comes alive for THIS project. Code immutability is enforced throughout via read-only tools palettes (`Read, Grep, Glob, Bash` -- no `Write`, no `Edit`). The invariant releases when `/connect-code-repo` clears its satisfied gate.

**`/strap-refresh`** -- the re-run companion. Reads the existing persistence stack as priors, runs a shallow scan against the current codebase, detects diffs between priors and current state, surfaces them to the CPO for approval, then dispatches only the specialists whose domains actually changed (or newly appeared). The single-curator rule applies to refresh runs same as initial onboarding.

**`/strap-upgrade`** -- the package-vs-install reconciliation skill. Diffs the freshly-pulled STRAP package against the adopter's installed `.claude/` tree using the previous-version tarball (distribution mode) or `git show <previous-tag>:<path>` (source mode) as the three-way-merge anchor, applies non-conflicting package changes, surfaces conflicts on package-managed files for CPO resolution, preserves adopter customizations on protected paths, and updates `.claude/.strap-version.json`. The protected-paths list mirrors the persistence-stack ownership and is split into two categories: **adopter-owned** (project-profile, continuations, state, settings -- excluded from diff entirely, no adds either) and **seeded-then-curated** (per-agent memory, per-agent rules, dev-lead memory + index -- package-only adds APPLIED so new operating learnings or new specialists land at the adopter install; modify and conflict suppressed so adopter curation wins). See [`upgrade-guide.md`](./upgrade-guide.md) for the operational walk-through.

## What is NOT in v2.3

For clarity:

- **Federation across multiple work-tracking adapters within one installation.** Each surface has at most one adapter.
- **Multi-language LSP/AST tooling.** Specialists read code via Claude rather than parsing it programmatically.
- **Per-sub-repo connection profiles in polyrepo mode.** v2.3 ships polyrepo umbrella discovery + per-sub-repo persistence-stack entries, but the connection profile is umbrella-scoped (one work-tracking + one source-control profile per install root). A future Feature in the polyrepo Epic extends the schema for per-sub-repo source-control endpoints.
- **Per-sub-repo project-docs rendering.** Umbrella `PROJECT.md` / `ARCHITECTURE.md` / `STACK.md` capture the system view; per-sub-repo doc rendering is a future Feature.
- **Multi-repo execution awareness** in `/execute-sprint`, `/fix-bugs`, `/refine-pr`, `/quick`. v2.3 polyrepo discovery is read-only; execution skills still operate against a single repo at a time. A future Feature extends execution for cross-repo Tasks.
- **Strap-agile iterations filesystem layout.** Capability is declared `supported` but the file shape is undefined; a future release will pin it down alongside an HTML backlog/kanban/sprint viewer.
- **In-place edits to canonical agent role contracts, STRAP-shipped SKILL.md files, or team rules files.** These are package-owned; in-place edits surface as `conflict` on every `/strap-upgrade`. The supported customization paths are per-agent rules (augment canonical agents), adopter-authored new agents and skills (add alongside the canonical set), and per-agent memory (project-specific tradecraft).

## References

- [`strap-in.md`](./strap-in.md) -- the adopter-facing narrative this document complements.
- [`customization-guide.md`](./customization-guide.md) -- how adopters tailor STRAP within v2.2's curation model.
- [`upgrade-guide.md`](./upgrade-guide.md) -- the `/strap-upgrade` operational walk-through.
- [`../contexts/onboarding-design.md`](../contexts/onboarding-design.md) -- v2 design source-of-truth + canonical connection-profile schema.
- [`../contexts/budget-discipline.md`](../contexts/budget-discipline.md) -- cross-cutting budget pattern every workflow follows.
- [`../../../CLAUDE.md`](../../../CLAUDE.md) -- session-startup identity grounding (read once per session).
- [`../../skills/connect-devops-project/SKILL.md`](../../skills/connect-devops-project/SKILL.md) -- work-tracking connection-profile schema source-of-truth.
- [`../../skills/connect-code-repo/SKILL.md`](../../skills/connect-code-repo/SKILL.md) -- source-control connection-profile schema source-of-truth.
- [`../../skills/decompose-feature/SKILL.md`](../../skills/decompose-feature/SKILL.md) -- reference v2.2 skill (parallel CreateTeam dispatch + lifecycle metadata).
- [`../../skills/execute-sprint/SKILL.md`](../../skills/execute-sprint/SKILL.md) -- reference v2.2 skill (lifecycle metadata round-trip + Local Git PR ceremony).
