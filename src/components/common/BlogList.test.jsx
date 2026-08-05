/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers Task 00034: the four per-car blog bodies collapse onto one data-driven
 * <BlogList>. The markdown-safety block is the primary home of Spec 00002's P8
 * assertion (AC-016) — it guards the render path, not just the source text.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import BlogList from './BlogList';
import ndBlog from '../../assets/Data/ndBlog.json';
import naBlog from '../../assets/Data/naBlog.json';
import msmBlog from '../../assets/Data/MsmBlog.json';
import c8Blog from '../../assets/Data/c8Blog.json';

/**
 * Resolved from the Vitest root rather than import.meta.url: under jsdom
 * import.meta.url is a document-relative http URL, not a file URL.
 */
const SOURCE = readFileSync(
    resolve(process.cwd(), 'src/components/common/BlogList.jsx'),
    'utf8'
);

/**
 * The raw-HTML guard below reads code, not prose: the module's own
 * documentation names the forbidden identifiers in order to explain why they
 * are forbidden, and matching those would make the guard fire on its own
 * rationale.
 */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const post = (id, overrides = {}) => ({
    id,
    date: `1/${id}/2025`,
    mileage: `${id}0,000`,
    picture: `images/nd/post-${id}.jpg`,
    cost: `$${id}00`,
    entry: `Entry ${id}.`,
    ...overrides,
});

const renderList = (props = {}) =>
    render(<BlogList data={[post(1), post(2)]} title="ND Build Log" {...props} />);

const postEntries = () => document.querySelectorAll('article.post');

const entryIds = () =>
    [...postEntries()].map((article) => within(article).getByText(/^Entry \d+\.$/).textContent);

beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
});

describe('the build log paginates the way the mockup does', () => {
    const nine = Array.from({ length: 9 }, (unused, index) => post(index + 1));

    it('shows three entries per page', () => {
        renderList({ data: nine });

        expect(postEntries()).toHaveLength(3);
    });

    it('orders entries newest id first', () => {
        renderList({ data: nine });

        expect(entryIds()).toEqual(['Entry 9.', 'Entry 8.', 'Entry 7.']);
    });

    it('leaves the caller-supplied array untouched while sorting', () => {
        const data = [post(1), post(3), post(2)];

        renderList({ data });

        expect(data.map((entry) => entry.id)).toEqual([1, 3, 2]);
    });

    it('advances a page of three on Next', () => {
        renderList({ data: nine });

        fireEvent.click(screen.getByRole('button', { name: /next/i }));

        expect(entryIds()).toEqual(['Entry 6.', 'Entry 5.', 'Entry 4.']);
    });

    it('walks back on Prev', () => {
        renderList({ data: nine });

        fireEvent.click(screen.getByRole('button', { name: /next/i }));
        fireEvent.click(screen.getByRole('button', { name: /prev/i }));

        expect(entryIds()).toEqual(['Entry 9.', 'Entry 8.', 'Entry 7.']);
    });

    it('reports the position in the run', () => {
        renderList({ data: nine });

        expect(document.querySelector('.pager__count').textContent).toContain('PAGE 1 / 3');
    });

    it('renders the short tail on the last page', () => {
        renderList({ data: [...nine, post(10)] });

        fireEvent.click(screen.getByRole('button', { name: /next/i }));
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
        fireEvent.click(screen.getByRole('button', { name: /next/i }));

        expect(entryIds()).toEqual(['Entry 1.']);
    });

    it('honours a caller-chosen page size', () => {
        renderList({ data: nine, postsPerPage: 4 });

        expect(postEntries()).toHaveLength(4);
    });

    /**
     * The previous per-car components scrolled from an effect on `page`, which
     * also fired on mount and fought the router-level ScrollToTop.
     */
    it('does not scroll on mount, only on a page change', () => {
        renderList({ data: nine });

        expect(window.scrollTo).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: /next/i }));

        expect(window.scrollTo).toHaveBeenCalledTimes(1);
    });
});

describe('the pager stops at both ends of the run', () => {
    const nine = Array.from({ length: 9 }, (unused, index) => post(index + 1));

    it('disables Prev on the first page', () => {
        renderList({ data: nine });

        expect(screen.getByRole('button', { name: /prev/i }).disabled).toBe(true);
        expect(screen.getByRole('button', { name: /next/i }).disabled).toBe(false);
    });

    it('disables Next on the last page', () => {
        renderList({ data: nine });

        fireEvent.click(screen.getByRole('button', { name: /next/i }));
        fireEvent.click(screen.getByRole('button', { name: /next/i }));

        expect(screen.getByRole('button', { name: /next/i }).disabled).toBe(true);
        expect(screen.getByRole('button', { name: /prev/i }).disabled).toBe(false);
    });

    it('hides the pager entirely when everything fits on one page', () => {
        renderList({ data: [post(1), post(2)] });

        expect(document.querySelector('.pager')).toBeNull();
    });
});

