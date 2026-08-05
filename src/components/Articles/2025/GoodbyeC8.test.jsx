/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers Task 00036: the C8 article moves off the Bootstrap grid onto the V2
 * editorial reading surface, its photos gain a generated width ladder, and none
 * of its prose changes on the way.
 *
 * jsdom performs no layout, so the measure and gutter assertions read the
 * compiled stylesheet rather than measuring a rendered box — the same trade
 * components/Footer/index.test.jsx and src/scss/styles.test.js make. That is
 * also why "no horizontal overflow" is asserted as the two declarations that
 * prevent it (a border-box measure, and photos capped at their panel) rather
 * than as a scrollWidth comparison, which jsdom always reports as zero.
 */

import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';

import * as sass from 'sass';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import GoodbyeC8 from './GoodbyeC8';

/**
 * Resolved from the Vitest root rather than import.meta.url: under jsdom
 * import.meta.url is a document-relative http URL, not a file URL.
 */
const ROOT = process.cwd();
const SCSS_DIR = resolve(ROOT, 'src/scss');
const NODE_MODULES = dirname(
    dirname(createRequire(resolve(ROOT, 'index.html')).resolve('bootstrap/package.json'))
);

const css = sass.compile(resolve(SCSS_DIR, 'styles.scss'), {
    loadPaths: [SCSS_DIR, NODE_MODULES],
    quietDeps: true,
    logger: sass.Logger.silent,
}).css;

const escapeForRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Reads one top-level rule's declarations; see the twin in styles.test.js. */
function topLevelDeclarationsOf(selector) {
    const match = css.match(new RegExp(`^${escapeForRegExp(selector)} \\{([^{}]*)\\}`, 'm'));

    expect(match, `no top-level ${selector} rule emitted`).not.toBeNull();

    return new Map(
        match[1]
            .split(';')
            .filter((declaration) => declaration.includes(':'))
            .map((declaration) => {
                const [name, ...rest] = declaration.split(':');

                return [name.trim(), rest.join(':').trim().replace(/\s+/g, ' ')];
            })
            .filter(([name]) => name)
    );
}

const renderArticle = () => render(<GoodbyeC8 />);

const photos = () => [...screen.getByRole('main').querySelectorAll('img')];

/** Collapses JSX's line-wrapping so prose can be matched as it reads. */
const prose = (container) => container.textContent.replace(/\s+/g, ' ').trim();

afterEach(cleanup);

describe('the article is built from the V2 reading surface', () => {
    it('is a main landmark carrying the article shell', () => {
        renderArticle();

        expect([...screen.getByRole('main').classList]).toEqual(['article']);
    });

    /**
     * The whole point of the port: the Bootstrap grid and the img-fluid sizing
     * helper are what the V2 language replaces.
     */
    it.each(['row', 'col', 'container', 'img-fluid', 'text-start', 'text-center', 'justify-content-center'])(
        'has dropped the pre-V2 Bootstrap class %s everywhere',
        (legacy) => {
            renderArticle();

            expect(screen.getByRole('main').querySelector(`.${legacy}`)).toBeNull();
        }
    );

    it('wraps every prose block in a post panel', () => {
        renderArticle();

        const posts = screen.getByRole('main').querySelectorAll('article.post');

        expect(posts).toHaveLength(7);

        for (const post of posts) {
            expect(post.querySelector('.post__body > .post__entry')).not.toBeNull();
        }
    });

    it('heads the page and its two named sections with section-head blocks', () => {
        renderArticle();

        expect(screen.getByRole('main').querySelectorAll('.section-head')).toHaveLength(3);
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Goodbye, Panda');
        expect(
            screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
        ).toEqual(['The Negatives', 'Final Thoughts']);
    });

    it('holds a reading measure that cannot overflow its viewport', () => {
        const article = topLevelDeclarationsOf('.article');

        expect(article.get('max-width')).toBe('760px');
        expect(article.get('margin-inline')).toBe('auto');
        expect(article.get('padding-inline')).toBe('var(--space-5)');
    });

    it('steps the gutters down below the tablet breakpoint', () => {
        expect(css).toContain('@media (max-width: 767.98px)');

        const mobile = css.split('@media (max-width: 767.98px)').pop();

        expect(mobile).toContain('.article');
        expect(mobile).toContain('padding-inline: var(--space-4)');
    });
});

