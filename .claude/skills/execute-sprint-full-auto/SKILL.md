---
name: /execute-sprint-full-auto
description: One-shot Spec-to-PR motion. From a Resolved Spec, the dev-lead generates Features, decomposes each, allocates everything into the current iteration, executes against the contract across all Features in parallel, and opens one draft PR per Feature -- without per-phase CPO approval gates. The Resolved Spec IS the contract; approval gates collapse to dev-lead authority; safety perimeter (no auto-merge, no Spec mutation, security-Critical/High blocks, new-domain activation halts) is non-negotiable; Spec-ambiguity halts interrupt only when the contract turns out to be incomplete.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
argument-hint: <spec-id>
---

# /execute-sprint-full-auto

## Purpose

Full Auto is STRAP's autonomy uplift on top of the canonical Spec-to-PR composition. The CPO has a Resolved Spec and wants to walk away while the dev-lead executes it end-to-end. One invocation; one entry-gate approval; the dev-lead drives the rest -- generation, decomposition, sprint allocation, parallel execution, draft PRs -- on the authority delegated by the Resolved Spec.

**Position against sibling skills:**

- [`/quick`](../quick/SKILL.md) is the single-motion lever for **free-form input** (description in, PR out). It requires classification because the input shape is unknown. Full Auto is its opposite -- the input is a Resolved Spec, the shape is known, classification is unnecessary, and the work spans many items.
- [`/execute-sprint`](../execute-sprint/SKILL.md) drives a **single sprint-allocated Feature** to PR. Full Auto runs N Features through the equivalent motion concurrently after generating and decomposing them in-line.
- [`/generate-features`](../generate-features/SKILL.md) + [`/decompose-feature`](../decompose-feature/SKILL.md) + [`/plan-sprint`](../plan-sprint/SKILL.md) + `/execute-sprint` is the canonical Production Workflow run manually with a CPO approval gate at every phase boundary. Full Auto is the deliberate composition that **collapses those approval gates to dev-lead authority while preserving the safety perimeter**.

**The contract.** The Resolved Spec is the contract. The dev-lead acts on it. Approval gates collapse because the CPO already approved the contract by resolving the Spec; re-approving the same intent at every phase boundary adds no signal. What does NOT collapse:

- **No auto-merge.** PRs land as drafts. The CPO is the deliberate gatekeeper at merge time.
- **No bypass of `security-reviewer` Critical/High.** Findings block the affected work item from Resolving until cleared.
- **No Spec mutation during the run.** The Spec is locked. Mid-run Spec edits happen only via the Ambiguity Halt Protocol "Clarify here" branch, which is explicit and audited.
- **No silent new-domain activation.** A Spec requiring a new specialist domain is a structural change to the project; that halts and surfaces to the CPO.
- **No skip of test execution.** Centralized build-and-test runs per Feature per [`/execute-sprint`](../execute-sprint/SKILL.md) Phase 5; failures halt before PR creation.

**The autonomy.** Within the safety perimeter, the dev-lead:

- Generates Features from Spec Constituent Parts without per-Feature brief approval.
- Decomposes each Feature without per-decomposition approval.
- Allocates everything into the current iteration without capacity-review gate.
- Executes Features in parallel (one team + worktree + branch + PR per Feature) without per-task CPO approval -- per-task dev-lead REVIEW gates remain because they are quality gates, not approval gates.
- Resolves Stories and Tasks on completion with v2.2 lifecycle metadata.
- Opens one draft PR per Feature with the Run Manifest in the description.

**The interrupts.** Full Auto halts and surfaces ONLY when:

- The Spec turns out to be ambiguous, incomplete, or contradictory mid-decomposition (Spec-Ambiguity Halt Protocol).
- A safety-perimeter rule trips (Safety-Perimeter Halts section).
- Budget exhaustion crosses 60% of the session aggregate (Budget enforcement section).

**Async observability.** The dev-lead emits structured checkpoint summaries at every phase boundary so the CPO can read the run in real-time without breaking flow. Checkpoints are output-only; they do not stop the run.

The skill ships portable. Every adopter-specific concern resolves at runtime:

- Specialist roster comes from `project-profile.md`'s `Domains` section (single-repo) or per-sub-repo `Active domains` (polyrepo umbrellas).
- Work-tracking operations render through `operation_templates.<op>` in `.claude/strap/state/devops-connection.yaml`.
- Branch and PR operations render through `operation_templates.<op>` in `.claude/strap/state/code-connection.yaml`.
- Type, state, field, link, and parent mappings come from `mapping.*` in both profiles; `state_asymmetries` covers host collapses.
- Markdown-to-HTML conversion is applied at the boundary for HTML-flavored description fields.
- v2.2 lifecycle metadata (`Authored By`, `Authored At`, `Completed By`, `Completed At`) is rendered into every work-item description; state-change audit lives in work-item comments tagged `[STRAP/agent:<name>]`.
- Build and test commands come from `project-profile.md`'s `Build and test` section (per active domain).

## Owner

**dev-lead.** When the skill is invoked the orchestrator IS the dev-lead. The skill inlines the orchestration of [`/generate-features`](../generate-features/SKILL.md), [`/decompose-feature`](../decompose-feature/SKILL.md), [`/plan-sprint`](../plan-sprint/SKILL.md), and [`/execute-sprint`](../execute-sprint/SKILL.md) -- using the same primitives (`operation_templates.*`, `CreateTeam`, worktree mechanics, centralized test execution) -- with collapsed approval gates and `full-auto`-tag stamping at every persist.

The skill does NOT call the underlying skills via `Skill` invocation. Cross-skill invocation would reintroduce the per-skill CPO approval gates the Full Auto contract is designed to collapse. Instead, the body of this skill references those skills' phase numbers and patterns as the canonical bodies; Full Auto's body documents only the orchestration shape and the deviations from per-skill behavior.

## Inputs

- `$ARGUMENTS` -- the Resolved Spec work item identifier. Required. No flags.
- `.claude/strap/contexts/project-profile.md` -- source of truth for active domains, their specialist rosters, stack particulars, and build/test commands. On polyrepo umbrellas, also the `Sub-repos` section + `depends_on` graph.
- `.claude/strap/state/devops-connection.yaml` -- work-tracking connection profile. Required fields used by this skill: `mapping.work_item_types.{spec,feature,story,task}.host_type`, `mapping.field_formats.description`, `mapping.states.{new,active,resolved}`, `mapping.state_asymmetries`, `mapping.fields.{original_estimate,completed_work,assigned_to,iteration,sub_repo}`, `mapping.default_parents.{feature}`, `mapping.link_types.{parent,related,predecessor,successor}`, `mapping.area_path_root`, `operation_templates.{work_item_read,work_item_create,work_item_update,work_item_comment_add,work_item_link_add,work_item_query,iteration_list}`.
- `.claude/strap/state/code-connection.yaml` -- source-control connection profile. Required fields: `host`, `host_url`, `default_branch`, `mapping.branch_prefix.{feature}`, `capabilities.{branch_create,branch_push,pull_request_create}`, `operation_templates.pull_request_create`.
- `.claude/strap/state/usage.yaml` -- token-budget state file (initialized by `/strap-in`). Full Auto initializes a session entry on every run.
- `.claude/strap/templates/work-items/{feature,story,task}.template.md` -- description body templates consumed during persistence.

## Pre-flight

Full Auto's preconditions are stricter than `/quick` or `/execute-sprint` because the run is long and the autonomy is real. Every precondition is a hard refusal -- never soft-skip.

