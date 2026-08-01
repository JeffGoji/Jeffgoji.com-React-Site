---
name: /refine-pr
description: Address PR feedback. Dev-lead reads reviewer comment threads and failed checks via the source-control connection profile, categorizes by domain against project-profile.md, dispatches active-domain specialists (parallel via CreateTeam for non-conflicting fixes, serial for dependent ones), reviews fixes, runs the centralized build-and-test pass, pushes updates to the existing feature branch, and posts an optional round-of-fixes summary comment. Thread resolution is owned by the human reviewer.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
---

# /refine-pr

## Purpose

Drive an open pull request through a round of reviewer feedback. The dev-lead -- this session, not a sub-agent -- reads comment threads and failed checks via the source-control connection profile, categorizes the work by domain using `project-profile.md`'s `Domains` section, dispatches active-domain specialists to apply fixes, reviews their work, runs the centralized build-and-test pass, and pushes updates back to the existing feature branch. The PR updates automatically when the source branch is pushed.

**The skill never resolves comment threads itself; thread resolution belongs to the human reviewer.** The skill prepares fixes for review, not approvals. Every `pull_request_post_comment` call uses `resolve_thread=false`.

Invoke this skill when a PR opened by [`/execute-sprint`](../execute-sprint/SKILL.md) or [`/fix-bugs`](../fix-bugs/SKILL.md) has reviewer comments or failed checks. Run it again for each subsequent round of feedback.

The skill ships portable. Every adopter-specific concern resolves at runtime:

- Specialist mapping per comment / failed check comes from `project-profile.md`'s `Domains` section (file paths -> domain -> implementation-owning specialist)
- PR metadata, comments, checks, and posted comments render through `operation_templates.<op>` in `.claude/strap/state/code-connection.yaml`
- Build and test commands come from `project-profile.md`'s `Build and test` section (per active domain)
- The audit trail for fixes lives in commit messages (`fix(#<pr-id>): <thread or check> -- <one-line>`) and in the optional round-of-fixes summary comment

## Owner

**dev-lead.** When the skill is invoked the orchestrator IS the dev-lead -- the skill does not delegate to a dev-lead sub-agent. For multi-thread / multi-check runs with non-conflicting fixes, specialists are dispatched in parallel via `CreateTeam`; for dependent or file-conflicting fixes, serial `Task` dispatch. For single-line trivial fixes (typo, lint nit), the dev-lead may implement directly.

## Inputs

- `$ARGUMENTS` -- the pull request identifier (host-defined opaque id; numeric for GitHub/Azure Repos/Bitbucket Cloud).
- `.claude/strap/contexts/project-profile.md` -- source of truth for active domains, specialist rosters, and per-domain build/test commands.
- `.claude/strap/state/code-connection.yaml` -- source-control connection profile. Required fields: `host`, `host_url`, `capabilities.{pull_request_get,pull_request_get_comments,pull_request_get_check_status,pull_request_post_comment}` all `supported`; `operation_templates.{pull_request_get,pull_request_get_comments,pull_request_get_check_status,pull_request_post_comment}`. Local Git profile cannot drive this skill -- it has no comment system and no CI surface.
- `.claude/strap/state/devops-connection.yaml` -- work-tracking connection profile. Required when the PR is linked to work items the dev-lead needs to inspect (read-only) for context.

## Pre-flight

