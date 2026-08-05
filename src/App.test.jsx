/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers Task 00024 / AC-018: /totdtrip was a second, unlinked registration of
 * the gallery /totdgallery served. It must not come back.
 *
 * Covers Task 00025: the route-parity guard at the Feature A/B seam. Task 00024
 * asserts the route table; this asserts the composed shell — what the assembled
 * App → Header → NavMenu tree actually offers a visitor — so a route removed
 * from one side and left behind in the other fails here.
 *
 * Covers Task 00023: the footer's composition into the shell, which is a
 * separate concern from the footer's own contract and lives here for the same
 * reason — the defect was in App.jsx, not in the component.
 *
 * Covers Task 00041: every pre-V2 gallery URL now redirects into the one
 * /galleries hub, and the per-gallery components behind those URLs are retired.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { GALLERY_SETS } from './components/common/gallerySets';

/**
 * The real hub fetches a build-time manifest per set; that is
 * GalleryHub.test.jsx's business. The stub keeps these assertions on route
 * resolution and off the network.
 */
vi.mock('./components/common/GalleryHub', () => ({
    default: () => <div data-testid="gallery-hub" />,
}));

const { default: App } = await import('./App');

/**
 * Resolved from the Vitest root rather than import.meta.url: under jsdom
 * import.meta.url is a document-relative http URL, not a file URL.
 */
const APP_SOURCE = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8');

/** jsdom does not implement scrollTo; App's ScrollToTop calls it on every nav. */
vi.stubGlobal('scrollTo', vi.fn());

const renderAt = (path) => {
    window.history.pushState({}, '', path);

    return render(<App />);
};

afterEach(cleanup);

/**
 * Every URL a visitor could once reach a gallery at. Derived from the set
 * config rather than re-listed so this guard and the route table cannot drift;
 * `/gallery` is added by hand because the switcher landing page was not a set.
 */
const LEGACY_GALLERY_PATHS = [...GALLERY_SETS.map((set) => set.legacyPath), '/gallery'];

