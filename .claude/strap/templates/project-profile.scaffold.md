<!-- STRAP_SCAFFOLD -->
# Project profile

_This file is a scaffold. The dev-lead populates it during `/strap-in`. The `STRAP_SCAFFOLD` sentinel at the top of this file is stripped during the synthesis gate -- once it is gone, the file is the curated record of what this project IS, and `/strap-in` will detect re-runs and redirect to `/strap-refresh`._

_Refine this over the project's lifetime. Inferences from onboarding go here; learnings from active work go here; CPO corrections go here. When the project shape evolves -- a new tech is added, a convention changes, a known sensitivity is discovered -- update this file before doing anything else._

## Identity

- **Project name**: _to be captured by /strap-in_
- **Company**: _to be captured by /strap-in_
- **Repository**: _to be captured by /connect-code-repo_
- **Default branch**: _to be captured by /connect-code-repo_

## Sub-repos

_The structural map for polyrepo installs. When the install root contains two or more peer sub-repos at depth-1 (each with its own `.git/`), `/strap-in` runs in polyrepo mode and populates this section -- one H3 entry per sub-repo. When the install is a single project, this section stays empty and `/strap-in` short-circuits the polyrepo flow. A populated `Sub-repos` section also acts as the polyrepo signal for `/strap-refresh`, which skips re-detection and runs the per-sub-repo refresh flow directly._

_Schema version: v2.4 (extended structured fields for routing, test execution, dependency awareness, and deployment-target attribution). The `<!-- strap-schema: sub-repos-v2.4 -->` sentinel comment immediately below marks the section as v2.4-aware so `/strap-upgrade` can detect and skip re-migration on already-migrated installs._

<!-- strap-schema: sub-repos-v2.4 -->

_Each sub-repo is an H3 section. The H3 heading text IS the canonical slug. Fields land as a bullet list directly under the heading. Identity fields come first, then execution-relevant fields (consumed by the v2.4 routing and test-execution skills), then orientation prose (read by specialists on invocation), then immutable meta:_

- **Slug**: canonical kebab-case identifier; matches the H3 heading text exactly. Used as foreign-key target for Task `sub_repo`, coordinated branch names, `CreateTeam` team names (`<feature-id>-<slug>`), and cross-sub-repo cluster manifests.
- **Path**: relative path from the install root to the sub-repo (e.g., `shared-lib`).
- **Role**: one-line description of what this sub-repo does in the system.
- **Primary language**: `typescript` / `csharp` / `python` / `go` / `kotlin` / `rust` / etc. Used by specialists during decomposition to pick framework-appropriate patterns.
- **Active domains**: comma-separated per-sub-repo specialist activation set (e.g., `frontend-engineer, integration-specialist`). When a Task is tagged with this sub-repo's slug, dispatch resolves specialists from THIS list, not umbrella-wide. Maps slugs to the canonical agent roster.
- **Test command**: shell command run at PR-prep time by `/execute-sprint`'s centralized test gate. Executed from the sub-repo's path (not umbrella root). Example: `npm test`, `dotnet test`, `pytest`, `go test ./...`.
- **Build command**: shell command for build verification. Same execution context as Test command. Example: `npm run build`, `dotnet build`, `python -m build`.
- **Parallel safe**: `true` or `false` (default `false`). Opt-in flag declaring this sub-repo's test/build commands can run concurrently with other `parallel_safe: true` sub-repos without resource conflicts (no shared port, no shared DB, no shared fixture). Conservative default keeps cross-sub-repo execution sequential until adopter explicitly opts in.
- **Deployment target**: name reference into `devops-connection.yaml`'s `deployment_targets:` list (e.g., `vercel-prod`, `azure-prod-eus`). Blank or omitted when the sub-repo does not deploy independently (library code, dev-only utilities, etc.). Feeds `/dora-collect`'s per-target deployment-frequency attribution.
- **Depends on**: comma-separated sub-repo slugs this sub-repo internally consumes (e.g., `web-frontend` depends on `shared-lib`). _Internal cross-sub-repo_ coupling only -- external deps (PostgreSQL, Redis, third-party APIs) belong in this sub-repo's Stack field or in `STACK.md`. Feeds `/execute-sprint` merge ordering and `/refine-pr` downstream test propagation (changes to an upstream sub-repo run downstream sub-repos' tests automatically).
- **Stack**: languages, frameworks, runtimes for this sub-repo (prose). Orientation context that specialists read on every invocation. Goes beyond Primary language to name the major frameworks and runtimes (e.g., "React 18 + TypeScript + Vite + Vitest" or ".NET 8 + ASP.NET Core + EF Core + xUnit").
- **Conventions**: per-sub-repo branch patterns, commit style, lint/format rules that differ from the umbrella defaults. Bullet list inside the field body.
- **Source-of-truth**: file paths or directories that exemplify this sub-repo's current shape. Specialists read these paths during decomposition and review.
- **Activated**: `<YYYY-MM-DD> by <approver>` _(captured at activation; immutable after)_.

