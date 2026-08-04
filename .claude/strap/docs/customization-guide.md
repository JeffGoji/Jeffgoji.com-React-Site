# Customization Guide

How adopters tailor STRAP to their project without breaking the upgrade path. STRAP is opinionated by design and the customization surface is much narrower than typical platform-style frameworks -- the canonical roster is fixed, the skill catalog is fixed, and the per-project tuning happens through a small set of curated files the dev-lead writes on the CPO's direction.

This guide is for the Claude Pipeline Orchestrator (CPO) -- the human who owns the install. Read it before editing anything under `.claude/`. The pattern you pick determines whether the next `/strap-upgrade` preserves your change cleanly, surfaces it as a conflict, or overwrites it.

## The customization surface

Four surfaces are adopter-tunable. Everything else is package-owned.

| Surface | What lives here | Editor | Upgrade behavior |
|---|---|---|---|
| **Project profile** | `.claude/strap/contexts/project-profile.md` -- the curated record of what THIS project IS (stack, active domains, conventions, build/test commands, DevOps integration). | dev-lead (CPO directs) | Never touched by `/strap-upgrade`. Adopter-owned. |
| **Per-agent rules** | `.claude/strap/rules/agents/<agent>.md` -- per-agent guardrails added reactively when something needs preventing. | dev-lead (CPO directs) | Never touched. Single-curator rule. |
| **Per-agent memory** | `.claude/strap/memory/agents/<agent>.md` -- accumulated tradecraft for this project. | dev-lead (CPO directs) | Never touched (treated as `conflict` in `/strap-upgrade` only if the install version equals the package's seed; once curated, the install version is authoritative). |
| **Connection profiles** | `.claude/strap/state/devops-connection.yaml`, `.claude/strap/state/code-connection.yaml` -- per-project work-tracking + source-control wire-up. | `/connect-*` skills (CPO directs) | Never touched. |

Three other adopter-owned categories are tracked but rarely edited directly:

- **Continuations** (`.claude/strap/contexts/continuations/<topic>.md`) -- written by `/context-prep`, read by `/context-fetch`. Session-state, not configuration.
- **Settings** (`.claude/settings.json`, `.claude/settings.local.json`) -- harness permissions + env. Edited via the harness `/config` flow or the installer, not directly.
- **Project docs** (default path `.claude/strap/project-docs/`, or whatever the `Project docs paths` field declares) -- the human-facing `PROJECT.md`, `ARCHITECTURE.md`, `STACK.md` rendered by `tech-writer` at `/strap-in` and refreshed surgically by `/strap-refresh`. A self-contained `<project-name>-orientation.html` companion is rendered alongside the three markdowns via the STRAP html-render pipeline at `.claude/strap/tools/html-render/`. The markdown is the source of truth (surgically updated at `/strap-refresh`); the HTML is a derived artifact (always full re-render). Both are read-mostly; the dev-lead curates through the closing-phase dispatches, not through in-place edits. The HTML uses the same template + CSS as `Welcome-to-STRAP.html` so the visual identity is consistent across all STRAP-produced docs.

That's the entire customization surface. There is no `project.yaml`. There is no template-rendering layer. There is no agent registry. The fixed canonical roster + the curated persistence stack is the whole model.

## The single-curator rule

Only the dev-lead writes to per-agent rules and per-agent memory. Specialists report findings; the dev-lead decides what gets persisted. The CPO directs the dev-lead through normal conversation -- "save this learning to the backend-engineer's memory", "add a guardrail so we never push to main directly" -- or through the explicit `/memory-refine <agent>` skill.

This rule exists because curated context is what makes STRAP compound over time. If specialists could write their own rules and memory, the persistence stack would drift -- contradictions accumulate, stale tradecraft persists, the project-profile loses coherence. One curator keeps the persistence stack tight.

CPO direction is non-negotiable. The dev-lead executes the curation; the CPO decides what to curate.

## Tuning project shape

Most customization is project-profile curation. The project profile is what tells every specialist what THIS project is.

**Stack tuning.** Add or edit the `Stack` section to capture languages, frameworks, runtimes. Update when the project adopts a new tech (e.g., adds a mobile client, swaps databases). The dev-lead reads the project profile on every invocation; updating it is the cleanest way to redirect specialist behavior.

**Domain activation.** The `Domains` section enumerates which logical concerns (client-ui, api, core, data, infrastructure, integrations) are active on this project, names the specialists each domain dispatches to, and records the per-domain `Source-of-truth` paths + `Conventions`. The `client-ui` domain covers **any** client-side UI form factor -- web (Angular / React / Vue / etc.), desktop (WPF / WinForms / MAUI / Avalonia / Borland C++ Builder VCL / etc.), mobile (Xamarin / MAUI / SwiftUI / native), cross-platform runtimes (Electron / Tauri / Flutter Desktop), AND server-rendered patterns (Python widget libraries like Streamlit / Dash / Gradio and in-house/custom widget frameworks, Phoenix LiveView, Rails Hotwire, Laravel Livewire, Blazor Server, classic template engines, vendored JS widget libraries). `frontend-engineer` dispatches across all of them via the same disciplines; the project profile names the specific framework. Adding a new domain (e.g., a new mobile client adds `client-ui` paths) goes through the `/decompose-feature` activation gate when a Spec first requires it, or through `/strap-refresh` when the project profile drifts from current codebase shape.

**Polyrepo Sub-repos.** When the install is a polyrepo umbrella (multiple peer sub-repos at depth-1 under the install root, each with their own `.git/`), `/strap-in`'s polyrepo path populates a top-level `Sub-repos` section in `project-profile.md` with one H3 entry per sub-repo. Each entry carries seven fields: `Path` (relative from install root), `Purpose` (one-line role), `Stack` (per-sub-repo languages and frameworks), `Conventions` (per-sub-repo branch / commit / lint patterns that differ from the umbrella), `Source-of-truth` (paths exemplifying the sub-repo's shape), `Runtime dependencies` (internal cross-sub-repo coupling -- external deps like Postgres or third-party APIs belong in `Stack` or `STACK.md`), and `Activated`. The section starts empty for single-project installs and stays empty -- a populated `Sub-repos` section is the polyrepo signal that `/strap-refresh` reads to skip re-prompting on subsequent runs. Domains can still exist alongside Sub-repos: a Domain can declare `Source-of-truth` paths that span multiple sub-repos (e.g., a `core` domain spanning two libs), and the dev-lead curates the Domain/Sub-repo relationship at synthesis. To restructure -- add a sub-repo to the umbrella, remove one, restate a runtime-dependency contract -- direct the dev-lead through `/strap-refresh`, which surfaces structural diffs explicitly before any updates land. CPO can defer or ignore a structural diff per case before applying it.

