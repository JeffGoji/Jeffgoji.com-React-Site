/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers the home page's videos section: the second surface reading the same
 * build-time manifest the /youtube hub reads, held to a smaller contract — no
 * masthead, no filter bar, no overlay, and a box whose height does not move when
 * the fetch resolves.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import VideoTeaser, { TEASER_COUNT } from './VideoTeaser';
import { VIDEO_COPY } from './videoCopy';
import { CHANNEL_FALLBACK, MANIFEST_PUBLIC_PATH } from './videoManifest';

const ROOT = process.cwd();

const CHANNEL = {
    title: 'Jeff Goji',
    url: 'https://www.youtube.com/channel/UCtestchannelid',
};

const videoAt = (videoId, publishedAt) => ({
    videoId,
    title: `Video ${videoId}`,
    description: `Description for ${videoId}`,
    publishedAt,
    thumbnailUrl: `https://i2.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    playlistId: 'PLseriesAaaaaaaaa',
    seriesTitle: 'jeffgoji.com',
});

/** Five items, unsorted, so both the slice and the sort have something to do. */
const VIDEOS = [
    videoAt('third000000', '2025-06-01T00:00:00+00:00'),
    videoAt('first000000', '2026-02-01T00:00:00+00:00'),
    videoAt('fifth000000', '2023-01-01T00:00:00+00:00'),
    videoAt('second00000', '2025-12-01T00:00:00+00:00'),
    videoAt('fourth00000', '2024-01-01T00:00:00+00:00'),
];

const manifestOf = (items) => ({
    ok: true,
    json: async () => ({ channel: CHANNEL, count: items.length, items }),
});

function stubFetch(response) {
    const fetchImpl = vi.fn(async () => response);

    vi.stubGlobal('fetch', fetchImpl);

    return fetchImpl;
}

const renderTeaser = () =>
    render(
        <MemoryRouter>
            <VideoTeaser />
        </MemoryRouter>
    );

const cardsIn = (container) => [...container.querySelectorAll('.video-grid .video')];

beforeEach(() => {
    stubFetch(manifestOf(VIDEOS));
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('the teaser is the same manifest, read smaller', () => {
    it('reads the path the build script writes', async () => {
        const fetchImpl = stubFetch(manifestOf(VIDEOS));

        renderTeaser();

        await waitFor(() => expect(fetchImpl).toHaveBeenCalledWith(MANIFEST_PUBLIC_PATH));
    });

    it('shows the most recent uploads and no more', async () => {
        const { container } = renderTeaser();

        await waitFor(() => expect(cardsIn(container)).toHaveLength(TEASER_COUNT));
        expect(
            cardsIn(container).map((card) => card.querySelector('.video__title').textContent)
        ).toEqual(['Video first000000', 'Video second00000', 'Video third000000']);
    });

    /** Home already carries the hero's h1; a second masthead is what this avoids. */
    it('heads its section at level 2, never level 1', async () => {
        renderTeaser();

        await waitFor(() => expect(screen.getAllByRole('heading', { level: 3 }).length).toBe(3));
        expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
        expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
            VIDEO_COPY.teaser.title
        );
    });

    /** The hub's chrome stays on the route that owns it. */
    it('carries no filter bar and no hero', async () => {
        const { container } = renderTeaser();

        await waitFor(() => expect(cardsIn(container)).toHaveLength(TEASER_COUNT));
        expect(container.querySelector('.videos-filterbar')).toBeNull();
        expect(container.querySelector('.videos-featured')).toBeNull();
    });

    it('offers the way through to the whole hub', async () => {
        renderTeaser();

        const link = await screen.findByRole('link', { name: new RegExp(VIDEO_COPY.teaser.all) });

        expect(link.getAttribute('href')).toBe('/youtube');
    });

    /** Home.test.jsx asserts the section's id and class in its composition order. */
    it('keeps the section identity the home page composes against', async () => {
        const { container } = renderTeaser();

        await waitFor(() => expect(cardsIn(container)).toHaveLength(TEASER_COUNT));
        expect(container.querySelector('section#videos.section--videos')).not.toBeNull();
    });
});

describe('the teaser costs no players', () => {
    it('lands with no iframe', async () => {
        const { container } = renderTeaser();

        await waitFor(() => expect(cardsIn(container)).toHaveLength(TEASER_COUNT));
        expect(container.querySelectorAll('iframe')).toHaveLength(0);
    });

    /**
     * No overlay here: the overlay exists to stop a long grid accumulating live
     * players, and three cards do not need a heavier interaction than a swap.
     */
    it('plays in place rather than opening the hubs overlay', async () => {
        const { container } = renderTeaser();

        await waitFor(() => expect(cardsIn(container)).toHaveLength(TEASER_COUNT));

        fireEvent.click(
            screen.getByRole('button', {
                name: `${VIDEO_COPY.card.playPrefix} Video first000000`,
            })
        );

        expect(container.querySelector('[role="dialog"]')).toBeNull();
        expect(container.querySelectorAll('iframe')).toHaveLength(1);
    });
});

describe('the section holds its box whatever the fetch does', () => {
    it('reserves the grid with a skeleton while the fetch is in flight', () => {
        stubFetch(new Promise(() => {}));

        const { container } = renderTeaser();

        expect(container.querySelectorAll('.video-skeleton')).toHaveLength(TEASER_COUNT);
    });

    /**
     * This section closes the home page, so collapsing it after mount would move
     * the footer by its whole height — the shift Bug 00077 was about.
     */
    it('still renders the section when the manifest is missing', async () => {
        stubFetch({ ok: false, json: async () => ({}) });

        const { container } = renderTeaser();

        await waitFor(() =>
            expect(container.querySelector('.videos-hub__status')).not.toBeNull()
        );
        expect(container.querySelector('section#videos.section--videos')).not.toBeNull();
        expect(screen.getByRole('heading', { level: 2 })).toBeDefined();
    });

    it('points at the channel when it has nothing to show', async () => {
        stubFetch({ ok: false, json: async () => ({}) });

        renderTeaser();

        const link = await screen.findByRole('link', { name: VIDEO_COPY.states.openChannel });

        expect(link.getAttribute('href')).toBe(CHANNEL_FALLBACK.url);
        expect(link.getAttribute('rel')).toContain('noopener');
    });

    it('does the same for a manifest that loaded but is empty', async () => {
        stubFetch(manifestOf([]));

        const { container } = renderTeaser();

        await waitFor(() =>
            expect(container.querySelector('.videos-hub__status')).not.toBeNull()
        );
        expect(container.querySelector('.video-grid')).toBeNull();
    });

    it('survives a fetch that rejects outright', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new TypeError('Failed to fetch');
            })
        );

        const { container } = renderTeaser();

        await waitFor(() =>
            expect(container.querySelector('.videos-hub__status')).not.toBeNull()
        );
    });
});

describe('the home surface consumes this rather than the hub', () => {
    const HOME_SOURCE = readFileSync(resolve(ROOT, 'src/components/pages/Home.jsx'), 'utf8');

    it('is what Home imports', () => {
        expect(HOME_SOURCE).toContain("import VideoTeaser from '../YouTube/VideoTeaser'");
    });

    /** Mounting the hub here would give the page a second masthead under the hero. */
    it('leaves the hub on its own route', () => {
        expect(HOME_SOURCE).not.toMatch(/from '\.\.\/YouTube'/);
    });
});
