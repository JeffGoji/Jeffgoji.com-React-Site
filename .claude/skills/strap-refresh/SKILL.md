---
name: /strap-refresh
description: Incremental re-discovery for an already-onboarded project. The dev-lead reads the existing persistence stack as priors, runs a shallow scan against the current codebase, detects diffs, surfaces them for CPO approval, then dispatches only the specialists whose domains actually changed (or newly appeared). The re-run companion to /strap-in. Supports --full to redo discovery from scratch when the priors are no longer trustworthy.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Skill, Task, AskUserQuestion
---

# /strap-refresh

## Purpose

A project that has been through `/strap-in` accumulates a curated persistence stack -- `project-profile.md` is populated, per-agent memory files carry tradecraft, per-agent rules carry guardrails. Over weeks and months that stack ages: the team adopts new tech, conventions evolve, sensitivities surface, mockup directories appear, integrations come online. The persistence stack drifts from the codebase.

`/strap-refresh` reconciles. It:

- reads the existing persistence stack as **priors** (project-profile + per-agent memory and rules),
- runs the same shallow-scope scan `/strap-in` runs,
- **detects diffs** between priors and current state,
- **surfaces those diffs for CPO approval** before any update happens (priors are CPO-curated; we don't overwrite them silently),
- dispatches only the specialists whose domains actually changed or newly appeared,
- synthesizes findings into the persistence stack as targeted edits, not whole-file rewrites.

The skill is incremental by default. The `--full` flag redoes discovery from scratch as if `/strap-in` were running again, but against an already-onboarded project (no scaffold sentinel restoration; existing rules and memory are read as priors then potentially rewritten).

Invoke when:

- The project shape has visibly changed (a new framework adopted, a major directory introduced, CI moved to a new host, a fresh team convention).
- A specialist's memory file is stale and producing bad suggestions.
- `/strap-in` redirects here on a re-run.

Do NOT invoke when:

- The project has never been onboarded. The skill detects this in [Pre-flight](#pre-flight-must-be-onboarded-check) and redirects to `/strap-in`.

## Owner

The dev-lead. `/strap-refresh` runs in the top-level Claude Code session that IS the dev-lead per `CLAUDE.md`. Same dispatch model as `/strap-in` -- `Task` / `Agent` for serial work, `CreateTeam` for parallel deep-dives.

## Inputs

- `$ARGUMENTS` -- optional. Recognized values:
  - **empty** (default): incremental refresh.
  - `--full`: redo discovery from scratch. Treat priors as informational only; re-dispatch every relevant specialist regardless of whether their domain changed. Useful when the priors are known-bad (e.g., after a large refactor invalidated multiple memory files).
- The current state of `.claude/strap/contexts/project-profile.md` (must exist and be past its scaffold state).
- The current state of `.claude/strap/memory/agents/<name>.md` files (15 of them; some empty, some populated -- the populated ones identify which specialists were active in past runs).
- The current state of `.claude/strap/rules/agents/<name>.md` files.
- The current state of `.claude/strap/state/usage.yaml` -- pulls budget defaults silently.
- The CPO -- interactively available. The approval gate ([Section 6](#6-diff-summary-and-approval-gate)) requires a CPO response.

## Workflow

Ten sections in order: Welcome (always first), Pre-flight (state check that may redirect or fail), then the seven re-discovery sections that parallel `/strap-in`'s structure, and a closing project-docs production phase (Section 9) that applies surgical updates to the human-facing orientation documents based on detected drift before hand-off (Section 10). The Welcome renders unconditionally as the first interaction so the CPO is anchored before any state inspection. Pre-flight runs second and may exit the skill (redirect to `/strap-in` on a not-yet-onboarded project; fail on install-incomplete state).

### 1. Welcome (re-run flavored)

Identity-anchored greeting acknowledging that this is not a fresh introduction. Markdown emphasis only -- no Bash banners, no ASCII art, no color tables. Renders unconditionally as the first interaction.

Render exactly (text block, not interactive):

```
Welcome back. I am the dev-lead. This project has been onboarded before -- the persistence stack
already carries what we captured together previously.

Here is what we will do today:

  1. I'll verify the project is in fact onboarded (pre-flight).
  2. I'll resolve refresh mode -- incremental (default) or full (--full to redo from scratch).
  3. I'll read the existing persistence stack as priors, then run a shallow scan against the current
     codebase.
  4. I'll detect diffs between the priors and the current state.
  5. I'll surface those diffs for your approval BEFORE dispatching any specialist or updating any
     curated content.
  6. After your approval, I'll dispatch only the specialists whose domains changed or newly appeared,
     then synthesize their findings as targeted edits to the persistence stack.
```

Then surface the Ready gate via `AskUserQuestion` (NOT a free-text prompt):

```yaml
header: "Ready to begin"
question: "Ready to refresh?"
options:
  - label: "Yes (Recommended)"
    description: "Proceed to pre-flight, then mode resolution."
  - label: "Pause"
    description: "Exit cleanly. No state is written; you can re-invoke /strap-refresh later."
```

Handle the response:

- `Yes` -- proceed to Section 2 (pre-flight).
- `Pause` -- exit cleanly.
- Free-text "Other" -- interpret intent and respond accordingly.

### 2. Pre-flight: must-be-onboarded check

Now that the welcome has rendered, verify the project is in fact onboarded. Inverse of `/strap-in`'s pre-flight: this skill REQUIRES that `/strap-in` has run and the scaffold sentinel has been stripped.

| State of `project-profile.md` | Classification | Action |
|---|---|---|
| File missing entirely | Install incomplete | Fail with structured message; ask CPO to run install + `/strap-in` |
| File present, sentinel at top | Not yet onboarded (scaffold) | Render the redirect message and exit |
| File present, sentinel absent, file empty or whitespace-only | Install incomplete (corrupted) | Fail with structured message |
| File present, sentinel absent, file has substantive content | Onboarded -- proceed | Continue to Section 3 |

The redirect-to-`/strap-in` message:

```
This project has not been onboarded yet -- project-profile.md still carries the scaffold sentinel.

Run /strap-in first. /strap-refresh is for already-onboarded projects only.
```

#### Polyrepo-mode detection (existing-profile override)

After the must-be-onboarded check clears, determine whether this is a polyrepo install. Unlike `/strap-in`, refresh does NOT re-run depth-1 detection -- the priors are authoritative. Polyrepo mode is detected from the existing `Sub-repos` section in `project-profile.md`:

- **`Sub-repos` H2 section present with one or more H3 entries** -> polyrepo mode. Read each entry; collect the sub-repo paths.
- **`Sub-repos` H2 section present but empty (no H3 entries)** -> single-project mode. The section is the scaffold form left from a non-polyrepo `/strap-in`; treat as absent.
- **`Sub-repos` H2 section absent entirely** -> single-project mode. Project was onboarded as single-repo.

Polyrepo mode set this way carries forward through all subsequent sections (priors, shallow scan, diff detection, dispatch, synthesis). No CPO prompt for the polyrepo path itself -- the prior `/strap-in` already captured the CPO's choice and recorded it in `Sub-repos`. The CPO sees the polyrepo-mode confirmation as part of the Section 3 inline narration:

```
Mode: incremental (default)
Polyrepo: <N> sub-repos from prior /strap-in -- shared-lib, web-frontend, api-server
```

**Sub-repo disk-state cross-check.** As a sanity gate, verify each sub-repo path declared in `Sub-repos` still exists on disk and still has a `.git/` directory. Discrepancies surface in Section 5 as polyrepo-structural diffs:

- **Sub-repo path missing on disk**: the sub-repo was deleted or renamed since the last refresh. Flagged for diff surfacing.
- **New depth-1 `.git/` subdirectory not declared in `Sub-repos`**: a new sub-repo was added since the last refresh. Flagged for diff surfacing.

Both cases are surfaced to the CPO at Section 6 with explicit handling options (per the v2.4 schema): for added sub-repos -- `Add to Sub-repos` (runs the per-sub-repo schema interview from `/strap-in` Section 8) / `Ignore (don't track)`. For removed sub-repos -- `Remove from Sub-repos` / `Keep (sub-repo will be restored later)` / `Mark dormant` (preserves the H3 entry but adds a `Status: dormant` field at the top; parallel to the Domains-section dormant convention; active routing skills skip dormant sub-repos). Do not silently update `Sub-repos` at this stage.

**v2.4 schema sentinel awareness.** Verify the `Sub-repos` section opens with the `<!-- strap-schema: sub-repos-v2.4 -->` sentinel (or later). When the sentinel is missing (legacy v2.3 prose form), this means /strap-upgrade has not yet run the schema migration. Surface to the CPO as a Section 6 diff: "Sub-repos section is in v2.3 prose form. Run `/strap-upgrade` to migrate to v2.4 schema before this refresh proceeds with field updates." Stop the refresh after Section 6 if the CPO declines to migrate -- structural drift detection (added/removed sub-repos) still applies, but per-field refresh (T3.2 scope) requires the v2.4 schema.

### 3. Mode resolution

Determine whether this is an incremental refresh (default) or a full redo (`--full`).

- `$ARGUMENTS` empty -> incremental mode. The default.
- `$ARGUMENTS == "--full"` -> full mode. Re-dispatch every relevant specialist; treat priors as informational only when synthesizing.
- `$ARGUMENTS` is anything else -> reject with usage message; exit.

Inline confirmation to the CPO:

```
Mode: incremental    (default; only re-dispatch specialists whose domain changed)
Mode: full           (--full; re-dispatch every relevant specialist regardless of domain change)
```

Budgets pull silently from `.claude/strap/memory/MEMORY.md` -- per [`budget-discipline.md`](../../strap/contexts/budget-discipline.md), the CPO confirms budgets once at `/strap-in` time and they apply to all subsequent workflows. If `usage.yaml` carries `budgets.strap-refresh`, use those; otherwise pull the defaults (200K per-agent, 1M session aggregate) from `budget-discipline.md` and write them to `usage.yaml` silently. The CPO sees a budget prompt only if MEMORY.md is corrupted or missing.

**Polyrepo budget projection.** When Section 2 detected polyrepo mode with `N >= 2` sub-repos, apply the additive polyrepo aggregation from [`budget-discipline.md`](../../strap/contexts/budget-discipline.md#polyrepo-aggregation): `projected_aggregate = session_aggregate + (N - 1) * per_sub_repo_increment` where `per_sub_repo_increment = 200K` for `/strap-refresh` (smaller than `/strap-in`'s 300K because refresh shallow-scans against priors, not from scratch). Narrate the projection silently in `usage.yaml`; surface to the CPO only if the projected aggregate exceeds the `usage.yaml` `budgets.strap-refresh.session_aggregate` value (which would mean refresh is structurally over-budget against the CPO's stored ceiling). In that case, prompt:

```
Polyrepo refresh budget projection (<N> sub-repos):
  projection = <base> + (<N> - 1) * 200K = <projected>
  current session_aggregate ceiling = <stored>
  projection exceeds ceiling -- refresh would likely checkpoint early.

Adjust ceiling now via /revise-token-budget, or proceed and accept early checkpoints?
```

The CPO either adjusts (re-invoke `/revise-token-budget` from outside) or accepts the projected early-checkpoint risk.

Initialize the workflow instance in `usage.yaml`:

- `session.workflow: strap-refresh`
- `session.workflow_instance: <ISO-date>-refresh-<mode>`
- `session.started_at: <ISO-timestamp>`
- `session.specialists_used: 0`
- Reset `agents.<name>.used_in_current` to 0 for every agent (per-agent budgets are per-workflow-instance).

### 4. Read priors + initial shallow discovery

Two reads happen here. The priors first, the current state second.

**Read the priors.**

- `.claude/strap/contexts/project-profile.md` -- the canonical record of what the project IS as of the last run.
- `.claude/strap/memory/agents/<name>.md` for every agent in the canonical 15. Note which files are populated (specialist was active before) vs empty (specialist was dormant).
- `.claude/strap/rules/agents/<name>.md` for every agent. Note which carry curated additions beyond the starter content.
- **`Sub-repos` H2 section in `project-profile.md`** (when polyrepo mode was detected in Section 2). Each H3 entry's 7 fields (Path, Purpose, Stack, Conventions, Source-of-truth, Runtime dependencies, Activated) are priors for that sub-repo. Treat them as authoritative for what the sub-repo WAS at last refresh; the shallow scan below detects what's drifted.

The set of populated memory files defines the **prior active set** -- the specialists who deep-dove the codebase in past runs. In polyrepo mode, per-sub-repo specialist notes within each memory file (added by `/strap-in` Section 8) are additional priors that scope each specialist's claims to specific sub-repos.

**Run the same shallow scan `/strap-in` runs.**

Targets per [`/strap-in` Section 4](../strap-in/SKILL.md#4-initial-discovery-shallow):

- Top-level manifest files.
- File-tree shape (one level at root; one more level into source dirs).
- Root documentation.
- Recent git activity (`git log --oneline -50`).
- CI config.
- Mockup directories.
- IaC markers.
- E2E markers.

Narration is hybrid: inline as findings land, with a structured synthesis at section end. Frame findings in terms of the priors:

> "Reading `package.json`... Angular 19, NgRx -- consistent with the prior profile. New dependency: `@aws-sdk/client-s3` -- not in the prior memory of integration-specialist. Flagging for diff detection."

NOT in scope:

- Full-codebase reads.
- Deep recursion past depth two.
- Anything that pushes dev-lead consumption past ~30K tokens (single-repo) or ~30K + 15K * (N-1) tokens (polyrepo).

#### Polyrepo per-sub-repo shallow scan (when polyrepo mode is in effect)

When Section 2 detected polyrepo mode, the shallow scan above runs **once per declared sub-repo** instead of once at the install root. Same mechanics as `/strap-in` Section 4 polyrepo subsection, but with prior awareness:

1. **Iterate sub-repos in `Sub-repos`-declared order** (matching how `/strap-in` synthesized them, so per-sub-repo narration is reproducible).
2. **For each declared sub-repo**, verify the path still exists (Section 2's disk-state cross-check should have already flagged missing paths; this is the structural verification before per-sub-repo scan). If missing, skip its shallow scan and carry the structural diff forward to Section 5.
3. **For each present sub-repo**, run the shallow-scan targets scoped to that sub-repo's directory. Frame findings against the **prior `Sub-repos` entry for that sub-repo** -- known stack, known conventions, known runtime deps.
4. **Per-sub-repo narration**: "Re-scanning `shared-lib`... C#/.NET 8 confirmed, no stack drift. Re-scanning `web-frontend`... Angular 19 confirmed, but new dependency `@aws-sdk/client-s3` -- not in the prior Sub-repos entry. Flagging for diff detection. Re-scanning `api-server`... no drift."
5. **New sub-repo handling**: if Section 2's cross-check found `.git/` subdirectories at depth-1 NOT declared in `Sub-repos`, run a fresh-style shallow scan (no priors) against each new sub-repo. Findings carry forward as a sub-repo-add diff in Section 5.

**Manifest cross-reference pass against priors.** Same Stage-1 mechanism as `/strap-in` Section 4: detect manifest references between sub-repos. Compare to the prior `Runtime dependencies` field per `Sub-repos` entry. Diffs:

- **New cross-sub-repo reference**: manifest now declares a sibling not in the prior `Runtime dependencies`.
- **Removed cross-sub-repo reference**: prior `Runtime dependencies` declared a sibling no longer referenced in any manifest.

Both surface as runtime-dep diffs in Section 5; the Stage 3 CPO confirmation in synthesis decides whether to update the field.

### 5. Diff detection and relevance recomputation

Compare priors against current state. Produce a structured diff list.

**Categories of diff worth surfacing:**

- **Stack diffs**: a framework, language, or major dependency appeared or disappeared (Redis introduced; Prisma replaced TypeORM; Angular major-version-bumped).
- **Architecture diffs**: a new top-level directory; a domain reorganization; service split or merge.
- **CI diffs**: new pipeline host; new build stages; new deployment targets.
- **Mockup-presence diffs**: mockups directory appeared or disappeared.
- **Integration surface diffs**: external SDKs added or removed.
- **IaC diffs**: IaC tooling adopted, replaced, or removed.
- **Convention diffs**: visible from recent git activity (branch naming, commit-message format).
- **Sensitivity diffs**: secrets-file footprint, PHI/PCI/PII markers, regulated-data classes.
- **Project-docs drift**: any of the above diffs that change the prose surface of `PROJECT.md`, `ARCHITECTURE.md`, or `STACK.md` -- a stack diff implies a `STACK.md` section is stale; an architecture diff implies an `ARCHITECTURE.md` section is stale; an identity / audience / repo-layout shift implies a `PROJECT.md` section is stale. Project-docs drift is derivative -- it never stands alone -- but it is tracked separately because the closing phase (Section 9) needs an explicit per-doc per-section flag list, not just "stack changed."

**Polyrepo-specific diff categories** (when polyrepo mode is in effect):

- **Sub-repo structural diffs**: a sub-repo declared in `Sub-repos` is missing on disk (removed); a depth-1 `.git/` subdirectory is present on disk but not declared in `Sub-repos` (added). Surfaced by Section 2's cross-check and Section 4's per-sub-repo scan.
- **Per-sub-repo stack diffs**: stack changed within a single sub-repo (e.g., `web-frontend` upgraded Angular major version; `api-server` adopted FastAPI replacing Flask). Same shape as single-repo stack diffs but attributed to a specific sub-repo.
- **Per-sub-repo conventions diffs**: conventions changed within a single sub-repo (branch naming, commit style, lint config).
- **Cross-sub-repo runtime-dep diffs**: a manifest now declares (or no longer declares) a sibling sub-repo as a dependency. Surfaced by the Section 4 manifest cross-reference pass against priors.
- **Per-sub-repo v2.4 execution-field diffs** (added v2.4): for each stable sub-repo (in `Sub-repos` AND on disk), re-run manifest inspection (per `/strap-in`'s "Build-file inspection patterns" table) and compare against the current v2.4 schema fields. Surface per-field drift only when manifest signals indicate a likely change:
  - `Primary language`: re-inspect manifest. Different result than current Sub-repos value -> surface ("was `typescript`, now appears `typescript` + `rust` per added `Cargo.toml`. Update?").
  - `Test command`: re-inspect `scripts.test` or equivalent. Difference -> surface.
  - `Build command`: same.
  - `Active domains`: heuristic recheck against repo structure; surface significant additions or removals.
  - `Depends on`: re-scan for cross-sub-repo imports / package references; surface drift (overlaps with cross-sub-repo runtime-dep diffs above; reconcile in Section 6 with the runtime-deps surface).
  - Other fields (Slug, Path, Role, Stack, Conventions, Source-of-truth, Parallel safe, Deployment target, Activated): no automated drift detection. Adopters update these manually via project-profile.md edits or via the v2.4 escape valves at Section 6. `Activated` is immutable; refresh never restamps it.
  Quiet when no manifest-driven drift detected per stable sub-repo -- the typical refresh case emits one summary line ("3 sub-repos stable; no v2.4 execution-field drift.") and proceeds.
- **Sub-repos section drift**: derivative -- the `Sub-repos` section in `project-profile.md` requires edits to reflect structural / stack / conventions / runtime-dep diffs above. Tracked separately because Section 8 synthesis applies it surgically (per-entry, per-field). When the section's sentinel comment indicates v2.3 prose form (no `<!-- strap-schema: sub-repos-v2.4 -->`), surface as a Section 6 blocker; recommend `/strap-upgrade` before this refresh proceeds with field updates.

A diff is anything where the prior persistence-stack statement does not match what the current codebase shows.

**Recompute specialist relevance against the diffs.**

For each of the nine deep-dive-capable specialists (security-reviewer, test-strategist, backend-engineer, frontend-engineer, database-engineer, integration-specialist, devops-lead, designer, ux-test-engineer):

| Prior state | Current trigger met? | Domain diffs since prior? | Decision (incremental mode) | Decision (`--full` mode) |
|---|---|---|---|---|
| Active | Yes | Yes | **Re-dispatch** (focused on diffs) | Re-dispatch (full) |
| Active | Yes | No | Skip (memory current) | Re-dispatch (full) |
| Active | No | n/a | **Mark dormant** (preserve memory; flag "domain receded") | Same |
| Dormant | Yes | n/a | **Activate** (full deep-dive of newly-relevant domain) | Activate (full) |
| Dormant | No | n/a | Stay dormant | Stay dormant |

The "preserve memory" case is important: even when a specialist's domain has receded (e.g., the team removed all integrations), the memory file is NOT deleted. Mark it with a note ("domain inactive as of <date>; preserved for historical context") and skip the dispatch. If the domain returns later, the prior memory becomes priors again.

**Priors-override-signals exception for `frontend-engineer`.** The default `Active + No current signal -> Mark dormant` row above has one exception: when `frontend-engineer`'s memory file has substantive curated content from prior runs (project-specific UI tradecraft accumulated -- not just the package-shipped starter content) AND the current signal scan finds no triggering signal, default to **Skip dispatch + KEEP active** rather than Mark dormant. The reasoning: UI signal patterns are heuristic-shaped (manifest deps, template extensions, vendored directory names) and can miss real UI work as projects evolve (e.g., vendored widget library upgrades its directory name; the project switches template engines without changing the underlying UI surface). The curated memory is more authoritative than the signal heuristic for "is UI work happening here?". If the codebase's UI surface really has receded, the next CPO-directed Section 6 override will mark it dormant explicitly. Conservative default: preserve curated context until evidence of recession is unambiguous.

This exception is scoped to `frontend-engineer` specifically (per the v2.3 Enhancement that introduced server-rendered + vendored-widget signal coverage). The general principle "priors override signal-heuristic misses" could extend to other specialists in a future refinement; not in scope here.

Always-active for non-trivial refreshes: `security-reviewer`, `test-strategist`. They re-dispatch on any meaningful diff (a single dependency bump alone does not trigger them; a new framework, new integration, or new top-level directory does).

### 6. Diff summary and approval gate

Render the diff list and the recomputed relevance set to the CPO as a structured summary. The CPO approves or modifies BEFORE any specialist dispatch happens.

Single-repo:

```
Refresh plan:

  Diffs detected since last run:
    - <category>: <one-line description>
    - <category>: <one-line description>
    - ...

  Specialists to re-dispatch (domain changed):
    - <agent>  -- diffs: <one-line list>

  Specialists newly activating (domain newly relevant):
    - <agent>  -- new signal: <description>

  Specialists going dormant (domain receded):
    - <agent>  -- memory preserved; no dispatch

  Specialists unchanged (no diffs in domain; skipping):
    - <agent>
    - ...

  Project-docs sections flagged for surgical update (Section 9 closing phase):
    - PROJECT.md / <section>     -- because <which underlying diff>
    - ARCHITECTURE.md / <section>-- because <which underlying diff>
    - STACK.md / <section>       -- because <which underlying diff>

```

Polyrepo (adds sub-repo attribution + structural diffs + Sub-repos section flag):

```
Refresh plan (polyrepo umbrella, N=<N> sub-repos):

  Sub-repo structural diffs:
    - Added:   <sub-repo-path> (depth-1 .git/ detected; not in Sub-repos)
    - Removed: <sub-repo-path> (in Sub-repos; path missing on disk)
    - (none)

  Per-sub-repo diffs:
    - web-frontend: <category>: <one-line description>
    - api-server: <category>: <one-line description>
    - ...

  Cross-sub-repo runtime-dep diffs:
    - Added:   <from-sub-repo> -> <to-sub-repo> (evidence: <manifest>)
    - Removed: <from-sub-repo> -> <to-sub-repo> (prior dep no longer referenced)

  Specialists to re-dispatch (per-sub-repo specialists scope to relevant sub-repos):
    - backend-engineer  -- diffs in: api-server
    - <agent>           -- diffs in: <sub-repo-or-umbrella>

  Specialists newly activating:
    - <agent>           -- new signal: <description> (sub-repo: <which> or umbrella)

  Specialists going dormant:
    - <agent>           -- domain receded across all sub-repos; memory preserved

  Specialists unchanged (skipping):
    - <agent>           -- no diffs in any sub-repo's relevant domain

  Sub-repos section edits flagged for synthesis:
    - <sub-repo-path>   -- update Stack (Angular 18 -> 19), update Runtime dependencies
    - <sub-repo-path>   -- ADD new entry (sub-repo newly appeared)
    - <sub-repo-path>   -- REMOVE entry (sub-repo deleted from disk)

  Project-docs sections flagged for surgical update (Section 9):
    - STACK.md / per-sub-repo table     -- because per-sub-repo stack diff in <which>
    - ARCHITECTURE.md / runtime deps    -- because cross-sub-repo runtime-dep diff
    - PROJECT.md / Sub-repos enumeration -- because sub-repo structural diff
```

The polyrepo summary surfaces structural diffs FIRST (sub-repo added/removed) because they have the largest downstream impact -- they cascade into per-sub-repo diffs (newly-active vs needs-removal), specialist relevance, and Sub-repos section edits.

Then surface the override gate via `AskUserQuestion`:

```yaml
header: "Refresh plan"
question: "Override the plan before I dispatch?"
options:
  - label: "Advance (Recommended)"
    description: "Accept this refresh plan and proceed to the parallel deep-dive."
  - label: "Override"
    description: "I'll ask which agents to force-activate or skip, or which diff you want explained. Repeatable."
```

Handle the response:

- `Advance` -- accept the plan; proceed to Section 7.
- `Override` -- prompt with a second `AskUserQuestion`:
  ```yaml
  header: "Override action"
  question: "What override?"
  options:
    - label: "Force-activate an agent"
      description: "Add a skipped specialist to the active set anyway."
    - label: "Skip an agent"
      description: "Remove a specialist from the active set despite diffs."
    - label: "Explain a diff"
      description: "Ask for more detail on a specific diff before deciding."
    - label: "Adjust sub-repo structural decision"
      description: "(Polyrepo only) Change how I handle a sub-repo added/removed flag -- defer, ignore, or alter the default Sub-repos section edit."
    - label: "Done overriding"
      description: "Return to the previous gate and advance."
  ```
  For each action, prompt for the agent name, diff identifier, or sub-repo path with a third `AskUserQuestion` (options enumerate the relevant candidates). Apply the change, re-render the plan, re-surface the override gate. Repeat until `Done overriding`.

  **Polyrepo structural-decision override** is the new action specific to polyrepo mode. Common uses: defer removing a `Sub-repos` entry when the sub-repo is temporarily missing (branch-local removal); ignore a newly-detected sub-repo that the CPO does not want managed under the umbrella (auxiliary script directory misidentified as a sub-repo); accept a sub-repo addition but keep the prior `Sub-repos` entries unchanged until a future refresh. The dev-lead records the override choice in the diff list and propagates it to Section 8 synthesis so the `Sub-repos` section is edited per the CPO's intent, not the default-action heuristic.
- Free-text "Other" -- interpret intent; common case is a question about a specific diff.

If the diff list is empty and no specialists need dispatch, the skill surfaces:

```
No meaningful diffs detected since the last refresh. The persistence stack appears current.

If you suspect drift the scan missed, run `/strap-refresh --full` to redo discovery from scratch.

Exit? (yes / discuss)
```

`yes` exits cleanly: finalize the workflow_instance entry in `usage.yaml` with `session.completed_at: <ISO-timestamp>` and `session.outcome: no_diffs_detected`. The persistence stack files are untouched. `discuss` opens a dialog with the CPO about what they're looking for; the skill may then re-run a targeted scan against a CPO-named area.

### 7. Parallel deep-dive via CreateTeam (active set only)

Dispatch the approved specialists as a parallel team via `CreateTeam`. Same read-only tool palette as `/strap-in`:

```
Read, Grep, Glob, Bash
```

No `Write`, no `Edit`. Code immutability invariant applies.

**Per-specialist brief differs from `/strap-in`.** The brief now includes:

- **Scope** -- focused on the diffs, not the whole domain. For a specialist whose domain has incremental changes: "Read the diffs and the existing memory file; identify what's new, what's still accurate, what's now wrong. Do NOT re-survey the whole domain." For a newly-activating specialist: same scope as `/strap-in` (full deep-dive of a previously unread domain).
- **Priors loaded inline** -- the brief includes the current content of the specialist's per-agent memory file. The specialist treats it as known-state and focuses on diffs.
- **Tool palette** -- `Read, Grep, Glob, Bash`. Read-only Bash discipline.
- **Per-agent budget** -- `<per-agent-budget>` tokens. Include `tokens_used: ~XXk` in finishing summary. The effective `<per-agent-budget>` resolves per `budget-discipline.md` "Dispatch-time resolution": `budgets.strap-refresh.agent_overrides.<name>.per_agent` if present, else `budgets.strap-refresh.per_agent`. Overrides are honored if the CPO set one via `/revise-token-budget --agent <name>` between runs.
- **Reporting format** -- structured findings PLUS an explicit list of **proposed memory edits**: "Add this learning"; "Remove this stale learning"; "Update this learning to reflect <change>". Specialists do NOT edit memory directly; they propose edits the dev-lead applies during synthesis.
- **Delivery via `SendMessage`** -- "You are dispatched through `CreateTeam`. You must call `SendMessage` with your structured findings, your proposed memory edits, and the `tokens_used: ~XXk` line as the final line before your session ends. Without `SendMessage`, your reply never reaches me and I wait indefinitely."

**Specialists report; dev-lead curates.** As with `/strap-in`. Single-curator invariant.

**Token accounting.** Same as `/strap-in`. Parse `tokens_used: ~XXk` from each specialist's finishing summary; sum into `session.specialists_used`; record per-agent consumption.

#### Polyrepo dispatch granularity (when polyrepo mode is in effect)

Same mixed-dispatch model as [`/strap-in` Section 6 polyrepo subsection](../strap-in/SKILL.md#6-parallel-deep-dive-via-createteam). Briefly:

- **Per-sub-repo briefs** for `backend-engineer`, `frontend-engineer`, `database-engineer` -- one brief per relevant sub-repo, parallel via `CreateTeam`. Each brief is scoped to ONE sub-repo and carries the prior `Sub-repos` entry for that sub-repo as part of priors.
- **Umbrella briefs** for `security-reviewer`, `test-strategist`, `integration-specialist`, `devops-lead` -- one brief covering all sub-repos, parallel via `CreateTeam`. Each carries the full prior `Sub-repos` section.

**Refresh-specific brief tweaks** (in addition to the polyrepo dispatch shape):

- **Diff scope**: each per-sub-repo brief names which sub-repos diffed and the specific diff categories within each. Specialists focus on diffs, not full re-survey. For newly-active sub-repos (sub-repo just added), the brief is full deep-dive shape (no priors for that sub-repo yet).
- **Prior sub-repo entry inline**: each per-sub-repo brief includes the prior `Sub-repos` H3 entry text verbatim as a priors block. Specialist treats it as known-state and proposes targeted edits.
- **Proposed Sub-repos field edits**: in their finishing summary, each per-sub-repo specialist proposes targeted field edits to the relevant `Sub-repos` entry: "Update Stack: Angular 18 -> 19"; "Add to Conventions: <new pattern>"; "Add to Runtime dependencies: <new sub-repo>". The dev-lead applies these surgically at Section 8 synthesis.
- **Stage 2 runtime-dep reporting**: same as `/strap-in` -- specialists report observed cross-sub-repo imports as `runtime-dep: <to-sub-repo> via <evidence>`. The dev-lead aggregates with Stage-1 manifest-cross-reference findings for the Stage 3 CPO confirm at Section 8.
- **Sub-repo structural diffs do not dispatch specialists for the missing sub-repo**; only sub-repos present on disk get briefs. Removed-sub-repo entries are handled in Section 8 synthesis (remove the Sub-repos entry; preserve the prior content in a dormant-style appendix or comment).

### 8. Phased discovery + synthesis gate

Identical to `/strap-in` Sections 7 and 8 in mechanics, with one twist for synthesis:

**Phased mode** -- if the diff set is large enough that a single wave would push session aggregate past 60%, lay out a phased plan. Refreshes are usually smaller than fresh onboardings, so phased mode is uncommon but supported.

**Synthesis gate** -- targeted edits, not whole-file rewrites:

- For each specialist that re-dispatched: apply the proposed memory and rules edits to the corresponding files. Edit in place. Preserve content the specialist did not flag for change.
- For `project-profile.md`: apply edits scoped to the diff categories surfaced in Section 6. Preserve curated content unrelated to the diffs.
- For specialists going dormant: append a "domain inactive as of <date>" note to their memory file. Do not delete prior content.
- Re-read every modified file at the end. Check for inconsistencies between specialists' edits.

#### Polyrepo synthesis: surgically update Sub-repos and confirm runtime-dep diffs

When polyrepo mode is in effect, synthesis additionally handles `Sub-repos` section edits and Stage 3 runtime-dep confirmation.

**Per-entry surgical edits to `Sub-repos`** (mirrors the surgical discipline applied to `project-profile.md` as a whole):

- **Existing entries with field diffs** (e.g., `web-frontend` Stack changed): edit the specific fields the specialists' proposed Sub-repos field edits named. Preserve every other field in the entry byte-for-byte.
- **Added entries** (new sub-repo detected and CPO did not override to ignore): append a new H3 entry with all 7 fields populated from the newly-dispatched specialists' findings + Stage 3 confirm for runtime deps. Insertion order: alphabetical by Path within the `Sub-repos` section.
- **Removed entries** (sub-repo deleted from disk and CPO did not override to defer): remove the H3 entry. Capture a one-line note in the dev-lead's own memory (`.claude/strap/memory/dev-lead/`) recording the removal and the timestamp -- if the sub-repo returns later, the dev-lead remembers the context.
- **CPO-overridden structural decisions**: apply per the CPO's choice from Section 6 (defer removal, ignore addition, etc.). No default-action edits when override is set.

**Stage 3 runtime-dep CPO confirmation** (when cross-sub-repo runtime-dep diffs exist):

Render the aggregated diff set (Stage-1 manifest cross-reference + Stage-2 specialist findings, both compared to prior `Runtime dependencies` fields):

```
Cross-sub-repo runtime-dep changes:

  Added (new in this refresh):
    - web-frontend -> shared-lib       (Stage 1: package.json file: reference)
    - api-server -> web-frontend (Stage 2: backend-engineer observed HTTP client)

  Removed (in prior Runtime dependencies; no longer referenced):
    - <sub-repo> -> <sub-repo>             (manifest no longer carries reference)

  Confirm the updates?
```

Surface via `AskUserQuestion`:

- `Confirm as shown (Recommended)`: apply additions and removals to each affected `Sub-repos` entry's `Runtime dependencies` field.
- `Edit list`: prompt for additions/removals via free-text; re-render.
- `Skip`: leave `Runtime dependencies` fields unchanged; document the gap in hand-off ambiguities.

If no cross-sub-repo runtime-dep diffs exist, skip Stage 3 entirely.

**Polyrepo synthesis quality bar** extends the single-repo bar:

> Another dev-lead resuming this project on a fresh session understands the umbrella shape from the `Sub-repos` section: which sub-repos exist now (post-refresh), what each does, what stack each uses, and what cross-sub-repo runtime contracts hold. The bar applies whether structural diffs were present this refresh or not.

#### Synthesis quality bar

The synthesis gate clears when:

> Another dev-lead resuming this project on a fresh session, with no memory of this refresh conversation, would understand the current project state from the updated persistence stack alone.

Surface any irreconcilable disagreements to the CPO before hand-off.

### 9. Project-docs surgical updates

After the synthesis gate clears, the dev-lead dispatches `tech-writer` (serial via `Task`, not parallel via `CreateTeam`) to apply **surgical updates** to the human-facing project-orientation documents at the configured `Project docs paths` (or the fallback `.claude/strap/project-docs/`).

The discipline that distinguishes refresh from initial onboarding: **surgical, not wholesale.** Update only the sections the Section 6 diff-summary flagged as drifted; preserve every other section byte-for-byte. CPO edits, narrative additions, and prior-refresh curation all live in those files; a wholesale rewrite at refresh time overwrites work the refresh did not invalidate.

**Tool palette (same exception as `/strap-in` Section 9).** Tech-writer receives the read-only-at-host palette augmented with `Write` and `Edit` for local docs only:

```
Read, Grep, Glob, Bash, Write, Edit
```

The code-immutability invariant is preserved structurally: writes are scoped to the configured `Project docs paths`, never production source.

**Resolve the write target.**

1. Look up the top-level `Project docs paths` field in the just-updated `project-profile.md`. If declared, use the first path.
2. Otherwise, fall back to `.claude/strap/project-docs/`.
3. Check whether `PROJECT.md`, `ARCHITECTURE.md`, `STACK.md` exist at the target path.
   - **All three present**: surgical-edit mode. Tech-writer applies Section 9 flagged edits in-place.
   - **One or more missing**: render-fresh mode for the missing files (typical when the project was onboarded pre-v2.2 and is seeing project-docs for the first time). Render from `.claude/strap/templates/project-docs/` for the missing files; surgical-edit the present ones.
   - **All three missing**: full render-fresh, like `/strap-in` Section 9.

Tell the CPO which mode the closing phase will run in and the target path.

**Per-tech-writer brief.** Dispatch via `Task`:

- **Role contract + operating context** -- per-agent rules, per-agent memory, the just-updated `project-profile.md`.
- **Mode declaration** -- surgical-edit, mixed, or render-fresh (per the resolved target-path check above).
- **The Section 6 project-docs flag list** -- explicit per-doc, per-section list of what drifted and why. Tech-writer edits only these sections in surgical-edit mode.
- **Updated persistence stack as authoritative source material** -- the just-updated `project-profile.md`, the just-curated `memory/agents/<re-dispatched-specialist>.md` files.
- **The three templates** -- `.claude/strap/templates/project-docs/{PROJECT,ARCHITECTURE,STACK}.md.template.md`. Used in render-fresh mode for missing files; used as reference in surgical-edit mode for section structure.
- **Surgical discipline (hard rule)** -- "In surgical-edit mode, modify ONLY the sections in my flag list. Preserve every other section byte-for-byte. Whole-file rewrites in surgical-edit mode are a defect."
- **Read-only-at-host discipline** -- same as `/strap-in` Section 9.
- **Stub discipline** -- same as `/strap-in` Section 9 (template placeholders without source material get a one-line stub note; no fabrication).
- **Per-agent budget** -- pulled from `usage.yaml`, resolved per `budget-discipline.md` "Dispatch-time resolution" (`agent_overrides.tech-writer.per_agent` if present, else `budgets.strap-refresh.per_agent`). Include `tokens_used: ~XXk` in the finishing report.
- **Reporting format** -- "Report back: files touched (full paths), per-file edited-sections summary, mode applied per file (surgical-edit or render-fresh), anything to curate, `tokens_used: ~XXk` as the final line."

**Review and curate.** When tech-writer returns:

1. Read each of the three files.
2. Verify the write target was honored (no edits outside the configured `Project docs paths`).
3. Verify surgical discipline: for files in surgical-edit mode, the un-flagged sections should be byte-identical to their pre-refresh state. Diff or spot-check.
4. Verify no Mustache placeholders rendered through in render-fresh sections.
5. Spot-check facts against the updated persistence stack.
6. Curate any rule or memory entries tech-writer flagged.

**The refresh project-docs bar** parallels Section 8's synthesis bar:

> The project-docs now reflect the current project state. A new contributor reading them cold would understand the project as it is today, not as it was at the last refresh.

#### Polyrepo umbrella docs surgical updates (when polyrepo mode is in effect)

When polyrepo mode is in effect, surgical updates apply to the **umbrella view** the docs capture. The tech-writer brief carries additional context tailored to polyrepo refreshes:

- **Source material includes the updated `Sub-repos` section** of the just-synthesized `project-profile.md`. The Sub-repos section is authoritative for the post-refresh system shape.
- **Per-doc polyrepo-specific surgical patterns**:
  - **Sub-repo added**: append a new row to `STACK.md`'s per-sub-repo table (columns: sub-repo / language / framework / role); add a paragraph or bullet to `ARCHITECTURE.md` describing the new sub-repo's role in the system; update `PROJECT.md`'s comprising-sub-repos list.
  - **Sub-repo removed**: remove the corresponding row from `STACK.md`; remove the paragraph from `ARCHITECTURE.md`; remove the entry from `PROJECT.md`'s list. Preserve every other section.
  - **Per-sub-repo stack diff**: edit only the affected row of `STACK.md`'s per-sub-repo table; the rest of the table and the surrounding prose stay byte-identical.
  - **Cross-sub-repo runtime-dep diff**: edit only the runtime-dep / data-flow section of `ARCHITECTURE.md`; the rest stays byte-identical.
- **Per-sub-repo project-docs still out of scope.** v2.3 ships umbrella-only project-docs. Per-sub-repo doc rendering is a later Feature in the polyrepo Epic; the refresh brief explicitly states this so tech-writer does not invent per-sub-repo doc updates.

Single-repo mode (`N=1`) applies surgical updates with the original (non-polyrepo) framing.

**No-diff fast-path.** If Section 5 produced no project-docs flag list (none of the detected diffs touched the prose surface of PROJECT/ARCHITECTURE/STACK), Section 9 skips the tech-writer dispatch entirely. The hand-off summary still mentions the no-update outcome for the project-docs so the CPO sees they were considered. Polyrepo mode applies the same fast-path: if no per-sub-repo stack diff, no cross-sub-repo runtime-dep diff, and no sub-repo structural diff touched the umbrella docs' prose surface, skip.

**Token accounting.** Same as `/strap-in` Section 9.

#### Render the HTML companion

After tech-writer's surgical updates land (or, in the no-diff fast-path, after Section 9 confirms no updates were needed), **always full re-render** the project-docs HTML companion via the STRAP html-render pipeline. The markdown is the surgical surface; the HTML is a derived artifact -- there is no "surgical HTML edit" path. The full re-render is cheap and keeps the HTML byte-aligned with the markdown.

The render mechanics are identical to `/strap-in` Section 9's "Render the HTML companion" sub-block (see [`../strap-in/SKILL.md`](../strap-in/SKILL.md)):

1. Resolve `<project-name>` and `<project-docs-path>` from `project-profile.md`.
2. Build a temporary render config naming the three markdowns as sources and the `<project-name>-orientation.html` output target.
3. Ensure the render dep is installed at `.claude/strap/tools/html-render/node_modules/marked/`. If absent (rare on refresh -- usually only on the first refresh after a v2.3 upgrade), run `npm --prefix .claude/strap/tools/html-render install --silent --no-save` once.
4. Invoke `node .claude/strap/tools/html-render/render.js <temp-config-path>` from the repo root.
5. Clean up the temp config.
6. Verify the output exists; on failure, surface the pipeline error verbatim and continue with the markdowns as the deliverable. Pipeline failure does not block hand-off.

The HTML companion's footer is updated to reflect the refresh timestamp; the polished visual identity (matching `Welcome-to-STRAP.html`) is unchanged from the prior render.

### 10. Hand-off summary

Present the CPO with a structured summary. Single-repo:

```
/strap-refresh complete.

What changed:
  - <category>: <what was updated; one line>
  - <category>: <what was updated; one line>

What I updated:
  - .claude/strap/contexts/project-profile.md          (scoped edits to <sections>)
  - .claude/strap/memory/agents/<name>.md              (<N> entries added; <M> updated; <K> removed)
  - .claude/strap/rules/agents/<name>.md               (<N> rules added)   (if any)
  - <project-docs-path>/PROJECT.md                     (surgical edits to <sections>, or "no drift -- preserved")
  - <project-docs-path>/ARCHITECTURE.md                (surgical edits to <sections>, or "no drift -- preserved")
  - <project-docs-path>/STACK.md                       (surgical edits to <sections>, or "no drift -- preserved")
  - <project-docs-path>/<project-name>-orientation.html (full re-render of the HTML companion)

What I preserved:
  - Memory files for specialists whose domain didn't change
  - Memory files for specialists whose domain receded (marked dormant)
  - Project-docs sections the diff list did not flag as drifted

Ambiguities for your call:
  - <list of items the synthesis gate flagged>
```

Polyrepo mode -- same shape with structural diffs and per-sub-repo deltas:

```
/strap-refresh complete (polyrepo umbrella, N=<N> sub-repos post-refresh).

Sub-repo structural changes:
  - Added:   <sub-repo-path>   (newly discovered; full deep-dive run; Sub-repos entry created)
  - Removed: <sub-repo-path>   (was in priors; not on disk; Sub-repos entry removed)
  - (none if no structural diffs this refresh)

What changed:
  - <sub-repo-path>: <category>: <what was updated; one line>
  - <sub-repo-path>: <category>: <what was updated; one line>
  - umbrella:        <category>: <what was updated; one line>   (cross-cutting: security, devops, etc.)

Cross-sub-repo runtime-dep changes:
  - <added/removed deps; or "no changes">

What I updated:
  - .claude/strap/contexts/project-profile.md          (scoped edits to <sections> + Sub-repos: <N added, M updated, K removed>)
  - .claude/strap/memory/agents/<name>.md              (per-sub-repo entries scoped to relevant sub-repos)
  - .claude/strap/rules/agents/<name>.md               (<N> rules added)   (if any)
  - <project-docs-path>/PROJECT.md                     (surgical edits to <sections>, or preserved)
  - <project-docs-path>/ARCHITECTURE.md                (surgical edits to <sections>, or preserved)
  - <project-docs-path>/STACK.md                       (per-sub-repo table updated, or preserved)
  - <project-docs-path>/<project-name>-orientation.html (full re-render of the HTML companion)

What I preserved:
  - Memory files for specialists whose domain didn't change in any sub-repo
  - Sub-repos entries for sub-repos with no diffs
  - Project-docs sections the diff list did not flag as drifted

CPO structural-override decisions applied:
  - <list of overrides from Section 6; or "none -- defaults applied">

Ambiguities for your call:
  - <list of items the synthesis gate flagged, including Stage 3 runtime-dep gaps if any>
```

Hand-off is the natural exit. Write a terminal entry to `usage.yaml` (`session.completed_at: <ISO-timestamp>`) and return control.

## Outputs

- Updated `.claude/strap/contexts/project-profile.md` with scoped edits reflecting the approved diffs.
- Updated `.claude/strap/memory/agents/<name>.md` for every specialist that re-dispatched or newly activated. Files for specialists whose domains were unchanged are NOT modified.
- Annotations on memory files for specialists going dormant ("domain inactive as of <date>").
- Updated `.claude/strap/rules/agents/<name>.md` for any specialist that proposed a new rule (rare on refresh; most rules come from initial onboarding).
- Surgically updated `PROJECT.md`, `ARCHITECTURE.md`, `STACK.md` at the configured `Project docs paths` (or fallback `.claude/strap/project-docs/`) for sections the diff list flagged as drifted. Unflagged sections are byte-identical to their pre-refresh state. Missing files render fresh from templates.
- Updated `.claude/strap/state/usage.yaml` with this refresh's workflow instance, specialists used (Section 7 + Section 9), per-agent consumption.
- A continuation file at `.claude/strap/contexts/continuations/strap-refresh-<project-slug>.md` IF the refresh spans multiple sessions; otherwise none.

## Quality gates

The skill is successful when all of the following hold:

- Pre-flight cleared (sentinel-absent + substantive content at entry; project is onboarded).
- Diffs detected and surfaced to the CPO; CPO approved the plan (or the no-diffs path exited cleanly).
- For each re-dispatched / newly-activating specialist: `tokens_used: ~XXk` reported; proposed memory edits captured and applied.
- Synthesis gate cleared OR gaps surfaced to the CPO and accepted at hand-off.
- Section 9 ran (project-docs surgical updates) when project-docs drift was flagged, or was explicitly skipped via the no-diff fast-path when not. In surgical-edit mode, un-flagged sections in project-docs files are byte-identical to their pre-refresh state.
- No code outside `.claude/strap/` (and the configured `Project docs paths` when it points outside `.claude/strap/`) was modified. The code-immutability invariant applies to production source; tech-writer's local-doc writes at Section 9 are the explicit narrow exception.
- No credentials appear in any tracked file.
- The persistence stack for specialists whose domains didn't change is byte-identical to its pre-refresh state.

**Polyrepo-mode additional gates** (apply only when Section 2 detected polyrepo mode):

- Polyrepo mode was detected from existing `Sub-repos` section (not re-prompted) and the disk-state cross-check ran (declared sub-repo paths verified; new depth-1 `.git/` subdirectories detected).
- Sub-repo structural diffs (added/removed) were surfaced in Section 6 with default actions named; CPO either accepted the defaults or applied structural-decision overrides.
- `Sub-repos` section in `project-profile.md` is surgically updated: only the affected entries' affected fields changed; all other entries and unaffected fields are byte-identical to pre-refresh state.
- Stage 3 runtime-dep CPO confirmation was surfaced when cross-sub-repo runtime-dep diffs existed (or skipped cleanly when none).
- Per-sub-repo specialists dispatched only against present sub-repos (no briefs sent for removed sub-repos).
- Umbrella project-docs reflect the post-refresh sub-repo set: `STACK.md`'s per-sub-repo table matches the current `Sub-repos` entries.

The skill fails -- and reports clearly -- when:

- Pre-flight finds scaffold sentinel present (project not yet onboarded).
- Pre-flight finds `project-profile.md` empty or whitespace-only (install incomplete).
- A specialist dispatch errors uncatchably.
- The CPO declines at the approval gate. Write a continuation, exit cleanly.

## Failure handling

- **Pre-flight detects scaffold-sentinel present**: redirect to `/strap-in` per the message above. Do NOT proceed.
- **`CreateTeam` primitive unavailable**: surface and offer serial `Task` fallback. Slower but functional.
- **Specialist returns proposed memory edits that conflict with another specialist's edits**: do not silently choose. Surface the conflict to the CPO at the synthesis gate with both proposed edits and ask for the call.
- **Specialist returns without proposed memory edits when diffs were expected**: note as a warning in `usage.yaml`. The persistence stack stays unchanged for that specialist; surface at hand-off.
- **CPO declines mid-flow**: write a continuation via `/context-prep strap-refresh-<project-slug>`. The continuation captures current phase, completed specialists, partial specialists, remaining work.
- **Diff detection produces nothing meaningful**: surface the "no diffs detected" message and exit cleanly. The persistence stack is left untouched. Suggest `--full` if the CPO suspects the scan missed something.
- **`--full` invoked on a freshly-onboarded project (memory files all populated very recently)**: proceed -- `--full` is a CPO-explicit override and should not second-guess.
- **tech-writer applied a wholesale rewrite in surgical-edit mode**: detected via byte-diff against pre-refresh state of un-flagged sections. Reject the wholesale rewrite; re-dispatch with the surgical-discipline rule reasserted and the per-section flag list re-emphasized. This is the most common Section 9 defect at refresh.
- **tech-writer wrote outside the configured docs path at Section 9**: same recovery pattern as `/strap-in` Section 9. Reject; re-dispatch with the target path named explicitly.
- **`Project docs paths` field absent on a project onboarded pre-v2.2**: fall back to `.claude/strap/project-docs/`. The first refresh after the v2.2 upgrade creates the directory and renders fresh; subsequent refreshes apply surgical edits.
- **Sub-repo declared in `Sub-repos` is missing on disk**: flagged in Section 5 as a sub-repo structural diff (removed). Default action at Section 8 synthesis is to remove the `Sub-repos` entry. CPO can override to defer the removal via Section 6 structural-decision override -- useful for branch-local removals or temporary sub-repo absences (e.g., a sub-repo cloned for a feature branch and absent on the current branch). When defer-override is applied, the `Sub-repos` entry stays intact and the gap is captured in hand-off ambiguities.
- **New depth-1 `.git/` subdirectory present on disk but not declared in `Sub-repos`**: flagged in Section 5 as a sub-repo structural diff (added). Default action is full deep-dive of the new sub-repo and creation of a new `Sub-repos` entry. CPO can override to ignore via Section 6 -- useful when the directory is an auxiliary script directory misidentified as a sub-repo (rare) or when the CPO wants to defer adoption to a future refresh.
- **`Sub-repos` section structurally malformed** (e.g., H3 entries missing required fields, duplicate paths, non-relative Path values): surface a structured failure naming the malformed entries. Do NOT auto-repair. The CPO restores the section manually or runs `/strap-refresh --full` to re-derive it from scratch.
- **Polyrepo Stage 3 runtime-dep confirmation: CPO declines or edits the diff list incorrectly**: leave the prior `Runtime dependencies` fields unchanged; document the gap as a synthesis-gate ambiguity. Subsequent refreshes will re-detect the diff and re-prompt.
- **Per-sub-repo specialist returns proposed Sub-repos field edits that conflict with another specialist's** (e.g., backend-engineer says Stack is C# 12; database-engineer says C# 11 from a different sub-repo's csproj): surface the conflict to the CPO at synthesis with both proposed edits and the source sub-repo of each. Do not silently choose one.
- **`/strap-refresh --full` invoked on a polyrepo install**: full mode re-derives the entire persistence stack, INCLUDING the `Sub-repos` section. Run the depth-1 detection from scratch, present the 3-way CPO choice from `/strap-in` Section 2 (umbrella / per-sub-repo install / single-with-caution), and proceed per the CPO's choice. Full-mode polyrepo refresh is uncommon (the initial `/strap-in` choice rarely needs to be re-litigated) but supported.

## References

- [`onboarding-design.md`](../../strap/contexts/onboarding-design.md) -- the v2 onboarding flow design; `/strap-refresh` is specified in the "Re-run path" section.
- [`budget-discipline.md`](../../strap/contexts/budget-discipline.md) -- budgets pull silently from MEMORY.md for `/strap-refresh`.
- [`CLAUDE.md`](../../../CLAUDE.md) -- super-pair identity, canonical agent roster, persistence stack, single-curator rule.
- [`../strap-in/SKILL.md`](../strap-in/SKILL.md) -- the fresh-onboarding companion. Many sections of `/strap-refresh` mirror its structure.
- [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md) -- the dev-lead identity contract.
- [`../../strap/rules/agent-devs.md`](../../strap/rules/agent-devs.md), [`../../strap/rules/agent-ops.md`](../../strap/rules/agent-ops.md) -- team rules.
- [`../../strap/rules/agents/dev-lead.md`](../../strap/rules/agents/dev-lead.md) -- dev-lead-specific guardrails.
- [`../context-prep/SKILL.md`](../context-prep/SKILL.md), [`../context-fetch/SKILL.md`](../context-fetch/SKILL.md) -- multi-session checkpoint primitives.
- [`../../strap/templates/project-docs/PROJECT.md.template.md`](../../strap/templates/project-docs/PROJECT.md.template.md), [`../../strap/templates/project-docs/ARCHITECTURE.md.template.md`](../../strap/templates/project-docs/ARCHITECTURE.md.template.md), [`../../strap/templates/project-docs/STACK.md.template.md`](../../strap/templates/project-docs/STACK.md.template.md) -- the three project-docs templates Section 9 uses (render-fresh mode for missing files; structural reference for surgical-edit mode).
- [`../../agents/agent-ops/tech-writer.md`](../../agents/agent-ops/tech-writer.md), [`../../strap/rules/agents/tech-writer.md`](../../strap/rules/agents/tech-writer.md), [`../../strap/memory/agents/tech-writer.md`](../../strap/memory/agents/tech-writer.md) -- tech-writer role contract + guardrails + tradecraft for the Section 9 dispatch.
