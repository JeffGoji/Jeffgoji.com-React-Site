/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the
 * suite uses.
 *
 * Covers Task 00019: the V2 logo replaces logo.gif and the brand routes Home
 * through the router rather than reloading the document.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import NavMenu from './index';

/**
 * Resolved from the Vitest root rather than import.meta.url: under jsdom
 * import.meta.url is a document-relative http URL, not a file URL.
 */
const SRC_ROOT = resolve(process.cwd(), 'src');

/** Brand colours the logo is contractually required to paint (see logo.svg). */
const WORDMARK_LIGHT = '#F6F6F4';
const GOJI_RED = '#E10600';

/**
 * Renders the nav inside a router seeded at a non-home route, with a probe that
 * reports the live location, so a brand click can be observed as a client-side
 * navigation instead of a document load.
 */
function renderNavAt(initialPath) {
    function LocationProbe() {
        return <span data-testid="location">{useLocation().pathname}</span>;
    }

    return render(
        <MemoryRouter initialEntries={[initialPath]}>
            <NavMenu />
            <LocationProbe />
        </MemoryRouter>
    );
}

function collectJsxSources(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);

        if (entry.isDirectory()) {
            return collectJsxSources(full);
        }

        return entry.name.endsWith('.jsx') && !entry.name.endsWith('.test.jsx')
            ? [full]
            : [];
    });
}

describe('NavMenu brand logo', () => {
    afterEach(cleanup);

    it('renders the logo inline as SVG rather than as an image element', () => {
        const { container } = renderNavAt('/garage');
        const brand = container.querySelector('a.navbar-brand');

        expect(brand.querySelector('svg')).not.toBeNull();
        expect(brand.querySelector('img')).toBeNull();
    });

    it('paints the wordmark in the locked brand colours', () => {
        const { container } = renderNavAt('/garage');
        const svg = container.querySelector('a.navbar-brand svg');

        const fills = Array.from(svg.querySelectorAll('[fill]')).map((node) =>
            node.getAttribute('fill')
        );

        expect(fills).toContain(WORDMARK_LIGHT);
        expect(fills).toContain(GOJI_RED);
    });

    it('paints the racing-line mark with the goji-red gradient', () => {
        const { container } = renderNavAt('/garage');
        const svg = container.querySelector('a.navbar-brand svg');

        expect(svg.querySelector('#jg-logo-goji-red')).not.toBeNull();
        expect(svg.querySelector('[stroke="url(#jg-logo-goji-red)"]')).not.toBeNull();
    });

    it('carries no script or inline event handler into the document', () => {
        const { container } = renderNavAt('/garage');
        const svg = container.querySelector('a.navbar-brand svg');

        expect(svg.querySelector('script')).toBeNull();
        expect(svg.outerHTML).not.toMatch(/\son[a-z]+=/i);
    });
});

describe('NavMenu brand link', () => {
    afterEach(cleanup);

    it('targets home rather than the Bootstrap anchor-hash default', () => {
        const { container } = renderNavAt('/garage');
        const brand = container.querySelector('a.navbar-brand');

        expect(brand.getAttribute('href')).toBe('/');
    });

    it('navigates home client-side when clicked', () => {
        const { container } = renderNavAt('/garage');

        expect(screen.getByTestId('location').textContent).toBe('/garage');

        fireEvent.click(container.querySelector('a.navbar-brand'), { button: 0 });

        expect(screen.getByTestId('location').textContent).toBe('/');
    });
});

describe('logo.gif retirement', () => {
    /**
     * Guards AC-002. The legacy asset is still on disk for other surfaces to be
     * migrated off; this fails the moment one is re-wired back to it.
     */
    it('has no logo.gif reference left in src', () => {
        const references = collectJsxSources(SRC_ROOT).filter((path) =>
            readFileSync(path, 'utf8').includes('logo.gif')
        );

        expect(references).toEqual([]);
    });
});
