---
name: /context-prep
description: Create or update a per-topic cross-session continuation runbook at .claude/strap/contexts/continuations/<topic>.md. Surveys current session state (git, ADO active items, files in flight, decisions surfaced in conversation), synthesizes against any existing continuation for the topic, edits in place to remove stale content, and writes a focused 150-300 line runbook that lets a new session pick up productively.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# /context-prep

## Purpose

Capture cross-session continuation context for a specific topic of work. Optimized for end-of-session checkpoints, mid-feature hand-offs between developers, context-window-limit recovery, and multi-developer pipeline hand-offs.

The continuation is **structured**, **bounded** (150-300 lines), and **edited in place** on each update -- stale content is removed, not accumulated.

## Owner

Any human or agent ending a session or handing off work. Most commonly invoked by the CPO -- Claude Pipeline Orchestrator -- or a developer who is about to pause.

## Inputs

- `$ARGUMENTS`: the topic slug (kebab-case). Required.
  - Suggested patterns documented in [`continuation-format.md`](../../strap/contexts/continuation-format.md):
    - `<ado-id>-<slug>` for work-item-traceable hand-offs (e.g., `38400-phase1-foundation`)
    - `<short-slug>` for ad-hoc work without an ADO ID
    - Multi-developer: include receiving developer ID when relevant

If `$ARGUMENTS` is empty, prompt the human for a topic and refuse to proceed without one.

## Workflow

### Step 1: Resolve topic and continuation path

- Slug-normalize the topic argument (lowercase, kebab-case, no spaces, no path separators).
- Compute path: `.claude/strap/contexts/continuations/<topic>.md`.
- Ensure `.claude/strap/contexts/continuations/` exists (create directory if absent).

### Step 2: Survey current session state

Gather these signals before composing or editing:

- **Git state**:
  - Current branch via `git rev-parse --abbrev-ref HEAD`
  - Recent commits on branch via `git log --oneline main...HEAD` (or against the project's default branch)
  - Uncommitted changes via `git status --short`
  - Recently-modified files via `git diff --name-only HEAD~5..HEAD` for context

- **ADO active work items** (when topic is ADO-traceable):
  - Use the active DevOps adapter's `work_item.query` and `work_item.get` operations to fetch state for IDs in the topic slug or in the existing continuation's `linked_work_items`.
  - Reduce to in-flight items (state = Active, Ready, or recently Resolved).

- **Files in flight**:
  - Modified or staged but not yet committed.
  - Recently-committed files relevant to the topic (typically last 1-2 commits).

- **Decisions surfaced in current conversation**:
  - Open questions raised by the human or agent during this session.
  - Choices made (architectural calls, scope cuts, naming conventions).
  - Gotchas discovered (things to NOT do next time).
  - Read backwards through the recent conversation context for these.

- **Source-of-truth pointers**:
  - Canonical files this topic touches. Examples in STRAP: `.claude/strap/contexts/onboarding-design.md`, `.claude/strap/contexts/budget-discipline.md`, agent definitions, schema specs, adapter contracts.

### Step 3: Read existing continuation if present

If `.claude/strap/contexts/continuations/<topic>.md` exists:

- Read it.
- Identify **stale content** to remove:
  - ADO work items now Closed or no longer relevant
  - Decisions now resolved (move to Critical context only if non-obvious; otherwise delete)
  - Files now committed and stable (remove from "Files in flight" unless still under active edit)
  - Blockers now cleared
  - Quick-resume actions already done

- Identify **evergreen content** to preserve:
  - Critical-context gotchas
  - Architectural decisions that still apply
  - Non-obvious invariants that will surprise a fresh reader
  - Source-of-truth pointers that remain canonical

- Plan the edit: full sections to rewrite (Where we left off, Files in flight, Open decisions, Open work items, Quick resume), sections to update conservatively (Critical context, What this is), sections to leave untouched if accurate (Source-of-truth pointers).

### Step 4: Synthesize the continuation

Compose the file per the format spec at [`continuation-format.md`](../../strap/contexts/continuation-format.md).

Frontmatter:

```yaml
---
topic: <slug>
last_updated: <current ISO 8601 UTC timestamp>
last_author: <author identifier; pull from project-profile.md identity section, git config user.name, or prompt the human>
status: active | parked | done
linked_work_items: [<ADO IDs in flight>]
---
```

Body, eight sections in order:

1. **What this is** -- one paragraph, 3-5 sentences orientation
2. **Where we left off** -- precise stopping point, current
3. **Files in flight** -- paths + one-line state per file
4. **Open decisions** -- pending choices with context
5. **Open work items** -- ADO IDs with `#<id> -- <state> -- <title>` format
6. **Quick resume** -- first 3 concrete actions for the next session
7. **Critical context** -- evergreen gotchas, one line each
8. **Source-of-truth pointers** -- canonical files + one-line description

### Step 5: Length and quality discipline

- **Target**: 150-300 lines for the rendered file.
- **Hard ceiling**: 400 lines.
- **Default bias**: shrink, not grow. The new file should be as small or smaller than the previous version unless genuinely new in-flight work warrants growth.
- Stale content is **deleted**, not struck through.
- One sentence per gotcha in Critical context.
- Quick resume is **concrete** (filenames, commands, skill invocations) -- not vague.
- "What this is" stays at 3-5 sentences. If you need more, the topic is too broad.

If the file would exceed the hard ceiling, surface that to the human and propose splitting the topic.

### Step 6: Write atomically

- Write to a temp file first (e.g., `.claude/strap/contexts/continuations/.<topic>.md.tmp`).
- Move atomically into place to avoid leaving a half-written continuation.
- Print a one-line confirmation: `Continuation prepared: <topic> (last_updated: <timestamp>, status: <status>, lines: <count>)`.

## Outputs

- `.claude/strap/contexts/continuations/<topic>.md` -- created or updated atomically.
- Stdout: one-line confirmation.

## Quality gates

- File exists at expected path after the skill completes.
- Frontmatter is valid YAML.
- All eight body sections are present in the documented order.
- Length is within the 400-line hard ceiling; ideally within the 150-300 line target.
- No stale content (cross-checked against current git state and ADO).
- `last_updated` reflects the current invocation, not the previous one.
- `linked_work_items` reflects current Active/recent items, not historical Closed ones.

## Failure handling

- **Topic argument missing**: prompt the human; refuse to proceed.
- **Continuations directory cannot be created**: surface filesystem error; do not write a partial file.
- **Existing file is malformed YAML in frontmatter**: surface the parse error; ask the human whether to repair manually or replace.
- **ADO adapter unreachable** (when querying linked work items): proceed without ADO data; note the missing data in the file with a `<!-- ADO data unavailable; refresh next /context-prep -->` marker; do not block the write.

## References

- Format specification: [`.claude/strap/contexts/continuation-format.md`](../../strap/contexts/continuation-format.md)
- Companion skill: [`/context-fetch`](../context-fetch/SKILL.md)
- CLAUDE.md note on session-start guidance
