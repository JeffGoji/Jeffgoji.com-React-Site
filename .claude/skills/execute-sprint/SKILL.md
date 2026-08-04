---
name: /execute-sprint
description: Execute sprint Tasks for an assigned Feature. Dev-lead creates the feature branch, sequences Tasks by dependency, dispatches active-domain specialists in worktrees via CreateTeam, reviews each task branch, runs the integration audit, sets v2.2 completion metadata at resolution, and prepares the PR via the source-control connection profile.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
---

# /execute-sprint

## Purpose

Drive a Feature from sprint-allocated Stories and Tasks to a reviewable pull request. The dev-lead -- this session, not a sub-agent -- creates the feature branch, builds a dependency-aware execution plan, dispatches active-domain specialists in dedicated worktrees as named teammates, reviews each task branch, runs the centralized build-and-test pass, walks acceptance criteria end-to-end, and prepares the PR via the source-control connection profile.

The skill ships portable. Every adopter-specific concern is resolved at runtime:

- Specialist roster per Task domain comes from `project-profile.md`'s `Domains` section
- Work-tracking operations render through `operation_templates.<op>` in `.claude/strap/state/devops-connection.yaml`
- Branch operations and PR creation render through `operation_templates.<op>` in `.claude/strap/state/code-connection.yaml`
- Type, state, and link-type mappings come from `mapping.*` in the same profiles; `state_asymmetries` covers host collapses (e.g., ADO Task has no Resolved)
- Markdown-to-HTML conversion is applied at the boundary for HTML-flavored description fields
- Lifecycle completion metadata (`Completed By`, `Completed At`) is rendered into Story and Task description bodies at resolution; state-change audit lives in work-item comments tagged `[STRAP/agent:<name>]`
- Build and test commands come from project-profile.md's `Build and test` section (per active domain)

Invoke this skill when a Feature has been allocated to the current sprint by [`/plan-sprint`](../plan-sprint/SKILL.md) and the developer is ready to begin implementation. Use [`/refine-pr`](../refine-pr/SKILL.md) afterwards to address PR feedback.

## Owner

**dev-lead.** When the skill is invoked the orchestrator IS the dev-lead -- the skill does not delegate to a dev-lead sub-agent. Specialists are dispatched in parallel via `CreateTeam` for Task implementation (Phase 4) and serial-Task for review interactions and integration fix-ups.

## Inputs

- `$ARGUMENTS` -- the Feature work item identifier, optionally followed by mode flags in any order:
  - `stacked` -- branch from the developer's currently checked-out branch instead of `default_branch` from `code-connection.yaml`. PR targets the origin copy of that branch. Used for stacked-branch workflows where the Feature builds on top of in-flight work. Distinct from the Local Git connection-profile mode (`host: local-git`), which is a profile-level choice that affects PR ceremony, not branch target.
  - `draft` -- create the final PR in draft state (CI feedback only; not requesting review).
- `.claude/strap/contexts/project-profile.md` -- source of truth for active domains, their specialist rosters, stack particulars, and build/test commands.
- `.claude/strap/state/devops-connection.yaml` -- work-tracking connection profile. Required fields used by this skill: `mapping.work_item_types.{feature,story,task}.host_type`, `mapping.field_formats.description`, `mapping.states.{new,active,resolved,closed}`, `mapping.state_asymmetries` (consulted on collapse), `mapping.fields.{original_estimate,completed_work}`, `mapping.link_types.{predecessor,successor}`, `operation_templates.{work_item_read,work_item_update,work_item_comment_add}`.
- `.claude/strap/state/code-connection.yaml` -- source-control connection profile. Required fields: `host`, `host_url`, `default_branch`, `mapping.branch_prefix.{feature,task}`, `capabilities.{branch_create,branch_push,pull_request_create}`, `operation_templates.pull_request_create`.
- `.claude/strap/templates/work-items/story.template.md` and `task.template.md` -- description body templates used when re-rendering on resolution.

## Pre-flight

Three checks before any work begins:

1. **Both connection profiles exist.** If `devops-connection.yaml` is missing, redirect to `/connect-devops-project`. If `code-connection.yaml` is missing, redirect to `/connect-code-repo`. The pipeline cannot execute a sprint without both.
2. **Required environment for parallel agent teams.** The effective resolved env (across `~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json`) must carry `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and a valid `CLAUDE_CODE_SPAWN_BACKEND` (`auto`, `tmux`, or `in-process`). Phase 4 depends on `CreateTeam`. Missing or invalid values are typically a hand-edited `settings.json` -- surface an actionable error naming the offending layer and direct the CPO at re-running the installer.
3. **`git --version` succeeds.** Branch creation, worktree management, and (for remote profiles) push depend on git.

## Workflow

### Phase 1: Read the Feature and validate preconditions

1. Render `operation_templates.work_item_read` with `id=$ARGUMENTS` and execute via the connection profile's transport. Walk the host's parent/child links to fetch every Story under the Feature, then walk each Story's children to fetch every Task. Read `predecessor` / `successor` links between Tasks and between Stories via additional reads or `work_item_query` per the link mapping.

2. Read the linked Spec (via the `related` link from Feature to Spec) for implementation context and acceptance-criteria traceability. When the Spec references mockups AND the project-profile's `client-ui` domain entry declares mockup paths, list those files for the frontend specialist's brief.

3. Validate preconditions. Stop and recommend the named upstream skill when any check fails:
   - Feature logical state must be `active` or transition-eligible from `mapping.states.new`. If the host state is something else (e.g., `closed`), refuse.
   - The Feature must be assigned to the current developer, or the CPO has explicitly delegated execution.
   - Every Task must carry the `mapping.fields.original_estimate` value populated. If missing on any Task, recommend [`/decompose-feature`](../decompose-feature/SKILL.md).
   - Every Story and Task must have an iteration path set per `mapping.fields.iteration` (or the field declared for sprint allocation in the host). If missing, recommend [`/plan-sprint`](../plan-sprint/SKILL.md).
   - Every Task's domain (inferred from its parent Story's `linked_spec_section` or an explicit domain hint in the Task body) must correspond to a `Status: active` entry in `project-profile.md`'s `Domains` section. On polyrepo umbrellas, the domain must be active in the Task's target sub-repo's `Active domains` (per the Task's `sub_repo` field). If any domain is missing for its scope, recommend re-running [`/decompose-feature`](../decompose-feature/SKILL.md) so the activation gate runs cleanly -- do NOT open the activation gate inline (mid-execution activation introduces unreviewed specialist context into an in-flight Feature).

4. **Polyrepo routing classification.** Read `project-profile.md` for the `Sub-repos` section + schema sentinel. The classification determines whether downstream phases operate in single-sub-repo mode (one REPO_ROOT, one team, one PR) or coordinated mode (N REPO_ROOTs, N teams, N PRs with cluster manifest).
   - **Single-repo umbrellas** (no `Sub-repos` section, or empty): Tasks have no `sub_repo` field; the entire skill operates against the single repo at the install root. Proceed with the existing single-repo flow.
   - **Polyrepo umbrellas**: read each Task's `sub_repo` field via the connection profile's `mapping.fields.sub_repo` resolver (Feature 1 schema -- custom_field / label_prefix / yaml_field / unsupported). Compute the unique set of sub-repo slugs across all Tasks:
     - **Single-sub-repo Feature** (all Tasks share one slug, or all `sub_repo` values are null): single-sub-repo routing. Capture the slug as `target_sub_repo` execution-plan state. Phase 3 creates one feature branch in that sub-repo; Phase 4 creates one team scoped to it; Phase 6 opens one PR. The Feature executes hands-off against `<umbrella>/<sub-repo-path>` as REPO_ROOT.
     - **Cross-sub-repo Feature** (Tasks reference 2+ distinct slugs): coordinated mode. The Feature executes across all affected sub-repos in this single `/execute-sprint` invocation. Capture the set of affected sub-repo slugs as `coordinated_sub_repos` execution-plan state for downstream phases:
       - Phase 2 step 3 renders per-sub-repo Task waves and seeks one CPO approval covering the cluster.
       - Phase 3 loops over `coordinated_sub_repos` creating N feature branches under per-sub-repo connection-profile overrides where present (Feature 3 schema).
       - Phase 4 step 1 dispatches N teams sequentially (one per sub-repo) per the worktree mechanics protocol; teams operate in parallel after creation.
       - Phase 4 steps 2-4 run wave dispatch + Task review + per-sub-repo build/test against each sub-repo's team and feature branch.
       - Phase 5 walks AC across all N sub-repos' merged feature branches; an AC may map to implementing files in one sub-repo and asserting tests in another.
       - Phase 6 opens N coordinated PRs with cluster-manifest marker in each PR body (two-step open + update for sibling references).
       - Phase 7 transitions the Feature with an audit comment listing all N PR ids.

       Worktree mechanics: the umbrella root is NOT a git repo; per-sub-repo `Set-Location` (absolute path) precedes every git command and `CreateTeam` invocation, per the v2.3.8 absolute-path discipline. Coordinated mode supersedes the single-sub-repo flow exclusively when 2+ slugs are present; single-sub-repo Features always use the single-sub-repo path above.
     - **Unsupported sub_repo storage** (connection-profile declares `host_storage: unsupported`): degrade gracefully. Tasks cannot carry `sub_repo`; CPO must specify the target sub-repo for this run inline. Prompt accordingly. Only single-sub-repo mode is reachable on hosts with unsupported sub_repo storage -- coordinated mode requires the per-Task `sub_repo` field to route correctly.

5. **Re-derive cross-sub-repo dependency graph (coordinated mode only; v2.4 Feature 6).** When step 4 captured `coordinated_sub_repos`, reconstitute the F6 dependency graph that /decompose-feature established in Story 6.1. Re-derivation is the canonical pattern (per the v2.4 Phase 3 plan: no separate persistence on the Feature; the graph is reconstituted from stable inputs each invocation).

   Three input sources, mirroring /decompose-feature Phase 6 step 1b:

   - **Static (Sub-repos `depends_on[]`):** read each affected sub-repo's `depends_on:` field from `project-profile.md`'s `## Sub-repos` section. Build the per-sub-repo adjacency list.
   - **Spec-traced:** read the Feature's linked Spec via `operation_templates.work_item_read`; parse Constituent Part section bodies using the same dependency-phrase patterns documented in /decompose-feature Phase 1 step 5 (explicit references, inheritance phrases; anti-patterns suppressed). Cross-sub-repo subset of the parsed graph feeds this source.
   - **Specialist-authored:** read each Story's description via `operation_templates.work_item_read`; extract the `## Cross-sub-repo dependencies` section that /decompose-feature Phase 8 writes when a Story participates in a cross-sub-repo edge. Parse the listed upstream + downstream + reason entries.

   Union the three sources with edge deduplication (same edge from multiple sources is one edge). Run Kahn's algorithm to compute `cluster_merge_order` -- a per-sub-repo ordering tuple: `[(sub-repo-slug, position-N-of-total), ...]`. Empty graph (independent sub-repos) produces a sentinel `cluster_merge_order = parallel` rendered as `merge-order=parallel-of-<total>` in downstream cluster manifests.

   **Cycle detection.** If Kahn's algorithm halts with edges remaining, surface the cycle path to the CPO and stop. Cycles at this layer are unusual -- /decompose-feature Phase 6 step 1c should have caught them. If a cycle appears here, the inputs have drifted between decomposition and execution (Sub-repos schema edited, Spec amended, Story descriptions hand-edited) -- recommend the CPO re-run `/decompose-feature` after aligning the inputs.

   Carry `cluster_merge_order` forward to Phase 2 step 3 (rendering), Phase 6 step 1 (PR open order), and Phase 6 step 2 (cluster-manifest marker `merge-order` field).

   Also carry the unioned per-sub-repo adjacency list (`f6_dependency_graph`) forward to Phase 4 step 4 + Phase 5 step 1 for **downstream test propagation** (v2.4 Feature 8 Story 8.2): the graph drives which downstream sub-repos must run tests when an upstream sub-repo changes, even when the downstream sub-repo's own code did not change. `cluster_merge_order` is the topological projection of the graph (positions only); `f6_dependency_graph` is the full edge set (`{<sub-repo>: [<upstream-sub-repos>], ...}`) needed for propagation lookup.

   Single-repo and single-sub-repo modes skip this step entirely; no cross-sub-repo edges exist.

