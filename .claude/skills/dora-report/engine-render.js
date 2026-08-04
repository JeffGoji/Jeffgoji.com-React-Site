/**
 * engine-render.js -- STRAP DORA report presentation engine.
 *
 * Consumes the PAYLOAD object produced by build-payload.js and renders the full
 * report DOM. Verbatim-engine invariant: adopters never edit this file.
 * If a section needs a value not currently rendered, the fix is to populate
 * the PAYLOAD field in build-payload.js -- not to rewrite the engine.
 *
 * Contract documented in:
 *   .claude/strap/contexts/dora-report-engine-design.md
 */

const {
  reportTitle, brandName, brandAccent,
  workItemUrlTemplate, prUrlTemplate,
  layers, subRepos, deploymentTargets,
  sprintMetrics, sprintLabels, sprintShort,
  series, movement, trendByDev, devTotals,
  verdicts, currentMetrics, inactiveMembers, agentAttribution,
} = PAYLOAD;

/** Per-section metric explainers (Feature #39724). Keyed by block-num label.
 *  Attached automatically by the infoTipFor() helper below; emitted as a native
 *  HTML title tooltip on a small "i" glyph beside the block-num kicker. Adopters
 *  encountering an unfamiliar metric hover to learn what it is. 1-2 sentences
 *  each; tone matches the report's editorial voice. */
const BLOCK_EXPLAINERS = {
  '01 · AI Efficiency Ratio': 'OriginalEstimate divided by wall-clock hours (resolved minus activated). Above 1x = faster than estimated; below 1x = slower. Wall-clock primary per the v2.4 Q6 lock; CompletedWork-derived ratio is suppressed when CompletedWork shows degeneracy.',
  '01b · AI vs Human at a glance': 'The same metrics rendered side-by-side for AI-driven vs human-driven work. Spread delta = current AI-vs-Human gap compared to the prior sprint. Positive delta = gap widening; negative = gap narrowing.',
  '01c · At a glance': 'KPI strip for secondary signals not covered by the hero (01) or the AI-vs-Human glance (01b). Quick scan view; deeper detail in later sections.',
  '02 · Shipped this sprint': 'Counts of work-item types that closed or resolved during the window. Volume signal, not quality -- read alongside cycle-time + CFR to interpret.',
  '03 · Per developer': 'Per-author breakdown of PR + work-item contribution. The Insufficient signal signature pill applies when an author has zero output across every visible column AND null interaction signals -- distinct from Quick-Approver (which requires some output).',
  '04a · PRs submitted': 'Per-author integration-PR volume plus size proxies. Files changed + lines total surface when /dora-collect captured git-diff stats (configurable via --with-git-diff-weight when that polish lands).',
  '04b · PR weight': 'Heatmap of files changed by lines changed per integration PR. Reads as a dash when /dora-collect did not capture git-diff stats; the engine degrades gracefully rather than guessing.',
  '04c · PR reviewers': 'Reviewer comment counts across integration PRs. Counts comments authored, not PRs reviewed -- a more honest signal of review engagement than PR count.',
  '04d · PR size': 'Iteration-count buckets: Small 0-1, Medium 2-3, Large 4-7, XL 8+. The AI vs Human partition uses the Track-1 binary-lenient classifier (PR is AI when authored-by-agent OR any linked work-item is AI-driven).',
  '05 · Cluster cycle-time': 'First PR open to last PR merge across all PRs in a Feature cluster. Single-PR Features degenerate to the standard PR cycle. Surfaces multi-PR Feature delivery time honestly when polyrepo umbrellas split a single Feature across several PRs.',
  '06 · Layer metrics': 'Per-layer deployment count + Change Failure Rate (CFR) + Mean Time to Restore (MTTR). Layers are declared in project-profile.md\'s Layers section. CFR + MTTR render no-signal pills when sample sizes fall below the configured confidence thresholds.',
  '07 · Quality cycle-times': 'Per-type cycle times at each state transition plus cross-type hops (e.g., Spec resolved to first Feature created). Higher-order types use isAiExecuted (descendant-Task majority rule); Tasks use the native AI tag.',
  '08 · Data quality': 'Field-coverage percentages feeding every metric above. Low coverage means some metrics degrade or get suppressed -- check the DQ flags here before interpreting movement in earlier sections.',
  'A · Editorial verdicts': 'Auto-generated milestone / watch / context cards from movement signals + DQ flags. Adopters can override the entire block with hand-authored verdicts via --verdicts <file>; --no-auto-verdicts suppresses auto-generation entirely.',
  'B · Roster note': 'Team members from the configured roster who had zero output in the window. Surfaces inactive members for CPO awareness without rendering an Insufficient-signal pill in the per-developer rows (which only fires for authors with actual signal but no output).',
  'C · Agent attribution': 'Per-agent task counts driven by strap:agent:* tag matching on closed Tasks. The agent role named in the tag (e.g., strap:agent:backend-engineer) gets credit; orchestration agents like dev-lead appear when they ran a Task directly.',
  'D · Pipeline funnel': 'Median time per stage across the 12-hop STRAP pipeline (Requirement -> Spec -> Feature -> Story -> Task -> Closed). Higher-order types partition by isAiExecuted; Task hops partition by native AI.',
  'DORA · Four metrics': 'The four canonical DORA-4 metrics for the sprint -- Deployment Frequency, Lead Time for Changes, Change Failure Rate, Mean Time To Restore. Each card carries the value, a sprint-over-sprint delta pill (or N/A when no prior sprint is in scope), and an info-tip with the DORA definition + DORA-categorization bands (Elite / High / Medium / Low). The "takeaway" view for the DORA-specific metrics; deeper detail per metric lives further down the report.',
  'DORA · Four metrics across the window': 'The four canonical DORA-4 metrics averaged across all included sprints. Sub-pill on each card compares the most-recent sprint to the first sprint in the window -- the "end vs start" trajectory across the period rather than within-pair delta. Lets the CPO see whether the team is trending toward higher / lower DORA bands over the period.',
  '0 · KPIs': 'Executive-summary five-numbers strip at the top of the comparison view. Each card carries the current value, an inline sparkline trending across all included sprints, and the sprint-over-sprint delta pill. The fifth card is adopter-adaptive: Deployments when deployment_targets are declared, Pipeline runs when only Layers are declared, Abandon rate when neither.',
  'E · Trend sparklines': 'Volume trend across sprints rendered as small-multiples -- each card scales to its own series so signals at different magnitudes stay readable. Inline sparkline includes dot markers per sprint with the value labeled above. Direction-aware delta pill in the header (inverse coloring for metrics where lower is better).',
  'F · Sprint-over-sprint movement': 'Metrics that moved more than 5% between the last two sprints, partitioned into improvements + regressions. Bars sized by magnitude (largest mover longest); direction is color, not value. Direction-aware: for cycle times + CFR + MTTR a decrease is an improvement (rendered green in the left column).',
  'G · Deploy heatmap': 'Per-layer deployment volume per sprint. Cell background intensity scales with run volume relative to the team max -- darker cells are heavier traffic. The red N-failed marker calls out failures inline; empty cells render an em-dash with muted styling.',
  'M · Methodology': 'Adopter-portable reference for every metric the report renders -- formulas, source fields, and per-metric notes. Lives as a collapsed details disclosure so it stays out of the way until adopters need to look up how a specific number is computed. The full PAYLOAD contract is documented separately at dora-report-engine-design.md.',
  'H · Per-developer spine': 'Per-author contribution across all included sprints, broken out per metric (PRs, Intermediate PRs, Drafts, Tasks, Higher items, Review comments) with uniform-width segments so columns are directly comparable. The total badge greens for team-max and reds for team-min per metric. Filter pills focus on one metric at a time.',
  'H2 · Per-developer · PR weight': 'Per-author PR weight across the window: avg files, avg lines, total lines shipped. Size bucket classifies the typical PR (small <200 lines, medium 200-1000, large 1000-5000, XL 5000+). Heaviest PR identifies the single biggest by lines. Sorted by total volume descending.',
  'N1 · Sprint progress': 'Day count + remaining + bar position for the in-flight sprint. Drives the progress gauge at the top of the in-flight view.',
  'N2 · Aging alerts': 'Active items past type-specific thresholds (Tasks > 3d, Stories > 5d, Features > 7d, Specs > 14d). Split into STRAP-instrumented (load-bearing pipeline signal) and inherited backlog (pre-existing work the team is carrying through STRAP onboarding).',
  'N3 · Active items': 'Tasks, Stories, Features, and Specs currently in the Active state in the in-flight sprint. Sorted; tabular drill-down beneath the aggregate.',
  'N4 · Open PRs': 'Integration PRs currently open. Excludes drafts; status + iteration count surfaces alongside author + title.',
  'N5 · Pipeline activity': 'Recent pipeline runs in the in-flight window. Status + finish time per layer; helps spot stuck deploys or runaway re-tries.',
};

/** Look up the explainer for a block-num label + render a small info-tip glyph. */
function infoTipFor(blockNum) {
  return infoTip(BLOCK_EXPLAINERS[blockNum] || '');
}

const SPRINT_N = sprintMetrics.length;
const SPRINT_N_WORD = (function (n) {
  const w = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  return w[n] || String(n);
})(SPRINT_N);
const SPRINT_SPAN_LABEL = SPRINT_N_WORD.charAt(0).toUpperCase() + SPRINT_N_WORD.slice(1) + '-sprint';

/* ----------------------------------------------------------------------------
 * Bootstrap helpers
 * --------------------------------------------------------------------------*/

(function bootstrapHead() {
  try { document.title = reportTitle || 'DORA Report'; } catch (e) {}
  const brandNameEl = document.getElementById('brand-name');
  if (brandNameEl) brandNameEl.textContent = brandName ? brandName + ' ' : '';
  const brandAccentEl = document.getElementById('brand-accent');
  if (brandAccentEl) brandAccentEl.textContent = brandAccent || 'DORA';
  const stampEl = document.getElementById('report-stamp');
  if (stampEl) stampEl.textContent = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const sub = document.getElementById('report-subtitle');
  if (sub) {
    const last = sprintMetrics[SPRINT_N - 1];
    const inflight = currentMetrics && currentMetrics.sprintName ? ' · ' + currentMetrics.sprintName + ' in flight' : '';
    sub.textContent = SPRINT_SPAN_LABEL + ' executive review · ' + (last ? last.name : '') + inflight;
  }
})();

function toggleTheme() {
  const root = document.documentElement;
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  try { localStorage.setItem('dora-theme', next); } catch (e) {}
}
try {
  const t = localStorage.getItem('dora-theme');
  if (t) document.documentElement.setAttribute('data-theme', t);
  else if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.setAttribute('data-theme', 'dark');
} catch (e) {}

/* ----------------------------------------------------------------------------
 * Format + URL helpers
 * --------------------------------------------------------------------------*/

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtHours(h) {
  if (h == null) return '—';
  if (h < 1) return (h * 60).toFixed(0) + 'm';
  if (h < 24) return h.toFixed(1) + 'h';
  return (h / 24).toFixed(1) + 'd';
}

function fmtPct(n) { return n == null ? '—' : (n * 100).toFixed(0) + '%'; }

function fmtDelta(pct) {
  if (pct == null || !isFinite(pct)) return '—';
  if (pct > 0) return '+' + pct.toFixed(0) + '%';
  return pct.toFixed(0) + '%';
}

function fmtNum(v, digits) {
  if (v == null || !isFinite(v)) return '—';
  const d = digits == null ? 2 : digits;
  return v.toFixed(d);
}

function workItemUrl(id) {
  if (!workItemUrlTemplate) return '#' + id;
  return workItemUrlTemplate.replace('{id}', id);
}

function prUrl(id) {
  if (!prUrlTemplate) return '#' + id;
  return prUrlTemplate.replace('{id}', id);
}

function deltaPill(curr, prev, opts) {
  opts = opts || {};
  const inverse = opts.inverse || false;
  if (curr == null || prev == null || prev === 0) return '<span class="delta-pill neutral">—</span>';
  const pct = ((curr - prev) / prev) * 100;
  const abs = Math.abs(pct);
  if (abs < 5) return '<span class="delta-pill neutral">→ ' + fmtDelta(pct) + '</span>';
  const direction = pct > 0 ? 'up' : 'down';
  const cls = inverse ? (direction === 'up' ? 'inverse-up' : 'inverse-down') : direction;
  const arrow = pct > 0 ? '↑' : '↓';
  return '<span class="delta-pill ' + cls + '">' + arrow + ' ' + fmtDelta(pct) + '</span>';
}

function aiBadge(isAi) {
  if (isAi === true) return ' <span class="sig ai">AI</span>';
  return '';
}

/** Render a no-signal pill with optional inline-count + tooltip context.
 *  Pass `leaf` (the metric's PartitionedCycle / MTTR / CFR / AI-Eff sub-block)
 *  to surface `need <threshold>; got <count>` inline and a longer tooltip
 *  explaining the threshold and how to configure it. */
function noSignalPill(leafOrLabel) {
  const labelOverride = typeof leafOrLabel === 'string' ? leafOrLabel : null;
  if (labelOverride) {
    return '<span class="delta-pill no-signal">' + esc(labelOverride) + '</span>';
  }
  const leaf = leafOrLabel || {};
  const threshold = leaf.threshold;
  const denom = leaf.count != null ? leaf.count : (leaf.denominator != null ? leaf.denominator : null);
  const inline = (threshold > 0 && denom != null)
    ? 'no signal (need ' + threshold + '; got ' + denom + ')'
    : 'no signal';
  const key = leaf.thresholdKey || '';
  const tip = (threshold > 0 && key)
    ? 'Sample below the configured ' + key + ' threshold of ' + threshold + '. Metric suppressed to avoid false precision on tiny samples. Configure via mapping.dora_confidence_thresholds in devops-connection.yaml.'
    : 'Sample below the confidence threshold; metric suppressed to avoid false precision.';
  return '<span class="delta-pill no-signal" title="' + esc(tip) + '" aria-label="' + esc(tip) + '">' + esc(inline) + '</span>';
}

/** Render a small superscript info glyph that surfaces the given explainer text
 *  on click, hover, OR keyboard focus. The popover styling lives in engine-head.html;
 *  CSS-only show/hide via :focus / :focus-within / :hover (no JS needed, dismissal
 *  on click-outside is automatic via focus-loss). The native title attribute is
 *  retained as the universal accessibility fallback + delay-tolerant hover hint;
 *  the styled popover is what the CPO actually sees when clicking the glyph.
 *  Use beside metric block titles and KPI labels. */
function infoTip(text) {
  if (!text) return '';
  // Note: deliberately NO title attribute -- the native browser tooltip would
  // double up with our styled popover on hover (visible as two boxes). aria-label
  // covers screen-reader accessibility; the popover IS the visible tooltip.
  return ' <span class="info-tip" tabindex="0" role="button" aria-label="' + esc(text) + '">i'
    + '<span class="info-tip-popover" role="tooltip">' + esc(text) + '</span>'
    + '</span>';
}

function sparklineSvg(values, opts) {
  opts = opts || {};
  const w = opts.w || 80, h = opts.h || 24;
  const valid = values.map(v => v == null ? 0 : v);
  if (valid.every(v => v === 0)) return '';
  const min = Math.min(...valid), max = Math.max(...valid);
  const range = max - min || 1;
  const pts = valid.map((v, i) => {
    const x = (i / Math.max(1, valid.length - 1)) * (w - 4) + 2;
    const y = h - 2 - ((v - min) / range) * (h - 4);
    return x.toFixed(1) + ',' + y.toFixed(1);
  });
  const last = pts[pts.length - 1].split(',');
  const stroke = opts.color || 'var(--ink-soft)';
  return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">'
    + '<polyline fill="none" stroke="' + stroke + '" stroke-width="1.4" points="' + pts.join(' ') + '"/>'
    + '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2" fill="' + stroke + '"/>'
    + '</svg>';
}

