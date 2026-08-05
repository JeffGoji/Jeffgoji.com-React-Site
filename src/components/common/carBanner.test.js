/**
 * Covers Task 00035: the blog banner is assembled from the garage row, not
 * restated per route.
 *
 * The rendered result is asserted in blog/blogRoutes.test.jsx against the real
 * cars. What is left here is the derivation itself — which entry the odometer
 * comes from, and what happens when that entry has no reading. c8Blog.json
 * already ships an entry missing a field, so a gap in the data is a live case
 * rather than a hypothetical one.
 */

import { describe, expect, it } from 'vitest';

import { buildCarBanner } from './carBanner';

const entry = (id, mileage) => ({ id, mileage, date: `1/${id}/2025`, entry: `Entry ${id}.` });

describe('the odometer follows the log', () => {
    it('reads the highest id, not the last element', () => {
        const banner = buildCarBanner('Miyoshi', [entry(1, '10,000'), entry(3, '30,000'), entry(2, '20,000')]);

        expect(banner.chips).toContainEqual({ label: 'ODO', value: '30,000 mi' });
    });

    it('leaves the caller-supplied array untouched while sorting', () => {
        const data = [entry(1, '10,000'), entry(3, '30,000'), entry(2, '20,000')];

        buildCarBanner('Miyoshi', data);

        expect(data.map((row) => row.id)).toEqual([1, 3, 2]);
    });

    it('drops the chip rather than reading "undefined mi" when the entry has no mileage', () => {
        const banner = buildCarBanner('Miyoshi', [entry(1, undefined)]);

        expect(banner.chips.map((chip) => chip.label)).toEqual(['STATUS']);
    });
});

describe('the identity comes from the car, not the caller', () => {
    it('titles the banner with the car name', () => {
        expect(buildCarBanner('Panda', [entry(1, '12,705')]).title).toBe('Panda');
    });

    it('resolves the same portrait the garage card uses', () => {
        expect(buildCarBanner('Panda', [entry(1, '12,705')]).image).toBeTruthy();
    });
});
