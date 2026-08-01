---
name: /decompose-feature
description: Decompose an assigned Feature into Stories and Tasks. Dev-lead reads the linked Spec, activates any required domains (CPO-gated structural precondition), dispatches active-domain specialists in parallel for read-only planning, reconciles their output, and persists work items with v2.2 lifecycle metadata (Authored By, AI tag, strap:logical-type tag) via the configured work-tracking connection profile.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
---

# /decompose-feature

## Purpose

The heart of the STRAP pipeline. Given a Feature with a linked Resolved Spec, the dev-lead reads the Spec, **activates any domains the Spec requires that are not yet active** in `project-profile.md`, dispatches the active-domain specialists in parallel for read-only planning, reconciles their output into a Story/Task decomposition, and persists the decomposition via the work-tracking connection profile.

The skill ships portable. Every adopter-specific concern is resolved at runtime:

- Active specialist roster comes from `project-profile.md`'s `Domains` section
- Work-item operations render through `operation_templates.<op>` in `.claude/strap/state/devops-connection.yaml`
- Type and state mappings come from `mapping.work_item_types` and `mapping.states` in the same profile
- Markdown-to-HTML conversion is applied at the boundary for HTML-flavored hosts (e.g., Azure DevOps `System.Description`); markdown-flavored hosts (Local strap-agile) bypass conversion
- Lifecycle metadata (`Authored By`, `Completed By`) is rendered into the work-item description body; state-change audit lives in work-item comments tagged `[STRAP/agent:<name>]`

## Owner

**dev-lead.** When the skill is invoked the orchestrator IS the dev-lead -- the skill does not delegate to a dev-lead sub-agent.

## Inputs

- `$ARGUMENTS` -- the Feature work item id.
- `.claude/strap/contexts/project-profile.md` -- source of truth for active domains and their specialists.
- `.claude/strap/state/devops-connection.yaml` -- connection profile with type/state mappings, capabilities, and `operation_templates`.
- `.claude/strap/templates/work-items/story.template.md` and `task.template.md` -- description body templates.

## Workflow

### Phase 1: Read the Feature and linked Spec

1. Render `operation_templates.work_item_read` with `id=$ARGUMENTS`; execute via the auth/transport declared in the connection profile. Capture: title, state, description, acceptance criteria, assigned developer, linked Spec id, existing child work items.
2. Validate preconditions:
   - The Feature MUST link to a Spec in logical state `resolved`. If not, surface what is missing and stop (recommend `/refine-spec <spec-id>`).
   - The Feature SHOULD have an assigned developer. If unassigned, flag to the CPO before proceeding.
   - If child Stories/Tasks already exist, present the existing decomposition and ask the CPO whether to start fresh (recommend `/reset-feature` first) or adjust what exists.
3. Read the linked Spec via the same operation pattern. Capture its Constituent Parts (`client-ui`, `api`, `core`, `data`, `infrastructure`, `integrations`, etc.). These become the input to the domain-activation gate.
4. **Polyrepo detection + annotation parsing.** Read `project-profile.md` to detect polyrepo mode: a populated `Sub-repos` section preceded by the current schema sentinel (`<!-- strap-schema: sub-repos-v2.4 -->` or above) signals polyrepo. On single-repo umbrellas (no `Sub-repos` section, or empty), skip annotation parsing entirely and proceed with the existing single-repo flow. On polyrepo umbrellas:
   - For each Constituent Part section heading in the Spec, parse the annotation using the regex `\[sub-repos?:\s*([^\]]+)\]`. Capture the single-slug value (`[sub-repo: web-frontend]`) or the comma-separated multi-slug list (`[sub-repos: shared-types, api-backend]`).
   - Validate every captured slug resolves to an actual entry in `project-profile.md`'s `Sub-repos` section. On mismatch (annotated slug not in Sub-repos): stop. Surface the offending section heading and the unknown slug to the CPO; recommend `/refine-spec <spec-id>` to correct the annotation, OR `/strap-refresh` if the Sub-repos section is out of date.
   - For each Constituent Part, record the resolved `sub_repo` value (single slug, multi-slug list, or null when unannotated). Constituent Parts on polyrepo umbrellas that lack an annotation entirely are a Spec defect -- stop and recommend `/refine-spec`. (Feature 1's spec.template.md gates this at Spec-resolution time; this Phase 1 check catches Specs that bypassed the gate.)
   - Carry the per-Part `sub_repo` resolution forward to Phase 2 (domain-activation gate uses per-sub-repo active_domains), Phase 5 (dispatch scoping), and Phase 8 (Task persistence + multi-slug Task split).
5. **Spec section dependency-phrase parsing (polyrepo umbrellas only; v2.4 Feature 6).** Within each Constituent Part section body, scan for dependency-declaring phrases that link one section to another. Captured edges feed Phase 6 step 1b's cross-sub-repo dependency graph (Spec-traced source).

   Detection patterns (extensible; conservative-bias detection -- false positives surface for CPO confirmation; false negatives leave intra-Feature dependencies relying on the static depends_on graph and specialist-authored declarations):

   - **Explicit references to other sections:** phrases of the form "depends on Section `<N>`", "depends on the `<X>` section", "consumes `<Y>`'s `<Z>`", "requires Section `<N>`'s output", "blocked by Section `<N>`".
   - **Inheritance phrases:** "built on top of `<X>`", "extends `<X>`", "consumes the output of `<X>`", "uses `<X>`'s exported types".
   - **Anti-patterns** (NOT a dependency; explicitly suppressed): "compared to", "instead of", "replaces", "supersedes", "in contrast to".

   Edge construction: when Section N's body declares a dependency on Section M, and Section N maps to sub-repo `<slug-N>` (from step 4's annotation parsing) and Section M maps to sub-repo `<slug-M>`, record the edge `<slug-N> -> <slug-M>` (slug-N depends on slug-M) in the `spec_traced_graph` for Phase 6 step 1b to consume. When slug-N == slug-M (same-sub-repo dependency), the edge is intra-Feature -- record it for sub-step (a)'s consumption rather than cross-sub-repo.

   Same-sub-repo dependencies and single-repo umbrellas: the Spec-traced graph remains useful for intra-Feature predecessor/successor linking even on single-repo. The scan runs on every umbrella mode; the cross-sub-repo subset (slug-N != slug-M edges) only matters on polyrepo.

   Carry the parsed `spec_traced_graph` forward to Phase 6 step 1b alongside Phase 1 step 4's per-Part `sub_repo` resolution.