/* ----------------------------------------------------------------------------
 * View picker + view switching
 * --------------------------------------------------------------------------*/

function viewCards() {
  const cards = [];
  sprintMetrics.forEach((m, i) => {
    cards.push({
      id: 'sprint-' + i,
      kicker: 'Sprint ' + (i + 1),
      name: m.name,
      meta: m.window.start.slice(5, 10) + ' → ' + m.window.end.slice(5, 10) + ' · ' + m.counts.tasksClosed + ' tasks · ' + m.counts.prsInt + ' PRs',
      current: false,
    });
  });
  cards.push({
    id: 'comparison',
    kicker: 'Summary',
    name: SPRINT_SPAN_LABEL + ' Comparison',
    meta: 'Trends · movement · per-developer',
    current: false,
  });
  if (currentMetrics) {
    cards.push({
      id: 'current',
      kicker: 'In flight',
      name: currentMetrics.sprintName,
      meta: 'Day ' + Math.floor(currentMetrics.daysElapsed + 0.5) + ' · ' + currentMetrics.tasksActive.length + ' tasks active · ' + currentMetrics.prs.length + ' open PRs',
      current: true,
    });
  }
  return cards;
}

function renderViewPicker() {
  const cards = viewCards();
  const root = document.getElementById('view-picker');
  if (!root) return;
  root.innerHTML = cards.map(c => '<div class="view-card' + (c.current ? ' current' : '') + '" data-view="' + c.id + '">'
    + '<div class="vc-kicker">' + esc(c.kicker) + '</div>'
    + '<div class="vc-name">' + esc(c.name) + '</div>'
    + '<div class="vc-meta">' + esc(c.meta) + '</div>'
    + '</div>').join('');
  root.querySelectorAll('.view-card').forEach(el => {
    el.addEventListener('click', () => switchView(el.getAttribute('data-view')));
  });
}

function switchView(id) {
  document.querySelectorAll('.view-card').forEach(el => el.classList.toggle('active', el.getAttribute('data-view') === id));
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === 'view-' + id));
  try { history.replaceState(null, '', '#' + id); } catch (e) {}
  window.scrollTo({ top: 0, behavior: 'auto' });
}

/* ----------------------------------------------------------------------------
 * Partition toggle (AI / Human / All) -- shared chrome
 * --------------------------------------------------------------------------*/

const PARTITION_LABELS = ['all', 'ai', 'human'];

function partitionToggleHtml(sectionId, current) {
  const cur = current || 'all';
  return '<div class="partition-toggle" data-section="' + sectionId + '">'
    + PARTITION_LABELS.map(p => '<button data-partition="' + p + '"' + (p === cur ? ' class="active"' : '') + '>' + p.charAt(0).toUpperCase() + p.slice(1) + '</button>').join('')
    + '</div>';
}

/**
 * Wire a partition toggle so clicks re-render the section. The render function
 * receives the selected partition key and must produce the updated section
 * HTML (excluding the toggle itself, which the wiring re-renders too).
 */
function wirePartitionToggle(sectionId, renderFn) {
  document.querySelectorAll('.partition-toggle[data-section="' + sectionId + '"] button').forEach(btn => {
    btn.addEventListener('click', () => {
      const partition = btn.getAttribute('data-partition');
      const container = document.getElementById(sectionId);
      if (container) {
        container.innerHTML = renderFn(partition);
        wirePartitionToggle(sectionId, renderFn);
      }
    });
  });
}

/* ----------------------------------------------------------------------------
 * Per-sprint view blocks
 * --------------------------------------------------------------------------*/

function renderAiHero(m, prevM) {
  const curr = m.ai.all.p50;
  const prev = prevM ? prevM.ai.all.p50 : null;
  const delta = (curr != null && prev != null && prev !== 0) ? ((curr - prev) / prev) * 100 : null;
  const deltaCls = delta == null ? 'neutral' : (delta > 0 ? 'up' : 'down');
  const deltaText = delta == null ? '—' : (delta > 0 ? '+' : '') + delta.toFixed(0) + '% vs ' + esc(prevM ? prevM.name : 'prior');
  const ah = m.agentVsHuman || { agent: 0, human: 0, agentShare: 0 };
  const agentPct = Math.round(ah.agentShare * 100);
  const humanPct = 100 - agentPct;
  const conf = m.ai.confidence === 'low' ? ' <span class="muted" title="Fewer than 30% of closed Tasks have wall-clock-computable AI Efficiency">(low confidence)</span>' : '';
  const sampleNoSignal = (m.ai.sampleConfidence === 'no-signal') || (m.ai.all && m.ai.all.sampleConfidence === 'no-signal');
  const sampleLeaf = (m.ai.all && m.ai.all.sampleConfidence === 'no-signal') ? m.ai.all : m.ai;
  const numMarkup = sampleNoSignal
    ? noSignalPill(sampleLeaf)
    : (curr != null ? curr.toFixed(2) : '—') + '<span class="ai-hero-x">×</span>';
  return '<section class="block ai-hero">'
    + '<div class="block-num">01 · AI Efficiency Ratio' + infoTipFor("01 · AI Efficiency Ratio") + '</div>'
    + '<div class="ai-hero-flex">'
    + '<div class="ai-hero-main">'
      + '<div class="ai-hero-num">' + numMarkup + '</div>'
      + '<div class="ai-hero-label">wall-clock P50, ' + m.ai.all.count + ' Tasks' + conf + '</div>'
      + '<div class="ai-hero-delta delta-pill ' + deltaCls + '">' + (delta != null ? (delta > 0 ? '↑' : delta < 0 ? '↓' : '→') + ' ' + deltaText : 'baseline') + '</div>'
    + '</div>'
    + '<div class="ai-hero-side">'
      + '<div class="ai-side-stat"><div class="ai-side-val">' + (m.ai.all.mean != null ? m.ai.all.mean.toFixed(2) + '×' : '—') + '</div><div class="ai-side-lbl">Mean</div></div>'
      + '<div class="ai-side-stat"><div class="ai-side-val">' + (m.ai.all.p90 != null ? m.ai.all.p90.toFixed(2) + '×' : '—') + '</div><div class="ai-side-lbl">P90</div></div>'
    + '</div>'
    + '<div class="ai-hero-mix">'
      + '<div class="ai-mix-lbl">Work composition</div>'
      + '<div class="ai-mix-bar"><div class="ai-mix-fill agent" style="width:' + agentPct + '%"></div><div class="ai-mix-fill human" style="width:' + humanPct + '%"></div></div>'
      + '<div class="ai-mix-legend">'
        + '<span><span class="ai-mix-dot agent"></span> Agent-completed <strong>' + ah.agent + '</strong> Tasks (' + agentPct + '%)</span>'
        + '<span><span class="ai-mix-dot human"></span> Human-completed <strong>' + ah.human + '</strong> Tasks (' + humanPct + '%)</span>'
      + '</div>'
      + '<div class="ai-mix-note">AI-driven = AI tag OR [STRAP/agent:*] audit-line on the work item.</div>'
    + '</div>'
    + '</div>'
    + '</section>';
}

function renderAiVsHumanGlance(m, prevM) {
  const g = m.aiVsHumanGlance;
  if (!g) return '';
  function card(label, ai, human, fmt, spread) {
    const aiVal = fmt(ai), humanVal = fmt(human);
    const spreadLabel = spread != null ? (spread > 0 ? '↑ +' : spread < 0 ? '↓ ' : '→ ') + spread.toFixed(0) + '% vs prior' : 'baseline';
    return '<div class="aivh-card">'
      + '<div class="aivh-label">' + esc(label) + '</div>'
      + '<div class="aivh-pair">'
        + '<div class="aivh-row ai"><span class="lbl">AI</span><span class="val">' + aiVal + '</span></div>'
        + '<div class="aivh-row human"><span class="lbl">Human</span><span class="val">' + humanVal + '</span></div>'
      + '</div>'
      + '<div class="aivh-spread">Spread: ' + spreadLabel + '</div>'
      + '</div>';
  }
  function shareCard() {
    const pct = g.authorshipShare ? g.authorshipShare.pct : 0;
    const delta = g.authorshipShare ? g.authorshipShare.deltaVsPrior : null;
    const deltaText = delta != null ? (delta > 0 ? '+' : '') + delta.toFixed(1) + ' pts vs prior' : 'baseline';
    return '<div class="aivh-card">'
      + '<div class="aivh-label">AI authorship share</div>'
      + '<div style="font-family:\'Inter\',sans-serif;font-weight:700;font-size:28px;color:var(--accent-deep);margin-bottom:8px">' + pct.toFixed(0) + '%</div>'
      + '<div class="aivh-spread">' + esc(deltaText) + '</div>'
      + '<div style="font-size:11px;color:var(--ink-faint);margin-top:6px">Weighted across PRs by linked-WI AI share.</div>'
      + '</div>';
  }
  return '<section class="block">'
    + '<div class="block-num">01b · AI vs Human at a glance' + infoTipFor("01b · AI vs Human at a glance") + '</div>'
    + '<h2 class="block-title">How is the AI flow doing vs the human flow?</h2>'
    + '<p class="block-lede">Side-by-side. Spread delta tells whether the AI/Human gap is widening or narrowing vs the prior sprint.</p>'
    + '<div class="ai-vs-human-grid">'
    + card('AI Efficiency P50', g.aiEfficiency.ai, g.aiEfficiency.human, (v) => v == null ? '—' : v.toFixed(2) + '×', g.aiEfficiency.spreadDeltaVsPrior)
    + card('PR cycle hours', g.prCycleHours.ai, g.prCycleHours.human, fmtHours, g.prCycleHours.spreadDeltaVsPrior)
    + card('Tasks closed', g.tasksClosed.ai, g.tasksClosed.human, (v) => String(v == null ? 0 : v), g.tasksClosed.spreadDeltaVsPrior)
    + card('Deploys', g.deploys.ai, g.deploys.human, (v) => String(v == null ? 0 : v), g.deploys.spreadDeltaVsPrior)
    + shareCard()
    + '</div>'
    + '</section>';
}

function renderKpiStrip(m, prevM) {
  function kpiCard(label, curr, prev, fmt, opts) {
    opts = opts || {};
    return '<div class="kpi">'
      + '<div class="lbl">' + esc(label) + '</div>'
      + '<div class="val">' + fmt(curr) + '</div>'
      + '<div class="sub">' + deltaPill(curr, prev, { inverse: opts.inverse }) + '<span class="muted">vs prior</span></div>'
      + '</div>';
  }
  const cards = [
    kpiCard('PRs merged (int)', m.counts.prsIntCompleted, prevM ? prevM.counts.prsIntCompleted : null, x => String(x)),
    kpiCard('Tasks closed', m.counts.tasksClosed, prevM ? prevM.counts.tasksClosed : null, x => String(x)),
    kpiCard('PR cycle P50', m.pr.cycle.all.p50, prevM ? prevM.pr.cycle.all.p50 : null, fmtHours, { inverse: true }),
  ];
  const deployLabel = m.pipelineRunRateMode === 'pipeline-run-rate' ? 'Pipeline runs' : 'Deploys';
  for (const layer of layers) {
    const curr = m.deployByLayer[layer.name] ? m.deployByLayer[layer.name].total : 0;
    const prev = prevM && prevM.deployByLayer[layer.name] ? prevM.deployByLayer[layer.name].total : null;
    cards.push(kpiCard(deployLabel + ' · ' + layer.name, curr, prev, x => String(x)));
  }
  if (m.pipelineRunRateMode === 'pipeline-run-rate') {
    cards.push('<div class="callout warn" style="margin:6px 0 0 0">'
      + '<strong>Label-honesty:</strong> No deployment_targets declared, so per-target attribution is unavailable. '
      + 'The "Deploys" cards above are <em>pipeline run counts</em>, not deployment events. '
      + 'Declare <code>deployment_targets:</code> in <code>devops-connection.yaml</code> for true Deployment Frequency.'
      + '</div>');
  }
  return '<section class="block">'
    + '<div class="block-num">01c · At a glance' + infoTipFor("01c · At a glance") + '</div>'
    + '<h2 class="block-title">Other key metrics</h2>'
    + '<div class="kpi-grid">' + cards.join('') + '</div>'
    + '</section>';
}

function renderSprintContents(m) {
  const c = m.contents;
  const totalShipped = c.features.length + c.stories.length + c.enhancements.length + c.specs.length;
  function group(title, items, color) {
    if (!items.length) return '';
    return '<div style="margin-bottom:16px">'
      + '<div style="font-family:\'JetBrains Mono\',monospace;font-size:10.5px;letter-spacing:1.1px;text-transform:uppercase;color:' + color + ';margin-bottom:6px">' + esc(title) + ' (' + items.length + ')</div>'
      + '<table class="editorial">'
      + '<thead><tr><th style="width:80px">ID</th><th>Title</th><th style="width:200px">Assignee</th></tr></thead>'
      + '<tbody>' + items.map(it => '<tr><td class="mono"><a href="' + workItemUrl(it.id) + '" target="_blank">#' + it.id + '</a>' + aiBadge(it.isAi) + '</td><td>' + esc(it.title) + '</td><td><small>' + esc(it.assignee || '—') + '</small></td></tr>').join('') + '</tbody>'
      + '</table>'
      + '</div>';
  }
  return '<section class="block">'
    + '<div class="block-num">02 · Shipped this sprint' + infoTipFor("02 · Shipped this sprint") + '</div>'
    + '<h2 class="block-title">What landed</h2>'
    + '<p class="block-lede">' + totalShipped + ' higher-order items closed (Features + Stories + Specs + Enhancements). ' + c.bugsResolved.length + ' Bugs resolved.</p>'
    + group('Features closed', c.features, 'var(--accent-deep)')
    + group('Stories closed', c.stories, 'var(--blue-deep)')
    + group('Specs resolved', c.specs, 'var(--green-deep)')
    + group('Enhancements closed', c.enhancements, 'var(--amber)')
    + (c.bugsResolved.length ? group('Bugs resolved', c.bugsResolved, 'var(--red-deep)') : '')
    + '</section>';
}

