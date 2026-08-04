/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers Task 00030's second half: the driver-intro section. The mockup declares
 * this section's grid inline, so the port's whole risk is in the stylesheet —
 * hence the split between markup assertions here and compiled-CSS assertions
 * below, the same trade Footer/index.test.jsx makes.
 */

import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';

import * as sass from 'sass';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import DriverIntro from './index';

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

afterEach(cleanup);

describe('the section carries the mockups bio column', () => {
    it('opens with the eyebrow and the driver heading', () => {
        render(<DriverIntro />);

        expect(document.querySelector('.driver-intro__inner .eyebrow')).not.toBeNull();
        expect(
            screen.getByRole('heading', { level: 2 }).classList.contains('driver-intro__name')
        ).toBe(true);
    });

    it('sits under the hero as an h2, not a competing h1', () => {
        render(<DriverIntro />);

        expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    });

    it('runs the bio at the lead measure rather than full bleed', () => {
        render(<DriverIntro />);

        expect(document.querySelector('.driver-intro__bio')).not.toBeNull();

        const bio = topLevelDeclarationsOf('.driver-intro__bio');

        expect(bio.get('max-width')).toBe('52ch');
        expect(bio.get('font-size')).toBe('var(--fs-lead)');
    });
});

describe('the telemetry chips are the spec-sheet voice', () => {
    it('shows the three figures the mockup carries', () => {
        render(<DriverIntro />);

        const chips = document.querySelectorAll('.spec-row .chip');

        expect(chips).toHaveLength(3);

        for (const chip of chips) {
            expect(chip.querySelector('b'), 'every chip states a figure').not.toBeNull();
            expect(chip.querySelector('b').textContent).toMatch(/^\d+$/);
        }
    });

    it('sets the chips in Space Mono and picks the figure out in the bright ink', () => {
        expect(topLevelDeclarationsOf('.chip').get('font-family')).toBe('var(--font-mono)');
        expect(topLevelDeclarationsOf('.chip b').get('color')).toBe('var(--text-hi)');
    });

    it('wraps the row rather than letting it push the page wide', () => {
        const row = topLevelDeclarationsOf('.spec-row');

        expect(row.get('display')).toBe('flex');
        expect(row.get('flex-wrap')).toBe('wrap');
    });
});

describe('the portrait is graded and deferred', () => {
    it('grades the frame with the shared editorial layer', () => {
        render(<DriverIntro />);

        const portrait = document.querySelector('.driver-intro__portrait');

        expect(portrait.classList.contains('media--editorial')).toBe(true);
    });

    /** Below the fold on every width in the audit range. */
    it('defers the frame until it is needed', () => {
        render(<DriverIntro />);

        expect(
            document.querySelector('.driver-intro__portrait img').getAttribute('loading')
        ).toBe('lazy');
    });

    it('describes the frame rather than labelling it generically', () => {
        render(<DriverIntro />);

        const alt = document.querySelector('.driver-intro__portrait img').getAttribute('alt');

        expect(alt.length).toBeGreaterThan(20);
        expect(alt.toLowerCase()).not.toBe('the garage');
    });
});

describe('the section fits 360 through 1440 without overflowing', () => {
    it('lays the bio beside the portrait at desktop', () => {
        const inner = topLevelDeclarationsOf('.driver-intro__inner');

        expect(inner.get('grid-template-columns')).toBe('1.3fr 1fr');
        expect(inner.get('width')).toBe('100%');
        expect(inner.get('max-width')).toBe('var(--container-max)');
        expect(inner.get('margin-inline')).toBe('auto');
    });

    it('stacks to one column at 768 and below', () => {
        const [, phone] = css.split('@media (max-width: 768px)');

        expect(phone).toContain('.driver-intro__inner');
        expect(phone).toContain('grid-template-columns: 1fr');
    });

    it('narrows the gutter at 360', () => {
        const narrow = css.split('@media (max-width: 360px)').pop();

        expect(narrow).toContain('.driver-intro__inner');
        expect(narrow).toContain('padding-inline: var(--space-4)');
    });

    it('keeps the portrait fluid rather than at its intrinsic width', () => {
        const frame = topLevelDeclarationsOf('.driver-intro__portrait img');

        expect(frame.get('width')).toBe('100%');
        expect(frame.get('height')).toBe('auto');
        expect(topLevelDeclarationsOf('.driver-intro__portrait').get('overflow')).toBe('hidden');
    });
});
