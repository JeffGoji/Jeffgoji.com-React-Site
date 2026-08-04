/**
 * @vitest-environment jsdom
 *
 * Brand-asset probe for src/assets/logo.svg (Task 00016).
 *
 * The logo is the one visual artifact every page renders, and it is consumed as
 * INLINE markup, so this suite guards the four things that would break it
 * silently:
 *   1. it parses as well-formed XML and carries a sane, square-agnostic viewBox
 *      (a bad viewBox is invisible in review and wrong in the nav bar),
 *   2. the locked brand marks survive edits — two-tone wordmark, apex dot,
 *      #E10600 / #F6F6F4,
 *   3. the accessibility label required by the DoD is present and meaningful,
 *   4. the file is self-contained and inert, which is what makes it safe to
 *      inject through `?raw` + dangerouslySetInnerHTML.
 *
 * Environment is pinned per-file, matching test/index-html-meta.test.js — the
 * SVG never passes through React, so it is parsed as a static document.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const assetsDir = dirname(fileURLToPath(import.meta.url));

/** Locked palette values the logo is allowed to use (see the SVG's header). */
const GOJI_RED = '#E10600';
const WORDMARK_OFF_WHITE = '#F6F6F4';

/** Smallest height the nav bar renders the logo at. */
const MIN_NAV_HEIGHT = 24;

const source = readFileSync(resolve(assetsDir, 'logo.svg'), 'utf8');
const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
const svg = doc.documentElement;

/** Collects every element in the document, root included. */
const elements = [svg, ...svg.querySelectorAll('*')];

function textNode(startsWith) {
    return [...svg.querySelectorAll('text')].find((node) =>
        node.textContent.trim().startsWith(startsWith)
    );
}

describe('logo.svg is a well-formed, correctly proportioned asset', () => {
    it('parses without an XML error', () => {
        expect(doc.querySelector('parsererror')).toBeNull();
        expect(svg.tagName).toBe('svg');
        expect(svg.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
    });

    it('declares intrinsic width and height that match the viewBox ratio', () => {
        const [minX, minY, width, height] = svg
            .getAttribute('viewBox')
            .split(/[\s,]+/)
            .map(Number);

        expect([minX, minY]).toEqual([0, 0]);
        expect(width).toBeGreaterThan(0);
        expect(height).toBeGreaterThan(0);

        // Without matching intrinsic attributes, `height: 32px; width: auto`
        // letterboxes the mark instead of scaling it.
        expect(Number(svg.getAttribute('width'))).toBe(width);
        expect(Number(svg.getAttribute('height'))).toBe(height);
    });

    it('keeps the apex dot inside the viewBox at nav-bar sizes', () => {
        const dot = svg.querySelector('circle');
        const [cx, cy, r] = ['cx', 'cy', 'r'].map((name) => Number(dot.getAttribute(name)));
        const [, , width, height] = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);

        expect(cx - r).toBeGreaterThanOrEqual(0);
        expect(cy - r).toBeGreaterThanOrEqual(0);
        expect(cx + r).toBeLessThanOrEqual(width);
        expect(cy + r).toBeLessThanOrEqual(height);

        // The dot is the smallest feature in the logo; below roughly a pixel at
        // the smallest nav size it stops reading as an apex marker.
        expect((r * 2 * MIN_NAV_HEIGHT) / height).toBeGreaterThanOrEqual(1);
    });

    it('leaves the racing-line mark clear of the wordmark', () => {
        const markRight = Math.max(
            ...[...svg.querySelectorAll('path')].flatMap((path) =>
                [...path.getAttribute('d').matchAll(/[ML]\s*(-?[\d.]+)/g)].map(([, x]) => Number(x))
            )
        );
        const strokeRadius = Number(svg.querySelector('g').getAttribute('stroke-width')) / 2;

        expect(markRight + strokeRadius).toBeLessThan(Number(textNode('JEFF').getAttribute('x')));
    });
});

describe('the locked brand marks are intact', () => {
    it('renders the two-tone JEFFGOJI wordmark', () => {
        const wordmark = textNode('JEFF');

        expect(wordmark.textContent.replace(/\s+/g, '')).toBe('JEFFGOJI');
        expect(wordmark.getAttribute('fill')).toBe(WORDMARK_OFF_WHITE);

        const gojiHalf = wordmark.querySelector('tspan');

        expect(gojiHalf.textContent).toBe('GOJI');
        expect(gojiHalf.getAttribute('fill')).toBe(GOJI_RED);
    });

    it('renders the white apex dot', () => {
        expect(svg.querySelector('circle').getAttribute('fill')).toBe(WORDMARK_OFF_WHITE);
    });

    it('renders the THE GOJI LINE tagline', () => {
        expect(textNode('THE').textContent.trim()).toBe('THE GOJI LINE');
    });

    it('sets type in the self-hosted families only', () => {
        const families = [...svg.querySelectorAll('text')].map((node) =>
            node.getAttribute('font-family').split(',')[0].trim().replace(/['"]/g, '')
        );

        expect(families).toEqual(['Archivo', 'Space Mono']);
    });

    it('paints the G bar with a gradient that a flat path can actually show', () => {
        // The bar is a horizontal line, so its object bounding box has zero
        // height — and a bbox-relative gradient is not painted on zero-area
        // geometry. Defaulting gradientUnits turns the "G" back into a "C".
        for (const gradient of svg.querySelectorAll('linearGradient, radialGradient')) {
            expect(gradient.getAttribute('gradientUnits')).toBe('userSpaceOnUse');
        }
    });

    it('resolves every paint reference to a definition in this file', () => {
        for (const element of elements) {
            for (const attribute of ['fill', 'stroke']) {
                const reference = element.getAttribute(attribute)?.match(/^url\(#([^)]+)\)$/);

                if (reference) {
                    // Attribute selector, not `#id` — XML documents have no
                    // DTD here, so `id` is not a recognised ID attribute.
                    expect(
                        svg.querySelector(`[id="${reference[1]}"]`),
                        `dangling ${reference[0]}`
                    ).not.toBeNull();
                }
            }
        }
    });
});

describe('the asset meets the accessibility contract', () => {
    it('exposes itself as a labelled image', () => {
        expect(svg.getAttribute('role')).toBe('img');
        expect(svg.getAttribute('aria-label')).toMatch(/JEFFGOJI/);
    });

    it('does not leave the wordmark readable only as decoration', () => {
        expect(svg.getAttribute('aria-hidden')).toBeNull();
    });
});

describe('the asset is self-contained and inert', () => {
    it('embeds no external or raster resource', () => {
        expect(svg.querySelector('image')).toBeNull();
        expect(source).not.toMatch(/xlink:href|@import|https?:\/\/(?!www\.w3\.org)/);
    });

    it('carries no script or inline event handler', () => {
        expect(svg.querySelector('script')).toBeNull();

        for (const element of elements) {
            const handlers = [...element.attributes].filter((attribute) =>
                attribute.name.toLowerCase().startsWith('on')
            );

            expect(handlers.map((attribute) => attribute.name)).toEqual([]);
        }
    });

    it('stays small enough to inline on every page', () => {
        expect(Buffer.byteLength(source)).toBeLessThan(4096);
    });
});