function renderDevTable(m) {
  function devRow(r) {
    const sigCls = r.signature === 'Insufficient signal' ? 'sig insufficient'
      : r.signature === '—' ? '' : 'sig ' + r.signature.toLowerCase().replace('-', '').replace(' ', '');
    const sigCell = r.signature === '—' ? '<span class="muted">no PR</span>' : '<span class="' + sigCls + '">' + esc(r.signature) + '</span>';
    function higher() {
      if (!r.higherTotal) return '<span class="muted">—</span>';
      const p = [];
      if (r.higherStories) p.push(r.higherStories + ' S');
      if (r.higherFeatures) p.push(r.higherFeatures + ' F');
      if (r.higherSpecs) p.push(r.higherSpecs + ' Sp');
      return '<strong>' + r.higherTotal + '</strong> <small>(' + p.join(', ') + ')</small>';
    }
    return '<tr>'
      + '<td>' + esc(r.name) + '</td>'
      + '<td class="num">' + r.intPrs + '</td>'
      + '<td class="num">' + (r.intermPrs || '<span class="muted">—</span>') + '</td>'
      + '<td>' + sigCell + '</td>'
      + '<td class="num">' + (r.avgIter != null ? r.avgIter.toFixed(2) : '<span class="muted">—</span>') + '</td>'
      + '<td class="num">' + (r.avgCmt != null ? r.avgCmt.toFixed(1) : '<span class="muted">—</span>') + '</td>'
      + '<td class="num">' + r.tasksClosed + '</td>'
      + '<td class="num">' + (r.tasksActive || '<span class="muted">—</span>') + '</td>'
      + '<td class="num">' + higher() + '</td>'
      + '<td class="num">' + (r.aiP50 != null ? r.aiP50.toFixed(2) + 'x' : '<span class="muted">—</span>') + '</td>'
      + '<td class="num">' + (r.taskP50 != null ? fmtHours(r.taskP50) : '<span class="muted">—</span>') + '</td>'
      + '<td class="num">' + (r.reviewerComments || '<span class="muted">—</span>') + '</td>'
      + '</tr>';
  }
  const devTable = m.devRows.map(devRow).join('');
  const focusedCount = m.devRows.filter(r => r.signature === 'Focused').length;
  const intermOnly = m.devRows.filter(r => r.intPrs === 0 && (r.intermPrs > 0 || r.higherTotal > 0 || r.tasksActive > 0));
  return '<section class="block">'
    + '<div class="block-num">03 · Per developer' + infoTipFor("03 · Per developer") + '</div>'
    + '<h2 class="block-title">Who shipped what</h2>'
    + '<p class="block-lede">Load and balance signal — not a performance ranking. Integration PRs are the cumulative stream; intermediate PRs are upstream contributions to feature branches.</p>'
    + '<table class="editorial">'
    + '<thead><tr>'
    + '<th>Developer</th><th class="num">Int. PRs</th><th class="num">Interm.</th><th>Signature</th>'
    + '<th class="num">Avg iter</th><th class="num">Avg cmt</th>'
    + '<th class="num">Tasks closed</th><th class="num">Tasks active</th>'
    + '<th class="num">Higher closed</th>'
    + '<th class="num">AI Eff P50</th><th class="num">Median cycle</th>'
    + '<th class="num">Review cmts</th>'
    + '</tr></thead>'
    + '<tbody>' + devTable + '</tbody>'
    + '</table>'
    + '<div class="callout"><strong>Read:</strong> ' + focusedCount + ' of ' + m.devRows.filter(r => r.intPrs > 0).length + ' integration-PR authors are in the <em>Focused</em> bucket.'
    + (intermOnly.length ? ' Upstream-only this sprint: ' + intermOnly.map(r => '<strong>' + esc(r.name) + '</strong>').join(', ') + ' (work in feature branches, not yet visible in integration metrics).' : '')
    + (m.pr.outliers.length ? ' Largest outlier: PR #' + m.pr.outliers[0].id + ' (' + esc(m.pr.outliers[0].createdBy) + ', ' + m.pr.outliers[0].iterationCount + ' iter / ' + m.pr.outliers[0].commentCount + ' cmt).' : '')
    + '</div>'
    + '</section>';
}

function renderPrSubmitted(m) {
  const prs = m.devRows.filter(r => r.intPrs > 0).sort((a, b) => b.intPrs - a.intPrs);
  if (!prs.length) {
    return '<section class="block"><div class="block-num">04a · PRs submitted' + infoTipFor("04a · PRs submitted") + '</div><h2 class="block-title">Who shipped PRs</h2><p class="muted">No integration PRs this sprint.</p></section>';
  }
  const maxPrs = Math.max(...prs.map(r => r.intPrs));
  const maxAvgLines = Math.max(...prs.map(r => r.avgLines || 0), 1);

  const cards = prs.map(r => {
    const volWidth = (r.intPrs / maxPrs) * 100;
    const sizeWidth = ((r.avgLines || 0) / maxAvgLines) * 100;
    const sigCls = r.signature === 'Insufficient signal' ? 'sig insufficient'
      : 'sig ' + r.signature.toLowerCase().replace('-', '').replace(' ', '');
    const sizeLabel = r.avgLines != null ? Math.round(r.avgLines) + ' lines avg' : 'no weight data';
    const heaviestLine = r.heaviestPr
      ? '<div class="profile-heaviest"><span class="muted">Heaviest:</span> <code>#' + r.heaviestPr.pr_id + '</code> ' + esc((r.heaviestPr.title || '').substring(0, 50)) + ((r.heaviestPr.title || '').length > 50 ? '…' : '') + ' <span class="mono">(' + r.heaviestPr.files + 'f / ' + r.heaviestPr.lines_total + 'L)</span></div>'
      : '';
    return '<div class="profile-card">'
      + '<div class="profile-head">'
        + '<div class="profile-name">' + esc(r.name) + '</div>'
        + '<span class="' + sigCls + '">' + esc(r.signature) + '</span>'
      + '</div>'
      + '<div class="profile-num-row">'
        + '<div class="profile-num"><div class="profile-num-val">' + r.intPrs + '</div><div class="profile-num-lbl">PRs</div></div>'
        + (r.intermPrs ? '<div class="profile-num"><div class="profile-num-val">' + r.intermPrs + '</div><div class="profile-num-lbl">interm.</div></div>' : '')
        + '<div class="profile-num"><div class="profile-num-val">' + (r.avgFiles != null ? Math.round(r.avgFiles) : '—') + '</div><div class="profile-num-lbl">files/PR avg</div></div>'
        + '<div class="profile-num"><div class="profile-num-val">' + (r.avgLines != null ? Math.round(r.avgLines) : '—') + '</div><div class="profile-num-lbl">lines/PR avg</div></div>'
        + '<div class="profile-num"><div class="profile-num-val">' + (r.maxIter != null ? r.maxIter : '—') + '</div><div class="profile-num-lbl">peak iter</div></div>'
      + '</div>'
      + '<div class="profile-bars">'
        + '<div class="profile-bar-row"><div class="profile-bar-lbl">Volume</div><div class="profile-bar-track"><div class="profile-bar-fill volume" style="width:' + volWidth + '%"></div></div><div class="profile-bar-val">' + r.intPrs + ' PRs</div></div>'
        + '<div class="profile-bar-row"><div class="profile-bar-lbl">Weight</div><div class="profile-bar-track"><div class="profile-bar-fill weight" style="width:' + sizeWidth + '%"></div></div><div class="profile-bar-val">' + sizeLabel + '</div></div>'
      + '</div>'
      + heaviestLine
      + '</div>';
  }).join('');

  return '<section class="block">'
    + '<div class="block-num">04a · PRs submitted' + infoTipFor("04a · PRs submitted") + '</div>'
    + '<h2 class="block-title">Volume × weight per author</h2>'
    + '<p class="block-lede">Two bars per dev: <strong>Volume</strong> (PR count vs sprint max) and <strong>Weight</strong> (avg lines per PR vs sprint max).</p>'
    + '<div class="profile-grid">' + cards + '</div>'
    + '</section>';
}

function renderPrWeight(m) {
  const stats = m.prWeightStats;
  if (!stats || stats.coverage === 0) {
    return '<section class="block">'
      + '<div class="block-num">04b · PR weight' + infoTipFor("04b · PR weight") + '</div>'
      + '<h2 class="block-title">How meaty the PRs were</h2>'
      + '<p class="muted">Weight signals (commits, files changed, lines added/deleted, work items linked) require local git access to merge commits. Run <code>git fetch</code> on integration target then re-render to populate this section.</p>'
      + '</section>';
  }
  const prs = m.prsWithWeight;
  return '<section class="block pw-block">'
    + '<div class="block-num">04b · PR weight' + infoTipFor("04b · PR weight") + '</div>'
    + '<h2 class="block-title">How meaty the PRs were</h2>'
    + '<p class="block-lede">Beyond iteration count: commits, files touched, lines added/deleted, work items linked. ' + Math.round(stats.coverage * 100) + '% coverage.</p>'
    + '<div class="kpi-grid">'
    + '<div class="kpi"><div class="lbl">Files / PR (P50)</div><div class="val">' + Math.round(stats.filesP50) + '</div><div class="sub muted">P90 ' + Math.round(stats.filesP90) + ' · max ' + stats.filesMax + '</div></div>'
    + '<div class="kpi"><div class="lbl">Lines / PR (P50)</div><div class="val">' + Math.round(stats.linesP50) + '</div><div class="sub muted">P90 ' + Math.round(stats.linesP90) + ' · max ' + stats.linesMax + '</div></div>'
    + '<div class="kpi"><div class="lbl">Commits / PR (P50)</div><div class="val">' + Math.round(stats.commitsP50) + '</div><div class="sub muted">P90 ' + Math.round(stats.commitsP90) + '</div></div>'
    + '<div class="kpi"><div class="lbl">Work items linked (P50)</div><div class="val">' + Math.round(stats.witP50) + '</div><div class="sub muted">max ' + stats.witMax + '</div></div>'
    + '</div>'
    + '<h4 style="margin-top:18px">Heaviest PRs</h4>'
    + '<table class="editorial">'
    + '<thead><tr><th>PR</th><th>Title</th><th>Author</th><th class="num">Commits</th><th class="num">Files</th><th class="num">Lines (+/-)</th><th class="num">WI</th><th class="num">Iter</th></tr></thead>'
    + '<tbody>' + prs.slice(0, 10).map(p => '<tr>'
      + '<td class="mono"><a href="' + prUrl(p.id) + '" target="_blank">#' + p.id + '</a>' + aiBadge(p.isAi) + '</td>'
      + '<td>' + esc(p.title) + '</td>'
      + '<td><small>' + esc(p.createdBy) + '</small></td>'
      + '<td class="num">' + (p.weight.commits || '—') + '</td>'
      + '<td class="num">' + (p.weight.files_changed != null ? p.weight.files_changed : '—') + '</td>'
      + '<td class="num mono">' + (p.weight.lines_added != null ? '+' + p.weight.lines_added + ' / -' + p.weight.lines_deleted : '—') + '</td>'
      + '<td class="num">' + (p.weight.work_items_count || '—') + '</td>'
      + '<td class="num">' + p.iterationCount + '</td>'
      + '</tr>').join('') + '</tbody></table>'
    + '</section>';
}

function renderPrReviewers(m) {
  const r = m.prReviewersRanked || [];
  if (!r.length) {
    return '<section class="block">'
      + '<div class="block-num">04c · PR reviewers' + infoTipFor("04c · PR reviewers") + '</div>'
      + '<h2 class="block-title">Who reviewed</h2>'
      + '<p class="muted">No reviewer comments captured this sprint.</p>'
      + '</section>';
  }
  const max = r[0].comments;
  const rows = r.map(rev => {
    const w = (rev.comments / max) * 100;
    return '<div style="display:grid;grid-template-columns:200px 80px 1fr 100px;gap:14px;align-items:center;padding:8px 0;border-bottom:1px solid var(--rule-soft)">'
      + '<div style="font-size:13px;color:var(--ink)">' + esc(rev.name) + '</div>'
      + '<div class="mono" style="font-size:11px;color:var(--ink-faint)">' + rev.prsReviewed + ' PRs</div>'
      + '<div style="height:6px;background:var(--bg-sunk);border-radius:3px;overflow:hidden"><div style="width:' + w.toFixed(1) + '%;height:100%;background:linear-gradient(90deg,var(--blue),var(--blue-deep))"></div></div>'
      + '<div class="mono" style="font-size:13px;font-weight:500;color:var(--ink);text-align:right">' + rev.comments + ' <small style="color:var(--ink-faint)">(' + rev.avgPerPr.toFixed(1) + '/pr)</small></div>'
      + '</div>';
  }).join('');
  return '<section class="block">'
    + '<div class="block-num">04c · PR reviewers' + infoTipFor("04c · PR reviewers") + '</div>'
    + '<h2 class="block-title">Who reviewed (comments authored)</h2>'
    + '<p class="block-lede">Non-self comments authored by each reviewer across PRs in window. Load signal — not productivity.</p>'
    + '<div class="lollipop-wrap">'
    + '<div style="font-family:\'JetBrains Mono\',monospace;font-size:10.5px;letter-spacing:1.1px;text-transform:uppercase;color:var(--ink-faint);margin-bottom:6px">Reviewer leaderboard (this sprint)</div>'
    + rows
    + '</div>'
    + '</section>';
}

function renderPrSize(m, sectionId, activePartition) {
  const initial = activePartition || 'all';
  function renderForPartition(partition) {
    const buckets = partition === 'all' ? m.pr.sizeBuckets : m.pr.sizeBucketsByMode[partition];
    const totalPrs = buckets ? (buckets.Small + buckets.Medium + buckets.Large + buckets.XL) : 0;
    const sizeRow = ['Small', 'Medium', 'Large', 'XL'].map(k => {
      const cls = k === 'Small' ? 's' : (k === 'Medium' ? 'm' : (k === 'Large' ? 'l' : 'xl'));
      const pct = totalPrs ? (buckets[k] / totalPrs * 100).toFixed(0) : 0;
      return '<tr><td><span class="bucket ' + cls + '">' + k + '</span></td><td class="mono">'
        + (k === 'Small' ? '0-1' : k === 'Medium' ? '2-3' : k === 'Large' ? '4-7' : '8+') + '</td>'
        + '<td class="num">' + buckets[k] + '</td><td class="num">' + pct + '%</td></tr>';
    }).join('');
    const outliersList = m.pr.outliers.filter(p => partition === 'all' || (partition === 'ai' ? p.isAi : !p.isAi));
    const outliers = outliersList.map(p => '<tr>'
      + '<td><a href="' + prUrl(p.id) + '" target="_blank"><code>#' + p.id + '</code></a>' + aiBadge(p.isAi) + '</td>'
      + '<td>' + esc(p.title) + '</td>'
      + '<td>' + esc(p.createdBy) + '</td>'
      + '<td class="num">' + p.iterationCount + '</td>'
      + '<td class="num">' + p.commentCount + '</td>'
      + '</tr>').join('');
    return partitionToggleHtml(sectionId, partition)
      + '<table class="editorial">'
      + '<thead><tr><th>Bucket</th><th>Iterations</th><th class="num">PRs</th><th class="num">% of total</th></tr></thead>'
      + '<tbody>' + sizeRow + '</tbody>'
      + '</table>'
      + (outliersList.length ? '<h3 style="font-family:\'Inter\',sans-serif;font-size:18px;margin:18px 0 8px;font-weight:600;color:var(--ink);">Outliers (Large + XL)</h3>'
        + '<table class="editorial"><thead><tr><th>PR</th><th>Title</th><th>Author</th><th class="num">Iter</th><th class="num">Cmt</th></tr></thead><tbody>' + outliers + '</tbody></table>' : '');
  }
  return '<section class="block">'
    + '<div class="block-num">04d · PR size' + infoTipFor("04d · PR size") + '</div>'
    + '<h2 class="block-title">Shipping in what increments</h2>'
    + '<p class="block-lede">Bucketed by iteration count (pushes after PR open). AI / Human toggle re-partitions the distribution.</p>'
    + '<div id="' + sectionId + '">' + renderForPartition(initial) + '</div>'
    + '</section>';
}