1. **Both connection profiles exist.** If `devops-connection.yaml` is missing, redirect to `/connect-devops-project`. If `code-connection.yaml` is missing, redirect to `/connect-code-repo`.
2. **`git --version` succeeds.** Branch, worktree, and (for remote profiles) push operations depend on git.
3. **Parallel agent teams required.** The effective resolved env (`~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json`) must carry `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and a valid `CLAUDE_CODE_SPAWN_BACKEND` (`auto`, `tmux`, or `in-process`). Phases 4 and 6 depend on `CreateTeam`. Single-specialist runs are not a valid Full Auto degradation; if the env is missing, refuse and direct the CPO at re-running the installer or editing the offending settings layer.
4. **`$ARGUMENTS` resolves to a Spec in logical state `resolved`.** Render `operation_templates.work_item_read` with `id=$ARGUMENTS`. Validate: `host_type` matches `mapping.work_item_types.spec.host_type`; logical state matches `mapping.states.resolved`. If the work item is not a Spec, refuse with the resolved type and recommend `/refine-requirement` / `/create-spec` for the originating chain. If the Spec is in any state other than `resolved` (e.g., `active`, `new`), refuse with the current state and recommend `/refine-spec <spec-id>`. **The Resolved-Spec precondition is the contract; the skill cannot run on an unfinished Spec.**
5. **`usage.yaml` exists.** Full Auto is the most expensive workflow; budget enforcement is mandatory, not soft. If `usage.yaml` is missing (the `/strap-in` scaffold step should have created it), surface the gap and recommend `/strap-in` or `/strap-refresh`.
6. **Current iteration resolvable.** Render `operation_templates.iteration_list` with `timeframe: current` per the host's semantics. The single returned iteration is the allocation target for Phase 5. If `capabilities.iteration_list: unsupported` for the host, refuse -- Full Auto requires sprint allocation by design.
7. **CPO assignee resolvable.** The "developer running the sprint" identity must be resolvable from one of:
   - `az account show` for Azure DevOps hosts (the `userPrincipalName` field).
   - The connection profile's `defaults.assigned_to` field when declared (Local strap-agile, GitHub Issues, Jira when configured).
   - As last resort, `git config user.email`.
   - On polyrepo umbrellas: the umbrella-level work-tracking host has one assignee per run -- assignment is uniform across all created items.
   - If no identity can be resolved, refuse and recommend the CPO configure the host CLI defaults or the connection profile.
8. **Required tools present.** Standard STRAP runtime: `Task` / `Agent`, `CreateTeam`, `AskUserQuestion`, `SendMessage`. These are baseline STRAP dependencies; the install scaffolding should have provisioned them. If any are missing, refuse and direct at the harness configuration.

## Workflow

### Phase 1: Read the Resolved Spec and draft the Run Contract

The dev-lead reads the Resolved Spec, walks Constituent Parts, identifies the Feature shape Phase 3 will generate, resolves activated domains, and drafts the **Run Contract** the CPO approves at Phase 2.

1. **Read the Spec.** Render `operation_templates.work_item_read` for the Spec. Capture: title, description body, all Constituent Part sections (`client-ui`, `api`, `core`, `data`, `infrastructure`, `integrations`, etc.), Acceptance Criteria, Mockup Reference table (when present), Mockup Wiring Guide (when present), `linked` Requirement, existing Feature children (Spec re-runs should be rare but possible). For polyrepo umbrellas, parse each Constituent Part section's `[sub-repo: <slug>]` annotation per [`/decompose-feature`](../decompose-feature/SKILL.md) Phase 1 step 4. If existing Features are present linked to this Spec, refuse with the existing chain id list -- Full Auto on a Spec that already has Features generated would create duplicates; recommend `/reset-feature` per Feature or `/execute-sprint` per existing Feature.
2. **Infer the Feature shape.** Group Constituent Parts into Feature briefs per `/generate-features` Phase A semantics. The grouping heuristic: parts that share a Spec section or a coherent business capability cluster into one Feature; parts that span multiple sections with distinct intent become separate Features. Polyrepo Constituent Parts with multi-slug annotations split into per-sub-repo Tasks at decomposition time (Phase 4), but at this stage the Feature grouping is by capability, not by sub-repo.
3. **Resolve activated domains.** Walk the inferred Feature shape and identify the canonical domain each Constituent Part requires. Check `project-profile.md`'s `Domains` section (single-repo) or per-sub-repo `Active domains` (polyrepo). If any required domain is NOT active in its scope, halt Phase 1 with a **Safety-Perimeter Halt: new domain activation required**. The CPO must run the domain-activation ceremony manually via [`/decompose-feature`](../decompose-feature/SKILL.md) Phase 2 on a single Feature, OR explicitly add the domain to `project-profile.md` before re-invoking Full Auto. Mid-Full-Auto domain activation is forbidden because it introduces unreviewed specialist context into a long-running autonomous workflow.
4. **Resolve the current iteration.** Captured at pre-flight; carry into the Run Contract.
5. **Resolve the CPO assignee.** Captured at pre-flight; carry into the Run Contract.
6. **Resolve polyrepo cluster scope.** On polyrepo umbrellas, compute the unique set of sub-repo slugs across all Constituent Parts. Carry as `coordinated_sub_repos` state. Per-Feature execution in Phase 6 may operate single-sub-repo (Feature scoped to one slug) or coordinated (Feature spans multiple slugs) -- the per-Feature decomposition in Phase 4 determines which.
7. **Draft the Run Contract.** Render the contract as a structured summary the CPO sees at the Phase 2 gate:

```
Full Auto Run Contract

Spec:          #<spec-id> -- "<spec-title>"
               State: resolved
               Constituent Parts: <count>
               Acceptance Criteria: <count>
               Mockups: <count> referenced (or "none")

Planned Features (<count>):
  1. <draft Feature title>
       Constituent Parts: <list>
       Activated domains: <list>
       Estimated scope: <stories>S / <tasks>T / <hours>h
       Sub-repo(s): <list>          (polyrepo only)
  2. <draft Feature title>
       ...

Activated domains (run total): <union of all Feature domains>
Target iteration: <iteration name> -- ends <YYYY-MM-DD>
Assignee:        <CPO host-identity>
Run tag:         full-auto (applied to every item created during this run)

Polyrepo:        <single-repo | single-sub-repo: <slug> | coordinated: <slug list>>
                 (polyrepo umbrellas only)

Surfacing rules:
  Halt on:
    - security-reviewer Critical/High finding
    - Spec ambiguity, incompleteness, or contradiction surfaced mid-decomposition
    - New domain activation required (Spec implies a domain not yet active)
    - Spec mutation attempted outside the Ambiguity Halt "Clarify here" branch
    - pull_request_create unsupported by source-control profile
    - CreateTeam failure (Full Auto requires parallel fan-out)
    - 60% session-aggregate budget checkpoint
  Run autonomously through:
    - Feature brief authoring + persistence (no per-Feature approval gate)
    - Per-Feature decomposition + persistence (no per-decomposition approval gate)
    - Sprint allocation (no capacity-review gate)
    - Parallel Feature execution (per-task dev-lead review gates remain)
    - Centralized test execution per Feature (failure halts before PR)
    - Per-Feature draft PR creation with Run Manifest in description

Estimated run shape:
  Features:        <count>
  Stories:         ~<count> (sum of per-Feature decomposition estimates)
  Tasks:           ~<count> (sum)
  Specialists:     ~<count> distinct (union of all Feature domain rosters)
  Wall-clock:      ~<estimated hours>h (driven primarily by Phase 6 parallel execution)
  Token budget:    300K per-agent / 3M session aggregate (Full Auto defaults)
