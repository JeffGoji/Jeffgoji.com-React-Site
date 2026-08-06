/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the
 * suite uses.
 *
 * Covers Task 00019: the V2 logo replaces logo.gif and the brand routes Home
 * through the router rather than reloading the document.
 *
 * Covers Task 00020: the nav is rebuilt onto the mockup's chrome, the active
 * route is marked, every dropdown id is unique and the mobile collapse survives.
 *
 * Covers Task 00021: the permanent "What's New" flag pill.
 *
 * Covers Bug 00079: where the Galleries entries point. This file asserted the
 * panel's structure and its ids but never its destinations, which is what let
 * six entries into the same gallery ship unguarded.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import NavMenu from './index';
import { GALLERY_SETS } from '../common/gallerySets';

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

/**
 * Opens the Galleries menu so the per-set submenu toggles mount: react-bootstrap
 * withholds a Dropdown.Menu's children until the menu has been shown once, and
 * four of the component's six ids live in there.
 */
function openGalleries(container) {
    fireEvent.click(container.querySelector('#galleries-nav-dropdown'));
}

/** Every id currently in the tree, in document order, duplicates included. */
function renderedIds(container) {
    return Array.from(container.querySelectorAll('[id]')).map((node) => node.id);
}

/** The nav's own links, excluding the brand and the dropdown panels' items. */
function navLinks(container) {
    return Array.from(container.querySelectorAll('.navbar-nav > a.nav-link'));
}

describe('NavMenu chrome', () => {
    afterEach(cleanup);

    /**
     * data-bs-theme="dark" switches Bootstrap onto its own dark ramp, which is
     * independent of the V2 token layer and shadowed it on this element. Guards
     * AC-002: the palette cannot reach the bar while that attribute is present.
     */
    it('leaves the navbar on the token layer rather than Bootstrap dark mode', () => {
        const { container } = renderNavAt('/garage');
        const navbar = container.querySelector('nav.navbar');

        expect(navbar.getAttribute('data-bs-theme')).toBeNull();
        expect(navbar.classList.contains('bg-dark')).toBe(false);
    });

    it('carries the ported mockup chrome hooks', () => {
        const { container } = renderNavAt('/garage');

        expect(container.querySelector('nav.site-nav')).not.toBeNull();
        expect(container.querySelector('.site-nav > .site-nav__inner')).not.toBeNull();
    });
});

describe('NavMenu active route', () => {
    afterEach(cleanup);

    it.each([
        ['/', '/'],
        ['/garage', '/garage'],
        ['/suspension', '/suspension'],
    ])('marks only the link for %s as active', (path, expected) => {
        const { container } = renderNavAt(path);

        const active = navLinks(container).filter((link) =>
            link.classList.contains('active')
        );

        expect(active.map((link) => link.getAttribute('href'))).toEqual([expected]);
        expect(active[0].getAttribute('aria-current')).toBe('page');
    });

    /**
     * NavLink prefix-matches by default, so an unbounded "/" would mark Home
     * active on every route and paint a second underline.
     */
    it('does not mark home active on a route below it', () => {
        const { container } = renderNavAt('/garage');
        const home = navLinks(container).find((link) => link.getAttribute('href') === '/');

        expect(home.classList.contains('active')).toBe(false);
        expect(home.getAttribute('aria-current')).toBeNull();
    });
});

/**
 * Guards AC-014. The pill is permanent chrome, so its contract is that it is
 * present regardless of route, points at /whats-new, and carries the class the
 * ported .nav__link--flag rule paints.
 */
describe("NavMenu What's New pill", () => {
    afterEach(cleanup);

    const FLAG_CLASS = 'site-nav__link--flag';

    it.each(['/', '/garage', '/youtube', '/suspension', '/totdgallery'])(
        'renders the pill on %s',
        (path) => {
            const { container } = renderNavAt(path);
            const pill = container.querySelector(`.navbar-nav > a.${FLAG_CLASS}`);

            expect(pill).not.toBeNull();
            expect(pill.getAttribute('href')).toBe('/whats-new');
        }
    );

    /**
     * The pill keeps .nav-link: the ported rule rides that chain, and the shared
     * type/padding chrome comes from it.
     */
    it('layers the flag class over the shared nav-link chrome', () => {
        const { container } = renderNavAt('/garage');
        const pill = container.querySelector(`.navbar-nav > a.${FLAG_CLASS}`);

        expect(pill.classList.contains('nav-link')).toBe(true);
    });

    it('sits last in the nav, after the Galleries dropdown', () => {
        const { container } = renderNavAt('/garage');
        const items = Array.from(container.querySelectorAll('.navbar-nav > *'));

        expect(items.at(-1).classList.contains(FLAG_CLASS)).toBe(true);
        expect(items.at(-2).querySelector('#galleries-nav-dropdown')).not.toBeNull();
    });

    it('leaves the rest of the nav at its established width', () => {
        const { container } = renderNavAt('/garage');

        expect(navLinks(container).map((link) => link.getAttribute('href'))).toEqual([
            '/',
            '/garage',
            '/youtube',
            '/suspension',
            '/whats-new',
        ]);
    });
});

