---
name: /test-parallel
description: Smoke test the parallel agent team pipeline. Dev-lead iterates active-domain specialists from project-profile.md, dispatches each via CreateTeam in parallel against a bounded read-only scan prompt derived from the domain entry's Source-of-truth + Conventions, collects findings via SendMessage, validates the round-trip end-to-end, and tears the team down. No work-tracking adapter touched. Diagnostic / minimal reproducer for the harness team primitive that /decompose-feature, /execute-sprint, /fix-bugs, and /refine-pr depend on.
allowed-tools: Read, Glob, Grep, Bash, Task
---

# /test-parallel

## Purpose

Validate the Claude Code harness's parallel agent-team infrastructure end-to-end against THIS project without engaging any work-tracking adapter. The dev-lead reads `project-profile.md`'s `Domains` section to identify active specialists, creates a team via `CreateTeam`, dispatches each specialist as a named teammate against a bounded read-only scan prompt derived from the domain entry, collects findings via `SendMessage`, and tears the team down.

This is a smoke test, not a functional test. It confirms that:

- `CreateTeam` returns a healthy team handle.
- Parallel dispatch via `Task` (with the team handle) spawns each specialist concurrently.
- Each specialist reads its operating context, performs a bounded task, and returns findings via `SendMessage` (the v2.2 team-channel return-path convention).
- The dev-lead can collect every specialist's reply.
- `TeamDelete` cleans up.

The same infrastructure underpins [`/decompose-feature`](../decompose-feature/SKILL.md), [`/execute-sprint`](../execute-sprint/SKILL.md), [`/fix-bugs`](../fix-bugs/SKILL.md), and [`/refine-pr`](../refine-pr/SKILL.md). A failure here predicts a failure there.

No DevOps adapter is involved. The skill never reads from or writes to a host work-tracking tool, never opens a PR, never creates a commit. Every dispatched specialist runs read-only.

**When to invoke:**
- After a harness upgrade (Claude Code version bump, plugin install) when team-primitive behavior may have changed.
- When `/decompose-feature` or `/execute-sprint` reports a team-channel anomaly and you want a minimal reproducer.
- After `/strap-in` curates the persistence stack, as a one-time confidence check.
- After `/strap-refresh` adds new active domains, to confirm the newly-curated specialists round-trip cleanly.

**When NOT to invoke:**
- As a substitute for `/strap-in` or `/strap-refresh`. Real onboarding work exercises the same infrastructure with actual signal -- this skill is for diagnostic isolation, not coverage.
- On a fresh install where `project-profile.md` is still the scaffold (no active domains yet). Run `/strap-in` first.

## Owner

**dev-lead.** Runs directly in the top-level session. Specialists are dispatched as named teammates via `CreateTeam` + `Task` for the duration of the smoke test only.

## Inputs

- `$ARGUMENTS` -- optional whitespace-separated list of specialist agent names to limit the test to a subset. When empty, the skill tests every specialist named in any `Status: active` domain entry in `project-profile.md`. When non-empty, intersects with the active set; rejects any name not in the canonical 15-agent roster with a clear message (no silent drops). Cross-cutting specialists not tied to a domain (e.g., `dora-analyst`, `tech-writer`, `sprint-planner`) can be explicitly named here to include them in the smoke test with a generic-task prompt; they are not in the default set.
- `.claude/strap/contexts/project-profile.md` -- source of truth for active domains and their specialist rosters. Required; sentinel must be stripped (curated state).

## Pre-flight

