# CPO budget preferences

Set during `/strap-in` onboarding on 2026-08-01.

- **Per-agent budget (strap-in):** 500K tokens per specialist dispatch
- **Session aggregate (strap-in):** 1M tokens; 60% checkpoint threshold at 600K

The CPO chose a generous per-agent allowance (500K) with the default 1M session
aggregate. Defaults for the other workflows were written to `usage.yaml` silently and
can be tuned later via `/revise-token-budget` or `/memory-refine dev-lead`.
