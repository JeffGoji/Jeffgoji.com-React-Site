---
name: /fix-bugs
description: Execute targeted fixes for Bug and Enhancement work items. Dev-lead reads each item, branches, sequences by severity and dependency, dispatches active-domain specialists from project-profile.md (parallel via CreateTeam for non-conflicting fixes, serial for dependent ones), reviews each fix, runs the centralized build-and-test pass, sets v2.2 completion metadata at resolution, and prepares the PR via the source-control connection profile.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
---

# /fix-bugs

## Purpose

Implement fixes for one or more Bug or Enhancement work items in a single coordinated pass. The lighter sibling of [`/execute-sprint`](../execute-sprint/SKILL.md): no Story decomposition, no full Spec traversal, no waves -- just targeted code changes against well-scoped tickets that already carry a root cause and affected files.

Use when the CPO has a list of Bug or Enhancement work items that are ready to implement -- typically items produced by [`/file-bugs`](../file-bugs/SKILL.md) or appended to a sprint via [`/plan-sprint`](../plan-sprint/SKILL.md).

The skill ships portable. Every adopter-specific concern resolves at runtime:

- Specialist mapping per Bug comes from `project-profile.md`'s `Domains` section (affected files mapped to active-domain specialists)
- Work-tracking operations render through `operation_templates.<op>` in `.claude/strap/state/devops-connection.yaml`
- Branch operations and PR creation render through `operation_templates.<op>` in `.claude/strap/state/code-connection.yaml`
- Type, state, field, and link mappings come from `mapping.*` in both profiles; `state_asymmetries` covers host collapses
- Markdown-to-HTML conversion is applied at the boundary for HTML-flavored description fields
- Lifecycle completion metadata (`Completed By`, `Completed At`) is rendered into Bug / Enhancement descriptions at resolution; state-change audit lives in work-item comments tagged `[STRAP/agent:<name>]`
- Build and test commands come from project-profile.md's `Build and test` section (per active domain)

## Owner

**dev-lead.** When the skill is invoked the orchestrator IS the dev-lead. For multi-item runs with non-conflicting fixes, specialists are dispatched in parallel via `CreateTeam`; for sequenced or dependent fixes, serial `Task` dispatch. For single-file simple fixes, the dev-lead may implement directly (no spawn ceremony) when the work clearly fits within one specialist's domain and the dev-lead's role contract.

## Inputs

- `$ARGUMENTS` -- whitespace-separated work item ids, optionally followed by mode flags in any order. Required. Example: `12345 12346 12347 stacked draft`.
- Recognized flags:
  - `stacked` -- branch from the developer's currently checked-out branch instead of `default_branch` from `code-connection.yaml`. PR targets the origin copy of that branch. Used when the fix builds on top of in-flight work. Distinct from the Local Git connection-profile mode (`host: local-git`), which affects PR ceremony, not branch target.
  - `draft` -- create the final pull request as a draft.
- `.claude/strap/contexts/project-profile.md` -- source of truth for active domains, their specialist rosters, and build/test commands per domain.
- `.claude/strap/state/devops-connection.yaml` -- work-tracking connection profile. Required fields: `mapping.work_item_types.{bug,enhancement}.host_type`, `mapping.field_formats.description`, `mapping.states.{new,active,resolved}`, `mapping.state_asymmetries` (consulted on collapse), `mapping.fields.{severity,completed_work,assigned_to}`, `operation_templates.{work_item_read,work_item_update,work_item_comment_add,work_item_link_add}`.
- `.claude/strap/state/code-connection.yaml` -- source-control connection profile. Required fields: `host`, `host_url`, `default_branch`, `mapping.branch_prefix.{fix,feature}`, `capabilities.{branch_create,branch_push,pull_request_create}`, `operation_templates.pull_request_create`.
- `.claude/strap/templates/work-items/bug.template.md` -- description body template used when re-rendering on resolution.

## Pre-flight

