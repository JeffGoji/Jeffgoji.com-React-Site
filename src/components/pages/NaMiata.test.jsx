/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers Task 00038: the NA6 spec page is re-skinned onto the V2 component
 * language and `.na-background` is retired. The content assertions are the
 * point of the suite — this Task is a re-skin, and every string on the page has
 * to survive it byte for byte.
 *
 * jsdom performs no layout, so the responsive and chrome assertions read the
 * compiled stylesheet rather than measuring a rendered box — the same trade
 * Footer/index.test.jsx and src/scss/styles.test.js make.
 */

import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';

import * as sass from 'sass';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

import NaMiata from './NaMiata';

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

/**
 * Reads a top-level rule's declarations, folding EVERY rule with that exact
 * selector in source order so the map holds what the cascade actually resolves.
 *
 * The twin in styles.test.js reads the first match only, which is enough for
 * the selectors it probes because nothing else declares them. `.card` is not
 * one of those: Bootstrap ships its own `.card`, and the V2 block deliberately
 * reuses the name and wins by sitting below the Bootstrap import. Reading the
 * first match there would report Bootstrap's rule and miss the port entirely.
 */
function topLevelDeclarationsOf(selector) {
    const matches = [
        ...css.matchAll(new RegExp(`^${escapeForRegExp(selector)} \\{([^{}]*)\\}`, 'gm')),
    ];

    expect(matches.length, `no top-level ${selector} rule emitted`).toBeGreaterThan(0);

    const declarations = new Map();

    for (const [, body] of matches) {
        for (const declaration of body.split(';')) {
            const [name, ...rest] = declaration.split(':');

            if (name.trim()) {
                declarations.set(name.trim(), rest.join(':').trim().replace(/\s+/g, ' '));
            }
        }
    }

    return declarations;
}

/**
 * The page renders no router-aware element, so it mounts bare. Wrapping it in a
 * MemoryRouter would assert a dependency it does not have.
 */
const renderPage = () => render(<NaMiata />);

/** Every mod entry the pre-V2 markup carried, in its original wording. */
const MODS = [
    'Xida XL coilovers (300/200 lb/in spring rates)',
    'RacingBeat 15/16" front swaybar',
    'ILM suspension bushing kit',
    'RacingBeat Header',
    "Flyin'Miata high-flow cat",
    'Borla cat-back exhaust',
    'Mazdaspeed Miata 6-speed Transmission',
    '4.10 Torsen differential',
];

afterEach(cleanup);

describe('the re-skin preserves every string the pre-V2 page carried', () => {
    it('keeps the page title verbatim, quotes and all', () => {
        renderPage();

        expect(
            screen.getByRole('heading', { level: 1, name: '1991 NA 1.6 Miata - "Miyoshi"' })
        ).toBeDefined();
    });

    it('keeps the ownership paragraph verbatim', () => {
        renderPage();

        expect(
            screen.getByText(
                "I bought this 1991 Miata on February 23rd 2003, and I'm the third owner. The car is pretty amazing"
            )
        ).toBeDefined();
    });

    it('keeps the Modifications heading', () => {
        renderPage();

        expect(screen.getByRole('heading', { level: 2, name: 'Modifications' })).toBeDefined();
    });

    it.each(['Suspension', 'Engine', 'Drivetrain'])('keeps the %s group heading', (category) => {
        renderPage();

        expect(screen.getByRole('heading', { level: 3, name: category })).toBeDefined();
    });

    it.each(MODS)('keeps the mod entry %s', (mod) => {
        renderPage();

        expect(screen.getByText(mod)).toBeDefined();
    });

    it('carries exactly the eight mod entries and no more', () => {
        const { container } = renderPage();

        expect(container.querySelectorAll('.chip')).toHaveLength(MODS.length);
    });
});

