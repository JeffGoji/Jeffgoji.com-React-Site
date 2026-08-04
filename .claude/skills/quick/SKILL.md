---
name: /quick
description: Single-motion CPO orchestration lever. Free-form description through classification, work-item chain creation, specialist routing, implementation, centralized test pass, and draft PR -- in one invocation. Dev-lead classifies, the CPO approves at a hard gate, the dev-lead persists with v2.2 lifecycle metadata and routes to active-domain specialists via the configured connection profiles. Adapts the chain shape to the ask; never refuses for size.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
argument-hint: "<description>" [--under <id>] [--into <branch>] [--mockup | --investigation] [--stacked] [--draft]
---

# /quick

## Purpose

The CPO has a unit of work that needs to happen now. `/quick` is the single-motion lever: free-form description in, draft PR (or amended PR, or investigation report) out -- one invocation, full hygiene.

`/quick` bypasses the deliberate Requirement -> Spec -> Feature -> Decompose -> Sprint ceremony for work that doesn't need it: a one-line bug fix, a small enhancement, a refactor without behavior change, a doc update, a test-coverage addition, a mockup POC, an investigation spike. The dev-lead classifies the ask, creates the appropriate work-item chain, routes to the right specialist(s), implements, runs the centralized build-and-test, and prepares the PR.

`/quick` never refuses for size. If the ask is bigger than a single Task, the chain adapts: Story+Task under an existing parent, or Feature+Story+Task for new scope. If the ask is a defect, the chain is a single Bug (atomic, matching the `/file-bugs` + `/fix-bugs` convention; no child Task). The skill is the "do now" lever, not the "deliberate plan" lever -- when the CPO needs the latter, `/new-requirement` is the entry point.

The skill ships portable. Every adopter-specific concern resolves at runtime:

- Work-tracking operations render through `operation_templates.<op>` in `.claude/strap/state/devops-connection.yaml`
- Branch and PR operations render through `operation_templates.<op>` in `.claude/strap/state/code-connection.yaml`
- Type, state, field, link, and parent mappings come from `mapping.*` in both profiles; `state_asymmetries` covers host collapses
- Markdown-to-HTML conversion is applied at the boundary for HTML-flavored description fields
- Lifecycle metadata (`Authored By`, `Authored At`) is rendered into work-item descriptions at creation; completion metadata (`Completed By`, `Completed At`) is rendered at resolution; state-change audit lives in work-item comments tagged `[STRAP/agent:<name>]`
- Build and test commands come from project-profile.md's `Build and test` section (per active domain)
- Specialist routing per project-profile.md's `Domains` section

## Owner

**dev-lead.** When the skill is invoked the orchestrator IS the dev-lead. Specialists are dispatched in parallel via `CreateTeam` for multi-domain non-conflicting work, serial via `Task` for single-domain or dependent work. For trivial single-file changes that fit the dev-lead's role contract (small fixes, one-line edits, doc tweaks) and clearly map to one domain, the dev-lead may implement directly without a specialist spawn.

## Inputs

- `$ARGUMENTS` -- a quoted free-form description followed by flags in any order. Required. Example: `"add a tenant-id filter to the audit log view" --under 12345 --stacked`.
- Recognized flags:
  - `--under <work-item-id>` -- create the new chain as a child of the named parent. Parent must be in an open state (`new` or `active`); the parent's logical type determines which child shapes are legal (see Phase 3).
  - `--into <branch>` -- append commits to an existing branch instead of creating a new branch. The named branch must be ahead-only versus `default_branch` (no divergence, no merge conflicts). Takes a branch name (not a PR id); if a PR id is supplied, `/quick` refuses and asks for the branch name.
  - `--mockup` -- force the designer-only path. Use when the description sounds code-y but the CPO wants a pure visual POC. Mutually exclusive with `--investigation`. NOT the same as the gated `/create-mockups` flow that runs as the pre-decomposition step for a Resolved Spec; this flag is a lightweight POC path that produces an Enhancement tagged `poc; mockup`.
  - `--investigation` -- produce a markdown report at `.claude/strap/investigations/<task-id>-<slug>.md` instead of code. No PR; the Task closes when the report lands. Mutually exclusive with `--mockup`.
  - `--stacked` -- branch from the developer's currently checked-out branch instead of `default_branch`. PR targets the origin copy of that branch. Used when this work builds on top of in-flight changes. Distinct from the Local Git connection-profile mode.
  - `--draft` -- create the final pull request as a draft. Default behavior when no flag combination clearly implies otherwise.
- `.claude/strap/contexts/project-profile.md` -- source of truth for active domains, their specialist rosters, build/test commands, and `client-ui` domain entry (consulted for `--mockup` path resolution).
- `.claude/strap/state/devops-connection.yaml` -- work-tracking connection profile. Required fields used by this skill: `mapping.work_item_types.{bug,enhancement,feature,story,task}.host_type`, `mapping.field_formats.description`, `mapping.states.{new,active,resolved}`, `mapping.state_asymmetries`, `mapping.fields.{severity,environment,original_estimate,completed_work,assigned_to}`, `mapping.default_parents.{feature,bug}`, `mapping.link_types.{parent,related}`, `operation_templates.{work_item_create,work_item_read,work_item_update,work_item_comment_add,work_item_link_add,work_item_query,iteration_list}`.
- `.claude/strap/state/code-connection.yaml` -- source-control connection profile. Required fields: `host`, `host_url`, `default_branch`, `mapping.branch_prefix.{fix,feature}`, `capabilities.{branch_create,branch_push,pull_request_create}`, `operation_templates.pull_request_create`. Optional: `mapping.branch_prefix.quick` (default `quick/` when not declared).
- `.claude/strap/templates/work-items/{bug,enhancement,feature,story,task}.template.md` -- description body templates consumed per chain shape.

## Pre-flight

1. **Both connection profiles exist.** If `devops-connection.yaml` is missing, redirect to `/connect-devops-project`. If `code-connection.yaml` is missing, redirect to `/connect-code-repo`.
2. **`git --version` succeeds.** Branch operations depend on git.
3. **Validate flag combinations.** `--mockup` and `--investigation` are mutually exclusive -- refuse with a clear message if both are present. `--under` and `--into` can combine. `--stacked` and `--into` are mutually exclusive (one branches from the current HEAD, the other targets a named existing branch).
4. **Resolve `--under <id>` when present.** Render `operation_templates.work_item_read` for the parent. Validate:
   - Parent exists.
   - Parent state is `mapping.states.new` or `mapping.states.active`. Refuse with the current state if `resolved`, `closed`, or `removed`.
   - Parent's logical type informs which child shapes are legal: Feature/Enhancement -> Story or Task; Story -> Task. Refuse if the parent type cannot accept any child the description shape implies.