```

Surface the Run Contract to the CPO via conversation output ahead of the Phase 2 gate. The contract is the entire surface the CPO approves; Phase 2 references it directly.

### Phase 2: The single CPO entry gate

Full Auto's only explicit CPO approval gate. The CPO sees the Run Contract and decides go/no-go.

Use `AskUserQuestion`:

- `Execute the contract` -- the run begins; the CPO can walk away.
- `Modify the contract` -- the CPO names scope changes (skip a Feature, narrow scope to a subset of Constituent Parts, change iteration, change assignee). The dev-lead re-renders the contract with the changes applied and re-presents Phase 2. Note: modification cannot ALTER the Spec -- the Spec is locked. Modification only adjusts what subset of the Spec this run targets.
- `Cancel` -- exit cleanly. No persistence. No branches.

After the Phase 2 gate clears, the dev-lead does not ask for further approval. Subsequent halts are interrupts (safety perimeter, Spec ambiguity, budget), not gates.

### Phase 3: Generate Features (per-Feature persistence, no approval gate)

Inlines [`/generate-features`](../generate-features/SKILL.md) Phase A semantics with collapsed gates.

1. **Dispatch spec-lead for Feature brief authoring.** Dispatch via serial `Task` (one specialist; no team needed for this phase). Brief covers:
   - The full Spec body (title, description, Constituent Parts, AC, mockups, linked Requirement).
   - The CPO-approved Feature grouping from Phase 1 step 2.
   - The mandate to author per-Feature brief sections (title, scope summary, rationale, active-domain notes, mockup-as-contract notes) per `/generate-features` Phase A's contract.
   - The **Full Auto operating-mode addendum** (load-bearing for safety): "You are operating under /execute-sprint-full-auto. Dev-lead is acting on Spec-as-contract authority and will not present briefs to the CPO for per-Feature approval. Surface any ambiguity, incompleteness, or contradiction in the Spec EXPLICITLY in your finishing SendMessage `Notes:` section. Such gaps will trigger a Spec-Ambiguity Halt -- it is BETTER to halt the run than to author a brief that papers over a Spec defect."
   - The required `SendMessage` finishing report with `Briefs:` (one per planned Feature), `Notes:` (ambiguities, mockup-not-referenced cases, anything load-bearing for safety), and `tokens_used: ~XXk`.
2. **Process the spec-lead's return.**
   - If `Notes:` contains any ambiguity/incompleteness/contradiction signals → fire the Spec-Ambiguity Halt Protocol.
   - If clean → proceed to persistence.
3. **Persist Features.** For each Feature brief:
   - Render `feature.template.md` with the brief content + v2.2 lifecycle-metadata block (`Authored By: dev-lead, via /execute-sprint-full-auto`, `Authored At: <ISO-8601>`).
   - Convert markdown → HTML at the boundary if `mapping.field_formats.description` is `html`.
   - Render `operation_templates.work_item_create` with `host_type` = `mapping.work_item_types.feature.host_type`, parent = `mapping.default_parents.feature`, state = `mapping.states.new`, tags = `AI; strap:feature; full-auto`, area_path = `mapping.area_path_root`, iteration_path = current iteration, assigned_to = CPO identity.
   - On polyrepo umbrellas, set `mapping.fields.sub_repo` if the Feature is single-sub-repo. Coordinated-sub-repo Features stamp `sub_repo` at Task level during Phase 4.
   - Render `operation_templates.work_item_link_add` to link the Feature `related` to the source Spec.
   - Audit comment via `operation_templates.work_item_comment_add`: `[STRAP/agent:dev-lead] Feature created (via /execute-sprint-full-auto). Authored By: dev-lead. Run tag: full-auto. Source Spec: #<spec-id>.`
4. **Emit checkpoint.** Phase 3 boundary:

```
[CHECKPOINT: Phase 3 -- Features generated]
  Features created: #<id1>, #<id2>, ..., #<idN>
  Tag stamp:        AI; strap:feature; full-auto
  Tokens used:      ~<X>k / 3000k session aggregate
  Time elapsed:     <Hh Mm>
  Next:             Phase 4 -- decompose Features serially
```

### Phase 4: Decompose each Feature (serial across Features; parallel within each)

For each Feature created in Phase 3, in sequence (one at a time), inline [`/decompose-feature`](../decompose-feature/SKILL.md) Phases 3 through 8 with collapsed gates. Phase 2's domain-activation gate from `/decompose-feature` is NOT inlined -- domain activation is a Phase 1 safety-perimeter halt for Full Auto.

**Serial across Features** because: decomposition is read-only planning, ambiguity detection is per-Feature, and serial execution produces coherent checkpoint output + clean failure handling (if Feature C surfaces ambiguity, dev-lead is not mid-flight on D, E, F). Marginal time savings from parallelizing decomposition do not outweigh the orchestration complexity and observability cost.

**Parallel within each Feature** because: that is the existing `/decompose-feature` pattern. Specialists fan out via `CreateTeam` for read-only Constituent-Part planning. No regression.

For each Feature (in created order):

1. **Read the Feature and its linked Spec section context.** Per `/decompose-feature` Phase 1: read the Feature description + the slice of the Spec the Feature represents (its Constituent Parts).
2. **Build the per-sub-repo + per-Constituent-Part dependency graph** (polyrepo only). Per `/decompose-feature` Phase 1 step 5: dependency-phrase parsing from Spec section bodies.
3. **Dispatch specialists for read-only Constituent-Part planning.** Per `/decompose-feature` Phases 3-5: identify each Constituent Part's required specialist; dispatch in parallel via `CreateTeam(team_name: "full-auto-decompose-<feature-id>")`. Each brief carries the operating-mode addendum:
   - The Constituent Part the specialist owns (verbatim Spec section).
   - The mandate to produce Stories + Tasks proposals with `original_estimate`, dependency declarations, file-level scope.
   - The **Full Auto operating-mode addendum**: "You are operating under /execute-sprint-full-auto. Dev-lead is acting on Spec-as-contract authority and will not present decompositions to the CPO for per-Feature approval. If the Spec section you own is ambiguous, incomplete, or contradicts another section, surface it EXPLICITLY in your `Notes:` -- such gaps trigger a Spec-Ambiguity Halt. Decomposing on top of a defective Spec section produces Tasks that will fail at execution; halting is the better outcome."
   - The required `SendMessage` finishing report per the standard contract + `tokens_used: ~XXk`.
4. **Wait for all specialists in the team to return.** Aggregate proposals.
5. **Process specialist returns.**
   - If any specialist's `Notes:` carries ambiguity/incompleteness/contradiction signals → fire the Spec-Ambiguity Halt Protocol for this Feature.
   - If clean → proceed.
6. **Reconcile cross-specialist dependencies.** Per `/decompose-feature` Phase 6: build the dependency graph from the aggregated proposals + the per-sub-repo `depends_on` graph + Spec-traced edges + specialist-authored declarations. Detect cycles → if a cycle surfaces here, treat as a Spec-Ambiguity Halt (decomposition cannot proceed).
7. **Persist Stories and Tasks.** Per `/decompose-feature` Phases 7-8: render templates, convert at the boundary, create work items via `operation_templates.work_item_create`, link parents, set `original_estimate`, set `assigned_to` (CPO identity), set `iteration_path` (current iteration), set `mapping.fields.sub_repo` per polyrepo annotation, set `predecessor` / `successor` links per the dependency graph, set tags = `AI; strap:story; full-auto` (Stories) and `AI; strap:task; full-auto` (Tasks).
8. **Audit comments.** Per item: `[STRAP/agent:dev-lead] <Story|Task> created (via /execute-sprint-full-auto). Parent: #<feature-or-story-id>. Authored By: dev-lead. Run tag: full-auto.`
9. **Tear down the decomposition team** via `TeamDelete`. Prune worktrees if the team used any (decomposition is read-only so worktrees are unusual at this phase, but the cleanup is defensive).
10. **Emit checkpoint.** Per-Feature decomposition boundary:

```
[CHECKPOINT: Phase 4 -- Feature #<id> decomposed]
  Stories created:  <count> (#<id1>, #<id2>, ...)
  Tasks created:    <count> (#<id1>, ...)
  Specialists:      <list>
  Sub-repos:        <list>  (polyrepo only)
  Decomposition tokens used: ~<X>k
  Run total tokens: ~<Y>k / 3000k
  Time elapsed:     <Hh Mm>
  Next:             Phase 4 continues -- decompose Feature #<next-id> ... | OR | Phase 5 -- sprint allocation (all Features decomposed)
```

After all Features decomposed: emit a Phase 4 summary checkpoint listing total Stories + total Tasks + total specialists dispatched + Phase 4 cumulative tokens.

### Phase 5: Sprint allocation (current iteration; all items)

Inlines [`/plan-sprint`](../plan-sprint/SKILL.md) with the capacity-review gate collapsed and the allocation deterministic ("everything into current").