describe('entries render through react-markdown, not raw HTML', () => {
    /**
     * Spec 00002 P8 / AC-016. Two layers: the module may not import or pass a
     * raw-HTML path, and a hostile entry must come out as text.
     */
    it('never reaches for dangerouslySetInnerHTML', () => {
        expect(CODE).not.toContain('dangerouslySetInnerHTML');
    });

    it('never pulls in a rehype raw-HTML plugin', () => {
        expect(CODE).not.toMatch(/rehype/i);
    });

    it('passes remark-gfm and no rehype plugins to the renderer', () => {
        expect(CODE).toContain('remarkPlugins={[remarkGfm]}');
        expect(CODE).not.toContain('rehypePlugins');
    });

    it('escapes an HTML tag authored into an entry instead of mounting it', () => {
        renderList({
            data: [post(1, { entry: 'before <img src="x" onerror="alert(1)"> after' })],
        });

        const entry = document.querySelector('.post__entry');

        expect(entry.querySelector('img')).toBeNull();
        expect(entry.textContent).toContain('<img src="x" onerror="alert(1)">');
    });

    it('mounts no script element from an entry', () => {
        renderList({ data: [post(1, { entry: '<script>window.pwned = true;</script>' })] });

        expect(document.querySelector('.post__entry script')).toBeNull();
        expect(window.pwned).toBeUndefined();
    });

    it('leaves an inline event handler out of the DOM', () => {
        renderList({ data: [post(1, { entry: '<b onclick="alert(1)">bold</b>' })] });

        const entry = document.querySelector('.post__entry');

        expect(entry.querySelector('b')).toBeNull();

        for (const element of entry.querySelectorAll('*')) {
            expect(element.getAttribute('onclick')).toBeNull();
        }

        expect(entry.textContent).toContain('<b onclick="alert(1)">bold</b>');
    });
});

describe('the custom p / img / a renderers survive the collapse', () => {
    it('gives paragraphs the pre-line treatment the JSON entries are authored for', () => {
        renderList({ data: [post(1, { entry: 'line one\nline two' })] });

        const paragraph = document.querySelector('.post__entry p');

        expect(paragraph.style.whiteSpace).toBe('pre-line');
        expect(paragraph.style.marginBottom).toBe('1rem');
    });

    it('gives a markdown image the bootstrap treatment and lazy loading', () => {
        renderList({ data: [post(1, { entry: '![a wheel](images/nd/wheel.jpg)' })] });

        const image = document.querySelector('.post__entry img');

        expect(image.getAttribute('src')).toBe('images/nd/wheel.jpg');
        expect([...image.classList]).toEqual(['img-fluid', 'rounded']);
        expect(image.getAttribute('loading')).toBe('lazy');
    });

    /**
     * Miyoshi's renderer wrapped the image in a centring <div>. Markdown puts an
     * inline image inside a paragraph, so that produced a <div> inside a <p> —
     * invalid nesting the browser resolves by splitting the paragraph in two.
     * Centring is `.post__entry img`'s job now.
     */
    it('leaves a markdown image inside its paragraph rather than splitting it', () => {
        renderList({ data: [post(1, { entry: 'before ![a wheel](images/nd/wheel.jpg) after' })] });

        const entry = document.querySelector('.post__entry');

        expect(entry.querySelectorAll('p')).toHaveLength(1);
        expect(entry.querySelector('p > img')).not.toBeNull();
        expect(entry.querySelector('div')).toBeNull();
    });

    it('falls back to a generic alt when the markdown supplies none', () => {
        renderList({ data: [post(1, { entry: '![](images/nd/wheel.jpg)' })] });

        expect(document.querySelector('.post__entry img').getAttribute('alt')).toBe('blog image');
    });

    it('opens markdown links in a new tab without leaking the referrer', () => {
        renderList({ data: [post(1, { entry: '[the build thread](https://example.com/t/1)' })] });

        const link = document.querySelector('.post__entry a');

        expect(link.getAttribute('href')).toBe('https://example.com/t/1');
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noreferrer');
    });

    it('still runs remark-gfm, so gfm-only syntax resolves', () => {
        renderList({ data: [post(1, { entry: '~~dropped~~ that idea' })] });

        expect(document.querySelector('.post__entry del').textContent).toBe('dropped');
    });

    /**
     * react-markdown hands the mdast node to every component override; spreading
     * it onto a real element makes React log an unknown-prop warning, which the
     * per-car components did on every entry.
     */
    it('keeps the mdast node off the rendered elements', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        renderList({ data: [post(1, { entry: '![alt](images/nd/wheel.jpg)\n\n[link](/x)' })] });

        expect(consoleError).not.toHaveBeenCalled();
        expect(document.querySelector('.post__entry p').hasAttribute('node')).toBe(false);
    });
});

