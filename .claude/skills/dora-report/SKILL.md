---
name: /dora-report
description: Render the DORA metrics report as a self-contained HTML document via the 5-asset engine architecture. Reads a snapshot from /dora-collect (or auto-collects if absent), builds a PAYLOAD via build-payload.js, assembles head + render + tail via assemble-report.js, and runs six verify-then-write quality gates before writing. The output is a polished single-file HTML report covering 10+ per-sprint sections, a multi-sprint comparison view, and an in-flight "right now" view -- adapter-mediated across adopter onboarding (layers from project-profile.md, sub-repos when polyrepo, deployment_targets when declared, host link templates from devops-connection.yaml).
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Skill
argument-hint: [--snapshot <path>] [--sprint <name>] [--since <YYYY-MM-DD>] [--out <path>] [--compare <sprint-or-snapshot>] [--last-n <N>] [--quality-threshold <pct>] [--no-auto-verdicts] [--verdicts <path>] [--strict]
---

# /dora-report

## Purpose

Render the DORA report from a `/dora-collect` snapshot as a single self-contained HTML file. The engine ships with STRAP and is identical across every adopter; only the PAYLOAD differs. Visual identity, sections, and metric formulas are canonical -- adopters never edit the engine.

The 5-asset architecture separates concerns cleanly:

| Asset | Role | Adopter touches? |
|---|---|---|
| `engine-head.html` | DOCTYPE + design-system CSS + body skeleton | Never |
| `engine-render.js` | PAYLOAD destructure + render functions + main() | Never |
| `engine-tail.html` | Closing tags | Never |
| `build-payload.js` | Snapshot(s) -> PAYLOAD; owns ALL computation | Never |
| `assemble-report.js` | Stitches the four above + runs verify gates | Never |

Full architectural design + PAYLOAD contract: [`../../strap/contexts/dora-report-engine-design.md`](../../strap/contexts/dora-report-engine-design.md).

## Owner

**dev-lead.** Mechanical assembly of a precomputed snapshot; no specialist dispatch needed. The interpretive layer (per-developer signature classification, momentum verdicts, Pace-finding label-honesty) is formula-driven inside `build-payload.js`, not judgment-call. `dora-analyst` consumes the rendered HTML when the CPO asks for deeper analysis.

## Inputs

`$ARGUMENTS` -- optional flags in any order:

| Flag | Default | Effect |
|---|---|---|
| `--snapshot <path>` | most-recent under `.claude/strap/state/dora-snapshots/` | Explicit snapshot path; `.json` or `.json.gz` |
| `--sprint <name>` | unset | Pass-through to `/dora-collect` when auto-collecting |
| `--since <YYYY-MM-DD>` | unset | Pass-through to `/dora-collect` when auto-collecting |
| `--out <path>` | `.claude/strap/state/dora-reports/<YYYYMMDD>-<HHMMSS>.html` | Explicit output path |
| `--compare <sprint-or-snapshot>` | unset | Multi-snapshot side-by-side comparison mode |
| `--last-n <N>` | unset | Multi-snapshot trend mode across N most-recent qualifying snapshots |
| `--quality-threshold <pct>` | `60` | Filter low-quality snapshots from `--last-n` / `--since` trend math |
| `--no-auto-verdicts` | off | Suppress auto-generated editorial verdicts (the tri-grid renders empty) |
| `--verdicts <path>` | unset | Hand-authored verdicts JSON; overrides auto-generation |
| `--strict` | off | Promotes verify-then-write Gates 3-6 from warn to fail |

## Adopter shape adapts at render time

Every adapter-specific concern resolves from the snapshot + connection profiles. Output adapts to whatever the adopter actually has:

| Adopter shape | Engine rendering |
|---|---|
| No `Layers` section in project-profile.md | Single-layer mode; one Layer Metrics subsection |
| No `Sub-repos` section in project-profile.md | Per-sub-repo subsections omit |
| No `deployment_targets:` in devops-connection.yaml | Per-target subsections omit; KPI strip switches to "Pipeline runs" label-honesty (Pace finding) |
| Empty `feature_clusters[]` | Cluster cycle-time section omits |
| Empty `excluded_clusters[]` | Excluded-clusters appendix omits |
| `data_quality.revisions_unavailable: true` | Pipeline Funnel hops degrade to state-change-date-only timing |
| `data_quality.pr_threads_unavailable: true` | PR-size histogram degrades to a note |
| No PR weight data | PR-weight block degrades to a "run git fetch" note |
| Pre-STRAP backlog share > 30% | Data Quality flag callout + auto-verdict context card |

Adapter values resolve from:
- Layers + Sub-repos: `.claude/strap/contexts/project-profile.md`
- Deployment targets + work-item URL template: `.claude/strap/state/devops-connection.yaml`
- PR URL template + default branch: `.claude/strap/state/code-connection.yaml`

