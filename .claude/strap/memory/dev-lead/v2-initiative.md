# V2 initiative -- jeffgoji.com redesign (kicked off 2026-08-01)

The CPO (technical product owner) assigned a V2 of the site as the active project. Three goals:

1. **Modern, exciting, enthusiast-attractive look** -- redesign the UI/UX so a car enthusiast wants to stay longer and explore. Visual overhaul is the headline goal.
2. **Performance-oriented** -- primarily image loading (the site has ~451 source JPGs, a half-consumed sharp gallery pipeline, and runtime canvas thumbnailing). Adopt better patterns/optimizations where found (lazy loading, responsive images/srcset, unify on the build-time sharp webp pipeline, code-splitting, drop the es2015 de-opt, etc.).
3. **"V2 What's New" summary page** -- a new in-site page highlighting the V2 changes, WHY they were made, and HOW they improved/accomplished goals 1 and 2. This is a meta/marketing page authored from the actual work done.

**Approach**: run the full STRAP pipeline with the agent team so memories/context accrue -- Requirement -> Spec -> mockups (designer, since goal 1 is visual) -> Features -> decompose -> execute-sprint -> PR. Active domains: client-ui (frontend-engineer, designer), infrastructure/build (devops-lead for the image pipeline + build perf), plus tech-writer for the What's New page content. security-reviewer + test-strategist always-active.

**Known V2-relevant findings already in the persistence stack** (from /strap-in): three unconsolidated gallery patterns + two thumbnail systems (goal 2 target); three overlapping styling systems + ineffective Bootstrap theme-map override (goal 1 must reconcile these first); vestigial es2015 target + dead entry-ssr.jsx (perf + cleanup); unpinned Node; four near-identical blog components (refactor opportunity during redesign). See project-profile.md Architecture notes + the per-agent memories.

**Constraints**: work on branches off main, never commit to main directly (CPO preference). `gh` needs Claude Code restart to be on PATH before execution skills run. Local working branch as of kickoff: feature/strap-onboarding (STRAP install; pushed).

## Locked V2 decisions (Requirement 00001, RESOLVED 2026-08-01)

Work item: `.claude/strap/work/requirement/00001.yaml` (resolved). CPO-approved decisions every downstream agent should honor:

- **Design language**: dark motorsport-editorial. **Black + red core palette** continuing the current theme (current anchors: red `#ff0000`, black, white text) but refined toward a *premium* red (not the harsh pure `#ff0000`). "New everything" — new logo, layout, components — within that black+red family. (Top-priority context for `designer`.)
- **Performance targets**: image weight −≥50% (home + a representative gallery vs V1 baseline); LCP ≤2.5s mid-tier mobile; Lighthouse Perf ≥90 desktop / ≥80 mobile. Approach: consolidate the 3 gallery patterns onto the build-time sharp→webp pipeline, responsive `srcset`/sizes, lazy-load below the fold, drop the vestigial `es2015` target, fix the multi-MB OG image.
- **Analytics**: APPROVED — add a lightweight, **cookieless, privacy-respecting** tool (e.g., Plausible). Capture a **V1 baseline early** (perf + engagement) so improvement is provable. (V1 had zero analytics.)
- **"V2 What's New" page**: **permanent** nav item. Audience = public car enthusiasts + autocross / great-drives fans. **Tone = exciting, entertaining, Top Gear / Jeremy Clarkson style** (NOT a dry changelog). Authored from actually-shipped work; every claim traceable.
- **Content**: keep ALL existing blogs/galleries/articles, re-presented in the new design. Clean up dead bits (orphaned `/totdtrip` route, "coming soon" gallery placeholder).
- **Responsive**: mobile-first; breakpoints ~360 / 768 / 1024 / 1440.
- **AdSense**: OUT of V2 (slots stay off) — but the redesign must NOT break the existing AdSense wiring (keep functional-but-inert for a later flip).
- **Timeline**: best-effort, no hard deadline. Stack stays React 18 + Vite + Netlify; no backend.

## Pipeline progress (as of 2026-08-01)

