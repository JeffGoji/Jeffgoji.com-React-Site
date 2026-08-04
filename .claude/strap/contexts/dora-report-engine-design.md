# /dora-report engine design

This document is the canonical reference for the `/dora-report` skill's presentation engine: the 5-asset architecture, the PAYLOAD contract, the snapshot-to-PAYLOAD mapping, and the visual idioms the engine renders. It locks in the design that ships to adopters in STRAP v2.5 (Feature #39709) and serves as the authoring spec for any future contributor extending the engine.

## Adopter outcome

When an adopter runs `/dora-report` after this refactor, they get a single self-contained HTML file with the visual polish of the 2026-05-12 Raptor reference design, adapted to their onboarded shape:

- **Layers** -- one Layer Metrics subsection per layer they declared in `project-profile.md`'s `Layers` section. Single-layer adopters get one subsection; multi-product / multi-federation adopters get one per layer.
- **Sub-repos** -- per-sub-repo views (pipeline funnel, contribution breakdown) when they declared a `Sub-repos` section. Single-repo umbrellas see these subsections omit cleanly.
- **Deployment targets** -- per-target deployment frequency cards when they declared `deployment_targets:` in `devops-connection.yaml`. Adopters who haven't declared targets see the cards omit, with the per-layer Deployment Frequency remaining the dominant signal.
- **Feature clusters** -- per-Feature cluster cycle-time signal when `feature_clusters[]` is populated (post-F5 polyrepo or any adopter whose PRs carry the cluster marker). Pre-F5 or single-PR-Feature adopters see the per-PR cycle-time view.
- **Work-item links** -- every `#<id>` resolves to the adopter's host (Azure DevOps, Jira, GitHub Issues, ...) via the URL template their `devops-connection.yaml` declares. No hardcoded host references.
- **Agent attribution** -- enumerated from the snapshot's actual `agentByOrchestrator` / `byAgentRole` distributions, not a hardcoded agent roster.
- **AI vs Human partition pervasive** -- every metric where the work-execution-mode distinction is meaningful (cycle times, PR cycle, cluster cycle, deployment contribution, CFR, MTTR, quality per-type cycle-time, pipeline funnel hops) carries the AI / Human / All partition in PAYLOAD. A dedicated "AI vs Human at a glance" block near the top of the report answers "how is the AI flow doing vs the human flow" without drilling. The pattern is the same regardless of adoption stage: pre-STRAP work + human-driven post-STRAP work both classify as Human; AI-tagged + agent-classifier-detected work classifies as AI.

The engine is **verbatim**: every adopter sees the same engine code; only the PAYLOAD differs.

## Visual identity (locked)

STRAP's DORA report visual identity is Raptor's polished 2026-05-12 design system, adopted as canonical. The warm orange accent (`#d97947` in light theme, `#e2885a` in dark theme), the Inter + JetBrains Mono typography pairing, the sticky-chrome masthead, the editorial-table treatment, the verdict tri-grid, the AI-Efficiency hero, the per-developer spine bars, the deploy heatmap, the print stylesheet -- this is what STRAP DORA reports look like across every adopter. The CSS variables rename Raptor-isms to neutral names (`--raptor` -> `--accent`), but the color values, typography, layout grids, and section choreography are preserved.

Adopters do not customize the visual via local theme overrides in v2.5. If a future iteration introduces theme customization, it ships as a STRAP feature (additive PAYLOAD fields, documented override mechanism), not as adopter-side engine edits.

## Architecture: 5 assets

The presentation layer separates concerns across five files in `.claude/skills/dora-report/`:

| Asset | Purpose | Adopter touches? |
|---|---|---|
| `engine-head.html` | DOCTYPE + design-system CSS + body skeleton (sticky masthead, view-picker, view-content) | Never |
| `engine-render.js` | PAYLOAD destructure + every render function + `main()` | Never |
| `engine-tail.html` | Closing `</script></body></html>` | Never |
| `build-payload.js` | One-or-more snapshot(s) -> PAYLOAD; owns ALL computation | Never (formulas are part of the engine contract) |
| `assemble-report.js` | Stitches `head + const PAYLOAD = <json>; + render-js + tail` into a self-contained HTML file | Never |

**Verbatim-engine invariant**: adopters never edit any of these five files. If a section needs a value not currently rendered, the fix is to populate the PAYLOAD field; do NOT rewrite the engine. PAYLOAD is the only adopter-side surface, and it is populated by `build-payload.js` reading from the adopter's snapshot -- not by the adopter.

This invariant is load-bearing for upgrades: `/strap-upgrade` ships engine updates from the canonical STRAP release; if an adopter modified the engine locally, three-way merge surfaces a conflict and the adopter must resolve. Adopters who want a different visual go through the STRAP contributor flow, not local edits.

## What we adopt from Raptor

The Raptor `/dora-report` implementation is the visual and architectural reference. Specifically:

**The 5-asset architecture itself.** The separation of engine (presentation) from PAYLOAD (data contract) from builder (snapshot->PAYLOAD) from assembler (stitcher) is a proven pattern. Adopt it without modification.

**The CSS design system in `engine-head.html`.** Theme tokens (light + dark), typography (Inter + JetBrains Mono via Google Fonts CDN with system-font fallback), sticky chrome (`.sticky-top`, `.masthead`, `.view-picker`, `.view-wrap`), layout primitives (`.kpi-grid`, `.verdict-grid`, `.vol-grid`, `.aging-grid`, `.profile-grid`, `.hh-split`), section chrome (`section.block`, `.block-num`, `.block-title`, `.block-lede`), tables (`table.editorial`), pills + buckets (`.delta-pill`, `.bucket`, `.sig`), callouts (`.callout`), spine bars (`.sb-*`), PR-weight purple block (`.pw-*`), AI-Efficiency hero (`.ai-hero`), profile cards (`.profile-card`), aging cards (`.aging-card`), heatmap (`.heatmap-wrap`, `.heat-grid`), appendix (`details.appendix`), responsive breakpoints, print stylesheet, theme-toggle.

**The render idioms in `engine-render.js`.** Specifically:

- View-picker pattern: per-sprint cards + a comparison card + an in-flight card; click switches views; history-state preserves the active view.
- Sprint hero: kicker + h1 + lede + sprint-strip.
- AI-Efficiency hero block: 72px headline number with delta pill, side panel showing mean + P90, work-composition mix bar (agent vs human).
- KPI cards with sparklines and delta pills.
- Verdict cards: milestone / watch / context tri-grid with headline + context + detail + action.
- Sprint contents: grouped tables (Features / Stories / Specs / Enhancements / Bugs) with linked IDs.
- Per-developer profile cards: volume + weight bars + heaviest-PR line + signature pill.
- Editorial dev table: integration PRs, intermediate, signature, avg iter, avg cmt, tasks closed, tasks active, higher closed, AI Eff P50, median cycle, review cmts.
- PR-weight block (when weight signal present): KPI grid of files/lines/commits/work-items P50 + P90 + max; heaviest-PR table.
- PR-reviewers leaderboard: per-reviewer lollipop with PR-count + comment-count.
- PR size bucket distribution: bucket table + outliers list (Large + XL).
- Data quality table: per-field covered/total/pct + status pill.
- Comparison view: verdict tri-grid + inactive-members + agent-attribution block + pipeline funnel with AI/Human/All toggle + KPI sparklines + sprint-over-sprint movement bars (improvements vs regressions) + volume small-multiples + deploy heatmap + per-dev spine + PR-weight-per-dev + field coverage + methodology appendix.
- Current/in-flight view: sprint progress bar + aging-alerts grid + active tasks/stories/features/specs + open PRs + pipeline activity.
- `deltaPill()` helper: `↑ +87%` green / `↓ -39%` red / `→ +3%` grey within ±5%, with `inverse` mode for metrics where higher-is-worse.
- `sparklineSvg()` helper: inline SVG sparkline rendered from a value array.
- Theme toggle with `localStorage` persistence and `prefers-color-scheme` initial fallback.

