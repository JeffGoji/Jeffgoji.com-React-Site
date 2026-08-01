# Continuation Format Specification

Cross-session continuations capture per-topic work-in-flight in a structured markdown file. Each file is independently consumable as session-startup context for a human or agent picking up where someone (possibly someone else) left off.

Continuations are produced by [`/context-prep`](../skills/context-prep/SKILL.md) and consumed by [`/context-fetch`](../skills/context-fetch/SKILL.md).

## File location

```
.claude/strap/contexts/continuations/<topic>.md
```

The topic is a kebab-case slug. The directory holds one file per topic. Multiple developers can have multiple in-flight topics in parallel without collision.

## Naming conventions for topic

- **ADO-traceable**: `<work-item-id>-<short-slug>` (e.g., `38400-phase1-foundation`, `42117-checkout-redesign`). Preferred when the work has a clear backing work item.
- **Free-form**: `<short-slug>` (e.g., `pilot-prep`, `adapter-bug-triage`). Acceptable for ad-hoc work that does not yet have a work item.
- **Multi-developer hand-off**: include the receiving developer's identifier when relevant (e.g., `38400-phase1-handoff-shane`).

Slugs are lowercase, hyphen-separated, no spaces, no path separators.

## Frontmatter schema

```yaml
---
topic: <slug>
last_updated: <ISO 8601 timestamp, e.g., 2026-05-07T14:32:00Z>
last_author: <CPO or developer name -- pulled from project-profile.md identity section or git config>
status: active | parked | done
linked_work_items: [<ADO IDs as integers or strings; empty list permitted>]
---
```

Fields:

- `topic` (required): the slug, matches the filename without `.md`.
- `last_updated` (required): ISO 8601 timestamp of the most recent `/context-prep` invocation against this topic.
- `last_author` (required): identifier of the human or agent that produced this update. Surfaces hand-off provenance.
- `status` (required): one of:
  - `active`: work in flight, not paused
  - `parked`: paused intentionally, expected to resume later
  - `done`: completed; archived; not shown by `/context-fetch` no-arg listing by default
- `linked_work_items` (optional, default empty list): ADO work item IDs this continuation tracks.

## Body sections (in order)

The body has eight sections, in order. Each section has a discipline that keeps the file useful.

### 1. What this is

One paragraph (3-5 sentences). Orients a reader who has never seen this topic before. What problem this work solves, who it serves, why it matters now.

### 2. Where we left off

The precise stopping point as of the most recent `/context-prep`. Concrete and short. Examples:

- "Drafted spec for Feature #1234. Awaiting CPO review on the data-model section."
- "Parafin fresh-install E2E complete; project-docs production landed clean; /file-bugs surfaced 3 findings now in triage."

### 3. Files in flight

A list of files modified, drafted, or under review. One line per file: path + state. Examples:

- `.claude/skills/new-skill/SKILL.md` -- draft, not yet committed
- `.claude/strap/contexts/onboarding-design.md` -- amended budget section, committed in 03ecef7
- `.claude/strap/state/devops-connection.yaml` -- needs revised auth field per recent host probe

### 4. Open decisions

Pending choices that block or shape progress. One bullet per decision with enough context to make the call. Should be small (3-7 items typical). If this section is large, work has stalled.

### 5. Open work items

ADO work item IDs that are currently `Active` or recently `Resolved` and relevant. Format: `#<id> -- <state> -- <title>`. Surfaces what to query in ADO when resuming.

### 6. Quick resume

The first 3 actions a session-resumer should take. Concrete commands or skill invocations, not vague intent. Examples:

1. `git checkout feat/phase7`
2. `/context-fetch <topic>` (this file)
3. Run `az boards work-item show --id 38406 --output json` to confirm Phase 7 epic state

### 7. Critical context

Evergreen gotchas, decisions that are easy to forget, things-not-to-do, surprising invariants. Persistent across updates -- this section is the "what bit me last time" log. One line per item.

### 8. Source-of-truth pointers

Canonical files this work depends on. Lets a resuming session read the same context the original session was working from. Path + one-line description per pointer.

## Length budget

- **Target**: 150-300 lines
- **Hard ceiling**: 400 lines
- A continuation longer than 400 lines means the topic should be split or has accumulated stale content that needs pruning during the next `/context-prep`.

## Update discipline

`/context-prep` is the only authorized writer. When updating an existing continuation:

- **Edit, do not append.** Stale items get DELETED. Resolved decisions move to "what we decided" within Critical context only if non-obvious; otherwise removed entirely.
- **Default bias is shrink, not grow.** A new update should be as small or smaller than the previous one unless genuinely new in-flight work warrants growth.
- **Critical context survives.** Evergreen gotchas, architectural calls, and "things-not-to-do" persist across updates because they remain relevant.
- **Where-we-left-off is always rewritten** to reflect the current stopping point.
- **Files in flight, open decisions, open work items** are recomputed from current state, not merged with previous content.
- **Quick resume is rewritten** to point at the actual next 3 actions.
- **Source-of-truth pointers** stay stable across updates unless the topic's dependencies have changed.

## Lifecycle

```
[create]                    [pause]                       [unpause]
   |                          |                              |
   v                          v                              v
active <----------------> parked <-----------------> active <---> done [archive]
```

`active` and `parked` are visible in `/context-fetch` no-arg listing. `done` is hidden by default; surfaces on `/context-fetch all`.

`done` continuations are kept on disk for audit value. Move to `done` rather than deleting unless the topic was created in error.

## Conflict semantics (v1)

When two developers prepare a continuation on the same topic, the second writer overwrites. The `last_author` field surfaces the change in any subsequent diff. If continuations need merge logic (multi-author concurrent work), that is a v1.1+ enhancement.

For the typical pipeline hand-off, this is sufficient: developer A preps the continuation when handing off, developer B fetches it on session start, B preps again at their own session end. Sequential, not concurrent.