## Workflow

### Step 1: Resolve snapshot

When `--snapshot <path>` is supplied: use it directly. Validate the file exists and parses as JSON (or gzip-of-JSON when `.json.gz`).

Otherwise:
1. Glob `.claude/strap/state/dora-snapshots/*.json(.gz)`. Sort by snapshot_id descending. Pick the newest.
2. If none exist: auto-invoke `/dora-collect` via the `Skill` tool with the same `--sprint` / `--since` arguments.
3. If the resolved snapshot is older than 24 hours and no explicit `--snapshot` was given: auto-invoke `/dora-collect` again to refresh. The operator's intent in running `/dora-report` without an explicit snapshot is usually "see the current state".

For `--compare` and `--last-n` modes: also resolve the named comparison snapshot(s) per the multi-sprint trend rules below.

### Step 2: Multi-sprint mode resolution

**Default mode** (no `--compare` / `--last-n`): primary snapshot only; engine renders single-sprint hero + comparison view degraded to single-row.

**`--compare <sprint-or-snapshot>`**: resolves the comparison either by `metadata.sprint_name` lookup or by path. Both snapshots loaded; engine renders side-by-side deltas in every section.

**`--last-n N`** (or `--since <date>`): glob all snapshots, sort by `metadata.collected_at` desc, filter by `data_quality.overall_pct >= --quality-threshold` (default 60%), take top N. If fewer than 2 snapshots qualify, refuse trend rendering:

```
Only <n> snapshot(s) above the <threshold>% quality threshold; trend rendering needs >=2.
Lower the threshold via --quality-threshold <pct> or run /dora-reconcile --auto-fix.
```

Excluded snapshots are logged in the rendered report header.

### Step 3: Build PAYLOAD

Run `build-payload.js` against the resolved snapshot(s):

```bash
node .claude/skills/dora-report/build-payload.js \
  --sprint <snap1.json> [--sprint <snap2.json> ...] \
  [--current <inflight.json>] \
  [--verdicts <verdicts.json>] \
  [--connection .claude/strap/state/devops-connection.yaml] \
  [--no-auto-verdicts] \
  --out <payload.json>
```

`build-payload.js` owns ALL metric computation. Snapshot fields map to PAYLOAD fields per the contract in the design doc. Formula references:

