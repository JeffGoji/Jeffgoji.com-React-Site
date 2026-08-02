# V1 performance baseline

Reference set for Feature 00005 (Feature C) acceptance criteria AC-006 (>=50% image-byte
reduction), AC-007 (LCP <=2.5s), AC-008 (Lighthouse Performance >=90 desktop / >=80 mobile).
Captured under Task 00048 (Story 00042, Phase 0).

Phase-3 re-measurement (Stories 00044/00045) must re-run the method in
[Methodology](#methodology) unchanged and compare against the tables below.

## Capture metadata

| Field | Value |
| --- | --- |
| Captured | 2026-08-01 |
| Captured by | devops-lead, Task 00048 |
| Codebase | `feature/00005-image-perf-analytics-baseline` @ `ff9fecd`, unmodified V1 |
| Build | `npm run build` (gallery:build -> vite build), Vite 4.5.1, Node v22.14.0 |
| Measurement surface | local `vite preview` of `dist/`, `http://127.0.0.1:4173` |
| Tool | Lighthouse 12.8.2, Chrome 8.3-path install, headless |
| Iterations | 3 per (page x form factor); tables report the **median** |
| Host | Windows 11, benchmarkIndex 830-1503 across runs |

**These are pre-V2 numbers and must not be re-captured after Task 00047 lands** (00047 changes
the Vite build target and would invalidate the comparison).

## Throttling profile

Lighthouse defaults, unmodified. Recorded verbatim from `configSettings` so the Phase-3 run can
assert an identical profile.

**Mobile** (`formFactor: mobile`, the "mid-tier mobile profile" for AC-007):

| Setting | Value |
| --- | --- |
| `throttlingMethod` | `simulate` (Lantern) |
| `throttling.rttMs` | 150 |
| `throttling.throughputKbps` | 1638.4 |
| `throttling.requestLatencyMs` | 562.5 |
| `throttling.downloadThroughputKbps` | 1474.56 |
| `throttling.cpuSlowdownMultiplier` | 4 |
| `screenEmulation` | 412 x 823, DPR 1.75, mobile |
| Emulated UA | `Moto G Power (2022)`, Android 11 |

**Desktop** (`--preset=desktop` / `desktop-config.js`):

| Setting | Value |
| --- | --- |
| `throttlingMethod` | `simulate` (Lantern) |
| `throttling.rttMs` | 40 |
| `throttling.throughputKbps` | 10240 |
| `throttling.cpuSlowdownMultiplier` | 1 |
| `screenEmulation` | 1350 x 940, DPR 1, non-mobile |
| Emulated UA | Chrome on macOS 10.15.7 |

## Lighthouse scores and LCP (median of 3)

Only the Performance category was run.

| Page | Form factor | Perf | LCP | FCP | TBT | CLS | Speed Index |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` (home) | desktop | **82** | **2348 ms** | 1430 ms | 0 ms | 0.000 | 1430 ms |
| `/` (home) | mobile | **67** | **13373 ms** | 2458 ms | 249 ms | 0.000 | 2882 ms |
| `/totdgallery` | desktop | **93** | **1450 ms** | 596 ms | 5 ms | 0.090 | 765 ms |
| `/totdgallery` | mobile | **60** | **11214 ms** | 2474 ms | 420 ms | 0.078 | 2901 ms |

Per-iteration Performance scores (spread is meaningful; treat +/-6 as noise on this host):

| Page | Form factor | Run 1 | Run 2 | Run 3 |
| --- | --- | --- | --- | --- |
| `/` | desktop | 88 | 82 | 82 |
| `/` | mobile | 68 | 67 | 63 |
| `/totdgallery` | desktop | 93 | 93 | 93 |
| `/totdgallery` | mobile | 58 | 60 | 61 |

### Gap to target

| AC | Target | Home desktop | Home mobile | Gallery desktop | Gallery mobile |
| --- | --- | --- | --- | --- | --- |
| AC-008 | Perf >=90 desktop / >=80 mobile | 82 (**-8**) | 67 (**-13**) | 93 (pass) | 60 (**-20**) |
| AC-007 | LCP <=2500 ms | 2348 (pass, no margin) | 13373 (**5.3x over**) | 1450 (pass) | 11214 (**4.5x over**) |

Mobile LCP is the dominant failure. Both pages are ~11-13 s against a 2.5 s target.

### LCP element

| Page | LCP element |
| --- | --- |
| `/` | `<div class="container-fluid splash-background text-white">` -- the CSS `background-image` hero (`nd-010.jpg`, 624190 B) declared at `src/assets/css/style.css:20` |
| `/totdgallery` | `<img class="image-gallery-image" src="/gallery/nd-totd2025/display/5065068.jpg.webp">` |

The home hero being a CSS background is load-bearing for Phase 3: a CSS `background-image` cannot
carry `fetchpriority="high"` or a `<link rel="preload">` without extra markup, and Lighthouse's
`prioritize-lcp-image` audit scores 0 on this page with 607 ms of attributable mobile savings.
Converting the hero to a real `<img>` (or adding an explicit preload) is a prerequisite for hitting
AC-007 on mobile, independent of the byte reduction.

## Cold-load transferred image bytes

Source: Lighthouse `network-requests`, `resourceType === "Image"`, filtered to the first-party
origin. This is the authoritative figure for AC-006 -- it counts what the browser actually pulled
on a cold load, not what exists on disk.

| Page | Form factor | Image requests | **Image transfer bytes** |
| --- | --- | --- | --- |
| `/` (home) | desktop | 6 | **2 593 063 B (2.59 MB)** |
| `/` (home) | mobile | 6 | **2 593 063 B (2.59 MB)** |
| `/totdgallery` | desktop | 124 | **2 080 624 B (2.08 MB)** |
| `/totdgallery` | mobile | 126 | **2 386 970 B (2.39 MB)** |

**AC-006 targets (>=50% reduction): home <=1 296 531 B; gallery <=1 040 312 B desktop /
<=1 193 485 B mobile.**

Home mobile and home desktop transfer byte-for-byte identical payloads. There is no responsive
image serving anywhere on the home page -- a 412 px-wide phone downloads the same full-resolution
JPEGs as a 1350 px desktop.

### Home page image inventory (all 6 cold-load requests)

| Bytes | Asset | Role |
| --- | --- | --- |
| 731 816 | `/assets/c8-002-*.jpg` | Garage card (C8 Corvette Z51) |
| 624 190 | `/assets/nd-010-*.jpg` | `.splash-background` hero -- **LCP element** |
| 427 741 | `/assets/night4-*.jpg` | Garage card (NA6 Miata) |
| 364 152 | `/assets/nd-002-*.jpg` | Garage card (ND GTS RF) |
| 233 443 | `/assets/41923629_*.jpg` | Garage card (NB Mazdaspeed) |
| 211 721 | `/assets/ncEdit-*.jpg` | Garage card (NC Club) |
| **2 593 063** | | **total** |

All six are JPEG. None are served in a modern format, none are responsive, none are lazy-loaded.

### Gallery image inventory

`/totdgallery` renders chunk 1 of `nd-totd2025` (`chunkSize = 120`,
`src/components/Gallery/ND/TailOfTheDragon/index.jsx:7`). All 120 thumbnails in the chunk are
fetched eagerly on load; `react-image-gallery` additionally fetches the current and adjacent
display-size slides.

| Group | Desktop | Mobile |
| --- | --- | --- |
| `thumbs/` (webp, 320 px) | 120 req, 1 170 384 B | 120 req, 1 170 384 B |
| `display/` (webp, 1600 px) | 4 req, 910 240 B | 6 req, 1 216 586 B |
| **total** | **124 req, 2 080 624 B** | **126 req, 2 386 970 B** |

The gallery already ships webp at both sizes, so `modern-image-formats` and `uses-optimized-images`
both score 1.0 here. Its remaining cost is (a) 120 eager thumbnail requests and (b) `display/`
images fixed at 1600 px wide regardless of viewport -- `uses-responsive-images` reports
**1 897 406 B / 5220 ms** of mobile savings across 122 images. A responsive `srcset` on the
gallery, not a format change, is where the gallery's AC-006 headroom lives.

## Lighthouse image opportunity audits

Median-run values. These quantify where the AC-006 reduction can come from.

**`/` (home)**

| Audit | Score | Potential savings |
| --- | --- | --- |
| `modern-image-formats` | 0.00 | 1 337 534 B (1230 ms mobile) |
| `uses-responsive-images` | 0.50 | 1 474 805 B mobile / 1 854 636 B desktop |
| `uses-optimized-images` | 0.50 | 381 493 B |
| `unsized-images` | 0.50 | 6 images lack intrinsic dimensions |
| `prioritize-lcp-image` | 0.00 | 607 ms mobile |
| `render-blocking-resources` | 0.00 | 600 ms mobile |

`modern-image-formats` alone reports 1 337 534 B of the home page's 2 593 063 B, i.e. **51.6%** --
AC-006's >=50% target is reachable on the home page from format conversion alone, before any
responsive-sizing work.

**`/totdgallery`**

| Audit | Score | Potential savings |
| --- | --- | --- |
| `uses-responsive-images` | 0.00 | 1 897 406 B (5220 ms mobile), 122 images |
| `modern-image-formats` | 1.00 | 0 B (already webp) |
| `uses-optimized-images` | 1.00 | 0 B |
| `unsized-images` | 0.50 | 78-85 images lack intrinsic dimensions |
| `render-blocking-resources` | 0.00 | 600 ms mobile |

## Non-image page weight (context for AC-008)

The mobile Performance gap is not purely images. Recorded so Phase 3 does not misattribute a
regression:

| Resource | Home (mobile) | Gallery (mobile) |
| --- | --- | --- |
| Total transfer | 4 172 595 B | 2 711 077 B |
| Script | 1 115 683 B | 260 770 B |
| Stylesheet | 166 326 B | 55 686 B |
| Third-party (AdSense) | 1 316 847 B | 58 284 B |

The home page pulls **1 316 847 B of third-party AdSense** from the global
`pagead2.googlesyndication.com` script in `index.html:79`, despite every `AdSenseSlot` call site
being commented out. That is ~32% of home-page transfer weight buying nothing, and it is the main
reason home mobile (67) scores worse than the 120-image gallery (60 is close despite 126 requests).
The main JS bundle is 658.66 kB raw / 202.71 kB gzip in a single unsplit chunk.

## Build-output findings (not scored by AC-006, but material)

Static audit of `dist/` after `npm run build`:

| Group | Files | Bytes |
| --- | --- | --- |
| `gallery/nd-totd2025/original` | 125 | 485 531 655 |
| `assets` (vite-hashed) | 165 | 438 903 550 |
| `gallery/nd-hillcountry/original` | 80 | 188 908 090 |
| `images` (public passthrough) | 46 | 73 893 793 |
| `gallery/nd-totd2025/display` | 125 | 35 234 186 |
| `gallery/nd-hillcountry/display` | 80 | 20 335 646 |
| `gallery/nd-totd2025/thumbs` | 125 | 1 180 800 |
| `gallery/nd-hillcountry/thumbs` | 80 | 609 078 |
| **`dist/` total (all types)** | | **1 245 771 652 (1.25 GB)** |

Three items a Phase-3 story should pick up:

1. **674 439 745 B (674 MB) of gallery `original/` files are deployed and never requested.**
   `scripts/build-gallery.mjs:62` copies every source image into `public/gallery/<id>/original/`
   and records it as the manifest's `full` field. Nothing in `src/` reads `full` -- verified by
   grep. That is 54% of the deploy payload serving no route.
2. **`fireball-2-*.jpg` (1 853 957 B) ships in `dist/assets/` and is never requested.**
   `src/components/Garage/Cards.jsx:10` imports it and maps it to card id 6 (`Cards.jsx:19`), but
   `src/components/Garage/Cars.json` defines only ids 1-5, so the card never renders. It is the
   single largest unreferenced asset in `assets/`.
3. **A CSS asset reference does not resolve at build time.** `vite build` warns that
   `../images/na/12370846_10207031045027913_1491479945616786482_o.jpg`, referenced from
   `src/assets/css/style.css`, "didn't resolve at build time, it will remain unchanged to be
   resolved at runtime" -- i.e. it is a live 404 wherever that rule applies.

`dist/` at 1.25 GB is also a Netlify concern independent of Feature C: it inflates build upload
time on every deploy and counts against bandwidth on any request that does reach `original/`.

## Methodology

Reproduce exactly. Any deviation invalidates comparison against the tables above.

### 1. Build

```
npm ci
npm run build
```

Node v22.14.0. Do **not** use a dev server -- `npm run dev` serves unbundled modules and produces
meaningless scores.

### 2. Serve

```
npx vite preview --port 4173 --host 127.0.0.1
```

Leave running. `vite preview` provides the SPA history fallback, so `/totdgallery` resolves.
Confirm `curl -o /dev/null -w "%{http_code}" http://127.0.0.1:4173/totdgallery` returns 200 before
auditing.

### 3. Install Lighthouse out-of-tree

Lighthouse is deliberately **not** a project dependency (it is a ~200 MB measurement-only tool and
the project has no CI runner to amortise it).

```
mkdir -p "$TMP/lh" && cd "$TMP/lh" && npm init -y && npm install lighthouse
```

On Windows the install path must be **short**. See [Environment traps](#environment-traps).

### 4. Run the matrix

```
CHROME_PATH="C:/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
LH_DIR="$TMP/lh/node_modules" \
node scripts/perf/lh-baseline.mjs
```

`scripts/perf/lh-baseline.mjs` runs 3 iterations of {home, totdgallery} x {desktop, mobile},
prints median Perf / LCP / FCP / TBT / CLS and first-party image request count and bytes, then
prints the static `dist/` image inventory. Overrides: `PERF_ORIGIN`, `PERF_ITERATIONS`.

All four audits reuse **one** Chrome instance, launched with
`--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage`. Default Lighthouse throttling
is used for both presets -- do not pass custom throttling flags.

### 5. Read the numbers

- **Lighthouse score** -- `categories.performance.score * 100`, median of 3.
- **LCP** -- `audits["largest-contentful-paint"].numericValue`, median of 3.
- **Image bytes (AC-006)** -- sum of `transferSize` over `audits["network-requests"].details.items`
  where `resourceType === "Image"` **and** the URL is first-party. Excluding third-party is
  mandatory: AdSense contributes 7-8 image requests to the home page that Feature C does not
  control, and including them would flatter the reduction.

### Environment traps

Both of these cost real time during the Task 00048 capture.

- **Windows MAX_PATH breaks Lighthouse silently.** Node reads lighthouse's nested
  `core/lib/cdt/package.json` (the `{"type":"commonjs"}` marker) at roughly 66 characters of path
  suffix. If the install directory is long enough to push that past 260 characters, the read fails
  without a filesystem error and every audit dies with `The requested module '../../lib/cdt/SDK.js'
  does not provide an export named 'default'`. Install Lighthouse at a short path
  (`C:\Users\<user>\AppData\Local\Temp\lh` works; a per-session scratchpad directory does not).
- **The Lighthouse CLI does not run on Node 22.14.** `lighthouse/cli/index.js` fails with
  `ERR_REQUIRE_CYCLE_MODULE` on `puppeteer-core`. Use the Node API (as `lh-baseline.mjs` does),
  which does not load `puppeteer-core` at all.

### Known divergence from production

The audits run against `vite preview` on localhost, **not** against https://jeffgoji.com/ on
Netlify. Effects:

- No CDN TTFB, no real DNS/TLS handshake, no HTTP/2 or Brotli-at-edge. Lighthouse's `simulate`
  throttling models the network from measured resource sizes, so byte-driven metrics (LCP, Speed
  Index) transfer reasonably; connection-setup-driven metrics do not.
- `public/_headers` and `public/_redirects` are Netlify directives and are **not** applied by
  `vite preview`. Cache-Control differences do not affect a cold load, which is what is measured.
- AdSense is fetched from the live network in both cases, and is the main source of run-to-run
  variance on the home page.

Absolute scores against the deployed site will differ. **The image-byte figures will not** -- they
are a property of the build, and are the AC-006 numbers. If a live-URL Lighthouse pass against V1
is wanted for a production-accurate AC-007/AC-008 reference, it must be run before V2 ships, since
V1 becomes unreachable afterwards. Steps 3-5 above work unchanged against a live URL via
`PERF_ORIGIN=https://jeffgoji.com`.
