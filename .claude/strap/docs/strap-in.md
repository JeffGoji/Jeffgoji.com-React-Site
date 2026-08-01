# strap-in

*how a small team of AI specialists ships software under one human's authority*

---

## What is STRAP?

STRAP -- the **Spec-To-Release Agentic Pipeline** -- is a portable agentic SDLC pipeline. A coordinated team of AI agents that takes raw ideas through requirements, specifications, decomposition, parallel implementation, and pull-request creation, all under a single human's authority.

It is built to be installed. Drop it into any software project, run a single skill, and a complete software-development team comes online: a planning side that turns ideas into specifications, an implementation side that builds against those specifications, a review side that holds the line on security and infrastructure, and a documentation side that captures it all for the audiences who need to read it.

The point of STRAP is not to remove the human. The point is to give one human the leverage of a small team. The human stays in control: they decide priority, they approve work, they merge pull requests. The agents do the work the human directs them to do, in parallel, with discipline, and with memory that grows alongside the codebase.

And the leverage compounds when more humans join. Multiple humans can each operate their own STRAP super-pair in parallel -- N orchestrators, N dev-leads, N agent teams -- all working against the same source-controlled persistence stack. The output multiplier scales with the orchestrator count, not just the agent count. One human gets a small team's velocity; N humans get N teams in coordinated motion against shared context.

STRAP can be installed across multiple products and companies -- every installation gets the same canonical pipeline, adapted to its stack and conventions over time through a curation model the rest of this document explains.

---

## What's in the Box?

A quick tour of what makes STRAP distinctive. Each item below has a deeper treatment further down this document and across `.claude/strap/`, but here is the shape of what you are getting in one pass.

### Discipline Over Cleverness

STRAP refuses several patterns that other agent setups treat as features. The discipline pays compounding returns.

- **Non-destructive Onboarding.** Specialists run with a read-only tools palette during `/strap-in` and `/strap-refresh` — `Read, Grep, Glob, Bash`; no `Write`, no `Edit`. Your production code cannot be modified during persistence-stack curation. Two narrow closing-phase exceptions exist for local-doc writers (`tech-writer` for project-docs, `designer` for mockups); both are scoped to adopter-owned local paths.
- **Centralized Test Execution.** Only the dev-lead runs the test suite, in a single pass at PR preparation. Specialists author tests alongside production code but never run them. Cuts cascade-failure spirals when test orchestration is mixed across N specialists.
- **Token Budgets.** Explicit per-agent + session-aggregate ceilings, set by the CPO once at install. Subsequent workflows pull defaults silently from `MEMORY.md`. Tune any time via `/revise-token-budget`. Polyrepo sessions surface an additive projection (_"3 sub-repos detected; projection: 1M + 2 × 300K = 1.6M"_) so cost is never hidden.
- **CPO Authority.** Every state transition requires explicit human approval. No agent merges PRs. No skill silently invokes another. The leverage is in how much you can confidently delegate — not in how much the agents do behind your back.

### Persistence as Code ("PaC")

Context lives where code lives. The persistence stack is **source-controlled, PR-reviewable, branch-aware, and shared** — across every session, across every developer, across every hand-off. STRAP doesn't get smarter by growing more agents; it gets smarter by growing what the agents read. This is the whole point.

- **Agent Context as Code.** `project-profile.md` is the canonical record of what your project IS — stack, conventions, active domains, build commands, sensitivities. Every agent reads it on every invocation. Lives in your repo, travels with your code, survives staff changes; one team-curated source of truth across N orchestrators.
- **Agent Memory as Code.** Per-agent memory files capture project-specific tradecraft (_"the test runner needs warming after fresh installs"_; _"this codebase prefers the older mapping pattern for X"_); per-agent rules files capture guardrails (_"never push directly to main"_). Soft learnings vs hard constraints, both source-controlled, both growing. Onboarding a new developer onto the project? They inherit every accumulated learning the moment they open the repo.
- **Single-Curator Rule.** Only the dev-lead writes to rules and memory. Specialists report findings; the dev-lead decides what gets persisted. No drift, no contradictions, no stale tradecraft accumulating from N parallel writers. Even when multiple humans are orchestrating in parallel, the curation discipline keeps the persistence stack coherent.
- **Auto-Discovery.** `/strap-in` reads your codebase at shallow scope (manifests, file-tree shape, recent git activity, CI config), infers the stack, dispatches the relevant specialists in parallel for read-only deep-dive, and synthesizes findings into the persistence stack. The CPO confirms at every gate; nothing happens silently.

### Self-adapting Onboarding & Discovery

Fifteen canonical agents ship to every adopter. What changes per install is which agents are active and how they understand your project — STRAP figures that out itself.