1. **Both connection profiles exist.** If `code-connection.yaml` is missing, redirect to `/connect-code-repo`. If `devops-connection.yaml` is missing, the skill still runs but loses linked-work-item context -- surface the gap and ask the CPO whether to continue without it.
2. **Source-control profile supports PR feedback operations.** `capabilities.{pull_request_get_comments,pull_request_get_check_status,pull_request_post_comment}` all `supported`. When any are `unsupported` (e.g., Local Git profile), surface the gap and stop -- the skill cannot operate without read access to feedback. Recommend the CPO either switch to a remote profile via `/connect-code-repo` or handle the review manually.
3. **`git --version` succeeds.** Branch checkout and push depend on git.
4. **Required environment for parallel agent teams (when fan-out is in scope).** When the categorized fix plan dispatches two or more specialists in parallel, the effective resolved env must carry `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and a valid `CLAUDE_CODE_SPAWN_BACKEND`. Single-specialist or dev-lead-direct runs do not require these.

## Workflow

### Phase 1: Read the PR and feedback

1. **Read PR metadata.** Render `operation_templates.pull_request_get` with `pr_id=$ARGUMENTS` and execute. Capture: title, source branch, target branch, status, linked work items (the Feature and child Stories from `/execute-sprint`, or the Bug list from `/fix-bugs`), merge status, any merge conflicts. If the PR is not in `active` status (already merged, abandoned, completed), stop and tell the CPO.

2. **Read comment threads.** Render `operation_templates.pull_request_get_comments` with `pr_id=$ARGUMENTS` and execute. Paginate via the host's pagination mechanism until all threads are loaded. Filter to active threads (`status != resolved`). For each thread, capture: `thread_id`, `status`, anchored file path and line (when present), reviewer identity, every comment in the thread, and whether the thread is anchored to code or is a top-level discussion.

3. **Read CI / required-policy status.** Render `operation_templates.pull_request_get_check_status` with `pr_id=$ARGUMENTS` (or `commit_sha=<head-sha>` per the host's API shape) and execute. Capture failed checks: `name`, `status`, `completed_at`, and `details_url` (when the host exposes it). Skip checks in `pending` or `success` -- only failures need action.

4. **Read linked work items for context (optional).** When `devops-connection.yaml` is present and the PR carries linked-work-item ids, render `operation_templates.work_item_read` for each linked Feature / Bug to capture the work-item context the reviewer's feedback might reference (e.g., acceptance criteria the reviewer is asking to satisfy, severity context for a Bug fix). Read-only inspection; no state changes here.

5. **Resolve the PR's `sub_repo` scope and detect cluster mode.** Read `project-profile.md` for the `Sub-repos` section + schema sentinel.
   - **Single-repo umbrellas**: skip cluster detection; REPO_ROOT is the install root; single-PR mode.
   - **Polyrepo umbrellas**: run cluster discovery BEFORE single-PR sub-repo resolution. Cluster discovery has three signals (all set during /execute-sprint Story 5.3 Phase 6):

     **Signal 1 -- PR-body cluster-manifest marker.** Match the first 200 characters of the PR body against the regex:

     ```
     <!--\s*strap-pr-cluster:\s*feature-id=(\d+)\s+sub-repo=([a-z0-9-]+)(?:\s+merge-order=([^\s>]+))?\s*-->
     ```

     A match captures `feature-id`, this PR's `sub-repo` slug, and optionally the `merge-order` field (added in v2.4 Feature 6 Story 6.2 T3). The merge-order capture is optional for backwards-compatibility with pre-F6 cluster markers; pre-F6 clusters degrade to `parallel-of-<total>` semantics on parse. Story 6.3 T1 below consumes the captured merge-order. The body marker is set once by /execute-sprint Phase 6 step 2 and is never modified -- humans rarely edit the first line of a PR body, so the marker is durable across reviewer rounds.

     **Signal 2 -- Cluster-summary comment marker.** When signal 1 matched, walk this PR's top-level comments newest-first (render `operation_templates.pull_request_get_comments`; filter to top-level/discussion threads, not anchored-to-code threads) and match each comment's first line against:

     ```
     <!--\s*strap-pr-cluster-summary:\s*feature-id=(\d+)\s+siblings=([0-9,]+)\s*-->
     ```

     A match captures the authoritative sibling PR id list. Parse the comma-separated ids; filter this PR's own id from the list (the cluster-summary intentionally includes self for completeness, but the walk should not loop back). The siblings come from this comment; the body marker alone provides feature-id + this-PR-sub-repo but not the sibling list.

     **Signal 3 -- Linked-work-item walk (fallback).** When signal 1 positive but signal 2 negative (the cluster-summary comment failed to post in /execute-sprint Phase 6 step 3, was deleted, or the host does not support `pull_request_post_comment`), walk the PR's linked work items via `operation_templates.work_item_read`. Identify the parent Feature (the work-item-type=Feature among linked items, or via parent traversal from a linked Story / Task / Bug). Read the Feature's `relations` for PR-type links across the work-tracking adapter (the work-tracking host typically auto-creates PR links when /execute-sprint's pull_request_create renders `{{linked_work_items}}` with the Feature id). The collected PR ids are the sibling list (minus this PR's own id).

     Cluster mode triggers when (signal 1 positive AND (signal 2 OR signal 3 positive)). Body marker alone (signal 1 only) without siblings is insufficient for cluster operation -- the dev-lead needs to know which sibling PRs to walk in Phase 1 read step. Surface the missing sibling list to the CPO and offer single-PR fallback (operate on this PR alone, document the discovery gap).

     - **Single-PR mode** (no cluster signals positive, OR the cluster degraded to one-PR via CPO confirmation): the PR's sub_repo resolves from its linked work items' `sub_repo` field via the connection profile's `mapping.fields.sub_repo` resolver. REPO_ROOT = `<umbrella>/<sub-repo-path>` for the resolved slug. Proceed with single-PR routing.

     - **Cluster mode** (signals 1 + (2 or 3) positive): capture `cluster_feature_id`, `cluster_pr_ids` (this PR + siblings), and the per-PR sub-repo mapping (each sibling PR's body marker gives its sub-repo when walked in Story 5.4 T2). Phases 1 (sibling walk + aggregation), 2-3 (per-sub-repo categorization + grouped fix plan), 4-7 (per-sub-repo execution) all operate in cluster mode from here. Surface to the CPO in Phase 3 which signal(s) triggered cluster discovery, the sibling PR count, and the affected sub-repos.

     - **PR not linked to any work item AND no markers detected**: prompt the CPO to specify the target sub-repo for the run. Document the missing linkage as a data-quality gap.

6. **Sibling-PR walk and aggregation (cluster mode only).** When step 5 detected cluster mode, walk each sibling PR and aggregate the cluster's feedback into a unified table. Steps 1-4 already loaded this PR; step 6 loads the siblings.

   For each sibling PR id in `cluster_pr_ids` (excluding this PR):

   1. Identify the sibling's sub-repo: read the sibling PR's body marker (the same signal-1 regex applied to the sibling's body). When the sibling body marker is missing (set by an earlier broken /execute-sprint run, or human-edited away), fall back to the work-item-link `sub_repo` resolution that single-PR mode uses.
   2. Resolve the sibling's source-control connection profile via per-sub-repo `sub_repos.<slug>` overrides in `code-connection.yaml`, falling through to umbrella defaults. Heterogeneous clusters (a GitHub PR sibling of an Azure Repos PR within the same Feature) resolve each PR's get-operations under the correct profile.
   3. Render `operation_templates.pull_request_get` with `pr_id=<sibling-id>` and execute via the per-sub-repo connection profile's transport. Capture sibling-PR metadata (title, source/target branches, status, linked work items, merge status). When a sibling is no longer in `active` status (it merged early, was abandoned, or was closed by a reviewer), surface to the CPO -- a partially-merged cluster is a legitimate state but means the refine-pr round operates on the remaining-active subset.
   4. Render `operation_templates.pull_request_get_comments` with `pr_id=<sibling-id>`. Paginate. Filter to active threads (`status != resolved`). For each thread, capture the same fields as step 2 PLUS the source PR id and sub-repo slug attribution.
   5. Render `operation_templates.pull_request_get_check_status` with `pr_id=<sibling-id>`. Capture failed checks with source PR + sub-repo attribution.
   6. Read sibling's linked work items via `operation_templates.work_item_read` for context (per step 4 single-PR semantics).

   After the loop, the aggregate state contains:

   - The original PR's threads + checks + linked items (from steps 1-4).
   - Each sibling PR's threads + checks + linked items (from step 6's loop).
   - Per-thread / per-check / per-link attribution: `source_pr_id` and `sub_repo` slug.

   Aggregation table format (consumed by Phase 2 categorization and Phase 3 presentation):

   ```
   | source_pr | sub_repo      | type    | thread_id / check / link | reviewer  | file:line          | summary                          |
   |-----------|---------------|---------|--------------------------|-----------|--------------------|----------------------------------|
   | 12345     | web-frontend  | thread  | t-1001                   | reviewer1 | src/login.tsx:42   | "Use the useAuth hook"           |
   | 12345     | web-frontend  | check   | frontend-lint            | (n/a)     | (n/a)              | "Unused import"                  |
   | 12347     | shared-types  | thread  | t-2003                   | reviewer2 | (top-level)        | "Check tenant isolation"         |
   ```

   **Heterogeneous-host clusters**: per-PR connection-profile resolution is the key invariant. A cluster with one PR on GitHub and one on Azure Repos walks each correctly because each sibling's get-operations execute under its sub-repo's profile (different `host`, `auth`, `operation_templates`).

   **Failure during sibling walk**: when a per-sibling `pull_request_get` / `pull_request_get_comments` / `pull_request_get_check_status` call fails (transient network, expired auth, missing capability), surface the per-PR failure to the CPO with the partial aggregation. Degrade the failed sibling to single-PR mode (continue the rest of the cluster); the CPO can re-run `/refine-pr <pr-id>` on the failed sibling separately. Do NOT block the entire round on one sibling's failure -- the cluster is independently-reviewable PRs that coordinate, not a transactional unit.

   Single-PR mode (single-repo or single-sub-repo, or cluster degraded to one) skips this step entirely.

7. **Resolve ordered-merge state (cluster mode + v2.4 Feature 6).** When step 5 detected cluster mode, resolve each affected sub-repo's `branch_protection.policy` from the per-sub-repo connection-profile (Feature 3 schema; `sub_repos.<slug>.branch_protection.policy` falls through to umbrella defaults). Three policy values per `onboarding-design.md`'s per-sub-repo `branch_protection` field documentation:

   - `independent` (default): each sub-repo's PR merges on its own timeline; no cross-PR coordination.
   - `ordered`: this sub-repo's PR is blocked until its upstream sub-repo's PR merges (per the cross-sub-repo dependency graph). /refine-pr enforces the blocking state via the steps below.
   - `all-must-merge`: the entire cluster merges as a group, or rolls back as a group. Phase 7 Story 6.3 T3 surfaces the all-must-merge gating; the cluster body marker carries enough state for the host's branch-protection automation (if any) to do the actual blocking.

   Compute cluster-level state from per-sub-repo policies:

   - `ordered_merge_required = true` when ANY affected sub-repo declares `policy: ordered`. Triggers per-PR upstream merge-status checks in step 8 below.
   - `all_must_merge_required = true` when ANY affected sub-repo declares `policy: all-must-merge`. Triggers cluster-wide merge-state checks in step 8.

   Per-sibling merge-order positions: parse each sibling's body marker (signal 1 regex applied to each sibling PR walked in step 6) to capture each PR's `merge-order=<position>-of-<total>` field. Combined with `ordered_merge_required`, this gives /refine-pr what it needs to enforce sequencing.

   Independent clusters (every affected sub-repo's policy is `independent` AND `cluster_merge_order` from the body markers is `parallel`) short-circuit: no further enforcement work; proceed to Phase 2 categorization. Single-PR mode skips this step entirely.

   Carry `ordered_merge_required`, `all_must_merge_required`, and the per-sibling merge-order map forward to Phase 7 step 3 (blocking-status comment posting) and Phase 3 presentation (CPO sees the gating state).

8. **Upstream merge-status check + blocking state computation (cluster mode + ordered policy).** When `ordered_merge_required` is true from step 7, walk the cluster in merge-order to compute per-PR blocking state. For each downstream PR (merge-order position N > 1), enumerate all upstream PRs (positions 1..N-1 in the cluster); for each upstream PR id, render `operation_templates.pull_request_get` via that sibling's per-sub-repo connection profile and read its merge status.

   Per upstream PR, the status falls into one of:

   - **merged**: upstream is no longer blocking (downstream may merge once its own gates pass).
   - **active**: upstream is open and unmerged; downstream is blocked on this upstream until it merges.
   - **abandoned / closed-without-merge**: upstream will never merge in its current form. Surface to the CPO as a cluster-broken state; the downstream PR cannot proceed under the ordered policy until the upstream is re-opened OR the CPO overrides the ordering.

   Build `pr_blocking_state`: a per-PR map of `{pr_id: blocked_by_upstream_pr_ids[]}`. Empty list means the PR is mergeable from the ordering perspective (all upstream merged, or no upstream). Non-empty list names the upstream PR ids that must merge before this PR may merge.

   When `all_must_merge_required` is true (orthogonal to ordered policy), check that all cluster PRs are simultaneously mergeable; capture `all_must_merge_state` as a single cluster-level flag (`true` = all sibling PRs are simultaneously in a mergeable state; `false` = at least one is blocked or has unresolved checks/threads).

   Per-sibling get_status failures (transient network, expired auth, host outage) degrade per-PR: mark the failed-to-check upstream as "status unknown" rather than "merged", preserving safety (the downstream stays blocked until the next /refine-pr invocation succeeds in re-checking).

   Carry `pr_blocking_state` and `all_must_merge_state` forward to Phase 3 (CPO presentation) and Phase 7 step 3 (blocking-status comment posting).

9. **Version-pin update detection (cluster mode + v2.4 Feature 6).** When cluster mode is active AND `cluster_merge_order` has cross-sub-repo edges, scan each affected PR's source branch for version-pin update patterns. Version-pin updates are a class of cross-sub-repo dependency where a downstream sub-repo's package manifest (`package.json`, `*.csproj`, etc.) bumps the pinned version of a sibling sub-repo's published package after the upstream sub-repo merges and publishes.

   Detection inputs: the per-affected-PR diff against its target branch (rendered via the per-sub-repo connection profile's diff capability when available; falls back to `git fetch origin <target>; git diff origin/<target>..HEAD` from REPO_ROOT when the host doesn't expose a diff API).

   **File-path patterns (per language ecosystem; extensible).** Patterns surface PRs whose diff touches dependency-declaration files:

   - **JavaScript / TypeScript**: `package.json`, `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`.
   - **.NET**: `*.csproj`, `packages.config`, `Directory.Packages.props`.
   - **Java**: `pom.xml`, `build.gradle`, `build.gradle.kts`.
   - **Python**: `requirements.txt`, `pyproject.toml`, `Pipfile`, `setup.cfg`, `setup.py`.
   - **Go**: `go.mod`, `go.sum`.
   - **Rust**: `Cargo.toml`, `Cargo.lock`.

   Each pattern set is documented inline as the source of truth; future ecosystems extend this list. Adopters with non-standard dependency-declaration paths can add patterns via /memory-refine on the dev-lead's rules file.

   **Content patterns within those files.** A diff hunk that changes a version number adjacent to a dependency identifier matching a sub-repo slug in the umbrella's Sub-repos schema. Example: a hunk that changes `"shared-lib": "^1.2.3"` to `"shared-lib": "^1.3.0"` in `package.json`, where `shared-lib` is a sub-repo slug.

   Per detected version-pin PR, capture `version_pin_metadata`:

   ```
   {
     pr_id: <this PR's id>,
     sub_repo: <this PR's sub-repo>,
     bumped_dependencies: [
       {dependency_name: "shared-lib", upstream_sub_repo: "shared-lib", old_version: "^1.2.3", new_version: "^1.3.0"},
       ...
     ]
   }
   ```

   The `upstream_sub_repo` field maps the bumped dependency name to a sub-repo slug in the umbrella's Sub-repos schema. When no Sub-repos slug matches the dependency name, the bump is treated as an external (non-cluster) dependency update and not gated -- surface as a Phase 4 resolution-summary note ("this PR bumps shared-lib but shared-lib is not a sub-repo in this umbrella") so the CPO knows the detection ran but did not gate.

   Conservative-bias detection: false positives (a PR bumps a version of a non-sibling dependency that happens to share a name with a sub-repo slug) surface for CPO confirmation at the Phase 3 presentation. False negatives (a real version-pin update slips through detection) leave the PR ungated -- adopters with strict requirements catch this at human review time.

   Carry `version_pin_metadata` forward to step 10 (gating logic) and Phase 3 (CPO presentation).

10. **Version-pin gating logic (cluster mode; v2.4 Feature 6).** Integrate `version_pin_metadata` (step 9) with `pr_blocking_state` (step 8): each version-pin PR is treated as a downstream PR whose upstream is the set of sub-repos in `bumped_dependencies[].upstream_sub_repo`. The blocking gate fires when ANY of those upstream sub-repos' PRs in the cluster are unmerged.

    Merge of `version_pin_metadata` into `pr_blocking_state`: for each version-pin PR, augment its `blocked_by_upstream_pr_ids` list with the PR ids of any cluster siblings whose `sub_repo` matches an `upstream_sub_repo` from the version-pin metadata. When an upstream sub-repo has multiple PRs in the cluster (unusual but possible), all of them must merge before the version-pin PR clears.

    The blocking-status comment (Phase 7 step 3) then renders the gating reason explicitly:

    ```
    <!-- strap-pr-cluster-blocking: feature-id=<id> blocked-by=<comma-pr-ids> policy=ordered updated=<ts> -->

    **Merge gate.** This PR bumps the pinned versions of cluster siblings and is blocked pending merge of:

    - #<id-A> ([shared-lib]) -- bumps shared-lib from ^1.2.3 to ^1.3.0
    - #<id-B> ([api-backend]) -- bumps api-backend from ^2.0.1 to ^2.1.0

    Policy: ordered. Status auto-updates on each /refine-pr invocation.
    ```

    **v2.5 publish-detection scope note (documented inline).** This gating uses upstream PR _merge_, NOT upstream package _publish_ (npm publish, NuGet push, PyPI upload, etc.). The distinction matters: an upstream PR can merge to its default branch without immediately triggering a package publish (depending on the adopter's pipeline), in which case the version-pin PR's bumped dependency is not yet available to consumers when the version-pin PR merges.

    Adopters with strict publish-before-consume requirements MUST hold the version-pin PR at the human merge button until the upstream package is confirmed published -- /refine-pr surfaces the merge-state gate but does not block the actual host merge (host's branch-protection layer + the human reviewer remain the last line of defense).

    Publish-detection (subscribing to package registries, watching for publish webhooks, or polling registry endpoints) is meaningfully more complex than merge-detection: it requires per-ecosystem registry adapters (npm, NuGet, PyPI, Crates.io, Maven Central, Go proxy, etc.), per-adopter credentials for private registries, and event-driven re-checking infrastructure. Out of v2.4 scope; v2.5 candidate Feature.

    **Phase 4 resolution-summary integration.** Phase 7 step 4's resolution summary surfaces the publish-vs-merge caveat per blocked version-pin PR:

    ```
    Cross-sub-repo blocking state:
      web-frontend PR: blocked on shared-lib PR merge (version-pin: bumps shared-lib ^1.2.3 -> ^1.3.0)
        Note: this gate uses upstream PR MERGE, not upstream PACKAGE PUBLISH. Confirm shared-lib has published v1.3.0 before merging this PR (manual gate).
    ```

    Independent clusters and single-PR mode skip version-pin gating entirely; only cluster mode with detected version-pin metadata triggers this step.

11. **Re-derive F6 dependency graph for downstream-propagation lookup (cluster mode; v2.4 Feature 8 Story 8.2).** When cluster mode is active, reconstitute the full F6 cross-sub-repo dependency graph from the same three input sources as /execute-sprint Phase 1 step 5:

    - **Static**: per-affected-sub-repo `depends_on[]` from `project-profile.md`'s Sub-repos schema.
    - **Spec-traced**: parse Constituent Part section bodies of the linked Spec for dependency phrases via the patterns documented in /decompose-feature Phase 1 step 5.
    - **Specialist-authored**: read each linked Story's description; extract the `## Cross-sub-repo dependencies` section that /decompose-feature Phase 8 wrote when the Story participates in a cross-sub-repo edge.

    Union with edge deduplication. Output: `f6_dependency_graph` -- a per-sub-repo adjacency list (`{<sub-repo>: [<upstream-sub-repos>], ...}`) carried forward to Phase 6 step 2 (downstream test propagation in centralized build-and-test).

    Steps 7 + 8 already use a partial projection of this graph (the per-sibling merge-order positions parsed from body markers). Step 11 is the full edge set, required for downstream propagation lookup. Re-derivation pattern mirrors /execute-sprint Phase 1 step 5 -- the canonical re-derive-each-invocation discipline, no separate persistence.

    Independent clusters (no edges from any source) yield an empty `f6_dependency_graph`; Phase 6 step 2 downstream propagation short-circuits. Single-PR mode skips this step entirely.