1. **Verify allocation already applied.** Stories and Tasks created in Phase 4 should already have `iteration_path` set to the current iteration (Phase 4 step 7 stamps it). Walk every Phase 4 item and confirm. If any item missed allocation due to a transient host failure, render `operation_templates.work_item_update` to re-stamp the iteration_path.
2. **Verify assignee on every item.** Walk every Phase 4 item and confirm `assigned_to` = CPO identity. Re-stamp any item that missed it.
3. **Confirm `full-auto` tag on every item.** Walk every Phase 3 + Phase 4 item (Features, Stories, Tasks). Confirm the `full-auto` tag is present. Re-stamp any item that missed it.
4. **No capacity-review gate.** The CPO accepted scope at Phase 2. Capacity overage in the current iteration is acceptable in Full Auto -- the workflow's contract is the Spec, not the iteration capacity. (If the CPO needs to rebalance later, `/rebalance-sprint` is the dedicated lever.)
5. **Single audit comment on each Feature.** `[STRAP/agent:dev-lead] Sprint allocation (via /execute-sprint-full-auto): <S> Stories and <T> Tasks allocated to iteration <iteration-name>; assigned to <CPO identity>; run tag full-auto.`
6. **Emit checkpoint.** Phase 5 boundary:

```
[CHECKPOINT: Phase 5 -- Sprint allocation complete]
  Iteration:        <iteration name> (ends <YYYY-MM-DD>)
  Assignee:         <CPO identity>
  Total items:      <F> Features + <S> Stories + <T> Tasks
  Tag verified:     full-auto on all items
  Tokens used:      ~<X>k / 3000k
  Time elapsed:     <Hh Mm>
  Next:             Phase 6 -- parallel Feature execution (<F> teams concurrent)
```

### Phase 6: Execute the sprint (parallel across Features; parallel within each)

The throughput phase. For every Feature created in Phase 3, inline [`/execute-sprint`](../execute-sprint/SKILL.md) Phases 3 through 7 in **parallel across Features**. Each Feature gets its own `CreateTeam` cluster, its own worktree root, its own feature branch, its own per-task review pass, its own centralized test pass, its own integration audit, and its own draft PR.

**Parallel across Features** because: this is the throughput uplift Full Auto delivers. The mechanics already exist -- `/execute-sprint` coordinated-mode (polyrepo) runs N teams concurrently across N sub-repos; Full Auto applies the same pattern across N Features in (typically) a single repo. The per-team isolation (separate worktree, separate branch) eliminates conflict surface.

**Parallel within each Feature** because: that is the existing `/execute-sprint` Phase 4 wave dispatch pattern. Specialists fan out via the per-Feature team. No regression.

For all Features concurrently:

1. **Per-Feature branch + worktree ceremony.** Per `/execute-sprint` Phase 3: render the feature branch name from `mapping.branch_prefix.feature` + the Feature id + a slug from the Feature title (e.g., `feature/12345-add-tenant-isolation-to-audit-log`); `git checkout -b <name> <base>` where `<base>` is `default_branch` from `code-connection.yaml`; `git push -u origin <name>` for remote profiles; create a worktree root sibling to the repo (`<repo-parent>/<repo-name>-worktrees/full-auto-<feature-id>/` or per project-profile.md `Conventions` override). On polyrepo coordinated-mode Features, per-sub-repo branches + worktrees per `/execute-sprint` Phase 3's coordinated-mode walk.
2. **Per-Feature team dispatch.** Per `/execute-sprint` Phase 4 step 1: `CreateTeam(team_name: "full-auto-exec-<feature-id>")`. Spawn the wave-1 Task implementers (no predecessors) as named teammates in a single batch. Each brief carries:
   - The Task body (title, description, AC, files in scope, sub_repo scope).
   - The parent chain (Feature → Story → Task ids).
   - The worktree path (absolute).
   - The implementation mandate: commit on the feature branch with message `feat(#<task-id>): <description>` (or `fix:` / `docs:` / `test:` per the Task body's nature).
   - The mandate to author the test that asserts the change (centralized test execution -- specialist WRITES the test, dev-lead RUNS the suite at Phase 6 step 4).
   - The **Full Auto operating-mode addendum**: "You are operating under /execute-sprint-full-auto. Dev-lead is acting on Spec-as-contract authority. If your Task's Spec context is ambiguous, incomplete, or contradicts what you observe in the codebase, surface it EXPLICITLY in your `Notes:` -- such gaps trigger a Spec-Ambiguity Halt during dev-lead's per-task review (Phase 6 step 3). Implementing on a defective contract produces Tasks that fail at test or AC walk."
   - The required `SendMessage` finishing report + `tokens_used: ~XXk`.
3. **Per-Feature wave loop.** Per `/execute-sprint` Phase 4 steps 2-3: as wave-N Tasks complete, dispatch wave-(N+1) Tasks (predecessors satisfied). Dev-lead reviews each Task branch as the specialist returns -- this is a QUALITY gate, not a CPO-approval gate; it stays. Review covers: did the specialist implement what the Task says? Are tests authored? Are there ambiguity signals in `Notes:`? Are there security-relevant changes that should pre-trigger a security-reviewer dispatch?
4. **Per-Feature centralized test pass.** Per `/execute-sprint` Phase 5 step 1: when all Tasks in the Feature complete, dev-lead runs the relevant active-domain build + test commands per project-profile.md's `Build and test` section against the Feature branch. On polyrepo coordinated-mode Features: per-sub-repo build + test against each sub-repo's branch. On test failure: HALT this Feature (Halt-and-report section); do NOT proceed to PR for this Feature; do NOT block other Features' parallel execution (each Feature's run is independent).
5. **Per-Feature integration audit.** Per `/execute-sprint` Phase 5 step 2: dev-lead reviews the Feature branch holistically for cross-task coherence; runs the AC walk (every AC item from the Spec section the Feature implements is traceable to landed code + landed tests). Failures here halt the Feature.
6. **Per-Feature security review.** When any landed change touches authentication, authorization, data access, secret handling, input validation, or the API surface, dispatch `security-reviewer` serial-Task against the Feature branch. Findings:
   - **Critical/High**: HALT this Feature. Tag the responsible Task(s) with `security-critical` or `security-high`. Surface to the CPO via the Halt-and-report mechanism. The Feature's branch and items are preserved; the CPO addresses the finding via `/fix-bugs` against a follow-up Bug + new commits to the same branch.
   - **Medium/Low**: append to the PR description as advisory notes; do not block.
7. **Per-Feature Story + Task resolution with v2.2 completion metadata.** Per `/execute-sprint` Phase 6: re-render each Task body with `Completed By` + `Completed At`; update via `work_item_update` with state → `mapping.states.resolved`, `mapping.fields.completed_work` → in-session wall-clock duration; cascade Story → `resolved` when all child Tasks resolved. Audit comment per state transition. Feature stays at `active` (the cascade to Resolved is the PR-merge trigger via `/dora-reconcile`).
8. **Per-Feature draft PR creation.** Per `/execute-sprint` Phase 7: render the PR description with the **Run Manifest** section appended (described below). Render `operation_templates.pull_request_create` with `{{draft}}: true` (always; no CPO override in Full Auto). Link every created work item via `{{linked_work_items}}`. Per polyrepo coordinated-mode Features: N PRs per Feature (one per sub-repo) with cluster-manifest cross-references per `/execute-sprint` Phase 7's coordinated-mode walk.
9. **Per-Feature checkpoint.** As each Feature completes Phase 6 (in arrival order, which may not match Feature-creation order due to parallel execution):

```
[CHECKPOINT: Phase 6 -- Feature #<id> executed]
  Branch:           <branch-name>
  Tasks resolved:   <count> (in <Hh Mm> wall-clock)
  Tests:            <passing | failing>
  Security review:  <none | clean | <severity> findings>
  Draft PR:         <pr-url>
  Feature tokens:   ~<X>k
  Run total tokens: ~<Y>k / 3000k
  Features remaining: <count> still executing
  Next:             Phase 7 when all Features land (or per-Feature halt-and-report on failure)
```

10. **Tear down per-Feature teams** via `TeamDelete` as each Feature completes. Prune the per-Feature worktree root.

After all Features complete Phase 6: emit a Phase 6 summary checkpoint listing total PRs opened, total Tasks resolved, total tokens consumed, total wall-clock elapsed, any halted Features.

### Phase 7: Run-level finalization and final summary

