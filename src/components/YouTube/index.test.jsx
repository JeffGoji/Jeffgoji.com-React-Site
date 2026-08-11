/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers the /youtube hub: the manifest fetch behind it, the four states around
 * that fetch, the conditional filter rows, the single-overlay player contract,
 * and the stylesheet deviations the designer's port called out. The card's own
 * contract lives in VideoCard.test.jsx.
 *
 * jsdom performs no layout, so the CSS assertions read the compiled stylesheet
 * rather than measuring a rendered box — the same trade Header/index.test.jsx
 * and src/scss/styles.test.js make.
 */

import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

import * as sass from 'sass';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import VideosHub from './index';
import { VIDEO_COPY } from './videoCopy';
import { CHANNEL_FALLBACK, MANIFEST_PUBLIC_PATH } from './videoManifest';

/**
 * Resolved from the Vitest root rather than import.meta.url: under jsdom
 * import.meta.url is a document-relative http URL, not a file URL.
 */
const ROOT = process.cwd();
const SCSS_DIR = resolve(ROOT, 'src/scss');
const COMPONENT_DIR = resolve(ROOT, 'src/components/YouTube');
const NODE_MODULES = dirname(
    dirname(createRequire(resolve(ROOT, 'index.html')).resolve('bootstrap/package.json'))
);

const css = sass.compile(resolve(SCSS_DIR, 'styles.scss'), {
    loadPaths: [SCSS_DIR, NODE_MODULES],
    quietDeps: true,
    logger: sass.Logger.silent,
}).css;

const escapeForRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Reads one top-level rule's declarations; see the twin in styles.test.js. */
function topLevelDeclarationsOf(selector) {
    const match = css.match(new RegExp(`^${escapeForRegExp(selector)} \\{([^{}]*)\\}`, 'm'));

    expect(match, `no top-level ${selector} rule emitted`).not.toBeNull();

    return new Map(
        match[1]
            .split(';')
            .filter((declaration) => declaration.includes(':'))
            .map((declaration) => {
                const [name, ...rest] = declaration.split(':');

                return [name.trim(), rest.join(':').trim().replace(/\s+/g, ' ')];
            })
            .filter(([name]) => name)
    );
}

const CHANNEL = {
    title: 'Jeff Goji',
    url: 'https://www.youtube.com/channel/UCtestchannelid',
};

const SERIES_A = 'PLseriesAaaaaaaaa';
const SERIES_B = 'PLseriesBbbbbbbbb';

