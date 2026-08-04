---
name: operating-team-inbox-file-substance
description: After CreateTeam multi-specialist dispatch, idle-notification arrives as a conversation turn but full SendMessage body persists to ~/.claude/teams/<team-name>/inboxes/dev-lead.json. Read the inbox file to retrieve specialist substance. Surfaced during 2026-05-26 Blue adopter /strap-in.
metadata:
  type: feedback
---

After dispatching specialists into an agent team via `CreateTeam` and waiting on their final `SendMessage` reports, the dev-lead receives idle-notification preview turns ("1 of N idle", "2 of N idle"...) but the **full message bodies do NOT arrive as separate conversation turns**. The harness persists each full body to disk at `~/.claude/teams/<team-name>/inboxes/dev-lead.json` (or `.../inbox/<message-id>.json` -- inspect the team transcript directory) and surfaces only the preview/summary in the conversation stream. **Read the inbox file to retrieve the substance.**

**Why:** Surfaced during 2026-05-26 Blue adopter `/strap-in`. Dev-lead dispatched 7 specialists, watched all 7 go idle (preview turns arrived as expected), then stalled waiting for "full message bodies as separate teammate-message blocks" per the skill brief. The bodies never arrived as turns. After investigation, the dev-lead discovered a 183K `inboxes/dev-lead.json` file containing all 7 reports verbatim. The pattern is intentional harness behavior, not a bug: 7 × ~95K bodies inline would dump ~660K of context into the dev-lead's turn stream in one batch, forcing premature compression and starving the synthesis phase. By splitting preview-as-turn + body-on-disk, the harness lets the dev-lead choose when to pull substance -- preserving budget headroom for synthesis work.

**How to apply:**

- **After every `CreateTeam` + multi-specialist dispatch, when specialists go idle**: read `~/.claude/teams/<team-name>/inboxes/dev-lead.json` (or list the inbox directory and read each entry) BEFORE concluding the dispatch is complete. The preview turns are notifications, not the data. The disk file is the substance.
- **Use absolute paths when reading the inbox file.** The `~` expansion is fine for the path but the Bash CWD may have drifted (see [[operating-bash-cwd-drift-polyrepo]]); prefer the `Read` tool with the resolved absolute path.
- **Token-budget reckoning still applies.** Reading the inbox file dumps the bodies into the dev-lead's context window. After consuming the substance, immediately synthesize and discard -- do not re-read or re-quote the bodies in subsequent turns. The harness preserved your context headroom by keeping them off the wire; honor that by synthesizing efficiently.
- **For multi-team dispatch** (e.g., `/execute-sprint` cluster mode opens N teams, one per sub-repo): each team gets its own inbox path: `~/.claude/teams/<feature-id>-<sub-repo-slug>/inboxes/dev-lead.json`. Iterate the team names and read each inbox.
- **If a body fails to surface even in the inbox file**: the specialist may have errored before sending its final message. Inspect `~/.claude/teams/<team-name>/tasks/<specialist>/` for the task's working state and any partial output. This is the rare "specialist crashed mid-report" case, distinct from the routine "body persisted to disk" case.
- **Skill briefs to specialists do NOT need to mention this.** Specialists call `SendMessage` normally; the harness handles persistence transparently from their side. Only the dev-lead needs the retrieval tradecraft.
- **Single-specialist dispatch via serial-`Task`** (not `CreateTeam`): full body DOES arrive as a conversation turn -- the inbox-file pattern is a `CreateTeam`-specific harness behavior. Don't conflate the two patterns.

See also: [[operating-bash-cwd-drift-polyrepo]] for the related polyrepo `Bash` CWD drift after `CreateTeam` dispatch (use absolute paths when reading the inbox file).
