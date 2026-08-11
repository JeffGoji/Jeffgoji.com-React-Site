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
 *
 * Covers Task 00035: the blog routes now render a <main> of their own, from
 * inside <BlogList>. Whether that lands as one landmark or two is a property of
 * the assembled shell, so it is asserted here as well as in the route's own
 * test.
 *
 * Covers Bug 00079: the nav's gallery entries and the pre-V2 redirects both
 * carry the clicked set into the hub, where all six used to arrive stripped of
 * it and open the first set. The nav-link assertion below previously pinned the
 * pre-V2 /totdgallery href, which was the contract that let this ship; it is
 * rewritten here rather than dropped.
 *
 * Covers Task 00066: /whats-new's route registration. The page's own contract is
 * components/WhatsNew/index.test.jsx's business; that the shell actually serves
 * the destination the nav and footer have been advertising since Task 00023 is a
 * seam property, so it joins the parity guard here rather than starting a
 * standalone file.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { GALLERY_SETS } from './components/common/gallerySets';

/** What the stub hub reports when it was handed no set to open on. */
const HUB_DEFAULT = '(default)';

/**
 * The real hub fetches a build-time manifest per set; that is
 * GalleryHub.test.jsx's business. The stub keeps these assertions on route
 * resolution and off the network.
 *
 * It does reproduce the one property of the real hub these assertions turn on:
 * `initialSlug` seeds the selection once and never steers it afterwards, so the
 * set on screen only follows the URL if the route genuinely remounts the hub.
 * A stub that read the prop on every render would pass the Bug 00079 cases
 * against a route that still cannot.
 */
vi.mock('./components/common/GalleryHub', async () => {
    const { useState } = await import('react');

    return {
        default: function GalleryHubStub({ initialSlug }) {
            const [seeded] = useState(initialSlug ?? HUB_DEFAULT);

            return <div data-testid="gallery-hub">{seeded}</div>;
        },
    };
});

const { default: App, LegacyGalleryRedirect } = await import('./App');

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

/**
 * Bug 00077. `<Navigate>` renders nothing and commits its navigation from an
 * effect, so the shell can paint one frame with the footer a viewport above
 * where the hub is about to put it — a measured 0.31 desktop / 0.78 mobile
 * layout shift on the legacy URLs, intermittent because it turns on whether
 * that paint beats the effect.
 */