_Domains can still exist alongside Sub-repos -- a Domain can declare Source-of-truth paths that span multiple sub-repos (e.g., a `core` domain spanning two libs). The dev-lead curates the Domain/Sub-repo relationship at synthesis. Per-sub-repo Active domains in this section take precedence over umbrella Domains for execution-time specialist dispatch; umbrella Domains continue to govern decomposition activation gates._

## Stack

_To be discovered by /strap-in. The dev-lead reads top-level manifests, file-tree shape, and recent git activity at shallow scope, then dispatches relevant specialists for the deep-dive. The synthesis lands here._

## Domains

_The activation map for code-domain specialists. Each domain entry binds a logical concern (client-ui, api, core, data, infrastructure, integrations, etc.) to a stack and an active specialist roster. Specialists read their domain entries on every invocation to pick up project-tuned context. The `/decompose-feature` activation gate adds new entries here when a Feature introduces a domain not yet listed; the CPO approves additions._

_Each active domain is an H3 section with the following fields:_

- **Status**: `active` or `dormant`
- **Specialists**: comma-separated canonical agents active for this domain (e.g., `designer, frontend-engineer` for a client-ui domain)
- **Stack**: framework, language, and runtime particulars specific to this domain
- **Conventions**: bullet list of patterns and disciplines that apply to work in this domain on this project
- **Source-of-truth**: file paths or directories that exemplify the domain's current shape
- **Activated**: `<YYYY-MM-DD> by <approver>` _(captured at activation; immutable after)_

_The section starts empty and grows through activation. Domains never active are omitted entirely; domains once active but no longer engaged shift to `Status: dormant` (memory and rules preserved for future re-activation)._

## Build and test

_To be discovered by /strap-in. Validators, smoke harness, CI pipeline references go here once observed._

## Conventions

_To be discovered by /strap-in. Branch patterns, commit style, documentation format, worktree usage go here._

## Architecture notes

_To be discovered by /strap-in. High-level structural facts that every agent should know on every invocation go here._

## DevOps integration

_To be wired up by /connect-devops-project. Work-tracking host, organization, project, epic IDs, area paths go here._

## Layers

_Adopter-configured partitioning for DORA reporting. Each layer groups pipeline runs, product deployments, and (optionally) federation file paths into a single bucket for `/dora-collect` snapshot and `/dora-report` per-layer DORA-4 breakdown. When this section is empty, DORA reports degrade gracefully to single-layer (everything in one bucket)._

_Each layer is an H3 section with the following fields:_

- **Status**: `active` or `dormant`
- **Pipeline pattern**: glob or regex matching pipeline run names that belong to this layer (e.g., `TM-PROD-*`, `Deploy MyApp *`)
- **Product layer**: _(optional)_ grouping label so multiple pipelines roll up to one product in reports (e.g., several `TM-*-Federation Api` pipelines under product `ASA`)
- **Federation pattern**: _(optional)_ file-path glob for code-activity attribution in the Federation Code Activity section of `/dora-report` (e.g., `src/Federations/TM/**`)
- **Excluded from DORA**: `true` or `false` _(default false; set true for internal-only pipelines like ephemeral dev environments that should not count toward Deployment Frequency / CFR / MTTR)_
- **Activated**: `<YYYY-MM-DD> by <approver>` _(captured at activation; immutable after)_

_The section starts empty. Adopters with simple single-pipeline setups can leave it empty -- DORA reports degrade to single-layer with no partitioning. Adopters with multi-product or multi-federation deployments populate this section to get per-layer DORA-4 breakdowns._

## Project docs paths

_Adopter-configurable target paths for the human-facing project-orientation documents (`PROJECT.md`, `ARCHITECTURE.md`, `STACK.md`) produced by tech-writer at `/strap-in` closing phase and refreshed surgically by `/strap-refresh`. Each entry is a directory path relative to the repo root. When this field is absent, the fallback is `.claude/strap/project-docs/`. Adopters with an existing docs directory (e.g., `docs/`, `documentation/project/`) declare it here so the rendered docs land where the team already looks for them._

_Example:_

```
- docs/project/
```

_Or for a multi-location setup (first declared path wins for write target; subsequent paths are documented for awareness):_

```
- docs/project/
- .claude/strap/project-docs/
```

_The entire path is protected by `/strap-upgrade` (adopter-owned; never reconciled against the package). Leave the section empty to use the default fallback._

## Project-specific behaviors

_To be discovered by /strap-in and refined over time. Quirks, gotchas, host-specific behaviors that have caught the team before go here._
