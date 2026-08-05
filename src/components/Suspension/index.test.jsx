/**
 * @vitest-environment jsdom
 *
 * Covers Task 00037: the suspension hub is ported onto the V2 language, the
 * vestigial empty Accordion.Item is gone, and none of the reference content
 * moved.
 *
 * jsdom performs no layout, so the chrome assertions read the compiled
 * stylesheet rather than measuring a rendered box — the same trade
 * Footer/index.test.jsx and src/scss/styles.test.js make.
 */

import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';

import * as sass from 'sass';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import Suspension from './index';

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

const PANELS = [
    'Springs',
    'Bumpstops',
    'Compression Damping',
    'Rebound Damping',
    'Combined Damping',
    'Critical Damping',
    'Swaybars',
];

const GROUPS = ['Springs', 'Bumpstops', 'Dampers', 'Sway-bars'];

afterEach(cleanup);

describe('the hub exposes one disclosure panel per sub-component', () => {
    it('heads the page once, at level 1', () => {
        render(<Suspension />);

        expect(screen.getByRole('heading', { level: 1, name: 'Suspension Tuning' })).toBeDefined();
    });

    it('labels the four groups', () => {
        render(<Suspension />);

        expect(
            screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
        ).toEqual(GROUPS);
    });

    it.each(PANELS)('offers a %s panel', (name) => {
        render(<Suspension />);

        expect(screen.getByRole('button', { name })).toBeDefined();
    });

    it('renders exactly seven panels, one per sub-component', () => {
        const { container } = render(<Suspension />);

        expect(container.querySelectorAll('.accordion-item')).toHaveLength(PANELS.length);
    });
});

/**
 * The pre-V2 markup numbered eight items 0-7 as if one eventKey sequence ran
 * across all four independent <Accordion> roots. eventKey is scoped per root, so
 * dropping a damper panel from that sequence left an empty
 * <Accordion.Item eventKey="5"> behind rather than forcing a renumber — and
 * react-bootstrap paints an item with neither header nor body as a bare
 * bordered strip in the middle of the damper list.
 */
describe('no item is left without a header or a body', () => {
    it('gives every item a header button', () => {
        const { container } = render(<Suspension />);

        for (const item of container.querySelectorAll('.accordion-item')) {
            expect(item.querySelector('.accordion-button'), item.outerHTML).not.toBeNull();
        }
    });

    it('gives every item a body', () => {
        const { container } = render(<Suspension />);

        for (const item of container.querySelectorAll('.accordion-item')) {
            expect(item.querySelector('.accordion-body'), item.outerHTML).not.toBeNull();
        }
    });

    it('leaves the damper group four panels, with nothing between them', () => {
        const { container } = render(<Suspension />);

        const dampers = [...container.querySelectorAll('.suspension__group')].find(
            (group) => group.querySelector('.suspension__group-title').textContent === 'Dampers'
        );

        expect(
            [...dampers.querySelectorAll('.accordion-button')].map((button) => button.textContent)
        ).toEqual([
            'Compression Damping',
            'Rebound Damping',
            'Combined Damping',
            'Critical Damping',
        ]);
    });

    /**
     * Four roots, holding 1/1/4/1 panels. The global 0-7 numbering is what made
     * the stub look cheaper than a renumber; per-root keys remove that pressure.
     */
    it('splits the panels across one accordion root per group', () => {
        const { container } = render(<Suspension />);

        expect(
            [...container.querySelectorAll('.accordion')].map(
                (root) => root.querySelectorAll('.accordion-item').length
            )
        ).toEqual([1, 1, 4, 1]);
    });
});

