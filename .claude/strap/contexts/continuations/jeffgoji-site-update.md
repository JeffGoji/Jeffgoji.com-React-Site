---
topic: jeffgoji-site-update
last_updated: 2026-08-01T20:10:00Z
last_author: JeffGoji
status: active
linked_work_items: ["00003", "00004", "00005", "00006"]
---

# jeffgoji.com V2 site update

## What this is

The V2 initiative for jeffgoji.com: a full "new everything" redesign with three goals — (1) a modern dark motorsport-editorial look, (2) image-loading/performance overhaul, (3) a self-documenting "V2 What's New" page. Run through the STRAP pipeline with the agent team. As of this checkpoint, the ENTIRE planning phase is complete — Requirement → Spec → approved mockups → 4 Features → all Stories/Tasks decomposed and persisted. The next phase is execution (`/plan-sprint` → `/execute-sprint`). Full durable detail lives in dev-lead memory `v2-initiative.md`.

## Where we left off

**ALL 4 Features are fully decomposed, persisted, and `active`** — the entire V2 backlog is built. `/decompose-feature` run on 00003, 00004, 00005, 00006. Totals: **16 Stories (00007-00011, 00026-00029, 00042-00045, 00061-00063) + 51 Tasks (00012-00025, 00030-00041, 00046-00060, 00064-00073)**, ~200 senior-dev-hours across the four Features. `.next-id`=74. Nothing executed yet — the next step is `/plan-sprint` + `/execute-sprint`.

## Files in flight

All V2 artifacts are UNCOMMITTED (created after commit f7bb2ac on branch `feature/strap-onboarding`; ~90 files):
- `.claude/strap/work/requirement/00001.yaml` — Requirement (resolved).
- `.claude/strap/work/spec/00002.yaml` — Spec (resolved; carries Mockup Reference + Wiring Guide).
- `.claude/strap/work/feature/0000{3,4,5,6}.yaml` — Features A/B/C/D (00003 `active`+decomposed; 00004-00006 `new`).
- `.claude/strap/work/story/*.yaml` (16 stories) + `task/*.yaml` (51 tasks) — the full A/B/C/D decomposition (all `new`).
- `.claude/strap/mockups/spec-00002/` — approved mockup set (12 files + assets/img photos).
- `.claude/strap/memory/dev-lead/v2-initiative.md` — the durable V2 map (decisions + pipeline progress).
- `.claude/strap/memory/agents/{designer,spec-lead}.md` — curated tradecraft.
- `.claude/strap/state/{devops,code}-connection.yaml`, `usage.yaml` — connection profiles.
- `.claude/strap/work/.next-id` = 74 (next work item id).

## Open decisions

- **Start building?** Whole backlog is decomposed. Next: `/plan-sprint <feature-id>` then `/execute-sprint <feature-id>`. Execution order per assembly: Feature C's baseline Stories (00042/00043) FIRST → Feature A (00003) → Feature B (00004) + Feature C perf (00044/00045) → Feature D (00006) last.
- **RESTART Claude Code before `/execute-sprint`** so `gh` is on the Bash PATH (pipeline templates call `gh` bare).
- **SQ-001 analytics tool** (Plausible/Umami/Fathom) still TBD — pick before Feature C Story 00043 executes.
- **Security headers** (CSP/nosniff/HSTS on public/_headers) — out of Feature C scope, not an AC; open hardening item for security-reviewer.
- **Commit the V2 artifacts?** ~90+ uncommitted files (work items + mockups + memory) on `feature/strap-onboarding`. Worth a commit checkpoint (never push to main without approval).

## Open work items

- `#00001` — resolved — Requirement: V2 (3 goals).
- `#00002` — resolved — Spec: dark motorsport-editorial V2 (9 Parts, 18 ACs, mockups wired).
- `#00003` — **active** — Feature A (design foundation + shell). Stories 00007-00011, Tasks 00012-00025.
- `#00004` — **active** — Feature B (per-surface redesign). Stories 00026-00029, Tasks 00030-00041. Predecessor 00003.
- `#00005` — **active** — Feature C (image-perf + analytics + baseline). Stories 00042-00045 (C1a/C1b Phase 0, C2a/C2b Phase 3), Tasks 00046-00060.
- `#00006` — **active** — Feature D (What's New page). Stories 00061-00063, Tasks 00064-00073. Predecessors 00003/4/5 (LAST).
- All child Stories/Tasks are `new`, ready for sprint planning + execution.

## Quick resume

1. The whole backlog is decomposed. Start building: **restart Claude Code FIRST** so `gh` lands on PATH (`C:\Program Files\GitHub CLI\gh.exe`), then `/plan-sprint <feature-id>` → `/execute-sprint <feature-id>`.
2. Execution order (per assembly): Feature C baseline Stories 00042/00043 FIRST (baseline must precede A/B) → Feature A (00003) → Feature B (00004) + Feature C perf 00044/00045 → Feature D (00006) LAST. Pick the analytics tool (SQ-001) before Story 00043 runs.
3. Optionally commit the V2 planning artifacts (work items + mockups + memory) on `feature/strap-onboarding` at a checkpoint. Never push to `main`.

## Critical context

- **Estimates are human senior-dev hours for planning/velocity — NOT pipeline wall-clock.** Agents execute each task in minutes. (This confused the CPO once.)
- **The V2 planning artifacts are all uncommitted** on `feature/strap-onboarding`. Consider committing the work-item + mockup tree at a checkpoint (no push without CPO approval; never to `main`).
- **`gh` is NOT on the Bash PATH** until Claude Code restarts (installed mid-session). Use the full path for any gh call until then.
- **CreateTeam is unavailable this session** — parallel specialist dispatch uses background `Agent` tool calls; their reports arrive as teammate `SendMessage` bodies, then the agent goes idle.
- **Local strap-agile work-tracking**: one YAML file per work item under `.claude/strap/work/<type>/<id>.yaml`; monotonic zero-padded ids from `.next-id`; four-state machine (new→active→resolved→closed).
- **Locked V2 palette** (softer-dark): charcoal `#141418`, reading panel `#202027`, red `#E10600`, warm off-white text; Archivo/Inter/Space Mono; "Goji Line" logo. Full detail in `designer.md` memory + `mockups/spec-00002/assets/tokens.css`.
- **Two adopted design deltas**: galleries → single `/galleries` hub + switcher (old routes redirect); videos → poster facade (data-driven). In the Wiring Guide on Spec 00002.
- CPO preference: never commit to `main`; all work via feature/task branches + reviewed PR.

## Source-of-truth pointers

- `.claude/strap/memory/dev-lead/v2-initiative.md` — the durable V2 map: locked decisions + pipeline progress + resume path.
- `.claude/strap/work/spec/00002.yaml` — the Spec: Constituent Parts, 18 ACs, Mockup Reference + Wiring Guide.
- `.claude/strap/mockups/spec-00002/` — approved visual contract (open `index.html`); `assets/tokens.css` = design-token source of truth.
- `.claude/strap/memory/agents/designer.md` — locked palette/type/logo + hero roster + editorial-grade technique.
- `.claude/strap/memory/agents/{frontend-engineer,spec-lead,devops-lead}.md` — per-domain tradecraft.
- `.claude/strap/state/{code,devops}-connection.yaml` — GitHub (JeffGoji/Jeffgoji.com-React-Site) + local strap-agile profiles.
