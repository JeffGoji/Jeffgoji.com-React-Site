# test-strategist memory

Your accumulated tradecraft for this project. Captures what you have learned about how to do your job well on THIS codebase.

Curated by the dev-lead. You read; you do not write. When you finish a task and notice something worth persisting, report it to the dev-lead in your finishing summary -- the dev-lead decides what gets added here.

## Project tradecraft

- **Current posture: zero tests, zero test tooling.** No jest/vitest/testing-library/playwright/cypress in `package.json`; no `test` script; no `*.test.*`/`*.spec.*`/`__tests__` in `src/`. ESLint exists but only as a Vite plugin.
- **Recommended stack: Vitest + React Testing Library + jsdom** (native Vite 4 fit -- reuses `@vitejs/plugin-react`, runs the `.mjs` build script + pure ESM helpers directly). Add `@testing-library/jest-dom` + `@testing-library/user-event`. Suggested scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.
- **Proportionality: small personal SPA -- target ~15-20 tests.** Do NOT add Playwright/Cypress e2e, coverage-threshold gates, or component snapshot testing. Bugs hide in build/data logic, not the Bootstrap presentation.
- **Highest-value test targets (ranked)**:
  1. Pure helpers in `scripts/build-gallery.mjs` -- `parseDateAlt` (date-regex + fallback), `sortKeys` (numeric locale sort), `cleanName`. Highest ROI. **Prerequisite**: these are not exported -- frontend must export them + guard `main()` behind an entry check first.
  2. `src/components/Gallery/_thumbs/chunk.js` -- `chunkItems` / `buildChunkMap` (off-by-one / last-chunk-remainder surface).
  3. Blog JSON data-integrity (`src/assets/Data/*Blog.json`) -- every entry has `id/date/mileage/picture/cost/entry`; `id` is a UNIQUE NUMBER; `picture` non-empty and path-convention-consistent. Use `describe.each` over the four files so new blogs are auto-covered.
  4. Route-parity guard -- assert `App.jsx` `<Route>` paths and `entry-ssr.jsx`'s route table stay in sync, OR formally retire `entry-ssr.jsx`. Catches the known route drift.
  5. Blog pagination behavior (one representative, e.g. ND/Kasumi) -- 3/page, newest-id-first, Prev disabled on page 1 / Next on last, pagination hidden when `totalPages <= 1`.
- **Out of scope / low value**: static article & page components (`Suspension/*`, `Articles/2025/*`, `pages/*`), `AdSenseSlot`, YouTube embeds -- presentational, no logic.
- **Conventions**: co-locate `Component.test.jsx` next to source; pure-logic tests beside their module; data-integrity tests as `blogData.test.js`. `vitest.config.js` with `environment: 'jsdom'`, `globals: true`, a `setup.js` importing jest-dom and resetting mocks/localStorage between tests (`hydrateThumbnails` leaks cache state otherwise).

## Anti-patterns to avoid

- Do NOT run test suites yourself -- centralized execution is the dev-lead's job. Author tests only. The gate is `npm test` (= `vitest run`) exiting non-zero, run only by the dev-lead.

## Tool / environment quirks

- The `.mjs` gallery build script and its helpers are plain ESM -- Vitest runs them directly (no Babel needed). This is a reason to prefer Vitest over Jest here.