describe('every photo is graded, sized and deferred', () => {
    it('carries all seven of the original photos', () => {
        renderArticle();

        expect(photos()).toHaveLength(7);
    });

    it('hangs each photo off a graded editorial media container', () => {
        renderArticle();

        for (const photo of photos()) {
            expect([...photo.parentElement.classList]).toEqual([
                'post__media',
                'media--editorial',
            ]);
        }
    });

    /** The grade layer only reaches an <img> that is a direct child. */
    it('caps each photo at its panel so nothing scrolls sideways', () => {
        expect(topLevelDeclarationsOf('.post__media img').get('width')).toBe('100%');
    });

    /**
     * The feed crops its posts to a uniform band; an article's photos are the
     * content, and one of these is a 4.3:1 panorama.
     */
    it('releases the article photos from the feed crop', () => {
        expect(topLevelDeclarationsOf('.article .post__media img').get('aspect-ratio')).toBe(
            'auto'
        );
    });

    it('reserves each box from the source geometry', () => {
        renderArticle();

        for (const photo of photos()) {
            expect(Number(photo.getAttribute('width'))).toBeGreaterThan(0);
            expect(Number(photo.getAttribute('height'))).toBeGreaterThan(0);
        }
    });

    it('advertises the generated width ladder with a matching sizes hint', () => {
        renderArticle();

        for (const photo of photos()) {
            expect(photo.getAttribute('sizes')).toBe('(max-width: 760px) 100vw, 760px');
            expect(photo.getAttribute('srcset')).toMatch(/^\/articles\/goodbye-c8\//);
        }
    });

    /**
     * scripts/build-article-images.mjs refuses to upscale, so a candidate wider
     * than the source names a file it never wrote. The 1080px-wide autocross
     * shot is the one that actually exercises this.
     */
    it('never advertises a candidate wider than its source', () => {
        renderArticle();

        for (const photo of photos()) {
            const intrinsic = Number(photo.getAttribute('width'));
            const candidates = photo
                .getAttribute('srcset')
                .split(',')
                .map((candidate) => Number(candidate.trim().split(/\s+/)[1].replace('w', '')));

            expect(candidates.length).toBeGreaterThan(0);

            for (const candidate of candidates) {
                expect(candidate).toBeLessThanOrEqual(intrinsic);
            }
        }
    });

    it('loads only the lead photo eagerly and defers the rest', () => {
        renderArticle();

        const [lead, ...below] = photos();

        expect(lead.getAttribute('loading')).toBe('eager');
        expect(below).toHaveLength(6);

        for (const photo of below) {
            expect(photo.getAttribute('loading')).toBe('lazy');
        }
    });

    /**
     * React 18.2 predates the `fetchPriority` prop and only passes an unknown
     * attribute through when it is spelled all-lowercase — so this guards that
     * the LCP hint actually reaches the DOM rather than being dropped.
     */
    it('flags the lead photo as the priority fetch and nothing else', () => {
        renderArticle();

        const [lead, ...below] = photos();

        expect(lead.getAttribute('fetchpriority')).toBe('high');

        for (const photo of below) {
            expect(photo.hasAttribute('fetchpriority')).toBe(false);
        }
    });

    /**
     * ResponsiveImage deliberately leaves `decoding` uncoupled from `loading`,
     * so the lead photo's synchronous decode is this surface's own call and can
     * be dropped by an edit that only looks at `loading`.
     */
    it('decodes the lead photo synchronously and the rest off the main thread', () => {
        renderArticle();

        const [lead, ...below] = photos();

        expect(lead.getAttribute('decoding')).toBe('sync');

        for (const photo of below) {
            expect(photo.getAttribute('decoding')).toBe('async');
        }
    });

    /**
     * The pre-V2 markup labelled all seven photos "Panda", which gives a
     * screen-reader user no way to tell them apart.
     */
    it('describes each photo distinctly', () => {
        renderArticle();

        const alts = photos().map((photo) => photo.getAttribute('alt'));

        expect(alts.every((alt) => alt && alt.length > 0)).toBe(true);
        expect(new Set(alts).size).toBe(alts.length);
    });
});

describe('the prose survives the re-skin intact', () => {
    it('opens on the original lede', () => {
        renderArticle();

        expect(prose(screen.getByRole('main'))).toContain(
            'Here at the end of a short but fun road. After three years and 16,000 miles, it is time to say goodbye to the C8 Corvette.'
        );
    });

    /** One anchor per prose block, so a dropped panel cannot pass unnoticed. */
    it.each([
        'The mid-engine layout gives it a handling characteristic that is unlike any previous Corvette',
        'the mag-ride is a game changer for combining ride comfort for daily driving duties',
        'PTM (Performance Traction Management) system',
        'The C8 has a sleek and modern look that turns heads wherever it goes.',
        'a 70th Anniversary Edition C8 with the Hardtop Convertible package',
        'While there are many positives to owning a C8 Corvette, there are also some negatives to consider.',
        'Overall, owning a C8 Corvette has been a fantastic experience.',
    ])('still reads "%s"', (anchor) => {
        renderArticle();

        expect(prose(screen.getByRole('main'))).toContain(anchor);
    });

    it('keeps all five negatives as a list', () => {
        renderArticle();

        const items = screen.getByRole('main').querySelectorAll('.post__entry li');

        expect(items).toHaveLength(5);
        expect(prose(items[2])).toContain('12 mpg combined is pretty much the norm');
    });

    it('closes on the goodbye, with the last photo after it', () => {
        renderArticle();

        const closing = [...screen.getByRole('main').querySelectorAll('article.post')].pop();

        expect(prose(closing)).toContain(
            "As I say goodbye to Panda, I will cherish the memories and experiences I've had with this amazing car."
        );
        expect(closing.lastElementChild.classList.contains('post__media')).toBe(true);
    });
});