1. **Re-check the Run Contract.** Confirm every Feature in the contract reached a terminal state: either a draft PR opened (success), or halted with a documented halt reason (Spec-Ambiguity, test failure, security finding). No Feature should be in a silent in-between state.
2. **Final audit comment on the Spec.** Render `operation_templates.work_item_comment_add` on the source Spec:

```
[STRAP/agent:dev-lead] /execute-sprint-full-auto complete.
  Features generated: <count> (#<id1>, #<id2>, ...)
  Stories created:    <count>
  Tasks created:      <count>
  Draft PRs opened:   <count> (<list of urls>)
  Halted Features:    <count> (<list of feature ids + halt reasons>, or "none")
  Surfacing events:   <count> Spec-Ambiguity halts, <count> Safety-Perimeter halts
  Run wall-clock:     <Hh Mm>
  Tokens consumed:    ~<X>k session aggregate
  Authored By:        dev-lead
  Source Spec:        #<spec-id>
```

3. **Update `usage.yaml`** with `session.completed_at: <ISO-8601 timestamp>` and the closing per-agent `used_in_current` values. Preserve `agents.<name>.last_dispatch`.
4. **Final summary to the CPO.** Print a structured summary that the CPO sees in conversation as the run terminates:

```
/execute-sprint-full-auto complete: "<spec-title>"

Run contract:
  Spec:             #<spec-id>
  Features:         <F> planned / <F-h> halted / <F-s> succeeded
  Stories created:  <S>
  Tasks created:    <T>
  Iteration:        <iteration name>
  Assignee:         <CPO identity>
  Run tag:          full-auto

Draft PRs opened (<count>):
  - <feature-1 title>: <pr-url>
  - <feature-2 title>: <pr-url>
  - ...

Halted Features (<count>):
  - <feature-id> -- <halt reason> -- branch <branch-name> preserved
  - ...

Surfacing events:
  - Spec-Ambiguity halts: <count>  (<list with resolutions: clarified-here | proceeded-with-assumption | run-cancelled>)
  - Safety-Perimeter halts: <count> (<list with categories>)

Budget consumption:
  Session aggregate: ~<X>k of 3000k (<percentage>%)
  Per-specialist exhaustions: <count> (specialists: <list>, or "none")

Run wall-clock: <Hh Mm>

Next:
  - Review each draft PR for readiness; convert to ready-for-review when satisfied.
  - For halted Features: investigate the halt reason; resume via /fix-bugs (security findings),
    /refine-spec (Spec defects), or /refine-pr (test/AC failures).
  - Source Spec #<spec-id> remains Resolved; the chain it generated is now in flight.
  - /close-ceremony will land Features at Closed once PRs merge.
```

5. **Prune in-flight state files.** Remove any per-Feature transient worktree-root scaffolding. The continuation file at `.claude/strap/contexts/continuations/full-auto-<spec-id>.md` (if any was written during a 60% checkpoint) stays as historical record; the CPO may mark it `done` at their discretion.

## Spec-Ambiguity Halt Protocol

The most important non-obvious behavior in Full Auto. A "well-scoped Resolved Spec" is the contract, but decomposition or execution may surface gaps the Spec author did not anticipate. The protocol gives the CPO a deliberate, audited way to resolve gaps without losing the run.

**Triggers.** Any of the following fires the protocol:

- A specialist's finishing `SendMessage` `Notes:` section flags ambiguity, incompleteness, or contradiction in their assigned Spec slice (Phase 3 spec-lead, Phase 4 decomposition specialists, Phase 6 implementation specialists).
- Cycle detection in Phase 4 step 6 cross-Constituent-Part dependency graph (decomposition cannot proceed against a cyclic Spec).
- A Phase 6 per-task dev-lead review surfaces a contradiction between the Task body (derived from the Spec) and the actual codebase that the specialist could not reconcile.
- A Phase 6 AC-walk step finds an Acceptance Criterion that has no matching implementation surface AND no matching test surface (Spec demanded behavior that decomposition did not produce a Task for).

**Procedure.** When the protocol fires:

1. **Halt the affected scope.** For Phase 3 ambiguity: halt the whole run before any Feature is persisted. For Phase 4 ambiguity: halt this Feature's decomposition (other Features in Phase 4 sequence are unaffected; if Feature N halts, Features N+1, N+2, etc. do not run). For Phase 6 ambiguity: halt this Feature's execution (other Features in Phase 6 parallel execution continue).
2. **Tag the affected items.** Apply `halted; spec-ambiguity` tag via `operation_templates.work_item_update` to the affected Feature (Phase 3-4) or affected Task(s) (Phase 6).
3. **Audit comment.** `[STRAP/agent:dev-lead] Spec-Ambiguity Halt at Phase <N>: <specialist or audit step> surfaced <verbatim ambiguity text>. Spec slice affected: <Constituent Part reference or AC reference>. Awaiting CPO resolution.`
4. **Surface to the CPO via `AskUserQuestion`.** Three options (no previews; nominal-label decision):
   - **`Clarify here` (Spec-edit-in-place).** The CPO names the clarification. The dev-lead applies the edit to the Spec description via `operation_templates.work_item_update` -- the Spec stays in state `resolved` (the edit is an additive amendment, not a re-opening). Audit comment on the Spec: `[STRAP/agent:dev-lead] Full Auto inline Spec clarification at Phase <N>: <one-liner of the change applied>. Source: <specialist name + Constituent Part>. Run instance: full-auto-<YYYYMMDD>-<spec-id>.` The dev-lead re-dispatches the failed specialist work (Phase 3 spec-lead re-authoring, Phase 4 specialist re-decomposing the affected Constituent Part, Phase 6 specialist re-implementing the affected Task) with the clarified Spec context. On polyrepo umbrellas, the Spec edit lands in the umbrella Spec; per-sub-repo Spec slices are not maintained separately.
   - **`Pause and return to manual /refine-spec`.** Full Auto exits cleanly. The Spec transitions to state `active` via `operation_templates.work_item_update` so `/refine-spec` can resume work on it. Items created so far stay in place tagged `halted; full-auto-partial`. Branches created so far stay. The CPO uses `/refine-spec <spec-id>` to fix the Spec; resumes via `/execute-sprint-full-auto <spec-id>` once Resolved again, on the understanding that the partial chain from the prior run remains -- Full Auto's pre-flight check for "existing Features linked to this Spec" will catch this and prompt the CPO to either `/reset-feature` per partial Feature or `/execute-sprint` per partial Feature.
   - **`Proceed with dev-lead's best-judgment assumption`.** The dev-lead names the assumption explicitly. The assumption text is appended to the affected Feature description under a new `## Assumptions made during Full Auto run` section, OR to the affected Task description for Phase 6 cases. Audit comment on the affected item: `[STRAP/agent:dev-lead] Spec-Ambiguity Halt resolved by best-judgment assumption: <verbatim assumption>. CPO accepted at <ISO-8601 timestamp>.` The dev-lead continues the affected work with the assumption applied. **This option is gated by the three-strikes rule below.**
5. **Three-strikes rule.** When 3 or more Spec-Ambiguity Halts fire in one run (across all phases combined), the dev-lead escalates the CPO on the third surfacing:
   - Override the standard three-option `AskUserQuestion` with a fourth option: `Cancel run and recommend /refine-spec`.
   - Surface the explicit recommendation: "This Spec has surfaced N ambiguities in one Full Auto run. The Spec is likely not Full-Auto-ready -- recommend cancelling, running `/refine-spec <spec-id>` to address the gaps systematically, and re-running Full Auto when Resolved."
   - The CPO may still choose Clarify here / Proceed with assumption / Pause-and-return, but the fourth option is presented first as the recommended path.

**Three-strikes rationale.** The CPO doctrine for Full Auto is "trust the Resolved Spec." If a Spec surfaces 3+ ambiguities in one run, the contract is broken in spirit even if individual halts were resolvable. Forcing escalation prevents the CPO from accidentally clarifying a Spec to death mid-run when the better outcome is a deliberate /refine-spec pass.

## Safety-Perimeter Halts

Always halt and surface. The dev-lead does not resolve these autonomously -- they require CPO intervention.