describe('the mod list is grouped into V2 cards', () => {
    it('renders one card per modification category', () => {
        const { container } = renderPage();

        expect(container.querySelectorAll('.card')).toHaveLength(3);
    });

    it('renders every mod as a telemetry chip inside its own group', () => {
        const { container } = renderPage();

        const suspension = screen
            .getByRole('heading', { level: 3, name: 'Suspension' })
            .closest('.card');

        expect(
            [...within(suspension).getAllByRole('listitem')].map((item) => item.textContent)
        ).toEqual([
            'Xida XL coilovers (300/200 lb/in spring rates)',
            'RacingBeat 15/16" front swaybar',
            'ILM suspension bushing kit',
        ]);

        expect(container.querySelectorAll('.spec-row')).toHaveLength(3);
    });

    /**
     * The pre-V2 markup put <h4> elements directly inside a single <ul>, which
     * is invalid — a <ul> may only contain <li>. Grouping per category is what
     * fixes it, so the shape is asserted rather than left to drift back.
     */
    it('puts nothing but list items inside each list', () => {
        const { container } = renderPage();

        for (const list of container.querySelectorAll('ul')) {
            for (const child of list.children) {
                expect(child.tagName).toBe('LI');
            }
        }
    });

    it('seats the intro prose in the reading panel', () => {
        const { container } = renderPage();

        expect(container.querySelector('.post .post__body .post__entry')).not.toBeNull();
    });
});

describe('the page carries no pre-V2 chrome', () => {
    it.each(['na-background', 'container-fluid', 'text-center', 'rounded-2'])(
        'drops the pre-V2 class %s',
        (legacy) => {
            const { container } = renderPage();

            expect(container.querySelector(`.${legacy}`)).toBeNull();
        }
    );

    it('drops the fixed-attachment wash from the stylesheet too', () => {
        expect(css).not.toContain('.na-background');
        expect(css).not.toContain('background-attachment: fixed');
    });
});

describe('the V2 blocks the page leans on are in the compiled stylesheet', () => {
    it('gives the card the surface, hairline and radius the mockup specifies', () => {
        const card = topLevelDeclarationsOf('.card');

        expect(card.get('background')).toBe('var(--color-surface)');
        expect(card.get('border')).toBe('var(--hairline)');
        expect(card.get('border-radius')).toBe('var(--radius-lg)');
    });

    /**
     * `.card` is also a live Bootstrap component class. The V2 block only wins
     * because it is emitted below the Bootstrap import — move it above and the
     * cards silently revert to Bootstrap's light-mode chrome with no error.
     */
    it('emits the V2 card block below Bootstrap so it wins the shared properties', () => {
        const rules = [...css.matchAll(/^\.card \{([^{}]*)\}/gm)];

        expect(rules.length).toBeGreaterThan(1);
        expect(rules.at(-1)[1]).toContain('var(--color-surface)');
    });

    it('gives the reading panel the elevated charcoal surface', () => {
        expect(topLevelDeclarationsOf('.post').get('background')).toBe('var(--color-reading)');
    });

    it('sets the chips in the telemetry face', () => {
        const chip = topLevelDeclarationsOf('.chip');

        expect(chip.get('font-family')).toBe('var(--font-mono)');
        expect(chip.get('font-size')).toBe('var(--fs-xs)');
        expect(chip.get('background')).toBe('var(--ink-800)');
        expect(chip.get('border')).toBe('var(--hairline)');
    });

    /**
     * The one thing standing between a long mod name and a horizontally
     * scrolling 360px viewport: the chip row wraps instead of overflowing.
     */
    it('wraps the chip row rather than letting it overflow', () => {
        const specRow = topLevelDeclarationsOf('.spec-row');

        expect(specRow.get('display')).toBe('flex');
        expect(specRow.get('flex-wrap')).toBe('wrap');
    });

    it('sets the headings in the display face the base layer does not yet supply', () => {
        expect(topLevelDeclarationsOf('.card__title').get('font-family')).toBe(
            'var(--font-display)'
        );
    });
});

describe('the card grid reflows across the four target breakpoints', () => {
    /**
     * The columns come from Bootstrap's grid rather than a hand-rolled one, so
     * what is asserted is that the markup opts into the reflow: one column at
     * 360, two from md (768), three from lg (1024 and 1440).
     */
    it('opts each card into the md and lg column spans', () => {
        const { container } = renderPage();

        const columns = [...container.querySelectorAll('.row > div')];

        expect(columns).toHaveLength(3);

        for (const column of columns) {
            expect(column.classList.contains('col-md-6')).toBe(true);
            expect(column.classList.contains('col-lg-4')).toBe(true);
        }
    });

    it('holds the page to the container measure rather than running full bleed', () => {
        const { container } = renderPage();

        expect(container.querySelector('main.section > .container')).not.toBeNull();
    });
});