function renderClusterCycleTime(m, sectionId, activePartition) {
  if (!m.clusterCycleTime) return '';
  const initial = activePartition || 'all';
  function renderForPartition(partition) {
    const data = m.clusterCycleTime[partition];
    if (!data || data.sampleSize === 0) {
      return partitionToggleHtml(sectionId, partition)
        + '<p class="muted">No cluster cycle-time data in this partition.</p>';
    }
    const dist = data.distribution.slice().sort((a, b) => (b.cycleSeconds || 0) - (a.cycleSeconds || 0));
    const rows = dist.slice(0, 10).map(d => '<tr>'
      + '<td class="mono"><a href="' + workItemUrl(d.featureId) + '" target="_blank">#' + d.featureId + '</a>' + aiBadge(d.isAi) + '</td>'
      + '<td class="num">' + d.prCount + '</td>'
      + '<td class="num">' + fmtHours((d.cycleSeconds || 0) / 3600) + '</td>'
      + '</tr>').join('');
    return partitionToggleHtml(sectionId, partition)
      + '<div class="kpi-grid">'
      + '<div class="kpi"><div class="lbl">Median cycle</div><div class="val">' + fmtHours(data.median) + '</div></div>'
      + '<div class="kpi"><div class="lbl">Mean cycle</div><div class="val">' + fmtHours(data.mean) + '</div></div>'
      + '<div class="kpi"><div class="lbl">P90 cycle</div><div class="val">' + fmtHours(data.p90) + '</div></div>'
      + '<div class="kpi"><div class="lbl">Sample size</div><div class="val">' + data.sampleSize + '</div><div class="sub muted">' + data.inFlightCount + ' in flight · ' + data.brokenCount + ' broken</div></div>'
      + '</div>'
      + (rows ? '<h4 style="margin-top:18px">Slowest clusters</h4>'
        + '<table class="editorial"><thead><tr><th>Feature</th><th class="num">PR count</th><th class="num">Cycle</th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table>' : '');
  }
  return '<section class="block">'
    + '<div class="block-num">05 · Cluster cycle-time' + infoTipFor("05 · Cluster cycle-time") + '</div>'
    + '<h2 class="block-title">Per-Feature delivery time (multi-PR aware)</h2>'
    + '<p class="block-lede">From first PR open to last PR merge across all PRs in a Feature\'s cluster. Single-PR Features degenerate to standard PR cycle. Toggle AI / Human to compare.</p>'
    + '<div id="' + sectionId + '">' + renderForPartition(initial) + '</div>'
    + '</section>';
}

function renderLayerMetrics(m, prevM) {
  let html = '<section class="block">'
    + '<div class="block-num">06 · Layer metrics' + infoTipFor("06 · Layer metrics") + '</div>'
    + '<h2 class="block-title">Per-layer deployment + CFR + MTTR</h2>';
  if (!layers.length) {
    html += '<p class="muted">No layers declared. Adopters configure layers in <code>project-profile.md</code>\'s <code>Layers</code> section.</p>';
  } else {
    html += '<table class="editorial"><thead><tr><th>Layer</th><th class="num">Total</th><th class="num">Succeeded</th><th class="num">Failed</th><th class="num">CFR (all)</th><th class="num">CFR (AI)</th><th class="num">CFR (Human)</th></tr></thead><tbody>';
    for (const layer of layers) {
      const dep = m.deployByLayer[layer.name] || { total: 0, succeeded: 0, failed: 0 };
      const cfr = m.cfrByLayer[layer.name] || { all: {}, ai: {}, human: {} };
      function cfrCell(p) {
        if (p.confidence === 'no-signal') return noSignalPill(p);
        return p.rate != null ? (p.rate * 100).toFixed(1) + '%' : '—';
      }
      html += '<tr><td>' + esc(layer.name) + '</td>'
        + '<td class="num">' + dep.total + '</td>'
        + '<td class="num">' + dep.succeeded + '</td>'
        + '<td class="num">' + dep.failed + '</td>'
        + '<td class="num">' + cfrCell(cfr.all) + '</td>'
        + '<td class="num">' + cfrCell(cfr.ai) + '</td>'
        + '<td class="num">' + cfrCell(cfr.human) + '</td>'
        + '</tr>';
    }
    html += '</tbody></table>';
    function mttrCell(leaf) {
      if (leaf && leaf.confidence === 'no-signal') return noSignalPill(leaf);
      return fmtHours(leaf ? leaf.p50 : null);
    }
    html += '<div class="kpi-grid">'
      + '<div class="kpi"><div class="lbl">MTTR P50 (all)</div><div class="val">' + mttrCell(m.mttr.all) + '</div><div class="sub muted">' + m.mttr.all.count + ' prod bugs</div></div>'
      + '<div class="kpi"><div class="lbl">MTTR P50 (AI)</div><div class="val">' + mttrCell(m.mttr.ai) + '</div><div class="sub muted">' + m.mttr.ai.count + ' AI prod bugs</div></div>'
      + '<div class="kpi"><div class="lbl">MTTR P50 (Human)</div><div class="val">' + mttrCell(m.mttr.human) + '</div><div class="sub muted">' + m.mttr.human.count + ' Human prod bugs</div></div>'
      + '</div>';
  }
  if (subRepos && subRepos.length) {
    html += '<h3 style="margin-top:18px">Per sub-repo (polyrepo)</h3>'
      + '<p class="muted" style="font-size:12px">Per-sub-repo funnel + pipeline aggregation. See snapshot funnels[].scope=sub-repo.</p>';
  }
  if (m.deployByTarget) {
    html += '<h3 style="margin-top:18px">Per deployment target</h3>'
      + '<table class="editorial"><thead><tr><th>Target</th><th class="num">Events</th><th class="num">AI</th><th class="num">Human</th></tr></thead><tbody>';
    for (const [target, d] of Object.entries(m.deployByTarget)) {
      html += '<tr><td>' + esc(target) + '</td>'
        + '<td class="num">' + d.eventCount + '</td>'
        + '<td class="num">' + d.byMode.ai + '</td>'
        + '<td class="num">' + d.byMode.human + '</td>'
        + '</tr>';
    }
    html += '</tbody></table>';
  }
  html += '</section>';
  return html;
}

function renderQualityCycleTimes(m, sectionId, activePartition) {
  const q = m.qualityCycleTimes;
  if (!q) return '';
  const initial = activePartition || 'all';
  function renderForPartition(partition) {
    function pcRow(label, leaf) {
      if (!leaf || !leaf[partition]) return '';
      const v = leaf[partition];
      const noSignal = v.confidence === 'no-signal';
      const p50Cell = noSignal ? noSignalPill(v) : fmtHours(v.p50);
      const p90Cell = noSignal ? '<span class="muted">—</span>' : fmtHours(v.p90);
      return '<tr><td>' + esc(label) + '</td>'
        + '<td class="num">' + p50Cell + '</td>'
        + '<td class="num">' + p90Cell + '</td>'
        + '<td class="num">' + v.count + '</td>'
        + '</tr>';
    }
    let html = partitionToggleHtml(sectionId, partition)
      + '<table class="editorial">'
      + '<thead><tr><th>Transition</th><th class="num">P50</th><th class="num">P90</th><th class="num">Sample</th></tr></thead>'
      + '<tbody>';
    if (q.requirement) {
      html += pcRow('Requirement: New → Active', q.requirement.newToActive);
      html += pcRow('Requirement: Active → Resolved', q.requirement.activeToResolved);
      html += pcRow('Requirement: total cycle', q.requirement.totalCycle);
      html += pcRow('Requirement Resolved → next Spec created', q.requirement.resolvedToNextSpecCreated);
    }
    if (q.spec) {
      html += pcRow('Spec: New → Active', q.spec.newToActive);
      html += pcRow('Spec: Active → Resolved', q.spec.activeToResolved);
      html += pcRow('Spec: total cycle', q.spec.totalCycle);
      html += pcRow('Spec Resolved → first Feature created', q.spec.resolvedToFirstFeatureCreated);
    }
    if (q.feature) {
      html += pcRow('Feature: New → Active', q.feature.newToActive);
      html += pcRow('Feature: Active → Resolved', q.feature.activeToResolved);
      html += pcRow('Feature: total cycle', q.feature.totalCycle);
      html += pcRow('Feature created → first Task active', q.feature.createdToFirstTaskActive);
    }
    if (q.story) {
      html += pcRow('Story: New → Active', q.story.newToActive);
      html += pcRow('Story: Active → Resolved', q.story.activeToResolved);
      html += pcRow('Story: total cycle', q.story.totalCycle);
    }
    if (q.task) {
      html += pcRow('Task: New → Active', q.task.newToActive);
      html += pcRow('Task: Active → Closed', q.task.activeToClosed);
      html += pcRow('Task: total cycle', q.task.totalCycle);
    }
    html += '</tbody></table>';
    return html;
  }
  return '<section class="block">'
    + '<div class="block-num">07 · Quality cycle-times' + infoTipFor("07 · Quality cycle-times") + '</div>'
    + '<h2 class="block-title">Pipeline velocity through state transitions</h2>'
    + '<p class="block-lede">Per-type cycle times at each state transition + cross-type hops. Higher-order types partition by AI-executed (descendant Tasks majority); Tasks partition by native AI tag.</p>'
    + '<div id="' + sectionId + '">' + renderForPartition(initial) + '</div>'
    + '</section>';
}

function renderDataQuality(m) {
  const dq = m.dq;
  function dqRow(label, d) {
    if (!d) return '';
    const pct = d.pct;
    const cls = pct >= 0.8 ? 'focused' : (pct >= 0.5 ? 'moderate' : 'lonewolf');
    return '<tr><td>' + esc(label) + '</td><td class="num">' + d.covered + '</td><td class="num">' + d.total + '</td><td class="num">' + fmtPct(pct) + '</td><td><span class="sig ' + cls + '">' + (pct >= 0.8 ? 'OK' : pct >= 0.5 ? 'partial' : 'low') + '</span></td></tr>';
  }
  const flags = dq.flags || {};
  const flagRows = [];
  if (flags.revisions_unavailable) flagRows.push('<li><strong>revisions_unavailable:</strong> work-item revisions missing; cycle-time hops degrade to state-change-date-only.</li>');
  if (flags.pr_threads_unavailable) flagRows.push('<li><strong>pr_threads_unavailable:</strong> PR-iteration data missing; PR-size histogram degrades.</li>');
  if (flags.reverts_unavailable) flagRows.push('<li><strong>reverts_unavailable:</strong> git log unavailable; CFR computation degrades to bug-tagged-prod within 48h only.</li>');
  if (flags.cw_oe_degeneracy) flagRows.push('<li><strong>cw_oe_degeneracy:</strong> CompletedWork field appears filled with OriginalEstimate value rather than actual hours; AI Efficiency Ratio uses wall-clock as primary.</li>');
  if (flags.possible_missing_audit_share > 0.05) flagRows.push('<li><strong>possible_missing_audit_share:</strong> ' + (flags.possible_missing_audit_share * 100).toFixed(0) + '% of closed Tasks have wall-clock &lt; 1h with no AI signal. Possible missing tagging.</li>');
  if (flags.pre_strap_human_backlog_share > 0.30) flagRows.push('<li><strong>pre_strap_human_backlog_share:</strong> ' + (flags.pre_strap_human_backlog_share * 100).toFixed(0) + '% of Human work predates STRAP adoption. AI vs Human comparison includes legacy backlog work.</li>');

  return '<section class="block">'
    + '<div class="block-num">08 · Data quality' + infoTipFor("08 · Data quality") + '</div>'
    + '<h2 class="block-title">Field coverage feeding these metrics</h2>'
    + '<p class="block-lede">Honest signal. Low-coverage metrics shown as low, not hidden.</p>'
    + '<table class="editorial">'
    + '<thead><tr><th>Field</th><th class="num">Covered</th><th class="num">Total</th><th class="num">Coverage</th><th>Status</th></tr></thead>'
    + '<tbody>'
    + dqRow('Tasks with Activated date', dq.fieldCoverage.tasksWithActivatedDate)
    + dqRow('Tasks with OriginalEstimate', dq.fieldCoverage.tasksWithOriginalEstimate)
    + dqRow('Tasks with CompletedWork', dq.fieldCoverage.tasksWithCompletedWork)
    + dqRow('Tasks with wall-clock computable', dq.fieldCoverage.tasksWithWallclockComputable)
    + dqRow('Bugs with Environment', dq.fieldCoverage.bugsWithEnvironment)
    + dqRow('AI-tagged items', dq.fieldCoverage.aiTaggedItems)
    + dqRow('PR threads available', dq.fieldCoverage.prThreadsAvailable)
    + dqRow('Pipeline runs classified', dq.fieldCoverage.pipelineRunsClassified)
    + '</tbody></table>'
    + (flagRows.length ? '<div class="callout warn"><strong>Data quality flags:</strong><ul style="margin:6px 0 0 0;padding-left:18px">' + flagRows.join('') + '</ul></div>' : '')
    + '</section>';
}

/* ----------------------------------------------------------------------------
 * Sprint view assembly
 * --------------------------------------------------------------------------*/

function renderSprintView(idx) {
  const m = sprintMetrics[idx];
  const prevM = idx > 0 ? sprintMetrics[idx - 1] : null;
  const sectionPrSize = 'pr-size-sprint-' + idx;
  const sectionCluster = 'cluster-cycle-sprint-' + idx;
  const sectionQuality = 'quality-cycles-sprint-' + idx;

  const head = '<div class="hero">'
    + '<div class="kicker">Sprint ' + (idx + 1) + ' · ' + m.window.start.slice(0, 10) + ' to ' + m.window.end.slice(0, 10) + '</div>'
    + '<h1>' + esc(m.name) + ' <em>· in review</em></h1>'
    + '<p class="lede">' + m.counts.tasksClosed + ' tasks closed · ' + m.counts.prsIntCompleted + ' integration PRs merged · ' + m.counts.prsInterm + ' intermediate PRs · ' + m.counts.bugs + ' bugs · AI Efficiency P50 ' + (m.ai.all.p50 != null ? m.ai.all.p50.toFixed(2) + 'x' : '—') + '.</p>'
    + '</div>';

  return '<div class="view" id="view-sprint-' + idx + '">'
    + head
    + renderDoraStrip(m, prevM)
    + renderAiHero(m, prevM)
    + renderAiVsHumanGlance(m, prevM)
    + renderKpiStrip(m, prevM)
    + renderSprintContents(m)
    + renderDevTable(m)
    + renderPrSubmitted(m)
    + renderPrWeight(m)
    + renderPrReviewers(m)
    + renderPrSize(m, sectionPrSize)
    + renderClusterCycleTime(m, sectionCluster)
    + renderLayerMetrics(m, prevM)
    + renderQualityCycleTimes(m, sectionQuality)
    + renderDataQuality(m)
    + '</div>';
}

/* ----------------------------------------------------------------------------
 * Comparison view
 * --------------------------------------------------------------------------*/

function renderVerdicts() {
  if (!verdicts) return '';
  function card(kind, label, v) {
    if (!v) return '';
    return '<div class="verdict ' + kind + '">'
      + '<div class="v-label ' + kind + '">' + esc(label) + '</div>'
      + '<div class="v-headline">' + esc(v.headline) + '</div>'
      + (v.context ? '<div class="v-context">' + esc(v.context) + '</div>' : '')
      + (v.detail ? '<div class="v-detail">' + esc(v.detail) + '</div>' : '')
      + (v.action ? '<div class="v-action">' + esc(v.action) + '</div>' : '')
      + '</div>';
  }
  return '<section class="block"><div class="block-num">A · Editorial verdicts' + infoTipFor("A · Editorial verdicts") + '</div>'
    + '<h2 class="block-title">Read this first</h2>'
    + '<div class="verdict-grid">'
    + card('good', 'Milestone', verdicts.milestone)
    + card('watch', 'Watch', verdicts.watch)
    + card('context', 'Context', verdicts.context)
    + '</div>'
    + '</section>';
}