5. **Resolve `--into <branch>` when present.** The flag takes a branch name (not a PR id; if the CPO supplies a PR id, refuse with `pass the branch name from PR #<id>` so the dev-lead never depends on a PR-resolution operation that the source-control profile may not expose). Validate:
   - Branch exists locally or fetches cleanly (`git fetch origin <branch>`).
   - Branch is not divergent from `default_branch` (`git merge-tree origin/<default> <branch>` clean). Refuse with `bring branch up to date with <default-branch> first` instruction on divergence.
   - No uncommitted changes in the working tree (`git status --porcelain` empty).
6. **Resolve the current iteration.** When `capabilities.iteration_list: supported`, render `operation_templates.iteration_list` and identify the current iteration. The created work items default to the current sprint -- `/quick` always allocates current sprint (never deferred). When `iteration_list` is unsupported, items are filed without iteration assignment and the CPO may allocate later via `/plan-sprint`.
7. **Required environment for parallel agent teams (when fan-out is in scope).** When the classification implies two or more specialists will fan out, the effective resolved env must carry `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and a valid `CLAUDE_CODE_SPAWN_BACKEND` (`auto`, `tmux`, or `in-process`). Single-specialist runs do not require these. Surface an actionable error if missing.

## Workflow

### Phase 1: Classification

The dev-lead reads the description and produces a classification report. This is dev-lead-internal reasoning -- no spec-lead dispatch, no codebase investigation pass. `/quick` trusts the CPO's framing; deeper investigation is what `/new-requirement` or `/file-bugs` exists for.

The dev-lead resolves:

1. **Item shape**, by applying the decision tree:
   - Description sounds like a defect ("X is broken", "Y doesn't work", "Z throws", "fix the regression in...") AND `--under` is absent -> **Bug** (single atomic item; matches the `/file-bugs` + `/fix-bugs` convention where Bug IS the work unit, not a parent for child Tasks).
   - `--under <feature-or-enhancement-id>` AND the work is multi-step or cross-file -> **Story + Task** under the named parent.
   - `--under <feature-or-enhancement-id>` AND the work is single-step in one file -> **Task** under the named parent.
   - `--under <story-id>` -> **Task** under the named parent.
   - No `--under`, ask is new feature scope (multi-Story work) -> **Feature + Story + Task**.
   - No `--under`, ask is small incremental work -> **Enhancement + Story + Task**.
   - `--investigation` -> **Enhancement + Task** (tagged `investigation`).
   - `--mockup` -> **Enhancement + Task** (tagged `poc; mockup`).

   Note: `--under <bug-id>` is not supported. Bugs are atomic in STRAP v2.2; an "additional iteration on an existing Bug" is handled by re-opening the Bug via `/fix-bugs` if not yet Resolved, or by filing a new Bug via `/quick "<description>"` if the original Bug was Resolved but issues remain.

2. **Polyrepo sub-repo classification (polyrepo umbrellas only).** Read `project-profile.md` for the `Sub-repos` section + schema sentinel.
   - **Single-repo umbrellas** (no `Sub-repos` section, or empty): skip this step. Items are created without `sub_repo`; the chain executes against the single repo.
   - **Polyrepo umbrellas**: identify the target sub-repo by matching the free-form description against each sub-repo's schema fields. Score each sub-repo against the description on these signals:
     - **Explicit sub-repo name in description** (e.g., "in web-frontend, fix..." or "the api-backend should..."): definitive match -- skip scoring; use the named slug.
     - **Keyword match against `Role`** (one-line description): strong signal. The description's nouns and verbs match the sub-repo's purpose text.
     - **Keyword match against `Active domains`** (e.g., "frontend" / "client" / "UI" matches a sub-repo with `frontend-engineer` in active_domains; "API" / "endpoint" / "backend" matches one with `backend-engineer`).
     - **Path / language hints** (e.g., "TypeScript" or ".tsx" matches sub-repo with `primary_language: typescript`; "controller" or ".cs" matches one with primary_language csharp).
   - **Resolution**:
     - **One clear winner** (top score is at least 3x the runner-up): proceed silently; the chosen sub-repo surfaces in the Phase 2 confirmation summary.
     - **Ambiguous** (no strong winner, or top two within 30% of each other): prompt the CPO via `AskUserQuestion` with the ranked candidates + a `Other / specify manually` option. The CPO picks; chosen sub-repo carries into Phase 3 persistence.
     - **Description implies cross-sub-repo work** (e.g., "add a new shared type AND wire the frontend to use it"): surface to the CPO that cross-sub-repo work is better filed via `/new-requirement` for the structured Requirement -> Spec -> decomposed Feature flow (which produces multi-slug Constituent Parts and correct cross-sub-repo Task tagging). Offer to either restrict the `/quick` invocation to one sub-repo OR cancel and recommend `/new-requirement`.
   - The chosen sub-repo slug (or null for single-repo umbrellas) is carried into Phase 3's persistence step where every work item in the chain inherits it via the connection profile's `mapping.fields.sub_repo`.

3. **Domain layer(s)** by mapping the described change to project-profile.md's `Domains` section (single-repo) or to the chosen sub-repo's `Active domains` (polyrepo). Single-domain Tasks dispatch via `Task`; multi-domain non-conflicting Tasks dispatch via `CreateTeam`.

4. **Primary specialist** and **secondary specialist(s)** per the domain mapping. For `--mockup`: primary is `designer`, no domain code agents. For `--investigation`: primary is the specialist whose domain owns the question (typically the engineer for the affected layer; spec-lead when the question is cross-cutting design).

5. **Effort estimate** in human-equivalent hours, file count, agent count. The OE figure is the CPO-facing time-to-complete-by-a-human number; the wall-clock figure (CompletedWork) is recorded at close from actual elapsed time, per the v2.2 metadata convention.

6. **Tags planned**: `AI` is universal; the `strap:<logical-type>` tag depends on each item's type (`strap:bug`, `strap:feature`, `strap:enhancement`, `strap:story`, `strap:task`); the **`quick`** source-attribution tag lands on every item created by this skill (mirrors `full-auto` on `/execute-sprint-full-auto` and `file-bugs` on `/file-bugs`; absence-of-all-three is the production-workflow signal for downstream `/dora-report` source breakdown); `--mockup` adds `poc; mockup`; `--investigation` adds `investigation`; Bug variant adds `env:<dev|uat|prod>` and `area:<area>` when the host supports these fields.

7. **Assumptions** the CPO's description forced the dev-lead to make. Surface every assumption explicitly so the CPO can correct at the gate.

8. **Branch plan**. When `--into` is set, the existing branch is the target. When `--into` is absent, the planned branch name is `<branch-prefix.quick>/<primary-item-type>-<primary-item-id>-<slug>` where `primary-item-type` is `bug` for the Bug shape (the Bug IS the implementation item) and `task` for all other shapes (the Task IS the implementation item). The id is unresolved at this point; it binds at Phase 3. On polyrepo umbrellas the branch is created in the chosen sub-repo's git, not at the umbrella root.

9. **Drafted body content per item.** For each item the chain will create, draft the description body skeleton: title (CPO-confirmable), severity / priority, key sections per the work-item template (e.g., for Bug: repro steps, expected vs actual, root cause hypothesis, affected files, impact). Fields the CPO's free-form description did not supply get placeholder text (`_(not supplied; dev-lead inference: <one-liner>)_`) -- never invented detail. The CPO sees this preview at the Phase 2 gate and can correct or add detail via "Modify and re-classify".

Present the classification report. On polyrepo umbrellas the report carries a `Sub-repo:` line immediately after `Item shape:`; on single-repo umbrellas the line is omitted entirely.

```
Quick work classification:
  Item shape:     <Bug | Enhancement+Story+Task | Feature+Story+Task | Story+Task under #<parent> | Task under #<parent>>
  Sub-repo:       <slug> (polyrepo umbrellas only; omitted on single-repo)
  Type rationale: <why this shape vs alternatives>
  Layer(s):       <backend | frontend | database | infra | docs | mixed>
  Estimated:      <hours>h total, <files>f, <agents>a
  Routing:        <primary specialist>[, <secondary specialist>(s)]
  Tags planned:   AI, strap:<type>[, env:*, area:*, poc, mockup, investigation]
  Branch:         <new <prefix>/<bug-or-task>-<id>-<slug> | --stacked from <current> | --into <existing>>
                  <REPO_ROOT note on polyrepo: branch lives in <umbrella>/<sub-repo-path>>
  Assumptions:    <list of assumptions from the description>