describe('panels expand and collapse', () => {
    it('starts every panel collapsed', () => {
        render(<Suspension />);

        for (const name of PANELS) {
            expect(screen.getByRole('button', { name }).getAttribute('aria-expanded')).toBe('false');
        }
    });

    it('expands the panel that is clicked', () => {
        render(<Suspension />);

        fireEvent.click(screen.getByRole('button', { name: 'Springs' }));

        expect(screen.getByRole('button', { name: 'Springs' }).getAttribute('aria-expanded')).toBe(
            'true'
        );
    });

    it('collapses the panel on a second click', () => {
        render(<Suspension />);

        const springs = screen.getByRole('button', { name: 'Springs' });

        fireEvent.click(springs);
        fireEvent.click(springs);

        expect(springs.getAttribute('aria-expanded')).toBe('false');
    });

    /**
     * Each group is its own <Accordion> root, which is what lets a reader hold
     * one damper panel open while comparing it against the springs panel. A
     * single root would have closed the first.
     */
    it('keeps groups independent of one another', () => {
        render(<Suspension />);

        fireEvent.click(screen.getByRole('button', { name: 'Springs' }));
        fireEvent.click(screen.getByRole('button', { name: 'Compression Damping' }));

        expect(screen.getByRole('button', { name: 'Springs' }).getAttribute('aria-expanded')).toBe(
            'true'
        );
    });

    /** Within a root, Bootstrap's default is single-open; that is unchanged. */
    it('closes the open damper when a sibling damper opens', () => {
        render(<Suspension />);

        fireEvent.click(screen.getByRole('button', { name: 'Compression Damping' }));
        fireEvent.click(screen.getByRole('button', { name: 'Rebound Damping' }));

        expect(
            screen.getByRole('button', { name: 'Compression Damping' }).getAttribute('aria-expanded')
        ).toBe('false');
    });
});

/**
 * The panels are reference material — spring-rate formulae, damping ratios,
 * swaybar diameters. The re-skin is allowed to move the chrome around them and
 * nothing else, so these read the values straight out of the rendered bodies.
 */
describe('the technical content survives the re-skin', () => {
    it.each([
        ['Springs', /K.*=.*K.*×.*MR/],
        ['Springs', /2\.0 – 2\.5 Hz/],
        ['Bumpstops', /progressive/i],
        ['Compression Damping', /0\.08 m\/s \(3 in\/s\)/],
        ['Rebound Damping', /porpoise/],
        ['Combined Damping', /packing/],
        ['Critical Damping', /ζ ≈ 40–60 % critical/],
        ['Swaybars', /22\.9 mm hollow/],
    ])('keeps %s reading %s', (panel, pattern) => {
        const { container } = render(<Suspension />);

        const body = [...container.querySelectorAll('.accordion-item')]
            .find((item) => item.querySelector('.accordion-button').textContent === panel)
            .querySelector('.accordion-body');

        expect(body.textContent).toMatch(pattern);
    });

    it('keeps every row of the swaybar generation table', () => {
        const { container } = render(<Suspension />);

        const table = container.querySelector('.table-bordered');

        expect(table.querySelectorAll('tbody tr')).toHaveLength(3);
        expect(within(table).getByText('NA/NB')).toBeDefined();
        expect(within(table).getByText('NC')).toBeDefined();
        expect(within(table).getByText('ND')).toBeDefined();
    });

    it('keeps every row of the low-speed / high-speed damping table', () => {
        const { container } = render(<Suspension />);

        const table = [...container.querySelectorAll('table')].find(
            (candidate) => !candidate.classList.contains('table-bordered')
        );

        expect(table.querySelectorAll('tbody tr')).toHaveLength(6);
    });

    /** Six columns cannot fit a 360px viewport; the wrapper scrolls in place. */
    it('wraps both spec tables so neither pushes the page into overflow', () => {
        const { container } = render(<Suspension />);

        const tables = container.querySelectorAll('table');

        expect(tables).toHaveLength(2);

        for (const table of tables) {
            expect(table.closest('.table-responsive'), table.outerHTML).not.toBeNull();
        }
    });
});

describe('the pre-V2 chrome is gone', () => {
    it.each(['container-fluid', 'row', 'col-lg-12', 'text-center'])(
        'drops the %s Bootstrap utility',
        (utility) => {
            const { container } = render(<Suspension />);

            expect(container.querySelector(`.${utility}`)).toBeNull();
        }
    );

    it.each(['mb-5', 'text-start'])('drops the %s utility from the panel bodies', (utility) => {
        const { container } = render(<Suspension />);

        expect(container.querySelector(`.${utility}`)).toBeNull();
    });

    it('opens the page on the shared section head', () => {
        const { container } = render(<Suspension />);

        const head = container.querySelector('.suspension > .section-head');

        expect(head).not.toBeNull();
        expect(head.querySelector('.eyebrow')).not.toBeNull();
        expect(head.querySelector('.sub')).not.toBeNull();
    });
});

