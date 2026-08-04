#!/usr/bin/env node

/**
 * assemble-report.js
 *
 * Stitches the five engine assets into one self-contained HTML report:
 *   engine-head.html
 *   + `const PAYLOAD = <json>;`
 *   + engine-render.js
 *   + engine-tail.html
 *
 * Before writing, runs verify-then-write quality gates per the design doc
 * (.claude/strap/contexts/dora-report-engine-design.md Section 11):
 *   Gate 1 PAYLOAD parses
 *   Gate 2 Headless render produces no undefined/NaN/[object Object]/Infinity
 *   Gate 3 Adopter-shape consistency (no per-sub-repo markup when subRepos empty,
 *          no per-target markup when deploymentTargets empty, etc.)
 *   Gate 4 Data Quality flag honesty -- every true flag appears in output
 *   Gate 5 Per-sprint section count meets minimum
 *   Gate 6 Spot-check sampling -- N PAYLOAD values appear verbatim in output
 *
 * Refuses to write and surfaces actionable errors on any gate failure.
 *
 * Usage:
 *   node assemble-report.js --payload <payload.json> --out <report.html>
 *     [--skill-dir <dir>] [--strict]
 *
 * --skill-dir defaults to the directory containing this script.
 * --strict causes Gates 3-6 to fail the build (default: warn but continue).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FORBIDDEN_TOKENS = ['undefined', 'NaN', '[object Object]', 'Infinity'];
const PER_SPRINT_MIN_SECTIONS = 9;
const SPOT_CHECK_SAMPLE_COUNT = 5;

/* ----------------------------------------------------------------------------
 * CLI
 * --------------------------------------------------------------------------*/

function parseArgs(argv) {
  const opts = { payload: null, out: null, skillDir: null, strict: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--payload') opts.payload = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--skill-dir') opts.skillDir = argv[++i];
    else if (a === '--strict') opts.strict = true;
    else throw new Error('Unknown argument: ' + a);
  }
  if (!opts.payload) throw new Error('--payload <path> is required.');
  if (!opts.out) throw new Error('--out <path> is required.');
  if (!opts.skillDir) opts.skillDir = __dirname;
  return opts;
}

/* ----------------------------------------------------------------------------
 * Read + stitch
 * --------------------------------------------------------------------------*/

function readEngineAssets(skillDir) {
  return {
    head: fs.readFileSync(path.join(skillDir, 'engine-head.html'), 'utf8'),
    render: fs.readFileSync(path.join(skillDir, 'engine-render.js'), 'utf8'),
    tail: fs.readFileSync(path.join(skillDir, 'engine-tail.html'), 'utf8'),
  };
}

function stitch(head, payload, render, tail) {
  const payloadLine = 'const PAYLOAD = ' + JSON.stringify(payload) + ';\n';
  return head + '\n' + payloadLine + '\n' + render + '\n' + tail;
}

/* ----------------------------------------------------------------------------
 * Minimal DOM mock -- enough for engine-render.js to execute headless without
 * throwing. Mock captures innerHTML writes per element id; the engine's
 * querySelectorAll calls return [] (since clicks don't fire in headless mode
 * and the engine handles empty results fine).
 * --------------------------------------------------------------------------*/

function makeElement(id, capture) {
  const e = {
    id: id || null,
    _innerHTML: '',
    _textContent: '',
    _attrs: {},
    _classList: new Set(),
  };
  Object.defineProperty(e, 'innerHTML', {
    get() { return e._innerHTML; },
    set(v) { e._innerHTML = v; if (id && capture) capture[id] = v; },
  });
  Object.defineProperty(e, 'textContent', {
    get() { return e._textContent; },
    set(v) { e._textContent = v; },
  });
  Object.defineProperty(e, 'classList', {
    get() {
      return {
        toggle: (cls, on) => {
          if (on === undefined) {
            if (e._classList.has(cls)) e._classList.delete(cls);
            else e._classList.add(cls);
          } else if (on) e._classList.add(cls);
          else e._classList.delete(cls);
        },
        contains: (cls) => e._classList.has(cls),
        add: (cls) => e._classList.add(cls),
        remove: (cls) => e._classList.delete(cls),
      };
    },
  });
  e.getAttribute = (n) => e._attrs[n] || null;
  e.setAttribute = (n, v) => { e._attrs[n] = v; };
  e.addEventListener = () => {};
  e.querySelectorAll = () => [];
  e.querySelector = () => null;
  return e;
}

function makeDocument(elements, capture) {
  const documentElement = makeElement(null, null);
  return {
    title: '',
    documentElement,
    getElementById(id) {
      if (!elements[id]) elements[id] = makeElement(id, capture);
      return elements[id];
    },
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: () => makeElement(null, null),
  };
}

/* ----------------------------------------------------------------------------
 * Verify gates
 * --------------------------------------------------------------------------*/

