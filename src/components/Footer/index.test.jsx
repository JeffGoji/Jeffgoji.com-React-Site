/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers Task 00023: the footer is mounted for the first time, rebuilt onto the
 * mockups' block, and no longer pinned to the viewport.
 *
 * jsdom performs no layout, so the grid assertions read the compiled stylesheet
 * rather than measuring a rendered box — the same trade Header/index.test.jsx
 * and src/scss/styles.test.js make.
 */

import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';

import * as sass from 'sass';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Footer from './index';

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

const renderFooter = (route = '/') =>
    render(
        <MemoryRouter initialEntries={[route]}>
            <Footer />
        </MemoryRouter>
    );

afterEach(cleanup);

describe('the footer is a landmark on every route', () => {
    it.each(['/', '/garage', '/nd-blog', '/totdgallery'])(
        'exposes the contentinfo landmark on %s',
        (route) => {
            renderFooter(route);

            expect(screen.getByRole('contentinfo')).toBeDefined();
        }
    );

    it('carries the block name and nothing else', () => {
        renderFooter();

        expect([...screen.getByRole('contentinfo').classList]).toEqual(['site-footer']);
    });

    /**
     * The pre-V2 footer took itself out of flow and overlaid the tail of every
     * page taller than one viewport. The mockup footer flows at the document end.
     */
    it.each(['fixed-bottom', 'container-fluid', 'text-center', 'p-0', 'm-0'])(
        'drops the pre-V2 Bootstrap utility %s',
        (utility) => {
            renderFooter();

            expect(screen.getByRole('contentinfo').classList.contains(utility)).toBe(false);
        }
    );

    it('flows at the end of the page rather than pinning to the viewport', () => {
        const footer = topLevelDeclarationsOf('.site-footer');

        expect(footer.get('margin-top')).toBe('var(--space-9)');
        expect(footer.has('position')).toBe(false);
    });
});

describe('the copyright line stays current without being hardcoded', () => {
    it('renders the year the clock reports', () => {
        renderFooter();

        expect(
            screen.getByText(new RegExp(`\\b${new Date().getFullYear()}\\b`))
        ).toBeDefined();
    });

    /**
     * The previous implementation set the year from a mount effect, so the first
     * commit painted the line with an empty year. Reading it at render removes
     * that frame — asserted by looking before any effect could have run.
     */
    it('has the year on the very first paint', () => {
        const { container } = renderFooter();

        expect(container.querySelector('.site-footer__bottom').textContent).toContain(
            String(new Date().getFullYear())
        );
    });
});

describe('the three-column shell is ported from the mockup', () => {
    it('renders the brand column plus the two link columns', () => {
        renderFooter();

        const columns = screen.getByRole('contentinfo').querySelectorAll('.site-footer__inner > div');

        expect(columns).toHaveLength(3);
    });

    it('heads the two link columns', () => {
        renderFooter();

        expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(2);
    });

    it('lays the columns out 1.4fr 1fr 1fr at desktop', () => {
        expect(topLevelDeclarationsOf('.site-footer__inner').get('grid-template-columns')).toBe(
            '1.4fr 1fr 1fr'
        );
    });

    /** The mockup's own breakpoint (assets/app.css:575); nothing forces another. */
    it('collapses to a single column at 768px and below', () => {
        expect(css).toMatch(/@media \(max-width: 768px\)/);

        const collapsed = css.split('@media (max-width: 768px)').pop();

        expect(collapsed).toContain('.site-footer__inner');
        expect(collapsed).toContain('grid-template-columns: 1fr');
    });

    it('tops the block with the checker strip', () => {
        renderFooter();

        expect(screen.getByRole('contentinfo').firstChild.classList.contains('checker-strip')).toBe(
            true
        );
        expect(topLevelDeclarationsOf('.checker-strip').get('background')).toBe('var(--checker)');
    });
});

describe('every footer link resolves to a router route', () => {
    it('routes the brand lockup home rather than to a hash anchor', () => {
        renderFooter();

        expect(screen.getByLabelText('jeffgoji.com home').getAttribute('href')).toBe('/');
    });

    /**
     * /whats-new is Feature D's route and does not exist yet; it ships here for
     * the same reason the nav ships it (AC-014). Excluded from the parity check.
     */
    it('points every other link at a path App.jsx serves', () => {
        renderFooter();

        const served = new Set([
            '/',
            '/garage',
            '/na-blog',
            '/nd-blog',
            '/c8-blog',
            '/gallery',
            '/youtube',
            '/suspension',
        ]);

        const targets = [...screen.getByRole('contentinfo').querySelectorAll('a[href]')]
            .map((anchor) => anchor.getAttribute('href'))
            .filter((href) => href !== '/whats-new');

        expect(targets.length).toBeGreaterThan(0);

        for (const href of targets) {
            expect(served.has(href), `${href} is not in App.jsx's route table`).toBe(true);
        }
    });

    it('uses router links, so no target leaves the SPA', () => {
        renderFooter();

        for (const anchor of screen.getByRole('contentinfo').querySelectorAll('a[href]')) {
            expect(anchor.getAttribute('href').startsWith('/')).toBe(true);
        }
    });
});
