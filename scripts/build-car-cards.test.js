/**
 * Unit coverage for the car card rendition script.
 *
 * Imported for its exports, which is only safe because the script gates
 * `buildCarCards()` behind an entry-point check, as build-heroes.mjs does.
 *
 * Default (node) environment: nothing here touches the DOM.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CARD_WIDTHS, carImagePaths, ladderFor, stemFor } from './build-car-cards.mjs';

describe('ladderFor', () => {
    it('renders the full ladder for a source wider than every rung', () => {
        expect(ladderFor(1920)).toEqual([400, 800, 1200]);
    });

    it('tops the ladder out at the source width when the rungs stop short', () => {
        expect(ladderFor(1024)).toEqual([400, 800, 1024]);
        expect(ladderFor(800)).toEqual([400, 800]);
    });

    it('never emits a rung wider than the source', () => {
        for (const width of [300, 800, 1163, 1913, 4000]) {
            expect(Math.max(...ladderFor(width))).toBeLessThanOrEqual(width);
        }
    });

    it('still emits one candidate for a source narrower than the smallest rung', () => {
        expect(ladderFor(300)).toEqual([300]);
    });
});

describe('stemFor', () => {
    it('flattens a Cars.json path into a URL-safe file stem', () => {
        expect(stemFor('nd/nd-002.jpg')).toBe('nd-nd-002');
        expect(stemFor('ncEdit.jpg')).toBe('ncEdit');
        expect(stemFor('nb/4192_1021_o.jpg')).toBe('nb-4192-1021-o');
    });

    it('gives every real car its own stem', async () => {
        const stems = (await carImagePaths()).map(stemFor);

        expect(new Set(stems).size).toBe(stems.length);
    });
});

describe('the car list comes from Cars.json', () => {
    it('finds every car, each with an existing source photo', async () => {
        const images = await carImagePaths();
        const data = JSON.parse(await fs.readFile(path.resolve('src/components/Garage/Cars.json'), 'utf8'));

        expect(images).toEqual(data.cars.map((car) => car.img));

        for (const img of images) {
            await expect(fs.access(path.resolve('src/assets/images', img))).resolves.toBeUndefined();
        }
    });
});

describe('CARD_WIDTHS', () => {
    it('is ascending', () => {
        expect([...CARD_WIDTHS].sort((a, b) => a - b)).toEqual(CARD_WIDTHS);
    });
});