function gate1_payloadParses(assembled) {
  const match = assembled.match(/const PAYLOAD = (\{[\s\S]*?\});\s*\n/);
  if (!match) return { ok: false, message: 'Gate 1 (PAYLOAD parses): const PAYLOAD = ...; line not found in assembled HTML.' };
  try {
    const parsed = JSON.parse(match[1]);
    return { ok: true, payload: parsed };
  } catch (e) {
    return { ok: false, message: 'Gate 1 (PAYLOAD parses): JSON.parse failed: ' + e.message };
  }
}

function gate2_headlessRender(assembled, payload) {
  const headEnd = assembled.indexOf('<script>');
  const tailStart = assembled.lastIndexOf('</script>');
  if (headEnd < 0 || tailStart < 0) {
    return { ok: false, message: 'Gate 2 (headless render): could not locate <script>...</script> in assembled HTML.' };
  }
  const scriptBody = assembled.slice(headEnd + '<script>'.length, tailStart);
  const elements = {};
  const capture = {};
  const documentMock = makeDocument(elements, capture);
  const sandbox = {
    PAYLOAD: payload,
    document: documentMock,
    window: {
      matchMedia: () => ({ matches: false }),
      scrollTo: () => {},
    },
    localStorage: { getItem: () => null, setItem: () => {} },
    history: { replaceState: () => {} },
    location: { hash: '' },
    Date, Math, Number, String, Object, Array,
    isFinite, isNaN, parseFloat, parseInt,
    JSON, RegExp, Boolean, Error,
    setTimeout: () => 0, clearTimeout: () => {},
    console: { log: () => {}, warn: () => {}, error: () => {} },
  };
  try {
    vm.createContext(sandbox);
    vm.runInContext(scriptBody, sandbox, { timeout: 5000 });
  } catch (e) {
    return { ok: false, message: 'Gate 2 (headless render): engine threw: ' + e.message };
  }
  const rendered = capture['view-content'] || '';
  if (!rendered) {
    return { ok: false, message: 'Gate 2 (headless render): engine did not populate #view-content.' };
  }
  const offenders = [];
  for (const tok of FORBIDDEN_TOKENS) {
    if (rendered.includes(tok)) offenders.push(tok);
  }
  if (offenders.length) {
    return {
      ok: false,
      message: 'Gate 2 (headless render): rendered output contains forbidden tokens: ' + offenders.join(', '),
      rendered,
    };
  }
  return { ok: true, rendered, capture };
}

function gate3_adopterShape(rendered, payload, strict) {
  const warnings = [];
  if ((!payload.subRepos || !payload.subRepos.length) && /per sub-repo/i.test(rendered)) {
    warnings.push('Per-sub-repo markup present but PAYLOAD.subRepos is empty');
  }
  if ((!payload.deploymentTargets || !payload.deploymentTargets.length)) {
    for (const m of payload.sprintMetrics) {
      if (m.deployByTarget && Object.keys(m.deployByTarget).length) {
        warnings.push('Per-target deploy data present without deploymentTargets declaration');
        break;
      }
    }
  }
  const hasClusters = payload.sprintMetrics.some((m) => m.clusterCycleTime != null);
  if (!hasClusters && /Cluster cycle-time/i.test(rendered)) {
    warnings.push('Cluster cycle-time section rendered without clusterCycleTime data');
  }
  if (warnings.length) {
    return { ok: !strict, message: 'Gate 3 (adopter-shape consistency) warnings: ' + warnings.join('; '), warnings };
  }
  return { ok: true };
}

function gate4_dataQualityFlags(rendered, payload, strict) {
  const missingFlags = [];
  for (let i = 0; i < payload.sprintMetrics.length; i++) {
    const m = payload.sprintMetrics[i];
    const flags = (m.dq && m.dq.flags) || {};
    if (flags.cw_oe_degeneracy === true && !/cw_oe_degeneracy/i.test(rendered)) {
      missingFlags.push('sprint[' + i + '].cw_oe_degeneracy not surfaced');
    }
    if (flags.pre_strap_human_backlog_share > 0.30 && !/pre_strap_human_backlog_share/i.test(rendered)) {
      missingFlags.push('sprint[' + i + '].pre_strap_human_backlog_share (>30%) not surfaced');
    }
    if (flags.revisions_unavailable === true && !/revisions_unavailable/i.test(rendered)) {
      missingFlags.push('sprint[' + i + '].revisions_unavailable not surfaced');
    }
  }
  if (missingFlags.length) {
    return { ok: !strict, message: 'Gate 4 (DQ flag honesty): ' + missingFlags.join('; '), missingFlags };
  }
  return { ok: true };
}