describe('NavMenu dropdown identity', () => {
    afterEach(cleanup);

    it('assigns a unique DOM id to every element that carries one', () => {
        const { container } = renderNavAt('/garage');

        const closed = renderedIds(container);

        expect(closed).toEqual([...new Set(closed)]);

        openGalleries(container);

        const opened = renderedIds(container);

        expect(opened).toEqual([...new Set(opened)]);
        expect(opened.length).toBeGreaterThan(closed.length);
    });

    it('names each gallery submenu toggle after the chassis it opens', () => {
        const { container } = renderNavAt('/garage');

        openGalleries(container);

        for (const id of [
            'nb-gallery-dropdown-toggle',
            'nc-gallery-dropdown-toggle',
            'nd-gallery-dropdown-toggle',
            'c8-gallery-dropdown-toggle',
        ]) {
            expect(container.querySelector(`#${id}`), `${id} is missing`).not.toBeNull();
        }
    });

    it('carries no placeholder entry for a gallery that does not exist', () => {
        const { container } = renderNavAt('/garage');

        openGalleries(container);

        expect(container.textContent).not.toMatch(/coming soon/i);
    });
});

const GALLERY_SUBMENU_TOGGLES = [
    'nb-gallery-dropdown-toggle',
    'nc-gallery-dropdown-toggle',
    'nd-gallery-dropdown-toggle',
    'c8-gallery-dropdown-toggle',
];

/**
 * Every entry the Galleries panel offers, keyed by href.
 *
 * Accumulated after each toggle rather than read once at the end: the menus
 * withhold their children until shown, and the root-close handler that fires on
 * the next toggle's click can take the previous one back out of the tree.
 * Scoped to the Galleries panel so the Articles menu cannot leak in.
 */
function surveyGalleryEntries(container) {
    const entries = new Map();

    const sample = () => {
        const panel = container.querySelector('#galleries-nav-dropdown').parentElement;

        for (const item of panel.querySelectorAll('a.dropdown-item[href]')) {
            entries.set(item.getAttribute('href'), item);
        }
    };

    openGalleries(container);
    sample();

    for (const id of GALLERY_SUBMENU_TOGGLES) {
        fireEvent.click(container.querySelector(`#${id}`));
        sample();
    }

    return entries;
}

/**
 * Guards Bug 00079. Each entry used to name the pre-V2 URL for its gallery,
 * which redirects to the hub with nothing left to say which gallery was asked
 * for — so five of the six opened Tail of the Dragon.
 */
describe('NavMenu gallery destinations', () => {
    afterEach(cleanup);

    /**
     * Compared against the set config as a whole rather than entry by entry:
     * that is what fails if an entry names a slug the config has since renamed,
     * which resolves to the bare hub and would otherwise look like a working
     * link.
     */
    it('points every entry at the hub carrying its own set', () => {
        const { container } = renderNavAt('/garage');

        const hrefs = [...surveyGalleryEntries(container).keys()].sort();

        expect(hrefs).toEqual(
            GALLERY_SETS.map((set) => `/galleries?set=${set.slug}`).sort()
        );
    });

    /**
     * The entries are plain Links for this reason: NavLink's active match
     * ignores the query, so six links sharing /galleries would every one of
     * them mark itself the current page as soon as the hub is open.
     */
    it('marks no entry as the current page while the hub is open', () => {
        const { container } = renderNavAt('/galleries');

        const entries = surveyGalleryEntries(container);

        expect(entries.size).toBe(GALLERY_SETS.length);

        for (const [href, item] of entries) {
            expect(item.classList.contains('active'), `${href} is active`).toBe(false);
            expect(item.getAttribute('aria-current'), `${href} is current`).toBeNull();
        }
    });
});

describe('NavMenu mobile collapse', () => {
    afterEach(cleanup);

    /**
     * Guards AC-005. The mockup toggles a hand-rolled .is-open class; this app
     * keeps react-bootstrap's collapse, so the contract asserted here is the
     * toggle button and the labelled region it controls.
     */
    it('keeps the toggle wired to the collapsible region', () => {
        const { container } = renderNavAt('/garage');
        const toggle = container.querySelector('button.navbar-toggler');
        const collapse = container.querySelector('.navbar-collapse');

        expect(toggle).not.toBeNull();
        expect(collapse).not.toBeNull();
        expect(toggle.getAttribute('aria-controls')).toBe(collapse.id);
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