**Mockup paths (`client-ui` domain only).** When the `client-ui` domain is active and the project already has a mockup application (e.g., an Nx workspace with `omni-web-mockups` and `omni-mobile-mockups`), declare its paths in a `Mockup paths` field on the `client-ui` domain entry. `/create-mockups` writes designer-authored mockup files under the declared paths. When `Mockup paths` is absent, the skill falls back to `.claude/strap/mockups/spec-<id>/` -- usable out of the box, but adopters with stack-specific mockup tooling typically prefer the override so the running mockup app picks them up directly.

**Project docs paths (top-level).** Declares where the human-facing project-orientation documents (`PROJECT.md`, `ARCHITECTURE.md`, `STACK.md`) land. `tech-writer` renders these from the curated persistence stack at `/strap-in`'s closing phase and refreshes them surgically at `/strap-refresh`'s closing phase. When the field is absent, the skill falls back to `.claude/strap/project-docs/`. Adopters with an existing docs directory (e.g., `docs/`, `documentation/project/`) declare it here so the rendered docs land where the team already looks for them. The first declared path is the write target; subsequent paths document additional locations for awareness. The path is protected by `/strap-upgrade` (adopter-owned; never reconciled against the package).

**DORA layers.** The top-level `Layers` section partitions pipeline runs, product deployments, and federation file paths for `/dora-collect` snapshots and `/dora-report` per-layer DORA-4 breakdown. Each layer declares a `Pipeline pattern` (glob or regex matching pipeline run names), an optional `Product layer` (grouping label), an optional `Federation pattern` (file-path glob for code-activity attribution), and `Excluded from DORA` (boolean; default false). When the section is empty, DORA reports degrade gracefully to single-layer (everything in one bucket) -- adopters with simple single-pipeline setups can leave it empty. Adopters with multi-product or multi-federation deployments populate it to get per-layer breakdowns (e.g., ASA-UAT vs ASA-PROD vs Marlin-PROD).

**Build / test commands.** The `Build and test` section carries the active-domain build + test commands. `/execute-sprint`, `/fix-bugs`, and `/refine-pr` all read these for the centralized build-and-test pass.

**Conventions.** Sprint cadence, naming convention, pair topology, capacity assumptions -- anything `/plan-sprint` and `/rebalance-sprint` consult when the host doesn't supply it natively. Branch conventions, commit-message format, worktree-root override -- anything `/execute-sprint` consults if the connection profile doesn't pin it down.

