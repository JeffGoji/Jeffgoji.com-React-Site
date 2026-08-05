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

import { OG_PUBLIC_PATH } from '../scripts/build-og-image.mjs';

const ORIGIN = 'https://jeffgoji.com';

/** The one URL the swap in Task 00060 introduced, derived rather than retyped. */
const OG_IMAGE_URL = `${ORIGIN}${OG_PUBLIC_PATH}`;

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

/**
 * Task 00060 swapped the social card for a built 1200x630 JPEG. The previous URL
 * resolved to nothing — it named src/assets/images/na/, one segment short of the
 * file's real home, from a directory that is not a served root — so every unfurl
 * fell back to whatever the crawler could scrape off the page.
 */
describe('the social card points at the built rendition', () => {
    it.each([
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
    ])('%s names the built card', (selector) => {
        expect(head.querySelector(selector).getAttribute('content')).toBe(OG_IMAGE_URL);
    });

    it('keeps the JSON-LD image on the same URL as the meta tags', () => {
        const parsed = JSON.parse(
            head.querySelector('script[type="application/ld+json"]').textContent
        );

        expect(parsed.image).toBe(OG_IMAGE_URL);
    });

    /**
     * Not a stylistic preference. Facebook, LinkedIn and X still do not reliably
     * decode webp for link previews, so the one asset in this pipeline that a
     * crawler fetches is the one that must not be webp — a guard worth having
     * precisely because the rest of the pipeline's output is.
     */
    it('serves the card in a format social crawlers decode', () => {
        expect(OG_IMAGE_URL).toMatch(/\.(jpe?g|png)$/);
    });

    it('leaves no reference to the unresolvable path it replaced', () => {
        expect(head.innerHTML).not.toContain('/assets/images/');
    });
});

/**
 * The image swap was meant to be the only edit to this head. These assertions
 * are deliberately verbatim rather than shape-checked: the value of the guard is
 * that a copy edit smuggled in alongside an asset change fails the build. The
 * suite's usual rule against asserting on English strings does not reach here —
 * this project has no i18n primitive, and index.html's copy is crawler-facing
 * marketing text with no translation layer to key against.
 */
describe('nothing else in the head moved', () => {
    it.each([
        ['meta[name="viewport"]', 'width=device-width, initial-scale=1.0'],
        ['meta[name="google-adsense-account"]', 'ca-pub-8417979887134577'],
        [
            'meta[name="description"]',
            'Jeff Goji’s Car Blogs: daily driving stories, tuning guides, Miata modifications, autocross recaps, and performance tips.',
        ],
        [
            'meta[name="keywords"]',
            'Jeff Goji, car blog, Miata, automotive tuning, autocross, performance driving, car modifications, The Goji Line',
        ],
        ['meta[name="author"]', 'Jeff ‘Goji’ Anderson-Lester'],
        ['meta[name="robots"]', 'index, follow'],
        ['meta[property="og:type"]', 'website'],
        ['meta[property="og:title"]', 'JeffGoji.com'],
        [
            'meta[property="og:description"]',
            "Dive into Jeff Goji's world of cars: Miata builds, tuning tips, and autocross event recaps.",
        ],
        ['meta[property="og:url"]', 'https://jeffgoji.com/'],
        ['meta[name="twitter:card"]', 'summary_large_image'],
        ['meta[name="twitter:title"]', "JeffGoji.com - Jeff Goji's Car Blogs"],
        [
            'meta[name="twitter:description"]',
            'Car enthusiast blog by Jeff Goji: Miata mods, tuning guides, autocross stories, and performance upgrades.',
        ],
    ])('%s is unchanged', (selector, content) => {
        expect(head.querySelector(selector).getAttribute('content')).toBe(content);
    });

    it('keeps the canonical url, the title and the icon', () => {
        expect(head.querySelector('link[rel="canonical"]').getAttribute('href')).toBe(
            'https://jeffgoji.com/'
        );
        expect(head.querySelector('title').textContent).toBe(
            "JeffGoji.com - Jeff Goji's Car Blogs"
        );
        expect(head.querySelector('link[rel="icon"]').getAttribute('href')).toBe('/goji.svg');
    });

    it('changes nothing in the JSON-LD but the image', () => {
        const parsed = JSON.parse(
            head.querySelector('script[type="application/ld+json"]').textContent
        );

        expect(parsed).toEqual({
            '@context': 'https://schema.org',
            '@type': 'Blog',
            name: 'JeffGoji.com',
            url: 'https://jeffgoji.com/',
            author: {
                '@type': 'Person',
                name: "Jeffrey 'Goji' Anderson-Lester",
            },
            description:
                'Jeff Goji’s Car Blogs: daily driving stories, tuning guides, Miata modifications, autocross recaps, and performance tips.',
            publisher: {
                '@type': 'Organization',
                name: 'JeffGoji.com',
                logo: {
                    '@type': 'ImageObject',
                    url: 'https://jeffgoji.com/goji.svg',
                },
            },
            image: OG_IMAGE_URL,
        });
    });

    /** A new tag is as much a change as an edited one. */
    it('carries no meta tags beyond the documented set', () => {
        expect(
            [...head.querySelectorAll('meta')]
                .map((tag) => tag.getAttribute('name') ?? tag.getAttribute('property'))
                .filter(Boolean)
                .sort()
        ).toEqual([
            'author',
            'description',
            'google-adsense-account',
            'keywords',
            'og:description',
            'og:image',
            'og:title',
            'og:type',
            'og:url',
            'robots',
            'twitter:card',
            'twitter:description',
            'twitter:image',
            'twitter:title',
            'viewport',
        ]);
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