function renderInactiveMembersBlock() {
  if (!inactiveMembers || !inactiveMembers.length) return '';
  return '<section class="block">'
    + '<div class="block-num">B · Roster note' + infoTipFor("B · Roster note") + '</div>'
    + '<h2 class="block-title">Team members inactive in window</h2>'
    + '<div class="aging-grid">'
    + inactiveMembers.map(p => {
      const lastDate = p.lastActivityDate ? p.lastActivityDate.slice(0, 10) : 'no record';
      return '<div class="aging-card">'
        + '<div class="ac-label">Inactive</div>'
        + '<div style="font-family:\'Inter\',sans-serif;font-weight:600;font-size:18px;color:var(--ink);margin-top:4px">' + esc(p.name) + '</div>'
        + '<div class="ac-items"><div class="ac-item"><div class="ai-title">Last activity</div><div class="ai-meta">' + lastDate + '</div></div></div>'
        + '</div>';
    }).join('')
    + '</div>'
    + '</section>';
}

function renderAgentAttribution() {
  if (!agentAttribution || !agentAttribution.available) {
    return '<section class="block">'
      + '<div class="block-num">C · Agent attribution' + infoTipFor("C · Agent attribution") + '</div>'
      + '<h2 class="block-title">Per-agent contribution</h2>'
      + '<p class="muted">' + esc(agentAttribution && agentAttribution.message ? agentAttribution.message : 'No agent attribution available.') + '</p>'
      + '</section>';
  }
  const rows = Object.entries(agentAttribution.byAgent).map(([role, info]) => '<tr>'
    + '<td>' + esc(role) + '</td>'
    + '<td class="num">' + info.tasks + '</td>'
    + '<td class="num">' + (info.aiP50 != null ? info.aiP50.toFixed(2) + 'x' : '—') + '</td>'
    + '</tr>').join('');
  return '<section class="block">'
    + '<div class="block-num">C · Agent attribution' + infoTipFor("C · Agent attribution") + '</div>'
    + '<h2 class="block-title">Per-agent contribution across ' + SPRINT_N + ' sprints</h2>'
    + '<table class="editorial">'
    + '<thead><tr><th>Agent role</th><th class="num">Tasks closed</th><th class="num">AI Eff P50</th></tr></thead>'
    + '<tbody>' + rows + '</tbody>'
    + '</table>'
    + '</section>';
}

function renderPipelineFunnel(sectionId, activePartition) {
  const initial = activePartition || 'all';
  function renderForPartition(partition) {
    const hops = [
      { stage: 'Req New → Active', src: m => m.funnel.itemCycles.requirement.newToActive },
      { stage: 'Req Active → Resolved', src: m => m.funnel.itemCycles.requirement.activeToResolved },
      { stage: 'Req Resolved → Spec created', src: m => m.funnel.crossStage.reqToSpec },
      { stage: 'Spec New → Active', src: m => m.funnel.itemCycles.spec.newToActive },
      { stage: 'Spec Active → Resolved', src: m => m.funnel.itemCycles.spec.activeToResolved },
      { stage: 'Spec Resolved → Feature created', src: m => m.funnel.crossStage.specToFeature },
      { stage: 'Feature created → Active', src: m => m.funnel.itemCycles.feature.createdToActive },
      { stage: 'Feature created → first Task active', src: m => m.funnel.crossStage.featureCreatedToFirstTask },
      { stage: 'Story created → Active', src: m => m.funnel.itemCycles.story.createdToActive },
      { stage: 'Story Active → Resolved', src: m => m.funnel.itemCycles.story.activeToResolved },
      { stage: 'Task created → Active', src: m => m.funnel.itemCycles.task.createdToActive },
      { stage: 'Task Active → Closed', src: m => m.funnel.itemCycles.task.activeToClosed },
    ];
    function pick(s) {
      if (!s) return { count: 0, p50: null };
      if (partition === 'ai') return s.ai || s[partition] || { count: 0, p50: null };
      if (partition === 'human') return s.human || s.nonAi || { count: 0, p50: null };
      return s.all || { count: 0, p50: null };
    }
    const sprintHeaders = sprintMetrics.map(m => '<th class="num"><small>' + esc(m.name) + '</small></th>').join('');
    const rows = hops.map(hop => {
      const perSprint = sprintMetrics.map(m => pick(hop.src(m)));
      const cells = perSprint.map(s => '<td class="num">' + (s.p50 != null ? fmtHours(s.p50) + ' <small>(' + s.count + ')</small>' : '—') + '</td>').join('');
      return '<tr><td>' + esc(hop.stage) + '</td>' + cells + '</tr>';
    }).join('');
    return partitionToggleHtml(sectionId, partition)
      + '<table class="editorial">'
      + '<thead><tr><th>Stage</th>' + sprintHeaders + '</tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '</table>';
  }
  return '<section class="block">'
    + '<div class="block-num">D · Pipeline funnel' + infoTipFor("D · Pipeline funnel") + '</div>'
    + '<h2 class="block-title">Median time per stage</h2>'
    + '<p class="block-lede">12 hops covering Requirement → Spec → Feature → Story → Task lineage. Sample size in parens. Toggle partitions cycle times by AI / Human / All.</p>'
    + '<div id="' + sectionId + '">' + renderForPartition(initial) + '</div>'
    + '</section>';
}

/** Compute the four DORA metrics for a single sprint. Returns:
 *    { df: { value, label, unit, help },
 *      lt: { value, unit, help },
 *      cfr: { rate, denominator, confidence, help },
 *      mttr: { value, count, confidence, help } }
 *  Each value is null when not computable for the sprint. */
function computeDoraFour(m) {
  // Deployment Frequency: total deploys in window (across all layers / targets)
  let deployTotal = 0;
  if (m.deployByTarget) {
    for (const t of Object.values(m.deployByTarget)) deployTotal += (t.eventCount || 0);
  }
  if (!deployTotal && m.deployByLayer) {
    for (const l of Object.values(m.deployByLayer)) deployTotal += (l.total || 0);
  }
  const dfLabel = m.deployByTarget ? 'Deployments' : 'Pipeline runs';
  const dfHelp = m.deployByTarget
    ? 'Deployment Frequency: total events emitted across all configured deployment_targets in the sprint window. Higher = the team is shipping changes to production more often. DORA categorizes: Elite >1/day, High weekly, Medium monthly, Low less than monthly.'
    : 'Deployment Frequency proxy: pipeline runs across declared Layers in the sprint window. The label switches to "Deployments" when deployment_targets are declared in devops-connection.yaml. Higher = the team is exercising the pipeline more often.';

  // Lead Time for Changes: PR cycle P50 (creation -> merge) as the canonical
  // STRAP measurement. The DORA original spec uses commit-to-deploy; PR cycle
  // is a tighter, more capturable proxy that correlates strongly.
  const lt = m.pr && m.pr.cycle && m.pr.cycle.all ? m.pr.cycle.all.p50 : null;
  const ltHelp = 'Lead Time for Changes: median time from PR creation to merge across integration PRs in window. STRAP uses PR cycle as the proxy for the DORA-canonical commit-to-deploy interval (which requires commit-deploy linkage data adopters may not have). Lower = changes flow faster from author to production. DORA: Elite less than one day, High between one day and one week, Medium between one week and one month, Low more than one month.';

  // Change Failure Rate: weighted average across layers (numerator + denominator
  // summed before dividing). Use the per-layer CFR.all blocks.
  let cfrNum = 0, cfrDen = 0, anyConfHigh = false;
  if (m.cfrByLayer) {
    for (const layer of Object.values(m.cfrByLayer)) {
      const p = layer.all;
      if (p) {
        cfrNum += (p.numerator || 0);
        cfrDen += (p.denominator || 0);
        if (p.confidence === 'high') anyConfHigh = true;
      }
    }
  }
  const cfrRate = cfrDen > 0 ? cfrNum / cfrDen : null;
  // Apply the same no-signal logic as per-layer using the aggregate denominator.
  const cfrFloor = (m.cfrByLayer && Object.values(m.cfrByLayer)[0] && Object.values(m.cfrByLayer)[0].all
                    ? Object.values(m.cfrByLayer)[0].all.threshold : 3) || 3;
  const cfrConfidence = cfrDen < cfrFloor ? 'no-signal' : 'high';
  const cfrHelp = 'Change Failure Rate: percentage of deploys that cause a production incident -- (prod Bugs created in window + reverts) / total deploys. Weighted average across all declared Layers when multiple layers exist. Lower = deploys land cleanly. DORA: Elite + High 0-15%, Medium 16-30%, Low more than 30%.';

  // MTTR: from m.mttr.all (already partitioned)
  const mttrLeaf = m.mttr && m.mttr.all ? m.mttr.all : null;
  const mttrHelp = 'Mean Time To Restore: median time from prod-Bug creation to resolution. Lower = the team recovers from production failures faster. DORA: Elite less than one hour, High less than one day, Medium one day to one week, Low more than one week.';

  return {
    df:   { value: deployTotal,                       unit: '/ sprint', label: dfLabel,           help: dfHelp },
    lt:   { value: lt,                                                 unit: '',                   help: ltHelp },
    cfr:  { rate: cfrRate, denominator: cfrDen, threshold: cfrFloor, confidence: cfrConfidence,   help: cfrHelp },
    mttr: { value: mttrLeaf ? mttrLeaf.p50 : null, count: mttrLeaf ? mttrLeaf.count : 0, confidence: mttrLeaf ? mttrLeaf.confidence : 'no-signal', threshold: mttrLeaf ? mttrLeaf.threshold : 5, help: mttrHelp },
  };
}

/** DORA-4 metrics strip for a single sprint. Shows the four headline DORA
 *  values with sprint-over-sprint delta pills (or "N/A" when prevM absent).
 *  Each card carries an info-tip with the DORA definition + categorization. */
function renderDoraStrip(m, prevM) {
  const cur = computeDoraFour(m);
  const prev = prevM ? computeDoraFour(prevM) : null;

  function deltaText(currV, prevV, inverse) {
    if (currV == null || prevV == null || prevV === 0) {
      return '<span class="delta-pill neutral" title="No prior sprint to compare against">N/A</span>';
    }
    return deltaPill(currV, prevV, { inverse: !!inverse });
  }

  // Deployment frequency card
  const dfCard = '<div class="dora-card">'
    + '<div class="dora-card-head">'
      + '<div class="dora-card-lbl">Deployment Frequency</div>'
      + infoTip(cur.df.help)
    + '</div>'
    + '<div class="dora-card-val">' + cur.df.value + ' <span class="dora-card-unit">' + esc(cur.df.label) + '</span></div>'
    + '<div class="dora-card-delta">' + deltaText(cur.df.value, prev ? prev.df.value : null, false) + '</div>'
    + '</div>';

  // Lead Time card
  const ltCard = '<div class="dora-card">'
    + '<div class="dora-card-head">'
      + '<div class="dora-card-lbl">Lead Time for Changes</div>'
      + infoTip(cur.lt.help)
    + '</div>'
    + '<div class="dora-card-val">' + (cur.lt.value != null ? fmtHours(cur.lt.value) : '<span class="muted">—</span>') + '</div>'
    + '<div class="dora-card-delta">' + deltaText(cur.lt.value, prev ? prev.lt.value : null, true) + '</div>'
    + '</div>';

  // CFR card
  let cfrValue;
  if (cur.cfr.confidence === 'no-signal') {
    cfrValue = noSignalPill({ count: cur.cfr.denominator, threshold: cur.cfr.threshold, thresholdKey: 'cfr_deploys' });
  } else {
    cfrValue = cur.cfr.rate != null ? (cur.cfr.rate * 100).toFixed(1) + '<span class="dora-card-unit">%</span>' : '<span class="muted">—</span>';
  }
  const cfrCard = '<div class="dora-card">'
    + '<div class="dora-card-head">'
      + '<div class="dora-card-lbl">Change Failure Rate</div>'
      + infoTip(cur.cfr.help)
    + '</div>'
    + '<div class="dora-card-val">' + cfrValue + '</div>'
    + '<div class="dora-card-delta">' + deltaText(cur.cfr.rate, prev ? prev.cfr.rate : null, true) + '</div>'
    + '</div>';

  // MTTR card
  let mttrValue;
  if (cur.mttr.confidence === 'no-signal') {
    mttrValue = noSignalPill({ count: cur.mttr.count, threshold: cur.mttr.threshold, thresholdKey: 'mttr_sample' });
  } else {
    mttrValue = cur.mttr.value != null ? fmtHours(cur.mttr.value) : '<span class="muted">—</span>';
  }
  const mttrCard = '<div class="dora-card">'
    + '<div class="dora-card-head">'
      + '<div class="dora-card-lbl">Mean Time To Restore</div>'
      + infoTip(cur.mttr.help)
    + '</div>'
    + '<div class="dora-card-val">' + mttrValue + '</div>'
    + '<div class="dora-card-delta">' + deltaText(cur.mttr.value, prev ? prev.mttr.value : null, true) + '</div>'
    + '</div>';

  return '<section class="block">'
    + '<div class="block-num">DORA · Four metrics' + infoTipFor('DORA · Four metrics') + '</div>'
    + '<h2 class="block-title">DORA-4 takeaway</h2>'
    + '<p class="block-lede">The four canonical DORA metrics for this sprint. Hover the <strong>ⓘ</strong> on each card for the definition + DORA-categorization bands. Sprint-over-sprint delta on each card; <code>N/A</code> when no prior sprint is in scope.</p>'
    + '<div class="dora-strip">' + dfCard + ltCard + cfrCard + mttrCard + '</div>'
    + '</section>';
}

