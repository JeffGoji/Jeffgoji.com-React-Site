# dora-analyst memory

Your accumulated tradecraft for this project. Captures what you have learned about how to do your job well on THIS codebase.

Curated by the dev-lead. You read; you do not write. When you finish a task and notice something worth persisting, report it to the dev-lead in your finishing summary's "for curation" section -- the dev-lead decides what gets added here.

## Project tradecraft

### Wall-clock is the only honest AI Efficiency Ratio

The `OriginalEstimate / CompletedWork` ratio has a well-known data-entry artifact: 50%+ of historical Tasks end up with `CompletedWork == OriginalEstimate` exactly, because the persistence step either copies OE forward or human reviewers stamp it equal at close-time. That makes the ratio read `1.00x` universally for those Tasks -- a degenerate metric.

`/dora-collect` Step 8 auto-detects this and sets `data_quality.cw_oe_degeneracy: true` when the CW==OE proportion crosses 50%. When that flag is set:

- The OE/CW ratio is meaningless for this snapshot. Do not quote it.
- The wall-clock variant (`ActivatedDate -> ResolvedDate` in hours) is the only valid AI Efficiency signal.
- `/dora-report` switches the headline AI-Eff to wall-clock automatically; honor that in your interpretation.

When the flag is unset (less than 50% CW==OE degeneracy), the OE/CW ratio MAY be a useful secondary signal, but wall-clock remains the primary headline.

### Integration-target PRs are the primary stream

`/dora-collect` Step 5 splits PRs into two streams based on `code-connection.yaml`'s `default_branch`:

- `prs_integration`: PRs targeting the default branch. This is the cumulative velocity signal -- all DORA-4 metrics compute from this set.
- `prs_intermediate`: PRs targeting any other branch (feature branches, task branches). Intermediate merges.

Filtering only to integration-stream is the right default for headline metrics. Filtering only to intermediate-stream erases developers whose sprint output is in-flight work on long-running feature branches. The Per-Developer Profile section's UNION-across-sources approach handles this -- honor it when interpreting per-developer signal.

Surface intermediate stream as a callout only when its count is material (>20% of total in-window PRs). The dev-lead may infer a long-running federation pattern from the ratio.

### Iteration count is the no-extra-API PR size proxy

PR file/line counts require fetching the source branch, which is often deleted post-merge. `/dora-collect` Step 5 captures PR threads (when the source-control profile exposes `pull_request_show`) and reads the count of `RefUpdate` thread events -- a no-API-cost proxy for "how many times did the author push after the PR was opened."

Buckets:

| Bucket | Iterations | Interpretation |
|---|---|---|
| Small | 0-1 | Single push or one fix; landed clean |
| Medium | 2-3 | Modest back-and-forth; expected for non-trivial work |
| Large | 4-7 | Heavy iteration; signal of complexity or unclear scope |
| XL | 8+ | Outlier; investigate for scope creep or review pattern |

When the iteration count is unavailable (`data_quality.pr_threads_unavailable: true`), do not invent a size signal -- surface the gap explicitly and recommend the dev-lead address the source-control profile gap.

### Active-developer set is a UNION across seven sources

The Per-Developer Profile section's developer set unions across:

1. Authors of integration-target PRs in window.
2. Authors of intermediate-target PRs in window.
3. Assignees of Tasks closed/resolved in window.
4. Assignees of Tasks currently in Active state (in-flight work).
5. Assignees of Stories closed/resolved in window.
6. Assignees of Features closed in window.
7. Assignees of Specs resolved in window.

A developer mid-Story on a feature branch shows as "did nothing this sprint" if you filter to source 1 only. The UNION approach is the antidote -- when a developer appears only in sources 2, 3, or 4, surface that explicitly in your interpretation so the dev-lead understands the developer's output is real but invisible to single-source filtering.

### Per-developer signature classification is load-balance signal, not performance judgment

Formula-driven labels from avg iterations + avg comments per PR:

- **Focused**: low iter (avg <= 1.5) + low-to-moderate comments. Small clean PRs.
- **Iterative**: high iter (avg >= 4) + moderate-to-high comments. Heavy back-and-forth.
- **Quick-Approver**: low iter + low comments. Either trivial PRs or rubber-stamped reviews.
- **Lone-Wolf**: high iter + low comments (avg < 2). Working without review burden -- flag for review-load balance.
- **Moderate**: default for everything else.

The labels describe *workflow shape*, not *quality of work*. When you interpret a developer's signature for the dev-lead, frame it as load-balance information: "X is signaturing Lone-Wolf this sprint, suggesting they're getting fewer reviews than average; worth a conversation about whether they need more reviewer capacity."

NEVER frame a signature as a performance judgment. NEVER recommend any agent action based on a developer's signature alone.

### Layer Metrics partition by project-profile.md's Layers section

`/dora-collect` reads the `Layers` section from `project-profile.md` and uses each layer's `Pipeline pattern` (glob/regex) to bucket pipeline runs. Each layer also declares an optional `Product layer` (grouping label) and `Federation pattern` (file-path glob for code-activity attribution).

When the section is empty -- common for single-pipeline projects -- everything buckets to `default` and the Layer Metrics section in the report renders single-layer. Adopters with multi-product or multi-federation deployments populate the section to get per-layer DORA-4 breakdowns.

When you interpret layer metrics, never assume cross-layer comparability -- a CFR of 5% in ASA-PROD is not directly comparable to a CFR of 5% in Marlin-PROD if the layers have different deployment cadences and tenant footprints. Surface per-layer interpretations separately.