describe('each post carries its telemetry chips', () => {
    it('labels date, mileage and cost', () => {
        renderList({ data: [post(7)] });

        const chips = [...document.querySelectorAll('.post__specs .chip')].map(
            (chip) => chip.textContent
        );

        expect(chips).toEqual(['DATE 1/7/2025', 'MILEAGE 70,000 mi', 'COST $700']);
    });

    /** c8Blog.json entry 2 ships no `cost`; a bare "COST" label reads as a bug. */
    it('drops a chip the entry has no value for', () => {
        renderList({ data: [post(1, { cost: undefined })] });

        const chips = [...document.querySelectorAll('.post__specs .chip')].map(
            (chip) => chip.textContent
        );

        expect(chips).toEqual(['DATE 1/1/2025', 'MILEAGE 10,000 mi']);
    });

    it('flags the cost chip so the palette can accent it', () => {
        renderList({ data: [post(1)] });

        const cost = document.querySelectorAll('.post__specs .chip')[2];

        expect(cost.classList.contains('chip--cost')).toBe(true);
    });

    it('hangs the row off spec-row, the shared telemetry primitive', () => {
        renderList({ data: [post(1)] });

        expect(document.querySelector('.post__specs').classList.contains('spec-row')).toBe(true);
    });

    it('grades the post image through the editorial media layer', () => {
        renderList({ data: [post(1)] });

        const media = document.querySelector('.post__media');

        expect(media.classList.contains('media--editorial')).toBe(true);
        expect(media.querySelector('img').getAttribute('src')).toBe('images/nd/post-1.jpg');
    });

    /** Memory flags the pre-V2 alt ("this post's pic") as a a11y defect. */
    it('describes the post image rather than calling it "this post\'s pic"', () => {
        renderList({ data: [post(1)] });

        const alt = document.querySelector('.post__media img').getAttribute('alt');

        expect(alt).toContain('ND Build Log');
        expect(alt).toContain('1/1/2025');
    });
});

describe('the car-identity banner is optional and driven by the caller', () => {
    const banner = {
        image: 'images/nd/car-nd.jpg',
        imageAlt: 'ND MX-5 at dusk',
        eyebrow: '2019 Mazda · ND · Daily',
        title: 'Kasumi',
        chips: [
            { label: 'ODO', value: '19,420 mi' },
            { label: 'STATUS', value: 'Daily-able' },
        ],
    };

    it('renders nothing above the log when no banner is supplied', () => {
        renderList();

        expect(document.querySelector('.hero')).toBeNull();
    });

    it('names the car in the hero title', () => {
        renderList({ banner });

        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Kasumi');
    });

    it('grades the banner image and describes it', () => {
        renderList({ banner });

        const media = document.querySelector('.hero__media');

        expect(media.classList.contains('media--editorial')).toBe(true);
        expect(media.querySelector('img').getAttribute('alt')).toBe('ND MX-5 at dusk');
    });

    it('carries the eyebrow and the status chips', () => {
        renderList({ banner });

        expect(document.querySelector('.hero .eyebrow').textContent).toBe(
            '2019 Mazda · ND · Daily'
        );
        expect(
            [...document.querySelectorAll('.blog-hero__specs .chip')].map((c) => c.textContent)
        ).toEqual(['ODO 19,420 mi', 'STATUS Daily-able']);
    });

    it('tolerates a banner with no chips', () => {
        renderList({ banner: { ...banner, chips: undefined } });

        expect(document.querySelector('.blog-hero__specs')).toBeNull();
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Kasumi');
    });

    it('keeps the log heading separate from the car name', () => {
        renderList({ banner });

        expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('ND Build Log');
    });
});

describe('the component renders every real blog data file', () => {
    it.each([
        ['naBlog.json', naBlog],
        ['MsmBlog.json', msmBlog],
        ['ndBlog.json', ndBlog],
        ['c8Blog.json', c8Blog],
    ])('renders %s without a page of its own', (name, data) => {
        renderList({ data, title: name });

        expect(postEntries().length).toBe(Math.min(3, data.length));
        expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(name);
    });

    /**
     * Both the newest-first sort and the React key read `id`. A duplicate or a
     * non-numeric id silently breaks the render, so the data files are guarded
     * here rather than left to a runtime surprise.
     */
    it.each([
        ['naBlog.json', naBlog],
        ['MsmBlog.json', msmBlog],
        ['ndBlog.json', ndBlog],
        ['c8Blog.json', c8Blog],
    ])('%s carries unique numeric ids', (name, data) => {
        const ids = data.map((entry) => entry.id);

        for (const id of ids) {
            expect(Number.isFinite(id), `${name} has a non-numeric id: ${id}`).toBe(true);
        }

        expect(new Set(ids).size, `${name} has duplicate ids`).toBe(ids.length);
    });

    /**
     * `cost` is deliberately absent from this list: c8Blog.json entry 2 omits
     * it, and the telemetry row drops a missing field rather than printing a
     * bare label. The three below have no such fallback.
     */
    it.each([
        ['naBlog.json', naBlog],
        ['MsmBlog.json', msmBlog],
        ['ndBlog.json', ndBlog],
        ['c8Blog.json', c8Blog],
    ])('%s supplies the fields the surface cannot render without', (name, data) => {
        for (const entry of data) {
            for (const field of ['date', 'picture', 'entry']) {
                expect(entry[field], `${name} entry ${entry.id} is missing ${field}`).toBeDefined();
            }
        }
    });
});
