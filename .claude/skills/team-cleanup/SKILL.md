---
name: /team-cleanup
description: Recover from wedged agent-team state by attempting graceful teammate shutdown and falling back to a filesystem wipe of the harness team and task directories.
allowed-tools: Read, Bash
---

# /team-cleanup

## Purpose

Resolve common Claude Code harness team-state issues:

- "Already leading team X" errors when starting a team-using skill.
- "Team X does not exist" errors when invoking team operations.
- Idle teammate notifications that persist after a skill finishes.
- Partially created teams left behind by interrupted skills.

The skill attempts a graceful teammate shutdown first so an orderly `TeamDelete` can succeed. When graceful shutdown is unavailable -- teammates that never spawned, stale on-disk state, interrupted skills -- the filesystem wipe at the end catches whatever was missed. Both paths are preserved; graceful is best-effort but never blocks the fallback.

This is a pure Claude Code harness utility. It does not touch any connection profile or persistence-stack file. It operates only on the harness paths under `~/.claude/teams/` and `~/.claude/tasks/`.

## Owner

Utility skill. Any agent in the harness MAY invoke it. The skill body executes in-place.

## Inputs

None. The skill takes no arguments.

## Workflow

### Step 1 -- Graceful teammate shutdown (best effort)

Check whether any team configs exist on disk:

```bash
ls ~/.claude/teams/ 2>/dev/null
```

When the directory is empty or missing, skip directly to Step 2 -- there are no teammates to shut down.

For each team directory that exists, enumerate the member names from its config and send each member a shutdown request. Read member names using `node -e` (per the harness shell-environment convention -- never use `python`):

```bash
node -e "let f=require('fs'); try { let c = JSON.parse(f.readFileSync(process.env.HOME + '/.claude/teams/<team-name>/config.json','utf8')); (c.members||[]).forEach(m => console.log(m.name)); } catch(e){}"
```

For each member name returned, send a shutdown request via the `SendMessage` tool:

```
SendMessage({
  to: "<member-name>",
  message: {
    type: "shutdown_request",
    reason: "Team cleanup requested by CPO"
  }
})
```

Proceed immediately to Step 2 after sending all shutdown requests. Do NOT wait synchronously for acknowledgments. Teammates that shut down promptly will clear the way for `TeamDelete` to succeed; teammates that do not -- panes that never spawned, agents that crashed, sessions on a different shell -- will be caught by the filesystem wipe in Step 3.

When any subcommand in this step fails -- config missing, JSON malformed, `SendMessage` rejected, team directory empty -- proceed quietly to Step 2 without surfacing an error. Graceful is best-effort by design; the fallback path must remain reliable regardless of what fails above.

### Step 2 -- Attempt TeamDelete

Try `TeamDelete` to gracefully remove the active team and its task list. When it succeeds, the current session's team and tasks are removed cleanly. Skip Step 3 -- there is nothing left to wipe -- and proceed to Step 4.

When `TeamDelete` fails or reports "no active team" or "active member(s)" or similar, proceed to Step 3.

### Step 3 -- Filesystem wipe (nuclear fallback)

Remove every remaining team and task file on disk. This catches orphaned state from Step 2 as well as teammates that never responded to the graceful shutdown request in Step 1:

```bash
rm -rf ~/.claude/teams/* ~/.claude/tasks/* 2>/dev/null
```

Verify the state is clean:

```bash
ls ~/.claude/teams/ 2>/dev/null; ls ~/.claude/tasks/ 2>/dev/null
```

Both listings should return empty.

### Step 4 -- Report

Tell the orchestrator:

> Team state cleaned. When "already leading team" errors or idle notifications persist, exit and restart Claude (`/exit` then `claude --continue`) to clear in-memory session state, then re-run the skill that was failing.

## Outputs

- An empty `~/.claude/teams/` directory.
- An empty `~/.claude/tasks/` directory.
- A short status line confirming cleanup and pointing at the session-restart fallback for residual in-memory state.

No DevOps work items, no PRs, no commits. Pure harness state cleanup.

## Quality gates

The skill is successful when both `~/.claude/teams/` and `~/.claude/tasks/` are empty after Step 3 (or when Step 2's `TeamDelete` succeeded and Step 3 was skipped).

The skill fails -- and reports clearly -- when the filesystem wipe in Step 3 returns a permission error or the directories remain non-empty after the wipe. Surface the error and recommend manual intervention; the skill does not escalate beyond the user's own filesystem permissions.

## References

- [`../test-parallel/SKILL.md`](../test-parallel/SKILL.md) -- the smoke test that exercises the same team infrastructure this skill cleans up.
