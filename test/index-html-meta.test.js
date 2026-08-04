/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file so these run before a project-wide Vitest
 * environment is configured. index.html is parsed as a static document rather
 * than rendered, because these tags never pass through React.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

let head;

beforeAll(() => {
    const source = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

    head = new DOMParser().parseFromString(source, 'text/html').head;
});

/**
 * Asserts a meta tag exists and carries a non-empty content attribute. An empty
 * content value is as broken as a missing tag for crawlers and social unfurls.
 */
function expectMetaContent(selector) {
    const tag = head.querySelector(selector);

    expect(tag, `missing ${selector}`).not.toBeNull();
    expect(tag.getAttribute('content')).not.toBe('');
}

describe('index.html SEO metadata', () => {
    it('declares a canonical url', () => {
        const canonical = head.querySelector('link[rel="canonical"]');

        expect(canonical).not.toBeNull();
        expect(canonical.getAttribute('href')).not.toBe('');
    });

    it('declares a page description', () => {
        expectMetaContent('meta[name="description"]');
    });

    it.each([
        'meta[property="og:type"]',
        'meta[property="og:title"]',
        'meta[property="og:description"]',
        'meta[property="og:url"]',
        'meta[property="og:image"]',
    ])('declares %s', (selector) => {
        expectMetaContent(selector);
    });

    it.each([
        'meta[name="twitter:card"]',
        'meta[name="twitter:title"]',
        'meta[name="twitter:description"]',
        'meta[name="twitter:image"]',
    ])('declares %s', (selector) => {
        expectMetaContent(selector);
    });

    it('embeds well-formed JSON-LD structured data', () => {
        const jsonLd = head.querySelector('script[type="application/ld+json"]');

        expect(jsonLd).not.toBeNull();

        const parsed = JSON.parse(jsonLd.textContent);

        expect(parsed['@context']).toBe('https://schema.org');
        expect(parsed['@type']).toBe('Blog');
    });
});

describe('index.html AdSense wiring', () => {
    it('declares the adsense account meta', () => {
        expectMetaContent('meta[name="google-adsense-account"]');
    });

    it('loads the adsbygoogle global script asynchronously', () => {
        const script = head.querySelector(
            'script[src*="pagead2.googlesyndication.com"]'
        );

        expect(script).not.toBeNull();
        expect(script.hasAttribute('async')).toBe(true);
    });
});

describe('index.html analytics wiring', () => {
    /**
     * The manual build is load-bearing: the default Plausible build patches
     * history.pushState and fires its own pageview per SPA navigation, which
     * would double-count against src/hooks/usePageviews.js.
     */
    it('loads the manual Plausible build, not the auto-tracking build', () => {
        const script = head.querySelector('script[src*="plausible.io"]');

        expect(script).not.toBeNull();
        expect(script.getAttribute('src')).toContain('script.manual.js');
        expect(script.getAttribute('data-domain')).toBe('jeffgoji.com');
    });

    it('defers the analytics script so it is callable by first mount', () => {
        const script = head.querySelector('script[src*="plausible.io"]');

        expect(script.hasAttribute('defer')).toBe(true);
    });
});