### Phase 2: Domain-activation gate (structural precondition)

For each Constituent Part the Spec carries, identify the canonical domain it represents and check `project-profile.md` for activation. **This phase is a precondition -- the skill does NOT dispatch specialists for a domain that isn't active.**

On polyrepo umbrellas, "active" means active for the Constituent Part's target sub-repo (its `Active domains` field in the `Sub-repos` section). On single-repo umbrellas, "active" means active in the umbrella `## Domains` section. The activation ceremony reflects this asymmetry.

1. **Build the active-domain set.**
   - Single-repo umbrellas: read the umbrella `## Domains` section; build the set of currently active domains (entries with `Status: active`).
   - Polyrepo umbrellas: for EACH sub-repo entry in `## Sub-repos`, read its `Active domains` field; index the active set per sub-repo (`web-frontend -> [frontend-engineer, integration-specialist]`, `api-backend -> [backend-engineer, database-engineer, integration-specialist]`, etc.). The umbrella `## Domains` section may also exist on polyrepo umbrellas (for cross-sub-repo domains); read it as the umbrella-level fallback for cross-cutting concerns (e.g., `security-reviewer` activates umbrella-wide when present).
2. For each Spec section, determine the required domain (`client-ui` section -> `client-ui` domain, `api` -> `api`, etc.). When a Spec section name doesn't map to any canonical domain, surface the unmapped section to the CPO; refuse to proceed (Spec needs amendment).
3. **Check activation per scope.**
   - Single-repo umbrellas: required domain must be in the umbrella `## Domains` active set.
   - Polyrepo umbrellas: required domain must be in the Constituent Part's target sub-repo's `Active domains` (from Phase 1's `sub_repo` resolution). Multi-slug Parts require coverage in EVERY target sub-repo. Cross-cutting domains (e.g., `security-reviewer`) may resolve via the umbrella `## Domains` fallback if not in any sub-repo's `Active domains`.
4. For each required domain not active in its scope, run the activation ceremony:
   - `AskUserQuestion` the CPO -- options (no previews; nominal-label decision). On polyrepo umbrellas the question names the sub-repo scope explicitly:
     - `Activate at sub-repo scope` (polyrepo) / `Activate` (single-repo) -- add the domain to the sub-repo's `Active domains` (polyrepo) or umbrella `## Domains` (single-repo) and curate the specialists' rules/memory now
     - `Activate umbrella-wide` (polyrepo only) -- add the domain to umbrella `## Domains` (cross-cutting; applies to all sub-repos). Use sparingly; per-sub-repo activation is the default polyrepo discipline.
     - `Skip and dispatch manually later` -- proceed without this domain's specialist; CPO accepts the gap
     - `Cancel decomposition` -- exit cleanly without persisting anything
   - On `Activate at sub-repo scope`:
     - Gather the stack particulars via structured prompts: framework / language / runtime, conventions (bullet list), source-of-truth paths -- scoped to the target sub-repo.
     - Append the specialist set to the relevant sub-repo's `Active domains` field in `## Sub-repos`. The umbrella `## Domains` section is NOT modified unless `Activate umbrella-wide` was chosen.
     - Set `Activated: <YYYY-MM-DD> by CPO` on the sub-repo entry (if not already stamped at /strap-in time).
     - Seed the active specialists' per-agent rules at `.claude/strap/rules/agents/<name>.md` and memory at `.claude/strap/memory/agents/<name>.md` with the sub-repo-specific tradecraft (via the `/memory-refine` machinery -- direct dev-lead edits, never specialist self-edits). On polyrepo umbrellas, per-agent memory MAY carry per-sub-repo subsections when the specialist works across multiple sub-repos with different conventions.
     - Confirm the activation to the CPO before continuing.
   - On `Activate umbrella-wide` (polyrepo only):
     - Append the `H3` entry to umbrella `## Domains` per the existing schema in [`../../strap/templates/project-profile.scaffold.md`](../../strap/templates/project-profile.scaffold.md). Use sparingly; document the rationale ("cross-cutting") in the Domain entry.
   - On `Activate` (single-repo): existing single-repo behavior unchanged -- append H3 entry to umbrella `## Domains`; seed per-agent rules and memory; stamp Activated.
   - On `Skip`: continue without the specialist for that domain; flag the gap in the Phase 7 summary (per-sub-repo gap visibility on polyrepo).
   - On `Cancel`: exit without persistence.
5. Confirm to the CPO before proceeding. The summary format adapts to umbrella mode:
   - Single-repo: "Domains active for this Feature: <list>. Specialists dispatching: <list>. Gaps (skipped domains): <list or none>."
   - Polyrepo: "Per-sub-repo activation summary: web-frontend -> <domains>; api-backend -> <domains>; shared-types -> <domains>. Cross-cutting (umbrella): <domains>. Specialists dispatching: <per-sub-repo list>. Gaps: <per-sub-repo list or none>."

### Phase 3: Resolve the dispatch set

From the active-and-required domains in the profile, build the dispatch set as the union of every domain entry's `Specialists` field. Skip duplicates.

State the resolved dispatch set to the CPO before continuing:

> Dispatching to: {specialist ids}. Spec sections covered: {sections}.

### Phase 4: Choose decomposition strategy

Sum the rough effort estimate from the Spec's Constituent Parts and count distinct domains. Apply:

| Condition | Strategy |
|---|---|
| Total effort under 24h, OR only two domains | Vertical-slice |
| Total effort >= 24h AND three or more domains | Layer-aligned (default) |

**Vertical-slice.** Dispatch only the smallest set of specialists to deliver user-visible behavior end-to-end (typically backend + client-ui). Each Story is a vertical slice ("User can X").

**Layer-aligned.** Dispatch one specialist per matched domain. Each Story is scoped to one domain; cross-domain dependencies are reconciled in Phase 6.

State the chosen strategy to the CPO before proceeding.

### Phase 5: Parallel dispatch via CreateTeam

The dispatch shape adapts to umbrella mode. Single-repo umbrellas dispatch one team with the umbrella-wide specialist set. Polyrepo umbrellas dispatch one team per affected sub-repo, scoped to that sub-repo's active domains, so each specialist's view of the codebase is naturally focused on the relevant sub-repo.

1. **Team creation.**
   - Single-repo umbrellas: `CreateTeam(team_name: "decompose-<feature-id>")` -- one team carrying all dispatched specialists.
   - Polyrepo umbrellas: for each sub-repo whose Constituent Parts are in scope, `CreateTeam(team_name: "decompose-<feature-id>-<sub-repo-slug>")` -- one team per sub-repo. Team-name convention matches the v2.4 worktree mechanics protocol (consistent with execution-time teams). Decomposition is read-only so worktree CWD doesn't matter for git ops, but the dev-lead still `Set-Location`s into the sub-repo's absolute path before each `CreateTeam` invocation so the team's working directory is naturally the sub-repo (specialists' Read/Grep/Glob/Bash operate in the right context).