/** DORA-4 metrics strip averaged across all included sprints (comparison view). */
function renderDoraStripSummary() {
  if (!sprintMetrics.length) return '';
  const perSprint = sprintMetrics.map(computeDoraFour);

  function avgDefined(arr) {
    const vals = arr.filter((v) => v != null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  const avgDf  = avgDefined(perSprint.map((d) => d.df.value));
  const avgLt  = avgDefined(perSprint.map((d) => d.lt.value));
  const avgCfr = avgDefined(perSprint.map((d) => d.cfr.rate));
  const avgMttr = avgDefined(perSprint.map((d) => d.mttr.value));

  // For the summary view, deltas compare the LAST sprint vs the FIRST sprint
  // -- "end of window vs start of window" rather than within-pair movement.
  const first = perSprint[0];
  const last = perSprint[perSprint.length - 1];

  function deltaText(currV, baselineV, inverse) {
    if (currV == null || baselineV == null || baselineV === 0) {
      return '<span class="delta-pill neutral" title="No baseline to compare against">N/A</span>';
    }
    return deltaPill(currV, baselineV, { inverse: !!inverse });
  }

  function card(label, headlineValue, deltaHtml, helpText) {
    return '<div class="dora-card">'
      + '<div class="dora-card-head">'
        + '<div class="dora-card-lbl">' + esc(label) + '</div>'
        + infoTip(helpText)
      + '</div>'
      + '<div class="dora-card-val">' + headlineValue + '</div>'
      + '<div class="dora-card-delta">' + deltaHtml + ' <small class="muted">end vs start</small></div>'
      + '</div>';
  }

  const dfVal = avgDf != null ? Math.round(avgDf * 10) / 10 + ' <span class="dora-card-unit">avg/sprint</span>' : '<span class="muted">—</span>';
  const ltVal = avgLt != null ? fmtHours(avgLt) + ' <small class="muted">avg</small>' : '<span class="muted">—</span>';
  const cfrVal = avgCfr != null ? (avgCfr * 100).toFixed(1) + '<span class="dora-card-unit">% avg</span>' : '<span class="muted">—</span>';
  const mttrVal = avgMttr != null ? fmtHours(avgMttr) + ' <small class="muted">avg</small>' : '<span class="muted">—</span>';

  return '<section class="block">'
    + '<div class="block-num">DORA · Four metrics across the window' + infoTipFor('DORA · Four metrics across the window') + '</div>'
    + '<h2 class="block-title">DORA-4 takeaway -- ' + SPRINT_N + '-sprint average</h2>'
    + '<p class="block-lede">The four canonical DORA metrics averaged across all included sprints. Sub-pill on each card compares the most-recent sprint to the first sprint in the window -- the "end vs start" trajectory across the period.</p>'
    + '<div class="dora-strip">'
    + card('Deployment Frequency', dfVal,  deltaText(last.df.value,  first.df.value,  false), last.df.help)
    + card('Lead Time for Changes', ltVal,  deltaText(last.lt.value,  first.lt.value,  true),  last.lt.help)
    + card('Change Failure Rate',  cfrVal, deltaText(last.cfr.rate, first.cfr.rate, true),  last.cfr.help)
    + card('Mean Time To Restore', mttrVal, deltaText(last.mttr.value, first.mttr.value, true), last.mttr.help)
    + '</div>'
    + '</section>';
}

/** Comparison-view sprint strip: a dense horizontal ribbon under the hero
 *  showing all included sprints with window ranges. The most-recent sprint
 *  highlights with the accent-soft fill. */
function renderSprintStrip() {
  if (!sprintMetrics.length) return '';
  const cells = sprintMetrics.map((m, i) => {
    const cls = i === sprintMetrics.length - 1 ? 'cell current' : 'cell';
    const range = (m.window.start || '').slice(5, 10) + '–' + (m.window.end || '').slice(5, 10);
    return '<div class="' + cls + '">'
      + '<div class="lbl">Sprint ' + (i + 1) + '</div>'
      + esc(m.name)
      + '<br><span style="color:var(--ink-faint);font-size:10.5px">' + esc(range) + '</span>'
      + '</div>';
  }).join('');
  return '<div class="sprint-strip">' + cells + '</div>';
}

/** Adopter-portable methodology reference. Documents every metric the engine
 *  renders + its formula + which PAYLOAD fields it consumes. Lands as a
 *  collapsed <details> at the end of the comparison view; expands on click.
 *  Adopter-generic by design -- no host/project/field-name specifics. */
function renderMethodology() {
  const rows = [
    ['AI Efficiency Ratio',
     'OriginalEstimate (hours) / wall-clock cycle hours (activated → closed/resolved). Computed per Task with non-null OriginalEstimate AND activated AND closed. Aggregated as P50 across eligible Tasks.',
     'Wall-clock primary per the v2.4 Q6 lock. Sample below the configured ai_eff_sample threshold renders the no-signal pill.'],
    ['AI / Human classifier (work items)',
     'Explicit-only union: hasAiTag === true OR hasStrapAgentAudit === true (at least one [STRAP/agent:*] comment-history audit line). Wall-clock heuristic does NOT classify; it surfaces only as a Data Quality flag.',
     'Per Q6 lock; demoted heuristic prevents over-classification of legitimately-fast human work.'],
    ['AI / Human classifier (PRs)',
     'Two-track model. Track 1 (binary lenient): isAi when authored-by-agent OR any linked work item is AI-driven; Track 2 (weighted): aiShare = AI-linked-WIs / total-linked-WIs (or 1.0 / 0.0 by authorship when zero linked WIs).',
     'Track 1 drives count + distribution metrics; Track 2 drives contribution share.'],
    ['Higher-order isAiExecuted',
     'For Requirement / Spec / Feature / Story: descendant-Task majority rule. isAiExecuted = (count of descendant Tasks where isAi === true) / (count of descendant Tasks) > 0.5. Null when zero descendant Tasks.',
     'Tasks use native isAi; higher-order types inherit via lineage.'],
    ['Change Failure Rate (CFR)',
     'rate = (prod Bugs created in window + reverts in window) / total deploys in layer in window. Per-layer; partitioned all/AI/Human.',
     'When denominator below the configured cfr_deploys threshold, the engine renders the no-signal pill instead of the rate.'],
    ['Mean Time To Restore (MTTR)',
     'P50 of (resolvedDate - createdDate) hours across prod Bugs with resolvedDate in window. Partitioned all/AI/Human.',
     'Sample below the configured mttr_sample threshold renders the no-signal pill.'],
    ['Lead Time / Quality cycle-times',
     'P50 + P90 of state-transition wall-clock hours per type per transition (e.g., Spec New→Active, Feature Active→Resolved, Task Active→Closed). Cross-type hops also computed (e.g., Spec resolved → first Feature created).',
     'Higher-order types partition by isAiExecuted; Task hops partition by native isAi. Sample below lead_time_sample threshold renders the no-signal pill.'],
    ['Cluster cycle-time',
     '(last PR merge in cluster) - (first PR open in cluster). One value per Feature whose linked PRs cluster (multi-PR Features). Single-PR Features degenerate to standard PR cycle.',
     'Polyrepo umbrellas with split-Feature delivery see honest end-to-end cycle here vs misleading per-PR cycle.'],
    ['Throughput by type',
     'Count of closed/resolved work items of each type whose closedDate/resolvedDate falls in window. Partitioned all/AI/Human using isAiExecuted for higher-order types, native isAi for atomic types (Task/Bug/Enhancement).',
     'Higher-order vs atomic distinction prevents double-counting attribution at the parent + descendant level.'],
    ['AI contribution share',
     'overall = mean(aiShare across PRs in window). byLayer / byTarget computed via PR-to-layer attribution.',
     'Weighted by Track 2 PR classifier; correlates with deliverable AI surface area, not just count.'],
    ['Developer signature',
     'Per-author classifier based on avgIter + avgCmt + intPrs distribution: Focused (avgIter ≤ 1.5) · Iterative (avgIter ≥ 4) · Lone-Wolf (low comment exchange) · Quick-Approver (moderate iter, low cmt) · Insufficient signal (zero output) · Moderate (default).',
     'Load + balance signal; never a performance ranking.'],
    ['PR weight',
     'commits, files_changed, lines_added, lines_deleted, lines_total, work_items, work_items_count per merged integration PR. Computed via local git diff against the integration target (opt-in via /dora-collect --with-git-diff-weight).',
     'Cached at .claude/strap/state/dora-collect-cache/pr-weights.json keyed by (host, pr_id, last_merge_commit). Cache hits skip the git-diff cost.'],
    ['STRAP-instrumented vs inherited Aging Alerts',
     'Items flagged STRAP-instrumented when (hasAiTag OR hasStrapAgentAudit) OR (tag matches any configured tag_prefix OR comment matches any configured comment_prefix OR any configured custom_field is set). Everything else = inherited backlog.',
     'Configurable via mapping.strap_instrumentation_signals in devops-connection.yaml. Inherited list collapses into details when more than 10 entries to keep the STRAP signal load-bearing.'],
    ['Confidence thresholds (no-signal pills)',
     'Per-metric thresholds in mapping.dora_confidence_thresholds: cfr_deploys, mttr_sample, lead_time_sample, ai_eff_sample. Defaults: 3 / 5 / 5 / 5. Below threshold → metric renders no-signal pill with the sample count + threshold inline.',
     'Setting any key to 0 disables that single threshold. Pills tooltip explain the suppression + point at the config knob.'],
    ['Auto-verdicts',
     'milestone = largest improvement vs prior sprint; watch = largest regression; context = data-quality / pre-STRAP-backlog awareness when applicable. Headlines direction-aware (up/down per actual value movement, not improvement vs regression).',
     'Overridden by --verdicts <file> when adopters want hand-authored editorial; --no-auto-verdicts suppresses entirely.'],
    ['Data Quality coverage',
     'Per-field covered/total/pct rollup of fields that feed the primary metrics (Tasks with Activated, Tasks with OriginalEstimate, Bugs with Environment, etc.). Below 60% coverage on a primary field surfaces a callout above the section.',
     'Drives the verdict.context card when degeneracies surface (cw_oe_degeneracy, revisions_unavailable, pre_strap_human_backlog_share > 30%).'],
  ];

  const tableRows = rows.map((r) => '<tr>'
    + '<td><strong>' + esc(r[0]) + '</strong></td>'
    + '<td>' + esc(r[1]) + '</td>'
    + '<td><small class="muted">' + esc(r[2]) + '</small></td>'
    + '</tr>').join('');

  return '<section class="block">'
    + '<div class="block-num">M · Methodology' + infoTipFor('M · Methodology') + '</div>'
    + '<h2 class="block-title">How the numbers are computed</h2>'
    + '<p class="block-lede">Adopter-portable reference for every metric the report renders. Formulas use generic field names (createdDate, activatedDate, etc.); your host\'s specific field names map via devops-connection.yaml. The full PAYLOAD contract lives at <code>.claude/strap/contexts/dora-report-engine-design.md</code>.</p>'
    + '<details class="appendix">'
    + '<summary>Open metrics reference</summary>'
    + '<table class="editorial">'
    + '<thead><tr><th>Metric</th><th>Formula</th><th>Notes</th></tr></thead>'
    + '<tbody>' + tableRows + '</tbody>'
    + '</table>'
    + '</details>'
    + '</section>';
}

/** Compact KPI card with inline sparkline + delta pill -- the "Five numbers"
 *  comparison-view summary uses this pattern (one per metric). */
function kpiCardSpark(label, ser, unit, fmt, opts) {
  opts = opts || {};
  const valid = (ser || []).filter((v) => v != null);
  if (!valid.length) return '';
  const curr = ser[ser.length - 1];
  const prev = ser.length > 1 ? ser[ser.length - 2] : null;
  const spark = sparklineSvg(ser, { color: opts.color || 'var(--accent-deep)' });
  return '<div class="kpi">'
    + '<div class="lbl">' + esc(label) + '</div>'
    + '<div class="val">' + (curr != null ? fmt(curr) : '—') + (unit ? '<span class="unit">' + unit + '</span>' : '') + '</div>'
    + '<div class="sub">' + spark + ' ' + deltaPill(curr, prev, { inverse: !!opts.inverse }) + '</div>'
    + '</div>';
}

/** Comparison-view "Five numbers" executive summary (block 0, top of view).
 *  Honors adopter portability: when no deploy signal exists, the 5th metric
 *  falls back from "Deploys" to "Abandon rate" (inverse) so the strip always
 *  renders five reliable cards. */
function renderComparisonKpiStrip() {
  const totalDeploysSeries = (function () {
    if (series.deploysByTarget) {
      const targets = Object.keys(series.deploysByTarget);
      if (targets.length) {
        const n = sprintMetrics.length;
        const out = new Array(n).fill(0);
        for (const t of targets) {
          const s = series.deploysByTarget[t] || [];
          for (let i = 0; i < n; i++) out[i] += s[i] || 0;
        }
        return { label: 'Deployments', series: out };
      }
    }
    const layerKeys = Object.keys(series.deploysByLayer || {});
    if (layerKeys.length) {
      const n = sprintMetrics.length;
      const out = new Array(n).fill(0);
      for (const k of layerKeys) {
        const s = series.deploysByLayer[k] || [];
        for (let i = 0; i < n; i++) out[i] += s[i] || 0;
      }
      return { label: 'Pipeline runs', series: out };
    }
    return null;
  })();

  const fifthCard = totalDeploysSeries
    ? kpiCardSpark(totalDeploysSeries.label, totalDeploysSeries.series, '', (v) => String(v == null ? 0 : v), { color: 'var(--accent-deep)' })
    : kpiCardSpark('Abandon rate', series.abandonPct, '', (v) => v != null ? (v * 100).toFixed(0) + '%' : '—', { color: 'var(--red-deep)', inverse: true });

  return '<section class="block">'
    + '<div class="block-num">0 · KPIs' + infoTipFor('0 · KPIs') + '</div>'
    + '<h2 class="block-title">Five numbers, ' + SPRINT_N_WORD + ' sprints</h2>'
    + '<p class="block-lede">Executive summary across the included sprints. Each card carries the headline value, an inline sparkline, and the sprint-over-sprint delta.</p>'
    + '<div class="kpi-grid">'
    + kpiCardSpark('AI Efficiency P50',  series.aiP50,        '×', (v) => v != null ? v.toFixed(2) : '—',           { color: 'var(--accent-deep)' })
    + kpiCardSpark('PRs to integration', series.prsCompleted, '',       (v) => String(v == null ? 0 : v),                    { color: 'var(--green-deep)' })
    + kpiCardSpark('Tasks closed',       series.tasksClosed,  '',       (v) => String(v == null ? 0 : v),                    { color: 'var(--blue-deep)' })
    + kpiCardSpark('PR cycle P50',       series.prCycleP50,   '',       fmtHours,                                            { color: 'var(--amber)', inverse: true })
    + fifthCard
    + '</div>'
    + '</section>';
}

/** Volume trend: per-metric vol-card with prominent inline sparkline + per-
 *  sprint value labels above each point. Each card scales to its own series
 *  (small-multiples) so signals at different magnitudes stay readable. */
function renderKpiSparklines() {
  const sprintShortLocal = sprintShort || sprintMetrics.map((m) => (m.name || '').slice(0, 3).toUpperCase());

  function volCard(label, ser, fmt, color, opts) {
    opts = opts || {};
    if (!ser || !ser.length) return '';
    const valid = ser.filter((v) => v != null);
    if (!valid.length) return '';
    const w = 220, h = 56;
    const min = Math.min(...valid), max = Math.max(...valid);
    const range = max - min || 1;
    const pts = ser.map((v, i) => {
      const denom = Math.max(1, ser.length - 1);
      const x = (i / denom) * (w - 14) + 7;
      const y = max === min ? h / 2 : h - 8 - ((v != null ? v : min) - min) / range * (h - 16);
      return { x, y, v };
    });
    const line = pts.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
    const dots = pts.map((p, i) => '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (i === pts.length - 1 ? 3.5 : 2.5) + '" fill="' + color + '"/>').join('');
    const labels = pts.map((p) => '<text x="' + p.x.toFixed(1) + '" y="' + (p.y - 7).toFixed(1) + '" text-anchor="middle" font-size="9" fill="var(--ink-soft)" font-family="JetBrains Mono">' + esc(fmt(p.v)) + '</text>').join('');
    const curr = ser[ser.length - 1];
    const prev = ser.length > 1 ? ser[ser.length - 2] : null;
    return '<div class="vol-card">'
      + '<div class="vc-label">' + esc(label) + '</div>'
      + '<div class="vc-vals"><div class="vc-current">' + esc(fmt(curr)) + '</div>' + deltaPill(curr, prev, { inverse: !!opts.inverse }) + '</div>'
      + '<svg viewBox="0 0 ' + w + ' ' + (h + 6) + '" preserveAspectRatio="none">'
      + '<polyline fill="none" stroke="' + color + '" stroke-width="1.6" points="' + line + '"/>'
      + dots + labels
      + '</svg>'
      + '<div class="vc-prior">' + esc(sprintShortLocal.join(' · ')) + '</div>'
      + '</div>';
  }
  return '<section class="block">'
    + '<div class="block-num">E · Trend sparklines' + infoTipFor("E · Trend sparklines") + '</div>'
    + '<h2 class="block-title">Throughput, sprint by sprint</h2>'
    + '<p class="block-lede">Each series has its own scale -- small-multiples avoid the "big numbers crush small numbers" trap on shared axes. Sprint short-codes run oldest → newest beneath each card.</p>'
    + '<div class="vol-grid">'
    + volCard('AI Efficiency P50',     series.aiP50,        (v) => v != null ? v.toFixed(2) + '×' : '—',         'var(--accent-deep)')
    + volCard('Tasks closed',           series.tasksClosed,  (v) => String(v == null ? 0 : v),                              'var(--blue-deep)')
    + volCard('PRs merged',             series.prsCompleted, (v) => String(v == null ? 0 : v),                              'var(--green-deep)')
    + volCard('PR cycle P50',           series.prCycleP50,   (v) => v != null ? (v < 24 ? v.toFixed(1) + 'h' : (v/24).toFixed(1) + 'd') : '—', 'var(--amber)', { inverse: true })
    + volCard('Integration PRs',        series.prsInt,       (v) => String(v == null ? 0 : v),                              'var(--azure)')
    + volCard('Abandon rate',           series.abandonPct,   (v) => v != null ? (v * 100).toFixed(0) + '%' : '—',     'var(--red-deep)', { inverse: true })
    + ((series.clusterCycleP50 || []).some((v) => v != null) ? volCard('Cluster cycle P50', series.clusterCycleP50, (v) => v != null ? (v < 24 ? v.toFixed(1) + 'h' : (v/24).toFixed(1) + 'd') : '—', 'var(--accent)', { inverse: true }) : '')
    + '</div>'
    + '</section>';
}

function renderMovementBlock() {
  const maxImp = Math.max(1, ...movement.improvements.map((r) => r.mag || Math.abs(r.deltaPct) || 0));
  const maxReg = Math.max(1, ...movement.regressions.map((r) => r.mag || Math.abs(r.deltaPct) || 0));
  function row(r, kind) {
    const max = kind === 'good' ? maxImp : maxReg;
    const widthPx = Math.max(2, ((r.mag || Math.abs(r.deltaPct)) / max) * 200);
    return '<div class="hh-row">'
      + '<div>'
        + '<div class="hh-name">' + esc(r.name) + '<small>' + fmtNum(r.from) + ' → ' + fmtNum(r.to) + '</small></div>'
        + '<div class="hh-bar-wrap"><div class="hh-bar ' + kind + '" style="width:' + widthPx.toFixed(1) + 'px"></div></div>'
      + '</div>'
      + '<div class="hh-pct ' + kind + '">' + (r.deltaPct >= 0 ? '+' : '') + r.deltaPct.toFixed(0) + '%</div>'
      + '</div>';
  }
  const lastM = sprintMetrics[sprintMetrics.length - 1];
  const prevM = sprintMetrics.length > 1 ? sprintMetrics[sprintMetrics.length - 2] : null;
  const lede = prevM ? esc(lastM.name) + ' vs ' + esc(prevM.name) + '. Bars sized by magnitude (largest mover longest). Direction is color, not value -- improvements green, regressions red.' : 'Movement renders once a second sprint lands.';
  return '<section class="block">'
    + '<div class="block-num">F · Sprint-over-sprint movement' + infoTipFor("F · Sprint-over-sprint movement") + '</div>'
    + '<h2 class="block-title">What got better, what got worse</h2>'
    + '<p class="block-lede">' + lede + '</p>'
    + '<div class="hh-split">'
    + '<div class="hh-col good"><div class="hh-head good">Improvements ↑</div>'
    + (movement.improvements.length ? movement.improvements.map((r) => row(r, 'good')).join('') : '<p class="muted" style="font-size:13px">No major improvements this sprint.</p>')
    + '</div>'
    + '<div class="hh-col bad"><div class="hh-head bad">Regressions ↓</div>'
    + (movement.regressions.length ? movement.regressions.map((r) => row(r, 'bad')).join('') : '<p class="muted" style="font-size:13px">No major regressions this sprint.</p>')
    + '</div>'
    + '</div>'
    + '</section>';
}

function renderDeployHeatmap() {
  if (!layers.length) return '';
  // Compute the team-wide max total runs across all layer × sprint cells; drives
  // per-cell color-intensity scaling.
  let maxRuns = 0;
  for (const m of sprintMetrics) {
    for (const layer of layers) {
      const d = m.deployByLayer[layer.name];
      if (d && d.total > maxRuns) maxRuns = d.total;
    }
  }
  maxRuns = Math.max(1, maxRuns);

  const headerCells = sprintMetrics.map((m) => '<th><small>' + esc(m.name) + '</small></th>').join('');
  const rows = layers.map((layer) => {
    const cells = sprintMetrics.map((m) => {
      const d = m.deployByLayer[layer.name];
      if (!d || d.total === 0) return '<td class="cell empty">—</td>';
      const intensity = Math.min(1, d.total / maxRuns);
      // Light-theme: blue-soft fill scaling from 0.08 alpha (cool) to 0.38 (saturated).
      // Dark-theme inherits via CSS opacity blending.
      const bg = 'rgba(91,135,217,' + (0.08 + intensity * 0.30).toFixed(2) + ')';
      const failBar = d.failed > 0 ? '<span class="fail">' + d.failed + ' failed</span>' : '';
      return '<td class="cell" style="background:' + bg + '">' + d.total + failBar + '</td>';
    }).join('');
    return '<tr><td class="layer">' + esc(layer.name) + '</td>' + cells + '</tr>';
  }).join('');
  return '<section class="block">'
    + '<div class="block-num">G · Deploy heatmap' + infoTipFor("G · Deploy heatmap") + '</div>'
    + '<h2 class="block-title">Where the deploys went</h2>'
    + '<p class="block-lede">Pipeline runs by layer × sprint. Cell value is total runs; the red <code>N failed</code> marker calls out failures inline. Cell background intensity scales with run volume relative to the team max -- darker cells are heavier traffic.</p>'
    + '<div class="heatmap-wrap">'
    + '<table class="heat-grid"><thead><tr><th class="layer">Layer</th>' + headerCells + '</tr></thead>'
    + '<tbody>' + rows + '</tbody></table>'
    + '</div>'
    + '</section>';
}

function renderDevSpine() {
  if (!trendByDev.length || !devTotals.length) return '';
  const filters = [
    { key: 'all',      label: 'All' },
    { key: 'prs',      label: 'PRs' },
    { key: 'drafts',   label: 'PRs Draft' },
    { key: 'tasks',    label: 'Tasks' },
    { key: 'higher',   label: 'Higher items' },
    { key: 'comments', label: 'Review comments' },
    { key: 'iter',     label: 'Iterations' },
  ];

  const sprintLabelsLocal = sprintMetrics.map((m) => m.name);

  function statsFor(getter) {
    const vals = devTotals.map(getter);
    return { max: Math.max(...vals), min: Math.min(...vals), vals };
  }
  const metricStats = {
    prs:      statsFor((d) => d.prs || 0),
    interm:   statsFor((d) => d.interm || 0),
    drafts:   statsFor((d) => d.drafts || 0),
    tasks:    statsFor((d) => d.tasks || 0),
    higher:   statsFor((d) => d.higher || 0),
    comments: statsFor((d) => d.comments || 0),
  };

  /** Uniform-width spine bar: every segment is the same horizontal slice;
   *  magnitude is shown as a numeric badge inside each segment and a totals
   *  badge on the right (colored green for team-max, red for team-min when
   *  the metric has spread). */
  function stackedBar(total, perSprint, stats) {
    const hasSpread = stats.max > stats.min;
    let badgeCls = 'sb-total';
    if (hasSpread) {
      if (total === stats.max) badgeCls += ' sb-total-high';
      else if (total === stats.min) badgeCls += ' sb-total-low';
    }
    if (total === 0 && stats.max === 0) return '<div class="sb-empty">—</div>';
    const segs = (perSprint || []).map((v, i) => {
      const colorIdx = Math.min(i, 2);
      return '<div class="sb-seg sb-seg-' + colorIdx + ' sb-seg-uniform" title="' + esc(sprintLabelsLocal[i] || '') + ': ' + (v || 0) + '">'
        + '<span class="sb-seg-n">' + (v || 0) + '</span>'
        + '</div>';
    }).join('');
    return '<div class="sb-row">'
      + '<div class="sb-track sb-track-full">' + segs + '</div>'
      + '<div class="' + badgeCls + '">' + total + '</div>'
      + '</div>';
  }

  const totalsRowsHtml = devTotals.map((d) => {
    const r = trendByDev.find((x) => x.name === d.name) || { prs: [], interm: [], drafts: [], tasks: [], higher: [], comments: [], maxIter: [] };
    const peakIter = (r.maxIter || []).reduce((a, b) => Math.max(a, b || 0), 0);
    return '<tr>'
      + '<td class="sb-name">' + esc(d.name) + '</td>'
      + '<td class="sb-cell" data-col="prs">'      + stackedBar(d.prs || 0,      r.prs,      metricStats.prs)      + '</td>'
      + '<td class="sb-cell" data-col="interm">'   + stackedBar(d.interm || 0,   r.interm,   metricStats.interm)   + '</td>'
      + '<td class="sb-cell" data-col="drafts">'   + stackedBar(d.drafts || 0,   r.drafts,   metricStats.drafts)   + '</td>'
      + '<td class="sb-cell" data-col="tasks">'    + stackedBar(d.tasks || 0,    r.tasks,    metricStats.tasks)    + '</td>'
      + '<td class="sb-cell" data-col="higher">'   + stackedBar(d.higher || 0,   r.higher,   metricStats.higher)   + '</td>'
      + '<td class="sb-cell" data-col="comments">' + stackedBar(d.comments || 0, r.comments, metricStats.comments) + '</td>'
      + '<td class="num mono" data-col="iter">' + (peakIter || '—') + '</td>'
      + '</tr>';
  }).join('');

  const sprintLegend = sprintMetrics.map((m, i) => {
    const colorIdx = Math.min(i, 2);
    return '<span class="sb-leg-item"><span class="sb-leg-sw sb-seg-' + colorIdx + '"></span>' + esc(m.name) + '</span>';
  }).join('');

  return '<section class="block">'
    + '<div class="block-num">H · Per-developer spine' + infoTipFor("H · Per-developer spine") + '</div>'
    + '<h2 class="block-title">Who shipped what, across ' + SPRINT_N + ' sprints</h2>'
    + '<p class="block-lede">Each cell\'s bar is the same width for cross-column comparison; magnitude lives in the badge on the right. The bar is split into ' + SPRINT_N + ' uniform segments — one per sprint, oldest → newest left-to-right per the legend below. The total badge is colored <strong style="color:var(--green-deep)">green</strong> for the team-max in that metric and <strong style="color:var(--red-deep)">red</strong> for the team-min when there\'s spread.</p>'
    + '<div class="sb-legend">' + sprintLegend + '<span class="sb-leg-note">oldest → newest, left to right</span></div>'
    + '<div class="dev-table-toolbar" id="dev-filter-bar">'
    + filters.map((f, i) => '<button class="dev-filter' + (i === 0 ? ' active' : '') + '" data-filter="' + f.key + '">' + esc(f.label) + '</button>').join('')
    + '</div>'
    + '<div id="dev-spine-content">'
    + '<table class="editorial sb-table">'
    + '<thead><tr>'
    + '<th>Developer</th>'
    + '<th data-col="prs">Integration PRs<br><small style="color:var(--ink-faint)">non-draft</small></th>'
    + '<th data-col="interm">Intermediate PRs</th>'
    + '<th data-col="drafts">Drafts in flight</th>'
    + '<th data-col="tasks">Tasks closed</th>'
    + '<th data-col="higher">Higher items closed</th>'
    + '<th data-col="comments">Review comments authored</th>'
    + '<th data-col="iter" class="num">Peak iter</th>'
    + '</tr></thead>'
    + '<tbody>' + totalsRowsHtml + '</tbody>'
    + '</table>'
    + '</div>'
    + '</section>';
}

/** Per-developer PR weight block (purple-themed comparison-view section).
 *  Shows per-author Volume × Weight × Total-volume meter rows across the full
 *  N-sprint window. Sorted by totalLines desc. Includes an insight callout
 *  contrasting most-PRs vs most-lines authors when they differ. */
function renderPrWeightPerDev() {
  const devs = devTotals.filter((d) => (d.prs || 0) > 0 && d.avgFilesPerPr != null && d.avgLinesPerPr != null).slice();
  if (!devs.length) return '';
  devs.sort((a, b) => (b.totalLines || 0) - (a.totalLines || 0));

  const maxFiles = Math.max(1, ...devs.map((d) => d.avgFilesPerPr || 0));
  const maxLines = Math.max(1, ...devs.map((d) => d.avgLinesPerPr || 0));
  const maxTotal = Math.max(1, ...devs.map((d) => d.totalLines || 0));

  function bucket(lines) {
    if (lines < 200)  return { label: 'small',  cls: 'pw-bucket pw-small'  };
    if (lines < 1000) return { label: 'medium', cls: 'pw-bucket pw-medium' };
    if (lines < 5000) return { label: 'large',  cls: 'pw-bucket pw-large'  };
    return                  { label: 'XL',     cls: 'pw-bucket pw-xl'     };
  }
  function fmtLines(n) {
    if (n == null) return '—';
    if (n < 1000) return String(Math.round(n));
    return (n / 1000).toFixed(1) + 'k';
  }

  const rows = devs.map((d) => {
    const filesPct = (d.avgFilesPerPr / maxFiles) * 100;
    const linesPct = (d.avgLinesPerPr / maxLines) * 100;
    const totalPct = (d.totalLines    / maxTotal) * 100;
    const sb = bucket(d.avgLinesPerPr);
    const heaviest = d.heaviestPr;
    return '<tr class="pw-row">'
      + '<td class="pw-name">' + esc(d.name) + '</td>'
      + '<td class="pw-prs"><span class="pw-prs-n">' + d.prs + '</span> <small>PRs</small></td>'
      + '<td><span class="' + sb.cls + '">' + esc(sb.label) + '</span></td>'
      + '<td class="pw-cell"><div class="pw-meter pw-meter-files"><div class="pw-meter-fill" style="width:' + filesPct.toFixed(1) + '%"></div></div><div class="pw-meter-val">' + d.avgFilesPerPr.toFixed(1) + '</div></td>'
      + '<td class="pw-cell"><div class="pw-meter pw-meter-lines"><div class="pw-meter-fill" style="width:' + linesPct.toFixed(1) + '%"></div></div><div class="pw-meter-val">' + fmtLines(d.avgLinesPerPr) + '</div></td>'
      + '<td class="pw-cell"><div class="pw-meter pw-meter-total"><div class="pw-meter-fill" style="width:' + totalPct.toFixed(1) + '%"></div></div><div class="pw-meter-val">' + fmtLines(d.totalLines) + '</div></td>'
      + '<td class="pw-heavy">' + (heaviest
          ? '<code>#' + heaviest.pr_id + '</code> <small>' + fmtLines(heaviest.lines_total) + ' / ' + heaviest.files + 'f</small>'
          : '<small style="color:var(--ink-faint)">—</small>')
        + '</td>'
      + '</tr>';
  }).join('');

  const mostPrs = devs.slice().sort((a, b) => (b.prs || 0) - (a.prs || 0))[0];
  const mostLines = devs[0];
  let insight = '';
  if (mostPrs && mostLines && mostPrs.name !== mostLines.name) {
    insight = '<p class="pw-insight"><strong>' + esc(String(mostPrs.name).split(' ')[0]) + '</strong> shipped the most PRs (' + mostPrs.prs + ', avg ' + fmtLines(mostPrs.avgLinesPerPr) + ' lines/PR), but <strong>' + esc(String(mostLines.name).split(' ')[0]) + '</strong> shipped the most volume (' + fmtLines(mostLines.totalLines) + ' total lines across ' + mostLines.prs + ' PRs, avg ' + fmtLines(mostLines.avgLinesPerPr) + ' lines/PR). Volume ≠ count.</p>';
  } else if (mostLines) {
    insight = '<p class="pw-insight"><strong>' + esc(String(mostLines.name).split(' ')[0]) + '</strong> led both volume and count: ' + mostLines.prs + ' PRs totaling ' + fmtLines(mostLines.totalLines) + ' lines (avg ' + fmtLines(mostLines.avgLinesPerPr) + ' lines/PR).</p>';
  }

  return '<section class="block pw-block">'
    + '<div class="block-num">H2 · Per-developer · PR weight' + infoTipFor("H2 · Per-developer · PR weight") + '</div>'
    + '<h2 class="block-title">How heavy were each developer\'s PRs?</h2>'
    + '<p class="block-lede">Each row is a developer. Bars are weighted per-PR averages across the ' + SPRINT_N + '-sprint window. <strong>Avg files</strong> and <strong>Avg lines</strong> are per-PR; <strong>Total lines</strong> is the cumulative volume (size × count). The <strong>size bucket</strong> classifies the typical PR: small &lt;200 lines · medium 200-1000 · large 1000-5000 · XL 5000+. <strong>Heaviest PR</strong> is the single biggest by lines.</p>'
    + insight
    + '<div class="pw-wrap">'
    + '<table class="pw-table">'
    + '<thead><tr><th>Developer</th><th>PRs</th><th>Size bucket</th><th>Avg files</th><th>Avg lines</th><th>Total lines</th><th>Heaviest PR</th></tr></thead>'
    + '<tbody>' + rows + '</tbody>'
    + '</table>'
    + '</div>'
    + '</section>';
}

/** Wire up the dev-spine filter toolbar (Feature A). Click handlers show/hide
 *  table columns by data-col attribute. "all" reveals every column; a metric
 *  key (prs/drafts/tasks/higher/comments/iter) hides every other column. */
function wireDevSpineFilter() {
  const bar = document.getElementById('dev-filter-bar');
  if (!bar) return;
  const buttons = bar.querySelectorAll('.dev-filter');
  const content = document.getElementById('dev-spine-content');
  if (!content) return;
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-filter');
      buttons.forEach((b) => b.classList.toggle('active', b === btn));
      const cols = content.querySelectorAll('th[data-col], td[data-col]');
      cols.forEach((cell) => {
        const cellKey = cell.getAttribute('data-col');
        const visible = (key === 'all') || (cellKey === key);
        cell.style.display = visible ? '' : 'none';
      });
    });
  });
}