describe('the legacy redirect holds the page height while it commits', () => {
    /**
     * Rendered on its own rather than through the route table: inside <Routes>
     * the redirect has already unmounted by the time a rendered tree can be
     * asserted on, and the frame under test is the one before that.
     */
    it('reserves a viewport behind the redirect', () => {
        const { container } = render(
            <MemoryRouter initialEntries={['/totdgallery']}>
                <LegacyGalleryRedirect />
            </MemoryRouter>
        );

        expect(container.querySelector('.route-reserve')).not.toBeNull();
    });

    /** A bare <Navigate> as a route element is the regression this guards. */
    it('routes every legacy path through that reservation', () => {
        expect(APP_SOURCE).not.toMatch(/element=\{<Navigate/);
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
    /**
     * Rewritten for Bug 00079. This used to assert the nav offered
     * /totdgallery — true at the time, and precisely the arrangement that broke
     * the other five entries once that URL started redirecting. The contract is
     * now that every entry names the hub and its own set, and that no pre-V2
     * gallery URL is advertised from the nav at all.
     */
    it('links every gallery through the hub carrying its own set', () => {
        const { container } = renderAt('/');

        const { hrefs } = surveyNav(container);

        for (const set of GALLERY_SETS) {
            expect(hrefs).toContain(`/galleries?set=${set.slug}`);
        }

        for (const path of LEGACY_GALLERY_PATHS) {
            expect(hrefs).not.toContain(path);
        }

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
     * The other half of the pill above (Task 00066). The nav and the footer have
     * advertised /whats-new since Task 00023, ahead of anything serving it; this
     * is the case that fails if the route is dropped from App.jsx and the two
     * link surfaces are left pointing at a 404.
     *
     * Both of the page's regions are named rather than just one, because a route
     * bound to the wrong element would still paint something at the path.
     */
    it("resolves the What's New pill's destination to the page", () => {
        const { container } = renderAt('/whats-new');

        expect(window.location.pathname).toBe('/whats-new');
        expect(container.querySelector('main > header.wn-dash')).not.toBeNull();
        expect(container.querySelector('main .wn-ledger__inner')).not.toBeNull();
    });

    /**
     * The page nests its dashboard <header> inside its own <main> so the shell's
     * banner stays unrivalled, which only means anything once the two are
     * assembled. Counted from the composed tree for the same reason Task 00035's
     * blog case is.
     */
    it("contributes exactly one main landmark on What's New", () => {
        renderAt('/whats-new');

        expect(screen.getAllByRole('main')).toHaveLength(1);
    });

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

/** Which per-chassis submenu each set's entry lives behind. */
const SUBMENU_FOR_SLUG = {
    'nb-hillcountry': 'nb-gallery-dropdown-toggle',
    'nc-eastcoast15': 'nc-gallery-dropdown-toggle',
    'nc-yellowstone15': 'nc-gallery-dropdown-toggle',
    'nd-hillcountry': 'nd-gallery-dropdown-toggle',
    'nd-totd2025': 'nd-gallery-dropdown-toggle',
    'nd-miatasatthegap2026': 'nd-gallery-dropdown-toggle',
    'c8-autox': 'c8-gallery-dropdown-toggle',
};

/**
 * Clicks a set's entry the way a visitor reaches it — through the Galleries
 * panel and then its chassis submenu. Both have to be opened first:
 * react-bootstrap withholds a Dropdown.Menu's children until it has been shown.
 */
const clickGalleryEntry = (container, slug) => {
    fireEvent.click(container.querySelector('#galleries-nav-dropdown'));
    fireEvent.click(container.querySelector(`#${SUBMENU_FOR_SLUG[slug]}`));
    fireEvent.click(container.querySelector(`a[href="/galleries?set=${slug}"]`), {
        button: 0,
    });
};

const shownSet = () => screen.getByTestId('gallery-hub').textContent;

/**
 * Bug 00079. Every route into the hub used to arrive with the chosen set
 * already discarded — the nav pointed at a pre-V2 URL, the redirect off it
 * named only /galleries, and the hub fell back to its first set. Five of the
 * six advertised entry points therefore opened Tail of the Dragon.
 */
describe('the hub opens on the set it was asked for (Bug 00079)', () => {
    it.each(GALLERY_SETS.map((set) => set.slug))('seeds the hub from ?set=%s', (slug) => {
        renderAt(`/galleries?set=${slug}`);

        expect(shownSet()).toBe(slug);
    });

    /** A standing bookmark on a pre-V2 URL keeps the gallery it was taken on. */
    it.each(GALLERY_SETS)('carries $slug through the $legacyPath redirect', (set) => {
        renderAt(set.legacyPath);

        expect(window.location.pathname).toBe('/galleries');
        expect(window.location.search).toBe(`?set=${set.slug}`);
        expect(shownSet()).toBe(set.slug);
    });

    /**
     * /gallery was the pre-V2 switcher landing page rather than a set, so it
     * has no identity to preserve and the hub's own default is correct for it.
     * A query naming nothing would be the regression here.
     */
    it('lands /gallery on the hub default with no set named', () => {
        renderAt('/gallery');

        expect(window.location.search).toBe('');
        expect(shownSet()).toBe(HUB_DEFAULT);
    });

    it.each(GALLERY_SETS.map((set) => set.slug))(
        'opens %s when its nav entry is clicked from elsewhere',
        (slug) => {
            const { container } = renderAt('/');

            clickGalleryEntry(container, slug);

            expect(window.location.pathname).toBe('/galleries');
            expect(shownSet()).toBe(slug);
        }
    );

    /**
     * The case a seed-only fix misses. React Router reuses the mounted element
     * across a navigation that resolves to the same path, so the URL changed
     * and the screen did not — the hub's `useState` initializer had already
     * run. Asserted from the second set's own entry rather than from a fresh
     * mount, because a fresh mount is exactly what is under test.
     */
    it('switches sets when a second nav entry is clicked from the hub', () => {
        const { container } = renderAt('/galleries?set=nd-totd2025');

        expect(shownSet()).toBe('nd-totd2025');

        clickGalleryEntry(container, 'c8-autox');

        expect(window.location.search).toBe('?set=c8-autox');
        expect(shownSet()).toBe('c8-autox');
    });

    /**
     * The switcher owns the selection once the hub is mounted and never writes
     * the URL, so re-clicking the entry the visitor has since switched away
     * from has to land somewhere — keying the route on the query alone would
     * leave this navigation inert.
     */
    it('reopens the set whose entry is clicked twice in a row', () => {
        const { container } = renderAt('/galleries?set=c8-autox');

        clickGalleryEntry(container, 'nc-yellowstone15');
        expect(shownSet()).toBe('nc-yellowstone15');

        clickGalleryEntry(container, 'nc-yellowstone15');
        expect(shownSet()).toBe('nc-yellowstone15');
    });

    /**
     * The hub is the one owner of the selected slug; the URL seeds it and
     * stops there. A `?set=` write from App would put a second owner on the
     * same value and let the switcher and the address bar disagree.
     */
    it('leaves the hub route reading the query rather than writing it', () => {
        expect(APP_SOURCE).not.toMatch(/setSearchParams/);
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

/**
 * <BlogList> brings its own <main>, so a per-car route that also wrapped one
 * would give the shell two competing landmarks — invisible on screen and only
 * catchable from an assembled render.
 */
describe('each blog route contributes exactly one main landmark (Task 00035)', () => {
    it.each(['/na-blog', '/msm-blog', '/nd-blog', '/c8-blog'])(
        'mounts a single main on %s',
        (route) => {
            renderAt(route);

            expect(screen.getAllByRole('main')).toHaveLength(1);
        }
    );
});