### Phase 2: Categorize feedback by domain

**Cluster-mode preamble.** In cluster mode (Phase 1 step 6 loaded the aggregated table with `source_pr_id` + `sub_repo` attribution per row), categorization operates per-row using the row's `sub_repo` attribution. Each row's specialist mapping uses THAT sub-repo's `Active domains` field from `project-profile.md` (set by /strap-in's extended interview in Feature 4) -- not umbrella-wide and not the dev-lead's working sub-repo. A thread anchored to `web-frontend/src/login.tsx` resolves to web-frontend's specialist via web-frontend's Active domains, even when other PRs in the cluster live in sub-repos with different Active domains.

**Cross-sub-repo specialists.** Some specialists are domain-agnostic and always available regardless of any one sub-repo's domain set -- `security-reviewer` is the canonical example; `test-strategist` and `integration-specialist` qualify when the threads they would handle span 2+ sub-repos. Cross-sub-repo specialists dispatch ONCE per cluster (not once per sub-repo), with a brief that names every PR + sub-repo their concern spans. They land via serial `Task` dispatch (Phase 5) rather than into a per-sub-repo team, because their work is cluster-wide rather than sub-repo-scoped.

**Cross-PR contradiction patterns (cluster mode only).** When the cluster's aggregated table carries reviewer feedback from 2+ PRs, the same Feature can receive contradictory directives across sub-repos -- one reviewer asks for X in repo-A, another asks for not-X in repo-B; or one reviewer's "extract this helper" in repo-A conflicts with another's "inline this helper" in the shared sub-repo. Contradictions are NOT auto-resolved by the dev-lead; they surface to the CPO for arbitration (Phase 3) before specialist dispatch (Phase 5). This subsection defines the patterns that drive detection; the actual detection pass runs after per-thread categorization (see end of Phase 2 below).

Three pattern categories. Conservative-bias detection: when a candidate pair is ambiguous, flag it. False positives are cheap (the CPO clears them at the arbitration gate in seconds); false negatives are silent (specialists get dispatched into contradiction-land, conflicts surface as merge or behavior conflicts after the round).

1. **Lexical opposites anchored to the same symbol.** Paired antonym keywords applied to the same identifier across PRs. Detection scans for thread pairs (one in each of two different PRs in the cluster) where:
   - Both threads reference the same identifier (function name, type name, variable name, file path, or class name -- captured by token extraction from the comment text).
   - One thread carries a keyword from a paired set; the other carries its opposite from the same set.

   Paired sets (extensible; bias toward over-flagging):

   | One side               | Opposite side          |
   |------------------------|------------------------|
   | add, include, enable   | remove, exclude, disable |
   | use, prefer, adopt     | avoid, reject, drop    |
   | keep, preserve, retain | delete, drop, remove   |
   | expose, public, export | hide, private, internal|

   Worked example: PR-A thread on `src/auth/login.cs:42` says "use the existing `ITokenIssuer`"; PR-B thread on `shared-lib/auth.cs:18` says "avoid `ITokenIssuer` here, it's deprecated". Same identifier (`ITokenIssuer`); paired keywords (use / avoid); flagged for CPO arbitration.

2. **Opposite naming requests.** Rename-to-X vs keep-as-Y for the same symbol across PRs. Detection scans for thread pairs where:
   - Both threads reference the same identifier.
   - One thread uses a rename pattern (`rename to`, `rename this to`, `should be called`, `should be named`).
   - The other thread uses a preserve pattern (`keep as`, `the name is fine`, `don't rename`, `prefer the existing name`).

   Worked example: PR-A thread says "rename `UserService` to `UserController` to match the Controller convention"; PR-B thread says "the `UserService` name is fine, don't touch it -- it matches the shared-types convention." Same target (`UserService`); rename vs preserve; flagged.

