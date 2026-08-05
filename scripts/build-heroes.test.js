/**
 * Unit coverage for the hero build script's ladder resolution (Task 00056).
 *
 * The script is imported for its exports, which is only safe because it gates
 * `buildHeroes()` behind an entry-point check — if that gate regresses, this
 * suite starts running a real sharp build and the failure is loud.
 *
 * Default (node) environment: nothing here touches the DOM.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { HERO_WIDTHS, HEROES, ladderFor } from './build-heroes.mjs';

describe('ladderFor', () => {
    it('renders the full ladder for a source wider than every rung', () => {
        expect(ladderFor(1920)).toEqual([480, 960, 1600]);
    });

    it('never emits a rung wider than the source', () => {
        for (const width of [400, 800, 1024, 1600, 4000]) {
            expect(Math.max(...ladderFor(width))).toBeLessThanOrEqual(width);
        }
    });

    it('tops the ladder out at the source width when the rungs stop short', () => {
        expect(ladderFor(800)).toEqual([480, 800]);
        expect(ladderFor(1024)).toEqual([480, 960, 1024]);
    });

    it('does not duplicate a source width that is already a rung', () => {
        expect(ladderFor(960)).toEqual([480, 960]);
    });

    it('leaves the ladder at the ceiling for a source between the top rung and beyond', () => {
        expect(ladderFor(1601)).toEqual([480, 960, 1600]);
    });

    it('returns ascending widths', () => {
        for (const width of [500, 800, 1024, 1837, 1920]) {
            const rungs = ladderFor(width);

            expect([...rungs].sort((a, b) => a - b)).toEqual(rungs);
        }
    });
});

describe('HEROES', () => {
    it('declares a unique key and an existing source for every car', async () => {
        const keys = HEROES.map((hero) => hero.key);

        expect(new Set(keys).size).toBe(keys.length);

        for (const hero of HEROES) {
            expect(hero.src).toMatch(/^src\/assets\/images\/.+\.jpg$/);
            await expect(fs.access(path.resolve(hero.src))).resolves.toBeUndefined();
        }
    });

    it('covers every car the rotating hero can pick', async () => {
        const heroesSource = await fs.readFile(
            path.resolve('src/components/Hero/heroes.js'),
            'utf8'
        );
        const declared = [...heroesSource.matchAll(/^\s{8}key: '([^']+)',$/gm)].map(
            (match) => match[1]
        );

        expect(declared.length).toBeGreaterThan(0);
        expect(HEROES.map((hero) => hero.key).sort()).toEqual([...declared].sort());
    });
});

describe('HERO_WIDTHS', () => {
    it('is ascending and capped at the gallery pipeline display width', () => {
        expect([...HERO_WIDTHS].sort((a, b) => a - b)).toEqual(HERO_WIDTHS);
        expect(Math.max(...HERO_WIDTHS)).toBe(1600);
    });
});