1. **Both connection profiles exist.** If `devops-connection.yaml` is missing, redirect to `/connect-devops-project`. If `code-connection.yaml` is missing, redirect to `/connect-code-repo`.
2. **`git --version` succeeds.** Branch creation and worktree management depend on git.
3. **Required environment for parallel agent teams (when fan-out is in scope).** When the run includes two or more items that will dispatch to specialists, the effective resolved env must carry `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and a valid `CLAUDE_CODE_SPAWN_BACKEND` (`auto`, `tmux`, or `in-process`). Single-item runs that the dev-lead implements directly do not require these. Missing or invalid values typically indicate a hand-edited `settings.json` -- surface an actionable error naming the offending layer and direct the CPO at re-running the installer.

## Workflow

### Phase 1: Read work items and validate

For each work item id in `$ARGUMENTS`:

1. **Read the item** via `operation_templates.work_item_read` with `id=<work-item-id>` and execute. Capture title, logical type, current state, severity / priority, description, root cause, affected files, linked artifacts, assignment, tags.

2. **Validate preconditions**:
   - Logical type MUST be `bug` or `enhancement` (verified via `strap:bug` / `strap:enhancement` tag or `mapping.work_item_types.{bug,enhancement}.host_type` match). Refuse other types with a clear message; the skill is not a general implementer.
   - State MUST be `mapping.states.new` or `mapping.states.active`. Items already in `resolved` or `closed` are skipped with a warning.
   - The description MUST contain enough detail to implement: at minimum a root cause section and at least one affected file path. When detail is missing:
     - Dispatch spec-lead via serial `Task` (read-only palette: `Read, Grep, Glob, Bash`) to investigate and return the missing detail.
     - Parse the existing description's `authored_by` / `authored_at` to preserve them. Re-render `bug.template.md` with the existing creation values plus the updated body sections.
     - Convert at the boundary if needed and execute `operation_templates.work_item_update` to update the description before proceeding.

3. **Identify the target specialist** for each item by mapping `affected files` to project-profile.md's `Domains` section. For each affected file:
   - Identify the canonical domain it belongs to (by path conventions declared in the matching `Domains` entry's `Source-of-truth` field, or by repo-tree inspection).
   - Look up the domain's `Specialists` field; pick the implementation-owning specialist (typically the engineer, not the designer).
   - When an item spans two or more domains, it dispatches to the dominant-domain specialist; cross-domain coordination is the dev-lead's at review time.
   - When no domain match exists, the dev-lead implements directly (a simple fix in a small or under-claimed area is faster than spawning).
   - **Polyrepo umbrellas**: domain resolution scopes to the Bug's `sub_repo` -- look up the matched domain in the sub-repo's `Active domains` (per project-profile.md's `Sub-repos` section) rather than umbrella-wide. Cross-cutting domains (e.g., `security-reviewer`) may still resolve via the umbrella `## Domains` section.

4. **Polyrepo routing classification.** Read `project-profile.md` for the `Sub-repos` section + schema sentinel.
   - **Single-repo umbrellas**: items have no `sub_repo` field; the whole run operates against the single repo. Proceed with existing single-repo flow.
   - **Polyrepo umbrellas**: read each item's `sub_repo` field via the connection profile's `mapping.fields.sub_repo` resolver. Compute the unique set:
     - **Single-sub-repo run** (all items share one slug, or all are null): single-sub-repo routing applies in Phase 3. The run executes against `<umbrella>/<sub-repo-path>` as REPO_ROOT; one fix branch in that sub-repo.
     - **Cross-sub-repo run** (items reference 2+ distinct slugs): atomic cross-sub-repo execution is Feature 5 (not yet shipped). For now, surface to the CPO: "These items span sub-repos `<list>`. Cross-sub-repo atomic fix-bugs is unavailable. Choose one sub-repo to fix now; remaining items require subsequent `/fix-bugs` invocations." Prompt via `AskUserQuestion`: one option per affected sub-repo + `Cancel`. Filter items to only those tagged with the chosen slug; note the deferred items in the Phase 2 plan.
     - **Items missing `sub_repo` on a polyrepo umbrella**: surface as a data-quality gap; recommend backfill via /strap-refresh interview before proceeding (or accept manual CPO classification for the run).

