/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers Task 00030: the rotating multi-car hero. The rotation itself is the
 * risky part — a pick that re-rolls on every render would swap the car under the
 * visitor mid-scroll — so the stability assertions drive Math.random rather than
 * observing whatever it happened to return.
 *
 * jsdom performs no layout, so the responsive assertions read the compiled
 * stylesheet rather than measuring a rendered box — the same trade
 * Footer/index.test.jsx and src/scss/styles.test.js make.
 */

import { useState } from 'react';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';

import * as sass from 'sass';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Hero from './index';
import { heroes, nightHero } from './heroes';

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

const renderHero = () =>
    render(
        <MemoryRouter>
            <Hero />
        </MemoryRouter>
    );

const heroImage = () => document.querySelector('.hero__media img');
const nameplate = () => document.querySelector('.hero__nameplate-name').textContent;

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('the rotation only ever lands on a shot from the list', () => {
    /** Includes both ends of Math.random's range: [0, 1). */
    it.each([0, 0.0001, 0.2, 0.5, 0.75, 0.999999])(
        'picks a listed shot when Math.random returns %f',
        (roll) => {
            vi.spyOn(Math, 'random').mockReturnValue(roll);
            renderHero();

            const shown = heroes.find((shot) => shot.alt === heroImage().getAttribute('alt'));

            expect(shown, 'the rendered frame is not one of heroes[]').toBeDefined();
            expect(heroImage().getAttribute('src')).toBe(shown.img);
            expect(nameplate()).toContain(shown.name);
            expect(nameplate()).toContain(shown.car);
        }
    );

    it('never indexes past the end of the list', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.999999999);
        renderHero();

        expect(heroImage().getAttribute('alt')).toBe(heroes[heroes.length - 1].alt);
    });

    it('carries one entry per car in the garage', () => {
        expect(heroes).toHaveLength(5);
        expect(new Set(heroes.map((shot) => shot.key)).size).toBe(heroes.length);
    });
});

describe('the pick is stable for the whole session', () => {
    /**
     * Re-renders the hero from a parent so the pick is exercised the way a real
     * composition would move it — Home re-rendering for an unrelated reason.
     */
    function Parent() {
        const [ticks, setTicks] = useState(0);

        return (
            <MemoryRouter>
                <button type="button" onClick={() => setTicks(ticks + 1)}>
                    bump
                </button>
                <span data-testid="ticks">{ticks}</span>
                <Hero />
            </MemoryRouter>
        );
    }

    it('does not reshuffle when the parent re-renders', () => {
        const roll = vi.spyOn(Math, 'random').mockReturnValue(0.5);

        render(<Parent />);

        const first = heroImage().getAttribute('src');
        const firstPlate = nameplate();

        roll.mockReturnValue(0.99);
        fireEvent.click(screen.getByRole('button', { name: 'bump' }));
        fireEvent.click(screen.getByRole('button', { name: 'bump' }));

        expect(screen.getByTestId('ticks').textContent).toBe('2');
        expect(heroImage().getAttribute('src')).toBe(first);
        expect(nameplate()).toBe(firstPlate);
    });

    it('rolls exactly once per mount', () => {
        const roll = vi.spyOn(Math, 'random').mockReturnValue(0.5);

        render(<Parent />);
        fireEvent.click(screen.getByRole('button', { name: 'bump' }));

        expect(roll).toHaveBeenCalledTimes(1);
    });

    /** A fresh visit is what re-rolls; that is the feature. */
    it('rolls again on a fresh mount', () => {
        const roll = vi.spyOn(Math, 'random').mockReturnValue(0);

        renderHero();
        const first = heroImage().getAttribute('alt');

        cleanup();
        roll.mockReturnValue(0.99);
        renderHero();

        expect(heroImage().getAttribute('alt')).not.toBe(first);
    });
});

describe('a frame that fails to load falls back to the night hero', () => {
    /** 0.5 lands on the NC shot, which is not itself the fallback frame. */
    const pickNonFallbackShot = () => vi.spyOn(Math, 'random').mockReturnValue(0.5);

    it('swaps in the night hero on an image error', () => {
        pickNonFallbackShot();
        renderHero();

        expect(heroImage().getAttribute('src')).not.toBe(nightHero.img);

        fireEvent.error(heroImage());

        expect(heroImage().getAttribute('src')).toBe(nightHero.img);
    });

    it('describes what is actually on screen after the swap', () => {
        pickNonFallbackShot();
        renderHero();

        fireEvent.error(heroImage());

        expect(heroImage().getAttribute('alt')).toBe(nightHero.alt);
    });

    /** The nameplate labels the rotation, not the pixels — as the mockup does. */
    it('keeps naming the picked car', () => {
        pickNonFallbackShot();
        renderHero();

        const picked = nameplate();
        fireEvent.error(heroImage());

        expect(nameplate()).toBe(picked);
    });

    it('settles rather than looping when the fallback errors too', () => {
        pickNonFallbackShot();
        renderHero();

        fireEvent.error(heroImage());
        fireEvent.error(heroImage());

        expect(heroImage().getAttribute('src')).toBe(nightHero.img);
    });

    it('cannot reference a missing file, because the fallback is a listed shot', () => {
        expect(heroes).toContain(nightHero);
    });
});