When in doubt, ask the dev-lead to surface what it actually reads from the profile, then update the profile. The profile is the canonical record; if a behavior isn't grounded in the profile, it should be.

## Tuning specialist behavior

When a specialist almost made a mistake or has accumulated tradecraft worth keeping, the dev-lead curates per-agent rules or per-agent memory.

**Per-agent rules** are guardrails. "Don't push directly to main." "Always run the test suite from the repo root, not from a subdirectory." "Validate Terraform plans against a dry-run before applying." Added reactively when something needs preventing.

**Per-agent memory** is soft tradecraft. "The test runner takes 8 minutes after a fresh dependency install; warm it once first." "This codebase prefers the older mapping pattern for X." "Use --no-build after the separate build step or you waste eight minutes." Grows naturally as work happens; specialists notice things, the dev-lead persists the learnings worth keeping.

The distinction matters: rules block behavior; memory shapes behavior. Use rules for hard constraints, memory for soft guidance.

The CPO can direct curation explicitly via:
- `/memory-show <agent>` to see what's already there.
- `/memory-refine <agent>` to update.

Both flow through the dev-lead under the single-curator rule.

## Tuning token budgets

STRAP's budget discipline is per-workflow (`/strap-in`, `/strap-refresh`, `/decompose-feature`, `/execute-sprint`, `/refine-pr`, `/fix-bugs`, `/quick`, `/create-test-plan`). The CPO confirms the onboarding workflow's per-agent + session-aggregate budgets once at `/strap-in` time; remaining workflows' defaults are written silently to `MEMORY.md` + `usage.yaml`. Subsequent workflows pull defaults silently.

When defaults don't fit your project's natural shape -- a large monorepo needs more session aggregate; a tight refresh wants a smaller ceiling; a specific specialist consistently over- or under-runs the default -- the canonical tuning surface is **`/revise-token-budget`**. The skill lists current budgets, accepts a workflow + agent + value to revise (or a workflow-wide change), persists to both `usage.yaml` and `MEMORY.md`, and writes an audit-trail comment. Per-agent overrides (`budgets.<workflow>.agent_overrides.<agent>.per_agent`) get honored at dispatch time -- the SKILL.md files resolve via `budget-discipline.md`'s "Dispatch-time resolution" rule.

For polyrepo installs, the session-aggregate budget is computed additively as `base + (N - 1) * per_sub_repo_increment`. The increment comes from the same defaults table; `/revise-token-budget` lets you tune either the base or the increment. Default increment is 300K for `/strap-in` and 200K for `/strap-refresh`.

## Reconnecting hosts

When work-tracking or source-control needs change (a Jira instance moves, a new auth token rotates in, a host changes its API shape, the team migrates from one tool to another):

1. **Re-invoke `/connect-devops-project`** (or `/connect-code-repo`). The pre-flight surfaces the existing profile and offers `keep` / `reconnect` / `switch`.
2. **`reconnect` re-probes the same host** to refresh capabilities (useful when the host changed its API surface).
3. **`switch` re-runs the five-step discovery against a different host** entirely.

Connection profiles persist env-var REFERENCES only -- credential values never enter any tracked file. To rotate a credential, update the env var in `.claude/settings.local.json` (or system env, or CI env); the profile reads the reference at runtime.

## Adding your own agents, skills, and rules

The canonical roster of 15 agents and the package skill catalog are the **default** set STRAP ships with -- not a wall. Adopters are encouraged to add their own agents, skills, and rules. The persistence stack is precisely the integration point that lets custom additions become first-class participants in the STRAP pipeline.

### Adopter-authored skills

Two flavors, both supported:

**Standalone skills** the CPO invokes directly (`/<your-skill> <args>`). Drop `.claude/skills/<your-skill>/SKILL.md` with the standard frontmatter (`name`, `description`, `allowed-tools`). The dev-lead reads the skill catalog on every session; no further wiring is needed. Use `operation_templates.<op>` from the connection profile for host work, and `project-profile.md`'s Domains for specialist dispatch -- the same patterns the STRAP skills follow.

**Pipeline-integrated skills** that should run as part of an existing workflow (e.g., "always run `/our-compliance-scan` after `/execute-sprint`"). Two integration paths:

1. **Per-agent rules curation.** Direct the dev-lead to add a rules entry under `.claude/strap/rules/agents/dev-lead.md` describing when to invoke the new skill ("after `/execute-sprint` prepares the PR, recommend `/our-compliance-scan`"). The dev-lead will surface it conversationally at the right moment.
2. **Claude Code harness hook** in `settings.json`. Fires the skill automatically on a tool event. This is a harness-level mechanism (not STRAP-specific) and bypasses the dev-lead's conversational surface entirely. Use when truly hands-off automation is wanted.

