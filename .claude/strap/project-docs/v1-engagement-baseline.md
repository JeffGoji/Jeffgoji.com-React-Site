# V1 engagement baseline

Reference set for Feature 00005 (Feature C) acceptance criterion **AC-004 (engagement half)**:
"a V1 engagement + perf baseline is captured and recorded in-repo BEFORE V2 UI ships, enabling a
documented before/after; post-launch engagement meets the confirmed target (working: +15% dwell,
measurable pages/session rise)."

Authored under Task 00051 (Story 00043, Phase 0). The perf half of AC-004 lives in
[`v1-perf-baseline.md`](./v1-perf-baseline.md) — read both; together they are the complete AC-004
before-set.

## Status: methodology + target, not numbers

**This document defines HOW the V1 engagement baseline is captured and WHAT it must be compared
against. It does not report engagement numbers, because none exist yet.**

That is a stated constraint, not a gap. Per **SQ-005** (Spec 00002 disposition, CPO, 2026-08-01):

> Capture the perf baseline immediately; the engagement baseline is best-effort over a short
> window (perf-only acceptable if engagement data is thin), given the no-hard-deadline timeline.

The site had no analytics of any kind before this sprint. Plausible landed in the same sprint that
this baseline is due (Task 00049 added the script tag; Task 00050 wired SPA route-change
pageviews), and **no Plausible account has been provisioned yet** — the `data-domain="jeffgoji.com"`
site does not exist on the Plausible side, so the script currently reports into nothing. There is
therefore zero historical engagement data to snapshot, and no way to manufacture it retroactively.

