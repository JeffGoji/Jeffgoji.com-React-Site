/**
 * Re-runnable capture of the Feature-C performance reference set.
 *
 * Runs the Lighthouse matrix (home + nd-totd2025 gallery, desktop + mobile,
 * 3 iterations) against a local `vite preview` server and prints median
 * scores, LCP, and first-party image transfer bytes.
 *
 * Lighthouse is deliberately NOT a project dependency -- it is a ~200 MB
 * measurement-only tool. Install it out-of-tree and point LH_DIR at it:
 *
 *   npm run build
 *   npx vite preview --port 4173 --host 127.0.0.1   (leave running)
 *   mkdir -p "$TMP/lh" && cd "$TMP/lh" && npm init -y && npm install lighthouse
 *   LH_DIR="$TMP/lh/node_modules" node scripts/perf/lh-baseline.mjs
 *
 * On Windows the LH_DIR path must be short. Node reads lighthouse's nested
 * `core/lib/cdt/package.json` CommonJS marker at ~66 chars of suffix; past
 * MAX_PATH that read silently fails and every audit dies with
 * "SDK.js does not provide an export named 'default'".
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ORIGIN = process.env.PERF_ORIGIN ?? "http://127.0.0.1:4173";
const LH_DIR = process.env.LH_DIR;
const ITERATIONS = Number(process.env.PERF_ITERATIONS ?? 3);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const TARGETS = [
  { name: "home", url: `${ORIGIN}/` },
  { name: "totdgallery", url: `${ORIGIN}/totdgallery` },
];

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function auditDist() {
  const dist = path.join(REPO_ROOT, "dist");
  if (!fs.existsSync(dist)) return null;

  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : [p];
    });

  const isImage = (p) => /\.(jpe?g|png|webp|gif|avif|svg)$/i.test(p);
  const group = (p) => {
    const rel = path.relative(dist, p).replace(/\\/g, "/");
    const m = rel.match(/^gallery\/([^/]+)\/([^/]+)\//);
    if (m) return `gallery/${m[1]}/${m[2]}`;
    if (rel.startsWith("assets/")) return "assets (vite-hashed)";
    if (rel.startsWith("images/")) return "images (public passthrough)";
    return "other";
  };

  const out = {};
  let total = 0;
  for (const f of walk(dist)) {
    const size = fs.statSync(f).size;
    total += size;
    if (!isImage(f)) continue;
    const g = group(f);
    out[g] ??= { files: 0, bytes: 0 };
    out[g].files++;
    out[g].bytes += size;
  }
  return { groups: out, distTotalBytes: total };
}

async function runLighthouse() {
  if (!LH_DIR) {
    console.log("LH_DIR unset -- skipping Lighthouse matrix, static dist audit only.");
    return null;
  }
  const load = (m) => import(pathToFileURL(path.join(LH_DIR, m)).href);
  const { default: lighthouse } = await load("lighthouse/core/index.js");
  const { default: desktopConfig } = await load("lighthouse/core/config/desktop-config.js");
  const chromeLauncher = await load("chrome-launcher/dist/index.js");

  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });

  const results = [];
  try {
    for (let i = 1; i <= ITERATIONS; i++) {
      for (const t of TARGETS) {
        for (const preset of ["desktop", "mobile"]) {
          const r = await lighthouse(
            t.url,
            { port: chrome.port, output: "json", onlyCategories: ["performance"], logLevel: "error" },
            preset === "desktop" ? desktopConfig : undefined
          );
          const a = r.lhr.audits;
          const fp = (a["network-requests"]?.details?.items ?? []).filter(
            (x) => x.resourceType === "Image" && x.url.startsWith(ORIGIN)
          );
          results.push({
            target: t.name,
            preset,
            perf: Math.round(r.lhr.categories.performance.score * 100),
            LCP: Math.round(a["largest-contentful-paint"].numericValue),
            FCP: Math.round(a["first-contentful-paint"].numericValue),
            TBT: Math.round(a["total-blocking-time"].numericValue),
            CLS: a["cumulative-layout-shift"].numericValue,
            imageCount: fp.length,
            imageBytes: fp.reduce((s, x) => s + (x.transferSize || 0), 0),
          });
        }
      }
    }
  } finally {
    await chrome.kill();
  }
  return results;
}

const lh = await runLighthouse();
if (lh) {
  console.log("\n=== Lighthouse medians ===");
  for (const t of TARGETS) {
    for (const preset of ["desktop", "mobile"]) {
      const rs = lh.filter((r) => r.target === t.name && r.preset === preset);
      if (!rs.length) continue;
      console.log(
        `${t.name.padEnd(12)} ${preset.padEnd(8)} perf=${median(rs.map((r) => r.perf))
          .toString()
          .padStart(3)}  LCP=${median(rs.map((r) => r.LCP))}ms  FCP=${median(
          rs.map((r) => r.FCP)
        )}ms  TBT=${median(rs.map((r) => r.TBT))}ms  CLS=${median(rs.map((r) => r.CLS)).toFixed(3)}` +
          `  images=${median(rs.map((r) => r.imageCount))} req / ${median(rs.map((r) => r.imageBytes))} B`
      );
    }
  }
}

const dist = auditDist();
if (dist) {
  console.log("\n=== Static dist/ image inventory ===");
  for (const [g, v] of Object.entries(dist.groups).sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log(`${g.padEnd(34)} ${String(v.files).padStart(5)} files  ${String(v.bytes).padStart(12)} B`);
  }
  console.log(`${"dist/ TOTAL (all file types)".padEnd(34)} ${" ".repeat(11)}  ${String(dist.distTotalBytes).padStart(12)} B`);
}