2. **Specialist dispatch into teams.**
   - Single-repo umbrellas: spawn each specialist in the resolved dispatch set as a named teammate in a single batch into the one team.
   - Polyrepo umbrellas: per sub-repo team, spawn that sub-repo's specialists (from the sub-repo's `Active domains`). Each sub-repo team operates in parallel with the other sub-repo teams after creation.
   - Tools palette is **read-only** (`Read, Grep, Glob, Bash` -- no `Write`, no `Edit`). Decomposition is planning; no production code is touched.
3. Each dispatch prompt includes:
   - The specialist's role contract path (`.claude/agents/<team>/<name>.md`)
   - The specialist's operating-context paths (rules, memory, project-profile)
   - The Feature id and title
   - The Spec section(s) this specialist owns (verbatim)
   - The Feature acceptance criteria (verbatim, for traceability)
   - The Story and Task templates (`.claude/strap/templates/work-items/story.template.md` and `task.template.md`)
   - Task-sizing guardrails (below)
   - The expected report format, including the `tokens_used: ~XXk` finishing-summary line
   - **Polyrepo umbrellas:** the target sub-repo's `Slug`, `Path`, `Role`, `Active domains`, `Stack`, `Conventions`, and `Source-of-truth` paths verbatim from `## Sub-repos`. Brief explicitly instructs: "Decompose for sub-repo `<slug>` (path `<path>`); Task source-of-truth file references MUST point at this sub-repo's paths. Each Task you produce inherits `sub_repo: <slug>` on persistence."
   - **Multi-slug Constituent Parts:** when a Part is tagged with multiple slugs, the specialist's brief names every target sub-repo and instructs the specialist to produce one Task per sub-repo by default. Consolidation into one cross-sub-repo Task requires an explicit specialist note ("This Task is identical across <slugs> -- consolidating") that surfaces in Phase 7 for CPO approval before Phase 8 split-vs-keep decision.
   - **Cross-sub-repo dependency declaration block (polyrepo umbrellas only; v2.4 Feature 6).** Brief instructs the specialist to include a `cross_sub_repo_dependencies:` block in the SendMessage finishing report when they identify cross-sub-repo dependencies that the static Sub-repos `depends_on[]` graph and Spec section annotations did not capture. Examples: a Task in this sub-repo needs a type defined in a sibling sub-repo but the type wasn't yet declared in `depends_on`; a Task consumes an API endpoint authored in a sibling sub-repo's Constituent Part that the Spec didn't explicitly cross-reference. Block format:

     ```
     cross_sub_repo_dependencies:
       - this_task: <Task title or shortcode>
         depends_on:
           - sub_repo: <slug>
             reason: <one-line explanation: identifier, file, or behavior consumed>
     ```

     Empty list (no declarations) is the common case; specialists ONLY declare when they identified a dependency not derivable from the static or Spec-traced sources. Dev-lead parses these blocks in Phase 6 step 1b's specialist-authored source.