**The metric definitions.** Where STRAP and Raptor compute the same metric (AI Efficiency Ratio wall-clock, PR cycle, PR size buckets, agent-vs-human classifier, per-dev union, pipeline-funnel hops), the formulas are identical and we adopt them.

**The count-driven label generalization.** Raptor's engine uses a `SPRINT_N` constant so the same engine renders 1 sprint or N sprints. We adopt that pattern unchanged.

## What we drop from Raptor

Every Raptor-specific assumption is removed and replaced with adopter-portable values driven by the snapshot or the connection profiles. Concretely:

| Raptor specific | Why dropped | Replacement |
|---|---|---|
| `<title>Raptor Core DORA Report` | Raptor-branded; adopters need their own name | Templated from PAYLOAD `reportTitle` (sourced from `devops-connection.yaml`'s project name + an adopter-overridable string) |
| `Raptor Core <span class="accent">DORA</span> Report` brand line | Same | Templated from PAYLOAD `brandName` + `brandAccent` |
| `--raptor` / `--raptor-deep` / `--raptor-soft` CSS variables | Hardcoded orange | Renamed to `--accent` / `--accent-deep` / `--accent-soft`; default color preserved (the warm orange #d97947 is good as a portable default); adopters can override via a documented theme-override snippet in a future iteration |
| Hardcoded ADO URL prefix `https://dev.azure.com/LeoMotionGroup/Raptor/_workitems/edit/` | Locks to one host + one org + one project | PAYLOAD `workItemUrlTemplate` -- a template string with `{id}` placeholder, sourced from `devops-connection.yaml`'s host configuration; the builder substitutes per-host conventions (ADO, Jira, GitHub Issues) |
| Hardcoded deploy buckets: `asaUat`, `asaProd`, `tmeUat`, `tmePr`, `marlin`, `pacePr` | Locks to Raptor's specific layer names | PAYLOAD `deployBuckets[]` -- an array of `{layerName, status counts, displayOrder}` driven by `metadata.layers_resolved[]`; the heatmap iterates this array |
| Hardcoded `kpiCard('ASA PROD deploys', ...)` reference in the per-sprint KPI strip | Layer-name leak | KPI strip computes per-layer deploy cards programmatically from `deployBuckets[]`; multi-layer adopters see N cards, single-layer adopters see one |
| Raptor agent role enum baked into `byAgentRole` aggregation | Locks to Raptor's roster | `byAgentRole` is now an open dictionary keyed by whatever roles appear in the snapshot; STRAP's 15-agent canonical roster surfaces when the snapshot contains those agent tags, but adopters with custom agents see their own roles |
| Federation-paths concept ("federation Code Activity" section based on `federation-paths.md`) | Raptor-specific; STRAP doesn't ship that file | Replaced by per-sub-repo and per-deployment-target views from `funnels[]` |
| `pipeline_summary_by_bucket` snapshot field reference | STRAP snapshot doesn't emit this | Builder reads from `funnels[]` (STRAP's unified scope-discriminated shape) |
| Hardcoded verdict copy and auto-generation rules tuned for Raptor's signals | Adopter-portable | Verdicts auto-generate from delta arithmetic on adopter-visible metrics; an optional `--verdicts <file>` flag lets the adopter author them explicitly |

## What we author fresh

Beyond the drops above, STRAP-specific extensions that have no Raptor equivalent:

**Adapter-mediated layer iteration.** Every render path that references a layer iterates `PAYLOAD.layers[]` (sourced from `metadata.layers_resolved[]` in the snapshot). Hardcoded layer-name references are forbidden.

**Per-Feature cluster cycle-time** (v2.4 polyrepo). New Executive Summary card and dedicated section block. Driven by PAYLOAD `clusterCycleTime: {median, mean, p90, sampleSize, inFlightCount, brokenCount, distribution}`. Built from snapshot `feature_clusters[]` where `cluster_merge_at` is non-null. Adopters with `feature_clusters[]: []` see the card omit.

**Per-target deployment frequency** (v2.4 polyrepo). Card-row in the Executive Summary alongside per-layer cards. Driven by PAYLOAD `deployTargets[]: [{target, eventCount, eventsPerDay}]`. Built from snapshot `deployments[]`. Adopters with no `deployment_targets:` declared see the card-row omit.

**Per-sub-repo funnel** (v2.4 polyrepo). New subsection under Layer Metrics. Driven by PAYLOAD `funnels[].subRepo[]: [{slug, totalRuns, succeeded, failed, canceled, successRate}]`. Built from snapshot `funnels[]` entries with `scope=sub-repo`. Single-repo umbrellas see the subsection omit.

**Per-deployment-target funnel** (v2.4 polyrepo). New subsection under Layer Metrics. Same shape as per-sub-repo, sourced from snapshot `funnels[]` with `scope=deployment-target`.

**Excluded clusters appendix** (v2.4-polish). New appendix section when snapshot `excluded_clusters[]` is non-empty. Driven by PAYLOAD `excludedClusters[]: [{featureId, title, exclusionReason, prIds, subRepos, lifecycleDates}]`. Renders as collapsible `<details>` per existing appendix convention. Adopters with no exclusions see the appendix omit entirely.

**STRAP-instrumented vs inherited aging split** (Pace finding). Aging Alerts section renders two sub-tables: STRAP-instrumented (items with `strap:*` tag OR `AI` tag OR `[STRAP/agent:*]` audit-line in comments) first, inherited backlog second (collapsed-by-default via `<details>` when more than 10 entries). Driven by PAYLOAD `aging: {strapInstrumented: [...], inherited: [...]}`. When all items are STRAP-instrumented (STRAP-native adopters with no inherited backlog), only one table renders.

**Pipeline Run Rate vs Deployment Frequency label-honesty** (Pace finding). The Executive Summary deploy card label switches between "Deployment Frequency" and "Pipeline Run Rate" based on PAYLOAD `deployments.attributionAvailable: true|false`. When the snapshot has `deployments[]` populated (per-target attribution exists), the card reads "Deployment Frequency". When `deployments[]` is empty or absent (no attribution -- typical for adopters whose deployment_targets is undeclared OR whose pipelines pre-date STRAP onboarding), the card reads "Pipeline Run Rate" with sub-line `<rate> runs / day -- no per-target attribution`.

**No-signal CFR pill at low denominators** (Pace finding). When the snapshot's per-layer deploy denominator is below the confidence threshold (default 3 deploys; configurable per #39701 in a future iteration), the CFR card renders a neutral `no signal` pill with sub-line `<numerator>/<denominator> -- denominator below threshold` rather than a healthy/warn/crit pill. PAYLOAD `cfrByLayer[].confidence: "high" | "low" | "no-signal"`.

**Insufficient signal per-dev signature** (Pace finding). Per-developer profile classifier checks whether the developer has any positive output signal across the rendered count columns (integration PRs, intermediate PRs, tasks closed, tasks active, higher items closed). When all are zero AND iter+comments are null, the signature pill renders as neutral `Insufficient signal` rather than defaulting to Quick-Approver. PAYLOAD `devRows[].signature: "Focused" | "Iterative" | "Moderate" | "Quick-Approver" | "Lone-Wolf" | "Insufficient signal"`.

**Broader data-quality vocabulary.** STRAP's snapshot has six data-quality flags (`revisions_unavailable`, `pr_threads_unavailable`, `reverts_unavailable`, `cw_oe_degeneracy`, `low_confidence_ai_eff`, plus per-field coverage). The engine surfaces each in the Data Quality section + degrades the affected metric section gracefully (e.g., when `pr_threads_unavailable`, the PR-size histogram degrades to a note instead of crashing). PAYLOAD `dataQuality: {flags: {...}, fieldCoverage: {...}, overallPct: <0-1>}`.

**Pervasive AI vs Human partition.** STRAP tags AI-driven work via the `AI` tag, the agent-classifier heuristic (wall-clock < 1h AND originalEstimate >= 0.5h), and `[STRAP/agent:*]` audit lines in comments. The snapshot already normalizes `hasAiTag` per work item. The builder propagates this signal into a pervasive partition across PAYLOAD: every metric where the work-execution-mode distinction is meaningful carries `{all, ai, human}` triples. The partition is computed once by the builder (not the engine) so render is cheap. Metrics partitioned:

- AI Efficiency Ratio: per-sprint `ai.{all, ai, human}` each carrying `{count, p50, mean, p90}`.
- PR cycle (creation -> close): per-sprint `pr.cycle.{all, ai, human}` each `{p50, p90, mean, count}`. A PR is "AI-driven" when ANY of its linked work items has `hasAiTag` OR when the PR is authored by a recognizable agent identity.
- Cluster cycle-time: `clusterCycleTime.{all, ai, human}` each `{median, mean, p90, sampleSize, inFlightCount, brokenCount, distribution}`. Classification is by parent Feature's AI status.
- CFR: per-layer `cfrByLayer[layer].{all, ai, human}` each `{rate, numerator, denominator, confidence}`.
- MTTR: `mttr.{all, ai, human}` each `{p50, count}`.
- Pipeline funnel hops: each hop already carries `{ai, nonAi, all}` from Raptor's pattern; STRAP renames `nonAi` -> `human` for consistency.
- Quality per-type cycle-times (see below): every state-transition triplet carries the AI/Human partition.
- Throughput per work-item type: `throughputByType[type].{all, ai, human}` carries counts.
- Deployment frequency (per layer): `deployByLayer[layer].{all, ai, human}` carries counts -- "AI-driven deploys" are those triggered by Features with an AI-tagged work-item lineage.

**Dedicated "AI vs Human at a glance" exec block.** New section block near the top of every per-sprint view and the comparison view. Side-by-side KPI cards: AI Efficiency P50 (AI vs Human baseline), PR cycle P50 (AI vs Human), throughput tasks (AI vs Human), deploy contribution (AI vs Human). Each card shows the AI value + the Human value + a "spread" delta vs prior sprint (is the AI/Human gap widening or narrowing?). The CPO reading the executive summary should answer "how is the AI flow doing vs the human flow" in 5 seconds.

**Per-state-transition cycle-time tables in Quality.** The Pipeline Funnel section already captures the 12-hop view (with AI/Human/All toggle). The Quality section grows to surface per-work-item-type cycle-time at each state transition, with the AI/Human partition. New PAYLOAD `qualityCycleTimes` per sprint:

```
qualityCycleTimes: {
  requirement: { newToActive, activeToResolved, totalCycle, resolvedToNextSpecCreated },
  spec:        { newToActive, activeToResolved, totalCycle, resolvedToFirstFeatureCreated },
  feature:     { newToActive, activeToResolved, totalCycle, createdToFirstTaskActive },
  story:       { newToActive, activeToResolved, totalCycle },
  task:        { newToActive, activeToClosed, totalCycle }
}
```

Each leaf is `{all: {p50, p90, count}, ai: {p50, p90, count}, human: {p50, p90, count}}`. Adopters whose data doesn't support a leaf (e.g., no revisions to derive state transitions) see that leaf degrade with a tooltip explaining the data gap.

This signal is complementary to Aging Alerts: Aging Alerts surfaces STUCK items (urgent, drill); Quality cycle-times surfaces VELOCITY trends (executive read).

## PAYLOAD contract

The PAYLOAD object is the only data the engine reads. Every value rendered in the HTML output is destructured from PAYLOAD by `engine-render.js`. The contract is intentionally explicit; downstream changes to render must drive corresponding changes here.

### Top-level keys (all required; empty arrays preserve shape)

```
{
  // Branding + host-template (sourced from devops-connection.yaml)
  reportTitle: string,                  // adopter-facing report title, e.g. "Pace DORA Report"
  brandName: string,                    // e.g. "Pace"
  brandAccent: string,                  // e.g. "DORA" (rendered in --accent color in masthead)
  workItemUrlTemplate: string,          // template with {id} placeholder, e.g. "https://dev.azure.com/.../Raptor/_workitems/edit/{id}"
  prUrlTemplate: string,                // template with {id} placeholder for PR links

  // Adopter shape signals (drive conditional rendering)
  layers: Array<LayerDescriptor>,       // from metadata.layers_resolved[]
  subRepos: Array<SubRepoDescriptor>,   // from project-profile.md Sub-repos section (empty when single-repo umbrella)
  deploymentTargets: Array<TargetDescriptor>, // from devops-connection.yaml deployment_targets (empty when undeclared)

  // Per-sprint metrics (count-driven engine; SPRINT_N = sprintMetrics.length)
  sprintMetrics: Array<SprintMetric>,   // oldest-first; one entry per completed sprint
  sprintLabels: Array<string>,          // sprint names for label/legend axes
  sprintShort: Array<string>,           // 3-char abbreviations for x-axis ticks

  // Aggregate trend series (length = SPRINT_N each)
  series: {
    tasksClosed: Array<number>,
    prsInt: Array<number>,
    prsCompleted: Array<number>,
    deploysByLayer: { [layerName: string]: Array<number> },  // adapter-driven, not hardcoded
    deploysByTarget: { [targetName: string]: Array<number> },// when deploymentTargets non-empty
    aiP50: Array<number>,
    aiMean: Array<number>,
    aiP90: Array<number>,
    prCycleP50: Array<number>,
    prCycleP90: Array<number>,
    abandonPct: Array<number>,
    bugsByEnv: { [envName: string]: Array<number> },         // adapter-driven (env tag is adopter-defined)
    cwOeAntiPattern: Array<number>,
    clusterCycleP50: Array<number>,                          // null entries for sprints with no clusters
    untargetedDeployRuns: Array<number>                      // Pace label-honesty signal
  },

  // Cross-sprint movement (improvements + regressions lists)
  movement: {
    improvements: Array<MovementRow>,
    regressions: Array<MovementRow>
  },

  // Per-developer trend + totals
  trendByDev: Array<DevTrendRow>,       // length = SPRINT_N per developer
  devTotals: Array<DevTotalRow>,

  // Editorial verdicts (auto-generated when --verdicts not provided)
  verdicts: {
    milestone: VerdictCard,
    watch: VerdictCard,
    context: VerdictCard
  },

  // In-flight (current/right-now view) -- null when --no-current flag used
  currentMetrics: CurrentMetrics | null,

  // Roster note (members inactive in window)
  inactiveMembers: Array<InactiveMember>,

  // Agent attribution (adapter-driven; open dictionary)
  agentAttribution: {
    available: boolean,
    totalTasks: number,
    byAgent: { [agentRole: string]: AgentAttributionRow },
    sprintNames: Array<string>,
    message: string                     // explanatory text when unavailable
  }
}
```

### Per-sprint entry (`sprintMetrics[i]`)

```
{
  name: string,
  window: { start: ISOdate, end: ISOdate },

  counts: {
    totalWorkItems: number,
    tasks: number, tasksClosed: number, tasksActive: number,
    stories: number, features: number, enhancements: number,
    bugs: number,
    bugsByEnv: { [envName: string]: number },  // adapter-driven; replaces Raptor's bugsProd/bugsUat/bugsDev
    specs: number, reqs: number,
    prsInt: number, prsIntCompleted: number, prsIntAbandoned: number,
    prsIntActive: number, prsIntDrafts: number,
    prsInterm: number
  },

  draftsByAuthor: { [name: string]: number },

  contents: {
    features: Array<{id, title, assignee}>,
    stories: Array<{id, title, assignee}>,
    enhancements: Array<{id, title, assignee}>,
    specs: Array<{id, title, assignee}>,
    bugsResolved: Array<{id, title, assignee, env, severity}>
  },

  prsWithWeight: Array<PrWeightRow>,    // weight-bearing PRs; empty when weight unavailable
  prWeightStats: PrWeightStats,         // coverage = 0 when prsWithWeight is empty (designed honest degradation)
  prReviewersRanked: Array<ReviewerRow>,

  agentVsHuman: {
    agent: number, human: number,
    tagged: number, heuristic: number,
    agentShare: number, taggedShare: number,
    agentByOrchestrator: { [name: string]: number },
    humanByAssignee: { [name: string]: number },
    byAgentRole: { [role: string]: { tasks: number } }  // open dictionary; not enum
  },

  // AI Efficiency carries the pervasive AI/Human partition
  ai: {
    all:   { count, p50, mean, p90 },
    ai:    { count, p50, mean, p90 },
    human: { count, p50, mean, p90 },
    confidence: "high" | "low"            // low when fewer than 30% wall-clock-computable
  },

  funnel: FunnelData,                     // 12-hop progression per item type; each hop partitioned {all, ai, human}

  pr: {
    cycle: {
      all:   { p50, p90, mean, count },
      ai:    { p50, p90, mean, count },
      human: { p50, p90, mean, count }
    },
    sizeBuckets: { Small, Medium, Large, XL },
    sizeBucketsByMode: {
      ai:    { Small, Medium, Large, XL },
      human: { Small, Medium, Large, XL }
    },
    outliers: Array<PrOutlier>,
    total
  },

  // STRAP-specific per-sprint blocks (omit cleanly when adopter shape doesn't carry them)
  // Each carries the pervasive {all, ai, human} partition where the distinction is meaningful
  deployByLayer: {
    [layerName: string]: {
      total, succeeded, failed, canceled,
      byMode: { ai: number, human: number }     // count of deploys whose lineage traces to AI-driven Features
    }
  },
  deployByTarget: { [targetName: string]: { total, eventCount, byMode: {ai, human} } } | null,
  clusterCycleTime: {
    all:   { median, mean, p90, sampleSize, inFlightCount, brokenCount, distribution: Array<{featureId, cycleSeconds, prCount, isAi}> },
    ai:    { median, mean, p90, sampleSize, inFlightCount, brokenCount, distribution: [...] },
    human: { median, mean, p90, sampleSize, inFlightCount, brokenCount, distribution: [...] }
  } | null,
  cfrByLayer: {
    [layerName: string]: {
      all:   { rate, numerator, denominator, confidence: "high"|"low"|"no-signal" },
      ai:    { rate, numerator, denominator, confidence },
      human: { rate, numerator, denominator, confidence }
    }
  },
  mttr: {
    all:   { p50, count },
    ai:    { p50, count },
    human: { p50, count }
  },
  pipelineRunRateMode: "deployment-frequency" | "pipeline-run-rate",  // Pace label-honesty signal

  throughputByType: {
    [type: string]: {                    // type in {Requirement, Spec, Feature, Story, Task, Bug, Enhancement}
      all: number, ai: number, human: number
    }
  },

  qualityCycleTimes: {
    requirement: {
      newToActive:                 PartitionedCycle,
      activeToResolved:            PartitionedCycle,
      totalCycle:                  PartitionedCycle,
      resolvedToNextSpecCreated:   PartitionedCycle   // cross-type hop
    },
    spec: {
      newToActive:                 PartitionedCycle,
      activeToResolved:            PartitionedCycle,
      totalCycle:                  PartitionedCycle,
      resolvedToFirstFeatureCreated: PartitionedCycle
    },
    feature: {
      newToActive:                 PartitionedCycle,
      activeToResolved:            PartitionedCycle,
      totalCycle:                  PartitionedCycle,
      createdToFirstTaskActive:    PartitionedCycle
    },
    story: {
      newToActive:                 PartitionedCycle,
      activeToResolved:            PartitionedCycle,
      totalCycle:                  PartitionedCycle
    },
    task: {
      newToActive:                 PartitionedCycle,
      activeToClosed:              PartitionedCycle,
      totalCycle:                  PartitionedCycle
    }
  },

  // Executive at-a-glance AI vs Human comparison
  aiVsHumanGlance: {
    aiEfficiency:        { ai: number|null, human: number|null, spreadDeltaVsPrior: number|null },     // Track 1 binary
    prCycleHours:        { ai: number|null, human: number|null, spreadDeltaVsPrior: number|null },     // Track 1 binary
    tasksClosed:         { ai: number, human: number, spreadDeltaVsPrior: number|null },               // weighted via WI partition
    deploys:             { ai: number, human: number, spreadDeltaVsPrior: number|null },               // Track 2 weighted via cluster lineage
    authorshipShare: {                                                                                 // Track 2 weighted; the new "what fraction was AI-authored" stat
      pct: number,                                       // 0..100 -- mean(aiShare) across PRs in window
      deltaVsPrior: number|null                          // pct-point delta
    }
  },

  // Snapshot-time pre-computed PR partition signals (consumed by builder + engine)
  aiContributionShare: {
    overall: number,                                     // 0..1 -- the headline weighted share for the sprint
    byLayer:  { [layerName: string]: number },
    byTarget: { [targetName: string]: number } | null    // null when deployment_targets undeclared
  },

  intermediateShare: number,

  devRows: Array<DevRow>,

  dq: DataQualityCoverage
}
```

### Other types

- `LayerDescriptor`: `{ name, pipelinePattern, productLayer?, federationPattern?, excludedFromDora }`
- `SubRepoDescriptor`: `{ slug, path, deploymentTarget?, pipelineMatchPatterns: [] }`
- `TargetDescriptor`: `{ name, environment, deployKind }`
- `MovementRow`: `{ name, from, to, deltaPct, mag, magnitude }`
- `DevTrendRow`: per-dev per-sprint arrays (prs, interm, drafts, tasks, higher, comments, iter, maxIter, avgCmt, avgFiles, avgLines, totalLines, heaviestPr)
- `DevTotalRow`: rolled-up per-dev totals across all sprints
- `VerdictCard`: `{ headline, context, detail, action }`
- `CurrentMetrics`: `{ sprintName, daysElapsed, daysRemaining, tasksActive, storiesActive, featuresActive, specsActive, aging, prs, prsByAuthor, tasksActiveByAssignee, pipelineRuns }`
- `InactiveMember`: `{ name, lastActivityDate, lastPrId, lastPrTitle }`
- `AgentAttributionRow`: `{ tasks, stories, ratios: [], oeSum, wallclockSum, perSprint, aiP50, aiMean }`
- `DevRow`: per-sprint per-dev row with classification, counts, signature
- `DataQualityCoverage`: per-field `{covered, total, pct}` map + boolean flags + `overallPct`
- `PartitionedCycle`: `{all: {p50, p90, count}, ai: {p50, p90, count}, human: {p50, p90, count}}` -- the canonical AI/Human/All triple for any cycle-time metric. Used by quality cycle-times and exposed-via-toggle UI patterns. `count` is the sample size feeding that partition; when count is 0 the engine renders a `--` placeholder and an "insufficient sample" tooltip.

## Snapshot -> PAYLOAD mapping

The builder maps snapshot fields to PAYLOAD fields. The mapping is exhaustive; every PAYLOAD field is sourced from a specific snapshot field. Where the mapping requires computation (percentiles, classifications, deltas), the formula is named here.

### Branding + host templates

- `PAYLOAD.reportTitle`: `<projectName> DORA Report` where `projectName` is read from `devops-connection.yaml`'s project field.
- `PAYLOAD.brandName`: same project name.
- `PAYLOAD.brandAccent`: literal "DORA" (color-rendered in `--accent`).
- `PAYLOAD.workItemUrlTemplate`: composed from `devops-connection.yaml`'s host + project per host-family conventions:
  - Azure DevOps: `https://dev.azure.com/<org>/<project>/_workitems/edit/{id}`
  - GitHub Issues: `https://github.com/<owner>/<repo>/issues/{id}`
  - Jira: `https://<host>/browse/{id}` (Jira uses keys, not ints; template substitutes `{id}` regardless)
- `PAYLOAD.prUrlTemplate`: composed from `code-connection.yaml`'s host per family conventions.

### Adopter shape signals

- `PAYLOAD.layers`: direct copy of `metadata.layers_resolved[]`.
- `PAYLOAD.subRepos`: read from `project-profile.md` Sub-repos section via parsed mapping (passed through the snapshot; or read fresh by builder if needed -- builder responsibility).
- `PAYLOAD.deploymentTargets`: read from `devops-connection.yaml` deployment_targets list.

### Per-sprint metric formulas

**Counts** (`sprintMetrics[i].counts`):
- Each work-item-type count: filter `snapshot.work_items` by `type` and (for closed/resolved) by `closedDate`/`resolvedDate` in window.
- `bugsByEnv`: group bugs by `environment` field; produces adapter-driven keys (e.g., `prod`, `uat`, `dev`, or whatever the adopter's env tag vocabulary is).
- PR counts: filter `snapshot.prs_integration` and `snapshot.prs_intermediate` by date in window, then split by status.

**Contents** (`sprintMetrics[i].contents`): filter resolved/closed higher-order items in window; map to `{id, title, assignee}` tuples.

**AI-driven classification** (load-bearing for every AI/Human partition below):

A work item is AI-driven when EITHER of the following holds:
1. `hasAiTag === true` (the `AI` tag is present -- applied automatically by STRAP creation skills), OR
2. The work item's comments contain at least one `[STRAP/agent:*]` audit line (applied automatically by STRAP execution + state-transition skills).

Otherwise, it is Human-driven. The wall-clock heuristic (`wallClockHours < 1h AND originalEstimate >= 0.5h`) is NOT a classifier signal -- it false-positives on skilled humans with clear plans, and STRAP's auto-tagging discipline makes it unnecessary for STRAP-touched work. The heuristic IS used as a data-quality flag: when N% of closed Tasks have `wallClockHours < 1h` with no `AI` tag and no agent audit-line, the Data Quality section surfaces it as "possible missing audit" so adopters can investigate (either tag retroactively or accept as Human).

**PR partition uses a two-track model**:

**Track 1 -- Binary lenient (for cycle-time + distribution metrics).** A PR is AI-driven when EITHER:
- The PR is authored by a recognizable agent identity (created_by contains an agent-suffix per STRAP convention or matches `devops-connection.yaml`'s declared agent-identity pattern), OR
- ANY linked work item is AI-driven by the work-item rule above.

Used for: `pr.cycle.{ai, human}`, `pr.sizeBucketsByMode.{ai, human}`, outlier `isAi` flag, AI badge in tables. These metrics require whole-PR membership (cycle time is one number; size buckets need whole PRs).

**Track 2 -- Weighted `aiShare` (for count/contribution metrics).** Per PR, compute `aiShare = (count of AI-driven linked WIs) / (count of all linked WIs)`. PRs with no linked WIs use the binary author-only signal (1.0 if agent-authored, 0.0 if human-authored). Aggregate across PRs:

- `aiContributionShare` per sprint = `mean(aiShare across PRs in window)` -- the share of work that was AI-authored, weighted by mixed-PR composition.
- Per-layer + per-target contribution: same aggregation over the PR subset attributed to that layer/target via cluster lineage.

Used for: `aiVsHumanGlance.tasksClosed` (the weighted partition), `aiVsHumanGlance.deploys`, and a new exec-block "AI authorship share" stat that reads as "AI authored X% of work shipped this sprint."

The builder pre-computes `isAi` per work item, `isAi` (binary) per PR, AND `aiShare` (weighted) per PR once at snapshot-normalize time so downstream formulas don't recompute.

**AI Efficiency** (`sprintMetrics[i].ai`):
- For each Task in `closedTasks` with `originalEstimate > 0`, `activatedDate`, `closedDate`:
  - `wallClockHours = (closedDate - activatedDate) in hours`
  - `ratio = originalEstimate / wallClockHours` (drop when wallClockHours <= 0)
- `all.{count, p50, mean, p90}` over ALL eligible Tasks.
- `ai.{count, p50, mean, p90}` restricted to `isAi === true`.
- `human.{count, p50, mean, p90}` restricted to `isAi === false`.
- Percentile via linear interpolation; mean is arithmetic.
- `confidence`: `"low"` when `all.count / closedTasks.length < 0.30`, else `"high"`.

**Agent vs human** (`sprintMetrics[i].agentVsHuman`):
- For each Task in `closedTasks` with the computability conditions above:
  - `isAgent = hasAiTag || (wallClockHours < 1 && originalEstimate >= 0.5)`
  - Increment agent or human; partition tagged vs heuristic; bucket by orchestrator (createdBy) and assignee.
- `agentShare = agent / counts.tasksClosed` (denominator is all closed Tasks per honest base-rate rule).

**PR cycle + size buckets** (`sprintMetrics[i].pr`):
- Completed integration PRs: `(closedDate - creationDate) hours`.
- `pr.cycle.all.{p50, p90, mean, count}` over all completed PRs.
- `pr.cycle.ai.{p50, p90, mean, count}` restricted to PRs with `isAi === true`.
- `pr.cycle.human.{p50, p90, mean, count}` restricted to PRs with `isAi === false`.
- `sizeBuckets`: Small 0-1 iter, Medium 2-3, Large 4-7, XL 8+ over all PRs.
- `sizeBucketsByMode.{ai, human}`: same bucket counts restricted by mode.
- `outliers`: all Large + XL PRs (each row carries its `isAi` flag for UI styling).

**PR weight stats** (`sprintMetrics[i].prWeightStats`):
- Filter `prsInt` to those with `weight` field populated (git-diff-enabled collect run).
- `coverage = weightedPrs.length / prsInt.length` (when prsInt empty, coverage = 0).
- Per-stat P50/P90/max for files, lines, commits, work-items.

**Deploys by layer** (`sprintMetrics[i].deployByLayer`):
- For each layer in `metadata.layers_resolved[]`:
  - Filter `snapshot.pipeline_runs` to runs attributed to this layer in window.
  - Aggregate `{total, succeeded, failed, canceled}` from `status`.
  - `byMode.ai` / `byMode.human`: count of runs whose lineage (via feature_clusters[].feature_id -> work_item.isAi) traces to AI-driven Features vs Human-driven. When lineage cannot be resolved (no cluster marker on the run's source), the run falls into `byMode.human` by default (conservative; un-attributed work is treated as Human).
- Adapter-driven layer keys, not hardcoded.

**Deploys by target** (`sprintMetrics[i].deployByTarget`):
- When `snapshot.deployments[]` exists: per target, `events[]` length = `eventCount`.
- `byMode.{ai, human}`: count of events whose `feature_id` traces to an AI-driven Feature via work_items[].isAi.
- When absent: emit `null` (the engine skips per-target rendering).

**Cluster cycle-time** (`sprintMetrics[i].clusterCycleTime`):
- When `snapshot.feature_clusters[]` populated, partition clusters by their parent Feature's `isAi` flag:
  - `eligible = clusters with cluster_merge_at non-null AND in-window AND cluster_state != "broken"`
  - For each of `all`, `ai`, `human`:
    - filter eligible by partition (`all` = no filter; `ai` = parent Feature isAi; `human` = parent Feature !isAi)
    - `cycles = filtered.map(c => c.cluster_cycle_time_seconds / 3600)` (hours)
    - `median, mean, p90` over `cycles`; `sampleSize = filtered.length`
    - `inFlightCount = (full unfiltered set's in-flight count for this partition)`
    - `brokenCount = (same for broken)`
    - `distribution = filtered.map(c => {featureId, cycleSeconds, prCount: c.cluster_pr_count, isAi})`
- When `feature_clusters[]` empty: emit `null` (engine skips cluster-cycle rendering).

**CFR by layer** (`sprintMetrics[i].cfrByLayer`):
- For each layer and each of `all`, `ai`, `human`:
  - `denominator = deployByLayer[layer].byMode[partition]` (or total for `all`)
  - `numerator = count of (bugs created within 48h of a layer-bucket deploy AND env-tagged prod-equivalent AND of the same partition) + count of reverts in window of the same partition`
  - `rate = numerator / denominator` (when denominator > 0)
  - `confidence = "no-signal" when denominator < 3 (configurable threshold) ; "high" otherwise`
- The engine renders `no-signal` cells with a neutral pill rather than a healthy/warn/crit pill.
- Per-partition denominator can independently fall below threshold; ai may be no-signal while all is high-confidence.

**MTTR** (`sprintMetrics[i].mttr`):
- For each partition (`all`, `ai`, `human`):
  - Filter Bugs by `environment` env-tagged-prod AND partition AI status.
  - `p50 = median (resolvedDate - createdDate) in hours over filtered bugs`
  - `count = filtered bug count`

**Throughput by type** (`sprintMetrics[i].throughputByType`):
- For each work-item type:
  - `all`: count of items of that type resolved/closed in window.
  - For **Task / Bug / Enhancement** (atomic types -- no execution descendants): `ai` filters on `isAi === true`; `human` filters on `isAi === false`.
  - For **Requirement / Spec / Feature / Story** (higher-order types): `ai` filters on `isAiExecuted === true`; `human` filters on `isAiExecuted === false`; items with `isAiExecuted === null` (no descendant Tasks; indeterminate) are excluded from both AI and Human partitions but counted in `all`. This is the load-bearing "agents actually shipped" signal vs the lifecycle/authorship signal.

**Higher-order `isAiExecuted` propagation** (builder snapshot-normalize step):
- For each higher-order item (Requirement, Spec, Feature, Story), walk descendant work items via the parent-link relation.
- `descendantTasks = transitive descendants whose type === "Task"` (Tasks are the leaves; intermediate Stories/Features don't double-count).
- `aiExecutedShare = count(descendantTasks where isAi) / count(descendantTasks)` when `count > 0`; else `null`.
- `isAiExecuted = aiExecutedShare > 0.5` when share is computable; else `null`.
- For items where descendant lineage is incomplete (e.g., parent-link cycles, broken parent chains -- rare), `isAiExecuted: null` and the Data Quality section captures the count.

**Quality cycle-times** (`sprintMetrics[i].qualityCycleTimes`):

Per work-item type, derive durations from the snapshot's `revisions[]` (when available) or from the type's state-change dates (degraded mode). Each leaf below is a `PartitionedCycle` (`{all, ai, human}` each `{p50, p90, count}`).

- **Intra-type transitions** (per work-item life-cycle):
  - `newToActive`: for items in window that reached Active state, time from `createdDate` to first `Active` state transition.
  - `activeToResolved` (or `activeToClosed` for Task): for items resolved/closed in window, time from first `Active` transition to `resolvedDate`/`closedDate`.
  - `totalCycle`: for items resolved/closed in window, `(resolvedDate - createdDate) hours`. The end-to-end "creation to done" cycle.
- **Cross-type hops** (pipeline velocity):
  - `requirement.resolvedToNextSpecCreated`: for Requirements resolved in window, time from `resolvedDate` to first child Spec's `createdDate`.
  - `spec.resolvedToFirstFeatureCreated`: for Specs resolved in window, time from `resolvedDate` to first child Feature's `createdDate`.
  - `feature.createdToFirstTaskActive`: for Features created in window, time from `createdDate` to first descendant Task reaching Active state.

Partition each leaf by the item's classification flag: `isAi` for Task leaves; `isAiExecuted` for Requirement/Spec/Feature/Story leaves (items with `isAiExecuted === null` excluded from AI/Human partitions but counted in `all`). When the snapshot has `revisions_unavailable: true`, all `*ToActive` and `Active*To*` leaves degrade to state-change-date-only (less granular but still informative); the engine renders a tooltip explaining the degradation.

**AI vs Human at-a-glance** (`sprintMetrics[i].aiVsHumanGlance`):

Four exec-summary KPI cards, each carrying paired AI/Human values plus the spread-delta-vs-prior:
- `aiEfficiency`: `{ai: ai.ai.p50, human: ai.human.p50, spreadDeltaVsPrior: ((curr_ai - curr_human) - (prior_ai - prior_human)) / max(prior_ai - prior_human, epsilon) * 100}`
- `prCycleHours`: `{ai: pr.cycle.ai.p50, human: pr.cycle.human.p50, spreadDeltaVsPrior: ...}`
- `tasksClosed`: `{ai: throughputByType.Task.ai, human: throughputByType.Task.human, spreadDeltaVsPrior: ...}`
- `deploys`: `{ai: sum across layers of deployByLayer[layer].byMode.ai, human: sum.byMode.human, spreadDeltaVsPrior: ...}`

The spread-delta is "is the AI/Human gap widening or narrowing vs prior sprint" -- positive when AI is pulling further ahead; negative when Human is catching up. The exec reader gets the answer in 5 seconds.

**Pipeline-run-rate label-honesty** (`sprintMetrics[i].pipelineRunRateMode`):
- `"deployment-frequency"` when `snapshot.deployments[]` is non-empty (per-target attribution exists).
- `"pipeline-run-rate"` when empty (no attribution; label switches accordingly).

**Per-developer rows** (`sprintMetrics[i].devRows`):
- Active-developer set: UNION of integration-PR authors, intermediate-PR authors, Tasks-closed assignees, Tasks-active assignees, higher-item-closed assignees (Stories, Features, Specs).
- For each developer:
  - Count integration PRs, intermediate PRs, drafts.
  - Compute avg iterations, avg comments, peak iter (max), max iter (peak), bucket distribution.
  - Compute avg files, avg lines, total lines, heaviest-PR (top-1 by lines_total) from PR-weight data when available.
  - Count tasks closed, tasks active, higher items closed (with breakdown stories/features/specs).
  - Compute median task cycle time (closed tasks only).
  - Compute AI Efficiency P50 across this dev's closed tasks.
  - Count reviewer comments authored on others' PRs.
  - Classify signature per the Pace-finding rule:
    - If all output-count columns are zero AND iter+comments are null: `"Insufficient signal"`.
    - Else: Focused (avg iter <= 1.5, low-mod comments) / Iterative (avg iter >= 4, mod-high comments) / Quick-Approver (low iter, low comments) / Lone-Wolf (avg iter >= 4, avg comments < 2) / Moderate (default).

**Data quality** (`sprintMetrics[i].dq`):
- Per-field covered/total/pct from snapshot's `data_quality` block, restricted to in-window items.

### Aggregate series (`PAYLOAD.series`)

For each metric in the series, populate an array of length `SPRINT_N`. Null entries are valid (the engine renders them as gaps in sparklines).

- `tasksClosed[i] = sprintMetrics[i].counts.tasksClosed`
- `prsInt[i] = sprintMetrics[i].counts.prsInt`
- `deploysByLayer[layer][i] = sprintMetrics[i].deployByLayer[layer].total` (adapter-driven keys)
- `deploysByTarget[target][i] = sprintMetrics[i].deployByTarget[target].eventCount` (when present; missing target -> 0)
- `aiP50[i] / aiMean[i] / aiP90[i] = sprintMetrics[i].ai.{p50,mean,p90}`
- ... (rest mechanical from per-sprint entries)

### Movement (`PAYLOAD.movement`)

For each metric tracked across sprints, compute `(latest - prior) / prior * 100`. Threshold the absolute delta at 5% to filter noise. Sort improvements descending by `deltaPct`; regressions by `abs(deltaPct)` descending.

### Verdicts (`PAYLOAD.verdicts`)

When `--verdicts <file>` is supplied: load and pass through verbatim. When absent: auto-generate three neutral verdicts from the trend:

- `milestone`: largest improvement
- `watch`: largest regression
- `context`: most-changed metric (regardless of direction) OR a data-quality caveat when one is prominent (e.g., `cw_oe_degeneracy` flagged)

Adopters with known caveats are encouraged to author verdicts explicitly; auto-generated verdicts are a fallback, not the primary surface.

## Render rules

### AI vs Human partition (load-bearing)

The pervasive AI/Human/All partition surfaces in the layout via:

1. **"AI vs Human at a glance" block** -- rendered as the second section block of every per-sprint view (immediately after the AI Efficiency hero) and as a dedicated section in the comparison view. Four side-by-side KPI cards: AI Efficiency, PR cycle hours, tasks closed, deploys. Each card stacks two values (AI on top, Human below) with a spread-delta-vs-prior pill. Data source: `sprintMetrics[i].aiVsHumanGlance`.

2. **AI / Human / All toggle** -- rendered on:
   - Pipeline Funnel section (Raptor pattern, preserved): toggle switches the entire 12-hop table between partition views.
   - Quality cycle-times tables (new): same toggle pattern, switching per-state-transition cycle-time tables.
   - PR cycle distribution (new): same toggle pattern over PR size buckets + outliers + cycle stats.
   - Cluster cycle-time histogram (new): same toggle pattern over the cluster distribution + aggregates.
   - The toggle is a small button group with `[All] [AI] [Human]` chips; `All` is the default; selection persists per-section across view switches (not across page loads).

3. **Inline AI/Human dual-render** -- for select per-sprint KPI cards (AI Efficiency hero, CFR cards), the card renders both values side-by-side without a toggle. The toggle pattern is for sections with multiple data points; the dual-render pattern is for single-card metrics.

4. **AI badge in tables** -- per-developer row, per-PR row, per-outlier row carries a small `AI` badge (rendered via `.sig.ai` -- a new sig variant in `--accent-soft` background) when the work is AI-driven. Lets the reader scan a table for AI-driven entries without filtering.

The partition is ALWAYS available in PAYLOAD; the layout selectively surfaces it. Section content stays scannable; the AI/Human deep view is one toggle-click away.

### Pace-finding rules (load-bearing)

1. **Pipeline Run Rate label-honesty.** Executive Summary deploy card reads "Deployment Frequency" when `sprintMetrics[i].pipelineRunRateMode === "deployment-frequency"`, else reads "Pipeline Run Rate" with sub-line `<rate> runs / day -- no per-target attribution`.

2. **No-signal CFR pill at low denominators.** CFR card renders with neutral `no signal` pill when `sprintMetrics[i].cfrByLayer[layer].confidence === "no-signal"`; the pill text shows `<numerator>/<denominator> -- denominator below threshold`.

3. **Insufficient signal per-dev signature.** Per-developer cards render the signature pill as neutral `"Insufficient signal"` (not Quick-Approver) when `devRows[i].signature === "Insufficient signal"`.

4. **STRAP-instrumented vs inherited aging split.** Aging Alerts section renders two tables: STRAP-instrumented first (load-bearing for adopters tracking the STRAP cycle), inherited backlog second (collapsed-by-default `<details>` when >10 entries). Section header text adapts to "No STRAP-instrumented aging alerts in window" when zero STRAP-instrumented items exist.

5. **Excluded clusters appendix.** When `excludedClusters[]` is non-empty, render a collapsible `<details>` appendix listing per-cluster Feature id, title, exclusion reason, PR ids, sub-repos, lifecycle dates. Opening sentence: "These N cluster(s) are present in the snapshot but excluded from DORA-4 aggregate math per the `strap:validation-cycle` tag convention." Empty -> appendix omitted entirely.

### Adopter-shape degradation rules

The engine adapts gracefully to whatever the adopter actually has:

- **No `feature_clusters`**: cluster-cycle-time card omits; per-Feature distribution histogram omits.
- **No `deployments[]`**: per-target cards omit; Executive Summary card label switches to "Pipeline Run Rate".
- **No `subRepos`**: per-sub-repo Layer-Metrics subsection omits.
- **No `deploymentTargets`**: per-deployment-target Layer-Metrics subsection omits.
- **No `excluded_clusters`**: appendix omits.
- **No PR weight signal**: PR-weight block degrades to "run git fetch to populate this section" message.
- **No PR threads**: PR-size histogram degrades to a note explaining iteration-count proxy requires per-PR thread data.
- **No revisions**: Pipeline Funnel degrades to state-change-date-only timing (less granular but still informative).
- **No reverts (`git log` unavailable)**: CFR computation degrades to "bug-tagged-prod within 48h" only.

Every degradation surfaces the gap in the Data Quality section so the adopter knows what's missing and why.

### Visual conventions

- All dates rendered as ISO-8601 UTC (`YYYY-MM-DDTHH:MM:SSZ` for full timestamps; `YYYY-MM-DD` for date-only). No locale-dependent date formatting.
- Delta pills: `↑ +87%` green (up=improvement), `↓ -39%` red (down=regression), `→ +3%` grey (within ±5%). Inverse mode for higher-is-worse metrics (PR cycle time, CFR).
- Color palette honored across themes (light + dark):
  - Healthy: `var(--green)` / `var(--green-deep)`
  - Warning: `var(--amber)`
  - Critical: `var(--red)` / `var(--red-deep)`
  - Neutral: `var(--ink-soft)` / `var(--ink-faint)`
  - Accent: `var(--accent)` / `var(--accent-deep)` / `var(--accent-soft)` (replaces Raptor's `--raptor`)

## Sanitization rules (the invariant)

Every value the engine renders must trace back to one of:
1. A field in the snapshot (which itself sourced from adapter-mediated collection)
2. A field in `devops-connection.yaml` or `code-connection.yaml` (passed via PAYLOAD by the builder)
3. A field in `project-profile.md` (passed via PAYLOAD by the builder)
4. A computed value from the above

**No literal strings naming hosts, organizations, projects, layer names, agent roles, environment tags, or deployment targets are permitted in `engine-render.js` or `engine-head.html`.** Static UI text (section titles, column headers, accessibility labels) is permitted and intentional; data values are not.

## Verify-then-write quality gates

Before `assemble-report.js` writes the output HTML, the builder + assembler verify:

1. **PAYLOAD parses inside the file.** The `const PAYLOAD = {...};` line extracts cleanly via regex and `JSON.parse` succeeds.
2. **No broken substitution.** Headless render of `engine-render.js` against the PAYLOAD (stub `document`/`window`/`localStorage`/`history`/`location`) produces no `undefined`, `NaN`, `[object Object]`, or `Infinity` in the rendered HTML.
3. **Adopter-shape consistency.** When `PAYLOAD.subRepos.length === 0`, the rendered HTML contains no per-sub-repo subsection markup. When `PAYLOAD.deploymentTargets.length === 0`, no per-target subsection markup. Same for clusters and exclusions.
4. **Data Quality block honest.** Every flag in `PAYLOAD.dataQuality.flags` that is true appears in the rendered Data Quality section.
5. **Per-sprint section count.** Each per-sprint view contains 9 `section.block` elements (or the count adapts to v2.4 polyrepo additions; the structural-parity check accepts both 9 and the adapter-extended count, but rejects mismatched-count outputs).
6. **Spot-check sampling.** Five randomly-chosen figures are verified against the source snapshot within tolerance (exact match for counts; <1% drift for ratios).

If any gate fails, `assemble-report.js` refuses to write and surfaces the gap. The adopter sees an actionable error, not a broken report.

## Open questions for CPO

1. **Brand accent color override.** ~~Default is preserved Raptor orange `#d97947`. Should the engine ship a documented theme-override mechanism in v2.5 ...~~ **CLOSED 2026-05-31:** Raptor's color palette + layout adopted as STRAP DORA report canonical visual identity. No theme-override mechanism in v2.5. The warm orange IS the brand. CSS variables renamed `--raptor` -> `--accent` for code portability; values preserved.

2. **Verdicts auto-generation cadence.** ~~Auto-verdicts can be useful or noisy ...~~ **CLOSED 2026-05-31:** Auto-verdicts ON by default with `--no-auto-verdicts` opt-out flag and `--verdicts <file>` override. Lowers the bar for first-time adopters; sophisticated adopters opt out or hand-author. Verdicts auto-generate from delta arithmetic on snapshot data; data-quality caveats remain surfaced explicitly in the Data Quality section (not buried in verdict copy).

3. **No-signal CFR threshold value.** ~~Default 3 deploys ...~~ **CLOSED 2026-05-31:** Hardcode `CFR_DENOMINATOR_MIN = 3` as a named constant at the top of `build-payload.js` with a `// configurable via #39701` comment pointing forward. #39709 ships scope-tight; #39701 lands the configurability refactor as an independent change later in v2.5. The constant is defined once at module scope so the future #39701 substitution is mechanical.

4. **Aging-alerts collapse threshold.** ~~Inherited backlog table collapses behind `<details>` ...~~ **CLOSED 2026-05-31:** Hardcode `INHERITED_AGING_COLLAPSE_THRESHOLD = 10` as a named constant in `engine-render.js`. The folded `<details>` summary text renders informatively: `View <N> inherited backlog items` (telegraphs scale even when collapsed). Revisit only if an adopter surfaces friction. Pure-UI threshold; data is always present in PAYLOAD.

5. **Engine head sanitization scope.** ~~The `engine-head.html` `<title>` is templated, but everything else in the CSS ...~~ **CLOSED 2026-05-31:** Defer offline-mode (`--system-fonts` flag or similar) to a future polish. Graceful degradation already in place: the existing font-stack fallback (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`) means offline readers get a fully readable report -- they lose Inter typography but keep the design system, colors, layout, every metric. The dora-report SKILL.md will document this as a known characteristic: "Offline rendering preserves the report; typography degrades to system-font fallback." When a real adopter surfaces the no-CDN constraint, the mitigation is a small conditional in `assemble-report.js` and adds cleanly.

6. **AI-driven PR classifier strictness.** ~~A PR is AI-driven when authored-by-agent OR when ANY linked work item is AI-driven ...~~ **CLOSED 2026-05-31:** Two-track model. **Track 1 (binary lenient)** for cycle-time + distribution metrics: PR is AI when agent-authored OR any linked WI is AI. **Track 2 (weighted aiShare)** for count + contribution metrics: aiShare = AI-linked-WIs / total-linked-WIs; aggregate produces "AI authored X% of work shipped this sprint" as a new exec-block stat. Track 1 handles whole-PR metrics; Track 2 handles fairness via fractional contribution. Both tracks live in PAYLOAD; engine renders the appropriate one per section. Also closed in this iteration: work-item classifier is **explicit-only** (`AI` tag OR `[STRAP/agent:*]` audit-line); wall-clock heuristic demoted from classifier to Data Quality flag. STRAP's auto-tagging discipline (every STRAP-created work item carries `AI` + `strap:<type>` tags from creation; every state transition leaves a `[STRAP/agent:<name>]` audit comment) makes the heuristic unnecessary for STRAP-touched work and false-positive-prone for human work.

7. **AI vs Human partition for pre-STRAP work.** ~~Adopters with significant pre-STRAP backlog history ...~~ **CLOSED 2026-05-31:** All data included; Data Quality caveat surface via new `dataQuality.flags.pre_strap_human_backlog_share` field (computed at collect time as `count(work_items where !isAi AND createdDate < metadata.strap_adoption_date) / count(work_items where !isAi)`). When share > 30%, the auto-verdicts emit a `context` card noting the non-apples-to-apples nature of the comparison. Adopters who want a clean post-STRAP-only comparison run `/dora-collect --since <adoption-date>` upstream. No `--post-strap-only` flag on `/dora-report` in v2.5 -- defers to v2.6 only if adopter friction surfaces. `metadata.strap_adoption_date` is sourced from `project-profile.md` (new optional field; defaults to the earliest `[STRAP/agent:*]` audit comment date when not declared).

8. **Higher-order-type AI partition attribution.** ~~For some types (Requirement, Spec, Feature, Story), AI involvement spans the lifecycle ...~~ **CLOSED 2026-05-31:** Hybrid model. Each higher-order item (Requirement, Spec, Feature, Story) carries TWO flags computed by the builder:
   - **`isAi`** (authorship): native -- the work item was created through the agentic pipeline (has `AI` tag).
   - **`isAiExecuted`** (execution): derived from descendant Tasks -- `aiExecutedShare = AI Tasks / total descendant Tasks > 0.5` (majority rule, matches Track 2 PR weighting). Items with no descendant Tasks get `isAiExecuted: null` (indeterminate).
   
   Partition selection per metric category:
   - **Throughput by type** + **cycle-time partitions** + the **AI vs Human at-a-glance exec block** -> use `isAiExecuted` (the load-bearing "agents actually shipped" signal).
   - **Optional authorship-rate callout** in higher-order sections -> uses `isAi` (the "STRAP authored N items this sprint" signal).
   - **Aging Alerts** STRAP-instrumented vs inherited split -> orthogonal; uses `strap:*` tag presence (unchanged).
   - **Tasks** -> native `isAi` only (no descendants; the two signals collapse).
   
   The two flags answer different questions; both live in PAYLOAD; the engine renders the appropriate one per section.

## References

- Feature work item: ADO #39709 (v2.5: /dora-report SPA refactor adopting 5-asset engine architecture)
- Continuation context: [`continuations/v25-roadmap-and-grooming.md`](./continuations/v25-roadmap-and-grooming.md)
- Upstream skill (snapshot source): [`../../skills/dora-collect/SKILL.md`](../../skills/dora-collect/SKILL.md)
- Companion skill (data-quality janitor): [`../../skills/dora-reconcile/SKILL.md`](../../skills/dora-reconcile/SKILL.md)
- Companion skill (close-ceremony report): [`../../skills/close-ceremony/SKILL.md`](../../skills/close-ceremony/SKILL.md)
- Onboarding design (connection profiles + Layers): [`onboarding-design.md`](./onboarding-design.md)
- Visual reference (Raptor's polished 2026-05-12 design): `file:///C:/Users/ShaneCorrallo/Downloads/dora-spa-2026-05-12.html#comparison`
- Visual reference (Raptor's 2026-05-31 latest): `file:///C:/Users/ShaneCorrallo/source/repos/OMNI/OmniCore/Raptor/.claude/contexts/dora-reports/20260531-polished.html#comparison`