const videoAt = (videoId, publishedAt, overrides = {}) => ({
    videoId,
    title: `Video ${videoId}`,
    description: `Description for ${videoId}`,
    publishedAt,
    thumbnailUrl: `https://i2.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    playlistId: SERIES_A,
    seriesTitle: 'jeffgoji.com',
    ...overrides,
});

/** Deliberately unsorted: the hub sorts, it does not trust arrival order. */
const VIDEOS = [
    videoAt('mid00000000', '2025-06-01T00:00:00+00:00'),
    videoAt('newest00000', '2026-02-01T00:00:00+00:00'),
    videoAt('oldest00000', '2024-01-01T00:00:00+00:00'),
];

const manifestOf = (items, channel = CHANNEL) => ({
    ok: true,
    json: async () => ({
        playlistId: SERIES_A,
        playlistTitle: 'jeffgoji.com',
        channel,
        count: items.length,
        items,
    }),
});

function stubFetch(response) {
    const fetchImpl = vi.fn(async () => response);

    vi.stubGlobal('fetch', fetchImpl);

    return fetchImpl;
}

const renderHub = async (items = VIDEOS) => {
    stubFetch(manifestOf(items));

    const rendered = render(<VideosHub />);

    await screen.findByRole('heading', { level: 2, name: VIDEOS_TITLE_MATCHER(items) });

    return rendered;
};

/** The hero is the newest video, whatever order the manifest arrived in. */
const VIDEOS_TITLE_MATCHER = (items) =>
    [...items].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))[0].title;

const cardsIn = (container) => [...container.querySelectorAll('.video-grid .video')];

beforeEach(() => {
    stubFetch(manifestOf(VIDEOS));
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('the hub reads the build-time manifest at runtime', () => {
    it('fetches the path the build script writes', async () => {
        const fetchImpl = stubFetch(manifestOf(VIDEOS));

        render(<VideosHub />);

        await waitFor(() => expect(fetchImpl).toHaveBeenCalledWith(MANIFEST_PUBLIC_PATH));
    });

    /**
     * Bundling the list would put the channel's uploads inside a content-hashed
     * chunk and make every new video a code change.
     */
    it('imports no static video list', () => {
        const source = readFileSync(resolve(COMPONENT_DIR, 'index.jsx'), 'utf8');

        expect(source).not.toMatch(/from '\.\/videos'/);
        expect(source).not.toMatch(/mockups/);
    });

    it('paints one card per manifest item', async () => {
        const { container } = await renderHub();

        expect(cardsIn(container)).toHaveLength(VIDEOS.length);
    });

    it('opens on the newest video whatever order the manifest arrived in', async () => {
        await renderHub();

        expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Video newest00000');
    });
});

describe('the four states around the fetch', () => {
    it('reserves the grids height while the fetch is in flight', () => {
        stubFetch(new Promise(() => {}));

        const { container } = render(<VideosHub />);

        expect(container.querySelector('.videos-hub__body--reserved')).not.toBeNull();
        expect(container.querySelector('.video-skeleton')).not.toBeNull();
        expect(screen.getByRole('status')).toBeDefined();
    });

    /**
     * This is the STEADY STATE until VIDEOS_PLAYLIST_ID is configured and
     * videos:build has run, not an exotic branch — so it is asserted for the two
     * shapes a missing manifest actually takes on this host.
     */
    it('degrades to the error state when the manifest 404s', async () => {
        stubFetch({ ok: false, json: async () => ({}) });

        const { container } = render(<VideosHub />);

        await screen.findByRole('alert');
        expect(container.querySelector('.videos-state--error')).not.toBeNull();
        expect(container.querySelector('iframe')).toBeNull();
    });

    /**
     * The SPA fallback in public/_redirects answers an unknown path with
     * index.html and a 200, so a missing manifest arrives as HTML that only
     * fails at parse time. The `ok` check alone would let it through.
     */
    it('degrades to the error state when the manifest is the SPA fallback html', async () => {
        stubFetch({
            ok: true,
            json: async () => {
                throw new SyntaxError('Unexpected token <');
            },
        });

        render(<VideosHub />);

        await screen.findByRole('alert');
    });

    it('degrades to the error state when fetch rejects outright', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new TypeError('Failed to fetch');
            })
        );

        render(<VideosHub />);

        await screen.findByRole('alert');
    });

    /** The videos exist on YouTube whether or not this site managed to list them. */
    it('offers the channel as an escape hatch from the error state', async () => {
        stubFetch({ ok: false, json: async () => ({}) });

        render(<VideosHub />);

        await screen.findByRole('alert');

        const escape = screen.getByRole('link', { name: VIDEO_COPY.states.openChannel });

        expect(escape.getAttribute('href')).toBe(CHANNEL_FALLBACK.url);
        expect(escape.getAttribute('rel')).toContain('noopener');
    });

    it('retries the fetch when asked', async () => {
        const fetchImpl = stubFetch({ ok: false, json: async () => ({}) });

        render(<VideosHub />);
        await screen.findByRole('alert');

        fireEvent.click(screen.getByRole('button', { name: VIDEO_COPY.states.retry }));

        await waitFor(() => expect(fetchImpl.mock.calls.length).toBeGreaterThan(1));
    });

    it('shows the empty state for a manifest with nothing in it', async () => {
        stubFetch(manifestOf([]));

        const { container } = render(<VideosHub />);

        await waitFor(() =>
            expect(container.querySelector('.videos-state')).not.toBeNull()
        );
        expect(container.querySelector('.videos-state--error')).toBeNull();
        expect(container.querySelector('.videos-filterbar')).toBeNull();
    });

    it('holds the reservation in every state that has no grid', async () => {
        stubFetch(manifestOf([]));

        const { container } = render(<VideosHub />);

        await waitFor(() => expect(container.querySelector('.videos-state')).not.toBeNull());
        expect(container.querySelector('.videos-hub__body--reserved')).not.toBeNull();
    });

    it('drops the reservation once the grid carries its own height', async () => {
        const { container } = await renderHub();

        expect(container.querySelector('.videos-hub__body--reserved')).toBeNull();
    });
});

describe('the filter rows render off the data, not off a flag', () => {
    /**
     * The manifest is built from ONE playlist today, so a series row would be a
     * control with a single choice. It is absent because the data says so, which
     * is what makes the row appear on its own the day a second playlist lands.
     */
    it('hides the series row while the manifest holds one playlist', async () => {
        const { container } = await renderHub();

        expect(
            container.querySelector(`[aria-label="${VIDEO_COPY.filters.seriesGroup}"]`)
        ).toBeNull();
    });

    it('shows the series row as soon as a second playlist appears', async () => {
        await renderHub([
            ...VIDEOS,
            videoAt('second00000', '2025-09-01T00:00:00+00:00', {
                playlistId: SERIES_B,
                seriesTitle: 'Great drives',
            }),
        ]);

        expect(
            screen.getByRole('group', { name: VIDEO_COPY.filters.seriesGroup })
        ).toBeDefined();
    });

    it('filters the grid down to the chosen series', async () => {
        const { container } = await renderHub([
            ...VIDEOS,
            videoAt('second00000', '2025-09-01T00:00:00+00:00', {
                playlistId: SERIES_B,
                seriesTitle: 'Great drives',
            }),
        ]);

        fireEvent.click(screen.getByRole('button', { name: 'Great drives' }));

        expect(cardsIn(container)).toHaveLength(1);
    });

    /** The RSS feed carries no tags at all, so this row has nothing to build from. */
    it('hides the tag row when no item carries tags', async () => {
        const { container } = await renderHub();

        expect(
            container.querySelector(`[aria-label="${VIDEO_COPY.filters.tagGroup}"]`)
        ).toBeNull();
    });

    it('shows the tag row if a manifest ever carries tags', async () => {
        await renderHub([
            videoAt('tagged00000', '2026-02-01T00:00:00+00:00', { tags: ['ND', 'Autocross'] }),
        ]);

        expect(screen.getByRole('group', { name: VIDEO_COPY.filters.tagGroup })).toBeDefined();
    });

    /**
     * A toggle that signals its state with colour alone is unusable without
     * sight of it; aria-pressed is what carries it to a screen reader.
     */
    it('ships the chips as pressed-state buttons, not as static badges', async () => {
        await renderHub([
            ...VIDEOS,
            videoAt('second00000', '2025-09-01T00:00:00+00:00', {
                playlistId: SERIES_B,
                seriesTitle: 'Great drives',
            }),
        ]);

        const all = screen.getByRole('button', { name: VIDEO_COPY.filters.all });

        expect(all.tagName).toBe('BUTTON');
        expect(all.getAttribute('aria-pressed')).toBe('true');

        fireEvent.click(screen.getByRole('button', { name: 'Great drives' }));

        expect(all.getAttribute('aria-pressed')).toBe('false');
    });

    it('offers a reset out of a filtered view, disabled until there is one', async () => {
        await renderHub([
            ...VIDEOS,
            videoAt('second00000', '2025-09-01T00:00:00+00:00', {
                playlistId: SERIES_B,
                seriesTitle: 'Great drives',
            }),
        ]);

        const clear = screen.getByRole('button', { name: VIDEO_COPY.filters.clear });

        expect(clear.disabled).toBe(true);

        fireEvent.click(screen.getByRole('button', { name: 'Great drives' }));
        expect(clear.disabled).toBe(false);

        fireEvent.click(clear);
        expect(screen.getByRole('button', { name: VIDEO_COPY.filters.all }).getAttribute(
            'aria-pressed'
        )).toBe('true');
    });

    /**
     * With one series and no tags there is nothing to reset, so the control that
     * resets it would be permanently disabled — worse than absent.
     */
    it('hides the reset when neither axis can be filtered', async () => {
        await renderHub();

        expect(screen.queryByRole('button', { name: VIDEO_COPY.filters.clear })).toBeNull();
    });

    /**
     * The live playlist is titled "jeffgoji.com", so with one series the hero
     * would read "Latest · jeffgoji.com" and carry a "Series jeffgoji.com" chip
     * on a page of that site. One derived flag governs the filter row, the card
     * kickers, the hero and the overlay together.
     */
    it('names no series anywhere while there is only one', async () => {
        const { container } = await renderHub();

        expect(container.querySelector('.card__kicker')).toBeNull();
        expect(container.querySelector('.videos-featured .eyebrow').textContent).toBe(
            VIDEO_COPY.featured.eyebrowPrefix
        );
        expect(container.textContent).not.toContain(VIDEO_COPY.featured.seriesLabel);
    });

    it('names the series everywhere once there are two', async () => {
        const { container } = await renderHub([
            ...VIDEOS,
            videoAt('second00000', '2025-09-01T00:00:00+00:00', {
                playlistId: SERIES_B,
                seriesTitle: 'Great drives',
            }),
        ]);

        expect(container.querySelector('.videos-featured .eyebrow').textContent).toContain(
            'jeffgoji.com'
        );
        expect(container.querySelector('.video-grid .card__kicker')).not.toBeNull();
    });

    it('keeps a live count of what the filters left', async () => {
        const { container } = await renderHub();

        expect(container.querySelector('.videos-filterbar__count').textContent).toBe(
            VIDEO_COPY.filters.countOf(VIDEOS.length, VIDEOS.length)
        );
    });
});

describe('sorting is limited to what publishedAt can express', () => {
    it('offers newest and oldest and nothing else', async () => {
        await renderHub();

        expect([...screen.getByRole('combobox').options].map((option) => option.textContent)).toEqual(
            [VIDEO_COPY.sorts.newest, VIDEO_COPY.sorts.oldest]
        );
    });

    /**
     * The feed carries no duration and no trustworthy view count, so a "most
     * watched" or "longest first" option would sort on a field that is not there.
     */
    it('offers no view-count or duration order', async () => {
        await renderHub();

        const labels = [...screen.getByRole('combobox').options].map((option) =>
            option.textContent.toLowerCase()
        );

        expect(labels.some((label) => /watch|view|long|duration/.test(label))).toBe(false);
    });

    it('defaults to newest first', async () => {
        const { container } = await renderHub();

        expect(cardsIn(container).map((card) => card.querySelector('.video__title').textContent)).toEqual(
            ['Video newest00000', 'Video mid00000000', 'Video oldest00000']
        );
    });

    it('reverses the grid on oldest first', async () => {
        const { container } = await renderHub();

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'oldest' } });

        expect(cardsIn(container).map((card) => card.querySelector('.video__title').textContent)).toEqual(
            ['Video oldest00000', 'Video mid00000000', 'Video newest00000']
        );
    });

    /** The hero is the masthead; it must not re-identify when a control moves. */
    it('leaves the hero alone when the grid reorders', async () => {
        await renderHub();

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'oldest' } });

        expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Video newest00000');
    });
});

describe('the document holds at most one player', () => {
    it('lands with none', async () => {
        const { container } = await renderHub();

        expect(container.querySelectorAll('iframe')).toHaveLength(0);
        expect(container.innerHTML).not.toContain('youtube.com/embed');
    });

    it('opens one overlay player on a card click, leaving every cell a poster', async () => {
        const { container } = await renderHub();

        fireEvent.click(
            screen.getByRole('button', { name: `${VIDEO_COPY.card.playPrefix} Video mid00000000` })
        );

        expect(container.querySelectorAll('iframe')).toHaveLength(1);
        expect(container.querySelectorAll('.video-grid .video__poster')).toHaveLength(
            VIDEOS.length
        );
        expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    });

    /**
     * The iframe is mounted by the overlay's existence, so closing unmounts the
     * player and stops playback with it — no pause plumbing, no postMessage.
     */
    it('unmounts the player on close', async () => {
        const { container } = await renderHub();

        fireEvent.click(
            screen.getByRole('button', { name: `${VIDEO_COPY.card.playPrefix} Video mid00000000` })
        );
        fireEvent.click(screen.getByRole('button', { name: VIDEO_COPY.modal.close }));

        expect(container.querySelectorAll('iframe')).toHaveLength(0);
    });

    it('closes on Escape', async () => {
        const { container } = await renderHub();

        fireEvent.click(
            screen.getByRole('button', { name: `${VIDEO_COPY.card.playPrefix} Video mid00000000` })
        );
        fireEvent.keyDown(document, { key: 'Escape' });

        expect(container.querySelector('[role="dialog"]')).toBeNull();
    });

    /** The hero is the one card that plays in place: there is only ever one of it. */
    it('plays the hero in place rather than in the overlay', async () => {
        const { container } = await renderHub();

        fireEvent.click(screen.getByRole('button', { name: VIDEO_COPY.featured.play }));

        expect(container.querySelector('[role="dialog"]')).toBeNull();
        expect(
            container.querySelector('.videos-featured__inner iframe').getAttribute('src')
        ).toBe('https://www.youtube.com/embed/newest00000?autoplay=1');
    });
});

describe('the hub heads the route once and links out safely', () => {
    it('carries exactly one h1', async () => {
        await renderHub();

        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });

    it('names the channel from the manifest rather than a hardcoded handle', async () => {
        await renderHub();

        const link = screen.getByRole('link', { name: CHANNEL.title });

        expect(link.getAttribute('href')).toBe(CHANNEL.url);
    });

    it('opens every external link without handing over the opener', async () => {
        const { container } = await renderHub();

        for (const link of container.querySelectorAll('a[target="_blank"]')) {
            expect(link.getAttribute('rel')).toContain('noopener');
        }
    });
});

/**
 * AC-016. The hub builds its markup from a fetched manifest, which is free text
 * from a third party — so a lapse into raw-HTML rendering here would be an
 * injection seam on a surface that has none today. Asserted against the source
 * rather than the output because the risk is the API being reached for at all.
 */
describe('the hub renders no raw HTML', () => {
    const sources = readdirSync(COMPONENT_DIR)
        .filter((name) => /\.jsx?$/.test(name) && !name.includes('.test.'))
        .map((name) => [name, readFileSync(resolve(COMPONENT_DIR, name), 'utf8')]);

    it('has sources to check', () => {
        expect(sources.length).toBeGreaterThan(0);
    });

    it.each(sources)('keeps dangerouslySetInnerHTML out of %s', (_name, source) => {
        expect(source).not.toContain('dangerouslySetInnerHTML');
    });

    it.each(sources)('assigns no innerHTML in %s', (_name, source) => {
        expect(source).not.toContain('innerHTML');
    });
});

/**
 * The component behind the name changed; the module seam did not. /youtube is a
 * linked destination in both the nav and the footer, so a rename here that left
 * App.jsx behind would 404 a route the shell advertises.
 */
describe('the /youtube route still resolves to this module', () => {
    const APP_SOURCE = readFileSync(resolve(ROOT, 'src/App.jsx'), 'utf8');

    it('is what App.jsx imports from components/YouTube', () => {
        expect(APP_SOURCE).toContain("from './components/YouTube'");
    });

    it('is still registered at the youtube path', () => {
        expect(APP_SOURCE).toMatch(/path="youtube"/);
    });
});

describe('the designers three deviations landed in the real stylesheet', () => {
    /**
     * DEVIATION 1. Production used to wash the whole poster back to opacity 0.5
     * so the play glyph held contrast. The dimming moves into a bottom-weighted
     * scrim so the photography keeps its brightness.
     */
    it('replaces the poster dimming with a bottom-weighted scrim', () => {
        expect(topLevelDeclarationsOf('.video__poster').get('opacity')).toBeUndefined();
        expect(topLevelDeclarationsOf('.video__poster').get('object-fit')).toBe('cover');

        const scrim = topLevelDeclarationsOf('.video__frame--button::after');

        expect(scrim.get('background')).toContain('linear-gradient(180deg');
        expect(scrim.get('background')).toContain('rgba(5, 5, 6, 0.75) 100%');
    });

    /** The glyph must clear both the poster and the scrim above it. */
    it('stacks the play glyph above the scrim', () => {
        expect(topLevelDeclarationsOf('.video__play').get('z-index')).toBe('2');
        expect(topLevelDeclarationsOf('.video__frame--button::after').get('z-index')).toBe('1');
    });

    /** DEVIATION 2. `.chip` becomes an interactive control for the first time. */
    it('gives the chip a pointer, a hover and a focus ring as a control', () => {
        expect(topLevelDeclarationsOf('.chip--toggle').get('cursor')).toBe('pointer');
        expect(css).toContain('.chip--toggle:focus-visible');
        expect(css).toContain('.chip--toggle:hover');
    });

    /** Pressed state changes the border as well as the fill, not colour alone. */
    it('signals the pressed chip with more than a fill colour', () => {
        const on = topLevelDeclarationsOf('.chip--toggle.is-on');

        expect(on.get('background')).toBe('var(--goji-red)');
        expect(on.get('border-color')).toBe('var(--goji-red)');
        expect(on.get('font-weight')).toBe('700');
    });

    /** DEVIATION 3. The size variant the filter bar's reset control needs. */
    it('carries the small button variant exactly once', () => {
        const small = topLevelDeclarationsOf('.btn--sm');

        expect(small.get('padding')).toBe('var(--space-2) var(--space-4)');
        expect(small.get('font-size')).toBe('var(--fs-xs)');
        expect(css.match(/^\.btn--sm \{/gm)).toHaveLength(1);
    });
});

describe('the mockups grid geometry is ported', () => {
    it('fills the row rather than fixing a column count', () => {
        expect(topLevelDeclarationsOf('.video-grid').get('grid-template-columns')).toBe(
            'repeat(auto-fill, minmax(300px, 1fr))'
        );
        expect(topLevelDeclarationsOf('.video-grid--sm').get('grid-template-columns')).toBe(
            'repeat(auto-fill, minmax(240px, 1fr))'
        );
    });

    it('holds the frame at 16:9 whatever the poster is', () => {
        expect(topLevelDeclarationsOf('.video__frame').get('aspect-ratio')).toBe('16/9');
    });

    /** The frame is a button; without this it paints the user agent's own border. */
    it('strips the user-agent button chrome off the frame', () => {
        const frame = topLevelDeclarationsOf('.video__frame');

        expect(frame.get('border')).toBe('0');
        expect(frame.get('padding')).toBe('0');
    });

    /**
     * Poster and player share the fill rule, so sass emits them as one grouped
     * selector across two lines — which the single-selector reader above cannot
     * see.
     */
    it('fills the frame with whichever of the two is mounted', () => {
        expect(css).toMatch(
            /^\.video__poster,\n\.video__player \{[^{}]*position: absolute;[^{}]*inset: 0;/m
        );
    });

    /** The bar is the only way back out of a filtered view deep in a long grid. */
    it('keeps the filter bar reachable while the grid scrolls', () => {
        const bar = topLevelDeclarationsOf('.videos-filterbar');

        expect(bar.get('position')).toBe('sticky');
        expect(bar.get('top')).toBe('0');
    });

    /** A loading state that animates is the worst thing to force on prefers-reduced-motion. */
    it('holds the skeleton shimmer behind the motion query', () => {
        expect(css).toMatch(
            /@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?video-shimmer/
        );
    });
});