4. **Task sizing guardrails (universal).**
   - Minimum task size: 3 hours of senior-developer effort. Smaller tasks fold into adjacent ones.
   - Maximum 4 tasks per Story. If exceeded, split the Story.
   - Group tightly-coupled artifacts into one task. Tests live inside the implementation task except E2E and dedicated load tests.
5. Collect specialist reports as they return. On polyrepo umbrellas, reconcile per-sub-repo team outputs into one unified decomposition at Phase 6 (each Story may span sub-repos via multi-slug Constituent Part splits, or stay single-sub-repo when the Part is single-slug).

### Phase 6: Reconciliation

The dev-lead's reconciliation pass:

1. **Dependency linking.**
   1. **Intra-Feature cross-domain dependencies.** Identify cross-domain predecessors and successors among this Feature's Tasks. Document via Story Sequencing format -- host links are written in Phase 8. (Existing single-repo + polyrepo behavior.)
   2. **Cross-sub-repo dependency graph (polyrepo umbrellas; v2.4 Feature 6).** When the Feature spans multiple sub-repos, build the cross-sub-repo dependency graph from three sources -- static (T1; this Task) + Spec-traced (Story 6.1 T2) + specialist-authored (Story 6.1 T3) -- then compute a topological sort across Tasks (Story 6.1 T4). The graph drives merge ordering in /execute-sprint Story 6.2 and ordered merge-window enforcement in /refine-pr Story 6.3.

      **Source 1: Static (Sub-repos `depends_on[]`).** Read `project-profile.md`'s `## Sub-repos` section. For each sub-repo entry that appears in this Feature's affected-sub-repo set (from Phase 1's per-Part `sub_repo` resolution), capture its `depends_on:` field. Build a per-sub-repo adjacency list:

      ```
      static_graph = {
        "web-frontend": ["shared-lib"],          # web-frontend depends on shared-lib
        "api-backend": ["shared-lib"],           # api-backend depends on shared-lib
        "shared-lib": []                         # no upstream dependencies
      }
      ```

      Static edges apply at sub-repo granularity, not Task granularity: every web-frontend Task in this Feature is downstream of every shared-lib Task. The topological sort step (T4) translates sub-repo-level edges into per-Task edges by expanding each sub-repo node into its constituent Tasks.

      **Source 2: Spec-traced (consume Phase 1 step 5).** Phase 1 step 5 parsed Spec section bodies for dependency-declaring phrases and built `spec_traced_graph`. Consume it directly here. Spec-traced edges may be sub-repo-granular (when both sections map to different sub-repos) or Task-granular (when both sections map to the same sub-repo); the cross-sub-repo subset feeds this step, the same-sub-repo subset feeds sub-step (a).

      **Source 3: Specialist-authored (parse specialist finishing reports).** Each parallel specialist's SendMessage finishing report (Phase 5 step 5) may carry a `cross_sub_repo_dependencies:` block declaring dependencies the specialist identified during decomposition that the static + Spec-traced sources did not capture. **Substance retrieval**: when CreateTeam specialists go idle, their full `SendMessage` bodies persist to `~/.claude/teams/<team-name>/inboxes/dev-lead.json` rather than arriving as conversation turns. Read the inbox file to retrieve specialist substance before parsing. See dev-lead memory `operating_team_inbox_file_substance.md` for the full retrieval tradecraft. Parse each block:

      ```
      cross_sub_repo_dependencies:
        - this_task: T-NNN-shortcode
          depends_on:
            - sub_repo: shared-lib
              reason: "consumes ITokenIssuer interface defined in shared-lib"
            - sub_repo: api-backend
              reason: "calls /auth/login endpoint authored in api-backend"
      ```

      For each declaration, translate to per-Task edges: this Task -> every Task in the named upstream sub-repo. Specialist-authored edges supplement (not override) the static + Spec-traced edges. Empty declarations leave the existing edges unchanged.

      **Union the three sources.** Construct the cross-sub-repo dependency graph as the union of static + Spec-traced + specialist-authored edges. Same edge from multiple sources is a single edge (deduplicate on (upstream-sub-repo, downstream-sub-repo) at sub-repo level and (upstream-Task, downstream-Task) at Task level).

      **Short-circuit.** Single-repo umbrellas and single-sub-repo Features (only one entry in the affected-sub-repo set) skip cross-sub-repo graph computation entirely -- no cross-sub-repo edges exist, the Feature degrades to the intra-Feature dependency model of sub-step (a).
   3. **Topological sort across Tasks.** Compute a partial order across all Tasks using the union of intra-domain edges (from sub-step (a)) plus cross-sub-repo edges (from sub-step (b)). Use Kahn's algorithm (BFS-style): start from Tasks with in-degree 0 (no predecessors); emit them as wave 1; remove their outgoing edges; the new in-degree-0 set becomes wave 2; iterate.

      **Cycle detection.** If Kahn's algorithm halts with edges remaining, the graph contains a cycle (one sub-repo's Task transitively depends on itself through other sub-repos). Surface the cycle path to the CPO: "Cycle detected: shared-lib.Task X -> web-frontend.Task Y -> shared-lib.Task X. This is typically an authoring error -- review the Spec annotations and specialist-authored declarations." Stop the skill; do NOT proceed to Phase 7. Recommend the CPO correct the offending annotation / declaration via `/refine-spec` or by re-running `/decompose-feature` after specialist alignment.

      **Tie-breaking.** When two Tasks are in the same wave (no edges between them), preserve input order. Define input order as: Spec section sequence first, then sub-repo slug alphabetical, then Task title alphabetical. Stable sort -- the same Feature decomposed twice produces identical wave assignments.

      **Output.** A per-wave Task list with cross-sub-repo edges respected:

      ```
      wave_assignments = [
        {wave: 1, tasks: [{sub_repo: "shared-lib", task: "T-101"}, {sub_repo: "shared-lib", task: "T-102"}]},
        {wave: 2, tasks: [{sub_repo: "web-frontend", task: "T-201"}, {sub_repo: "api-backend", task: "T-301"}]},
        {wave: 3, tasks: [{sub_repo: "web-frontend", task: "T-202"}]}
      ]
      ```

      `wave_assignments` is the canonical dependency-graph output that Phase 7 (CPO surface) and Story 6.2 (/execute-sprint merge-order surfacing) consume. Single-repo and single-sub-repo Features produce wave_assignments with all Tasks in one or more waves but no cross-sub-repo edges.
