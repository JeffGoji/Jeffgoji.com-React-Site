---
name: /memory-refine
description: Curate the persistent memory file for a specialist agent. The CPO directs the change; the dev-lead applies the edit. Used to add learnings, prune stale entries, or restructure how an agent's tradecraft is captured.
allowed-tools: Read, Edit, Write, Bash, Grep
---

# /memory-refine

## Purpose

The mechanism by which the dev-lead curates a specialist agent's persistent memory under CPO direction. Memory is the agent's project-specific tradecraft; this skill is the single sanctioned write path.

Companion to [`/memory-show`](../memory-show/SKILL.md).

## Owner

The dev-lead. The CPO invokes this skill via the dev-lead.

Only the dev-lead writes to memory files. Specialist agents never invoke this skill; they report findings in their finishing summary and the dev-lead decides what gets persisted via this skill or by direct edit.

## Inputs

- `$ARGUMENTS`: agent name (slug matching the canonical roster), optionally followed by a free-form directive describing the refinement.
  - **Agent name only**: dialog mode -- prompt the CPO for the refinement direction.
  - **Agent name + directive**: direct mode -- apply the directive as the refinement.

## Workflow

### Step 1: Resolve target

- Parse `$ARGUMENTS` as `<agent-name> [free-form directive]`.
- Validate `<agent-name>` exists as `.claude/strap/memory/agents/<agent-name>.md`. If not, surface available agents and stop.
- Read the current memory file body.

### Step 2: Resolve the directive

- **Dialog mode** (no free-form directive provided): present the current memory file to the CPO. Ask: "What should change?" The CPO responds with a description of what to add, remove, or restructure.
- **Direct mode**: take the directive from the arguments as-is.

### Step 3: Apply the edit

- Determine the change type:
  - **Add**: a new entry under an existing section, or a new section if the directive describes content that does not fit existing sections.
  - **Update**: edit an existing entry to reflect new understanding.
  - **Remove**: delete an entry that is stale, no longer accurate, or refuted by recent evidence.
  - **Restructure**: reorganize sections when the agent's tradecraft has grown enough that the current shape no longer serves.
- Edit `.claude/strap/memory/agents/<agent-name>.md` via the `Edit` tool.
- Preserve the file's structural pattern (header + categorized sections) unless the directive explicitly calls for a restructure.

### Step 4: Confirm

- Display a diff-style summary of the change:

```
Refined: .claude/strap/memory/agents/<agent-name>.md
Change: <one-line summary>

- <removed lines if any>
+ <added lines>
```

- Ask the CPO to confirm before staging for commit.
- On confirmation, leave the change uncommitted (the CPO commits on their cadence) unless the CPO explicitly directs a commit.

## Outputs

- An edited memory file.
- A diff-style summary on stdout.

## Quality gates

- The file must remain readable as markdown after the edit. Broken frontmatter, broken section structure, or accidental file truncation is a defect.
- Entries should be tight: one paragraph per learning, leading with the rule or observation, followed by the why and the where-it-applies.
- Avoid duplication. Before adding an entry, scan the file for an existing entry that should be updated instead.

## Failure handling

- **Agent file missing**: surface available agents and stop. Suggest checking the canonical roster in `.claude/agents/`.
- **Directive ambiguous**: ask the CPO a follow-up question rather than guessing.
- **CPO declines confirmation**: revert the edit; leave the file as it was.

## When to use this skill vs. direct edit

This skill is the formal path. The dev-lead may also edit memory files directly when:

- The change is implicit (e.g., during routine specialist-report curation at the end of a task).
- The change is small enough that the dialog overhead is not warranted.

When the CPO explicitly invokes `/memory-refine <agent> <directive>`, use this skill. The skill exists to make memory curation visible and intentional when the CPO chooses to direct it.

## References

- Companion skill: [`/memory-show`](../memory-show/SKILL.md)
- Identity model and curator rule: [`CLAUDE.md`](../../../CLAUDE.md)
- Per-agent memory files: `.claude/strap/memory/agents/<agent>.md`
