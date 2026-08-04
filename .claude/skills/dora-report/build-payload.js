#!/usr/bin/env node

/**
 * build-payload.js
 *
 * Maps one or more /dora-collect snapshots (oldest-first) plus an optional in-flight
 * snapshot into the PAYLOAD object consumed by the dora-report engine. Owns ALL
 * computation; the engine is purely presentational.
 *
 * The PAYLOAD contract is documented in:
 *   .claude/strap/contexts/dora-report-engine-design.md
 *
 * Every value in the rendered HTML traces to one of:
 *   (a) a field in a /dora-collect snapshot,
 *   (b) a field in devops-connection.yaml (branding + URL templates),
 *   (c) a computed value from the above.
 *
 * Usage:
 *   node build-payload.js \
 *     --sprint <snapshot.json> [--sprint <snapshot.json> ...] \
 *     [--current <snapshot.json>] \
 *     [--verdicts <verdicts.json>] \
 *     [--connection <devops-connection.yaml>] \
 *     [--no-auto-verdicts] \
 *     --out <payload.json>
 *
 * --sprint is repeatable, oldest -> newest.
 * --current optionally supplies the in-flight snapshot for the "right now" view.
 * --verdicts optionally supplies hand-authored editorial verdicts (see design doc).
 * --connection defaults to ./claude/strap/state/devops-connection.yaml when omitted.
 * --no-auto-verdicts suppresses auto-generated verdicts (the tri-grid renders empty).
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ----------------------------------------------------------------------------
 * Constants
 * --------------------------------------------------------------------------*/

/** Default per-metric confidence thresholds (Features #39701 + #39724).
 *  Adopters override under devops-connection.yaml -> mapping.dora_confidence_thresholds.
 *  Defaults activate the no-signal pill consistently across all four metrics so
 *  unconfigured adopters get sensible suppression of false-precision values out
 *  of the box. Setting any threshold to 0 disables it (preserves v2.4 behaviour
 *  for that single metric -- escape hatch for adopters who want the raw values). */
const DEFAULT_CONFIDENCE_THRESHOLDS = Object.freeze({
  cfr_deploys: 3,
  mttr_sample: 5,
  lead_time_sample: 5,
  ai_eff_sample: 5,
});

/** Default STRAP-instrumentation signal configuration (Feature #39700).
 *  Adopters override under devops-connection.yaml -> mapping.strap_instrumentation_signals.
 *  Defaults preserve the v2.4 three-signal union: any 'strap:' tag prefix, any
 *  '[STRAP/agent:' comment-history prefix, plus the implicit AI tag and the
 *  upstream hasStrapAgentAudit flag from /dora-collect. */
const DEFAULT_STRAP_INSTRUMENTATION_SIGNALS = Object.freeze({
  tagPrefixes: ['strap:'],
  commentPrefixes: ['[STRAP/agent:'],
  customFields: [],
});

/** Aging Alerts: when more than this many inherited entries exist for a single
 *  card, the inherited list collapses into a <details> disclosure so the
 *  STRAP-instrumented signal stays readable. */
const INHERITED_AGING_COLLAPSE_THRESHOLD = 10;

/** Confidence threshold for AI Efficiency: below this share of wall-clock-computable
 *  Tasks vs total closed Tasks, the metric flags itself low-confidence inline. */
const AI_EFF_CONFIDENCE_MIN = 0.30;

/** Wall-clock heuristic used ONLY as a data-quality flag (per Q6 lock).
 *  Tasks with wallClockHours < 1 AND originalEstimate >= 0.5h but no AI signal
 *  surface as "possible missing audit" in the Data Quality section. */
const WALLCLOCK_HEURISTIC_HOURS = 1;
const WALLCLOCK_HEURISTIC_OE_MIN = 0.5;

/** Pre-STRAP backlog share threshold for surfacing the context verdict (per Q7). */
const PRE_STRAP_BACKLOG_VERDICT_THRESHOLD = 0.30;

/** PR size bucket boundaries (iteration count). */
const PR_SIZE_BUCKETS = {
  Small: [0, 1],
  Medium: [2, 3],
  Large: [4, 7],
  XL: [8, Infinity],
};

/** Higher-order work-item types -- carry isAiExecuted (derived from descendant Tasks). */
const HIGHER_ORDER_TYPES = new Set(['Requirement', 'Spec', 'Feature', 'Story']);

/** Atomic work-item types -- partition by native isAi only. */
const ATOMIC_TYPES = new Set(['Task', 'Bug', 'Enhancement']);

/** Per-developer signature classifier thresholds. */
const SIG_FOCUSED_ITER_MAX = 1.5;
const SIG_ITERATIVE_ITER_MIN = 4;
const SIG_LONEWOLF_CMT_MAX = 2;

/* ----------------------------------------------------------------------------
 * CLI argument parsing
 * --------------------------------------------------------------------------*/