2. **Deduplication.** Where two specialists propose overlapping work, prefer the domain expert; clarify the boundary.
3. **Consolidation.** Merge any pair of tasks that share scope, are both under 3 hours, and have a strict A-blocks-B sequential dependency. Sum estimates. Stop when no eligible pairs remain or the Story is at four or fewer tasks.
4. **Gap analysis.** Walk every Spec acceptance criterion; confirm each maps to at least one Story acceptance criterion. Flag gaps prominently.
5. **Effort coherence.** Flag outliers and disproportionate cross-domain estimates.
6. **Sequencing.** Schema first, then domain logic, then API, then client UI. Security and tests parallel with their target domain. Identify the critical path.

### Phase 7: Present unified decomposition for CPO approval

Present to the CPO:

- Summary: total Stories, total Tasks, total estimated hours, dispatched specialists.
- Dependency graph with critical path.
- **Cross-sub-repo dependency graph (polyrepo umbrellas; v2.4 Feature 6).** When Phase 6 step 1b computed cross-sub-repo edges, render the `wave_assignments` output as a CPO-readable merge order:

  ```
  Cross-sub-repo dependencies detected (3 sources: <static / Spec-traced / specialist-authored>):

    Wave 1 (no upstream dependencies):
      shared-lib:
        - Task T-101: <title>
        - Task T-102: <title>

    Wave 2 (depends on Wave 1):
      web-frontend:
        - Task T-201: <title>  -- depends on shared-lib (sources: static + Spec-traced)
      api-backend:
        - Task T-301: <title>  -- depends on shared-lib (sources: static)

    Wave 3 (depends on Wave 2):
      web-frontend:
        - Task T-202: <title>  -- depends on api-backend (source: specialist-authored)

  Independent clusters within this Feature: none.
  Cycles detected: none.

  CPO: confirm or override before Story / Task filing. Overrides apply per-Task and re-run the topological sort.
  ```

  Source attribution per edge surfaces which detection mechanism captured the dependency. CPO can override (drop or add edges) and the dev-lead re-runs the sort. The final graph persists on the Story descriptions in Phase 8.

  Empty graph (single-repo, single-sub-repo, or polyrepo with no cross-sub-repo edges) renders one line: "Cross-sub-repo dependencies: none. Sub-repos in this Feature merge independently."
