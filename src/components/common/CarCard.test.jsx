/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers Task 00033: the shared car card and the two variants the V2 surfaces
 * ask for. The retired branch is the load-bearing one -- a retired car has no
 * build log, so nothing about it may render as a link.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import CarCard, { isRetired } from './CarCard';
import carsData from '../Garage/Cars.json';

/**
 * Resolved from the Vitest root rather than import.meta.url: under jsdom
 * import.meta.url is a document-relative http URL, not a file URL.
 */
const CODE = readFileSync(resolve(process.cwd(), 'src/components/common/CarCard.jsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const live = carsData.cars.find((car) => !isRetired(car.bloglink));
const retired = carsData.cars.find((car) => isRetired(car.bloglink));

/**
 * Mounted under a matched route rather than bare under the router: the data's
 * bloglinks are relative (`../na-blog`), and React Router resolves those
 * against the matched route path, so a bare mount would not exercise the
 * resolution the live surfaces get.
 */
const renderCard = (car, variant, route = '/garage') =>
    render(
        <MemoryRouter initialEntries={[route]}>
            <Routes>
                <Route path={route} element={<CarCard variant={variant} {...car} />} />
            </Routes>
        </MemoryRouter>
    );

/** The card root, which is an <article> or an <a> depending on the branch. */
const cardOf = (container) => container.querySelector('.car-card');

afterEach(cleanup);

describe('the data carries both branches the card renders', () => {
    it('holds exactly one retired car', () => {
        expect(carsData.cars.filter((car) => isRetired(car.bloglink))).toHaveLength(1);
    });

    it('retires the NC, which is the car with no build log', () => {
        expect(retired.id).toBe(3);
    });
});

describe('the hub variant is the /garage card', () => {
    it('tags the card with the car number', () => {
        const { container } = renderCard(live, 'hub');

        expect(cardOf(container).querySelector('.numtag').textContent).toBe(`#${live.id}`);
    });

    it('grades the portrait with the editorial media layer', () => {
        const { container } = renderCard(live, 'hub');

        const media = cardOf(container).querySelector('.card__media');

        expect(media.classList.contains('media--editorial')).toBe(true);
        expect(within(media).getByRole('img')).toBeDefined();
    });

    it('resolves the portrait to a bundled asset rather than the raw data path', () => {
        renderCard(live, 'hub');

        const src = screen.getByRole('img').getAttribute('src');

        expect(src).toBeTruthy();
        expect(src).not.toBe(live.img);
    });

    it('names the car in the alt text instead of describing the element', () => {
        renderCard(live, 'hub');

        expect(screen.getByRole('img').getAttribute('alt')).toContain(live.name);
        expect(screen.getByRole('img').getAttribute('alt')).toContain(live.label);
    });

    it('kicks the card off with the year, make and editorial tag', () => {
        const { container } = renderCard(live, 'hub');

        const kicker = cardOf(container).querySelector('.card__kicker').textContent;

        expect(kicker).toContain(String(live.year));
        expect(kicker).toContain(live.make);
        expect(kicker).toContain(live.tag);
    });

    it('opens the build log at the router path the data declares', () => {
        renderCard(live, 'hub');

        expect(screen.getByRole('link').getAttribute('href')).toBe('/na-blog');
    });

    it('lazy-loads the portrait, since the hub paints five of them', () => {
        renderCard(live, 'hub');

        expect(screen.getByRole('img').getAttribute('loading')).toBe('lazy');
    });
});

describe('a retired car is a tribute, never a link', () => {
    it('renders no link at all in the hub variant', () => {
        renderCard(retired, 'hub');

        expect(screen.queryByRole('link')).toBeNull();
    });

    it('renders no link at all in the preview variant', () => {
        renderCard(retired, 'preview');

        expect(screen.queryByRole('link')).toBeNull();
    });

    it('swaps the build-log call to action for the tribute chip', () => {
        const { container } = renderCard(retired, 'hub');

        expect(cardOf(container).querySelector('.is-retired')).not.toBeNull();
    });

    /**
     * The one copy assertion in this file. The chip's wording is the mockup's
     * (garage.html:49) rather than the component's invention, so it is asserted
     * where the mockup-as-contract port would otherwise be unprovable. Every
     * other behaviour here is asserted structurally.
     */
    it('carries the mockup wording verbatim', () => {
        const { container } = renderCard(retired, 'hub');

        expect(cardOf(container).querySelector('.is-retired').textContent).toBe(
            'Retired · tribute'
        );
    });

    it('still tags and describes the car like any other', () => {
        const { container } = renderCard(retired, 'hub');

        expect(cardOf(container).querySelector('.numtag').textContent).toBe(`#${retired.id}`);
        expect(cardOf(container).querySelector('.card__text').textContent).toBe(
            retired.description
        );
    });

    it('roots the card on an article, since there is nothing to activate', () => {
        const { container } = renderCard(retired, 'preview');

        expect(cardOf(container).tagName).toBe('ARTICLE');
    });
});

describe('the preview variant is the compact home-strip card', () => {
    it('makes the whole card the link to the build log', () => {
        const { container } = renderCard(live, 'preview');

        const card = cardOf(container);

        expect(card.tagName).toBe('A');
        expect(card.getAttribute('href')).toBe('/na-blog');
    });

    it('drops the number tag the hub carries', () => {
        const { container } = renderCard(live, 'preview');

        expect(cardOf(container).querySelector('.numtag')).toBeNull();
    });

    it('drops the build-log call to action, which would nest a link', () => {
        const { container } = renderCard(live, 'preview');

        expect(cardOf(container).querySelectorAll('a')).toHaveLength(0);
        expect(cardOf(container).querySelector('.btn')).toBeNull();
    });

    it('is the variant a caller gets without asking for one', () => {
        const { container } = render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="/" element={<CarCard {...live} />} />
                </Routes>
            </MemoryRouter>
        );

        expect(cardOf(container).classList.contains('car-card--preview')).toBe(true);
    });

    it('keeps the same media, kicker, title and text as the hub', () => {
        const { container } = renderCard(live, 'preview');

        const card = cardOf(container);

        for (const part of ['.card__media', '.card__kicker', '.card__title', '.card__text']) {
            expect(card.querySelector(part), `${part} missing from the preview`).not.toBeNull();
        }
    });
});

/**
 * Task 00058. The portrait routes through the shared <ResponsiveImage>. It
 * carries no candidate list: Cars.json's five photos are Vite asset imports and
 * no build script renders width variants of them. Two of the five share a
 * source file with the hero ladder, so renditions for those two exist under
 * /hero/ -- but they are addressed by hero key and reached through a runtime
 * manifest fetch, which is not a coupling a card should own.
 */
describe('the portrait renders through the shared responsive primitive', () => {
    it('leaves no bare img on the card', () => {
        expect(CODE).toContain("import ResponsiveImage from './ResponsiveImage'");
        expect(CODE).toContain('<ResponsiveImage');
        expect(CODE).not.toContain('<img');
    });

    it.each(['hub', 'preview'])(
        'advertises no candidates in the %s variant, since none are built',
        (variant) => {
            renderCard(live, variant);

            const image = screen.getByRole('img');

            expect(image.hasAttribute('srcset')).toBe(false);
            expect(image.hasAttribute('sizes')).toBe(false);
        }
    );

    it('lazy-loads the preview portrait too, not just the hub`s', () => {
        renderCard(live, 'preview');

        expect(screen.getByRole('img').getAttribute('loading')).toBe('lazy');
    });
});

describe('both variants share the card block', () => {
    it.each(['hub', 'preview'])('roots the %s variant on .card', (variant) => {
        const { container } = renderCard(live, variant);

        const card = cardOf(container);

        expect(card.classList.contains('card')).toBe(true);
        expect(card.classList.contains(`car-card--${variant}`)).toBe(true);
    });

    it.each(['hub', 'preview'])('titles the %s variant with the car name and model', (variant) => {
        renderCard(live, variant);

        const title = screen.getByRole('heading', { level: 3 });

        expect(title.textContent).toContain(live.name);
        expect(title.querySelector('small').textContent).toBe(live.model);
    });
});
