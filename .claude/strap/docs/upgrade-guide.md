# Upgrade Guide

Operational walk-through of `/strap-upgrade`, the skill that reconciles a new STRAP package version against an existing installation. This guide is the CPO-facing narrative companion to [`../../skills/strap-upgrade/SKILL.md`](../../skills/strap-upgrade/SKILL.md) -- the SKILL.md is the contract, this guide is how it feels to run.

It assumes STRAP is already installed in your project (`.claude/.strap-version.json` exists), and that you have a STRAP source clone somewhere on disk (typically `~/strap-src` per [`INSTALL.md`](../../../INSTALL.md)) at the version you want to take.

## When to upgrade

Three triggers:

1. **You pulled new STRAP source.** `git pull` in your source clone. Run `/strap-upgrade` to bring those changes into your project.
2. **A release notes document calls out a change.** Some upgrades introduce new skills, new agent role contracts, or schema extensions to the connection profiles that require explicit reconciliation.
3. **You detect drift.** The `.claude/.strap-version.json` in your project is older than the version your source clone HEAD points at.

Do NOT run `/strap-upgrade` for a fresh install. Use the installer (`infra/install/install.sh` or `install.ps1`), followed by `/strap-in` to curate the persistence stack.

## The model in one paragraph

STRAP separates **package-owned** files (skills, agent role contracts, team rules, templates, design docs) from two flavors of **protected** files. Category A adopter-owned files (project-profile, connection profiles, continuations, settings, per-install state) are excluded from the diff entirely -- even if the package version differs, the install version wins. Category B seeded-then-curated files (per-agent rules + memory, dev-lead memory + index) ship as seeds: the adopter dev-lead inherits the STRAP-source-curated content on fresh install, then accumulates customizations on top. On upgrade, package-only adds DO land (a new operating learning at STRAP source or a new specialist's seed makes it to every adopter), but modify and conflict suppressed so adopter curation wins. For package-owned files, the skill uses a three-way merge against the previous-version tarball (or the source clone's git history in source mode) to distinguish clean upgrades (you haven't touched the file; safe to overwrite) from conflicts (you customized AND the package changed; CPO decides).

## What happens during an upgrade

```
1. Resolve source clone path
2. Compare versions
3. Diff the trees (with adopter-owned exclusions applied)
4. Present the plan + AskUserQuestion gate
5. Apply (per chosen strategy)
6. Update .claude/.strap-version.json
7. Post-upgrade recommendations
8. Report
```

The skill meets you at one approval gate (between the plan and the apply). Everything else flows from the inputs the skill resolved.

A structured upgrade report lands at `.claude/strap/state/upgrade-reports/<ISO-timestamp>.md` so any upgrade can be audited later.

## The protected-paths list

Protected paths fall into two categories with different upgrade rules. Both categories preserve adopter customizations; they differ only on `package-only` adds.

### Category A -- adopter-owned (NEVER touched, even adds)

These paths represent state owned entirely by the adopter install or by the installer. Excluded from the diff entirely; even `package-only` adds are NOT applied. The installer (not `/strap-upgrade`) writes the per-install copy where applicable:

- `.claude/.strap-version.json` -- updated by the skill itself at the end; not subject to diff.
- `.claude/settings.json` and `.claude/settings.local.json` -- harness permissions + env.
- `.claude/strap/contexts/project-profile.md` -- the curated record of THIS project (dev-lead-curated during `/strap-in`); installer copies a scaffold from `.claude/strap/templates/project-profile.scaffold.md` once at first install.
- `.claude/strap/contexts/continuations/` -- session-state runbooks.
- `.claude/strap/state/` -- connection profiles, sprint reports, usage tracking, any per-install state.
- `.claude/strap/work/` -- when Local (strap-agile) is the work-tracking host, the adopter's work items.
- `.claude/strap/mockups/` -- when the default mockup-path fallback is in use, this carries the adopter's designer-authored mockup files (keyed by Spec id). When `project-profile.md`'s `client-ui` domain declares `Mockup paths` pointing at an out-of-tree location (e.g., an existing Nx workspace), the override is used instead and the default directory may not exist.
- `.claude/strap/investigations/` -- where `/quick --investigation` writes specialist investigation reports (keyed by Task id). Same protection rationale as `.claude/strap/mockups/`.
- `.claude/strap/project-docs/` -- where `tech-writer` writes the human-facing project-orientation documents (`PROJECT.md`, `ARCHITECTURE.md`, `STACK.md`) at `/strap-in` closing phase and refreshes them surgically at `/strap-refresh`. When `project-profile.md` declares a top-level `Project docs paths` field pointing elsewhere (e.g., `docs/project/`), the override is used and this default directory may not exist; the protection here covers the default fallback path.

### Category B -- seeded-then-curated (package-only adds APPLIED; install-wins on modify/conflict)

These paths ship from STRAP source as scaffolds / seeds. The adopter dev-lead curates against them through `/strap-in` and ongoing operations. On upgrade:

- `package-only` adds **APPLIED** -- a new file at STRAP source lands at the adopter install. Examples: a new universal operating learning added to dev-lead memory in a later STRAP version; a brand-new specialist's seed memory/rules accompanying a newly-added role contract.
- `package-modified clean` SKIPPED -- once the adopter has touched the seed, the install version is authoritative.
- `conflict` SKIPPED -- adopter customization preserved. Surfaced in the plan as awareness; install wins; not subject to the conflict-strategy gate.

Category B paths:

- `.claude/strap/memory/MEMORY.md` -- the dev-lead's memory index. Ships with the STRAP-source-curated index entries (universal operating learnings); adopter dev-lead extends through `/strap-in` and ongoing curation.
- `.claude/strap/memory/dev-lead/` -- the dev-lead's per-topic memory files. Ships with universal operating learnings (e.g., Bash CWD drift in polyrepo sessions, Windows shell selection); adopter dev-lead adds entries via `/memory-refine` or organic curation.
- `.claude/strap/memory/agents/*.md` -- per-agent memory. Package ships a seed/scaffold per active specialist role; once the dev-lead curates, the install version is authoritative for modify/conflict cases.
- `.claude/strap/rules/agents/*.md` -- per-agent rules. Same seed-then-curate pattern as per-agent memory.

The list mirrors the persistence-stack ownership. Anything the single-curator rule says is adopter-owned ends up in Category A or B.

## The diff classification

For everything NOT in the protected-paths list, the skill walks the tree and classifies each path:

| Classification | Condition | Action (default; protected-path rules above may modify) |
|---|---|---|
| `unchanged` | Install and package files are byte-equal. | Skip. |
| `package-only` | Path exists in package, not in install. | Stage to add. Suppressed for Category A paths; APPLIED for Category B seeded-then-curated paths. |
| `install-only` | Path exists in install, not in package. | Leave alone. Surface for awareness if under a package-managed directory (skills, agents, team rules, templates). Typically an adopter-authored skill or an artifact the package no longer ships. |
| `package-modified clean` | Both exist; package differs from install; install matches the package's previous version. No adopter modification since last install. | Stage to overwrite. Suppressed for both protected-path categories (install wins). |
| `conflict` | Both exist; package differs from install; install ALSO differs from the package's previous version (you modified after install AND the package changed). | Surface for CPO resolution; NOT auto-merged. For both protected-path categories: surfaced as awareness, install wins, not subject to the conflict-strategy gate. |

"Package's previous version" comes from `git show <previous-tag>:<path>` against the source clone's git history. The skill needs the source clone to be a real git checkout for this to work; flat copies don't carry the history needed for three-way merge.

## The approval gate

The skill presents a plan to the CPO with counts per classification, full path lists for each, the source clone HEAD's short summary, and the cross-cutting impact (which adopter-owned skills should be re-considered post-upgrade -- see "Post-upgrade recommendations" below).

The gate uses `AskUserQuestion` with five nominal options:

- **Apply (skip conflicts)** -- apply adds and clean-overwrites; conflicts stay unchanged and surface at the end for manual resolution.
- **Apply with conflict strategy: take-package** -- apply adds, clean-overwrites, AND overwrite every conflict with the package version. Adopter customization to those files is lost. Requires a second confirmation showing per-file consequences (e.g., "backend-engineer memory: 14 lines of curated tradecraft will be replaced with the package's seed scaffold"). Use sparingly.
- **Apply with conflict strategy: keep-install** -- apply adds and clean-overwrites; leave every conflict file alone with the install version. Adopter customization preserved; package updates to those files are NOT applied. The next upgrade will surface the same conflicts again because the divergence widens.
- **Pause** -- stop without changes. The skill writes a pending-state file at `.claude/strap/state/upgrade-pending.md` capturing the plan; resolve conflicts manually and re-invoke.
- **Cancel** -- abandon the upgrade. No state file, no changes.

The "Apply (skip conflicts)" path is the safest default: clean upgrades land, conflicts surface so you can address each one consciously.

## Conflict resolution workflow

When you choose `Apply (skip conflicts)` or `Pause`, the skill ends with a list of conflict paths in hand. Three paths to resolve each:

### Take the package version

Replace your install version with the package version. Appropriate when the local edit was a workaround for a bug the package now fixes, or when the local edit is no longer relevant, or when the package version is a clean improvement and your edit isn't load-bearing. Mechanism: copy from the source clone (`cp <source-clone>/.claude/path/to/file .claude/path/to/file`).

### Keep your install version

Decline the package change entirely. Appropriate when your local edit is load-bearing and you've consciously chosen to diverge. Mechanism: do nothing; the file is already at the install version. Note: the next upgrade will re-surface this conflict because the divergence keeps widening. Document the intentional divergence in your project's onboarding notes.

### Three-way merge manually

For non-trivial conflicts, drive a real three-way merge in your editor. Three windows:

1. The package's previous version: `git show <previous-tag>:<path>` from the source clone.
2. The package's new version: the file at the same path under the source clone.
3. Your install version: the file at the same path in your project.

Merge by hand. Replace the install version with the merged file. Re-run `/strap-upgrade` with `Apply (skip conflicts)` -- the file is now treated as `unchanged` (or `package-modified clean` if you adopted the package side).

The skill does NOT invent a merged file. Conflict resolution is the CPO's call; the skill makes the data available.

## Post-upgrade recommendations

When the upgrade introduced certain kinds of change, the skill recommends follow-up actions. These are advisory; the CPO decides whether to run them.

| What changed in the upgrade | Recommendation |
|---|---|
| New skill `SKILL.md` files added | None automatic. New skills are immediately available; the dev-lead reads them on next invocation. Direct the dev-lead to surface them when relevant. |
| New agent role contracts added under `.claude/agents/` | `/strap-refresh` -- the dev-lead can decide whether the new specialist's domain is active in this project and curate seed rules + memory if so. |
| Existing agent role contracts overwritten with changed responsibilities | `/memory-refine <agent-name>` -- confirm the per-agent rules + memory still align with the updated role contract. |
| Connection-profile schema docs changed in `/connect-code-repo` or `/connect-devops-project` SKILL.md | Re-read the schema doc. Existing `code-connection.yaml` / `devops-connection.yaml` do NOT auto-update -- if new operations need wiring (e.g., new capability fields), re-invoke the relevant `/connect-*` skill in reconnect mode. |
| Work-item template changes (e.g., `bug.template.md`) | None automatic. Newly-created work items use the updated template; existing items keep their prior body. |
| `agent-devs.md` / `agent-ops.md` team rules updated | None automatic. Every agent re-reads team rules on every invocation. |

The skill flags which of these apply in the upgrade report so you can decide which follow-ups to run.

## Major-version refusal

The skill refuses to advance across STRAP major-version bumps automatically. Major bumps may carry breaking schema changes the skill is not authorized to apply without explicit CPO acknowledgement of the release notes.

When the package is a major version ahead:

1. The skill reports the major bump and stops without applying anything.
2. Read the release notes for that major.
3. The migration may require: re-curating the project profile, re-running `/connect-*` skills against schema changes, addressing connection-profile-shape changes manually.
4. After the migration steps land, re-invoke `/strap-upgrade` -- now the version delta is within the major and the skill proceeds normally.

The major-version refusal is the only place STRAP says "no, you do this part by hand." The trade-off is reversibility: a major-bump auto-apply that goes wrong is hard to back out of; the manual checkpoint catches it.

## Recovery from a failed upgrade

`/strap-upgrade` is not transactional across the filesystem. If a write fails mid-apply you may end up with a partial upgrade -- some files at the new version, some still at the old. The skill names what landed in the report; the rest is recovery.

### The simple recovery: git

Your project is a git repository. STRAP artifacts under `.claude/` are version-controlled. The simple recovery:

```bash
git status                   # see what landed
git diff                     # see the partial upgrade
git checkout -- .claude/     # discard the partial upgrade
```

Then fix the underlying cause (permissions, disk space, broken source clone) and re-run `/strap-upgrade` from a clean state. The skill is idempotent at the version level -- re-running from a clean state produces the same result.

### The harder recovery: partial commits

If you committed the partial upgrade before discovering the failure, `git reset --hard <pre-upgrade-commit>` is the recovery -- but `git reset --hard` is destructive. Use it only when you can re-derive any work-in-progress and only after confirming the pre-upgrade commit is what you actually want. The upgrade report under `.claude/strap/state/upgrade-reports/` is your source-of-truth for what changed.

### Preventing the failure mode

The most common cause is filesystem permissions on a path under `.claude/`. To prevent: run `/strap-upgrade` from a working tree where you have write access to every path under `.claude/`. STRAP does not modify files outside `.claude/` and the install's `.strap-version.json` -- that surface is the only one that needs to be writable.

## When STRAP-on-STRAP development is detected

If the project you're running `/strap-upgrade` in IS the STRAP source repo itself (you're working on STRAP, not consuming it), the skill refuses cleanly. You're operating ON the package, not consuming it -- the skill's reconciliation logic doesn't apply to its own source.