- Implementation sequence (recommended execution order).
- Risk flags: gaps, estimate outliers, ambiguities, Spec deviations.
- Domain-activation summary: any domains activated this pass, any skipped (with gap consequence).

Wait for CPO approval. Apply requested adjustments (split Story, change estimate, add Story, resequence, drop/add cross-sub-repo edges) and re-present until the CPO approves.

### Phase 8: Persist work items with v2.2 lifecycle metadata

On approval, create work items via the connection profile's `operation_templates.work_item_create`.

**Description body shape (every created work item).**

The work-item template at `.claude/strap/templates/work-items/<type>.template.md` embeds the lifecycle-metadata block via Mustache placeholders (`{{ authored_by }}`, `{{ authored_at }}`, `{{ completed_by }}`, `{{ completed_at }}`) followed by the type-specific content sections. The dev-lead renders the template with these values for every Story and Task:

- `authored_by` -> `dev-lead`
- `authored_at` -> ISO-8601 timestamp at the moment of persistence
- `completed_by` -> `_(set at resolution)_`
- `completed_at` -> `_(set at resolution)_`

The remaining placeholders (e.g., `{{ story.title }}`, `{{ story.acceptance_criteria }}`, `{{ task.original_estimate_hours }}`) come from the specialist's reconciled output. The render is a single pass per work item; no separate prepend step.

**Description format conversion at the boundary.**

If `mapping.field_formats.description` is `html` (e.g., Azure DevOps `System.Description`), convert the rendered markdown body to HTML before substitution into `operation_templates.work_item_create`. If `markdown` (e.g., Local strap-agile), pass through unchanged. Conversion mechanism is a runtime detail (pandoc, node-markdown, equivalent); the contract is that what reaches the host renders cleanly.

**For each Story:**

1. Render `operation_templates.work_item_create` with placeholders:
   - `{{type}}` -> `mapping.work_item_types.story.host_type`
   - `{{title}}` -> Story title
   - `{{description}}` -> rendered description body (HTML or markdown per the conversion rule)
   - `{{parent_id}}` -> `$ARGUMENTS` (the Feature id)
   - `{{area_path}}` -> from profile or Story-specified child path
   - `{{state}}` -> `mapping.states.new`
   - `{{tags}}` -> `AI; strap:story`
2. Execute via the connection profile's transport (Bash/curl for HTTP hosts, `az` for Azure CLI, filesystem write for Local strap-agile).
3. Capture the host work-item id on the response.

**For each Task (parented to its Story):**

Same pattern with:
- `{{type}}` -> `mapping.work_item_types.task.host_type`
- `{{parent_id}}` -> the parent Story's host id
- `{{tags}}` -> `AI; strap:task`
- Additional field: `fields.original_estimate` populated

**Cross-sub-repo dependencies persistence on Story descriptions (polyrepo umbrellas only; v2.4 Feature 6).**