3. **Opposite architectural direction.** Extract-vs-inline, abstract-vs-concrete, separate-vs-merge applied to the same component across PRs. Detection scans for thread pairs where:
   - Both threads reference the same identifier OR the same file path.
   - One thread uses a direction-A pattern; the other uses a direction-B pattern.

   Direction pairs:

   | Direction A                          | Direction B                          |
   |--------------------------------------|--------------------------------------|
   | extract, factor out, pull up         | inline, fold in, push down           |
   | abstract, generalize, parameterize   | concretize, specialize, hard-code    |
   | separate, split, decompose           | merge, combine, consolidate          |

   Worked example: PR-A thread on `shared-lib/auth.cs` says "extract this duplication into a shared helper"; PR-B thread on the same file says "inline this helper, it's only used once now." Same file; extract vs inline; flagged.

**Detection-pass algorithm.** After per-thread categorization completes (the per-thread + per-check rules below), iterate the aggregated table to identify candidate pairs:

- Compute the cross-PR product: for every (thread_A, thread_B) where `source_pr_id_A != source_pr_id_B` (cross-PR within the cluster), evaluate each pattern category against the pair.
- For each pattern that matches:
  - Capture: the pair of threads (full attribution: source_pr_id, sub_repo, file:line, reviewer, comment text), the matched pattern category, the detected anchoring identifier or file path.
- Deduplicate: a thread pair that matches multiple pattern categories appears once with all matched categories listed.
- Persist the contradiction-pair list as state for Phase 3 presentation; the per-thread / per-check categorization from earlier in this Phase remains the source of truth for non-contradicting items.

Detection is intentionally syntactic-first (lexical pattern matching on the comment text). Semantic-level contradiction detection (LLM-driven interpretation of reviewer intent) is feasible but out of scope for v2.4; this layer's conservative-bias false-positive cost is low enough that semantic enhancement is a v2.5+ refinement, not a v2.4 requirement. Single-PR mode skips detection entirely (no cross-PR pairs to evaluate).

For each active comment thread (or each row in the aggregated table for cluster mode):

1. **Determine the target domain** by mapping the anchored file path (when present) against `project-profile.md`'s `Domains` section -- each domain entry's `Source-of-truth` field declares path conventions; match the file against those conventions. In cluster mode, the lookup uses the row's `sub_repo` to scope to that sub-repo's `Active domains`.
2. **For non-anchored top-level threads**, infer from comment content keywords:
   - Security concerns -> `security-reviewer` (always available, not tied to a domain). In cluster mode, when one cluster carries 2+ security threads across different sub-repos, group them under a single security-reviewer dispatch.
   - Test coverage / test correctness -> `test-strategist`. Group across cluster when spanning sub-repos.
   - Integration / external-system concerns -> `integration-specialist` when that domain is active in the row's sub-repo.
   - General architecture or scope concerns -> escalate to the CPO via the proposal (do not auto-dispatch).
3. **Resolve domain to specialist** via the `Domains` entry's `Specialists` field (implementation-owning specialist; typically the engineer). In cluster mode, the resolution uses the row's `sub_repo`'s `Active domains` -- two threads on identical file paths but in different sub-repos may resolve to different specialists if the sub-repos' Active domains differ.
4. **When no domain match exists**, surface the thread to the CPO for manual routing in the proposal; do not guess.

For each failed check:

