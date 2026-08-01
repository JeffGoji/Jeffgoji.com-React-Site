---
name: /strap-in
description: The super-pair meets the project. The dev-lead reads the codebase, infers the stack, dispatches relevant specialists in parallel for a read-only deep-dive, and curates the persistence stack (project-profile.md, per-agent memory, per-agent rules) so the canonical 15-agent stack comes alive for THIS project. First skill a CPO runs after install.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Skill, Task, AskUserQuestion
---

# /strap-in

## Purpose

`/strap-in` is the first conversation between the super-pair (CPO + dev-lead) and the project. The install script has dropped the canonical `.claude/strap/` tree into the repository; the 15 agents are present but generic; their memory files are empty; the project profile is a scaffold. This skill brings the stack alive for THIS project by:

- reading what is in the repository at a shallow-but-broad scope,
- deciding which specialists matter for the deep-dive,
- dispatching those specialists in parallel via `CreateTeam` with a read-only tools palette,
- synthesizing their findings into the persistence stack (curated by the dev-lead, sole writer),
- handing off to the CPO with pointers to `/connect-devops-project` and `/connect-code-repo`.

The skill is the entrance to the entire pipeline. It is invoked once per project. Subsequent re-discovery happens through [`/strap-refresh`](../strap-refresh/SKILL.md).

Invoke when:

