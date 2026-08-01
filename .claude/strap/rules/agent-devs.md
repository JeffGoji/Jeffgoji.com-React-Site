# agent-devs shared rules

These rules apply to every agent on the agent-devs team: dev-lead, backend-engineer, frontend-engineer, database-engineer, integration-specialist, security-reviewer, devops-lead, and test-strategist.

Stack-specific values (build commands, frameworks, namespace conventions, tenancy model) live in [`.claude/strap/contexts/project-profile.md`](../contexts/project-profile.md), not this file. Every agent reads the project profile on every invocation; the dev-lead curates it. This file carries cross-cutting rules that are stable across stacks.

## The super-pair

Every STRAP session is operated by the CPO (human) and the dev-lead (top-level Claude session) as a super-pair. All other agent-devs agents are specialists the dev-lead dispatches via `Task` / `Agent`. Specialists do not talk to the CPO directly and do not spawn other agents. They report findings to the dev-lead, who synthesizes and curates.

See [`CLAUDE.md`](../../CLAUDE.md) for the full identity model.

## DevOps and source-control integration

Two connection profiles drive STRAP's runtime operations:

- **Work tracking** (work items, iterations, documentation): `.claude/strap/state/devops-connection.yaml`, written by `/connect-devops-project`.
- **Source control** (repos, branches, pull requests): `.claude/strap/state/code-connection.yaml`, written by `/connect-code-repo`.

The two profiles often target the same host (e.g., Azure DevOps for both), but they may differ (e.g., Jira for work tracking + Bitbucket for code). Skills and agents call operations through `{{adapter.<surface>.<operation>}}` references; the runtime resolves them via each profile's `operation_templates` block. Never call host-tool CLIs directly. If an operation fails with `unsupported.operation` (the host declared the operation unavailable when the connection was probed), the calling skill is responsible for either degrading gracefully or surfacing a clear actionable error.

For details: see [`.claude/skills/connect-devops-project/SKILL.md`](../../skills/connect-devops-project/SKILL.md) (work-tracking schema) and [`.claude/skills/connect-code-repo/SKILL.md`](../../skills/connect-code-repo/SKILL.md) (source-control schema).

## Shell environment rules

These are harness-level rules, not host-project-level. They apply everywhere.

- **JSON parsing in shell pipelines**: use `node -e`. Never `python` / `python3` / `python -c`.
- **Temp files on Windows**: `$HOME/AppData/Local/Temp/`, not `/tmp/`.
- **Path conversion in Git Bash on Windows**: prefix with `MSYS_NO_PATHCONV=1` when passing `/`-leading paths to native CLIs.
- **Long descriptions**: write to a file via the `Write` tool first, pass the contents to the adapter operation. Do NOT use shell heredocs for formatted content.
- **Avoid `cd <path> && <cmd>` compound commands**: the `cd` persists in the Bash tool's CWD state across calls, which (a) triggers permission prompts on the CPO side due to the harness's compound-`cd` audit rule, and (b) silently drifts the CWD for subsequent relative-path probes from the same tool context. Prefer single commands with absolute paths: `head -80 <REPO_ROOT>/Main/code/SomeFile.h` rather than `cd <REPO_ROOT> && head -80 Main/code/SomeFile.h`. For `grep` / `find` scoped to a directory, pass the directory as an explicit argument: `grep -rn "pattern" <REPO_ROOT>/subdir` rather than `cd <REPO_ROOT>/subdir && grep -rn "pattern" .`. The dispatch brief from the dev-lead always includes `REPO_ROOT` as an absolute path; use it.

## Project context

Project identity, host, organization, project, area path, team, source-control URL, default branch, feature/task branch patterns, and stack values (languages, frameworks, build/test commands, namespace conventions, tenancy model) all live in [`.claude/strap/contexts/project-profile.md`](../contexts/project-profile.md). The dev-lead curates that file during `/strap-in`; every agent reads it on every invocation. The team rules deliberately do not duplicate those values -- a single source of truth is part of the v2 discipline.

## Work item creation standards

Stories and Tasks created by agent-devs agents must include:

- **Logical type**: typically `story`, `task`, `bug`, or `enhancement` (where the connection profile declares enhancement support via `mapping.work_item_types`).
- **Area path**: from `project-profile.md`'s DevOps integration section.
- **Assigned to**: the human assigned to the parent Feature.
- **Original estimate**: required on every Task (human senior-level hours). Skills populate this via the connection profile's `mapping.fields.original_estimate` declaration.

Descriptions follow the format the connection profile declares via `mapping.field_formats.description` (HTML for Azure DevOps, Markdown for GitHub Issues, etc.).

## Pull request creation