function gate5_sectionCount(rendered, payload, strict) {
  const sectionMatches = rendered.match(/<section class="block/g) || [];
  const sprintCount = payload.sprintMetrics.length;
  const expectedMin = sprintCount * PER_SPRINT_MIN_SECTIONS;
  if (sectionMatches.length < expectedMin) {
    return {
      ok: !strict,
      message: 'Gate 5 (section count): expected at least ' + expectedMin + ' section.block elements across ' + sprintCount + ' sprint(s); found ' + sectionMatches.length + '.',
    };
  }
  return { ok: true, sectionCount: sectionMatches.length };
}

function gate6_spotCheck(rendered, payload, strict) {
  const samples = [];
  for (const m of payload.sprintMetrics) {
    samples.push({ kind: 'sprint-name', value: m.name });
    if (m.ai && m.ai.all && m.ai.all.count != null) samples.push({ kind: 'ai-count', value: String(m.ai.all.count) });
    if (m.counts && m.counts.tasksClosed != null) samples.push({ kind: 'tasks-closed', value: String(m.counts.tasksClosed) });
  }
  const picked = samples.slice(0, SPOT_CHECK_SAMPLE_COUNT);
  const missing = picked.filter((s) => s.value && !rendered.includes(s.value));
  if (missing.length) {
    return {
      ok: !strict,
      message: 'Gate 6 (spot-check): expected values not found in rendered output: ' + missing.map((m) => m.kind + '=' + m.value).join(', '),
      missing,
    };
  }
  return { ok: true, checked: picked.length };
}

/* ----------------------------------------------------------------------------
 * Atomic write
 * --------------------------------------------------------------------------*/

function atomicWrite(filePath, content) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

/* ----------------------------------------------------------------------------
 * Main
 * --------------------------------------------------------------------------*/

function runVerifyGates(assembled, payload, strict) {
  const results = [];

  const g1 = gate1_payloadParses(assembled);
  results.push({ gate: 1, ok: g1.ok, message: g1.message || 'PAYLOAD parses OK' });
  if (!g1.ok) return { ok: false, results };

  const g2 = gate2_headlessRender(assembled, payload);
  results.push({ gate: 2, ok: g2.ok, message: g2.message || 'Headless render produces no forbidden tokens' });
  if (!g2.ok) return { ok: false, results };

  const rendered = g2.rendered;

  const g3 = gate3_adopterShape(rendered, payload, strict);
  results.push({ gate: 3, ok: g3.ok, message: g3.message || 'Adopter-shape consistency OK' });
  if (!g3.ok) return { ok: false, results };

  const g4 = gate4_dataQualityFlags(rendered, payload, strict);
  results.push({ gate: 4, ok: g4.ok, message: g4.message || 'Data Quality flags honestly surfaced' });
  if (!g4.ok) return { ok: false, results };

  const g5 = gate5_sectionCount(rendered, payload, strict);
  results.push({ gate: 5, ok: g5.ok, message: g5.message || 'Per-sprint section count meets minimum (found ' + (g5.sectionCount || '?') + ')' });
  if (!g5.ok) return { ok: false, results };

  const g6 = gate6_spotCheck(rendered, payload, strict);
  results.push({ gate: 6, ok: g6.ok, message: g6.message || 'Spot-check sampling OK (' + (g6.checked || 0) + ' values verified)' });
  if (!g6.ok) return { ok: false, results };

  return { ok: true, results };
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv);
  } catch (e) {
    console.error('Error: ' + e.message);
    console.error('Usage: node assemble-report.js --payload <payload.json> --out <report.html> [--skill-dir <dir>] [--strict]');
    process.exit(2);
  }
  try {
    const payload = JSON.parse(fs.readFileSync(opts.payload, 'utf8'));
    const { head, render, tail } = readEngineAssets(opts.skillDir);
    const assembled = stitch(head, payload, render, tail);
    const result = runVerifyGates(assembled, payload, opts.strict);
    for (const r of result.results) {
      console.log((r.ok ? '[OK]   ' : '[FAIL] ') + 'Gate ' + r.gate + ': ' + r.message);
    }
    if (!result.ok) {
      console.error('\nAssemble failed: one or more verify gates rejected the output. No file written.');
      process.exit(1);
    }
    atomicWrite(opts.out, assembled);
    console.log('\nReport written: ' + opts.out);
    console.log('  size:       ' + assembled.length + ' bytes');
    console.log('  sprints:    ' + payload.sprintMetrics.length);
    console.log('  layers:     ' + (payload.layers.length || 0));
    console.log('  in-flight:  ' + (payload.currentMetrics ? payload.currentMetrics.sprintName : '(none)'));
    console.log('\nOpen in browser: file:///' + path.resolve(opts.out).replace(/\\/g, '/'));
  } catch (e) {
    console.error('Assemble failed: ' + e.message);
    if (process.env.DEBUG) console.error(e.stack);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  parseArgs, readEngineAssets, stitch, runVerifyGates,
  gate1_payloadParses, gate2_headlessRender, gate3_adopterShape,
  gate4_dataQualityFlags, gate5_sectionCount, gate6_spotCheck,
  atomicWrite,
};
