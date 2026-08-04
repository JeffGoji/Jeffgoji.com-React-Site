---
name: /connect-code-repo
description: Wire up source control. CPO picks Azure Repos / Bitbucket / GitHub / Local Git / Other; the dev-lead probes the host, models branches/PRs/auth, validates with the CPO, and persists a per-project connection profile. The pipeline reads the profile at runtime to create branches and open PRs via the universal `{{adapter.source_control.*}}` interface. Required before the pipeline can open PRs.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion
---

# /connect-code-repo

## Purpose

Wire up the source-control surface for THIS project. After `/strap-in` and (typically) `/connect-devops-project` complete, the persistence stack is curated and work-tracking is wired. But the pipeline still cannot open pull requests because it has nowhere to push branches and no PR-creation operation to call. `/connect-code-repo` closes that gap.

Git itself is a **hard prerequisite** -- the skill fails fast if `git --version` does not return a version.

The skill follows the **connection-discovery model** specified in [`onboarding-design.md`](../../strap/contexts/onboarding-design.md#connection-discovery-model). Same five-step flow as `/connect-devops-project`, with a Local Git escape valve for projects that do not yet have (or do not want) a remote.

Invoke when:

- `/strap-in` has completed and the CPO is ready to wire source control.
- The CPO wants to switch hosts (re-invoke; existing profile is overwritten after confirmation).
- The CPO is transitioning from Local Git to a real remote (re-invoke and pick the new host).

Do NOT invoke when:

- `/strap-in` has not yet run. Pre-flight surfaces "run `/strap-in` first."
- `git` is not on PATH. Pre-flight surfaces install instructions and exits.

## Owner

The dev-lead. Runs in the top-level Claude Code session. Uses `Bash` for git operations and HTTP probes; no specialist dispatch.

## Inputs

- `$ARGUMENTS` -- optional. Currently unused.
- `.claude/strap/contexts/project-profile.md` -- must exist and be past its scaffold state (sentinel stripped).
- `.claude/strap/state/code-connection.yaml` -- may or may not exist. If present, surfaced at pre-flight.
- Environment variables for the chosen host's auth method. **The skill never writes a credential value.**
- The CPO -- interactively available throughout.

## Pre-flight

Three checks:

**1. Git installed.** Run `git --version`. If it fails:

```
git is not installed or not on PATH. /connect-code-repo requires git.

Install git:
  Windows:  https://git-scm.com/download/win
  macOS:    brew install git    (or install Xcode Command Line Tools)
  Linux:    apt-get install -y git    (Debian/Ubuntu)
            dnf install -y git        (RHEL/Fedora)

Then re-invoke /connect-code-repo.
```

Exit.

**2. Project-profile sanity.** Same check as `/connect-devops-project`. Surface "run `/strap-in` first" if missing/scaffold/empty.

**3. Existing-profile check.** Read `.claude/strap/state/code-connection.yaml`. If present:

```
A code-repo connection profile already exists:
  Host:           <host>
  Host URL:       <host_url>
  Default branch: <default_branch>
  Last validated: <validated_at>

Pick one:
  keep       -- exit; use the existing profile
  reconnect  -- re-probe the same host and re-validate
  switch     -- pick a different host (Local Git -> remote upgrade goes through here too)
```

`keep` exits. `reconnect` proceeds to step 3 (re-probe). `switch` proceeds to host selection.

## Workflow

Five steps for remote hosts (executed against the **primary sub-repo** on polyrepo umbrellas); a per-sub-repo wire-up loop afterwards on polyrepo umbrellas; a Local Git branch for adopters with no remote.

### 0. Polyrepo detection + primary sub-repo selection

Read `project-profile.md` for the `Sub-repos` section + schema sentinel (`<!-- strap-schema: sub-repos-v2.4 -->`).

**Single-repo umbrellas** (no `Sub-repos` section, or empty): proceed directly to Step 1 with the existing single-host single-project flow. Steps 1-5 configure the umbrella's only repo; Step 6 (the per-sub-repo loop) is skipped; persistence omits the `sub_repos:` map.

**Polyrepo umbrellas** (Sub-repos section populated): enter the polyrepo flow.

1. **Present the sub-repo list to the CPO.** Show slug + path + role from `Sub-repos` for each entry.
2. **Primary sub-repo selection.** Ask `AskUserQuestion`: "Which sub-repo is the primary?" Options: one per sub-repo from the Sub-repos list, with the auto-suggested primary marked `(Recommended)`. Heuristics for the recommendation, in priority order:
   - The sub-repo whose `role` mentions "primary", "main", "user-facing", or "client".
   - The sub-repo with the most `Active domains` entries (typically the most-active surface).
   - The first sub-repo in the section (project-profile order).
3. **Configure the primary first via Steps 1-5.** The primary's host, organization, default_branch, branch_patterns, and auth become the umbrella defaults. The primary's branch_protection observations (Step 3 read-only probe of host policies) inform the suggested branch_protection.policy for the primary's sub_repos: entry at Step 6 persistence (independent unless the CPO chose otherwise).
4. **After Step 5 persists the primary, proceed to Step 6** to wire each non-primary sub-repo.

### 1. CPO names the host

`AskUserQuestion` with four named options + "Other":

```yaml
header: "Source-control host"
question: "Which host carries this project's source?"
options:
  - label: "Azure Repos"
    description: "Azure DevOps git repo. PR creation via Azure DevOps REST. Pairs naturally with Azure DevOps as the work-tracking host."
  - label: "GitHub"
    description: "GitHub.com or GitHub Enterprise. PR creation via GitHub REST or gh CLI. Public or private repos."
  - label: "Bitbucket"
    description: "Bitbucket Cloud or Server. PR creation via Bitbucket REST. Pairs naturally with Jira as the work-tracking host."
  - label: "Local Git"
    description: "Local-only git, no remote. PR ceremony happens locally as a coordinated merge. Suitable for evaluation, solo workflows, or projects that have not yet provisioned a remote."
```

`Other` accepts the host name as free text and routes to a full from-scratch discovery.

### Local Git branch

If the CPO picked Local Git, skip the five-step flow.

**Satisfied-gate condition (Local Git):** `git --version` returns AND a `main` branch exists. If the repository has not been `git init`-ed, the skill offers:

```
This directory is not yet a git repository. Local Git mode needs `git init` and a `main` branch.

Initialize now? (yes / cancel)
```

`yes` runs:

```bash
git init -b main
git add -A
git commit -m "chore: initial commit (created by /connect-code-repo local-git mode)"
```

(Or, if `git init -b main` is unsupported on the local git version, `git init` + `git symbolic-ref HEAD refs/heads/main`.)

Local Git PR ceremony:

- Feature branches off `main`, task branches off feature branches.
- A "PR" is a dev-lead-coordinated local merge with sanity gates:
  - Tests pass (centralized via the dev-lead).
  - No force-merge to `main`.
  - Dev-lead approval logged in the merge commit message.
- The pipeline's `pull_request_create` operation maps to a local merge, not to an API call.

Write the connection profile to `.claude/strap/state/code-connection.yaml`:

```yaml
host: local-git
host_url: file://<absolute-repo-path>
default_branch: main
auth:
  method: none
mapping:
  branch_prefix:
    feature: feature/
    task:    task/
    fix:     fix/
    chore:   chore/
capabilities:
  ref_get:                   supported   # via git rev-parse refs/heads/<branch>
  branch_list:               supported   # via git for-each-ref
  branch_create:             supported   # via git checkout -b
  branch_delete_local:       supported   # via git branch -d
  branch_delete_remote:      unsupported # no remote
  branch_push:               unsupported # no remote
  pull_request_create:       degraded    # local-merge ceremony; not a host API call
  pull_request_get:          unsupported
  pull_request_update:       unsupported
  pull_request_close:        supported   # via local merge + branch delete
  pull_request_list:         unsupported # no PR concept in local-git; /dora-collect halts when this is the only source-control profile
  pull_request_get_comments: unsupported # no comment system in local-git
  pull_request_post_comment: unsupported # no comment system in local-git
  pull_request_get_check_status: unsupported # no CI in local-git
  pull_request_show:         unsupported # no PR concept in local-git
  pull_request_linked_work_items: unsupported # no PR linkage in local-git
  commit_history:            supported
  file_read_at_ref:          supported
operation_templates:
  pull_request_create:
    type: local-merge
    steps:
      - "git checkout {{target_branch}}"
      - "git merge --no-ff {{source_branch}} -m '{{merge_message}}'"
      - "git branch -d {{source_branch}}"
```

Skip to [Hand-off](#hand-off).

### 2. Dev-lead authenticates

Per the host:

- **Azure Repos**: PAT via `az login` (if Azure DevOps is also wired) OR PAT directly. Probe: `az repos list` or `git ls-remote <repo-url>`.
- **GitHub**: GitHub PAT or `gh auth status`. Probe: `gh repo view` (if `gh` is installed) or `curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user`.
- **Bitbucket**: App password (Cloud) or PAT (Server). Probe: `curl -u $BITBUCKET_USER:$BITBUCKET_TOKEN https://api.bitbucket.org/2.0/user` or equivalent for Server.
- **Other**: same as `/connect-devops-project` -- CPO names the auth method, dev-lead writes env-var REFERENCES only.

**Same secrets discipline as `/connect-devops-project`.** A credential VALUE never enters a prompt, a file, or a commit. The skill writes env-var NAMES to the profile and refuses to persist anything else.

### 3. Dev-lead explores

Read-only probes by default:

- List the repository the auth principal can see; confirm the CPO picks the right one if multiple are visible.
- Identify the default branch (typically `main` or `master`; some legacy repos use other names).
- List the most recent N branches to confirm the dev-lead can read remote refs.
- Identify the PR-creation API path and required body schema.
- Identify the PR-feedback API surface: how the host exposes reviewer comment threads (`pull_request_get_comments`), how new comments are posted (`pull_request_post_comment` -- always with `resolve_thread=false`; thread resolution is the human reviewer's call), and how CI / required-policy check status is queried (`pull_request_get_check_status`). Required for `/refine-pr`.
- Identify the PR-listing API surface: how the host enumerates PRs by date range and status (`pull_request_list`). Required for `/dora-collect` to acquire the integration-stream + intermediate-stream split used by all DORA-4 metrics. Probe a date-range query against the most recent week to confirm the response shape includes `id`, `title`, `status`, `createdDate`, `closedDate`, `sourceRefName`, `targetRefName`, `createdBy`.
- Identify the branch-protection rules on the default branch (required reviewers, status checks, force-push restrictions). These affect what the pipeline can and cannot do.

**Write probes require explicit CPO consent.** Surface:

```
A write probe would:
  1. Create a throwaway branch (e.g., strap-probe-<timestamp>) from the default branch.
  2. Push the branch to the remote.
  3. Delete the branch from the remote.
  4. Delete the local copy.

This validates branch_create + branch_push + branch_delete_remote + branch_delete_local end-to-end. The branch is empty
(no commits beyond what's on the default branch) and is removed before this skill exits.

Proceed with write probe? (yes / skip)
```

`yes` runs the probe. `skip` proceeds with read-only validation; capability declarations are then marked best-effort.

### 4. Dev-lead models

Build the connection profile from probe findings:

```yaml
host: <azure-repos | github | bitbucket | other>
host_url: <repo-url>
default_branch: <main | master | other>
auth:
  method: <pat | gh_cli | az_cli | app_password>
  user_env: <env-var-name>      # when relevant
  token_env: <env-var-name>     # references only
mapping:
  branch_prefix:
    feature: feature/
    task:    task/
    fix:     fix/
    chore:   chore/
  pr_template_path: <repo-relative path to PR template if present, else omitted>
branch_protection:
  default_branch:
    requires_reviewers: <count or null>
    requires_status_checks: <list of check names>
    forbids_force_push: <bool>
capabilities:
  ref_get:                       supported | unsupported   # Read a named ref + return objectId. Building block for verification (origin/main unchanged?) and optimistic-concurrency ops (REST branch delete with oldObjectId).
  branch_list:                   supported | unsupported
  branch_create:                 supported | unsupported
  branch_delete_local:           supported | unsupported   # local working copy delete (git branch -d)
  branch_delete_remote:          supported | unsupported   # remote-ref delete; on hosts with REST refs PATCH, use zero-sha update + ref_get-derived oldObjectId for optimistic concurrency
  branch_push:                   supported | unsupported
  pull_request_create:           supported | unsupported
  pull_request_get:              supported | unsupported
  pull_request_update:           supported | unsupported
  pull_request_close:            supported | unsupported
  pull_request_list:             supported | unsupported   # /dora-collect enumerates PRs by date-range + status for DORA-4 metrics; required for /dora-report
  pull_request_get_comments:     supported | unsupported   # /refine-pr reads reviewer comment threads via this op
  pull_request_post_comment:     supported | unsupported   # /refine-pr posts the round-of-fixes summary via this op
  pull_request_get_check_status: supported | unsupported   # /refine-pr reads CI / required-policy status via this op
  pull_request_show:             supported | unsupported   # OPTIONAL: /dora-collect uses to fetch per-PR thread data for the iteration-count size proxy; degrades gracefully when absent
  pull_request_linked_work_items: supported | unsupported  # OPTIONAL: /dora-collect uses to resolve PR <-> work-item links; degrades to parsing PR description tokens (Closes #<id>) when absent
  commit_history:                supported | unsupported
  file_read_at_ref:              supported | unsupported
operation_templates:
  pull_request_create:
    method: POST
    path: <host-relative path>
    body_template: |
      <Mustache-templated PR body with placeholders>
  pull_request_list:
    method: GET
    path: <host-relative path -- accepts {{status?}}, {{min_created_date?}}, {{max_created_date?}}, {{min_closed_date?}}, {{max_closed_date?}}, {{target_branch?}}, {{top?}} placeholders>
    # Returns array of PRs; each item includes id, title, status (active/completed/abandoned), creationDate, closedDate, sourceRefName, targetRefName, createdBy.
    # /dora-collect filters client-side to in-window PRs and splits by targetRefName == default_branch (integration stream) vs other (intermediate stream).
    # Pagination: host-dependent. When the host supports continuationToken or page parameters, document the iteration pattern here.
  pull_request_get_comments:
    method: GET
    path: <host-relative path -- includes {{pr_id}} placeholder>
    # Returns array of threads; each thread includes thread_id, status, comments[], and (when anchored) file_path + line.
    # Skill consumes with include_resolved=false filter applied client-side when host doesn't support server-side filtering.
  pull_request_post_comment:
    method: POST
    path: <host-relative path -- includes {{pr_id}} placeholder>
    body_template: |
      <Mustache-templated comment body; placeholders: {{body}}, {{thread_id?}} for replies, {{file_path?}} {{line?}} for anchored>
    # Skill always uses resolve_thread=false; thread resolution is owned by the human reviewer.
  pull_request_get_check_status:
    method: GET
    path: <host-relative path -- includes {{pr_id}} or {{commit_sha}} placeholder>
    # Returns array of checks; each check includes name, status (pending/success/failure), completed_at, and (when available) details_url.
  pull_request_show:                                                                                              # OPTIONAL
    method: GET
    path: <host-relative path -- includes {{pr_id}} placeholder>
    # Returns full PR detail including thread data when available (RefUpdate events, vote counts, discussion comments).
    # /dora-collect uses the RefUpdate event count as the no-API-cost PR-size proxy (iteration count -> Small/Medium/Large/XL buckets).
    # Skip declaring when the host doesn't surface thread/event data; /dora-collect's data_quality flags pr_threads_unavailable: true.
  pull_request_linked_work_items:                                                                                 # OPTIONAL
    method: GET
    path: <host-relative path -- includes {{pr_id}} placeholder>
    # Returns array of linked work-item ids. /dora-collect uses this for PR -> work-item linkage reconstruction.
    # Skip declaring when the host doesn't expose explicit PR/work-item linkage; /dora-collect falls back to parsing PR descriptions for Closes #<id> / Related: AB#<id> tokens.
  # ... one template per supported logical operation
```

**Same operation execution mechanism as `/connect-devops-project`:** generic HTTP/REST template executor. At runtime, the dev-lead reads the relevant `operation_templates.<op>` block, substitutes placeholders, and runs the request via `Bash`/`curl` or the appropriate CLI (`gh`, `az repos`). Deterministic over reasoned-on-the-fly.

#### Doctrine: REST/token-injected where both exist

When both a host CLI command (git, gh, az repos) and a host REST endpoint exist for the same logical operation, prefer the REST or token-injected variant. Adopters running STRAP in a Claude Code tool-invocation context cannot satisfy credential-helper or auth-prompt interactivity; reasoned-on-the-fly fallback chains add latency and obscure root cause. The REST/token-injected pattern is canonical for any host whose CLI auth flow can stall on interactive prompts.

This applies most strongly to `ref_get`, `branch_delete_remote`, and `branch_push` on hosts that pair a REST refs API with a credential-helper-driven git CLI. See [`onboarding-design.md`](../../strap/contexts/onboarding-design.md) doctrine paragraph for the broader rule.

#### Host-specific template guidance

**Azure Repos** -- prescribe these `operation_templates` entries at Step 4 model time (token from `az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798`):

```yaml
operation_templates:
  ref_get:
    type: rest
    method: GET
    path: /{{organization}}/{{project}}/_apis/git/repositories/{{repo_id}}/refs?filter=heads/{{branch_name}}&api-version=7.1
    # Response: { "value": [{ "name": "refs/heads/<branch>", "objectId": "<sha>" }, ... ] }
    # Empty value array means the ref does not exist on the remote.
  branch_delete_remote:
    type: rest-recipe
    steps:
      - op: ref_get
        capture: { objectId: value[0].objectId }
      - method: POST
        path: /{{organization}}/{{project}}/_apis/git/repositories/{{repo_id}}/refs?api-version=7.1
        body: |
          [{
            "name": "refs/heads/{{branch_name}}",
            "oldObjectId": "{{captured.objectId}}",
            "newObjectId": "0000000000000000000000000000000000000000"
          }]
    # POST is correct (not PATCH) per ADO REST refs API; the zero-sha newObjectId signals delete.
    # oldObjectId rejects stale operations with staleOldObjectId -- optimistic concurrency for free.
  branch_push:
    type: cli
    command: 'git -c http.extraHeader="Authorization: Bearer {{token}}" -C {{repo_path}} push -u origin {{branch_name}}'
    # Pure REST cannot replace push (git uploads pack data). The http.extraHeader pattern injects the bearer token, bypassing the credential helper entirely.
```

**Note for re-runs against Azure Repos profiles persisted before the v2.4-polish (commit landing this section)**: existing profiles carry `branch_push: { type: cli, command: 'git push -u origin {{branch_name}}' }` and lack `ref_get` + `branch_delete_remote` entries. Surface this during re-run and offer to regenerate the affected templates while preserving everything else.

**GitHub** -- `gh` CLI is the canonical surface; its OAuth flow does not stall on credential-helper prompts the same way. Use `gh api` for `ref_get` (`gh api repos/{owner}/{repo}/git/refs/heads/{branch}`), `gh api -X DELETE` for `branch_delete_remote`, and `git push` for `branch_push` (relies on `gh auth setup-git`). Re-evaluate per the doctrine if a GitHub adopter hits credential-helper stalls in a non-interactive context.

**Bitbucket** -- App-password auth is interactive-friendly via `curl -u "{{user}}:{{token}}"`; `git push` via the same `curl -u` HTTP credential injection works without credential helper. Use REST endpoints for `ref_get` and `branch_delete_remote` (Bitbucket REST API v2.0); use git CLI with embedded auth in remote URL or `http.extraHeader` for `branch_push`.

**Local Git** -- `branch_delete_remote` and `branch_push` are unsupported (no remote); `ref_get` uses `git rev-parse refs/heads/{{branch_name}}` against the local repo.

#### Starter operation_templates copy (v2.5 #39698)

Once the host is named at Step 1, the dev-lead copies the matching starter file from `.claude/strap/templates/connection-templates/<host>.yaml` into the draft `code-connection.yaml`'s `operation_templates:` block before the validation gate fires. Mapping:

| Host (Step 1 selection) | Starter file (repo-operations subset) |
|---|---|
| Azure Repos | `azure-devops.yaml` (ref_get, branch_*, pull_request_*) |
| GitHub | `github.yaml` (ref_get, branch_*, pull_request_*, pipeline_*) |
| Bitbucket | `bitbucket.yaml` (ref_get, branch_*, pull_request_*, pipeline_*) |
| Local Git | inline operation_templates (no remote ops apply; `ref_get` only via local `git rev-parse`) |
| Other | empty `operation_templates:` block; CPO authors entries during the validation loop |

The starter provides ~8-10 pre-authored repo operations per host. The adopter typically only revises `{{token}}` / `{{user}}` env-var placeholder names and host-specific path fragments. The validation block at Step 5 surfaces the populated templates inline so the CPO can spot mismatches before persistence.

#### Auth recipes per host (v2.5 #39698)

Concentrated authentication setup per host. The connect skill walks the relevant block at Step 2 (dev-lead authenticates) and persists `auth:` block references in `code-connection.yaml`. Tokens never appear in YAML; only env-var names.

**Azure Repos.** Bearer token from `az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798` (the ADO resource UUID -- same as work-items). Persists as `auth.method: pat` with `auth.token_env: ADO_PAT`. Required scopes: vso.code (read/write). The `http.extraHeader` git push pattern (see Azure Repos template guidance above) injects the bearer token without relying on the credential helper -- canonical for non-interactive Claude Code tool contexts.

**GitHub.** Two options:
- **Fine-grained PAT** (https://github.com/settings/tokens?type=beta): scope to specific repos; required permissions are Contents: write, Pull requests: write, Actions: read (for pipeline probe -- v2.5 #39703). Persists as `auth.method: pat` with `auth.token_env: GITHUB_TOKEN`.
- **Classic PAT** (https://github.com/settings/tokens): scope is `repo` (broad).
- **`gh` CLI session** (`gh auth login`): handles token storage transparently. Most `github.yaml` operations use `gh` CLI patterns; REST is the fallback. `gh auth setup-git` configures git's credential helper for `git push` -- required for the `branch_push` CLI pattern in `github.yaml`.

**Bitbucket Cloud.** App password from https://bitbucket.org/account/settings/app-passwords/. Persists as `auth.method: app_password` with `auth.user_env: BITBUCKET_USER` and `auth.token_env: BITBUCKET_APP_PASSWORD`. Required scopes per app password: Repositories: read/write, Pull requests: read/write. The `git push` pattern uses `http.extraHeader` Basic-auth injection to bypass credential helper.

**Local Git.** No remote auth. `branch_push` / `branch_delete_remote` are unsupported (no remote); the dev-lead manages refs locally.

**Other (unknown host).** CPO names the env var conventions at Step 2.

For all hosts: credentials never appear in any tracked file. The connect skill validates env-var resolution at Step 2 via a no-op probe (e.g., `gh auth status` for GitHub, `az repos list` for ADO, `curl /repositories/{workspace}` for Bitbucket).

### 5. Dev-lead validates with the CPO and persists

Surface the model to the CPO:

```
Connection profile draft:

  Host:           <host>
  Repo URL:       <host_url>
  Default branch: <default_branch>
  Auth:           <method> via env vars <user_env>, <token_env>

  Branch-protection on default:
    Requires reviewers:      <count or none>
    Required status checks:  <list or none>
    Forbids force-push:      <bool>

  Capabilities:
    Supported:   <list>
    Unsupported: <list>  (impact: <one-line consequence per gap>)

  Branch prefixes:
    feature/    task/    fix/    chore/

Confirm? (yes / adjust <field> / explain <capability>)
```

`yes` writes the profile to `.claude/strap/state/code-connection.yaml` with `validated_at` and `validated_by` fields plus `schema_version: "2.4"` as the first key. `adjust <field>` reopens that field. `explain <capability>` walks through what a gap means.

On polyrepo umbrellas, persist also includes the `sub_repos:` map with the primary's entry seeded (empty mapping `{}` -- explicit inheritance from the umbrella defaults the primary just configured). Step 6 walks the remaining sub-repos and extends the map. On single-repo umbrellas, the `sub_repos:` map is omitted entirely.

After persist of the primary: the satisfied gate does NOT release yet on polyrepo umbrellas -- the pipeline needs every sub-repo wired before PRs can be opened cleanly. On single-repo umbrellas, the gate releases here.

### 6. Per-sub-repo wire-up (polyrepo umbrellas only)

For each non-primary sub-repo in `project-profile.md`'s `Sub-repos` section, run a focused mini-flow:

1. **Present the sub-repo's metadata.** Show slug, path, role, primary_language, active_domains from the Sub-repos entry.
2. **`AskUserQuestion`: "Configure source control for `<slug>`:"** Options (no previews; nominal-label decision):
   - **`Inherit from primary` (Recommended for most polyrepo umbrellas):** sub-repo lives at the same host + org + default_branch + auth as the primary. The sub_repos: map entry is `<slug>: {}` (empty mapping = explicit inheritance).
   - **`Customize host or organization`:** sub-repo lives on a different host (e.g., the primary is on GitHub and this sub-repo is on Azure Repos) or in a different organization. The dev-lead runs a scoped five-step discovery flow against the sub-repo (probe + model + validate) and captures the per-sub-repo overrides.
   - **`Customize auth only`:** same host + org + branch model, but different credentials (e.g., a different PAT for a sub-repo with stricter access). Capture the auth override; everything else inherits.
   - **`Customize branch model`:** same host + org + auth, but different `default_branch` or `branch_patterns`. Capture the branch overrides; everything else inherits.
3. **Branch protection per sub-repo.** `AskUserQuestion`: "Branch protection policy for `<slug>`:"

   The `(Recommended)` marker is rendered dynamically based on the sub-repo's `Depends on` field in `project-profile.md`'s Sub-repos section, read just before the prompt renders. `All-must-merge` is never the dynamic recommendation -- it requires a deployment-target lockstep relationship that can't be derived from `Depends on` alone; the CPO opts in explicitly.

   **When the sub-repo's `Depends on` field is empty / absent** (leaf in the dependency graph):

   - **`Independent` (Recommended):** PRs in this sub-repo merge on their own timeline; no cross-PR coordination. Leaf sub-repos have no upstream to wait on, so independent is the natural default.
   - **`Ordered`:** would have no effect for a leaf (no upstream PR to gate against). Pick only if you anticipate adding a dependency later and want the policy in place now.
   - **`All-must-merge`:** the PR cluster from a cross-sub-repo Feature merges as a group, or rolls back as a group. Pick when this sub-repo shares a deployment target with siblings and must ship in lockstep.

   **When the sub-repo's `Depends on` field has entries** (downstream node consuming from upstream sub-repos):

   - **`Independent`:** PRs in this sub-repo merge on their own timeline; no cross-PR coordination. Pick when sub-repos are developed in lockstep without published-artifact handoff (the downstream branch is built against the upstream branch in the working tree, not against the upstream's merged-to-default state). Less common in production polyrepo umbrellas.
   - **`Ordered` (Recommended):** PRs in this sub-repo are blocked until the upstream PR (the one this sub-repo `Depends on`) merges. The natural recommendation when this sub-repo consumes a published artifact from another sub-repo (library import, contract dependency, version-pin update). `/refine-pr` surfaces the gating state via a blocking-status comment on the downstream PR; the human reviewer holds discipline.
   - **`All-must-merge`:** the PR cluster merges atomically. Pick when this sub-repo shares a deployment target with siblings and must ship in lockstep. Distinct from `Ordered` -- atomicity is stronger than sequencing.

   **Recommendation surface**: when the prompt renders, cite the source of the dynamic recommendation inline so the CPO sees the reasoning -- e.g., `Recommended: Ordered (this sub-repo's Depends on lists yp-paceguilib; downstream PRs typically wait for upstream merges)`.
4. **Persist the sub_repos: map entry** for this sub-repo with the captured overrides + branch_protection. Inherited fields are omitted (empty mapping when fully inherited; partial mapping when some fields override).
5. **Loop to the next sub-repo.** When all non-primary sub-repos are wired, the satisfied gate releases. The pipeline can now open PRs across the umbrella.

If the CPO declares `Cancel` mid-loop, the partial sub_repos: map persists with explicit `validated_at: <ts>` per-entry markers; remaining sub-repos are flagged as "not configured" (missing keys in the map -- contrast with explicit inheritance which uses empty mapping). A subsequent `/connect-code-repo` invocation picks up where the partial wire-up left off.

#### Persistence: schema_version + sub_repos: map encoding

The persisted `code-connection.yaml` carries:

- **`schema_version: "2.4"`** as the first key. Written by every successful run regardless of umbrella mode -- single-repo profiles also stamp this field so `/strap-upgrade` can detect that they are at the current schema version.
- **Top-level umbrella defaults** (host, organization, default_branch, branch_patterns, auth, capabilities, operation_templates) seeded from the primary sub-repo (polyrepo) or the only repo (single-repo).
- **`sub_repos:` map** (polyrepo umbrellas only; omitted on single-repo). Each map entry is keyed by the sub-repo's slug:
  - **Empty mapping `{}`**: explicit inheritance from the umbrella defaults. The CPO confirmed at the Step 6 prompt that this sub-repo inherits everything.
  - **Partial mapping**: declares only the fields that override the umbrella defaults (e.g., a different `auth` block or a different `default_branch`). Omitted fields fall through.
  - **branch_protection sub-field** (always present per entry): `{policy: independent}`, `{policy: ordered}`, or `{policy: all-must-merge}` per the Step 6 prompt.
  - **`validated_at: <ISO-8601 timestamp>`** + **`validated_by: <cpo-handle>`** per entry, recording when that sub-repo's configuration was last confirmed. Empty mappings carry these as well (inheritance is still a confirmed choice).
- **Inline comment** above the `sub_repos:` map explaining the empty-mapping convention so adopters reading the file directly understand the difference between explicit inheritance and not-configured.

#### Re-run safety

When `/connect-code-repo` is invoked on an umbrella where `code-connection.yaml` already exists with `schema_version: "2.4"`:

1. **Read the existing profile** before prompting anything. Surface the current state to the CPO: "Found existing connection profile (validated at `<ts>` by `<cpo-handle>`). Umbrella host: `<host>`. Sub-repos configured: `<list with per-entry validated_at>`. Sub-repos in project-profile.md but not in the connection profile: `<list>` (will configure these now)."
2. **Three CPO options** via `AskUserQuestion`:
   - **`Configure missing sub-repos only` (Recommended when sub_repos: map is partial):** skip Steps 1-5 (primary already configured); skip Step 6 entries already in the map with `validated_at`; run Step 6 only for sub-repos missing from the map.
   - **`Reconfigure a specific sub-repo`:** CPO names the sub-repo; the dev-lead runs Step 6's mini-flow for just that one entry (overwriting the existing entry with new `validated_at` on completion). Other entries untouched.
   - **`Reconfigure entirely` (uncommon; for major host changes):** confirm with CPO that the existing profile should be archived (rename to `code-connection.<ts>.yaml.bak`) and start fresh from Step 0.
3. **Preservation rule**: any entry not touched by the current run keeps its existing `validated_at` and `validated_by` -- those are creation/validation-time facts and survive subsequent runs untouched.
4. **Project-profile.md drift detection**: when sub-repos exist in `code-connection.yaml`'s `sub_repos:` map but no longer appear in `project-profile.md`'s `Sub-repos` section (sub-repo was removed at /strap-refresh time), surface the orphan entries to the CPO with `AskUserQuestion`: `Remove from profile` / `Keep (sub-repo will be restored later)` / `Cancel`.

The re-run path is the typical interaction for evolving polyrepo umbrellas -- adding a sub-repo, swapping auth, tightening branch protection. The skill stays idempotent: a re-run with no changes to project-profile.md and no CPO edits produces no diff on `code-connection.yaml` other than refreshed `validated_at` timestamps on touched entries.

### Hand-off

Present the CPO with a structured summary (text block):

```
/connect-code-repo complete.

Profile persisted at: .claude/strap/state/code-connection.yaml
Host:                 <host>
Default branch:       <default_branch>
Capabilities:         <N supported, M unsupported>

Branch-protection observations:
  - <required reviewer count, status checks, etc.>

Capability gaps with workflow impact:
  - <gap>: <which skills degrade and how>

The pipeline now has everything it needs to:
  - Open pull requests (via this profile)
  - Create / push / delete branches
  - Read commits and files at any ref
```

Then surface the next-step gate via `AskUserQuestion`. The available options depend on whether the work-tracking profile already exists -- check `.claude/strap/state/devops-connection.yaml` before rendering.

**If `devops-connection.yaml` does NOT exist** (typical case -- code-repo wired first per the default `/strap-in` hand-off recommendation):

```yaml
header: "Next step"
question: "What's next?"
options:
  - label: "Connect work tracking (Recommended)"
    description: "Run /connect-devops-project to wire up where work items live (Azure DevOps Boards / Jira / GitHub Issues / Local strap-agile). Natural next step now that source control is in place."
  - label: "Pause"
    description: "Stop here. The project is in operational mode; the pipeline can open PRs. /connect-devops-project can run later when you want to file work items."
```

**If `devops-connection.yaml` DOES exist** (work-tracking was wired first):

```yaml
header: "Next step"
question: "What's next?"
options:
  - label: "Pause (Recommended)"
    description: "Stop here. Both connection profiles are in place. The pipeline is fully wired and ready for /file-bugs, /new-requirement, /create-spec, /decompose-feature, /execute-sprint."
  - label: "File the discovery bugs now"
    description: "Run /file-bugs against the production-bug list captured in project-profile.md during /strap-in synthesis. Files them as Bug work items in the connected DevOps host."
```

Code-immutability invariant releases (per [`onboarding-design.md`](../../strap/contexts/onboarding-design.md#code-immutability-invariant)) once this skill's satisfied gate clears -- the project transitions from onboarding mode to operational mode and the normal pipeline rules apply from this point.

## Outputs

- `.claude/strap/state/code-connection.yaml` -- per-project connection profile. Source-controlled. **Carries env-var REFERENCES, never credential values.**
- For Local Git mode (when `git init` ran): a `.git/` directory with `main` branch and an initial commit.
- Updated `.claude/strap/contexts/project-profile.md` -- the `## Identity` section gets the repository URL filled in.

## Quality gates

The skill is successful when all of the following hold:

- Git is installed (`git --version` succeeds).
- A connection profile exists at `.claude/strap/state/code-connection.yaml` with all required fields.
- The profile carries env-var REFERENCES only -- no credential value anywhere in the file.
- For remote mode: auth probe passed at validation; at least one read-probe succeeded (`git ls-remote`, `gh repo view`, equivalent).
- For Local Git: `main` branch exists and has at least one commit.
- Capability declarations match probe evidence.
- The CPO confirmed the profile at the validation gate.
- The code-immutability invariant releases cleanly at hand-off (no orphaned state from `/strap-in` or `/strap-refresh`).

The skill fails -- and reports clearly -- when:

- `git --version` fails. Surface install instructions; exit.
- Auth probe fails irreparably. Surface the underlying error; loop back to auth.
- For remote: `git ls-remote` cannot reach the host. Surface as a network / permissions failure with a one-line remediation hint.
- `pull_request_create` cannot be modeled (the host doesn't expose it; the repo is read-only). Surface and ask the CPO whether to fall back to Local Git or pause.
- The CPO declines at the validation gate. Write no profile; exit cleanly.

## Failure handling

- **Pre-flight finds scaffold sentinel in `project-profile.md`**: redirect to `/strap-in`.
- **CPO pastes a credential into a prompt**: same response as `/connect-devops-project`. Refuse to echo, persist, or commit. Instruct the CPO to set the env var locally.
- **`git init` declined**: for Local Git, exit without writing a profile (the satisfied gate is unmet). The CPO can re-invoke after initializing manually.
- **Default branch is `master` (legacy)**: surface and ask the CPO whether to keep `master` or rename to `main`. The profile records whatever the CPO chooses; the pipeline reads `default_branch` from the profile.
- **Write probe creates a branch but cannot delete it**: surface the orphan loudly; do NOT proceed to persist as if the probe passed.
- **Branch-protection rules block the write probe** (e.g., direct push to default branch is forbidden, which is correct): treat as evidence that the host enforces protection AND mark `branch_push` as `supported_to_non_default_only` or similar. Surface to the CPO and adjust the capability declaration accordingly.

## References

- [`onboarding-design.md`](../../strap/contexts/onboarding-design.md) -- connection-discovery model, five-step flow, profile shape, secrets discipline.
- [`../connect-devops-project/SKILL.md`](../connect-devops-project/SKILL.md) -- the paired skill for work-tracking wire-up.
- [`../strap-in/SKILL.md`](../strap-in/SKILL.md) -- the upstream skill whose hand-off points here.
- `.claude/strap/templates/connection-templates/<host>.yaml` -- per-host accelerator templates. **Optional optimization**: if a template for the chosen host is present, the dev-lead loads it at Step 2 and validates it against the live host. If absent, the dev-lead runs the five-step flow from scratch. The skill works identically in either case.
- [`CLAUDE.md`](../../../CLAUDE.md) -- super-pair identity, persistence stack, secrets discipline.