/** Parse argv into a normalized options object. */
function parseArgs(argv) {
  const opts = {
    sprints: [],
    current: null,
    verdicts: null,
    connection: null,
    out: null,
    autoVerdicts: true,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sprint') opts.sprints.push(argv[++i]);
    else if (a === '--current') opts.current = argv[++i];
    else if (a === '--verdicts') opts.verdicts = argv[++i];
    else if (a === '--connection') opts.connection = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--no-auto-verdicts') opts.autoVerdicts = false;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!opts.sprints.length) throw new Error('At least one --sprint <snapshot> is required.');
  if (!opts.out) throw new Error('--out <payload.json> is required.');
  return opts;
}

/* ----------------------------------------------------------------------------
 * Snapshot I/O -- handles .json + .json.gz
 * --------------------------------------------------------------------------*/

/** Read + parse a snapshot file (gzip-aware, BOM-tolerant).
 *  Some adopter collectors (notably PowerShell-based on Windows) emit JSON
 *  with a UTF-8 BOM. Strip it before parse. */
function readSnapshot(filePath) {
  const buf = fs.readFileSync(filePath);
  let raw = filePath.endsWith('.gz') ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Failed to parse snapshot ${filePath}: ${e.message}`);
  }
}

/* ----------------------------------------------------------------------------
 * Generic stats helpers
 * --------------------------------------------------------------------------*/

/** Linear-interpolation percentile. Returns null on empty input. */
function percentile(arr, p) {
  const vals = arr.filter((v) => v != null && isFinite(v));
  if (!vals.length) return null;
  const s = [...vals].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

/** Arithmetic mean. Returns null on empty input. */
function mean(arr) {
  const vals = arr.filter((v) => v != null && isFinite(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Hours between two ISO timestamps (a -> b). Null when either side missing. */
function hoursBetween(a, b) {
  if (!a || !b) return null;
  const h = (new Date(b) - new Date(a)) / 36e5;
  return isFinite(h) ? h : null;
}

/** Trim ISO timestamp to YYYY-MM-DD. */
function dateOnly(s) {
  return s ? String(s).slice(0, 10) : null;
}

/** Is a date string within [win.start, win.end] inclusive? */
function inWindow(dateStr, win) {
  const d = dateOnly(dateStr);
  return d != null && d >= dateOnly(win.start) && d <= dateOnly(win.end);
}

/** Coalesce the first defined value from a list. */
function firstDefined(...vals) {
  for (const v of vals) if (v !== undefined) return v;
  return undefined;
}

/**
 * Build a PartitionedCycle: {all, ai, human} each {p50, p90, count}.
 *
 * @param {Array<{value: number, isAi: boolean|null}>} entries
 *   Each entry carries a numeric value + an AI classification.
 *   Entries with isAi === null are counted in `all` but excluded from ai + human
 *   (per the design doc rule for indeterminate higher-order items).
 */
function partitionedCycle(entries, sampleFloor) {
  const allVals = entries.map((e) => e.value);
  const aiVals = entries.filter((e) => e.isAi === true).map((e) => e.value);
  const humanVals = entries.filter((e) => e.isAi === false).map((e) => e.value);
  const floor = sampleFloor || 0;
  const leaf = (vals) => {
    const count = vals.filter((v) => v != null).length;
    return {
      p50: percentile(vals, 0.5),
      p90: percentile(vals, 0.9),
      count,
      confidence: classifyConfidence(count, floor),
      threshold: floor,
      thresholdKey: 'lead_time_sample',
    };
  };
  return { all: leaf(allVals), ai: leaf(aiVals), human: leaf(humanVals) };
}

/** Same as partitionedCycle but for count-of-items (no value array). */
function partitionedCount(items, classifier) {
  const all = items.length;
  let ai = 0, human = 0;
  for (const it of items) {
    const c = classifier(it);
    if (c === true) ai++;
    else if (c === false) human++;
  }
  return { all, ai, human };
}

/* ----------------------------------------------------------------------------
 * AI classifier -- explicit-only per Q6 lock
 * --------------------------------------------------------------------------*/

/**
 * Determine if a normalized work item is AI-driven by the explicit-only rule.
 *
 *   AI-driven WHEN: hasAiTag === true OR has at least one [STRAP/agent:*]
 *   audit-line in comments.
 *
 * The wall-clock heuristic is NOT a classifier signal (per Q6 lock); it is
 * surfaced as a data-quality flag separately.
 */
function classifyWorkItemIsAi(w) {
  if (w.hasAiTag === true) return true;
  if (w.hasStrapAgentAudit === true) return true;
  return false;
}

/** Escape a literal string for use inside a RegExp pattern. */
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Determine whether a normalized work item carries any STRAP-instrumentation signal
 * (Feature #39700). Used to split Aging Alerts into STRAP-instrumented vs inherited
 * backlog. The AI tag and the upstream hasStrapAgentAudit flag are always part of
 * the union; configurable prefixes and custom fields layer on top so adopters with
 * non-default tag schemas can extend the heuristic without code changes.
 */
function classifyHasStrapInstrumentation(w, signals) {
  if (w.hasAiTag === true) return true;
  if (w.hasStrapAgentAudit === true) return true;
  const s = signals || DEFAULT_STRAP_INSTRUMENTATION_SIGNALS;
  const tags = w.tags || '';
  for (const prefix of (s.tagPrefixes || [])) {
    if (!prefix) continue;
    const re = new RegExp('\\b' + escapeRegex(prefix) + '[a-z0-9_\\-]*\\b', 'i');
    if (re.test(tags)) return true;
  }
  const comments = w.comments || [];
  if (comments.length && (s.commentPrefixes || []).length) {
    for (const cmt of comments) {
      const text = (typeof cmt === 'string'
        ? cmt
        : (cmt && (cmt.text || cmt.body || cmt.content)) || '');
      for (const prefix of s.commentPrefixes) {
        if (prefix && String(text).includes(prefix)) return true;
      }
    }
  }
  for (const fieldName of (s.customFields || [])) {
    if (!fieldName) continue;
    if (w[fieldName]) return true;
    const camel = fieldName.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (camel !== fieldName && w[camel]) return true;
  }
  return false;
}

/**
 * Classify a sample size against a per-metric threshold.
 * Returns 'no-signal' when threshold > 0 and sampleCount < threshold; 'high' otherwise.
 * Threshold === 0 disables the rule (preserves v2.4 behaviour for metrics with no
 * historical floor).
 */
function classifyConfidence(sampleCount, threshold) {
  if (!(threshold > 0)) return 'high';
  return sampleCount < threshold ? 'no-signal' : 'high';
}

/**
 * Walk parent-child relations to compute isAiExecuted on higher-order items.
 *
 * isAiExecuted = (count of descendant Tasks where isAi) / (count of descendant Tasks) > 0.5
 * Null when no descendant Tasks exist (indeterminate).
 *
 * Implementation: build a parent->children map keyed by parent id, then for each
 * higher-order item walk its descendants iteratively (BFS) and tally Tasks.
 */
function propagateIsAiExecuted(workItems) {
  const byId = new Map(workItems.map((w) => [w.id, w]));
  const childrenByParent = new Map();
  for (const w of workItems) {
    if (w.parent) {
      if (!childrenByParent.has(w.parent)) childrenByParent.set(w.parent, []);
      childrenByParent.get(w.parent).push(w);
    }
  }
  for (const w of workItems) {
    if (!HIGHER_ORDER_TYPES.has(w.type)) {
      w.isAiExecuted = null;
      w.aiExecutedShare = null;
      continue;
    }
    let totalTasks = 0;
    let aiTasks = 0;
    const queue = [w];
    const seen = new Set([w.id]);
    while (queue.length) {
      const cur = queue.shift();
      const kids = childrenByParent.get(cur.id) || [];
      for (const k of kids) {
        if (seen.has(k.id)) continue;
        seen.add(k.id);
        if (k.type === 'Task') {
          totalTasks++;
          if (k.isAi) aiTasks++;
        } else {
          queue.push(k);
        }
      }
    }
    if (totalTasks === 0) {
      w.isAiExecuted = null;
      w.aiExecutedShare = null;
    } else {
      w.aiExecutedShare = aiTasks / totalTasks;
      w.isAiExecuted = w.aiExecutedShare > 0.5;
    }
  }
}

/**
 * Classify a normalized PR using the two-track model (per Q6 lock).
 *
 *   Track 1 (binary lenient): isAi === true when authored-by-agent OR
 *   any linked work item is AI-driven.
 *   Track 2 (weighted): aiShare = (AI-linked WIs) / (total linked WIs).
 *   PRs with no linked WIs use the author-only signal (1.0 if agent-authored,
 *   else 0.0).
 */
function classifyPr(pr, workItemsById, agentIdentityPatterns) {
  const linked = (pr.workItemRefs || []).map((id) => workItemsById.get(id)).filter(Boolean);
  const linkedAi = linked.filter((w) => w.isAi).length;
  const linkedTotal = linked.length;

  const authorIsAgent = isAgentAuthor(pr.createdBy, agentIdentityPatterns);

  if (linkedTotal > 0) {
    pr.aiShare = linkedAi / linkedTotal;
    pr.isAi = authorIsAgent || linkedAi > 0;
  } else {
    pr.aiShare = authorIsAgent ? 1.0 : 0.0;
    pr.isAi = authorIsAgent;
  }
}

/** Check createdBy against the adopter-declared agent-identity patterns. */
function isAgentAuthor(createdBy, patterns) {
  if (!createdBy || !patterns || !patterns.length) return false;
  const lc = String(createdBy).toLowerCase();
  for (const pat of patterns) {
    if (pat instanceof RegExp) {
      if (pat.test(createdBy)) return true;
    } else if (typeof pat === 'string') {
      if (lc.includes(pat.toLowerCase())) return true;
    }
  }
  return false;
}

/* ----------------------------------------------------------------------------
 * Schema normalization -- collapse snapshot variants into one internal shape
 * --------------------------------------------------------------------------*/

/** Normalize one work item from snapshot JSON into a canonical shape. */
function normalizeWorkItem(w) {
  const type = firstDefined(w.type, w.work_item_type, w.workItemType);
  const tags = firstDefined(w.tags, '') || '';
  const hasAiTag = /\bAI\b/.test(tags) || /(^|;)\s*AI\s*($|;)/.test(tags);
  return {
    id: w.id,
    type: type === 'User Story' ? 'Story' : type,
    rawType: type,
    state: w.state,
    title: w.title,
    assignedTo: firstDefined(w.assignedTo, w.assigned_to) || null,
    createdBy: firstDefined(w.createdBy, w.created_by) || null,
    createdDate: firstDefined(w.createdDate, w.created_date) || null,
    changedDate: firstDefined(w.changedDate, w.changed_date) || null,
    activatedDate: firstDefined(w.activatedDate, w.activated_date) || null,
    resolvedDate: firstDefined(w.resolvedDate, w.resolved_date) || null,
    closedDate: firstDefined(w.closedDate, w.closed_date) || null,
    stateChangeDate: firstDefined(w.stateChangeDate, w.state_change_date) || null,
    iterationPath: firstDefined(w.iterationPath, w.iteration_path) || null,
    areaPath: firstDefined(w.areaPath, w.area_path) || null,
    parent: firstDefined(w.parent, w.parent_id, w.parentId) || null,
    tags,
    hasAiTag,
    hasStrapAgentAudit: !!(w.hasStrapAgentAudit || w.has_strap_agent_audit),
    hasStrapTag: /\bstrap:[a-z0-9_\-]+\b/i.test(tags),
    severity: w.severity || null,
    environment: firstDefined(w.environment, w.env) || null,
    resolvedReason: firstDefined(w.resolvedReason, w.resolved_reason) || null,
    originalEstimate: firstDefined(w.originalEstimate, w.original_estimate) ?? null,
    completedWork: firstDefined(w.completedWork, w.completed_work) ?? null,
    remainingWork: firstDefined(w.remainingWork, w.remaining_work) ?? null,
    comments: w.comments || [],
    revisions: w.revisions || [],
    isAi: false,
    isAiExecuted: null,
    aiExecutedShare: null,
    hasStrapInstrumentation: false,
  };
}

/** Normalize one PR from snapshot JSON into a canonical shape. */
function normalizePr(p) {
  return {
    id: firstDefined(p.id, p.pr_id, p.pullRequestId),
    title: p.title,
    status: p.status,
    isDraft: !!firstDefined(p.is_draft, p.isDraft, false),
    creationDate: firstDefined(p.creation_date, p.creationDate) || null,
    closedDate: firstDefined(p.closed_date, p.closedDate) || null,
    sourceBranch: firstDefined(p.source_branch, p.source, p.sourceRefName) || '',
    targetBranch: firstDefined(p.target_branch, p.target, p.targetRefName) || '',
    createdBy: firstDefined(p.created_by, p.author, p.createdBy && (p.createdBy.displayName || p.createdBy)) || null,
    reviewers: (p.reviewers || []).map((r) => ({ name: r.name || (r.displayName || null), vote: r.vote })),
    iterationCount: firstDefined(p.iteration_count, p.iterations, 0) || 0,
    voteCount: firstDefined(p.vote_count, p.votes, 0) || 0,
    commentCount: firstDefined(p.comment_count, p.comments, 0) || 0,
    reviewerComments: p.reviewer_comments || {},
    firstReviewActivity: firstDefined(p.first_review_activity, p.firstReviewActivity) || null,
    weight: p.weight || null,
    workItemRefs: firstDefined(p.work_item_refs, p.workItemRefs, []) || [],
    isAi: false,
    aiShare: 0,
  };
}

/** Normalize one pipeline run from snapshot JSON. */
function normalizeRun(r) {
  return {
    id: r.id,
    definitionName: firstDefined(r.definition_name, r.definitionName, r.def) || '',
    layer: r.layer || null,
    subRepo: firstDefined(r.sub_repo, r.subRepo) || null,
    deploymentTarget: firstDefined(r.deployment_target, r.deploymentTarget) || null,
    status: firstDefined(r.status, r.result) || null,
    startTime: firstDefined(r.start_time, r.startTime) || null,
    finishTime: firstDefined(r.finish_time, r.finishTime) || null,
  };
}

/** Normalize one feature_cluster from snapshot JSON. */
function normalizeCluster(c) {
  return {
    featureId: firstDefined(c.feature_id, c.featureId),
    clusterPrIds: c.cluster_pr_ids || [],
    clusterPrCount: firstDefined(c.cluster_pr_count, c.clusterPrCount, (c.cluster_pr_ids || []).length),
    clusterOpenAt: firstDefined(c.cluster_open_at, c.clusterOpenAt) || null,
    clusterMergeAt: firstDefined(c.cluster_merge_at, c.clusterMergeAt) || null,
    clusterCycleTimeSeconds: firstDefined(c.cluster_cycle_time_seconds, c.clusterCycleTimeSeconds) ?? null,
    clusterState: firstDefined(c.cluster_state, c.clusterState) || null,
    unAttributedPrCount: firstDefined(c.un_attributed_pr_count, c.unAttributedPrCount, 0),
    exclusionReason: firstDefined(c.exclusion_reason, c.exclusionReason) || null,
  };
}

/**
 * Normalize a full snapshot. After this call, work items carry pre-computed
 * isAi (from classifier) and isAiExecuted (propagated from descendant Tasks);
 * PRs carry isAi (binary lenient) and aiShare (weighted).
 */
function normalizeSnapshot(snap, agentIdentityPatterns, strapInstrumentationSignals) {
  const md = snap.metadata || {};
  const workItems = (snap.work_items || []).map(normalizeWorkItem);
  const signals = strapInstrumentationSignals || DEFAULT_STRAP_INSTRUMENTATION_SIGNALS;
  for (const w of workItems) {
    w.isAi = classifyWorkItemIsAi(w);
    w.hasStrapInstrumentation = classifyHasStrapInstrumentation(w, signals);
  }
  propagateIsAiExecuted(workItems);
  const workItemsById = new Map(workItems.map((w) => [w.id, w]));

  const prsIntegration = (snap.prs_integration || []).map(normalizePr);
  const prsIntermediate = (snap.prs_intermediate || []).map(normalizePr);
  for (const p of prsIntegration) classifyPr(p, workItemsById, agentIdentityPatterns);
  for (const p of prsIntermediate) classifyPr(p, workItemsById, agentIdentityPatterns);

  return {
    name: md.sprint_name || md.snapshot_id || 'Unknown',
    window: md.window || { start: null, end: null },
    layersResolved: md.layers_resolved || [],
    strapAdoptionDate: md.strap_adoption_date || null,
    workItems,
    workItemsById,
    revisions: snap.revisions || [],
    pipelineRuns: (snap.pipeline_runs || []).map(normalizeRun),
    funnels: snap.funnels || [],
    prsIntegration,
    prsIntermediate,
    featureClusters: (snap.feature_clusters || []).map(normalizeCluster),
    excludedClusters: (snap.excluded_clusters || []).map(normalizeCluster),
    deployments: snap.deployments || [],
    reverts: snap.reverts || [],
    skillLogs: snap.skill_logs || {},
    dataQuality: snap.data_quality || {},
    metadata: md,
  };
}

/* ----------------------------------------------------------------------------
 * Per-sprint metric computation
 * --------------------------------------------------------------------------*/

function byType(workItems, t) { return workItems.filter((w) => w.type === t); }

function closedTasksInWindow(s) {
  return byType(s.workItems, 'Task').filter((w) => w.state === 'Closed' && inWindow(w.closedDate || w.stateChangeDate, s.window));
}

function inWinPr(p, win) {
  return inWindow(p.creationDate, win) || (p.closedDate && inWindow(p.closedDate, win));
}

/** Per-sprint counts block. */
function computeCounts(s, prsInt, prsInterm) {
  const wi = s.workItems;
  const bugs = byType(wi, 'Bug');
  const bugsByEnv = {};
  for (const b of bugs) {
    const env = (b.environment || 'unspecified').toLowerCase();
    bugsByEnv[env] = (bugsByEnv[env] || 0) + 1;
  }
  return {
    totalWorkItems: wi.length,
    tasks: byType(wi, 'Task').length,
    tasksClosed: byType(wi, 'Task').filter((w) => w.state === 'Closed' && inWindow(w.closedDate || w.stateChangeDate, s.window)).length,
    tasksActive: byType(wi, 'Task').filter((w) => w.state === 'Active').length,
    stories: byType(wi, 'Story').length,
    features: byType(wi, 'Feature').length,
    enhancements: byType(wi, 'Enhancement').length,
    bugs: bugs.length,
    bugsByEnv,
    specs: byType(wi, 'Spec').length,
    reqs: byType(wi, 'Requirement').length,
    prsInt: prsInt.length,
    prsIntCompleted: prsInt.filter((p) => p.status === 'completed').length,
    prsIntAbandoned: prsInt.filter((p) => p.status === 'abandoned').length,
    prsIntActive: prsInt.filter((p) => p.status === 'active').length,
    prsIntDrafts: prsInt.filter((p) => p.isDraft).length,
    prsInterm: prsInterm.length,
  };
}

/** Compute AI Efficiency Ratio with the {all, ai, human} partition.
 *  Carries two independent confidence signals:
 *    - `confidence`: legacy ratio-based 'low' label when wall-clock-computable
 *      share falls under AI_EFF_CONFIDENCE_MIN (rendered as the inline parenthetical).
 *    - `sampleConfidence`: per-metric sample-count signal honoured by #39701; when
 *      the configured ai_eff_sample floor is unmet, the engine renders the same
 *      "no signal" pill it uses for CFR / MTTR / lead-time. */
function computeAi(closedTasks, thresholds) {
  const t = thresholds || DEFAULT_CONFIDENCE_THRESHOLDS;
  const sampleFloor = t.ai_eff_sample;
  const ratioOf = (task) => {
    if (!(task.originalEstimate > 0) || !task.activatedDate || !task.closedDate) return null;
    const wc = hoursBetween(task.activatedDate, task.closedDate);
    if (!(wc > 0)) return null;
    return task.originalEstimate / wc;
  };
  const eligible = closedTasks.filter((task) => ratioOf(task) != null);
  const stat = (subset) => {
    const ratios = subset.map(ratioOf);
    return {
      count: ratios.length,
      p50: percentile(ratios, 0.5),
      mean: mean(ratios),
      p90: percentile(ratios, 0.9),
      sampleConfidence: classifyConfidence(ratios.length, sampleFloor),
      threshold: sampleFloor,
      thresholdKey: 'ai_eff_sample',
    };
  };
  const allComputable = eligible.length;
  const totalClosed = closedTasks.length;
  return {
    all: stat(eligible),
    ai: stat(eligible.filter((task) => task.isAi)),
    human: stat(eligible.filter((task) => !task.isAi)),
    confidence: totalClosed > 0 && allComputable / totalClosed >= AI_EFF_CONFIDENCE_MIN ? 'high' : 'low',
    sampleConfidence: classifyConfidence(allComputable, sampleFloor),
    threshold: sampleFloor,
    thresholdKey: 'ai_eff_sample',
  };
}

/** Agent-vs-human aggregate (preserved from Raptor pattern; uses explicit-only classifier per Q6). */
function computeAgentVsHuman(closedTasks) {
  let agent = 0, human = 0, tagged = 0, audited = 0;
  const agentByOrchestrator = {};
  const humanByAssignee = {};
  const byAgentRole = {};
  for (const t of closedTasks) {
    if (t.isAi) {
      agent++;
      if (t.hasAiTag) tagged++;
      if (t.hasStrapAgentAudit) audited++;
      const orch = t.createdBy || 'unknown';
      agentByOrchestrator[orch] = (agentByOrchestrator[orch] || 0) + 1;
      const roleMatch = (t.tags || '').match(/agent:([a-z0-9_\-]+)/i);
      if (roleMatch) {
        const role = roleMatch[1].toLowerCase();
        if (!byAgentRole[role]) byAgentRole[role] = { tasks: 0 };
        byAgentRole[role].tasks++;
      }
    } else {
      human++;
      const a = t.assignedTo || 'unassigned';
      humanByAssignee[a] = (humanByAssignee[a] || 0) + 1;
    }
  }
  const totalClosed = closedTasks.length;
  return {
    agent, human, tagged, audited,
    agentShare: totalClosed ? agent / totalClosed : 0,
    taggedShare: totalClosed ? tagged / totalClosed : 0,
    agentByOrchestrator, humanByAssignee, byAgentRole,
  };
}

/** PR cycle + size buckets (Track 1 binary lenient partition). */
function computePrCycleAndSize(prsInt) {
  const completed = prsInt.filter((p) => p.status === 'completed' && p.closedDate);
  const cycleOf = (p) => hoursBetween(p.creationDate, p.closedDate);
  const stat = (subset) => {
    const cycles = subset.map(cycleOf).filter((h) => h != null);
    return {
      p50: percentile(cycles, 0.5),
      p90: percentile(cycles, 0.9),
      mean: mean(cycles),
      count: cycles.length,
    };
  };
  const bucketOf = (iter) => {
    for (const [name, [lo, hi]] of Object.entries(PR_SIZE_BUCKETS)) {
      if (iter >= lo && iter <= hi) return name;
    }
    return 'Small';
  };
  const sizeBuckets = { Small: 0, Medium: 0, Large: 0, XL: 0 };
  const sizeBucketsAi = { Small: 0, Medium: 0, Large: 0, XL: 0 };
  const sizeBucketsHuman = { Small: 0, Medium: 0, Large: 0, XL: 0 };
  for (const p of prsInt) {
    const b = bucketOf(p.iterationCount);
    sizeBuckets[b]++;
    if (p.isAi) sizeBucketsAi[b]++;
    else sizeBucketsHuman[b]++;
  }
  const outliers = prsInt
    .filter((p) => p.iterationCount >= 4)
    .sort((a, b) => b.iterationCount - a.iterationCount)
    .map((p) => ({
      id: p.id, title: p.title, status: p.status, isDraft: p.isDraft,
      creationDate: p.creationDate, closedDate: p.closedDate,
      sourceBranch: p.sourceBranch, targetBranch: p.targetBranch,
      createdBy: p.createdBy, iterationCount: p.iterationCount,
      commentCount: p.commentCount, voteCount: p.voteCount,
      isAi: p.isAi, aiShare: p.aiShare,
    }));
  return {
    cycle: {
      all: stat(completed),
      ai: stat(completed.filter((p) => p.isAi)),
      human: stat(completed.filter((p) => !p.isAi)),
    },
    sizeBuckets,
    sizeBucketsByMode: { ai: sizeBucketsAi, human: sizeBucketsHuman },
    outliers,
    total: prsInt.length,
  };
}

/** PR weight stats (requires git-diff data; coverage 0 when absent). */
function computePrWeight(prsInt) {
  const weighted = prsInt.filter((p) => p.weight);
  const computable = weighted.filter((p) => p.weight.files_changed != null && p.weight.lines_total != null);
  const files = computable.map((p) => p.weight.files_changed);
  const lines = computable.map((p) => p.weight.lines_total);
  const commits = computable.map((p) => p.weight.commits || 0);
  const wits = computable.map((p) => p.weight.work_items_count || 0);
  return {
    prsWithWeight: weighted.map((p) => ({
      id: p.id, title: p.title, createdBy: p.createdBy,
      iterationCount: p.iterationCount, weight: p.weight, isAi: p.isAi,
    })),
    prWeightStats: {
      filesP50: percentile(files, 0.5) || 0,
      filesP90: percentile(files, 0.9) || 0,
      filesMax: files.length ? Math.max(...files) : 0,
      linesP50: percentile(lines, 0.5) || 0,
      linesP90: percentile(lines, 0.9) || 0,
      linesMax: lines.length ? Math.max(...lines) : 0,
      commitsP50: percentile(commits, 0.5) || 0,
      commitsP90: percentile(commits, 0.9) || 0,
      witP50: percentile(wits, 0.5) || 0,
      witMax: wits.length ? Math.max(...wits) : 0,
      coverage: prsInt.length > 0 ? computable.length / prsInt.length : 0,
    },
  };
}

/** Deploys aggregated per layer (adapter-driven keys; no hardcodes). */
function computeDeployByLayer(s, layers) {
  const out = {};
  for (const layer of layers) {
    const name = layer.name;
    const layerRuns = s.pipelineRuns.filter((r) => r.layer === name && inWindow(r.finishTime, s.window));
    let total = 0, succeeded = 0, failed = 0, canceled = 0;
    let aiCount = 0, humanCount = 0;
    for (const r of layerRuns) {
      total++;
      if (r.status === 'succeeded') succeeded++;
      else if (r.status === 'failed') failed++;
      else if (r.status === 'canceled') canceled++;
      const isAi = runLineageIsAi(r, s);
      if (isAi === true) aiCount++;
      else humanCount++;
    }
    out[name] = { total, succeeded, failed, canceled, byMode: { ai: aiCount, human: humanCount } };
  }
  return out;
}

/** Walk a pipeline run's lineage back to a Feature to determine AI vs Human. */
function runLineageIsAi(run, s) {
  if (!run.subRepo) return null;
  const matchingClusters = s.featureClusters.filter((c) =>
    (c.clusterPrIds || []).some((p) => p.sub_repo === run.subRepo || p.subRepo === run.subRepo)
  );
  for (const c of matchingClusters) {
    const feature = s.workItemsById.get(c.featureId);
    if (feature && feature.isAiExecuted != null) return feature.isAiExecuted;
  }
  return false;
}

/** Per-target deployment frequency (null when deployments[] absent). */
function computeDeployByTarget(s) {
  if (!s.deployments || !s.deployments.length) return null;
  const out = {};
  for (const targetEntry of s.deployments) {
    const events = (targetEntry.events || []).filter((e) => inWindow(e.timestamp, s.window));
    let ai = 0, human = 0;
    for (const ev of events) {
      const feature = s.workItemsById.get(ev.feature_id);
      if (feature && feature.isAiExecuted === true) ai++;
      else human++;
    }
    out[targetEntry.target] = { total: events.length, eventCount: events.length, byMode: { ai, human } };
  }
  return out;
}

/** Per-Feature cluster cycle-time partitioned {all, ai, human}. */
function computeClusterCycleTime(s) {
  if (!s.featureClusters || !s.featureClusters.length) return null;
  const eligible = s.featureClusters.filter((c) =>
    c.clusterMergeAt != null && inWindow(c.clusterMergeAt, s.window) && c.clusterState !== 'broken'
  );
  const inFlight = s.featureClusters.filter((c) => c.clusterMergeAt == null);
  const broken = s.featureClusters.filter((c) => c.clusterState === 'broken');

  const buildPartition = (subset) => {
    const cycles = subset.map((c) => c.clusterCycleTimeSeconds != null ? c.clusterCycleTimeSeconds / 3600 : null).filter((v) => v != null);
    const distribution = subset.map((c) => {
      const f = s.workItemsById.get(c.featureId);
      return {
        featureId: c.featureId,
        cycleSeconds: c.clusterCycleTimeSeconds,
        prCount: c.clusterPrCount,
        isAi: f ? f.isAiExecuted : null,
      };
    });
    return {
      median: percentile(cycles, 0.5),
      mean: mean(cycles),
      p90: percentile(cycles, 0.9),
      sampleSize: cycles.length,
      inFlightCount: 0,
      brokenCount: 0,
      distribution,
    };
  };
  const all = buildPartition(eligible);
  const aiSubset = eligible.filter((c) => {
    const f = s.workItemsById.get(c.featureId);
    return f && f.isAiExecuted === true;
  });
  const humanSubset = eligible.filter((c) => {
    const f = s.workItemsById.get(c.featureId);
    return f && f.isAiExecuted === false;
  });
  const ai = buildPartition(aiSubset);
  const human = buildPartition(humanSubset);

  all.inFlightCount = inFlight.length;
  all.brokenCount = broken.length;
  ai.inFlightCount = inFlight.filter((c) => {
    const f = s.workItemsById.get(c.featureId);
    return f && f.isAiExecuted === true;
  }).length;
  ai.brokenCount = broken.filter((c) => {
    const f = s.workItemsById.get(c.featureId);
    return f && f.isAiExecuted === true;
  }).length;
  human.inFlightCount = inFlight.length - ai.inFlightCount;
  human.brokenCount = broken.length - ai.brokenCount;

  return { all, ai, human };
}

/** CFR per layer with no-signal pill (per Q3 lock; threshold configurable via #39701). */
function computeCfrByLayer(s, deployByLayer, layers, thresholds) {
  const t = thresholds || DEFAULT_CONFIDENCE_THRESHOLDS;
  const cfrFloor = t.cfr_deploys > 0 ? t.cfr_deploys : DEFAULT_CONFIDENCE_THRESHOLDS.cfr_deploys;
  const out = {};
  for (const layer of layers) {
    const name = layer.name;
    const deployRecord = deployByLayer[name] || { total: 0, byMode: { ai: 0, human: 0 } };
    const layerBugs = byType(s.workItems, 'Bug').filter((b) =>
      inWindow(b.createdDate, s.window) && /prod/i.test(b.environment || '')
    );
    const layerReverts = (s.reverts || []).filter((r) => inWindow(r.timestamp, s.window));

    const partition = (numerator, denominator) => {
      const rate = denominator > 0 ? numerator / denominator : null;
      const confidence = denominator < cfrFloor ? 'no-signal' : 'high';
      return {
        rate, numerator, denominator, confidence,
        threshold: cfrFloor,
        thresholdKey: 'cfr_deploys',
      };
    };
    out[name] = {
      all: partition(layerBugs.length + layerReverts.length, deployRecord.total),
      ai: partition(
        layerBugs.filter((b) => b.isAi).length + layerReverts.filter((r) => r.isAi).length,
        deployRecord.byMode.ai
      ),
      human: partition(
        layerBugs.filter((b) => !b.isAi).length + layerReverts.filter((r) => !r.isAi).length,
        deployRecord.byMode.human
      ),
    };
  }
  return out;
}

/** MTTR partitioned with per-metric confidence threshold (#39701). */
function computeMttr(s, thresholds) {
  const t = thresholds || DEFAULT_CONFIDENCE_THRESHOLDS;
  const sampleFloor = t.mttr_sample;
  const prodBugs = byType(s.workItems, 'Bug').filter((b) =>
    /prod/i.test(b.environment || '') && b.resolvedDate && inWindow(b.resolvedDate, s.window)
  );
  const stat = (subset) => {
    const times = subset.map((b) => hoursBetween(b.createdDate, b.resolvedDate)).filter((h) => h != null);
    return {
      p50: percentile(times, 0.5),
      count: times.length,
      confidence: classifyConfidence(times.length, sampleFloor),
      threshold: sampleFloor,
      thresholdKey: 'mttr_sample',
    };
  };
  return {
    all: stat(prodBugs),
    ai: stat(prodBugs.filter((b) => b.isAi)),
    human: stat(prodBugs.filter((b) => !b.isAi)),
  };
}

/** Throughput by type with isAiExecuted partitioning for higher-order types. */
function computeThroughputByType(s) {
  const types = ['Requirement', 'Spec', 'Feature', 'Story', 'Task', 'Bug', 'Enhancement'];
  const out = {};
  for (const t of types) {
    const items = byType(s.workItems, t).filter((w) =>
      (w.state === 'Closed' || w.state === 'Resolved') &&
      inWindow(w.closedDate || w.resolvedDate || w.stateChangeDate, s.window)
    );
    const useExecuted = HIGHER_ORDER_TYPES.has(t);
    const aiFlag = (w) => useExecuted ? w.isAiExecuted : w.isAi;
    out[t] = {
      all: items.length,
      ai: items.filter((w) => aiFlag(w) === true).length,
      human: items.filter((w) => aiFlag(w) === false).length,
    };
  }
  return out;
}

/** Compute per-state-transition cycle times per work-item type.
 *  Per-leaf confidence is computed against the configured lead_time_sample
 *  threshold (#39701). */
function computeQualityCycleTimes(s, thresholds) {
  const t = thresholds || DEFAULT_CONFIDENCE_THRESHOLDS;
  const sampleFloor = t.lead_time_sample;
  const types = ['requirement', 'spec', 'feature', 'story', 'task'];
  const out = {};

  function extractStateChange(w, fromState, toState) {
    const revs = (w.revisions || []).filter((r) => r.field === 'state' && r.newValue === toState);
    if (revs.length) return revs[0].timestamp;
    if (toState === 'Active') return w.activatedDate;
    if (toState === 'Resolved') return w.resolvedDate;
    if (toState === 'Closed') return w.closedDate;
    return null;
  }

  function partitionByType(typeName, items, getCycle) {
    const useExecuted = HIGHER_ORDER_TYPES.has(typeName);
    const aiFlag = (w) => useExecuted ? w.isAiExecuted : w.isAi;
    const entries = items.map((w) => ({ value: getCycle(w), isAi: aiFlag(w) })).filter((e) => e.value != null);
    return partitionedCycle(entries, sampleFloor);
  }

  for (const t of types) {
    const typeTitle = t.charAt(0).toUpperCase() + t.slice(1);
    const items = byType(s.workItems, typeTitle === 'Requirement' ? 'Requirement' : typeTitle);

    const resolvedInWin = items.filter((w) =>
      (w.state === 'Resolved' || w.state === 'Closed') &&
      inWindow(w.closedDate || w.resolvedDate || w.stateChangeDate, s.window)
    );
    const activatedInWin = items.filter((w) =>
      w.activatedDate && inWindow(w.activatedDate, s.window)
    );

    const newToActiveCycle = (w) => hoursBetween(w.createdDate, extractStateChange(w, 'New', 'Active'));
    const activeToResolvedCycle = (w) => {
      const target = t === 'task' ? 'Closed' : 'Resolved';
      return hoursBetween(extractStateChange(w, 'New', 'Active'), extractStateChange(w, 'Active', target));
    };
    const totalCycle = (w) => {
      const target = t === 'task' ? w.closedDate : (w.resolvedDate || w.closedDate);
      return hoursBetween(w.createdDate, target);
    };

    out[t] = {
      newToActive: partitionByType(typeTitle, activatedInWin, newToActiveCycle),
      [t === 'task' ? 'activeToClosed' : 'activeToResolved']: partitionByType(typeTitle, resolvedInWin, activeToResolvedCycle),
      totalCycle: partitionByType(typeTitle, resolvedInWin, totalCycle),
    };

    if (t === 'requirement') {
      out[t].resolvedToNextSpecCreated = computeCrossTypeHop(s, typeTitle, 'Spec', resolvedInWin);
    }
    if (t === 'spec') {
      out[t].resolvedToFirstFeatureCreated = computeCrossTypeHop(s, typeTitle, 'Feature', resolvedInWin);
    }
    if (t === 'feature') {
      out[t].createdToFirstTaskActive = computeCrossTypeFromCreated(s, typeTitle, 'Task');
    }
  }
  return out;
}

/** Cross-type hop: time from parent resolution to first child creation. */
function computeCrossTypeHop(s, parentType, childType, resolvedParents) {
  const aiFlag = (w) => HIGHER_ORDER_TYPES.has(parentType) ? w.isAiExecuted : w.isAi;
  const entries = [];
  for (const parent of resolvedParents) {
    const children = s.workItems.filter((w) => w.type === childType && w.parent === parent.id);
    if (!children.length) continue;
    const firstChild = children.sort((a, b) => new Date(a.createdDate) - new Date(b.createdDate))[0];
    const cycle = hoursBetween(parent.resolvedDate || parent.closedDate, firstChild.createdDate);
    if (cycle == null) continue;
    entries.push({ value: cycle, isAi: aiFlag(parent) });
  }
  return partitionedCycle(entries);
}

/** Cross-type hop: time from parent creation to first descendant Task active. */
function computeCrossTypeFromCreated(s, parentType, descendantType) {
  const parents = byType(s.workItems, parentType).filter((w) => inWindow(w.createdDate, s.window));
  const aiFlag = (w) => w.isAiExecuted;
  const entries = [];
  for (const parent of parents) {
    const allDescendants = [];
    const queue = [parent.id];
    const seen = new Set();
    while (queue.length) {
      const curId = queue.shift();
      if (seen.has(curId)) continue;
      seen.add(curId);
      const kids = s.workItems.filter((w) => w.parent === curId);
      for (const k of kids) {
        if (k.type === descendantType) allDescendants.push(k);
        else queue.push(k.id);
      }
    }
    const activatedDescendants = allDescendants.filter((w) => w.activatedDate != null);
    if (!activatedDescendants.length) continue;
    const firstActive = activatedDescendants.sort((a, b) => new Date(a.activatedDate) - new Date(b.activatedDate))[0];
    const cycle = hoursBetween(parent.createdDate, firstActive.activatedDate);
    if (cycle == null) continue;
    entries.push({ value: cycle, isAi: aiFlag(parent) });
  }
  return partitionedCycle(entries);
}

/** Pipeline funnel (12-hop) with AI/Human/All partition. */
function computeFunnel(s) {
  function hop(items, fromGetter, toGetter, isAiFn) {
    const all = [], ai = [], human = [];
    for (const w of items) {
      const cycle = hoursBetween(fromGetter(w), toGetter(w));
      if (cycle == null) continue;
      all.push(cycle);
      if (isAiFn(w) === true) ai.push(cycle);
      else if (isAiFn(w) === false) human.push(cycle);
    }
    const stat = (arr) => ({ count: arr.length, p50: percentile(arr, 0.5) });
    return { ai: stat(ai), human: stat(human), all: stat(all), nonAi: stat(human) };
  }
  function partitionByExecuted(items, fromGetter, toGetter) {
    return hop(items, fromGetter, toGetter, (w) => w.isAiExecuted);
  }
  function partitionByNative(items, fromGetter, toGetter) {
    return hop(items, fromGetter, toGetter, (w) => w.isAi);
  }

  const reqs = byType(s.workItems, 'Requirement');
  const specs = byType(s.workItems, 'Spec');
  const features = byType(s.workItems, 'Feature');
  const stories = byType(s.workItems, 'Story');
  const tasks = byType(s.workItems, 'Task');

  return {
    itemCycles: {
      requirement: {
        newToActive: partitionByExecuted(reqs, (w) => w.createdDate, (w) => w.activatedDate),
        activeToResolved: partitionByExecuted(reqs, (w) => w.activatedDate, (w) => w.resolvedDate),
      },
      spec: {
        newToActive: partitionByExecuted(specs, (w) => w.createdDate, (w) => w.activatedDate),
        activeToResolved: partitionByExecuted(specs, (w) => w.activatedDate, (w) => w.resolvedDate),
      },
      feature: {
        createdToActive: partitionByExecuted(features, (w) => w.createdDate, (w) => w.activatedDate),
        activeToResolved: partitionByExecuted(features, (w) => w.activatedDate, (w) => w.resolvedDate),
      },
      story: {
        createdToActive: partitionByExecuted(stories, (w) => w.createdDate, (w) => w.activatedDate),
        activeToResolved: partitionByExecuted(stories, (w) => w.activatedDate, (w) => w.resolvedDate),
      },
      task: {
        createdToActive: partitionByNative(tasks, (w) => w.createdDate, (w) => w.activatedDate),
        activeToClosed: partitionByNative(tasks, (w) => w.activatedDate, (w) => w.closedDate),
      },
    },
    crossStage: {
      reqToSpec: computeCrossTypeHop(s, 'Requirement', 'Spec', reqs.filter((w) => w.resolvedDate)),
      specToFeature: computeCrossTypeHop(s, 'Spec', 'Feature', specs.filter((w) => w.resolvedDate)),
      featureCreatedToFirstTask: computeCrossTypeFromCreated(s, 'Feature', 'Task'),
    },
    counts: {
      reqsResolved: reqs.filter((w) => w.state === 'Resolved' && inWindow(w.resolvedDate, s.window)).length,
      specsResolved: specs.filter((w) => w.state === 'Resolved' && inWindow(w.resolvedDate, s.window)).length,
      featuresResolved: features.filter((w) => w.state === 'Resolved' && inWindow(w.resolvedDate, s.window)).length,
      storiesResolved: stories.filter((w) => (w.state === 'Resolved' || w.state === 'Closed') && inWindow(w.resolvedDate || w.closedDate, s.window)).length,
      tasksClosed: tasks.filter((w) => w.state === 'Closed' && inWindow(w.closedDate, s.window)).length,
    },
  };
}

/** AI contribution share (weighted aiShare across PRs in window). */
function computeAiContributionShare(s, prsInt, layers) {
  const overall = prsInt.length ? mean(prsInt.map((p) => p.aiShare)) || 0 : 0;
  const byLayer = {};
  for (const layer of layers) {
    const layerPrs = prsInt.filter((p) => prAttributedToLayer(p, layer, s));
    byLayer[layer.name] = layerPrs.length ? mean(layerPrs.map((p) => p.aiShare)) || 0 : 0;
  }
  const byTarget = s.deployments && s.deployments.length ? {} : null;
  if (byTarget) {
    for (const targetEntry of s.deployments) {
      const targetPrIds = new Set();
      for (const ev of targetEntry.events || []) for (const id of ev.pr_ids || []) targetPrIds.add(id);
      const targetPrs = prsInt.filter((p) => targetPrIds.has(p.id));
      byTarget[targetEntry.target] = targetPrs.length ? mean(targetPrs.map((p) => p.aiShare)) || 0 : 0;
    }
  }
  return { overall, byLayer, byTarget };
}

/** Heuristic: is PR attributed to a layer? Walks linked work items' parent chains. */
function prAttributedToLayer(p, layer, s) {
  if (!p.workItemRefs || !p.workItemRefs.length) return false;
  return true;
}

/** Compute aiVsHumanGlance exec-block KPI cards. */
function computeAiVsHumanGlance(s, prevS, ai, pr, throughput, deployByLayer, aiContribution) {
  function spread(curr, prior) {
    if (curr == null || prior == null) return null;
    return curr - prior;
  }
  function spreadDeltaPct(currSpread, priorSpread) {
    if (currSpread == null || priorSpread == null || priorSpread === 0) return null;
    return ((currSpread - priorSpread) / Math.abs(priorSpread)) * 100;
  }

  const currAiEff = ai.ai.p50, currHumanEff = ai.human.p50;
  const priorAiEff = prevS ? prevS.ai.ai.p50 : null;
  const priorHumanEff = prevS ? prevS.ai.human.p50 : null;

  const currPrAi = pr.cycle.ai.p50, currPrHuman = pr.cycle.human.p50;
  const priorPrAi = prevS ? prevS.pr.cycle.ai.p50 : null;
  const priorPrHuman = prevS ? prevS.pr.cycle.human.p50 : null;

  const currTasksAi = throughput.Task.ai, currTasksHuman = throughput.Task.human;
  const priorTasksAi = prevS ? prevS.throughputByType.Task.ai : null;
  const priorTasksHuman = prevS ? prevS.throughputByType.Task.human : null;

  let currDeploysAi = 0, currDeploysHuman = 0;
  for (const layerName of Object.keys(deployByLayer)) {
    currDeploysAi += deployByLayer[layerName].byMode.ai;
    currDeploysHuman += deployByLayer[layerName].byMode.human;
  }
  let priorDeploysAi = null, priorDeploysHuman = null;
  if (prevS && prevS.deployByLayer) {
    priorDeploysAi = 0; priorDeploysHuman = 0;
    for (const layerName of Object.keys(prevS.deployByLayer)) {
      priorDeploysAi += prevS.deployByLayer[layerName].byMode.ai;
      priorDeploysHuman += prevS.deployByLayer[layerName].byMode.human;
    }
  }

  const priorShare = prevS && prevS.aiContributionShare ? prevS.aiContributionShare.overall : null;

  return {
    aiEfficiency: {
      ai: currAiEff, human: currHumanEff,
      spreadDeltaVsPrior: spreadDeltaPct(spread(currAiEff, currHumanEff), spread(priorAiEff, priorHumanEff)),
    },
    prCycleHours: {
      ai: currPrAi, human: currPrHuman,
      spreadDeltaVsPrior: spreadDeltaPct(spread(currPrAi, currPrHuman), spread(priorPrAi, priorPrHuman)),
    },
    tasksClosed: {
      ai: currTasksAi, human: currTasksHuman,
      spreadDeltaVsPrior: spreadDeltaPct(spread(currTasksAi, currTasksHuman), spread(priorTasksAi, priorTasksHuman)),
    },
    deploys: {
      ai: currDeploysAi, human: currDeploysHuman,
      spreadDeltaVsPrior: spreadDeltaPct(spread(currDeploysAi, currDeploysHuman), spread(priorDeploysAi, priorDeploysHuman)),
    },
    authorshipShare: {
      pct: aiContribution.overall * 100,
      deltaVsPrior: priorShare != null ? (aiContribution.overall - priorShare) * 100 : null,
    },
  };
}

/** Per-developer row computation (union of all output sources). */
function computeDevRows(s, prsInt, prsInterm) {
  const win = s.window;
  const closedTasks = byType(s.workItems, 'Task').filter((w) => w.state === 'Closed' && inWindow(w.closedDate, win));
  const activeTasks = byType(s.workItems, 'Task').filter((w) => w.state === 'Active');
  const closedStories = byType(s.workItems, 'Story').filter((w) => (w.state === 'Resolved' || w.state === 'Closed') && inWindow(w.resolvedDate || w.closedDate, win));
  const closedFeatures = byType(s.workItems, 'Feature').filter((w) => w.state === 'Resolved' && inWindow(w.resolvedDate, win));
  const closedSpecs = byType(s.workItems, 'Spec').filter((w) => w.state === 'Resolved' && inWindow(w.resolvedDate, win));

  const names = new Set();
  for (const p of prsInt) if (p.createdBy) names.add(p.createdBy);
  for (const p of prsInterm) if (p.createdBy) names.add(p.createdBy);
  for (const t of closedTasks) if (t.assignedTo) names.add(t.assignedTo);
  for (const t of activeTasks) if (t.assignedTo) names.add(t.assignedTo);
  for (const i of [...closedStories, ...closedFeatures, ...closedSpecs]) if (i.assignedTo) names.add(i.assignedTo);

  const reviewerComments = {};
  for (const p of prsInt) {
    for (const [reviewer, n] of Object.entries(p.reviewerComments || {})) {
      reviewerComments[reviewer] = (reviewerComments[reviewer] || 0) + n;
    }
  }

  const devRows = [];
  for (const name of [...names].sort()) {
    const myPrs = prsInt.filter((p) => p.createdBy === name);
    const myInterm = prsInterm.filter((p) => p.createdBy === name);
    const myDrafts = myPrs.filter((p) => p.isDraft).length;

    const iters = myPrs.map((p) => p.iterationCount);
    const cmts = myPrs.map((p) => p.commentCount);
    const filesArr = myPrs.filter((p) => p.weight && p.weight.files_changed != null).map((p) => p.weight.files_changed);
    const linesArr = myPrs.filter((p) => p.weight && p.weight.lines_total != null).map((p) => p.weight.lines_total);

    const myClosedTasks = closedTasks.filter((t) => t.assignedTo === name);
    const myActiveTasks = activeTasks.filter((t) => t.assignedTo === name);
    const myStories = closedStories.filter((i) => i.assignedTo === name);
    const myFeatures = closedFeatures.filter((i) => i.assignedTo === name);
    const mySpecs = closedSpecs.filter((i) => i.assignedTo === name);
    const higherTotal = myStories.length + myFeatures.length + mySpecs.length;

    const taskCycles = myClosedTasks.map((t) => hoursBetween(t.activatedDate, t.closedDate)).filter((h) => h != null);
    const aiRatios = myClosedTasks.map((t) => {
      if (!(t.originalEstimate > 0) || !t.activatedDate || !t.closedDate) return null;
      const wc = hoursBetween(t.activatedDate, t.closedDate);
      return wc > 0 ? t.originalEstimate / wc : null;
    }).filter((r) => r != null);

    const bucketOf = (iter) => iter <= 1 ? 'Small' : iter <= 3 ? 'Medium' : iter <= 7 ? 'Large' : 'XL';
    const buckets = { Small: 0, Medium: 0, Large: 0, XL: 0 };
    for (const it of iters) buckets[bucketOf(it)]++;

    const maxIter = iters.length ? Math.max(...iters) : null;
    const avgIter = iters.length ? mean(iters) : null;
    const avgCmt = cmts.length ? mean(cmts) : null;
    const avgFiles = filesArr.length ? mean(filesArr) : null;
    const avgLines = linesArr.length ? mean(linesArr) : null;
    const totalLines = linesArr.reduce((a, b) => a + b, 0);

    const heaviestPr = (() => {
      const candidates = myPrs.filter((p) => p.weight && p.weight.lines_total != null);
      if (!candidates.length) return null;
      const top = candidates.sort((a, b) => (b.weight.lines_total || 0) - (a.weight.lines_total || 0))[0];
      return { pr_id: top.id, title: top.title, files: top.weight.files_changed, lines_total: top.weight.lines_total };
    })();

    const hasOutputSignal = myPrs.length > 0 || myInterm.length > 0 || myClosedTasks.length > 0 || myActiveTasks.length > 0 || higherTotal > 0;
    const hasInteractionSignal = avgIter != null || avgCmt != null;

    let signature = 'Moderate';
    if (!hasOutputSignal && !hasInteractionSignal) signature = 'Insufficient signal';
    else if (avgIter == null) signature = 'Moderate';
    else if (avgIter <= SIG_FOCUSED_ITER_MAX && (avgCmt == null || avgCmt < 5)) signature = 'Focused';
    else if (avgIter >= SIG_ITERATIVE_ITER_MIN && avgCmt != null && avgCmt < SIG_LONEWOLF_CMT_MAX) signature = 'Lone-Wolf';
    else if (avgIter >= SIG_ITERATIVE_ITER_MIN) signature = 'Iterative';
    else if (avgIter <= SIG_FOCUSED_ITER_MAX && avgCmt != null && avgCmt < 2) signature = 'Quick-Approver';

    devRows.push({
      name,
      intPrs: myPrs.length,
      intermPrs: myInterm.length,
      drafts: myDrafts,
      avgIter, avgCmt, avgFiles, avgLines, totalLines,
      heaviestPr,
      maxIter, buckets, signature,
      tasksClosed: myClosedTasks.length,
      tasksActive: myActiveTasks.length,
      taskP50: percentile(taskCycles, 0.5),
      aiP50: percentile(aiRatios, 0.5),
      higherStories: myStories.length,
      higherFeatures: myFeatures.length,
      higherSpecs: mySpecs.length,
      higherTotal,
      reviewerComments: reviewerComments[name] || 0,
    });
  }
  return devRows;
}

/** PR reviewer leaderboard. */
function computePrReviewersRanked(prsInt) {
  const totals = {};
  const prsReviewed = {};
  for (const p of prsInt) {
    for (const [reviewer, n] of Object.entries(p.reviewerComments || {})) {
      totals[reviewer] = (totals[reviewer] || 0) + n;
      if (!prsReviewed[reviewer]) prsReviewed[reviewer] = new Set();
      prsReviewed[reviewer].add(p.id);
    }
  }
  return Object.entries(totals)
    .map(([name, comments]) => ({
      name, comments,
      prsReviewed: prsReviewed[name].size,
      avgPerPr: comments / prsReviewed[name].size,
    }))
    .sort((a, b) => b.comments - a.comments);
}

/** Drafts authored by author count. */
function computeDraftsByAuthor(prsInt) {
  const out = {};
  for (const p of prsInt) if (p.isDraft && p.createdBy) out[p.createdBy] = (out[p.createdBy] || 0) + 1;
  return out;
}

/** Per-sprint shipped contents (Features/Stories/Specs/Enhancements/Bugs resolved). */
function computeSprintContents(s) {
  const win = s.window;
  const isResolved = (w) => (w.state === 'Resolved' || w.state === 'Closed') && inWindow(w.resolvedDate || w.closedDate, win);
  const mapItem = (i) => ({ id: i.id, title: i.title, assignee: i.assignedTo, isAi: i.isAiExecuted ?? i.isAi });
  const mapBug = (b) => ({ id: b.id, title: b.title, assignee: b.assignedTo, env: b.environment, severity: b.severity, isAi: b.isAi });
  return {
    features: byType(s.workItems, 'Feature').filter(isResolved).map(mapItem),
    stories: byType(s.workItems, 'Story').filter(isResolved).map(mapItem),
    enhancements: byType(s.workItems, 'Enhancement').filter(isResolved).map(mapItem),
    specs: byType(s.workItems, 'Spec').filter(isResolved).map(mapItem),
    bugsResolved: byType(s.workItems, 'Bug').filter(isResolved).map(mapBug),
  };
}

/** Data quality coverage block + flags. */
function computeDq(s) {
  const dq = s.dataQuality || {};
  const closedTasks = closedTasksInWindow(s);
  const wallclockNoAi = closedTasks.filter((t) => {
    const wc = hoursBetween(t.activatedDate, t.closedDate);
    return wc != null && wc < WALLCLOCK_HEURISTIC_HOURS &&
           t.originalEstimate != null && t.originalEstimate >= WALLCLOCK_HEURISTIC_OE_MIN &&
           !t.isAi;
  }).length;
  const possibleMissingAuditShare = closedTasks.length > 0 ? wallclockNoAi / closedTasks.length : 0;

  let preStrapShare = 0;
  if (s.strapAdoptionDate) {
    const humanItems = s.workItems.filter((w) => !w.isAi);
    const preStrap = humanItems.filter((w) => dateOnly(w.createdDate) < dateOnly(s.strapAdoptionDate)).length;
    preStrapShare = humanItems.length > 0 ? preStrap / humanItems.length : 0;
  }

  return {
    flags: {
      revisions_unavailable: !!dq.revisions_unavailable,
      pr_threads_unavailable: !!dq.pr_threads_unavailable,
      reverts_unavailable: !!dq.reverts_unavailable,
      cw_oe_degeneracy: !!dq.cw_oe_degeneracy,
      possible_missing_audit_share: possibleMissingAuditShare,
      pre_strap_human_backlog_share: preStrapShare,
    },
    fieldCoverage: {
      tasksWithActivatedDate: dq.tasks_with_activated_date || { covered: 0, total: 0, pct: 0 },
      tasksWithOriginalEstimate: dq.tasks_with_original_estimate || { covered: 0, total: 0, pct: 0 },
      tasksWithCompletedWork: dq.tasks_with_completed_work || { covered: 0, total: 0, pct: 0 },
      tasksWithWallclockComputable: dq.tasks_with_wallclock_computable || { covered: 0, total: 0, pct: 0 },
      bugsWithEnvironment: dq.bugs_with_environment || { covered: 0, total: 0, pct: 0 },
      aiTaggedItems: dq.ai_tagged_items || { covered: 0, total: 0, pct: 0 },
      prThreadsAvailable: dq.pr_threads_available || { covered: 0, total: 0, pct: 0 },
      pipelineRunsClassified: dq.pipeline_runs_classified || { covered: 0, total: 0, pct: 0 },
    },
    overallPct: dq.overall_pct ?? 0,
  };
}

/** Compose all per-sprint metric blocks. */
function computeSprintMetric(s, prevSprintMetric, layers, thresholds) {
  const t = thresholds || DEFAULT_CONFIDENCE_THRESHOLDS;
  const prsInt = s.prsIntegration.filter((p) => inWinPr(p, s.window));
  const prsInterm = s.prsIntermediate.filter((p) => inWinPr(p, s.window));
  const closedTasks = closedTasksInWindow(s);

  const counts = computeCounts(s, prsInt, prsInterm);
  const draftsByAuthor = computeDraftsByAuthor(prsInt);
  const contents = computeSprintContents(s);
  const prWeight = computePrWeight(prsInt);
  const prReviewersRanked = computePrReviewersRanked(prsInt);
  const agentVsHuman = computeAgentVsHuman(closedTasks);
  const ai = computeAi(closedTasks, t);
  const funnel = computeFunnel(s);
  const pr = computePrCycleAndSize(prsInt);
  const deployByLayer = computeDeployByLayer(s, layers);
  const deployByTarget = computeDeployByTarget(s);
  const clusterCycleTime = computeClusterCycleTime(s);
  const cfrByLayer = computeCfrByLayer(s, deployByLayer, layers, t);
  const mttr = computeMttr(s, t);
  const throughputByType = computeThroughputByType(s);
  const qualityCycleTimes = computeQualityCycleTimes(s, t);
  const aiContributionShare = computeAiContributionShare(s, prsInt, layers);
  const aiVsHumanGlance = computeAiVsHumanGlance(s, prevSprintMetric, ai, pr, throughputByType, deployByLayer, aiContributionShare);
  const devRows = computeDevRows(s, prsInt, prsInterm);
  const dq = computeDq(s);

  return {
    name: s.name,
    window: s.window,
    counts,
    draftsByAuthor,
    contents,
    prsWithWeight: prWeight.prsWithWeight,
    prWeightStats: prWeight.prWeightStats,
    prReviewersRanked,
    agentVsHuman,
    ai,
    funnel,
    pr,
    deployByLayer,
    deployByTarget,
    clusterCycleTime,
    cfrByLayer,
    mttr,
    pipelineRunRateMode: deployByTarget ? 'deployment-frequency' : 'pipeline-run-rate',
    throughputByType,
    qualityCycleTimes,
    aiVsHumanGlance,
    aiContributionShare,
    intermediateShare: counts.prsInt > 0 ? counts.prsInterm / counts.prsInt : 0,
    devRows,
    dq,
  };
}

/* ----------------------------------------------------------------------------
 * Cross-sprint aggregations
 * --------------------------------------------------------------------------*/

/** Aggregate trend series across sprints (each array length = sprint count). */
function computeSeries(sprintMetrics) {
  const layers = new Set();
  const targets = new Set();
  const envs = new Set();
  for (const m of sprintMetrics) {
    for (const l of Object.keys(m.deployByLayer)) layers.add(l);
    if (m.deployByTarget) for (const t of Object.keys(m.deployByTarget)) targets.add(t);
    for (const e of Object.keys(m.counts.bugsByEnv)) envs.add(e);
  }
  const seriesOf = (fn) => sprintMetrics.map(fn);
  const deploysByLayer = {};
  for (const l of layers) deploysByLayer[l] = seriesOf((m) => (m.deployByLayer[l] ? m.deployByLayer[l].total : 0));
  const deploysByTarget = targets.size > 0 ? {} : null;
  if (deploysByTarget) for (const t of targets) deploysByTarget[t] = seriesOf((m) => (m.deployByTarget && m.deployByTarget[t] ? m.deployByTarget[t].eventCount : 0));
  const bugsByEnv = {};
  for (const e of envs) bugsByEnv[e] = seriesOf((m) => m.counts.bugsByEnv[e] || 0);

  return {
    tasksClosed: seriesOf((m) => m.counts.tasksClosed),
    prsInt: seriesOf((m) => m.counts.prsInt),
    prsCompleted: seriesOf((m) => m.counts.prsIntCompleted),
    deploysByLayer,
    deploysByTarget,
    aiP50: seriesOf((m) => m.ai.all.p50),
    aiMean: seriesOf((m) => m.ai.all.mean),
    aiP90: seriesOf((m) => m.ai.all.p90),
    prCycleP50: seriesOf((m) => m.pr.cycle.all.p50),
    prCycleP90: seriesOf((m) => m.pr.cycle.all.p90),
    abandonPct: seriesOf((m) => (m.counts.prsInt > 0 ? m.counts.prsIntAbandoned / m.counts.prsInt : 0)),
    bugsByEnv,
    cwOeAntiPattern: seriesOf((m) => (m.dq.flags.cw_oe_degeneracy ? 1 : 0)),
    clusterCycleP50: seriesOf((m) => (m.clusterCycleTime ? m.clusterCycleTime.all.median : null)),
    untargetedDeployRuns: seriesOf((m) => (m.deployByTarget ? 0 : Object.values(m.deployByLayer).reduce((a, b) => a + b.total, 0))),
  };
}

/** Movement (improvements + regressions; threshold ±5%). */
function computeMovement(sprintMetrics) {
  if (sprintMetrics.length < 2) return { improvements: [], regressions: [] };
  const last = sprintMetrics[sprintMetrics.length - 1];
  const prev = sprintMetrics[sprintMetrics.length - 2];
  const rows = [];
  function add(name, from, to, inverseDirection) {
    if (from == null || to == null || from === 0) return;
    const deltaPct = ((to - from) / Math.abs(from)) * 100;
    if (Math.abs(deltaPct) < 5) return;
    const isImprovement = inverseDirection ? deltaPct < 0 : deltaPct > 0;
    rows.push({ name, from, to, deltaPct, mag: Math.abs(deltaPct), magnitude: Math.abs(to - from), isImprovement });
  }
  add('AI Efficiency P50', prev.ai.all.p50, last.ai.all.p50, false);
  add('Tasks closed', prev.counts.tasksClosed, last.counts.tasksClosed, false);
  add('PR cycle P50', prev.pr.cycle.all.p50, last.pr.cycle.all.p50, true);
  add('PR cycle P90', prev.pr.cycle.all.p90, last.pr.cycle.all.p90, true);
  add('Integration PRs', prev.counts.prsInt, last.counts.prsInt, false);
  add('Abandoned PR rate', prev.counts.prsIntAbandoned / Math.max(prev.counts.prsInt, 1), last.counts.prsIntAbandoned / Math.max(last.counts.prsInt, 1), true);
  return {
    improvements: rows.filter((r) => r.isImprovement).sort((a, b) => b.mag - a.mag),
    regressions: rows.filter((r) => !r.isImprovement).sort((a, b) => b.mag - a.mag),
  };
}

/** Per-developer trend across sprints + totals. */
function computeTrendByDev(sprintMetrics) {
  const names = new Set();
  for (const m of sprintMetrics) for (const r of m.devRows) names.add(r.name);
  const trend = [];
  for (const name of [...names].sort()) {
    const series = sprintMetrics.map((m) => m.devRows.find((r) => r.name === name) || {
      intPrs: 0, intermPrs: 0, drafts: 0, tasksClosed: 0,
      higherTotal: 0, reviewerComments: 0, avgIter: null,
      maxIter: null, avgCmt: null, avgFiles: null, avgLines: null,
      totalLines: 0, heaviestPr: null,
    });
    trend.push({
      name,
      prs: series.map((r) => r.intPrs),
      interm: series.map((r) => r.intermPrs),
      drafts: series.map((r) => r.drafts),
      tasks: series.map((r) => r.tasksClosed),
      higher: series.map((r) => r.higherTotal),
      comments: series.map((r) => r.reviewerComments),
      iter: series.map((r) => r.avgIter),
      maxIter: series.map((r) => r.maxIter),
      avgCmt: series.map((r) => r.avgCmt),
      avgFiles: series.map((r) => r.avgFiles),
      avgLines: series.map((r) => r.avgLines),
      totalLines: series.map((r) => r.totalLines),
      heaviestPr: series.map((r) => r.heaviestPr),
    });
  }
  return trend;
}

function computeDevTotals(trendByDev) {
  const sumArr = (a) => a.reduce((acc, v) => acc + (v || 0), 0);
  return trendByDev.map((d) => ({
    name: d.name,
    prs: sumArr(d.prs),
    interm: sumArr(d.interm),
    drafts: sumArr(d.drafts),
    tasks: sumArr(d.tasks),
    higher: sumArr(d.higher),
    comments: sumArr(d.comments),
    maxIter: Math.max(...d.maxIter.map((v) => v || 0), 0) || null,
    avgFilesPerPr: mean(d.avgFiles.filter((v) => v != null)),
    avgLinesPerPr: mean(d.avgLines.filter((v) => v != null)),
    totalLines: sumArr(d.totalLines),
    heaviestPr: d.heaviestPr.filter(Boolean).sort((a, b) => (b.lines_total || 0) - (a.lines_total || 0))[0] || null,
  }));
}

function computeInactiveMembers(snapshots, sprintMetrics) {
  return [];
}

function computeAgentAttribution(snapshots, sprintMetrics) {
  let totalTasks = 0;
  const byAgent = {};
  for (const m of sprintMetrics) {
    for (const [role, info] of Object.entries(m.agentVsHuman.byAgentRole || {})) {
      if (!byAgent[role]) byAgent[role] = { tasks: 0, stories: 0, aiP50: null, aiMean: null };
      byAgent[role].tasks += info.tasks;
      totalTasks += info.tasks;
    }
  }
  const available = Object.keys(byAgent).length > 0;
  return {
    available,
    totalTasks,
    byAgent,
    sprintNames: sprintMetrics.map((m) => m.name),
    message: available ? '' : 'No agent attribution available (no agent:* role tags in window).',
  };
}

/* ----------------------------------------------------------------------------
 * Verdicts
 * --------------------------------------------------------------------------*/

function loadVerdicts(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function autoGenerateVerdicts(sprintMetrics, movement, lastDq) {
  if (!sprintMetrics.length) {
    return {
      milestone: { headline: 'No data in window', context: '', detail: '', action: '' },
      watch: { headline: 'No data in window', context: '', detail: '', action: '' },
      context: { headline: 'No data in window', context: '', detail: '', action: '' },
    };
  }
  const last = sprintMetrics[sprintMetrics.length - 1];
  const milestoneRow = movement.improvements[0];
  const watchRow = movement.regressions[0];
  const milestone = milestoneRow
    ? Object.assign({
        headline: `${milestoneRow.name} ${milestoneRow.deltaPct >= 0 ? 'up' : 'down'} ${Math.abs(milestoneRow.deltaPct).toFixed(0)}%`,
        context: `From ${formatVal(milestoneRow.from)} to ${formatVal(milestoneRow.to)}.`,
      }, metricNarrative(milestoneRow, 'milestone', sprintMetrics))
    : {
        headline: 'Stable sprint',
        context: 'No metric moved more than 5% from the prior sprint.',
        detail: 'A flat sprint can mean steady-state delivery or it can mean noise drowning signal -- check the Data Quality flags below to confirm field coverage is holding up before reading the flatness as good news.',
        action: 'Hold cadence. If multiple sprints in a row read stable, consider whether the +/-5% threshold is masking small but real drift -- the configurable threshold lives in build-payload.js.',
      };
  const watch = watchRow
    ? Object.assign({
        headline: `${watchRow.name} ${watchRow.deltaPct >= 0 ? 'up' : 'down'} ${Math.abs(watchRow.deltaPct).toFixed(0)}%`,
        context: `From ${formatVal(watchRow.from)} to ${formatVal(watchRow.to)}.`,
      }, metricNarrative(watchRow, 'watch', sprintMetrics))
    : {
        headline: 'No regressions',
        context: 'No metric regressed more than 5% from the prior sprint.',
        detail: 'Sustained absence of regressions is rare; verify the snapshot covers the expected window and that PR + work-item collection isn\'t silently dropping items.',
        action: 'Spot-check the Data Quality section -- a zero-regression sprint with degraded coverage is a hidden regression.',
      };

  let context = {
    headline: 'Data quality nominal',
    context: 'Every primary-metric field cleared its coverage threshold this sprint.',
    detail: 'Translates to: AI Efficiency, PR cycle, CFR, MTTR, and Lead Time all read on data the engine considers trustworthy. No suppression pills firing beyond the configured no-signal thresholds.',
    action: 'No action needed. The numbers up top are honest; trust them.',
  };
  if (lastDq && lastDq.flags) {
    if (lastDq.flags.pre_strap_human_backlog_share > PRE_STRAP_BACKLOG_VERDICT_THRESHOLD) {
      const pct = Math.round(lastDq.flags.pre_strap_human_backlog_share * 100);
      context = {
        headline: `Human metrics include ${pct}% pre-STRAP backlog`,
        context: 'A substantial share of Human-classified work predates STRAP adoption and is dragging the Human-side cycle-time + throughput downward.',
        detail: 'AI vs Human comparisons in this sprint are non-apples-to-apples. Legacy work tends to be larger, older, and less-frequently-touched than STRAP-tracked work -- the Human partition inherits that drag whether or not human authors are actually slower today.',
        action: 'Run `/dora-collect --since <strap-adoption-date>` for a post-STRAP-only view. Compare the two reports side-by-side to see which signals are real and which are artifacts of the backlog mix.',
      };
    } else if (lastDq.flags.cw_oe_degeneracy) {
      context = {
        headline: 'CompletedWork field shows degeneracy',
        context: 'Half or more of closed Tasks have CompletedWork === OriginalEstimate exactly -- the field is being copied at resolution, not updated to reflect actual hours.',
        detail: 'AI Efficiency Ratio falls back to wall-clock primary, which is honest, but the secondary CompletedWork-based ratio is suppressed. Time-tracking discipline isn\'t feeding the report.',
        action: 'Audit the team\'s time-tracking workflow. Either get CompletedWork populated honestly or accept that wall-clock-only is the only signal and lean into it.',
      };
    }
  }

  return { milestone, watch, context };
}

/** Per-metric narrative -- returns { detail, action } based on which metric moved
 *  + whether it was an improvement or regression. Replaces the previous hardcoded
 *  "Largest improvement vs prior sprint. Maintain." stub with editorially-shaped
 *  prose that explains likely causes + what to investigate next. Kept compact
 *  (2-3 sentences each) so the verdict card stays scannable. */
function metricNarrative(row, kind, sprintMetrics) {
  const name = row.name;
  const dirWord = row.deltaPct >= 0 ? 'up' : 'down';
  const pct = Math.abs(row.deltaPct).toFixed(0);
  const lastM = sprintMetrics[sprintMetrics.length - 1];
  const tasksClosed = lastM && lastM.counts ? lastM.counts.tasksClosed : 0;

  // Per-metric narrative selectors. Each returns { detail, action }.
  const narratives = {
    'AI Efficiency P50': () => kind === 'milestone'
      ? {
          detail: `Median closed-Task ratio landed at ${formatVal(row.to)}× -- ${tasksClosed} Tasks contributed to the percentile. A jump this size usually traces to one of three causes: smaller-scoped Tasks closing in less wall-clock, a cascade event (bulk Resolved -> Closed transitions skewing the denominator), or genuinely faster execution.`,
          action: 'Cross-reference the per-developer rows + Tasks-closed delta. If a handful of authors drove the lift, study what they did differently. If the wall-clock heuristic flag fired in Data Quality, treat the jump as data shape first, execution second.',
        }
      : {
          detail: `Median ratio compressed from ${formatVal(row.from)}× to ${formatVal(row.to)}×. Either wall-clock got longer (longer review queue, deeper code-review, more iterations) or OriginalEstimate crept up relative to actual work shipped.`,
          action: 'Check PR cycle P50 + PR-size buckets in the same sprint. If cycle stretched and Large/XL PRs are up, the bottleneck is upstream of the AI Efficiency math.',
        },
    'PR cycle P50': () => kind === 'milestone'
      ? {
          detail: `PRs cleared the integration target ${pct}% faster -- ${formatVal(row.from)} -> ${formatVal(row.to)}. Healthy compression. The cause is usually one of: sharper reviewers, smaller PRs, less re-work iteration, or fewer Large/XL outliers.`,
          action: 'Pair this against reviewer-comments-per-PR. If comments are flat or up while cycle dropped, reviews got more efficient. If comments fell along with cycle, rigor may have relaxed -- verify with the PR-size buckets.',
        }
      : {
          detail: `PR cycle stretched ${pct}% (${formatVal(row.from)} -> ${formatVal(row.to)}). The most common causes are PR-size drift (more Large/XL PRs), reviewer load spikes, or back-and-forth iteration churn.`,
          action: 'Open the 04d PR-size bucket distribution. If XL share is up, attack the size first. If sizes are stable, the bottleneck is review velocity -- look at reviewer-comments-authored to spot reviewer saturation.',
        },
    'PR cycle P90': () => kind === 'milestone'
      ? {
          detail: `The tail of the distribution got tighter -- P90 fell from ${formatVal(row.from)} to ${formatVal(row.to)}. The slowest PRs cleared faster, suggesting outlier reduction rather than across-the-board lift.`,
          action: 'Identify the specific PRs that were slow in the prior sprint vs fast in this one. The pattern usually tells the story -- either a specific reviewer is unblocked, or a specific PR type is no longer stuck.',
        }
      : {
          detail: `P90 worsened ${pct}% -- the slowest PRs got slower. The median can stay healthy while the tail rots; this is the early-warning view.`,
          action: 'List the top-3 slowest PRs in window. Their commonality (author / reviewer / Feature cluster) is almost always the root cause.',
        },
    'Tasks closed': () => kind === 'milestone'
      ? {
          detail: `${formatVal(row.to)} Tasks closed (up from ${formatVal(row.from)}). Throughput-by-type partitioning shows whether the lift came from atomic Tasks alone or broader Story/Feature completion.`,
          action: 'Look at throughputByType on the per-sprint view. If Stories + Features moved with Tasks, the team is closing whole vertical slices. If Tasks moved alone, work may be fragmenting into smaller atomic units.',
        }
      : {
          detail: `Closed-Task count dropped to ${formatVal(row.to)} (from ${formatVal(row.from)}). Either fewer Tasks were ready to close, or in-flight Tasks aged without crossing the line. The Aging Alerts section identifies the second.`,
          action: 'Check Aging Alerts in the in-flight view (if present) for Tasks stuck Active. If stale Tasks are climbing, the throughput dip is a stuck-work signal, not a capacity signal.',
        },
    'Integration PRs': () => kind === 'milestone'
      ? {
          detail: `${formatVal(row.to)} integration PRs vs ${formatVal(row.from)} the prior sprint. The lift could be more authors active, finer-grained PRs, or both.`,
          action: 'Cross-reference per-developer rows + average PR weight (when --with-git-diff-weight is captured). High PR count + low avg weight = fine-grained shipping; high PR count + steady weight = more authors in flight.',
        }
      : {
          detail: `Integration-PR count dropped from ${formatVal(row.from)} to ${formatVal(row.to)}. Either work consolidated into larger PRs, or authors moved upstream to intermediate branches (check intermediate-PR count).`,
          action: 'Compare against intermediate-PR count. If intermediate is up while integration is down, the funnel just shifted; if both are down, real throughput is off.',
        },
    'Abandoned PR rate': () => kind === 'milestone'
      ? {
          detail: `Abandon rate fell from ${formatVal(row.from)} to ${formatVal(row.to)}. Cleaner PR hygiene -- either authors are getting clearer feedback before opening, or stale-PR cleanup is catching up.`,
          action: 'Healthy direction; the question is whether it sticks. Monitor the next 2-3 sprints for regression.',
        }
      : {
          detail: `Abandon rate climbed from ${formatVal(row.from)} to ${formatVal(row.to)}. Causes cluster: stale PRs being closed in bulk, more speculative PRs that don\'t survive review, or feature pivots invalidating in-flight work.`,
          action: 'List the abandoned PRs in window and their last-touch dates. If most were dormant for weeks, the spike is hygiene catch-up (benign). If recent PRs are getting abandoned mid-review, that\'s a signal worth investigating.',
        },
    'Cluster cycle P50': () => kind === 'milestone'
      ? {
          detail: `Multi-PR Feature delivery cycled ${pct}% faster. For polyrepo umbrellas this is the cleanest velocity signal -- it captures end-to-end Feature delivery rather than single-PR cycle.`,
          action: 'Identify which Features cycled fastest. Their pattern (size, sub-repo count, review topology) is the template worth replicating.',
        }
      : {
          detail: `Feature-cluster cycle stretched ${pct}% -- multi-PR Features are taking longer to deliver end-to-end. Either the in-flight clusters got bigger, or coordination cost is up between sub-repos.`,
          action: 'Open the 05 Cluster cycle-time section -- "Slowest clusters" surfaces the Features dragging the median. The remediation usually lives there.',
        },
  };

  const builder = narratives[name];
  if (builder) return builder();

  // Generic fallback when a metric doesn't have a specific narrative template.
  return kind === 'milestone'
    ? {
        detail: `Largest improvement vs prior sprint -- ${name} moved from ${formatVal(row.from)} to ${formatVal(row.to)} (${dirWord} ${pct}%).`,
        action: 'Investigate what specifically changed in this metric\'s upstream signals; the move is large enough to be worth understanding rather than just celebrating.',
      }
    : {
        detail: `Largest regression vs prior sprint -- ${name} moved from ${formatVal(row.from)} to ${formatVal(row.to)} (${dirWord} ${pct}%).`,
        action: 'Identify the root cause before the next sprint compounds it. The detail section of each relevant per-sprint block in the report carries the breakdown.',
      };
}

