---
name: /memory-show
description: Display the persistent memory file for a specialist agent. With no argument, list every agent in the roster with a one-line summary of its memory file (size, last-modified, entry count). With an agent name, present the full memory file body.
allowed-tools: Read, Bash, Glob
---

# /memory-show

## Purpose

Surface a specialist agent's accumulated tradecraft for this project. Used by the CPO to inspect what the dev-lead has curated for an agent; used by the dev-lead to ground a curation decision in the current state of the memory.

Companion to [`/memory-refine`](../memory-refine/SKILL.md).

## Owner

The dev-lead. The CPO invokes this skill via the dev-lead.

## Inputs

- `$ARGUMENTS`: optional agent name (slug matching the canonical roster).
  - **No arg**: list mode -- enumerate every agent under `.claude/strap/memory/agents/` with a one-line summary.
  - **`<agent-name>`**: load mode -- present the full memory file body for that agent.

## Workflow

### Step 1: Resolve mode

- `$ARGUMENTS` empty: list mode.
- Otherwise: load mode, treat `$ARGUMENTS` as agent name slug.

### Step 2A: List mode

- Glob `.claude/strap/memory/agents/*.md`.
- For each file:
  - Capture the filename (without `.md`) as the agent name.
  - Read the file to determine: total line count, last-modified timestamp (via `git log -1 --format=%ai -- <path>` or filesystem mtime as a fallback), and whether the file contains any entries beyond the bootstrap template (heuristic: lines that are not headings, not blank, and not the literal placeholder `(empty -- ...)`).
- Sort alphabetically.
- Present as a table:

```
AGENT                     LINES  LAST UPDATED          ENTRIES
backend-engineer          14     2026-05-14 03:30:00   0
database-engineer         14     2026-05-14 03:30:00   0
...
```

- If `.claude/strap/memory/agents/` is empty or missing, surface a clear error pointing the dev-lead at the layout in CLAUDE.md.

### Step 2B: Load mode

- Path: `.claude/strap/memory/agents/<agent>.md`.
- If absent:

```
No memory for agent '<agent>'. Available agents:
<list of agents from .claude/strap/memory/agents/*.md>
```

- If present:
  - Read the file.
  - Present a header line summarizing:

```
Memory: <agent>
Path:   .claude/strap/memory/agents/<agent>.md
Last updated: <git timestamp or mtime>
---
```

  - Present the body verbatim.

## Outputs

- **List mode**: a table on stdout.
- **Load mode**: a header line plus the memory file's body verbatim.

## Quality gates

- The skill does not write to memory; that is `/memory-refine`'s responsibility.
- Malformed memory files are presented as-is rather than reformatted -- the dev-lead diagnoses and corrects via `/memory-refine`.

## Failure handling

- **Memory directory missing**: surface a clear error stating `.claude/strap/memory/agents/` does not exist; point to CLAUDE.md for the layout.
- **Agent not in roster**: list available agents and surface the path checked.

## References

- Companion skill: [`/memory-refine`](../memory-refine/SKILL.md)
- Identity model and persistence stack: [`CLAUDE.md`](../../../CLAUDE.md)
- The dev-lead's own auto-memory index lives at [`.claude/strap/memory/MEMORY.md`](../../strap/memory/MEMORY.md) and is loaded automatically every session; this skill does not duplicate that view.