- **AI Efficiency Ratio** -- wall-clock primary (`OriginalEstimate / (ResolvedDate - ActivatedDate)`); partitioned `{all, ai, human}` per Q6 lock.
- **AI/Human classifier** -- work items: `AI` tag OR `[STRAP/agent:*]` audit-line (explicit-only). Wall-clock heuristic demoted to Data Quality flag. PRs: two-track model (Track 1 binary lenient for cycle/distribution; Track 2 weighted `aiShare` for count/contribution).
- **Higher-order isAiExecuted** -- propagated via descendant Task lineage (majority rule, `aiExecutedShare > 0.5`). Tasks use native `isAi`.
- **Per-metric confidence thresholds** -- CFR, MTTR, lead-time, and AI Efficiency all carry a `confidence: 'no-signal' | 'high'` field plus the threshold + threshold-key they were evaluated against. When the sample is below the configured floor, the engine renders a contextual "no signal" pill (Feature #39701 + #39724) showing the threshold and the actual count inline (e.g., `no signal (need 5; got 2)`) with a tooltip explaining the suppression and how to reconfigure. Defaults activate the polish out of the box; setting a key to 0 disables the rule for that single metric:
  ```yaml
  mapping:
    dora_confidence_thresholds:
      cfr_deploys: 3       # default; preserves v2.4 Pace finding
      mttr_sample: 5       # default; suppresses tiny-sample MTTR
      lead_time_sample: 5  # default; suppresses tiny-sample lead-time
      ai_eff_sample: 5     # default; suppresses tiny-sample AI Efficiency
  ```
  Per-key defaults are applied when keys are absent so unconfigured adopters get consistent no-signal treatment automatically. AI Efficiency continues to carry its legacy ratio-based `confidence: 'low'` parenthetical independently of the sample-count `sampleConfidence`.
- **Metric explainer tooltips** (Feature #39724) -- every block-num kicker carries a small `ⓘ` glyph that surfaces a 1-2 sentence explainer of the metric via native HTML `title` tooltip (hover on desktop, long-press on mobile, focus via keyboard). Coverage is broader than DORA-4: AI Efficiency Ratio, AI vs Human at-a-glance, Cluster cycle-time, Aging Alerts STRAP-instrumented vs inherited split, Per-developer signatures, Pipeline Funnel, etc. Explainer copy lives in `BLOCK_EXPLAINERS` at the top of `engine-render.js` -- one map; one helper (`infoTipFor(blockNum)`); zero JavaScript at runtime. `aria-label` mirrors the tooltip for screen-reader accessibility.
- **STRAP-instrumented vs inherited Aging-Alerts split** -- the in-flight Aging Alerts section splits each card into a STRAP-instrumented sub-list (load-bearing, surfaces first) and an inherited backlog sub-list (collapses into `<details>` when more than `INHERITED_AGING_COLLAPSE_THRESHOLD = 10` entries). Default classifier signals are the v2.4 three-signal union (AI tag OR `strap:*` tag OR `[STRAP/agent:*]` audit comment OR upstream `hasStrapAgentAudit` flag from `/dora-collect`). Adopters with custom tag schemas override the heuristic via `devops-connection.yaml -> mapping.strap_instrumentation_signals`:
  ```yaml
  mapping:
    strap_instrumentation_signals:
      tag_prefixes:     ['strap:']        # default = v2.4 union
      comment_prefixes: ['[STRAP/agent:']
      custom_fields:    []                # truthy field name = STRAP-instrumented
  ```
  AI tag and `hasStrapAgentAudit` are always implicit members of the union (Feature #39700).
- **Pipeline run rate label-honesty** -- `pipelineRunRateMode` = `pipeline-run-rate` when `deployments[]` empty; KPI strip label switches accordingly (Pace finding).
- **Insufficient signal signature** -- per-developer rows with zero output across all visible columns + null interaction signals get a neutral pill, NOT Quick-Approver (Pace finding).
- **Pre-STRAP backlog caveat** -- `pre_strap_human_backlog_share` computed at collect time; >30% surfaces an auto-verdict context card (Q7 lock).

The full PAYLOAD contract (top-level keys + per-sprint shape + supporting types) is documented in [`../../strap/contexts/dora-report-engine-design.md`](../../strap/contexts/dora-report-engine-design.md).

### Step 4: Assemble + verify

Run `assemble-report.js` against the PAYLOAD:

```bash
node .claude/skills/dora-report/assemble-report.js \
  --payload <payload.json> \
  --out <report.html> \
  [--strict]
```

Stitches: `engine-head.html` + `const PAYLOAD = <json>;` + `engine-render.js` + `engine-tail.html`. Before writing, runs six quality gates:

| Gate | Check | Failure |
|---|---|---|
| 1 | PAYLOAD parses inside the assembled file | Hard fail; refuse to write |
| 2 | Headless render produces no `undefined` / `NaN` / `[object Object]` / `Infinity` | Hard fail; refuse to write |
| 3 | Adopter-shape consistency (no per-sub-repo markup when subRepos empty, etc.) | Warn (`--strict`: fail) |
| 4 | Data Quality flags honestly surfaced (every `true` flag appears) | Warn (`--strict`: fail) |
| 5 | Per-sprint section count meets minimum (>= 9 per sprint) | Warn (`--strict`: fail) |
| 6 | Spot-check N PAYLOAD values appear verbatim in rendered output | Warn (`--strict`: fail) |

Gate failures surface actionable errors with file paths and offending values. Atomic write (temp + rename) ensures the previous report stays intact on failure.

### Step 5: Index + confirmation

On success, append a one-line entry to `.claude/strap/state/dora-reports/INDEX.md` if the report is for sprint-end review:

```
2026-05-31 | <sprint-name> | <report-path> | <data-quality-pct>%
```

Print:

```
Report rendered: <path>
  size:       <bytes>
  sprints:    <count>
  layers:     <count>
  in-flight:  <name or (none)>

Open in browser: file:///<absolute-path>
```

## Quality gates (what "done" means)

The skill is successful when all of the following hold:

- The snapshot was resolved (or auto-collected when absent).
- `build-payload.js` produced a PAYLOAD matching the contract in the design doc.
- All six `assemble-report.js` verify gates passed (or warned non-strict).
- The output HTML opens in a browser, renders without console errors, and surfaces the per-sprint + comparison + (if applicable) current views.
- Adopter shape adapts cleanly: missing optional fields produce omitted sections, not empty markup.
- The AI vs Human partition is pervasive: AI Efficiency, PR cycle, throughput, cluster cycle-time, CFR, MTTR, quality cycle-times, pipeline funnel all carry the `{all, ai, human}` triples and the AI vs Human at-a-glance exec block renders.
- The Pace-finding rules surface where applicable: Pipeline Run Rate label when `deployments[]` empty; no-signal CFR pill when denominator below threshold; Insufficient signal signature for zero-output developers; pre-STRAP backlog caveat verdict when share exceeds 30%.

## Failure handling

| Condition | Behavior |
|---|---|
| Snapshot missing AND `/dora-collect` fails | Surface the collect error; stop. |
| Snapshot malformed | Surface parse error + the path; stop. |
| `--compare` argument cannot be resolved | List available snapshots; stop. |
| `--last-n N` produces fewer than 2 qualifying snapshots after threshold filter | Refuse trend; suggest lowering threshold OR running `/dora-reconcile --auto-fix`. |
| Any hard verify gate fails (1 or 2) | Refuse to write; surface gate's actionable error. Previous report unchanged. |
| Any soft verify gate fails (3-6) without `--strict` | Warn; write proceeds; warnings surface on stdout. |
| Any soft gate fails with `--strict` | Refuse to write; surface offending gate. |
| Layers section changed between collect + render | Snapshot's `metadata.layers_resolved` is authoritative; surfaces a header note when divergence detected. |

## Known characteristics

- **Offline rendering**: the report preserves layout + content when Google Fonts CDN is unreachable; typography degrades to system-font fallback (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`). All metric values, colors, layouts, interactivity stay intact. No `--system-fonts` flag in v2.5 (deferred to a future polish when an adopter surfaces the constraint).
- **Per-metric confidence thresholds**: `DEFAULT_CONFIDENCE_THRESHOLDS` in `build-payload.js` holds the sensible defaults (3/5/5/5 across CFR / MTTR / lead-time / AI-Eff sample sizes). Adopter overrides live in `devops-connection.yaml -> mapping.dora_confidence_thresholds` and are honoured per-key (see Step 3); setting any key to 0 disables that single rule (escape hatch for adopters who want the raw small-sample numbers). Each PAYLOAD leaf carries the evaluated `threshold` + `thresholdKey` alongside `confidence` so the contextual no-signal pill can render `"no signal (need 5; got 2)"` inline and a tooltip pointing at the configuration knob.
- **Aging-alerts collapse threshold**: `INHERITED_AGING_COLLAPSE_THRESHOLD = 10` is a named constant in `build-payload.js`. Inherited backlog items above the threshold collapse into a `<details>` disclosure; the summary text shows the count (`View N inherited backlog items`) so scale is visible without expansion.
- **Configurable STRAP-instrumentation heuristic**: `DEFAULT_STRAP_INSTRUMENTATION_SIGNALS` in `build-payload.js` holds the v2.4 three-signal union default. Adopter overrides live in `devops-connection.yaml -> mapping.strap_instrumentation_signals` (see Step 3). The `classifyHasStrapInstrumentation` helper honours configured `tag_prefixes`, `comment_prefixes`, and `custom_fields` in addition to the implicit AI tag + `hasStrapAgentAudit` signals.
- **Visual identity is canonical**: STRAP DORA reports use the warm-orange accent (`#d97947` light, `#e2885a` dark) across every adopter. No theme-override mechanism in v2.5; CSS variables (`--accent`, `--accent-deep`, `--accent-soft`) make a future theme system additive rather than refactor-heavy.

## Recommended cadence

- **Sprint boundary**: `/dora-collect && /dora-report` at the end of every sprint. The default mode covers the standard single-sprint review.
- **Mid-sprint check**: ad-hoc `/dora-report` to see current trajectory. Auto-refreshes the snapshot when stale (>24h).
- **Trend review**: `/dora-report --last-n 6` quarterly for a 6-sprint view of momentum.
- **Pre-RC review**: `/dora-report --compare <last-RC-sprint>` to see what changed since the last release candidate.

## References

- Architectural design + PAYLOAD contract: [`../../strap/contexts/dora-report-engine-design.md`](../../strap/contexts/dora-report-engine-design.md).
- Upstream skill: [`../dora-collect/SKILL.md`](../dora-collect/SKILL.md) -- snapshot acquisition.
- Upstream skill: [`../dora-reconcile/SKILL.md`](../dora-reconcile/SKILL.md) -- data-quality janitor whose `--auto-fix` keeps snapshot inputs honest.
- Companion skill: [`../close-ceremony/SKILL.md`](../close-ceremony/SKILL.md) -- Resolved -> Closed ritual whose ceremony reports feed Skill Calibration aggregates.
- Project profile (Layers + Sub-repos): [`../../strap/contexts/project-profile.md`](../../strap/contexts/project-profile.md).
- Work-tracking connection profile schema: `.claude/strap/state/devops-connection.yaml`.
- Source-control connection profile schema: `.claude/strap/state/code-connection.yaml`.
- `dev-lead` role contract: [`../../agents/agent-devs/dev-lead.md`](../../agents/agent-devs/dev-lead.md).
- `dora-analyst` role contract: [`../../agents/agent-ops/dora-analyst.md`](../../agents/agent-ops/dora-analyst.md).
