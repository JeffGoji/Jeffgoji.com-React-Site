# devops-lead memory

Your accumulated tradecraft for this project. Captures what you have learned about how to do your job well on THIS codebase.

Curated by the dev-lead. You read; you do not write. When you finish a task and notice something worth persisting, report it to the dev-lead in your finishing summary -- the dev-lead decides what gets added here.

## Project tradecraft

- **Deploy topology: single-target static deploy on Netlify.** No CI service, no container, no IaC -- correct for a personal SPA. Pipeline is: `git push` -> Netlify build image (`npm install` pulls `sharp` native binary + `fast-glob`) -> `npm run build` (`gallery:build` sharp resize -> `public/gallery/`, then `vite build` -> `dist/`) -> publish `dist/`.
- **Netlify's own build IS the CI/CD.** Do NOT add GitHub Actions -- it would duplicate the per-push build and create a second config to drift. Not a git repo yet; `git init` + Netlify site link is the whole pipeline.
- **`sharp` is the single most fragile build link** -- a native binary, Node-version-sensitive, and Node is currently unpinned. Only the `nd-totd2025` gallery actually needs it.
- **Config files**: `netlify.toml` (command `npm run build`, publish `dist`), `public/_redirects` (`/* /index.html 200` SPA fallback -- correct), `public/_headers` (cache policy only).

## Anti-patterns to avoid

- **Unpinned Node version (highest-value fix).** No `.nvmrc`, no `NODE_VERSION` in `netlify.toml`. `sharp@0.34` needs Node >= 18.17. Pin it (`[build.environment] NODE_VERSION="20"` or `.nvmrc`) -- removes the biggest latent "worked last month, breaks on rebuild" risk. Do this first.
- **`immutable` cache header on non-hashed originals.** `public/_headers` marks `/gallery/*` `max-age=31536000, immutable`, but `original/` filenames are NOT content-hashed (`build-gallery.mjs:59` copies raw source name) -- a re-uploaded same-name photo serves stale for a year. `immutable` is only safe on the hashed `thumbs/` + `display/` webp derivatives.
- **Vestigial `target:'es2015'`** (`vite.config.js:8`) exists only to serve the dead SSG (vite-react-ssg renders via jsdom). With SSG dead it just ships a larger down-transpiled bundle to every real visitor. Either revive SSG (add dep, wire entry) OR delete `entry-ssr.jsx` and raise the target -- currently you pay both costs, get neither benefit.
- **Half-consumed gallery pre-build.** `build-gallery.mjs:33-44` builds two galleries; `nd-hillcountry`'s sharp output is regenerated every build but NEVER referenced (the HillCountry component uses `import.meta.globEager` static imports + runtime canvas thumbnailing instead). Wasted build time + CDN storage, and two parallel thumbnail systems. Pick one.
- **Hardcoded `GALLERIES` list** (`build-gallery.mjs:33`) with `srcDir` paths that must exist. Rename a dir -> `fast-glob` returns empty -> silently ships an empty manifest (`count:0`, no error). Add a "0 items found" guard. (Per-file error handling IS good -- bad images skipped and recorded in `manifest.skipped`.)
- **Missing security headers** on `public/_headers` -- policy owned by security-reviewer; the header block is the deploy surface. Add `nosniff`, `Referrer-Policy`, HSTS, `frame-ancestors`, and an AdSense-permissive CSP.

## Tool / environment quirks

- Windows dev host; on Windows prefer the PowerShell tool for native ops and Bash for portable text ops.
- Gallery build output (`public/gallery/`) is gitignored and regenerated from scratch every build (~186 images; seconds, scales linearly). No idempotency/caching -- fine at current scale.
