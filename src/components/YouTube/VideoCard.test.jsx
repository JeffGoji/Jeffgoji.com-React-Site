/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers the card's own contract: the facade holds the player out of the
 * document until the visitor asks for it, and the click either swaps in place or
 * reports upward depending on whether the surface owns an overlay. The hub's
 * contract lives in index.test.jsx, the teaser's in VideoTeaser.test.jsx.
 *
 * Copy is asserted through VIDEO_COPY rather than as English literals, so
 * rewording the site does not fail the suite.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import VideoCard from './VideoCard';
import { VIDEO_COPY } from './videoCopy';

/** One manifest item, exactly as scripts/build-videos.mjs emits it. */
const VIDEO = {
    videoId: 'UySrXUfHA_k',
    title: 'A run at the LSR PCA autocross',
    description: 'A clean run at the LSR PCA event.',
    publishedAt: '2025-03-04T18:00:00+00:00',
    thumbnailUrl: 'https://i2.ytimg.com/vi/UySrXUfHA_k/hqdefault.jpg',
    playlistId: 'PLtestPlaylist01',
    seriesTitle: 'jeffgoji.com',
};

const PLAY_NAME = `${VIDEO_COPY.card.playPrefix} ${VIDEO.title}`;

afterEach(cleanup);

const renderCard = (props = {}) => render(<VideoCard video={VIDEO} {...props} />);

describe('the facade costs nothing until it is clicked', () => {
    it('mounts no iframe', () => {
        const { container } = renderCard();

        expect(container.querySelector('iframe')).toBeNull();
    });

    /**
     * jsdom does not fetch subresources, so "no request" is asserted as "nothing
     * in the tree points at the embed" — which is the property that causes the
     * request in a real browser.
     */
    it('points nothing in the tree at the embed origin', () => {
        const { container } = renderCard();

        expect(container.innerHTML).not.toContain('youtube.com/embed');
    });

    it('shows the manifests own poster', () => {
        const { container } = renderCard();

        expect(container.querySelector('.video__poster').getAttribute('src')).toBe(
            VIDEO.thumbnailUrl
        );
    });

    /** hqdefault is the one rendition YouTube guarantees for every video. */
    it('falls back to hqdefault when the manifest carried no thumbnail', () => {
        const { container } = render(
            <VideoCard video={{ ...VIDEO, thumbnailUrl: '' }} />
        );

        expect(container.querySelector('.video__poster').getAttribute('src')).toBe(
            `https://img.youtube.com/vi/${VIDEO.videoId}/hqdefault.jpg`
        );
    });

    it('defers even the poster until it is near the viewport', () => {
        const { container } = renderCard();

        expect(container.querySelector('.video__poster').getAttribute('loading')).toBe('lazy');
    });

    /** An intrinsic ratio on the poster keeps the card from reflowing on load. */
    it('reserves the poster box', () => {
        const { container } = renderCard();
        const poster = container.querySelector('.video__poster');

        expect(poster.getAttribute('width')).toBe('480');
        expect(poster.getAttribute('height')).toBe('360');
    });
});

describe('the facade is operable, not just clickable', () => {
    it('is a button, so it is tab-reachable and takes Enter and Space for free', () => {
        renderCard();

        expect(screen.getByRole('button').tagName).toBe('BUTTON');
    });

    /**
     * type="button" is load-bearing: the grid may sit inside a form on some
     * future surface, and a default-type button submits it.
     */
    it('does not submit an enclosing form', () => {
        renderCard();

        expect(screen.getByRole('button').getAttribute('type')).toBe('button');
    });

    it('announces which video it plays', () => {
        renderCard();

        expect(screen.getByRole('button', { name: PLAY_NAME })).toBeDefined();
    });

    /**
     * The button already carries the name; an alt repeating it would make the
     * card announce the same title twice.
     */
    it('leaves the poster out of the accessibility tree', () => {
        const { container } = renderCard();

        expect(container.querySelector('.video__poster').getAttribute('alt')).toBe('');
    });

    it('hides the decorative play glyph', () => {
        const { container } = renderCard();

        expect(container.querySelector('.video__play').getAttribute('aria-hidden')).toBe('true');
    });
});

