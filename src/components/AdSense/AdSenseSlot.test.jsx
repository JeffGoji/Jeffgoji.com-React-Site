/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file so these run before a project-wide Vitest
 * environment is configured.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import AdSenseSlot from './AdSenseSlot';

/**
 * Resolved from the Vitest root rather than import.meta.url: under the jsdom
 * environment import.meta.url is a document-relative http URL, not a file URL.
 */
const SRC_ROOT = resolve(process.cwd(), 'src');

/**
 * Collects every JSX source file under src/, excluding test files, so the
 * inert-baseline guard can scan for render sites.
 */
function collectJsxSources(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);

        if (entry.isDirectory()) {
            return collectJsxSources(full);
        }

        return entry.name.endsWith('.jsx') && !entry.name.endsWith('.test.jsx')
            ? [full]
            : [];
    });
}

describe('AdSenseSlot', () => {
    afterEach(() => {
        cleanup();
        delete window.adsbygoogle;
    });

    it('renders the adsbygoogle ins element', () => {
        const { container } = render(<AdSenseSlot />);

        expect(container.querySelector('ins.adsbygoogle')).not.toBeNull();
    });

    it('enables no ad slot, because no VITE_AD_* values are configured', () => {
        const { container } = render(<AdSenseSlot />);
        const ins = container.querySelector('ins.adsbygoogle');

        expect(ins.getAttribute('data-ad-client')).toBe('');
        expect(ins.getAttribute('data-ad-slot')).toBe('');
    });

    it('does not throw when the vendor global is absent', () => {
        delete window.adsbygoogle;

        expect(() => render(<AdSenseSlot />)).not.toThrow();
    });

    it('pushes nothing to the vendor global when it is absent', () => {
        delete window.adsbygoogle;

        render(<AdSenseSlot />);

        expect(window.adsbygoogle).toBeUndefined();
    });

    it('sets no cookies', () => {
        render(<AdSenseSlot />);

        expect(document.cookie).toBe('');
    });
});

describe('AdSense inert baseline', () => {
    /**
     * Guards AC-017: every slot call site is commented out today, so no ad ever
     * mounts. Uncommenting one is a deliberate product decision that must not
     * ride along with an unrelated change.
     */
    it('has no live AdSenseSlot render site in src', () => {
        const liveRenderSites = collectJsxSources(SRC_ROOT).flatMap((path) =>
            readFileSync(path, 'utf8')
                .split('\n')
                .filter((line) => line.includes('<AdSenseSlot'))
                .filter((line) => {
                    const trimmed = line.trimStart();
                    return !trimmed.startsWith('{/*') && !trimmed.startsWith('//');
                })
                .map((line) => `${path}: ${line.trim()}`)
        );

        expect(liveRenderSites).toEqual([]);
    });
});
