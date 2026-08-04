# Budget discipline

This document defines the budget-management pattern STRAP uses across every pipeline workflow that fans out to specialists. It is referenced by `/strap-in`, `/strap-refresh`, `/decompose-feature`, `/execute-sprint`, `/execute-sprint-full-auto`, `/refine-pr`, `/fix-bugs`, `/quick`, and any future skill that dispatches one or more specialists in parallel or in sequence.

The pattern is approximate, not exact. Specialists' self-reported token counts are estimates; dev-lead's own consumption is not introspectable. The discipline gives the CPO real operating constraints with workable precision -- not perfect measurement.

## The two budgets

Every workflow operates against two budgets:

- **Per-agent budget** -- the maximum tokens any single specialist may consume across one invocation of the workflow (including all phases and all sessions that invocation spans). When a specialist exhausts its per-agent budget, dev-lead works with whatever the specialist produced and does not dispatch it again within this workflow instance.
- **Session aggregate budget** -- the maximum tokens specialists may consume in aggregate within a single session. When 60% of the budget is exhausted, dev-lead recommends `/context-prep` + `/clear` + fresh-session resume. Specialists carry their remaining per-agent budget into the new session; the session aggregate resets.

**Per-agent budget is per-workflow-instance, not project-lifetime.** A specialist dispatched during `/strap-in` resets its per-agent budget when `/execute-sprint` later invokes it on a Feature.

## Defaults by workflow

Different workflows have different natural token shapes. Defaults:

| Workflow | Per-agent | Session aggregate | Per-sub-repo increment |
|---|---|---|---|
| `/strap-in` (discovery) | 200K | 1M | 300K |
| `/strap-refresh` (re-discovery) | 200K | 1M | 200K |
| `/decompose-feature` (planning) | 150K | 750K | n/a |
| `/execute-sprint` (implementation) | 500K | 2M | n/a |
| `/execute-sprint-full-auto` (one-shot Spec-to-PR) | 1M | 5M | n/a |
| `/refine-pr` (focused fixes) | 100K | 500K | n/a |
| `/fix-bugs` (targeted fixes) | 200K | 1M | n/a |
| `/quick` (single-motion) | 200K | 1M | n/a |
| `/create-test-plan` (test-plan authoring) | 200K | 1M | n/a |

These are starting points. The CPO confirms them once at install time during `/strap-in` Section 3 for the onboarding workflow specifically; the remaining workflows' defaults are written silently. Any time afterward, the CPO revises any of them via [`/revise-token-budget`](../../skills/revise-token-budget/SKILL.md) -- the canonical, audit-trailed surface for budget tuning.