## Upgrading from v2.2 to v2.3

v2.3 is the first official release to external adopters. v2.2 was an internal validation milestone (no release tag was cut). Most v2.3 changes are additive -- new skills, new specialist coverage, new optional pathways -- and `/strap-upgrade` reconciles them cleanly as `package-only` or `package-modified clean`. A few changes warrant explicit adopter awareness:

### What ships new

- **Polyrepo support** (Epic #38963). `/strap-in`'s pre-flight now detects depth-1 sub-repos and offers a three-way CPO choice (polyrepo umbrella / per-sub-repo install / single-project at root). Existing single-project installs are unaffected -- the new code path only engages when N >= 2 sub-repos are detected at the install root OR the `--polyrepo` flag is passed explicitly. If you want to migrate an existing single-project install to polyrepo mode against an umbrella that has since grown sibling repos, run `/strap-refresh` and the existing-`Sub-repos`-section check applies (or `--full` to re-derive the persistence stack from scratch).
- **html-render pipeline ships inside `.claude/`** at `.claude/strap/tools/html-render/`. In v2.2 the pipeline lived at `infra/pipeline/scripts/html-render/`, which is excluded from the install tarball -- the project-docs HTML companion never rendered at adopter installs as a result (only the three markdowns landed). v2.3 vendors the pipeline into the runtime tree so the HTML companion lands on every `/strap-in` and `/strap-refresh`. After upgrading, the next `/strap-refresh` (or a manual re-render via `node .claude/strap/tools/html-render/render.js <config>`) populates the HTML companion at your configured `Project docs paths`.
- **`frontend-engineer` activation broadened** (Enhancements #39198 and #39200). Section 5's activation signal list now covers desktop UI (WPF / WinForms / MAUI / WinUI / UWP / Xamarin / Avalonia / Borland C++ Builder / Qt / Apple platforms / Flutter Desktop / etc.) AND server-rendered patterns (Python widget libraries like Streamlit / Dash / Gradio and in-house/custom widget frameworks; Phoenix LiveView; Rails Hotwire; Laravel Livewire; Blazor Server; classic template engines like ERB / HAML / Jinja / Razor; vendored JS widget libraries like DHTMLX / ExtJS / jQuery UI). **These new signals don't fire retroactively on existing installs**: an existing single-repo install where `frontend-engineer` was previously dormant on a desktop project will stay dormant until `/strap-refresh` (or `/strap-refresh --full`) re-evaluates Section 5's activation criteria. After the refresh, the specialist activates and starts accumulating UI tradecraft naturally.
- **`/revise-token-budget` is a new skill** for tuning budgets after install. v2.2 had budgets in `MEMORY.md` + `usage.yaml`; v2.3 adds the explicit CPO-driven revision surface with audit trail. Per-agent budget overrides are now a first-class field (`budgets.<workflow>.agent_overrides.<agent>.per_agent`). Existing `usage.yaml` files don't need a structural update -- the field is optional and dispatches resolve per `budget-discipline.md`'s dispatch-time resolution rule.
- **`/create-test-plan` v2 rewrite.** New SKILL.md following the `/create-mockups` pattern (interview + plan + scaffold + present). `ux-test-engineer` becomes the third closing-phase write-exception specialist (alongside `designer` and `tech-writer`).
- **Enhancement is the 7th STRAP logical type** (Enhancement #38944). `mapping.work_item_types.enhancement` is a new field in `devops-connection.yaml`. Existing profiles missing the field are still functional; re-invoke `/connect-devops-project` in `reconnect` mode to add it. The `strap:enhancement` tag is also new on filed Enhancement work items.
- **`/strap-refresh` `frontend-engineer` priors-override-signals exception** (Enhancement #39200). On refresh, when `frontend-engineer`'s memory has substantive curated content from prior runs but current signals don't trigger activation, the dev-lead defaults to keeping the specialist active rather than marking dormant. UI signal patterns are heuristic; curated memory is more authoritative.

### What does NOT change

- The protected-paths list (above) is unchanged. All adopter-owned paths stay protected. Your curated project-profile, per-agent rules, per-agent memory, continuations, connection profiles, work items, mockups, investigations, and project-docs remain untouched.
- v2.2 lifecycle-metadata convention (`Authored By/At`, `Completed By/At`, `AI` tag, `strap:<logical-type>` tag) is unchanged. v2.3 builds on it; existing tagged items continue to flow through DORA queries.
- The canonical 15-agent roster is unchanged. v2.3 broadens `frontend-engineer`'s scope through role contract + activation-signal updates; the agent's name, model, and identity stay the same.

### Recommended post-upgrade actions

After `/strap-upgrade` lands, in order:

1. **Re-render project-docs HTML companion.** Either run `/strap-refresh` (which produces the HTML automatically), or manually invoke `node .claude/strap/tools/html-render/render.js <config>` (build a config like the one `/strap-in` Section 9 builds in memory). One-time `npm --prefix .claude/strap/tools/html-render install --silent --no-save` resolves `marked` on first render.
2. **`/strap-refresh`** if your project has desktop UI or server-rendered UI surfaces that weren't picked up by v2.2's web-only `frontend-engineer` activation. The refresh recomputes activation against v2.3's expanded signal list. `--full` if you want a complete re-derivation against the new signal set.
3. **`/connect-devops-project reconnect`** to add the `enhancement` mapping if your existing `devops-connection.yaml` predates v2.3. Optional -- only needed if your team plans to file Enhancement work items against this connection.
4. **`/revise-token-budget`** if you want to tune any per-workflow budget or set per-agent overrides. Optional; v2.2 budget defaults continue to work as-is.

### Polyrepo opt-in for existing single-project installs

If your existing v2.2 single-project install lives at an umbrella root that has since grown sibling sub-repos (or always had them, but v2.2 didn't model them), `/strap-refresh --full` re-derives the persistence stack from scratch -- the depth-1 detection runs, the three-way CPO choice surfaces, and you can opt into polyrepo mode if appropriate. The existing curated content (project-profile, per-agent memory) is read as priors during the full re-derive but is not assumed authoritative. Backup the install's `.claude/` first if you want a clean rollback option.

## Quick reference

| Situation | Run |
|---|---|
| Pulled new STRAP source; want to take it | `/strap-upgrade <path-to-source-clone>` |
| Upgrade reported a major bump | Read release notes; address migration steps manually; re-run `/strap-upgrade` |
| Upgrade flagged conflicts; want package version everywhere | `/strap-upgrade ...` then choose `Apply with conflict strategy: take-package` (re-confirm at the per-file gate) |
| Upgrade flagged conflicts; want to merge by hand | `/strap-upgrade ...` then choose `Pause`; merge manually; re-run with `Apply` |
| Upgrade succeeded; introduced new specialists | `/strap-refresh` |
| Upgrade succeeded; role contracts changed | `/memory-refine <agent>` for the affected agent(s) |
| Upgrade succeeded; connection-profile schema changed | Re-invoke `/connect-devops-project` or `/connect-code-repo` in reconnect mode |
| Upgrade failed mid-apply | `git checkout -- .claude/`; fix root cause; re-run |

## References

- [`../../skills/strap-upgrade/SKILL.md`](../../skills/strap-upgrade/SKILL.md) -- the skill definition this guide operationalizes (the contract).
- [`../../skills/strap-refresh/SKILL.md`](../../skills/strap-refresh/SKILL.md) -- the incremental re-discovery skill recommended after upgrades that introduce new specialists.
- [`../../skills/memory-refine/SKILL.md`](../../skills/memory-refine/SKILL.md) -- per-agent memory curation, recommended after role-contract changes.
- [`../../skills/connect-devops-project/SKILL.md`](../../skills/connect-devops-project/SKILL.md) and [`../../skills/connect-code-repo/SKILL.md`](../../skills/connect-code-repo/SKILL.md) -- re-invoke in reconnect mode after schema changes.
- [`customization-guide.md`](./customization-guide.md) -- which surfaces are adopter-owned (this guide's protected-paths list mirrors that ownership model).
- [`architecture.md`](./architecture.md) -- the persistence-stack model that grounds the protected-paths list.
- [`../../../INSTALL.md`](../../../INSTALL.md) -- the source-clone pattern this skill assumes.
