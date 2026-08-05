/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers Task 00035: the four per-car blog routes render through the shared
 * <BlogList>. One file rather than four co-located ones, because after the
 * collapse the four modules are the same module with four configurations —
 * every assertion below is the same assertion four times, and a table states
 * that directly.
 *
 * <BlogList>'s own behaviour (pagination, markdown safety, telemetry chips) is
 * covered in common/BlogList.test.jsx. What is asserted here is the wiring:
 * the right data on the right route, the heading content AC-016 requires kept,
 * and the single <main> the shell composition depends on.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import NABlog from './Miyoshi';
import MsmBlog from './Kiryu';
import NDBlog from './Kasumi';
import C8Blog from './Panda';

import naBlog from '../../assets/Data/naBlog.json';
import msmBlog from '../../assets/Data/MsmBlog.json';
import ndBlog from '../../assets/Data/ndBlog.json';
import c8Blog from '../../assets/Data/c8Blog.json';

import carsData from '../Garage/Cars.json';

const carNamed = (name) => carsData.cars.find((car) => car.name === name);

/**
 * Resolved from the Vitest root rather than import.meta.url: under jsdom
 * import.meta.url is a document-relative http URL, not a file URL.
 *
 * Comments are stripped before the source guards read it: each module documents
 * why it may not wrap a <main>, and matching that prose would make the guard
 * fire on its own rationale.
 */
const sourceOf = (folder) =>
    readFileSync(resolve(process.cwd(), `src/components/blog/${folder}/index.jsx`), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

const ROUTES = [
    ['Miyoshi', NABlog, naBlog, 'NA6 MX-5 Build Log'],
    ['Kiryu', MsmBlog, msmBlog, 'NB Mazdaspeed Build Log'],
    ['Kasumi', NDBlog, ndBlog, 'ND GTS RF Build Log'],
    ['Panda', C8Blog, c8Blog, 'C8 Corvette Z51 Build Log'],
];

const newestOf = (data) => [...data].sort((a, b) => b.id - a.id)[0];

const bannerChips = () =>
    [...document.querySelectorAll('.blog-hero__specs .chip')].map((chip) => chip.textContent);

afterEach(cleanup);

describe.each(ROUTES)('the %s route renders through the shared BlogList', (
    name,
    Route,
    data,
    heading
) => {
    it('mounts exactly one main landmark, the one BlogList owns', () => {
        render(<Route />);

        expect(screen.getAllByRole('main')).toHaveLength(1);
    });

    it('uses the mockup heading as the log title', () => {
        render(<Route />);

        expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(heading);
    });

    it('names the car once, in the banner', () => {
        render(<Route />);

        const headings = screen.getAllByRole('heading', { level: 1 });

        expect(headings).toHaveLength(1);
        expect(headings[0].textContent).toBe(name);
    });

    it('feeds the log its own data file', () => {
        render(<Route />);

        expect(document.querySelectorAll('article.post')).toHaveLength(Math.min(3, data.length));
    });

    it('opens on the newest entry', () => {
        render(<Route />);

        const first = document.querySelector('article.post');
        const chips = [...first.querySelectorAll('.post__specs .chip')].map(
            (chip) => chip.textContent
        );

        expect(chips).toContain(`DATE ${newestOf(data).date}`);
    });

    it('pages only when the log outruns a single page', () => {
        render(<Route />);

        expect(Boolean(document.querySelector('.pager'))).toBe(data.length > 3);
    });

    it('carries no leftover react-bootstrap scaffold', () => {
        expect(sourceOf(name)).not.toContain('react-bootstrap');
    });

    /** The regression this Task's brief singles out: a second competing landmark. */
    it('wraps BlogList in no main of its own', () => {
        expect(sourceOf(name)).not.toContain('<main');
    });
});

describe.each(ROUTES)('the %s banner reads the garage row for that car', (name, Route, data) => {
    const car = carNamed(name);

    it('resolves a portrait rather than painting an empty banner', () => {
        render(<Route />);

        expect(document.querySelector('.hero__media img').getAttribute('src')).toBeTruthy();
    });

    it('describes the banner image by the car it shows', () => {
        render(<Route />);

        const alt = document.querySelector('.hero__media img').getAttribute('alt');

        expect(alt).toContain(String(car.year));
        expect(alt).toContain(car.model);
        expect(alt).toContain(car.name);
    });

    it('states the year, make and model in the eyebrow', () => {
        render(<Route />);

        expect(document.querySelector('.hero .eyebrow').textContent).toBe(
            `${car.year} ${car.make} · ${car.model}`
        );
    });

    it('reads the odometer off the newest entry rather than a written-in figure', () => {
        render(<Route />);

        expect(bannerChips()).toContain(`ODO ${newestOf(data).mileage} mi`);
    });

    it('carries the status the garage card carries', () => {
        render(<Route />);

        expect(bannerChips()).toContain(`STATUS ${car.tag}`);
    });
});

describe('every blog route has a car to read its identity from', () => {
    it.each(ROUTES.map(([name]) => name))('finds %s in Cars.json', (name) => {
        expect(carNamed(name)).toBeDefined();
    });

    it('leaves the retired car without a build-log route', () => {
        const routed = new Set(ROUTES.map(([name]) => name));

        expect([...routed]).not.toContain('Ryoko');
    });
});
