# agent-ops shared rules

These rules apply to every agent on the agent-ops team: req-lead, spec-lead, designer, tech-writer, sprint-planner, dora-analyst, and ux-test-engineer.

Stack-specific values (build commands, frameworks, namespace conventions, tenancy model) live in [`.claude/strap/contexts/project-profile.md`](../contexts/project-profile.md), not this file. Every agent reads the project profile on every invocation; the dev-lead curates it. This file carries cross-cutting rules that are stable across stacks.

## The super-pair

Every STRAP session is operated by the CPO (human) and the dev-lead (top-level Claude session) as a super-pair. The agent-ops specialists are dispatched by the dev-lead via `Task` / `Agent` and report findings back. Specialists do not talk to the CPO directly and do not spawn other agents.

See [`CLAUDE.md`](../../CLAUDE.md) for the full identity model.

## DevOps integration

Skills and agents call work-tracking, iteration, and documentation operations through the connection profile persisted at `.claude/strap/state/devops-connection.yaml`. The profile is written once by `/connect-devops-project` and records the active host, the logical-to-host work-item type mapping, field formats, state transitions, capability declarations, and per-operation templates. Operations are referenced as `{{adapter.<surface>.<operation>}}` (work-tracking, iteration, documentation surfaces); the runtime resolves them via the profile's `operation_templates` block.

Never call host-tool CLIs directly. If an operation fails with `unsupported.operation` (the host declared the operation unavailable when the connection was probed), the calling skill is responsible for either degrading gracefully or surfacing a clear actionable error.

For details:

- **Connection profile schema**: [`.claude/skills/connect-devops-project/SKILL.md`](../../skills/connect-devops-project/SKILL.md) (canonical v2.2 schema with extension fields and operation templates).
- **Per-project connection state**: `.claude/strap/state/devops-connection.yaml` (written by `/connect-devops-project`; read by skills and agents; never hand-edited).

## Shell environment rules

These apply to every agent running in the Claude Code harness, regardless of host project. They are properties of the harness, not the adopter's stack.

