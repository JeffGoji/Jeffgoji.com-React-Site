# Onboarding design (v2 rc_pivot_refactor)

This document captures the design for the new STRAP onboarding flow. It is the source of truth the future implementation of `/strap-in`, `/connect-devops-project`, `/connect-code-repo`, and `/strap-refresh` will be cut against.

The design is locked in principle. Open questions and unresolved details are called out explicitly at the end.

## Onboarding as three skills, not one phase tree

The pre-pivot v1 model fused install setup, project discovery, and external-system connection into one eight-phase skill (`/onboard`) coordinated by an `onboarding-lead` subagent. The v2 model splits these into three concerns, each handled by a separate skill:

| Skill | Concern | Required for onboarding? |
|---|---|---|
| `/strap-in` | The super-pair meets the project. Dev-lead reads the codebase, infers the stack, curates the persistence stack, and brings the canonical agents alive for THIS project. | Yes -- always the first step. |
| `/connect-devops-project` | Wires up work-item tracking. CPO picks from Azure DevOps / Jira / GitHub Issues / Local (strap-agile), or any other host via "Other" with full discovery. | Optional for evaluation; required before agents file work items. |
| `/connect-code-repo` | Wires up source control. CPO picks from Azure Repos / Bitbucket / GitHub / Local Git, or any other host via "Other" with full discovery. | Required. Git installed is a hard prerequisite. |

Plus a re-run skill:

| Skill | Concern |
|---|---|
| `/strap-refresh` | Incremental re-discovery when the project shape changes (new tech adopted, conventions evolved, known sensitivities surfaced). Reads the current project-profile.md, diffs against fresh discovery, surfaces changes for CPO approval before updating. |

If `/strap-in` is invoked against a project that is already onboarded, it detects this and redirects to `/strap-refresh`.

## Setup happens before `/strap-in`

By the time the CPO opens Claude Code and types `/strap-in`, the install script has already:

- Created the `.claude/strap/` directory tree with rules, memory, contexts, adapters, templates
- Written `.claude/settings.json` with the STRAP permission allowlist and env vars
- Installed the 15 canonical agents under `.claude/agents/` and the canonical skill set under `.claude/skills/`

The CPO opens a Claude Code session and runs `/strap-in`. That is the first conversation -- the super-pair meeting the project together.

## `/strap-in` -- structure

Eight conceptual sections in order. The implementation may compress or expand these, but the conceptual shape is fixed.

### 1. Welcome (brief, 3-4 lines)

Identity-anchored: the CPO is talking to the dev-lead; this is the super-pair's first session; we are about to discover the project together. Tone is warm but business-like. Markdown emphasis only -- no Bash banner detours.

### 2. Budget prompt

The CPO confirms operating budgets for the onboarding workflow. Two budgets, both ceiling-style:

- **Per-agent budget** -- tokens any single specialist may consume across the onboarding event (including multi-session phased dispatches). Default: 200K.
- **Session aggregate budget** -- tokens specialists may consume in aggregate within a single session. Default: 1M.

Prompt offers 100K / 200K (Recommended) / 500K / 750K for per-agent, and 500K / 1M (Recommended) / 2M / 5M for session aggregate, with "Other" for custom values via free-text input. The CPO answers both via a single `AskUserQuestion` call with two questions.

Selected values land in:

- `.claude/strap/memory/MEMORY.md` -- under a "CPO preferences" section, so future workflows can pull defaults silently
- `.claude/strap/state/usage.yaml` -- under the `budgets.strap-in` entry; structured runtime state

See [`budget-discipline.md`](./budget-discipline.md) for the full budget model.

### 3. Initial discovery (dev-lead, shallow)

Dev-lead reads what's there at a shallow-but-broad scope. Targets:

- Top-level manifest files: `package.json`, `*.csproj`, `pyproject.toml`, `Cargo.toml`, `pom.xml`, `go.mod`, `Gemfile`, etc.
- File-tree shape: one level deep at the root, then targeted into obvious source dirs (`src/`, `apps/`, `packages/`, etc.) one more level.
- README and root documentation files.
- Recent git activity: last ~50 commits to identify where work is happening.
- CI config files: `.github/workflows/`, `azure-pipelines.yml`, `.gitlab-ci.yml`, etc.
- Mockup directories: configured paths or detected `mockup/` / `mockups/` at root.

NOT in scope at this stage: full-codebase reads, deep recursion into source trees, or anything that would consume more than ~20-30K tokens. The goal is enough signal to decide which specialists activate; the deep dive happens in the next section.

Narration is hybrid: inline for major findings ("Reading `package.json`... Angular 19, NgRx, RxJS."), batched at the end as a synthesis bullet list.

**Greenfield / no-codebase fallback.** If initial discovery turns up an empty or near-empty project (a fresh `git init` with only a README; a brand-new scaffold with no real code yet; no detectable manifests at all), dev-lead switches to dialog mode:

- Asks the CPO what they are building (the problem domain, intended users, scope).
- Asks if the CPO has a tech stack in mind; if not, offers suggestions tailored to the problem (e.g., "for a real-time collaboration app you might want a websocket-capable backend like NestJS or .NET, plus a reactive frontend like Angular or React; I'd lean..." -- always with a recommendation, never just a menu).
- Captures the CPO's intent into a thin initial `project-profile.md` with placeholder sections marked for later refinement.
- Skips the parallel deep-dive (nothing for specialists to read); flags that `/strap-refresh` should be invoked once real code lands so the persistence stack can be properly populated.
- Proceeds directly to the hand-off summary.

### 4. Specialist relevance decision

Dev-lead determines which of the 15 canonical agents activate for the deep-dive based on initial discovery.

**Always active** for deep-dive:

- `security-reviewer` -- every project has security implications
- `test-strategist` -- every project has tests, or should have them

**Conditionally active** based on signals from initial discovery:

| Agent | Activates when |
|---|---|
| `backend-engineer` | Backend manifest detected (`*.csproj`, `pyproject.toml`, `go.mod`, etc.) OR `src/api/`-style dir present |
| `frontend-engineer` | Frontend manifest detected (`package.json` with frontend framework) OR `src/app/`-style dir present |
| `database-engineer` | ORM/migrations dir present, schema files detected, OR connection-string config present |
| `integration-specialist` | External-SDK imports detected, integration config present, or CPO confirms when prompted |
| `devops-lead` | IaC files present (`*.bicep`, `*.tf`, `cloudformation/`, `helm/`) OR CI config indicates deployment |
| `designer` | Mockup paths configured OR detected `mockup/` / `design/` dir |
| `ux-test-engineer` | E2E framework detected (`playwright.config.*`, `cypress.config.*`, etc.) OR CPO confirms when prompted |

Irrelevant for this project does NOT mean deleted. All 15 agents stay in the roster with empty memory and starter rules; they activate when the project later grows into their domain.

Dev-lead narrates the relevance decision to the CPO. CPO can override (force-activate or skip a specialist) before the deep-dive launches.

### 5. Parallel deep-dive via `CreateTeam`

This is the heart of `/strap-in`. Dev-lead spawns the activated specialists as a team using the `CreateTeam` primitive. Specialists run in parallel, each examining its respective slice of the codebase.

**Read-only tool palette during discovery (structurally enforced).** Specialists dispatched during `/strap-in` get a restricted tools palette: `Read, Grep, Glob, Bash` -- no `Write`, no `Edit`. This makes the code-immutability invariant a structural property, not a policy one. Specialists CANNOT modify code during discovery even if they tried.

**Per-specialist brief.** Each specialist receives:

- The Spec section they will examine (e.g., backend-engineer examines backend code)
- Pointers to their per-agent memory and rules files (which start mostly empty)
- The token budget for this dispatch (per-agent budget allocation)
- Instructions: "Read your slice. Report findings -- conventions, patterns, anti-patterns, sensitivities, anything worth knowing. Do NOT modify any file. Include `tokens_used: ~XXk` in your finishing summary."

