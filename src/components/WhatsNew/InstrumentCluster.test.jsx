/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the convention the rest of the suite
 * uses.
 *
 * Covers Task 00067: the telltale strip and the stat tiles. The cluster renders
 * against a fixture rather than against data/metrics.js -- the tiles are a
 * contract over a shape, and the real figures are tech-writer's to change
 * (Story 00063) without a test moving with them. That the page hands the cluster
 * the real module is asserted once, in index.test.jsx.
 *
 * jsdom performs no layout, so the ported-tile assertions read the compiled
 * stylesheet rather than measuring a rendered box -- the same trade
 * index.test.jsx and src/scss/styles.test.js make.
 */

import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';

import * as sass from 'sass';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import InstrumentCluster from './InstrumentCluster';

/**
 * Resolved from the Vitest root rather than import.meta.url: under jsdom
 * import.meta.url is a document-relative http URL, not a file URL.
 */
const ROOT = process.cwd();
const SCSS_DIR = resolve(ROOT, 'src/scss');
const NODE_MODULES = dirname(
    dirname(createRequire(resolve(ROOT, 'index.html')).resolve('bootstrap/package.json'))
);

const css = sass.compile(resolve(SCSS_DIR, 'styles.scss'), {
    loadPaths: [SCSS_DIR, NODE_MODULES],
    quietDeps: true,
    logger: sass.Logger.silent,
}).css;

const escapeForRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Reads one top-level rule's declarations; see the twin in index.test.jsx. */
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

/**
 * One telemetry row. Every field is overridable so a case can state only the
 * field it is about; `label` doubles as the React key, so cases that render
 * several rows vary it.
 */
const metric = (overrides = {}) => ({
    value: '90',
    unit: '+',
    label: 'Lighthouse',
    delta: 'up from 60',
    trend: 'up',
    note: 'mobile lab score',
    gauge: 90,
    target: true,
    ...overrides,
});

const renderCluster = (metrics) => render(<InstrumentCluster metrics={metrics} />).container;

afterEach(cleanup);

describe('the telltale strip', () => {
    it('carries the five readouts of the mockup', () => {
        const container = renderCluster([]);

        expect(container.querySelectorAll('.tele-strip > span')).toHaveLength(5);
    });

    it('lights the LIVE dot', () => {
        const container = renderCluster([]);

        expect(container.querySelector('.tele-strip .live')).not.toBeNull();
    });

    /**
     * The strip describes the deploy, not the figures, so it stands whether or
     * not there is a metric to render a tile from.
     */
    it('stands independently of the metrics', () => {
        const container = renderCluster([metric()]);

        expect(container.querySelector('.tele-strip')).not.toBeNull();
    });
});

describe('the tile grid renders one tile per metric', () => {
    it('emits a tile for each row', () => {
        const container = renderCluster([
            metric({ label: 'LCP' }),
            metric({ label: 'Lighthouse' }),
            metric({ label: 'Shipped' }),
        ]);

        expect(container.querySelectorAll('.tele-grid > .tele-tile')).toHaveLength(3);
    });

    /**
     * An empty cluster is a valid render: the perf pass may not have produced a
     * number yet, and an empty grid must stay empty rather than paint a
     * placeholder tile a visitor would read as a real measurement.
     */
    it('renders an empty grid from an empty array', () => {
        const container = renderCluster([]);

        const grid = container.querySelector('.tele-grid');

        expect(grid).not.toBeNull();
        expect(grid.childElementCount).toBe(0);
    });

    it('reads the whole row onto the tile', () => {
        const container = renderCluster([
            metric({
                value: '2.5',
                unit: 's',
                label: 'LCP',
                delta: 'down from 4s',
                note: 'largest contentful paint',
            }),
        ]);

        const tile = container.querySelector('.tele-tile');

        expect(tile.querySelector('.tele-tile__head > span').textContent).toBe('LCP');
        expect(tile.querySelector('.tele-tile__value').textContent).toBe('2.5s');
        expect(tile.querySelector('.tele-tile__unit').textContent).toBe('s');
        expect(tile.querySelector('.tele-tile__delta').textContent).toBe('down from 4s');
        expect(tile.querySelector('.tele-tile__note').textContent).toBe(
            'largest contentful paint'
        );
    });
});

/**
 * The badge is the page's honesty mechanism (AC-015): a goal must never read as
 * a measurement, so `target` drives both the word and the bezel colour.
 */
describe('the badge states whether the figure is a goal or a fact', () => {
    it('badges an aspirational figure TARGET', () => {
        const container = renderCluster([metric({ target: true })]);

        const badge = container.querySelector('.tele-badge');

        expect(badge.textContent).toBe('TARGET');
        expect(badge.className).toContain('tele-badge--target');
        expect(badge.className).not.toContain('tele-badge--live');
    });

    it('badges a measured figure SHIPPED', () => {
        const container = renderCluster([metric({ target: false })]);

        const badge = container.querySelector('.tele-badge');

        expect(badge.textContent).toBe('SHIPPED');
        expect(badge.className).toContain('tele-badge--live');
        expect(badge.className).not.toContain('tele-badge--target');
    });

    it('badges each tile from its own row', () => {
        const container = renderCluster([
            metric({ label: 'LCP', target: true }),
            metric({ label: 'Shipped', target: false }),
        ]);

        expect(
            [...container.querySelectorAll('.tele-badge')].map((badge) => badge.textContent)
        ).toEqual(['TARGET', 'SHIPPED']);
    });
});