| Halt | Trigger | Resolution path |
|---|---|---|
| **New domain activation required** | Phase 1 detects a Spec-required domain not in `project-profile.md`'s active set (or per-sub-repo `Active domains` on polyrepo) | Refuse Phase 1; CPO runs `/decompose-feature` on a single Feature to walk the domain-activation ceremony, OR edits `project-profile.md` directly + runs `/strap-refresh` |
| **`security-reviewer` Critical/High finding** | Phase 6 step 6 security review on a Feature | Affected Feature halts; CPO runs `/fix-bugs` to address; commits land on the same feature branch; Full Auto does not re-run -- the CPO converts the draft PR to ready-for-review or re-invokes `/refine-pr` after the fix |
| **Spec mutation attempted outside Ambiguity Halt** | Any code path that would `work_item_update` the Spec body when the CPO did not select "Clarify here" | Refuse the mutation; surface to CPO; preserve all in-flight state |
| **`pull_request_create` unsupported** | Phase 6 step 8 against a source-control profile that does not declare the operation | Halt before PR opening; items stay at Resolved; branches preserved; CPO opens PRs manually using the host UI |
| **`CreateTeam` failure** | Phase 4 or Phase 6 team creation returns an error | Refuse to fall back to serial dispatch (Full Auto requires parallel fan-out); halt and surface the actionable error naming the offending settings layer |
| **Connection profile mutation during run** | Either `devops-connection.yaml` or `code-connection.yaml` is modified between Phase 1 and Phase 7 | Refuse to continue; the run cannot be coherent across a profile change; halt with the path of the modified profile |
| **Budget exhaustion -- 100% session aggregate hit** | `session.specialists_used` >= `session_aggregate` | Stop dispatching new specialists; complete any in-flight specialist work; halt before any new Phase 4 / Phase 6 work begins |

For every Safety-Perimeter Halt, the dev-lead:

1. Tags affected items with `halted; <halt category>` (e.g., `halted; new-domain-required`, `halted; security-critical`).
2. Writes the audit comment per the work item's state transition history.
3. Preserves all branches, worktrees, and committed work.
4. Tears down active teams via `TeamDelete`.
5. Surfaces halt context to the CPO via Halt-and-report.

## Checkpoint Summaries (async observability)

The dev-lead emits structured checkpoint summaries at every phase boundary. Checkpoints are **conversation output only** -- they do not block, do not gate, do not require acknowledgment. The CPO can read them in real-time and intervene at will (Ctrl-C halts the harness; the in-flight state is what it is at that moment).

**Format.** Every checkpoint follows the canonical shape:

```
[CHECKPOINT: <phase> -- <one-line phase summary>]
  Items created:    <ids or summary>
  Branches:         <names or summary>
  Tokens used:      ~<X>k / 3000k session aggregate
  Time elapsed:     <Hh Mm> wall-clock since run start
  Next:             <next phase or action>
```

**When checkpoints fire.**

| Phase boundary | Checkpoint content |
|---|---|
| Post-Phase 1 | Run Contract drafted (the contract text itself is the checkpoint output before Phase 2) |
| Post-Phase 2 | CPO approval (one of: approved + executing, modified + re-rendered, cancelled + exited) |
| Post-Phase 3 | Features generated |
| Per-Feature in Phase 4 | Feature decomposed (one per Feature) |
| Post-Phase 4 | Phase 4 summary (cumulative across all Features) |
| Post-Phase 5 | Sprint allocation complete |
| Per-Feature in Phase 6 | Feature executed (one per Feature; arrival order, not creation order) |
| Post-Phase 6 | Phase 6 summary (cumulative across all Features) |
| Post-Phase 7 | Final summary (the structured output described in Phase 7 step 4) |