### Honest data-quality reporting is the discipline

The `data_quality` section in the snapshot is the honesty signal. When a metric category shows < 30% coverage, the corresponding metric is `low_confidence` -- `/dora-report` flags it inline. When you interpret a low-confidence metric, your language MUST reflect the uncertainty:

- "Lead time for changes appears to be 4.2 days median, BUT only 28% of work items in the window have the required `ActivatedDate` field -- this number is low-confidence."
- "AI Efficiency Ratio cannot be reliably computed for this snapshot (wall-clock-computable coverage is 18%); recommend `/dora-reconcile --auto-fix` first."

Hedging language is HONEST language. Confident claims from low-coverage data are misleading; the CPO depends on you to maintain that distinction.

### Per-developer breakdowns in every section

The report renders per-developer breakdowns in every section where developer attribution is meaningful (PR Health, Quality, Pipeline Funnel, Skill Calibration). When you interpret these:

- Look for cross-section patterns: a developer who's Quick-Approver in PR Health AND has high Pipeline Funnel hop 8 dwell is signaturing "rubber-stamps reviews but is slow to close own work" -- a load-balance concern.
- Look for outliers: a developer whose cycle time is 3x the team median may have a specific blocker worth surfacing.
- Look for invisibility: a developer who appears only in "Tasks active" (in-flight work) but nowhere else is signaling either long-running work or scope-creep; surface for the dev-lead.

## Anti-patterns to avoid

- **Don't use OE/CW as the headline AI Efficiency Ratio** when `cw_oe_degeneracy: true`. Wall-clock only.
- **Don't average away the per-developer signal**. A "team-average PR iteration count" hides the bimodal distribution of one Iterative developer + many Focused developers. Use distributions + per-developer tables, not just averages.
- **Don't single-stream PR filter**. Always check both `prs_integration` and `prs_intermediate`; report intermediate as callout when material.
- **Don't make claims from work items missing the `AI` tag**. The AI tag is the binary signal for "this item was authored by an AI agent in the STRAP pipeline." When AI-tag coverage in the snapshot is low (< 60% of in-window items), recommend the dev-lead run `/dora-reconcile --auto-fix` to populate the inheritance before relying on AI-segmented metrics.
- **Don't conflate Layer Metrics across layers**. A 5% CFR in one layer is not directly comparable to a 5% CFR in another -- each layer's deployment cadence and risk profile is distinct.
- **Don't recommend specific code fixes for anomalies**. When you spot a metric spike, trace to the underlying work items and identify candidate causes, but do not propose code-level remediation -- that's not your domain.
- **Don't run host queries directly**. The connection-profile `operation_templates.*` interface is the dev-lead's surface. If you need data the report or snapshot doesn't surface, ask the dev-lead to re-collect.
- **Don't paste large analysis blocks through shell heredocs**. Author analysis reports to file via the `Write` tool, then SendMessage the path.

## Tool / environment quirks

- `/dora-report`'s embedded Chart.js loads from CDN at view time. If you are reading the HTML programmatically (via `Read` or `Bash` text extraction), the rendered chart data is inline in the `<script>` blocks at the bottom of the file -- you don't need the CDN to access the underlying numbers.
- The snapshot's `metadata.layers_resolved` array captures the Layers section state AT THE MOMENT OF COLLECTION. If `project-profile.md`'s Layers section has changed between collection and your reading, the snapshot's layer set is authoritative for that snapshot's interpretation. `/dora-report` surfaces the divergence when it occurs.
- The snapshot may be gzip-compressed (`.json.gz` extension) when over 5 MB. Both `.json` and `.json.gz` are valid; the `Bash` tool can decompress on the fly if needed.

## Known unknowns to surface to the CPO on first invocation

These are project-specific values STRAP's defaults cannot supply. On your first dispatch for THIS project, include a "Known unknowns" section in your analysis report asking the dev-lead to surface these to the CPO and curate the answers back into this memory file:

- **Lead-time-for-changes target per layer.** STRAP defaults to "median" with no specific target hours. The 2021 DORA report's "elite" target is "< 1 hour"; "high" is "1 day to 1 week"; "medium" is "1 week to 1 month"; "low" is "> 1 month". THIS project's acceptable range for THIS layer needs CPO direction.
- **Change-failure-rate target per layer.** Industry "elite" is 0-5%, "high" is 5-10%, "medium/low" is 10-15%+. THIS project's threshold per layer needs CPO direction.
- **MTTR target per layer.** Elite < 1 hour, high < 1 day, medium 1-7 days, low > 7 days. THIS project's threshold needs CPO direction.
- **Deployment Frequency target per layer.** Daily / multiple-per-week / weekly / monthly -- the appropriate cadence for THIS layer is project-specific.
- **Release-readiness criteria.** Does THIS project block release on any open Sev 1-2 Bugs? Does it require all ACs have passing tests? Does it require documentation parity? These belong in project-profile.md once curated.
- **Per-developer reporting threshold.** Does THIS team accept full-name attribution in reports, or does it prefer initials/IDs for sensitivity? The Per-Developer Profile section default is full name -- confirm before publishing widely.
- **Performance governance targets.** P95 response-time targets, throughput thresholds per layer, load-test cadence. These come from ux-test-engineer's plans + CPO direction; surface gaps when load-test outputs reference targets not in this memory.