When Phase 6 step 1b's `wave_assignments` captured cross-sub-repo dependencies for the Feature, persist the per-Story dependency context as a "Cross-sub-repo dependencies" section in each affected Story's description body. The story.template.md placeholder set is extended to carry this content; the dev-lead renders the section when the Story participates in a cross-sub-repo edge.

Section format (rendered in the Story description's markdown / HTML):

```
## Cross-sub-repo dependencies

This Story's Tasks live in sub-repo `<this-sub-repo>` and depend on Tasks in upstream sub-repos:

- `<upstream-sub-repo-A>` -- reason: <one-line; aggregates sources>
- `<upstream-sub-repo-B>` -- reason: <one-line>

Downstream sub-repos depend on this Story's Tasks:

- `<downstream-sub-repo-C>` -- consumer reason: <one-line>

Detection sources for this Story's edges: <static / Spec-traced / specialist-authored / multiple>.

Consumed by:
- `/execute-sprint` Story 6.2 -- merge-order surfacing and cluster ordering.
- `/refine-pr` Story 6.3 -- ordered merge-window enforcement when `branch_protection.policy: ordered`.
- `/execute-sprint` Story 8.2 + `/refine-pr` Story 8.2 -- downstream test propagation when this sub-repo's tests run because an upstream sub-repo changed.
```

This section is the source of truth for re-deriving the dependency graph in downstream skills (per the Phase 3 plan: re-derive each invocation, no separate persistence). `/execute-sprint` Phase 1 (Story 6.2 T1) reads each Story's description, extracts the "Cross-sub-repo dependencies" section, and reconstitutes the graph alongside re-reading Sub-repos schema + Spec annotations. `/refine-pr` Phase 1 (Story 6.3 T1) does the same when cluster mode is active.

Stories with no cross-sub-repo edges omit the section entirely. Single-repo and single-sub-repo Features never render the section.

**Polyrepo sub_repo persistence on Tasks (polyrepo umbrellas only).**

When Phase 1 captured per-Constituent-Part `sub_repo` annotations, each Task inherits the `sub_repo` of its source Constituent Part. Persistence uses the connection profile's `mapping.fields.sub_repo` entry to encode the value per the host's storage strategy (Feature 1 schema):

- `custom_field`: set the named host field on Task creation (e.g., ADO `STRAP.SubRepo`).
- `label_prefix`: apply the prefixed label (e.g., GitHub Issues `sub-repo:<slug>`); the operation_template enforces the one-per-Task invariant.
- `yaml_field`: write the field into the Task YAML frontmatter (Local strap-agile).
- `unsupported`: skip the field with a Phase 7-surfaced gap warning so the CPO is aware cross-sub-repo execution is unavailable.

**Multi-slug Constituent Part Task split (default behavior).**

When a Constituent Part section carries a multi-slug annotation (e.g., `[sub-repos: shared-types, api-backend]`), the specialist's reconciled output is **expanded into one Task per slug by default** before Phase 8 persistence:

- Each per-slug Task carries the SAME title prefix as the parent (with the slug appended for distinguishability: `<Original title> [<slug>]`), the SAME acceptance criteria, and a `sub_repo` value of exactly one slug.
- Specialist may consolidate the multi-slug expansion during Phase 5 dispatch (e.g., when the work is genuinely identical across sub-repos and a single coordinated Task makes more sense) by emitting one Task carrying both slugs in its source-of-truth notes; CPO approves at the Phase 7 gate before persistence.
- Single-slug or unannotated Constituent Parts persist as one Task each, with `sub_repo` either set to the single slug or omitted (single-repo umbrellas).

Single-repo umbrellas (no `Sub-repos` section, no per-Part annotations from Phase 1): omit the `sub_repo` field on Task creation entirely. No multi-slug expansion. Existing behavior preserved.

**For each cross-Story dependency:**

Render `operation_templates.work_item_link_add` with `link_type=predecessor` (or `successor`, mapped via `mapping.link_types`) and execute.

**Feature state transition.**

Render `operation_templates.work_item_update` to move the Feature to `mapping.states.active`. Hosts that lack an Active state degrade per the connection profile's capability declaration -- record the actual transition in the summary; if a logical-state tag is needed for downstream visibility (e.g., `strap:active`), apply it per the existing logical-state tag convention.

Post a state-change comment via `operation_templates.work_item_comment_add`:

> `[STRAP/agent:dev-lead] State: new -> active (via /decompose-feature). Decomposed into <N> Stories, <M> Tasks.`

### Phase 9: Confirm completion

Confirm to the CPO with:

- Full Story/Task id list
- Feature state transition (was -> is)
- Domain-activation summary (anything added to project-profile.md this pass)
- Specialist-curation summary (any per-agent rules/memory updates landed via activation)
- Skipped-domain gaps (if any)
- Next-step recommendation: `/plan-sprint <feature-id>` to allocate to a sprint, then `/execute-sprint <feature-id>` to begin implementation

## Outputs

- A populated Story/Task tree under the Feature, linked to predecessors/successors.
- Original-estimate fields populated on every Task.
- Lifecycle metadata block (`Authored By: dev-lead`, `Authored At: <ts>`) at the top of every created work-item description.
- `AI` and `strap:<logical-type>` tags on every created work item.
- The Feature transitioned to `active` (or adapter equivalent), with a `[STRAP/agent:dev-lead]` state-change comment.
- Project-profile.md's `Domains` section updated with any newly activated domains.
- Specialist per-agent rules and memory updated with any newly curated domain tradecraft.
- A unified summary for the CPO.

## Quality gates

The skill is successful when all of the following hold:

- The linked Spec was in `resolved` state when the skill ran.
- Every required domain was either active in project-profile.md or activated (with CPO approval) during this run -- no specialist dispatched against a domain that isn't in the profile.
- Every dispatched specialist ran read-only (no Write, no Edit). Decomposition is planning, not implementation.
- Sizing guardrails (minimum 3 hours per task, maximum 4 tasks per Story) were enforced before persistence.
- Every persisted work item carries the lifecycle metadata block at the top of its description.
- Every persisted work item carries the `AI` tag and the appropriate `strap:<logical-type>` tag.
- Markdown-to-HTML conversion was applied for HTML-flavored hosts (no raw markdown reaches an HTML field).
- The Feature transitioned to `active` (or adapter equivalent), with a `[STRAP/agent:dev-lead]` comment recording the transition.
- The dev-lead did not rewrite specialist Story/Task content -- specialist outputs were reconciled, not regenerated.
- Requires the harness team primitive (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and a valid `CLAUDE_CODE_SPAWN_BACKEND` in the effective resolved env). Phase 5's `CreateTeam` + parallel specialist spawn depends on it.

## Failure handling

- **Linked Spec not in `resolved`**: Stop. Recommend `/refine-spec <spec-id>`.
- **Spec section name has no canonical-domain mapping**: Stop. Surface the unmapped section to the CPO; Spec needs amendment.
- **Domain-activation declined by CPO**: Two paths -- `Skip` (continue with degraded dispatch set; flag in Phase 7 summary) or `Cancel` (exit cleanly with no persistence).
- **Per-agent rules/memory curation during activation fails**: Record the gap; the activation entry in project-profile.md still lands so the next session can complete curation via `/memory-refine`.
- **`operation_templates` rendering produces malformed requests**: Surface the failing template path and request body; do not execute the malformed call.
- **HTML conversion fails for a markdown body**: Surface the offending content; do not post raw markdown into an HTML-flavored field.
- **`CreateTeam` fails (env keys missing)**: Surface an actionable error naming the offending settings layer; direct the CPO at re-running the installer.
- **A specialist times out or errors during dispatch**: Continue with the others; flag the gap in reconciliation; offer to re-dispatch the missing specialist.
- **`work_item.create` returns a transient error with no confirmation**: Render `operation_templates.work_item_query` against parent + title to check for partial creation before retrying (avoids duplicates).
- **The Feature already has children and the CPO has not chosen between fresh-start and adjust-existing**: Stop. Present the existing decomposition with options.

## References

- Source Feature: `$ARGUMENTS` (logical type `feature`).
- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- dev-lead guardrails: [`../../strap/rules/agents/dev-lead.md`](../../strap/rules/agents/dev-lead.md).
- Project profile (active domains + specialists): [`../../strap/contexts/project-profile.md`](../../strap/contexts/project-profile.md).
- Project-profile scaffold (Domains schema): [`../../strap/templates/project-profile.scaffold.md`](../../strap/templates/project-profile.scaffold.md).
- Work-tracking connection profile: `.claude/strap/state/devops-connection.yaml`.
- Story / Task templates: `.claude/strap/templates/work-items/story.template.md`, `.claude/strap/templates/work-items/task.template.md`.
- Memory-curation skill: [`../memory-refine/SKILL.md`](../memory-refine/SKILL.md).
- Upstream skill: [`../generate-features/SKILL.md`](../generate-features/SKILL.md).
- Downstream skills: [`../plan-sprint/SKILL.md`](../plan-sprint/SKILL.md), [`../execute-sprint/SKILL.md`](../execute-sprint/SKILL.md).
- Onboarding design (connection-discovery model + profile shape): [`../../strap/contexts/onboarding-design.md`](../../strap/contexts/onboarding-design.md).
