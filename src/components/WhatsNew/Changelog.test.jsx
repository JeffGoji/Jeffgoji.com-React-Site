/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers Task 00068: the numbered ledger. The rows and their readouts are what
 * this file guards — the page shell around them is asserted in index.test.jsx.
 *
 * jsdom performs no layout, so the ported-rule assertions read the compiled
 * stylesheet rather than measuring a rendered box, the same trade
 * index.test.jsx and styles.test.js make.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';

import * as sass from 'sass';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';

import Changelog from './Changelog';

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

const SOURCE = readFileSync(resolve(ROOT, 'src/components/WhatsNew/Changelog.jsx'), 'utf8');

/**
 * The raw-HTML guard reads code, not prose: the module's own documentation names
 * the forbidden identifier in order to explain why it is forbidden, and matching
 * that would make the guard fire on its own rationale.
 */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const escapeForRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Reads one top-level rule's declarations; see the twin in index.test.jsx. */
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

const entry = (n, overrides = {}) => ({
    ver: `V2.0 -- SECTION ${n}`,
    tag: `TAG-${n}`,
    goal: `GOAL ${n}`,
    title: `Title ${n}`,
    body: `Body ${n}`,
    why: `Why ${n}`,
    how: `How ${n}`,
    ...overrides,
});

const entries = (count) => Array.from({ length: count }, (unused, index) => entry(index + 1));

const renderLedger = (whatsNew) => {
    const { container } = render(<Changelog whatsNew={whatsNew} />);

    return container.querySelector('.changelog');
};

afterEach(cleanup);

describe('the ledger opens with the mockup head', () => {
    it('carries the eyebrow and the section heading', () => {
        const ledger = renderLedger(entries(2));
        const head = ledger.querySelector('.cl-head');

        expect(head.querySelector('.eyebrow').textContent).toBe('The ledger');
        expect(within(head).getByRole('heading', { level: 2 }).className).toContain(
            'cl-head__title'
        );
    });

    /**
     * The head is the section's own copy, not an entry's, so an empty content
     * file must still leave the reader something rather than a blank band.
     */
    it('stands on its own when there is nothing to list', () => {
        const ledger = renderLedger([]);

        expect(ledger.querySelector('.cl-head')).not.toBeNull();
        expect(ledger.querySelectorAll('.cl-item')).toHaveLength(0);
    });
});

describe('the ledger renders one numbered row per entry', () => {
    it.each([0, 1, 3, 12])('lists %i entries as %i rows', (count) => {
        expect(renderLedger(entries(count)).querySelectorAll('.cl-item')).toHaveLength(count);
    });

    /**
     * The number is derived from position, so it has to keep counting past the
     * fixture the page currently ships — and the zero-pad has to stop at two
     * digits rather than widening the column.
     */
    it('numbers the rows from 01 and pads only single digits', () => {
        const ledger = renderLedger(entries(11));
        const numbers = [...ledger.querySelectorAll('.cl-num')].map((el) => el.textContent);

        expect(numbers[0]).toBe('01');
        expect(numbers[8]).toBe('09');
        expect(numbers[9]).toBe('10');
        expect(numbers[10]).toBe('11');
    });
});

describe('each row carries the entry it was given', () => {
    it('paints both meta chips', () => {
        const row = renderLedger([entry(7)]).querySelector('.cl-item');

        expect(row.querySelector('.cl-meta .cl-tag').textContent).toBe('TAG-7');
        expect(row.querySelector('.cl-meta .cl-goal').textContent).toBe('GOAL 7');
    });

    it('paints the card title and body', () => {
        const row = renderLedger([entry(7)]).querySelector('.cl-item');

        expect(row.querySelector('.cl-card__title').textContent).toBe('Title 7');
        expect(row.querySelector('.cl-card__body').textContent).toBe('Body 7');
    });

    it('paints the WHY and HOW readout rows in that order', () => {
        const rows = renderLedger([entry(7)]).querySelectorAll('.cl-readout__row');

        expect(rows).toHaveLength(2);
        expect(rows[0].querySelector('.cl-readout__k').textContent).toContain('WHY');
        expect(rows[0].querySelector('.cl-readout__v').textContent).toBe('Why 7');
        expect(rows[1].querySelector('.cl-readout__k').textContent).toContain('HOW');
        expect(rows[1].querySelector('.cl-readout__v').textContent).toBe('How 7');
    });

    it('gives every row its own readout rather than one for the ledger', () => {
        const ledger = renderLedger(entries(4));

        expect(ledger.querySelectorAll('.cl-readout')).toHaveLength(4);
        expect(ledger.querySelectorAll('.cl-readout__row')).toHaveLength(8);
    });

    it('keeps the rows in the order the content file lists them', () => {
        const ledger = renderLedger(entries(3));
        const titles = [...ledger.querySelectorAll('.cl-card__title')].map((el) => el.textContent);

        expect(titles).toEqual(['Title 1', 'Title 2', 'Title 3']);
    });
});

