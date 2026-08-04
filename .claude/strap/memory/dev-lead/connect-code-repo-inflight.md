# Source control connected (2026-08-01)

`/connect-code-repo` complete. Profile at `.claude/strap/state/code-connection.yaml`.

- **Host/repo**: GitHub `JeffGoji/Jeffgoji.com-React-Site` (public, default `main`). CPO account `JeffGoji`, `ADMIN`.
- **Auth**: `gh` CLI session (token in OS keyring). Write access live-validated (branch create/delete write-probe passed).
- **`main` is NOT host-protected.** STRAP feature/task -> reviewed-PR discipline is the only guard. CPO explicitly wants nothing committed to main directly.

**Local reconciliation done.** The working dir was a `main` snapshot (no `.git`). Reconciled in place: `git init`, added `origin`, fetched, `git reset --mixed origin/main`, created branch **`feature/strap-onboarding`**, committed the STRAP install (`.claude/` + `strap-install.ps1`, 164 files) as `f7bb2ac` on top of `origin/main` (`0e29a57`). Tracked site files match main exactly. **Branch PUSHED** to `origin/feature/strap-onboarding` (2026-08-01) after `gh auth setup-git` configured the git credential helper. No PR opened yet; `main` untouched.

**ENVIRONMENT QUIRK -- `gh` not on Bash PATH.** `gh` 2.97.0 is installed at `C:\Program Files\GitHub CLI\gh.exe` but was NOT on the Bash tool's PATH at wire-up (installed mid-session). Invoke by full path `"/c/Program Files/GitHub CLI/gh.exe"` until Claude Code is restarted. The persisted `operation_templates` call `gh` bare, so **restart Claude Code once before running pipeline skills** (/execute-sprint, /fix-bugs, /refine-pr) that shell out to `gh`, or they will fail with `gh: command not found`.