describe('responsive delivery degrades to what the pipeline has emitted', () => {
    it('omits srcset and sizes while no shot carries renditions', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        renderHero();

        expect(heroes.every((shot) => shot.srcSet === undefined)).toBe(true);
        expect(heroImage().hasAttribute('srcset')).toBe(false);
        expect(heroImage().hasAttribute('sizes')).toBe(false);
    });

    /**
     * The seam Feature C Task 00059 fills. Asserted against a stubbed shot list
     * because the renditions themselves are that Task's deliverable.
     */
    it('emits both once a shot carries renditions', async () => {
        const stub = {
            key: 'stub',
            img: '/stub.jpg',
            srcSet: '/stub-480.webp 480w, /stub-960.webp 960w',
            name: 'Stub',
            car: 'Stub chassis',
            alt: 'A stubbed frame',
        };

        vi.resetModules();
        vi.doMock('./heroes', () => ({ heroes: [stub], nightHero: stub }));

        try {
            const { default: StubbedHero } = await import('./index');

            render(
                <MemoryRouter>
                    <StubbedHero />
                </MemoryRouter>
            );

            expect(heroImage().getAttribute('srcset')).toBe(stub.srcSet);
            expect(heroImage().getAttribute('sizes')).toBe('100vw');
        } finally {
            vi.doUnmock('./heroes');
            vi.resetModules();
        }
    });
});

describe('the hero markup is the mockups block', () => {
    it('grades the frame with the hero-strength editorial layer', () => {
        renderHero();

        const media = document.querySelector('.hero__media');

        expect(media.classList.contains('media--editorial')).toBe(true);
        expect(media.classList.contains('media--editorial--hero')).toBe(true);
    });

    /**
     * Both darkening layers are load-bearing: the grade's multiply overlay tones
     * the photo, the scrim washes the corner the headline sits in. The brightest
     * source in the list is illegible with only one of them.
     */
    it('stacks the grade overlay and the scrim over the frame', () => {
        renderHero();

        expect(document.querySelector('.hero .hero__scrim')).not.toBeNull();
        expect(topLevelDeclarationsOf('.media--editorial::after').get('mix-blend-mode')).toBe(
            'multiply'
        );
        expect(topLevelDeclarationsOf('.hero__scrim').get('position')).toBe('absolute');
    });

    it('closes the block with the red baseline flag', () => {
        renderHero();

        const flag = topLevelDeclarationsOf('.hero__flag');

        expect(document.querySelector('.hero .hero__flag')).not.toBeNull();
        expect(flag.get('background')).toBe('var(--goji-red)');
        expect(flag.get('height')).toBe('6px');
    });

    it('leads with the eyebrow, the h1 and the lead', () => {
        renderHero();

        expect(document.querySelector('.hero__inner .eyebrow')).not.toBeNull();
        expect(screen.getByRole('heading', { level: 1 }).classList.contains('hero__title')).toBe(
            true
        );
        expect(document.querySelector('.hero__lead')).not.toBeNull();
    });

    it('sets the nameplate and the eyebrow in the telemetry face', () => {
        expect(topLevelDeclarationsOf('.hero__nameplate-label').get('font-family')).toBe(
            'var(--font-mono)'
        );
        expect(topLevelDeclarationsOf('.hero__nameplate-name').get('font-family')).toBe(
            'var(--font-mono)'
        );
        expect(topLevelDeclarationsOf('.eyebrow').get('font-family')).toBe('var(--font-mono)');
    });

    it('keeps the nameplate from swallowing clicks meant for the CTAs', () => {
        expect(topLevelDeclarationsOf('.hero__nameplate').get('pointer-events')).toBe('none');
    });
});

describe('both CTAs stay inside the SPA', () => {
    it('routes to paths App.jsx serves', () => {
        renderHero();

        const targets = [...document.querySelectorAll('.hero__cta a')].map((anchor) =>
            anchor.getAttribute('href')
        );

        expect(targets).toEqual(['/garage', '/totdgallery']);
    });

    it('carries the mockups primary and ghost treatments', () => {
        renderHero();

        const [primary, ghost] = document.querySelectorAll('.hero__cta a');

        expect(primary.classList.contains('btn--primary')).toBe(true);
        expect(ghost.classList.contains('btn--ghost')).toBe(true);
        expect(topLevelDeclarationsOf('.btn--primary').get('background')).toBe('var(--goji-red)');
        expect(topLevelDeclarationsOf('.btn--ghost').get('background')).toBe('transparent');
    });
});

describe('the hero fits 360 through 1440 without overflowing', () => {
    it('clips the cover frame instead of letting it push the page wide', () => {
        expect(topLevelDeclarationsOf('.hero').get('overflow')).toBe('hidden');

        const frame = topLevelDeclarationsOf('.hero__media img');

        expect(frame.get('width')).toBe('100%');
        expect(frame.get('height')).toBe('100%');
        expect(frame.get('object-fit')).toBe('cover');
    });

    it('holds the copy to a fluid container rather than a fixed width', () => {
        const inner = topLevelDeclarationsOf('.hero__inner');

        expect(inner.get('width')).toBe('100%');
        expect(inner.get('max-width')).toBe('var(--container-max)');
        expect(inner.get('margin-inline')).toBe('auto');
        expect(inner.get('padding-inline')).toBe('var(--space-5)');
    });

    it('scales the headline with the viewport instead of pinning a size', () => {
        expect(topLevelDeclarationsOf('.hero__title').get('font-size')).toBe('var(--fs-hero)');
        expect(css).toMatch(/--fs-hero:\s*clamp\(/);
    });

    it('shortens the block and tucks the nameplate in at 768 and below', () => {
        const [, phone] = css.split('@media (max-width: 768px)');

        expect(phone).toContain('.hero');
        expect(phone).toContain('min-height: 72vh');
        expect(phone).toContain('.hero__nameplate-label');
    });

    it('narrows the gutter at 360', () => {
        expect(css).toMatch(/@media \(max-width: 360px\)/);

        const narrow = css.split('@media (max-width: 360px)').pop();

        expect(narrow).toContain('.hero__inner');
        expect(narrow).toContain('padding-inline: var(--space-4)');
    });
});