function renderExcludedClustersAppendix() {
  const excluded = PAYLOAD.excludedClusters || [];
  if (!excluded.length) return '';
  const rows = excluded.map((c) => '<tr>'
    + '<td class="mono"><a href="' + workItemUrl(c.featureId) + '" target="_blank">#' + c.featureId + '</a></td>'
    + '<td>' + esc(c.title || '(no title)') + '</td>'
    + '<td><small>' + esc(c.exclusionReason || 'strap:validation-cycle') + '</small></td>'
    + '<td class="num">' + (c.prCount || 0) + '</td>'
    + '<td><small class="muted">' + (c.subRepos || []).join(', ') + '</small></td>'
    + '<td><small>' + (c.lifecycleDates && c.lifecycleDates.openedAt ? c.lifecycleDates.openedAt.slice(0, 10) : '—') + '</small></td>'
    + '</tr>').join('');
  return '<section class="block">'
    + '<details class="appendix" open>'
    + '<summary>Appendix · Excluded clusters (' + excluded.length + ')</summary>'
    + '<p class="block-lede" style="margin-top:12px">These ' + excluded.length + ' cluster(s) are present in the snapshot but excluded from DORA-4 aggregate math per the <code>strap:validation-cycle</code> tag convention. Their PRs were opened to exercise the polyrepo pipeline end-to-end, then deliberately abandoned without merging; including them would permanently skew deploy frequency, lead-time, and CFR.</p>'
    + '<table class="editorial">'
    + '<thead><tr><th>Feature</th><th>Title</th><th>Exclusion reason</th><th class="num">PRs</th><th>Sub-repos</th><th>Opened</th></tr></thead>'
    + '<tbody>' + rows + '</tbody>'
    + '</table>'
    + '</details>'
    + '</section>';
}