/**
 * Spec 00002 P8 / AC-016. Two layers: the module may not reach for a raw-HTML
 * path, and a hostile entry must come out as text. The mockup builds these rows
 * by assigning innerHTML, so this is the one place the port deliberately
 * diverges from its source's mechanism.
 */
describe('the ledger renders entry fields as plain text', () => {
    it('never reaches for dangerouslySetInnerHTML', () => {
        expect(CODE).not.toContain('dangerouslySetInnerHTML');
    });

    it('never pulls in a markdown or raw-HTML renderer', () => {
        expect(CODE).not.toMatch(/markdown|remark|rehype/i);
    });

    it.each(['title', 'body', 'why', 'how'])(
        'escapes an HTML tag authored into %s instead of mounting it',
        (field) => {
            const payload = 'before <img src="x" onerror="window.pwned = true"> after';
            const ledger = renderLedger([entry(1, { [field]: payload })]);

            expect(ledger.querySelector('img')).toBeNull();
            expect(ledger.textContent).toContain(payload);
        }
    );

    it('mounts no script element from an entry', () => {
        renderLedger([entry(1, { body: '<script>window.pwned = true;</script>' })]);

        expect(document.querySelector('.changelog script')).toBeNull();
        expect(window.pwned).toBeUndefined();
    });
});

describe('the ledger is ported from the mockup (assets/app.css:482-547)', () => {
    it('hangs the rail off the ledger and offsets the rows past it', () => {
        const ledger = topLevelDeclarationsOf('.changelog');
        const rail = topLevelDeclarationsOf('.changelog::before');

        expect(ledger.get('position')).toBe('relative');
        expect(ledger.get('max-width')).toBe('920px');
        expect(ledger.get('padding-left')).toBe('clamp(var(--space-6), 9vw, 92px)');
        expect(rail.get('position')).toBe('absolute');
        expect(rail.get('background')).toBe('linear-gradient(var(--goji-red), transparent 92%)');
    });

    /**
     * The node sits on the rail only while the row's left padding, the rail's
     * offset and the node's offset stay the same two clamps; a change to one
     * without the others walks the nodes off the line.
     */
    it('pins each row node to the rail with the same two clamps', () => {
        const railOffset = 'clamp(28px, 4.5vw, 44px)';
        const rowOffset = 'clamp(var(--space-6), 9vw, 92px)';
        const node = topLevelDeclarationsOf('.cl-item::before').get('left');

        expect(topLevelDeclarationsOf('.changelog::before').get('left')).toBe(railOffset);
        expect(node).toContain(railOffset);
        expect(node).toContain(rowOffset);
        expect(topLevelDeclarationsOf('.cl-num').get('left')).toContain(rowOffset);
    });

    it('sets the number in the display face', () => {
        const number = topLevelDeclarationsOf('.cl-num');

        expect(number.get('position')).toBe('absolute');
        expect(number.get('font-family')).toBe('var(--font-display)');
        expect(number.get('font-style')).toBe('italic');
        expect(number.get('color')).toBe('var(--ink-400)');
    });

    it('gives the card the surface and hairline the rest of V2 uses', () => {
        const card = topLevelDeclarationsOf('.cl-card');

        expect(card.get('background')).toBe('var(--color-surface)');
        expect(card.get('border')).toBe('var(--hairline)');
        expect(card.get('border-radius')).toBe('var(--radius-lg)');
    });

    it('distinguishes the tag chip from the pilled goal chip', () => {
        expect(topLevelDeclarationsOf('.cl-tag').get('color')).toBe('var(--goji-red)');
        expect(topLevelDeclarationsOf('.cl-goal').get('border-radius')).toBe('var(--radius-pill)');
    });

    it('lays the readout out as a label column beside its value', () => {
        expect(topLevelDeclarationsOf('.cl-readout__row').get('grid-template-columns')).toBe(
            'auto 1fr'
        );
        expect(topLevelDeclarationsOf('.cl-readout').get('border-top')).toBe('var(--hairline)');
    });

    /**
     * The mockup names the readout's three inner classes `.row` / `.k` / `.v`.
     * Bootstrap owns `.row`, and its `.row > *` rule sets `width: 100%` on every
     * child — which outranks the single-class rules that size the two columns
     * and would collapse the readout onto one. The rename is the deviation that
     * keeps the ported layout, so it is guarded rather than left to drift back.
     */
    it('does not hand the readout back to Bootstrap grid class names', () => {
        expect(css).not.toContain('.cl-readout .row');
        expect(CODE).not.toMatch(/className="row"/);
    });

    /** whats-new.html:80 inlines these two; an inline style cannot be overridden. */
    it('carries the ledger heading style on a class', () => {
        const heading = topLevelDeclarationsOf('.cl-head__title');

        expect(heading.get('font-size')).toBe('var(--fs-h2)');
        expect(heading.get('text-transform')).toBe('uppercase');
        expect(CODE).not.toContain('style=');
    });

    it('stacks the readout under the narrow breakpoint', () => {
        expect(css).toMatch(
            /@media \(max-width: 480px\) \{\s*\.cl-readout__row \{[^}]*grid-template-columns: 1fr/
        );
    });
});