Use the source-control connection profile's `operation_templates.pull_request_create`, never a host-tool CLI directly. The operation template handles auth, repo identifier resolution, base / head branch handling, and linking to work items.

When the source-control profile and the work-item profile target different hosts, pass `linked_work_items` to `pull_request_create`. The source-control side records the cross-link via the host's native mechanism (e.g., GitHub's `AB#<id>` notation paired with Azure Boards). Profiles that cannot persist cross-system links declare `pull_request.linked_work_items` unsupported in their capability block; in that case, fall back to a work-item-side `work_item_link(link_type=pull-request)` on the work-tracking profile.

## Behavioral rules

These rules are STRAP-wide conventions. They ship verbatim and do not vary per installation.

1. **Be critical, not agreeable.** If something is wrong, say so directly.
2. **Never use emojis.** No emojis in any communication, work item, code, or documentation.
3. **No inline comments.** Use structured documentation appropriate to the language (XML doc for C#, JSDoc for TypeScript, docstrings for Python, godoc for Go). Document WHY, not WHAT.
4. **Human authority.** The CPO approves all decompositions, PRs, and state transitions. Specialists prepare and recommend; the dev-lead synthesizes; the CPO decides.
5. **Traceability.** Every Story traces to a Spec section. Every Task traces to a Story. Every PR traces to a Feature.
6. **Centralized test execution.** Only the dev-lead runs the test suite during sprint execution. test-strategist authors and triages tests; specialists write per-domain tests; the dev-lead executes them at PR preparation. A single verifier preserves traceability and avoids duplicated expensive runs.
7. **Single curator.** Only the dev-lead writes to rules and memory files. Specialists report findings; the dev-lead decides what gets persisted.
8. **One level of fan-out, via team primitives.** The dev-lead dispatches specialists; specialists do not spawn other agents. When dispatching multiple specialists in parallel, use `CreateTeam`. Serial `Task` / `Agent` dispatch is reserved for genuinely sequential work where one specialist's output feeds the next specialist's brief.
9. **Report tokens consumed.** Every finishing summary from a specialist includes a single line `tokens_used: ~XXk` (estimate). The dev-lead sums per-agent and session-aggregate consumption against the budgets configured in [`.claude/strap/memory/MEMORY.md`](../memory/MEMORY.md). See [`../contexts/budget-discipline.md`](../contexts/budget-discipline.md) for the full model.
10. **Deliver findings via `SendMessage` when dispatched by `CreateTeam`.** Team-channel dispatch is one-way at start; the specialist receives the brief but must explicitly call `SendMessage` with the structured findings (plus the `tokens_used` line as the last line) before the session ends. Failing to call `SendMessage` leaves the dev-lead waiting indefinitely on a teammate that has finished its work. Foreground `Task` / `Agent` dispatch returns results via the tool result automatically; only `CreateTeam` requires the explicit `SendMessage`.
11. **Code immutability during discovery.** Specialists dispatched by `/strap-in` or `/strap-refresh` operate against a read-only tools palette (no `Write`, no `Edit`). The adopter's code is not modified during onboarding; only files under `.claude/strap/` may be written. The invariant releases when `/connect-code-repo` clears its satisfied gate.

Multi-tenant security is enforced when the project profile declares multi-tenancy. The security-reviewer's tenant-isolation contract is authoritative; any data-access path that bypasses the configured tenancy filter is a defect the security-reviewer must reject.

## Epics reference

Host epic IDs that anchor STRAP's logical work-item types live in [`project-profile.md`](../contexts/project-profile.md)'s DevOps integration section. The dev-lead curates them during `/connect-devops-project` (or `/strap-in` for STRAP-on-STRAP). Adopters with no epic-anchoring convention can omit the section; the pipeline degrades to non-hierarchical work-item creation.

## Reference documents

- **Identity model and persistence stack**: [`CLAUDE.md`](../../../CLAUDE.md)
- **Project profile (stack-specific values)**: [`.claude/strap/contexts/project-profile.md`](../contexts/project-profile.md)
- **Onboarding design**: [`.claude/strap/contexts/onboarding-design.md`](../contexts/onboarding-design.md)
- **Budget discipline**: [`.claude/strap/contexts/budget-discipline.md`](../contexts/budget-discipline.md)
- **Connection profile schemas**: [`.claude/skills/connect-devops-project/SKILL.md`](../../skills/connect-devops-project/SKILL.md), [`.claude/skills/connect-code-repo/SKILL.md`](../../skills/connect-code-repo/SKILL.md)
- **Per-agent guardrails**: [`.claude/strap/rules/agents/`](./agents/)
- **Per-agent memory**: [`.claude/strap/memory/agents/`](../memory/agents/)