The `Per-sub-repo increment` column applies only to onboarding workflows that scan repository contents (`/strap-in`, `/strap-refresh`); for all other workflows it is `n/a`. See [Polyrepo aggregation](#polyrepo-aggregation) below for how the increment composes with the session aggregate.

## Polyrepo aggregation

When `/strap-in` detects a polyrepo install (or `/strap-refresh` runs against one), the session-aggregate budget needs to grow to accommodate per-sub-repo Section 4 reading work and per-sub-repo Section 6 specialist dispatch for implementation-domain specialists.

**Formula** (additive, not multiplicative):

```
projected_aggregate = session_aggregate + (N - 1) * per_sub_repo_increment
```

Where `N` is the number of detected sub-repos and `per_sub_repo_increment` comes from the workflow's row in the defaults table above. The base `session_aggregate` is what a single-repo install consumes; each additional sub-repo adds the increment. The formula is sub-linear in N because the constant-cost sections (welcome, mode resolution, synthesis gate, project-docs production, hand-off) only run once regardless of N -- only Section 4 and the per-sub-repo specialists in Section 6 scale with N.

**Worked example** for `/strap-in` against a 3-sub-repo polyrepo:

```
1M + (3 - 1) * 300K = 1M + 600K = 1.6M projected aggregate
```

**Surface to the CPO at Section 3 budget prompt** (polyrepo path only). The dev-lead shows the math explicitly:

> N sub-repos detected (N=3). Projected session budget: 1.6M tokens (base 1M + 2 * 300K per additional sub-repo). Accept / adjust via /revise-token-budget / cancel?

The explicit breakdown is deliberate -- a hidden multiplier (`base * f(N)`) would drift silently from reality as projects evolve. An additive increment respects the CPO's authority to see and tune cost. The CPO adjusts via `/revise-token-budget` if needed before Section 4 starts.

**Per-agent budget does NOT scale with N.** Each specialist still gets the same internal budget; what changes is that per-sub-repo specialists (backend-engineer, frontend-engineer, database-engineer) may be dispatched multiple times -- once per relevant sub-repo, in parallel via `CreateTeam`. Each dispatch has its own per-agent budget; the dev-lead's session aggregate covers the sum.

### Auto-scaling stored defaults at install time

`/strap-in`'s budget-persistence step (Section 3 step 2) auto-scales the stored `/strap-refresh` `session_aggregate` default for polyrepo umbrellas. The scaled value is written to `usage.yaml` at install time so subsequent `/strap-refresh` invocations don't surface a budget-ceiling-bump prompt on every refresh -- the polyrepo projection is already baked into the stored default. Formula applied at install:

```
strap_refresh_session_aggregate = 1M (base) + (N - 1) * 200K (per-sub-repo increment)
```

Worked examples:

| Umbrella N | Stored `strap-refresh.session_aggregate` |
|---|---|
| Single-repo (N=1) | 1M (no scaling) |
| Polyrepo N=2 | 1.2M |
| Polyrepo N=3 | 1.4M |
| Polyrepo N=4 | 1.6M |
| Polyrepo N=5 | 1.8M |

This auto-scaling applies ONLY to `/strap-refresh`. The `/strap-in` workflow's budget is the one the CPO actively confirms at Section 3 with the polyrepo projection surfaced (the CPO sees the math and accepts / adjusts). Other workflows' defaults are written without polyrepo scaling because their token shapes don't scale linearly with sub-repo count -- `/decompose-feature`, `/execute-sprint`, etc. dispatch specialists per-Task not per-sub-repo, so their natural shape is Task-count-driven not sub-repo-count-driven. CPOs whose adopter projects develop unusually high-cost workflows of those types can revise individually via `/revise-token-budget`.

`/strap-refresh` is the natural fit for auto-scaling because it always touches every sub-repo at depth-1 to detect changes -- the per-sub-repo cost is the dominant factor and scales predictably.

## Set budgets once, not every workflow

Asking the CPO to confirm budgets at every workflow invocation is ceremony fatigue. The discipline is:

1. **At install time** (`/strap-in`'s setup phase): CPO confirms defaults for the workflows they will use. Selected values land in `MEMORY.md` AND in `.claude/strap/state/usage.yaml`.
2. **Subsequent workflows**: pull defaults from `MEMORY.md` silently. The CPO sees a budget prompt ONLY if they explicitly want to override for a specific run, or if a workflow's prior history suggests the defaults need adjustment.

The user-facing prompt is single per install. Repeated prompts on every workflow invocation is a defect.

**Install-time scope:** `/strap-in` prompts the CPO for the **onboarding workflow's** budgets specifically (the workflow about to run). The remaining workflows' defaults from the table above are written to `MEMORY.md` silently as starting points alongside the CPO's onboarding pair. The CPO can revise any of them any time via [`/revise-token-budget`](../../skills/revise-token-budget/SKILL.md). This keeps the install conversation focused on what the CPO is actually about to do without forcing decisions about workflows they may not run for weeks.

## Who watches what

The watching responsibility splits between dev-lead and CPO:

| Watcher | Watches | Mechanism |
|---|---|---|
| Dev-lead | Per-specialist consumption + session aggregate | Specialists self-report `tokens_used: ~XXk` in finishing summaries; dev-lead sums per-agent and session-aggregate; tracks in `usage.yaml` |
| CPO | Dev-lead's own consumption | The CPO runs `/usage` periodically and watches their context window. Dev-lead cannot introspect its own token use. CPO interjects with "checkpoint now" when appropriate. |

When the CPO interjects, dev-lead immediately stops the current workflow phase, runs `/context-prep`, and instructs the CPO on the `/clear` + fresh-session resume.

## Specialist self-reporting protocol

Every specialist's finishing summary, regardless of workflow, includes a single line:

```
tokens_used: ~XXk
```

This is an estimate. Specialists report their best-guess based on the work they did. Dev-lead uses this for accounting; the imprecision is acknowledged and buffered by the 60% threshold.

This requirement is in [`../rules/agent-ops.md`](../rules/agent-ops.md) and [`../rules/agent-devs.md`](../rules/agent-devs.md) as a team rule. Specialists do not have to remember it per-dispatch; it is baked into the dispatch contract.

## State file shape

Runtime budget state lives at `.claude/strap/state/usage.yaml`. The shape:

```yaml
budgets:
  strap-in:           { per_agent: 200000, session_aggregate: 1000000 }
  strap-refresh:      { per_agent: 200000, session_aggregate: 1000000 }
  decompose-feature:  { per_agent: 150000, session_aggregate: 750000 }
  execute-sprint:
    per_agent: 500000
    session_aggregate: 2000000
    agent_overrides:                          # optional; appears when /revise-token-budget --agent has been used
      backend-engineer: { per_agent: 750000 }
      security-reviewer: { per_agent: 300000 }
  execute-sprint-full-auto:
    per_agent: 1000000                        # specialists dispatched across multiple Features per workflow instance
    session_aggregate: 5000000                # 60% checkpoint fires at 3M; covers 3-5 Feature equivalent /execute-sprint motions
  refine-pr:          { per_agent: 100000, session_aggregate: 500000 }
  fix-bugs:           { per_agent: 200000, session_aggregate: 1000000 }
  quick:              { per_agent: 200000, session_aggregate: 1000000 }
  create-test-plan:   { per_agent: 200000, session_aggregate: 1000000 }

session:
  workflow: strap-in
  workflow_instance: 2026-05-14-onboarding   # unique id for this workflow invocation
  started_at: 2026-05-14T19:00:00Z
  specialists_used: 234500                    # session aggregate so far

agents:
  backend-engineer:
    used_in_current: 45000                    # per-agent budget consumed so far in this workflow instance
    last_dispatch: 2026-05-14T18:30:00Z
  frontend-engineer:
    used_in_current: 67000
    last_dispatch: 2026-05-14T18:45:00Z
  database-engineer:
    used_in_current: 22000
    last_dispatch: 2026-05-14T18:50:00Z
```

The `agents.<name>.used_in_current` resets when a new workflow instance starts. The historical `last_dispatch` timestamps survive.

The file is source-controlled so the CPO can audit and so the state survives across sessions.

### Per-agent overrides

A workflow's `budgets.<workflow>.agent_overrides.<agent>.per_agent` (when present) overrides the workflow's `per_agent` default for that specific specialist on that specific workflow. The override is *additive* to the schema -- a workflow with no overrides has no `agent_overrides` block, and a workflow with overrides for only some specialists falls back to `per_agent` for the rest.

The override exists for the case where one specialist needs a different ceiling than its peers on the same workflow -- for example, `backend-engineer` handling a complex Feature implementation under `/execute-sprint` may need a higher per-agent budget than `security-reviewer` reviewing the same Feature. The override expresses that asymmetry without inflating every specialist's per-agent on the workflow.

**Dispatch-time resolution.** When the dev-lead dispatches a specialist within a workflow's run, the effective per-agent budget for that specialist is:

```
budgets.<workflow>.agent_overrides.<agent>.per_agent
  if present, else
budgets.<workflow>.per_agent
```

The session aggregate has no per-agent dimension and is read directly from `budgets.<workflow>.session_aggregate` regardless of overrides.

**Where this is honored.** Every budget-aware skill -- `/strap-in`, `/strap-refresh`, `/decompose-feature`, `/execute-sprint`, `/refine-pr`, `/fix-bugs`, `/quick` -- applies the override-resolution rule at dispatch-time budget pull. The per-specialist brief and per-agent tracking use the resolved value, not the unfiltered default.

**Setting and clearing overrides** flows through [`/revise-token-budget --agent <agent-name>`](../../skills/revise-token-budget/SKILL.md). Manual edits to the `agent_overrides` block work but bypass the audit trail; the skill is the canonical surface.

## Checkpoint mechanics

When dev-lead's sum of specialist consumption reaches 60% of the session aggregate budget (default: 600K out of 1M for `/strap-in`), dev-lead:

1. Reports to the CPO: "Specialists have consumed ~600K of the 1M session aggregate. Recommending checkpoint."
2. Runs `/context-prep <workflow-instance>` to capture phase progress in a continuation file.
3. Instructs the CPO: "Run `/usage` to confirm your own window; then `/clear` and start a fresh session. On resume, run `/context-fetch <workflow-instance>` first."

The CPO confirms or overrides before any of this happens. If the CPO overrides ("I have plenty of room, push through"), dev-lead proceeds and notes the override in the continuation for future sessions to learn from.

## Why 60%?

The threshold leaves headroom for synthesis. After a checkpoint, the new session starts with:

- The continuation runbook (~5-10K)
- The project profile and per-agent rules/memory loaded (~10-20K)
- Dev-lead's own ramp-up reading

Plus space for the next phase of work. 60% as the trigger leaves ~40% buffer; in practice the buffer covers the synthesis cost cleanly.

This is tunable. If 60% proves too conservative (frequent unnecessary checkpoints) or too aggressive (sessions blow out before checkpoint), revise via [`/revise-token-budget`](../../skills/revise-token-budget/SKILL.md) (which adjusts the session-aggregate budget; the 60% trigger is computed from it).

## Honest limitations

- **Estimation imprecision**: specialist self-reports are estimates. Real consumption could be 10-30% off in either direction. The 60% threshold buffers some of this.
- **Dev-lead's own consumption is invisible**: I cannot introspect my own token use. The CPO's `/usage` watch is the only signal. If the CPO forgets to check, the session can blow out.
- **No precise dispatch boundaries**: a specialist's "tokens used" includes its prompt and its tool calls; we cannot perfectly attribute. We accept the approximation.
- **The dev-lead-tracked session aggregate does NOT include the dev-lead's own usage**. The CPO sees the true aggregate via `/usage`; the dev-lead's tracked aggregate is "specialists only."

These limitations are real. The budget discipline still gives the CPO operating constraints they otherwise wouldn't have -- it just doesn't give them perfect ones.

## References

- Onboarding design: [`./onboarding-design.md`](./onboarding-design.md)
- Team rules (dispatch contract for specialist self-reporting): [`../rules/agent-ops.md`](../rules/agent-ops.md), [`../rules/agent-devs.md`](../rules/agent-devs.md)
- Dev-lead guardrails (budget tracking responsibility): [`../rules/agents/dev-lead.md`](../rules/agents/dev-lead.md)
- Dev-lead's CPO-preferences memory: [`../memory/MEMORY.md`](../memory/MEMORY.md)
- Runtime state file: `.claude/strap/state/usage.yaml`
- CPO budget-tuning skill (canonical revision surface; the source of audit-trailed budget changes): [`../../skills/revise-token-budget/SKILL.md`](../../skills/revise-token-budget/SKILL.md)