- The install scripts have run, `.claude/` is in place, and the CPO is starting their first Claude Code session in the repository.
- A CPO is resuming an `/strap-in` that was checkpointed mid-flow per [Section 7](#7-phased-discovery-for-large-codebases). Resume goes through [`/context-fetch strap-in-<project-slug>`](../context-fetch/SKILL.md) first; the skill then re-enters at the next phase.

Do NOT invoke when:

- The project has already been onboarded. The skill detects this in [Pre-flight](#pre-flight-already-onboarded-check) and redirects to `/strap-refresh`.

## Owner

The dev-lead. `/strap-in` runs in the top-level Claude Code session that IS the dev-lead per `CLAUDE.md`. There is no subagent orchestrator; the dev-lead executes the workflow directly and dispatches specialists via `Task` / `Agent` (serial) and `CreateTeam` (parallel).

## Inputs

- `$ARGUMENTS` -- optional. Currently recognized flags:
  - `--polyrepo` -- forces polyrepo mode without prompting. Skips the auto-detect 3-way CPO choice in Section 2 and jumps straight to polyrepo umbrella discovery. Useful when the umbrella has its own top-level `.git/` (so auto-detect would not trigger) but contains sub-repos as submodules or sibling clones the CPO wants treated as polyrepo. Reserved for future use: `--debug` (surface dispatch internals) and similar.
- The repository as it stands at invocation. The skill reads what is there; it does not require any pre-population beyond the `.claude/strap/` scaffold the install scripts wrote.
- `.claude/strap/contexts/project-profile.md` -- must exist, either as the install-time scaffold (sentinel-marked) or as a previously-curated file (sentinel-stripped).
- The CPO -- interactively available throughout. Several phases ask for explicit input. Without a CPO at the terminal, the skill pauses at the next interactive gate.

## Workflow

Ten sections in order: Welcome (always first), Pre-flight (state check that may redirect or fail), then the seven conceptual sections from [`onboarding-design.md`](../../strap/contexts/onboarding-design.md), and a closing project-docs production phase (Section 9) that renders the human-facing orientation documents from the curated persistence stack before hand-off (Section 10). Each section has a defined entry condition, internal mechanics, and exit. The dev-lead narrates per the hybrid cadence: inline for major findings, batched at section boundaries.

The Welcome renders unconditionally as the first interaction. Pre-flight runs second and may exit the skill (redirect to `/strap-refresh` on an already-onboarded project; fail on install-incomplete state). The remaining sections assume pre-flight cleared.

### Cross-cutting discipline: absolute paths in Bash probes

Throughout `/strap-in`, the dev-lead's verification probes (`ls`, `find`, `glob`, `cat`, `head`, etc.) MUST use absolute paths -- not paths relative to the working directory. Reason: long polyrepo sessions can drift the Bash tool's CWD into a sub-repo after `CreateTeam` dispatch, causing relative-path probes to return false negatives ("file not found" when the file actually exists at the expected location). The `Read` and `Write` tools use absolute paths natively and are unaffected; only Bash-style probes are at risk.

Resolve an absolute `REPO_ROOT` once at session start (e.g., via `git -C <cwd> rev-parse --show-toplevel`, or the absolute path the CPO invoked the session in) and use it to construct verification commands throughout. Every specialist brief includes `REPO_ROOT` as an explicit field; every "Verification command:" line in a specialist's finishing summary uses absolute paths so the dev-lead can copy-paste verbatim. If a probe returns "no files" against what you expect to be there, re-probe with an absolute path before concluding the specialist failed.

### Cross-cutting discipline: shell selection on Windows

On Windows, prefer the `PowerShell` tool for native Windows operations -- extracting tarballs via `tar.exe`, launching HTML in the default browser via `Start-Process`, anything that touches file associations or native CLIs. Use the `Bash` tool for Unix-style portable text operations (`ls`, `cat`, `grep`, `find`, simple piping) -- these work uniformly across platforms via Git Bash. The Git Bash MSYS emulation layer has known seams when driving native CLIs through it:

- **Path conversion.** Paths beginning with `/` get rewritten before reaching the native CLI (`az`, `curl`, etc.). Prefix with `MSYS_NO_PATHCONV=1` when passing `/`-leading paths. The team rules formalize this.
- **`tar` and `C:` paths.** `tar` treats `C:` as a remote host (legacy `rsh` convention) and fails on `tar -xzf C:/path/file.tar.gz`. Workarounds: `tar --force-local -xzf ...` from Bash, OR invoke `tar.exe` directly via the PowerShell tool (Windows 10+ ships bsdtar at `System32\tar.exe`).
- **`npm --prefix <path>`.** Does NOT read `package.json` from `<path>` -- npm walks up from the actual CWD instead. The canonical recipe is `node -e "require('child_process').execSync('npm install ...', {cwd: '<absolute-path>'})"` (Section 9, the html-render install step, uses this form).

Platform-detection convention used throughout this skill body: `uname -s` returns `MSYS_NT-*` or `MINGW64_NT-*` on Windows-via-Git-Bash, `Darwin` on macOS, `Linux*` on Linux. Resolve the platform once at session start when a downstream phase will branch on it (Section 9's `Open Summary Document` recipe is the canonical example).

### 1. Welcome

Identity-anchored greeting plus an itinerary so the CPO knows the journey before any state inspection happens. Markdown emphasis only -- no Bash banners, no ASCII art, no color tables. Renders unconditionally as the first interaction.

Before rendering, derive a working slug for this run:

1. Read the working directory name via `Bash` (`basename "$PWD"`).
2. Slug-normalize: lowercase, replace whitespace and underscores with hyphens, drop anything that isn't `[a-z0-9-]`, collapse multiple hyphens.
3. If the result is empty (rare; would require a working directory like `.` or `/`), use `strap-run` as a fallback.

Render exactly (text block, not interactive):

```
Welcome to STRAP. I am the dev-lead -- the top-level Claude session in this project. You are the CPO.

This is the super-pair's first conversation in this project. Here is what we will do together:

  1. I'll verify the install state of this project (pre-flight).
  2. You'll confirm operating budgets for this onboarding workflow.
  3. I'll read the project at a shallow scope -- manifests, file-tree shape, recent git activity, CI config.
  4. I'll decide which of the 15 canonical specialists matter for this codebase and dispatch the active ones
     in parallel for a read-only deep-dive.
  5. I'll synthesize their findings into your project's persistence stack -- the curated project-profile.md,
     per-agent memory files, and per-agent rules every agent reads on every invocation thereafter.
  6. I'll hand off to /connect-devops-project (work tracking) and /connect-code-repo (source control) when ready.

Working slug for this run: <slug>.
```

Then surface the Ready gate via `AskUserQuestion` (NOT a free-text prompt):

```yaml
header: "Ready to begin"
question: "Ready to start the onboarding flow?"
options:
  - label: "Yes (Recommended)"
    description: "Proceed to pre-flight with the working slug shown above."
  - label: "Pause"
    description: "Exit cleanly. No state is written; you can re-invoke /strap-in later."
  - label: "Change slug"
    description: "Override the derived slug. I'll ask for the new value before proceeding to pre-flight."
```

The slug appears in continuation filenames, in the workflow-instance id in `usage.yaml`, and influences the `Project name` field written into `project-profile.md` during synthesis.

Handle the response:

- `Yes` -- proceed to Section 2 (pre-flight) with the current slug.
- `Pause` -- exit cleanly. No state is written.
- `Change slug` -- prompt the CPO via a second `AskUserQuestion` with `header: "New slug"`, `question: "What slug would you prefer?"`, and a single option `"Other"` that takes free-text. Validate the result against the slug-normalization rule (kebab-case, `[a-z0-9-]` only); re-prompt if invalid; otherwise confirm inline and proceed to Section 2.
- Free-text "Other" response -- interpret the intent and respond accordingly (e.g., a question about the flow gets answered before re-rendering the gate).

### 2. Pre-flight: already-onboarded check

Now that the welcome has rendered and the CPO has signaled `yes`, verify the install state of `project-profile.md` AND the connection wire-up state. This determines whether `/strap-in` proceeds with a fresh onboarding, recommends the right `/connect-*` skill for a partially-wired project, redirects to `/strap-refresh` for a fully-wired one, or fails fast on an install-incomplete state.

Mechanism: scaffold sentinel in `project-profile.md` plus existence of `.claude/strap/state/{code,devops}-connection.yaml`. The install script writes the scaffold with a literal line:

```
<!-- STRAP_SCAFFOLD -->
```

at the top of the file. The dev-lead strips this sentinel during the synthesis gate ([Section 8](#8-synthesis-gate)) as part of the first real curation.

**Three onboarding phases the pre-flight distinguishes:**

| State of `project-profile.md` | Connections | Phase | Action |
|---|---|---|---|
| File missing entirely | n/a | Install incomplete | Fail; ask CPO to re-run install |
| File present, sentinel at top | n/a | Fresh onboarding | Proceed to Section 3 |
| File present, sentinel absent, empty/whitespace | n/a | Install incomplete (corrupted) | Fail; ask CPO to re-run install or restore sentinel manually |
| File present, sentinel absent, substantive content | At least one connection YAML missing | **Onboarded but partially wired** | Surface unsatisfied gate(s); recommend the right `/connect-*` skill |
| File present, sentinel absent, substantive content | Both connection YAMLs present | Fully onboarded + wired | Redirect to `/strap-refresh` |

**For the fresh-onboarding case**: proceed to Section 3 normally.

**For the install-incomplete cases**: render a structured failure message naming the expected path (`.claude/strap/contexts/project-profile.md`) and the install scripts (`infra/install/install.{ps1,sh}`). Do not proceed.

**For the partially-wired case**: render the gate-status text block, then surface options via `AskUserQuestion`. Only present options that apply (omit options for gates already satisfied).

Render the status text:

```
This project is onboarded -- project-profile.md is past its scaffold state.

Connection gates:
  - source control (.claude/strap/state/code-connection.yaml):  <wired | not yet wired>
  - work tracking (.claude/strap/state/devops-connection.yaml):  <wired | not yet wired>

<N> gate(s) remain.
```

Then surface (presenting only the applicable options):

```yaml
header: "Onboarded, partially wired"
question: "What's next?"
options:
  # Only render this option if code-connection.yaml is missing:
  - label: "Run /connect-code-repo (Recommended when missing)"
    description: "Wire up source control. REQUIRED -- releases the code-immutability invariant and is the operational-mode transition. The pipeline cannot open PRs without this."
  # Only render this option if devops-connection.yaml is missing:
  - label: "Run /connect-devops-project"
    description: "Wire up work tracking. Optional but typical -- enables filing work items in the connected DevOps host."
  - label: "Run /strap-refresh"
    description: "If the codebase has changed since onboarding (new framework, restructure, new conventions), re-discover before connecting. Otherwise pick a connect option above."
  - label: "Pause"
    description: "Stop here. The project state is preserved; you can run any of the above later."
```

After the CPO picks, exit `/strap-in` cleanly. The selected skill is the CPO's next action (or pause is). Do NOT silently invoke the selected skill -- the CPO types the slash command themselves.

**For the fully-wired case**: render the redirect message and exit.

```
This project is fully onboarded -- project-profile.md is past its scaffold state and both
connection profiles are wired (source control + work tracking).

  /strap-refresh        -- incrementally re-discover changes since the last run
  /strap-refresh --full -- redo discovery from scratch

To re-onboard from scratch (e.g., the persistence stack is corrupted), restore the scaffold
sentinel manually and re-invoke /strap-in.
```

Do NOT proceed past pre-flight without an intact scaffold sentinel. The phase-based redirect protects already-curated state from being overwritten by a re-run, AND surfaces the right next step when wire-up is incomplete.

#### Polyrepo detection (fresh-onboarding path only)

After the fresh-onboarding determination clears (sentinel present, file scaffold-state), but before Section 3 (budget prompt), determine whether the install root is a polyrepo umbrella. Polyrepo detection must happen here -- the budget projection in Section 3 needs to know N (the sub-repo count) to compute the additive aggregate.

**Three detection paths, in resolution order:**

1. **Explicit `--polyrepo` flag** present in `$ARGUMENTS`. Skip the prompt; treat as polyrepo umbrella with the sub-repo discovery path described below.

2. **Existing-profile override**. If `project-profile.md` (after sentinel strip in the synthesis gate would land it) already declared a populated `Sub-repos` section in a prior run, the pre-flight redirect to `/strap-refresh` would have fired earlier. So this path is reachable only for fresh onboardings; the override is documented here for symmetry with `/strap-refresh`'s polyrepo-aware mode-resolution.

3. **Auto-detect via depth-1 `.git/` scan**. Default path. Scan `<install-root>/*/.git/` -- one level deep, deliberately. Depth-1 captures peer sub-repos at the canonical layout level while naturally excluding vendored or build-dir `.git/` directories (those live 2+ levels deep under `node_modules/`, `vendor/`, `.venv/`, `target/`, etc., and would never match the `<root>/*/.git/` glob).

   ```bash
   # Mechanism (Bash, depth-1)
   find . -maxdepth 2 -mindepth 2 -type d -name '.git' 2>/dev/null
   ```

   Polyrepo-candidate when:
   - Two or more sub-repos found at depth-1 (each with their own `.git/` directory)

   That's it. The dev-lead does NOT pre-decide based on whether the install root has its own `.git/` or its own source manifests (`.sln`, `package.json`, `pyproject.toml`, etc.). Common ambiguous cases &mdash; a `.sln` at the umbrella that references projects each living in its own git remote; an npm workspace at the umbrella with sub-packages each in their own repo; a parent `pom.xml` with child modules in separate repos &mdash; could be polyrepo OR could be single-project depending on how the team versions and releases the work. The detection just notices "N peer repos at depth-1" and asks; the CPO is the authority on what the structure means. The 3-way choice's "Continue as single-project at root" option is the escape hatch when the CPO knows the umbrella manifest is authoritative.

**When polyrepo-candidate is identified (auto-detect path)**, render the detection narration first, then surface the 3-way CPO choice. Never silently switch modes.

Render:

```
I see N sub-repos at depth-1, each with its own .git/ directory:
  - <sub-repo-1>/
  - <sub-repo-2>/
  - <sub-repo-N>/

<if-root-has-its-own-git>The install root is also a git repo, so this could be a polyrepo umbrella OR a parent project that vendors the sub-repos. Your call.</if-root-has-its-own-git>
<if-root-has-source-manifests>The install root has its own source manifests (<manifest-list>), so this could be a polyrepo with a workspace-style umbrella manifest OR a single project that happens to have nested git repos. Your call.</if-root-has-source-manifests>
<if-root-is-bare>The install root has no top-level git or source manifests &mdash; this looks like a textbook polyrepo umbrella.</if-root-is-bare>

Three ways to proceed:
```

Then surface the 3-way choice via `AskUserQuestion`:

```yaml
header: "Polyrepo detected"
question: "How do you want me to handle this install?"
options:
  - label: "Proceed as polyrepo umbrella (Recommended)"
    description: "Single STRAP install at <install-root>/.claude/. I'll populate a Sub-repos section in project-profile.md with one entry per sub-repo and produce umbrella PROJECT/ARCHITECTURE/STACK docs that capture the system view."
  - label: "Exit and install per sub-repo"
    description: "STRAP exits with guidance. You cd into each sub-repo and run /strap-in separately. STRAP treats each as an independent project; cross-repo orientation lives outside STRAP. Useful when sub-repos have wildly different stacks, ownership, or release cadences. STRAP does NOT loop installs across sub-repos automatically."
  - label: "Continue as single-project at root"
    description: "I proceed in single-project mode against the umbrella root. Discovery treats the umbrella as one project; per-sub-repo signals get mushed into one project-profile.md; accuracy will be sub-optimal. Escape hatch for 'I know what I'm doing' -- e.g., a polyrepo where one sub-repo dominates and the rest are auxiliary scripts."
```

Handle the response:

- `Proceed as polyrepo umbrella` -- record the polyrepo mode and the N sub-repos in a session-local variable (used by Sections 3 onward); proceed to Section 3.
- `Exit and install per sub-repo` -- render an exit message naming each sub-repo and the next-step recommendation; write a terminal entry to `usage.yaml` (`session.completed_at: <ISO-timestamp>`, `session.notes: "polyrepo: CPO chose per-sub-repo installs"`); exit cleanly with a non-error status. The CPO is now expected to `cd` into each sub-repo and run `/strap-in` independently. Do NOT silently invoke `/strap-in` per sub-repo; that's deliberate CPO orchestration.
- `Continue as single-project at root` -- record single-project mode despite the polyrepo signal; narrate the caution explicitly ("Proceeding in single-project mode against the umbrella root. Per-sub-repo signals will be mushed into one project-profile.md; accuracy will be sub-optimal."); proceed to Section 3 with N=1 effectively.
- Free-text "Other" -- common case is a question about how polyrepo mode handles a specific concern; answer, then re-surface the gate.

**When `--polyrepo` flag is present**, skip the prompt entirely. Render: "Polyrepo mode forced by --polyrepo flag. Detecting sub-repos..." Run the depth-1 scan and treat the result as the sub-repo set. If the scan finds zero sub-repos under `--polyrepo`, fail with a structured message ("--polyrepo forced but no depth-1 sub-repos detected at install root").

**When neither auto-detect nor `--polyrepo` triggers** (single-repo install, or umbrella with its own `.git/` and source manifests at top level and no `--polyrepo` override), proceed in single-project mode with N=1. Polyrepo is the exception, not the default.

**Pre-existing sub-repo `.claude/` directories**: any sub-repo that already has its own `.claude/` directory (e.g., from a prior individual STRAP install on that sub-repo, or just the default `settings.local.json` that Claude Code creates) is treated as a bystander. Polyrepo install lives at `<install-root>/.claude/`; sub-repo `.claude/` directories are at non-overlapping paths and never touched. No merge logic, no overwrite, no warning -- they're irrelevant to the umbrella install.

### 3. Budget prompt

Confirm the per-agent and session-aggregate budgets for the onboarding workflow. Per [`budget-discipline.md`](../../strap/contexts/budget-discipline.md), this is the ONLY workflow that prompts for budgets interactively -- subsequent workflows pull defaults silently from `.claude/strap/memory/MEMORY.md`.

#### Polyrepo projection (when applicable)

If Section 2 recorded polyrepo mode with `N >= 2` sub-repos, surface the additive session-aggregate projection BEFORE the budget prompt. Single-repo mode (`N=1`) skips this subsection.

Compute per the [polyrepo aggregation formula](../../strap/contexts/budget-discipline.md#polyrepo-aggregation): `projected_aggregate = session_aggregate + (N - 1) * per_sub_repo_increment` where `session_aggregate = 1M` and `per_sub_repo_increment = 300K` come from the `/strap-in` row of the defaults table.

Render to the CPO:

```
Polyrepo session budget projection:

  N sub-repos detected: <N>
  Base session aggregate (single-repo default):   1M
  Per-sub-repo increment (from budget-discipline): 300K
  Projection: 1M + (<N> - 1) * 300K = <projected> tokens

The math is additive (not a hidden multiplier) -- you see and tune the cost. The
checkpoint trigger at 60% sits at <0.6 * projected> tokens.
```

When the budget prompt below renders the session-aggregate question, **substitute the polyrepo-projected value into the Recommended option** so the CPO sees the right default for their actual session shape. Other options remain (the CPO may still pick a tighter or looser ceiling, just with awareness of the projected cost). If the CPO selects a value lower than the projected aggregate, narrate the implication ("Selected ceiling is below the projected polyrepo aggregate; checkpoints will fire earlier than usual"); proceed but record the gap in `usage.yaml`.

Per-agent budget is NOT scaled by N. Each specialist still has the same internal budget; per-sub-repo dispatch means a specialist may be invoked multiple times in parallel (once per relevant sub-repo), each invocation with its own per-agent allowance. The session aggregate is what covers the sum.

#### The budget questions

Render the budget prompt via a single `AskUserQuestion` call with two questions:

```yaml
Question 1:
  header: "Per-agent budget"
  question: "What is the maximum tokens any single specialist may consume across this onboarding workflow?"
  options:
    - label: "200K (Recommended)"
      description: "Default. Comfortable headroom for a typical codebase deep-dive. Each specialist gets this allowance for the duration of /strap-in."
    - label: "100K"
      description: "Tighter. Suitable for small or very focused codebases."
    - label: "500K"
      description: "Generous. Choose this for large codebases or when you want specialists to be exhaustive."
    - label: "750K"
      description: "Very generous. Choose this for monorepos or when /strap-in will span many sessions."

Question 2:
  header: "Session aggregate"
  question: "What is the maximum aggregate tokens specialists may consume within a single session before I recommend a checkpoint?"
  options:
    - label: "1M (Recommended)"
      description: "Default. The 60% checkpoint threshold sits at 600K -- enough for one full deep-dive wave in most cases."
    - label: "500K"
      description: "Tight. Frequent checkpoints; suitable for cost-conscious runs."
    - label: "2M"
      description: "Spacious. Suitable for codebases where waves run long."
    - label: "5M"
      description: "Very spacious. Suitable for the largest monorepos."
```

Both questions accept `Other` for a custom value via free-text input.

**Polyrepo substitution rule for Question 2.** When polyrepo mode is in effect, the dev-lead substitutes the polyrepo-projected aggregate into the Recommended option's label and description before rendering. For example, with `N=3`: the Recommended option becomes `"1.6M (Recommended, polyrepo N=3 projection)"` with description `"Default for this polyrepo session. 60% checkpoint threshold at ~960K."` The other static options (500K / 2M / 5M) remain as-is for the CPO to over- or undershoot the projection if they want. Single-repo mode keeps the original `"1M (Recommended)"` label unchanged.

When the CPO answers:

1. Write the two selected values to `.claude/strap/memory/MEMORY.md` under a `## CPO preferences` section, with a topic file at `.claude/strap/memory/dev-lead/cpo_preferences_budgets.md` per the auto-memory convention.

2. Write the full budget table to `.claude/strap/state/usage.yaml`. If `.claude/strap/state/` does not exist, create it first (`mkdir -p`). The install script is the canonical owner of this directory; the skill's `mkdir -p` is defensive against installs that pre-date the directory-creation update.
   - The CPO's chosen values under `budgets.strap-in`.
   - The default values for the remaining workflows (`/strap-refresh`, `/decompose-feature`, `/execute-sprint`, `/execute-sprint-full-auto`, `/refine-pr`, `/fix-bugs`, `/quick`) per the defaults table in `budget-discipline.md`. Written silently; the CPO can refine any of them later via `/memory-refine dev-lead`.
   - **Polyrepo auto-scaling for `/strap-refresh` (when applicable)**: when polyrepo mode is in effect (Sub-repos section will be populated with N ≥ 2 sub-repos), apply the [polyrepo aggregation formula](../../strap/contexts/budget-discipline.md#polyrepo-aggregation) to `/strap-refresh`'s `session_aggregate` at default-write time. The `/strap-refresh` row in the defaults table declares `per_sub_repo_increment: 200K`; the polyrepo-scaled default is `session_aggregate_default + (N - 1) * 200K`. Worked example for N=3: `1M + 2 * 200K = 1.4M`. Write the SCALED value to `budgets.strap-refresh.session_aggregate` so subsequent `/strap-refresh` invocations don't trigger a budget-ceiling-bump prompt on every refresh. Per-agent budget for `/strap-refresh` does NOT scale; only session aggregate does. Single-repo umbrellas (N=1) write the base default with no scaling.

3. Initialize the `session` and `agents` blocks in `usage.yaml`:
   - `session.workflow: strap-in`
   - `session.workflow_instance: <ISO-date>-onboarding`
   - `session.started_at: <ISO-timestamp>`
   - `session.specialists_used: 0`
   - `agents: {}`

4. Confirm to the CPO inline: "Budgets set: per-agent <X>, session aggregate <Y>. Defaults for the other workflows recorded silently. You can adjust any of them later via `/memory-refine dev-lead`."

### 4. Initial discovery (shallow)

Read what is in the repository at a shallow-but-broad scope. Target ~20-30K tokens of consumption; this is the dev-lead's own context, not a specialist dispatch.

Targets:

- **Top-level manifest files**: `package.json`, `*.csproj`, `pyproject.toml`, `Cargo.toml`, `pom.xml`, `build.gradle*`, `go.mod`, `Gemfile`, `requirements*.txt`, `composer.json`. Use `Glob` to enumerate; `Read` the ones present.
- **File-tree shape**: one level deep at the root via `Bash` (`ls -la`); then one more level into obvious source directories (`src/`, `apps/`, `packages/`, `services/`, `lib/`, `app/`). Do NOT recurse further.
- **Root documentation**: `README.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `LICENSE`, `CLAUDE.md` if present.
- **Recent git activity**: `git log --oneline -50` to identify active areas.
- **CI config**: `.github/workflows/*.yml`, `azure-pipelines.yml`, `.gitlab-ci.yml`, `Jenkinsfile`, `.circleci/config.yml`, `bitbucket-pipelines.yml`.
- **Mockup directories**: detect `mockup/`, `mockups/`, `design/`, `prototypes/` at the root.
- **IaC markers**: `*.bicep`, `*.tf`, `cloudformation/`, `helm/`, `kustomize/`, `pulumi/`.
- **E2E markers**: `playwright.config.*`, `cypress.config.*`, `wdio.conf.*`, `e2e/`, `tests/e2e/`.

NOT in scope at this stage:

- Full-codebase reads.
- Deep recursion past depth two.
- Reading every file in `src/`.
- Anything that pushes consumption past ~30K tokens.

Narration is hybrid:

- **Inline** as major findings land: "Reading `package.json`... Angular 19, NgRx, RxJS. Reading `src/api/`... NestJS service shell."
- **Batched at section end** as a structured synthesis: a bullet list of facts the dev-lead now knows, ready for the relevance decision in Section 5.

#### Polyrepo discovery loop (when polyrepo mode is in effect)

When Section 2 recorded polyrepo mode with `N >= 2` sub-repos, Section 4 runs the shallow-scan targets above **once per detected sub-repo**, instead of once at the install root. Single-repo mode (`N=1`) skips this subsection and runs the original single-scan path.

**Mechanics**:

1. **Iterate sub-repos in deterministic order** (alphabetical by path) so narration is reproducible across runs.
2. **For each sub-repo**, run the shallow-scan targets (manifests, file-tree shape, root docs, recent git activity, CI config, mockup paths, IaC markers, E2E markers) scoped to that sub-repo's directory. Use `Glob` with the sub-repo path as a prefix; use `Bash` for `git log --oneline -50` invoked with `-C <sub-repo-path>` so each sub-repo's history is reported independently.
3. **Narrate per sub-repo inline**: "Scanning `shared-lib`... C# library project, .NET 8, no top-level docs. Scanning `web-frontend`... Angular 19 frontend, NgRx, integration tests under `__pycache__/`... Scanning `api-server`... Python 3.12 ASGI service, FastAPI, alembic migrations."
4. **Aggregate signals at the end** into two views:
   - **Per-sub-repo notes**: a small structured bundle per sub-repo (stack particulars, conventions hints, source-of-truth paths) that feeds the `Sub-repos` section of `project-profile.md` at synthesis (Section 8).
   - **Union signals**: a flat union of all signals that drives Section 5's specialist activation decision. Treated as the equivalent of single-repo signals -- any signal from any sub-repo activates the relevant specialist.

#### Manifest cross-reference pass (Stage 1 runtime dependencies)

When iterating manifests in polyrepo mode, perform an additional pass to detect cross-sub-repo runtime dependencies. This is Stage 1 of the 3-stage runtime-dep funnel; Stage 2 (specialist refinement) lands in Section 6 and Stage 3 (CPO confirmation) lands in Section 8.

**Mechanism**: for each manifest read, look for references where the manifest names another sub-repo as a dependency. Manifest-specific patterns:

- `package.json` `dependencies` / `devDependencies`: sub-repo name as a key (e.g., `"shared-lib": "file:../shared-lib"` or `"shared-lib": "workspace:*"`).
- `requirements.txt` / `pyproject.toml`: editable local install referencing a sibling path (e.g., `-e ../shared-lib`, `shared_lib @ file://../shared-lib`).
- `*.csproj` `<ProjectReference Include="../shared-lib/...">`.
- `go.mod` `replace <module> => ../shared-lib`.
- `Cargo.toml` `shared_lib = { path = "../shared-lib" }`.

Record each detected cross-reference as `{ from: <sub-repo>, to: <sub-repo>, evidence: <manifest path + line> }`. The aggregated set seeds the `Runtime dependencies` field in each `Sub-repos` entry at synthesis. Stage 2 specialists confirm or extend; Stage 3 surfaces the final set for CPO confirm.

Stage-1 detection is best-effort and conservative -- it catches manifest-declared coupling, not implicit runtime contracts (e.g., undocumented HTTP API calls between services). Those surface in Stage 2 (specialist code-level imports) and Stage 3 (CPO authority).

#### Greenfield / no-codebase fallback

If initial discovery turns up an empty or near-empty project -- a fresh `git init` with only a README, a brand-new scaffold with no real source code, no detectable manifests at all -- the dev-lead switches to **dialog mode** in place of the deep-dive. The fallback path:

1. **Surface the finding**: "I see only README.md and a `.git/` directory. There is no codebase to read yet. Switching to dialog mode."

2. **Ask what they are building**. Free-text response from the CPO. Probing questions if useful: problem domain, intended users, scope, hard constraints.

3. **Ask if they have a stack in mind**. If yes, capture it. If no, offer suggestions tailored to the problem with a recommendation, not a menu. Example: "For a real-time collaboration app you would want a websocket-capable backend (NestJS or .NET) and a reactive frontend (Angular or React). I would recommend Angular + NestJS in TypeScript end-to-end -- shared types, single language across the stack, both have first-class observable primitives." The CPO accepts, modifies, or names their own choice.

4. **Capture intent into a thin initial `project-profile.md`** with placeholder sections marked for later refinement. The scaffold sentinel is replaced with the curated identity / intended-stack content. Future-state sections (`## Build and test`, `## DevOps integration`, `## Project-specific behaviors`) carry placeholder text noting they will be populated by `/strap-refresh` once code lands.

5. **Skip Sections 5-8** -- there is nothing for specialists to read. Note that all 15 agents remain in the roster as dormant; they activate when real code arrives.

6. **Run Section 9 (project-docs production) against the thin profile.** Tech-writer renders `PROJECT.md`, `ARCHITECTURE.md`, `STACK.md` from the curated identity / intended-stack content; most sections in `ARCHITECTURE.md` and `STACK.md` land as stubs awaiting future `/strap-refresh` enrichment, but the orientation surface exists from day one so a new contributor reading the repo cold knows what the project is and where it is going.

7. **Hand off** per Section 10 with an explicit pointer: "Run `/strap-refresh` once you have real code in the repository so the persistence stack can be properly populated."

The greenfield path ends here. Sections 5 through 8 below assume the deep-dive path; Sections 9 and 10 run on both paths.

### 5. Specialist relevance decision

Decide which of the 15 canonical agents activate for the deep-dive based on signals from Section 4.

**Polyrepo signal union.** In polyrepo mode, activation decisions run against the **union of signals across all sub-repos**. Any signal from any sub-repo activates the relevant specialist. The render below attributes each signal to its source sub-repo so the CPO sees which sub-repo triggered which activation. Single-repo mode (`N=1`) renders without the per-sub-repo attribution column.

**Always active**:

- `security-reviewer` -- every project has security implications.
- `test-strategist` -- every project has tests or should have them.

**Conditionally active** based on signals:

| Agent | Activates when |
|---|---|
| `backend-engineer` | A backend manifest is detected (`*.csproj`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle*`, `composer.json`), OR `src/api/`-style directory present, OR `package.json` carries a backend framework dependency (express, nestjs, fastify, hapi, etc.). |
| `frontend-engineer` | Any client-side UI signal across web / desktop / mobile / server-rendered form factors: <br>**Web** -- `package.json` declares a web framework dependency (angular, react, vue, svelte, solid, qwik, nextjs, nuxt, sveltekit, remix). <br>**.NET desktop (modern)** -- `.csproj` carries `<UseWPF>true</UseWPF>`, `<UseWindowsForms>true</UseWindowsForms>`, the `Microsoft.NET.Sdk.WindowsDesktop` SDK, `<UseMaui>true</UseMaui>`, OR the `Microsoft.NET.Sdk.Maui` SDK. <br>**.NET desktop (WinUI / UWP)** -- `Microsoft.WindowsAppSDK` package OR `Microsoft.NET.Sdk.WinUI` SDK in `.csproj`. <br>**.NET desktop (cross-platform / legacy)** -- `Xamarin.Forms`, `Microsoft.AspNetCore.Components.WebView.*`, `Uno.UI`, OR `Avalonia.*` package in `.csproj`; OR `.axaml` files at any depth; OR `<UseUno>true</UseUno>` in `.csproj`. <br>**Native C++ (Borland)** -- `.bpr`, `.bpk`, `.cbproj`, OR `.bpg` files present (Borland C++ Builder, including BCB5/6 + RAD Studio XE). <br>**Qt** -- `.pro` OR `.qrc` files present; OR `CMakeLists.txt` references `Qt5::*` or `Qt6::*` targets. <br>**Cross-platform web-runtime desktop** -- `electron`, `@tauri-apps/api`, OR `nwjs` dep in `package.json`; OR `src-tauri/Cargo.toml` present. <br>**Java desktop** -- `org.openjfx:javafx-*` OR `org.jetbrains.compose` dependency in Maven (`pom.xml`) or Gradle (`build.gradle*`). <br>**Apple platforms** -- `.xcodeproj` files OR `Package.swift` with SwiftUI imports. <br>**Flutter Desktop** -- `pubspec.yaml` AND the presence of `linux/`, `windows/`, OR `macos/` sibling directories. <br>**Server-rendered Python widget libraries** -- `streamlit`, `dash`, `gradio`, `panel`, `nicegui`, `reflex`, `django-crispy-forms`, `django-tables2`, `wtforms`, OR `flask-wtf` declared in `requirements.txt`, `pyproject.toml`, `setup.py`, OR `Pipfile`. Also: in-house / custom Python widget frameworks (declared as a local-path editable install or workspace dependency) -- these are common in legacy enterprise stacks and look the same structurally. <br>**Server-rendered .NET / Java / Ruby / PHP** -- `.razor` files with `@page` directives (Blazor Server); `.cshtml` files (ASP.NET MVC server views); `.heex` files OR `phoenix_live_view` dep in `mix.exs`; `turbo-rails` OR `stimulus-rails` in `Gemfile` OR `.erb` files under `app/views/`; `livewire/livewire` in `composer.json` OR `app/Livewire/` directory; `.jsf` / `.xhtml` with JSF namespaces OR `javax.faces.webapp.FacesServlet` in `web.xml`. <br>**Classic template engines** -- `.erb`, `.haml`, `.slim`, `.pug`, `.jade`, `.jinja`, `.jinja2`, `.j2`, `.hbs`, `.handlebars`, `.mustache`, OR `.twig` files at any depth (excluding `node_modules`, `vendor`, build dirs). <br>**Vendored JS widget library directories** -- directories named `dhtmlx*`, `extjs*`, `sencha*`, `jquery-ui*`, `kendo*`, `infragistics*`, OR `devexpress*` under common asset paths (`static/`, `public/`, `assets/`, `wdoc/`, `wwwroot/`). |
| `database-engineer` | An ORM or migrations directory is present (`migrations/`, `db/migrate/`, `prisma/`, `typeorm/`), OR schema files detected (`schema.prisma`, `*.sql` under a migrations dir), OR a connection-string config key is present in the manifest. |
| `integration-specialist` | External SDK imports detected in manifests (`@aws-sdk/`, `azure-storage-*`, `googleapis`, `stripe`, `twilio`, etc.), OR a `integrations/` or `connectors/` directory present, OR the CPO confirms when prompted. |
| `devops-lead` | IaC files present (`*.bicep`, `*.tf`, `cloudformation/`, `helm/`, `pulumi/`, `kustomize/`), OR CI config indicates deployment beyond CI builds, OR `Dockerfile` / `docker-compose.yml` at root. |
| `designer` | Mockup paths configured in project-profile, OR detected `mockup/` / `mockups/` / `design/` / `prototypes/` directory at root. |
| `ux-test-engineer` | E2E framework config detected (`playwright.config.*`, `cypress.config.*`, `wdio.conf.*`), OR a `e2e/` / `tests/e2e/` directory present, OR the CPO confirms when prompted. |

The remaining five agents (`req-lead`, `spec-lead`, `tech-writer`, `sprint-planner`, `dora-analyst`) are agent-ops planning agents -- they do not participate in this section's parallel deep-dive of code. `tech-writer` participates in a different phase: after synthesis lands, the dev-lead invokes `tech-writer` serially at the closing project-docs production phase ([Section 9](#9-project-docs-production)) to render the human-facing project-orientation documents (`PROJECT.md`, `ARCHITECTURE.md`, `STACK.md`) from the curated persistence stack. The other four (`req-lead`, `spec-lead`, `sprint-planner`, `dora-analyst`) activate when the pipeline runs Requirements, Specs, sprints, and metrics respectively. The dev-lead itself is the curator and is not a specialist to dispatch.

**Frameworks without canonical markers and the CPO-override escape hatch.** Some UI frameworks have no canonical file or dependency pattern that Section 4's shallow scan can detect from manifests + file-tree shape alone -- raw Win32 / GDI+ in pure C/C++ (`WinMain` in source, no project-file convention), Java Swing without an explicit framework dep (Swing is JDK-bundled), direct GTK without `qmake` or PkgConfig hints, game-engine UI (Unity / Unreal / Godot -- arguably a separate discipline anyway). These won't trigger `frontend-engineer` activation from signals alone. The override gate below is the documented path: the dev-lead's relevance table makes the activation set legible, and the CPO can `Force-activate frontend-engineer` when they know the project has UI work that the signal scan missed.

**UI-shaped hints nudge.** When the signal scan does NOT activate `frontend-engineer` but Section 4 detected ANY of the following, the dev-lead's relevance-table render appends an inline soft hint to the CPO (informational only; never auto-activates):

- A directory named `views/`, `templates/`, `partials/`, OR `layouts/` at any depth (outside `node_modules`, `vendor`, build dirs)
- HTML files (`.html`, `.htm`) outside of `docs/` or build dirs (more than ~5 total signals real UI work)
- JS/TS files under non-build, non-vendor asset paths exceeding ~10 total (suggests web-asset-driven UI even without a managed framework)
- Python files importing identifiers matching `Widget`, `Form`, `View`, `Page`, OR `Component` (best-effort source-level peek -- only for the dev-lead's hint; not a guaranteed signal)

Suggested hint text in the relevance render:

```
Note: I see hints of UI work (templates/, HTML files, JS assets, or Widget/Form-style
imports) but no canonical framework signal matched. If your project uses a UI pattern
not covered by the activation list (server-rendered widgets without a recognized
framework dep, raw native APIs, etc.), force-activate frontend-engineer at the Override
gate. CPO override is the documented path for exactly this case.
```

The nudge makes the override path discoverable for the silent-skip case. It never auto-activates -- the CPO explicit consent path stays the only way `frontend-engineer` gets added without a positive signal match.

**Render the decision to the CPO** as a structured text block. Single-repo:

```
Specialist relevance for the deep-dive:

  Always active:
    - security-reviewer
    - test-strategist

  Activating based on signals:
    - backend-engineer    -- found <signal>
    - frontend-engineer   -- found <signal>
    - <etc.>

  Dormant for this run (no signals; will activate later if/when relevant):
    - <list>
```

Polyrepo mode -- same shape with per-sub-repo signal attribution:

```
Specialist relevance for the deep-dive (polyrepo, N=3):

  Always active (umbrella scope):
    - security-reviewer
    - test-strategist

  Activating based on signals (relevant sub-repos in parens):
    - backend-engineer    -- found .csproj (shared-lib); found pyproject.toml (api-server)
    - frontend-engineer   -- found angular dependency in package.json (web-frontend)
    - database-engineer   -- found alembic/ (api-server)
    - devops-lead         -- found Dockerfile (api-server)

  Dormant for this run (no signals; will activate later if/when relevant):
    - <list>
```

The per-sub-repo attribution feeds Section 6's mixed-dispatch decision (per-sub-repo briefs for backend/frontend/database; umbrella briefs for the always-active and cross-cutting specialists).

Then surface the override gate via `AskUserQuestion`:

```yaml
header: "Relevance decision"
question: "Override the activation set before I dispatch?"
options:
  - label: "Advance (Recommended)"
    description: "Accept this activation set and proceed to the parallel deep-dive."
  - label: "Override"
    description: "I'll ask which agents to force-activate or skip. Repeatable until you advance."
```

Handle the response:

- `Advance` -- accept the set; proceed to Section 6.
- `Override` -- prompt the CPO with a second `AskUserQuestion` for the override action:
  ```yaml
  header: "Override action"
  question: "What override?"
  options:
    - label: "Force-activate an agent"
      description: "Add an agent to the active set even though no signal triggered it."
    - label: "Skip an agent"
      description: "Remove an agent from the active set despite the signal."
    - label: "Done overriding"
      description: "Return to the previous gate and advance."
  ```
  For `Force-activate` / `Skip`, prompt for the agent name via a third `AskUserQuestion` whose options list every agent currently NOT in / IN the active set. Apply the change, re-render the relevance table, re-surface the override gate. Repeat until `Done overriding` returns to Advance.
- Free-text "Other" -- interpret intent; common case is a question about a specific agent's signal, which the dev-lead answers before re-rendering the gate.

Irrelevant for this project does NOT mean deleted. All 15 agents stay in the roster with empty memory and starter rules; they activate when the project later grows into their domain via `/strap-refresh`.

### 6. Parallel deep-dive via CreateTeam

The heart of `/strap-in`. Dispatch the activated specialists as a parallel team using the `CreateTeam` primitive.

**Read-only tool palette (structurally enforced).** Each specialist dispatched during `/strap-in` receives a restricted tools palette:

```
Read, Grep, Glob, Bash
```

No `Write`, no `Edit`, no `NotebookEdit`. This makes the code-immutability invariant ([`onboarding-design.md`](../../strap/contexts/onboarding-design.md) "Code immutability invariant") a structural property: specialists CANNOT modify code during discovery even if they attempted to. `Bash` remains because read-only inspection commands (`git log`, `git diff --stat`, `ls`, `find -type f`, `wc -l`) are genuinely useful. The dispatch brief constrains specialists to read-only Bash invocations only -- no `git checkout`, no `git commit`, no `rm` / `mv` / `cp`, no `npm install`, no migrations, nothing state-mutating.

**Per-specialist brief.** Each specialist receives a brief covering:

- **`REPO_ROOT` (absolute path)** -- the absolute path the dev-lead resolved at session start. All path references in the brief MUST be absolute or explicitly relative-to-`REPO_ROOT`. Specialists' own probes are safer with absolute paths even though their CWD does not drift the dev-lead's way; the discipline keeps brief authoring consistent and gives the specialist an unambiguous root.
- **Scope** -- which slice of the codebase to examine. Examples:
  - `backend-engineer`: "Read backend source code under `<paths>`. Identify the framework, architectural conventions, dependency-injection patterns, async/await usage, error-handling conventions, and any anti-patterns that future you should be warned about."
  - `frontend-engineer`: "Read frontend source code under `<paths>`. Identify the framework, state-management approach, component composition discipline, store-ownership patterns, i18n approach, and any anti-patterns."
  - `database-engineer`: "Read schema files and migrations under `<paths>`. Identify the engine, schema conventions, migration discipline, indexing strategy, and any conventions that future migrations should follow."
  - `security-reviewer`: "Read the codebase broadly. Identify authentication/authorization patterns, secrets-handling, input-validation discipline, error-response hygiene, and any specific sensitivities (PHI/PCI/PII, regulated data classes)."
  - `test-strategist`: "Identify the test stack, naming conventions, coverage approach, and any patterns the team uses for test data, mocking, and centralized test execution."
- **Tool palette** -- `Read, Grep, Glob, Bash`. State this explicitly in the brief.
- **Read-only Bash discipline** -- state explicitly: "No state-mutating Bash invocations. Inspection only."
- **Absolute-path Bash discipline** -- state explicitly: "Use absolute paths constructed from `REPO_ROOT` in single commands rather than `cd <REPO_ROOT> && <cmd>` compounds. Example: `head -80 <REPO_ROOT>/Main/code/SomeFile.h` rather than `cd <REPO_ROOT> && head -80 Main/code/SomeFile.h`. For `grep` / `find` scoped to a subdirectory, pass the subdirectory as an explicit argument: `grep -rn 'pattern' <REPO_ROOT>/subdir` rather than `cd <REPO_ROOT>/subdir && grep -rn 'pattern' .`. The harness audits `cd <path> && <cmd>` compounds and triggers a permission prompt on the CPO side every time -- mass prompt fatigue. Plus the `cd` persists in your Bash tool's CWD across calls and silently breaks subsequent relative-path probes."
- **Per-agent budget** -- "Your budget for this dispatch is `<per-agent-budget>` tokens. Include `tokens_used: ~XXk` as the final line of your finishing summary." The effective `<per-agent-budget>` resolves per `budget-discipline.md` "Dispatch-time resolution": `budgets.strap-in.agent_overrides.<name>.per_agent` if present, else `budgets.strap-in.per_agent`. Overrides are rare for `/strap-in` (this skill prompts the CPO for an aligned per-agent value at Section 3) but are honored if the CPO has set one via `/revise-token-budget --agent <name>` between runs.
- **Pointers to per-agent memory and rules** -- "Your memory at `.claude/strap/memory/agents/<name>.md` and rules at `.claude/strap/rules/agents/<name>.md` will be curated by me (the dev-lead) based on your findings. They start mostly empty."
- **Reporting format** -- "Report your findings as a structured summary: conventions, patterns, anti-patterns, sensitivities, anything worth a future specialist of your type knowing about this codebase."
- **Delivery via `SendMessage`** -- "You are dispatched through `CreateTeam`. The team channel is one-way at dispatch; I receive your brief, but you must explicitly call `SendMessage` with your structured findings (and the `tokens_used: ~XXk` line as the final line) before your session ends. Without `SendMessage`, your findings stay in your session and I wait indefinitely. Foreground `Agent` / `Task` dispatch returns results automatically; only `CreateTeam` requires the explicit call."

**Dispatch.** Use `CreateTeam` with the active specialists as teammates. Spawn them named and in the background so the CPO sees colored-badge progress indicators (per the dev-lead's memory on agent spawning). Wait for the team to return before proceeding.

#### Polyrepo dispatch granularity (mixed by specialist nature)

When polyrepo mode is in effect, dispatch granularity depends on the specialist's natural scope. This preserves single-repo brief quality -- a specialist never has to reconcile findings across mixed stacks in a single thought when those findings are naturally per-sub-repo. Single-repo mode (`N=1`) collapses both buckets below to one brief per specialist as today.

**Per-sub-repo briefs** (one brief per *relevant* sub-repo, dispatched in parallel via `CreateTeam`):

- `backend-engineer`
- `frontend-engineer`
- `database-engineer`

Their findings are inherently sub-repo-scoped -- different language/framework per sub-repo means mushing them into one brief loses fidelity. Each per-sub-repo brief carries:

- **Scope sentence**: "Read backend source in `<sub-repo-path>` only. Do not read other sub-repos; they are dispatched separately."
- **Sub-repo context**: which sub-repo this is, what role it plays in the umbrella (from the Section 4 aggregate notes), and which other sub-repos the dev-lead has dispatched in parallel (so the specialist understands the cross-team coordination shape without being asked to inspect siblings).
- **Stage 2 runtime-dep reporting**: "If you observe imports or runtime calls into another sub-repo's code, note them in your finishings as `runtime-dep: <to-sub-repo> via <evidence>`. The dev-lead aggregates and confirms with the CPO at synthesis."

**Skip non-relevant sub-repos.** If `backend-engineer` only activates for one sub-repo (e.g., signal came from a single `pyproject.toml`), it gets exactly ONE brief, not N. The N-multiplier only applies when the specialist is actually relevant to multiple sub-repos.

**Umbrella-wide briefs** (one brief covering all sub-repos, dispatched in parallel via `CreateTeam`):

- `security-reviewer`
- `test-strategist`
- `integration-specialist`
- `devops-lead`

Their findings are inherently cross-cutting -- they only make sense viewed across the system. Each umbrella brief carries:

- **Scope sentence**: "Read across all <N> sub-repos. The system is a polyrepo umbrella; your domain spans the umbrella, not any single sub-repo."
- **Sub-repo list with per-sub-repo summaries**: from Section 4 aggregate notes, so the specialist understands the system shape going in.
- **Stage 2 runtime-dep reporting**: same as per-sub-repo briefs (cross-cutting specialists often see runtime contracts that per-sub-repo specialists miss).

**Specialists outside the seven Section-6 conditionally-active**: same as single-repo. `designer` (when activated) dispatches against the configured mockup paths (typically umbrella-scoped); `ux-test-engineer` dispatches against the configured E2E paths (typically per-sub-repo if E2E lives inside each sub-repo). The dev-lead routes them at brief time.

**Dispatch shape worked example** (a polyrepo with N=3 sub-repos: `shared-lib` C# library, `web-frontend` Angular, `api-server` Python ASGI):

| Specialist | Briefs | Scope per brief |
|---|---|---|
| `backend-engineer` | 2 (parallel) | shared-lib; api-server |
| `frontend-engineer` | 1 | web-frontend |
| `database-engineer` | 1 | api-server (alembic) |
| `security-reviewer` | 1 (umbrella) | all 3 sub-repos |
| `test-strategist` | 1 (umbrella) | all 3 sub-repos |
| `integration-specialist` | 1 (umbrella) | all 3 sub-repos |
| `devops-lead` | 1 (umbrella) | all 3 sub-repos |

Total: 8 briefs, all dispatched in parallel via a single `CreateTeam`. The 3 per-sub-repo briefs and 4 umbrella briefs run concurrently; the dev-lead waits for the full team to return before synthesizing.

**Substance retrieval after specialists go idle.** When specialists complete and the team transitions to idle, the harness delivers idle-notification preview turns ("1 of N idle", "2 of N idle"...) but the **full `SendMessage` bodies persist to disk at `~/.claude/teams/<team-name>/inboxes/dev-lead.json`** rather than arriving as conversation turns. The idle preview is the notification; the inbox file is the substance. Read the inbox file before concluding the dispatch is complete. See dev-lead memory `operating_team_inbox_file_substance.md` for the full tradecraft (retrieval flow, multi-team iteration, error-case detection).

**Synthesize.** When the team returns and the inbox bodies are in hand, the dev-lead consolidates findings into three target files per specialist:

1. **`.claude/strap/contexts/project-profile.md`** -- curate the project-wide facts each specialist surfaced: stack confirmations, architectural notes, conventions, DevOps integration markers, project-specific behaviors. Replace scaffold sections with curated content. Strip the `<!-- STRAP_SCAFFOLD -->` sentinel at the end of synthesis (Section 8).

2. **`.claude/strap/memory/agents/<name>.md`** -- agent-specific tradecraft for THIS project. Soft learnings, codebase-specific gotchas, conventions worth keeping. Replace empty memory with curated content.

3. **`.claude/strap/rules/agents/<name>.md`** -- guardrails inferred from anti-patterns observed. Append to (not replace) the starter rules; add new rules only when a specific defect surfaced in discovery suggests prevention is warranted. Most onboardings will not add rules at this stage.

**Single-curator discipline.** Only the dev-lead writes to these files. Specialists report findings; the dev-lead decides what gets persisted. This is a STRAP-wide invariant ([`CLAUDE.md`](../../../CLAUDE.md) "Single curator").

**Token accounting.** When each specialist's finishing summary returns, parse `tokens_used: ~XXk` from the last line. Sum into `session.specialists_used` in `usage.yaml`. Per-agent consumption goes to `agents.<name>.used_in_current`.

### 7. Phased discovery for large codebases

If the initial discovery (Section 4) suggests the codebase is large enough that a single parallel wave would push session aggregate past 60%, lay out a **phased plan** instead of one wave:

- Specialists dispatch in waves. Each wave covers a slice of one or more specialists' domains. Suggested wave shapes:
  - Wave 1: `security-reviewer` + `test-strategist` (always-active pair, both run broad scans).
  - Wave 2: `backend-engineer` + `database-engineer` (server-side and persistence; often related).
  - Wave 3: `frontend-engineer` + `designer` + `ux-test-engineer` (client-side and visual contract).
  - Wave 4: `devops-lead` + `integration-specialist` (infrastructure and external surface).
- Between waves, the dev-lead:
  - Synthesizes that wave's findings into the persistence stack.
  - Reads `usage.yaml` and checks `session.specialists_used` against `budgets.strap-in.session_aggregate`.
  - Decides whether to launch the next wave or checkpoint.

**Checkpoint trigger.** When `session.specialists_used` exceeds 60% of `budgets.strap-in.session_aggregate`:

1. Report to the CPO: "Specialists have consumed ~<X>K of the <Y>M session aggregate. Recommending checkpoint."
2. Run `/context-prep strap-in-<project-slug>` to capture phase progress.
3. Instruct the CPO: "Run `/usage` to confirm your own window; then `/clear` and start a fresh session. On resume, run `/context-fetch strap-in-<project-slug>` first."
4. The CPO confirms or overrides. If they override ("plenty of room, push through"), proceed and note the override in the continuation for future sessions to learn from.

**Multi-session state.** Specialists carry their remaining per-agent budget across sessions (recorded in `usage.yaml`); the session aggregate resets on a fresh session. The continuation captures which specialists are done, which are partial, what is left.

Most onboardings complete in one session. Phased mode is the escape valve for large codebases and is not the default path.

#### Polyrepo wave partitioning (when polyrepo mode is in effect)

In polyrepo mode, the wave shapes adapt to the mixed-dispatch model. Per-sub-repo briefs (backend/frontend/database) count toward the wave that hosts them; umbrella briefs (security/test/integration/devops) stay in their normal positions.

**Suggested polyrepo wave shapes** (for a 3-sub-repo umbrella as a reference; scale up or partition further for larger N):

- Wave 1: `security-reviewer` (umbrella) + `test-strategist` (umbrella). Same as single-repo.
- Wave 2: `backend-engineer` per-sub-repo briefs (1..N parallel) + `database-engineer` per-sub-repo briefs (1..N parallel). Server-side and persistence dispatched together; per-sub-repo within each.
- Wave 3: `frontend-engineer` per-sub-repo briefs (1..N parallel) + `designer` (umbrella, when active) + `ux-test-engineer` (umbrella or per-sub-repo per E2E configuration).
- Wave 4: `devops-lead` (umbrella) + `integration-specialist` (umbrella). Same as single-repo.

**Per-wave checkpoint trigger** uses the polyrepo-projected session aggregate from Section 3, not the single-repo default. The 60% threshold sits at `0.6 * projected_aggregate`, which is higher than `0.6 * 1M` in polyrepo mode -- waves can run longer before triggering a checkpoint.

**Large-N partitioning** (e.g., N=8+). For very large polyrepos, the per-sub-repo per-wave parallelism may itself need partitioning to stay under the team-size practical limit. The dev-lead splits a wave's per-sub-repo briefs into sub-waves (e.g., backend-engineer on sub-repos 1-4 first, then 5-8) and synthesizes between sub-waves. The session-aggregate budget governs when this partition is necessary.

### 8. Synthesis gate

Once all waves are complete (across however many sessions), the dev-lead does a final synthesis pass before hand-off:

1. **Re-read every per-agent memory file** the dev-lead wrote during Section 6. Check for inconsistencies (one specialist saying "we use X" while another says "we use Y"), gaps (claims that should be backed by evidence), and overconfident statements (sweeping conventions inferred from one or two files).

2. **Re-read `project-profile.md`**. Same check. Strip the `<!-- STRAP_SCAFFOLD -->` sentinel if it is still present. This is the first real curation of the file and marks the project as onboarded.

3. **Re-read every per-agent rules file** the dev-lead modified. Same check. Confirm that every rule additions cite a concrete observed defect, not a general principle.

4. **Refine where needed**. Edit the files to resolve inconsistencies. Flag genuinely ambiguous findings for CPO input in the hand-off summary.

#### Polyrepo synthesis: write Sub-repos section and confirm runtime deps

When polyrepo mode is in effect, synthesis additionally:

5. **Populate the `Sub-repos` H2 section** in `project-profile.md` per the v2.4 schema -- one H3 entry per detected sub-repo with the full 14-field bullet list per the [scaffold contract](../../strap/templates/project-profile.scaffold.md#sub-repos). The section opens with the `<!-- strap-schema: sub-repos-v2.4 -->` sentinel comment so `/strap-upgrade` can detect the schema version on future upgrades.

   Field-by-field source map:

   **Identity (3 fields)**
   - **Slug**: auto-suggested kebab-case form of the sub-repo path basename (e.g., `web-frontend`); CPO confirms or overrides during synthesis confirmation. Matches the H3 heading text exactly.
   - **Path**: from Section 2 detection (relative to umbrella root).
   - **Role**: synthesized from Section 4 shallow scan + Section 6 specialist findings + (for high-confidence cases) the sub-repo's own `README.md` if present. One-line description.

   **Execution routing (7 fields)** -- driven by per-sub-repo build-file inspection (see "Build-file inspection patterns" below) plus CPO confirmation
   - **Primary language**: inspect the manifest's language signal (e.g., `package.json` + `tsconfig.json` -> `typescript`; `*.csproj` -> `csharp`; etc.). Auto-suggested; CPO confirms.
   - **Active domains**: signals from Section 4 + Section 6 ranked into canonical-domain set (`frontend`, `backend`, `database`, `integration`, `infrastructure`, etc.). Multi-select prompt; auto-suggestions ranked by signal strength.
   - **Test command**: from manifest scripts/targets per the inspection table (T1.2). Auto-suggested; CPO confirms or edits.
   - **Build command**: same as Test command -- manifest-driven default + CPO confirmation.
   - **Parallel safe**: default `false`. CPO opt-in to `true` after a brief explanation: "Set `true` only when this sub-repo's tests have no shared resource conflicts with other sub-repos' tests (no shared port, no shared DB, no shared fixture)." Conservative-but-correct default.
   - **Deployment target**: FK reference to a target name in `devops-connection.yaml`'s `deployment_targets:` list. Default suggestion is driven by CI-config inspection (see "CI-config inspection patterns for Deployment target" below) -- the dev-lead scans the sub-repo's path for known CI markers (`vercel.json`, `.github/workflows/*deploy*.yml`, `azure-pipelines.yml` deploy stages, generic IaC markers) and proposes a target whose name fuzzy-matches a detected hint. When the umbrella's `devops-connection.yaml` has only one declared target, that target is the default. When no targets are declared, the field offers a skip option (sub-repo treated as un-attributed downstream; F9 deploy-freq math omits it). CPO confirms / overrides / skips.
   - **Depends on**: from the 3-stage runtime-deps funnel (see step 6 below). The v2.4 schema renames the v2.3 `Runtime dependencies` field to `Depends on` (semantic preserved: internal cross-sub-repo only).

   **Orientation prose (3 fields)** -- read by specialists on every invocation; same as v2.3
   - **Stack**: from per-sub-repo Section 4 manifests + Section 6 implementation-specialist confirm.
   - **Conventions**: from Section 6 specialist findings scoped to this sub-repo.
   - **Source-of-truth**: paths from Section 4 file-tree shape + Section 6 specialist citations.

   **Meta (1 field)**
   - **Activated**: `<today> by <CPO-handle>` -- captured here, immutable after.

   **Per-sub-repo interview shape**. The dev-lead runs the field-population conversation sub-repo by sub-repo (sequential prompts to keep cognitive load manageable). Per sub-repo:
   1. Present detected facts (path, slug suggestion, manifest, primary language inference).
   2. Confirm/override Slug and Role.
   3. Confirm/override Primary language.
   4. Multi-select Active domains (suggestions pre-checked from signals).
   5. Confirm/edit Test command + Build command (defaults from manifest inspection).
   6. Confirm Parallel safe (default false; explain when true is appropriate).
   7. Resolve Deployment target via CI-config inspection (see patterns below) + fuzzy-match against `devops-connection.yaml`'s declared `deployment_targets:`. Present the proposed default with detected evidence; CPO confirms / overrides via menu of declared targets / skips. Skip stores no value (un-attributed downstream).
   8. Confirm/edit Depends on (suggestions from the 3-stage funnel in step 6).

   After all sub-repos are interviewed, present an umbrella-wide summary block (one row per sub-repo with the populated execution-routing fields) before any persistence happens. CPO confirms the full picture before the Sub-repos section is written.

   **Single-repo umbrellas**: the entire Sub-repos section stays empty (no sentinel, no H3 entries). Polyrepo synthesis path is skipped.

##### Build-file inspection patterns

Auto-suggestion defaults for Primary language + Test command + Build command come from inspecting each sub-repo's build-file manifests. The dev-lead inspects in this order; first match wins:

| Manifest detected | Primary language | Test command | Build command |
|---|---|---|---|
| `package.json` | `typescript` if `tsconfig.json` present, else `javascript` | `scripts.test` (typical: `npm test` / `vitest` / `jest`) | `scripts.build` (typical: `npm run build`) |
| `*.csproj` or `*.sln` | `csharp` | `dotnet test` | `dotnet build -c Release` |
| `pom.xml` | `java` | `mvn test` | `mvn package` |
| `build.gradle` / `build.gradle.kts` | `java` or `kotlin` (inspect for Kotlin DSL) | `./gradlew test` | `./gradlew build` |
| `pyproject.toml` | `python` | `pytest` (or scan for `[tool.pytest]` / `[tool.poetry.scripts]` test entry) | `python -m build` (or poetry build target) |
| `Cargo.toml` | `rust` | `cargo test` | `cargo build --release` |
| `go.mod` | `go` | `go test ./...` | `go build ./...` |
| `Gemfile` | `ruby` | `bundle exec rspec` or `rake test` (inspect) | `gem build` (when gemspec present) or N/A |
| `composer.json` | `php` | `vendor/bin/phpunit` (inspect `scripts.test`) | `scripts.build` when defined |
| `Makefile` | (varies; inspect targets) | scan for `test:` target -> `make test` | scan for `build:` / `all:` target -> `make build` |
| No manifest detected | prompt CPO directly | prompt CPO directly | prompt CPO directly |

**Multi-manifest sub-repos** (e.g., a sub-repo with both `package.json` and `Cargo.toml` for a mixed Node/Rust workspace): present the detected manifests and ask the CPO which is the primary signal. The non-primary contributes to `Stack` (orientation prose) but doesn't drive the `Primary language` / `Test command` / `Build command` defaults.

**Inspection is best-effort**: when the manifest exists but lacks the expected entries (e.g., `package.json` with no `scripts.test`), the dev-lead emits a suggestion-with-question form: "`web-frontend`: detected `package.json` but no `scripts.test` defined. Suggested Test command: (blank; please specify)." CPO supplies the value directly.

##### CI-config inspection patterns for Deployment target

Auto-suggestion defaults for the per-sub-repo `Deployment target` field come from inspecting each sub-repo's CI configuration. The dev-lead scans for the markers below and emits a fuzzy hint that gets matched against `devops-connection.yaml`'s declared `deployment_targets:` names. First detected hint wins; multiple matches surface a ranked menu.

| Marker detected | Hint kind | Typical hint signal |
|---|---|---|
| `vercel.json` OR `.vercel/` directory OR `next.config.*` with Vercel-specific config | Vercel | `vercel` substring; suggests targets like `vercel-prod`, `vercel-preview` |
| `.github/workflows/*deploy*.yml` OR `*release*.yml` OR `*production*.yml` | GitHub Actions | parse top-level `name:`, job names, step `uses:` (e.g., `aws-actions/*`, `azure/*`, `google-github-actions/*`) for cloud signals |
| `azure-pipelines.yml` (or `azure-pipelines/*.yml`) | Azure DevOps pipelines | parse `stages:` with `deployment:` entries; capture stage names + `environment:` blocks as hints |
| `Dockerfile` + `helm/` directory | Kubernetes-flavored | suggests `aks-prod`, `eks-prod`, `gke-prod`, `k8s-prod` etc. based on adjacent IaC markers |
| `terraform/` directory + `*.tf` files | Terraform-driven IaC | inspect `provider "aws"` / `provider "azurerm"` / `provider "google"` blocks for cloud signals |
| `serverless.yml` | Serverless Framework | suggests AWS-flavored targets (Serverless Framework is AWS-dominant) |
| `app.yaml` (GCP App Engine signal) | GCP App Engine | suggests `gcp-*` targets |
| `Procfile` + Heroku-specific config | Heroku | suggests `heroku-*` targets |
| No CI markers detected | None | no default suggested; CPO selects manually from declared targets or skips |

**Fuzzy-match logic**: detected hints are matched against declared target names by case-insensitive substring search. When a sub-repo detects `vercel.json` (hint: `vercel`) and `devops-connection.yaml` declares a target named `vercel-prod`, the match scores high and `vercel-prod` is the proposed default. When multiple targets match (e.g., both `vercel-prod` and `vercel-preview`), surface a ranked menu sorted by match quality; CPO picks. When the hint matches no declared target, propose the unmatched hint as a "would you like to add a target?" prompt; CPO can either declare a new target inline (re-entering `/connect-devops-project` Step 5b's per-target capture) or skip the field for this sub-repo.

**Skip path**: when no CI markers detect AND no targets are declared in `devops-connection.yaml`, the prompt offers `Skip` as the recommended option (the sub-repo has no deployment activity STRAP can attribute). Skip stores no value; the field is omitted from the persisted Sub-repos entry per the absent-is-valid invariant.

**Detection is best-effort**: false positives are acceptable (CPO overrides at the prompt); false negatives surface as "no default suggested" (CPO chooses manually from declared targets). The pattern list is extensible -- additional markers can be added as adopters surface gaps; document new patterns inline above so future runs cover them.

**Persistence in Sub-repos block**: when the CPO confirms or overrides a target, write `**Deployment target**: <target-name>` as a bullet in the per-sub-repo H3 entry alongside the other 13 fields. When the CPO skips, omit the bullet entirely (do NOT write `**Deployment target**: ~` or blank value; absent bullet means "un-attributed"). The schema sentinel `<!-- strap-schema: sub-repos-v2.4 -->` already in place from F1; F7 S3 adds a populated field, not a new schema version.

**Single-repo umbrellas**: the entire Sub-repos section stays empty in single-repo mode (per the polyrepo-only synthesis path above). The per-sub-repo Deployment target prompt does NOT run; no Sub-repos H3 entries exist. Adopters with single-repo umbrellas who declare umbrella-level `deployment_targets:` in `devops-connection.yaml` (via /connect-devops-project Step 5b) document the topology but get no automatic per-sub-repo attribution (single-repo deployment-topology modeling deferred to v2.5+ per the F7 schema docs).

6. **Runtime-dependency Stage 3 (CPO confirmation)**. Aggregate the cross-sub-repo runtime-dep findings from Stage 1 (Section 4 manifest cross-reference) and Stage 2 (Section 6 specialist `runtime-dep: <to-sub-repo> via <evidence>` reports). Render the aggregated set to the CPO:

   ```
   Runtime dependencies detected between sub-repos:

     web-frontend -> shared-lib       (Stage 1: package.json file: reference)
     api-server -> shared-lib (Stage 1: pyproject.toml -e ../shared-lib)
     api-server -> web-frontend (Stage 2: backend-engineer observed HTTP client to objyes4web service)

   Anything missing? Anything wrong?
   ```

   Surface via `AskUserQuestion` with options:
   - `Confirm as shown (Recommended)`: write the aggregated set to the `Runtime dependencies` field of each `Sub-repos` entry.
   - `Edit list`: prompt for additions or removals via free-text. Common case: the CPO names an undocumented HTTP API contract that manifests don't reveal. Apply, re-render, re-surface.
   - `Skip`: leave `Runtime dependencies` empty for now; document the gap in hand-off ambiguities.

7. **Pre-existing sub-repo `.claude/` audit (informational, no action)**. If any sub-repo carries its own `.claude/` from a prior individual STRAP install or default Claude Code state, mention them in the hand-off summary so the CPO knows two `.claude/` trees exist alongside each other (umbrella + sub-repo). Bystander pattern; no merge, no overwrite, no warning needed -- the paths don't overlap. Useful to surface in case the CPO wants to clean up sub-repo `.claude/` trees that are now redundant under the umbrella install.

#### Synthesis quality bar

The synthesis gate clears when the dev-lead has high confidence in the initial survey. The bar:

> Another dev-lead resuming this project on a fresh session, with no memory of this onboarding conversation, would understand the project from the persistence stack alone.

For polyrepo, this expands implicitly: another dev-lead reading the `Sub-repos` section understands the structural shape of the umbrella, each sub-repo's role, and the cross-sub-repo runtime contracts.

If the bar is not cleared, surface the gaps to the CPO before hand-off. Common gaps:

- "Two specialists disagreed on convention X; need your call."
- "I am uncertain whether the project is multi-tenant or single-tenant; clarify?"
- "The codebase has both prisma and typeorm imports; which is canonical?"
- (Polyrepo) "Stage 1 + Stage 2 found no cross-sub-repo runtime deps; you confirmed none exist. Sub-repos appear independent at runtime. Recording as such."

### 9. Project-docs production

After the synthesis gate clears, the dev-lead dispatches `tech-writer` (serial via `Task`, not parallel via `CreateTeam`) to render the human-facing project-orientation documents from the curated persistence stack. Three documents land at the configured `Project docs paths` (or the fallback): `PROJECT.md`, `ARCHITECTURE.md`, `STACK.md`.

**Why a separate phase, not part of Section 6.** Project-docs production is sequential authoring of three related documents from a single synthesized brief. There is no parallel fan-out value -- and the brief depends on the synthesized persistence stack, which exists only after Section 8 has cleared. Running tech-writer alongside the Section 6 deep-dive wave would force it to read incomplete state and re-render later.

**Tool palette (codebase-discovery dispatch exception).** Unlike Section 6 specialists -- which dispatch read-only with `Read, Grep, Glob, Bash` -- tech-writer receives a palette that includes `Write` and `Edit`:

```
Read, Grep, Glob, Bash, Write, Edit
```

The exception is structurally narrow: tech-writer writes ONLY to the configured `Project docs paths` (or the fallback `.claude/strap/project-docs/`). The code-immutability invariant is preserved because the write target is local docs in the adopter-owned tree, never production source. This is the same exception pattern designer follows in `/create-mockups`, where the read-only-at-host palette is augmented with `Write`/`Edit` for the configured `Mockup paths`.

**Resolve the write target.**

1. Look up the top-level `Project docs paths` field in the just-synthesized `project-profile.md`. If declared, use the first path. The path is relative to the repo root.
2. Otherwise, fall back to `.claude/strap/project-docs/`.
3. Create the target directory if it does not exist (`mkdir -p`).
4. Tell the CPO which path the rendered docs will land at.

**Per-tech-writer brief.** Dispatch via `Task` (serial; one specialist; no parallel fan-out value):

- **Role contract + operating context** -- per-agent rules, per-agent memory, the just-synthesized `project-profile.md`. Tech-writer reads these on dispatch like any specialist.
- **`REPO_ROOT` (absolute path)** -- always include the absolute repo-root path in the brief (resolve via `git -C <cwd> rev-parse --show-toplevel`, falling back to the absolute path the session was invoked in). All other path references in the brief MUST be absolute (prefixed with `<REPO_ROOT>/`) or explicitly relative-to-`REPO_ROOT`. Reason: long polyrepo + `CreateTeam` sessions can drift the dev-lead's Bash CWD into a sub-repo, so verification probes constructed with relative paths return false negatives. Absolute paths in the brief are reused by tech-writer's verification command (see Reporting format below), preventing the drift from masking a successful write.
- **Curated persistence stack as authoritative source material** -- the synthesized `project-profile.md`, the curated `memory/agents/<active-specialist>.md` files. These are the source of truth.
- **Synthesized specialist findings** -- the structured findings each Section 6 specialist returned, condensed into a paragraph or two per specialist. Tech-writer needs the narrative context, not the raw reports.
- **The three templates** -- absolute paths under `<REPO_ROOT>/.claude/strap/templates/project-docs/PROJECT.md.template.md`, `ARCHITECTURE.md.template.md`, `STACK.md.template.md`. Tech-writer renders each one with the Mustache placeholders filled from source material. **Do not assert "templates absent" in the brief without verifying via an absolute-path probe** (`ls "<REPO_ROOT>/.claude/strap/templates/project-docs/"`); a relative-path probe can false-negative due to CWD drift.
- **Target write path** -- absolute. The resolved `Project docs paths` from `project-profile.md` (or the fallback `<REPO_ROOT>/.claude/strap/project-docs/`). The three rendered files land at this path with their `.template.md` suffix stripped.
- **Read-only-at-host discipline** -- "No state-mutating Bash invocations. No writes outside the configured docs path. The code-immutability invariant applies to production source; you may write to the local docs path only."
- **Stub discipline** -- "Fill every Mustache placeholder. Sections without source material get a one-line stub note ('_To be populated in a future /strap-refresh once <signal> arrives._'). Never fabricate facts to fill a section."
- **Brief-contradiction discipline** -- "If a brief claim (e.g., 'templates absent') contradicts what your own `Read` probes can see, surface the contradiction in your finishing summary rather than silently siding with the brief or with your probes. The dev-lead can then correct the brief or correct their understanding." This makes tech-writer's robustness against CWD-drift-induced bad briefs explicit rather than incidental.
- **Per-agent budget** -- pulled from `usage.yaml`, resolved per `budget-discipline.md` "Dispatch-time resolution" (`agent_overrides.tech-writer.per_agent` if present, else `budgets.strap-in.per_agent`). Include `tokens_used: ~XXk` in the finishing report.
- **Reporting format** -- "Report back via your finishing summary: (a) files written as ABSOLUTE paths (one per line), (b) a `Verification command:` line the dev-lead can copy-paste verbatim (e.g., `ls -la \"<REPO_ROOT>/.claude/strap/project-docs/\"`), (c) per-file section summary (which sections populated from source material, which marked as stubs), (d) any brief-contradictions you observed, (e) anything to curate (rule or memory entry the dev-lead should consider), and (f) `tokens_used: ~XXk` as the final line."

**Review and curate.** When tech-writer returns:

1. Run the `Verification command:` from tech-writer's finishing summary verbatim. The command uses absolute paths so it survives any CWD drift in the dev-lead's Bash tool. If the listing does not show the expected files, double-check by reading one of them with the absolute path via the `Read` tool before concluding tech-writer fabricated -- `Read`'s path resolution is independent of Bash's CWD and is the most reliable probe.
2. Read each of the three rendered files via absolute paths.
3. Verify they live at the configured path (or the fallback) -- not elsewhere.
4. Verify Mustache placeholders are all resolved (no literal `{{ var }}` strings rendered through to output).
5. Spot-check for fabrication: facts cited in the docs MUST trace back to `project-profile.md`, the per-agent memory files, or the brief. Where they do not, re-dispatch with the specific section flagged.
6. If tech-writer surfaced any brief-contradictions: validate via absolute-path probe, correct the dev-lead's understanding, and update the brief / memory entries before any re-dispatch.
7. Curate any rule or memory entries tech-writer flagged in its finishing report.

**The project-docs bar** parallels the synthesis-gate bar from Section 8 but for a human audience:

> A new contributor to this project, reading PROJECT.md / ARCHITECTURE.md / STACK.md cold with no prior context, would understand what the project is, how the code is structured, and what it is built with.

#### Polyrepo umbrella project-docs (when polyrepo mode is in effect)

When polyrepo mode is in effect, the three rendered documents capture the **umbrella system view** -- not a single sub-repo. The tech-writer brief includes additional context:

- **Source material includes the `Sub-repos` section** of the synthesized `project-profile.md` in addition to the per-agent memory files and synthesized findings. The Sub-repos section is authoritative for the system shape; tech-writer reads it first.
- **Per-document polyrepo shape**:
  - `PROJECT.md`: umbrella project name + tagline + a bulleted list of comprising sub-repos with one-line purposes per sub-repo (from the `Purpose` field of each Sub-repos entry).
  - `ARCHITECTURE.md`: cross-sub-repo system shape, runtime dependencies (from the `Runtime dependencies` field), data flow between sub-repos when known. Per-sub-repo internal architecture stays high-level here (one paragraph per sub-repo at most); deep per-sub-repo architecture is a later Feature in this Epic.
  - `STACK.md`: table-form summary of stack particulars across sub-repos. Columns: sub-repo / language / framework / role. Plus a short "Umbrella conventions" subsection covering anything that spans the system (shared CI patterns, shared lint config, shared docs discipline).
- **Per-sub-repo project-docs are out of scope** for this Feature (#38964). v2.3 ships umbrella-only. The tech-writer brief explicitly states this so the writer does not attempt to render N sets of docs.
- **Stub discipline still applies**. Sections without source material get the standard one-line stub note. For polyrepo, a common stub is the "Data flow" subsection in `ARCHITECTURE.md` when no specialist or CPO confirmation surfaced explicit data flow contracts.

Single-repo mode (`N=1`) renders the three documents as today -- no umbrella shape, no Sub-repos source material.

**Token accounting.** Same as Section 6. Parse `tokens_used: ~XXk` from tech-writer's finishing summary; add to `session.specialists_used` in `usage.yaml`; record under `agents.tech-writer.used_in_current`.

#### Render the HTML companion

After the three project-docs markdowns land (and tech-writer's review pass completes), render a self-contained HTML companion via the STRAP html-render pipeline shipped at `.claude/strap/tools/html-render/`. The HTML uses the same template + CSS that produces `Welcome-to-STRAP.html`, so the visual identity is consistent across all STRAP-produced docs.

1. **Resolve the project name and the project-docs path.** Project name comes from `project-profile.md`'s `## Identity` section (`Project name` field) or, if absent, the working directory basename slugified. Project-docs path comes from `project-profile.md`'s top-level `Project docs paths` field, or the fallback `.claude/strap/project-docs/`.

2. **Resolve `REPO_ROOT` as an absolute path.** Determine the absolute path to the repo root once (e.g., via `git -C <cwd> rev-parse --show-toplevel`, or the absolute path the CPO invoked the session in). This value is used as the config's `basePath` field below so that all source / output paths in the in-memory config are interpreted from the repo root regardless of where the temp config file gets written. This sidesteps the well-known `render.js` gotcha where, in the absence of `basePath`, source paths resolve relative to the config file's directory (which produces nested invalid paths like `.claude/strap/project-docs/.claude/strap/project-docs/PROJECT.md`).

3. **Build a temporary render config.** Write a JSON config to a temp path (e.g., `<project-docs-path>/.render-config.json`) with:

   ```json
   {
     "title": "<project-name> -- Project Orientation",
     "basePath": "<REPO_ROOT>",
     "outputPath": ".claude/strap/project-docs/<project-name>-orientation.html",
     "brand": {
       "name": "STRAP",
       "version": "<project-name>",
       "tagline": "Project Orientation"
     },
     "sources": [
       { "path": ".claude/strap/project-docs/PROJECT.md",      "id": "project",      "label": "Project" },
       { "path": ".claude/strap/project-docs/ARCHITECTURE.md", "id": "architecture", "label": "Architecture" },
       { "path": ".claude/strap/project-docs/STACK.md",        "id": "stack",        "label": "Stack" }
     ],
     "nav": "auto",
     "footer": "<p>Rendered at <ISO-timestamp> from <project-name>'s curated persistence stack via the STRAP html-render pipeline.</p><p>The three markdown sources are the source of truth; this HTML is regenerated at every /strap-in and /strap-refresh.</p>"
   }
   ```

   Substitute `<REPO_ROOT>` with the absolute path resolved in step 2. If `Project docs paths` is configured to a path OTHER than `.claude/strap/project-docs/`, adjust the `outputPath` and `sources[].path` strings accordingly -- all relative to `basePath`. Always use absolute paths in `basePath` (not `${VAR}` shell-style placeholders); the renderer does not expand shell variables.

4. **Ensure the render dep is installed -- with adopter narration.** Check whether `.claude/strap/tools/html-render/node_modules/marked/` exists. If absent (typical on a fresh adopter install), announce the install BEFORE running it so the adopter knows what the permission prompt is about. The narration shape:

   > To render the HTML companion for your project orientation, I need to install one Node.js package -- `marked` -- locally inside `<REPO_ROOT>/.claude/strap/tools/html-render/`. This is a one-time install scoped to STRAP's tool tree; nothing is installed globally, nothing outside `.claude/`. You'll see a permission prompt from Claude Code for the `npm install` command -- approve to continue.

   Then invoke `npm install` with the working directory explicitly set to the html-render tool directory. The canonical recipe (cross-shell, no CWD persistence into the parent tool context, no `cd` in the command to trip the harness's compound-`cd` audit rule):

   ```bash
   node -e "require('child_process').execSync('npm install --silent --no-save', {cwd: '<REPO_ROOT>/.claude/strap/tools/html-render', stdio: 'inherit'})"
   ```

   `node` spawns `npm` as a child process with `cwd` set via `child_process` options. npm reads `package.json` from that cwd (the html-render directory, where the marked dep is declared), installs into `<cwd>/node_modules/`, and exits. No parent-shell CWD pollution.

   **Why not `npm --prefix <path> install`:** `--prefix` sets npm's install location but DOES NOT change where npm reads `package.json` from -- npm still walks up from the actual CWD. In a session where the parent CWD is the adopter's repo root (which has no `package.json`), `npm --prefix <path> install` fails with `ENOENT: package.json` at the parent path. Documented npm behavior; counter-intuitive but stable.

   **Why not `cd <path> && npm install`:** the `cd` persists in the Bash tool's CWD across calls (Claude Code's documented behavior), drifting the working directory for subsequent commands. The next `node render.js .render-config.json` would then resolve `render.js` from the html-render dir's "ancestor view" and fail. Plus the harness's compound-`cd` audit fires a permission prompt every time.

   **PowerShell-side alternative** (if for some reason `node -e` is not viable): `Push-Location <REPO_ROOT>\.claude\strap\tools\html-render; try { npm install --silent --no-save } finally { Pop-Location }` -- PowerShell's `Push-Location`/`Pop-Location` is shell-local, doesn't affect the Bash tool's CWD state, and triggers no compound-`cd` audit (no `cd` keyword).

   `--no-save` prevents npm from mutating `package.json` (no-op when cwd is correctly the html-render dir, but harmless). The dep set is intentionally minimal (`marked` only) so this completes in 1-2 seconds against any registry mirror. Subsequent `/strap-in` runs see `node_modules/marked/` present and skip the install.

5. **Invoke the pipeline.** From the repo root: `node .claude/strap/tools/html-render/render.js <temp-config-path>`. The pipeline reads each markdown, parses via `marked` (HTML passthrough preserves any rich components tech-writer authored as raw HTML blocks), builds a sidebar nav from H1/H2 headings (`nav: "auto"`), and writes a self-contained HTML to the output path.

6. **Clean up the temp config** after the render succeeds.

7. **Verify the HTML output exists** at the absolute expected path -- use `ls "<REPO_ROOT>/.claude/strap/project-docs/<project-name>-orientation.html"` rather than a relative-path probe, since long polyrepo sessions can drift the Bash CWD. On failure, surface the pipeline error verbatim and continue with the three markdowns as the deliverable (markdown is the canonical source; HTML is a derived artifact and its absence does not block hand-off, but the gap is recorded for the CPO). Common failure modes: Node.js not on PATH at the adopter site; npm install timed out (registry unreachable); marked install succeeded but render.js threw on a malformed source markdown.

The HTML companion lands alongside the three markdowns at the configured `Project docs paths` and gives the team a shareable, formatted, self-contained orientation surface for the project. No external dependencies in the rendered output (CSS inlined; no CDN requirements); opens cleanly in any browser. The render pipeline itself lives inside the adopter's `.claude/` tree -- there is no STRAP-source-clone dependency at runtime, and the tool ships with every install.

#### Surface the orientation docs to the CPO with a security callout

After the HTML companion renders successfully (or the markdowns land cleanly if HTML rendering failed), surface the orientation deliverables to the CPO before falling through to the Section 10 hand-off. This block makes the CPO aware of (a) where the docs live, (b) that they may contain sensitive findings, and (c) gives them the choice to review now in a browser or proceed to source-control / DevOps wire-up.

The narration shape:

> **Project orientation is ready for your review.**
>
> The dev-lead has produced four human-facing orientation documents at `<absolute-path-to-project-docs>/`:
>
>   - `PROJECT.md`       -- what this project is
>   - `ARCHITECTURE.md`  -- how the code is structured
>   - `STACK.md`         -- what it's built with
>   - `<project>-orientation.html`  -- the three above, with a sidebar nav, in one shareable HTML
>
> **Security note: these documents may surface sensitive findings.**
>
> Where the codebase exposes credentials, API keys, hardcoded secrets, or other sensitive material, the dev-lead's curated specialist findings capture them with file:line citations so they can be tracked and remediated. Treat these documents as internal -- they may name real keys you don't want shared. They live locally under `.claude/strap/project-docs/` (or the configured `Project docs paths`) and never leave this machine unless you publish them yourself.
>
> Take a moment to review the summary before we wire up source control and work tracking.

Then prompt via `AskUserQuestion`:

- **Open Summary Document** -- launches the orientation HTML in the OS default browser. Detect the platform and invoke:
  - Windows (PowerShell tool, preferred): `Start-Process "<absolute-path-to-orientation.html>"` -- honors the Windows file association directly with no quoting gymnastics
  - Windows (Bash tool fallback): `start "" "<absolute-path-to-orientation.html>"` (the empty `""` is the window title argument that `start` requires when the path is quoted; the PowerShell form is cleaner when PowerShell is in reach)
  - macOS: `open "<absolute-path-to-orientation.html>"`
  - Linux: `xdg-open "<absolute-path-to-orientation.html>"` (some headless / WSL environments may not have `xdg-open` -- surface the failure and continue without blocking)
  - Detect via `uname -s` (`MSYS_NT-*` / `MINGW64_NT-*` / `CYGWIN*` -> Windows; `Darwin` -> macOS; `Linux*` -> Linux). Fire-and-forget; do not block on the launch. Proceed immediately to the `/connect-*` hand-off in the same turn so the CPO can review the doc while we line up the next prompt.

- **Review Later** -- proceed to the Section 10 hand-off without opening anything.

Both choices are valid; this is informational + UX, not a gating decision. The hand-off summary in Section 10 still includes the project-docs paths so the CPO can come back to them anytime.

### 10. Hand-off summary

Present the CPO with a structured summary. Single-repo:

```
/strap-in complete.

What I found:
  - Stack:        <one-line summary>
  - Architecture: <one-line summary>
  - DevOps signals: <if any detected from CI configs or *.yml>
  - Sensitivities: <any flagged by security-reviewer>

What I updated:
  - .claude/strap/contexts/project-profile.md   (curated; scaffold sentinel stripped)
  - .claude/strap/memory/agents/<name>.md       (one entry per active specialist)
  - .claude/strap/rules/agents/<name>.md        (if any rules were added)
  - <project-docs-path>/PROJECT.md              (human-facing project orientation)
  - <project-docs-path>/ARCHITECTURE.md         (human-facing architecture orientation)
  - <project-docs-path>/STACK.md                (human-facing tech-stack orientation)
  - <project-docs-path>/<project-name>-orientation.html   (self-contained HTML companion -- shareable, polished, no external dependencies)

What is NOT yet set up:
  - Source-control wire-up  -- run /connect-code-repo when ready (REQUIRED; releases the code-immutability invariant and is the operational-mode transition)
  - Work-item tracking      -- run /connect-devops-project when ready (optional; enables filing bugs and stories as work items)

Ambiguities for your call:
  - <list of items the synthesis gate flagged>

```

Polyrepo mode -- same shape with sub-repo summary and umbrella callouts:

```
/strap-in complete (polyrepo umbrella, N=<N> sub-repos).

What I found:
  - Sub-repos:    <count> peer sub-repos at depth-1
                  - <sub-repo-1>: <one-line purpose> (<stack summary>)
                  - <sub-repo-2>: <one-line purpose> (<stack summary>)
                  - ...
  - Umbrella stack:         <one-line summary across sub-repos>
  - System architecture:    <one-line summary capturing runtime topology>
  - Cross-sub-repo runtime deps: <count> contracts captured (see Sub-repos entries in project-profile.md)
  - DevOps signals:  <if any detected from CI configs across sub-repos>
  - Sensitivities:   <any flagged by security-reviewer at umbrella scope>

What I updated:
  - .claude/strap/contexts/project-profile.md   (curated; scaffold sentinel stripped; Sub-repos section populated with <N> entries)
  - .claude/strap/memory/agents/<name>.md       (one entry per active specialist; per-sub-repo specialists have per-sub-repo notes within their memory)
  - .claude/strap/rules/agents/<name>.md        (if any rules were added)
  - <project-docs-path>/PROJECT.md              (human-facing umbrella project orientation)
  - <project-docs-path>/ARCHITECTURE.md         (human-facing umbrella architecture)
  - <project-docs-path>/STACK.md                (human-facing umbrella tech stack with per-sub-repo table)
  - <project-docs-path>/<project-name>-orientation.html   (self-contained HTML companion)

Pre-existing sub-repo .claude/ trees (bystander, untouched):
  - <sub-repo-path>/.claude/      (<contents summary -- e.g., "default Claude Code settings only" or "prior STRAP install")>
  - <list any others; omit this block if none detected>

What is NOT yet set up:
  - Source-control wire-up  -- run /connect-code-repo when ready (REQUIRED)
  - Work-item tracking      -- run /connect-devops-project when ready (optional)
  - Per-sub-repo source-control endpoints  -- separate Feature in the polyrepo Epic; single source-control profile assumed for now
  - Multi-repo execution awareness in /execute-sprint, /fix-bugs, /refine-pr, /quick -- separate Feature

Ambiguities for your call:
  - <list of items the synthesis gate flagged, including Stage 3 runtime-dep gaps if any>

```

Then surface the next-step gate via `AskUserQuestion`:

```yaml
header: "Next step"
question: "What's next?"
options:
  - label: "Connect source control (Recommended)"
    description: "Run /connect-code-repo. Required wire-up: releases the code-immutability invariant and transitions the project from onboarding mode to operational mode. The pipeline cannot open PRs without this."
  - label: "Connect work tracking first"
    description: "Run /connect-devops-project. Optional wire-up: enables agents to file Requirements, Specs, Features, Stories, Tasks, Bugs as work items. The curated bug list is already durable in project-profile.md, so this can run later without losing data."
  - label: "Pause"
    description: "Stop here. Review the curated persistence stack before continuing. Both connect skills can run later in either order."
```

The hand-off is the natural exit from `/strap-in`. Handle the response:

- `Connect source control` -- advise the CPO to run `/connect-code-repo` next; the skill writes the terminal entry to `usage.yaml` (`session.completed_at: <ISO-timestamp>`) and returns control.
- `Connect work tracking first` -- same as above but advise `/connect-devops-project`.
- `Pause` -- write the terminal entry and return control without a next-step recommendation.

Per the design, `/connect-code-repo` is the required wire-up (git is a hard prerequisite; this skill releases the code-immutability invariant); `/connect-devops-project` is optional for evaluation runs. The hand-off recommends code-repo first to align with that contract -- but the CPO can pick either order; both skills must eventually run for the pipeline to operate fully.

## Outputs

- A curated `.claude/strap/contexts/project-profile.md`. Scaffold sentinel stripped. Sections populated with what the dev-lead and specialists found.
- A populated `.claude/strap/memory/agents/<name>.md` for every specialist that activated. Empty bootstrap files for specialists that stayed dormant.
- An updated `.claude/strap/rules/agents/<name>.md` for any specialist whose discovery surfaced a defect worth a rule (most onboardings: none).
- Three human-facing project-orientation documents at the configured `Project docs paths` (or the fallback `.claude/strap/project-docs/`): `PROJECT.md`, `ARCHITECTURE.md`, `STACK.md`. Rendered by tech-writer at Section 9 from the curated persistence stack.
- A self-contained HTML companion at the same path -- `<project-name>-orientation.html` -- rendered by the html-render pipeline at `.claude/strap/tools/html-render/` from the three markdown sources. Polished visual identity matching `Welcome-to-STRAP.html`; no external CDN dependencies; shareable artifact.
- A populated `.claude/strap/state/usage.yaml` with budgets, session start, specialists used (Section 6 + Section 9), and per-agent consumption.
- A `## CPO preferences` section in `.claude/strap/memory/MEMORY.md` indexed by topic file under `.claude/strap/memory/dev-lead/`.
- A continuation file at `.claude/strap/contexts/continuations/strap-in-<project-slug>.md` IF the onboarding spans multiple sessions; otherwise no continuation is written.

## Quality gates

The skill is successful when all of the following hold:

- Pre-flight cleared (scaffold sentinel present at entry, stripped at exit) OR greenfield path completed cleanly.
- Budget prompt answered; values written to both `MEMORY.md` and `usage.yaml`. In polyrepo mode, the projected aggregate was shown to the CPO with the additive math explicit.
- For non-greenfield: every active specialist reported back with a `tokens_used: ~XXk` line; their findings are reflected in the persistence stack.
- The synthesis gate cleared OR the dev-lead surfaced gaps to the CPO and the CPO accepted them in the hand-off.
- Section 9 produced `PROJECT.md`, `ARCHITECTURE.md`, `STACK.md` at the resolved write path; every Mustache placeholder resolved (no literal `{{ var }}` rendered through); spot-check confirmed no fabricated facts. The HTML companion at `<project-name>-orientation.html` rendered alongside without errors (or absence was surfaced to the CPO).
- The hand-off summary names file paths the CPO can audit (persistence stack + project docs).
- No code outside `.claude/strap/` (and the configured `Project docs paths` when it points outside `.claude/strap/`) was modified. The code-immutability invariant applies to production source; tech-writer's local-doc writes at Section 9 are the explicit narrow exception.
- No credentials appear in any tracked file (`.claude/strap/state/usage.yaml`, `MEMORY.md`, per-agent memory, per-agent rules, project-profile, project docs). The skill does not solicit credentials; if a CPO offers one inadvertently, the dev-lead does not echo, persist, or commit it.

**Polyrepo-mode additional gates** (apply only when Section 2 recorded polyrepo mode):

- Polyrepo detection narration was visible to the CPO and the 3-way choice was surfaced via `AskUserQuestion` (never silently switched modes).
- `Sub-repos` H2 section in `project-profile.md` has one H3 entry per detected sub-repo with all 7 fields populated (Path, Purpose, Stack, Conventions, Source-of-truth, Runtime dependencies, Activated). Empty fields are explicit one-line stubs, not missing fields.
- Runtime-dep Stage 3 confirmation was surfaced to the CPO (even if Stage 1 + Stage 2 found zero cross-sub-repo deps -- the CPO confirms "none" rather than the dev-lead assuming).
- Section 9 umbrella project-docs reference the sub-repos correctly; `STACK.md` carries a per-sub-repo stack table.
- Pre-existing sub-repo `.claude/` directories, if any, were mentioned in the hand-off bystander block.

The skill fails -- and reports clearly -- when:

- The scaffold sentinel check finds neither sentinel nor populated profile (install incomplete).
- A specialist dispatch errors uncatchably (CreateTeam failure, agent missing). Surface the failure with the offending agent and the underlying error; the CPO decides whether to retry the failed dispatch or `advance` without it.
- A specialist returns without the `tokens_used: ~XXk` line. Treat as a budget-tracking warning; the run continues but the dev-lead estimates consumption manually and notes the gap in `usage.yaml`.
- The CPO declines at any interactive gate. Write a continuation, capture state in `usage.yaml`, exit cleanly.

## Failure handling

- **`project-profile.md` missing entirely**: install incomplete. Surface a structured message naming the expected path and ask the CPO to re-run the install script. Do not attempt to scaffold the file from inside `/strap-in`; that is the install script's job.
- **`CreateTeam` primitive unavailable in the current session**: surface a structured failure ("the harness does not expose `CreateTeam` in this session -- the multi-process backend may not be configured"). Offer fallback: serial `Task` dispatch one specialist at a time. The CPO chooses. Slower but functional.
- **Specialist dispatch returns with anomalies** (no findings, premature termination, framework error): note the anomaly in `usage.yaml` under that specialist's entry. Surface to the CPO at the synthesis gate; CPO decides whether to redispatch or accept partial coverage.
- **Synthesis gate finds irreconcilable specialist disagreements**: do not pick one specialist's claim over another's silently. Surface the disagreement to the CPO with both positions and ask for a call.
- **CPO declines mid-flow**: write a continuation via `/context-prep strap-in-<project-slug>`. The continuation captures current phase, completed specialists, partial specialists, and remaining work. The next session resumes via `/context-fetch strap-in-<project-slug>`.
- **Budget exhaustion mid-wave**: a single specialist that hits its per-agent budget stops; the dev-lead works with what was reported. Do not redispatch within the same workflow instance. Note the exhaustion in `usage.yaml`.
- **tech-writer wrote outside the configured docs path at Section 9**: surface the deviation; reject the rendered files at the wrong path; re-dispatch with a tighter brief naming the target path explicitly. Do not auto-move files; the deviation is a defect worth addressing in tech-writer's guardrails afterward.
- **Mustache placeholders rendered through to the output**: tech-writer left a literal `{{ var }}` in a file. Re-dispatch with the specific file + placeholder named and the source-material constraint reasserted.
- **tech-writer fabricated content not traceable to source material**: re-dispatch with the offending section flagged and the stub-discipline rule reasserted. Do not silently accept fabricated docs.
- **Section 9 budget exhaustion**: tech-writer hits per-agent budget mid-render. The dev-lead works with what landed and notes the gap in `usage.yaml`; missing sections are added to the hand-off ambiguities list for CPO follow-up via `/strap-refresh`.
- **Section 9 HTML pipeline failure**: surface the pipeline error verbatim (Node trace, marked error, file-not-found, etc.). The three markdown sources are the canonical deliverable and remain valid; HTML companion absence does not block hand-off. The CPO can re-invoke the pipeline manually after fixing the underlying cause (`node .claude/strap/tools/html-render/render.js <config-path>`).
- **`--polyrepo` flag forces polyrepo mode but depth-1 scan finds zero sub-repos**: structured failure ("--polyrepo forced but no depth-1 `.git/` subdirectories detected at install root"). The CPO can either re-invoke without the flag (single-repo mode) or fix the install layout. Do not silently fall back -- the flag was explicit.
- **Polyrepo detection finds exactly one sub-repo at depth-1**: not a polyrepo. Auto-detect requires `N >= 2`. Proceed in single-project mode without prompting; this state is indistinguishable from a single sub-repo cloned alongside an empty umbrella directory, and the latter is the more common case.
- **Polyrepo per-sub-repo specialist dispatch returns with anomalies for a subset of sub-repos** (e.g., backend-engineer succeeds for sub-repo A but errors for sub-repo B): treat each per-sub-repo brief as an independent failure unit. Note the anomaly in `usage.yaml` under the specialist's entry with sub-repo attribution. Surface to CPO at synthesis; CPO decides whether to re-dispatch the failed sub-repo or accept partial coverage. Do not block other sub-repos' findings.
- **Polyrepo Stage 3 runtime-dep confirmation: CPO declines to confirm**: leave `Runtime dependencies` field empty in each `Sub-repos` entry; document the gap in hand-off ambiguities. Do not invent a runtime-dep set without CPO confirmation -- inferred deps without confirmation belong in specialist memory, not in `project-profile.md`.

## References

- [`onboarding-design.md`](../../strap/contexts/onboarding-design.md) -- the v2 onboarding flow design; source of truth this skill implements.
- [`budget-discipline.md`](../../strap/contexts/budget-discipline.md) -- the cross-cutting budget pattern.
- [`CLAUDE.md`](../../../CLAUDE.md) -- super-pair identity, canonical agent roster, persistence stack, single-curator rule.
- [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md) -- the dev-lead identity contract; this skill runs in the dev-lead session.
- [`../../strap/rules/agent-devs.md`](../../strap/rules/agent-devs.md), [`../../strap/rules/agent-ops.md`](../../strap/rules/agent-ops.md) -- team rules including CreateTeam-for-parallel-work, token-reporting, code-immutability.
- [`../../strap/rules/agents/dev-lead.md`](../../strap/rules/agents/dev-lead.md) -- dev-lead-specific guardrails (CreateTeam discipline, budget tracking, structural read-only enforcement).
- [`../strap-refresh/SKILL.md`](../strap-refresh/SKILL.md) -- the re-run path when the project shape changes.
- [`../connect-devops-project/SKILL.md`](../connect-devops-project/SKILL.md), [`../connect-code-repo/SKILL.md`](../connect-code-repo/SKILL.md) -- the next-step skills the hand-off points at.
- [`../context-prep/SKILL.md`](../context-prep/SKILL.md), [`../context-fetch/SKILL.md`](../context-fetch/SKILL.md) -- multi-session checkpoint primitives.
- [`../../strap/docs/strap-in.md`](../../strap/docs/strap-in.md) -- the front-door narrative; reader-facing companion to this skill.
- [`../../strap/templates/project-docs/PROJECT.md.template.md`](../../strap/templates/project-docs/PROJECT.md.template.md), [`../../strap/templates/project-docs/ARCHITECTURE.md.template.md`](../../strap/templates/project-docs/ARCHITECTURE.md.template.md), [`../../strap/templates/project-docs/STACK.md.template.md`](../../strap/templates/project-docs/STACK.md.template.md) -- the three project-docs templates Section 9 renders.
- [`../../agents/agent-ops/tech-writer.md`](../../agents/agent-ops/tech-writer.md) -- tech-writer role contract (covers the codebase-discovery documentation responsibility).
- [`../../strap/rules/agents/tech-writer.md`](../../strap/rules/agents/tech-writer.md), [`../../strap/memory/agents/tech-writer.md`](../../strap/memory/agents/tech-writer.md) -- tech-writer guardrails and tradecraft for the Section 9 dispatch.
- [`../create-mockups/SKILL.md`](../create-mockups/SKILL.md) -- the precedent exception pattern Section 9 mirrors (read-only-at-host + write-allowed-at-local-paths).