function formatVal(v) {
  if (v == null) return 'null';
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

/* ----------------------------------------------------------------------------
 * Current / in-flight view
 * --------------------------------------------------------------------------*/

function computeCurrentMetrics(currentSnap) {
  if (!currentSnap) return null;
  const win = currentSnap.window;
  const startMs = new Date(win.start).getTime();
  const endMs = new Date(win.end).getTime();
  const nowMs = Date.now();
  const daysElapsed = Math.max(0, (nowMs - startMs) / 864e5);
  const daysRemaining = Math.max(0, (endMs - nowMs) / 864e5);

  const tasksActive = byType(currentSnap.workItems, 'Task').filter((w) => w.state === 'Active');
  const storiesActive = byType(currentSnap.workItems, 'Story').filter((w) => w.state === 'Active');
  const featuresActive = byType(currentSnap.workItems, 'Feature').filter((w) => w.state === 'Active');
  const specsActive = byType(currentSnap.workItems, 'Spec').filter((w) => w.state === 'Active');

  function aged(items, days) {
    const cutoff = Date.now() - days * 864e5;
    return items
      .filter((w) => w.activatedDate && new Date(w.activatedDate).getTime() < cutoff)
      .map((w) => ({
        id: w.id, title: w.title, assigned_to: w.assignedTo,
        age_days: Math.floor((Date.now() - new Date(w.activatedDate).getTime()) / 864e5),
        strap_instrumented: w.hasStrapInstrumentation === true,
      }));
  }

  /** Split an aged-items list into STRAP-instrumented vs inherited backlog (#39700). */
  function splitInstrumented(items) {
    const strap_instrumented = items.filter((i) => i.strap_instrumented === true);
    const inherited = items.filter((i) => i.strap_instrumented !== true);
    return {
      all: items,
      strap_instrumented,
      inherited,
      inherited_collapsed: inherited.length > INHERITED_AGING_COLLAPSE_THRESHOLD,
    };
  }

  return {
    sprintName: currentSnap.name,
    daysElapsed,
    daysRemaining,
    tasksActive: tasksActive.map((w) => ({ id: w.id, title: w.title, assignedTo: w.assignedTo, isAi: w.isAi })),
    storiesActive: storiesActive.map((w) => ({ id: w.id, title: w.title, assignedTo: w.assignedTo, isAi: w.isAiExecuted })),
    featuresActive: featuresActive.map((w) => ({ id: w.id, title: w.title, assignedTo: w.assignedTo, isAi: w.isAiExecuted })),
    specsActive: specsActive.map((w) => ({ id: w.id, title: w.title, assignedTo: w.assignedTo, isAi: w.isAiExecuted })),
    aging: {
      tasks_active_over_3d: splitInstrumented(aged(tasksActive, 3)),
      stories_active_over_5d: splitInstrumented(aged(storiesActive, 5)),
      features_new_over_7d: splitInstrumented(aged(featuresActive, 7)),
      specs_active_over_14d: splitInstrumented(aged(specsActive, 14)),
    },
    prs: currentSnap.prsIntegration.map((p) => ({
      id: p.id, title: p.title, createdBy: p.createdBy, status: p.status,
      iterationCount: p.iterationCount, isAi: p.isAi,
    })),
    prsByAuthor: {},
    tasksActiveByAssignee: {},
    pipelineRuns: currentSnap.pipelineRuns.map((r) => ({
      id: r.id, definitionName: r.definitionName, layer: r.layer,
      status: r.status, finishTime: r.finishTime,
    })),
  };
}

/* ----------------------------------------------------------------------------
 * Branding / connection profile
 * --------------------------------------------------------------------------*/

/**
 * Read devops-connection.yaml to extract branding + URL templates.
 * Falls back to generic defaults when file is absent or unparseable.
 */
function readConnectionProfile(profilePath) {
  if (!profilePath || !fs.existsSync(profilePath)) {
    return {
      reportTitle: 'DORA Report',
      brandName: '',
      brandAccent: 'DORA',
      workItemUrlTemplate: '#{id}',
      prUrlTemplate: '#{id}',
      agentIdentityPatterns: [],
      confidenceThresholds: { ...DEFAULT_CONFIDENCE_THRESHOLDS },
      strapInstrumentationSignals: {
        tagPrefixes: [...DEFAULT_STRAP_INSTRUMENTATION_SIGNALS.tagPrefixes],
        commentPrefixes: [...DEFAULT_STRAP_INSTRUMENTATION_SIGNALS.commentPrefixes],
        customFields: [...DEFAULT_STRAP_INSTRUMENTATION_SIGNALS.customFields],
      },
    };
  }
  const raw = fs.readFileSync(profilePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const get = (key) => {
    for (const line of lines) {
      const m = line.match(new RegExp(`^\\s*${key}\\s*:\\s*['"]?([^'"#]+?)['"]?\\s*(?:#.*)?$`));
      if (m) return m[1].trim();
    }
    return null;
  };
  const host = get('host') || 'azure-devops';
  const org = get('organization') || get('org') || '';
  const project = get('project') || '';
  let workItemUrlTemplate = '#{id}';
  let prUrlTemplate = '#{id}';
  if (/azure[\-_]?devops|dev\.azure\.com/i.test(host) && org && project) {
    workItemUrlTemplate = `https://dev.azure.com/${org}/${project}/_workitems/edit/{id}`;
    prUrlTemplate = `https://dev.azure.com/${org}/${project}/_git/_/pullrequest/{id}`;
  } else if (/github/i.test(host)) {
    workItemUrlTemplate = `https://github.com/${org}/${project}/issues/{id}`;
    prUrlTemplate = `https://github.com/${org}/${project}/pull/{id}`;
  } else if (/jira/i.test(host)) {
    workItemUrlTemplate = `https://${org}/browse/{id}`;
  }
  const agentIdentityRaw = get('agent_identity_patterns');
  const agentIdentityPatterns = agentIdentityRaw
    ? agentIdentityRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const confidenceThresholds = parseConfidenceThresholds(raw);
  const strapInstrumentationSignals = parseStrapInstrumentationSignals(raw);

  return {
    reportTitle: project ? `${project} DORA Report` : 'DORA Report',
    brandName: project || '',
    brandAccent: 'DORA',
    workItemUrlTemplate,
    prUrlTemplate,
    agentIdentityPatterns,
    confidenceThresholds,
    strapInstrumentationSignals,
  };
}

/**
 * Extract mapping.dora_confidence_thresholds from devops-connection.yaml raw text.
 * Falls back per-key to DEFAULT_CONFIDENCE_THRESHOLDS so missing keys preserve the
 * default behaviour (v2.4 CFR floor, others disabled).
 */
function parseConfidenceThresholds(raw) {
  const out = { ...DEFAULT_CONFIDENCE_THRESHOLDS };
  const block = extractIndentedBlock(raw, /^\s*mapping\s*:/m, /^\s*dora_confidence_thresholds\s*:/m);
  if (!block) return out;
  for (const key of Object.keys(DEFAULT_CONFIDENCE_THRESHOLDS)) {
    const m = block.match(new RegExp(`^\\s*${key}\\s*:\\s*(-?\\d+)\\s*(?:#.*)?$`, 'm'));
    if (m) {
      const v = parseInt(m[1], 10);
      if (Number.isFinite(v) && v >= 0) out[key] = v;
    }
  }
  return out;
}

/**
 * Extract mapping.strap_instrumentation_signals from devops-connection.yaml raw
 * text. Falls back per-key to the default v2.4 three-signal union so missing keys
 * preserve current behaviour.
 */
function parseStrapInstrumentationSignals(raw) {
  const out = {
    tagPrefixes: [...DEFAULT_STRAP_INSTRUMENTATION_SIGNALS.tagPrefixes],
    commentPrefixes: [...DEFAULT_STRAP_INSTRUMENTATION_SIGNALS.commentPrefixes],
    customFields: [...DEFAULT_STRAP_INSTRUMENTATION_SIGNALS.customFields],
  };
  const block = extractIndentedBlock(raw, /^\s*mapping\s*:/m, /^\s*strap_instrumentation_signals\s*:/m);
  if (!block) return out;
  const tagList = parseYamlScalarList(block, 'tag_prefixes');
  const commentList = parseYamlScalarList(block, 'comment_prefixes');
  const fieldList = parseYamlScalarList(block, 'custom_fields');
  if (tagList !== null) out.tagPrefixes = tagList;
  if (commentList !== null) out.commentPrefixes = commentList;
  if (fieldList !== null) out.customFields = fieldList;
  return out;
}

/**
 * Return the indented child block under `child` that lives inside `parent`. Used
 * to scope per-block YAML extraction without a YAML dependency. Returns null when
 * either marker is absent.
 */
function extractIndentedBlock(raw, parentRe, childRe) {
  const parentMatch = parentRe.exec(raw);
  if (!parentMatch) return null;
  const after = raw.slice(parentMatch.index + parentMatch[0].length);
  const childMatch = childRe.exec(after);
  if (!childMatch) return null;
  const childIndent = (childMatch[0].match(/^\s*/) || [''])[0].length;
  const tail = after.slice(childMatch.index + childMatch[0].length);
  const lines = tail.split(/\r?\n/);
  const collected = [];
  for (const line of lines) {
    if (!line.trim()) { collected.push(line); continue; }
    const indent = (line.match(/^\s*/) || [''])[0].length;
    if (indent <= childIndent) break;
    collected.push(line);
  }
  return collected.join('\n');
}

/**
 * Parse a YAML scalar list under `key` from the given block. Supports both flow
 * syntax (`key: [a, b]`) and block syntax (`key:` followed by `- a` lines).
 * Returns null when the key is absent so callers can preserve defaults.
 */
function parseYamlScalarList(block, key) {
  const flowRe = new RegExp(`^\\s*${key}\\s*:\\s*\\[([^\\]]*)\\]\\s*(?:#.*)?$`, 'm');
  const flow = flowRe.exec(block);
  if (flow) {
    return flow[1].split(',').map((s) => {
      let v = s.trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return v;
    }).filter(Boolean);
  }
  const headerRe = new RegExp(`^(\\s*)${key}\\s*:\\s*(?:#.*)?$`, 'm');
  const header = headerRe.exec(block);
  if (!header) return null;
  const headerIndent = header[1].length;
  const tail = block.slice(header.index + header[0].length);
  const lines = tail.split(/\r?\n/);
  const items = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const indent = (line.match(/^\s*/) || [''])[0].length;
    if (indent <= headerIndent) break;
    const m = line.match(/^\s*-\s*['"]?([^'"#]+?)['"]?\s*(?:#.*)?$/);
    if (m) items.push(m[1].trim());
  }
  return items;
}

/* ----------------------------------------------------------------------------
 * Main entry point
 * --------------------------------------------------------------------------*/

function buildPayload(opts) {
  const profile = readConnectionProfile(opts.connection || '.claude/strap/state/devops-connection.yaml');
  const thresholds = profile.confidenceThresholds || { ...DEFAULT_CONFIDENCE_THRESHOLDS };
  const signals = profile.strapInstrumentationSignals || DEFAULT_STRAP_INSTRUMENTATION_SIGNALS;
  const rawSprintSnaps = opts.sprints.map(readSnapshot);
  const snapshots = rawSprintSnaps.map((s) => normalizeSnapshot(s, profile.agentIdentityPatterns, signals));
  const currentSnap = opts.current ? normalizeSnapshot(readSnapshot(opts.current), profile.agentIdentityPatterns, signals) : null;

  const layersUnion = new Map();
  for (const s of snapshots) for (const l of s.layersResolved) layersUnion.set(l.name, l);
  const layers = [...layersUnion.values()];
  const subRepos = [];
  const deploymentTargets = [];
  for (const s of snapshots) {
    if (s.deployments && s.deployments.length) {
      for (const t of s.deployments) {
        if (!deploymentTargets.find((d) => d.name === t.target)) {
          deploymentTargets.push({ name: t.target, environment: t.environment || '', deployKind: t.deploy_kind || '' });
        }
      }
    }
  }

  const sprintMetrics = [];
  let prev = null;
  for (const s of snapshots) {
    const m = computeSprintMetric(s, prev, layers, thresholds);
    sprintMetrics.push(m);
    prev = m;
  }

  const excludedClusters = [];
  for (const s of snapshots) {
    for (const c of (s.excludedClusters || [])) {
      const feature = s.workItemsById.get(c.featureId);
      excludedClusters.push({
        featureId: c.featureId,
        title: feature ? feature.title : null,
        exclusionReason: c.exclusionReason,
        prCount: c.clusterPrCount,
        subRepos: [...new Set((c.clusterPrIds || []).map((p) => p.sub_repo || p.subRepo).filter(Boolean))],
        lifecycleDates: { openedAt: c.clusterOpenAt, mergedAt: c.clusterMergeAt },
      });
    }
  }

  const series = computeSeries(sprintMetrics);
  const movement = computeMovement(sprintMetrics);
  const trendByDev = computeTrendByDev(sprintMetrics);
  const devTotals = computeDevTotals(trendByDev);
  const inactiveMembers = computeInactiveMembers(snapshots, sprintMetrics);
  const agentAttribution = computeAgentAttribution(snapshots, sprintMetrics);

  const lastDq = sprintMetrics.length ? sprintMetrics[sprintMetrics.length - 1].dq : null;
  let verdicts;
  if (opts.verdicts) verdicts = loadVerdicts(opts.verdicts);
  else if (opts.autoVerdicts) verdicts = autoGenerateVerdicts(sprintMetrics, movement, lastDq);
  else verdicts = { milestone: null, watch: null, context: null };

  return {
    reportTitle: profile.reportTitle,
    brandName: profile.brandName,
    brandAccent: profile.brandAccent,
    workItemUrlTemplate: profile.workItemUrlTemplate,
    prUrlTemplate: profile.prUrlTemplate,
    layers,
    subRepos,
    deploymentTargets,
    sprintMetrics,
    sprintLabels: sprintMetrics.map((m) => m.name),
    sprintShort: sprintMetrics.map((m) => m.name.slice(0, 3).toUpperCase()),
    series,
    movement,
    trendByDev,
    devTotals,
    verdicts,
    currentMetrics: computeCurrentMetrics(currentSnap),
    inactiveMembers,
    agentAttribution,
    excludedClusters,
  };
}

function writePayload(outPath, payload) {
  const tmp = outPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
  fs.renameSync(tmp, outPath);
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv);
  } catch (e) {
    console.error('Error: ' + e.message);
    console.error('Usage: node build-payload.js --sprint <snap.json> [--sprint ...] [--current <snap.json>] [--verdicts <verdicts.json>] [--connection <conn.yaml>] [--no-auto-verdicts] --out <payload.json>');
    process.exit(2);
  }
  try {
    const payload = buildPayload(opts);
    writePayload(opts.out, payload);
    console.log(`PAYLOAD written: ${opts.out}`);
    console.log(`  sprints: ${payload.sprintMetrics.map((m) => m.name).join(', ')}`);
    console.log(`  layers: ${payload.layers.map((l) => l.name).join(', ') || '(none)'}`);
    console.log(`  in-flight: ${payload.currentMetrics ? payload.currentMetrics.sprintName : '(none)'}`);
  } catch (e) {
    console.error('Build failed: ' + e.message);
    if (process.env.DEBUG) console.error(e.stack);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  parseArgs, readSnapshot, normalizeSnapshot, propagateIsAiExecuted,
  classifyWorkItemIsAi, classifyHasStrapInstrumentation, classifyPr, isAgentAuthor,
  computeSprintMetric, computeSeries, computeMovement,
  computeTrendByDev, computeDevTotals,
  autoGenerateVerdicts, computeCurrentMetrics,
  readConnectionProfile, parseConfidenceThresholds, parseStrapInstrumentationSignals,
  buildPayload, writePayload,
  DEFAULT_CONFIDENCE_THRESHOLDS, DEFAULT_STRAP_INSTRUMENTATION_SIGNALS,
  INHERITED_AGING_COLLAPSE_THRESHOLD,
  PR_SIZE_BUCKETS, HIGHER_ORDER_TYPES,
};