describe('the legacy gallery URLs redirect into the hub (Task 00041)', () => {
    it('resolves /galleries to the hub', () => {
        renderAt('/galleries');

        expect(screen.getByTestId('gallery-hub')).toBeDefined();
    });

    it.each(LEGACY_GALLERY_PATHS)('lands %s on the hub', (path) => {
        renderAt(path);

        expect(screen.getByTestId('gallery-hub')).toBeDefined();
        expect(window.location.pathname).toBe('/galleries');
    });

    /**
     * `replace` rather than `push`: a redirect that stacks a history entry
     * traps Back on the URL that immediately forwards again.
     */
    it.each(LEGACY_GALLERY_PATHS)('leaves %s off the history stack', (path) => {
        const before = window.history.length;

        renderAt(path);

        expect(window.history.length).toBe(before + 1);
    });

    /**
     * The redirects are the whole reason the old components can go; a
     * reintroduced import is the signal that one of them came back.
     */
    it('imports no per-gallery component', () => {
        expect(APP_SOURCE).not.toMatch(/from '\.\/components\/Gallery/);
    });
});

describe('the removed totdtrip route stays removed (Task 00024)', () => {
    it('resolves /totdtrip to nothing', () => {
        renderAt('/totdtrip');

        expect(screen.queryByTestId('gallery-hub')).toBeNull();
        expect(window.location.pathname).toBe('/totdtrip');
    });

    it('registers no totdtrip path', () => {
        expect(APP_SOURCE).not.toContain('totdtrip');
    });
});

/** The per-set submenus the Galleries panel fans out into. */
const GALLERY_SUBMENU_TOGGLES = [
    'nb-gallery-dropdown-toggle',
    'nc-gallery-dropdown-toggle',
    'nd-gallery-dropdown-toggle',
    'c8-gallery-dropdown-toggle',
];

/**
 * Walks the nav's full offer surface — top level, the Galleries panel and every
 * per-set submenu — accumulating what a visitor can reach.
 *
 * Sampled after each toggle rather than once at the end: react-bootstrap
 * withholds a Dropdown.Menu's children until the menu has been shown, and the
 * root-close handler that fires on the next toggle's click can take the last
 * menu back out of the tree.
 */
const surveyNav = (container) => {
    const hrefs = new Set();
    const text = [];

    const sample = () => {
        const nav = container.querySelector('nav.site-nav');

        for (const link of nav.querySelectorAll('a[href]')) {
            hrefs.add(link.getAttribute('href'));
        }

        text.push(nav.textContent);
    };

    sample();

    fireEvent.click(container.querySelector('#galleries-nav-dropdown'));
    sample();

    for (const id of GALLERY_SUBMENU_TOGGLES) {
        fireEvent.click(container.querySelector(`#${id}`));
        sample();
    }

    return { hrefs: [...hrefs], text: text.join(' ') };
};

describe('the nav offers exactly what the app registers', () => {
    it('links the surviving gallery route and nothing at the removed one', () => {
        const { container } = renderAt('/');

        const { hrefs } = surveyNav(container);

        expect(hrefs).toContain('/totdgallery');
        expect(hrefs).not.toContain('/totdtrip');
    });

    /**
     * Wider than the nav on purpose: the footer gained its own link column in
     * Task 00023, so a stale target can now be reintroduced from two places.
     */
    it('leaves no link to the removed route anywhere in the shell', () => {
        const { container } = renderAt('/');

        expect(container.querySelector('a[href="/totdtrip"]')).toBeNull();
    });

    /**
     * Header and Footer sit outside <Routes>, so an unmatched path still paints
     * the chrome. Asserts the removal took the route and not the shell with it.
     */
    it('still paints the shell at the removed path', () => {
        const { container } = renderAt('/totdtrip');

        expect(container.querySelector('nav.site-nav')).not.toBeNull();
        expect(container.querySelector('footer.site-footer')).not.toBeNull();
    });

    /**
     * Identified by href rather than by its label: the pill's copy is the
     * NavMenu unit test's business, and this file should not break on a wording
     * change. Asserted as a direct child of .navbar-nav because the contract is
     * that it is reachable without opening anything.
     */
    it.each(['/', '/garage', '/youtube', '/totdgallery'])(
        "offers What's New on %s without a dropdown in the way",
        (path) => {
            const { container } = renderAt(path);
            const pill = container.querySelector(
                'nav.site-nav .navbar-nav > a[href="/whats-new"]'
            );

            expect(pill).not.toBeNull();
            expect(pill.classList.contains('site-nav__link--flag')).toBe(true);
        }
    );

    /**
     * Standing regression guard for Task 00020's removal of the "NA Miata
     * (coming soon)" entry. The nav advertises routes that exist; a placeholder
     * for one that does not is a 404 waiting to be clicked.
     */
    it('advertises no destination that has not been built', () => {
        const { container } = renderAt('/');

        expect(surveyNav(container).text).not.toMatch(/coming soon/i);
    });
});

/**
 * The Footer component was fully built but never imported, so the defect Task
 * 00023 fixed lived in App.jsx's composition rather than in the component. Only
 * an App-level render catches a regression of it; the component's own contract
 * is covered in components/Footer/index.test.jsx.
 */
describe('the shell mounts the footer on every route (Task 00023)', () => {
    it.each(['/', '/garage', '/youtube', '/suspension'])(
        'renders the contentinfo landmark on %s',
        (route) => {
            renderAt(route);

            expect(screen.getByRole('contentinfo')).toBeDefined();
        }
    );

    it('mounts exactly one footer', () => {
        renderAt('/');

        expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    });

    it('places the footer below the routed content, alongside the banner', () => {
        renderAt('/');

        const footer = screen.getByRole('contentinfo');
        const banner = screen.getByRole('banner');

        expect(footer.parentElement.contains(banner)).toBe(true);
        expect(footer.parentElement.lastElementChild).toBe(footer);
    });
});