describe('the delta takes its direction from the trend', () => {
    it.each(['up', 'down', 'flat'])('marks a %s row', (trend) => {
        const container = renderCluster([metric({ trend })]);

        expect(container.querySelector('.tele-tile__delta').className).toBe(
            `tele-tile__delta is-${trend}`
        );
    });

    /** Only a moved number takes the accent; a flat one keeps the muted default. */
    it('accents a moved figure and leaves a flat one muted', () => {
        expect(topLevelDeclarationsOf('.tele-tile__delta').get('color')).toBe('var(--text-mid)');
        expect(css).toMatch(/\.tele-tile__delta\.is-down,\s*\.tele-tile__delta\.is-up \{/);
    });
});

describe('the meter fills to the gauge', () => {
    it('sets the fill width from the row', () => {
        const container = renderCluster([metric({ gauge: 62 })]);

        expect(container.querySelector('.tele-tile__meter i').style.width).toBe('62%');
    });

    it.each([0, 100])('carries the %i%% end of the range', (gauge) => {
        const container = renderCluster([metric({ gauge })]);

        expect(container.querySelector('.tele-tile__meter i').style.width).toBe(`${gauge}%`);
    });

    it('fills each tile from its own row', () => {
        const container = renderCluster([
            metric({ label: 'LCP', gauge: 62 }),
            metric({ label: 'Shipped', gauge: 100 }),
        ]);

        expect(
            [...container.querySelectorAll('.tele-tile__meter i')].map((fill) => fill.style.width)
        ).toEqual(['62%', '100%']);
    });

    /** The inline width is only a fill because the track clips it. */
    it('clips the fill to the track', () => {
        expect(topLevelDeclarationsOf('.tele-tile__meter').get('overflow')).toBe('hidden');
    });
});

describe('the cluster is ported from the mockup (assets/app.css:396-480)', () => {
    it('lays the tiles out four across', () => {
        expect(topLevelDeclarationsOf('.tele-grid').get('grid-template-columns')).toBe(
            'repeat(4, 1fr)'
        );
    });

    it.each([
        ['(max-width: 900px)', 'repeat(2, 1fr)'],
        ['(max-width: 480px)', '1fr'],
    ])('reflows the grid at %s', (query, columns) => {
        const block = css.match(
            new RegExp(`@media ${escapeForRegExp(query)} \\{\\s*\\.tele-grid \\{([^{}]*)\\}`)
        );

        expect(block, `no .tele-grid rule emitted under ${query}`).not.toBeNull();
        expect(block[1]).toContain(`grid-template-columns: ${columns}`);
    });

    it('gives the tile its bezel notch', () => {
        const notch = topLevelDeclarationsOf('.tele-tile::before');

        expect(notch.get('background')).toBe('var(--goji-red)');
        expect(notch.get('position')).toBe('absolute');
    });

    it('separates the two badge bezels by colour', () => {
        expect(topLevelDeclarationsOf('.tele-badge--target').get('color')).toBe(
            'var(--goji-red-bright)'
        );
        expect(topLevelDeclarationsOf('.tele-badge--live').get('color')).toBe('var(--text-hi)');
    });

    /** The caption the page shell renders; Task 00064 left it for this port. */
    it('styles the honesty caption', () => {
        const caption = topLevelDeclarationsOf('.tele-caption');

        expect(caption.get('font-family')).toBe('var(--font-mono)');
        expect(caption.get('max-width')).toBe('78ch');
        expect(topLevelDeclarationsOf('.tele-caption b').get('color')).toBe(
            'var(--goji-red-bright)'
        );
    });
});

/**
 * The mockup pulses the LIVE dot unconditionally and forever. The dot is lit
 * either way, so the animation is held behind the motion query rather than
 * shipped as the mockup wrote it -- the deviation is only ever visible from the
 * stylesheet, so it is asserted here.
 */
describe('the LIVE pulse respects a reduced-motion preference', () => {
    it('leaves the resting dot unanimated', () => {
        expect(topLevelDeclarationsOf('.tele-strip .live').has('animation')).toBe(false);
    });

    it('starts the pulse only under no-preference', () => {
        const guarded = css.match(
            /@media \(prefers-reduced-motion: no-preference\) \{([^]*?)\n\}/g
        );

        expect(guarded, 'no reduced-motion guard emitted').not.toBeNull();
        expect(guarded.join('')).toContain('animation: telePulse');
        expect(css.match(/animation: telePulse/g)).toHaveLength(1);
    });
});