**Specialists report; dev-lead curates.** When the team returns, dev-lead synthesizes findings into:

- `project-profile.md` -- stack facts, conventions, architecture notes
- Per-agent memory files -- agent-specific tradecraft for THIS project
- Per-agent rules files -- guardrails inferred from anti-patterns observed

This is the single-curator rule in action: only dev-lead writes; specialists only report.

### 6. Phased discovery for large codebases

If the initial discovery suggests the codebase is large enough that a single parallel wave would blow budgets, dev-lead lays out a phased plan:

- Specialists dispatch in waves, each wave covering a slice of their domain
- Between waves, dev-lead synthesizes the wave's findings, checks budget against thresholds, and decides whether to launch the next wave or checkpoint
- If session aggregate usage exceeds 60% of the budget, dev-lead recommends `/context-prep` + `/clear` + fresh-session resume
- The continuation file captures phase progress: which specialists are done, which are partial, what's left

This is multi-session by design. Some onboardings will complete in one session; some will take three or four. The discipline is the same.

### 7. Synthesis gate

Once all waves are complete (across however many sessions), dev-lead does a final synthesis pass:

- Re-read every per-agent memory and rules file dev-lead wrote
- Re-read the project-profile.md
- Look for inconsistencies, gaps, or overconfident claims
- Refine where needed; flag any genuinely ambiguous findings for CPO input

The gate clears when dev-lead has high confidence in the initial survey. The bar is "another dev-lead resuming this project on a fresh session would understand it from the persistence stack alone."

### 8. Hand-off summary

Dev-lead presents the CPO with:

- What was found (project shape, stack, conventions)
- What was updated (project-profile.md, per-agent memory files, per-agent rules files -- with file paths)
- What is NOT yet set up (DevOps connection, source-control connection) and pointers at `/connect-devops-project` and `/connect-code-repo`
- Any ambiguities or open questions that need CPO direction

The hand-off is the natural exit from `/strap-in`. The CPO decides what to do next -- typically run one of the `/connect-*` skills, or pause and review what was captured.

## Code immutability invariant

During `/strap-in` (and `/strap-refresh`), the adopter's code is immutable. Only files under `.claude/strap/` may be written. This invariant holds across all specialists and across multi-session phased discovery.

Enforcement:

- **Structural (Edit / Write)**: specialists dispatched during discovery receive a tools palette without `Write` / `Edit`. This is the primary defense against accidental file modification.
- **Bash discipline (policy)**: `Bash` remains in the read-only palette because inspection commands (`git log`, `git diff --stat`, `ls`, `find -type f`, `wc -l`, etc.) are genuinely useful during discovery. Specialists are constrained by the dispatch brief to **read-only Bash invocations only** -- no `git checkout`, no `git commit`, no `rm` / `mv` / `cp`, no `npm install`, no migrations, nothing that mutates state. The dev-lead's brief states this explicitly; specialists' per-agent rules reinforce it.
- **Policy**: per-agent rules state the invariant; dev-lead's own rules enforce it.
- **Boundary**: the invariant releases when `/connect-code-repo` clears its satisfied gate, signalling that onboarding is complete and the normal pipeline rules apply.

## Sub-repos schema (v2.4)

For polyrepo umbrellas, `project-profile.md` carries a `Sub-repos` section that lists each peer sub-repo with structured metadata. The schema serves two distinct audiences:

- **Specialists during decomposition + execution**: read per-sub-repo metadata (active domains, test command, deployment target, dependency graph) to route Tasks, dispatch the correct specialist set, run tests, and attribute deploys.
- **Humans reading the project**: read per-sub-repo Stack, Conventions, and Source-of-truth prose to orient themselves on what each sub-repo does and how it's organized.

The schema combines both into one section: structured fields up front (machine-consumed), orientation prose at the end (human-consumed). Adopters with single-project installs leave the section empty; the polyrepo flow short-circuits when `Sub-repos` is empty.

### Schema version + sentinel convention

The `Sub-repos` section opens with a sentinel HTML comment marking the schema version:

```
## Sub-repos

_Schema version: v2.4 ..._

<!-- strap-schema: sub-repos-v2.4 -->
```

