---
name: /connect-devops-project
description: Wire up work-item tracking. CPO picks Azure DevOps / Jira / GitHub Issues / Local (strap-agile) / Other; the dev-lead probes the host, models the logical-to-host mapping, validates with the CPO, and persists a per-project connection profile. The pipeline reads the profile at runtime to call work-tracking operations via the universal `{{adapter.work_item.*}}` interface.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion
---

# /connect-devops-project

## Purpose

Wire up the work-item tracking surface for THIS project. After `/strap-in` completes, the persistence stack is curated but the pipeline cannot yet file Requirements, Specs, Features, Stories, Tasks, or Bugs because it has nowhere to file them. `/connect-devops-project` closes that gap.

The skill follows the **connection-discovery model** specified in [`onboarding-design.md`](../../strap/contexts/onboarding-design.md#connection-discovery-model). STRAP does not ship a fixed adapter per host. Instead, the dev-lead probes the host live, models its shape against STRAP's logical operations, validates the model with the CPO, and persists a per-project **connection profile** that the pipeline reads at runtime.

Invoke when:

- `/strap-in` has completed and the hand-off pointed at this skill.
- The CPO wants to switch work-tracking hosts (re-invoke with a different host choice; the existing profile is overwritten after confirmation).
- The existing profile is broken (auth expired, capabilities changed on the host side) and needs re-probing.

Do NOT invoke when:

- `/strap-in` has not yet run. The skill checks for the absence of a curated `project-profile.md` and surfaces "run `/strap-in` first" if so.

## Owner

The dev-lead. Runs in the top-level Claude Code session. Uses `Bash` extensively for auth probes and HTTP requests; no specialist dispatch is needed -- the connection-discovery flow is dev-lead-only work.

## Inputs

- `$ARGUMENTS` -- optional. Currently unused. Reserved for explicit-host invocations (e.g., `/connect-devops-project jira`) in a future iteration.
- `.claude/strap/contexts/project-profile.md` -- must exist and be past its scaffold state (sentinel stripped).
- `.claude/strap/state/devops-connection.yaml` -- may or may not exist. If present, surfaced at pre-flight; CPO chooses keep-or-reconnect.
- Environment variables -- whatever auth method the chosen host requires. The dev-lead reads ONLY env-var REFERENCES from the profile; the values themselves live in `.claude/settings.local.json` env block, system env, or CI env. **The skill never writes a credential value to any file.**
- The CPO -- interactively available throughout. Host selection, capability confirmation, and write-probe consent all require CPO input.

## Pre-flight

Two checks:

**1. Project-profile sanity.** Read `.claude/strap/contexts/project-profile.md`. If missing, empty, or carries the scaffold sentinel, surface:

```
This project has not been onboarded yet -- run /strap-in first.
/connect-devops-project requires a curated project profile.
```

Exit without writing.

**2. Existing-profile check.** Read `.claude/strap/state/devops-connection.yaml`. If present:

```
A devops connection profile already exists:
  Host:        <host>
  Host URL:    <host_url>
  Last validated: <validated_at>

Pick one:
  keep       -- exit; use the existing profile
  reconnect  -- re-probe the same host and re-validate the model
  switch     -- pick a different host (existing profile will be overwritten after confirmation)
```

`keep` exits without changes. `reconnect` proceeds to step 3 of the five-step flow (re-probe) using the existing host choice. `switch` proceeds to host selection.

If no profile exists, proceed to host selection.

## Workflow

Five steps for remote hosts (executed against the **primary sub-repo's work-tracking project** on polyrepo umbrellas), an optional umbrella-level `deployment_targets:` capture step (Step 5b), an optional `default_parents` capture step for default parent Epics (Step 5c), a per-sub-repo wire-up loop afterwards on polyrepo umbrellas, plus a local-mode branch. Mechanics follow the connection-discovery flow in [`onboarding-design.md`](../../strap/contexts/onboarding-design.md#the-five-step-flow).

### 0. Polyrepo detection + primary sub-repo selection

Read `project-profile.md` for the `Sub-repos` section + schema sentinel (`<!-- strap-schema: sub-repos-v2.4 -->`).

**Single-repo umbrellas** (no `Sub-repos` section, or empty): proceed directly to Step 1 with the existing single-project flow. Steps 1-5 configure the umbrella's only work-tracking project; Step 6 is skipped; persistence omits the `sub_repos:` map.

**Polyrepo umbrellas** (Sub-repos section populated): enter the polyrepo flow.

1. **Present the sub-repo list** with slug + path + role from `Sub-repos`.
2. **Primary sub-repo selection.** Same heuristic as `/connect-code-repo` Step 0 -- role mentions "primary"/"main" -> most `active_domains` -> first in section. The CPO confirms or overrides via `AskUserQuestion`.
3. **Configure the primary's work-tracking project first via Steps 1-5.** Mapping, capabilities, operation_templates, and auth all derive from the primary's project. These become the umbrella defaults.
4. **After Step 5 persists the primary, proceed to Step 6** to wire each non-primary sub-repo. The dominant v2.4 case is same-host different-project (one ADO org with multiple ADO projects sharing an umbrella); the Step 6 interview is optimized for that case.

The polyrepo flow does not require `/connect-code-repo` to run first -- the two skills are independent. But running `/connect-code-repo` first lets the CPO use the same primary selection in both, keeping the umbrella's mental model coherent.

### 1. CPO names the host

`AskUserQuestion` with four named options + "Other":

```yaml
header: "Work-tracking host"
question: "Which host tracks your work?"
options:
  - label: "Azure DevOps"
    description: "Azure DevOps org + project. Work items via Azure Boards. Iteration planning via sprint capacity. Most heavily tested host."
  - label: "Jira"
    description: "Jira Cloud or Jira Server. Work items as issues. Sprint planning via Agile boards. Field mappings (e.g., original_estimate) typically need confirmation."
  - label: "GitHub Issues"
    description: "GitHub repo's Issues + Projects. Simpler state machine than Azure DevOps or Jira. No native sprint capacity model."
  - label: "Local (strap-agile)"
    description: "Work items as source-controlled markdown under .claude/strap/work/. Lives in your repo's git history -- diffable, PR-reviewable, branch-aware. The 'work-item-tracking-as-code' option: same paradigm as IaC, applied to work tracking. No external service needed; the markdown is the surface."
```

`Other` accepts the host name as free text and routes to a full from-scratch discovery (no accelerator template).

### Local-mode branch (`strap-agile`)

If the CPO picked Local, skip the five-step flow. Local mode (strap-agile) is a fixed shape STRAP ships:

- Work items live as `.md` files under `.claude/strap/work/<type>/<id>-<slug>.md`. Types: `requirement`, `spec`, `feature`, `story`, `task`, `bug`.
- Each work item carries YAML frontmatter (id, type, state, parent, links, assignee, created/updated timestamps).
- State transitions update frontmatter. Lifecycle: `new` -> `active` -> `resolved` -> `closed`.
- The local-files accelerator template at `.claude/strap/templates/connection-templates/local-files.yaml` describes the shape.

**This is the work-item-tracking-as-code paradigm.** Work items live in the same git history as the code:

- **PR-reviewable** -- a Story is a `.md` file. Changes go through PR review same as code. Acceptance criteria can be debated and refined in code review.
- **Diffable** -- `git log .claude/strap/work/` is the work-item changelog. WHEN was a Bug filed? WHO filed it? WHY (commit message)? All in git history.
- **Branch-aware** -- a feature branch can carry provisional work items that only exist there until merged. You can experiment with how to structure a Feature without committing to it on main.
- **Single source of truth** -- code and work-items move together in the same commit. The "ticket says X but code does Y" mismatch becomes impossible.
- **Audit-friendly** -- compliance / DORA-style metrics become git-blame-able. There is no opaque issue-tracker audit log to reconcile against; they are the same.
- **Portable** -- no external service to migrate to or from. Work items travel with the repo.

Suitable for small teams, solo developers, and projects where the agility and PR-review-everything posture of work-as-code outweighs the breadth of a large DevOps platform. Not positioned as a wholesale replacement for Azure DevOps Boards or Jira on large multi-team programs -- those tools earn their cost on cross-team capacity planning, dependency graphs, executive reporting, and integrations with Slack / Teams / Salesforce. strap-agile is for adopters who want all four of "git-native review, branch-aware experimentation, single-commit truth, and no external service."

Write the connection profile to `.claude/strap/state/devops-connection.yaml`:

```yaml
host: local-files
host_url: file://.claude/strap/work/
auth:
  method: none
mapping:
  work_item_types:
    requirement: { host_type: requirement }
    spec:        { host_type: spec }
    feature:     { host_type: feature }
    story:       { host_type: story }
    task:        { host_type: task }
    bug:         { host_type: bug }
    enhancement: { host_type: enhancement }
  field_formats:
    description: markdown
  states:
    new:      new
    active:   active
    resolved: resolved
    closed:   closed
  link_types:
    parent_child: parent
    related:      related
    predecessor:  predecessor
    successor:    successor
capabilities:
  work_item_create:        supported
  work_item_read:          supported
  work_item_update:        supported
  work_item_delete:        supported
  work_item_query:         supported
  work_item_link_add:      supported    # links recorded in the markdown file's YAML frontmatter
  work_item_comment_add:   supported    # appended to a "Comments" section in the markdown file
  iteration_list:          supported
  iteration_get_capacity:  unsupported    # local has no capacity model; sprint-planner uses MEMORY.md preferences
  pull_request_create:     unsupported    # handled by /connect-code-repo in local-git mode
operation_templates:
  work_item_create:
    type: filesystem
    action: write_file
    path_template: ".claude/strap/work/{{type}}/{{id}}-{{slug}}.md"
  # work_item_read, work_item_update, work_item_query, work_item_link_add, work_item_comment_add, iteration_list -- filesystem-action equivalents follow the same shape.
```

Ensure `.claude/strap/work/` and per-type subdirectories exist (`mkdir -p`). Skip to [Step 5: Hand-off](#5-hand-off).

### 2. Dev-lead authenticates

Per the host:

- **Azure DevOps**: PAT via `az login` (or device-code flow) OR the user already has `az` configured. Probe: `az account show`. Capture the org and project; PAT/CLI auth means no token leaves the local environment.
- **Jira**: API token (Atlassian Cloud) or PAT (Server). Walk the CPO through generating the token if needed; the **token VALUE never enters any prompt** -- the CPO sets `JIRA_USER` and `JIRA_TOKEN` env vars in `.claude/settings.local.json` env block (or shell env). The skill validates the env vars are set but does not read or echo their values.
- **GitHub Issues**: GitHub PAT or `gh auth status`. Same env-var discipline: `GITHUB_TOKEN` in local settings.
- **Other**: dev-lead asks the CPO how the host authenticates and what env-var names to reference. The skill writes ONLY the env-var name to the profile.

Auth probe runs (e.g., `curl -H "Authorization: ..." <auth-test-url>` for REST hosts, `az account show` for Azure). On failure: surface a structured error naming the underlying response. CPO fixes the env or the cred and the skill re-probes.

### 3. Dev-lead explores

Read-only probes by default. Structured set:

- List projects / repos / boards the auth principal can see. Confirm the CPO picks the right one (`AskUserQuestion` with the discovered list).
- List work-item types in the chosen project.
- For each STRAP logical type (`requirement`, `spec`, `feature`, `story`, `task`, `bug`): identify which host type best maps. Ask the CPO if the inferred mapping is uncertain.
- List state transitions (the workflow states / status field).
- List fields. Identify the field id for capacity-related concerns (`original_estimate`, `completed_work` if the project tracks them).
- List iterations / sprints (if the host has the concept).

**Write probes require explicit CPO consent.** Surface:

```
The host appears to support work-item create+delete. A write probe would create a synthetic
work item (title "STRAP probe -- safe to delete"), verify it landed, and delete it. This is the
most reliable validation that the connection works end-to-end.

Proceed with write probe? (yes / skip)
```

`yes` runs the probe. `skip` proceeds without; capability validation is then "best-effort based on read probes only" and noted in the profile.

### 4. Dev-lead models

Build the connection profile from probe findings.

#### Surface the probed mapping and gate the customization decision

From Step 3's read probes, the dev-lead has inferred a default host work-item type for each of the seven STRAP logical types (`requirement`, `spec`, `feature`, `story`, `task`, `bug`, `enhancement`). The defaults follow STRAP's canonical recommendations adjusted for what the host's process template actually exposes (see [Top-4 candidate ranking discipline](#top-4-candidate-ranking-discipline) below for the algorithm).

Surface the probed default to the CPO as a structured text block BEFORE any `AskUserQuestion` (this is the "discovery first, decision second" pattern -- the CPO sees the full proposed mapping in plain text, then answers a single gate question):

```
Probed default mapping for <host> (process template: <template-name>):

  STRAP type     -> host type
  requirement    -> <inferred-host-type>
  spec           -> <inferred-host-type>
  feature        -> <inferred-host-type>
  story          -> <inferred-host-type>
  task           -> <inferred-host-type>
  bug            -> <inferred-host-type>
  enhancement    -> <inferred-host-type>

Notes:
  - <inferred-host-type> ranked #1 for STRAP <type> because <signal: canonical default available / common alternative used / fallback>
  - <any collisions: e.g., "requirement and story both map to User Story -- this is intentional when teams treat requirements as user-story narratives">
```

Then gate the customization decision via a three-option `AskUserQuestion`:

```yaml
header: "Mapping decision"
question: "Use the probed default mapping, or customize per STRAP type?"
options:
  - label: "Accept probed mapping (Recommended)"
    description: "Proceed with the auto-probed defaults shown above. Suitable when the defaults line up with how your team uses the host."
  - label: "Customize mapping"
    description: "Walk through each STRAP type and pick the host type from up to 4 ranked candidates (or type a host type that's not in the top 4). Suitable when one or more defaults don't match your team's conventions."
  - label: "Reject and exit"
    description: "Abort /connect-devops-project without persisting anything. Suitable when the host or process template needs adjustment before STRAP can wire up cleanly."
```

Per the dev-lead's preview-discipline rule (all-or-nothing previews per AskUserQuestion question), none of the three options carries a `preview` field -- the discovery text block above is the structured preview surface; the gate question is a clean three-way decision.

**On Accept**: use the probed defaults; proceed to the rest of Step 4 (profile shape) below.

**On Customize**: enter the [Custom Map flow](#custom-map-flow) below; on its completion (Accept), return here with the customized mapping in hand.

**On Reject**: exit `/connect-devops-project` cleanly without writing the profile. The CPO can re-invoke after addressing whatever made the probed mapping unworkable (different process template, different host, etc.).

#### Custom Map flow

Entered only when the CPO picked `Customize mapping` at the gate above. Walks the CPO through each of the seven STRAP logical types with the discovered top-4 host candidates per type.

**Step 1: Discovery text block.** Before any `AskUserQuestion` runs, emit a plain-text block listing every host work-item type the probe found. This is the full-menu surface for the CPO's `Type Something` (free-text) escape on each per-type question:

```
Host work-item types available on this process template:
  - <type-1>
  - <type-2>
  - <type-3>
  ...

Now mapping each STRAP logical type. The top 4 most-likely host candidates appear as
options per STRAP type; pick "Type Something" and enter a host type from the list above
for anything outside the top 4.
```

The AskUserQuestion options that follow surface only the top-4 candidates per type. The text block covers the long tail.

**Step 2: Mapping Call 1 (4 questions in one AskUserQuestion).** Covers STRAP `requirement`, `spec`, `feature`, `story`. Each question header is `Map STRAP <type> to which host work-item type?` with up to 4 author-specified options (with the probed default carrying the `(Recommended)` suffix at the top) + the auto-added `Type Something` option that accepts free-text input. Per-option descriptions explain when each mapping is appropriate (e.g., "User Story" -- "Default-fit for STRAP Story; the most common host work-item type for narrative scope.").

The four-question batch renders cleanly with vertical option lists per question. The candidate options per STRAP type come from the [Top-4 candidate ranking discipline](#top-4-candidate-ranking-discipline) below.

**Step 3: Mapping Call 2 (3 questions in one AskUserQuestion).** Covers STRAP `task`, `bug`, `enhancement`. Same shape as Call 1: up to 4 author-specified options per question, probed default carries `(Recommended)`, `Type Something` for free-text.

**Step 4: Validation and confirmation text block.** After both calls land, render the full proposed mapping as a structured text block including validation observations:

```
Custom mapping proposal for <host>:

  STRAP type     -> host type
  requirement    -> <picked-host-type>
  spec           -> <picked-host-type>
  feature        -> <picked-host-type>
  story          -> <picked-host-type>
  task           -> <picked-host-type>
  bug            -> <picked-host-type>
  enhancement    -> <picked-host-type>

Observations:
  - Collisions (warning, not block):
      <STRAP-types-A and STRAP-types-B> both map to <host-type>
      [intentional when ...; surface for CPO awareness]
  - Hierarchy notes:
      <STRAP type> -> <host type> is lighter/heavier than typical
      [explain when this is fine vs when it suggests reconsideration]
  - Unmapped check: <every STRAP type has a mapping | one or more STRAP types are null>
```

Validation rules:
- **Collision warning** (NOT blocking): when two STRAP types map to the same host work-item type, surface as a warning. Adopters sometimes intentionally collapse the hierarchy (e.g., STRAP Requirement and STRAP Story both to ADO User Story when the team treats requirements as user stories).
- **Hierarchy note** (NOT blocking): when a STRAP type maps to a host type conventionally lighter or heavier than typical (e.g., STRAP Spec -> User Story is lighter than the typical Spec -> Feature). Surface for awareness; CPO confirms intent.
- **Unmapped check** (blocking): every STRAP type must have a mapping after the two calls. Free-text-input via `Type Something` must not be empty; if empty, re-prompt the affected question.

**Step 5: Final confirmation gate.** Surface a four-option `AskUserQuestion`:

```yaml
header: "Apply custom mapping"
question: "How does the mapping look?"
options:
  - label: "Accept this mapping"
    description: "Persist to devops-connection.yaml's mapping.work_item_types block. Subsequent connect-skill phases pick up the customized mapping."
  - label: "Modify a specific row"
    description: "Re-prompt for one STRAP type's mapping via a single-question AskUserQuestion. Useful when most of the mapping is right but one row needs revision."
  - label: "Restart Custom Map"
    description: "Return to Custom Map Step 1 (discovery text block). Useful when you realized partway through that the wrong approach was selected."
  - label: "Cancel"
    description: "Abort the Custom Map flow without persisting; return to the top-level mapping-decision gate above."
```

- **Accept this mapping** -> return from the Custom Map flow with the mapping in hand; proceed to the rest of Step 4 (profile shape) below.
- **Modify a specific row** -> ask which STRAP type via a sub-`AskUserQuestion` whose options are the seven STRAP types; on selection, re-prompt that single type's mapping via a one-question `AskUserQuestion` (same options as the original call, probed default carrying `(Recommended)`); re-render the validation block at Step 4; re-surface this gate.
- **Restart Custom Map** -> return to Custom Map Step 1.
- **Cancel** -> return to the top-level mapping-decision gate; the CPO can pick `Accept probed mapping` or `Reject and exit` instead.

#### Top-4 candidate ranking discipline

For each STRAP logical type, the dev-lead computes up to 4 candidate host work-item types using the following algorithm:

1. **STRAP canonical default** -- the "first choice" host type per STRAP's recommendations. Always rank #1 if the host has a matching type; carries the `(Recommended)` suffix in the AskUserQuestion option label.
2. **Common alternatives** known to the connect skill for each STRAP type. Examples baked in (host-type names use Azure Boards Agile defaults; substitute equivalents for Jira / GitHub Issues / others):
   - STRAP `requirement`: User Story (default), Feature, Epic, Issue
   - STRAP `spec`: Feature (default), Epic, User Story, Issue
   - STRAP `feature`: Epic (default), Feature, User Story, Issue
   - STRAP `story`: User Story (default), Feature, Task, Issue
   - STRAP `task`: Task (default), User Story, Bug, Issue
   - STRAP `bug`: Bug (default), Issue, Task, User Story
   - STRAP `enhancement`: Feature (default), User Story, Task, Issue
3. **Filter to host-available**: drop any candidate the probed process template does not expose.
4. **Pad if needed**: if fewer than 4 candidates remain after filtering, pad from remaining host types not yet listed for this STRAP type (e.g., if a host has only User Story, Task, Bug, and the candidate list for STRAP `requirement` was filtered to just User Story, pad with Task and Bug to fill out to 3 options).
5. **Take top 4**: anything beyond the top 4 lives in the Step 1 discovery text block; the CPO reaches it via `Type Something` on the relevant per-type question.

The algorithm runs once per STRAP type at Custom Map entry; the results are cached for the duration of the flow so a `Modify a specific row` step reuses the same candidate set.

#### Probe state_asymmetries per work-item type (v2.5 #39697)

Before building the rest of the profile shape, walk each work-item type from `mapping.work_item_types` and confirm its actual state machine on the host. STRAP **probes the host directly** for the state list per work-item type and derives a proposed STRAP-logical collapse from the probed states; the CPO confirms the collapse via a single per-type AskUserQuestion (Accept / Customize / Skip). The probe replaces the pre-v2.5 assume-default flow that required custom-template adopters to answer up to 28 prompts (7 logical types x 4-question Customize follow-up). Probe-driven flow runs ~7 prompts in the common path (one Accept per type); even Customize halves to a single multi-question follow-up because the probe already knows the state list.

**This step runs unconditionally on every host.** Stock-template hosts return the canonical state lists, the heuristic-derived collapse matches the assumed default, and the CPO clicks Accept per type. Custom-template hosts (ASA_Raptor_DevOps, Scrum customizations, Jira workflows configured per-project) return the actual state list, the heuristic does its best, and the CPO confirms or refines via Customize. GitHub Issues' fixed open/closed model is hard-coded (no network probe required) -- the probe surface still runs to keep the per-host code path uniform.

##### Probe the host's state machine per work-item type

For each work-item type in `mapping.work_item_types`, probe the host for the actual state list. Per-host endpoints:

- **Azure DevOps**: `GET https://dev.azure.com/{{org}}/{{project}}/_apis/wit/workitemtypes/{{host_type}}/states?api-version=7.1`. Returns an array of state objects with `name` + `category` (Proposed / InProgress / Resolved / Completed / Removed). The category metadata is gold for the heuristic below -- it maps directly to STRAP-logical states.
- **Jira**: `GET /rest/api/3/workflowscheme/project?projectKeyOrId={{project_key}}` to identify the workflow for each issue type, then `GET /rest/api/3/workflow/search?workflowName={{workflow_name}}&expand=statuses` for the state list. Jira returns status objects with `name` + `statusCategory.key` (`new`, `indeterminate`, `done`) -- analogous to ADO's category metadata for heuristic mapping.
- **GitHub Issues**: no network probe required. Every issue type collapses to `open` / `closed`. Hard-code the two-state list; the heuristic always collapses `STRAP.new` + `STRAP.active` to `open` and `STRAP.resolved` + `STRAP.closed` to `closed` with a `strap:<logical-state>` tag for granularity.
- **strap-agile (Local)**: read the YAML schema from `.claude/strap/work/schema.yaml` directly; the per-type `states:` block is the source of truth. No network access.
- **Other (unknown host)**: skip the probe; fall back to the CPO-driven Customize flow below with no probed states (free-text entry per STRAP-logical state).

**Derive a proposed collapse from the probed states.** The dev-lead applies a deterministic heuristic per STRAP-logical state:

1. **Category-metadata match (when available)**: ADO `category` and Jira `statusCategory.key` provide an authoritative signal:
   - `Proposed` / `new` -> STRAP.new
   - `InProgress` / `indeterminate` -> STRAP.active
   - `Resolved` -> STRAP.resolved (when present; ADO Issue / ADO Task / GitHub / Jira-without-Resolved fall through to category-Completed)
   - `Completed` / `Removed` / `done` -> STRAP.closed (Removed maps to closed with a `strap:removed` note in the entry's `notes:` block)
2. **Name-similarity match (when no category metadata, or as tie-breaker)**: normalized case-insensitive contains-match against canonical aliases:
   - STRAP.new: `new`, `to do`, `open`, `backlog`, `created`, `proposed`
   - STRAP.active: `active`, `in progress`, `doing`, `in review`, `started`, `wip`
   - STRAP.resolved: `resolved`, `code review`, `qa`, `awaiting close`, `done (resolved)`
   - STRAP.closed: `closed`, `done`, `completed`, `removed`, `cancelled`
3. **Resolved-fallback**: when no probed state maps to STRAP.resolved (canonical case: ADO Task, ADO Issue, GitHub, many Jira workflows), the dev-lead proposes the closed-equivalent + records the `strap:resolved` tag fallback in the collapse `notes:`. The CPO can override via Customize.

Render the probed states + proposed collapse + heuristic provenance to the CPO before the AskUserQuestion fires (discovery first, decision second). When the probe fails (network error, permissions, host returns no states): surface the error inline and offer two options via AskUserQuestion: `Retry probe (Recommended)` / `Fall back to Customize without probed states` (free-text state list per the legacy Customize flow). Persistent probe failures degrade gracefully to the legacy flow.

##### Per-type confirmation flow

For each work-item type in `mapping.work_item_types` (the 7 STRAP logical types, scoped to the host_type each resolves to), surface the probed state machine + proposed collapse and ask the CPO to confirm:

```
STRAP logical type:  <type>  (host type: <host_type>)

Probed state machine on this host:
  States:  <probed-states-list>     (source: <host>/states endpoint)
  Categories: <category-per-state>  (ADO + Jira only)

Proposed STRAP-logical collapse (heuristic-derived):
  STRAP.new      -> host '<probed-state>'   (signal: <category-match | name-similarity>)
  STRAP.active   -> host '<probed-state>'   (signal: <signal>)
  STRAP.resolved -> host '<probed-state>'   (signal: <signal | resolved-fallback: no Resolved equivalent>)
  STRAP.closed   -> host '<probed-state>'   (signal: <signal>)
```

Then `AskUserQuestion`:

```yaml
header: "<type> state machine"
question: "Confirm the probed state machine for <type> (host: <host_type>) and the proposed collapse?"
options:
  - label: "Accept probed + proposed collapse (Recommended)"
    description: "Use the probed states list + heuristic-derived collapse as state_asymmetries. Suitable when the proposed collapse matches your team's intent. Stock-template hosts almost always Accept."
  - label: "Customize collapse"
    description: "Override the heuristic's collapse with manual per-STRAP-logical-state assignments. Single multi-question follow-up with the probed states as options (no free-text state list required -- the probe provided that). Pick when the heuristic misjudged (e.g., your team uses 'In Review' for STRAP.resolved instead of STRAP.active)."
  - label: "Skip this type"
    description: "Persist no state_asymmetries entry for this type. STRAP falls back to the standard STRAP-logical state names; if the host doesn't honor those, work-item updates will fail with host validation errors at execution time. Pick only when you know the host's state machine matches STRAP-logical names exactly."
```

**On Accept probed + proposed collapse**: persist a `state_asymmetries.<host_type>` block with the probed states + heuristic collapse. Skip to the next work-item type.

**On Customize collapse**: walk a single multi-question AskUserQuestion (4 questions in one call -- one per STRAP-logical state):

```yaml
AskUserQuestion:
  header: "Customize <host_type> collapse"
  questions:
    - question: "Which probed host state maps to STRAP.new?"
      options:
        # one option per probed state, plus the resolved-fallback option
        - label: "<probed-state-1>"
        - label: "<probed-state-2>"
        ...
        - label: "(no host equivalent; collapse to STRAP.active)"
    - question: "Which probed host state maps to STRAP.active?"
      options: <as above>
    - question: "Which probed host state maps to STRAP.resolved?"
      options:
        - label: "<probed-state-1>"
        ...
        - label: "(no host equivalent; collapse to STRAP.closed + strap:resolved tag)"
    - question: "Which probed host state maps to STRAP.closed?"
      options: <as above>
```

Then a single confirmation `AskUserQuestion` rendering the constructed `state_asymmetries.<host_type>` block back to the CPO with options `Accept` / `Restart this type` / `Skip this type`.

**Why this is shorter than pre-v2.5**: the probe eliminates the pre-v2.5 first Customize question ("Which states does the host's <host_type> support?" -- the host now answers that directly) AND the pre-v2.5 "Optional notes" question (the heuristic-provenance recorded in the persisted entry covers the WHY). Net: 1 AskUserQuestion call per Customize + 1 confirm = 2 prompts, down from 4. When the heuristic gets the collapse right (the common case), Accept is 1 prompt + no follow-up.

**On Skip this type**: persist no entry. Documented inline as a known degradation: work-item updates that target STRAP-logical states without an asymmetry-resolved mapping rely on the host accepting STRAP-logical state names verbatim; if the host validates against its own state machine, updates will fail.

##### Expected probe output per stock host

Stock-template hosts return predictable state lists; the heuristic-derived collapse should match the canonical assumption and the CPO will Accept without further action. This subsection documents the expected probe output as a sanity check -- if a stock host returns something unexpected, the host likely has a customization the adopter wasn't aware of.

- **ADO Agile**:
  - User Story / Feature / Epic: `New, Active, Resolved, Closed` (categories: Proposed, InProgress, Resolved, Completed)
  - Task: `To Do, In Progress, Done` (categories: Proposed, InProgress, Completed -- no Resolved; falls back to Done + `strap:resolved` tag)
  - Bug: `New, Active, Resolved, Closed`
  - Issue: `Active, Closed` (two-state; new+active collapse to Active, resolved+closed collapse to Closed)
- **ADO Scrum**: similar to Agile but Task uses `To Do, In Progress, Done` and User Story uses `New, Approved, Committed, Done`.
- **ADO CMMI**: User Story-equivalent (Requirement) uses `Proposed, Active, Resolved, Closed`.
- **ADO custom templates** (ASA_Raptor_DevOps and similar): probe returns whatever the template author defined. Common deviation: Task uses `{New, Active, Closed, Removed}` instead of stock Agile's `{To Do, In Progress, Done}`. The heuristic handles category-driven matching; CPO Customize handles edge cases.
- **Jira Standard**: workflow varies per project. Most projects ship with category metadata (`new`, `indeterminate`, `done`); the heuristic uses those. Projects with a Resolved-category status (some Jira workflows split done into Resolved + Closed) hit STRAP.resolved cleanly; projects without fall back to closed + `strap:resolved` tag.
- **GitHub Issues**: `open, closed` (fixed). Heuristic always collapses STRAP.new + STRAP.active -> open, STRAP.resolved + STRAP.closed -> closed.
- **strap-agile (Local)**: per the YAML schema's `states:` block. Adopter-defined; the schema is the source of truth.

For custom-template adopters (ASA_Raptor_DevOps and similar), the probe + heuristic together get the common cases right; Customize covers the rest.

##### Re-run safety

When `/connect-devops-project` is re-invoked on an umbrella that already has `state_asymmetries` populated in `devops-connection.yaml`, re-run the probe per work-item type and compare against the persisted entry. Three outcomes per type:

- **Probe matches the persisted entry exactly** (state list + collapse + categories): silent no-op; entry stays as-is. Refresh `validated_at` only.
- **Probe differs from the persisted entry**: surface the diff (added states, removed states, changed collapse) and offer per-type `Keep persisted` / `Update to probed` / `Customize` options via AskUserQuestion. This catches host-side state-machine drift (e.g., a custom template added a `Code Review` state between Active and Resolved).
- **Probe failed**: keep the persisted entry; flag the probe failure in the re-run report for CPO awareness.

Existing entries are preserved unless the CPO actively chooses Update or Customize -- prevents accidental loss of custom asymmetries during routine re-runs.

#### Build the rest of the profile

After the mapping AND state_asymmetries are in hand (whether from `Accept assumed` or the Customize flow per type), model the rest of the profile per the shape in [`onboarding-design.md`](../../strap/contexts/onboarding-design.md#connection-profile-shape):

##### Field-existence probe (v2.4-polish)

Before persisting the profile, validate that every field declared in `mapping.fields` actually exists on the host's process template. Adopters on custom process templates (e.g., ASA_Raptor_DevOps, custom Jira workflows, modified GitHub Issues schemas) frequently have field renames or omissions vs. stock templates; declaring a stock field name that doesn't exist on the host leads to silent downstream degradation (e.g., `/dora-collect` strips the unsupported field from queries, `/file-bugs` omits the field from writes, with no warning to the operator).

Per host:

- **Azure DevOps**: query `https://dev.azure.com/{{org}}/{{project}}/_apis/wit/workitemtypes/{{host_type}}/fields?api-version=7.1` for each work-item type; intersect the returned field set with the declared `mapping.fields` values.
- **Jira**: query `/rest/api/3/field` (project-scoped); intersect against declared values.
- **GitHub Issues**: probe is a no-op for the core fields (fixed schema); validate label-based fields (`severity:*`, `priority:*`, `env:*`) against `/repos/{owner}/{repo}/labels`.
- **strap-agile (Local)**: validate against the YAML schema declarations directly; no network probe needed.

For each declared field, classify:

- **Present**: declared name matches a host field. No action.
- **Missing**: declared name does NOT match any host field. Surface to CPO via `AskUserQuestion` per missing field:
  - `Customize -- rename to actual host field` (sub-question presenting the host's available field list)
  - `Skip -- omit from profile` (skills that consume this field will degrade per their declared graceful-degradation behavior; document the gap inline)
  - `Confirm -- proceed without this field` (records the declared field with an inline `# WARNING: declared but not present on host process template` comment; skills will silently strip at runtime, but the comment preserves audit trail)
- **Ambiguous** (host has multiple fields whose name approximates the declared field): surface the candidates via `AskUserQuestion` for CPO selection.

The probe runs ONCE at profile build. Re-runs of `/connect-devops-project` re-probe touched entries; untouched entries trust the prior probe result (the `validated_at` + `validated_by` markers preserve idempotency).

**Why this matters**: silent field absence is one of the failure modes adopters most often miss during onboarding. The Pace v2.4.0 Phase E validation surfaced `Custom.PullRequestUrl` + `Custom.Environment` declared in `devops-connection.yaml` but absent from the actual ASA_Raptor_DevOps process template; `/dora-collect` stripped both mid-flight with no operator-visible signal. An attentive operator noticed; an unattentive one would have a corrupted DORA snapshot without realizing.

##### Cross-version field-rename detection (v2.5-polish #39702)

The original field-existence probe catches mismatches at profile build time. It does NOT catch the silent-drift case where the host's process template gets upgraded BETWEEN profile creation and a subsequent run -- the host renames `Custom.PullRequestUrl` to `Custom.PRUrl`, the persisted profile still references the old name, and downstream skills (`/dora-collect`, `/file-bugs`, `/execute-sprint`) silently strip the field with no operator-visible signal. This is the same failure mode the probe was built to prevent, just shifted forward in time.

On `/connect-devops-project` re-run (and as part of `/strap-refresh`'s connection-profile drift detection pass when that skill invokes this check), execute a per-declared-field re-probe step BEFORE the standard field-existence probe runs:

1. **Re-probe the host for the current field set** per the host-specific query in the Field-existence probe section above (same endpoints, same intersection logic). Capture each current field's `name` AND `type` (string / integer / boolean / date / picklist / etc.) AND `displayName` when the host distinguishes the two.

2. **For each persisted `mapping.fields.<role>: <host-field-id>` entry**, check whether the persisted host-field-id still exists on the host. Three outcomes:

   - **Still present**: no action; entry is healthy.
   - **Missing AND rename candidates exist**: trigger the rename-confirmation flow below.
   - **Missing AND no rename candidates exist**: surface as orphaned -- the field appears genuinely removed, not renamed. Three CPO options via `AskUserQuestion`: `Mark as orphaned (record in profile with inline # ORPHANED comment + remove from active mapping)` / `Keep as-is (preserve for manual investigation; skills continue to silently strip)` / `Pause -- investigate now (open the host's field-management UI and decide before continuing the re-run)`.

3. **Rename-candidate detection** for a missing persisted field. A current host field is a candidate when ALL conditions hold:

   - **Type match**: the current field's `type` matches the persisted field's `type` (when the persisted profile recorded type at probe-build time -- v2.4-polish #39572 onwards). When no type was recorded (pre-#39572 profile), skip the type check and proceed on name similarity alone with an inline note that type validation is degraded.
   - **Name similarity**: the current field's `name` (or `displayName`) scores above a similarity threshold against the persisted field name. Use a normalised Levenshtein distance: `1 - (edit_distance / max(len(a), len(b)))`. Threshold: `0.50` (covers the canonical `Custom.PullRequestUrl` -> `Custom.PRUrl` case at ~0.62, and `Custom.Environment` -> `Custom.DeployEnvironment` at ~0.55, while rejecting unrelated fields).
   - **Not already mapped**: the current field isn't already the target of another persisted `mapping.fields.*` entry. Same field can't be the rename target for two different STRAP roles.

   Rank candidates by similarity score descending. Cap at the top three.

4. **Rename-confirmation flow** via `AskUserQuestion` per missing-field-with-candidates:

   ```yaml
   header: "Field renamed?"
   question: "Persisted field <role>: <persisted-host-field-id> no longer exists on the host. The probe found <N> candidate fields with similar names + matching type. Which one is the rename target?"
   options:
     # one per top-N candidate, with similarity score + type shown
     - label: "<candidate-1-host-field-id> (similarity <pct>%, type <type>) -- Recommended"
       description: "Update mapping.fields.<role> to <candidate-1-host-field-id>. Skills consuming this field will use the new name on next invocation."
     - label: "<candidate-2-host-field-id> (similarity <pct>%, type <type>)"
       description: "Update mapping.fields.<role> to <candidate-2-host-field-id>."
     - label: "None of these -- mark as orphaned"
       description: "Treat as a removal, not a rename. Record inline # ORPHANED comment and remove from active mapping. Downstream skills degrade per their declared graceful-degradation behavior."
     - label: "Keep as-is -- defer decision to next re-run"
       description: "Leave the persisted value untouched. Skills continue to silently strip the missing field. Use when you want to investigate against the host's field-management UI before committing."
   ```

   First option (highest-similarity candidate) is marked Recommended only when the top score exceeds `0.70` (high confidence). Below that threshold no Recommended marker is set; the CPO chooses without pre-bias.

5. **Persist rename decisions** by updating `mapping.fields.<role>` to the new host-field-id. Stamp `mapping.field_renames` (new optional sub-block) with an audit entry per rename:

   ```yaml
   mapping:
     field_renames:
       - role: priority
         from: Custom.OldPriority
         to:   Custom.Priority
         similarity: 0.78
         confirmed_at: 2026-05-31T18:00:00Z
         confirmed_by: <user>
   ```

   The `field_renames` ledger is append-only across re-runs (each new rename event lands as a new list entry). It surfaces in `/strap-refresh` drift reports and provides an audit trail for "why did this skill suddenly start writing a different field name?" investigations.

6. **Order of operations within Step 4**: re-probe → rename-detection → standard field-existence probe (now operating on the post-rename mapping). Renamed fields that resolve cleanly stay out of the standard probe's Missing/Ambiguous flows; orphaned-and-acknowledged fields skip the probe (their inline comment marks them as known-degraded).

The rename-detection pass is idempotent: when no host renames have occurred since the last validated_at, every persisted field still resolves cleanly and no CPO prompts fire.

**Why this matters**: complements polish #39572's build-time probe by closing the silent-drift gap. Pace's `Custom.PullRequestUrl` + `Custom.Environment` mismatch was caught at build time; the post-build host upgrade case (where the rename happens after the profile is written) was the v2.4 deferral. With this polish landed, `/connect-devops-project` re-run + `/strap-refresh` both catch the drift.



```yaml
host: <host-name>
host_url: <base-url>
auth:
  method: <pat | api_token | oauth | cli>
  user_env: <env-var-name>      # only when relevant
  token_env: <env-var-name>     # references only; never the value
mapping:
  work_item_types:
    requirement: { host_type: <host-type> }
    spec:        { host_type: <host-type> }
    feature:     { host_type: <host-type> }
    story:       { host_type: <host-type> }
    task:        { host_type: <host-type> }
    bug:         { host_type: <host-type> }
    enhancement: { host_type: <host-type> }
  fields:
    title:            <host-field-id>
    description:      <host-field-id>
    state:            <host-field-id>
    type:             <host-field-id>
    iteration:        <host-field-id>
    area:             <host-field-id>
    assigned_to:      <host-field-id>
    tags:             <host-field-id>
    parent:           <host-field-id>
    work_item_id:     <host-field-id>
    # v2.2 extension fields (declare what the host supports; skills degrade gracefully when absent):
    severity:         <host-field-id>   # Bugs only -- /file-bugs + /fix-bugs + /quick + /dora-collect + /dora-reconcile read this
    priority:         <host-field-id>   # Enhancements / Features priority bucket -- /plan-sprint + /rebalance-sprint read this
    environment:      <host-field-id>   # Bugs only -- env:* tag derived from this; /file-bugs + /dora-collect + /dora-reconcile read this
    original_estimate: <host-field-id>  # Tasks (and STRAP-v2.2 atomic Bugs) -- /quick + /execute-sprint + /plan-sprint + /dora-collect + /dora-reconcile read this
    completed_work:   <host-field-id>   # /execute-sprint + /fix-bugs + /quick + /dora-collect + /dora-reconcile (wall-clock hours at resolution) read this
    remaining_work:   <host-field-id>   # /rebalance-sprint reads this for mid-sprint capacity projection
    activated_date:   <host-field-id>   # state-transition timestamp; /dora-collect + /dora-reconcile + /close-ceremony read this (wall-clock CW basis + stale-item detection)
    resolved_date:    <host-field-id>   # state-transition timestamp; same consumers
    closed_date:      <host-field-id>   # state-transition timestamp; same consumers
    start_date:       <host-field-id>   # /dora-reconcile Pass G stamps this from activated_date when missing
    finish_date:      <host-field-id>   # /dora-reconcile Pass G stamps this from resolved_date or closed_date when missing
    resolved_reason:  <host-field-id>   # Bugs only -- /fix-bugs + /quick (Shape 3a Bug close) set this; /close-ceremony + /dora-reconcile read it
    pr_url:           <host-field-id>   # OPTIONAL -- /fix-bugs + /quick + /execute-sprint write PR reference here when set; /close-ceremony + /dora-reconcile read it
  field_formats:
    description: html | markdown          # what format the host expects for the description field
  states:
    new:      <host-state-label>
    active:   <host-state-label>
    resolved: <host-state-label>
    closed:   <host-state-label>
  state_asymmetries:                      # OPTIONAL. When the host's state machine collapses per-type (e.g., ADO Issue has no Resolved; ADO Task has no Resolved), document the collapse and the workaround. The strap:<logical-state> tag is the standard fallback for representing the logical state when the host can't.
    <host-type>:
      allowed: [<states-the-host-supports>]
      collapse:
        new:      <host-state>
        active:   <host-state>
        resolved: <host-state>
        closed:   <host-state>
      notes: |
        <how the asymmetry is handled>
  link_types:
    parent_child: <host-link-name>        # used for spec->feature, feature->story, story->task
    related:      <host-link-name>        # used for cross-tree references (e.g., requirement->spec when parent slot unavailable)
    predecessor:  <host-link-name>        # used for cross-Story dependencies
    successor:    <host-link-name>        # mirror of predecessor
  area_path_root:     <root-area-path>    # OPTIONAL. Default area for new items.
  iteration_path_root: <root-iteration-path>  # OPTIONAL. Default iteration.
  default_parents:                        # OPTIONAL. When the host's hierarchy requires a parent slot for top-level item types (e.g., ADO Features under an Epic; Jira Stories under an Epic), declare the parent ids here. Hosts without enforced hierarchy (GitHub Issues, local-files) may omit.
    requirement: <host-parent-id>         # parent for new Requirements (typically a "Requirements" Epic on ADO)
    spec:        <host-parent-id>         # parent for new Specs
    feature:     <host-parent-id>         # parent for new Features
    bug:         <host-parent-id>         # parent for new Bugs (optional; may live under feature or own epic)
capabilities:
  work_item_create:        supported | unsupported
  work_item_read:          supported | unsupported     # read one item by id
  work_item_read_batch:    supported | unsupported     # OPTIONAL -- /dora-collect uses this for windowed snapshots (200+ items per call); skill falls back to per-id reads when absent
  work_item_update:        supported | unsupported
  work_item_delete:        supported | unsupported
  work_item_query:         supported | unsupported     # query/search by criteria
  work_item_link_add:      supported | unsupported     # add a link/relation between two items
  work_item_comment_add:   supported | unsupported     # post a comment (used for state-change audit)
  work_item_revisions:     supported | unsupported     # OPTIONAL -- /dora-collect reads state-transition history for rework rate + Pipeline Funnel hop timing; skill falls back to state-change-date-only timing when absent
  iteration_list:          supported | unsupported
  iteration_get_capacity:  supported | unsupported
  pull_request_create:     <owned by /connect-code-repo; record here only if the host overlaps both>
operation_templates:
  # Each entry declares either `type: cli` with a `command` (multi-line CLI invocation with {{placeholders}})
  # or `type: rest` with `method`, `path`, `headers`, `body_template`. Pick the transport that matches the
  # host's primary interface. Every capability declared `supported` above MUST have a corresponding template.
  work_item_create:      { ... }   # placeholders: {{host_type}}, {{title}}, {{description}}, {{area_path}}, {{iteration_path}}, {{tags}}, {{extra_fields_kv_pairs}}
  work_item_read:        { ... }   # placeholders: {{id}}
  work_item_read_batch:  { ... }   # OPTIONAL -- placeholders: {{ids}} (comma-separated), {{fields}} (comma-separated; consumers pass the field set they need). Used by /dora-collect for windowed snapshots; skill falls back to per-id work_item_read when absent.
  work_item_update:      { ... }   # placeholders: {{id}}, {{title?}}, {{description?}}, {{state?}}, {{extra_fields_kv_pairs?}} -- consumers pass only the fields they want to update
  work_item_delete:      { ... }   # placeholders: {{id}}
  work_item_query:       { ... }   # placeholders: {{wiql}} for ADO, {{jql}} for Jira, {{search-string}} elsewhere
  work_item_link_add:    { ... }   # placeholders: {{source_id}}, {{target_id}}, {{link_type}} (mapped to host link name via mapping.link_types)
  work_item_comment_add: { ... }   # placeholders: {{id}}, {{body}}
  work_item_revisions:   { ... }   # OPTIONAL -- placeholders: {{id}}. Returns array of revisions; each revision includes the changed fields + timestamp + author. /dora-collect parses for state-transition history and rework detection.
  iteration_list:        { ... }   # no placeholders
```

**Operation execution mechanism (locked).** The dev-lead executes host operations via a **generic HTTP/REST template executor**: at runtime, the dev-lead reads the relevant `operation_templates.<op>` block, substitutes placeholders (`{{project}}`, `{{type}}`, `{{title}}`, etc.) from the call site, and runs the resulting request via `Bash`/`curl` (for HTTP hosts) or the appropriate CLI (e.g., `az`) for non-HTTP hosts. This is the lock from the prior open-question: deterministic templates over reasoned-on-the-fly execution.

#### Starter operation_templates copy (v2.5 #39698)

Once the host is named at Step 1, the dev-lead copies the matching starter file from `.claude/strap/templates/connection-templates/<host>.yaml` into the draft `devops-connection.yaml`'s `operation_templates:` block before the validation gate fires. Mapping:

| Host (Step 1 selection) | Starter file |
|---|---|
| Azure DevOps | `azure-devops.yaml` (work-item operations subset) |
| GitHub Issues | `github.yaml` (work-item operations subset) |
| Jira | `jira.yaml` |
| strap-agile (Local) | `strap-agile.yaml` (no operation_templates; capabilities point at local-file mechanism) |
| Other | empty `operation_templates:` block; CPO authors entries during the validation loop |

The starter provides ~14 pre-authored operations per host (work_item_create/read/update/delete/query/link_add/comment_add/revisions, iteration_list, state_machine_probe, field_existence_probe, etc.). The adopter typically only revises `{{token}}` placeholder names and host-specific path fragments (e.g., `{{organization}}` / `{{project}}` for ADO, `{{site}}` for Jira). The validation block at Step 5 surfaces the populated templates inline so the CPO can spot mismatches before persistence.

When a starter template references a capability the CPO declared `unsupported` at Step 5, the validation block flags it -- either upgrade the capability to `supported` (and keep the template) or drop the template entry (and accept the workflow consequence per the gap explanation).

#### Auth recipes per host (v2.5 #39698)

Concentrated authentication setup per host. The connect skill walks the relevant block at Step 2 (dev-lead authenticates) and persists `auth:` block references in `devops-connection.yaml`. Tokens never appear in YAML; only env-var names.

**Azure DevOps.** Bearer token from `az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798` (the ADO resource UUID). Persists as `auth.method: pat` with `auth.token_env: ADO_PAT` referencing the env var that carries the token. The az CLI must be installed AND the user signed in (`az login` or service-principal auth) -- the connect skill validates with `az account show` at Step 2. Required scopes: vso.work (read/write), vso.code (read/write for repo profile -- code-repo skill territory), vso.build (read for pipeline probe). Note: `az rest` is broken on dev.azure.com in some environments (token-resource + cp1252 errors); use `az boards` / `az repos` / `az pipelines` sub-commands instead OR raw curl with the Bearer token.

**Jira (Cloud).** API token created at https://id.atlassian.com/manage-profile/security/api-tokens (per-Atlassian-account, not per-project). Auth header is `Authorization: Basic base64({{user_email}}:{{token}})`. Persists as `auth.method: api_token` with `auth.user_env: JIRA_EMAIL` and `auth.token_env: JIRA_API_TOKEN`. The dev-lead pre-computes the Basic auth header at runtime; templates reference `{{token_auth_header}}` as the pre-encoded value.

**GitHub Issues.** Two options: fine-grained PAT (preferred for least-privilege) or classic PAT.
- **Fine-grained PAT** (https://github.com/settings/tokens?type=beta): scope to specific repos; required permissions are Contents: write, Issues: write, Pull requests: write, Actions: read. Persists as `auth.method: pat` with `auth.token_env: GITHUB_TOKEN`.
- **Classic PAT** (https://github.com/settings/tokens): scope is `repo` (broad). Simpler but org-wide.
- **`gh` CLI session** (`gh auth login`): handles token storage transparently. Most `github.yaml` operations use `gh` CLI patterns by default; REST patterns are the fallback when `gh` is not installed.

**Bitbucket Cloud.** App password from https://bitbucket.org/account/settings/app-passwords/ (per-user). Auth header is `Authorization: Basic base64({{user}}:{{app_password}})`. Persists as `auth.method: app_password` with `auth.user_env: BITBUCKET_USER` and `auth.token_env: BITBUCKET_APP_PASSWORD`. Required scopes per app password: Repositories: read/write, Pull requests: read/write, Issues: read/write (if Bitbucket Issues are in use), Pipelines: read.

**strap-agile (Local).** No remote auth. The dev-lead operates directly against `.claude/strap/work/` files.

**Other (unknown host).** The CPO names the env var conventions during Step 2; the auth block reflects those names without prescribed defaults.

For all hosts: credentials never appear in any tracked file. The connect skill validates env-var resolution at Step 2 via a no-op probe (e.g., `GET /projects?$top=1` for ADO, `GET /myself` for Jira) and surfaces resolution failures to the CPO inline.

### 5. Dev-lead validates with the CPO and persists

Surface the model to the CPO as a structured summary:

```
Connection profile draft:

  Host:           <host>
  Host URL:       <host_url>
  Auth:           <method> via env vars <user_env>, <token_env>

  Mapping:
    requirement  -> <host-type>
    spec         -> <host-type>
    feature      -> <host-type>
    story        -> <host-type>
    task         -> <host-type>
    bug          -> <host-type>
    enhancement  -> <host-type>

  States:
    new      -> <host-state>
    active   -> <host-state>
    resolved -> <host-state>
    closed   -> <host-state>

  Capabilities:
    Supported:   <list>
    Unsupported: <list>  (impact: <one-line consequence per gap>)

Confirm? (yes / adjust <field> / explain <capability>)
```

`yes` writes the profile to `.claude/strap/state/devops-connection.yaml` with `schema_version: "2.4"` as the first key, plus `validated_at: <ISO-timestamp>` and `validated_by: <CPO-handle>` (pulled from project-profile.md `## Identity` or, if absent, from `git config user.name`). `adjust <field>` reopens that field for revision. `explain <capability>` walks through what the gap means for the pipeline (e.g., "iteration_get_capacity unsupported on Jira Cloud -> sprint-planner will read capacity from MEMORY.md preferences instead").

On polyrepo umbrellas, persist also includes the `sub_repos:` map with the primary's entry seeded (empty mapping `{}` -- explicit inheritance from the umbrella defaults the primary just configured). Step 6 walks the remaining sub-repos and extends the map. On single-repo umbrellas, the `sub_repos:` map is omitted entirely.

After persist of the primary: on single-repo umbrellas, control flows to Step 5b (deployment_targets capture is still meaningful for single-repo adopters who want to declare topology) and then Step 5c (default parent Epics capture) before the satisfied gate releases. On polyrepo umbrellas, control flows to Step 5b, then Step 5c, then Step 6; the gate does NOT release until every sub-repo is wired.

### 5b. Umbrella deployment_targets capture (optional)

After the primary work-tracking project persists, capture the umbrella's deployment topology -- the set of deployment targets the umbrella ships to. Each declared target lives in `devops-connection.yaml`'s top-level `deployment_targets:` list and becomes the foreign-key target for sub-repos' `Deployment target` field. The per-sub-repo references themselves are captured by `/strap-in`'s extended interview (Feature 7 Story 7.3); Step 5b owns ONLY the umbrella-level list.

This step is **optional** -- adopters that don't model deployment topology may skip the entire step. Skipping leaves `devops-connection.yaml` without a `deployment_targets:` key (v2.3-equivalent shape); downstream skills (`/dora-collect`, `/dora-report`) fall through to v2.3 single-target deployment-frequency aggregation cleanly.

#### Re-run detection

Before prompting, read the existing `deployment_targets:` from `.claude/strap/state/devops-connection.yaml` (which Step 5 has already written). Three cases:

- **Absent or empty list**: first-time capture. Present the opt-in prompt ("Declare deployment targets?") with skip as a first-class option.
- **Existing non-empty list**: re-run. Surface the existing targets and `AskUserQuestion` for amend / replace / skip mode (see "Re-run modes" below).

#### Opt-in prompt (first-time capture)

`AskUserQuestion`:

```yaml
header: "Deployment targets"
question: "Declare deployment targets for this umbrella?"
options:
  - label: "Yes, declare targets"
    description: "Capture one or more deployment targets the umbrella ships to. Each target carries a canonical name, cloud, environment, and optional region. References from sub-repos drive Feature 9's per-target deployment-frequency math + per-target pipeline funnel rendering."
  - label: "Skip (Recommended if deployments are managed outside STRAP's attribution model)"
    description: "Leave deployment_targets: absent. /dora-collect falls through to v2.3 single-target deploy-freq aggregation. You can re-run /connect-devops-project later to capture targets if your attribution needs evolve."
```

`Skip` ends Step 5b immediately. `Yes, declare targets` enters the capture loop.

#### Per-target capture loop

For each target:

1. **`AskUserQuestion`: "Target #N -- name:"** Free-text input. Must be unique within the list (validate against already-captured targets in this run). Conventional shape: `<cloud>-<environment>` (e.g., `vercel-prod`, `azure-prod-eus`, `aws-staging`); enforce no spaces (sub-repo references parse the name as a single token).

2. **`AskUserQuestion`: "Cloud for `<name>`:"** Enum prompt with all canonical values + "Other":

   ```yaml
   header: "Cloud"
   question: "Which cloud or environment does `<name>` run on?"
   options:
     - label: "vercel"
       description: "Vercel hosting (typically frontend deploys; preview-deployment-aware)."
     - label: "azure"
       description: "Microsoft Azure (App Service, AKS, Functions, VMs, etc.)."
     - label: "aws"
       description: "Amazon Web Services (ECS, Lambda, EKS, EC2, etc.)."
     - label: "gcp"
       description: "Google Cloud Platform (Cloud Run, GKE, App Engine, etc.)."
     - label: "on-prem"
       description: "Self-hosted infrastructure (own datacenter, on-prem VMs, on-prem Kubernetes, edge devices, etc.). First-class because real adopter scenarios require it."
     - label: "other"
       description: "Cloud provider v2.4 doesn't enumerate (DigitalOcean, Cloudflare, Fly.io, Heroku, etc.). Future STRAP versions may codify additional values."
   ```

3. **`AskUserQuestion`: "Environment classification for `<name>`:"** Free-text input. Conventional values: `production`, `staging`, `dev`, `qa`. Suggest one based on the name (e.g., `vercel-prod` -> suggest `production`); CPO confirms or types another.

4. **`AskUserQuestion`: "Region for `<name>` (optional):"** Free-text input. Empty input = omit the field. Suggest a default based on the cloud + adopter context if signals are available (e.g., AWS + adopter is US-based -> `us-east-1`); confirm with CPO.

5. **Capture the target** as a dict `{name, cloud, environment, region}` in this run's pending list.

6. **`AskUserQuestion`: "Add another deployment target?"** Two options (`Yes, add another` / `No, that's all`). `Yes` loops back to step 1 for the next target. `No` exits the loop.

Single-target adopter flow: one iteration through steps 1-5, then `No` at step 6. Multi-target flow: N iterations.

#### Re-run modes

When Step 5b detects an existing non-empty `deployment_targets:` list:

```yaml
header: "Deployment targets re-run"
question: "Existing deployment_targets: list found (<N> targets). What would you like to do?"
options:
  - label: "Amend (Recommended)"
    description: "Add new targets to the existing list without modifying current entries. Existing targets keep their fields; the capture loop runs to collect additions. Safe default for evolving adopters."
  - label: "Replace"
    description: "Replace the entire deployment_targets: list. Captures fresh targets via the per-target loop; existing entries are overwritten. CPO double-confirmation required before persistence (will surface count of deletions)."
  - label: "Skip"
    description: "Preserve the existing list unchanged; skip Step 5b. Sub-repo references continue resolving against the existing list."
```

**Amend mode**: existing targets preserved verbatim; capture loop runs to append. New target names validated against the existing list for uniqueness.

**Replace mode**: captures fresh targets via the loop, then before persistence presents a double-confirmation: "This will delete N existing targets: <name-list>. Confirm? (yes / cancel)". `cancel` aborts the replacement and falls through to amend / skip choice again. `yes` writes the fresh list, discarding the old.

**Skip mode**: no-op; existing list preserved.

#### Persistence

After the capture loop completes (or amend/replace decision), persist by re-writing `.claude/strap/state/devops-connection.yaml` with the new top-level `deployment_targets:` list. The list lives as a sibling of `host`, `organization`, `project`, `auth`, `mapping`, `capabilities`, `operation_templates`, `sub_repos:`. Position: alphabetical or grouped-by-concern (place it adjacent to `sub_repos:` since both are polyrepo / topology-related); follow the existing file's ordering convention.

Skip mode produces no file write (idempotent).

The `validated_at` + `validated_by` discipline applies per top-level block: Step 5b stamps `deployment_targets_validated_at:` + `deployment_targets_validated_by:` at the same level (mirroring how the primary's `validated_at` lands).

### 5c. Default parent Epics for top-level work items (optional)

After Step 5b's deployment_targets capture and before Step 6's per-sub-repo wire-up, capture optional default parent Epics for `Requirement`, `Spec`, and `Feature` work items. Many adopter teams overlay an Epic-bucket scheme on top of STRAP's flat work-item hierarchy as a backlog-organization aid -- "all STRAP-authored Requirements live under one Epic; all Specs under another; all Features under a third". STRAP's custom process templates treat Requirement / Spec / Feature as top-level types (no parent enforcement), but adopter teams often want the Epic-level visibility anyway. Step 5c is where that intent gets captured into `mapping.default_parents`.

This step is **optional** -- adopters using tags / area paths / queries for backlog organization (rather than Epic-bucket overlays) skip the step. Skipping persists `mapping.default_parents: { requirement: ~, spec: ~, feature: ~ }` (explicit nulls = "no parent on file"); future `/new-requirement`, `/create-spec`, `/generate-features` runs honor the explicit-null and file work items top-level.

#### Re-run detection

Before prompting, read existing `mapping.default_parents` from `.claude/strap/state/devops-connection.yaml`. Three cases:

- **Absent / empty `{}`**: never configured. Run the full interview.
- **All three keys present with explicit values** (Epic ids OR explicit nulls): already configured per a prior CPO decision. Skip this step entirely unless the CPO has invoked `/connect-devops-project` with explicit re-run intent.
- **Partial population** (some keys set, others missing): run the interview for only the missing keys.

#### Opt-in prompt

`AskUserQuestion`:

```yaml
header: "Parent Epics"
question: "Configure default parent Epics for STRAP-filed Requirements, Specs, and Features?"
options:
  - label: "Skip -- keep work items top-level (Recommended for most installs)"
    description: "STRAP's default. The custom process template treats Requirement / Spec / Feature as top-level types; no parent Epic is required. Work items remain discoverable via area path + tags + queries. Pick this when the team uses tags / queries (not Epic-bucket overlays) for backlog organization."
  - label: "Create new STRAP Epics"
    description: "Auto-create 'STRAP Requirements', 'STRAP Specs', and 'STRAP Features' Epics at the configured area path. Future /new-requirement, /create-spec, /generate-features runs will parent automatically. Recommended when the team wants Epic-level grouping but doesn't yet have organizational Epics in place."
  - label: "Use existing Epics"
    description: "Point at Epics that already exist in your DevOps host (e.g., a 'Requirements' bucket Epic the team uses for organization). I'll ask for each Epic ID per type. You can mix-and-match (set Requirements only, skip Specs + Features)."
```

`Skip` ends Step 5c with explicit-null persistence (see Persistence below). `Create new STRAP Epics` enters the auto-create flow. `Use existing Epics` enters the per-type ID-capture flow.

#### Auto-create flow ("Create new STRAP Epics")

For each of the three logical types (requirement, spec, feature), the dev-lead creates an Epic via `operation_templates.work_item_create` with `host_type=Epic` (NOT a STRAP logical type -- Epic is adopter-host scaffolding, used here as a parent slot):

```
Epic title:     "STRAP Requirements" (then "STRAP Specs", then "STRAP Features")
Epic area:      mapping.area_path_root
Epic iteration: mapping.iteration_path_root  (or omitted -> host default)
Epic state:     mapping.states.new
Epic tags:      AI; strap:epic; strap:default-parent
Epic body:      "Default parent Epic for STRAP-authored <type>s. Auto-created by /connect-devops-project on <ISO-date> for the <project> wire-up. STRAP work items of type <type> file under this Epic by default; the CPO can override per-item by setting an explicit parent at item-creation time."
```

After each Epic creates successfully, capture the returned id into the pending `default_parents` map. Failure of any single Epic creation (host rejects the type, area path resolution fails) is non-fatal: surface the failure to the CPO with options to retry that Epic, persist nulls for that type, or abort the whole step. Partial-completion is permitted -- if "STRAP Features" creates but "STRAP Specs" fails, persist `default_parents: { requirement: <id>, spec: ~, feature: <id> }` with the explicit null marking spec as un-parented for now.

#### Per-type ID-capture flow ("Use existing Epics")

For each logical type (requirement, spec, feature), run a focused mini-prompt:

```yaml
AskUserQuestion:
  header: "Parent Epic for <type>"
  question: "Which existing Epic parents STRAP-filed <type>s? (Epic id from the host)"
  options:
    - label: "Provide Epic ID"
      description: "Enter the host work-item id of the Epic. I'll verify it exists, is of type Epic, and is in a non-Closed state before binding."
    - label: "Skip this type (leave un-parented)"
      description: "Persist an explicit null for <type>. Future STRAP-filed <type>s will land top-level."
```

When the CPO provides an ID, validate via `operation_templates.work_item_read`:
- Item exists (no 404)
- `host_type` is "Epic" (or the host's Epic-equivalent type if the mapping declares one)
- State is not "Closed" / "Removed" (closed Epics shouldn't auto-parent new work)

On validation failure: surface the specific failure (not-found / wrong-type / closed) and re-prompt. CPO can correct the id or skip the type.

On successful validation: capture into the pending `default_parents` map.

#### Persistence

After the flow completes (or Skip is chosen), persist `mapping.default_parents` with explicit per-type values. Three legal value shapes per key:

- **`~` (YAML null)**: explicit "no parent" -- CPO's deliberate choice. Future skills file work items top-level without re-prompting.
- **`<integer-id>`**: parent Epic id. Future skills auto-parent new work items.
- **Key missing entirely**: legacy / pre-Step-5c installs. Future skills surface the gap and ask the CPO ad-hoc (per existing `/new-requirement`, `/create-spec`, `/generate-features` failure-handling).

The full Step 5c-produced block looks like:

```yaml
mapping:
  default_parents:
    requirement: 39590   # STRAP Requirements Epic (auto-created 2026-05-29)
    spec:        39591   # STRAP Specs Epic
    feature:     39592   # STRAP Features Epic
  default_parents_validated_at: 2026-05-29T16:00:00Z
  default_parents_validated_by: scorrallo
```

Or, if the CPO chose Skip:

```yaml
mapping:
  default_parents:
    requirement: ~       # explicit no-parent (CPO chose top-level filing)
    spec:        ~
    feature:     ~
  default_parents_validated_at: 2026-05-29T16:00:00Z
  default_parents_validated_by: scorrallo
```

The `validated_at` + `validated_by` per-block stamping mirrors Step 5b's pattern.

#### Scope and extensions

Step 5c covers `Requirement`, `Spec`, and `Feature` -- the three "top-level" logical types whose parent slot is genuinely optional. Bugs and Enhancements are NOT covered by Step 5c in v2.4 (they typically live under their generating Feature or as standalone work items; their parent semantics are different). Extending Step 5c to `bug` and `enhancement` is a v2.5 candidate when adopter feedback surfaces real organizational use cases.

Stories and Tasks are NEVER auto-parented to Epics -- they descend from Features (Stories) or Stories (Tasks) per `/decompose-feature`'s explicit parent-child relations.

### 6. Per-sub-repo wire-up (polyrepo umbrellas only)

For each non-primary sub-repo in `project-profile.md`'s `Sub-repos` section, run a focused mini-flow:

1. **Present the sub-repo's metadata.** Show slug, path, role, primary_language, active_domains.
2. **`AskUserQuestion`: "Configure work-tracking for `<slug>`:"** Options (no previews; nominal-label decision):
   - **`Same as primary` (Recommended for shared work-tracking):** sub-repo's items live in the same project as the primary. The `sub_repos:` map entry is `<slug>: {}` (empty mapping = explicit inheritance). Use when the umbrella has one logical work-tracking project that tracks all sub-repos' work.
   - **`Different project, same host + organization` (Recommended for separated work-tracking):** the canonical v2.4 polyrepo case. Prompt for the project name. Probe the new project for capability differences (work-item types, custom fields, iteration support). Persist a per-sub-repo entry with `project: <name>` plus any `capabilities:` overrides if the probe found differences. The mapping and operation_templates typically inherit (same host means same protocols and field shapes); flag for CPO confirmation when the probe surprised.
   - **`Different host or organization` (out-of-scope; v2.5 candidate):** surface the cross-host federation limitation. If the CPO insists, capture the structural override (per-sub-repo `host`, `organization`, `auth`) and document the operational degradation in the persisted file as an inline comment. Pipeline skills that hit a cross-host umbrella surface "Cross-host federation requires v2.5; falling back to per-sub-repo dispatch" warnings at runtime.
   - **`Skip` (sub-repo has no work tracking):** rare; the sub-repo is a library that lives in the umbrella for code-coupling but its work items live elsewhere or nowhere. Persist `<slug>: { tracking: skipped }` so pipeline skills know to bypass work-tracking operations for that sub-repo.
3. **Capture `pipeline_match_patterns` (v2.4 F10; cross-host probe v2.5 #39703).** Explicit per-sub-repo pipeline-name patterns drive `/dora-collect`'s pipeline attribution (PRIMARY signal; fallback to path-based + name-substring otherwise). The probe is host-dispatched -- the connect skill reads the umbrella's host from the persisted `host` field (or the in-progress draft when running for the first time) and invokes the matching probe below. **Depends on the auth recipes per host + the operation_templates starter copy from #39698; the templates include `pipeline_list` and `pipeline_runs_list` operations that this substep invokes.**

   **Per-host probe queries:**

   - **Azure DevOps**: `az pipelines runs list --top 30 --query "[].definition.name"` for the project. Returns the most-recent 30 pipeline-run definition names. The CLI handles auth via the active `az login` session; alternative REST: `GET /{{organization}}/{{project}}/_apis/build/builds?api-version=7.1&$top=30` with `Authorization: Bearer {{token}}`.
   - **GitHub Actions**: invoke the `pipeline_list` operation template from `github.yaml` (`gh api repos/{{owner}}/{{repo}}/actions/workflows --jq '.workflows[] | .name'`). For runs-level discovery, invoke `pipeline_runs_list` (`gh api repos/{{owner}}/{{repo}}/actions/runs?per_page=30 --jq '.workflow_runs[].name'`). Workflows ARE the named pipelines on GitHub; the workflow `.name` field corresponds to ADO's pipeline definition name.
   - **Bitbucket Pipelines**: two-stage probe. (a) Parse `bitbucket-pipelines.yml` from the repo root if accessible (declared pipeline names live in `pipelines.default`, `pipelines.branches.<branch>`, `pipelines.pull-requests.<branch>`, `pipelines.custom.<name>`); (b) invoke the `pipeline_list` REST template from `bitbucket.yaml` (`GET /repositories/{{workspace}}/{{repo_slug}}/pipelines?sort=-created_on&pagelen=30`) for the most-recent runs. Distinct pipeline names emerge from either source -- Bitbucket Pipelines doesn't enforce a "pipeline name" the way ADO does, so adopters often rely on the YAML's pipeline keys (`default`, `staging`, `production`) as the pattern targets.
   - **Jenkins**: query the controller's API for the job list. Default endpoint: `GET <jenkins-base>/api/json?tree=jobs[name,fullName]` with `Authorization: Basic base64({{user}}:{{api_token}})`. For multi-branch / pipeline-as-code Jenkins, recurse into folder children via `<jenkins-base>/job/<folder>/api/json`. The starter `jenkins.yaml` operation template is NOT shipped in v2.5 (deferred to v2.6 when a Jenkins adopter surfaces); the probe falls back to free-text capture for Jenkins adopters today, with the doctrine documented here as future-spec.
   - **strap-agile (Local)**: no CI; substep 3 is silently skipped on local hosts (no pipeline-match-patterns concept).
   - **Other (unknown host)**: free-text capture only; no automated probe. Surface the gap to the CPO and offer to capture patterns via the `Custom pattern` path below.

   **Common flow after the probe returns:**

   Surface the distinct pipeline names + `AskUserQuestion`: "Which of these pipeline names belong to `<slug>`?" with each name as a selectable option (multi-select) plus `None of these` / `Custom pattern (regex or glob)`. On `Custom pattern`: free-text capture; supports glob (default) or regex (when wrapped in `/.../`). Captured patterns persist as `sub_repos.<slug>.pipeline_match_patterns: [...]`. **Field-state semantics matter for re-run safety:**

   | State | Meaning | Re-run behaviour |
   |---|---|---|
   | Key absent | F10 capture never ran for this sub-repo (typical: profile written before v2.4-polish #39555 landed, or sub-repo added before F10 capture was wired) | Re-prompt via the targeted backfill flow described in Re-run safety below |
   | `[]` (explicit empty array) | F10 capture ran AND the adopter deliberately captured zero patterns (umbrella shares the ADO project with neighboring products that own their own CI; this sub-repo genuinely has no pipeline of its own in this host) | Preserve as-is; do not re-prompt |
   | `[<pattern>, ...]` (non-empty array) | F10 capture ran and patterns were declared | Preserve as-is; do not re-prompt |

   Multiple patterns allowed (some adopters have build + deploy pipelines under different names per sub-repo). When the host has zero pipelines visible (fresh project, pipelines not yet wired): skip with an inline note; persist the key as absent so a future re-run re-prompts when the host has pipelines.

   **Empty-patterns case as valid adopter state (v2.5-polish #39707).** When the keyword classification yields zero matches across **all** sub-repos (the umbrella-shares-ADO-project posture -- e.g., an umbrella whose sub-repos live in an ADO project alongside neighboring products that own their own pipelines), surface an inline callout to the CPO at the end of Step 6:

   > **No pipeline definitions matched any sub-repo.** This is a legitimate adopter state -- your umbrella may share the ADO project with neighboring products that have their own CI, and none of those pipelines belong to this umbrella's sub-repos today. F10 attribution-delta validation defers to a future polyrepo conversion where pipeline names DO map to your sub-repos. Each sub-repo's `pipeline_match_patterns` will persist as an explicit empty array `[]` so the next `/dora-collect` and `/connect-devops-project` re-run honour the captured intent (no re-prompts; `/dora-collect` short-circuits the attribution pass per #39708).

   The callout fires when, across all visible sub-repos that completed substep 3, the union of captured patterns is empty. The CPO acknowledges the callout (`AskUserQuestion`: Continue / Re-run pattern capture for individual sub-repos / Cancel) before substep 4 persists.
4. **Persist the sub_repos: map entry** for this sub-repo with the captured overrides + `pipeline_match_patterns` (when captured, including explicit `[]`) + `validated_at` + `validated_by`. The empty-array case is persisted explicitly (not omitted) so re-run safety can distinguish "deliberate empty" from "never captured".
5. **Loop to the next sub-repo.** When all non-primary sub-repos are wired, the satisfied gate releases.

The same Cancel-mid-loop and partial-persistence semantics as `/connect-code-repo`'s Step 6 apply: a cancelled run lands the partial `sub_repos:` map; the next `/connect-devops-project` invocation picks up where the partial wire-up left off.

#### Persistence: schema_version + sub_repos: map + deployment_targets: list encoding (devops)

The persisted `devops-connection.yaml` carries:

- **`schema_version: "2.4"`** as the first key. Written by every successful run regardless of umbrella mode.
- **Top-level umbrella defaults** (host, organization, project, auth, mapping, capabilities, operation_templates) seeded from the primary sub-repo's work-tracking project (polyrepo) or the only project (single-repo).
- **`deployment_targets:` list** (optional; captured by Step 5b). Each entry is a dict with `name` (canonical identifier; FK target for sub-repos' `Deployment target` field), `cloud` (enum: vercel / azure / aws / gcp / on-prem / other), `environment` (free-form classification), `region` (optional). Absence is valid -- single-target / un-modeled adopters omit the key entirely. Feeds Feature 9's per-target deployment-frequency math + per-target pipeline funnel.
- **`mapping.default_parents` block** (optional; captured by Step 5c). Three keys (`requirement`, `spec`, `feature`), each carrying either a host Epic id (auto-parent enabled), explicit `~` / null (CPO chose top-level filing; no parent applied), or missing entirely (legacy pre-Step-5c install; skills surface gap ad-hoc). Consumed by `/new-requirement`, `/create-spec`, `/generate-features`. The `default_parents_validated_at` + `default_parents_validated_by` siblings record when the block was last confirmed.
- **`sub_repos:` map** (polyrepo umbrellas only). Each entry is keyed by sub-repo slug:
  - **Empty mapping `{}`**: explicit inheritance from the umbrella defaults.
  - **Partial mapping**: declares only the fields that override (typically just `project:` in the same-host-different-project case; sometimes `capabilities:` when per-project differences surface; `tracking: skipped` for sub-repos with no work tracking).
  - **`validated_at` + `validated_by`** per entry.

Per-sub-repo `mapping` overrides are supported but rarely needed; when work-item-type names differ across projects under the same host (one project uses `Story` while another uses `User Story`), the override goes here.

Per-sub-repo `deployment_target` references (the FK pointer from a sub-repo to a target name in this list) are NOT captured here -- they live in `project-profile.md`'s `Sub-repos` section, populated by `/strap-in`'s extended interview (Feature 7 Story 7.3). Step 5b owns the umbrella-level list; `/strap-in` owns the per-sub-repo references.

#### Re-run safety (devops)

Same pattern as `/connect-code-repo`'s re-run safety:

1. **Read existing profile** before prompting. Surface current sub-repo configuration state to the CPO.
2. **Three CPO options:** configure missing sub-repos only / reconfigure specific sub-repo / reconfigure entirely (archives old profile as `devops-connection.<ts>.yaml.bak`).
3. **Preservation rule:** untouched entries keep existing `validated_at` and `validated_by`.
4. **Project-profile drift detection:** orphan entries (sub-repo removed via /strap-refresh) surface for CPO decision (Remove from profile / Keep / Cancel).
5. **Missing-field backfill -- targeted substep re-run (v2.5-polish #39706).** Re-run mode scans every already-configured sub-repo entry in the persisted `sub_repos:` map for any v2.4 schema fields whose key is **absent** (vs present-but-empty -- see substep 3's field-state table). The current backfill targets are:

   - `pipeline_match_patterns` -- absent indicates F10 capture never ran for this sub-repo (typical: profile written before v2.4-polish #39555 landed; or sub-repo added via `/strap-refresh` between the initial wire-up and the F10 capture being added). Surface ONLY the F10 substep (substep 3) for the affected sub-repos -- not the full Step 6 mini-flow -- and persist the captured patterns (including explicit empty arrays) without touching other fields on the entry. The entry's `validated_at` / `validated_by` refresh ONLY when the backfill writes.

   Detection runs after Step 6's "configure missing sub-repos" pass and before the satisfied gate releases. When backfill is needed, prompt:

   ```yaml
   AskUserQuestion:
     header: "Backfill F10 patterns"
     question: "<N> already-configured sub-repos are missing pipeline_match_patterns (F10 capture never ran for them). Run the F10 substep for these now?"
     options:
       - label: "Backfill all <N> (Recommended)"
         description: "Run the F10 pipeline-name capture for each affected sub-repo. Other fields on the entry are preserved verbatim. /dora-collect's attribution improves immediately on the next run."
       - label: "Skip backfill -- defer to next /connect-devops-project re-run"
         description: "Leave the field absent. Pipeline attribution continues to use path-based + name-substring fallbacks. The next re-run re-surfaces this prompt."
       - label: "Persist explicit empty arrays (umbrella shares ADO project, no patterns to capture)"
         description: "Stamp each affected sub-repo with pipeline_match_patterns: []. Use when the umbrella's sub-repos share the ADO project with neighboring products that own their own CI -- /dora-collect's attribution pass short-circuits cleanly per #39708. Re-run mode will NOT re-prompt after this."
   ```

   Targeted-substep semantics are deliberate: the goal is recovery from "the F10 capture wasn't part of the original wire-up" without re-walking the entire Step 6 mini-flow (which would re-prompt for project / capability / mapping fields the adopter already confirmed). The same shape extends to future v2.5+ schema additions: each new per-sub-repo field gets a backfill substep that runs only for entries with the key absent.

The skill stays idempotent: a re-run with no project-profile changes and no CPO edits produces no diff on `devops-connection.yaml` other than refreshed `validated_at` timestamps on touched entries.

### Hand-off

Present the CPO with a structured summary (text block):

```
/connect-devops-project complete.

Profile persisted at: .claude/strap/state/devops-connection.yaml
Host:                 <host>
Capabilities:         <N supported, M unsupported>
Capability gaps with workflow impact:
  - <gap>: <which skills degrade and how>
  - ...
```

Then surface the next-step gate via `AskUserQuestion`. The available options depend on whether the source-control profile already exists -- check `.claude/strap/state/code-connection.yaml` before rendering.

**If `code-connection.yaml` does NOT exist** (work-tracking wired before code-repo):

```yaml
header: "Next step"
question: "What's next?"
options:
  - label: "Connect source control (Recommended)"
    description: "Run /connect-code-repo. REQUIRED wire-up: the pipeline cannot open PRs without this, and the code-immutability invariant only releases when this skill's satisfied gate clears."
  - label: "Pause"
    description: "Stop here. Work-tracking is wired but source control is not. The pipeline cannot open PRs yet. /connect-code-repo must run before any /execute-sprint or PR-creating workflow."
```

**If `code-connection.yaml` DOES exist** (typical case -- code-repo wired first per the default `/strap-in` hand-off):

```yaml
header: "Next step"
question: "What's next?"
options:
  - label: "Pause (Recommended)"
    description: "Stop here. Both connection profiles are in place. The pipeline is fully wired and ready for /file-bugs, /new-requirement, /create-spec, /decompose-feature, /execute-sprint."
  - label: "File the discovery bugs now"
    description: "Run /file-bugs against the production-bug list captured in project-profile.md during /strap-in synthesis. Files them as Bug work items in this DevOps host."
```

Hand-off is the natural exit.

## Outputs

- `.claude/strap/state/devops-connection.yaml` -- per-project connection profile. Source-controlled. **Carries env-var REFERENCES, never credential values.** The `mapping.work_item_types` block carries all seven STRAP logical types (`requirement`, `spec`, `feature`, `story`, `task`, `bug`, `enhancement`); the values come either from the probed default (when the CPO picked `Accept probed mapping`) or from the CPO's per-type selections (when the CPO walked the Custom Map flow).
- Updated `.claude/strap/contexts/project-profile.md` -- the `## DevOps integration` section gets a one-line summary ("Host: Azure DevOps; org: `<your-org>`; project: `<your-project>`; details in `.claude/strap/state/devops-connection.yaml`").
- For Local mode: `.claude/strap/work/<type>/` directories created (one per type), with a `.gitkeep` if no items exist yet.

## Quality gates

The skill is successful when all of the following hold:

- A connection profile exists at `.claude/strap/state/devops-connection.yaml` with all required fields.
- The profile carries env-var REFERENCES only -- no credential value appears anywhere in the file.
- Auth probe passed at validation time (`auth.last_probe_status: ok`).
- At least one read-probe operation succeeded (e.g., listing projects, listing work-item types).
- Capability declarations match probe evidence -- claimed-supported operations have at least one passing probe; claimed-unsupported operations have a recorded failure or a known-host limitation.
- Every STRAP logical type (`requirement`, `spec`, `feature`, `story`, `task`, `bug`, `enhancement`) has a non-null `host_type` mapping. None left unset after either the Accept-probed-mapping path or the Custom Map flow.
- State-machine probe ran per work-item type (v2.5 #39697): probed state list + heuristic-derived collapse surfaced to the CPO before the per-type AskUserQuestion; CPO chose Accept / Customize / Skip per type. On re-runs, persisted entries were diffed against the fresh probe and surfaced when divergent.
- Pipeline-pattern probe ran per-sub-repo at Step 6 substep 3 using the host-dispatched probe (Azure DevOps `az pipelines runs list`; GitHub Actions `gh api workflows + runs`; Bitbucket Pipelines `bitbucket-pipelines.yml` + REST runs; Jenkins `/api/json` jobs; strap-agile silently skipped; Other free-text only) (v2.5 #39703). Probe results were surfaced as multi-select options; CPO chose patterns OR Custom pattern OR None of these per sub-repo.
- Collision warnings and hierarchy notes (when present) were surfaced in the validation block before the CPO confirmed; the CPO's confirmation includes implicit acceptance of those observations.
- The CPO confirmed the profile at the validation gate.

The skill fails -- and reports clearly -- when:

- Auth probe fails irreparably (wrong env-var, expired cred, network failure). Surface the underlying error verbatim; do not retry silently.
- A required logical operation cannot be modeled and the host doesn't support graceful degradation. Surface the gap; ask the CPO whether to fall back to Local (strap-agile) or pause.
- The CPO declines at the validation gate. Write no profile; exit cleanly. The skill is safely re-invokable.

## Failure handling

- **Pre-flight finds scaffold sentinel in `project-profile.md`**: redirect to `/strap-in`.
- **CPO pastes a credential into a prompt**: do not echo, do not write, do not commit. Respond with: "Credentials must not appear in any tracked file or any prompt visible to me. Set `<env-var-name>` in `.claude/settings.local.json` env block (or your shell env) and retry." Continue with whatever the non-credential next step is.
- **Auth probe returns an actionable error** (e.g., 401, 403, env var unset): surface the error verbatim with a one-line remediation hint; loop back to the auth step.
- **Write probe creates a work item but cannot delete it**: surface the orphan loudly with the host item id so the CPO can clean up manually. Do NOT proceed to persist as if the write probe passed.
- **`operation_templates` rendering produces malformed requests**: surface the failing template path and request body; do not persist a profile that has known-broken templates.
- **CPO picks `Reject and exit` at the mapping-decision gate**: exit `/connect-devops-project` cleanly with no persistence. The skill is safely re-invokable.
- **CPO picks `Cancel` at the Custom Map final-confirmation gate**: return to the top-level mapping-decision gate (Accept / Customize / Reject); no persistence. The Custom Map flow's intermediate selections are discarded.
- **CPO picks `Restart Custom Map`**: return to Custom Map Step 1; previously-collected per-type answers are discarded.
- **A STRAP type's `Type Something` free-text input is empty or whitespace**: re-prompt the affected question; do not accept null mappings.
- **Probed host type list is empty (process template exposes no work-item types)**: stop with a clear error; the host or process template needs adjustment before `/connect-devops-project` can model it. Recommend the CPO review the host's process template or pick a different project.
- **State-machine probe fails for a work-item type** (network error, permissions, host returns no states for the type): surface the underlying error inline; offer `Retry probe (Recommended)` / `Fall back to Customize without probed states` via AskUserQuestion. Persistent probe failures degrade gracefully to the legacy free-text Customize flow; the persisted entry records the degradation in its `notes:` block.
- **Pipeline-pattern probe fails at Step 6 substep 3** (host CLI unavailable, REST endpoint returns 4xx/5xx, `bitbucket-pipelines.yml` parse error): surface the error inline; offer `Retry probe` / `Fall back to free-text Custom pattern only (Recommended)` via AskUserQuestion. The free-text fallback preserves the substep's value (adopter can still capture patterns by typing them) while marking the probe failure in the persisted entry's `notes:` for re-run awareness.

## References

- [`onboarding-design.md`](../../strap/contexts/onboarding-design.md) -- connection-discovery model, five-step flow, profile shape, secrets discipline, capability gaps.
- [`../connect-code-repo/SKILL.md`](../connect-code-repo/SKILL.md) -- the paired skill for source-control wire-up.
- [`../strap-in/SKILL.md`](../strap-in/SKILL.md) -- the upstream skill whose hand-off points here.
- `.claude/strap/templates/connection-templates/<host>.yaml` -- per-host accelerator templates. **Optional optimization**: if a template for the chosen host is present, the dev-lead loads it at Step 2 and uses it as a strong prior for Steps 3-4, validating that the template still matches the live host. If no template is present, the dev-lead runs the five-step flow from scratch. The skill works identically in either case; templates only save discovery time. The schema is the same as `.claude/strap/state/devops-connection.yaml`.
- [`CLAUDE.md`](../../../CLAUDE.md) -- super-pair identity; secrets discipline; persistence stack.