### Adopter-authored agents

Adding a new agent and wiring it into the pipeline is a three-step ceremony:

1. **Create the agent role contract.** Drop `<custom-agent>.md` at `.claude/agents/agent-{ops,devs}/<name>.md` with the standard frontmatter (`name`, `description`, `model`, `tools`, `color`). Follow the same role-contract structure as the canonical 15 (Identity / Operating context / Responsibilities / Dispatch contract / Boundaries).
2. **Seed the persistence-stack files.** Create `.claude/strap/rules/agents/<custom-agent>.md` and `.claude/strap/memory/agents/<custom-agent>.md` with starter content (or empty stubs the dev-lead curates over time).
3. **Wire into the pipeline via `project-profile.md`.** Ask the dev-lead to add the new agent to the `Specialists` field of the relevant domain entry under the `Domains` section. CPO directs; dev-lead applies the edit under the single-curator rule.

Example: a compliance-reviewer that runs alongside backend-engineer on every API surface. Add `compliance-reviewer.md` to `agent-devs/`, seed its rules + memory, and tell the dev-lead "add compliance-reviewer to the api domain's Specialists list." From that moment, every pipeline skill that reads active-domain specialists (`/decompose-feature`, `/execute-sprint`, `/fix-bugs`, `/refine-pr`, `/test-parallel`) routes work through the custom agent like any canonical one.

**Cross-cutting agents** (security-scanning, compliance, project-specific governance) fit naturally as additional Specialists on existing canonical domains. **Entirely new logical domains** beyond the canonical six (client-ui, api, core, data, infrastructure, integrations) are a heavier lift -- most pipeline skills handle them fine because they read `project-profile.md` directly, but `/decompose-feature`'s Spec-section-to-domain mapping logic was authored around the six and may need a small skill update for a Spec section that targets a brand-new domain. The easier path is to extend existing domains with custom Specialists.

### What `/strap-upgrade` protects

Custom additions are always safe from package reconciliation:

| Custom artifact | Upgrade classification |
|---|---|
| `.claude/agents/agent-{ops,devs}/<custom-agent>.md` | `install-only` (package never ships a file at that path) |
| `.claude/skills/<custom-skill>/SKILL.md` | `install-only` |
| `.claude/strap/rules/agents/<custom-agent>.md` | Protected (entire `rules/agents/` directory is adopter-owned) |
| `.claude/strap/memory/agents/<custom-agent>.md` | Protected |
| `project-profile.md` Domains edits adding custom Specialists | Protected (project-profile is adopter-owned) |
| Hook entries in `settings.json` referencing custom skills | Protected (settings files are adopter-owned) |

The CPO cannot accidentally break the upgrade path by extending STRAP through these channels.

## What is NOT supported

The constraint isn't "no new agents" -- it's "no in-place edits to package-shipped artifacts." Specifically:

- **Editing a canonical agent's role contract file in place.** The 15 STRAP-shipped role contracts at `.claude/agents/agent-{ops,devs}/<canonical-name>.md` are package-owned; in-place edits surface as `conflict` on every upgrade. The supported path is **per-agent rules** at `.claude/strap/rules/agents/<canonical-name>.md` -- those are adopter-owned and stack on top of the role contract at runtime.
- **Editing a STRAP-shipped skill SKILL.md in place.** Same pattern as canonical agents. The supported path is to add a new skill with a different name and direct the dev-lead to invoke yours instead.
- **Editing team rules (`agent-devs.md`, `agent-ops.md`) in place.** Same pattern. The supported path is **per-agent rules** -- they apply contextually to specific agents and stack on top of team rules.
- **No template-rendering layer.** The v1 mechanism that rendered rules + contexts from per-stack templates is gone. Files are canonical. Per-stack context lives in `project-profile.md` and the agents read it at runtime.
- **No `project.yaml`.** The role this file played in v1 (project identity, adapter selection, stack identity, convention toggles) is now split across `project-profile.md` (curated narrative) and the two connection profiles (host-specific operations).
- **No two-layer rendered agents.** v1's `<agent>.role.md` + per-stack template pattern is gone. Agents are single-file role contracts that read `project-profile.md` at runtime.
- **No `/onboard-*` skill family.** Replaced by `/strap-in` (first encounter) + `/connect-*` (host wire-up) + `/strap-refresh` (re-discovery) + `/strap-upgrade` (package reconciliation).

## When to fork STRAP entirely