`/strap-upgrade` reads the sentinel at upgrade time. When the sentinel is at or above the current schema version, the section is already migrated; the upgrade skips re-migration. When the sentinel is absent (v2.3 prose form) or below the current version, `/strap-upgrade` runs the appropriate migration path interactively with the CPO. See Feature 4 in the v2.4 Epic (#39221) for the migration flow.

The sentinel format is stable: `<!-- strap-schema: sub-repos-vMAJOR.MINOR -->`. Future schema versions (v2.5+) follow the same convention with a bumped version suffix. The sentinel format itself is the source of truth -- it must not be changed without a corresponding `/strap-upgrade` migration path.

`/strap-refresh` reads the sentinel similarly: a populated `Sub-repos` section with a current-version sentinel signals the polyrepo flow; the refresh skips re-detection and runs the per-sub-repo refresh flow directly. A populated section without the current sentinel signals a stale-schema install and triggers migration before refresh proceeds.

### Field summary

Each sub-repo is an H3 section under `## Sub-repos`. The H3 heading text IS the canonical slug. The full 14-field list is documented inline in `project-profile.scaffold.md` -- canonical source. Field-by-concern summary:

- **Identity (3 fields)**: Slug, Path, Role.
- **Execution routing (7 fields)**: Primary language, Active domains, Test command, Build command, Parallel safe, Deployment target, Depends on.
- **Orientation prose (3 fields)**: Stack, Conventions, Source-of-truth.
- **Meta (1 field)**: Activated.

The `Active domains` field is the silent precondition for per-Task specialist dispatch -- when a Task carries `sub_repo: <slug>`, dispatch resolves specialists from THIS sub-repo's `Active domains`, not umbrella-wide. The `Depends on` field feeds Feature 6 (cross-sub-repo merge ordering) and Feature 8 (downstream test propagation when an upstream sub-repo changes). The `Deployment target` field references `devops-connection.yaml`'s `deployment_targets:` list (see "Deployment targets" under "Per-sub-repo overrides (v2.4)" below for the full schema). It drives Feature 9's per-target deployment-frequency math and per-target pipeline funnel rendering.

### Section lifecycle

- **At `/strap-in` on a fresh polyrepo umbrella**: depth-1 git scan detects peer sub-repos; the dev-lead interviews the CPO for each sub-repo's extended-schema fields (test command, build command, active domains, deployment target, dependency graph). Defaults are suggested from build-file inspection (`package.json` scripts, `*.csproj` targets, `pom.xml`, `Makefile`). The CPO confirms; the dev-lead persists with the v2.4 sentinel.
- **At `/strap-upgrade` v2.3 -> v2.4**: existing prose `Sub-repos` sections are walked; v2.4 fields are prompted interactively; sentinel is stamped on completion.
- **At `/strap-refresh`**: re-runs depth-1 detection against current code; surfaces added or removed sub-repos for CPO approval; updates schema in place. Sentinel stamping carries forward.

### Worked example -- 3-sub-repo polyrepo umbrella

A realistic populated `Sub-repos` section for an umbrella with a React+TypeScript web client, a .NET 8 API backend, and a shared types/contracts library consumed by both:

````markdown
## Sub-repos

_Schema version: v2.4 (extended structured fields for routing, test execution, dependency awareness, and deployment-target attribution). The sentinel comment immediately below marks the section as v2.4-aware._

<!-- strap-schema: sub-repos-v2.4 -->

### web-frontend

- **Slug**: web-frontend
- **Path**: ./web-frontend
- **Role**: Customer-facing web client; the primary user surface
- **Primary language**: typescript
- **Active domains**: frontend-engineer, integration-specialist
- **Test command**: `npm test`
- **Build command**: `npm run build`
- **Parallel safe**: true
- **Deployment target**: vercel-prod
- **Depends on**: shared-types
- **Stack**: React 18 + TypeScript + Vite + Vitest + TanStack Query; Tailwind for styling; consumes the API via the typed client generated from shared-types
- **Conventions**:
  - Branch pattern overrides umbrella default: `feat/<scope>` (matches Vercel preview-deployment slug rules)
  - Per-component test colocated with implementation: `Foo.tsx` + `Foo.test.tsx`
  - State via TanStack Query for server state; React state for ephemeral UI
- **Source-of-truth**:
  - `src/components/` -- UI building blocks
  - `src/features/` -- feature-oriented composition
  - `src/api/` -- generated client + custom hooks wrapping shared-types
- **Activated**: 2026-05-23 by CPO

### api-backend

- **Slug**: api-backend
- **Path**: ./api-backend
- **Role**: REST API serving the web-frontend; primary backend
- **Primary language**: csharp
- **Active domains**: backend-engineer, database-engineer, integration-specialist
- **Test command**: `dotnet test`
- **Build command**: `dotnet build -c Release`
- **Parallel safe**: false
- **Deployment target**: azure-prod-eus
- **Depends on**: shared-types
- **Stack**: .NET 8 + ASP.NET Core + EF Core (PostgreSQL provider) + xUnit + FluentAssertions; OpenAPI generated from controllers; PostgreSQL 16 in production
- **Conventions**:
  - Per-feature folders under `src/Features/`; controllers + handlers + DTOs colocated
  - MediatR for request/response pipeline; FluentValidation for input
  - Integration tests use Testcontainers + ephemeral PostgreSQL (port-binds to ephemeral; therefore not parallel_safe with other tests touching PostgreSQL)
- **Source-of-truth**:
  - `src/Features/` -- per-feature composition
  - `src/Domain/` -- domain model
  - `src/Infrastructure/` -- EF Core context + repositories
- **Activated**: 2026-05-23 by CPO

### shared-types

- **Slug**: shared-types
- **Path**: ./shared-types
- **Role**: API contracts and shared utility types consumed by both web-frontend and api-backend
- **Primary language**: typescript
- **Active domains**: backend-engineer
- **Test command**: `npm test`
- **Build command**: `npm run build`
- **Parallel safe**: true
- **Deployment target**:
- **Depends on**:
- **Stack**: TypeScript + tsup (bundle to ESM + CJS); zod for runtime schemas; tsc for type emission; published to internal npm registry; NuGet package generated by post-build script for .NET consumers
- **Conventions**:
  - One file per logical contract (e.g., `OrderDto.ts`, `UserProfileDto.ts`)
  - zod schemas live alongside TS types; runtime parsing exported as `parseOrderDto`, etc.
  - Breaking changes bump major version; .NET package version follows npm version
- **Source-of-truth**:
  - `src/contracts/` -- DTOs
  - `src/schemas/` -- zod runtime validators
  - `src/utils/` -- shared utility types
- **Activated**: 2026-05-23 by CPO
````

Annotations on the example:

- **`shared-types` has empty `Deployment target` and `Depends on`**: it's a library, not a deployed service, and has no internal cross-sub-repo dependencies. Both fields are present-but-empty rather than omitted, so the field list shape stays stable across all sub-repos.
- **`web-frontend.Depends on: shared-types`**: when shared-types is in a change set, Feature 8 will automatically run web-frontend's tests even if web-frontend's own code didn't change -- catches API-contract drift. Same for `api-backend.Depends on: shared-types`. If shared-types and web-frontend BOTH have changes in a cross-sub-repo Feature, Feature 6 sequences shared-types' PR to merge first.
- **`web-frontend.Parallel safe: true` + `api-backend.Parallel safe: false`**: the API backend's integration tests bind to ephemeral PostgreSQL via Testcontainers (port collision risk if run in parallel with anything else touching PostgreSQL). The web-frontend's Vitest suite is in-process and resource-isolated, so it can run concurrently. Feature 8 groups parallel_safe sub-repos and runs them together; api-backend runs serially.
- **Heterogeneous `Active domains`**: web-frontend dispatches frontend-engineer + integration-specialist; api-backend dispatches backend-engineer + database-engineer + integration-specialist; shared-types dispatches backend-engineer alone (types lib is light-touch authoring). A Task tagged `sub_repo: web-frontend` resolves the frontend specialist set; a Task tagged `sub_repo: api-backend` resolves the backend specialist set.
- **Heterogeneous `Deployment target`**: web-frontend deploys to Vercel; api-backend deploys to Azure (East US). Feature 9 attributes deploys per target -- merging both PRs in a coordinated cluster counts as 2 deploys (different targets), not 1.

## Connection-discovery model

Both `/connect-devops-project` and `/connect-code-repo` follow the same five-step discovery-driven flow. STRAP does NOT ship a fixed set of pre-built adapters per host. Instead, the dev-lead probes the host live during `/connect`, models the host's shape against STRAP's logical operations, validates the model with the CPO, and persists a per-project **connection profile** that the pipeline reads at runtime.

This removes the "adapter backlog" entirely. Every work-tracker or source-control system the CPO has access to is supportable through one well-defined discovery loop -- not by us writing N adapters ahead of time.

### The universal interface

Skills continue to call logical operations through the existing `{{adapter.<surface>.<operation>}}` references. The interface is stable; the implementation is per-project.

### Accelerator templates for well-known hosts

For hosts STRAP knows well (Azure DevOps, GitHub, Jira, Bitbucket, Azure Repos, local-files), starter connection templates ship with the package. The dev-lead loads the matching template at `/connect` time and validates it still matches the actual host -- skipping much of the discovery work. For hosts STRAP doesn't have a template for, the dev-lead runs full discovery from scratch.

Starter templates live at `.claude/strap/templates/connection-templates/<host>.yaml`. (The v1 adapter directories under `.claude/strap/adapters/` were retired in #38925 Stage 2; per-project connection state lives at `.claude/strap/state/{devops,code}-connection.yaml` after `/connect-*` skills land.)

### The five-step flow

1. **CPO names the host.** Via `AskUserQuestion` with up to four named options + "Other" for everything else. Choices are listed in each `/connect-*` section below.
2. **Dev-lead authenticates.** PAT, OAuth, API token, CLI-based auth -- whichever the host needs. Walks the CPO through credentials if necessary. Auth probe runs and either succeeds or surfaces an actionable error.
3. **Dev-lead explores.** Reads the project structure: can it see projects, list work items, see work-item types, read transitions, list branches, see PRs? Can it create-and-delete a test work item or branch? The probe is read-only by default; write probes require explicit CPO consent.
4. **Dev-lead models.** Builds the connection profile from what it found:
   - Logical-to-host type mappings (e.g., STRAP's `requirement` is this host's `Story`)
   - Field mappings (e.g., `original_estimate` is this host's `customfield_10026`)
   - State transitions (e.g., `active -> resolved` is this host's `Done` transition id)
   - Capability declarations (which logical operations are supported; which are unsupported and need graceful degradation)
   - Auth method and credential reference
5. **Dev-lead validates with the CPO and persists.** Surfaces the model: "I think Requirement maps to Story on your Jira -- confirm? I see your project has these custom states -- here's how I'd model the lifecycle. Capability gap: iteration capacity is unsupported on this Jira instance -- sprint-planner will fall back to your manual capacity table." CPO confirms or corrects. The validated profile lands at `.claude/strap/state/devops-connection.yaml` (work-tracking) or `.claude/strap/state/code-connection.yaml` (source control). The gate satisfies.

### Connection profile shape

The connection profile is a host-agnostic data structure that adopts the host-specific shape at probe time. Three layers:

1. **`mapping`** -- declares how STRAP's logical concepts map to the host's vocabulary (types, fields, states, link types). Includes per-field formats (e.g., is the description field HTML or markdown?) and state-machine collapse documentation (e.g., when a host type lacks a Resolved state, where does it collapse?).
2. **`capabilities`** -- declares which logical operations the host supports. Every capability set `supported` MUST have a corresponding template.
3. **`operation_templates`** -- the executable recipes. Each declares either `type: cli` (multi-line shell command with placeholders) or `type: rest` (method + path + headers + body_template). The dev-lead renders + executes these at runtime.

Canonical operation set -- **work-tracking**:

| Logical operation | Purpose |
|---|---|
| `work_item_create` | Create a new item |
| `work_item_read` | Read one item by id |
| `work_item_update` | Update fields on an existing item |
| `work_item_delete` | Permanently destroy an item |
| `work_item_query` | Query/search by criteria |
| `work_item_link_add` | Add a link/relation between two items |
| `work_item_comment_add` | Post a comment on an item (used for state-change audit, tagged `[STRAP/agent:<name>]`) |
| `iteration_list` | List iterations/sprints |

Canonical operation set -- **source-control**:

| Logical operation | Purpose |
|---|---|
| `ref_get` | Read a single named ref and return its current `objectId` (commit SHA). Building block for verification operations (is origin/main tip unchanged? does this branch exist on origin? what commit does origin/main point at right now?) and for optimistic-concurrency operations that need a known-current ref state (e.g., REST-style branch deletion that requires `oldObjectId`). |
| `branch_list` | List branches matching a pattern |
| `branch_create` | Create a new local branch from a base ref |
| `branch_delete_local` | Delete a local branch |
| `branch_delete_remote` | Delete a branch on the remote (via REST refs-update zero-sha pattern where the host supports it; via `git push --delete` otherwise) |
| `branch_push` | Push a local branch to the remote (with explicit auth token injection where the host supports it; via `git push -u origin` otherwise) |
| `pull_request_create` / `pull_request_get` / `pull_request_update` / `pull_request_close` / `pull_request_list` | PR lifecycle operations |
| `pull_request_get_comments` / `pull_request_post_comment` | PR comment-thread operations |
| `pull_request_get_check_status` | PR CI / required-policy status |
| `pull_request_show` / `pull_request_linked_work_items` | OPTIONAL deeper PR detail + work-item linkage (consumed by `/dora-collect`) |
| `commit_history` | Read commit log |
| `file_read_at_ref` | Read file contents at a specified ref |

**Doctrine: REST/token-injected where both exist.** When both a host CLI command (git, gh, az repos) and a host REST endpoint exist for the same logical operation, prefer the REST or token-injected variant. Adopters running STRAP in a Claude Code tool-invocation context cannot satisfy credential-helper or auth-prompt interactivity; reasoned-on-the-fly fallback chains add latency and obscure root cause. The REST/token-injected pattern is canonical for any host whose CLI auth flow can stall on interactive prompts. First concrete application: Azure Repos `branch_delete_remote` (REST refs-update with `oldObjectId` for optimistic concurrency) and `branch_push` (`git -c http.extraHeader="Authorization: Bearer <token>" push ...`). Future host adapter additions consult the same rule.

Example for a Jira work-tracking connection (abridged):

```yaml
host: jira
host_url: https://acme.atlassian.net
auth:
  method: api_token
  user_env: JIRA_USER
  token_env: JIRA_TOKEN
mapping:
  work_item_types:
    requirement: { host_type: Story }
    spec:        { host_type: Document }
    feature:     { host_type: Epic }
    story:       { host_type: Sub-task }
    task:        { host_type: Sub-task }
    bug:         { host_type: Bug }
  fields:
    title:             summary
    description:       description
    state:             status
    original_estimate: customfield_10026
    completed_work:    customfield_10027
  field_formats:
    description: markdown                # Jira Cloud accepts ADF or wiki markup; markdown via Atlassian Document Format
  states:
    new:      To Do
    active:   In Progress
    resolved: Done
    closed:   Done
  link_types:
    parent_child: jira_parent
    related:      Relates
    predecessor:  Blocks
    successor:    is_blocked_by
  default_parents:                          # OPTIONAL. Per-logical-type parent ids for new top-level items (e.g., ADO Features under an Epic; Jira Stories under an Epic). Omitted by hosts without enforced hierarchy (GitHub Issues, local-files).
    requirement: PROJ-1                     # the "Requirements" Epic id
    spec:        PROJ-2                     # the "Specs" Epic id
    feature:     PROJ-3                     # the "Features" Epic id
    bug:         PROJ-4                     # the "Bugs" Epic id (optional)
capabilities:
  work_item_create:        supported
  work_item_read:          supported
  work_item_update:        supported
  work_item_delete:        supported
  work_item_query:         supported
  work_item_link_add:      supported
  work_item_comment_add:   supported
  iteration_list:          supported
  iteration_get_capacity:  unsupported
  pull_request_create:     unsupported
operation_templates:
  work_item_create:
    type: rest
    method: POST
    path: /rest/api/3/issue
    body_template: |
      { "fields": { "project": {"key": "{{project}}"}, "issuetype": {"name": "{{host_type}}"}, "summary": "{{title}}", "description": "{{description}}" } }
  work_item_read:    { type: rest, method: GET,  path: /rest/api/3/issue/{{id}} }
  work_item_update:  { type: rest, method: PUT,  path: /rest/api/3/issue/{{id}}, ... }
  work_item_delete:  { type: rest, method: DELETE, path: /rest/api/3/issue/{{id}} }
  work_item_query:   { type: rest, method: POST, path: /rest/api/3/search, ... }    # placeholder: {{jql}}
  work_item_link_add:    { type: rest, method: POST, path: /rest/api/3/issueLink, ... }   # placeholders: {{source_id}}, {{target_id}}, {{link_type}}
  work_item_comment_add: { type: rest, method: POST, path: /rest/api/3/issue/{{id}}/comment, ... }   # placeholder: {{body}}
  iteration_list:    { type: rest, method: GET,  path: /rest/agile/1.0/board/{{board}}/sprint }
```

Dev-lead reads this at runtime, fills in templates, and executes operations via the configured auth method.

**State-machine asymmetries.** Some hosts have per-type state machines that collapse STRAP's logical states (e.g., Azure DevOps Agile process: Issue has only Active/Closed; Task has only New/Active/Closed). When that happens, `mapping.state_asymmetries.<host-type>` documents the allowed states and the collapse rule; the dev-lead applies the `strap:<logical-state>` tag at write time to preserve the logical state for downstream visibility.

### Connection profile schema versioning (v2.4)

Both `code-connection.yaml` and `devops-connection.yaml` carry a top-level `schema_version` field as their first key. The field declares which version of the connection-profile schema the file conforms to; `/strap-upgrade` reads it at upgrade time to determine which migration path to run.

**Field placement.** First key in the file:

```yaml
schema_version: "2.4"
host: ...
```

**Format.** String in the form `"<MAJOR>.<MINOR>"`. Matches the sentinel-comment format used for `project-profile.md`'s `Sub-repos` section (`<!-- strap-schema: sub-repos-v2.4 -->`); the schema-version field is the YAML-native equivalent since connection profiles are pure YAML (no markdown comment surface).

**Migration detection.** `/strap-upgrade` reads `schema_version` per the convention:

- **Absent or below current**: connection profile predates v2.4's schema extensions. `/strap-upgrade` (with Feature 4's interactive migration) walks the CPO through schema updates and stamps the new version on completion.
- **At or above current**: profile is already migrated; `/strap-upgrade` skips the connection-profile migration step.

**Backwards compatibility.** v2.3 connection profiles do not carry `schema_version`. They are treated as pre-v2.4; `/strap-upgrade` migrates them interactively. The migration is idempotent (re-running on an already-migrated profile is a no-op when `schema_version` is current).

**Versioning discipline.** Every future schema change to the connection profile bumps `schema_version`. Migration paths key off the version to run the right transformation. The version field is the single source of truth -- never compare structural shape; always read the version.

Both connection profiles carry the field regardless of polyrepo mode -- single-repo umbrellas use `schema_version: "2.4"` once they upgrade, even though their profiles don't carry a `sub_repos:` map.

### Host-side branch protection observations (v2.4)

`code-connection.yaml` carries an optional top-level `branch_protection:` block that captures what the host actually enforces on the default branch (and any other protected branches the adopter cares about). The block is observational, not prescriptive -- STRAP does not change host policy; it reads what is configured and uses that knowledge to behave correctly during PR review and merge-readiness checks. Single-repo umbrellas carry this block; polyrepo umbrellas carry it at the umbrella level and may override per sub-repo (see the next section).

This block is distinct from the per-sub-repo `branch_protection:` block under `sub_repos.<slug>.` documented in the next section. Same name, two different concerns:

- **Top-level `branch_protection:`**: host-policy observations. What the host actually requires. Consumed by `/refine-pr` to know how many reviewers must approve, which status checks must pass, whether comment threads must be resolved before merge.
- **Per-sub-repo `branch_protection.policy:`**: STRAP coordination policy. How cross-sub-repo PR clusters from a single Feature behave at merge time (`independent` / `ordered` / `all-must-merge`). Consumed by Features 5 and 6 of v2.4.

The two share a name because they describe the same conceptual surface (branch protection) from two vantage points -- what the host enforces vs. how STRAP coordinates across sub-repos. The next section's per-sub-repo `branch_protection:` block carries BOTH the observation fields (overriding the umbrella default for THIS sub-repo) AND the STRAP-coordination `policy:` field. Inline schema comments in persisted profiles disambiguate.

#### Field set

```yaml
schema_version: "2.4"
host: azure-repos
organization: example-org
project: Example-Umbrella
default_branch: main
branch_protection:
  requires_reviewers: 2                    # minimum-reviewer count; null = not enforced
  requires_status_checks: ["Build"]        # status-check names that must pass; [] = none required
  requires_comment_resolution: true        # all comment threads must be resolved before merge
  requires_merge_strategy: squash          # required strategy: merge | squash | rebase | null = host allows any
  requires_work_item_linking: true         # PR must link to at least one work item
  forbids_force_push: true                 # push --force is rejected on the protected branch
  file_size_restriction: 10485760          # max file size in bytes; null = no restriction
  notes: "Build status check is named exactly 'Build' (case-sensitive)"
```

All fields are optional. An omitted field means "not observed" -- not "not enforced." When `/connect-code-repo` cannot determine a field's value (the host's branch-policy API is unavailable, or the CPO declines to confirm), the field stays absent rather than guessing a default.

#### Consumers

- `/refine-pr` reads `requires_reviewers`, `requires_status_checks`, and `requires_comment_resolution` to know when a PR is ready for human merge. The round-of-fixes summary notes which gates still pend.
- `/execute-sprint` reads `requires_status_checks` when rendering the PR description's check expectations and when sequencing the centralized build-and-test pass against the host's named checks.
- `/connect-code-repo` populates the block during interview by probing the host's branch-policy API where available, and confirming each field with the CPO.
- Future v2.5 PR-cluster merge orchestration would read these fields to know when each PR in a cluster is independently ready.

#### Discipline

Treat the host-side block as a point-in-time snapshot. Adopters change host policy independently of STRAP. `/strap-refresh` re-probes the host and updates the block when divergence is detected; the CPO confirms before persisting. Stale observations are a data-quality gap, not a correctness gap -- `/refine-pr` still works against a stale block, just with less precision about which gates remain.

### Per-sub-repo overrides (v2.4)

For polyrepo umbrellas, both connection profiles support optional `sub_repos:` maps that declare per-sub-repo overrides on host-specific configuration. A single connection profile can model umbrellas with heterogeneous topologies (one GitHub sub-repo + one Azure Repos sub-repo, or one ADO org spanning multiple ADO projects) with clean inheritance from umbrella defaults. Single-host single-project profiles omit the maps entirely and continue to work unchanged.

#### `code-connection.yaml` `sub_repos:` map

Optional top-level `sub_repos:` keyed by sub-repo slug (foreign key to `project-profile.md`'s `Sub-repos` section). Each entry declares per-sub-repo overrides on the standard code-connection fields (`host`, `organization`, `project`, `repository`, `default_branch`, `branch_patterns`, `auth`) plus the new v2.4 `branch_protection` field. Inheritance is override-only -- top-level values apply unless the sub-repo entry overrides a specific field.

```yaml
schema_version: "2.4"
host: github
organization: example-app
default_branch: main
branch_patterns:
  feature: "feature/<title>"
  fix: "fix/<title>"
auth:
  method: pat
  token_env: GITHUB_TOKEN
sub_repos:
  web-frontend:
    # Inherits everything from umbrella (host=github, org=example-app, etc.).
    # Empty mapping signals "explicit inheritance" vs missing key.
    {}
  api-backend:
    # Different host + auth. Branch model still inherits.
    host: azure-repos
    organization: example-org
    project: Example-Backend
    repository: example-api
    auth:
      method: workload-identity-federation
      service_connection: example-org-wif
    branch_protection:
      # Host-side observation overrides: this sub-repo's host enforces stricter policy than the umbrella.
      requires_reviewers: 3
      requires_status_checks: ["Build", "Lint", "Security-Scan"]
      # STRAP coordination policy: this sub-repo's PR is blocked until upstream sub-repos' PRs merge.
      policy: ordered
  shared-types:
    # Same host (github) and org, different default branch and protection.
    repository: example-shared-types
    default_branch: develop
    branch_protection:
      policy: all-must-merge
```

##### `branch_protection` field

A per-sub-repo `branch_protection:` block carries BOTH:

- **Host-side observation overrides** -- any field from the umbrella-level `branch_protection:` block (documented in the previous section: `requires_reviewers`, `requires_status_checks`, `requires_comment_resolution`, `requires_merge_strategy`, `requires_work_item_linking`, `forbids_force_push`, `file_size_restriction`, `notes`). When this sub-repo's host enforces stricter or looser policy than the umbrella default, declare the differences here. Omitted fields fall through to the umbrella-level block.
- **STRAP coordination `policy:` field** -- unique to per-sub-repo blocks; not meaningful at the umbrella level. Three values:

- **`independent`** (default): each sub-repo's PR merges on its own timeline; no cross-PR coordination. Use when sub-repos are deployed and released independently.
- **`ordered`**: when this sub-repo has a `depends_on` relationship to another sub-repo (per `project-profile.md` `Sub-repos` schema), the downstream PR is blocked until the upstream PR merges. The `/refine-pr` skill surfaces the gating state inline. Feeds Feature 6 (cross-sub-repo dependency awareness + merge ordering).
- **`all-must-merge`**: the entire PR cluster from a cross-sub-repo Feature merges as a group, or rolls back as a group. Feeds Feature 5 (atomic cross-sub-repo execution PR cluster behavior). Use when sub-repos share a deployment target and must ship together.

When omitted, `branch_protection.policy` defaults to `independent`.

##### Heterogeneous-host worked example

The example above demonstrates the canonical v2.4 case: one umbrella with three sub-repos -- `web-frontend` on GitHub (inherits), `api-backend` on Azure Repos (overrides host, organization, project, auth, branch_protection), and `shared-types` on GitHub (same host as primary, but different default branch and stricter branch_protection). The pipeline reads the merged profile at runtime, walking each Task's `sub_repo` slug into the corresponding entry to resolve host/auth/branch decisions for that Task's operations.

##### Inheritance discipline

Per-sub-repo entries override **only the fields they declare**. Omitted fields fall through to top-level umbrella defaults. An empty mapping (`{}`) signals explicit inheritance from the umbrella (contrast with a missing key, which signals "not configured"). The empty-mapping convention lets the `/connect-code-repo` interview record "this sub-repo intentionally uses defaults" without leaving it ambiguous.

#### `devops-connection.yaml` `sub_repos:` map

Optional top-level `sub_repos:` keyed by sub-repo slug. Each entry declares per-sub-repo overrides on work-tracking configuration (`host`, `organization`, `project`, `auth`, `capabilities`) plus the optional `pipeline_match_patterns: [...]` field (v2.4 F10) that drives `/dora-collect`'s pipeline attribution. Same inheritance pattern as code-connection -- override-only-what-you-declare; empty mapping signals explicit inheritance.

```yaml
schema_version: "2.4"
host: azure-devops
organization: example-org
project: Example-Umbrella
auth:
  method: pat
  token_env: AZDO_PAT
mapping: {}            # umbrella-wide type/state/field mappings
capabilities: {}       # umbrella-wide capability declarations
operation_templates: {}  # umbrella-wide CLI / REST templates
sub_repos:
  web-frontend:
    # Same host + org as umbrella; different project for work-tracking.
    project: Example-Web
    pipeline_match_patterns:
      - "web-*"             # glob match on pipeline name
      - "/^frontend-.*$/"   # regex match (slashes denote regex)
  api-backend:
    project: Example-Backend
    # This project has iteration_list unsupported -- per-sub-repo capability override.
    capabilities:
      iteration_list: unsupported
    pipeline_match_patterns:
      - "api-build-*"
      - "api-deploy-prod"
  shared-types:
    # Fully inherits from umbrella (same project too).
    {}
```

**`pipeline_match_patterns: [...]` (v2.4 F10)** is the explicit PRIMARY signal `/dora-collect` consumes when attributing pipeline runs to sub-repos. Patterns are glob by default; wrap in slashes (`/.../`) to denote regex. `/dora-collect`'s fallback chain still applies (path-based, then name-substring) when patterns are absent or fail to match. Adopters whose CI pipeline names pre-date STRAP onboarding (the typical adoption pattern -- pipeline names already exist; STRAP arrives later) declare patterns once at `/connect-devops-project` Step 6's per-sub-repo mini-flow and pipelines attribute cleanly thereafter.

Empty array (`pipeline_match_patterns: []`) signals "no explicit patterns; rely on fallbacks". Absent field signals "not yet captured; re-prompt on next `/connect-devops-project` re-run". Re-run safety: existing patterns preserved unless CPO explicitly re-confirms or removes.

##### Same-host different-project (the dominant v2.4 case)

The canonical polyrepo work-tracking scenario: one ADO org with multiple ADO projects sharing an umbrella. Each sub-repo's items live in their own ADO project; the umbrella holds the auth + connection details. The per-sub-repo override is typically just a `project:` field; everything else inherits.

This pattern also covers GitHub Issues across multiple repositories under one organization (where each "project" is a repository), and Jira instances with multiple boards under one URL.

##### Per-sub-repo capability overrides

When a sub-repo's project differs in supported capabilities (e.g., one ADO project has `iteration_list` enabled while another doesn't), declare the differences in the sub-repo's `capabilities:` sub-mapping. Pipeline skills resolve capabilities per Task's `sub_repo` at runtime; a sub-repo with `iteration_list: unsupported` triggers the documented degradation path for Tasks in that sub-repo (e.g., `/plan-sprint` falls back to manual capacity for that sub-repo's items).

Per-sub-repo `mapping` overrides are supported but rarely needed -- work-item-type names typically match across projects under the same host. When they differ (one project uses `Story` for the Story logical type while another uses `User Story`), the override goes here.

##### Cross-host work-tracking federation (deferred to v2.5)

When sub-repos need genuinely different hosts (one ADO + one Jira tracking the same Feature), the connection profile can declare the structural override (per-sub-repo `host:` field), but cross-adapter coordination logic is **out of scope for v2.4**. Pipeline operations against cross-host umbrellas degrade with explicit warnings -- /decompose-feature, /execute-sprint, /refine-pr, and /dora-collect run per-sub-repo and the dev-lead reconciles across hosts manually. Full cross-host federation is a v2.5 candidate; document the limitation inline when persisting the override.

#### `devops-connection.yaml` `deployment_targets:` list

Optional top-level `deployment_targets:` list declaring the deployment topology an umbrella ships to. Each target carries a canonical name (the foreign-key target for per-sub-repo `Deployment target` references in `project-profile.md`'s `Sub-repos` section), the cloud / on-prem environment it lives in, the deployment environment classification, and an optional region. The list models multi-target umbrellas first-class -- one Feature shipping to AWS prod + Azure staging + an on-prem VM is a real adopter scenario v2.4 makes declarative. The list is **optional**; profiles without `deployment_targets:` continue to work unchanged (v2.3 behavior preserved; no per-target attribution emitted downstream).

```yaml
schema_version: "2.4"
host: azure-devops
organization: example-org
project: Example-Umbrella
deployment_targets:
  - name: vercel-prod              # canonical identifier; referenced from Sub-repos schema
    cloud: vercel                  # vercel / azure / aws / gcp / on-prem / other
    environment: production        # production / staging / dev / etc.
    region: ~                      # optional; free-form (e.g., us-east-1, eastus)
  - name: azure-prod-eus
    cloud: azure
    environment: production
    region: eastus
  - name: aws-staging
    cloud: aws
    environment: staging
    region: us-east-1
sub_repos: {}
```

##### Field semantics

- **`name`** -- canonical identifier; arbitrary string. Each name MUST be unique within the `deployment_targets:` list. Referenced from `project-profile.md`'s `Sub-repos` section via each sub-repo's `Deployment target` field.
- **`cloud`** -- enum identifying where the target runs. Canonical values: `vercel`, `azure`, `aws`, `gcp`, `on-prem`, `other`. The `on-prem` value is first-class because self-hosted adopters are a real scenario; `other` is the fallthrough for cloud providers v2.4 doesn't enumerate. The enum is extensible -- future STRAP versions can codify additional values without breaking older profiles.
- **`environment`** -- classification of the environment's role. Typical values: `production`, `staging`, `dev`, `qa`. Free-form to accommodate adopter-specific stage names; conventional values are recommended for downstream report grouping.
- **`region`** -- optional free-form string identifying the geographic or logical region (e.g., `us-east-1`, `eastus`, `westeurope`, `on-prem-dc1`). Omitted when the target is region-agnostic or the adopter doesn't model regions.

##### Per-sub-repo reference

Each sub-repo in `project-profile.md`'s `Sub-repos` section may declare a `Deployment target` field whose value is one of the names in this list. The reference is what links a sub-repo's deployment activity to a target -- driving Feature 9's per-target deployment-frequency math and per-target pipeline funnel rendering.

```markdown
### web-frontend

- **Slug**: web-frontend
- **Path**: ./web-frontend
- ...
- **Deployment target**: vercel-prod    # references deployment_targets[].name in devops-connection.yaml
```

The reference is **optional** per sub-repo. Sub-repos without a `Deployment target` value are treated as un-attributed -- they contribute to per-sub-repo pipeline funnels but not to per-target deployment-frequency math. Adopters that don't model deployment topology at all simply omit `deployment_targets:` from `devops-connection.yaml` and the `Deployment target` field from each sub-repo; v2.4 falls through to v2.3 single-target deployment-frequency aggregation cleanly.

##### Validation

- **Resolution**: when a sub-repo declares `Deployment target: <name>`, the name MUST resolve to an entry in `devops-connection.yaml`'s `deployment_targets:` list.
- **Unknown reference rejection**: validation surfaces unknown references at load time -- specifically when a pipeline skill (notably `/dora-collect` at snapshot construction time) resolves the per-sub-repo lookup. The error surfaces the unresolved name, the sub-repo slug, and the list of declared targets so the CPO can correct either the reference or the list.
- **Absence is valid**: the field is optional on each sub-repo. Absent value = no deployment attribution downstream. Pipeline skills handle absence gracefully (no errors; un-attributed sub-repos are surfaced with a count in the snapshot for transparency).
- **Validation locus**: validation runs when skills load `project-profile.md` + `devops-connection.yaml` together. The dominant locus is `/dora-collect` (where lookup actually matters); other skills can validate eagerly at load when the resolution is on a hot path for them.

##### Single-repo umbrellas

Single-repo umbrellas (no `Sub-repos` section) don't have per-sub-repo `Deployment target` fields. The umbrella-level `deployment_targets:` list MAY still be declared (it documents the umbrella's deployment topology), but no automatic attribution happens -- /dora-collect's per-target aggregation in single-repo mode falls through to v2.3 single-target / single-pipeline deploy-freq accounting. Single-repo deployment-topology modeling is deferred to v2.5+.

##### Consumers

- `/connect-devops-project` -- interactive interview captures the list at umbrella onboarding time (Feature 7 Story 7.2). Re-run idempotency offers amend / replace / skip modes.
- `/strap-in` -- per-sub-repo interview captures each sub-repo's `Deployment target` reference; CI-config inspection (Vercel project marker, `.github/workflows/*deploy*.yml`, `azure-pipelines.yml` deploy stages, generic IaC markers) drives the default suggestion (Feature 7 Story 7.3).
- `/strap-upgrade` -- v2.3 -> v2.4 migration backfills both the umbrella `deployment_targets:` list and per-sub-repo `Deployment target` references via interactive prompts (Feature 7 Story 7.4).
- `/dora-collect` -- per-PR target resolution feeds deployment-frequency per-target aggregation + per-target pipeline funnel (Feature 9 Stories 9.2 + 9.3).
- `/dora-report` -- renders per-target deployment-frequency column + per-target funnel rows in the layer-metrics section (Feature 9 Story 9.5).

### Per-host storage for the v2.4 `sub_repo` field

For polyrepo umbrellas, Task work items carry a `sub_repo` field whose value is a canonical sub-repo slug from `project-profile.md`'s `Sub-repos` section. The field is optional everywhere -- absent or null = single-repo umbrella; routing skills degrade to umbrella-wide REPO_ROOT when the field is absent. Per-host storage strategies differ; the connection profile's `mapping.fields.sub_repo` entry declares how each host represents the field.

Four canonical storage patterns. The shorthand `sub_repo: <host-field-name>` continues to work for direct-field mappings; the expanded object form below is required when storage diverges from a direct field-to-field mapping.

**1. Direct custom-field mapping (Azure DevOps, Jira).** The host supports custom fields on work items. `sub_repo` maps to a host-defined custom field.

```yaml
mapping:
  fields:
    sub_repo:
      host_field: STRAP.SubRepo       # Azure DevOps reference name
      host_storage: custom_field      # default; may be omitted for direct mappings
```

For Jira, `host_field` is the per-instance custom field id (e.g., `customfield_10042`) captured during `/connect-devops-project`. The CPO names the human-readable label (recommended: "STRAP Sub-Repo") at field provisioning time; the field id is the stable per-instance identifier.

**2. Label-prefix mapping (GitHub Issues, similar tagged-array hosts).** The host supports labels (an array of strings on each item). `sub_repo` is stored as a single label with a stable prefix; the slug is extracted by stripping the prefix.

```yaml
mapping:
  fields:
    sub_repo:
      host_storage: label_prefix
      prefix: "sub-repo:"             # full label: sub-repo:<slug>
```

Convention: exactly one prefixed label per Task. The Task adapter's `work_item_create` and `work_item_update` `operation_templates` strip any pre-existing prefixed labels before applying the new one (one-per-Task invariant); the `work_item_read` template extracts the slug from the matching label and surfaces it as `sub_repo` in the returned object.

**3. Native YAML field (Local strap-agile).** The host is filesystem-backed YAML; `sub_repo` lives as a first-class YAML field on the Task file.

```yaml
mapping:
  fields:
    sub_repo:
      host_field: sub_repo
      host_storage: yaml_field
```

Trivial case -- no transformation; the field exists as-is in the Task YAML frontmatter and is read/written directly.

**4. Unsupported (rare).** When a host has no place to store `sub_repo` at the Task level (very rare; some legacy issue trackers), the connection profile declares the gap explicitly:

```yaml
mapping:
  fields:
    sub_repo:
      host_storage: unsupported
      degradation: "Cross-sub-repo coordination unavailable; single-sub-repo Features still work via /quick + CPO classification at decomposition time."
```

Routing skills check this capability gap at execution time and surface the limitation to the CPO. Single-sub-repo Features continue to work via in-session CPO classification; cross-sub-repo Features and atomic execution (v2.4 Feature 5) require sub_repo storage.

#### Per-host quick reference

| Host | host_storage | host_field / prefix | Notes |
|---|---|---|---|
| Azure DevOps | `custom_field` | `STRAP.SubRepo` | Custom field must be added to the host process template. The v2.4 `/strap-in` extended interview (Feature 4) surfaces this requirement at first wire-up; absent the custom field, the polyrepo flow is gated until provisioning. |
| GitHub Issues | `label_prefix` | `sub-repo:` | Labels are pre-existing; no provisioning needed beyond convention. One-per-Task invariant enforced by `operation_templates`. |
| Jira | `custom_field` | `customfield_XXXXX` (per-instance) | Custom field provisioned per-instance; `/connect-devops-project` captures the field id. Recommended human-readable name: "STRAP Sub-Repo". |
| Local (strap-agile) | `yaml_field` | `sub_repo` | Direct YAML field in the Task file frontmatter. |

The four canonical patterns above cover the host families STRAP supports in v2.4. Other hosts (Bitbucket Issues, GitLab Issues, Linear, ClickUp, etc.) fall through to one of the same patterns -- the dev-lead at `/connect-devops-project` time picks the matching pattern when modeling the host. Schema-versioning the connection profile (Feature 3) carries `schema_version: "2.4"` after this field set is wired so `/strap-upgrade` can detect older profiles that need extending.

### Capability gaps

Whatever the host can't do, the connection profile records as `unsupported`. Pipeline skills that need an unsupported capability degrade gracefully per the existing adapter-contract pattern. The CPO learns about gaps at `/connect` time, not surprise during pipeline runs.

### Secrets discipline (non-negotiable)

The connection profile at `.claude/strap/state/{devops,code}-connection.yaml` is source-controlled -- mappings, capabilities, and host URL are team-shared artifacts that travel with the project. The profile **never contains credential values**.

Credentials are referenced by env-var name only (`token_env: JIRA_TOKEN`, `user_env: JIRA_USER`). Actual values live in one of:

- **`.claude/settings.local.json` `env` block** -- per-developer, gitignored. The natural home for STRAP installs. Each developer sets their own PAT / API token.
- **System / shell environment** -- for developers who prefer their shell profile or platform-specific secret stores.
- **CI environment variables** -- for pipeline-triggered runs.

A PAT, API token, password, or any secret-typed value appearing in any tracked file -- the connection profile, `project-profile.md`, an agent file, a context doc, a memory file -- is a security defect. The dev-lead refuses to commit any change that introduces one. If a CPO pastes a credential into a prompt, the dev-lead does not echo it back, does not write it to any file, and does not include it in any commit; instead, dev-lead instructs the CPO to set the corresponding env var locally.

This is the same "Secrets out of state" rule the devops-lead enforces for infrastructure-as-code, applied to the connection-profile surface.

## `/connect-devops-project` -- structure

Wires up work-item tracking. CPO picks the host:

| Option | What it connects to |
|---|---|
| Azure DevOps | Azure DevOps org + project |
| Jira | Jira Cloud or Server |
| GitHub Issues | GitHub repo's Issues + Projects |
| Local (strap-agile) | Markdown work items under `.claude/strap/work/` |
| Other | Any host the CPO names; full discovery from scratch |

Local mode (`strap-agile`) is the markdown-first work-tracking vision: work items as `.md` files with YAML frontmatter as the system of record. Lifecycle: Requirement -> Spec -> Feature -> Story -> Task -> Bug. State transitions update frontmatter; links are explicit. No discovery needed -- the shape is fixed by STRAP. The starter template under `.claude/strap/templates/connection-templates/local-files.yaml` describes the shape.

For remote modes: full five-step flow above. On hard block (CPO cannot establish auth, or host doesn't expose required operations), CPO chooses "pause until connectivity is established" or "fall back to Local (strap-agile)."

## `/connect-code-repo` -- structure

Wires up source control. CPO picks the host:

| Option | What it connects to |
|---|---|
| Azure Repos | Azure DevOps repo |
| Bitbucket | Bitbucket Cloud or Server |
| GitHub | GitHub repo (public or private) |
| Local Git | Local-only `git init`, no remote |
| Other | Any host the CPO names; full discovery from scratch |

Local Git mode means there is no `git remote`. The team operates on local branches following the standard PR-pattern as a local-merge ceremony: feature branches off `main`, task branches off feature branches, "PR" is a dev-lead-coordinated local merge with sanity gates (tests pass, no force-merge to `main`, dev-lead approval). The connection profile records `pull_request_create` as a logical operation that maps to local-merge, not to a host API call.

For remote modes: full five-step flow above. The probe verifies dev-lead can read the remote, list branches, and (with CPO consent) create-and-delete a test branch.

**Satisfied gate definitions:**

- **Remote intent**: the gate satisfies when auth probe succeeds AND dev-lead can read the remote AND the connection profile is validated by the CPO.
- **Local Git intent**: the gate satisfies when git is installed AND a `main` branch exists (creating it via `git init` + first commit if absent).

## Specialist relevance: irrelevant != deleted

When a specialist is not activated for the deep-dive (e.g., no frontend code -> frontend-engineer not active), it does NOT mean the agent is removed. The agent stays in the roster with:

- Its canonical agent definition at `.claude/agents/agent-{devs,ops}/<name>.md`
- Its per-agent rules at `.claude/strap/rules/agents/<name>.md` (starter content)
- Its per-agent memory at `.claude/strap/memory/agents/<name>.md` (empty)

The agent is dormant. When the project later grows into its domain (e.g., the team adds a frontend a year later), `/strap-refresh` detects the new code, activates the specialist for a fresh deep-dive, and curates its memory and rules from that point forward.

## Narration cadence

Hybrid:

- **Inline**: short bursts as major findings land, especially during dev-lead's initial discovery and as specialist reports come back. "Reading `package.json`... Angular 19, NgRx. Found a `mockup/` directory -- designer is in scope."
- **Batched checkpoints**: at the end of each phase (initial discovery, each deep-dive wave, the synthesis gate, the hand-off). Structured summaries the CPO can scan.

The dev-lead's voice in narration is direct and confident, not chatty. Each statement either reports a fact, names a decision, or surfaces something for CPO input.

## Multi-session phased discovery

Some onboardings span sessions. The discipline:

1. At end of session: dev-lead runs `/context-prep strap-in-<project-slug>` to capture phase progress. The continuation records which specialists are done, which are partial, what's left.
2. At start of next session: CPO runs `/context-fetch strap-in-<project-slug>`. The continuation loads as session-startup context. Dev-lead resumes mid-phase from there.
3. Specialists carry their remaining per-agent budget across sessions (recorded in `.claude/strap/state/usage.yaml`).

The state file is the bridge across sessions. The continuation is the narrative summary the dev-lead reads to ground itself.

## Re-run path: `/strap-refresh`

If a project has already been onboarded (`project-profile.md` populated, specialists have memory entries), `/strap-in` detects this and redirects:

> "This project is already onboarded. Use `/strap-refresh` to incrementally update the persistence stack against the current codebase, or `/strap-refresh --full` to redo discovery from scratch."

`/strap-refresh` is structurally similar to `/strap-in` but:

- Reads the current persistence stack first (project-profile, per-agent memory and rules) and uses it as priors
- Detects diffs against fresh discovery and surfaces them for CPO approval before updating
- Skips specialists whose domain hasn't changed
- Activates dormant specialists whose domain newly appeared

## CreateTeam-for-parallel-work pattern

`CreateTeam` is the canonical primitive for dispatching parallel specialist work. Any time the pipeline fans out to multiple specialists in parallel -- onboarding deep-dives, sprint Task implementation, PR fix-fanout -- dev-lead uses `CreateTeam`.

Serial `Task` / `Agent` dispatch is reserved for genuinely sequential work (one specialist's output feeds the next specialist's brief). Parallel work uses team primitives.

This pattern is documented in [`agent-devs.md`](../rules/agent-devs.md) as a team rule and in [`dev-lead.md`](../rules/agents/dev-lead.md) as a dev-lead-specific guardrail.

## Resolved during `/strap-in` implementation (2026-05-14)

- **Re-run boundary detection.** Resolved: **scaffold sentinel** in `project-profile.md`. The install script writes `<!-- STRAP_SCAFFOLD -->` at the top of a fresh `project-profile.md`. The dev-lead strips this sentinel during the synthesis gate as part of the first real curation. Detection: sentinel present = fresh onboarding; sentinel absent + substantive content = already onboarded; sentinel absent + empty/whitespace = install-incomplete. Zero new state files; one source of truth. Implemented in [`../../skills/strap-in/SKILL.md`](../../skills/strap-in/SKILL.md) pre-flight section.
- **`/strap-refresh` vs `/strap-in --refresh` flag.** Resolved: **separate `/strap-refresh` skill.** Two named skills with distinct intents; clearer to invoke and document; harder for a CPO to accidentally trigger full re-discovery when they wanted incremental. `/strap-in` redirects to `/strap-refresh` when pre-flight detects an already-onboarded project.

## Open questions still to resolve

These are flagged for resolution during implementation of the remaining skills:

- **The "evaluation mode" exit path.** A CPO who runs `/strap-in` and `/connect-code-repo --mode local-only-git` is in a working but local-only state. What's the path from there to "now I want to connect a real remote"? Likely a re-invocation of `/connect-code-repo` with a different mode; should validate this works smoothly when the skill is cut.
- **Adapter migration to connection-templates.** Complete (#38925 Stage 2). v1 adapter directories at `.claude/strap/adapters/` were retired; per-project connection state lives at `.claude/strap/state/{devops,code}-connection.yaml`, and starter accelerators live at `.claude/strap/templates/connection-templates/<host>.yaml`.
- **Operation execution mechanism.** Two options for how dev-lead executes host operations against the connection profile's `operation_templates`: (a) generic HTTP/REST executor that fills templates and runs them via `Bash`/`curl`; (b) reasoned-on-the-fly execution where dev-lead figures out the right call each time. Leaning (a) for reliability; lock at implementation of `/connect-devops-project`.
- **Token estimation reliability.** Specialist self-reports are estimates. We don't have a precise mechanism. The 60% threshold buffers some of this; the CPO's `/usage` watch covers the rest. Live with the imprecision unless it proves expensive once first-adopter validation produces real numbers.
- **Mockup discovery before designer activation.** If the project profile names mockup paths but no mockups exist yet, does the designer activate? Probably no (nothing to read); reactivate on `/strap-refresh` after mockups land.

## References

- Budget discipline (cross-cutting): [`./budget-discipline.md`](./budget-discipline.md)
- Identity model and persistence stack: [`/CLAUDE.md`](../../../CLAUDE.md)
- Team rules: [`../rules/agent-ops.md`](../rules/agent-ops.md), [`../rules/agent-devs.md`](../rules/agent-devs.md)
- Dev-lead guardrails: [`../rules/agents/dev-lead.md`](../rules/agents/dev-lead.md)
- The narrative front door: [`../docs/strap-in.md`](../docs/strap-in.md)
- Active continuation: [`./continuations/strap-in-refactor.md`](./continuations/strap-in-refactor.md)
