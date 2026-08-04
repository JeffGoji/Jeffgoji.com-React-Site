# spec-lead memory

Your accumulated tradecraft for this project. Captures what you have learned about how to do your job well on THIS codebase.

Curated by the dev-lead. You read; you do not write. When you finish a task and notice something worth persisting, report it to the dev-lead in your finishing summary -- the dev-lead decides what gets added here.

## Project tradecraft

- **Client-only static SPA, no backend.** "Backend/API contracts" here = the real data sources: `src/components/Garage/Cars.json` (cars), `src/assets/Data/{naBlog,MsmBlog,ndBlog,c8Blog}.json` (blog entries `{id,date,mileage,picture,cost,entry(markdown)}`), and `public/gallery/<slug>/manifest.json` emitted by `scripts/build-gallery.mjs` (items `{original,thumbnail,full,alt,description,loading,originalAlt(=gallery label),_thumbId}`; top-level `{id,label,count,items,skipped}`). YouTube video list is hardcoded in `YouTube/index.jsx` (not yet data-driven). Map mockup/spec data shapes against THESE, not a server API.
- **Blog `id` is load-bearing** — unique numeric; the sort (`b.id-a.id`) and React `key` both depend on it. Never let two entries share an id.
- **Blog `picture` path convention is inconsistent in the real data** — `picture` is root-relative WITHOUT a leading slash (served from `public/images/`), but inline markdown images sometimes use a leading slash (`/images/...`). Both resolve; carry as-is.
- **V2 Spec 00002** decomposes into P1-P9 (design-system, shell, per-surface, image-perf, styling-reconcile, analytics+baseline, What's-New, security, tests). Mockups at `.claude/strap/mockups/spec-00002/` are the approved verbatim visual contract; the Mockup Wiring Guide on the Spec maps data + names porting concerns.
- **Two CPO-ruled design deltas on V2** (adopted, extend P3): galleries consolidate to a single `/galleries` hub with a set-switcher (old per-gallery routes redirect); videos use a click-to-load poster facade (data-driven) instead of eager iframes.

## Anti-patterns to avoid

(empty -- populate as recurring mistakes get caught)

## Tool / environment quirks

- **`build-gallery.mjs` emits generic per-gallery `originalAlt` (= the gallery label) + `alt`/`description`, but NO per-image `label` or `thumbnailAlt`.** The V2 lightbox wants a per-image caption (`label`) + thumb alt. If per-image captions are desired site-wide, that's a build-SCRIPT enhancement (source alt/label per file), not just a wiring change — log it against P4, don't assume the manifest already carries it.

## Anti-patterns to avoid

(empty -- populate as recurring mistakes get caught)

## Tool / environment quirks

(empty -- populate as environment-specific friction gets discovered)
