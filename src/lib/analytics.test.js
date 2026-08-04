/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file so these run before a project-wide Vitest
 * environment is configured.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { trackPageview } from './analytics';

describe('trackPageview', () => {
    afterEach(() => {
        delete window.plausible;
    });

    it('forwards exactly one pageview to the vendor global', () => {
        window.plausible = vi.fn();

        trackPageview();

        expect(window.plausible).toHaveBeenCalledTimes(1);
        expect(window.plausible).toHaveBeenCalledWith('pageview');
    });

    it('no-ops when the vendor global is absent', () => {
        delete window.plausible;

        expect(() => trackPageview()).not.toThrow();
    });

    it('no-ops when the vendor global is present but not callable', () => {
        window.plausible = { q: [] };

        expect(() => trackPageview()).not.toThrow();
    });

    it('sets no cookies', () => {
        window.plausible = vi.fn();

        trackPageview();

        expect(document.cookie).toBe('');
    });
});
