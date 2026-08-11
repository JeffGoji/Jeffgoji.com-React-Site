/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers Task 00032: the composed V2 home surface. Home owns no visual language
 * of its own beyond the garage-preview strip, so most of what is worth guarding
 * here is composition — that the four sections are all present, in the mockup's
 * order, and that the pre-V2 hub masthead this Task removed has not come back.
 *
 * jsdom performs no layout, so the responsive assertions read the compiled
 * stylesheet rather than measuring a rendered box — the same trade
 * Hero/index.test.jsx and DriverIntro/index.test.jsx make.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';

import * as sass from 'sass';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import Home, { PREVIEW_COUNT } from './Home';
import carsData from '../Garage/Cars.json';
import { isRetired } from '../common/CarCard';

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

const HOME_SOURCE = readFileSync(resolve(ROOT, 'src/components/pages/Home.jsx'), 'utf8');

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

/**
 * Routed rather than rendered bare: the cars' bloglinks are relative paths, so
 * where they resolve to depends on the route Home is matched at.
 */
const renderHome = () =>
    render(
        <MemoryRouter initialEntries={['/']}>
            <Routes>
                <Route path="/" element={<Home />} />
            </Routes>
        </MemoryRouter>
    );

const previewCards = (container) => [...container.querySelectorAll('.car-card')];

/**
 * The videos strip fetches /videos/manifest.json after mount. Stubbed to the
 * shape a missing manifest takes, because that is Home's steady state until the
 * playlist is configured and it is the branch this suite's composition
 * assertions have to hold across — the section renders its head either way. The
 * teaser's own populated behaviour is covered in YouTube/VideoTeaser.test.jsx.
 */
beforeEach(() => {
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: false, json: async () => ({}) }))
    );
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('the home surface composes the four V2 sections', () => {
    it('mounts the hero, the driver intro, the garage preview and the videos', () => {
        const { container } = renderHome();

        expect(container.querySelector('.hero')).not.toBeNull();
        expect(container.querySelector('.driver-intro')).not.toBeNull();
        expect(container.querySelector('#garage .garage-grid')).not.toBeNull();
        expect(container.querySelector('.section--videos')).not.toBeNull();
    });

    /**
     * Order is the contract, not just presence: the hero has to open the page
     * and the videos have to close it, which is what home.html's section
     * sequence says.
     */
    it('lays them out in the mockups order', () => {
        const { container } = renderHome();

        const marks = [...container.querySelector('main').children].map(
            (child) => child.id || child.className
        );

        expect(marks).toEqual(['hero', 'driver-intro', 'checker-strip', 'garage', 'videos']);
    });

    it('heads the page exactly once, from the hero', () => {
        const { container } = renderHome();

        const headings = screen.getAllByRole('heading', { level: 1 });

        expect(headings).toHaveLength(1);
        expect(container.querySelector('.hero').contains(headings[0])).toBe(true);
    });

    /** The shell's <header> owns the banner; Home owns the one <main> under it. */
    it('claims the main landmark and no banner of its own', () => {
        renderHome();

        expect(screen.getAllByRole('main')).toHaveLength(1);
        expect(screen.queryByRole('banner')).toBeNull();
    });
});

describe('the garage preview is a taste of the hub, not a copy of it', () => {
    it('shows the top three cars', () => {
        const { container } = renderHome();

        expect(previewCards(container)).toHaveLength(PREVIEW_COUNT);
        expect(PREVIEW_COUNT).toBeLessThan(carsData.cars.length);
    });

    it('shows them in the data order, from the top', () => {
        const { container } = renderHome();

        const titles = previewCards(container).map(
            (card) => card.querySelector('.card__title').textContent
        );

        expect(titles).toEqual(
            carsData.cars.slice(0, PREVIEW_COUNT).map((car) => `${car.name} ${car.model}`)
        );
    });

    it('builds every card as a preview card', () => {
        const { container } = renderHome();

        for (const card of previewCards(container)) {
            expect(card.classList.contains('car-card--preview')).toBe(true);
            expect(card.querySelector('.numtag'), 'the number tag belongs to the hub').toBeNull();
        }
    });

    it('lays the strip out on the shared garage grid', () => {
        const { container } = renderHome();

        expect(container.querySelector('.garage-grid').children).toHaveLength(PREVIEW_COUNT);
    });

    it('sends the reader on to the hub for the rest of the stable', () => {
        const { container } = renderHome();

        const onward = container.querySelector('.garage-preview__head a');

        expect(onward.getAttribute('href')).toBe('/garage');
    });

    /**
     * The retired car sits inside the top three, so the strip is deliberately
     * two links and one plain article. Anything that made all three links would
     * be routing the reader home from the retired card for no reason.
     */
    it('leaves the retired car off a link', () => {
        const { container } = renderHome();

        const shown = carsData.cars.slice(0, PREVIEW_COUNT);
        const retired = shown.findIndex((car) => isRetired(car.bloglink));

        expect(retired, 'the top three no longer include the retired car').toBeGreaterThan(-1);
        expect(previewCards(container)[retired].tagName).toBe('ARTICLE');
    });

    it('makes each live card a link to its own build log', () => {
        const { container } = renderHome();

        const live = carsData.cars.slice(0, PREVIEW_COUNT).filter((car) => !isRetired(car.bloglink));

        const links = previewCards(container).filter((card) => card.tagName === 'A');

        expect(links).toHaveLength(live.length);
        expect(links.map((link) => link.getAttribute('href'))).toEqual(['/na-blog', '/msm-blog']);
    });
});