1. **Identify failure type**: `build`, `test`, `lint`, or `policy`.
2. **Route by failure type and failing file path** the same way as comments:
   - Build/test failures in backend paths -> backend-engineer; in frontend paths -> frontend-engineer; in data paths -> database-engineer; in infra paths -> devops-lead.
   - Lint failures -> the specialist owning the affected tree.
   - Policy violations (branch protection, CODEOWNERS, required-reviewer rules) -> the dev-lead direct (policy is dev-lead's by definition).

**Run the contradiction-detection pass (cluster mode only).** After per-thread categorization and per-check routing complete, but before transitioning to Phase 3, run the detection-pass algorithm defined in the "Cross-PR contradiction patterns" subsection above. Inputs: the fully-categorized aggregated table (every row carries source_pr_id, sub_repo, file:line, reviewer, comment text, assigned specialist). Outputs: a list of contradiction pairs, each capturing both source comments' full attribution + the matched pattern category (or categories) + the detected anchoring identifier or file path. Persist as `cluster_contradictions` state that Phase 3 reads when rendering the "Needs CPO arbitration" section.

When the detection pass returns an empty list (no contradictions detected across the cluster), Phase 3 omits the arbitration section entirely and proceeds to the per-sub-repo + cross-cluster fix plan directly. When non-empty, Phase 3 surfaces the arbitration section ABOVE the fix-plan tables (Story 5.5 T3 work).

Single-PR mode skips this step (no cross-PR comparison surface). Note: contradictions can also surface within a single PR (one reviewer asking for X while another asks for not-X on the same PR); the v2.4 scope is cross-PR only, and intra-PR contradictions stay surfaced as ambiguous-dispatch items in Phase 3's existing "Items needing CPO input" line (the dev-lead flags during categorization rather than via automated detection).

### Phase 3: Present the categorized feedback and fix plan

Presentation adapts to mode.

**Single-PR mode** (single-repo, single-sub-repo, or cluster degraded to one PR). Present to the CPO:

```
PR: <id> - <title>
Source: <source-branch> -> Target: <target-branch>
Status: <status>
Linked work items: <list>

Active comment threads:
| # | File:line              | Reviewer  | Domain      | Specialist        | Summary                           |
|---|------------------------|-----------|-------------|-------------------|-----------------------------------|
| 1 | src/auth/login.cs:42   | reviewer1 | api         | backend-engineer  | "Use the existing ITokenIssuer..." |
| 2 | (top-level)            | reviewer2 | security    | security-reviewer | "Check tenant isolation here..."  |
| 3 | ui/Dashboard.tsx:118   | reviewer1 | client-ui   | frontend-engineer | "Extract to a hook"               |

Failed checks:
| Check                | Type  | Specialist        | Summary                       |
|----------------------|-------|-------------------|-------------------------------|
| backend-build        | build | backend-engineer  | "Unresolved type: ICache"     |
| frontend-lint        | lint  | frontend-engineer | "Unused import"               |

Proposed fix plan (grouped by specialist):
- backend-engineer: thread 1, failed check `backend-build`           (parallel-A)
- security-reviewer: thread 2                                         (parallel-A)
- frontend-engineer: thread 3, failed check `frontend-lint`           (parallel-A)

Items needing CPO input (NOT auto-dispatched):
- (none, or list threads where dispatch was ambiguous / dev-lead disagrees with the reviewer)
```

**Cluster mode** (cluster discovered in Phase 1 step 5; siblings walked in step 6). Present to the CPO:

```
Coordinated PR cluster from Feature #<cluster_feature_id>
N PRs across sub-repos: <list>
Discovery signals: <which of signals 1/2/3 fired>
Total active comment threads: <T>
Total failed checks: <C>
Total specialists to dispatch: <S>  ([per-sub-repo: <S1>; cross-cluster: <S2>])

--- Needs CPO arbitration (rendered only when cluster_contradictions is non-empty) ---

Pair 1 (matched pattern: <category>):
  Side A: PR #<id-A> ([<sub-repo-A>]) thread <t-XXXX> by <reviewer-1> at <file-A:line-A>
    "<comment text A>"
  Side B: PR #<id-B> ([<sub-repo-B>]) thread <t-YYYY> by <reviewer-2> at <file-B:line-B>
    "<comment text B>"
  Anchor: <identifier or file path that triggered the match>
  Dev-lead read: <optional alignment heuristic when discernible -- which side seems aligned with the rest of the cluster's direction, or "ambiguous">

Pair 2 (matched pattern: <category>):
  ...

(Threads listed above are EXCLUDED from the per-sub-repo / cross-cluster fix-plan tables below until arbitration resolves.)

--- Per sub-repo ---

[<sub-repo-A>] PR #<id-A> - <title>
Source: <source-A> -> Target: <target-A>
Status: <status-A>
Linked work items: <list-A>

Active comment threads (<sub-repo-A>):
| # | File:line | Reviewer | Domain | Specialist | Summary |
|---|-----------|----------|--------|------------|---------|
...

Failed checks (<sub-repo-A>):
| Check | Type | Specialist | Summary |
|-------|------|------------|---------|
...

[<sub-repo-B>] PR #<id-B> - <title>
...

--- Cross-cluster (cluster-wide concerns) ---

| # | source_pr / file:line | Reviewer | Specialist | Summary |
|---|-----------------------|----------|------------|---------|
...
(Security, test-coverage, or integration threads grouped because they span the cluster.)

--- Proposed fix plan ---

Per-sub-repo dispatch (each team handles its sub-repo's fixes):
- [<sub-repo-A>] frontend-engineer: thread A-1, check `frontend-lint`            (in team refine-pr-<cluster_feature_id>-<sub-repo-A>; parallel-A)
- [<sub-repo-B>] backend-engineer: thread B-3                                     (in team refine-pr-<cluster_feature_id>-<sub-repo-B>; parallel-A)

Cross-cluster dispatch (serial Task; brief names all affected sub-repos):
- security-reviewer: thread A-2, thread B-1 (spans <sub-repo-A> + <sub-repo-B>)  (read/analysis; surfaces findings to per-sub-repo teams)

Items needing CPO input (NOT auto-dispatched):
- (Ambiguous dispatch only -- contradiction pairs surface in the dedicated arbitration section above.)
```

**Arbitration workflow (cluster mode with non-empty `cluster_contradictions`).** When the arbitration section is rendered, the gate runs in two stages.

**Stage 1 -- Per-pair arbitration.** For each contradiction pair in `cluster_contradictions`, prompt the CPO via `AskUserQuestion` with four options (or batch up to 4 pairs per AskUserQuestion call when the total exceeds 4 pairs; the question itself names which pair is being arbitrated):

- **Drop both** -- both threads are excluded from specialist dispatch. The dev-lead renders an arbitration reply on EACH side via `operation_templates.pull_request_post_comment` with `resolve_thread=false`. Reply body template:

  > Arbitration: This thread conflicts with PR #`<other-pr-id>` ([`<other-sub-repo>`]) thread `<t-XXXX>` at `<other-file:line>`. The CPO arbitrated to drop both -- this comment is deferred. Please discuss with the conflicting reviewer or open a follow-up PR to align direction across the cluster.

- **Keep side A** -- side A's thread proceeds to specialist dispatch normally; side B is excluded. Dev-lead posts an arbitration reply on side B only:

  > Arbitration: This thread conflicts with PR #`<other-pr-id>` ([`<other-sub-repo>`]) thread `<t-XXXX>` at `<other-file:line>`. The CPO arbitrated to address the conflicting reviewer's direction in PR #`<other-pr-id>` -- this comment is deferred. Please discuss with the reviewer in #`<other-pr-id>` or open a follow-up PR.

- **Keep side B** -- symmetric: side B proceeds to dispatch; side A gets the arbitration reply.

- **Not a contradiction** -- the detection pass over-flagged; both threads proceed to specialist dispatch normally. The dev-lead notes the false-positive in the resolution summary (Phase 7 step 3) so the pattern definitions can evolve in future revisions.

The dev-lead executes per-pair arbitration replies as the CPO answers each AskUserQuestion. The reply uses the relevant sub-repo's per-sub-repo `pull_request_post_comment` connection-profile resolution. Posting failures on arbitration replies are surfaced but do not block subsequent stage-1 questions -- the CPO can post arbitration manually on the relevant PR if the host's comment API is failing.

**Stage 2 -- Main approval gate.** After stage 1 completes, re-render the per-sub-repo + cross-cluster fix-plan tables with arbitration outcomes applied (dropped threads removed from per-specialist dispatch lists; surviving threads kept). Present the updated plan + the main approval gate.

**Single-mode approval gate** (or cluster mode with no contradictions detected). Single-stage. Use `AskUserQuestion` for the approval gate. Options:

- `Approve and dispatch`
- `Modify before dispatching` -- the CPO names which threads to drop, reroute, or push back on (dev-lead replies on the PR thread with the reasoning instead of dispatching a fix). Re-present after edits.
- `Cancel` -- exit cleanly with no dispatch and no push.

The approval gate is a SINGLE `AskUserQuestion` covering the entire cluster (or single PR) -- one approval whether single-PR or cluster, never N approvals -- mirroring /execute-sprint's gate semantics.

Per the dev-lead's human-authority discipline, no fix is dispatched without CPO approval, and arbitration is never auto-resolved.

### Phase 4: Checkout and prepare the feature branch(es)

REPO_ROOT(s) for this run derive from Phase 1 step 5's resolution:

- **Single-repo umbrellas**: REPO_ROOT is the install root.
- **Single-PR mode on polyrepo umbrellas**: REPO_ROOT is `<umbrella>/<sub-repo-path>` for the resolved sub-repo.
- **Cluster mode**: N REPO_ROOTs, one per PR in `cluster_pr_ids`, each at `<umbrella>/<sub-repo-path>` for that PR's sub-repo.

The dev-lead `Set-Location`s into REPO_ROOT (absolute path) before any git command in this Phase, per the v2.3.8 universal absolute-path discipline. In cluster mode, `Set-Location` lands once per PR at the head of each loop iteration; after each iteration's git operations complete, the dev-lead returns to umbrella root before the next iteration.

1. **Fetch and checkout each PR's source branch.** Single modes operate on the one source branch in the one REPO_ROOT; cluster mode loops over each PR.

   For each PR (this PR alone in single modes; this PR + every sibling in cluster mode):
   - `Set-Location` into the PR's REPO_ROOT.
   - `git fetch origin <source-branch>`
   - `git checkout <source-branch>`
   - `git pull origin <source-branch>`

2. **Verify a clean working tree** in each affected REPO_ROOT (`git status --porcelain`). Stop if there are uncommitted changes in ANY affected REPO_ROOT; ask the CPO to commit or stash first. Cluster mode requires every sub-repo to be clean -- partial cleanness is not a safe operating state for a coordinated round.

After Phase 4, the dev-lead returns to umbrella root (single `Set-Location`) before Phase 5 begins. In cluster mode, every affected sub-repo's source branch is checked out and clean.

This skill operates against the main checkout at each REPO_ROOT, not a worktree. Worktree management is owned by `/execute-sprint` (which created the feature branch(es) in the first place); `/refine-pr` is a feedback-handling pass against the existing branch(es).

### Budget enforcement

Per [`budget-discipline.md`](../../strap/contexts/budget-discipline.md), `/refine-pr` operates against two budgets pulled from `.claude/strap/state/usage.yaml` at workflow start. Defaults from `budget-discipline.md`'s defaults table: per-agent **100K**, session aggregate **500K**. The CPO can override via `/memory-refine dev-lead` (or, once `/revise-token-budget` ships, via that skill).

**Dispatch-time budget pull.** After Phase 4 completes (source branch checked out, working tree clean) and before Phase 5 begins (specialist dispatch):

1. Read `.claude/strap/state/usage.yaml`. Pull `budgets.refine-pr.per_agent` and `budgets.refine-pr.session_aggregate`. Also pull `budgets.refine-pr.agent_overrides` if present -- per-agent overrides established via `/revise-token-budget --agent <name>` take precedence over the workflow default at dispatch-time per-agent resolution (see `budget-discipline.md` "Per-agent overrides"). If `usage.yaml` is missing (the `/strap-in` scaffold step should have created it), surface the gap and stop with a recommendation to run `/strap-in` or `/strap-refresh`.
2. Initialize the `session` block:
   - `session.workflow: refine-pr`
   - `session.workflow_instance: refine-pr-<pr-id>` (matches Phase 5's `CreateTeam` `team_name`)
   - `session.started_at: <ISO-8601 timestamp>`
   - `session.specialists_used: 0`
3. For every specialist that will be dispatched in this round (one per thread / failed check per the Phase 3 fix plan), reset `agents.<name>.used_in_current` to `0` (preserve `agents.<name>.last_dispatch`). Specialists not in this round's roster are left untouched. Pure dev-lead-direct runs (single-line trivial fixes only) skip steps 2-3 since no specialist budget is consumed.

Note: each invocation of `/refine-pr` on the same PR is a new workflow instance. Per-agent counters reset round-to-round; the session aggregate resets each round.

**Per-agent budget in the dispatch brief.** Append a budget line to every specialist's brief, mirroring `/strap-in` Section 6. The effective `<per-agent-budget>` value resolves per `budget-discipline.md` "Dispatch-time resolution": `agent_overrides.<name>.per_agent` if present, else `per_agent`:

> "Your budget for this dispatch is `<per-agent-budget>` tokens. Include `tokens_used: ~XXk` as the final line of your finishing summary."

This carries the per-agent budget into the specialist's awareness and enforces the self-reporting contract that token accounting depends on. Per the agent-devs team rule, every specialist already self-reports the line; the brief makes the budget for THIS dispatch explicit.

**Token accounting.** When each specialist's `SendMessage` finishing report returns at Phase 6 review time, parse the `tokens_used: ~XXk` line. Add to `agents.<name>.used_in_current`; sum into `session.specialists_used`. Update `agents.<name>.last_dispatch` to the dispatch's ISO timestamp. Persist after each specialist completes (not just at workflow end) so a session interruption preserves accurate state.

**60% session-aggregate checkpoint.** When `session.specialists_used` crosses 60% of the configured session aggregate (same threshold `/strap-in` Section 7 uses):

1. Surface to the CPO: "Specialists have consumed ~`<X>`K of the `<Y>`K session aggregate. Recommending checkpoint."
2. Run `/context-prep refine-pr-<pr-id>` to capture in-flight workflow state (which threads / checks are addressed, which are pending, which commits landed) in a continuation.
3. Instruct the CPO: "Run `/usage` to confirm your own window; then `/clear` and start a fresh session. On resume, run `/context-fetch refine-pr-<pr-id>` first."
4. The CPO confirms or overrides. On override ("plenty of room, push through"), proceed and note the override in the continuation for future sessions to learn from.

**Per-agent exhaustion.** When `agents.<name>.used_in_current` reaches its per-agent budget for a specialist whose assigned threads / checks in this round are not yet complete:

- Do NOT redispatch that specialist within this workflow instance.
- Work with what the specialist already produced; review the landed fix work normally.
- Note the exhaustion under `agents.<name>` in `usage.yaml` (e.g., add `exhausted_at: <ISO-timestamp>` to the agent's entry).
- For the unaddressed threads / checks assigned to the exhausted specialist, escalate to the CPO in Phase 7's resolution summary as "remaining issues -- specialist budget exhausted; either expand budget via `/revise-token-budget` and re-run `/refine-pr <pr-id>`, or hand off the remaining items manually."

Per-agent budget is per-workflow-instance, not per-session. After a 60% checkpoint, the new session reads `agents.<name>.used_in_current` to know how much each specialist has left in this round's instance.

**Workflow-completion close-out.** At the end of Phase 8 (Clean up), after the round-of-fixes summary is posted:

- Write `session.completed_at: <ISO-8601 timestamp>` to `usage.yaml`.
- Preserve `agents.<name>.used_in_current` as the closing value -- it gets reset at the next workflow instance's dispatch-time budget pull.

**Per-skill tuning.** `/refine-pr` fans out to multiple specialists in parallel -- one per thread or failed check. The 100K per-agent budget per specialist matters most; the 500K session aggregate binds only when a PR has many threads spanning multiple domains. A PR with one or two threads typically lands well under budget; a PR with eight or more threads spanning multiple domains is the realistic checkpoint trigger. Dev-lead-direct trivial fixes (single-line typo or lint nit per the Owner section) do not consume from `usage.yaml`; the CPO's `/usage` discipline is the only signal for dev-lead consumption (see `budget-discipline.md` "Who watches what").

### Phase 5: Dispatch specialists

1. **For parallel fan-out** (two or more specialists with no file conflicts): team creation adapts to mode.
   - **Single-repo umbrellas, single PR**: `CreateTeam(team_name: "refine-pr-<pr-id>")`. One team.
   - **Polyrepo umbrella, single-PR mode**: `Set-Location` into REPO_ROOT (the resolved sub-repo's absolute path); `CreateTeam(team_name: "refine-pr-<pr-id>-<sub-repo-slug>")`. The team inherits the dev-lead's CWD.
   - **Cluster mode**: loop over each affected sub-repo (one per PR in `cluster_pr_ids`) sequentially:
     1. `Set-Location` into the sub-repo's REPO_ROOT (absolute path; one tool call per sub-repo; never compound `cd ... && CreateTeam`).
     2. Invoke `CreateTeam(team_name: "refine-pr-<cluster_feature_id>-<sub-repo-slug>")`. The team inherits the dev-lead's CWD; subsequent team-internal operations scope to that sub-repo's git.

     Team creation MUST be sequential (CreateTeam inherits dev-lead CWD; the dev-lead has one CWD -- same constraint as /execute-sprint Story 5.2 T1). After all N teams exist they operate in parallel; parallel fan-out happens within team processes, supervised by the dev-lead via per-team `SendMessage`. The dev-lead returns to umbrella root after the final team-creation iteration.

   **Cross-cluster specialists** (security-reviewer, test-strategist, integration-specialist when handling cluster-spanning concerns per Phase 2 preamble) do NOT land in a per-sub-repo team. They dispatch via serial `Task` with a brief that names every affected PR + sub-repo + the consolidated thread / check list. Their work is cluster-wide rather than sub-repo-scoped, so a single dispatch suffices.

   Spawn each per-sub-repo specialist as a named teammate via single batched dispatch into the appropriate team.

2. **For serial dispatch** (file conflicts, sequenced dependencies, dev-lead-direct trivial fixes, cross-cluster specialists per step 1): use serial `Task` or direct dev-lead implementation as appropriate.

3. **Each specialist's brief includes:**
   - The specialist's role contract and operating-context paths (rules, memory, project-profile, active domain entry; in cluster mode, the active domain entry for THIS specialist's sub-repo, except for cross-cluster specialists whose brief lists every affected sub-repo).
   - The PR id (in cluster mode, the source PR for each assigned thread / check), the source branch name, the linked Feature / Bug ids for context. In cluster mode, also include `cluster_feature_id` so the specialist can reason about cluster-wide concerns when reviewing related context.
   - The threads assigned to it: `thread_id`, source PR id and sub-repo (cluster mode), file path and line (when anchored), reviewer identity, full comment text, and the dev-lead's interpretation of the required fix (the *what* and *why*, not a prescriptive *how*).
   - The failed checks assigned to it: check name, type, source PR + sub-repo (cluster mode), error output or `details_url`, and the required fix.
   - **Sub-branching policy.** Small fixes (one or two files, contained change) commit directly to the source branch from the specialist's worktree (or the main checkout for dev-lead direct). Substantial fixes (multiple files, structural change) create a sub-branch from the source branch (`<source-branch>/fix-<thread-id>`) for the dev-lead to merge after review. The specialist makes this judgment. In cluster mode, sub-branches live in the per-sub-repo git only -- a specialist never creates a sub-branch in a sibling sub-repo's repository.
   - The mandate to author or update tests when the feedback requires it. Per the centralized-test-execution rule, the specialist WRITES tests; the dev-lead RUNS them at Phase 6.
   - The mandate to commit with traceable messages: `fix(#<source-pr-id>): thread <thread-id> -- <one-line>` for comment-driven fixes (use the SOURCE PR id, not the cluster's first PR, to keep traceability anchored to the actual reviewer's PR); `fix(#<source-pr-id>): check <check-name> -- <one-line>` for failed-check fixes.
   - **Explicit do-not-resolve constraint**: the specialist MUST NOT call any host API that resolves a comment thread. Thread resolution is the human reviewer's call only.
   - The required `SendMessage` finishing report: what was changed per assigned item, files touched, tests written, deviations from the dev-lead's interpretation, any items the specialist disagrees with or needs clarification on, the `tokens_used: ~XXk` line.

   **Substance retrieval after CreateTeam specialists go idle.** Idle-notification preview turns arrive as conversation turns, but full `SendMessage` bodies persist to disk at `~/.claude/teams/<team-name>/inboxes/dev-lead.json`. In cluster mode, each per-sub-repo team has its own inbox: `~/.claude/teams/refine-pr-<feature-id>-<sub-repo-slug>/inboxes/dev-lead.json`. Iterate each team's inbox to retrieve specialist substance before review (Phase 6). Serial `Task` dispatch (for cross-cluster specialists) does NOT exhibit this pattern -- full bodies arrive as turns. See dev-lead memory `operating_team_inbox_file_substance.md` for the full retrieval tradecraft.

### Phase 6: Review fixes and run centralized build-and-test

1. **As each specialist completes**, review the changes. In cluster mode, the dev-lead supervises returns from N teams + serial cross-cluster dispatches concurrently; review steps operate against the sub-repo where the returning specialist's work lives. `Set-Location` into the appropriate REPO_ROOT precedes every git command in the review.
   - Read the diff against each assigned thread / check.
   - Verify the fix actually addresses the reviewer's feedback (not a near-miss or a partial fix).
   - When the specialist created a sub-branch, merge it into the source branch from the main checkout (the source PR's REPO_ROOT in cluster mode): `git merge --no-ff <sub-branch>`. Verify the merge succeeds before deleting the sub-branch.
   - When issues remain, `SendMessage` the specialist with specific corrections; wait for the updated push or worktree commit.

2. **After all specialists complete**, run the centralized build-and-test pass. Execution adapts to mode:
   - **Single-repo / single-sub-repo modes**: build per active-domain command from `project-profile.md`'s `Build and test` section (every active domain that landed work in this round); test per active-domain command.
   - **Cluster mode**: group affected sub-repos by `parallel_safe` (per the Sub-repos schema; default `false`) into sequential and parallel batches, then execute in order (v2.4 Feature 8 Story 8.1):
     - **Sequential batch first**: parallel_safe=false sub-repos. Run one at a time in slug-alphabetical order. For each, `Set-Location` into REPO_ROOT, execute `test_command` + `build_command`, capture per-sub-repo result.
     - **Parallel batch second (subprocess fan-out; v2.4 Feature 8 Story 8.1 T2)**: parallel_safe=true sub-repos execute concurrently via the harness's `run_in_background` Bash primitive. For each parallel-safe sub-repo, `Set-Location` into its REPO_ROOT (Set-Location MUST land BEFORE subprocess launch; subprocess CWD inherits the dev-lead's CWD at launch time). Invoke `test_command` as a background process; batch multiple background launches in a single message per the parallel-tool-call discipline. After all parallel-batch subprocesses are launched, the dev-lead does NOT poll -- the harness notifies on completion; the dev-lead waits on completion notifications for all parallel-batch members before proceeding. Per-sub-repo exit code + stdout capture maps to pass/fail + diagnostic. Failure isolation: one sub-repo's non-zero exit does NOT abort other concurrent subprocesses; the aggregation gate (Story 8.1 T3) decides cluster-wide pass/fail.
     - **Sequential-first rationale**: parallel_safe=false sub-repos may have shared state (test databases, fixed ports, fixture conflicts); isolating them avoids concurrency-induced flakes.
     - **Downstream propagation** layers on top (Story 8.2): the F6 dependency graph (Phase 1 step 11's `f6_dependency_graph`) drives whether downstream sub-repos' tests also run for this round. Source set: the sub-repos that received fix commits this round (from the per-PR fix dispatch in Phase 5). Walk transitive downstream sub-repos from the graph; build `test_propagation_set` with `source: true | false` per entry. Empty graph (independent cluster) reduces propagation to just source sub-repos. The propagation set respects `parallel_safe` batch grouping for the FULL set, not just source members. Downstream tests run even when downstream code did not change; failed source tests do NOT cancel downstream propagation; Set-Location protocol applies per sub-repo regardless of source flag.
     - **Aggregation gate (Story 8.1 T3 + Story 8.2 T3 propagation attribution)**: after sequential + parallel batches both complete, aggregate per-sub-repo results into a single PR-blocking gate with explicit propagation attribution:

       ```
       round_test_result = {
         status: "pass" | "fail",
         per_sub_repo: [
           {sub_repo: "<slug>", source: true | false, batch: "sequential" | "parallel", exit_code: <int>, summary: "<head + tail of stdout>", propagated_from: [<source sub-repos when source=false>]},
           ...
         ]
       }
       ```

       Aggregate `status: "pass"` only when every per-sub-repo `exit_code == 0`. Any non-zero exit fails the cluster gate. The `source` flag + `propagated_from` make attribution explicit for failure-dispatch routing.
   - Per the agent-devs centralized-test-execution rule, only the dev-lead runs these.
   - When the aggregation gate fails, dispatch routing depends on the failing sub-repo's `source` flag (mirroring /execute-sprint's policy):
     - **`source: true`**: dispatch into the failing sub-repo's team. Standard same-sub-repo fix.
     - **`source: false`** (downstream propagation surfaced a failure when the downstream code did NOT change in this round): dispatch into the UPSTREAM sub-repo's team listed in `propagated_from`. The downstream test is the canary; the upstream change likely introduced drift. The specialist's brief includes the downstream test that failed and the upstream sub-repo's source-PR fix-commit list for context. CPO can override at the resolution surface when the canary test is incorrect.

     The aggregation gate gates Phase 7 push: until cluster-wide pass, no source branches push to origin and no PR clusters receive round-of-fixes comments.

3. **Verify thread coverage.** For every active comment thread that was in the approved plan, confirm there is a corresponding commit on the appropriate source branch addressing it. In cluster mode, "appropriate source branch" is the source branch of the thread's source PR (a `web-frontend` thread's fix must land on the `web-frontend` PR's source branch, not a sibling sub-repo's). Threads without a commit indicate either a missed fix (dispatch again) or an escalation (which the proposal should already have flagged).

### Phase 7: Push and update the PR(s)

1. **Push the updated source branch(es) to origin.** Execution adapts to mode.
   - **Single-PR modes**: `git push origin <source-branch>` from REPO_ROOT. The PR updates automatically; the source-control host re-runs CI on the new head sha. No separate "update PR" call.
   - **Cluster mode**: loop over affected sub-repos sequentially. For each, `Set-Location` into REPO_ROOT and `git push origin <source-branch>` via that sub-repo's connection profile. Each sub-repo's host re-runs CI for its PR independently. When a sub-repo received no fix commits in this round (e.g., all its threads were CPO-pushback with PR-comment replies and no code changes), skip the push for that sub-repo to avoid an empty CI re-run.

2. **Post the round-of-fixes summary comment(s) (optional but recommended).** Single mode posts one comment on the one PR; cluster mode posts one comment per PR in the cluster.

   For each PR receiving a summary comment, render the per-PR summary body and write it to a temp file via the `Write` tool (per the agent-devs shell-environment rule). The body covers:
   - Per-thread: thread reference, the reviewer's concern in one line, the fix applied in one line, the commit sha that addressed it.
   - Per-failed-check: check name, the fix applied, the commit sha.
   - Threads escalated to the CPO / reviewer for input (with the reason).
   - In cluster mode, an optional "Cross-cluster notes" section when a cross-cluster specialist (security-reviewer, test-strategist, integration-specialist per Phase 2 preamble) touched something relevant to this PR (e.g., "security-reviewer's cross-cluster brief flagged tenant-isolation in both this PR and #`<sibling-id>`; both PRs received corresponding fix commits").

   Render `operation_templates.pull_request_post_comment` per per-sub-repo connection profile with:
   - `{{pr_id}}` -> the target PR id (this PR in single mode; each PR in turn in cluster mode)
   - `{{body}}` -> the rendered summary (read from the temp file)
   - `{{thread_id}}` -> unset (this is a new top-level comment, not a reply)
   - **Always with `resolve_thread=false`** -- never resolve threads from the skill.

   Execute via the connection profile's transport. In cluster mode, posting failures on one PR do not block summary posting on siblings; surface per-PR posting failures separately.

3. **Post blocking-status comments (cluster mode + ordered policy / all-must-merge; v2.4 Feature 6).** When Phase 1 step 8 captured `pr_blocking_state` (ordered policy) or `all_must_merge_state` (all-must-merge policy), post a top-level blocking-status comment on each PR that is currently in a blocked state. Auto-update pattern: subsequent /refine-pr invocations re-check upstream merge state and post a new blocking-status comment when the blocked-by list changes (or when the state clears entirely).

   Per blocked PR, render the comment body with the blocking-status marker as the first line:

   ```
   <!-- strap-pr-cluster-blocking: feature-id=<id> blocked-by=<comma-pr-ids-or-empty> policy=<ordered|all-must-merge> updated=<ISO-timestamp> -->

   **Merge gate.** This PR is blocked pending merge of upstream PR(s):

   - #<id-A> ([<sub-repo-A>]) -- status: <active|abandoned|unknown>
   - #<id-B> ([<sub-repo-B>]) -- status: active

   Policy: <ordered | all-must-merge>. Status auto-updates on each /refine-pr invocation.
   ```

   Edge cases:

   - **All upstream merged (blocked-by empty)**: post a final blocking-status comment with `blocked-by=` empty + body "All upstream merged; this PR is ready to merge from the cluster-ordering perspective." This is the gate clearing. Old blocking comments stay (audit trail); newest-first comment scan finds the empty-blocked-by comment as the latest state.
   - **All-must-merge policy + cluster not simultaneously mergeable**: blocking comment lists every sibling PR that is currently blocking, regardless of merge-order position. Specifically names the non-mergeable siblings (failed checks, unresolved threads, etc.). All-must-merge gates are released only when every sibling clears.
   - **Abandoned upstream**: blocking comment marks status as `abandoned`; body includes a one-line "Cluster is in a broken state -- the upstream PR cannot merge in its current form. The CPO may override the ordering or re-open the upstream."
   - **Pre-F6 cluster (no merge-order field in body markers)**: skip blocking-status comments entirely; the cluster operates with `independent` policy semantics regardless of any sub-repo's declared `branch_protection.policy` because the merge-order data is missing.

   Render `operation_templates.pull_request_post_comment` per per-sub-repo connection profile with the comment body, `resolve_thread=false`. Comment posting failures degrade per-PR (surface to CPO; do not block the run; the comment is a courtesy update, not a correctness gate -- the actual merge gating happens at the host's branch-protection layer).

   Independent clusters (no ordered/all-must-merge policy in any affected sub-repo) skip this step entirely.

4. **Present a resolution summary to the CPO.**
   - Comment threads addressed (table: source PR (cluster mode), thread id, summary, fix applied, commit sha, status).
   - Failed checks addressed (similar table).
   - Remaining issues: items the specialists flagged as needing clarification, items the dev-lead pushed back on (PR comment posted, no commit), failed checks that did not resolve despite the fix attempt.
   - In cluster mode, open with a cluster header ("PR cluster from Feature #`<cluster_feature_id>`; `<N>` PRs; `<S>` specialists dispatched (`<S1>` per-sub-repo + `<S2>` cross-cluster)").
   - **Cross-sub-repo blocking state (cluster mode + ordered / all-must-merge policy; v2.4 Feature 6).** When Phase 1 step 8 captured non-trivial blocking state, summarize per-PR: `<sub-repo-A>` PR ready to merge (no upstream); `<sub-repo-B>` PR blocked on `<sub-repo-A>` (status: active); `<sub-repo-C>` PR blocked on `<sub-repo-A>` + `<sub-repo-B>`. Note the policy (ordered / all-must-merge) and that blocking-status comments were posted on each blocked PR. When all upstream have merged and the cluster is fully mergeable, note "Cluster ordering: all gates cleared." Explicit call-outs for abandoned upstream PRs and CPO-override paths if any.

   Tell the CPO each PR is updated and that they should resolve threads and re-request review in the host tool for each PR. When ordered/all-must-merge policy is in effect, remind the CPO that merge ordering must be honored at the merge button (STRAP surfaces the gate state but the host performs the actual merge). If further feedback arrives, recommend `/refine-pr <pr-id>` again on any PR in the cluster (cluster discovery in Phase 1 step 5 + ordered-merge re-evaluation in step 7+8 re-fire on the next invocation).

### Phase 8: Clean up

1. **Shut down the agent team(s)** (when one or more were created). Single modes: `TeamDelete` removes the one team. Cluster mode: loop over all N per-sub-repo teams (named `refine-pr-<cluster_feature_id>-<sub-repo-slug>`) and `TeamDelete` each. If any shutdown wedges, recommend `/team-cleanup` as the recovery primitive -- one wedge does not block remaining teardown.
2. **Prune any sub-branches** that were merged. Single modes: from REPO_ROOT, `git push origin --delete <sub-branch>` after confirming the merge landed. Cluster mode: loop over affected sub-repos; for each, `Set-Location` into REPO_ROOT and delete the sub-branches that landed in that sub-repo.

The skill leaves the main checkout(s) on the source branch(es). No worktree management is performed (this skill does not create worktrees; `/execute-sprint` owns that).

## Outputs

- One or N PR source branches updated with fix commits, pushed to origin (single mode: one branch; cluster mode: each affected sub-repo's source branch pushed via its per-sub-repo connection profile). PRs update automatically; per-host CI re-runs per PR.
- Optional round-of-fixes summary comments posted via `operation_templates.pull_request_post_comment` with `resolve_thread=false` (one comment in single mode; one per cluster PR in cluster mode).
- Zero, one, or more arbitration replies posted via `pull_request_post_comment` with `resolve_thread=false` -- only when cluster mode detected contradiction pairs AND the CPO arbitrated to drop one or both sides. Each reply names the conflicting PR + sub-repo + thread + the arbitration decision.
- A resolution summary presented to the CPO with status per thread and per check; cluster mode opens with a cluster header listing all N PRs and the per-sub-repo + cross-cluster specialist counts.
- No PR thread resolutions (the human reviewer owns those).
- The agent team(s) deleted: one team in single modes; N per-sub-repo teams in cluster mode (cross-cluster specialists dispatch via serial Task and do not own a team).
- `.claude/strap/state/usage.yaml` updated with `session.completed_at`, the final per-agent `used_in_current` values, and any `exhausted_at` markers from specialists that hit their per-agent budget mid-workflow. (Skipped for pure dev-lead-direct runs that did not initialize a session.)

## Quality gates

The skill is successful when all of the following hold:

- Both connection profiles' required capabilities were satisfied at pre-flight; in cluster mode, every affected sub-repo's per-sub-repo overrides resolved cleanly across whatever heterogeneous-host topology the cluster spans.
- Every active comment thread (from this PR alone in single mode; from this PR + every sibling in cluster mode) was either addressed by a commit on the appropriate source branch, pushed back on by the dev-lead via a PR-comment reply (no commit), or explicitly escalated to the CPO in the proposal.
- Every failed check was either fixed by a commit or escalated to the CPO.
- The centralized build and test commands passed on the updated source branch(es) before push -- per-affected-sub-repo sequentially in cluster mode.
- Comment-to-specialist routing used `project-profile.md`'s `Domains` section; in cluster mode, per-row resolution used the row's `sub_repo`'s `Active domains` field. No domain dispatch was hardcoded.
- The skill did not resolve any comment threads on any PR (every `pull_request_post_comment` call used `resolve_thread=false`).
- Commits carry traceable messages referencing the source PR id (in cluster mode, the thread's source PR id specifically, not the cluster's first PR id) and the addressed thread or check.
- In cluster mode, every sibling PR was discoverable (PR-body marker + cluster-summary comment OR linked-work-item walk fallback) and walked successfully in Phase 1 step 6; any sibling that failed to walk was surfaced with a partial-cluster warning rather than silently dropped.
- In cluster mode, when contradictions were detected, the CPO arbitrated EVERY pair (no auto-resolution); arbitration replies were posted on every dropped side via `pull_request_post_comment` with `resolve_thread=false`; the fix plan presented at the main approval gate reflected the post-arbitration thread set.
- `tokens_used: ~XXk` reporting was captured for every specialist dispatch (per-team and cross-cluster) (or its absence noted as a budget-tracking warning per Failure handling). Pure dev-lead-direct runs are not budgeted by this gate.
- The session aggregate stayed within budget OR the 60% checkpoint was offered to the CPO when crossed.
- Requires the harness team primitive (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` + valid `CLAUDE_CODE_SPAWN_BACKEND`) when parallel fan-out is in scope (single mode: one team; cluster mode: N sequential CreateTeams + serial cross-cluster Task dispatches); pure dev-lead-direct trivial-fix runs do not require it.

## Failure handling

- **`code-connection.yaml` missing**: stop. Redirect to `/connect-code-repo`.
- **`devops-connection.yaml` missing**: continue without linked-work-item context after CPO confirmation.
- **PR feedback capabilities unsupported** (`pull_request_get_comments` / `pull_request_get_check_status` / `pull_request_post_comment`): stop. Surface the gap; the skill cannot operate without read access to feedback. Recommend switching to a remote profile via `/connect-code-repo` or handling the review manually. In cluster mode, capability gaps are evaluated per-affected-sub-repo's connection profile -- if any one sub-repo's profile lacks a required capability, stop before any work begins (the cluster is not safely operable when sibling discovery + comment posting can only run on a subset of the PRs).
- **PR not in `active` status** (already merged, abandoned, completed): stop and surface. In cluster mode, if THIS PR is inactive, stop; if a SIBLING is inactive (the cluster is partially-merged after /execute-sprint), surface to the CPO with the partial-cluster state and confirm whether to refine the remaining-active subset or stop.
- **Cluster mode: sibling-PR discovery is incomplete** (Phase 1 step 5 found signal 1 positive but neither signal 2 nor signal 3 succeeded): surface the discovery gap; offer to degrade to single-PR refinement of this PR only, document the missing sibling list, and recommend the CPO either re-run /execute-sprint to repost cluster-summary comments OR manually note the cluster siblings to refine separately.
- **Cluster mode: a sibling-PR walk fails mid-aggregation** (Phase 1 step 6): preserve the per-sibling failure detail and proceed with the partial aggregation; degrade the failed sibling to single-PR refinement (skip its threads/checks in this round). The remaining cluster work continues.
- **Cluster mode: contradiction-detection-pass false positive surfaced at stage 1 arbitration**: the CPO chooses "Not a contradiction" -- both threads proceed to dispatch normally. The dev-lead notes the false positive in the Phase 7 resolution summary so future revisions of the pattern definitions (Phase 2 "Cross-PR contradiction patterns" subsection) can incorporate the learning. Do NOT modify the pattern definitions inline mid-run.
- **Cluster mode: arbitration-reply post fails for a dropped side**: surface the per-PR failure to the CPO with the reply text preserved so the CPO can post manually. Do NOT block dispatch on this failure -- arbitration outcomes are decided regardless of whether the deferral comment lands. The reply post is a courtesy to the original reviewer, not a correctness gate.
- **A thread or check cannot be matched to an active-domain specialist and the CPO does not provide manual routing**: stop; do not guess.
- **Working tree is dirty after checkout**: stop; ask the CPO to commit or stash first.
- **`operation_templates` rendering produces malformed requests**: surface the failing template path and request body; do not execute.
- **A specialist fails to call `SendMessage` and the dev-lead is left waiting**: treat extended silence as a wedged teammate; recover via `/team-cleanup`.
- **Build or test fails after fixes**: dispatch the responsible specialist (or fix directly for simple cases); do not push until the build and test pass.
- **`pull_request_post_comment` fails after fixes have been pushed**: the fixes are still in place on the source branch; surface the comment-post failure separately so the CPO can decide whether to manually post the summary.
- **The CPO declines the proposed fix plan**: report the declined plan; stop. No push.
- **`CreateTeam` fails for parallel fan-out**: surface the actionable error naming the offending settings layer; offer to fall back to serial dispatch.
- **A specialist returns without the `tokens_used: ~XXk` line**: treat as a budget-tracking warning; the run continues but the dev-lead estimates that specialist's consumption manually and notes the gap under `agents.<name>` in `usage.yaml`.
- **A specialist exhausts its per-agent budget mid-workflow**: do not redispatch within this workflow instance; work with what the specialist produced; escalate unaddressed threads / checks assigned to the exhausted specialist in the Phase 7 resolution summary so the CPO can revise the budget via `/revise-token-budget` and re-run `/refine-pr`, or hand off the remaining items manually.
- **`.claude/strap/state/usage.yaml` missing**: surface the gap; the install scaffold step in `/strap-in` should have created it. Recommend re-running `/strap-in` or `/strap-refresh` to restore the file before proceeding.

## References

- Source PR: `$ARGUMENTS`.
- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- dev-lead guardrails: [`../../strap/rules/agents/dev-lead.md`](../../strap/rules/agents/dev-lead.md).
- agent-devs team rules: [`../../strap/rules/agent-devs.md`](../../strap/rules/agent-devs.md) -- centralized test execution, PR creation rule, `SendMessage` discipline.
- Project profile (active domains + specialists + build/test): [`../../strap/contexts/project-profile.md`](../../strap/contexts/project-profile.md).
- Source-control connection profile: `.claude/strap/state/code-connection.yaml`.
- Work-tracking connection profile (for linked-work-item context): `.claude/strap/state/devops-connection.yaml`.
- Upstream skills: [`../execute-sprint/SKILL.md`](../execute-sprint/SKILL.md), [`../fix-bugs/SKILL.md`](../fix-bugs/SKILL.md), [`../quick/SKILL.md`](../quick/SKILL.md).
- Downstream skills:
  - [`../dora-reconcile/SKILL.md`](../dora-reconcile/SKILL.md) -- once the PR merges, the daily Pass A cascade lands Feature/Enhancement -> Resolved (Stories/Tasks cascade per their existing flows). The PR-merge -> Resolved transition is `/dora-reconcile`'s domain, not this skill's.
  - [`../close-ceremony/SKILL.md`](../close-ceremony/SKILL.md) -- the CPO ritual that takes the merged-PR work from Resolved to Closed.
- Recovery primitive for wedged teammates: [`../team-cleanup/SKILL.md`](../team-cleanup/SKILL.md).
- Source-control connection-profile schema source-of-truth (extended in this same workstream to cover PR feedback operations): [`../connect-code-repo/SKILL.md`](../connect-code-repo/SKILL.md).
- Budget discipline (cross-cutting): [`../../strap/contexts/budget-discipline.md`](../../strap/contexts/budget-discipline.md).
