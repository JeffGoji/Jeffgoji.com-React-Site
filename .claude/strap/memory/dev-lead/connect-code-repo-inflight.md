# Source-control wire-up (in progress) -- resume /connect-code-repo

Started 2026-08-01. `/connect-code-repo` is partway through; `code-connection.yaml` NOT yet persisted (auth not yet available).

**Decisions captured so far:**
- **Host**: GitHub.
- **Repo**: `JeffGoji/Jeffgoji.com-React-Site` (https://github.com/JeffGoji/Jeffgoji.com-React-Site) -- confirmed via unauthenticated read-probe: **public**, not a fork, not archived, **default_branch: main**. 16 branches exist on the remote (main, strap_v1, newSite, several feature branches, and `practice-only-DO-NOT-MERGE`).
- **Auth route**: `gh` CLI. As of 2026-08-01 gh was NOT installed and GITHUB_TOKEN was NOT set. CPO is installing gh + `gh auth login`, then restarting Claude Code (needed for gh to land on the Bash PATH), then re-running /connect-code-repo.

**CPO preference (emphasized explicitly):** never commit to `main` directly -- all work on `feature/*` / `task/*` branches merged into main only via reviewed PR. (This is STRAP's default, but the CPO called it out specifically -- apply extra care around main.)

**Open practical issue -- local dir is a snapshot, not a clone.** The working directory (`Jeffgoji.com-React-Site-main`) is a GitHub source-download snapshot, NOT a git clone: no `.git/`, no remote, no history, disconnected from the 16 remote branches. The STRAP install (`.claude/`) lives inside this snapshot. Before the pipeline can operate against origin, this needs reconciling -- likely: `git init`, add `origin`, fetch, and put the snapshot (incl. the `.claude/` STRAP tree) onto a NEW non-main working branch (do NOT clobber remote branches; the snapshot may be ahead/behind/diverged -- unknown). Get CPO consent before any git operation that could conflict. Candidate: base a fresh `strap-integration` branch (or reuse `strap_v1`) off the snapshot.

**On resume after restart:** re-run `/connect-code-repo`; probe with authenticated gh (`gh auth status`, `gh repo view JeffGoji/Jeffgoji.com-React-Site`, branch-protection on main, PR API surface); then model + validate + persist. Then handle the local-clone reconciliation above.