Drafted content per item:
  <Item type> ("<title>")
    Severity/Priority: <n>
    Key fields: <one-line summary per template section, with placeholder markers
                 for fields the CPO didn't supply>
```

### Phase 2: CPO approval gate

Use `AskUserQuestion` for the hard approval gate. Options (nominal-label decision; no previews):

- `Approve and execute`
- `Modify and re-classify` -- the CPO names what to adjust (different shape, different routing, scope clarification, scope reduction). The dev-lead re-classifies and re-presents.
- `Reject` -- exit cleanly with no persistence.

Per STRAP's CPO-authority discipline, `/quick` waits for an explicit go/no-go before any work-item is created or branch is touched. There is no "proceed by default after pause" -- the gate is hard.

### Phase 3: Create the work-item chain with v2.2 lifecycle metadata

On approval, the dev-lead creates the chain per the resolved item shape. For every item, apply the v2.2 hygiene checklist:

- Tags: `AI` + the appropriate `strap:<logical-type>` tag + `quick` source-attribution tag (+ Bug-variant `env:*` / `area:*` + mockup/investigation markers as applicable).
- Description carries the lifecycle-metadata block at the top.
- Area path: from `devops-connection.yaml`'s `mapping.area_path_root`.
- Iteration path: the current iteration resolved at pre-flight (when supported).
- Parent linkage via `mapping.link_types.parent` (or per host convention).
- No `StartDate` / `FinishDate` / `CompletedWork` at creation -- those mirror state transitions later.
- **Polyrepo umbrellas only:** every item in the chain (Bug for 3a; Enhancement/Feature + Story + Task for the rest) carries the `sub_repo` field set to the slug chosen in Phase 1 step 2. Persistence uses the connection profile's `mapping.fields.sub_repo` entry per Feature 1 schema (`custom_field` / `label_prefix` / `yaml_field` / `unsupported` degradation -- if `unsupported`, surface the limitation and document the sub-repo in the description body's metadata table instead). The lifecycle-metadata table at the top of every item also carries a `Sub-repo:` row for human visibility (same `<slug>` value).

The five chain shapes:

#### Shape 3a: Bug (no `--under`)

The Bug is the implementation item; no child Task. Matches the `/file-bugs` + `/fix-bugs` convention where `CompletedWork` lives on the Bug itself.

1. **Create the Bug.** Render `bug.template.md` with placeholders:
   - Lifecycle metadata: `authored_by: dev-lead`, `authored_at: <ts>`, `completed_by/at: _(set at resolution)_`.
   - Bug-specific placeholders the dev-lead drafted in Phase 1 step 8: `severity`, `environment` (when host supports), `area`, `repro_steps`, `expected`, `actual`, `root_cause`, `affected_files`, `impact`. Fields the CPO didn't supply carry their placeholder text from the Phase 1 preview that the CPO already approved.
   - Append a `Target Agent: <implementor>` line at the foot of the description body so `/dora-reconcile` Pass F-1 can parse the implementor role for AI-tag inheritance.

   Convert markdown -> HTML at the boundary if `mapping.field_formats.description` is `html`. Execute `operation_templates.work_item_create` with `host_type` = `mapping.work_item_types.bug.host_type`, parent = `mapping.default_parents.bug` (falls back to `mapping.default_parents.feature`), state = `mapping.states.new`, tags = `AI; strap:bug; quick; env:<env>; area:<area>`. In the same create call (or in an immediate update if the host requires separation): populate `mapping.fields.severity` with the classified severity and `mapping.fields.original_estimate` with the dev-lead's OE.

2. Audit comment on the Bug via `operation_templates.work_item_comment_add`: `[STRAP/agent:dev-lead] State: <none> -> new (via /quick). Authored By: dev-lead. Bug; Severity: <n>. OE: <h>h. Target Agent: <implementor>.`

#### Shape 3b: Enhancement + Story + Task (no `--under`)

1. **Create the Enhancement** parented to `mapping.default_parents.feature`. Lifecycle metadata + Overview / Business Case / Desired Behavior / Affected Files. Tags = `AI; strap:enhancement; quick` (+ `investigation` or `poc; mockup` for those variants). Degrade to Feature when `mapping.work_item_types.enhancement` is absent (see Enhancement degradation).
2. **Create the Story** as child of the Enhancement. Story description carries `Producing Agent: dev-lead` for /dora-reconcile Pass F-1 parsing. Tags = `AI; strap:story; quick`.
3. **Create the Task** as child of the Story. Task description carries `Target Agent: <implementor>`. Populate `mapping.fields.original_estimate` with the dev-lead's OE. Tags = `AI; strap:task; quick`.
4. Audit comment on each item recording creation.

#### Shape 3c: Feature + Story + Task (no `--under`, new scope)

Same as 3b but the top of the chain is a Feature (`mapping.work_item_types.feature.host_type`), parented to `mapping.default_parents.feature`. Tags on the Feature = `AI; strap:feature; quick`. Used when the description implies new cross-cutting capability (rare for `/quick`; new Features usually originate from a Resolved Spec via `/generate-features`).

#### Shape 3d: Story + Task under existing parent (`--under <feature-or-enhancement-id>`)

1. **Create the Story** as child of the named parent. Tags = `AI; strap:story; quick`.
2. **Create the Task** as child of the Story. Tags = `AI; strap:task; quick`.
3. Audit comments on Story and Task; reference the existing parent id.

#### Shape 3e: Task under existing parent (`--under <story-id>` OR single-step under Feature/Enhancement)

1. **Create the Task** as child of the named parent. Task description carries `Target Agent: <implementor>`. Populate `mapping.fields.original_estimate` with the dev-lead's OE. Tags = `AI; strap:task; quick`.
2. Audit comment on the Task referencing the parent chain.

**For all shapes**: render every description body with the v2.2 lifecycle-metadata table at the top (Authored By / Authored At / Completed By / Completed At), convert at the boundary, persist via `operation_templates.work_item_create`. The `Target Agent: <role>` line (on the implementation item -- Bug for Shape 3a, Task for the rest) and the `Producing Agent: <role>` line (on Stories) are load-bearing -- `/dora-reconcile` Pass F-1 parses them for AI-tag inheritance.

Capture the resolved work-item ids. The primary implementation item id binds the branch name: `<branch-prefix.quick>/bug-<bug-id>-<slug>` for Shape 3a; `<branch-prefix.quick>/task-<task-id>-<slug>` for the rest.

### Phase 4: Branch ceremony

1. **Determine the base branch**:
   - **Default mode**: base is `code-connection.yaml`'s `default_branch` on origin.
   - **`--stacked` mode**: base is the developer's currently checked-out branch. PR targets the origin copy of that branch. Verify a clean working tree.
   - **`--into <branch>` mode**: base is the named existing branch. No new branch is created; commits land on the existing branch. PR is updated (or created if absent) against the existing branch's PR target.
   - **Local Git profile** (`code-connection.yaml`'s `host: local-git`): same as default mode but no push. Phase 8's PR ceremony degrades per the profile's `local-merge` step sequence.

2. **Render the branch name** (default + `--stacked` modes only). Resolve the branch prefix: use `mapping.branch_prefix.quick` if declared in the connection profile, else fall back to `quick/`. For Shape 3a: `<prefix>bug-<bug-id>-<slug>` where `<slug>` is derived from the Bug title. For all other shapes: `<prefix>task-<task-id>-<slug>` where `<task-id>` is the (primary) Task created in Phase 3 and `<slug>` is derived from the Task title. If the rendered name exists, append `-v2`; if that also exists, append a timestamp.

3. **Create the branch**:
   - `git checkout -b <branch-name> <base>`
   - For remote profiles: `git push -u origin <branch-name>`. In `--stacked` mode, also push the local base branch to origin first if absent.
   - For Local Git profile: skip the push.

4. **Transition the implementation item(s) to `mapping.states.active`** via `operation_templates.work_item_update`. For Shape 3a, the implementation item is the Bug. For Shapes 3b/3c/3d/3e, the implementation items are the Tasks. Apply `strap:active` tag where the host state machine collapses per `state_asymmetries`. Audit comment per item: `[STRAP/agent:dev-lead] State: new -> active (via /quick). Specialist: <name>. Branch: <branch-name>. Mode: <default | --stacked | --into>.`

5. **Cascade parents to `active`** so the chain is internally consistent (no parent-behind-child state mismatches). `/dora-reconcile` Pass A is forward-only (children done -> parent resolved); it does NOT cascade backward. The dev-lead lands the upward cascade here:
   - Shape 3a: Bug is the implementation item; already transitioned in step 4. Nothing more to cascade.
   - Shape 3b/3c/3d: transition the Story to `active` (per `mapping.states.active`). Audit comment: `[STRAP/agent:dev-lead] State: new -> active (via /quick; cascade from child Task). Branch: <branch-name>.`
   - Shape 3b/3c: also transition the Feature/Enhancement to `active`. Audit comment with the same cascade rationale.
   - Shape 3d/3e (`--under` named an existing parent): the parent is already in `new` or `active`; if `new`, transition to `active` with the same cascade audit comment. Leave at `active` if already there.

### Budget enforcement

Per [`budget-discipline.md`](../../strap/contexts/budget-discipline.md), `/quick` operates against two budgets pulled from `.claude/strap/state/usage.yaml` at workflow start. Defaults from `budget-discipline.md`'s defaults table: per-agent **200K**, session aggregate **1M**. The CPO can override via `/memory-refine dev-lead` (or, once `/revise-token-budget` ships, via that skill).

**Dispatch-time budget pull.** After Phase 4 completes (branch ceremony done, implementation items transitioned to active) and before Phase 5 begins (specialist dispatch or dev-lead-direct implementation):

1. Read `.claude/strap/state/usage.yaml`. Pull `budgets.quick.per_agent` and `budgets.quick.session_aggregate`. Also pull `budgets.quick.agent_overrides` if present -- per-agent overrides established via `/revise-token-budget --agent <name>` take precedence over the workflow default at dispatch-time per-agent resolution (see `budget-discipline.md` "Per-agent overrides"). If `usage.yaml` is missing (the `/strap-in` scaffold step should have created it), surface the gap and stop with a recommendation to run `/strap-in` or `/strap-refresh`.
2. Initialize the `session` block:
   - `session.workflow: quick`
   - `session.workflow_instance: quick-<YYYYMMDD>-<primary-item-id>` (matches Phase 5's `CreateTeam` `team_name`)
   - `session.started_at: <ISO-8601 timestamp>`
   - `session.specialists_used: 0`
3. For every specialist that will be dispatched in this run, reset `agents.<name>.used_in_current` to `0` (preserve `agents.<name>.last_dispatch`). Specialists not in this run's roster are left untouched. Pure dev-lead-direct runs skip steps 2-3 since no specialist budget is consumed.

**Per-agent budget in the dispatch brief.** Append a budget line to every specialist's brief, mirroring `/strap-in` Section 6. The effective `<per-agent-budget>` value resolves per `budget-discipline.md` "Dispatch-time resolution": `agent_overrides.<name>.per_agent` if present, else `per_agent`:

> "Your budget for this dispatch is `<per-agent-budget>` tokens. Include `tokens_used: ~XXk` as the final line of your finishing summary."

This carries the per-agent budget into the specialist's awareness and enforces the self-reporting contract that token accounting depends on. Per the agent-devs and agent-ops team rules, every specialist already self-reports the line; the brief makes the budget for THIS dispatch explicit. The investigation path (`--investigation`) and mockup path (`--mockup`) include this line just like the default and refactor paths.

**Token accounting.** When the specialist's `SendMessage` finishing report returns, parse the `tokens_used: ~XXk` line. Add to `agents.<name>.used_in_current`; sum into `session.specialists_used`. Update `agents.<name>.last_dispatch` to the dispatch's ISO timestamp. Persist after each specialist completes (not just at workflow end) so a session interruption preserves accurate state.

**60% session-aggregate checkpoint.** When `session.specialists_used` crosses 60% of the configured session aggregate (same threshold `/strap-in` Section 7 uses):

1. Surface to the CPO: "Specialists have consumed ~`<X>`K of the `<Y>`K session aggregate. Recommending checkpoint."
2. Run `/context-prep quick-<workflow-instance>` to capture in-flight workflow state (which items are created, where the implementation stands, which branch + commits exist) in a continuation.
3. Instruct the CPO: "Run `/usage` to confirm your own window; then `/clear` and start a fresh session. On resume, run `/context-fetch quick-<workflow-instance>` first."
4. The CPO confirms or overrides. On override ("plenty of room, push through"), proceed and note the override in the continuation for future sessions to learn from.

**Per-agent exhaustion.** When `agents.<name>.used_in_current` reaches its per-agent budget for a specialist whose work in this `/quick` run is not yet complete:

- Do NOT redispatch that specialist within this workflow instance.
- Work with what the specialist already produced; review the landed work normally.
- Note the exhaustion under `agents.<name>` in `usage.yaml` (e.g., add `exhausted_at: <ISO-timestamp>` to the agent's entry).
- For `--investigation`: a partial report is what lands; surface to the CPO the budget-binding event so they can decide whether to expand the budget for a re-run or accept the partial report.
- Surface to the CPO that the specialist exhausted its budget mid-`/quick` so they can decide whether to revise the per-agent budget for the next workflow instance via `/revise-token-budget`.

Per-agent budget is per-workflow-instance, not per-session. After a 60% checkpoint, the new session reads `agents.<name>.used_in_current` to know how much each specialist has left in this `/quick` instance.

**Workflow-completion close-out.** At the end of Phase 9 (Final summary), after the PR is opened (or the investigation report is delivered, or the mockup set is committed):

- Write `session.completed_at: <ISO-8601 timestamp>` to `usage.yaml`.
- Preserve `agents.<name>.used_in_current` as the closing value -- it gets reset at the next workflow instance's dispatch-time budget pull.

**Per-skill tuning.** `/quick` is single-motion and should rarely hit the 60% session-aggregate checkpoint in a single specialist run. Per-agent exhaustion is the realistic constraint, most often for large `--investigation` work (broad codebase scans by the primary specialist) -- when the per-agent budget binds mid-investigation, the report lands partial. Dev-lead-direct trivial fixes (single-file changes per the Owner section) do not consume from `usage.yaml`; the CPO's `/usage` discipline is the only signal for dev-lead consumption (see `budget-discipline.md` "Who watches what").

### Phase 5: Execute

Three execution paths, selected by flag and routing:

#### 5a. Default + Refactor + Doc + Test paths

For multi-specialist non-conflicting fan-out: `CreateTeam(team_name: "quick-<YYYYMMDD>-<primary-item-id>")`, spawn each specialist as a named teammate in a single batch. Each brief includes:

- The specialist's role contract path + operating context (rules, memory, project-profile, active domain entry).
- The implementation-item id (Bug for Shape 3a; Task for the rest), full description, parent chain, affected files.
- The worktree path -- the specialist operates exclusively within it. Worktree root: `<repo-parent>/<repo-name>-worktrees/<primary-item-id>-<slug>/` (or per project-profile.md `Conventions` override).
- The mandate to commit on the quick branch with a traceable message keyed to the implementation-item id: `fix(#<bug-id>): <description>` for Shape 3a; `feat(#<task-id>): <description>` for the rest (or `docs(#<task-id>): <description>` for doc-only Tasks, `test(#<task-id>): <description>` for test-coverage-only Tasks).
- The mandate to author the test that asserts the change. Per the centralized-test-execution rule, the specialist WRITES the test; the dev-lead RUNS the suite at Phase 6.
- The required `SendMessage` finishing report (files touched, tests written, deviations, blockers, `tokens_used: ~XXk`).

For single-specialist work: serial `Task` dispatch. Same brief; no team ceremony.

For trivial single-file changes that fit the dev-lead's role contract: the dev-lead implements directly on the quick branch, commits with the same message convention, authors any required test. No specialist spawn.

Review every change after each specialist completes (or after the dev-lead's direct implementation). Run the relevant active-domain build command per project-profile.md to confirm no compile errors. Repair issues before proceeding.

#### 5b. Investigation path (`--investigation`)

Dispatch the primary specialist via serial `Task` with read-only tools palette (`Read, Grep, Glob, Bash`). Brief:

- The Task id and the CPO's verbatim question.
- The active-domain entry whose specialist is dispatched.
- The mandate to investigate and produce a markdown report at `.claude/strap/investigations/<task-id>-<slug>.md`.
- Report structure (enforced by the dev-lead's brief):
  - **Question** (verbatim from `$ARGUMENTS`).
  - **Findings** (with file refs / commit refs / external links as evidence; confirmed facts distinguished from hypotheses).
  - **Analysis** (interpretation).
  - **Recommendation** (one of: "no action needed", "create Requirement for <X>", "run /quick <follow-up description>", "needs CPO decision: <specific question>").
- The mandate to NOT modify production code.
- The required `SendMessage` finishing report with the report path and a one-line recommendation summary.

The dev-lead reads the report for coherence. If clean, skip ahead to Phase 7 (no Phase 6 test run; no Phase 8 PR).

#### 5c. Mockup path (`--mockup`)

Dispatch the designer via serial `Task` with read-write tools palette (`Read, Grep, Glob, Bash, Edit, Write`). Brief:

- The designer's role contract + the `client-ui` domain entry.
- The Task id and the description.
- Target mockup path resolved per the same rule `/create-mockups` uses: `client-ui.Mockup paths[0] + quick-<task-id>/`, falling back to `.claude/strap/mockups/quick-<task-id>/`.
- The mandate to build deployable mockup code per the `client-ui` `Conventions` (framework, file extensions, mock data idioms).
- The mandate to commit each mockup file separately on the quick branch for clean PR review.
- The required `SendMessage` finishing report (files written, run instructions, walkthrough, design decisions, mock-data shape, open gaps, `tokens_used: ~XXk`).

This path is a lightweight POC -- it does NOT write to a Spec, it does NOT run `/analyze-mockups`. The gated `/create-mockups` flow is the production pre-decomposition path; `/quick --mockup` is a design spike that produces a referenceable artifact. When the CPO later creates a Requirement that builds on the mockup, they reference the Enhancement id manually for traceability.

### Phase 6: Centralized build and test

Skipped for `--investigation`. Conditional otherwise:

- Default / refactor / test paths: run the relevant active-domain build + test commands per project-profile.md. Run only the domains that landed work.
- Mockup-only: no test run (mockup code is not part of the production test surface).
- Doc-only: no test run; consider a markdown linter if the project declares one in `Build and test`.
- Cross-cutting: run every affected domain's suites.

When any verification step fails: halt. Preserve the branch. Tag the responsible implementation item (Bug for Shape 3a; the failing Task for the rest) with `test-failure` via `operation_templates.work_item_update`. Do not open the PR. Surface halt context to the CPO (see Halt-and-report).

### Phase 7: Resolve work items with v2.2 completion metadata

Before opening the PR (or instead of PR for `--investigation`), transition the implementation items to `mapping.states.resolved` and apply lifecycle completion metadata. **DORA metrics depend on this.** The STRAP v2.2 convention is that workflow skills stop at Resolved -- the Resolved -> Closed transition happens via PR merge cascade (`/dora-reconcile`) or via the CPO acceptance ritual (`/close-ceremony`).

The dev-lead tracks the active-to-resolved duration in-session: Phase 4 step 4 recorded when each implementation item transitioned to `active`; Phase 7 records when it transitions to `resolved`. The difference is the wall-clock `CompletedWork` value.

#### For Shape 3a (Bug-only)

1. **Read the existing Bug description** to preserve `authored_by` / `authored_at` from creation.
2. **Re-render `bug.template.md`** with completion placeholders:
   - `completed_by` -> the implementing specialist (or `dev-lead` for direct implementations).
   - `completed_at` -> ISO-8601 timestamp at the moment of resolution.
   - All Bug-specific fields preserved verbatim from creation.
3. **Convert markdown to HTML at the boundary** if `mapping.field_formats.description` is `html`.
4. **Update the Bug** via `operation_templates.work_item_update`: state -> `mapping.states.resolved`, description -> the re-rendered body, `mapping.fields.completed_work` -> the in-session wall-clock duration in hours, `ResolvedReason` -> `Fixed` (or `Cannot Reproduce` for investigation variants where the bug was misdiagnosed). Apply `strap:resolved` tag where the host state machine collapses per `state_asymmetries`.
5. **Audit comment**: `[STRAP/agent:dev-lead] State: active -> resolved (via /quick). Completed By: <specialist | dev-lead>. CompletedWork: <h>h wall-clock. ResolvedReason: Fixed. Commit: <short-sha>.`

The Bug stays at Resolved. **Bug -> Closed is NOT this skill's responsibility** -- that's the QA/CPO verification gate handled by `/close-ceremony`.

#### For Shapes 3b/3c/3d/3e (Tasks under a parent chain)

For each Task created in Phase 3:

1. **Read the existing Task description** to preserve `authored_by` / `authored_at`.
2. **Re-render `task.template.md`** with completion placeholders:
   - `completed_by` -> the implementing specialist (or `dev-lead` for direct implementations).
   - `completed_at` -> ISO-8601 timestamp at the moment of resolution.
3. **Convert markdown to HTML at the boundary** if needed.
4. **Update the Task** via `operation_templates.work_item_update`: state -> `mapping.states.resolved`, description -> the re-rendered body, `mapping.fields.completed_work` -> the in-session wall-clock duration in hours. Apply `strap:resolved` tag where the host state machine collapses per `state_asymmetries`.
5. **Audit comment**: `[STRAP/agent:dev-lead] State: active -> resolved (via /quick). Completed By: <specialist | dev-lead>. CompletedWork: <h>h wall-clock. Commit: <short-sha>.`

#### Story cascade (Shapes 3b/3c/3d)

When all child Tasks are `resolved`, transition the Story to `mapping.states.resolved` and apply completion metadata (`Completed By: dev-lead`, `Completed At: <ts>`; `CompletedWork` rolled up from child Tasks). Apply `strap:resolved` tag if needed. Audit comment: `[STRAP/agent:dev-lead] State: active -> resolved (via /quick; cascade from child Tasks). Completed By: dev-lead.`

`/dora-reconcile` Pass A handles this cascade on a daily cadence regardless; the dev-lead landing it inline keeps `/quick`'s output coherent at PR time.

#### Feature/Enhancement (Shapes 3b/3c) and existing parents (Shapes 3d/3e)

**Stay at `active`**. Feature/Enhancement -> Resolved is the cascade trigger for `/dora-reconcile` to land when the linked PR merges. Feature/Enhancement -> Closed is the CPO acceptance gate via `/close-ceremony`. `/quick` does NOT auto-resolve Features or Enhancements.

#### Investigation variant

The Task transitions to `resolved` with the investigation report path written into the description footer (e.g., `> Investigation report: .claude/strap/investigations/<task-id>-<slug>.md`). The Enhancement parent stays at `active`; the CPO closes via `/close-ceremony` after reading the report.

### Phase 8: PR creation (or append)

Skipped for `--investigation`. Three variants otherwise:

#### 8a. Default + new branch

1. **Render the PR description** to a temp file via `Write`. Structured markdown body covering:
   - Run shape and chain summary (every item id + type + title).
   - "Quick classification" section (the report from Phase 1, including assumptions and the drafted-body preview the CPO approved).
   - Per implementation item (Bug for Shape 3a; each Task otherwise): change summary, commit sha, files touched, tests written.
   - Centralized test summary.
   - Mockup walkthrough section (when `--mockup`): files, run command, design notes from the designer's `SendMessage` report.
   - Closing token in the host's expected format (e.g., `Closes #<id>` for GitHub, `Related: AB#<id>` for Azure Repos paired with Azure DevOps).
2. **Create the PR** via `code-connection.yaml`'s `operation_templates.pull_request_create` with placeholders:
   - `{{source_branch}}` -> the quick branch
   - `{{target_branch}}` -> `default_branch` (default mode) or the current local branch (`--stacked` mode)
   - `{{title}}` -> `fix: <summary>` (Bug-variant), `feat: <summary>` (default), `docs: <summary>` (doc-only), `poc: <summary>` (`--mockup`)
   - `{{description}}` -> the rendered description (read from the temp file)
   - `{{linked_work_items}}` -> every created work-item id
   - `{{draft}}` -> true when `--draft` was supplied, OR by default (`/quick` favors draft creation; the CPO opens for review manually)
3. **Update each work item with the PR reference** via `operation_templates.work_item_update`.
4. **Audit comment per item**: `[STRAP/agent:dev-lead] PR opened: <pr-url-or-merge-hash> against <target-branch>. Awaiting CPO merge.`

#### 8b. With `--into <branch>`

Do NOT open a new PR. Push commits to the existing branch (or commit locally for Local Git profile). Render a comment on the existing PR (when present; resolved by querying `pull_request_create`'s host for an open PR against the branch, OR ad-hoc if the host has no list operation in the profile) listing: commit shas added by this `/quick` run, summary, link to the new implementation item (Bug or Task). Existing PR stays in its current state.

#### 8c. Local Git profile

Execute the `local-merge` step sequence per the profile's `operation_templates.pull_request_create.steps`. Capture the merge commit hash as the "PR identifier" for hand-off.

### Phase 9: Final summary

Print a structured summary to the CPO:

```
/quick complete: <Bug or Task title>

Chain created:
  Bug:                           #<id> -- resolved -- <title>         (Shape 3a only)
    or
  Feature | Enhancement:         #<id> -- active -- <title>           (Shapes 3b/3c when newly created; otherwise the existing --under parent)
  Story:                         #<id> -- resolved -- <title>         (Shapes 3b/3c/3d)
  Task:                          #<id> -- resolved -- <title>         (Shapes 3b/3c/3d/3e)
  Tags:                          AI; strap:<type>[; env:*; area:*; poc; mockup; investigation]

Code/artifacts:
  Branch:     <branch-name>
  Commits:    <count> (<sha1>, <sha2>, ...)
  Files:      <count> changed
  Tests:      <passing | n/a>

Output:
  Draft PR:   <pr-url-or-id>                                       (default mode)
    or
  Appended:   to PR <pr-url-or-id> / branch <name>                 (--into mode)
    or
  Report:     .claude/strap/investigations/<task-id>-<slug>.md     (--investigation mode)
    or
  Mockups:    <mockup-path>                                        (--mockup mode)

Effort recorded:
  OriginalEstimate: <X>h human-equivalent
  CompletedWork:    <Y>h wall-clock
  Authored By / At: dev-lead / <creation-ts>
  Completed By / At: <specialist | dev-lead> / <resolution-ts>

Next:
  - Review draft PR (or the existing PR's new commits).
  - Convert to ready-for-review when satisfied, or run /refine-pr for changes.
  - The Bug (Shape 3a) and Feature/Enhancement parents flow to /close-ceremony for the CPO acceptance gate (Resolved -> Closed) once the work is verified.
  - Investigation reports: read and decide whether a Requirement should be created.
```

Tear down the agent team (when one was created) via `TeamDelete`. If shutdown wedges, recommend `/team-cleanup`. Prune git worktrees (`git worktree prune`) and remove the quick-branch worktree root.

## Halt-and-report

Any halt at any phase:

1. Tag the responsible work item(s) with `halted` via `operation_templates.work_item_update`. Audit comment on each: `[STRAP/agent:dev-lead] Halted at Phase <N>: <reason>. Branch preserved: <branch-name>.`
2. Preserve the branch and commits. Never auto-revert.
3. Print halt context to the CPO:

```
/quick HALTED at Phase <N>: <phase name>

Reason: <halt reason>

Preserved:
  Work items: <list of ids with current state>
  Branch:     <branch-name>
  Commits:    <list of shas>

To resolve:
  - Investigate the halt context (logs / failed tests / specialist report).
  - Fix manually or via /fix-bugs <id>, then either:
    - Continue work on the branch and open PR manually, or
    - Re-invoke /quick with --into <branch> to add more agent work.
```

4. Tear down the agent team (when one was created). Exit.

## Enhancement degradation

When `mapping.work_item_types.enhancement` is absent from the connection profile, Shape 3b items are degraded:

1. Substitute Feature for Enhancement (`mapping.work_item_types.feature.host_type`).
2. Tag with `AI; strap:feature; strap:degraded-enhancement` so downstream agents and reports can distinguish degraded items.
3. Surface the degradation at the Phase 1 classification report so the CPO sees the substitution before approving.

The skill never silently rewrites Enhancements to Features without flagging it.

Note: this degradation differs from `/file-bugs`, which degrades Enhancement -> Bug. The asymmetry is by chain-shape design: `/file-bugs` creates atomic single-level items (Bug or Enhancement) so degrading to Bug preserves the intake shape; `/quick`'s Shape 3b creates an Enhancement+Story+Task chain, so degrading to Feature preserves the multi-level chain shape (Feature+Story+Task) -- degrading to Bug would force collapse of the Story/Task children, which is structurally incompatible.

## Outputs

- A coherent work-item chain in the host work-tracker matching the classified shape, parented per the connection profile's conventions (or per `--under`), every item carrying the v2.2 lifecycle-metadata block + `AI` tag + `strap:<logical-type>` tag + `quick` source-attribution tag.
- A quick branch (or appended commits to an existing branch via `--into`) containing one commit per implementation item plus any cleanup commits.
- A pull request (draft by default, ready when explicitly directed) linked to every created work item, OR an investigation report at `.claude/strap/investigations/<task-id>-<slug>.md`, OR a designer mockup set at the resolved mockup path.
- The implementation item(s) in `mapping.states.resolved` with `CompletedWork` populated and `Completed By / At` in the description. For Shape 3a the implementation item is the Bug (with `ResolvedReason: Fixed` set). For other shapes the implementation items are the Tasks.
- Story (Shapes 3b/3c/3d) in `mapping.states.resolved` via cascade.
- Feature/Enhancement in `mapping.states.active` -- never auto-resolved by this skill. Closure happens via PR merge cascade in `/dora-reconcile` or via `/close-ceremony`.
- `[STRAP/agent:dev-lead]` audit comments on every state transition.
- A structured summary delivered to the CPO with chain ids, branch, commits, tests, PR (or report / mockups), and effort recorded.
- `.claude/strap/state/usage.yaml` updated with `session.completed_at`, the final per-agent `used_in_current` values, and any `exhausted_at` markers from specialists that hit their per-agent budget mid-workflow. (Skipped for pure dev-lead-direct runs that did not initialize a session.)

## Quality gates

The skill is successful when all of the following hold:

- Both connection profiles were present at pre-flight.
- Flag combinations were validated; `--mockup` and `--investigation` mutual exclusion enforced; `--stacked` and `--into` mutual exclusion enforced.
- The CPO explicitly approved the Phase 1 classification (including the drafted body preview) before any work item or branch was created.
- Every created item carries the v2.2 lifecycle-metadata block at the top of its description.
- Every created item carries the `AI` tag, the appropriate `strap:<logical-type>` tag, AND the `quick` source-attribution tag.
- The `Target Agent: <role>` line is present on the implementation item (Bug for Shape 3a; Task for the rest) and `Producing Agent: <role>` is present on Stories so `/dora-reconcile` Pass F-1 can parse them.
- The parent chain is internally consistent at PR time: implementation item Resolved, Story Resolved (when applicable), Feature/Enhancement Active. No parent-behind-child mismatches.
- A fresh quick branch was created when needed (never reused unless `--into` named one explicitly).
- The centralized build and test commands passed on the final commit before PR creation (default + refactor + test + doc paths; mockup-only and investigation-only skip).
- The PR (or local-merge) exists, is linked to every created work item, and was created via `code-connection.yaml`'s `operation_templates.pull_request_create` -- except for `--into` (no new PR) and `--investigation` (no PR).
- Every persisted state transition carries a `[STRAP/agent:dev-lead]` comment via `operation_templates.work_item_comment_add`.
- The `strap:<logical-state>` tag was applied at each transition where the host state machine collapses per `state_asymmetries`.
- No item was advanced past `mapping.states.resolved` -- the Resolved -> Closed transition happens via PR merge cascade in `/dora-reconcile` (Tasks, Stories, Features/Enhancements) or via `/close-ceremony` (Bug, Feature/Enhancement).
- For `--investigation`: a markdown report exists at `.claude/strap/investigations/<task-id>-<slug>.md` and the report path is referenced in the Task description footer.
- For `--mockup`: mockup files exist at the resolved mockup path and run cleanly per the designer's reported `Run instructions`.
- `tokens_used: ~XXk` reporting was captured for every specialist dispatch (or its absence noted as a budget-tracking warning per Failure handling). Pure dev-lead-direct runs are not budgeted by this gate.
- The session aggregate stayed within budget OR the 60% checkpoint was offered to the CPO when crossed.
- Requires the harness team primitive (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` + valid `CLAUDE_CODE_SPAWN_BACKEND`) only when parallel fan-out is in scope; single-specialist and dev-lead-direct runs do not require it.

## Failure handling

- **Either connection profile missing**: stop. Recommend `/connect-devops-project` or `/connect-code-repo` per the gap.
- **`--mockup` AND `--investigation` both supplied**: refuse with `mutually exclusive` message; surface the offending invocation.
- **`--stacked` AND `--into` both supplied**: refuse with `mutually exclusive` message.
- **`--under <id>` parent missing or in wrong state**: refuse with the parent's current state; suggest a different parent or no-parent invocation.
- **`--into <branch>` divergent from `default_branch`**: refuse with `bring branch up to date with <default> first` instruction.
- **Classification cannot determine item shape**: ask the CPO for clarification; do not guess. Surface the ambiguity and the candidate shapes.
- **CPO declines at the approval gate**: exit cleanly; no persistence; no branch.
- **Work-item creation fails mid-chain**: surface the host error verbatim. For created items that were already persisted, leave them in place tagged `halted`. Do not roll back automatically -- the CPO may want to inspect the partial chain.
- **Branch creation fails** (collision or push rejection): retry with `-v2` / timestamp suffix; on persistent failure, surface the host error and stop.
- **`operation_templates` rendering produces malformed requests**: surface the failing template path and request body; do not execute.
- **HTML conversion fails**: surface the offending content; do not post raw markdown into an HTML-flavored field.
- **A specialist fails to call `SendMessage` and the dev-lead is left waiting**: treat extended silence as a wedged teammate; recover via `/team-cleanup`.
- **Build or test fails after implementation**: halt before PR creation; preserve the branch; tag the responsible Task with `test-failure`.
- **`pull_request_create` is unsupported by the source-control profile**: stop and surface the gap; the items stay in their current states with all work on the branch; the CPO opens the PR manually using the host's UI.
- **`CreateTeam` fails for parallel fan-out**: surface the actionable error naming the offending settings layer; offer to fall back to serial dispatch.
- **`--investigation` specialist times out or returns no report**: halt; tag the Task with `halted`; preserve any partial report; surface the gap.
- **A specialist returns without the `tokens_used: ~XXk` line**: treat as a budget-tracking warning; the run continues but the dev-lead estimates that specialist's consumption manually and notes the gap under `agents.<name>` in `usage.yaml`.
- **A specialist exhausts its per-agent budget mid-workflow**: do not redispatch within this workflow instance; work with what the specialist produced (for `--investigation`, the partial report is what lands); surface the exhaustion to the CPO so the budget can be revised via `/revise-token-budget` for the next instance.
- **`.claude/strap/state/usage.yaml` missing**: surface the gap; the install scaffold step in `/strap-in` should have created it. Recommend re-running `/strap-in` or `/strap-refresh` to restore the file before proceeding.

## References

- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- dev-lead guardrails: [`../../strap/rules/agents/dev-lead.md`](../../strap/rules/agents/dev-lead.md).
- agent-devs team rules: [`../../strap/rules/agent-devs.md`](../../strap/rules/agent-devs.md) -- centralized test execution, PR creation rule, `SendMessage` discipline.
- agent-ops team rules: [`../../strap/rules/agent-ops.md`](../../strap/rules/agent-ops.md).
- Project profile (active domains + specialists + build/test): [`../../strap/contexts/project-profile.md`](../../strap/contexts/project-profile.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Source-control connection profile: `.claude/strap/state/code-connection.yaml`.
- Work-item templates: `.claude/strap/templates/work-items/{bug,enhancement,feature,story,task}.template.md`.
- Sibling skills (creation paths): [`../file-bugs/SKILL.md`](../file-bugs/SKILL.md), [`../new-requirement/SKILL.md`](../new-requirement/SKILL.md).
- Sibling skills (execution paths): [`../fix-bugs/SKILL.md`](../fix-bugs/SKILL.md), [`../execute-sprint/SKILL.md`](../execute-sprint/SKILL.md).
- Downstream skill: [`../refine-pr/SKILL.md`](../refine-pr/SKILL.md) for PR-feedback iterations.
- Downstream skill: [`../close-ceremony/SKILL.md`](../close-ceremony/SKILL.md) for the CPO Resolved -> Closed value-acceptance gate.
- Companion skill (the gated production mockup flow, NOT `--mockup` here): [`../create-mockups/SKILL.md`](../create-mockups/SKILL.md).
- Recovery primitive for wedged teammates: [`../team-cleanup/SKILL.md`](../team-cleanup/SKILL.md).
- Connection-profile schema source-of-truth: [`../connect-devops-project/SKILL.md`](../connect-devops-project/SKILL.md), [`../connect-code-repo/SKILL.md`](../connect-code-repo/SKILL.md).
- Onboarding design (connection-discovery model + profile shape): [`../../strap/contexts/onboarding-design.md`](../../strap/contexts/onboarding-design.md).
- Budget discipline (cross-cutting): [`../../strap/contexts/budget-discipline.md`](../../strap/contexts/budget-discipline.md).
