---
name: /strap-upgrade
description: Upgrade the installed STRAP package to a newer version. Default mode fetches the new release (and the previously-installed version, for three-way-merge anchoring) from the distribution URL recorded at install time; --from-source mode preserves the legacy source-clone-driven path for STRAP-on-STRAP development. The skill diffs package vs install, applies non-conflicting upstream changes, surfaces conflicts on protected adopter-owned files for CPO resolution, and updates the version manifest.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion
---

# /strap-upgrade

## Purpose

Apply a new STRAP package version into an existing installation without losing the adopter's local customizations. The dev-lead diffs the upstream `.claude/` tree against the installed `.claude/` tree, applies non-conflicting upstream changes automatically, surfaces conflicts on package-managed paths for CPO resolution, preserves adopter content on protected paths (Category A excluded from diff entirely; Category B seeded-then-curated paths receive package-only adds while install wins on modify/conflict), and updates the version manifest.

This skill is separate from [`/strap-in`](../strap-in/SKILL.md). `/strap-in` is the first-encounter onboarding skill that curates the persistence stack for a freshly-installed STRAP. `/strap-upgrade` assumes a prior install completed (the `.claude/.strap-version.json` sentinel exists) and reconciles package-level changes from a newer release.

Invoke when:

- The adopter wants to take a newer STRAP release into their project.
- A STRAP release calls out a change that requires reconciliation (a new skill, an updated agent role contract, a schema extension on `code-connection.yaml` or `devops-connection.yaml`).
- The adopter detects drift between their installed STRAP and the package version recorded in `.claude/.strap-version.json`.

Do NOT invoke this skill for first-time installs. Use the installer (`infra/install/install.{sh,ps1}`) for the first install, then `/strap-in` to curate the persistence stack.

## Modes

**Distribution mode (default).** The skill reads the `distributionUrl` field from `.claude/.strap-version.json` (written by the installer at first install) and fetches both the new tarball and the previously-installed tarball directly from the published distribution. This is the supported path for adopters who installed via `curl ... | bash` or `iwr ...; .\install.ps1` and do NOT have a STRAP source clone.

**Source mode (`--from-source <path>`).** The skill takes a path to a STRAP source-repo git checkout and uses `git show <previous-tag>:<path>` as the three-way-merge anchor. This is the legacy path retained for STRAP-on-STRAP development and for adopters who maintain a source clone deliberately. Auto-selected when `.strap-version.json` has `distributionUrl: null` (the `-FromSource`/`--from-source` install path records this).

## Owner

**dev-lead.** The skill runs directly in the top-level session -- no specialist dispatch. Package-vs-install reconciliation is a tight conversational loop with the CPO over file-level decisions; a sub-agent boundary adds latency without benefit.

## Inputs

- `$ARGUMENTS` -- optional. Recognized flags:
  - `--from-source <path>` -- force source mode against the named source clone (absolute path).
  - `--distribution-url <url>` -- override the recorded `distributionUrl` (useful for mirrors, air-gapped sites with synced manifest+tarballs).
  - `--target-version <ver>` -- pin the upgrade target version explicitly (default: latest in the installed channel).
  - `--channel <name>` -- override the installed channel for resolution (default: the `channel` field in `.strap-version.json`).
- `.claude/.strap-version.json` -- the installed version sentinel. Required (absence means there is no prior install; redirect to the installer).
- The installed `.claude/` tree under the project root -- the current live state.
- Network access to the distribution URL (distribution mode), OR a STRAP source clone (source mode).

## Pre-flight

