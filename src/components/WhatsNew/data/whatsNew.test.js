/**
 * Guards the ledger shape contract across the frontend/tech-writer seam. These
 * assertions are about structure only -- never about the copy, which tech-writer
 * rewrites in place.
 */

import { describe, expect, it } from 'vitest';

import { whatsNew } from './whatsNew';

const CONTRACT_KEYS = ['ver', 'tag', 'goal', 'title', 'body', 'why', 'how'];

describe('whatsNew', () => {
    it('exports an array', () => {
        expect(Array.isArray(whatsNew)).toBe(true);
    });

    it('carries exactly the contract keys on every entry', () => {
        whatsNew.forEach((entry) => {
            expect(Object.keys(entry).sort()).toEqual([...CONTRACT_KEYS].sort());
        });
    });

    it('carries a non-empty string in every contract field', () => {
        whatsNew.forEach((entry) => {
            CONTRACT_KEYS.forEach((key) => {
                expect(typeof entry[key]).toBe('string');
                expect(entry[key].trim().length).toBeGreaterThan(0);
            });
        });
    });
});
