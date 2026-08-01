# Dev-lead memory index

This is the dev-lead's persistent, source-controlled memory for this project. It survives sessions, transfers to other developers operating as the CPO, and grows as the project evolves.

Topic files live alongside this index under `.claude/strap/memory/dev-lead/`. Each line in this index is a one-liner under ~150 characters pointing at a topic file with a hook.

## What this is for

The dev-lead reads this every session. It captures:

- **Project shape** -- structural facts that aren't obvious from the file tree
- **CPO preferences and conventions** -- how the CPO wants to be worked with
- **Operating learnings** -- patterns that work or that have caused problems
- **Reference pointers** -- external systems, dashboards, repos the dev-lead should know about

What it does NOT capture: anything derivable from the current code, git history, or the per-agent files. Memory is for what the source cannot tell you.

## Project shape

(empty -- populate as the project shape becomes clear)

## CPO preferences and conventions

- [Budget preferences](dev-lead/cpo_preferences_budgets.md) -- strap-in per-agent 500K, session aggregate 1M. Set 2026-08-01.

## Project shape / in-flight work

- [Source-control wire-up in progress](dev-lead/connect-code-repo-inflight.md) -- GitHub repo JeffGoji/Jeffgoji.com-React-Site, gh-CLI auth pending install+restart; local dir is a snapshot not a clone (needs reconcile); CPO: never commit to main.

## Operating learnings

**Universal absolute-path discipline (applies to the dev-lead session's OWN tool calls, not just dispatched specialists):**

- **Bash**: use absolute paths in single commands. NEVER `cd <path> && <cmd>` -- triggers the compound-`cd` permission audit (CPO prompt-spam) AND drifts the Bash tool's CWD across subsequent calls. Construct the absolute path inline: `git -C <REPO_ROOT>/subdir <cmd>`, `head -80 <REPO_ROOT>/path/to/file`, `grep -rn "pattern" <REPO_ROOT>/subdir`.
- **Write / Edit / Read**:
  - **Absolute paths required.** The harness tools reject relative paths. Construct paths as `<REPO_ROOT>/.claude/strap/memory/agents/<name>.md`, not `.claude/strap/memory/agents/<name>.md`.
  - **Read existing files before Write/Edit.** The harness requires a prior Read of the file in the same session; Writes to existing files without a prior Read fail with "Error writing file" -- a wasted tool round-trip even when the dev-lead recovers correctly on retry. Per-agent memory files SHIP as seed scaffolds (v2.3.6+) -- they EXIST at the adopter install before `/strap-in` ever starts. Batch-Read the active set at the start of the synthesis phase, then curate via Write/Edit.

- [Bash CWD drift in polyrepo /strap-in sessions](dev-lead/operating_bash_cwd_drift_polyrepo.md) -- relative-path Bash probes false-negative after `CreateTeam` fan-out; use absolute paths via `REPO_ROOT`. Surfaced on Pace YesPrime E2E 2026-05-21.
- [Windows shell selection -- PowerShell for native, Bash for portable](dev-lead/operating_windows_shell_selection.md) -- prefer PowerShell tool for `tar.exe`, `Start-Process`, file associations; Bash for Unix-style portable text ops. Three MSYS quirks documented (path conversion, `tar` + `C:`, `npm --prefix`). Surfaced over 2026-05-22 live-adopter v2.3.x exercise.
- [CreateTeam inbox-file substance retrieval](dev-lead/operating_team_inbox_file_substance.md) -- specialist `SendMessage` full bodies persist to `~/.claude/teams/<team-name>/inboxes/dev-lead.json`, NOT to conversation turns; preview-as-turn is just notification. Read the inbox file for substance. Surfaced 2026-05-26 Blue adopter `/strap-in`.

## Reference pointers

(empty -- external systems, dashboards, repos to reference)
