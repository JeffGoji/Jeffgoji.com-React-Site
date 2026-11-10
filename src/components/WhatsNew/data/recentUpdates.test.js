/**
 * Guards the recentUpdates content contract. Structure only, never the copy.
 * That each link resolves to a served route is asserted in src/App.test.jsx.
 */

import { describe, expect, it } from 'vitest';

import { CATEGORIES, recentUpdates } from './recentUpdates';

const KEYS = ['category', 'date', 'links', 'summary', 'title'];

describe('recentUpdates', () => {
    it('is a non-empty array', () => {
        expect(Array.isArray(recentUpdates)).toBe(true);
        expect(recentUpdates.length).toBeGreaterThan(0);
    });

    it.each(recentUpdates.map((u) => [u.title, u]))('%s has the contract shape', (_, update) => {
        expect(Object.keys(update).sort()).toEqual(KEYS);
        expect(update.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Number.isNaN(new Date(update.date).getTime())).toBe(false);
        expect(CATEGORIES).toContain(update.category);
        ['title', 'summary'].forEach((key) => {
            expect(typeof update[key]).toBe('string');
            expect(update[key].trim().length).toBeGreaterThan(0);
        });
        expect(update.links.length).toBeGreaterThan(0);
        update.links.forEach((link) => {
            expect(link.label.trim().length).toBeGreaterThan(0);
            expect(link.to.startsWith('/')).toBe(true);
        });
    });

    it('is authored newest first', () => {
        const dates = recentUpdates.map((u) => u.date);
        expect(dates).toEqual([...dates].sort().reverse());
    });

    it('has unique date + title pairs (the React key)', () => {
        const keys = recentUpdates.map((u) => u.date + u.title);
        expect(new Set(keys).size).toBe(keys.length);
    });
});