### Phase 2: Sequence and present the execution plan

Sort the validated items by implementation order:

1. **Severity / priority** -- lower number first (Sev 1 before Sev 2).
2. **File conflicts** -- when two items touch the same file, sequence them rather than parallelize (avoid merge conflicts within the fix branch).
3. **Dependency** -- when fixing item A reveals or enables fixing item B, do A first.
4. **Layer ordering** -- backend changes before frontend changes that depend on them.
5. **Quick wins** -- a low-severity fix in the same file as a high-severity fix batches with it (same commit).

Identify the parallelism plan: items with no file conflicts and no dependencies can fan out in parallel via `CreateTeam`; everything else dispatches serial via `Task`.

When `stacked` was NOT specified, check whether any item touches files modified on the current local branch:

- Read the diff via local `git status` / `git diff`.
- Warn the CPO when overlap exists; recommend either `stacked` mode or waiting for the current branch's work to land first.

Present the execution plan to the CPO:

```
| Order | Id     | Type | Title    | Sev/Pri | Files (count + key paths) | Specialist        | Mode         |
|-------|--------|------|----------|---------|---------------------------|-------------------|--------------|
| 1     | 12345  | bug  | <title>  | Sev 1   | 2 files (auth/*)          | backend-engineer  | parallel-A   |
| 2     | 12346  | bug  | <title>  | Sev 2   | 1 file (ui/login.tsx)     | frontend-engineer | parallel-A   |
| 3     | 12347  | bug  | <title>  | Sev 2   | 1 file (auth/login.cs)    | backend-engineer  | serial after-1 (file conflict with item 1) |
```

Include source-control mode (default vs `stacked`), base branch, and the planned fix branch name. Wait for explicit CPO confirmation before any branch is created.

### Phase 3: Create the fix branch and worktree root (when parallel)

REPO_ROOT for this run is the install root on single-repo umbrellas, or `<umbrella>/<sub-repo-path>` on polyrepo umbrellas per Phase 1's classification (the one sub-repo all items share, or the CPO-chosen sub-repo on a cross-sub-repo run filtered to single-sub-repo scope). The dev-lead `Set-Location`s into REPO_ROOT (absolute path) before any git command in this Phase, per the v2.3.8 universal absolute-path discipline. Polyrepo umbrella roots are NOT git repos; `git` at the umbrella root fails. Per-sub-repo connection-profile overrides (Feature 3) apply when present.

