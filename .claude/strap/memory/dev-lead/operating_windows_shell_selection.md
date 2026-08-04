---
name: operating-windows-shell-selection
description: On Windows, prefer the PowerShell tool for native Windows operations (tar.exe, Start-Process, file associations) and reserve the Bash tool for Unix-style portable text operations. The Git Bash MSYS emulation layer has three documented seams that produce counter-intuitive failures when driving native CLIs through it. Surfaced during the 2026-05-22 live-adopter fresh-install + /strap-upgrade exercise that drove v2.3.1 through v2.3.4.
metadata:
  type: feedback
---

When operating on Windows, the dev-lead has two parallel shell surfaces: the `Bash` tool (Git Bash on Windows) and the `PowerShell` tool. The right discipline is to prefer PowerShell for native Windows operations (`tar.exe` extractions, `Start-Process` launches, file-association invocations, anything that goes through a Windows-native CLI) and reserve Bash for Unix-style portable text operations (`ls`, `cat`, `grep`, `find`, simple piping) that work uniformly across platforms. Driving native CLIs through Git Bash exposes the MSYS emulation layer, which has known seams.

**Why:** Surfaced over the 2026-05-22 live-adopter session (fresh-install of the published `install.ps1`, then `/strap-upgrade` to the latest patch). Three concrete quirks all traced to the same root cause -- the MSYS layer interposing between Bash and the native CLI:

1. **`MSYS_NO_PATHCONV=1`** -- already in team rules. Git Bash rewrites `/`-leading arguments to Windows form before they reach native CLIs like `az` and `curl`, breaking commands that take POSIX-style paths intentionally. Adding `MSYS_NO_PATHCONV=1` to the command's environment suppresses the rewrite.

2. **`npm --prefix <path> install` fails with `ENOENT: package.json`** -- npm's `--prefix` sets the install LOCATION, NOT the package.json discovery root; npm walks up from the actual CWD looking for `package.json`. In a session where the parent CWD is the adopter's repo root (no `package.json` there), the command fails. Documented npm behavior; counter-intuitive but stable. The earlier html-render install recipe used `npm --prefix` and broke at first real-world install; the corrected form is `node -e "require('child_process').execSync('npm install ...', {cwd: '<absolute-path>'})"`, which spawns npm as a child process with the cwd set via `child_process` options. Cross-shell, no CWD persistence into the parent tool state, no compound-`cd` audit.

3. **`tar -xzf C:/path/file.tar.gz` fails** -- `tar` treats `C:` as a remote host (legacy `rsh` convention from when `tar over ssh` was a common idiom). Workarounds: `tar --force-local -xzf ...` from Bash (the recovery mid-flight during the live-adopter `/strap-upgrade` Phase 2 extract step), OR invoke `tar.exe` directly via the PowerShell tool (Windows 10+ ships bsdtar at `System32\tar.exe`), which sidesteps MSYS entirely.

**How to apply:**

- **Detect the platform once at session start** via `uname -s`: `MSYS_NT-*` / `MINGW64_NT-*` -> Windows-via-Git-Bash; `Darwin` -> macOS; `Linux*` -> Linux. Use this to branch downstream phases that need platform-specific recipes (tarball extracts, browser launches, etc.).
- **For `tar` extracts on Windows**: prefer the PowerShell tool calling `tar.exe` with backslash paths. Bash with `--force-local` and forward-slash paths is the documented Bash-side fallback in `/strap-upgrade` Phase 2.
- **For browser / file-association launches on Windows**: prefer PowerShell `Start-Process "<absolute-path>"`. The Bash `start "" "<absolute-path>"` form works but has its own quoting quirks (the empty `""` is the title argument). Codified in `/strap-in` Section 9's `Open Summary Document` recipe.
- **For npm against a sub-directory**: use the `node -e "require('child_process').execSync('npm install ...', {cwd: '<absolute-path>'})"` recipe everywhere. Cross-shell, cross-platform, no CWD pollution. Codified in `/strap-in` Section 9's html-render install step.
- **For `/`-leading paths to native CLIs from Bash**: prefix with `MSYS_NO_PATHCONV=1`. Codified in team rules (`agent-devs.md` + `agent-ops.md`).
- **`/strap-upgrade` Phase 2 step 7** (tarball extract) is the highest-friction example -- the platform-aware recipe ships there so adopter dev-leads inherit the discipline via `/strap-upgrade` itself.
- **macOS and Linux are unaffected**: `tar` accepts forward-slash paths cleanly, npm has no MSYS layer, browser launches go through `open` / `xdg-open`. The discipline only matters on Windows; everywhere else, defaults work and the platform branch collapses to the standard Unix recipe.

See also: [[operating-bash-cwd-drift-polyrepo]] (companion operating learning -- absolute paths in Bash probes; same family of cross-platform discipline gaps).
