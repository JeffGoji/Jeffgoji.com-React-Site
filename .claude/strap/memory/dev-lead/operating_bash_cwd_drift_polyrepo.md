---
name: operating-bash-cwd-drift-polyrepo
description: Bash tool CWD drifts under sub-repo paths in long polyrepo `/strap-in` sessions after CreateTeam dispatch; relative-path probes (ls / find / glob) return false negatives while Read/Write with absolute paths still work. Surfaced during 2026-05-21 Pace YesPrime polyrepo E2E.
metadata:
  type: feedback
---

In long polyrepo `/strap-in` sessions, the dev-lead's `Bash` tool CWD can drift into a sub-repo path after `CreateTeam` dispatch (most likely cause: the teammates' working directories influence inherited shell state during the synthesis turn that follows). Relative-path probes from that point forward silently target the wrong root.

**Why:** Surfaced on the 2026-05-21 Pace YesPrime polyrepo E2E. After dispatching ~10 parallel teammates and then dispatching `tech-writer` serial-Task for Section 9, the dev-lead's `Bash` calls had been re-rooted under `yp-kipsy-asgi-server/`. Verifying `ls -la .claude/strap/project-docs/` returned empty even though the directory existed and tech-writer had written three files there. The dev-lead nearly concluded tech-writer had fabricated and was about to self-author the docs in violation of skill discipline. The CPO's `I'm seeing the files under .claude/strap/docs` callout broke the loop; absolute paths then verified correctly. The same root cause also produced a `render-config.json` `ENOENT` because the in-memory config used paths relative to repo root while `render.js` (pre-`basePath`) resolved them relative to the config file's directory.

**How to apply:**

- In `/strap-in`, resolve `REPO_ROOT` as an absolute path once at session start. Use it to construct every Bash verification command, every specialist brief's path references, and every tech-writer / render-config path. The skill body now codifies this in the "Cross-cutting discipline: absolute paths in Bash probes" section. Honor it.
- When a Bash verification probe returns "no files" against what you expect, re-probe with an absolute path before concluding the specialist failed. The `Read` tool's path resolution is independent of Bash CWD and is the most reliable probe when in doubt.
- The render pipeline's `basePath` config field (added 2026-05-22) lets the in-memory config tell `render.js` to resolve source/output paths from `REPO_ROOT` instead of from the config file's directory. Use it in the `/strap-in` Section 9 in-memory config; do not rely on the legacy relative-to-config behavior outside the shipped `welcome.json`.
- Single-repo `/strap-in` sessions historically have not surfaced this -- no `CreateTeam` fan-out triggers the drift. Polyrepo mode is where the discipline matters most.

See also: [[operating_strap_in_polyrepo]] (placeholder for future polyrepo-specific learnings).