/* ----------------------------------------------------------------------------
 * Current / in-flight view
 * --------------------------------------------------------------------------*/

function renderCurrentView() {
  if (!currentMetrics) return '';
  const c = currentMetrics;
  const totalDays = c.daysElapsed + c.daysRemaining;
  const progress = totalDays > 0 ? c.daysElapsed / totalDays * 100 : 0;
  let html = '<div class="view" id="view-current">';
  html += '<div class="hero">'
    + '<div class="kicker">In flight · day ' + Math.floor(c.daysElapsed + 0.5) + '</div>'
    + '<h1>' + esc(c.sprintName) + ' <em>· right now</em></h1>'
    + '<p class="lede">' + c.tasksActive.length + ' tasks active · ' + c.storiesActive.length + ' stories active · ' + c.prs.length + ' open PRs.</p>'
    + '</div>';
  html += '<section class="block">'
    + '<div class="block-num">N1 · Sprint progress' + infoTipFor("N1 · Sprint progress") + '</div>'
    + '<div class="sprint-progress">'
    + '<div class="sp-meta"><span>Day ' + Math.floor(c.daysElapsed + 0.5) + ' of ' + Math.round(totalDays) + '</span><span>' + Math.round(c.daysRemaining) + ' days remaining</span></div>'
    + '<div class="sp-bar-wrap"><div class="sp-bar" style="width:' + progress.toFixed(1) + '%"></div></div>'
    + '</div></section>';
  html += renderAgingAlerts(c);
  html += renderActiveItems(c);
  html += renderOpenPrs(c);
  html += renderPipelineActivity(c);
  html += '</div>';
  return html;
}

function renderAgingAlerts(c) {
  const a = c.aging || {};

  function asSplit(block) {
    if (!block) return { strap_instrumented: [], inherited: [], inherited_collapsed: false };
    if (Array.isArray(block)) {
      const strap = block.filter((i) => i && i.strap_instrumented === true);
      const inherited = block.filter((i) => !i || i.strap_instrumented !== true);
      return { strap_instrumented: strap, inherited, inherited_collapsed: false };
    }
    return {
      strap_instrumented: block.strap_instrumented || [],
      inherited: block.inherited || [],
      inherited_collapsed: !!block.inherited_collapsed,
    };
  }

  function itemRow(i) {
    return '<div class="ac-item">'
      + '<div class="ai-title"><a href="' + workItemUrl(i.id) + '" target="_blank">#' + i.id + '</a> ' + esc(i.title) + '</div>'
      + '<div class="ai-meta">' + i.age_days + 'd</div>'
      + '</div>';
  }

  function itemListMarkup(items, cap) {
    const head = items.slice(0, cap).map(itemRow).join('');
    const overflow = items.length > cap
      ? '<div class="ac-item"><div class="ai-title muted">… ' + (items.length - cap) + ' more</div></div>'
      : '';
    return head + overflow;
  }

  function card(label, split, threshold) {
    const strap = split.strap_instrumented;
    const inherited = split.inherited;
    if (!strap.length && !inherited.length) {
      return '<div class="aging-card ok">'
        + '<div class="ac-label">' + esc(label) + '</div>'
        + '<div class="ac-count">0</div>'
        + '<div class="ac-items"><small style="color:var(--green-deep)">none aged past ' + threshold + '</small></div>'
        + '</div>';
    }
    const totalCount = strap.length + inherited.length;
    const headerCls = strap.length ? 'warning' : 'ok';
    let body = '';
    if (strap.length) {
      body += '<div class="ac-section"><div class="ac-section-lbl">STRAP-instrumented · ' + strap.length + '</div>'
        + '<div class="ac-items">' + itemListMarkup(strap, 6) + '</div></div>';
    } else if (inherited.length) {
      body += '<div class="ac-section"><div class="ac-section-lbl muted">No STRAP-instrumented aging in window</div></div>';
    }
    if (inherited.length) {
      const innerList = '<div class="ac-items">' + itemListMarkup(inherited, 6) + '</div>';
      if (split.inherited_collapsed) {
        body += '<details class="ac-collapse"><summary>View ' + inherited.length + ' inherited backlog item' + (inherited.length === 1 ? '' : 's') + '</summary>'
          + innerList + '</details>';
      } else {
        body += '<div class="ac-section"><div class="ac-section-lbl muted">Inherited backlog · ' + inherited.length + '</div>'
          + innerList + '</div>';
      }
    }
    return '<div class="aging-card ' + headerCls + '">'
      + '<div class="ac-label">' + esc(label) + '</div>'
      + '<div class="ac-count">' + totalCount + '</div>'
      + body
      + '</div>';
  }

  return '<section class="block">'
    + '<div class="block-num">N2 · Aging alerts' + infoTipFor("N2 · Aging alerts") + '</div>'
    + '<h2 class="block-title">Items stuck longer than threshold</h2>'
    + '<p class="block-lede">STRAP-instrumented items surface first (load-bearing pipeline signal); inherited backlog renders below and collapses when oversized.</p>'
    + '<div class="aging-grid">'
    + card('Tasks active > 3d', asSplit(a.tasks_active_over_3d), '3 days')
    + card('Stories active > 5d', asSplit(a.stories_active_over_5d), '5 days')
    + card('Features new > 7d', asSplit(a.features_new_over_7d), '7 days')
    + card('Specs active > 14d', asSplit(a.specs_active_over_14d), '14 days')
    + '</div>'
    + '</section>';
}

function renderActiveItems(c) {
  function block(label, items) {
    if (!items || !items.length) return '';
    return '<h3 style="margin-top:14px;font-size:14px">' + esc(label) + ' (' + items.length + ')</h3>'
      + '<table class="editorial">'
      + '<thead><tr><th>ID</th><th>Title</th><th>Assignee</th></tr></thead>'
      + '<tbody>' + items.slice(0, 20).map(i => '<tr>'
        + '<td class="mono"><a href="' + workItemUrl(i.id) + '" target="_blank">#' + i.id + '</a>' + aiBadge(i.isAi) + '</td>'
        + '<td>' + esc(i.title) + '</td>'
        + '<td><small>' + esc(i.assignedTo || '—') + '</small></td>'
        + '</tr>').join('') + '</tbody></table>';
  }
  return '<section class="block">'
    + '<div class="block-num">N3 · Active items' + infoTipFor("N3 · Active items") + '</div>'
    + '<h2 class="block-title">In-flight work</h2>'
    + block('Tasks active', c.tasksActive)
    + block('Stories active', c.storiesActive)
    + block('Features active', c.featuresActive)
    + block('Specs active', c.specsActive)
    + '</section>';
}

function renderOpenPrs(c) {
  if (!c.prs || !c.prs.length) return '';
  return '<section class="block">'
    + '<div class="block-num">N4 · Open PRs' + infoTipFor("N4 · Open PRs") + '</div>'
    + '<h2 class="block-title">Currently open</h2>'
    + '<table class="editorial">'
    + '<thead><tr><th>PR</th><th>Title</th><th>Author</th><th>Status</th><th class="num">Iter</th></tr></thead>'
    + '<tbody>' + c.prs.slice(0, 25).map(p => '<tr>'
      + '<td class="mono"><a href="' + prUrl(p.id) + '" target="_blank">#' + p.id + '</a>' + aiBadge(p.isAi) + '</td>'
      + '<td>' + esc(p.title) + '</td>'
      + '<td><small>' + esc(p.createdBy) + '</small></td>'
      + '<td>' + esc(p.status) + '</td>'
      + '<td class="num">' + p.iterationCount + '</td>'
      + '</tr>').join('') + '</tbody></table>'
    + '</section>';
}

function renderPipelineActivity(c) {
  if (!c.pipelineRuns || !c.pipelineRuns.length) return '';
  return '<section class="block">'
    + '<div class="block-num">N5 · Pipeline activity' + infoTipFor("N5 · Pipeline activity") + '</div>'
    + '<h2 class="block-title">Recent runs</h2>'
    + '<table class="editorial">'
    + '<thead><tr><th>Pipeline</th><th>Layer</th><th>Status</th><th>Finished</th></tr></thead>'
    + '<tbody>' + c.pipelineRuns.slice(0, 20).map(r => '<tr>'
      + '<td>' + esc(r.definitionName) + '</td>'
      + '<td>' + esc(r.layer || '—') + '</td>'
      + '<td>' + esc(r.status || '—') + '</td>'
      + '<td><small>' + (r.finishTime ? r.finishTime.slice(0, 16).replace('T', ' ') : '—') + '</small></td>'
      + '</tr>').join('') + '</tbody></table>'
    + '</section>';
}

/* ----------------------------------------------------------------------------
 * Comparison view assembly
 * --------------------------------------------------------------------------*/

function renderComparisonView() {
  const sectionFunnel = 'pipeline-funnel-cmp';
  return '<div class="view" id="view-comparison">'
    + '<div class="hero">'
    + '<div class="kicker">' + SPRINT_SPAN_LABEL + ' summary</div>'
    + '<h1>Across <em>' + SPRINT_N + ' sprints</em></h1>'
    + '<p class="lede">Verdicts · movement · trends · per-developer · pipeline funnel · deploy heatmap.</p>'
    + renderSprintStrip()
    + '</div>'
    + renderDoraStripSummary()
    + renderVerdicts()
    + renderComparisonKpiStrip()
    + renderMovementBlock()
    + renderKpiSparklines()
    + renderDeployHeatmap()
    + renderInactiveMembersBlock()
    + renderAgentAttribution()
    + renderPipelineFunnel(sectionFunnel)
    + renderDevSpine()
    + renderPrWeightPerDev()
    + renderExcludedClustersAppendix()
    + renderMethodology()
    + '</div>';
}

/* ----------------------------------------------------------------------------
 * Wire up partition toggles after DOM is populated
 * --------------------------------------------------------------------------*/

function wireAllPartitionToggles() {
  for (let i = 0; i < SPRINT_N; i++) {
    const m = sprintMetrics[i];
    const sectionPrSize = 'pr-size-sprint-' + i;
    const sectionCluster = 'cluster-cycle-sprint-' + i;
    const sectionQuality = 'quality-cycles-sprint-' + i;
    wirePartitionToggle(sectionPrSize, (partition) => {
      const container = document.createElement('div');
      container.innerHTML = renderPrSize(m, sectionPrSize, partition);
      const inner = container.querySelector('#' + sectionPrSize);
      return inner ? inner.innerHTML : '';
    });
    if (m.clusterCycleTime) {
      wirePartitionToggle(sectionCluster, (partition) => {
        const container = document.createElement('div');
        container.innerHTML = renderClusterCycleTime(m, sectionCluster, partition);
        const inner = container.querySelector('#' + sectionCluster);
        return inner ? inner.innerHTML : '';
      });
    }
    wirePartitionToggle(sectionQuality, (partition) => {
      const container = document.createElement('div');
      container.innerHTML = renderQualityCycleTimes(m, sectionQuality, partition);
      const inner = container.querySelector('#' + sectionQuality);
      return inner ? inner.innerHTML : '';
    });
  }
  wirePartitionToggle('pipeline-funnel-cmp', (partition) => {
    const container = document.createElement('div');
    container.innerHTML = renderPipelineFunnel('pipeline-funnel-cmp', partition);
    const inner = container.querySelector('#pipeline-funnel-cmp');
    return inner ? inner.innerHTML : '';
  });
}

/* ----------------------------------------------------------------------------
 * Main entry point
 * --------------------------------------------------------------------------*/

function main() {
  renderViewPicker();
  const root = document.getElementById('view-content');
  if (!root) return;
  let html = '';
  for (let i = 0; i < SPRINT_N; i++) html += renderSprintView(i);
  html += renderComparisonView();
  if (currentMetrics) html += renderCurrentView();
  root.innerHTML = html;

  let initialView = (location.hash || '').slice(1);
  if (!initialView) initialView = 'comparison';
  switchView(initialView);
  wireAllPartitionToggles();
  wireDevSpineFilter();
}

main();