describe('the pre-V2 eager composition is retired', () => {
    it('mounts neither the hub masthead nor a second stable', () => {
        const { container } = renderHome();

        expect(container.querySelector('.garage__head')).toBeNull();
        expect(previewCards(container)).not.toHaveLength(carsData.cars.length);
    });

    it('imports neither the hub nor the pre-V2 splash', () => {
        expect(HOME_SOURCE).not.toMatch(/from '\.\.\/Garage'/);
        expect(HOME_SOURCE).not.toMatch(/from '\.\/Intro'/);
    });

    it('still reads the hubs data and the shared card', () => {
        expect(HOME_SOURCE).toContain("import carsData from '../Garage/Cars.json'");
        expect(HOME_SOURCE).toContain("import CarCard from '../common/CarCard'");
    });

    /**
     * The videos section reads the same build-time manifest /youtube reads, but
     * through the teaser rather than the hub: the hub owns an <h1> and a filter
     * bar, and mounting it here would give the page a second masthead under the
     * hero — the same reason the garage strip is not the garage hub.
     */
    it('takes the videos strip from the teaser, not from the hub', () => {
        expect(HOME_SOURCE).toContain("import VideoTeaser from '../YouTube/VideoTeaser'");
        expect(HOME_SOURCE).not.toMatch(/from '\.\.\/YouTube'/);
    });
});

describe('the preview strip fits 360 through 1440 without overflowing', () => {
    it('holds the strip to the shared container measure', () => {
        const inner = topLevelDeclarationsOf('.garage-preview__inner');

        expect(inner.get('width')).toBe('100%');
        expect(inner.get('max-width')).toBe('var(--container-max)');
        expect(inner.get('margin-inline')).toBe('auto');
        expect(inner.get('padding-inline')).toBe('var(--space-5)');
    });

    /**
     * The head row is the only place on this surface where two boxes compete
     * for one line, so wrapping is what keeps 360 free of a horizontal scroll.
     */
    it('wraps the head row rather than letting the onward link push it wide', () => {
        const head = topLevelDeclarationsOf('.garage-preview__head');

        expect(head.get('display')).toBe('flex');
        expect(head.get('flex-wrap')).toBe('wrap');
        expect(head.get('justify-content')).toBe('space-between');
    });

    /**
     * auto-fill rather than a fixed three-up: at 360 the track floor plus the
     * tightened gutter still fits the viewport, so the strip reflows to one
     * column instead of overflowing.
     */
    it('reflows the card grid instead of holding three columns', () => {
        expect(topLevelDeclarationsOf('.garage-grid').get('grid-template-columns')).toBe(
            'repeat(auto-fill, minmax(280px, 1fr))'
        );
    });

    it('narrows the gutter at 360', () => {
        // Several Feature B surfaces each carry their own 360px block, so the
        // last one in the file is not necessarily this one -- search every block
        // for the one that mentions .garage-preview__inner.
        const narrow = css
            .split('@media (max-width: 360px)')
            .slice(1)
            .find((segment) => segment.includes('.garage-preview__inner'));

        expect(narrow, 'no 360px block mentions .garage-preview__inner').toBeDefined();
        expect(narrow).toContain('padding-inline: var(--space-4)');
    });
});
