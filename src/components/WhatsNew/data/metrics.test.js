/**
 * Guards the instrument-cluster shape contract across the frontend/tech-writer
 * seam. `trend` and `gauge` get the strictest treatment: they are rendered as a
 * CSS modifier class and as a percentage width, so an out-of-domain value fails
 * silently in the browser rather than loudly.
 */

import { describe, expect, it } from 'vitest';

import { metrics } from './metrics';

const CONTRACT_KEYS = ['value', 'unit', 'label', 'delta', 'trend', 'note', 'gauge', 'target'];
const TEXT_KEYS = ['value', 'unit', 'label', 'delta', 'note'];
const TRENDS = ['up', 'down', 'flat'];

describe('metrics', () => {
    it('exports an array', () => {
        expect(Array.isArray(metrics)).toBe(true);
    });

    it('carries exactly the contract keys on every tile', () => {
        metrics.forEach((metric) => {
            expect(Object.keys(metric).sort()).toEqual([...CONTRACT_KEYS].sort());
        });
    });

    it('carries a non-empty string in every text field', () => {
        metrics.forEach((metric) => {
            TEXT_KEYS.forEach((key) => {
                expect(typeof metric[key]).toBe('string');
                expect(metric[key].trim().length).toBeGreaterThan(0);
            });
        });
    });

    it('constrains trend to the three rendered directions', () => {
        metrics.forEach((metric) => {
            expect(TRENDS).toContain(metric.trend);
        });
    });

    it('constrains gauge to a finite 0-100 meter fill', () => {
        metrics.forEach((metric) => {
            expect(typeof metric.gauge).toBe('number');
            expect(Number.isFinite(metric.gauge)).toBe(true);
            expect(metric.gauge).toBeGreaterThanOrEqual(0);
            expect(metric.gauge).toBeLessThanOrEqual(100);
        });
    });

    it('keeps target boolean so the TARGET/SHIPPED badge cannot fall through', () => {
        metrics.forEach((metric) => {
            expect(typeof metric.target).toBe('boolean');
        });
    });
});
