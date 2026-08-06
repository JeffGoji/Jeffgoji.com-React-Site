/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers Task 00064: the page shell. The two regions and the landmark shape are
 * what this file guards — the tiles inside the cluster (Task 00067) and the rows
 * inside the ledger (Task 00068) are asserted in their own components' tests.
 *
 * The route registration is asserted at App level rather than here; that is Task
 * 00066's contribution to the shared route-parity guard in src/App.test.jsx.
 *
 * jsdom performs no layout, so the ported-band assertions read the compiled
 * stylesheet rather than measuring a rendered box — the same trade
 * Hero/index.test.jsx and src/scss/styles.test.js make.
 */

import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';

import * as sass from 'sass';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import WhatsNew from './index';
import { whatsNew } from './data/whatsNew';

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

describe('the page mounts both regions of the mockup', () => {
    it('paints the dashboard band', () => {
        const { container } = render(<WhatsNew />);

        expect(container.querySelector('header.wn-dash')).not.toBeNull();
    });

    it('paints the ledger section', () => {
        const { container } = render(<WhatsNew />);

        expect(container.querySelector('section.section .wn-ledger__inner')).not.toBeNull();
    });

    it('opens the band with the masthead and its lead', () => {
        render(<WhatsNew />);

        expect(screen.getByRole('heading', { level: 1 }).className).toContain('wn-dash__title');
        expect(screen.getByText(/no vapourware/i)).not.toBeNull();
    });

    /**
     * The honesty note is the reason the TARGET badges are allowed to ship at
     * all (AC-015), so it is part of the shell's contract rather than the tiles'.
     */
    it('carries the TARGET caption under the cluster', () => {
        const { container } = render(<WhatsNew />);

        const caption = container.querySelector('.wn-dash .tele-caption');

        expect(caption).not.toBeNull();
        expect(caption.textContent).toMatch(/marked TARGET/);
    });

    it('closes the ledger with the goal legend', () => {
        const { container } = render(<WhatsNew />);

        const legend = container.querySelector('.wn-ledger__inner .wn-legend');

        expect(legend).not.toBeNull();
        expect(legend.textContent).toMatch(/GOAL 1/);
    });
});

describe('the page composes the two clusters', () => {
    it('hands the dashboard band the instrument cluster', () => {
        const { container } = render(<WhatsNew />);

        expect(container.querySelector('.wn-dash__inner .tele-grid')).not.toBeNull();
    });

    it('hands the ledger section the changelog', () => {
        const { container } = render(<WhatsNew />);

        expect(container.querySelector('.wn-ledger__inner .changelog')).not.toBeNull();
    });

    /**
     * The cluster renders its grid with nothing in it until the data module
     * (Task 00065) is threaded through. An empty grid must stay empty rather
     * than paint a placeholder tile a visitor would read as a real one.
     */
    it('leaves the instrument cluster empty while it is unwired', () => {
        const { container } = render(<WhatsNew />);

        expect(container.querySelector('.tele-grid').childElementCount).toBe(0);
    });

    /**
     * This page is the only reader of the data module, so the wiring is asserted
     * here; what the ledger does with the rows is Changelog.test.jsx's contract.
     */
    it('feeds the ledger the whatsNew entries from the data module', () => {
        const { container } = render(<WhatsNew />);

        expect(container.querySelectorAll('.changelog .cl-item')).toHaveLength(whatsNew.length);
    });
});

/**
 * The mockup hangs its `<header class="wn-dash">` off <body>, where it would map
 * to the banner landmark and rival the shell's own. Nesting it inside the page's
 * one <main> is the deviation that keeps a single banner, and it is only ever
 * visible from the DOM shape, so it is asserted here.
 */
describe('the page contributes one main landmark and no banner', () => {
    it('mounts exactly one main', () => {
        render(<WhatsNew />);

        expect(screen.getAllByRole('main')).toHaveLength(1);
    });

    it('keeps the dashboard header inside that main', () => {
        const { container } = render(<WhatsNew />);

        expect(container.querySelector('main > header.wn-dash')).not.toBeNull();
    });
});

describe('the dashboard band is ported from the mockup (assets/app.css:376-394)', () => {
    it('carries the carbon wash and the closing hairline', () => {
        const band = topLevelDeclarationsOf('.wn-dash');

        expect(band.get('background')).toContain('var(--goji-red-ink)');
        expect(band.get('background')).toContain('var(--ink-1000)');
        expect(band.get('border-bottom')).toBe('var(--hairline)');
        expect(band.get('padding-block')).toBe('var(--space-9) var(--space-8)');
        expect(band.get('overflow')).toBe('hidden');
    });

    /**
     * The gridline wash is absolutely positioned over the whole band, so a
     * non-positioned inner would let it paint on top of the copy.
     */
    it('lifts the cluster above the gridline wash', () => {
        expect(topLevelDeclarationsOf('.wn-dash::before').get('position')).toBe('absolute');
        expect(topLevelDeclarationsOf('.wn-dash__inner').get('position')).toBe('relative');
    });

    /**
     * The mockups' `.container` is Bootstrap's class name too, so the measure is
     * repeated per block instead — the same trade `.garage-preview__inner` makes.
     */
    it.each(['.wn-dash__inner', '.wn-ledger__inner'])('carries the measure on %s', (selector) => {
        const inner = topLevelDeclarationsOf(selector);

        expect(inner.get('max-width')).toBe('var(--container-max)');
        expect(inner.get('margin-inline')).toBe('auto');
        expect(inner.get('padding-inline')).toBe('var(--space-5)');
    });

    /** The legend rides `.card__text` and only wins its size from below it. */
    it('emits the goal legend after the card text it overrides', () => {
        expect(topLevelDeclarationsOf('.wn-legend').get('font-size')).toBe('var(--fs-xs)');
        expect(css.indexOf('.wn-legend')).toBeGreaterThan(css.indexOf('.card__text'));
    });
});