**Per-Feature checkpoint granularity** is the default. Per-Task checkpoints would be noisy on big runs (a 50-Task Feature would emit 50 checkpoints, drowning the conversation). The Feature boundary is the right granularity -- it tells the CPO "Feature N is done" without breaking the per-Task review discipline (which happens inside dev-lead's own working context).

**No checkpoint emission during halts.** Halts use the Halt-and-report mechanism instead, which is heavier and explicitly demands attention. Checkpoints are for healthy progress only.

## Budget enforcement

Full Auto is the most expensive STRAP workflow. Per [`budget-discipline.md`](../../strap/contexts/budget-discipline.md), the skill operates against two budgets pulled from `.claude/strap/state/usage.yaml` at run start. Defaults are higher than `/quick`'s to accommodate Full Auto's scope.

**Defaults (Full Auto):**

- Per-agent: **1M** (vs `/execute-sprint`'s 500K) -- specialists in Full Auto are dispatched across MULTIPLE Features per workflow instance (typically once in Phase 4 decomposition + once in Phase 6 execution, multiplied across 3-5 Features = 6-10 total dispatches sharing the per-agent ceiling). `/execute-sprint`'s 500K covers one Feature's-worth of dispatches; Full Auto's 1M covers the multi-Feature scope.
- Session aggregate: **5M** (vs `/execute-sprint`'s 2M) -- Full Auto's session may run the equivalent of 3-5 `/execute-sprint` invocations plus Phase 3 + Phase 4 decompositions. The 60% checkpoint fires at 3M, giving the CPO room to break the run cleanly across sessions.

These defaults are TUNING ESTIMATES, not load-bearing constants. Real Full Auto runs will calibrate them. File a v2.6 follow-up Feature to revise after the first real adopter run.

**Dispatch-time budget pull.** After Phase 2 (CPO approval) and before Phase 3 (Feature generation):

1. Read `.claude/strap/state/usage.yaml`. Pull `budgets.execute-sprint-full-auto.per_agent` (default 300000) and `budgets.execute-sprint-full-auto.session_aggregate` (default 3000000). Pull `budgets.execute-sprint-full-auto.agent_overrides` if present.
2. Initialize the `session` block:
   - `session.workflow: execute-sprint-full-auto`
   - `session.workflow_instance: full-auto-<YYYYMMDD>-<spec-id>`
   - `session.started_at: <ISO-8601 timestamp>`
   - `session.specialists_used: 0`
3. For every specialist that may be dispatched during this run, reset `agents.<name>.used_in_current` to `0` (preserve `agents.<name>.last_dispatch`). Specialists not in this run's roster are left untouched.

**Per-agent budget in dispatch briefs.** Every specialist brief (Phase 3 spec-lead, Phase 4 decomposition specialists, Phase 6 implementation specialists, Phase 6 security-reviewer) carries:

> "Your budget for this dispatch is `<per-agent-budget>` tokens. Include `tokens_used: ~XXk` as the final line of your finishing summary."

The effective per-agent value resolves per `budget-discipline.md` "Dispatch-time resolution": `agent_overrides.<name>.per_agent` if present, else `budgets.execute-sprint-full-auto.per_agent`.

**Token accounting.** When a specialist's `SendMessage` finishing report returns, parse the `tokens_used: ~XXk` line. Add to `agents.<name>.used_in_current`; sum into `session.specialists_used`. Update `agents.<name>.last_dispatch`. Persist after each specialist completes (not just at run end) so an interruption preserves accurate state.

**60% session-aggregate checkpoint.** When `session.specialists_used` crosses 60% of the configured session aggregate:

1. Pause new specialist dispatch. In-flight specialists complete normally.
2. Surface to the CPO: "Specialists have consumed ~`<X>`K of the `<Y>`K session aggregate (60% threshold reached). Recommending checkpoint to preserve in-flight Full Auto state across a fresh session."
3. Run `/context-prep full-auto-<spec-id>` to capture in-flight workflow state. The continuation should record: current phase, Features generated, Features decomposed, Features executing (with branches + Task ids), surfacing events history, remaining work in flight.
4. Instruct the CPO: "Run `/usage` to confirm your own window; then `/clear` and start a fresh session. On resume, run `/context-fetch full-auto-<spec-id>` first; re-invoking `/execute-sprint-full-auto <spec-id>` will detect the partial chain via the pre-flight existing-Features check and prompt for per-Feature resume vs reset."
5. The CPO confirms or overrides. On override ("plenty of room, push through"), proceed and note the override in the continuation for future runs to learn from.

**Per-agent exhaustion.** When `agents.<name>.used_in_current` reaches its per-agent budget mid-run:

- Do NOT redispatch that specialist within this workflow instance.
- For Phase 4 decomposition: if the exhausted specialist's Constituent Part is incomplete, treat as a Spec-Ambiguity Halt (the decomposition cannot proceed without the specialist's input).
- For Phase 6 execution: work with what the specialist already produced; review the landed work normally; if Tasks the specialist was assigned remain incomplete, treat the unfinished Tasks as halted (tag `halted; per-agent-budget-exhausted`); the Feature can still open a partial PR if other Tasks completed.
- Note the exhaustion under `agents.<name>` in `usage.yaml` (`exhausted_at: <ISO-timestamp>`).
- Surface to the CPO at run end so they can revise the per-agent budget for the next workflow instance via `/revise-token-budget`.

**Run-completion close-out.** At the end of Phase 7:

- Write `session.completed_at: <ISO-8601 timestamp>` to `usage.yaml`.
- Preserve `agents.<name>.used_in_current` as the closing value -- it gets reset at the next Full Auto run's dispatch-time pull.
- Surface the run's total consumption in the final summary (Phase 7 step 4).

## Halt-and-report

Any halt at any phase -- Spec-Ambiguity (when CPO selects Pause-and-return or Cancel), Safety-Perimeter, budget exhaustion, or workflow-error:

1. **Tag affected items** with `halted; <category>` via `operation_templates.work_item_update`. Categories: `spec-ambiguity`, `new-domain-required`, `security-critical`, `security-high`, `test-failure`, `ac-walk-failure`, `spec-mutation-attempted`, `pr-create-unsupported`, `createteam-failure`, `connection-profile-mutation`, `budget-exhausted`, `per-agent-budget-exhausted`, `cycle-detected`.
2. **Audit comment** on each affected item: `[STRAP/agent:dev-lead] Halted at Phase <N>: <category>. Reason: <specific reason>. Branch preserved: <branch-name>. Other Features: <continuing | also halted | not yet started>.`
3. **Preserve all branches and commits.** Never auto-revert. Never delete worktrees the halt-affected Feature is operating in (other Features' worktrees may be cleaned up if those Features completed cleanly).
4. **Tear down halted Feature's team** via `TeamDelete`. Other Features' teams in Phase 6 continue unaffected -- per-Feature halts do not cascade.
5. **Print halt context to the CPO:**

```
/execute-sprint-full-auto -- Feature HALTED at Phase <N>

Feature: #<id> -- "<title>"
Reason:  <category>: <specific reason>

Preserved:
  Work items: <list of ids with current state and halt tag>
  Branch:     <branch-name> (in <worktree-path>)
  Commits:    <list of shas>

Other Features:
  Still executing: <list of feature ids in Phase 6>     (when halt is per-Feature in Phase 6)
  Already complete: <list with PR urls>
  Not yet started: <list>                               (when halt is in Phase 4 and later Features did not begin)

To resolve:
  - <category-specific recommendation>
  - Investigate the halt context (specialist Notes:, failed tests, security findings, etc.).
  - Fix manually or via the appropriate skill:
    - Spec defects: /refine-spec
    - Security findings: /fix-bugs against new follow-up Bug, commits land on same branch
    - Test failures: /fix-bugs or /refine-pr
    - Domain activation: edit project-profile.md or run /decompose-feature on a sample Feature
  - Re-running /execute-sprint-full-auto on this Spec will detect the partial chain via pre-flight and prompt for per-Feature resume.

Run state: <count> Features succeeded, <count> halted, <count> not yet started.
```

6. **For run-level halts** (Phase 1/2/3 halts that affect the whole run, or budget halts that pause all phases), the run terminates and the dev-lead does NOT proceed to Phase 7. The CPO addresses the halt and re-invokes the skill from scratch (or with the partial-chain handling).

## Outputs

- One or more `feature` work items (one per Spec Feature grouping; typically 2-5 per Spec) under the host's Features-epic parent, linked `related` to the source Spec, each carrying v2.2 lifecycle metadata + `AI; strap:feature; full-auto` tags + CPO assignment + current iteration.
- One or more `story` work items per Feature (typically 2-5 per Feature) carrying v2.2 metadata + `AI; strap:story; full-auto` tags + CPO assignment + current iteration + parent linkage to the Feature.
- One or more `task` work items per Story (typically 2-5 per Story) carrying v2.2 metadata + `AI; strap:task; full-auto` tags + CPO assignment + current iteration + parent linkage to the Story + `original_estimate` per specialist proposal + `predecessor`/`successor` links per the dependency graph.
- One feature branch per Feature (or N coordinated branches per coordinated-mode Feature) carrying one commit per Task implementation + any centralized test-run fixes.
- One draft pull request per Feature (or N coordinated PRs per coordinated-mode Feature with cluster-manifest cross-references), linked to every work item the Feature owns, draft state by default, containing the **Run Manifest** in the PR description.
- Every Story and Task in `mapping.states.resolved` with `CompletedWork` populated, `Completed By` + `Completed At` in the description (per item lifecycle metadata block).
- Every Feature in `mapping.states.active` (the cascade to Resolved is the PR-merge trigger via `/dora-reconcile`; the cascade to Closed is the CPO acceptance gate via `/close-ceremony`).
- `[STRAP/agent:dev-lead]` audit comments on every state transition and every Spec-Ambiguity / Safety-Perimeter halt.
- A final audit comment on the source Spec recording the run's outcome (Phase 7 step 2).
- `.claude/strap/state/usage.yaml` updated with the closed `session` block and the closing `agents.<name>.used_in_current` values.
- A structured final summary delivered to the CPO in conversation (Phase 7 step 4) with full chain ids, PR urls, halt list, surfacing event log, and budget consumption.
- (Conditional) A `/context-prep` continuation at `.claude/strap/contexts/continuations/full-auto-<spec-id>.md` if a 60% budget checkpoint fired and the run was paused for fresh-session resume.

### Run Manifest (in every PR description)

Appended to every draft PR's description body:

```
## Full Auto Run Manifest

Generated by `/execute-sprint-full-auto` from Spec #<spec-id> on <run-start-timestamp>.

Run scope (this PR):
  - Feature: #<feature-id> -- "<feature-title>"
  - Stories: <count> (<id list>)
  - Tasks: <count> (<id list>)
  - Branch: <branch-name>
  - Sub-repo: <slug>                    (polyrepo only)

Run scope (the whole Full Auto run):
  - Source Spec: #<spec-id>
  - Total Features: <count>
  - Total PRs: <count> (this is PR <N> of <total>)
  - Other PRs from this run:
    - <feature-id-2>: <pr-url-2>
    - ...

Surfacing events affecting this Feature:
  - <list, or "none">

Acceptance criteria coverage:
  - <AC item 1 from Spec>: <Task #<id> + commit <sha> + test <file>>
  - <AC item 2>: <...>
  - ...

Tag: full-auto
Authored By: dev-lead, via /execute-sprint-full-auto
```

## Quality gates

The skill is successful when all of the following hold:

- Both connection profiles were present at pre-flight; required env present; required tools present.
- `$ARGUMENTS` resolved to a Spec in state `resolved`; the Spec was not mutated during the run except via the Ambiguity Halt "Clarify here" branch.
- The CPO explicitly approved the Run Contract at Phase 2 (Execute or Modify+re-approve). Cancel exits cleanly with no persistence.
- Every created item (Feature, Story, Task) carries:
  - The v2.2 lifecycle-metadata block at the top of its description.
  - The `AI` tag, the appropriate `strap:<logical-type>` tag, AND the `full-auto` tag.
  - The CPO's host identity as `assigned_to`.
  - The current iteration as `iteration_path` (Stories and Tasks; Features may inherit per host conventions).
  - Parent linkage per the chain shape.
- For Spec-Ambiguity Halts: the protocol fired correctly; the CPO selected an option; the chosen branch executed cleanly (Spec edit + audit comment, OR partial-chain preservation + run exit, OR assumption logged + run continued).
- For Safety-Perimeter Halts: affected items tagged with the correct category; branches preserved; teams torn down; halt context surfaced to CPO.
- Three-strikes ambiguity rule fired on the third Spec-Ambiguity Halt with the fourth `Cancel run and recommend /refine-spec` option presented.
- Checkpoint summaries emitted at every phase boundary per the Checkpoint Summaries section.
- For every Feature that reached Phase 6:
  - Branch created from `default_branch` (or per `stacked` / coordinated-mode conventions when applicable).
  - All Tasks executed via per-Feature `CreateTeam` cluster; per-Feature worktree root created and torn down.
  - Centralized build-and-test passed against the Feature branch (or halt fired on failure).
  - Integration audit + AC walk passed (or halt fired on failure).
  - Security review ran when triggered; Critical/High halted the Feature; Medium/Low surfaced in PR description as advisory.
  - All Stories and Tasks transitioned to `resolved` with v2.2 completion metadata.
  - One draft PR per Feature (or N per coordinated-mode Feature) opened via `operation_templates.pull_request_create`, linked to every work item, draft state.
  - Run Manifest appended to every PR description.
- Tokens consumed stayed within the session aggregate budget OR the 60% checkpoint was offered to the CPO when crossed.
- `tokens_used: ~XXk` reporting was captured for every specialist dispatch (or absence noted as a budget-tracking warning per Failure handling).
- Final summary delivered to the CPO with full chain, PRs, halts, and budget consumption.
- `usage.yaml` updated with `session.completed_at` and closing per-agent values.
- The source Spec carries a final audit comment recording the run's outcome.
- No item was advanced past `mapping.states.resolved` (Stories, Tasks resolve; Features stay active). PR-merge cascade and `/close-ceremony` handle Resolved → Closed.

## Failure handling

- **Either connection profile missing**: refuse at pre-flight; recommend `/connect-devops-project` or `/connect-code-repo`.
- **Spec not in state `resolved`**: refuse at pre-flight; recommend `/refine-spec <spec-id>`.
- **Spec has existing Feature children linked**: refuse at Phase 1; list the existing chain; recommend `/reset-feature` per partial Feature OR `/execute-sprint` per existing Feature.
- **Required env missing for parallel teams**: refuse at pre-flight; name the offending settings layer; direct at re-running the installer.
- **`usage.yaml` missing**: refuse at pre-flight; recommend `/strap-in` or `/strap-refresh`.
- **`iteration_list` unsupported by work-tracking host**: refuse at pre-flight; Full Auto requires sprint allocation by design.
- **CPO identity not resolvable**: refuse at pre-flight; recommend configuring host CLI defaults or the connection profile's `defaults.assigned_to`.
- **Spec-Ambiguity Halt fires**: protocol per the Spec-Ambiguity Halt Protocol section.
- **Three-strikes ambiguity threshold crossed**: present the fourth `Cancel run and recommend /refine-spec` option as primary; CPO chooses.
- **New domain activation required**: Safety-Perimeter Halt; refuse Phase 1; CPO addresses manually.
- **`security-reviewer` Critical/High finding**: Safety-Perimeter Halt per affected Feature; other Features continue.
- **`pull_request_create` unsupported**: Safety-Perimeter Halt before PR opening; items stay at Resolved; CPO opens PRs manually.
- **`CreateTeam` failure**: Safety-Perimeter Halt; refuse to fall back to serial dispatch.
- **Per-Feature centralized test failure**: per-Feature halt; tag Task with `test-failure`; do not open PR for this Feature; other Features continue.
- **Per-Feature integration audit / AC-walk failure**: per-Feature halt; same as test-failure handling.
- **Connection profile modified during run**: Safety-Perimeter Halt; refuse to continue.
- **Specialist returns without `tokens_used:` line**: treat as budget-tracking warning; run continues; dev-lead estimates consumption manually and notes the gap under `agents.<name>` in `usage.yaml`.
- **Specialist exhausts per-agent budget mid-run**: do not redispatch within this instance; treat downstream incomplete work per the Budget Enforcement section's per-agent exhaustion handling.
- **60% session-aggregate budget crossed**: pause new dispatches; surface to CPO; offer `/context-prep` checkpoint + fresh session.
- **100% session-aggregate budget hit**: Safety-Perimeter Halt; complete in-flight work; halt before any new dispatches.
- **Specialist `SendMessage` silence (wedged teammate)**: treat extended silence as halt; tag affected Task `halted; specialist-wedged`; surface for `/team-cleanup` recovery.
- **Workflow-error during persistence** (host returns transient error mid-create): render `work_item_query` against parent + title to check for partial creation before retrying (avoids duplicates); on persistent failure, surface and halt.
- **HTML conversion fails**: surface offending content; do not post raw markdown into an HTML-flavored field.
- **`operation_templates` rendering produces malformed requests**: surface failing template path and request body; halt; do not execute.

## References

- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- dev-lead guardrails: [`../../strap/rules/agents/dev-lead.md`](../../strap/rules/agents/dev-lead.md).
- agent-devs team rules: [`../../strap/rules/agent-devs.md`](../../strap/rules/agent-devs.md) -- centralized test execution, PR creation rule, `SendMessage` discipline.
- agent-ops team rules: [`../../strap/rules/agent-ops.md`](../../strap/rules/agent-ops.md).
- Project profile (active domains + specialists + build/test): [`../../strap/contexts/project-profile.md`](../../strap/contexts/project-profile.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Source-control connection profile: `.claude/strap/state/code-connection.yaml`.
- Token-budget state: `.claude/strap/state/usage.yaml`.
- Work-item templates: `.claude/strap/templates/work-items/{feature,story,task}.template.md`.
- Composed-motion source-of-truth skills (Full Auto inlines, does NOT invoke):
  - [`/generate-features`](../generate-features/SKILL.md) -- Feature brief authoring + persistence (Phase A is inlined as Full Auto Phase 3).
  - [`/decompose-feature`](../decompose-feature/SKILL.md) -- Spec-section dependency parsing, specialist parallel planning, persistence (Phases 1, 3-8 are inlined as Full Auto Phase 4).
  - [`/plan-sprint`](../plan-sprint/SKILL.md) -- single-sprint allocation (inlined as Full Auto Phase 5 with capacity-review gate collapsed).
  - [`/execute-sprint`](../execute-sprint/SKILL.md) -- branch ceremony, wave dispatch, per-task review, centralized test, AC walk, draft PR (Phases 3-7 are inlined as Full Auto Phase 6 with parallel-across-Features fan-out).
- Closest single-motion analog: [`/quick`](../quick/SKILL.md) -- differs in input shape (free-form vs Resolved Spec), classification requirement (required vs N/A), and scope (single chain vs multi-Feature run).
- Downstream skills:
  - [`/refine-pr`](../refine-pr/SKILL.md) for PR-feedback iterations on Full Auto-generated PRs.
  - [`/fix-bugs`](../fix-bugs/SKILL.md) for addressing security findings or follow-up bugs against the Full Auto chain.
  - [`/close-ceremony`](../close-ceremony/SKILL.md) for the CPO Resolved → Closed value-acceptance gate on Features that reach merged-PR state.
  - [`/refine-spec`](../refine-spec/SKILL.md) for Spec re-shaping after Spec-Ambiguity Halts that selected `Pause and return to manual /refine-spec`.
- Recovery primitives:
  - [`/team-cleanup`](../team-cleanup/SKILL.md) for wedged teammates.
  - [`/reset-feature`](../reset-feature/SKILL.md) for cleaning a partial-chain Feature before re-running Full Auto on the same Spec.
- Context primitives:
  - [`/context-prep`](../context-prep/SKILL.md) for capturing in-flight state at the 60% budget checkpoint.
  - [`/context-fetch`](../context-fetch/SKILL.md) for resuming after a fresh-session restart.
- Cross-cutting:
  - Budget discipline: [`../../strap/contexts/budget-discipline.md`](../../strap/contexts/budget-discipline.md).
  - Onboarding design (connection-profile shape + canonical operation set): [`../../strap/contexts/onboarding-design.md`](../../strap/contexts/onboarding-design.md).
  - Continuation format: [`../../strap/contexts/continuation-format.md`](../../strap/contexts/continuation-format.md).
