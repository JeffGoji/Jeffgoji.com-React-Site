---
name: /revise-token-budget
description: CPO-driven budget tuning for STRAP workflows. Lists current per-workflow per-agent and session-aggregate budgets, and revises any of them (or layers a per-agent override onto a workflow's default) with persistence to .claude/strap/state/usage.yaml AND MEMORY.md plus an audit trail of every revision. The canonical knob for tuning STRAP budgets after /strap-in's initial setup.
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion
argument-hint: "[<workflow-name> | --agent <agent-name> | --show]"
---

# /revise-token-budget

## Purpose

`/revise-token-budget` is the canonical CPO surface for tuning STRAP budgets after `/strap-in`'s initial setup. `/strap-in` Section 3 prompts the CPO once for the onboarding workflow's per-agent and session-aggregate budgets, then writes silent defaults for the remaining workflows per [`budget-discipline.md`](../../strap/contexts/budget-discipline.md)'s defaults table. From that point on, this skill is how the CPO revises any of those budgets -- whether because a workflow is consistently hitting per-agent exhaustion, the session aggregate is too generous or too tight, or a specific specialist needs a higher ceiling than its workflow's default.

The skill replaces the prior pattern of "ask the dev-lead to edit MEMORY.md via `/memory-refine dev-lead`." That path still works for memory curation generally; budget revisions specifically flow through this skill so the audit trail lands consistently and the persistence touches both `usage.yaml` (runtime state) and `MEMORY.md` (CPO preferences) without the CPO having to remember which file to edit.

The skill is also a recommendation surface: when the dev-lead observes specialists hitting per-agent exhaustion across multiple workflow instances, it actively recommends `/revise-token-budget <workflow>` to the CPO instead of silently noting the issue.

## Owner

**dev-lead.** This skill runs in the top-level Claude Code session that IS the dev-lead. No specialist dispatch. A lightweight conversational gate driven entirely by `AskUserQuestion` interactions with the CPO.

## Inputs

- `$ARGUMENTS` -- one of the following modes, all optional:
  - **No arg** -- list mode. Render the current budgets table and prompt the CPO via `AskUserQuestion` for what to revise.
  - **`<workflow-name>`** -- jump to revising that workflow's per-agent and session-aggregate budgets. Recognized names (matching `budget-discipline.md`'s defaults table at the time this skill ships): `strap-in`, `strap-refresh`, `decompose-feature`, `execute-sprint`, `refine-pr`, `fix-bugs`, `quick`. As new budget-aware skills land in the catalog (e.g., `create-test-plan` once #38957 ships), they join this list automatically -- the skill reads the workflow set from `usage.yaml` rather than hardcoding it.
  - **`--agent <agent-name>`** -- revise a per-agent override. After resolving the agent, prompt for which workflow the override applies to, then collect the per-agent value.
  - **`--show`** -- inspect-only mode. Render the current budgets table and exit. No revision; no prompts.
- `.claude/strap/state/usage.yaml` -- source of truth for the current budget table. Created at `/strap-in` Section 3; this skill reads and writes it. If missing, the skill surfaces the gap and stops (recommend `/strap-in` or `/strap-refresh`).
- `.claude/strap/memory/MEMORY.md` -- the dev-lead's memory index. Updated under the `## CPO preferences` section so the current values are visible to every session.
- `.claude/strap/memory/dev-lead/cpo_preferences_budgets.md` -- the topic file holding the current values per the auto-memory convention. Updated in place each time a revision lands.
- `.claude/strap/memory/dev-lead/budget_revisions.md` -- the audit-trail topic file. Append-only chronological log of every revision: timestamp, target row, prior value, new value, CPO-supplied reason. Created on first revision if absent.

## Pre-flight

1. **`.claude/strap/state/usage.yaml` exists.** If missing, surface the gap and stop with a recommendation to run `/strap-in` (first-time setup) or `/strap-refresh` (re-discovery on an already-onboarded project). This skill operates on existing state -- it does not initialize the budget table from scratch.
2. **Validate flag combinations.** `--agent` and `--show` are mutually exclusive. `<workflow-name>` and `--agent` are mutually exclusive (the workflow is resolved interactively after `--agent`). Surface a clear error and stop on conflict.
3. **Validate workflow-name argument (when supplied).** Read `usage.yaml`'s `budgets` block; check that the supplied name exists as a key. If not, list the available names and stop.
4. **Validate agent-name argument (when supplied).** Match against the canonical 15-agent roster from `.claude/agents/agent-devs/` and `.claude/agents/agent-ops/`. The dev-lead's own role is excluded (dev-lead consumption is not specialist-budgetable per `budget-discipline.md` "Who watches what"). If unmatched, list the eligible specialists and stop.

## Workflow

### Step 1: Resolve mode

Parse `$ARGUMENTS`:

- Empty -> **list mode** (Step 2a).
- `--show` -> **show mode** (Step 2d).
- `--agent <name>` -> **agent override mode** (Step 2c).
- Known workflow name -> **workflow mode** (Step 2b).
- Anything else -> surface as an unrecognized argument; suggest the four valid invocation shapes.

### Step 2a: List mode (no arg)

1. Read `.claude/strap/state/usage.yaml` and parse the `budgets` block.

2. Render the current state to the CPO as a structured text block:

   ```
   Current budgets (.claude/strap/state/usage.yaml):

   | Workflow            | Per-agent  | Session aggregate | Per-agent overrides       |
   |---------------------|------------|-------------------|---------------------------|
   | strap-in            | 200K       | 1M                | -                         |
   | strap-refresh       | 200K       | 1M                | -                         |
   | decompose-feature   | 150K       | 750K              | -                         |
   | execute-sprint      | 500K       | 2M                | backend-engineer: 750K    |
   | refine-pr           | 100K       | 500K              | -                         |
   | fix-bugs            | 200K       | 1M                | -                         |
   | quick               | 200K       | 1M                | -                         |
   ```

   When `agent_overrides` are present under a workflow, list each override as `<agent>: <per-agent>` in the rightmost column. When absent, render `-`.

3. Surface the revise target via `AskUserQuestion`:

   ```yaml
   header: "What to revise"
   question: "What do you want to revise?"
   options:
     - label: "A workflow's defaults"
       description: "Revise per-agent and/or session-aggregate budgets for a specific workflow."
     - label: "A per-agent override"
       description: "Layer a per-agent budget override onto a workflow (e.g., give backend-engineer a higher ceiling in /execute-sprint than the workflow's default)."
     - label: "Cancel"
       description: "Exit without changes."
   ```

4. Handle the response:
   - `A workflow's defaults` -> ask which workflow via a second `AskUserQuestion` whose options list the workflow names from `usage.yaml`'s `budgets` keys. Proceed to Step 3 with the chosen workflow.
   - `A per-agent override` -> ask which agent via a second `AskUserQuestion` whose options list the canonical specialists (the 14 non-dev-lead agents, with the most likely candidates -- the deep-dive specialists -- listed first). Then ask which workflow via a third `AskUserQuestion`. Proceed to Step 4 (per-agent value collection).
   - `Cancel` -> exit cleanly with no persistence.

### Step 2b: Workflow mode (`<workflow-name>`)

Skip the target selection. Render the current row for the named workflow to the CPO as a structured one-liner:

```
Revising budgets for /<workflow-name>:
  Per-agent:        <current> (default per budget-discipline.md: <default>)
  Session aggregate: <current> (default: <default>)
  Per-agent overrides: <list or "none">
```

Proceed to Step 3.

### Step 2c: Agent override mode (`--agent <agent-name>`)

Surface a workflow-selection `AskUserQuestion` whose options list the workflow names from `usage.yaml`'s `budgets` keys plus a `Remove an existing override` option (shown only when at least one override exists for the named agent across workflows).

- Workflow chosen -> proceed to Step 4 with `(<workflow-name>, <agent-name>)` as the target.
- `Remove an existing override` -> list the existing overrides for this agent across workflows; let the CPO pick which to remove; proceed to Step 6 with the remove operation.

### Step 2d: Show mode (`--show`)

Render the current state per Step 2a's table format. Exit. No prompts.

### Step 3: Collect new workflow values (workflow defaults path)

Surface a single `AskUserQuestion` with two questions, mirroring `/strap-in` Section 3's budget prompt for option-label consistency:

```yaml
Question 1:
  header: "Per-agent budget"
  question: "What is the maximum tokens any single specialist may consume across one invocation of /<workflow-name>?"
  options:
    - label: "100K"
      description: "Tighter. Suitable for small or very focused work."
    - label: "200K (Recommended)"
      description: "Default. Comfortable headroom for typical work in this workflow."
    - label: "500K"
      description: "Generous. Choose for larger codebases or exhaustive specialist runs."
    - label: "750K"
      description: "Very generous. Choose for monorepos or work that spans many sessions."

Question 2:
  header: "Session aggregate"
  question: "What is the maximum aggregate tokens specialists may consume within a single session before I recommend a checkpoint?"
  options:
    - label: "500K"
      description: "Tight. Frequent checkpoints; suitable for cost-conscious runs."
    - label: "1M (Recommended)"
      description: "Default. The 60% checkpoint threshold sits at 600K."
    - label: "2M"
      description: "Spacious. Suitable for workflows where waves run long."
    - label: "5M"
      description: "Very spacious. Suitable for the largest monorepos."
```

The "(Recommended)" tag on each question floats to whichever option matches that workflow's default per `budget-discipline.md`'s defaults table -- not always the same option across workflows. For `/execute-sprint`, the per-agent recommendation is 500K and the session aggregate recommendation is 2M; for `/refine-pr`, per-agent is 100K and session aggregate is 500K. Render dynamically; do not hardcode "200K (Recommended)" if the active row's default is something else.

Both questions accept `Other` for a custom value via free-text input.

The CPO may pick one or both; the skill applies the chosen change(s) and leaves the other at its current value. When the CPO picks `Other` and enters a value, parse it (accept `100k`, `100K`, `100000`, `100,000` -- normalize to integer tokens).

Proceed to Step 5.

### Step 4: Collect per-agent override value (agent override path)

Single `AskUserQuestion` with one question, same options as Step 3's Question 1:

```yaml
header: "Per-agent budget override"
question: "What is the per-agent budget for <agent-name> when dispatched by /<workflow-name>?"
options:
  - label: "100K"
  - label: "200K"
  - label: "500K"
  - label: "750K"
  - label: "Remove override (use workflow default)"
```

`Other` accepted for custom value. The `Remove override` option is the discoverable way to clear an existing override (also accessible via Step 2c's `Remove an existing override` flow when entering through `--agent`).

Proceed to Step 5.

### Step 5: Validate

Apply validation rules against the proposed new values:

1. **Per-agent must not exceed session aggregate** -- nonsense values where the per-agent budget allows a single specialist to exhaust the entire session aggregate by itself. Surface a clear error and re-prompt at Step 3 / Step 4.
2. **Per-agent override must not exceed the workflow's session aggregate** -- same logic for the override path.
3. **Warn on surprising values** -- not blocking, but call them out so the CPO can re-decide:
   - `/execute-sprint` per-agent below 200K (its default is 500K; tightening to below 200K likely triggers exhaustion on real Feature work).
   - Any session aggregate above 10M (well above the largest default; rarely warranted).
   - A per-agent override LOWER than the workflow default for that workflow's primary specialist (e.g., a `backend-engineer` override at 100K under `/execute-sprint` whose default is 500K -- usually the intent is to RAISE for heavy-work specialists, not lower).
   - Surface the warning(s) and proceed to Step 6 only after the CPO confirms in Step 6's gate.

### Step 6: Confirm and apply

Surface a final `AskUserQuestion`:

```yaml
header: "Apply revision"
question: "Apply these changes?"
options:
  - label: "Apply"
    description: "Persist the revision to usage.yaml and MEMORY.md. Active for new workflow instances starting from now."
  - label: "Modify"
    description: "Return to value selection. Repeatable until you apply or cancel."
  - label: "Cancel"
    description: "Exit without changes."
```

Include in the question body a verbatim summary of the change:

```
Workflow:           /<workflow-name>
Per-agent:          <prior> -> <new>     (unchanged if not revised)
Session aggregate:  <prior> -> <new>     (unchanged if not revised)
Per-agent override: <agent>: <prior> -> <new>   (when override path)
```

For `Cancel`: exit cleanly with no persistence.
For `Modify`: re-enter Step 3 (workflow path) or Step 4 (override path).
For `Apply`: proceed to Step 7.

Before applying, optionally collect a CPO reason via one more `AskUserQuestion`:

```yaml
header: "Reason"
question: "Briefly, why this revision? (optional; lands in the audit trail)"
options:
  - label: "Hitting per-agent exhaustion consistently"
  - label: "Session aggregate too tight (frequent unnecessary checkpoints)"
  - label: "Workflow scope grew (codebase larger / more complex)"
  - label: "Tightening for cost-conscious operation"
  - label: "Skip (no reason recorded)"
```

`Other` accepted for free-text input. The reason is recorded in `budget_revisions.md` for future understanding; omitting it is fine but discouraged.

### Step 7: Persist

Three writes land atomically (from the CPO's perspective; on failure of any one, undo any partial writes and surface):

1. **`usage.yaml`** -- update `budgets.<workflow>.{per_agent,session_aggregate}` for the workflow-defaults path, OR set `budgets.<workflow>.agent_overrides.<agent>.per_agent` for the override path. When removing an override, delete the `agent_overrides.<agent>` key (and the entire `agent_overrides` block when no overrides remain on that workflow).

2. **`.claude/strap/memory/dev-lead/cpo_preferences_budgets.md`** -- the topic file. Update the body to reflect the new current state. The file is current-state-only (it does NOT carry history); revisions overwrite. If the file does not exist yet (the skill is operating on a `usage.yaml` created before this topic-file convention), create it.

3. **`.claude/strap/memory/dev-lead/budget_revisions.md`** -- the audit-trail topic file. Append a new entry at the end:

   ```markdown
   ## <ISO-8601 timestamp>

   Target:        /<workflow-name> [-- override on <agent>]
   Change:        <field>: <prior> -> <new>
                  [<field>: <prior> -> <new>]
   Reason:        <CPO-supplied reason, or "not recorded">
   ```

   Create the file if absent; otherwise append. Index in `MEMORY.md` if not already linked.

4. **`.claude/strap/memory/MEMORY.md`** -- ensure both topic files are linked in the index. If `cpo_preferences_budgets.md` is not already linked, add a one-line pointer under `## CPO preferences and conventions`. If `budget_revisions.md` is not linked, add a pointer under the same section.

### Step 8: Confirm to the CPO

Print a one-paragraph summary inline:

```
Budgets revised.
  <Workflow or override target> updated:
    <field>: <prior> -> <new>
    [<field>: <prior> -> <new>]
  Audit-trail entry: .claude/strap/memory/dev-lead/budget_revisions.md
  Active for new workflow instances starting from now; any in-flight instance continues with its original budget.
```

The "active for new instances" language is important: a workflow already running (`/execute-sprint` mid-Feature, for example) reads its budget once at dispatch time and does not re-read mid-workflow. A revision applied during an in-flight workflow takes effect on the NEXT instance, not the current one.

## Outputs

- **List mode (no arg, no apply)** -- a rendered budgets table on stdout.
- **Show mode (`--show`)** -- a rendered budgets table on stdout; nothing else.
- **All revision paths (workflow-defaults or per-agent override)**, on Apply:
  - `.claude/strap/state/usage.yaml` updated with the new values.
  - `.claude/strap/memory/dev-lead/cpo_preferences_budgets.md` updated to the new current state.
  - `.claude/strap/memory/dev-lead/budget_revisions.md` appended with one entry capturing timestamp, target, change, and reason.
  - `.claude/strap/memory/MEMORY.md` index updated when topic-file pointers were missing.
  - An inline confirmation to the CPO naming the change and reminding that the revision applies to NEXT workflow instances.

## Quality gates

The skill is successful when all of the following hold:

- The CPO explicitly chose `Apply` at the Step 6 gate before any persistence landed (Cancel and Modify never persist).
- Per-agent values do not exceed the corresponding session-aggregate value (validated at Step 5).
- Surprising-value warnings were surfaced before Apply when applicable.
- All three persistence layers (`usage.yaml`, `cpo_preferences_budgets.md`, `budget_revisions.md`) landed for revision-path runs; List and Show modes do not write.
- The audit-trail entry in `budget_revisions.md` includes timestamp, target, prior and new values, and the CPO-supplied reason (or "not recorded" when omitted).
- `MEMORY.md` carries the topic-file pointers under `## CPO preferences and conventions`.
- The skill never invokes specialist dispatch, never spawns teammates, and never touches non-budget state.

## Failure handling

- **`.claude/strap/state/usage.yaml` missing**: surface the gap; recommend `/strap-in` or `/strap-refresh`. Stop. Do not auto-create.
- **`<workflow-name>` argument unrecognized**: list the workflow names from `usage.yaml`'s `budgets` keys and stop.
- **`--agent <agent-name>` argument unmatched against the canonical roster**: list the eligible specialists and stop. The dev-lead's own role is intentionally excluded.
- **`--agent` and `--show` both supplied**: refuse with `mutually exclusive`; surface the offending invocation.
- **`<workflow-name>` and `--agent` both supplied**: refuse with `mutually exclusive`; the workflow is resolved interactively after `--agent`.
- **CPO declines at the Step 1 / Step 6 gate**: exit cleanly; no persistence.
- **Validation fails at Step 5** (per-agent exceeds session aggregate): re-prompt at Step 3 / Step 4 with the offending value flagged.
- **`Other` value cannot be parsed as a positive integer**: re-prompt with the parsing rules ("`100k` / `100K` / `100000` / `100,000` accepted; negative values and zero refused").
- **A persistence write fails mid-Step-7** (e.g., disk full, permission denied): undo any partial writes; surface the failure verbatim; the user retries the skill after fixing the underlying cause.
- **Removing the only override on a workflow leaves an empty `agent_overrides` block**: clean up by removing the empty block entirely (not just the agent key) so the YAML stays tidy.

## When to use this skill vs. /memory-refine

`/revise-token-budget` is the canonical surface for any change to the budgets table or per-agent overrides. `/memory-refine dev-lead` remains the right surface for OTHER changes to dev-lead memory -- learnings, reference pointers, CPO conventions that are not budget values. The split exists so the audit trail for budget revisions specifically lands in a dedicated topic file the dev-lead can scan when investigating budget-related questions ("when did we last raise execute-sprint's per-agent? why?").

If a CPO instructs the dev-lead to change budgets via `/memory-refine dev-lead`, the dev-lead redirects to this skill rather than editing budgets directly. This keeps the audit trail consistent.

## References

- Source Feature: #38942 (logical type `feature`).
- Predecessor Feature: #38941 -- budget-discipline parity in execution skills. Revising un-enforced budgets is theater; this skill ships after enforcement landed in the execution skills.
- Budget discipline (canonical specification): [`../../strap/contexts/budget-discipline.md`](../../strap/contexts/budget-discipline.md). The defaults table, the schema for `usage.yaml`, and the dispatch-time override resolution rule all live there.
- `/strap-in` Section 3 (budget prompt): [`../strap-in/SKILL.md`](../strap-in/SKILL.md) -- this skill mirrors that section's `AskUserQuestion` patterns for option-label consistency.
- Memory-curation skill (sibling): [`../memory-refine/SKILL.md`](../memory-refine/SKILL.md) -- the right surface for non-budget changes to dev-lead memory.
- Inspect-only sibling: [`../memory-show/SKILL.md`](../memory-show/SKILL.md) -- the read counterpart to `/memory-refine`. The closest analog for `--show` mode here.
- Runtime state: `.claude/strap/state/usage.yaml`.
- CPO-preferences topic file: `.claude/strap/memory/dev-lead/cpo_preferences_budgets.md`.
- Audit-trail topic file: `.claude/strap/memory/dev-lead/budget_revisions.md`.
- Dev-lead memory index: `.claude/strap/memory/MEMORY.md`.
