---
name: /context-fetch
description: Load cross-session continuation context. With no argument, list active and parked continuations under .claude/strap/contexts/continuations/ with topic, status, last_updated, last_author, and one-line summary, sorted most-recent first. With a topic argument, present the full continuation as session-startup context.
allowed-tools: Read, Bash, Glob
---

# /context-fetch

## Purpose

Resume work from a prior session by loading the relevant continuation file. First action of any session that resumes prior work. Companion to [`/context-prep`](../context-prep/SKILL.md).

## Owner

Any human or agent starting or resuming a session.

## Inputs

- `$ARGUMENTS`: optional topic slug.
  - **No arg**: list mode -- enumerate active and parked continuations for the human to pick.
  - **`all`**: list mode -- include `done` status as well (default hides it).
  - **`<topic>`**: load mode -- present the full continuation body for that topic.

## Workflow

### Step 1: Resolve mode

- `$ARGUMENTS` empty: list mode, default filter (active + parked).
- `$ARGUMENTS` is `all`: list mode, no filter (active + parked + done).
- Otherwise: load mode, treat `$ARGUMENTS` as topic slug.

### Step 2A: List mode

- Glob `.claude/strap/contexts/continuations/*.md`.
- For each file:
  - Read frontmatter (topic, last_updated, status, last_author).
  - Read the first paragraph of the body for a summary line.
- Filter by status:
  - Default: include `active` and `parked`; exclude `done`.
  - With `all` argument: include all statuses.
- Sort by `last_updated` descending (most recent first).
- Format as a table:

```
TOPIC                          STATUS    LAST UPDATED              LAST AUTHOR    SUMMARY
strap-in-refactor              active    2026-05-19T05:30:00Z      cpo-handle    v2.2 foundation refactor; Parafin E2E passed; #38925 in flight...
v22-cleanup                    parked    2026-05-18T22:00:00Z      cpo-handle    v1 debt cleanup four-stage plan; staged plan in #38925...
connect-flow-ux                parked    2026-05-19T05:00:00Z      dev-jordan    Custom Map UX surfaced during Parafin connect run...
```

- If the list is empty:

```
No active continuations.
Use /context-prep <topic> to create one.
```

### Step 2B: Load mode

- Path: `.claude/strap/contexts/continuations/<topic>.md`.
- If absent:

```
No continuation for topic '<topic>'. Try /context-fetch (no arg) to list available topics.
```

- If present:
  - Read the file.
  - Validate frontmatter is parseable. If malformed, surface the parse error and refuse to load.
  - Present a header line summarizing the continuation:

```
Continuation: <topic>
Status:       <status>
Last updated: <last_updated>
Last author:  <last_author>
Linked WIs:   [<ADO IDs>]
---
```

  - Present the body verbatim (the eight sections from "What this is" through "Source-of-truth pointers"). The reading agent or human consumes this as session-startup context.

## Outputs

- **List mode**: table of continuations on stdout.
- **Load mode**: header summary plus full body printed; the receiving agent or human now has the topic's continuation as immediate working context.

## Quality gates

- **List mode**: any continuation files present render without crashing on malformed frontmatter (skip with a warning rather than abort).
- **Load mode**: frontmatter parses; body is presented in full; no content is silently truncated.

## Failure handling

- **Continuations directory missing**: print `No continuations directory at .claude/strap/contexts/continuations/. None to fetch.` Do not auto-create.
- **Specific continuation file missing in load mode**: surface the path; suggest `/context-fetch` no-arg.
- **Frontmatter parse error in list mode**: skip the malformed file; print one warning line per skipped file.
- **Frontmatter parse error in load mode**: refuse to load; surface the parse error and the path; suggest manual repair or `/context-prep <topic>` to overwrite.

## References

- Format specification: [`.claude/strap/contexts/continuation-format.md`](../../strap/contexts/continuation-format.md)
- Companion skill: [`/context-prep`](../context-prep/SKILL.md)
- CLAUDE.md note on session-start guidance
