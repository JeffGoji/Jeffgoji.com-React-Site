# Rules

Cross-cutting rules that every agent on a given team inherits. STRAP ships two team-rules files:

- `agent-ops.md` -- rules every planning and coordination agent loads (req-lead, spec-lead, designer, tech-writer, sprint-planner, dora-analyst, ux-test-engineer).
- `agent-devs.md` -- rules every implementation agent loads (dev-lead, backend-engineer, frontend-engineer, database-engineer, integration-specialist, security-reviewer, devops-lead, test-strategist).

Team rules are canonical files in v2 (no template-rendering layer). Per-installation values -- project identity, host, conventions, build/test commands, stack particulars -- live in [`../contexts/project-profile.md`](../contexts/project-profile.md), which every agent reads on every invocation. The dev-lead curates that file under the single-curator rule; team rules deliberately do not duplicate adopter-specific values.

Per-agent guardrails (added reactively when something needs preventing) live under [`agents/`](./agents/). Per-agent memory (accumulated tradecraft) lives at [`../memory/agents/`](../memory/agents/). Both are adopter-owned -- the dev-lead curates per the CPO's direction, and `/strap-upgrade` protects them as adopter customization surfaces.

Authoring rules: keep them tech-agnostic, declarative, and short. Anything that would change between portfolio companies belongs in `project-profile.md`, not here. Anything that's specific to one agent's tradecraft belongs in that agent's per-agent rules or memory, not the team rules.
