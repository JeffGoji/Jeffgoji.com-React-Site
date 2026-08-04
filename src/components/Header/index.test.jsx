/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers Task 00022: the banner is restyled onto the token layer, the residual
 * Bootstrap chrome is gone, and the wrapper no longer defeats the sticky bar it
 * contains.
 *
 * jsdom performs no layout, so the viewport assertions read the compiled
 * stylesheet and do the box arithmetic here rather than measuring a rendered
 * box. That is the same trade src/scss/styles.test.js makes.
 */

import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';

import * as sass from 'sass';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Header from './index';

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

const renderHeader = () =>
    render(
        <MemoryRouter>
            <Header />
        </MemoryRouter>
    );

afterEach(cleanup);

describe('the banner is a landmark, not a painted box', () => {
    it('exposes the header as the banner landmark', () => {
        renderHeader();

        expect(screen.getByRole('banner')).toBeDefined();
    });

    it('still wraps the primary navigation', () => {
        renderHeader();

        expect(screen.getByRole('banner').contains(screen.getByRole('navigation'))).toBe(true);
    });

    it('carries the block name and nothing else', () => {
        renderHeader();

        expect([...screen.getByRole('banner').classList]).toEqual(['site-header']);
    });

    /**
     * The pre-V2 wrapper was `container-fluid p-0`. `p-0` only ever cancelled
     * `container-fluid`'s own gutter, so the pair was inert on a block-level
     * element — but `container-fluid` also declares --bs-gutter-x, which
     * inherits into the nav subtree.
     */
    it.each(['container-fluid', 'container', 'p-0', 'm-0'])(
        'drops the pre-V2 Bootstrap utility %s',
        (utility) => {
            renderHeader();

            expect(screen.getByRole('banner').classList.contains(utility)).toBe(false);
        }
    );

    it('contributes no box, so it cannot constrain the sticky bar it contains', () => {
        expect(topLevelDeclarationsOf('.site-header').get('display')).toBe('contents');
    });
});

/**
 * DoD: no horizontal overflow at 360 / 768 / 1024 / 1440. Every ancestor of
 * .site-nav__inner is full-bleed and unpadded, so the widest painted box in the
 * header chain is the inner row itself.
 */
describe('the header chain fits the viewport at every DoD width', () => {
    const VIEWPORTS = [360, 768, 1024, 1440];
    const ROOT_FONT_SIZE = 16;
    const CONTAINER_WIDE = 1440;
    const GUTTER = 1.5 * ROOT_FONT_SIZE;

    /** Padding is only additive to width under content-box; Reboot forbids it. */
    it('keeps every box border-box, so padding stays inside the declared width', () => {
        expect(css).toMatch(/\*,\s*\*::before,\s*\*::after \{\s*box-sizing: border-box;/);
    });

    it('leaves the bar itself unpadded horizontally', () => {
        expect(topLevelDeclarationsOf('.navbar').get('--bs-navbar-padding-x')).toBe('0');
    });

    it('reads the measure and gutter from the tokens the inner row consumes', () => {
        const inner = topLevelDeclarationsOf('.site-nav__inner');

        expect(inner.get('max-width')).toBe('var(--container-wide)');
        expect(inner.get('padding-inline')).toBe('var(--space-5)');
        expect(css).toContain(`--container-wide: ${CONTAINER_WIDE}px`);
        expect(css).toContain(`--space-5: ${GUTTER / ROOT_FONT_SIZE}rem`);
    });

    it.each(VIEWPORTS)('paints no box wider than a %ipx viewport', (viewport) => {
        const borderBoxWidth = Math.min(viewport, CONTAINER_WIDE);

        expect(borderBoxWidth).toBeLessThanOrEqual(viewport);
        expect(borderBoxWidth - 2 * GUTTER).toBeGreaterThan(0);
    });
});