1. **Prior install present.** `.claude/.strap-version.json` must exist. If absent, surface that this looks like a fresh project; redirect to the installer.
2. **No STRAP-on-STRAP development context.** When the project itself is the STRAP repository, this skill is not applicable -- you ARE the package source. Surface and stop.
3. **Required tools available.** `tar` always. `curl` for distribution mode (or PowerShell-side `Invoke-WebRequest` -- the dev-lead's Bash tool handles both). `git` only required in source mode.

## Workflow

### Phase 1: Resolve mode

Read `.claude/.strap-version.json`. Parse the JSON; extract:

- `version` -- the installed version
- `channel` -- the channel the install came from (`stable` / `rc` / `source`)
- `distributionUrl` -- the URL the install was fetched from (string for hosted installs, `null` or absent for `--from-source` installs)
- `tarballSha256` -- the SHA-256 of the installed tarball (for distribution-mode validation)

Mode selection:

| `$ARGUMENTS` carries | `distributionUrl` field | Selected mode |
|---|---|---|
| `--from-source <path>` | (any) | source |
| (none) | a URL string | distribution |
| (none) | `null` or absent | source -- but no source-clone path; prompt the CPO via `AskUserQuestion` for the clone path OR confirm distribution mode against a hardcoded fallback URL |
| `--distribution-url <url>` | (any) | distribution (with the override URL) |

For the "absent `distributionUrl`" case, the most common cause is an install that predates the field. Hardcoded fallback distribution URL: `https://lmgstrapdist.blob.core.windows.net/releases`. Surface this assumption to the CPO before proceeding.

#### Channel coercion (source -> distribution transition; v2.5-polish #39692)

When the install's `.strap-version.json` carries `channel: source` AND the resolved mode is `distribution` (the CPO picked distribution against the fallback URL above, or explicitly via `--distribution-url`), the installed `channel` value is meaningless for distribution-mode manifest lookups -- `manifest.channels.source` does not exist (manifests only carry `stable` and `rc`).

Before fetching the manifest in Phase 2, propose `stable` as the coerced target channel via `AskUserQuestion` (skipped when `--channel` was passed on the CLI -- that's an explicit override and takes precedence):

```yaml
AskUserQuestion:
  header: "Target channel"
  question: "This install was anchored to a source clone (channel=source). Distribution mode needs a published channel. Which channel should resolve the target version?"
  options:
    - label: "stable (Recommended)"
      description: "Published stable releases. Default for adopter installs that exited STRAP-on-STRAP development and want the supported upgrade cadence. Persists channel: stable into .strap-version.json on successful upgrade."
    - label: "rc"
      description: "Published release candidates. Use when the team is opting into pre-release validation. Persists channel: rc into .strap-version.json on successful upgrade."
```

The selected channel feeds Phase 2 step 2 (target version resolution) immediately and persists into `.strap-version.json` at Phase 6 alongside the new `version` + `distributionUrl`. The coercion is one-time: once the install carries a non-source channel, future re-runs honour the existing value without re-prompting.

`Cancel` from this prompt aborts the upgrade with no state change. This is deliberately a hard gate -- the resolution can't proceed without a published channel and the CPO is the only one who can pick.

### Phase 2: Acquire the new package and the previous-version anchor

#### Distribution mode

1. **Fetch the manifest.** `curl -fsSL "<distributionUrl>/manifest.json" -o <temp>/manifest.json`. Surface failures with the URL and the underlying curl error.

2. **Resolve the target version.**
   - If `--target-version` is set, use it.
   - Otherwise look up `manifest.channels.<channel>` (where `channel` is the override from `--channel` if set, else the installed channel).
   - Validate the resolved version exists in `manifest.versions`.

3. **Compare versions.** If `target == installed`, exit cleanly with "already at version X, nothing to upgrade." Otherwise proceed (see major-bump check below).

4. **Cache directory.** Use `.claude/strap/state/upgrade-cache/` for downloaded tarballs.

5. **Download the new tarball.** `<distributionUrl>/<manifest.versions[target].tarball.path>` -> `<cache>/strap-<target>.tar.gz`. Verify SHA-256 against `manifest.versions[target].tarball.sha256`. If the cached file already exists and its SHA matches, skip the download.

6. **Download the previous-version tarball.** `<distributionUrl>/<manifest.versions[installed].tarball.path>` -> `<cache>/strap-<installed>.tar.gz`. Verify SHA-256 against `manifest.versions[installed].tarball.sha256` (the manifest carries every published version's checksum). If the cached file already exists and its SHA matches, skip the download.

   If the manifest does NOT carry the installed version (e.g., the install pre-dates the current manifest's retention window OR the install was an intermediate commit between published releases), fall back to the SHA recorded in `.strap-version.json` as a best-effort integrity check on whatever is cached locally. When neither the manifest nor a cache hit can confirm the previous version, drop into **two-way merge mode** (v2.5-polish #39693) rather than failing -- see below.

#### Two-way merge mode (previous-version anchor unavailable)

When step 6 cannot resolve a previous-version anchor (manifest dropped the version + no SHA-matching cache hit + no `--from-source` clone available), proceed with a two-tree comparison instead of failing. The classification table in Phase 3 collapses:

| Three-way classification | Two-way equivalent |
|---|---|
| `unchanged` (install == new) | `unchanged` |
| `package-only` (path in new, not in install) | `package-only` (unchanged) |
| `install-only` (path in install, not in new) | `install-only` (unchanged) |
| `package-modified clean` (install == prev, install != new) | **Not distinguishable** -- folds into `conflict` because the anchor that lets us tell "adopter touched this" from "package changed this" is gone |
| `conflict` (install != prev AND install != new) | `conflict` |
| `prev-only` (path in prev + install, not in new) | **Not distinguishable** -- folds into `install-only` (we can't tell the package previously shipped this file then removed it from an install-authored file that was always local) |

The practical consequence: every install file that differs from the new package version surfaces as `conflict`. This is by design -- without an anchor we cannot safely auto-apply the package version to files that might carry adopter customization. The conflict-strategy gate in Phase 4 marks `take-package` as Recommended for this mode (rationale below).

Stamp `metadata.two_way_merge: true` on the upgrade-report at Phase 5 for transparency. Also surface a one-line note at the top of the Phase 4 plan:

```
Two-way merge mode: previous-version anchor unavailable; package-modified clean classification disabled.
Every install file differing from the new package surfaces as conflict for CPO decision.
```

Adopters who want to restore three-way discipline can re-install at the current version to re-anchor (the installer writes a fresh `.strap-version.json` with the matching tarball SHA), then re-invoke `/strap-upgrade`. This is the documented recovery path.

7. **Extract both tarballs into temp directories.** Both extract paths contain `.claude/` at the root afterward. Use a platform-aware recipe -- detect via `uname -s` (`MSYS_NT-*` / `MINGW64_NT-*` -> Windows; `Darwin` -> macOS; `Linux*` -> Linux):

   - **macOS / Linux** (Bash tool):
     ```
     tar -xzf <cache>/strap-<target>.tar.gz -C <temp>/new/
     tar -xzf <cache>/strap-<installed>.tar.gz -C <temp>/prev/
     ```

   - **Windows -- PowerShell tool (preferred).** Invoke Windows-native `tar.exe` (Win10+ ships bsdtar at `System32\tar.exe`) directly -- no MSYS emulation layer in the path:
     ```
     tar.exe -xzf "<cache>\strap-<target>.tar.gz" -C "<temp>\new\"
     tar.exe -xzf "<cache>\strap-<installed>.tar.gz" -C "<temp>\prev\"
     ```

   - **Windows -- Bash tool fallback.** When extracting through Git Bash, `tar` interprets the leading `C:` in `C:/...` paths as an `rsh` remote host. Pass `--force-local` to disable that behavior:
     ```
     tar --force-local -xzf "<cache>/strap-<target>.tar.gz" -C "<temp>/new/"
     tar --force-local -xzf "<cache>/strap-<installed>.tar.gz" -C "<temp>/prev/"
     ```

8. **Hand off to Phase 3** with three trees: `prev` (anchor), `new` (target), and the installed `.claude/` tree under the project root.

#### Source mode

1. **Validate the source-clone path** (from `--from-source` arg, `STRAP_SOURCE` env, or `AskUserQuestion` prompt). It must contain `.claude/` and `.git/`.

2. **Derive the package version** per the installer's source-mode convention:
   - When the source clone's working tree is clean: `source-<short-sha>`
   - When dirty: `source-<short-sha>-dirty`
   - When a published `package/VERSION` file is present and authoritative: use its content verbatim

3. **Compare versions** -- same table as distribution mode below.

4. **Hand off to Phase 3** with the source-clone's `.claude/` as `new` and `git show <previous-tag>:<path>` (resolved per the legacy logic) as the `prev` anchor. The previous-version resolution chain in source mode:
   - Installed version is `source-<sha>` -> `git show <sha>:<path>`
   - Installed version is a published semver with a matching tag in the clone (e.g., `v2.2.0`) -> `git show v2.2.0:<path>`
   - Neither available -> classify the affected path conservatively as `conflict`

#### Version comparison (both modes)

| Comparison | Action |
|---|---|
| Equal | Nothing to upgrade. Report "already at version X" and exit cleanly. |
| Target is a different `source-<sha>` than installed | Proceed (assume forward) -- source-mode versions have no ordering. Surface the source-clone HEAD's `git log -1` summary. |
| Target semver-greater than installed (same major) | Proceed. |
| Target semver-greater than installed (higher major) | Stop. Surface the major bump; direct the CPO to read the release notes for that major version before re-invoking. Major bumps may carry breaking schema changes this skill does not auto-apply. |
| Installed version newer than target | Stop. Surface the inversion. |

### Phase 3: Diff the trees

Walk three trees in parallel: `prev` (the anchor), `new` (the target package), and `install` (the project's current `.claude/`). For every path under `.claude/`, classify:

| Classification | Condition | Action (default; protected-path rules below may modify) |
|---|---|---|
| `unchanged` | `install` byte-equal to `new`. | Skip. |
| `package-only` | Path in `new`, not in `install`. | Stage to add. Suppressed for Category A protected paths; APPLIED for Category B seeded-then-curated paths. |
| `install-only` | Path in `install`, not in `new`. | Leave alone. Surface for CPO awareness if under a package-managed directory (skills, agents, team rules, templates, adapters, contexts). |
| `package-modified clean` | `install` differs from `new`, AND `install` byte-equal to `prev` (adopter has not touched the file since install). | Stage to overwrite. Suppressed for both protected-path categories (install wins). |
| `conflict` | `install` differs from `new`, AND `install` differs from `prev` (adopter modified after install AND package changed). | Surface for CPO resolution; do not auto-merge. For both protected-path categories: surfaced as awareness, install wins, not subject to the conflict-strategy gate. |
| `prev-only` | Path in `prev` and `install`, not in `new` (the package removed the file in the new version). | Surface for CPO awareness; the adopter may want to keep their copy or delete it. |

**Determining "prev" for a path:**

- **Distribution mode**: read from `<temp>/prev/<path>` (the extracted previous-version tarball).
- **Source mode**: `git show <previous-tag-or-sha>:<path>` from the source clone (legacy behavior; same resolution order as today).

**Protected paths fall into two categories** with different rules.

**Category A -- adopter-owned (NEVER touched by this skill, even adds):**

These paths represent state owned entirely by the adopter install or by the installer. They are excluded from the diff entirely; even `package-only` adds are NOT applied. Where applicable, the installer (not this skill) is responsible for writing a per-install copy at first install:

- `.claude/.strap-version.json` -- updated by this skill itself at Phase 6; not subject to diff
- `.claude/settings.json` and `.claude/settings.local.json` -- adopter permissions / env
- `.claude/strap/contexts/project-profile.md` -- the curated record of THIS project (dev-lead-curated during `/strap-in`); installer copies a scaffold from `.claude/strap/templates/project-profile.scaffold.md` once at first install
- `.claude/strap/contexts/continuations/` -- session-state runbooks
- `.claude/strap/state/` -- connection profiles, sprint reports, usage tracking, upgrade-cache, any per-install state
- `.claude/strap/work/` -- when Local (strap-agile) is the work-tracking host, this carries the adopter's work items
- `.claude/strap/wikis/` -- where tech-writer drafts community/code docs against the configured docs adapter. Adopter content.
- `.claude/strap/mockups/` -- where `/create-mockups` writes designer-authored mockup files (default fallback only; adopter `Mockup paths` overrides are out-of-tree).
- `.claude/strap/investigations/` -- where `/quick --investigation` writes specialist investigation reports keyed by Task id.
- `.claude/strap/project-docs/` -- where tech-writer writes the human-facing project-orientation documents (default fallback only).

**Category B -- seeded-then-curated (package-only adds APPLIED; reconcile on package-modified clean; install-wins on conflict):**

These paths ship from STRAP source as scaffolds / seeds. The adopter dev-lead curates against them through `/strap-in` and ongoing operations. On upgrade:

- `package-only` adds: **APPLIED** -- a new file at STRAP source (e.g., a new operating learning at the dev-lead memory level, or a new specialist's seed memory/rules accompanying a new role contract) lands at the adopter install.
- `package-modified clean` (install byte-equal to prev seed): **RECONCILE CANDIDATE** (v2.5 #39694). The install has not been curated since the seed AND upstream improved the file. Add to the reconcile-candidates list for Phase 4 surfacing via a batched AskUserQuestion. The CPO decides: Keep install (default; Recommended), Apply all upstream improvements, or Review per-file. **Why the reconcile exists**: pre-v2.5 behavior was to skip these files (install-wins regardless of customization state), so adopters who hadn't customized a seed silently missed upstream improvements. Pace v2.4.0 surfaced this directly -- req-lead / spec-lead / test-strategist per-agent rules were byte-identical to the source-972a2f2 seed and the polish-fb2d370 improvements never landed; the specialists ran on stale rules.
- `conflict` (install differs from both prev seed AND new package): SKIPPED -- adopter has customized the seed; install version is authoritative. Surfaced in the plan for awareness only.
- `prev-only`: leave alone -- if a later STRAP version retires a seed, the adopter's copy stays in place.

**Two-way merge mode caveat (v2.5 #39694).** The reconcile path requires the prev-seed anchor to compute byte-equality. In two-way merge mode (Phase 2 fell back to two-tree comparison; no prev anchor), the reconcile path is silently disabled -- Category B files that differ from the new package fold into the `conflict` list per the collapsed two-way classification and are SKIPPED. Adopters who want reconcile semantics can re-install at the current version to restore the prev anchor, then re-invoke `/strap-upgrade`.

Category B paths split into two subtypes (v2.5 #39696). The split is significant for the reconcile gate's Recommended marker -- see Phase 4 "Category B reconcile gate":

**Subtype: rules-doctrine** -- STRAP-authored doctrine. Adopters who have not customized generally want upstream improvements landing.

- `.claude/strap/rules/agents/*.md` -- per-agent rules. Doctrine the STRAP source curates as specialist guardrails. Polish releases regularly improve the wording, the trade-off framing, the do/don't lists. An adopter whose copy is byte-equal to the prev seed has not had reason to override the doctrine; reconcile defaults toward "Apply all upstream" so improvements flow.

**Subtype: memory-tradecraft** -- adopter-curated learning. Even an untouched memory file represents an intentional state (the adopter has not had cause to record anything for that surface yet).

- `.claude/strap/memory/MEMORY.md` -- the dev-lead's memory index. Ships with the STRAP-source-curated index entries (universal operating learnings); adopter dev-lead extends through `/strap-in` and ongoing curation.
- `.claude/strap/memory/dev-lead/` -- the dev-lead's per-topic memory files. Ships with universal operating learnings (e.g., Bash CWD drift in polyrepo sessions, Windows shell selection); adopter dev-lead adds entries via `/memory-refine` or organic curation.
- `.claude/strap/memory/agents/*.md` -- per-agent memory. Package ships a seed/scaffold per active specialist role; once the dev-lead curates, the install version is authoritative for modify/conflict. New per-agent memory files (e.g., a brand-new specialist arriving in a later STRAP version) land via the package-only add rule.

**Both subtypes share the same Phase 3 classifier rules.** The subtype only changes the Recommended marker on the Phase 4 reconcile-gate AskUserQuestion. `package-only` adds APPLY in both. `package-modified clean` becomes a RECONCILE CANDIDATE in both (with different Recommended). `conflict` stays SKIPPED (install-wins) in both. `prev-only` is left alone in both.

**Package-owned paths (subject to diff/apply):**

Everything else under `.claude/` that the tarball ships:

- `.claude/agents/**` -- agent role contracts (`dev-lead`, `backend-engineer`, etc.)
- `.claude/skills/**` -- skill `SKILL.md` files
- `.claude/strap/rules/agent-devs.md` and `.claude/strap/rules/agent-ops.md` -- team-wide rules
- `.claude/strap/templates/**` -- work-item templates, project-profile scaffold, connection-template accelerators, project-docs templates
- `.claude/strap/contexts/onboarding-design.md`, `budget-discipline.md`, `continuation-format.md` -- skill-referenced design docs that ship in the package
- `.claude/strap/docs/**` -- narrative front-door docs (welcome.md, strap-in.md, architecture.md, customization-guide.md, upgrade-guide.md, Welcome-to-STRAP.html)
- `.claude/strap/tools/**` -- html-render pipeline, future tools

### Phase 4: Present the plan

Compose a structured upgrade plan for the CPO:

```
Upgrade plan:
  Mode:         <distribution|source>
  Installed:    <version>      (from .claude/.strap-version.json)
  Target:       <version>      (from <manifest URL | source-clone path>)
  Channel:      <channel>      (resolved to target via manifest)
  Distribution: <distributionUrl>     (distribution mode)
  Source clone: <path> + HEAD <sha>   (source mode)

File classifications:
  unchanged:                       N
  package-only:                    N    (will be added)
  package-modified clean:          N    (will be overwritten -- adopter hasn't touched these)
  Category B reconcile candidates: N    (install == prev seed; upstream improved -- CPO reconcile decision)
  install-only:                    N    (left alone; surfaced if under package-managed directory)
  prev-only:                       N    (removed in the new version; left alone)
  conflict:                        N    (adopter modified after install AND package changed -- CPO decision)

Adds (package-only):
  + .claude/skills/new-skill/SKILL.md
  + .claude/agents/agent-devs/new-specialist.md
  ...

Overwrites (package-modified clean, package-owned):
  ~ .claude/skills/decompose-feature/SKILL.md
  ~ .claude/agents/agent-devs/backend-engineer.md
  ...

Category B reconcile candidates (CPO decision -- v2.5 #39694; subtype split #39696):
  Subtype: rules-doctrine (Recommended: Apply all upstream)
    ? .claude/strap/rules/agents/req-lead.md         (install == prev seed; upstream improved)
    ? .claude/strap/rules/agents/spec-lead.md        (install == prev seed; upstream improved)
    ? .claude/strap/rules/agents/test-strategist.md  (install == prev seed; upstream improved)
    ...
  Subtype: memory-tradecraft (Recommended: Keep install)
    ? .claude/strap/memory/MEMORY.md                 (install == prev seed; upstream improved)
    ? .claude/strap/memory/dev-lead/operating_*.md   (install == prev seed; upstream improved)
    ? .claude/strap/memory/agents/spec-lead.md       (install == prev seed; upstream improved)
    ...

Conflicts (CPO decision):
  ! .claude/strap/rules/agent-devs.md
      install differs from previous-version (adopter customized)
      package differs from previous-version (upstream changed)
      diff-summary (one-line each): <how install diverges from previous> | <how package diverges from previous>
  ...

install-only files under package-managed directories (awareness only):
  i .claude/skills/some-custom-skill/SKILL.md  (likely adopter-authored skill)

prev-only files (removed in new version, awareness only):
  - .claude/strap/contexts/legacy-design-doc.md  (left in install)

Cross-cutting impact:
  - Touches skill SKILL.md files (no impact on running workflows; reload on next invocation)
  - Touches agent role contracts (specialists reload on next dispatch)
  - Touches connection-profile schema documentation (in /connect-{code-repo,devops-project})
    -> Recommend re-reading the schema docs; existing connection profiles do not auto-update
  - Introduces N new skills -> Recommend /strap-refresh after upgrade so dev-lead can curate per-project context against the new pieces
```

#### Category B reconcile gate (v2.5 #39694; subtype split #39696)

When the reconcile-candidates list from Phase 3 is non-empty AND the upgrade is in three-way merge mode, fire a batched AskUserQuestion BEFORE the main conflict-strategy gate below. (In two-way merge mode the list is always empty; the prev-seed anchor required to detect reconcile candidates does not exist.)

**The prompt is split by Category B subtype (v2.5 #39696).** Subtype boundaries are declared in the Category B paths block in Phase 3. Each subtype carries a different Recommended marker:

- **rules-doctrine** (`.claude/strap/rules/agents/*.md`): Recommended swings to **Apply all upstream improvements**. STRAP-authored doctrine; adopters who have not customized generally want polish improvements landing.
- **memory-tradecraft** (`.claude/strap/memory/MEMORY.md`, `.claude/strap/memory/dev-lead/`, `.claude/strap/memory/agents/*.md`): Recommended stays **Keep install**. Adopter-curated learning surface; an untouched memory file represents an intentional state, not abandonment.

When both subtypes have candidates, fire TWO sequential AskUserQuestion calls (one per subtype). When only one subtype has candidates, fire a single prompt with that subtype's defaults.

**rules-doctrine prompt:**

```yaml
AskUserQuestion:
  header: "Per-agent rules unchanged from seed"
  question: "<N> per-agent rules files (.claude/strap/rules/agents/*.md) match the original seed byte-for-byte AND upstream improved the doctrine. Apply upstream improvements?"
  options:
    - label: "Apply all upstream improvements (Recommended)"
      description: "Overwrite all <N> rules-doctrine files with the new package's version. Safe specifically because each file is byte-equal to the original seed -- no adopter customization is lost. Rules-doctrine is STRAP-authored guardrail content; recommended when the polish improves wording / trade-off framing / do-don't lists."
    - label: "Keep install"
      description: "Preserve current rules content. These files are not overwritten; the specialist agents continue running with the install version. Choose this when the adopter has deliberately decided the current rules suit their context even though they haven't edited them."
    - label: "Review per-file"
      description: "Walk each rules-doctrine candidate one at a time. For each: file path, one-line diff summary, AskUserQuestion with Keep install / Apply upstream / View full diff (loops back). Records the per-file decision in the upgrade report."
```

**memory-tradecraft prompt:**

```yaml
AskUserQuestion:
  header: "Memory files unchanged from seed"
  question: "<N> memory files (.claude/strap/memory/... -- MEMORY.md / dev-lead/ / agents/) match the original seed byte-for-byte AND upstream improved them. Apply upstream improvements?"
  options:
    - label: "Keep install (Recommended)"
      description: "Preserve current memory content. These files are not overwritten; the adopter continues with the install version. Memory is adopter-curated learning -- an untouched file represents an intentional state, not abandonment. Most adopters keep install."
    - label: "Apply all upstream improvements"
      description: "Overwrite all <N> memory-tradecraft files with the new package's version. Safe specifically because each file is byte-equal to the original seed -- no adopter learning is lost. Use when the upstream memory updates (e.g., new operating learnings the STRAP source has codified) are worth pulling in."
    - label: "Review per-file"
      description: "Walk each memory-tradecraft candidate one at a time. For each: file path, one-line diff summary, AskUserQuestion with Keep install / Apply upstream / View full diff (loops back). Records the per-file decision in the upgrade report."
```

In both prompts, `Review per-file` loops back into AskUserQuestion per candidate with options `Keep install` / `Apply upstream` / `View full diff` (View full diff prints the unified diff and loops back to the same three-option prompt). Decisions are captured into the same data structure that `Apply all upstream improvements` would have populated (one outcome per candidate); Phase 5 applies the union.

`Cancel` from either prompt aborts the entire upgrade with no state change (same semantics as Cancel on the main approval gate). `Pause` is NOT offered here -- the reconcile decision is small enough that the CPO either commits or aborts; partial reconcile decisions do not write to a pending state file.

When the reconcile-candidates list is empty, this sub-phase is silently skipped. When one subtype is empty and the other is not, only the non-empty subtype's prompt fires.

#### Main approval gate

Use `AskUserQuestion` for the approval gate. Options vary by merge mode.

**Three-way merge mode (previous-version anchor available):**

- `Apply (skip conflicts)` -- apply adds and clean-overwrites; conflicts stay unchanged and are reported at the end for manual resolution.
- `Apply with conflict strategy: take-package` -- apply adds, clean-overwrites, AND overwrite every conflict with the package version. Adopter customization to per-agent memory / rules / etc. would be lost; surface this consequence explicitly before confirming.
- `Apply with conflict strategy: keep-install` -- apply adds and clean-overwrites; leave every conflict file alone with the install version. Adopter customization preserved; package updates to those files are NOT applied.
- `Pause` -- stop without changes. The skill writes a state file at `.claude/strap/state/upgrade-pending.md` capturing the plan; the CPO resolves conflicts manually and re-invokes.
- `Cancel` -- abandon the upgrade. No state file, no changes.

**Two-way merge mode (previous-version anchor unavailable; v2.5-polish #39693):**

In two-way mode the `package-modified clean` classification is unreachable -- every install file differing from the new package version surfaces as conflict (per the collapsed classification table in Phase 2). The `take-package` strategy is the well-formed default and SHOULD be presented as Recommended with the rationale inline:

- `Apply with conflict strategy: take-package (Recommended for two-way mode)` -- apply adds AND overwrite every conflict with the package version. **Why recommended:** package-managed paths (`.claude/skills/`, `.claude/agents/`, `.claude/strap/contexts/<design-docs>`, `.claude/strap/rules/agent-{devs,ops}.md`, `.claude/strap/templates/`, `.claude/strap/docs/`, `.claude/strap/tools/`) are not adopter-edited in well-formed installs -- Category A adopter-owned paths and Category B seeded-then-curated paths are excluded from the diff entirely by the Phase 3 protected-paths rules and are never present in the conflict list. The conflicts that DO surface are therefore overwhelmingly upstream improvements the adopter wants applied; `keep-install` in this mode silently throws away upstream fixes. Confirm the list before proceeding.
- `Apply with conflict strategy: keep-install` -- apply adds; leave every conflict file alone with the install version. Use only when the adopter has knowingly edited package-managed paths (rare in well-formed installs; surface the per-file list for explicit acknowledgement before confirming).
- `Apply (skip conflicts)` -- apply adds only; conflicts stay unchanged and are reported for manual resolution. Equivalent to `keep-install` in effect (no anchor means no auto-resolved files to apply); offered for consistency with three-way mode.
- `Pause` -- stop without changes; write the pending plan.
- `Cancel` -- abandon the upgrade.

For `take-package` in EITHER mode, re-prompt with a confirmation showing the exact list of conflict files that would be overwritten and the per-file consequence. In two-way mode the confirmation explicitly notes that anchor-loss is the reason these files surfaced as conflicts (not adopter edits per se).

### Phase 5: Apply the plan

Apply staged adds and overwrites:

1. For each `package-only` add: copy the file from `new` to `install`, creating intermediate directories as needed.
2. For each package-owned `package-modified clean` overwrite: copy the file from `new` to `install` (replacing the install version).
3. For each Category B reconcile candidate under the chosen reconcile decision (v2.5 #39694; subtype-keyed per #39696). Each candidate carries a subtype tag (`rules-doctrine` or `memory-tradecraft`); the decision applies per-subtype:
   - Subtype's decision was `Keep install`: no write for any candidate of that subtype.
   - Subtype's decision was `Apply all upstream improvements`: copy each candidate from `new` to `install`.
   - Subtype's decision was `Review per-file`: apply per the captured per-file decision (Keep install or Apply upstream).
4. For each `conflict` under the chosen conflict strategy: apply per the strategy (or skip under `Apply (skip conflicts)`).

After all writes, render an upgrade report at `.claude/strap/state/upgrade-reports/<ISO-timestamp>.md` capturing:

- Mode used (distribution / source)
- Installed version (before)
- Target version (now)
- Distribution URL (if distribution mode) or source clone path + HEAD sha (if source mode)
- Files added (full path list)
- Files overwritten (full path list of package-owned `package-modified clean` files)
- Category B reconcile decisions (v2.5 #39694; subtype-keyed per #39696): per-subtype (rules-doctrine, memory-tradecraft) the chosen option (Keep install / Apply all upstream / Review per-file) and the per-file outcomes (kept install / applied upstream) for each candidate
- Files conflict-resolved (full path list, per strategy chosen)
- Files conflict-skipped (full path list, awaiting manual CPO action)
- Files install-only under package-managed directories (awareness list)
- Files prev-only (removed in target version, left in install)
- Cross-cutting impact warnings carried forward from the plan

Phase 7 appends a `## Migration outcomes` section to this same file after running schema migrations (see Phase 7's "Diagnostic surface" sub-section). The augmented report is the canonical single-file record of the upgrade.

### Phase 6: Update the version manifest

Update `.claude/.strap-version.json`:

- `version` -> the target version
- `tarballSha256` -> the SHA-256 of the new tarball (from the manifest in distribution mode; the source-mode local tarball SHA in source mode; or unchanged when the upgrade resolved to a `source-<sha>` version)
- `installedAt` -> current UTC timestamp
- `installedBy` -> `strap-upgrade.skill`
- `channel`, `distributionUrl` -> unchanged (re-installing via `infra/install` is the way to change those)

### Phase 7: Version-specific schema migrations

Some version transitions introduce changes to adopter-owned files (the project profile, connection profiles, work items in the host) that cannot land via the package-level diff in Phase 5. These changes require interactive migration with the CPO. Phase 7 reads the version transition (prev -> new from Phase 2's comparison) and runs the relevant migration paths.

#### Re-read this skill from disk before running migrations

Phase 5 just wrote the target-version copy of `.claude/skills/strap-upgrade/SKILL.md` to the install, replacing the version this skill loaded into memory at upgrade start. Migrations new to the target version live inside the on-disk content. Before running any sub-migration:

1. `Read .claude/skills/strap-upgrade/SKILL.md` -- the full file (now the target-version content).
2. Locate the `### Phase 7: Version-specific schema migrations` section in the on-disk content.
3. Continue from that section's instructions, including sub-migrations introduced by the new version that the in-memory copy does not yet know about.

**Why this matters (Pace v2.4.0 surfacing, 2026-05-31).** Pace's source-972a2f2 -> v2.4.0 upgrade hit this failure mode directly. The dev-lead loaded source-972a2f2's SKILL.md (knowing migrations 7.i through 7.v) at upgrade start. Phase 5 wrote v2.4.0's SKILL.md (introducing 7.vi Azure Repos REST templates and 7.vii pipeline_match_patterns) to disk via take-package. Phase 7 then ran from the in-memory source-972a2f2 content; 7.vi and 7.vii never executed. Pace operationally worked around via manual `/connect-code-repo` and `/connect-devops-project` re-runs. The re-read step closes the gap for every future migration the package introduces.

**When the target version introduces no new schema migrations** (the on-disk Phase 7's sub-migration list is identical to the in-memory copy): the re-read is a no-op in effect. Sub-migrations still run idempotently; each consults its own sentinel and short-circuits.

**Adopter boundary caveat.** Adopters upgrading FROM a pre-v2.5 version INTO v2.5+ ran the upgrade with a pre-re-read Phase 7 in memory, so the v2.5 sub-migrations introduced by this transition are NOT auto-applied on the upgrade itself. Subsequent upgrades (from v2.5+ onward) operate from the in-memory re-read step and pick up all future sub-migrations correctly. Documented one-time recovery for the pre-v2.5 -> v2.5 boundary: see Phase 8 recommendations.

#### Common contract for sub-migrations

Migrations are idempotent: re-running an already-applied migration is a no-op. They are also order-independent within a phase boundary -- the dev-lead can run sub-migrations in any sequence; each consults its own sentinel/version field before doing anything.

Each sub-migration produces one of four tracked outcomes; record these for the diagnostic surface at the end of the phase:

- `fired` -- the sentinel was absent or stale, the sub-migration ran, and changes were written.
- `already-applied` -- the sentinel was present at the target schema version; the sub-migration was a no-op.
- `cpo-skipped` -- the CPO chose Skip via AskUserQuestion. The skip is recorded per the sub-migration's defined record location (e.g., 7.vi writes to `.strap-version.json.skipped_migrations`).
- `n/a` -- the install shape does not apply (e.g., 7.vi N/A when no Azure Repos host; 7.iii / 7.v / 7.vii N/A when single-repo umbrella; 7.iv N/A when CPO declined the optional capture at a prior pass and the sentinel records the decline).

When the transition crosses a version boundary that introduces no schema migrations, this phase is a silent no-op.

#### v2.4 migrations (when crossing from any v2.3.x to v2.4.0 or above)

Three sub-migrations apply. Each checks its own state before acting; idempotent on re-run.

##### 7.i -- project-profile.md Sub-repos prose-to-structured migration

Check `project-profile.md` for a `Sub-repos` section. Three cases:

- **Absent**: single-repo install. No migration needed. Move to 7.ii.
- **Present + v2.4 sentinel detected** (`<!-- strap-schema: sub-repos-v2.4 -->` or later): already migrated. Skip.
- **Present + no sentinel** (v2.3 prose form): run the prose-to-structured migration.

Interactive migration flow:

1. **Parse existing prose entries**. Walk each H3 under `## Sub-repos`; extract the v2.3 fields (Path, Purpose, Stack, Conventions, Source-of-truth, Runtime dependencies, Activated) per H3.
2. **Field renames** (semantic preserved):
   - `Purpose` -> `Role`
   - `Runtime dependencies` -> `Depends on`
3. **Per sub-repo, prompt for new v2.4 fields** (with build-file inspection defaults per the patterns in `/strap-in` Section 8's "Build-file inspection patterns" subsection -- single source of truth):
   - `Slug` (auto-suggest from path; CPO confirms)
   - `Primary language` (manifest-driven default)
   - `Active domains` (multi-select with signal-ranked suggestions)
   - `Test command` (manifest-driven default)
   - `Build command` (manifest-driven default)
   - `Parallel safe` (default false; CPO opt-in to true)
   - `Deployment target` (free-text or blank)
4. **Persist the rewritten Sub-repos section** with the sentinel comment + the 14-field bullet list per H3. Preserved values: original prose Stack / Conventions / Source-of-truth / Activated. New values: from step 3 prompts. Renamed: Role from Purpose, Depends on from Runtime dependencies.

**Reset-and-re-run escape valve.** At the start of the migration, present the CPO with an option: "Run interactive migration (Recommended)" / "Reset and re-run /strap-in (archive current project-profile.md as `project-profile.<ts>.md.bak`)". The reset path is useful when the v2.3 prose is sparse or stale enough that re-running /strap-in is cleaner than walking each field.

##### 7.ii -- Connection-profile schema_version migration

Check `.claude/strap/state/code-connection.yaml` and `.claude/strap/state/devops-connection.yaml` for the top-level `schema_version` field.

- **Both profiles missing**: pre-onboarding state. No migration. Recommend `/connect-code-repo` + `/connect-devops-project` at Phase 8.
- **`schema_version` at or above 2.4**: already migrated. Skip.
- **`schema_version` absent or below 2.4**: run the connection-profile migration.

Interactive migration flow (per profile, independently):

1. **Read existing top-level fields** (host, organization, project, default_branch, branch_patterns, auth, mapping, capabilities, operation_templates).
2. **Stamp `schema_version: "2.4"`** as the new first key.
3. **On polyrepo umbrellas** (Sub-repos populated in project-profile.md after 5b.i lands): walk the CPO through adding per-sub-repo overrides via the same logic as `/connect-code-repo` Step 6 (or `/connect-devops-project` Step 6 for the devops profile). Default proposal: empty mappings (all sub-repos inherit). CPO can override per sub-repo.
4. **On single-repo umbrellas**: just stamp `schema_version`. No `sub_repos:` map.
5. **Refresh `validated_at` + `validated_by`** on entries touched.

##### 7.iii -- Active-Task `sub_repo` backfill (polyrepo umbrellas only)

After 7.i + 7.ii apply, on polyrepo umbrellas: query the work-tracking host for Tasks in Active (and optionally New) state lacking the `sub_repo` field (per the connection profile's `mapping.fields.sub_repo` resolver).

- **Zero results**: silent no-op with a one-line summary ("No backfill needed -- 0 Active Tasks lack `sub_repo`."). The typical case for installs that adopted v2.4 before accumulating significant v2.3-era polyrepo work.
- **One or more results**: present an interactive backfill table:

  ```
  | Task id | Title                                       | Suggested sub_repo | Confirm? |
  |---------|---------------------------------------------|--------------------|----------|
  | #12345  | Add login button styling                    | web-frontend       | (Y/N/?)  |
  | #12346  | Update auth middleware                      | api-backend        | (Y/N/?)  |
  | #12347  | Bump shared-types version                   | (ambiguous)        | (?)      |
  ```

  Suggestion logic mirrors `/quick`'s Phase 1 step 2 sub-repo classification: title keyword match against Sub-repos `Role` / `Active domains` / `Path` / language hints. Strong single matches get the auto-suggestion; ambiguous Tasks flagged for CPO inspection.

  CPO walks the table in one batched pass: confirm / reject / specify-manually per Task. Bulk update via the work-tracking adapter applies all confirmations in one operation when the host supports batch updates; falls back to per-Task updates otherwise.

**Resolved / Closed Tasks ignored** -- their lack of `sub_repo` does not affect future routing. Single-repo umbrellas: skip backfill entirely (no `sub_repo` concept).

##### 7.iv -- Umbrella `deployment_targets:` backfill

After 7.ii migrates the connection profile to `schema_version: "2.4"`, check `.claude/strap/state/devops-connection.yaml` for a top-level `deployment_targets:` list. Three cases:

- **Present and non-empty**: already declared (possibly via /connect-devops-project Step 5b on a prior session, or an earlier 7.iv run). Skip.
- **Absent OR empty list**: run the interactive backfill.
- **Single-repo umbrella + CPO declines optional capture**: leave absent; single-repo deployment-topology modeling is optional in v2.4 and deferred to v2.5+ for automatic attribution. Skip.

Interactive backfill flow:

1. **Surface the migration intent**. Present the CPO with one paragraph framing: "v2.4 introduces `deployment_targets:` as the umbrella's declarative deployment topology. References from sub-repos drive Feature 9's per-target deployment-frequency math + per-target pipeline funnel. Declaration is optional -- adopters whose deployments live outside STRAP's attribution model may skip."

2. **`AskUserQuestion`: "Declare deployment_targets: now?"** Two options: `Yes, declare targets now (Recommended)` / `Skip (revisit via /connect-devops-project later)`. Skip ends 7.iv; the field stays absent.

3. **On `Yes`, invoke the per-target capture loop from `/connect-devops-project` Step 5b** -- same name + cloud (enum: vercel/azure/aws/gcp/on-prem/other) + environment + region (optional) capture per target; same "add another?" loop exit. Migration re-uses the same prompts to keep the adopter mental model coherent (one interview shape for the same field in two skills).

4. **Persist the captured list** to `devops-connection.yaml` at the top level (sibling of `host`, `sub_repos:`, etc.). Stamp `deployment_targets_validated_at:` + `deployment_targets_validated_by:` mirroring the existing top-level discipline.

5. **Idempotency**: re-running 7.iv when `deployment_targets:` already exists with non-empty content is a no-op. The CPO can re-enter via `/connect-devops-project` Step 5b's amend / replace / skip modes for evolution beyond migration.

##### 7.v -- Per-sub-repo `deployment_target` backfill (polyrepo umbrellas only)

After 7.iv applies (umbrella `deployment_targets:` list now exists OR was explicitly skipped), on polyrepo umbrellas: walk `project-profile.md`'s `Sub-repos` section for H3 entries missing the `**Deployment target**:` bullet. Three cases:

- **All sub-repos have the field**: silent no-op with a one-line summary ("No backfill needed -- all <N> sub-repos have Deployment target set.").
- **Zero declared targets in devops-connection.yaml + any sub-repos missing the field**: skip the table (nothing to assign against); print a one-line note: "0 deployment targets declared; skipping per-sub-repo backfill. Run `/connect-devops-project` Step 5b to declare targets, then re-run `/strap-upgrade` to backfill."
- **At least one declared target + at least one sub-repo missing the field**: present the interactive backfill table.

Interactive backfill table:

```
| Sub-repo       | Detected CI hint           | Suggested target  | CPO assignment    |
|----------------|----------------------------|-------------------|-------------------|
| web-frontend   | vercel.json detected       | vercel-prod       | (target / skip / ?) |
| api-backend    | azure-pipelines.yml found  | azure-prod-eus    | (target / skip / ?) |
| shared-lib     | (no CI hints)              | --                | (target / skip / ?) |
```

Suggestion logic re-uses `/strap-in` Section 8's "CI-config inspection patterns for Deployment target" subsection (single source of truth for the marker list + fuzzy-match logic). Strong single matches get the auto-suggestion; multi-match surfaces a ranked menu inline ("? -> ranked menu of vercel-prod, vercel-preview..."); no-match leaves the field with `--` and CPO chooses manually from declared targets or skips.

CPO walks the table in one batched pass:

- `target` -- assign the suggested or chosen target name.
- `skip` -- leave the field absent (sub-repo treated as un-attributed downstream; F9 deploy-freq math omits it).
- `?` -- defer ("I don't know yet"); equivalent to skip but flagged in the migration report as deferred-not-decided (CPO can re-run `/strap-upgrade` later or invoke `/strap-in` to revisit).

After CPO confirms, persist by writing the per-sub-repo `**Deployment target**: <target-name>` bullets into each affected H3 entry in `project-profile.md`'s `Sub-repos` section. Skipped / deferred sub-repos get no bullet written (absent-is-valid per F7 S1 schema invariant).

**Single-repo umbrellas**: skip 7.v entirely (no Sub-repos block, no per-sub-repo field).

**Idempotency**: re-running 7.v when all sub-repos already have the field is a no-op. Re-running 7.v after some sub-repos were skipped at the prior pass surfaces ONLY the still-missing sub-repos (already-set sub-repos are not re-prompted; the bullet's presence is the sentinel).

**Schema sentinel**: F1's `<!-- strap-schema: sub-repos-v2.4 -->` already in place from 7.i; 7.v adds a populated field, not a new schema version.

##### 7.vii -- Per-sub-repo `pipeline_match_patterns` backfill (v2.4 F10)

After 7.ii migrates the connection profile to `schema_version: "2.4"`, on polyrepo umbrellas: walk `devops-connection.yaml`'s `sub_repos.<slug>` entries for missing or empty `pipeline_match_patterns:` arrays. Three cases:

- **All sub-repos have non-empty patterns**: silent no-op with a one-line summary ("No backfill needed -- all <N> sub-repos have pipeline_match_patterns set.").
- **Some sub-repos missing or empty**: present the interactive backfill prompt.
- **Single-repo umbrellas**: skip 7.vii entirely (no Sub-repos; pipeline attribution falls through to single-layer mode).

Interactive backfill flow:

1. **Surface the migration intent**. Present the CPO with one paragraph: "v2.4 F10 introduces explicit `pipeline_match_patterns: [...]` per sub-repo so `/dora-collect` can attribute CI pipeline runs cleanly when pipeline names pre-date STRAP onboarding (the typical adoption case). Existing installs may have all 100% of pipeline runs falling into `__unattributed__` until patterns are declared."

2. **`AskUserQuestion`: "Capture pipeline_match_patterns now?"** Two options: `Yes, walk per-sub-repo (Recommended)` / `Skip (continue with __unattributed__ fallback)`. Skip ends 7.vii; sub-repos stay without patterns.

3. **On `Yes`, per sub-repo missing or with empty patterns**: invoke the per-sub-repo capture sub-flow from `/connect-devops-project` Step 6 substep 3 -- probe the host for the most-recent N pipeline-run names, surface as multi-select with `Custom pattern` fallback. CPO selects per sub-repo.

4. **Persist** by writing the captured `pipeline_match_patterns` arrays into each affected sub-repo entry in `devops-connection.yaml`. Stamp refreshed `validated_at` + `validated_by` on touched entries.

5. **Idempotency**: re-running 7.vii when all sub-repos already have patterns is a no-op. Re-running after a prior Skip: prompt resurfaces for the still-missing sub-repos (CPO can opt in on a later upgrade after seeing the `__unattributed__` impact in a `/dora-report`).

**Why content-inspection in 7.vii**: the field is optional (empty/absent are valid states for adopters who choose to rely on fallback attribution). The migration is a one-time prompt that resolves the "fresh STRAP install on a project with pre-existing CI" pattern; subsequent adopter operational tempo controls whether they ever populate it.

##### 7.vi -- Azure Repos REST-where-available template migration

Check `.claude/strap/state/code-connection.yaml` for an Azure Repos profile carrying pre-polish operation_templates (the templates that rely on git's credential helper). Migration applies when the polish doctrine from `connect-code-repo`'s "REST/token-injected where both exist" subsection landed in a release the install is now crossing into.

Detection (content-inspection; no schema_version bump):

1. Read top-level `host`. If not `azure-repos`, skip 7.vi.
2. Read `operation_templates.branch_push.command`. If the string contains `http.extraHeader`, the migration already applied; skip 7.vi.
3. If `operation_templates.ref_get` is absent OR `operation_templates.branch_delete_remote` is absent OR `operation_templates.branch_push` lacks the `http.extraHeader` bearer-token injection, the install is pre-polish; offer the migration.

On polyrepo umbrellas: repeat the detection per `sub_repos.<slug>` entry (the umbrella default OR per-sub-repo override may carry the operation_templates).

Interactive migration flow:

1. **Surface the migration intent**. Present the CPO with one paragraph: "Your Azure Repos connection profile carries pre-polish templates for `branch_push` and/or `branch_delete_remote`. These rely on git's credential helper and can hang in non-interactive Claude Code tool contexts (the failure mode that surfaced during Pace v2.4.0 Wave 3 cleanup). Re-run `/connect-code-repo` to regenerate the affected templates with REST + token-injected variants while preserving everything else?"

2. **`AskUserQuestion`: "Migrate Azure Repos templates now?"** Options: `Yes, re-run /connect-code-repo in reconnect mode (Recommended)` / `Skip (continue with pre-polish templates)` / `Explain` (walks through what changes).

3. **On `Yes`**: chain into `/connect-code-repo` in re-run mode. The downstream skill detects the existing profile, surfaces the affected operation_templates entries (`ref_get` NEW, `branch_delete_remote` REVISED, `branch_push` REVISED), CPO confirms, the touched entries get refreshed `validated_at` + `validated_by`. Other entries (PR ops, etc.) are preserved as-is.

4. **On `Skip`**: install continues with pre-polish templates. Record the skip in `.claude/.strap-version.json` under a new `skipped_migrations` array entry `{ id: "7.vi-azure-repos-rest-templates", skipped_at: <ISO-ts>, version_at_skip: <new-version> }` so 7.vi does not re-fire on subsequent upgrades (the CPO can still re-trigger manually by deleting the entry and re-running `/strap-upgrade`, OR by directly invoking `/connect-code-repo` reconnect on the Azure Repos sub-repo).

5. **On `Explain`**: surface a one-paragraph summary of the doctrine + the three template revisions (`ref_get` is new; `branch_delete_remote` becomes REST PATCH zero-sha with `oldObjectId` for optimistic concurrency; `branch_push` becomes `git -c http.extraHeader="Authorization: Bearer <token>" push ...` bypassing credential helper). Loop back to the AskUserQuestion.

**Single-repo umbrellas with Azure Repos host**: run 7.vi against the top-level profile only. **Polyrepo umbrellas with mixed hosts**: run 7.vi against each Azure-Repos sub-repo independently (skip non-Azure sub-repos). **Polyrepo umbrellas without any Azure Repos sub-repo**: silent skip with no prompt.

**Idempotency**: re-running 7.vi after the migration applies (templates contain `http.extraHeader`) is a no-op. Re-running 7.vi after a prior `Skip` is also a no-op unless the CPO removed the skip record.

**Why content-inspection over schema_version bump**: the polish lands a per-host template revision, not a schema-shape change. Bumping the umbrella `schema_version` field would falsely imply broader schema drift. Content inspection scopes the migration cleanly to the host that needs it.

#### Diagnostic surface at end of Phase 7

After all applicable sub-migrations complete, surface the outcomes in two places:

1. **Inline to the CPO during the skill run** (so the run-end summary is grounded before Phase 8 recommendations and Phase 9 report):

   ```
   Migration outcomes (Phase 7):
     fired:           7.i (project-profile.md Sub-repos prose-to-structured), 7.iv (umbrella deployment_targets:)
     already-applied: 7.ii (connection-profile schema_version), 7.iii (Active-Task sub_repo backfill)
     cpo-skipped:     7.vi (Azure Repos REST templates) -- recorded at .strap-version.json.skipped_migrations
     n/a:             7.v (per-sub-repo Deployment target -- single-repo install), 7.vii (pipeline_match_patterns -- single-repo install)
   ```

   Each bucket lists the affected sub-migrations by id + one-line label; absent buckets are omitted (no `n/a:` line when the install matches every sub-migration's applicability shape).

2. **Appended to the upgrade-report file** written at Phase 5. Open `.claude/strap/state/upgrade-reports/<ISO-timestamp>.md` and append a `## Migration outcomes` section carrying the same content as the inline output, plus per-sub-migration detail:

   - For `fired`: the touched paths or work-item ids.
   - For `already-applied`: the sentinel that short-circuited (e.g., `<!-- strap-schema: sub-repos-v2.4 -->` present in project-profile.md).
   - For `cpo-skipped`: the AskUserQuestion option chosen and the skip-record path.
   - For `n/a`: the applicability rule that excluded the sub-migration (e.g., "single-repo umbrella -- 7.v requires Sub-repos block").

The augmented report is the canonical single-file record of the upgrade: package-level changes (Phase 5) + adopter-owned schema migrations (Phase 7) + post-upgrade recommendations (Phase 8) in one place.

#### Future migrations

The phase scales by adding per-version-transition subsections (`#### v2.5 migrations`, etc.) below the v2.4 set. Each version's sub-migrations check their own state and run idempotently. Cross-version transitions (e.g., 2.3 -> 2.5 in one upgrade) run every applicable version's migrations in sequence; the per-sub-migration sentinel/version checks ensure each runs at most once.

### Phase 8: Post-upgrade recommendations

When the upgrade applied changes that affect the dev-lead's persistence-stack curation, recommend follow-up actions:

| Change | Recommendation |
|---|---|
| New skill `SKILL.md` files added | None automatic. The new skills are immediately available; the dev-lead reads them on next invocation. |
| New agent role contracts added under `.claude/agents/` | `/strap-refresh` -- so the dev-lead can decide whether the new specialist's domain is active in this project and curate seed rules / memory if so. |
| Existing agent role contracts overwritten with changed responsibilities | `/memory-refine <agent-name>` to confirm the per-agent rules and memory still align with the updated role contract. |
| Connection-profile schema changes in `/connect-code-repo` or `/connect-devops-project` (visible because the SKILL.md was in the overwrite list) | Re-read the schema doc; existing `code-connection.yaml` / `devops-connection.yaml` do not auto-update. If new operations need wiring, the CPO re-invokes the relevant `/connect-*` skill in reconnect mode. |
| Work-item template changes | None automatic. Newly-created work items use the updated template; existing items keep their prior body. |
| `agent-devs.md` / `agent-ops.md` team rules updated | None automatic. Every agent re-reads team rules on every invocation. |
| Crossing into a target version that introduced a re-read-Phase-7 step the in-memory copy did not have (e.g., upgrading from a pre-v2.5 version into v2.5+) | New target-version sub-migrations were not auto-applied on this upgrade because the in-memory Phase 7 pre-dated the re-read instruction. Surface the list of sub-migrations declared by the target version's on-disk SKILL.md that did NOT appear in this run's outcomes. The CPO can re-trigger them manually (e.g., re-run `/connect-code-repo` for 7.vi or `/connect-devops-project` Step 6 substep 3 for 7.vii); future upgrades from this version forward will inherit the re-read step and self-heal. |

### Phase 9: Report

End with a structured upgrade report covering:

- Mode used
- Previous version -> new version
- Counts: adds, overwrites, reconcile candidates (and the chosen reconcile decision), conflicts resolved, conflicts skipped, install-only flagged, prev-only flagged
- Strategy used for conflicts (if any)
- Reconcile decisions (if Category B reconcile candidates surfaced): per-subtype (rules-doctrine, memory-tradecraft) chosen option + count applied / count kept
- Migration outcomes (Phase 7): counts per bucket (`fired`, `already-applied`, `cpo-skipped`, `n/a`) with sub-migration ids listed inline. Suppress buckets with zero entries. When Phase 7 was a silent no-op (no schema migrations declared for the version transition), emit a single-line "Migrations: none for this transition" entry instead.
- Path to the upgrade report file
- Follow-up recommendations from Phase 8 (with the relevant skill names linked)

## Outputs

- The installed `.claude/` tree updated with non-conflicting package changes (per the chosen strategy for conflicts).
- An upgrade report at `.claude/strap/state/upgrade-reports/<ISO-timestamp>.md` capturing the full reconciliation.
- An updated `.claude/.strap-version.json` reflecting the target version + new tarball SHA.
- (On `Pause` exit only) An `.claude/strap/state/upgrade-pending.md` file the CPO uses to resume.
- (Distribution mode only) Tarballs cached at `.claude/strap/state/upgrade-cache/strap-<version>.tar.gz` for both the previous and the new version. The cache naturally accumulates an "anchor" for the next upgrade. Adopters can prune manually; the skill does not auto-evict.

## Quality gates

The skill is successful when all of the following hold:

- A prior install was detected at `.claude/.strap-version.json`.
- Mode was selected unambiguously (distribution OR source) and the necessary acquisition resources were available.
- In distribution mode: the manifest was fetched and parsed; the new and previous tarballs were downloaded (or cache-hit) and SHA-verified.
- In source mode: git was available and the three-way-merge classification succeeded.
- The version comparison detected a real upgrade scenario (or reported "already at version X" cleanly).
- Every Category A protected path was excluded from the diff entirely.
- Every Category B (seeded-then-curated) protected path was diffed. `package-only` adds were applied; `package-modified clean` files surfaced as reconcile candidates per #39694 (or, in two-way merge mode, folded into the conflict list); `conflict` classifications surfaced as awareness with install-wins semantics.
- When Category B reconcile candidates were present (three-way merge mode only), the CPO chose a reconcile option per subtype (Keep install / Apply all upstream / Review per-file -- rules-doctrine and memory-tradecraft prompted independently) before any write to a Category B path.
- The CPO chose a conflict-handling strategy at the approval gate before any write.
- The upgrade report file exists with full counts and path lists.
- `.claude/.strap-version.json` reflects the new package version + tarball SHA after successful apply.
- Before any Phase 7 sub-migration ran, the dev-lead re-read `.claude/skills/strap-upgrade/SKILL.md` from disk and continued from the on-disk Phase 7 instructions.
- Each Phase 7 sub-migration produced a tracked outcome (`fired` / `already-applied` / `cpo-skipped` / `n/a`).
- The Phase 7 diagnostic surface was emitted inline AND appended to the upgrade-report file as a `## Migration outcomes` section. When the transition introduced no schema migrations, the inline surface is omitted and the report carries a "Migrations: none for this transition" line.
- Post-upgrade recommendations were surfaced when the upgrade introduced new specialists or schema changes.

## Failure handling

- **No `.claude/.strap-version.json`**: surface that this looks like a fresh project; redirect to the installer.
- **`distributionUrl` absent or `null` and no `--from-source` provided**: prompt the CPO via `AskUserQuestion` whether to use the hardcoded fallback distribution URL or fall back to source mode (which requires a clone path).
- **Manifest fetch failed** (DNS, network, 4xx/5xx): surface the URL and the underlying curl error. Suggest checking network reachability or providing `--distribution-url` to override.
- **Manifest schema version unsupported**: stop with the version the manifest declared and the version this skill supports. The adopter must update STRAP itself (paradoxically -- this is the path of last resort when a major manifest-schema bump landed; reinstall via the new installer).
- **Target version not in manifest**: name the version and list the available versions from `manifest.versions`.
- **Tarball SHA-256 mismatch**: stop. Do not extract a tarball that doesn't match its declared SHA. Suggest re-running (transient network corruption) or filing an issue (signed-distribution defect).
- **Cannot find the previously-installed version in the manifest** (e.g., manifest retention window dropped it): surface, fall back to source mode if available, or document the gap and stop. The adopter can re-install at the desired version to re-anchor.
- **Source-mode without `.git/` in the clone**: stop -- three-way merge in source mode requires git history. Suggest using distribution mode instead.
- **STRAP-on-STRAP development context detected** (the project IS the STRAP source): surface and stop.
- **Target targets a higher major version than the install**: stop and refer to release notes.
- **Installed version is newer than target**: stop and surface the inversion.
- **`git show <previous>:<path>` fails for a file under a package-managed directory** (source mode only): classify as `conflict` rather than guessing.
- **CPO chose `Pause`**: write the pending state file and exit cleanly.
- **CPO chose `Cancel`**: exit without writing anything.
- **A filesystem write fails mid-apply** (permissions, disk full): surface the OS error verbatim; record the partial state in the report; do not retry destructively.

## References

- Installer (first install + version-manifest writer): [`infra/install/install.sh`](../../../infra/install/install.sh) / [`infra/install/install.ps1`](../../../infra/install/install.ps1).
- Onboarding skill (curate persistence stack after install): [`../strap-in/SKILL.md`](../strap-in/SKILL.md).
- Incremental re-discovery (post-upgrade follow-up when new specialists / schema land): [`../strap-refresh/SKILL.md`](../strap-refresh/SKILL.md).
- Per-agent memory curation (post-upgrade follow-up when role contracts change): [`../memory-refine/SKILL.md`](../memory-refine/SKILL.md).
- Onboarding design (persistence-stack model, protected-paths rationale): [`../../strap/contexts/onboarding-design.md`](../../strap/contexts/onboarding-design.md).
- Install / source-mode model: [`../../../INSTALL.md`](../../../INSTALL.md).
- dev-lead role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- dev-lead guardrails: [`../../strap/rules/agents/dev-lead.md`](../../strap/rules/agents/dev-lead.md) -- single-curator rule (the reason per-agent memory and rules are protected).
- CLAUDE.md (canonical persistence-stack reference): [`../../../CLAUDE.md`](../../../CLAUDE.md).