What this doc locks down instead — and what makes the before/after provable later — is the metric
list, the target, the capture procedure, and the window rule. When the account is provisioned and
the window closes, the numbers get filled into [Baseline capture](#baseline-capture-fill-when-the-window-closes)
below and this doc becomes the V1 before-set.

## Instrumentation as shipped

| Piece | Location | Behavior |
| --- | --- | --- |
| Vendor script | `index.html` (head, after the AdSense global) | Plausible hosted `script.manual.js`, `defer`, `data-domain="jeffgoji.com"` |
| Vendor seam | `src/lib/analytics.js` | `trackPageview()`; no-ops when `window.plausible` is absent (ad blockers, SSR, tests) |
| SPA reporter | `src/hooks/usePageviews.js` | One pageview per `useLocation().pathname` change |
| Mount point | `src/components/CustomComponents/PageviewTracker.js`, mounted in `src/App.jsx` inside `BrowserRouter` | Mounts the hook exactly once |

**`script.manual.js` is load-bearing.** Plausible's default build patches `history.pushState` and
fires its own pageview on every SPA navigation. Running it alongside `usePageviews()` would double
every route-change pageview and corrupt every metric in this document. The manual build makes
`src/lib/analytics.js` the only reporter. Do not swap the script back to `script.js`.

Cookieless by design: no cookies, no `localStorage`, no cross-site identifier (AC-003). Plausible
derives "unique visitor" from a daily-rotating salted hash, which is why the metrics below are
day-scoped and why visitor counts are not comparable across a salt rotation boundary.

## Tracked engagement signals

These are the Plausible dashboard metrics that constitute the baseline. All five are native to
Plausible's default site dashboard — **no custom goals, custom events, or custom properties are
required for AC-004**, and none should be added, since a metric that requires custom instrumentation
in V2 but not in V1 is not comparable.

| # | Metric | Plausible name | What it measures | Role in AC-004 |
| --- | --- | --- | --- | --- |
| E-1 | Pageviews | *Total Pageviews* | Total route renders, including SPA navigations | Volume context; denominator sanity check |
| E-2 | Unique visitors | *Unique Visitors* | Daily-hashed distinct visitors | Normalizes E-1 against traffic swings |
| E-3 | Pages per session | *Views per Visit* | Pageviews / visits | **Primary target metric** — must show a measurable rise |
| E-4 | Dwell proxy | *Visit Duration* (average) | Time from first to last event in a visit | **Primary target metric** — must rise >=15% |
| E-5 | Bounce rate | *Bounce Rate* | Visits with a single pageview | Guard metric — a pages/session rise driven purely by a bounce-rate artifact is not a real win |

Two supporting breakdowns are captured alongside the headline numbers, not as targets but so a
V2 change can be attributed rather than merely observed:

| # | Breakdown | Why it is captured |
| --- | --- | --- |
| E-6 | Top Pages (pageviews + visit duration per path) | V2 changes the UI unevenly; a site-wide dwell change needs per-route attribution |
| E-7 | Entry Pages + Sources | If V2's before/after window has a different traffic mix (e.g. a referral spike), a site-wide comparison is confounded and must be re-cut on the common source set |

### Why "Visit Duration" is a proxy and not dwell

Plausible computes visit duration as the elapsed time between the first and last *event* in a
visit. A single-pageview visit therefore has a duration of 0 regardless of how long the reader
actually spent on the page. This systematically understates dwell on a blog whose most engaging
outcome is "read one long post to the end."

This matters for the +15% target in a specific way: **E-4 will move if V2 causes more
navigation, even with no change in per-page reading time.** E-4 and E-3 are correlated by
construction, not independent. That is acceptable for AC-004 as written — the AC pairs them
deliberately — but the Phase-3 comparison must not present them as two independent confirmations
of the same improvement.

If a true per-page dwell measure is wanted later, it requires a custom engaged-time event
(a visibility/heartbeat timer reporting through `src/lib/analytics.js`). **That is explicitly out
of scope here**, because adding it after V1's window closes would make it V2-only and therefore
useless for a before/after.

## Targets

| Metric | V1 baseline | V2 target | Source |
| --- | --- | --- | --- |
| E-4 Visit Duration | _(fill from window)_ | **>= baseline x 1.15** (+15%) | AC-004 "working: +15% dwell" |
| E-3 Views per Visit | _(fill from window)_ | **Measurable rise** — strictly greater than baseline, and greater than the baseline's own day-to-day spread | AC-004 "measurable pages/session rise" |
| E-5 Bounce Rate | _(fill from window)_ | No target; must not *increase* while E-3/E-4 rise | Guard against artifact |
| E-1 / E-2 | _(fill from window)_ | No target | Context only |

"Measurable" for E-3 is defined against the baseline's own noise: record the per-day min and max
across the capture window, and treat the V2 figure as a real rise only if it exceeds the baseline
window's daily maximum. A 7-day mean on a low-traffic single-author blog carries meaningful
variance, and a rise inside that variance is not evidence.

**+15% on E-4 is a working target, not a contractual one** — AC-004's own wording marks it
"working". If the V1 window turns out to be too thin to support a percentage comparison (see
[Sufficiency test](#sufficiency-test)), the fallback disposition under SQ-005 is that the perf
baseline alone satisfies AC-004, and the engagement half is reported as directional rather than
quantitative. Whoever closes AC-004 makes that call explicitly and records it here rather than
silently relaxing the number.

## Capture window

**Rule: the first full Monday–Sunday week that begins after the Plausible account is provisioned
and verified receiving data, and that ends before any V2 UI ships to production.**

Monday–Sunday rather than "7 days from provisioning" because weekday/weekend traffic on a hobby
car blog differs enough that a window with an unbalanced day mix cannot be compared to a
differently-balanced one. The V2 comparison window must use the same rule.

Sequencing constraints:

1. Provisioning is a prerequisite and is **not** done. See [Blockers](#blockers).
2. The window must be entirely pre-V2. If a V2 UI change deploys mid-window, the window is void —
   restart it, or if V2 cannot wait, close the window early and record the short duration.
3. Do not start the clock on the provisioning day itself. Partial first days and verification
   traffic both skew a 7-day mean at this traffic volume.
4. Exclude the author's own visits. Plausible does not do this automatically; either browse the
   live site with an ad blocker that blocks `plausible.io`, or add an exclusion filter, and record
   in the capture table which method was used.

### Sufficiency test

Before the recorded window is treated as a valid baseline, check:

- **>= 7 complete days** of data.
- **>= 50 visits** across the window. Below that, Views per Visit and Visit Duration are dominated
  by individual sessions and a +15% delta is indistinguishable from one long visit.
- **No single day contributing > 40% of visits.** A referral spike inside a 7-day window makes the
  mean describe that spike, not the site.

If any check fails, the window is **thin**. A thin window is still recorded — it is better than
nothing and SQ-005 anticipates it — but it is labeled thin in the capture table, and the AC-004
engagement comparison is reported as directional (up / flat / down) rather than as a percentage.

## Capture method

Reproduce exactly for both the V1 window and the V2 comparison window. A metric read under a
different filter set is not comparable.

1. Confirm the tag is live: load `https://jeffgoji.com/` and verify a request to
   `plausible.io/api/event` fires, and that **no cookies and no `localStorage` entries** are set
   by `plausible.io` (this also re-verifies AC-003).
2. Confirm SPA tracking: navigate `/` -> `/garage` -> `/nd-blog` via in-app links and verify
   **three** `api/event` requests, one per route — not one, and not six. Six means the script tag
   reverted from `script.manual.js` to `script.js` and every number in the window is doubled.
3. In the Plausible dashboard for `jeffgoji.com`, set the date range to the exact capture window
   (custom range, not "Last 7 days" — the relative range moves).
4. Apply **no** filters. Record the site-wide figures for E-1..E-5 into
   [Baseline capture](#baseline-capture-fill-when-the-window-closes).
5. Record the per-day series for E-3 and E-5 (needed for the min/max spread that defines
   "measurable").
6. Record the Top Pages breakdown (E-6) for at least: `/`, `/garage`, the four blog routes
   (`/na-blog`, `/msm-blog`, `/nd-blog`, `/c8-blog`), and `/totdgallery`.
7. Record Entry Pages and Sources (E-7).
8. Export the raw CSV from Plausible and commit it next to this doc so the numbers survive
   independent of the dashboard's data-retention policy.

### Measurement traps specific to this codebase

These are properties of the V1 app that distort the metrics above. Each must hold constant across
the V1 and V2 windows, or the comparison breaks.

- **Blog pagination does not change the URL.** Every blog component holds its page in local
  `useState` (`src/components/blog/Panda/index.jsx:12` and its three near-identical siblings), so
  paging through posts fires **no** pageview. Deep reading of a blog is currently invisible to E-3.
  **If V2 makes pagination URL-driven (a route param or a query string), pages/session will rise
  purely from the instrumentation change and AC-004's E-3 target becomes meaningless.** Whoever
  implements V2 pagination must either keep it URL-free or flag the change here so the comparison
  is re-cut on a pagination-excluded basis. This is the single largest threat to a provable
  before/after.
- **`/totdtrip` and `/totdgallery` render the same component** (`src/App.jsx` route table). Traffic
  to one gallery is split across two paths in the Top Pages breakdown; sum them before comparing.
  `/totdtrip` is orphaned (nothing links to it), so the split should be small, but verify rather
  than assume.
- **Ad blockers suppress `plausible.io`.** A car-enthusiast audience blocks at an above-average
  rate, so absolute volume (E-1, E-2) understates reality. Ratio metrics (E-3, E-4, E-5) are
  affected only if blocking rates differ between windows, which is the assumption the comparison
  rests on. Do not report E-1/E-2 as traffic truth.
- **AdSense is present but inert** (AC-017) and contributes ~1.3 MB to the home page. It does not
  affect analytics correctness, but it does affect load time, which affects dwell — a V2 dwell rise
  may be partly a perf win rather than a content/UI win. Cross-read with
  [`v1-perf-baseline.md`](./v1-perf-baseline.md) before attributing an E-4 change to the redesign.
- **A visitor who lands, reads one post, and leaves registers duration 0.** See
  [Why "Visit Duration" is a proxy](#why-visit-duration-is-a-proxy-and-not-dwell).

## Baseline capture (fill when the window closes)

| Field | Value |
| --- | --- |
| Window start | _(YYYY-MM-DD, Monday)_ |
| Window end | _(YYYY-MM-DD, Sunday)_ |
| Days of data | _(must be >= 7)_ |
| Sufficiency | _(sufficient / **thin** — see [Sufficiency test](#sufficiency-test))_ |
| Author-traffic exclusion | _(ad blocker / dashboard filter)_ |
| Captured by | _(agent + Task id)_ |
| Codebase at capture | _(branch @ sha — must be pre-V2)_ |
| Raw export | _(committed CSV path)_ |

| Metric | Value | Per-day min | Per-day max |
| --- | --- | --- | --- |
| E-1 Pageviews | | | |
| E-2 Unique Visitors | | | |
| E-3 Views per Visit | | | |
| E-4 Visit Duration (avg) | | | |
| E-5 Bounce Rate | | | |

| Path | Pageviews | Avg. visit duration |
| --- | --- | --- |
| `/` | | |
| `/garage` | | |
| `/na-blog` | | |
| `/msm-blog` | | |
| `/nd-blog` | | |
| `/c8-blog` | | |
| `/totdgallery` (+ `/totdtrip`) | | |

## Blockers

1. **No Plausible account is provisioned.** `data-domain="jeffgoji.com"` has no corresponding site
   on plausible.io, so the shipped script reports into nothing and the capture window cannot start.
   This is an account/billing action outside any engineering task in this sprint — Plausible's
   hosted tier is paid, so it needs an owner decision, not just a signup. Raised in Task 00049 and
   restated here because it is now the sole thing standing between this methodology and a real
   baseline. **Every day between V1 shipping and provisioning is a day of baseline data that cannot
   be recovered.**
2. **The window gates V2.** AC-004 requires the baseline to precede V2 UI. With a Monday–Sunday
   window plus a provisioning lead time, V2's earliest safe ship date is roughly two weeks after
   provisioning completes. If V2 ships first, AC-004's engagement half cannot be satisfied at all —
   not thinly, but not at all — because V1 becomes unreachable and unmeasurable.

## Related

- [`v1-perf-baseline.md`](./v1-perf-baseline.md) — the perf half of AC-004 (AC-006 image bytes,
  AC-007 LCP, AC-008 Lighthouse), captured under Task 00048 with live V1 numbers.