1. **Determine the base branch:**
   - **Default mode**: base is `code-connection.yaml`'s `default_branch` on origin. PR target is the same branch. Per-sub-repo override (Feature 3) takes precedence when present.
   - **`stacked` mode**: base is the developer's currently checked-out branch in REPO_ROOT. PR target is the origin copy of that branch. Verify a clean working tree (`git status --porcelain` from REPO_ROOT); stop if uncommitted changes exist.
   - **Local Git profile** (`code-connection.yaml`'s `host: local-git`): same as default mode but no push; branch lives locally only. Phase 6's PR ceremony degrades per the profile's `operation_templates.pull_request_create.type: local-merge`.

2. **Render the fix branch name.** Combine `mapping.branch_prefix.fix` (e.g., `fix/`) with the run shape:
   - Multi-item run: `fix/bug-fixes-<YYYYMMDD>`.
   - Single-item run: `fix/<work-item-id>-<slug>` where `<slug>` is derived from the item's title.
   - Enhancement-only run: substitute `mapping.branch_prefix.feature` (e.g., `feature/`) when the convention prefers `feat/` for additive changes. Default behavior: use `fix/` for any run that includes at least one Bug.

3. **Always create a fresh branch. Never reuse an existing branch.** If the rendered name exists, append `-v2`; if that also exists, append a timestamp.

4. **Create and push (or just create, for Local Git) the branch:**
   - `git checkout -b <branch-name> <base>`
   - For remote profiles: `git push -u origin <branch-name>`. In `stacked` mode, also push the local base branch to origin first if absent.
   - For Local Git profile: skip the push.

5. **For parallel fan-out**, create the worktree root: `<repo-parent>/<repo-name>-worktrees/<fix-branch-slug>/` where `<repo-name>` is REPO_ROOT's basename (sub-repo name on polyrepo umbrellas). Per-specialist worktrees: `<worktree-root>/<specialist-name>-<work-item-id>/`. If project-profile.md's `Conventions` section declares a worktree-root override, use that instead.

   **CreateTeam name on polyrepo umbrellas**: `fix-bugs-<YYYYMMDD>-<run-slug>-<sub-repo-slug>` (sub-repo suffix appended) per v2.4 worktree mechanics conventions. The dev-lead is already `Set-Location`d into REPO_ROOT from this Phase; CreateTeam inherits that working directory.

6. **Transition every targeted item to `mapping.states.active`** via `operation_templates.work_item_update`. Apply `strap:active` tag where the host state machine collapses per `state_asymmetries`. Post the audit comment via `operation_templates.work_item_comment_add`:

   > `[STRAP/agent:dev-lead] State: new -> active (via /fix-bugs). Sequence position: <n>. Specialist: <name>. Mode: <parallel-X | serial after-<n> | dev-lead direct>.`

7. **Tell the CPO**: the branch name, the PR target, the worktree root (when parallel), and the sequence.

### Budget enforcement

Per [`budget-discipline.md`](../../strap/contexts/budget-discipline.md), `/fix-bugs` operates against two budgets pulled from `.claude/strap/state/usage.yaml` at workflow start. Defaults from `budget-discipline.md`'s defaults table: per-agent **200K**, session aggregate **1M**. The CPO can override via `/memory-refine dev-lead` (or, once `/revise-token-budget` ships, via that skill).

**Dispatch-time budget pull.** After Phase 3 completes (fix branch created, worktree root prepared when parallel) and before Phase 4 begins (specialist dispatch):

1. Read `.claude/strap/state/usage.yaml`. Pull `budgets.fix-bugs.per_agent` and `budgets.fix-bugs.session_aggregate`. Also pull `budgets.fix-bugs.agent_overrides` if present -- per-agent overrides established via `/revise-token-budget --agent <name>` take precedence over the workflow default at dispatch-time per-agent resolution (see `budget-discipline.md` "Per-agent overrides"). If `usage.yaml` is missing (the `/strap-in` scaffold step should have created it), surface the gap and stop with a recommendation to run `/strap-in` or `/strap-refresh`.
2. Initialize the `session` block:
   - `session.workflow: fix-bugs`
   - `session.workflow_instance: fix-bugs-<YYYYMMDD>-<run-slug>` (matches Phase 4's `CreateTeam` `team_name` for parallel runs)
   - `session.started_at: <ISO-8601 timestamp>`
   - `session.specialists_used: 0`
3. For every specialist that will be dispatched in this run, reset `agents.<name>.used_in_current` to `0` (preserve `agents.<name>.last_dispatch`). Specialists not in this run's roster are left untouched. Single-item dev-lead-direct runs skip steps 2-3 since no specialist budget is consumed.

**Per-agent budget in the dispatch brief.** Append a budget line to every specialist's brief, mirroring `/strap-in` Section 6. The effective `<per-agent-budget>` value resolves per `budget-discipline.md` "Dispatch-time resolution": `agent_overrides.<name>.per_agent` if present, else `per_agent`:

> "Your budget for this dispatch is `<per-agent-budget>` tokens. Include `tokens_used: ~XXk` as the final line of your finishing summary."

This carries the per-agent budget into the specialist's awareness and enforces the self-reporting contract that token accounting depends on. Per the agent-devs team rule, every specialist already self-reports the line; the brief makes the budget for THIS dispatch explicit.

**Token accounting.** When each specialist's `SendMessage` finishing report returns, parse the `tokens_used: ~XXk` line. Add to `agents.<name>.used_in_current`; sum into `session.specialists_used`. Update `agents.<name>.last_dispatch` to the dispatch's ISO timestamp. Persist after each specialist completes (not just at workflow end) so a session interruption preserves accurate state.

**60% session-aggregate checkpoint.** When `session.specialists_used` crosses 60% of the configured session aggregate (same threshold `/strap-in` Section 7 uses):

1. Surface to the CPO: "Specialists have consumed ~`<X>`K of the `<Y>`K session aggregate. Recommending checkpoint."
2. Run `/context-prep fix-bugs-<workflow-instance>` to capture in-flight workflow state (which items are resolved, which are in-flight, which are pending) in a continuation.
3. Instruct the CPO: "Run `/usage` to confirm your own window; then `/clear` and start a fresh session. On resume, run `/context-fetch fix-bugs-<workflow-instance>` first."
4. The CPO confirms or overrides. On override ("plenty of room, push through"), proceed and note the override in the continuation for future sessions to learn from.

**Per-agent exhaustion.** When `agents.<name>.used_in_current` reaches its per-agent budget for a specialist whose items in this run are not yet complete:

- Do NOT redispatch that specialist within this workflow instance.
- Work with what the specialist already produced; review the landed fixes normally.
- Note the exhaustion under `agents.<name>` in `usage.yaml` (e.g., add `exhausted_at: <ISO-timestamp>` to the agent's entry).
- Surface to the CPO that the specialist exhausted its budget mid-run so they can decide whether to revise the per-agent budget for the next workflow instance via `/revise-token-budget`.

Per-agent budget is per-workflow-instance, not per-session. After a 60% checkpoint, the new session reads `agents.<name>.used_in_current` to know how much each specialist has left in this run's instance.

**Workflow-completion close-out.** At the end of Phase 7 (Clean up), after the PR is opened:

- Write `session.completed_at: <ISO-8601 timestamp>` to `usage.yaml`.
- Preserve `agents.<name>.used_in_current` as the closing value -- it gets reset at the next workflow instance's dispatch-time budget pull.

**Per-skill tuning.** `/fix-bugs` runs shorter than `/execute-sprint`; the 200K per-agent budget is typically the more relevant constraint than the 1M session aggregate. Most fix-bugs runs comfortably finish within a single session. Per-agent exhaustion most often signals a Bug whose scope outgrew the `/fix-bugs` shape and should have been a Spec -- surface that learning at workflow close. Dev-lead-direct fixes (single-file simple changes per the Owner section) do not consume from `usage.yaml`; the CPO's `/usage` discipline is the only signal for dev-lead consumption (see `budget-discipline.md` "Who watches what").

### Phase 4: Execute the fixes

For each item in sequence order:

1. **Dev-lead direct (simple fixes).** Single file with a clear change, or no specialist mapping. The dev-lead implements directly: read the file, apply the change, author the test that asserts the fix, verify via the relevant active-domain build command. Commit on the fix branch with a traceable message: `fix(#<id>): <short description>` for Bugs, `feat(#<id>): <short description>` for Enhancements.

2. **Parallel specialist fan-out.** For items in the same `parallel-X` group:
   - `CreateTeam(team_name: "fix-bugs-<YYYYMMDD>-<run-slug>")` if not already created.
   - Spawn each item's specialist as a named teammate in a single batch. The brief includes:
     - The specialist's role contract path and operating-context paths (rules, memory, project-profile, active domain entry).
     - The work-item id, logical type, title, full description, severity / priority, root cause, affected files.
     - The assigned worktree path -- the specialist operates exclusively within that path.
     - The mandate to commit on the fix branch (the specialist branches from the fix branch within the worktree, applies the change, commits with `fix(#<id>): <short description>` or `feat(#<id>): <short description>`, and pushes -- or for Local Git, just commits locally).
     - The mandate to author the test that asserts the fix. Per the centralized-test-execution rule, the specialist WRITES the test; the dev-lead RUNS the suite at Phase 5.
     - The required `SendMessage` finishing report: what was changed, files touched, tests written, deviations from the work-item instructions, any blockers, and the `tokens_used: ~XXk` line. Per the agent-devs `SendMessage` rule, teammates must explicitly call `SendMessage` or the dev-lead waits indefinitely.

   **Substance retrieval after CreateTeam specialists go idle.** Full `SendMessage` bodies persist to `~/.claude/teams/<team-name>/inboxes/dev-lead.json` rather than arriving as conversation turns; idle preview turns are notifications only. Read the inbox file to retrieve specialist substance before review (step 4). Serial `Task` dispatch (step 3 below) does NOT exhibit this pattern -- full bodies arrive as turns. See dev-lead memory `operating_team_inbox_file_substance.md` for the full retrieval tradecraft.

3. **Serial specialist dispatch.** For items that depend on a prior item or share a file with an in-flight item: dispatch via `Task` (serial), wait for completion, review the change before moving on.

4. **Review every change** after each specialist completes or after direct implementation:
   - Read the diff; confirm the change addresses the root cause; check for unintended side effects.
   - Run the relevant active-domain build command (per project-profile.md) to confirm no compile errors.
   - When issues are found, repair them (re-dispatch the specialist via `SendMessage` with specific fixes, or fix directly for simple cases) before proceeding to the next item.

5. **Transition the item to `mapping.states.resolved`** via `operation_templates.work_item_update`. In the same update, populate `mapping.fields.completed_work` with the actual hours per the specialist's report (or the dev-lead's estimate for direct fixes). Apply `strap:resolved` tag where the host state machine collapses.

6. **Set v2.2 completion metadata on the item.** Parse the existing description's metadata table to preserve `authored_by` and `authored_at`. Re-render `bug.template.md` (Bugs) or the inline Enhancement description shape with the existing creation values plus:
   - `completed_by` -> the implementing specialist's name (or `dev-lead` for direct fixes)
   - `completed_at` -> ISO-8601 timestamp at the moment of resolution

   Convert markdown to HTML at the boundary if `mapping.field_formats.description` is `html`. Execute a second `operation_templates.work_item_update` with `id` and the revised `description`.

7. **Post the resolution audit comment:**

   > `[STRAP/agent:dev-lead] State: active -> resolved (via /fix-bugs). Completed By: <specialist | dev-lead>. Commit: <short-sha>. Fix branch: <branch-name>.`

### Phase 5: Centralized build and test

After every fix is committed:

1. **Build** the affected stack layers using the active-domain build commands from project-profile.md. Run only the domains that landed work in this run.
2. **Test** using the active-domain test commands. Per the agent-devs centralized-test-execution rule, only the dev-lead runs these.
3. **Review the cumulative diff** against the base branch. Surface the file count, line delta, and commit list to the CPO.

When any verification step fails, dispatch the responsible specialist via serial `Task` to repair (or fix directly for simple cases) before requesting CPO sign-off. Do not proceed to PR creation with failing builds or tests.

### Phase 6: PR preparation

On CPO approval of the verification summary:

1. **Render the PR description** to a temp file via the `Write` tool (per the agent-devs shell-environment rule, formatted descriptions never go through shell heredocs). Structured markdown body covering:
   - Run shape: Bug-only / Enhancement-only / mixed; item count; severity / priority distribution.
   - Per item: id, title, type, severity / priority, root cause summary, change summary, commit sha.
   - Test summary (counts per domain; any deviations from the centralized-test rule).
   - Closing token in the host's expected format (e.g., `Closes #<id>` per item for GitHub, `Related: AB#<id>` for Azure Repos paired with Azure DevOps).

2. **Create the PR via the source-control connection profile.** Render `code-connection.yaml`'s `operation_templates.pull_request_create` with placeholders:
   - `{{source_branch}}` -> the fix branch name
   - `{{target_branch}}` -> default branch (default mode) or current branch (`stacked` mode)
   - `{{title}}` -> `fix: <summary>` for Bug-only runs, `feat: <summary>` for Enhancement-only runs, `fix and enhance: <summary>` for mixed
   - `{{description}}` -> the rendered description (read from the temp file)
   - `{{linked_work_items}}` -> every targeted work-item id. The source-control profile records the cross-link to the work-tracking host when they differ.
   - `{{draft}}` -> true when the `draft` flag was supplied.

   For Local Git profile: execute the `local-merge` step sequence per the profile's `operation_templates.pull_request_create.steps`. Capture the merge commit hash as the "PR identifier" for hand-off.

3. **Update each work item with the PR reference** via `operation_templates.work_item_update` -- append the PR URL (or merge commit hash for Local Git) to the description footer, or set a dedicated field if `mapping.fields.pr_url` is declared in the profile.

4. **Post a per-item PR-link audit comment**:

   > `[STRAP/agent:dev-lead] PR opened: <pr-url-or-merge-hash> against <target-branch>. Awaiting CPO merge.`

5. **Report the PR id / URL (or merge commit hash) to the CPO** for human review.

### Phase 7: Clean up

1. **Shut down the agent team** (when one was created). `TeamDelete` to remove the team. If shutdown wedges, recommend `/team-cleanup`.
2. **Prune git worktrees** (`git worktree prune`) and remove the fix-branch worktree root directory (when parallel fan-out was used).

The items transition to `mapping.states.closed` only after the PR merges -- that transition is not part of this skill.

## Outputs

- A single fix branch containing one commit per work item (or grouped commits for batched fixes), pushed to the host source-control system (or held locally for Local Git profile).
- A pull request linked to every targeted work item (or a merge commit hash for Local Git), in `active` or `draft` status per flags.
- Every targeted work item in `mapping.states.resolved` with `completed_work` populated and the v2.2 lifecycle metadata block populated (`Completed By: <specialist | dev-lead>`, `Completed At: <ts>`); `strap:resolved` tag where the host state machine collapses.
- A `[STRAP/agent:dev-lead]` audit comment on each item recording the `new -> active` and `active -> resolved` transitions and the PR link.
- A verification summary delivered to the CPO covering build status, test status, and the cumulative diff.
- Worktrees pruned; the agent team deleted (when one was created).
- `.claude/strap/state/usage.yaml` updated with `session.completed_at`, the final per-agent `used_in_current` values, and any `exhausted_at` markers from specialists that hit their per-agent budget mid-workflow. (Skipped for single-item dev-lead-direct runs that did not initialize a session.)

## Quality gates

The skill is successful when all of the following hold:

- Both connection profiles were present at pre-flight.
- A fresh fix branch was created (never reused).
- Every targeted work item has a corresponding commit on the fix branch and is in `mapping.states.resolved` with v2.2 completion metadata populated.
- The centralized build and test commands passed on the final commit before PR creation.
- The PR (or local-merge) exists, is linked to every work item, and was created via `code-connection.yaml`'s `operation_templates.pull_request_create`.
- Every persisted state transition carries a `[STRAP/agent:dev-lead]` comment via `operation_templates.work_item_comment_add`.
- The existing `Authored By` / `Authored At` from `/file-bugs` were preserved across every update.
- Markdown-to-HTML conversion was applied for HTML-flavored description fields.
- The `strap:<logical-state>` tag was applied at each transition where the host state machine collapses.
- No work item was advanced past `mapping.states.resolved` -- closure happens after PR merge.
- `tokens_used: ~XXk` reporting was captured for every specialist dispatch (or its absence noted as a budget-tracking warning per Failure handling). Dev-lead-direct runs are not budgeted by this gate.
- The session aggregate stayed within budget OR the 60% checkpoint was offered to the CPO when crossed.
- Requires the harness team primitive (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` + valid `CLAUDE_CODE_SPAWN_BACKEND`) when parallel fan-out is in scope; single-item dev-lead-direct runs do not require it.

## Failure handling

- **Either connection profile missing**: stop. Recommend `/connect-devops-project` or `/connect-code-repo` per the gap.
- **Any item lacks logical type `bug` or `enhancement`**: skip with a clear message; the skill is not a general implementer.
- **Any item is in state `resolved` or `closed`**: skip with a warning; the CPO can re-open manually if intentional.
- **Any item lacks minimum implementable detail** (root cause + at least one affected file): dispatch spec-lead serial-Task read-only to investigate and update the description before proceeding. If investigation cannot recover enough detail, surface the gap and stop.
- **The CPO declines the execution plan**: stop; no branch is created; no state transitions land.
- **Branch creation fails** (collision or push rejection): retry with the `-v2` / timestamp suffix per Phase 3 step 3; on persistent failure, surface the host error verbatim and stop.
- **`operation_templates` rendering produces malformed requests**: surface the failing template path and request body; do not execute.
- **HTML conversion fails**: surface the offending content; do not post raw markdown into an HTML-flavored field.
- **A specialist fails to call `SendMessage` and the dev-lead is left waiting**: treat extended silence as a wedged teammate; recover via `/team-cleanup`.
- **Build or test fails after a fix**: dispatch the responsible specialist (or fix directly for simple cases); the PR is not created until everything passes.
- **`pull_request_create` is unsupported by the source-control profile**: stop and surface the gap; the items stay in `resolved` with all work merged on the fix branch; the CPO opens the PR manually using the host's UI.
- **`CreateTeam` fails for parallel fan-out**: surface the actionable error naming the offending settings layer; offer to fall back to serial dispatch.
- **A specialist returns without the `tokens_used: ~XXk` line**: treat as a budget-tracking warning; the run continues but the dev-lead estimates that specialist's consumption manually and notes the gap under `agents.<name>` in `usage.yaml`.
- **A specialist exhausts its per-agent budget mid-workflow**: do not redispatch within this workflow instance; work with what the specialist produced; surface the exhaustion to the CPO so the budget can be revised via `/revise-token-budget` for the next instance.
- **`.claude/strap/state/usage.yaml` missing**: surface the gap; the install scaffold step in `/strap-in` should have created it. Recommend re-running `/strap-in` or `/strap-refresh` to restore the file before proceeding.

## References

- Source items: `$ARGUMENTS` (logical types `bug` and `enhancement`).
- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- dev-lead guardrails: [`../../strap/rules/agents/dev-lead.md`](../../strap/rules/agents/dev-lead.md).
- agent-devs team rules: [`../../strap/rules/agent-devs.md`](../../strap/rules/agent-devs.md) -- centralized test execution, PR creation rule, `SendMessage` discipline.
- Project profile (active domains + specialists + build/test): [`../../strap/contexts/project-profile.md`](../../strap/contexts/project-profile.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Source-control connection profile: `.claude/strap/state/code-connection.yaml`.
- Bug template: `.claude/strap/templates/work-items/bug.template.md`.
- Upstream skill: [`../file-bugs/SKILL.md`](../file-bugs/SKILL.md).
- Sibling skill (heavier-weight): [`../execute-sprint/SKILL.md`](../execute-sprint/SKILL.md).
- Sibling skill (single-motion atomic intake-plus-fix): [`../quick/SKILL.md`](../quick/SKILL.md) -- for DO-NOW work that bypasses the file-bugs / fix-bugs split.
- Downstream skills:
  - [`../refine-pr/SKILL.md`](../refine-pr/SKILL.md) -- address reviewer feedback on the resulting PR.
  - [`../dora-reconcile/SKILL.md`](../dora-reconcile/SKILL.md) -- daily reconcile lands the Bug/Enhancement Resolved cascade hygiene (Pass G stamps FinishDate; Pass H stamps wall-clock CompletedWork on AI-tagged items).
  - [`../close-ceremony/SKILL.md`](../close-ceremony/SKILL.md) -- the CPO ritual that takes the Bug/Enhancement from Resolved to Closed (the QA/CPO verification gate that `/fix-bugs` defers per the v2.2 state convention).
- Recovery primitive for wedged teammates: [`../team-cleanup/SKILL.md`](../team-cleanup/SKILL.md).
- Onboarding design (connection-discovery model + profile shape): [`../../strap/contexts/onboarding-design.md`](../../strap/contexts/onboarding-design.md).
- Budget discipline (cross-cutting): [`../../strap/contexts/budget-discipline.md`](../../strap/contexts/budget-discipline.md).
