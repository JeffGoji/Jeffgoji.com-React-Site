/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers Task 00031 at the card level: the facade holds the player out of the
 * document until the visitor asks for it, and the click hands over to the right
 * video. The grid's own contract lives in index.test.jsx.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import VideoCard from './VideoCard';

const VIDEO = {
    id: 'UySrXUfHA_k',
    title: 'A run at the LSR PCA autocross',
    meta: 'Autocross · March 2025',
};

afterEach(cleanup);

const renderCard = (video = VIDEO) => render(<VideoCard video={video} />);

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

    it('shows the poster instead', () => {
        const { container } = renderCard();

        expect(container.querySelector('.video__poster').getAttribute('src')).toBe(
            'https://img.youtube.com/vi/UySrXUfHA_k/hqdefault.jpg'
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

        expect(screen.getByRole('button', { name: `Play ${VIDEO.title}` })).toBeDefined();
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

describe('clicking hands over to the player', () => {
    const play = () => {
        const rendered = renderCard();

        fireEvent.click(screen.getByRole('button'));

        return rendered;
    };

    it('mounts exactly one iframe', () => {
        const { container } = play();

        expect(container.querySelectorAll('iframe')).toHaveLength(1);
    });

    it('embeds the id it was given', () => {
        const { container } = play();

        expect(container.querySelector('iframe').getAttribute('src')).toBe(
            'https://www.youtube.com/embed/UySrXUfHA_k?autoplay=1'
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
        const { container } = play();

        expect(container.querySelector('.card__kicker').textContent).toBe(VIDEO.meta);
        expect(screen.getByRole('heading', { level: 4 }).textContent).toBe(VIDEO.title);
    });
});
