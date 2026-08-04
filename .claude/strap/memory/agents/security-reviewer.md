# security-reviewer memory

Your accumulated tradecraft for this project. Captures what you have learned about how to do your job well on THIS codebase.

Curated by the dev-lead. You read; you do not write. When you finish a task and notice something worth persisting, report it to the dev-lead in your finishing summary -- the dev-lead decides what gets added here.

## Project tradecraft

- **jeffgoji.com is a static-ish client-only React SPA with NO backend, NO auth, NO database, NO user input.** No forms, no fetch-to-backend, no cookies/localStorage of sensitivity. Calibrate severity accordingly -- this is a public content site, not an app with a trust boundary. Onboarding review found **no Critical or High** findings.
- **No secrets in source.** Grep for `apiKey/secret/token/password/AIza/Bearer` across `src/` = zero. `.env` files are gitignored and absent. AdSense publisher IDs (`ca-pub-*` in `index.html:9`, `public/ads.txt`) are **public by design** -- classify as informational, never as findings.
- **The only content-becomes-DOM path is the markdown blog renderer, and it is safe as configured.** `react-markdown` v10 + `remark-gfm` only -- NO `rehype-raw`, NO `dangerouslySetInnerHTML`, NO `DOMPurify` anywhere. Raw HTML in a JSON `entry` is escaped as text; default `urlTransform` strips `javascript:`/`vbscript:`/`data:` URLs. Authoring path is owner-only. **See the guardrail in rules -- this is one edit away from a stored-XSS sink.**
- **Outbound link hygiene is correct**: the four blog `a` overrides render `target="_blank" rel="noreferrer"` (noreferrer implies noopener), and props are spread before target/rel so markdown can't override them.
- **Only externally-loaded active code**: Google AdSense (`pagead2.googlesyndication.com`) and static YouTube embed iframes (`src/components/YouTube/index.jsx`) -- both hardcoded, no user-controlled URLs.

## Anti-patterns to avoid

- **Missing HTTP security headers (Low, open hardening item).** `public/_headers` sets only `Cache-Control`. No CSP, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, or HSTS. Recommended low-risk baseline for `/*`: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. CSP is non-trivial because of the Google ad stack -- introduce it in `Content-Security-Policy-Report-Only` mode first, tuned against `pagead2.googlesyndication.com` + `youtube.com/embed`, before enforcing.
- **Unused `firebase` SDK (Low)** in `package.json:15` -- dead supply-chain surface / future footgun (someone pasting a Firebase config with keys). Tree-shaken out today (never imported), so runtime attack surface is nil. Recommend removal.

## Tool / environment quirks

- Do not run `npm audit` / network scans as part of read-only review; report dependency risk as advisory.
