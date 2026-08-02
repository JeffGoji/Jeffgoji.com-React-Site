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

**RESUME PATH (next steps, in order):**
1. **Restart Claude Code** so `gh` is on the Bash PATH (pipeline templates call `gh` bare).
2. `/plan-sprint <id>` → `/execute-sprint <id>`. Execution order: Feature C baseline Stories 00042/00043 FIRST → Feature A (00003) → Feature B (00004) + Feature C perf (00044/00045) → Feature D (00006) LAST. Pick SQ-001 analytics tool before Story 00043.
3. Multi-session build phase; each execute-sprint dispatches specialists in worktrees + opens a PR.

**REMINDER before execute-sprint:** restart Claude Code so `gh` is on PATH (pipeline templates call `gh` bare). Build-time photo follow-ups are logged in Spec 00002 (NC webp, hero srcset, gallery watermarks, real TOTD frames).