### Phase 2: Build the execution plan and CPO approval

1. **Map every Task to a specialist.** For each Task:
   - Identify the canonical domain (from the parent Story's Spec section, the Task description, or an explicit domain field).
   - Look up the domain in `project-profile.md`'s `Domains` section; read the `Specialists` field.
   - When two or more specialists are listed for the domain (e.g., `designer, frontend-engineer` for `client-ui`), pick the implementation-owning specialist per the domain's convention (typically the engineer, not the designer). When ambiguous, surface to the CPO.
   - When no domain match exists, the Phase 1 precondition check should have already caught it -- if it slipped through, stop and surface.

2. **Build the dependency graph.** From Task and Story `predecessor` / `successor` links, topologically sort Tasks into waves:
   - **Wave 1**: Tasks with no predecessors.
   - **Wave N**: Tasks whose predecessors are all in waves 1..N-1.

3. **Present the execution plan to the CPO.** Rendering adapts to the Phase 1 step 4 classification:
   - **Single-repo or single-sub-repo modes**: Feature id and title; total Stories, Tasks, and estimated hours (summed from `original_estimate`); per-wave table of Tasks with target specialists, dependencies, and hours; the critical path (longest sequential chain); the source-control mode (default vs `stacked`) and base branch; the worktree root path.
   - **Coordinated mode**: cluster summary header -- "Feature spans `<N>` sub-repos: `<list>`. Total Stories: `<S>`. Total Tasks: `<T>`. Total estimated hours: `<H>`. Merge order: `<rendered merge order>`." The merge-order line comes from Phase 1 step 5's `cluster_merge_order` (Feature 6): "shared-lib (1st) -> web-frontend (2nd) -> api-backend (3rd)" when ordered, or "parallel (no cross-sub-repo dependencies)" when the sentinel is `parallel`. Then one section per sub-repo in `coordinated_sub_repos` rendered in merge-order sequence (upstream first): each section header includes the merge-order position ("[shared-lib] (Merge order: 1st)"); body covers REPO_ROOT (absolute `<umbrella>/<sub-repo-path>`); per-sub-repo base branch (resolved via per-sub-repo connection-profile overrides where present, falling through to umbrella defaults); worktree root sibling to that sub-repo's checkout; per-sub-repo wave table (Tasks, specialists, intra-sub-repo dependencies, hours); per-sub-repo critical path; upstream + downstream sub-repos within this Feature when cluster_merge_order has edges. Inter-sub-repo merge-order enforcement at PR-merge time is Feature 6 Story 6.3 (/refine-pr ordered merge-window enforcement); this skill SURFACES the order at plan time but does not block per-sub-repo work in waves -- work proceeds in parallel waves per-sub-repo per Phase 4.

   The CPO confirmation gate is a single approval covering the entire run (one approval whether single-mode or coordinated, never N approvals). Wait for CPO confirmation.

4. **On confirmation, transition the Feature to active.** If the Feature is in `mapping.states.new`, render `operation_templates.work_item_update` with `state` -> `mapping.states.active` (apply `strap:active` tag if the host state machine collapses per `mapping.state_asymmetries`). Post the state-change audit comment via `operation_templates.work_item_comment_add`:

   > `[STRAP/agent:dev-lead] State: new -> active (via /execute-sprint). Beginning <N>-wave execution of <M> Tasks across <K> Stories.`

### Phase 3: Create the feature branch and worktree root

Branch + worktree-root creation operates per REPO_ROOT. The Phase 1 step 4 classification dictates how many REPO_ROOTs Phase 3 walks:

- **Single-repo umbrellas**: one REPO_ROOT at the install root (the single git repo).
- **Single-sub-repo Features** (polyrepo umbrella, one slug in scope): one REPO_ROOT at `<umbrella>/<sub-repo-path>` (the `target_sub_repo` captured in Phase 1).
- **Coordinated mode**: N REPO_ROOTs, one per sub-repo in `coordinated_sub_repos`. Steps 1-5 below execute inside a loop over the N sub-repos; step 6 renders the consolidated summary after the loop completes.

For every REPO_ROOT the dev-lead enters in this phase, `Set-Location` (absolute path) precedes every git command, per the v2.3.8 universal absolute-path discipline. Polyrepo umbrella roots are NOT git repos; running `git` at the umbrella root will fail. CWD shifts only via explicit `Set-Location` calls -- never compound `cd <path> && <cmd>` invocations. In coordinated mode, `Set-Location` lands once per sub-repo at the head of each loop iteration; after step 5 the dev-lead returns to umbrella root via an explicit `Set-Location` before moving to Phase 4 (or to the next iteration's REPO_ROOT).

1. **Determine the base branch** for the current REPO_ROOT:
   - **Default mode**: base is `code-connection.yaml`'s `default_branch` on origin. PR target is the same branch. On polyrepo umbrellas with per-sub-repo connection-profile overrides (Feature 3 schema), this REPO_ROOT's per-sub-repo `default_branch` takes precedence over the umbrella default; otherwise umbrella defaults apply.
   - **`stacked` mode**: base is the developer's currently checked-out branch in this REPO_ROOT (`git rev-parse --abbrev-ref HEAD` run from REPO_ROOT). PR target is the origin copy of that branch. Verify a clean working tree (`git status --porcelain`); stop if uncommitted changes exist. In coordinated mode, `stacked` mode requires the stacked branch to exist in every affected sub-repo -- surface and stop if any sub-repo lacks it.
   - **Local Git profile** (`code-connection.yaml`'s `host: local-git`, or this REPO_ROOT's per-sub-repo override's `host: local-git`): same as default mode but no push; branch lives locally only. Phase 6's PR ceremony degrades per the profile's `operation_templates.pull_request_create.type: local-merge`.

2. **Render the feature branch name.** Combine `mapping.branch_prefix.feature` (e.g., `feature/`) with `<feature-id>-<slug>` where `<slug>` is derived from the Feature title (lowercase, hyphenated, alphanumerics only). Result example: `feature/12345-tenant-isolation-audit`. The rendered name is the same across all N sub-repos in coordinated mode -- per-sub-repo branches are NOT collision-prone because they live in different git repos. Identical naming makes the cluster trivially discoverable by name across sub-repos.

3. **Always create a fresh feature branch. Never reuse an existing branch.** If the rendered name exists locally or on origin (in this REPO_ROOT's git), append `-v2`; if that also exists, append a timestamp suffix. The collision check runs per REPO_ROOT; one sub-repo's collision does not force the others to use the suffix (cross-sub-repo branch-name divergence within the same Feature is acceptable and recorded in the Phase 3 summary).

4. **Create and push (or just create, for Local Git) the feature branch from this REPO_ROOT:**
   - `git checkout -b <branch-name> <base>`
   - For remote profiles: `git push -u origin <branch-name>`. In `stacked` mode, also push the local base branch to origin first if absent.
   - For Local Git profile: skip the push.

5. **Create the worktree root for this REPO_ROOT.** Path: `<repo-parent>/<repo-name>-worktrees/<feature-slug>/` where `<repo-name>` is REPO_ROOT's basename. The worktree root lives outside the main repo checkout so per-agent worktrees do not collide with the dev-lead's primary checkout. If project-profile.md's `Conventions` section declares a worktree-root override, use that instead. In coordinated mode, each sub-repo's worktree root is naturally sibling to that sub-repo's checkout, NOT the umbrella root -- the umbrella root holds no git repository and therefore no worktrees.

6. **Tell the CPO** the Phase 3 outcome. Rendering matches the classification:
   - **Single-repo or single-sub-repo modes**: the branch name, the PR target, REPO_ROOT (with explicit sub-repo callout on polyrepo umbrellas), the worktree root, and the wave count.
   - **Coordinated mode**: a consolidated block listing all N entries -- per sub-repo, the branch name, PR target, REPO_ROOT, worktree root, and wave count. Close with a one-line cluster summary: "Phase 3 complete. `<N>` feature branches created across `<N>` sub-repos; ready for Phase 4 team dispatch."

After Phase 3 the dev-lead returns to umbrella root (single `Set-Location`) before Phase 4 begins.

### Budget enforcement

Per [`budget-discipline.md`](../../strap/contexts/budget-discipline.md), `/execute-sprint` operates against two budgets pulled from `.claude/strap/state/usage.yaml` at workflow start. Defaults from `budget-discipline.md`'s defaults table: per-agent **500K**, session aggregate **2M**. The CPO can override via `/memory-refine dev-lead` (or, once `/revise-token-budget` ships, via that skill).

**Dispatch-time budget pull.** After Phase 3 completes (feature branch created, worktree root prepared) and before Phase 4 begins (specialist fan-out via `CreateTeam`):

1. Read `.claude/strap/state/usage.yaml`. Pull `budgets.execute-sprint.per_agent` and `budgets.execute-sprint.session_aggregate`. Also pull `budgets.execute-sprint.agent_overrides` if present -- per-agent overrides established via `/revise-token-budget --agent <name>` take precedence over the workflow default at dispatch-time per-agent resolution (see `budget-discipline.md` "Per-agent overrides"). If `usage.yaml` is missing (the `/strap-in` scaffold step should have created it), surface the gap and stop with a recommendation to run `/strap-in` or `/strap-refresh`.
2. Initialize the `session` block:
   - `session.workflow: execute-sprint`
   - `session.workflow_instance: execute-<feature-id>` (matches Phase 4's `CreateTeam` `team_name`)
   - `session.started_at: <ISO-8601 timestamp>`
   - `session.specialists_used: 0`
3. For every specialist that will be dispatched in this run (every Task's mapped specialist across all waves), reset `agents.<name>.used_in_current` to `0` (preserve `agents.<name>.last_dispatch`). Specialists not in this Feature's roster are left untouched.

**Per-agent budget in the dispatch brief.** Append a budget line to every specialist's wave-dispatch brief, mirroring `/strap-in` Section 6. The effective `<per-agent-budget>` value resolves per `budget-discipline.md` "Dispatch-time resolution": `agent_overrides.<name>.per_agent` if present, else `per_agent`:

> "Your budget for this dispatch is `<per-agent-budget>` tokens. Include `tokens_used: ~XXk` as the final line of your finishing summary."

This carries the per-agent budget into the specialist's awareness and enforces the self-reporting contract that token accounting depends on. Per the agent-devs team rule, every specialist already self-reports the line; the brief makes the budget for THIS dispatch explicit.

**Token accounting.** When each specialist's `SendMessage` finishing report returns at task-branch review time, parse the `tokens_used: ~XXk` line. Add to `agents.<name>.used_in_current`; sum into `session.specialists_used`. Update `agents.<name>.last_dispatch` to the dispatch's ISO timestamp. Persist after each specialist completes (not just at workflow end) so a session interruption preserves accurate state.

**60% session-aggregate checkpoint.** When `session.specialists_used` crosses 60% of the configured session aggregate (same threshold `/strap-in` Section 7 uses):

1. Surface to the CPO: "Specialists have consumed ~`<X>`K of the `<Y>`M session aggregate. Recommending checkpoint."
2. Run `/context-prep execute-sprint-<feature-id>` to capture in-flight workflow state (which Tasks are resolved, which are in-flight, which waves are pending, integration-audit state) in a continuation.
3. Instruct the CPO: "Run `/usage` to confirm your own window; then `/clear` and start a fresh session. On resume, run `/context-fetch execute-sprint-<feature-id>` first."
4. The CPO confirms or overrides. On override ("plenty of room, push through"), proceed and note the override in the continuation for future sessions to learn from.

Wave boundaries are natural checkpoint points: between waves, after synthesizing the wave's findings and running the centralized build-and-test pass, check whether `session.specialists_used` has crossed 60% and either launch the next wave or recommend a checkpoint.

**Per-agent exhaustion.** When `agents.<name>.used_in_current` reaches its per-agent budget for a specialist whose Tasks in this Feature are not yet complete:

- Do NOT redispatch that specialist within this workflow instance.
- Work with what the specialist already produced; review their landed Task work normally.
- Note the exhaustion under `agents.<name>` in `usage.yaml` (e.g., add `exhausted_at: <ISO-timestamp>` to the agent's entry).
- Surface to the CPO that the specialist exhausted its budget mid-Feature so they can decide whether to revise the per-agent budget for the next workflow instance via `/revise-token-budget`.

Per-agent budget is per-workflow-instance, not per-session. After a 60% checkpoint, the new session reads `agents.<name>.used_in_current` to know how much each specialist has left in this Feature's instance.

**Workflow-completion close-out.** At the end of Phase 7 (Clean up and resolve), after the Feature is transitioned to Resolved and the PR is opened:

- Write `session.completed_at: <ISO-8601 timestamp>` to `usage.yaml`.
- Preserve `agents.<name>.used_in_current` as the closing value -- it gets reset at the next workflow instance's dispatch-time budget pull.

**Per-skill tuning.** `/execute-sprint` runs the longest of the four budget-aware execution skills and is the most likely to hit the 60% checkpoint -- a multi-wave Feature commonly spans multiple sessions. The 2M session aggregate is the dominant constraint; the 500K per-agent rarely binds in a single specialist's wave dispatch but can bind across multiple wave dispatches for the same specialist over a long-running Feature. The skill does not implement directly; all Task work routes through specialists, so every dispatch contributes to the budget.

### Phase 4: Execute waves

1. **Create the agent team(s).** Phase 1 step 4 classification determines whether one team or N teams are created. Coming into Phase 4, the dev-lead is at umbrella root (returned from Phase 3 per the worktree mechanics protocol).
   - **Single-repo umbrellas**: umbrella root == install root == REPO_ROOT; the dev-lead is already at REPO_ROOT. Invoke `CreateTeam(team_name: "execute-<feature-id>")` -- one team for the whole Feature.
   - **Polyrepo umbrellas, single-sub-repo Feature**: `Set-Location` into `<umbrella>/<sub-repo-path>` (the `target_sub_repo`'s absolute path; one tool call). Invoke `CreateTeam(team_name: "execute-<feature-id>-<sub-repo-slug>")` -- one team scoped to the chosen sub-repo. The team inherits the dev-lead's CWD; its worktree operations naturally scope to that sub-repo's git.
   - **Coordinated mode** (N sub-repos): for each sub-repo slug in `coordinated_sub_repos`, in sequence:
     1. `Set-Location` into `<umbrella>/<sub-repo-path>` (absolute path; one tool call per sub-repo; never compound `cd ... && CreateTeam`).
     2. Invoke `CreateTeam(team_name: "execute-<feature-id>-<sub-repo-slug>")`. The team inherits the dev-lead's CWD; subsequent team-internal worktree operations scope to this sub-repo's git.

     Team creation MUST be sequential because the harness primitive `CreateTeam` inherits the dev-lead's CWD at invocation time, and the dev-lead has one CWD. After all N teams exist they operate in parallel; parallel work happens within team processes, supervised by the dev-lead via per-team `SendMessage` (Phase 4 step 2 onward). After the final team-creation iteration the dev-lead returns to umbrella root before proceeding.

   Spawned specialists appear as named, color-badged teammates regardless of mode.

2. **For each Task in the current wave** (dispatch all wave-N Tasks in a single batched message per team).

   **Coordinated-mode wave model**: each sub-repo's team operates on its own wave timeline. Wave N for sub-repo A is independent of wave N for sub-repo B; the dev-lead supervises N concurrent wave streams. Cross-sub-repo wave coordination (sub-repo B's wave N+1 waiting on sub-repo A's wave N) is Feature 6 in the v2.4 Epic; for /execute-sprint without Feature 6, intra-sub-repo dependencies are the only blocking constraint within a Feature. Per-sub-repo waves can complete at different cadences -- the dev-lead may be reviewing sub-repo A's wave 2 returns while sub-repo B's wave 1 is still mid-dispatch.

   For every Task in the current wave (routed to its sub-repo's team in coordinated mode; the single team otherwise):
   - Create a per-agent worktree under the appropriate feature worktree root:
     - Path: `<feature-worktree-root>/<specialist-name>-<task-id>`. In coordinated mode, `<feature-worktree-root>` is the worktree root for THIS Task's sub-repo (Phase 3 created one per sub-repo); in single-sub-repo and single-repo modes, it is the one worktree root.
     - `git worktree add --detach <path> <feature-branch>` runs from the appropriate REPO_ROOT (each sub-repo's git carries its own feature branch with identical naming across the cluster). Detached HEAD is required because git refuses to check the same branch out in multiple worktrees, and the dev-lead holds it in the main checkout.
   - Transition the Task to `mapping.states.active` via `operation_templates.work_item_update` (apply `strap:active` tag if collapsed per `state_asymmetries`). When this is the first Task on its parent Story to start, transition the Story to `mapping.states.active` the same way. Post `[STRAP/agent:dev-lead]` state-change comments on both.
   - Dispatch the specialist into the appropriate team -- in coordinated mode, the team whose name matches `execute-<feature-id>-<sub_repo>` for this Task's `sub_repo` value; in single-sub-repo and single-repo modes, the one team. The brief includes:
     - The specialist's role contract path (`.claude/agents/agent-devs/<name>.md` or `agent-ops/<name>.md`).
     - The specialist's operating-context paths (its rules, memory, project-profile, and the active domain entry).
     - The work-item id and the work-item body (passed verbatim; the specialist reads it for AC and implementation guidance).
     - The assigned worktree path -- the specialist operates exclusively within that path and never touches the main repo checkout (or any sibling sub-repo in coordinated mode).
     - The task branch naming convention -- combine `mapping.branch_prefix.task` (e.g., `task/`) with `<task-id>-<slug>`. The specialist creates the task branch from inside the worktree.
     - The mandate to author tests per the centralized-test-execution rule: specialists WRITE tests; the dev-lead RUNS them. Specialists do not invoke the test suite themselves.
     - The mandate to commit with messages referencing the Task id and push the task branch (skip push for Local Git profile). The specialist does NOT merge into the feature branch -- the dev-lead reviews and merges.
     - The required `SendMessage` finishing report: what was implemented, files touched, tests written, deviations from the Task instructions, any blockers, and the `tokens_used: ~XXk` line. Per the agent-devs `SendMessage` rule, teammates must explicitly call `SendMessage` or the dev-lead waits indefinitely.

   **Substance retrieval after specialists go idle.** Idle-notification preview turns arrive as conversation turns, but full `SendMessage` bodies persist to disk at `~/.claude/teams/<team-name>/inboxes/dev-lead.json` rather than as conversation turns. In coordinated mode, each per-sub-repo team has its own inbox: `~/.claude/teams/<feature-id>-<sub-repo-slug>/inboxes/dev-lead.json`. Iterate each team's inbox to retrieve specialist substance before review (step 3). See dev-lead memory `operating_team_inbox_file_substance.md` for the full retrieval tradecraft.

3. **Review each completed task branch** as specialists return. In coordinated mode, the dev-lead supervises returns from N teams concurrently; review steps below operate against the sub-repo where the returning Task lives. Set-Location into the sub-repo's REPO_ROOT (absolute path) precedes every git command in this step; the dev-lead may shift CWD repeatedly across sub-repos as different teams' Tasks complete.
   - Fetch the task branch (or read directly from the worktree for Local Git) and check it out for review in a scratch location within REPO_ROOT for the Task's sub-repo.
   - Run the dev-lead Task Branch Review Checklist: acceptance criteria met, unit tests authored, no lint or build errors per the active domain's build command, no scope creep, multi-tenant isolation respected when project-profile.md declares multi-tenancy, mockup-as-contract fidelity verified when the `client-ui` domain entry declares mockup paths.
   - On rejection: `SendMessage` the specialist with specific fixes; wait for the updated push (or worktree commit).
   - On approval: merge into the feature branch from the main checkout (REPO_ROOT for this sub-repo in coordinated mode) via `git merge --no-ff <task-branch-ref>`. **Verify the merge succeeds before deleting the remote task branch.** A deleted remote task branch cannot be recovered.
   - After a successful merge, push the sub-repo's feature branch (remote profiles only; each sub-repo pushes independently to its own origin per its connection-profile resolution), delete the local and remote task branches in that sub-repo's git, and either remove the specialist's worktree (no further Tasks for this specialist in this sub-repo) or update it to the latest feature branch state (more Tasks pending in later waves for this sub-repo).
   - **Transition the Task to `mapping.states.resolved`** via `operation_templates.work_item_update`. In the same update, populate `mapping.fields.completed_work` with the actual hours per the specialist's report. Apply `strap:resolved` tag if the host state machine collapses (per `state_asymmetries`; e.g., ADO Task has no Resolved, so set the host to its nearest-equivalent state and apply `strap:resolved`).
   - **Set v2.2 completion metadata on the Task.** Parse the existing description's metadata table to preserve `authored_by` and `authored_at`. Re-render `task.template.md` with the existing creation values plus:
     - `completed_by` -> the implementing specialist's name (e.g., `backend-engineer`)
     - `completed_at` -> ISO-8601 timestamp at the moment of resolution
   - Convert markdown to HTML at the boundary if `mapping.field_formats.description` is `html`. Execute a second `operation_templates.work_item_update` with `id` and the revised `description`.
   - Post the audit comment: `[STRAP/agent:dev-lead] State: active -> resolved (via /execute-sprint). Merged from <task-branch-ref> into <feature-branch>. Completed By: <specialist>.`

4. **Between waves, run the centralized build-and-test step.** The dev-lead is the sole executor (per the agent-devs centralized-test-execution rule). Execution scope adapts to mode:
   - **Single-repo / single-sub-repo modes**: build per active-domain command (from project-profile.md's `Build and test` section -- e.g., backend build, frontend build for each domain that landed work in the wave); test per active-domain command (backend tests, frontend tests, integration tests).
   - **Coordinated mode**: group affected sub-repos by their `parallel_safe` field (per the Sub-repos schema; default `false`) into sequential and parallel batches, then execute in order (v2.4 Feature 8 Story 8.1):
     - **Sequential batch first**: sub-repos with `parallel_safe: false` (the schema default). Run one at a time in deterministic order (slug-alphabetical). For each, `Set-Location` into REPO_ROOT, execute `test_command` + `build_command`, capture per-sub-repo result, return to umbrella root.
     - **Parallel batch second (subprocess fan-out; v2.4 Feature 8 Story 8.1 T2)**: sub-repos with `parallel_safe: true` execute concurrently via the harness's `run_in_background` Bash primitive:
       1. For each parallel-safe sub-repo, `Set-Location` into its REPO_ROOT (absolute path). The Set-Location MUST land BEFORE the subprocess launches because subprocess CWD inherits the dev-lead's CWD at launch time.
       2. Invoke `test_command` (and `build_command` if applicable) as a background Bash process. Multiple background launches batch in a single message per the parallel-tool-call discipline.
       3. After all parallel-batch subprocesses are launched, the dev-lead does NOT poll -- the harness notifies on background completion. The dev-lead waits on completion notifications for all parallel-batch members before proceeding to aggregation.
       4. Per-sub-repo result capture: each subprocess's exit code + stdout (captured by `run_in_background`) maps to that sub-repo's pass/fail + diagnostic output.
       5. **Failure isolation**: one parallel-batch sub-repo's non-zero exit does NOT abort the other concurrent subprocesses. All complete, all results captured; the aggregation gate (Story 8.1 T3) decides cluster-wide pass/fail.
     - **Rationale for sequential-first**: parallel_safe=false sub-repos may have shared state (test databases, fixed ports, fixture conflicts) that runs cleanly when isolated but breaks if a concurrent subprocess is touching the same resources. Running them first ensures any non-parallel-safe sub-repo executes in a clean environment before the parallel fan-out introduces concurrent processes.
     - **Downstream propagation (Story 8.2)** layers on top: when the F6 dependency graph identifies upstream sub-repos in this wave's change set, downstream sub-repos' `test_command` runs even when downstream code didn't change. Compute the propagation set:

       1. **Source sub-repos**: the sub-repos with Task work in the current wave (the wave's change set).
       2. **Downstream sub-repos (transitive walk)**: from `f6_dependency_graph`, find every sub-repo whose `depends_on[]` (transitively) includes any source sub-repo. Walk depth-first; include all transitive descendants.
       3. **Propagation set**: union of (1) and (2). Each entry tagged with `source: true` (had Task work) or `source: false` (added by propagation).

       ```
       test_propagation_set = [
         {sub_repo: "shared-lib", source: true, batch: "sequential"},
         {sub_repo: "web-frontend", source: false, batch: "parallel"},     // added by propagation; depends on shared-lib
         {sub_repo: "api-backend", source: false, batch: "parallel"}       // added by propagation; depends on shared-lib
       ]
       ```

       The batch assignment (sequential vs parallel) applies the same Sub-repos `parallel_safe` field grouping to the FULL propagation set. Downstream sub-repos respect their own `parallel_safe` declaration. Independent clusters (`f6_dependency_graph` empty) skip propagation: `test_propagation_set` reduces to just the source sub-repos.

       **Execution discipline for propagated downstream sub-repos**:

       1. **`test_command` runs even when downstream code did not change.** The propagation rationale is exactly to catch version-pin / API-contract drift -- the downstream sub-repo's existing tests are the canary that detects upstream-introduced breakage.
       2. **Set-Location protocol applies per sub-repo regardless of source flag**: downstream sub-repos get the same per-iteration `Set-Location` into REPO_ROOT before their `test_command` launches (sequential batch) or before their subprocess launches (parallel batch).
       3. **Failed source tests do NOT cancel downstream propagation.** When a source sub-repo's tests fail, the downstream propagation still runs to surface any drift the failing source change introduced. All propagation-set members complete; aggregation captures the full picture.
     - **Aggregation gate (Story 8.1 T3 + Story 8.2 T3 propagation attribution)**: after sequential + parallel batches both complete, aggregate per-sub-repo results into one cluster-wide pass/fail with explicit propagation attribution:

       ```
       wave_test_result = {
         status: "pass" | "fail",
         per_sub_repo: [
           {sub_repo: "shared-lib", source: true, batch: "sequential", exit_code: 0, summary: "10 tests, 0 failures"},
           {sub_repo: "web-frontend", source: false, batch: "parallel", exit_code: 1, summary: "3 tests failed in shared-lib downstream propagation (head: 'auth.test.ts: should call ITokenIssuer')", propagated_from: ["shared-lib"]},
           {sub_repo: "api-backend", source: false, batch: "parallel", exit_code: 0, summary: "24 tests, 0 failures", propagated_from: ["shared-lib"]}
         ]
       }
       ```

       Aggregate `status: "pass"` only when every per-sub-repo entry has `exit_code == 0`. Any non-zero exit fails the cluster gate. Per-sub-repo `summary` captures the head and tail of stdout. The `source` flag (true for sub-repos with Task work this wave, false for propagation-added downstream sub-repos) and `propagated_from` (list of source sub-repos that triggered this downstream sub-repo's inclusion in the propagation set) make the attribution explicit for failure-dispatch routing.
   - When the aggregation gate fails (in any mode), dispatch the responsible specialist via serial `Task` to fix before proceeding to the next wave. Do not accumulate integration debt across waves. In coordinated mode, dispatch routing depends on the failing sub-repo's `source` flag:
     - **`source: true` failure** (sub-repo's own code change broke its own tests): dispatch into the failing sub-repo's team. Standard same-sub-repo fix.
     - **`source: false` failure** (downstream propagation surfaced a failure when the downstream code did NOT change): dispatch into the UPSTREAM sub-repo's team listed in `propagated_from`. The assumption is that upstream introduced the drift; downstream tests are the canary. The specialist's brief names the downstream test that failed (the canary signal), the upstream sub-repo that likely introduced the drift, and the head/tail summary. The CPO can override the dispatch routing at the resolution surface when the canary itself is wrong (downstream test is incorrect rather than catching a real drift).

5. **Story completion checkpoints.** When all Tasks under a Story are resolved AND the Story's acceptance-criteria subset is verified on the feature branch (or, in coordinated mode, on the sub-repo's feature branch). A Story's sub-repo is implicit from its Tasks' `sub_repo` values: by /decompose-feature's contract a Story groups Tasks that share a sub-repo, so the Story scopes naturally.
   - Render `operation_templates.work_item_update` to transition the Story to `mapping.states.resolved` (apply `strap:resolved` tag if needed).
   - Parse the existing description's `authored_by` / `authored_at`. Re-render `story.template.md` with those values preserved plus `completed_by` -> `dev-lead` (the dev-lead certifies the Story's AC) and `completed_at` -> ISO-8601 timestamp. Convert at the boundary and execute a second `work_item_update`.
   - Post `[STRAP/agent:dev-lead] State: active -> resolved (via /execute-sprint). All <N> Tasks merged; acceptance criteria <list> verified.` In coordinated mode, also name the sub-repo so the audit comment carries cluster context.

### Phase 5: Integration audit

When all Stories are resolved (across all sub-repos in coordinated mode), run the integration audit. Generic core + acceptance-criteria traceability. Per-stack discipline lives in the specialist's per-agent rules and was already enforced at task-review time.

1. **Generic core (always run).** Against the merged feature branch (in coordinated mode, against EACH sub-repo's merged feature branch). In coordinated mode, group affected sub-repos by `parallel_safe` per Phase 4 step 4's batching protocol (v2.4 Feature 8 Story 8.1):
   - **Sequential batch first**: parallel_safe=false sub-repos. For each, `Set-Location` into REPO_ROOT, execute `build_command` + `test_command`, capture results, return to umbrella root.
   - **Parallel batch second**: parallel_safe=true sub-repos. Run concurrently via subprocess fan-out (Story 8.1 T2). Per-sub-repo results captured as subprocess exit codes + stdout.
   - **Downstream propagation** layers on top (Story 8.2): the source set for the integration audit is ALL sub-repos in `coordinated_sub_repos` (every sub-repo that landed Feature work). Propagation extends the set with downstream sub-repos whose `f6_dependency_graph` upstream chain transitively touches any source sub-repo. Build `test_propagation_set` the same way as Phase 4 step 4 (source: true for coordinated_sub_repos members, source: false for propagation-added downstream sub-repos). At integration-audit time the propagation set typically equals the full umbrella graph rooted at coordinated_sub_repos -- catches version-pin / API-contract drift cluster-wide before Phase 6 opens PRs.
   - **Aggregation gate (Story 8.1 T3)** mirrors the Phase 4 step 4 structure: after sequential + parallel batches complete, build `audit_test_result` with per-sub-repo entries (sub_repo, batch, exit_code, summary). Aggregate `status: "pass"` only when every per-sub-repo entry exits 0. The aggregation gate gates Phase 6 PR opening -- a non-pass means Phase 5 re-runs after fixes land; Phase 6 stays blocked until the cluster-wide pass.
   - When the aggregation gate fails, dispatch the responsible specialist via serial `Task` (into the failing sub-repo's team in coordinated mode) to fix. Re-run Phase 5 from step 1 after fixes land.

2. **Acceptance-criteria walkthrough.** For every AC in the Spec, trace it through the merged code. In coordinated mode an AC may map to implementing files in one sub-repo and asserting tests in another (a canonical example: a shared-types AC whose implementation lives in `shared-types/` but whose end-to-end test lives in `web-frontend/`); trace each AC through ALL N sub-repos' merged feature branches and identify the contributions per sub-repo. Identify the implementing files (with sub-repo attribution) and the asserting test(s) (with sub-repo attribution); confirm both reach the AC. ACs that cannot be traced end-to-end across the cluster indicate a gap -- identify the missing Task or wiring and dispatch the responsible specialist via serial `Task` (into the appropriate sub-repo's team) to close. Cross-sub-repo gaps (where closing the AC requires work in 2+ sub-repos) may need multiple serial dispatches; gate Phase 6 on all such fixes landing.

3. **Compile and present results.** To the CPO: build status per domain (and per sub-repo in coordinated mode); test status per domain (and per sub-repo in coordinated mode); AC traceability matrix. In single modes the matrix is `AC-NNN -> implementing-file -> test-file`; in coordinated mode the matrix carries explicit per-sub-repo attribution -- `AC-NNN -> <sub-repo-A>:src/file.ts -> <sub-repo-B>:tests/integration.spec.ts` -- so cross-sub-repo AC ownership reads unambiguously. Include deviations from the Spec; any technical debt introduced. If any hard-gate check failed, the Feature is NOT ready for PR until fixed.

### Phase 6: PR preparation

**Cluster-manifest markers (coordinated mode).** Every PR in a coordinated-mode cluster is marked as a cluster member by TWO machine-detectable HTML-comment markers, set at different points in the cluster lifecycle:

- **PR-body marker** (set at step 2 open time; never modified). First line of the PR body. Identifies the PR as a cluster member and names its sub-repo + parent Feature, plus its position in the cluster's merge order (v2.4 Feature 6). Format:

  ```
  <!-- strap-pr-cluster: feature-id=<id> sub-repo=<slug> merge-order=<position>-of-<total> -->
  ```

  Fields: `<id>` is the parent Feature work-item id (numeric); `<slug>` is this PR's sub-repo slug (kebab-case; matches the Sub-repos schema in `project-profile.md`); `merge-order=<position>-of-<total>` is this PR's merge-order position from Phase 1 step 5's `cluster_merge_order` (e.g., `1-of-3`, `2-of-3`, `3-of-3`). Independent clusters (no F6 edges) use the sentinel `merge-order=parallel-of-<total>` -- signals "no required order". The marker is set once at PR open and never updated.

- **Cluster-summary comment marker** (posted in step 3 update pass after all N PRs are open). A top-level PR comment on each PR carrying the authoritative sibling list. Format of the comment's first line:

  ```
  <!-- strap-pr-cluster-summary: feature-id=<id> siblings=<comma-pr-ids> -->
  ```

  followed by a human-readable cluster summary in the comment body (sibling PR ids with sub-repo labels, link to the parent Feature). The siblings list is authoritative -- it includes ALL PRs in the cluster (including the PR the comment is posted on; `/refine-pr` filters self-references during cluster discovery).

The two-marker design uses only existing connection-profile capabilities (`pull_request_create` + `pull_request_post_comment`); no `pull_request_update` capability is required, so cluster behavior works on every connection profile that supports comment posting. PR-body markers render invisibly in Markdown viewers (GitHub, Azure Repos, Bitbucket Cloud).

Detection regexes (consumed by `/refine-pr` cluster discovery in Story 5.4 T1; Story 6.3 T1 extends the PR-body regex to also capture `merge-order`):

```
PR body:     <!--\s*strap-pr-cluster:\s*feature-id=(\d+)\s+sub-repo=([a-z0-9-]+)(?:\s+merge-order=([^\s>]+))?\s*-->
PR comment:  <!--\s*strap-pr-cluster-summary:\s*feature-id=(\d+)\s+siblings=([0-9,]+)\s*-->
```

The `merge-order` capture group is optional in the PR-body regex (backwards-compatible with pre-Feature-6 cluster markers; pre-F6 clusters degrade to `merge-order=parallel-of-<total>` semantics on parse).

`/refine-pr` discovery: body marker present -> cluster mode triggered, this PR's sub-repo and feature-id known; walk top-level PR comments newest-first looking for the summary marker -> sibling PR ids known. Either marker missing degrades to the linked-work-item walk fallback (Story 5.4 T1 belt-and-suspenders pattern).

Single-repo and single-sub-repo PRs do NOT carry either marker -- presence of the body marker is itself the cluster signal.

1. **Render the PR description(s).** Rendering adapts to mode.

   **Single-repo / single-sub-repo modes**: one PR description -- structured markdown body covering:
   - Feature id and title
   - Linked Spec id (with the `related` link)
   - Summary: one paragraph from the Feature description
   - Stories implemented (id + title list)
   - Acceptance criteria with traceability (AC id -> implementing files)
   - Test summary (counts by domain; any deviations from the centralized-test rule)
   - Closing token in the host's expected format (e.g., `Closes #<feature-id>` for GitHub, `Related: AB#<feature-id>` for Azure Repos paired with Azure DevOps)

   **Coordinated mode**: N PR descriptions, one per sub-repo in `coordinated_sub_repos`. Each carries:
   - PR-body cluster-manifest marker as the FIRST line (set once at open; never modified). Identifies the PR as a cluster member and names its sub-repo + parent Feature.
   - Per-PR title prefix `[<sub-repo-slug>] <feature-id>: <feature-title>` -- visible to reviewers in PR lists and indicates cluster membership at a glance.
   - Feature id and title.
   - Linked Spec id (with the `related` link).
   - Summary: one paragraph from the Feature description plus a cluster context note ("This PR is one of `<N>` coordinated PRs from Feature #`<id>`. A cluster-summary comment posted after all PRs open lists every sibling PR.").
   - Stories implemented in THIS sub-repo (id + title list; filtered to Stories whose Tasks live in this sub-repo).
   - Per-sub-repo AC subset with traceability (from the Phase 5 traceability matrix, filtered to ACs that have implementing files OR asserting tests in this sub-repo).
   - Test summary for THIS sub-repo's tests.
   - Closing token scoped to the Feature (all N PRs reference the same Feature; merging a single PR does not auto-resolve the Feature -- /dora-reconcile Pass A cascades only when all N PRs merge).

   Write each rendered description to its own temp file via the `Write` tool (per the agent-devs shell-environment rule, formatted descriptions never go through shell heredocs).

2. **Create the PR(s) via the source-control connection profile.** Execution adapts to mode.

   **Single-repo / single-sub-repo modes**: render `code-connection.yaml`'s `operation_templates.pull_request_create` with placeholders:
   - `{{source_branch}}` -> the feature branch name
   - `{{target_branch}}` -> default branch (default mode) or current branch (`stacked` mode)
   - `{{title}}` -> the Feature title
   - `{{description}}` -> the rendered description (read from the temp file)
   - `{{linked_work_items}}` -> the Feature id plus every child Story id. The source-control profile records the cross-link to the work-tracking host when they differ (per the agent-devs PR-creation rule on multi-adapter installs).
   - `{{draft}}` -> true when the `draft` flag was supplied.

   For Local Git profile: execute the `local-merge` step sequence (`git checkout <target>; git merge --no-ff <source> -m '<merge-message>'; git branch -d <source>`). Capture the resulting merge commit hash as the "PR identifier" for hand-off reporting.

   **Coordinated mode**: loop over each sub-repo in `coordinated_sub_repos` in sequence, ordered by `cluster_merge_order` from Phase 1 step 5 (upstream sub-repos first; reviewers see upstream PRs in their notification flow before downstream PRs). Independent clusters with `cluster_merge_order = parallel` iterate in any order (slug-alphabetical for determinism). For each iteration:
   1. `Set-Location` into the sub-repo's REPO_ROOT (absolute path).
   2. Resolve the per-sub-repo source-control connection profile (host, auth, branch_patterns, operation_templates) via the per-sub-repo `sub_repos.<slug>` overrides in `code-connection.yaml`, falling through to umbrella defaults.
   3. Render the body cluster-manifest marker with this sub-repo's merge-order position (e.g., `merge-order=1-of-3` for the upstream sub-repo, `merge-order=2-of-3` next, etc.; or `merge-order=parallel-of-<total>` when `cluster_merge_order` is the parallel sentinel). The rendered marker is the first line of the description body.
   4. Render `operation_templates.pull_request_create` with placeholders:
      - `{{source_branch}}` -> this sub-repo's feature branch name (same name as siblings, different git repo)
      - `{{target_branch}}` -> per-sub-repo default branch (or stacked target if applicable)
      - `{{title}}` -> the prefixed title `[<sub-repo-slug>] <feature-id>: <feature-title>`
      - `{{description}}` -> this sub-repo's rendered description with cluster-manifest body marker (read from temp file)
      - `{{linked_work_items}}` -> the Feature id plus the Stories whose Tasks live in this sub-repo
      - `{{draft}}` -> true when the `draft` flag was supplied (applies to ALL PRs in the cluster -- draft is a cluster-level choice).
   5. Execute via the connection profile's transport. Capture the new PR id/URL.

   After the loop, the cluster's PR id/URL collection feeds step 3 (cluster-summary comment posting).

   Local Git profile per sub-repo: execute the `local-merge` step sequence in each sub-repo's REPO_ROOT; capture each merge commit hash. The cluster manifest in the body becomes ineffective (no PR ids exist to reference); for Local Git clusters, `/refine-pr` cluster discovery degrades to linked-work-item walk only.

3. **Post the cluster-summary comments (coordinated mode only).** After step 2 opens all N PRs in the cluster, post a top-level summary comment on each PR carrying the authoritative sibling list. The body marker from step 2 identified each PR as a cluster member; this comment closes the discovery loop by naming the siblings.

   For each PR in the cluster:
   1. `Set-Location` into the corresponding sub-repo's REPO_ROOT.
   2. Resolve that sub-repo's source-control connection profile (`pull_request_post_comment` operation_template).
   3. Render the comment body, with the marker as the first line:

      ```
      <!-- strap-pr-cluster-summary: feature-id=<id> siblings=<comma-pr-ids> -->

      **Coordinated PR cluster.** Part of Feature #<id>. Merge order: <ordered or parallel>.

      Cluster PRs (in merge order):
      1. #<id-A> ([<sub-repo-A>])  -- merge first
      2. #<id-B> ([<sub-repo-B>])
      3. #<id-C> ([<sub-repo-C>])  -- merge last

      See Feature #<id> for full context.
      ```

      `siblings` lists ALL PR ids in the cluster (including this PR's own id; `/refine-pr` filters self-references during discovery). The human-readable list orders PRs by `cluster_merge_order` (upstream first; v2.4 Feature 6); each entry includes the sub-repo label and the relative merge-order position. For `cluster_merge_order = parallel`, render "Merge order: parallel (no cross-sub-repo dependencies)" and list PRs in slug-alphabetical order without merge-order annotations.

   4. Render `operation_templates.pull_request_post_comment` with:
      - `{{pr_id}}` -> this PR's id
      - `{{body}}` -> the rendered summary (read from a temp file written via the `Write` tool)
      - `{{thread_id}}` -> unset (this is a new top-level comment, not a reply)
      - `resolve_thread=false` (always; the no-resolve discipline applies even when /execute-sprint posts a top-level comment).

   Execute via the per-sub-repo connection profile's transport. Capture the comment id for the Phase 7 Feature audit comment.

   For Local Git profile sub-repos (no comment system, no PR id): the cluster-summary comment cannot be posted; cluster discovery for that sub-repo degrades to linked-work-item walk via /refine-pr's belt-and-suspenders fallback (documented in Story 5.4 T1). Hosts with `pull_request_post_comment: unsupported` in their connection profile degrade identically and the run continues -- the body marker alone still triggers /refine-pr cluster mode, just without the sibling list.

   Single-repo and single-sub-repo modes skip this step entirely (no cluster to summarize).

4. **Report the PR id(s) / URL(s) (or merge commit hashes for Local Git) to the CPO** for human review. In coordinated mode, the report opens with a cluster summary header ("Coordinated PR cluster opened: `<N>` PRs across sub-repos `<list>`. Cluster-summary comments posted on each PR.") and lists each PR with sub-repo attribution.

### Phase 7: Clean up and resolve

1. **Shut down the agent team(s).** In single-repo / single-sub-repo modes, `TeamDelete` removes the one execution team. In coordinated mode, loop over all N teams (named `execute-<feature-id>-<sub-repo-slug>` per Phase 4 step 1) and `TeamDelete` each. If any shutdown wedges (per the documented unreliability of teammate shutdown), recommend `/team-cleanup` as the recovery primitive -- the wedge does not block the remaining teardown work.

2. **Prune git worktrees and remove the Feature worktree root directory.** In single-repo / single-sub-repo modes, `git worktree prune` runs once against the one REPO_ROOT and the one feature worktree root is removed. In coordinated mode, loop over all N sub-repos: `Set-Location` into each sub-repo's REPO_ROOT, run `git worktree prune`, and remove that sub-repo's feature worktree root. Return to umbrella root after the loop.

3. **Transition the Feature to `mapping.states.resolved`** via `operation_templates.work_item_update`. Apply `strap:resolved` tag if the host state machine collapses. Parse the existing description's metadata block to preserve `authored_by` / `authored_at`. Re-render `feature.template.md` with:
   - `completed_by` -> `dev-lead (CPO-approved)`
   - `completed_at` -> ISO-8601 timestamp at the moment of PR creation

   Convert at the boundary and execute a second `work_item_update` with the revised description.

4. **Post the Feature audit comment.** Single-repo / single-sub-repo:

   > `[STRAP/agent:dev-lead] State: active -> resolved (via /execute-sprint). PR <id-or-merge-hash> opened against <target-branch>. Awaiting CPO merge to transition to closed.`

   Coordinated mode (N PRs):

   > `[STRAP/agent:dev-lead] State: active -> resolved (via /execute-sprint). Coordinated PR cluster opened across <N> sub-repos: <list of (sub-repo-slug, PR-id, target-branch) tuples>. Cluster-summary comments posted on each PR. Awaiting CPO merge of all <N> PRs to transition to closed.`

   The Feature transitions to `mapping.states.closed` only after all PRs in the cluster merge -- that transition is not part of this skill. /dora-reconcile Pass A handles the cascade once every PR merges.

## Outputs

- One or N pushed feature branches with all Tasks merged (or merge commits on per-sub-repo base branches for Local Git profiles). Single-repo / single-sub-repo modes produce one branch; coordinated mode produces N branches with identical naming across N sub-repos.
- One pull request OR an N-PR coordinated cluster, created via the source-control connection profile, linked to the Feature and its Stories (or, for Local Git, merge commit hashes for hand-off). Coordinated-mode PRs carry the body cluster-manifest marker; a cluster-summary comment with the authoritative sibling list is posted on each PR after the cluster opens.
- Every Task in `mapping.states.resolved` with `completed_work` populated and the v2.2 lifecycle metadata block populated (`Completed By: <specialist>`, `Completed At: <ts>`); `strap:resolved` tag where the host state machine collapses.
- Every Story in `mapping.states.resolved` with `Completed By: dev-lead` and `Completed At: <ts>` in the metadata block. In coordinated mode, each Story is scoped to one sub-repo.
- The Feature in `mapping.states.resolved` with `Completed By: dev-lead (CPO-approved)` and `Completed At: <ts>`, awaiting PR merge to transition to `closed`. In coordinated mode, the Feature transitions to closed only when ALL N PRs in the cluster merge.
- A `[STRAP/agent:dev-lead]` state-change comment on the Feature and on every Story / Task that transitioned during the run.
- Worktrees pruned in every affected REPO_ROOT (one in single modes; N in coordinated mode); the agent team(s) deleted (one in single modes; N in coordinated mode).
- `.claude/strap/state/usage.yaml` updated with `session.completed_at`, the final per-agent `used_in_current` values, and any `exhausted_at` markers from specialists that hit their per-agent budget mid-workflow.

## Quality gates

The skill is successful when all of the following hold:

- Both connection profiles (`devops-connection.yaml` and `code-connection.yaml`) were present and validated at pre-flight; in coordinated mode, every affected sub-repo's per-sub-repo overrides resolved cleanly.
- Every required feature branch was created fresh, never reused (one branch in single modes; N branches with identical naming across N sub-repos in coordinated mode).
- Every Task was merged through dev-lead review; no specialist merged its own work.
- The centralized build-and-test step passed after the final wave and again at the Phase 5 integration audit -- per-feature-branch in single modes; per-sub-repo-feature-branch in coordinated mode.
- Every Spec AC was traced end-to-end through the merged code; in coordinated mode the traceability matrix carries per-sub-repo attribution.
- Every persisted state transition carries a `[STRAP/agent:dev-lead]` comment via `operation_templates.work_item_comment_add`.
- Every Story and Task description carries the v2.2 lifecycle metadata block with `Completed By` and `Completed At` populated at resolution; the existing `Authored By` / `Authored At` from `/decompose-feature` were preserved.
- Markdown-to-HTML conversion was applied for HTML-flavored description fields (no raw markdown reached an HTML-flavored host).
- The `strap:<logical-state>` tag was applied at each transition where the host state machine collapses per `mapping.state_asymmetries`.
- The PR(s) were created via the appropriate `operation_templates.pull_request_create` (or the local-merge ceremony for Local Git profile), linked to the Feature. In coordinated mode, every PR carries the body cluster-manifest marker, and a cluster-summary comment was posted on each PR after the cluster opened (skipped only on Local Git profile sub-repos or hosts with `pull_request_post_comment: unsupported`).
- `tokens_used: ~XXk` reporting was captured for every specialist dispatch (or its absence noted as a budget-tracking warning per Failure handling).
- The session aggregate stayed within budget OR the 60% checkpoint was offered to the CPO when crossed.
- Requires the effective resolved env to carry `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and a valid `CLAUDE_CODE_SPAWN_BACKEND`. Phase 4's `CreateTeam` (one team in single modes; N sequential CreateTeams in coordinated mode) depends on it.

## Failure handling

- **Either connection profile missing**: stop. Recommend `/connect-devops-project` or `/connect-code-repo` per the gap.
- **The Feature is not allocated to the current sprint**: stop. Recommend `/plan-sprint <feature-id>`.
- **Any Task lacks `original_estimate` or an iteration path**: stop. Recommend `/decompose-feature` (estimates) or `/plan-sprint` (allocation).
- **Any Task's domain is not active in project-profile.md**: stop. Recommend re-running `/decompose-feature <feature-id>` so the activation gate runs cleanly. Do NOT open the activation gate inline.
- **The CPO declines the execution plan**: stop; no branch is created; no state transitions land.
- **Branch creation fails** (collision or push rejection): retry with the `-v2` / timestamp suffix per Phase 3 step 3; on persistent failure, surface the host error verbatim and stop.
- **`operation_templates` rendering produces malformed requests**: surface the failing template path and request body; do not execute the malformed call.
- **HTML conversion fails for a description body**: surface the offending content; do not post raw markdown into an HTML-flavored field.
- **A specialist times out or errors during a wave**: continue with the others in the wave; flag the gap when collecting reports; re-dispatch the missing specialist via serial `Task` before reviewing.
- **A specialist fails to call `SendMessage` and the dev-lead is left waiting**: per the dev-lead guardrails, treat extended silence as a wedged teammate; recover via `/team-cleanup`.
- **A merge fails**: the dev-lead retries; the remote task branch is NOT deleted until the merge succeeds.
- **The centralized build or test pass fails between waves or at the Phase 5 audit**: dispatch the responsible specialist via serial `Task` to fix. The PR is not created until everything passes.
- **An AC cannot be traced end-to-end at the Phase 5 walkthrough**: identify the gap; dispatch the responsible specialist via serial `Task`. The PR is not created until every AC traces cleanly.
- **`pull_request_create` is unsupported by the source-control profile** (e.g., a remote host that declared the capability `unsupported`): stop and surface the gap; the Feature stays in `active` with all work merged on the feature branch; the CPO opens the PR manually using the host's UI. In coordinated mode, this gate runs per-sub-repo; if any one sub-repo's profile declares unsupported, the entire run stops at Phase 6 step 2 before opening any PRs (no half-cluster outcomes).
- **Coordinated mode: a sub-repo's `pull_request_create` succeeds for some PRs but fails for others mid-cluster**: roll-forward. Preserve the successful PRs, capture their ids/URLs, surface the gap to the CPO with the per-sub-repo failure detail. Skip the cluster-summary comment post (the cluster is incomplete); recommend the CPO open the failed sub-repo's PR manually and re-invoke `/refine-pr <pr-id>` per the resulting cluster, OR delete the affected feature branch and re-run `/execute-sprint` against the failed sub-repo's Tasks. Roll-back across already-opened PRs is NOT performed automatically -- closing a successful PR is destructive enough to warrant CPO intervention.
- **Coordinated mode: `pull_request_post_comment` fails for one or more PRs in step 3 after step 2 succeeded**: surface the per-PR failure; the cluster body markers still trigger cluster mode in `/refine-pr` so discovery degrades to linked-work-item walk for affected PRs. The run continues; the failure is a quality-of-discovery hit, not a correctness hit.
- **`CreateTeam` fails at Phase 4 (env keys missing or invalid)**: surface the actionable error naming the offending settings layer; direct the CPO at re-running the installer.
- **A specialist returns without the `tokens_used: ~XXk` line**: treat as a budget-tracking warning; the run continues but the dev-lead estimates that specialist's consumption manually and notes the gap under `agents.<name>` in `usage.yaml`.
- **A specialist exhausts its per-agent budget mid-workflow**: do not redispatch within this workflow instance; work with what the specialist produced; surface the exhaustion to the CPO so the budget can be revised via `/revise-token-budget` for the next instance.
- **`.claude/strap/state/usage.yaml` missing**: surface the gap; the install scaffold step in `/strap-in` should have created it. Recommend re-running `/strap-in` or `/strap-refresh` to restore the file before proceeding.

## References

- Source Feature: `$ARGUMENTS` (logical type `feature`).
- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- dev-lead guardrails: [`../../strap/rules/agents/dev-lead.md`](../../strap/rules/agents/dev-lead.md).
- agent-devs team rules: [`../../strap/rules/agent-devs.md`](../../strap/rules/agent-devs.md) -- centralized test execution, work-item creation standards, PR creation rule, `SendMessage` discipline.
- Project profile (active domains + specialists + build/test): [`../../strap/contexts/project-profile.md`](../../strap/contexts/project-profile.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Source-control connection profile: `.claude/strap/state/code-connection.yaml`.
- Story / Task templates: `.claude/strap/templates/work-items/story.template.md`, `.claude/strap/templates/work-items/task.template.md`, `.claude/strap/templates/work-items/feature.template.md`.
- Upstream skills: [`../decompose-feature/SKILL.md`](../decompose-feature/SKILL.md), [`../plan-sprint/SKILL.md`](../plan-sprint/SKILL.md).
- Downstream skills:
  - [`../refine-pr/SKILL.md`](../refine-pr/SKILL.md) -- address reviewer feedback on the resulting PR.
  - [`../dora-reconcile/SKILL.md`](../dora-reconcile/SKILL.md) -- daily Pass A cascade lands when child Stories' Tasks all reach Resolved; landed PR merge cascades the Feature to Resolved on the next reconcile run.
  - [`../close-ceremony/SKILL.md`](../close-ceremony/SKILL.md) -- the CPO ritual that takes the Feature from Resolved to Closed (the value-acceptance gate that `/execute-sprint` defers per the v2.2 state convention).
- Onboarding design (connection-discovery model + profile shape): [`../../strap/contexts/onboarding-design.md`](../../strap/contexts/onboarding-design.md).
- Budget discipline (cross-cutting): [`../../strap/contexts/budget-discipline.md`](../../strap/contexts/budget-discipline.md).
- Connection-profile schema source-of-truth: [`../connect-devops-project/SKILL.md`](../connect-devops-project/SKILL.md), [`../connect-code-repo/SKILL.md`](../connect-code-repo/SKILL.md).
- Recovery primitive for wedged teammates: [`../team-cleanup/SKILL.md`](../team-cleanup/SKILL.md).
