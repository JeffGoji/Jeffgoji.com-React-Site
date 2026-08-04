/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers Task 00024 / AC-018: /totdtrip was a second, unlinked registration of
 * the same gallery component /totdgallery serves. Removing it must not take the
 * shared import — or the surviving route — with it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

/**
 * The real gallery fetches a build-time manifest and mounts
 * react-image-gallery; neither is what this file is asserting about. The stub
 * keeps the assertion on route resolution.
 */
vi.mock('./components/Gallery/ND/TailOfTheDragon', () => ({
    default: () => <div data-testid="totd-gallery" />,
}));

/**
 * Unrelated to this route, but unavoidable: the module is reached through the
 * route table's nd-hillcountry entry and calls import.meta.globEager, which
 * Vitest's SSR transform does not implement. Any test that renders App needs
 * this stub until that call site moves to import.meta.glob({eager:true}).
 */
vi.mock('./components/Gallery/ND/HillCountry/images', () => ({ default: [] }));

const { default: App } = await import('./App');

/**
 * Resolved from the Vitest root rather than import.meta.url: under jsdom
 * import.meta.url is a document-relative http URL, not a file URL.
 */
const APP_SOURCE = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8');

/** jsdom does not implement scrollTo; App's ScrollToTop calls it on every nav. */
vi.stubGlobal('scrollTo', vi.fn());

const renderAt = (path) => {
    window.history.pushState({}, '', path);

    return render(<App />);
};

afterEach(cleanup);

describe('the Tail of the Dragon gallery has exactly one route', () => {
    it('still resolves /totdgallery to the gallery', () => {
        renderAt('/totdgallery');

        expect(screen.getByTestId('totd-gallery')).toBeDefined();
    });

    it('no longer resolves /totdtrip to anything', () => {
        renderAt('/totdtrip');

        expect(screen.queryByTestId('totd-gallery')).toBeNull();
    });

    it('registers no totdtrip path', () => {
        expect(APP_SOURCE).not.toContain('totdtrip');
    });

    it('retains the gallery import the surviving route depends on', () => {
        expect(APP_SOURCE).toContain(
            "import TailOfTheDragonGallery from './components/Gallery/ND/TailOfTheDragon'"
        );
    });
});
