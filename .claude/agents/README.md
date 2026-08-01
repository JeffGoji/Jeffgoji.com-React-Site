# Agents

STRAP ships 15 canonical agents organized into two teams. The roster is fixed -- the same 15 agents ship to every adopter. What varies per installation is the curated persistence stack the dev-lead maintains.

- `agent-ops/` -- planning and coordination team (7 agents): `req-lead`, `spec-lead`, `designer`, `tech-writer`, `sprint-planner`, `dora-analyst`, `ux-test-engineer`.
- `agent-devs/` -- implementation, review, and verification team (8 agents): `dev-lead`, `backend-engineer`, `frontend-engineer`, `database-engineer`, `integration-specialist`, `security-reviewer`, `devops-lead`, `test-strategist`.

Each agent is a single markdown file with frontmatter declaring name, description, model, tools, and color. Agents read their per-agent rules (`.claude/strap/rules/agents/<name>.md`), per-agent memory (`.claude/strap/memory/agents/<name>.md`), the team rules (`.claude/strap/rules/agent-{ops,devs}.md`), and the project profile (`.claude/strap/contexts/project-profile.md`) on every invocation. The persistence stack is curated by the dev-lead under the single-curator rule; specialists report findings, the dev-lead decides what gets persisted.

The dev-lead is the top-level Claude Code session itself, not a subagent. All other agents are dispatched by the dev-lead via `Task` / `Agent` (serial) or `CreateTeam` (parallel) per the dispatch protocol in [`../../CLAUDE.md`](../../CLAUDE.md).