- **Dormant Agent Activation.** Agents that aren't relevant to your stack stay dormant — memory and rules persist as empty bootstrap files; no dispatch happens. When a domain shows up later (a new mobile client, a fresh integration surface, a new database), `/strap-refresh` detects the signal and activates the relevant specialist without re-onboarding from scratch.
- **Polyrepo Support.** When the install root contains multiple peer sub-repos at depth-1 (each with its own `.git/`), `/strap-in` recognizes the umbrella shape and offers a three-way CPO choice — polyrepo umbrella, per-sub-repo install with guidance, or single-project at root with caution. In umbrella mode, Section 4 discovery runs per sub-repo, specialist dispatch is mixed (per-sub-repo briefs for backend/frontend/database; umbrella briefs for security/test/integration/devops), and cross-sub-repo runtime dependencies surface through a three-stage funnel (manifest parse → specialist code-level confirm → CPO synthesis confirm).
- **Form-Factor-Agnostic Specialists.** `frontend-engineer` covers any client-side UI — web (Angular / React / Vue / Svelte), desktop (WPF / WinForms / MAUI / Avalonia / Borland C++ Builder VCL / Qt / JavaFX), mobile (Xamarin / MAUI / SwiftUI / native iOS+Android), and server-rendered (Python widget libraries like Streamlit / Dash / Gradio and in-house/custom widget frameworks; Phoenix LiveView; Rails Hotwire; Razor / Blazor Server; classic template engines). The same disciplines (state ownership, parent/child contracts, i18n, composition) translate across all of them.
- **Surgical Refresh.** `/strap-refresh` reads the existing persistence stack as priors, detects diffs against the current codebase, surfaces them for CPO approval **BEFORE** dispatching any specialist or updating any curated content, then applies targeted edits — not whole-file rewrites. CPO edits, narrative additions, and prior-refresh curation are preserved. Project-docs get the same surgical treatment; un-flagged sections stay byte-identical.

### Drop-In Integration

Your work-tracking host. Your source-control host. Your existing docs directory. STRAP probes each at connect time and persists per-project profiles that the pipeline reads at runtime.