1. **`project-profile.md` curated.** Must exist and be past the scaffold state (no `STRAP_SCAFFOLD` sentinel). If missing or scaffold, redirect to `/strap-in`.
2. **At least one active domain.** `project-profile.md`'s `Domains` section must carry at least one `Status: active` entry. If none, redirect to `/strap-in` or `/strap-refresh` to activate domains.
3. **Harness team-primitive env present.** The effective resolved env (across `~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json`) must carry `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and a valid `CLAUDE_CODE_SPAWN_BACKEND` (`auto`, `tmux`, or `in-process`). Missing or invalid values typically indicate a hand-edited `settings.json` -- surface an actionable error naming the offending layer and direct the CPO at re-running the installer. The whole point of `/test-parallel` is to validate this primitive; pre-flight refuses to dispatch when the env keys are absent (otherwise the failure would be opaque).

## Workflow

### Step 1: Determine the specialist set

1. Read `project-profile.md`. Parse the `Domains` H2 section; collect every H3 entry where `Status: active`.
2. For each active domain entry, parse the `Specialists` field (comma-separated canonical agent names). Aggregate into a set; deduplicate.
3. **Apply `$ARGUMENTS` filter** (if non-empty):
   - Parse the whitespace-separated list.
   - For each named agent: verify it's in the canonical 15-agent roster (`backend-engineer`, `frontend-engineer`, `database-engineer`, `integration-specialist`, `security-reviewer`, `devops-lead`, `test-strategist`, `designer`, `tech-writer`, `sprint-planner`, `dora-analyst`, `ux-test-engineer`, `req-lead`, `spec-lead`). `dev-lead` is excluded (it never runs as a subagent). Reject unknown names with a clear message.
   - Intersect with the default active set; UNION with any explicitly-named cross-cutting specialists not in any active domain (e.g., `dora-analyst` when explicitly listed).
4. If the resulting set is empty, stop and report. There is nothing to dispatch.

Present the set to the CPO before creating the team:

```
Specialists to dispatch:
| Agent              | Source                     | Bounded scan target                                    |
|--------------------|----------------------------|--------------------------------------------------------|
| backend-engineer   | Domain: api (active)       | <Source-of-truth from api domain>                      |
| frontend-engineer  | Domain: client-ui (active) | <Source-of-truth from client-ui domain>                |
| database-engineer  | Domain: data (active)      | <Source-of-truth from data domain>                     |
| dora-analyst       | $ARGUMENTS explicit        | Generic task (no domain): list configured DevOps epics |
```

Wait for CPO confirmation -- the smoke test creates a real team and burns real tokens; CPO consent gates execution.

### Step 2: Create the team

`CreateTeam(team_name: "test-parallel")` with a description naming the run (e.g., `"smoke test 2026-05-16T22:00"`). On failure, surface the harness error verbatim and stop -- this is what /test-parallel exists to detect.

Confirm to the CPO: team created, specialist count, dispatch beginning.

### Step 3: Dispatch in parallel

Dispatch every specialist in the set in a single batched message (multiple `Task` invocations in one tool call) so the harness spawns them concurrently. Each dispatch carries:

- `subagent_type`: the agent name from the canonical roster.
- `name`: the same agent name (color-badged-teammate visibility convention).
- `team_name`: `test-parallel`.
- The brief: bounded scan prompt derived from the agent's source.

**Per-domain specialist brief shape:**

```
Smoke test dispatch from /test-parallel.

Operating context to read on every invocation (you already do this; this is reminder, not new):
- .claude/strap/rules/agent-<devs|ops>.md (your team rules)
- .claude/strap/rules/agents/<your-name>.md (your guardrails)
- .claude/strap/memory/agents/<your-name>.md (your accumulated tradecraft)
- .claude/strap/contexts/project-profile.md (what this project IS)

Bounded read-only task:
1. From your domain's `Source-of-truth` field in project-profile.md
   (domain: <domain-name>, paths: <paths-list>), pick 3 representative
   files via Glob/Read.
2. For each file, name one convention from the domain entry's `Conventions`
   field that the file exemplifies or (notably) violates.
3. Return findings via SendMessage as a structured report:
   - Files inspected (path list).
   - Convention-match findings (3 short lines: file -> convention).
   - One observation about the codebase's current state in your domain
     (1-2 sentences).
   - tokens_used: ~XXk
   - --- <your-agent-name> SCAN COMPLETE ---

