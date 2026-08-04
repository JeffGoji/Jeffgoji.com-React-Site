/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers Task 00031 at the section level: the grid is data-driven, it lands on
 * the page with no player mounted, and it is still the module both the home page
 * and the /youtube route reach for. The card's own contract lives in
 * VideoCard.test.jsx.
 *
 * jsdom performs no layout, so the grid assertions read the compiled stylesheet
 * rather than measuring a rendered box — the same trade Header/index.test.jsx
 * and src/scss/styles.test.js make.
 */

import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

import * as sass from 'sass';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import VideoGrid from './index';
import { videos } from './videos';

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

afterEach(cleanup);

describe('the grid is driven by the data, not by the markup', () => {
    it('paints one card per video', () => {
        const { container } = render(<VideoGrid />);

        expect(container.querySelectorAll('.video')).toHaveLength(videos.length);
    });

    it('offers one play affordance per video', () => {
        render(<VideoGrid />);

        expect(screen.getAllByRole('button')).toHaveLength(videos.length);
    });

    it('carries the three real channel ids', () => {
        expect(videos.map((video) => video.id)).toEqual([
            'UySrXUfHA_k',
            'Q2B8mA3vgP0',
            'XVjs7LRCBak',
        ]);
    });

    /** The id is the React key and the sort-free identity of a card. */
    it('gives every video a unique id', () => {
        expect(new Set(videos.map((video) => video.id)).size).toBe(videos.length);
    });

    it('gives every video a title and a kicker', () => {
        for (const video of videos) {
            expect(video.title.length, `${video.id} has no title`).toBeGreaterThan(0);
            expect(video.meta.length, `${video.id} has no meta`).toBeGreaterThan(0);
        }
    });

    it('posts every title on the page', () => {
        render(<VideoGrid />);

        for (const video of videos) {
            expect(screen.getByRole('heading', { level: 4, name: video.title })).toBeDefined();
        }
    });
});

describe('the section lands with no player in the document', () => {
    it('mounts no iframe at all', () => {
        const { container } = render(<VideoGrid />);

        expect(container.querySelectorAll('iframe')).toHaveLength(0);
    });

    it('points nothing in the tree at the embed origin', () => {
        const { container } = render(<VideoGrid />);

        expect(container.innerHTML).not.toContain('youtube.com/embed');
    });

    it('shows a poster for every video instead', () => {
        const { container } = render(<VideoGrid />);

        expect([...container.querySelectorAll('.video__poster')].map((img) => img.src)).toEqual(
            videos.map((video) => `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`)
        );
    });
});

describe('a click loads one video and only that video', () => {
    it('mounts the clicked card and leaves the others as facades', () => {
        const { container } = render(<VideoGrid />);

        fireEvent.click(screen.getByRole('button', { name: `Play ${videos[1].title}` }));

        const frames = container.querySelectorAll('iframe');

        expect(frames).toHaveLength(1);
        expect(frames[0].getAttribute('src')).toBe(
            `https://www.youtube.com/embed/${videos[1].id}?autoplay=1`
        );
        expect(screen.getAllByRole('button')).toHaveLength(videos.length - 1);
    });
});

/**
 * AC-016. The facade builds its markup from data that includes a YouTube id and
 * free text, so a lapse into raw-HTML rendering here would be an injection seam
 * on a surface that has none today. Asserted against the source rather than the
 * output because the risk is the API being reached for at all.
 */
describe('the section renders no raw HTML', () => {
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

    it('stands alone, so the route renders the whole section', () => {
        const { container } = render(<VideoGrid />);

        expect(container.querySelector('section.section--videos')).not.toBeNull();
        expect(screen.getByRole('heading', { level: 2 })).toBeDefined();
    });
});

describe('the mockups video block is ported', () => {
    it('fills the row rather than fixing a column count', () => {
        expect(topLevelDeclarationsOf('.video-grid').get('grid-template-columns')).toBe(
            'repeat(auto-fill, minmax(300px, 1fr))'
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
     * The poster is absolutely positioned, so a statically positioned play glyph
     * paints underneath it — which is what the mockup does.
     */
    it('stacks the play glyph above the poster', () => {
        expect(topLevelDeclarationsOf('.video__play').get('z-index')).toBe('1');
    });

    it('washes the poster back so the glyph keeps its contrast', () => {
        const poster = topLevelDeclarationsOf('.video__poster');

        expect(poster.get('opacity')).toBe('0.5');
        expect(poster.get('object-fit')).toBe('cover');
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
});