describe('the accordion chrome is driven by the token layer', () => {
    it('re-points the Bootstrap accordion slots at the tokens', () => {
        const accordion = topLevelDeclarationsOf('.accordion.spec-accordion');

        expect(accordion.get('--bs-accordion-bg')).toBe('var(--color-reading)');
        expect(accordion.get('--bs-accordion-btn-bg')).toBe('var(--ink-800)');
        expect(accordion.get('--bs-accordion-color')).toBe('var(--color-text)');
        expect(accordion.get('--bs-accordion-btn-color')).toBe('var(--color-heading)');
        expect(accordion.get('--bs-accordion-border-color')).toBe('var(--color-border)');
        expect(accordion.get('--bs-accordion-btn-focus-box-shadow')).toBe('var(--glow-red)');
    });

    /**
     * Bootstrap ships both chevrons as data URIs, which cannot reference a
     * custom property, so the overrides are literals and drift silently if the
     * ramp moves. Asserted against the declared token values for that reason.
     */
    it('paints the chevron muted when closed and brand red when open', () => {
        const accordion = topLevelDeclarationsOf('.accordion.spec-accordion');

        expect(accordion.get('--bs-accordion-btn-icon')).toContain("fill='%239C978D'");
        expect(accordion.get('--bs-accordion-btn-active-icon')).toContain("fill='%23E10600'");
        expect(css).toContain('--text-lo: #9C978D');
        expect(css).toContain('--goji-red: #E10600');
    });

    it('sets the headers in the display face', () => {
        const button = topLevelDeclarationsOf('.spec-accordion .accordion-button');

        expect(button.get('font-family')).toBe('var(--font-display)');
        expect(button.get('text-transform')).toBe('uppercase');
    });

    it('rules the open header in brand red', () => {
        expect(
            topLevelDeclarationsOf('.spec-accordion .accordion-button:not(.collapsed)').get(
                'box-shadow'
            )
        ).toBe('inset 0 -3px 0 var(--goji-red)');
    });

    it('gives the bodies the long-form reading measure', () => {
        const body = topLevelDeclarationsOf('.spec-accordion .accordion-body');

        expect(body.get('font-size')).toBe('var(--fs-read)');
        expect(body.get('line-height')).toBe('var(--lh-read)');
    });

    /**
     * --bs-table-color otherwise resolves to Bootstrap's light-mode emphasis
     * colour, which is near-black on the charcoal panel.
     */
    it('repaints the spec tables onto the charcoal panel', () => {
        const table = topLevelDeclarationsOf('.spec-accordion .table');

        expect(table.get('--bs-table-color')).toBe('var(--color-text)');
        expect(table.get('--bs-table-bg')).toBe('transparent');
        expect(table.get('--bs-table-border-color')).toBe('var(--color-border)');
    });

    it('holds the page to the container measure', () => {
        const shell = topLevelDeclarationsOf('.suspension');

        expect(shell.get('max-width')).toBe('var(--container-max)');
        expect(shell.get('margin-inline')).toBe('auto');
    });

    it('tightens the gutters below the tablet breakpoint', () => {
        expect(css).toMatch(/@media \(max-width: 768px\)/);

        // Multiple Feature B surfaces each carry their own 768px block, so the
        // LAST one in the file is not necessarily this one -- search every
        // block for the one that mentions .suspension (not .suspension__*)
        // instead of assuming position.
        const collapsed = css
            .split('@media (max-width: 768px)')
            .slice(1)
            .find((segment) => /\.suspension(?!__)/.test(segment));

        expect(collapsed, 'no 768px block mentions .suspension').toBeDefined();
        expect(collapsed).toContain('padding-inline: var(--space-4)');
    });
});
