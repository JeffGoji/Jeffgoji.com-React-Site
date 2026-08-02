/**
 * The single seam between this app and the analytics vendor. Every call site goes
 * through here so a vendor swap is a one-file change, and so the vendor global may
 * be absent -- ad blockers, SSR, and the test environment all hit that path -- without
 * any caller having to care.
 *
 * Vendor is Plausible (cookieless). Its hosted script exposes `window.plausible` as a
 * callable once loaded; `index.html` uses the `script.manual.js` build, so this module
 * is the only thing that reports pageviews.
 */

/**
 * Reports a pageview for the current URL. Plausible reads `location.href` itself,
 * so the caller does not supply the path.
 */
export function trackPageview() {
    if (typeof window === 'undefined' || typeof window.plausible !== 'function') {
        return;
    }

    window.plausible('pageview');
}
