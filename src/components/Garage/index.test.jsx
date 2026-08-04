/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers Task 00033: /garage is the V2 number-tag hub. The data assertions here
 * are the regression guard for the pre-V2 defect this Task removed -- an image
 * map keyed by car id that carried a sixth entry no car in Cars.json claimed.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import Garage from './index';
import carsData from './Cars.json';
import { resolveCarImage } from '../common/carImages';
import { isRetired } from '../common/CarCard';

const renderGarage = () =>
    render(
        <MemoryRouter initialEntries={['/garage']}>
            <Routes>
                <Route path="/garage" element={<Garage />} />
            </Routes>
        </MemoryRouter>
    );

const cards = (container) => [...container.querySelectorAll('.car-card')];

afterEach(cleanup);

describe('the hub renders the whole stable', () => {
    it('paints one card per car in the data', () => {
        const { container } = renderGarage();

        expect(cards(container)).toHaveLength(carsData.cars.length);
    });

    it('paints five cars', () => {
        const { container } = renderGarage();

        expect(cards(container)).toHaveLength(5);
    });

    it('lays the cards out on the garage grid', () => {
        const { container } = renderGarage();

        expect(container.querySelector('.garage-grid').children).toHaveLength(5);
    });

    it('builds every card as a hub card', () => {
        const { container } = renderGarage();

        for (const card of cards(container)) {
            expect(card.classList.contains('car-card--hub')).toBe(true);
        }
    });

    it('counts the stable off the data rather than out of the copy', () => {
        const { container } = renderGarage();

        expect(container.querySelector('.eyebrow').textContent).toContain(
            String(carsData.cars.length)
        );
    });

    it('heads the page once', () => {
        renderGarage();

        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });
});

describe('every car wears its number tag', () => {
    it('tags all five cards', () => {
        const { container } = renderGarage();

        expect(container.querySelectorAll('.numtag')).toHaveLength(5);
    });

    it('tags each card with its own id', () => {
        const { container } = renderGarage();

        const tags = [...container.querySelectorAll('.numtag')].map((tag) => tag.textContent);

        expect(tags).toEqual(carsData.cars.map((car) => `#${car.id}`));
    });
});

describe('the retired car is a tribute rather than a build log', () => {
    it('links every live car and no retired one', () => {
        const { container } = renderGarage();

        const live = carsData.cars.filter((car) => !isRetired(car.bloglink));

        expect(container.querySelectorAll('.car-card a')).toHaveLength(live.length);
        expect(container.querySelectorAll('.is-retired')).toHaveLength(1);
    });

    it('leaves the retired card with no link of its own', () => {
        const { container } = renderGarage();

        const retired = carsData.cars.findIndex((car) => isRetired(car.bloglink));

        expect(cards(container)[retired].querySelector('a')).toBeNull();
    });

    it('points each live card at the route App.jsx serves for that blog', () => {
        renderGarage();

        const served = new Set(['/na-blog', '/msm-blog', '/nd-blog', '/c8-blog']);

        for (const anchor of screen.getAllByRole('link')) {
            expect(served.has(anchor.getAttribute('href')), anchor.getAttribute('href')).toBe(true);
        }
    });
});

describe('the data no longer carries the pre-V2 image mismatch', () => {
    it('holds no car the image registry cannot resolve', () => {
        for (const car of carsData.cars) {
            expect(resolveCarImage(car.img), `${car.name} has no portrait`).toBeTruthy();
        }
    });

    it('gives every car its own portrait', () => {
        const portraits = carsData.cars.map((car) => resolveCarImage(car.img));

        expect(new Set(portraits).size).toBe(carsData.cars.length);
    });

    it('renders a resolved src on every card, so none paints empty', () => {
        renderGarage();

        for (const image of screen.getAllByRole('img')) {
            expect(image.getAttribute('src')).toBeTruthy();
        }
    });

    it('holds no reference to the Fireball, which was never a car in the stable', () => {
        expect(JSON.stringify(carsData).toLowerCase()).not.toContain('fireball');
    });

    it('holds no sixth car', () => {
        expect(carsData.cars.map((car) => car.id)).toEqual([1, 2, 3, 4, 5]);
    });
});

describe('the data carries the fields the V2 card reads', () => {
    it.each(['img', 'label', 'tag'])('gives every car a %s', (field) => {
        for (const car of carsData.cars) {
            expect(typeof car[field], `${car.name} has no ${field}`).toBe('string');
            expect(car[field].length).toBeGreaterThan(0);
        }
    });

    it('keeps every id a unique number, which the card keys off', () => {
        const ids = carsData.cars.map((car) => car.id);

        expect(ids.every((id) => typeof id === 'number')).toBe(true);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