describe('the body carries only what the feed can supply', () => {
    it('heads the card at level 3, under whatever owns the surface', () => {
        renderCard();

        expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(VIDEO.title);
    });

    it('prints the published month and year', () => {
        const { container } = renderCard();

        expect(container.querySelector('.video__meta').textContent).toBe('Mar 2025');
    });

    /**
     * The RSS feed carries neither, and the CPO dropped both rather than
     * hand-maintaining them. A formatter reappearing here would put an invented
     * number on a card.
     */
    it('shows no duration badge and no view count', () => {
        const { container } = renderCard();

        expect(container.querySelector('.video__duration')).toBeNull();
        expect(container.textContent).not.toMatch(/views/i);
        expect(container.textContent).not.toMatch(/\d+:\d\d/);
    });

    /** One playlist means one series, so naming it on every card is noise. */
    it('keeps the series kicker off by default', () => {
        const { container } = renderCard();

        expect(container.querySelector('.card__kicker')).toBeNull();
    });

    it('shows the series kicker when the surface asks for it', () => {
        const { container } = renderCard({ showSeries: true });

        expect(container.querySelector('.card__kicker').textContent).toBe(VIDEO.seriesTitle);
    });

    it('omits the kicker when the manifest carried no series title', () => {
        const { container } = render(
            <VideoCard video={{ ...VIDEO, seriesTitle: '' }} showSeries />
        );

        expect(container.querySelector('.card__kicker')).toBeNull();
    });
});

describe('without an onOpen the card plays in place', () => {
    const play = () => {
        const rendered = renderCard();

        fireEvent.click(screen.getByRole('button', { name: PLAY_NAME }));

        return rendered;
    };

    it('mounts exactly one iframe', () => {
        const { container } = play();

        expect(container.querySelectorAll('iframe')).toHaveLength(1);
    });

    it('embeds the id it was given, autoplaying', () => {
        const { container } = play();

        expect(container.querySelector('iframe').getAttribute('src')).toBe(
            `https://www.youtube.com/embed/${VIDEO.videoId}?autoplay=1`
        );
    });

    /** Without the autoplay permission the autoplay parameter is ignored. */
    it('grants the frame the autoplay permission the src asks for', () => {
        const { container } = play();

        expect(container.querySelector('iframe').getAttribute('allow')).toContain('autoplay');
    });

    it('names the frame after the video', () => {
        const { container } = play();

        expect(container.querySelector('iframe').getAttribute('title')).toBe(VIDEO.title);
    });

    it('lets the player go fullscreen', () => {
        const { container } = play();

        expect(container.querySelector('iframe').hasAttribute('allowfullscreen')).toBe(true);
    });

    it('takes the facade back out, so the poster is not left under the player', () => {
        const { container } = play();

        expect(screen.queryByRole('button')).toBeNull();
        expect(container.querySelector('.video__poster')).toBeNull();
    });

    it('keeps the card body', () => {
        play();

        expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(VIDEO.title);
    });
});

describe('with an onOpen the card reports upward and stays a poster', () => {
    it('hands the whole item to the caller', () => {
        const onOpen = vi.fn();

        renderCard({ onOpen });
        fireEvent.click(screen.getByRole('button', { name: PLAY_NAME }));

        expect(onOpen).toHaveBeenCalledWith(VIDEO);
    });

    /**
     * This is the property the hub's single-overlay contract rests on: a grid of
     * cards can be clicked through without any cell ever mounting a player.
     */
    it('mounts no player of its own', () => {
        const { container } = renderCard({ onOpen: vi.fn() });

        fireEvent.click(screen.getByRole('button', { name: PLAY_NAME }));

        expect(container.querySelector('iframe')).toBeNull();
        expect(container.querySelector('.video__poster')).not.toBeNull();
    });
});

describe('density is the only thing size changes', () => {
    it.each(['sm', 'md', 'lg'])('carries the %s modifier', (size) => {
        const { container } = renderCard({ size });

        expect(container.querySelector(`.video--${size}`)).not.toBeNull();
    });

    /**
     * A card that drops a field at one size makes that field look optional to
     * whoever ports this next.
     */
    it('shows the same fields at every size', () => {
        for (const size of ['sm', 'md', 'lg']) {
            const { container } = render(<VideoCard video={VIDEO} size={size} showSeries />);

            expect(container.querySelector('.card__kicker')).not.toBeNull();
            expect(container.querySelector('.video__title')).not.toBeNull();
            expect(container.querySelector('.video__meta')).not.toBeNull();

            cleanup();
        }
    });
});