- **DevOps Integration.** Host-agnostic: Azure DevOps Boards / Jira / GitHub Issues / Local (`strap-agile`) / Other. The `/connect-devops-project` skill probes the host, models the connection (logical-to-host type mappings, fields, states, operation templates), validates with the CPO, and persists. Capability declarations mean unsupported operations degrade gracefully — no silent failures. Custom Map UX captures bespoke process templates whose types don't match the canonical set.
- **Source Control Integration.** Same five-step model: Azure Repos / GitHub / Bitbucket / Local Git / Other. `/connect-code-repo` clears the code-immutability invariant when wired — the deliberate transition from onboarding to operational mode. Write probes validate auth + network + git CLI end-to-end with explicit CPO consent; the test artifact (a throwaway branch created and deleted) appears in the connection profile for audit.
- **Work-Tracking as Code (strap-agile).** Optional `Local` mode for `/connect-devops-project`. Work items become markdown files in your git history — PR-reviewable, diffable, branch-aware. The _"ticket says X but code does Y"_ mismatch becomes impossible because both are tracked in the same atomic change. The right call for small teams and solo developers; not positioned as a wholesale replacement for Azure DevOps Boards or Jira on large multi-team programs.
- **Seven Logical Work-Item Types.** STRAP's logical model — Requirement / Spec / Feature / Enhancement / Story / Task / Bug — maps to each host's native types via the Custom Map UX. Where the host carries native types matching one-to-one, the mapping is exact. Where types collapse (Azure DevOps' `Issue` shared by Requirements and Bugs in some templates), the `strap:<logical-type>` tag preserves findability.

### Self-documenting Outputs

Beyond agent work, STRAP produces durable artifacts your team can review the same way they review code. Each one is auditable, diffable, and meaningful at a glance.

- **Project-Docs Pipeline.** `/strap-in`'s closing phase produces `PROJECT.md` + `ARCHITECTURE.md` + `STACK.md` at the configured `Project docs paths` — human-facing orientation distilled from the curated persistence stack. A self-contained HTML companion renders alongside via the bundled markdown-to-HTML pipeline shipped at `.claude/strap/tools/html-render/`. The bar: _a new contributor reading them cold would understand what the project is, how the code is structured, and what it is built with._
- **Mockup-as-Contract.** `designer` produces deployable mockup code (real interactive mockups, built with the same component libraries the production app uses — not sketches, not wireframes) that `frontend-engineer` ports verbatim. The mockup IS the visual contract; the implementation is the port. `/create-mockups` → `/analyze-mockups` is the pre-decomposition gate for Specs with user-facing scope.
- **DORA Governance + AI Efficiency Ratio.** Built-in metrics layer: `/dora-collect` snapshots, `/dora-report` renders a self-contained HTML report with embedded Chart.js (DORA-4 + AI Efficiency Ratio comparing original estimates vs actual wall-clock cycle times), `/dora-reconcile` is the daily data-quality janitor. Wall-clock is the primary AI-efficiency signal (preserves the hard-won OE/CW data-entry artifact lesson). Adopter-configurable per-layer DORA-4 breakdowns when the project profile declares Layers.
- **Cross-Session Continuations.** Multi-session work survives via `/context-prep <topic>` (write a runbook capturing where things stand — files in flight, open decisions, work items, quick-resume actions, critical context) and `/context-fetch <topic>` (resume cold by loading the runbook as session-startup context). Multi-developer hand-offs travel through these. No mid-feature work is ever stranded.

---

## Meet the Agent Team

Fifteen agents ship with STRAP. Together they form a complete software-development team. They are stable: the same fifteen ship to every adopter, every install. They are dormant when not needed and active when work comes their way. Over time the dev-lead refines them -- adding rules where guardrails are needed, adding memory where tradecraft is worth keeping -- but the agents themselves do not get renamed, replaced, or regenerated.

The team splits into two halves. **agent-ops** plans and coordinates. **agent-devs** implements and verifies.

### The super-pair at the center

You -- the human typing the prompts -- are the **CPO**. The Claude Pipeline Orchestrator. You set priority. You approve work. You decide. Your authority is non-negotiable; no agent can impersonate you and no skill can run a state transition without your sign-off.

Claude itself -- this session, the one you are talking to right now -- is the **dev-lead**. Your working partner. The dev-lead does not write production code directly. It coordinates the team, dispatches specialists, synthesizes their work, curates their rules and memory, and brings everything back to you. It is the only agent that talks to you; everyone else routes through it.

This is the **super-pair**. Everything else extends from this one relationship.

### agent-ops -- the planning and coordination team

**req-lead** owns Requirements. When you bring a raw idea -- a customer complaint, a market opportunity, an operational pain point -- req-lead refines it. Asks probing questions one at a time. Surfaces open questions and tracks them. Forces decisions where stakeholder needs conflict instead of papering over them. Writes the result as a structured Requirement with a clear Problem Statement, Desired Outcome, Success Criteria, and Scope. Allergic to vague problem statements.

**spec-lead** owns Specifications. Takes resolved Requirements and produces Specs with enough technical depth that the implementation team can decompose them without coming back to ask clarifying questions. Researches the codebase. Names specific files, modules, services, and components. Generates Features and Enhancements once a Spec is approved. The bridge between "what" and "how."

**designer** owns UI and UX. Interviews you on intent, audience, scope, and fidelity tier. Produces deployable mockup code -- actual interactive mockups built with the same component libraries the production app uses, not sketches -- that the frontend implementation team ports verbatim into production. The mockup IS the visual contract.

**tech-writer** owns documentation. Drafts feature pages, release notes, use-case guides, API docs, architecture docs, how-to guides. Adapts tone to the configured audience: community for non-technical readers, code for developers, both when both are configured. Drafts locally, publishes through the docs adapter, never invents metrics.

**sprint-planner** owns iteration cadence. Allocates Stories and Tasks into sprints based on the configured capacity model. Tracks velocity. Produces sprint reports. Rebalances at iteration boundaries. Surfaces capacity conflicts rather than silently spilling.

**dora-analyst** owns metrics and quality governance. Tracks the four DORA metrics -- Deployment Frequency, Lead Time for Changes, Change Failure Rate, Mean Time to Restore -- plus an Agent Efficiency Ratio that compares original estimates against actual cycle times. Evaluates release-readiness gates. Produces evidence; you interpret and decide.

**ux-test-engineer** owns end-to-end and load testing. Derives test plans from Spec acceptance criteria. Authors and runs E2E suites. Files structured Bug work items for failures with reproduction steps and structured evidence. Runs load tests on a release cadence and hands results to dora-analyst.

### agent-devs -- the implementation and verification team

**dev-lead** is Claude. That's you talking to it right now. Introduced above.

**backend-engineer** implements server-side code: domain entities, application services, transport handlers, data-access seams, message contracts, integration glue. Holds the line on clean architecture and dependency injection. Authors unit tests alongside the production code but does not run them -- only the dev-lead runs the test suite, at PR preparation, in a single centralized pass.

**frontend-engineer** implements client-side code across web, desktop, mobile, native, and server-rendered form factors -- Angular / React / Vue on web, WPF / WinForms / MAUI / Avalonia / Borland C++ Builder VCL on desktop, Xamarin / MAUI / SwiftUI on mobile, Electron / Tauri / Flutter Desktop cross-platform, and server-rendered patterns (Python widget libraries like Streamlit / Dash / Gradio and in-house/custom widget frameworks, Phoenix LiveView, Rails Hotwire, Laravel Livewire, Blazor Server, ASP.NET MVC views, classic template engines, vendored JS widget libraries like DHTMLX / ExtJS). The disciplines are the same regardless: state-ownership (containers own derivation, views observe), parent/child contracts (typed inputs and outputs at every boundary), i18n (externalized through the framework's primitive), composition (small reusable elements). When mockups exist, ports them verbatim under the designer's contract.

**database-engineer** owns the persistence layer: entity definitions, relationships, schema migrations, indexing strategy, query plans. Generates migrations and inspects them. Applies them to the local development database to confirm they run -- and only the local database. Production, UAT, and shared-development are pipeline-only. No exceptions. No `--force` flag turns it off.

**devops-lead** owns infrastructure-as-code, cloud fabric, and pipeline definitions. Analyzes and builds. Authors IaC, surfaces state-management and secret-handling defects, builds the CI/CD pipelines themselves. But never runs apply, deploy, or any state-mutating command against an environment with dependents -- the pipeline applies; the devops-lead produces the IaC and the plan output. When the CPO pushes back on that rule, the answer is still no.

**security-reviewer** is the OWASP-aligned audit gate. Reviews code for authentication explicitness, authorization rigor, tenant isolation when the project is multi-tenant, input validation, injection prevention, secrets handling, error-response hygiene, API surface controls, and mass-assignment defense. Severity is non-negotiable. Critical and High findings block merge.

**integration-specialist** owns external-system integration. Dynamic endpoints, per-tenant configuration stores, retry policies, bidirectional mapping at trust boundaries, DI rigor across federated sub-services. Dormant when the project has no external surface; activated the moment one appears.

**test-strategist** authors test strategy at the Feature level, reviews test coverage intent across the team's tests, and triages test-code failures the dev-lead redispatches. Does not run tests -- that is the dev-lead's centralized responsibility.

### How they work together

The dev-lead -- you, in this session -- dispatches specialists via Claude Code's primitives. Parallel fan-out (sprint execution waves, PR-feedback rounds, onboarding deep-dives) uses `CreateTeam` so specialists appear as named, color-badged teammates and reply through a single team channel via `SendMessage`. Serial dispatch (authoring chains where one specialist's output feeds the next, or single-target read-only investigations) uses `Task` / `Agent` directly. Each specialist works in its own scope -- a worktree, a branch, a set of files -- so they do not step on each other.

When a specialist finishes, it reports back to the dev-lead. The dev-lead synthesizes: reconciles overlaps, fills gaps, flags issues. Then the dev-lead reports back to the CPO with a coherent unified output the CPO can review in a single pass.

Specialists never talk to the CPO directly. They never spawn other specialists. They report; the dev-lead curates; you decide.

---

## STRAP Persistence -- Context and Memories

Here is what makes STRAP genuinely different from a one-off agent setup: it gets better over time. Not because the agents themselves become smarter -- they are still markdown files -- but because the things they read become richer.

STRAP carries several kinds of source-controlled state. The dev-lead is the sole writer for all of them. Specialists only read. This is the single-curator rule, and it is what makes the persistence stack coherent: there is exactly one editor, and everyone else inherits.

### Team rules

`.claude/strap/rules/agent-ops.md` and `.claude/strap/rules/agent-devs.md` carry the cross-cutting team-level guardrails -- STRAP-wide conventions that ship verbatim to every adopter. Be critical, not agreeable. Never use emojis. No inline comments. Human authority is final. Traceability is mandatory. Centralized test execution -- only the dev-lead runs the test suite. Single curator -- only the dev-lead writes to rules and memory. One level of fan-out -- specialists never spawn other specialists.

These are the rules of the road. They do not vary per installation. They define what it means to operate as a STRAP team.

### Per-agent rules

`.claude/strap/rules/agents/<agent>.md` carries each agent's individual guardrails. backend-engineer has rules about clean architecture and dependency injection and async/await invariants. devops-lead has the no-apply-from-agent rule. designer has the mockup-is-a-contract rule. security-reviewer has the severity-is-non-negotiable rule.

These rules ship with starter content. They grow over time -- reactively. When the dev-lead notices something a specialist almost did wrong ("the backend-engineer almost committed secrets to settings.json"), the dev-lead adds a rule to prevent it next time. Rules are guardrails: you add them when something needs preventing.

### Per-agent memory

`.claude/strap/memory/agents/<agent>.md` carries each agent's accumulated tradecraft for THIS project. Not rules -- soft learnings. "This codebase prefers the older mapping pattern for X." "The test runner is flaky after a fresh dependency install; warm it once first." "Use `--no-build` after a separate build step or you waste eight minutes."

Memory grows as work happens. A specialist finishes a task, reports something it noticed, and the dev-lead decides whether the learning is worth keeping. If yes, the dev-lead edits the memory file. Next time that specialist runs, the learning is already there.

This is the part that compounds. Six months into a project, the per-agent memory files describe how to do the job WELL on this specific codebase. New developers operating as the CPO inherit that institutional knowledge automatically -- it is source-controlled, it travels with the repo, it survives staff changes.

### The project profile

`.claude/strap/contexts/project-profile.md` is the canonical record of what THIS project IS. Stack. Frameworks. Build commands. Test commands. Conventions. Architecture notes. DevOps integration. Every agent reads it on every invocation.

The project profile is what replaces the v1 idea of "render per-stack agents at install time." Instead of baking stack-specifics into every agent file at install, the agents stay generic and read the project profile to learn what stack they are working in. The dev-lead curates the project profile as the project evolves. A new tech adoption, a convention change, a known sensitivity surfacing -- all of it lands here.

### The dev-lead's own auto-memory

`.claude/strap/memory/MEMORY.md` plus topic files under `.claude/strap/memory/dev-lead/` is the dev-lead's own persistent memory. It works like the auto-memory pattern Claude uses across sessions in personal use, but project-scoped: categorized topic files indexed by a master file, growing over time with project shape, CPO preferences, operating learnings, and reference pointers.

This is the most important persistent file in the whole installation. The dev-lead is the curator of curators. Its own memory has to be disciplined: tight one-line index entries, named topic files, links between them where they share context.

### Continuations

`.claude/strap/contexts/continuations/<topic>.md` carries cross-session topic snapshots. Workstreams that span sessions -- a feature underway, a refactor in progress, a workstream the team has been chipping at for weeks -- get a continuation runbook capturing where things stand: where we left off, what is in flight, open decisions, open work items, quick-resume instructions, critical context, source-of-truth pointers.

The dev-lead writes these via `/context-prep` when handing off a session, and reads them via `/context-fetch` when resuming.

### Why this matters

Most AI tooling treats every session as fresh. You type your problem in, get a response, and the next session starts from zero. The tool cannot learn -- it has no place to put learnings.

STRAP gives learnings a place to live. Rules accumulate what should never happen again. Memory accumulates what should happen better. The project profile accumulates what this project is. Continuations accumulate where workstreams stand. The dev-lead's own auto-memory accumulates everything else.

All source-controlled. All shared across the team. All curated by the dev-lead.

The agents themselves stay simple. The intelligence is in the persistence stack.

---

## The Onboarding Flow

Installing STRAP into a new project is a deliberate ceremony, not a silent file-drop. Four skills carry the flow.

### `/strap-in` -- the super-pair meets the project

The first conversation. The dev-lead reads the codebase at a shallow scope -- top-level manifests, file-tree shape, recent git activity, CI config, mockup paths, integration markers, IaC files, E2E test markers. The CPO confirms operating budgets for the workflow (per-agent ceiling, session-aggregate ceiling). The dev-lead decides which of the fifteen canonical specialists matter for this codebase, presents the activation set to the CPO for confirmation or override, then dispatches the active ones in parallel via `CreateTeam` to deep-dive their respective domains.

Specialists report back. The dev-lead synthesizes findings into the persistence stack -- the project profile, per-agent memory files, per-agent rules additions cited to concrete observations. Reconciled across specialists where they overlap. Refined to the bar: another dev-lead resuming this project on a fresh session, with no memory of this conversation, would understand the project from the persistence stack alone.

After synthesis lands, the dev-lead invokes `tech-writer` at a closing project-docs production phase to render three human-facing orientation documents -- `PROJECT.md`, `ARCHITECTURE.md`, `STACK.md` -- from the curated persistence stack. These land at the configured `Project docs paths` (or the fallback `.claude/strap/project-docs/`) and give a new contributor reading the repo cold the same orientation the agents have. Bar: a new contributor reading them cold would understand what the project is, how the code is structured, and what it is built with.

Throughout, the adopter's production code is immutable. The Section 6 specialists run with a read-only tools palette (`Read`, `Grep`, `Glob`, `Bash` -- no `Write`, no `Edit`); the source under inspection cannot be modified during onboarding. The closing project-docs production phase is the explicit narrow exception -- `tech-writer` receives `Write` / `Edit` scoped to the configured `Project docs paths` only, never production source. This is the same exception pattern `designer` follows in `/create-mockups`. The invariant fully releases only when `/connect-code-repo` clears its satisfied gate -- the deliberate transition from onboarding mode to operational mode.

**Polyrepo support.** When the install root contains multiple peer sub-repos at depth-1 (each with its own `.git/`), `/strap-in` recognizes the umbrella shape and presents a three-way choice to the CPO: **proceed as polyrepo umbrella** (single STRAP install at the install root, with a `Sub-repos` section in `project-profile.md` capturing one entry per sub-repo and umbrella `PROJECT.md` / `ARCHITECTURE.md` / `STACK.md` describing the system view), **exit and install per sub-repo** (STRAP exits cleanly with guidance for running `/strap-in` independently in each sub-repo -- the right call when sub-repos have wildly different stacks, ownership, or release cadences), or **continue as single-project at root** (an explicit escape hatch when one sub-repo dominates and the rest are auxiliary, with a caution that per-sub-repo signals will be mushed together). The CPO picks; STRAP never silently switches modes. The `--polyrepo` flag forces polyrepo mode without prompting.

In polyrepo mode, the discovery loop runs once per sub-repo (manifests, file-tree shape, recent git activity), specialist activation unions signals across sub-repos, and the parallel deep-dive uses a mixed-dispatch model -- per-sub-repo briefs for `backend-engineer` / `frontend-engineer` / `database-engineer` when each is relevant to multiple sub-repos (so a Python sub-repo and a C# sub-repo don't get mushed into one backend brief), and umbrella briefs for `security-reviewer` / `test-strategist` / `integration-specialist` / `devops-lead` whose findings are inherently cross-cutting. Cross-sub-repo runtime dependencies are discovered through a three-stage funnel (manifest parse during shallow scan, specialist code-level confirmation during deep-dive, CPO confirmation at synthesis) and recorded in each sub-repo's `Sub-repos` entry. The session budget grows additively (`base + (N-1) * per_sub_repo_increment`) with the math shown to the CPO at the Section 3 budget prompt -- no hidden multipliers. Per-sub-repo project-docs are a later Feature; this initial polyrepo Feature ships umbrella docs only.

### `/connect-code-repo` -- source control wire-up

Required. Wires up where git lives. CPO picks the host (Azure Repos, GitHub, Bitbucket, Local Git, or Other via full from-scratch discovery) via an `AskUserQuestion`. The dev-lead authenticates, probes the host live, models the connection -- auth method, default branch, branch-protection observations, capability declarations, operation templates for PR creation and branch management -- validates the model with the CPO, then persists the profile at `.claude/strap/state/code-connection.yaml`. Credentials are recorded as env-var references only; values never enter any tracked file.

Pre-flight checks git installed; the flow refuses to proceed without it. Write probes -- with explicit CPO consent -- create-and-delete a throwaway branch on the real remote to confirm end-to-end credentials, network, and git CLI all work together. The probe evidence is recorded in the connection profile so a future audit can answer "did this connection validate against the live host."

### `/connect-devops-project` -- work-tracking wire-up

Optional but typical. Wires up where work items live. Same five-step discovery flow as `/connect-code-repo`, against Azure DevOps Boards, Jira, GitHub Issues, Local (strap-agile -- see the next section), or any other host via full discovery. The connection profile at `.claude/strap/state/devops-connection.yaml` records logical-to-host type mappings (the STRAP `Requirement` is this host's `Story`; STRAP's `Feature` is this host's `Epic`), field mappings, state transitions, capability declarations, and operation templates. Capability gaps are explicitly recorded so subsequent workflows degrade gracefully when the host doesn't support an operation.

### `/strap-refresh` -- the re-run

The companion to `/strap-in`. When the codebase shape changes -- a new framework adopted, a major directory introduced, CI moved to a new host, a fresh team convention surfaced -- `/strap-refresh` reads the existing persistence stack as priors, runs a shallow scan against the current state, detects diffs between priors and current, and surfaces them for CPO approval BEFORE dispatching any specialist or updating any curated content. Specialists run only against changed domains; memory files for unchanged domains stay byte-identical. Specialists newly activated by new signals get a fresh deep-dive against their previously-unread domain.

After synthesis, `tech-writer` applies **surgical** updates to the project-orientation docs (`PROJECT.md`, `ARCHITECTURE.md`, `STACK.md`) for the sections flagged as drifted by the diff list. Sections that did not drift stay byte-identical -- CPO edits, narrative additions, and prior-refresh curation are preserved. Whole-file rewrites at refresh time are a defect, not a feature.

For polyrepo installs, `/strap-refresh` detects mode from the existing `Sub-repos` section in `project-profile.md` -- no re-prompting, no depth-1 re-detection. The priors are authoritative; refresh just verifies they still hold. Structural diffs are surfaced explicitly: a sub-repo declared in `Sub-repos` but missing on disk (removed since the last refresh), a new depth-1 `.git/` subdirectory not yet declared (added since the last refresh), or per-sub-repo stack / convention / runtime-dependency drift. The CPO sees these structural diffs first in the refresh plan and can defer, ignore, or accept the default action per case before any updates land. Sub-repos entries get surgically updated -- the affected entry's affected fields change, every other entry and unaffected field stays byte-identical.

This matters: STRAP's curated persistence stack is a CPO-curated artifact, not an automated derivation. Updates require approval, not just detection. The single-curator rule applies to refresh runs same as initial onboarding.

---

## Work-Tracking as Code (strap-agile)

One of `/connect-devops-project`'s host options is **Local (strap-agile)**. This is not a fallback or evaluation-only mode -- it is a deliberate paradigm worth understanding.

In strap-agile mode, work items are **markdown files in your repo's git history**:

```
.claude/strap/work/
├── requirement/
│   ├── 0001-customer-export.md
│   └── 0002-multi-tenant-isolation.md
├── spec/
│   └── 0001-customer-export.md
├── feature/
│   ├── 0001-csv-export.md
│   └── 0002-pdf-export.md
├── story/
│   ├── 0001-csv-export-handler.md
│   └── 0002-csv-export-formatter.md
├── task/
│   └── 0001-author-csv-handler.md
└── bug/
    └── 0001-sales-routing-typo.md
```

Each file carries YAML frontmatter (id, type, state, parent links, assignee, timestamps); the body is the work-item content (problem statement, acceptance criteria, scope notes).

What this gets you:

- **PR-reviewable work items.** A Story is a `.md` file. Changes go through PR review -- same gates as code. The acceptance criteria of a Story can be debated and refined in code review before someone implements against it.
- **Diffable history.** `git log .claude/strap/work/` is the work-item changelog. WHEN was a Bug filed? WHO filed it? WHY (commit message)? Every answer is in git history. No separate audit surface to reconcile against.
- **Branch-aware.** A feature branch can carry provisional work items that only exist on that branch until merged. You can experiment with how to structure a Feature without committing to it on main.
- **Single source of truth.** Code and work-items move together in the same commit. The "ticket says X but code does Y" mismatch becomes impossible because both are tracked in the same atomic change.
- **Audit-friendly.** Compliance / DORA-style metrics become git-blame-able. The work-item history IS the git history.
- **Portable.** No external service to migrate to or from. Work items travel with the repo.

This is the same paradigm as IaC, applied to work tracking: **work-item-tracking-as-code**.

It is not positioned as a wholesale replacement for Azure DevOps Boards or Jira on large multi-team programs -- those tools earn their cost when capacity planning across many sprints, cross-team dependency graphs, executive reporting, and integrations with Slack / Teams / Salesforce are load-bearing. strap-agile is positioned as the **right choice for small teams, solo developers, and projects where the agility and PR-review-everything posture of work-as-code outweighs the breadth of a large DevOps platform.**

A future skill will render strap-agile work items as an exportable HTML view -- kanban board grouped by state plus backlog grouped by type -- so the work-tracking surface stays useful for at-a-glance project state without forcing CPOs back into `git grep`. For now: the markdown is the surface, and `git log` is the query language.

---

## The Production Workflows

Once onboarding is complete, the production pipeline runs through a tight set of skills the dev-lead invokes. Each follows the same v2.2 pattern: dev-lead owns the CPO conversation and the host-side persistence, specialists are dispatched for the focused work, every persisted item carries v2.2 lifecycle metadata, every state transition is audited as a `[STRAP/agent:<name>]` comment, and host-format translation happens at the boundary.

**Authoring chain.** `/new-requirement` + `/refine-requirement` (req-lead drafts; dev-lead persists). `/create-spec` + `/refine-spec` (spec-lead authors; dev-lead persists). For Specs with user-facing scope, the mockup tier runs next: `/create-mockups` dispatches the designer to interview the CPO, build deployable mockup code in the configured paths, and (on CPO approval after any number of iterations) write a Mockup Reference section back to the Spec; `/analyze-mockups` then dispatches spec-lead to audit completeness, extract mockup data shapes, map them to backend API declarations, and write the Mockup Wiring Guide back to the Spec. Once the Spec carries both the Mockup Reference and the Wiring Guide (or the Spec has no user-facing scope), `/generate-features` produces Features under it; `/decompose-feature` decomposes each Feature into Stories and Tasks via parallel-domain specialists. Every work item carries `Authored By` / `Authored At` metadata, an `AI` tag distinguishing AI-authored from human-authored work, and a `strap:<logical-type>` tag for findability even when the host's type mapping collapses.

**Execution.** `/plan-sprint` allocates Stories / Tasks / Bugs into the current sprint with a hard single-sprint constraint (overflow stays unallocated; cross-sprint flow is `/rebalance-sprint`'s sole responsibility). `/execute-sprint` creates the feature branch, dispatches active-domain specialists into per-agent worktrees, reviews each task branch, runs the centralized build-and-test pass, sets `Completed By` / `Completed At` at resolution, and prepares the PR via the source-control connection profile.

**Bug tier.** `/file-bugs` accepts informal CPO input, dispatches an intake specialist read-only for investigation and classification, and persists Bugs / Enhancements with the same v2.2 metadata + tag pattern. `/fix-bugs` is the lighter sibling of `/execute-sprint` for Bug + Enhancement work items -- targeted fixes, no Story decomposition, same metadata round-trip at resolution. Bugs in STRAP v2.2 are atomic (no child Task convention) -- `CompletedWork` lives on the Bug itself.

**Single-motion path.** `/quick` is the CPO "do now" lever: free-form description -> classification -> work-item chain creation -> specialist routing -> implementation -> centralized test pass -> draft PR, in one invocation. Five chain shapes adapt to the ask (atomic Bug; Enhancement+Story+Task; Feature+Story+Task; Story+Task under an existing parent; Task under an existing parent). Flags `--under <id>`, `--into <branch>`, `--mockup` (lightweight POC, distinct from the gated `/create-mockups` pre-decomposition flow), `--investigation` (produces a markdown report at `.claude/strap/investigations/<task-id>-<slug>.md` instead of code), `--stacked`, `--draft`. Hard CPO approval gate after classification; never refuses for size. Bypasses the deliberate Requirement -> Spec ceremony when the work doesn't need it.

**PR feedback.** `/refine-pr` reads reviewer comment threads and failed CI checks, categorizes by domain, dispatches the relevant specialists in parallel (or serially for file-conflicting fixes), runs the centralized build-and-test pass, and pushes updates to the existing feature branch. Thread resolution is owned by the human reviewer; the skill posts an optional round-of-fixes summary comment but never resolves a thread itself.

**Close ritual.** Execution skills (`/execute-sprint`, `/fix-bugs`, `/quick`, `/refine-pr`) all stop at Resolved by design. `/close-ceremony` is the deliberate CPO ritual that converts Resolved into Closed -- the value-acceptance moment. CPO walks Resolved Features, Enhancements, Bugs, and lingering Stories and decides per item: **close** (value accepted), **reject** (back to Active with `rework` tag + audit reason), **defer** (stays Resolved with `defer:<reason>` tag), or **skip**. Two walkthrough modes (per-item via `AskUserQuestion`, batch via text response) cover small and large ceremonies. Filter by `--type`, `--owner`, `--days`; `--dry-run` previews without applying. Produces a ceremony report at `.claude/strap/state/close-ceremonies/`.

**DORA governance.** `/dora-reconcile` runs daily (cascades only by default) or weekly with `--auto-fix` (also stamps derivable hygiene fields -- date stamping from state-transition timestamps, `AI` tag inheritance via three sub-phases, wall-clock `CompletedWork` for AI-tagged items). Eight reconciliation passes keep the metadata wiring honest. Pass D recommends `/close-ceremony` when items pending Closed > 14 days crosses 5. `/dora-collect` writes a JSON snapshot of work items, pipeline runs (bucketed by `project-profile.md`'s `Layers` section -- the adopter-configurable partitioning that drives per-layer DORA-4 breakdowns; defaults to single-layer when empty), and PRs (split into integration vs intermediate streams per `code-connection.yaml`'s `default_branch`). `/dora-report` renders a self-contained HTML report from the snapshot: ten sections including Per-Developer Profile, Pipeline Funnel, Layer Metrics, PR Health (size distribution by iteration count -- no diff API calls). **Wall-clock as primary AI Efficiency Ratio** (preserves the hard-won OE/CW degeneracy lesson). Supports `--compare` for side-by-side prior-sprint analysis and `--last-n N` for multi-sprint trend charts. The dora-analyst specialist is dispatched on top of the rendered report when the CPO asks for interpretive analysis (anomaly investigation, trend explanation, release-readiness recommendations).

**Recovery and continuation.** `/team-cleanup` recovers from wedged team state. `/context-prep` captures cross-session continuation runbooks under `.claude/strap/contexts/continuations/<topic>.md`; `/context-fetch` lists them or loads one as session-startup context. Multi-session and multi-developer workstreams travel through these.

## What's next

The pivot foundation is in place. The onboarding flow is captured. The work-tracking-as-code paradigm is introduced. The production workflows are wired through the v2.2 connection-profile + project-profile model. The DORA governance + close-ceremony layer closes the metrics loop: execution skills stop at Resolved, `/dora-reconcile` keeps the metadata honest daily, `/dora-collect` + `/dora-report` produce the evidence, `/close-ceremony` is the CPO value-acceptance gate, and the dora-analyst interprets when asked.

Specific known-next surfaces (the v2.3-and-beyond list, in rough priority order):

- **strap-agile iterations spec + HTML backlog/kanban/sprint viewer.** The Local work-tracking host declares iterations supported but the filesystem layout for sprints isn't pinned down yet; v2.3 will both specify it and ship a static-HTML export skill that renders `.claude/strap/work/*/*.md` as a backlog + kanban + sprint view for at-a-glance project state without leaving the repo.
- **Connection-template gallery.** Per-well-known-host accelerator templates that pre-fill the `/connect-*` five-step discovery for common cases (Azure DevOps Boards, GitHub Issues, Jira, Bitbucket, Azure Repos, GitHub) to skip much of the modeling step.
- **Optional `--gate-testing` flag on `/close-ceremony`.** v2.2 documents the `testing:*` tag gate pattern (warn before closing items lacking `testing:uat-passed` or `testing:prod-passed`) but does not enforce it. v2.3 may opt into enforcement when adopter project conventions stabilize around the tag set.

The story continues from here.