- **Requirement 00001** — RESOLVED. (`.claude/strap/work/requirement/00001.yaml`)
- **Spec 00002** — RESOLVED, 9 Constituent Parts (P1-P9), 18 ACs (AC-001..018). (`.claude/strap/work/spec/00002.yaml`)
- **Mockups** — CPO-APPROVED & LOCKED at `.claude/strap/mockups/spec-00002/` (5 iterations). Visual contract is final. Mockup Reference written into Spec 00002.
- **Mockup Wiring Guide** — WRITTEN via /analyze-mockups (2026-08-01). Pre-decomposition gate CLOSED. 0 blocking gaps; real Cars.json/*Blog.json contracts map cleanly. **Two CPO-ruled design deltas adopted:** (a) galleries → single `/galleries` hub with set-switcher (old per-gallery routes redirect); (b) videos → click-to-load poster facade (data-driven). Both extend P3.
- **Domains** — `designer` + `tech-writer` activated into client-ui (2026-08-01).
- **Work-tracking** — Local strap-agile; ids used: 00001=Requirement, 00002=Spec, 00003-00006=Features. `.next-id`=7.
- **Features** — GENERATED & persisted via /generate-features (2026-08-01), all `new`, linked to Spec 00002:
  - **00003 — Feature A**: Design foundation + app shell (P1/P5/P2). AC-002, AC-018.
  - **00004 — Feature B**: Per-surface redesign incl. rotating hero + video facade + galleries hub (P3). AC-001, AC-005, AC-016. Predecessor: 00003.
  - **00005 — Feature C**: Image-perf pipeline + analytics + V1 baseline (P4/P6). AC-003/004/006-013/017. **Split into 2 Stories at decompose: C1 baseline+hygiene (Phase 0, before A/B), C2 perf-overhaul (Phase 3).**
  - **00006 — Feature D**: "What's New" page (P7). AC-014, AC-015. Predecessors: 00003/00004/00005 (LAST).
  - Order: C1 baseline → A → B (+ C2 perf parallel) → D last. P8 security + P9 tests cross-cut into each.

- **ALL 4 Features DECOMPOSED + active** (2026-08-01). 16 Stories + 51 Tasks, ~200 senior-dev-hrs. `.next-id`=74.
  - A (00003): Stories 00007-00011, Tasks 00012-00025.
  - B (00004): Stories 00026-00029, Tasks 00030-00041 (shared components under src/components/common/).
  - C (00005): Stories 00042-00045 (C1a build-hygiene+baseline, C1b analytics+eng-baseline, C2a pipeline, C2b client-delivery), Tasks 00046-00060.
  - D (00006): Stories 00061-00063, Tasks 00064-00073.

## Execution progress (updated 2026-08-01, mid Feature C sprint)

- **Sprint 2026.08.A created** (2026-08-01 -> 2026-08-08, `.claude/strap/work/.iterations.yaml`). Fallback capacity model (no `iteration_get_capacity` on strap-agile): 6 hrs/day, solo CPO+agents pair-unit, logged in project-profile.md Conventions.
- **`/plan-sprint 00005` allocated Stories 00042+00043 only** (26h of 42h capacity, 7 Tasks). Stories 00044/00045 (32h, Phase 3 perf-overhaul) stayed unallocated overflow -- 00045 has an external dependency on Feature B's redesigned surfaces (not started), and 00044+00045 together would exceed capacity anyway. Re-run `/plan-sprint` once Feature B is underway.
- **SQ-001 resolved: Plausible (hosted)**, `data-domain="jeffgoji.com"`. CPO needs a Plausible account provisioned before AC-003 delivers real data (script is inert-but-harmless until then).
- **CreateTeam unavailable this session/environment** (tool not present in the harness despite `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` + `CLAUDE_CODE_SPAWN_BACKEND=auto` both being set correctly). Workaround: dev-lead creates git worktrees manually (`git worktree add --detach <path> <feature-branch>`) and dispatches specialists via background `Agent` calls (named, so `SendMessage` keeps working) instead of `CreateTeam` teammates. This is now the established pattern for /execute-sprint on this project until CreateTeam becomes available.
- **Windows long-path limit hit immediately** on first `git worktree add` (deeply nested worktree path + this repo's long legacy image filenames > 260 chars). Fixed once via `git config core.longpaths true` on the repo -- do this before the first worktree op on any future execute-sprint run here.
- **Branching resolution:** `main` was still at pre-STRAP-install commit (`0e29a57`) when execution started -- branching Feature work off it in default mode would have dropped `.claude/strap/**` from the working tree mid-run. Resolved by committing the V2 planning-artifact checkpoint to `feature/strap-onboarding` (commit `ff9fecd`) and running execute-sprint in **stacked mode**: Feature 00005's branch (`feature/00005-image-perf-analytics-baseline`) is stacked on `feature/strap-onboarding`, not `main`. Its eventual PR targets `feature/strap-onboarding`. **`main` still has no STRAP install or V2 work -- a PR merging `feature/strap-onboarding` (or later) into `main` is still an open step**, CPO's call on timing.
- **Feature 00005 (Feature C) PARTIAL execution complete 2026-08-01: Stories 00042+00043 fully resolved, all 7 sprint-allocated Tasks merged. PR #16 opened** (`feature/00005-image-perf-analytics-baseline` -> `feature/strap-onboarding`, stacked mode). Feature 00005 itself stays `active` -- Stories 00044/00045 (Phase-3 image-pipeline overhaul, AC-006..011) remain unallocated overflow for a future `/plan-sprint` once Feature B is underway. Node pinned to **22** (deviation from Spec's literal "20" -- EOL by 2026-08-01; dev-lead approved). V1 perf baseline captured via real Lighthouse (not proxy): home desktop Perf 82/LCP 2348ms, home mobile Perf 67/LCP 13373ms, gallery desktop Perf 93/LCP 1450ms, gallery mobile Perf 60/LCP 11214ms. Full baseline + methodology: `.claude/strap/project-docs/v1-perf-baseline.md` + `.claude/strap/project-docs/v1-engagement-baseline.md`. Test suite established from zero: Vitest 1.6.1 + RTL + jsdom, 30 tests, `npm test` now the centralized-execution gate. Two real regressions caught and fixed mid-execution (not deferred): a browser-support-floor gap from removing a stale `Object.hasOwn` polyfill, and a Plausible double-counting bug from its default SPA auto-tracking.
- **Open CPO action: provision a Plausible account for `jeffgoji.com`.** The engagement-baseline capture window (documented in `v1-engagement-baseline.md`) cannot start until this exists -- it's a paid hosted tier, a billing/ownership decision, not an engineering task. Every day this is delayed is baseline data that can't be recovered once V2 ships.
- **PR #16 needs a merge decision**, and separately, `feature/strap-onboarding` -> `main` still needs its own merge/PR at some point (main has no STRAP install or any V2 work yet) -- CPO's call on timing for both.

### Findings from the V1 baseline that should shape Phase-3 planning (Stories 00044/00045, not yet allocated)

- **Home page's LCP element is a CSS `background-image`** (`.splash-background`, `src/assets/css/style.css:20`), not an `<img>` -- it cannot carry `fetchpriority`/`preload` without markup changes. Converting the hero to a real `<img>` is a *prerequisite* for AC-007 on mobile (currently 4.5-5.3x over the 2.5s target), independent of byte reduction. A Phase-3 story that only does format conversion will still miss AC-007. Story 00045 (client-side responsive delivery, owns the hero per its Task 00059) needs this called out explicitly when it's dispatched.
- **Home and gallery need opposite fixes.** Home: 51.6% of image weight is already reachable via format conversion alone (`modern-image-formats` savings). Gallery: already all-webp, format work buys zero there -- its entire headroom is responsive sizing (`display/` fixed at 1600px regardless of viewport) + trimming 120+ eager thumbnail requests (`chunkSize`).
- **AdSense costs ~32% of home-page transfer weight (1.3MB) while fully inert** (every slot commented out, per Requirement 00001's "AdSense OUT of V2, keep functional-but-inert"). This is the single cheapest Lighthouse-score win available and it's not an image change -- may not belong in Feature C's image-work scope. CPO call whether it's worth a scoped exception or a separate work item; flagged, not yet actioned.
- **`dist/` is 1.25GB; 674MB (54%) is gallery `original/` full-res files that are never requested** (`build-gallery.mjs` copies every source to `original/`, manifest's `full` field, nothing in `src/` reads it). One-line fix, outside Task 00048's scope -- candidate for a new Task/Bug when Story 00044 (pipeline overhaul) is allocated, or sooner if the CPO wants the Netlify deploy-size win independently.
- **Known-stale non-blocking build warning**: a CSS asset reference in `style.css` (`../images/na/12370846_...jpg`) 404s at build time -- pre-existing, unrelated to V2 changes, worth a look whenever that file is next touched.
- The Lighthouse baseline was captured against `localhost:vite preview`, not the live Netlify URL -- image-byte figures (AC-006) are unaffected, but a live-URL pass is still needed for production-accurate AC-007/AC-008 before V1 is superseded (V1 becomes unmeasurable once V2 ships). Note this for whoever runs the Phase-3 re-measurement.

## RESUME PATH (if a session breaks mid-execution)

1. Confirm `git config core.longpaths` is `true` on the repo (set once already, should persist).
2. `/context-fetch jeffgoji-site-update` for full initiative context, then check Task status in `.claude/strap/work/task/*.yaml` (iteration=Sprint 2026.08.A) to see what's resolved vs still active/new.
3. Continue `/execute-sprint 00005` -- it should pick up from wherever the wave sequence left off (Wave 2: Tasks 00047, 00050; Wave 3: Tasks 00051, 00052; then integration audit + PR against `feature/strap-onboarding`).
4. Build-time photo follow-ups remain logged in Spec 00002 (NC webp, hero srcset, gallery watermarks, real TOTD frames) -- unrelated to Feature C, land during Feature B/C2 work.