Forking is a last resort. The cost is permanent: you stop receiving STRAP upgrades and you take on the entire pipeline as your own product. Reasonable triggers:

- Your team's pipeline diverges so far from STRAP's two-team model that the orchestration logic itself no longer fits.
- A regulatory constraint requires you to vendor every dependency under your own version control with no upstream link.

If you fork: mirror the STRAP source repo into your own git remote, stop running `/strap-upgrade`, continue using the persistence-stack curation model (it's not coupled to upstream STRAP being a moving target). Forking is reversible only by manually merging fork changes against an upstream tag and re-adopting the upgrade flow.

Do not fork because of a single missing knob. File the gap as a STRAP feature request first.

## Quick reference

| You want to | Pattern | Effect on upgrade |
|---|---|---|
| Change the project's tech stack or active domains | Dev-lead curates `project-profile.md` (CPO directs) | Preserved -- project-profile is adopter-owned |
| Block a specialist behavior that almost caused harm | Dev-lead adds a per-agent rule (CPO directs) | Preserved -- per-agent rules are adopter-owned |
| Capture tradecraft worth keeping for next time | Dev-lead adds a per-agent memory entry (CPO directs) | Preserved -- per-agent memory is adopter-owned |
| Change a build or test command | Edit project-profile.md's `Build and test` section | Preserved |
| Partition DORA reports by pipeline, product, or federation | Populate project-profile.md's `Layers` section | Preserved -- project-profile is adopter-owned |
| Redirect human-facing project-orientation docs (`PROJECT.md`, `ARCHITECTURE.md`, `STACK.md`) to an existing docs directory | Populate project-profile.md's top-level `Project docs paths` field | Preserved -- project-profile is adopter-owned; the rendered docs path is protected by `/strap-upgrade` |
| Add, remove, or restate a polyrepo sub-repo (umbrella installs) | Direct the dev-lead through `/strap-refresh`; structural diffs in the `Sub-repos` section surface explicitly with defer / ignore / accept options before any updates land | Preserved -- the `Sub-repos` section lives in `project-profile.md` (adopter-owned) |
| Reconnect to a different work-tracking or source-control host | Re-invoke `/connect-devops-project` or `/connect-code-repo` | Preserved -- connection profiles are adopter-owned |
| Add an adopter-specific standalone skill | Drop in `.claude/skills/<your-skill>/SKILL.md` | Preserved (classified `install-only`) |
| Wire a custom skill into an existing workflow | Per-agent rules edit OR `settings.json` hook | Preserved -- both surfaces are adopter-owned |
| Add a new agent and wire it into the pipeline | New role contract under `.claude/agents/...` + seed rules + memory + dev-lead adds it to a `Domains` Specialists list | Preserved -- adopter-authored agents are `install-only`; persistence-stack files are adopter-owned |
| Add an entirely new logical domain beyond the canonical six | Possible for most skills; may need a small `/decompose-feature` update for Spec-section mapping | Preserved -- project-profile edits are adopter-owned |
| Edit a canonical agent's role contract in place | Discouraged. Use per-agent rules to augment behavior instead | In-place edits surface as conflicts |
| Edit a STRAP-shipped skill SKILL.md in place | Discouraged. Add a new skill with a different name instead | In-place edits surface as conflicts |
| Edit team rules (`agent-devs.md`, `agent-ops.md`) directly | Discouraged. Use per-agent rules to override contextually | In-place team-rule edits surface as conflicts |

When in doubt: ask the dev-lead. The dev-lead reads the persistence stack on every invocation and can tell you what's already curated, what's adopter-owned, and what the supported customization path is for the change you're contemplating.

## References

- [`upgrade-guide.md`](./upgrade-guide.md) -- the full `/strap-upgrade` walk-through, including the protected-paths list this guide alludes to.
- [`architecture.md`](./architecture.md) -- the persistence-stack and connection-discovery models in design detail.
- [`strap-in.md`](./strap-in.md) -- the adopter-facing narrative that introduced the persistence-stack concept.
- [`../../../CLAUDE.md`](../../../CLAUDE.md) -- super-pair identity, single-curator rule, fixed-roster invariant.
- [`../../skills/memory-refine/SKILL.md`](../../skills/memory-refine/SKILL.md) -- the explicit per-agent memory curation skill.
- [`../../skills/memory-show/SKILL.md`](../../skills/memory-show/SKILL.md) -- the inspection skill for per-agent memory.
- [`../../skills/strap-refresh/SKILL.md`](../../skills/strap-refresh/SKILL.md) -- the incremental re-discovery skill when project shape drifts.