- **JSON parsing in shell pipelines**: use `node -e`. Never `python` / `python3` / `python -c`.
- **Temp files on Windows**: `$HOME/AppData/Local/Temp/`, not `/tmp/`. Linux and macOS use `/tmp/` as normal.
- **Path conversion in Git Bash on Windows**: prefix with `MSYS_NO_PATHCONV=1` when passing `/`-leading paths to native CLIs.
- **Long descriptions for work items and PRs**: write the formatted content (HTML or Markdown per the adapter's declared format) to a file via the `Write` tool first, then pass the absolute path's contents to the adapter operation. Do NOT use shell heredocs for formatted content.
- **Avoid `cd <path> && <cmd>` compound commands**: the `cd` persists in the Bash tool's CWD state across calls, which (a) triggers permission prompts on the CPO side due to the harness's compound-`cd` audit rule, and (b) silently drifts the CWD for subsequent relative-path probes from the same tool context. Prefer single commands with absolute paths: `head -80 <REPO_ROOT>/path/to/file.md` rather than `cd <REPO_ROOT> && head -80 path/to/file.md`. For `grep` / `find` scoped to a directory, pass the directory as an explicit argument: `grep -rn "pattern" <REPO_ROOT>/subdir` rather than `cd <REPO_ROOT>/subdir && grep -rn "pattern" .`. The dispatch brief from the dev-lead always includes `REPO_ROOT` as an absolute path; use it.

## Project context

Project identity, company, host, organization, project, area path, team, and epic IDs all live in [`.claude/strap/contexts/project-profile.md`](../contexts/project-profile.md) (Identity section + DevOps integration section). The dev-lead curates that file during `/strap-in`; every agent reads it on every invocation. The team rules deliberately do not duplicate those values -- a single source of truth is part of the v2 discipline.

## Work item creation standards

Every work item created by an agent-ops agent must include:

- **Logical type**: one of `requirement`, `spec`, `feature`, `story`, `task`, `bug`, `enhancement`. The connection profile's `mapping.work_item_types` block resolves logical to host-tool reference name.
- **Area path**: from `project-profile.md`'s DevOps integration section, or a specific child area path declared by the calling skill.
- **Iteration path**: current sprint iteration via `{{adapter.iteration.get_current}}`. May be unset for backlog items.
- **Assigned to**: as specified by the CPO (via the dev-lead), or unassigned if not yet determined.
- **Description**: in the format the connection profile declares via `mapping.field_formats.description` (HTML for Azure DevOps, Markdown for GitHub Issues, etc.). Authored via the `Write` tool to a temp file, then passed to the operation template.

## Behavioral rules

These rules are STRAP-wide conventions. They ship verbatim and do not vary per installation.

1. **Be critical, not agreeable.** If something is wrong, say so directly. Challenge flawed approaches; do not paper over them.
2. **Never use emojis.** No emojis in any communication, work item, wiki page, or documentation.
3. **No inline comments.** Use structured documentation. Document WHY, not WHAT.
4. **Human authority.** Specialists prepare and recommend; the dev-lead synthesizes; the CPO decides and approves. Never make priority calls, accept specifications, or close requirements without CPO direction (via the dev-lead).
5. **Traceability.** Every artifact links back to its source. Specs link to Requirements. Features link to Specs. Test plans link to Specs.
6. **Quality over speed.** Thoroughness matters. Incomplete Specs cause rework downstream; incomplete test plans miss bugs in production.
7. **Single curator.** Only the dev-lead writes to rules and memory files. Specialists report findings; the dev-lead decides what gets persisted.
8. **Specialists do not talk to the CPO directly.** All CPO interaction routes through the dev-lead.
9. **One level of fan-out, via team primitives.** When the dev-lead dispatches multiple agent-ops specialists in parallel (e.g., spec-lead and designer working on different sections concurrently), it uses `CreateTeam`. Specialists do not spawn other agents.
10. **Report tokens consumed.** Every finishing summary from a specialist includes a single line `tokens_used: ~XXk` (estimate). The dev-lead sums per-agent and session-aggregate consumption against the budgets configured in [`.claude/strap/memory/MEMORY.md`](../memory/MEMORY.md). See [`../contexts/budget-discipline.md`](../contexts/budget-discipline.md) for the full model.
11. **Deliver findings via `SendMessage` when dispatched by `CreateTeam`.** Team-channel dispatch is one-way at start; the specialist receives the brief but must explicitly call `SendMessage` with the structured findings (plus the `tokens_used` line as the last line) before the session ends. Failing to call `SendMessage` leaves the dev-lead waiting indefinitely on a teammate that has finished its work. Foreground `Task` / `Agent` dispatch returns results via the tool result automatically; only `CreateTeam` requires the explicit `SendMessage`.
12. **Code immutability during discovery.** When dispatched by `/strap-in` or `/strap-refresh`, agent-ops specialists (designer, ux-test-engineer) operate against a read-only tools palette. The adopter's code is not modified during onboarding; only files under `.claude/strap/` may be written.

## Epics reference

Host epic IDs that anchor STRAP's logical work-item types live in [`project-profile.md`](../contexts/project-profile.md)'s DevOps integration section. The dev-lead curates them during `/connect-devops-project` (or `/strap-in` for STRAP-on-STRAP). Adopters with no epic-anchoring convention can omit the section; the pipeline degrades to non-hierarchical work-item creation.

## Reference documents

- **Identity model and persistence stack**: [`CLAUDE.md`](../../../CLAUDE.md)
- **Project profile (stack-specific values)**: [`.claude/strap/contexts/project-profile.md`](../contexts/project-profile.md)
- **Onboarding design**: [`.claude/strap/contexts/onboarding-design.md`](../contexts/onboarding-design.md)
- **Budget discipline**: [`.claude/strap/contexts/budget-discipline.md`](../contexts/budget-discipline.md)
- **Connection profile schema**: [`.claude/skills/connect-devops-project/SKILL.md`](../../skills/connect-devops-project/SKILL.md)
- **Per-agent guardrails**: [`.claude/strap/rules/agents/`](./agents/)
- **Per-agent memory**: [`.claude/strap/memory/agents/`](../memory/agents/)