Do NOT write or edit any file. Do NOT touch the host work-tracker.
Do NOT spawn other agents. This is a harness smoke test -- a clean
SendMessage round-trip with the completion marker is the whole goal.
```

**Cross-cutting specialist brief shape (when explicitly named in $ARGUMENTS):**

Generic-task prompt -- no domain Source-of-truth to scan. Pick one tight task per agent:
- `dora-analyst`: list the configured DevOps host name and area path from project-profile.md's DevOps integration section.
- `tech-writer`: list the documentation audiences configured in project-profile.md's Conventions or Docs section (or report "none configured").
- `sprint-planner`: list the sprint cadence and naming convention from project-profile.md's Conventions section.
- `req-lead` / `spec-lead`: list the active domain names from project-profile.md and briefly note (1-2 sentences) which Constituent Parts a typical Spec would cover for this project.
- `security-reviewer`: list the active domains AND whether project-profile.md declares multi-tenancy (yes/no) -- the headline security context.
- `test-strategist`: list the active-domain test commands from project-profile.md's Build and test section.
- `designer` / `ux-test-engineer`: when the `client-ui` domain is active, list the mockup paths (if any) declared in that domain entry; otherwise return "n/a -- client-ui domain not active".
- `devops-lead`: list the connection profile hosts (devops + code) from `.claude/strap/state/*.yaml` filenames (the values are tracked elsewhere; just confirming the files exist).

Every brief ends with the same SendMessage round-trip + completion-marker contract.

The skill body NEVER fabricates a specialist's domain conventions or invents fields. When project-profile.md is missing a `Conventions` field for an active domain, the brief instructs the specialist to report that gap rather than guess.

### Step 4: Collect and validate

Wait for every dispatched specialist's `SendMessage` reply. Per the agent-devs `SendMessage` discipline, a specialist that fails to call `SendMessage` leaves the dev-lead waiting indefinitely -- treat extended silence as a wedged teammate.

For each reply:
- **Completion marker check**: confirm the `--- <agent-name> SCAN COMPLETE ---` line is present.
- **Tokens-used line check**: confirm the `tokens_used: ~XXk` line is present (this is what the dev-lead's budget tracker consumes; its absence indicates a malformed report).
- **Structural check**: confirm the four report sections (files inspected, convention-match findings, observation, plus the metadata lines) are all present.

A specialist passes the smoke test when all three checks pass. A specialist fails when any check fails or the reply never arrives.

### Step 5: Report

Present results to the CPO in two parts.

**Pipeline validation:**

```
CreateTeam:        pass | fail
Parallel dispatch: <N> specialists dispatched concurrently
Round-trip:        <M>/<N> specialists returned via SendMessage
Completion marker: <K>/<N> specialists carried the marker
Tokens-used line:  <L>/<N> specialists carried the line
TeamDelete:        pass | fail (after teardown in Step 6)

Verdict: <healthy | partial-failure | wedged>
```

**Per-specialist summary:**

```
| Agent              | Round-trip | Marker | Tokens line | Excerpt (2-3 lines from findings)              |
|--------------------|------------|--------|-------------|------------------------------------------------|
| backend-engineer   | pass       | pass   | pass        | <2-3 lines from the agent's structured report> |
| frontend-engineer  | pass       | pass   | pass        | <excerpt>                                      |
| database-engineer  | fail       | n/a    | n/a         | no reply within timeout                        |
```

For each specialist failure: include the error or empty-output indicator, plus a one-line hint (e.g., "no SendMessage reply within timeout -- specialist likely wedged; recommend /team-cleanup before re-running").

### Step 6: Tear down

`TeamDelete(team_name: "test-parallel")` to remove the team and its task list.

When `TeamDelete` fails or hangs, recommend [`/team-cleanup`](../team-cleanup/SKILL.md) to recover (the documented primitive for wedged team state).

Exit with a final one-line verdict to the CPO:

- **healthy**: every specialist round-tripped cleanly. The harness team primitive is operational on this installation. `/decompose-feature`, `/execute-sprint`, `/fix-bugs`, `/refine-pr` will use the same infrastructure with real work-item content.
- **partial-failure**: some specialists round-tripped, others did not. The per-specialist table identifies which; recommend re-running for the failing ones (often transient) and `/team-cleanup` if a re-run also fails.
- **wedged**: `TeamDelete` could not clean up, or a majority of specialists never returned. Recommend `/team-cleanup` and investigation of the harness env (re-run the installer to reset `settings.json` env keys if they were hand-edited).

## Outputs

- A pass / fail verdict per pipeline stage (`CreateTeam`, dispatch, round-trip, marker, tokens line, `TeamDelete`).
- A per-specialist completion table with scan excerpts.
- A single one-line verdict (`healthy` / `partial-failure` / `wedged`).
- No host work-tracking artifacts, no PRs, no commits, no filesystem writes outside what the harness team primitive itself emits during the run.

## Quality gates

The skill is successful when all of the following hold:

- `project-profile.md` was curated (sentinel stripped) at pre-flight.
- At least one active-domain specialist was identified (or `$ARGUMENTS` explicitly named cross-cutting specialists).
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and a valid `CLAUDE_CODE_SPAWN_BACKEND` were present in the effective resolved env.
- The CPO confirmed the dispatch set before `CreateTeam`.
- `CreateTeam` and `TeamDelete` succeeded.
- Every dispatched specialist either (a) round-tripped with the completion marker AND the tokens-used line, or (b) was reported as failed with a clear hint.
- The CPO received the verdict line (`healthy` / `partial-failure` / `wedged`).
- No production code was modified; no work-tracking host was touched.

## Failure handling

- **`project-profile.md` missing or scaffold**: redirect to `/strap-in`.
- **No active domains**: redirect to `/strap-in` or `/strap-refresh`.
- **`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` or `CLAUDE_CODE_SPAWN_BACKEND` missing/invalid**: surface the offending settings layer; direct the CPO at re-running the installer.
- **`$ARGUMENTS` names an agent not in the canonical 15-agent roster**: reject with the offending name; list valid names.
- **`CreateTeam` fails**: surface the harness error verbatim; stop. No dispatch attempt.
- **A specialist's `Source-of-truth` paths don't exist on disk**: include the gap in the brief (the specialist will report it back -- this is information, not a hard failure).
- **A specialist returns malformed output (missing marker, missing tokens line, missing report sections)**: mark `fail` for that specialist with the missing-element indicator. Continue with the others.
- **A specialist never calls `SendMessage` and the dev-lead waits indefinitely**: treat as wedged after a reasonable timeout (per the dev-lead's discretion); proceed to teardown and report `wedged` for that specialist.
- **`TeamDelete` fails or hangs**: recommend `/team-cleanup`; report the final verdict as `wedged`.

## References

- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- dev-lead guardrails: [`../../strap/rules/agents/dev-lead.md`](../../strap/rules/agents/dev-lead.md) -- `CreateTeam`-for-parallel rule.
- agent-devs team rules: [`../../strap/rules/agent-devs.md`](../../strap/rules/agent-devs.md) -- `SendMessage` discipline, tokens-used line convention.
- agent-ops team rules: [`../../strap/rules/agent-ops.md`](../../strap/rules/agent-ops.md).
- Project profile (active domains + specialists): [`../../strap/contexts/project-profile.md`](../../strap/contexts/project-profile.md).
- Production consumers of the same parallel-agent infrastructure: [`../decompose-feature/SKILL.md`](../decompose-feature/SKILL.md), [`../execute-sprint/SKILL.md`](../execute-sprint/SKILL.md), [`../fix-bugs/SKILL.md`](../fix-bugs/SKILL.md), [`../refine-pr/SKILL.md`](../refine-pr/SKILL.md).
- Recovery primitive for wedged team state: [`../team-cleanup/SKILL.md`](../team-cleanup/SKILL.md).
- Onboarding skill (curates the persistence stack so /test-parallel has specialists to dispatch): [`../strap-in/SKILL.md`](../strap-in/SKILL.md).
- Incremental re-discovery (adds new active domains over time): [`../strap-refresh/SKILL.md`](../strap-refresh/SKILL.md).
