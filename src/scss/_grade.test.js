/**
 * @vitest-environment jsdom
 *
 * Grade-layer parity + probe suite for src/scss/_grade.scss.
 *
 * _grade.scss is a Tier-1 verbatim port of the approved mockup contract at
 * .claude/strap/mockups/spec-00002/assets/app.css (Spec 00002, Part P1). The
 * mockup is the source of truth, so parity is asserted by diffing the compiled
 * partial against the mockup's EDITORIAL IMAGE TREATMENT section rather than
 * by restating values.
 *
 * The probe cases resolve which rules a real
 * `<figure class="media--editorial"><img></figure>` selects. jsdom does not
 * resolve var() indirection or pseudo-element styles through getComputedStyle,
 * so selector matching against the compiled rule table is the probe mechanism.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as sass from 'sass';
import { beforeEach, describe, expect, it } from 'vitest';

const scssDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scssDir, '../..');
const mockupApp = resolve(
    repoRoot,
    '.claude/strap/mockups/spec-00002/assets/app.css'
);

const SECTION_START = '/* ---------- EDITORIAL IMAGE TREATMENT';
const SECTION_END = '/* ---------- HERO ----------';

const GRADE_VARS = [
    '--grade-brightness',
    '--grade-contrast',
    '--grade-saturate',
    '--grade-tone-top',
    '--grade-tone-bot',
    '--grade-vignette',
    '--grade-vig-clear',
];

function stripComments(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function parseDeclarations(body) {
    const declarations = new Map();

    for (const raw of body.split(';')) {
        const separator = raw.indexOf(':');

        if (separator === -1) {
            continue;
        }

        const name = raw.slice(0, separator).trim();

        if (!name) {
            continue;
        }

        declarations.set(
            name,
            raw.slice(separator + 1).trim().replace(/\s+/g, ' ')
        );
    }

    return declarations;
}

/**
 * Flattens a stylesheet into selector -> declarations. At-rule preludes are
 * prefixed onto their inner selectors so a media-query-scoped rule cannot be
 * confused with a top-level one of the same selector. Statement at-rules
 * (Sass prepends `@charset`) carry no block, so anything up to the last `;`
 * before a selector is discarded.
 */
function parseRules(css, prefix = '') {
    const rules = new Map();
    const source = stripComments(css);
    let cursor = 0;

    while (cursor < source.length) {
        const open = source.indexOf('{', cursor);

        if (open === -1) {
            break;
        }

        const preceding = source.slice(cursor, open);
        const prelude = preceding
            .slice(preceding.lastIndexOf(';') + 1)
            .trim()
            .replace(/\s+/g, ' ');
        let depth = 1;
        let scan = open + 1;

        while (scan < source.length && depth > 0) {
            if (source[scan] === '{') {
                depth += 1;
            } else if (source[scan] === '}') {
                depth -= 1;
            }

            scan += 1;
        }

        const body = source.slice(open + 1, scan - 1);

        if (prelude.startsWith('@')) {
            for (const [key, value] of parseRules(body, `${prefix}${prelude} `)) {
                rules.set(key, value);
            }
        } else {
            rules.set(prefix + prelude, parseDeclarations(body));
        }

        cursor = scan;
    }

    return rules;
}

function splitPseudoElement(selector) {
    const match = selector.match(/^(.*?)(::[\w-]+)$/);

    return match
        ? { host: match[1], pseudo: match[2] }
        : { host: selector, pseudo: null };
}

/**
 * Merges every top-level rule the element selects, in source order, so the
 * probe reads what the browser would actually apply.
 */
function appliedTo(rules, element, pseudo = null) {
    const merged = new Map();

    for (const [selector, declarations] of rules) {
        if (selector.startsWith('@')) {
            continue;
        }

        const parsed = splitPseudoElement(selector);

        if (parsed.pseudo !== pseudo || !element.matches(parsed.host)) {
            continue;
        }

        for (const [name, value] of declarations) {
            merged.set(name, value);
        }
    }

    return merged;
}

function alphaOf(rgba) {
    const match = rgba.match(/rgba?\([^)]*?,\s*([\d.]+)\s*\)/);

    expect(match, `not an rgba() value: ${rgba}`).not.toBeNull();

    return Number.parseFloat(match[1]);
}

const compiled = sass.compileString('@use "grade";', { loadPaths: [scssDir] });
const ported = parseRules(compiled.css);

const appCss = readFileSync(mockupApp, 'utf8');
const sectionStart = appCss.indexOf(SECTION_START);
const sectionEnd = appCss.indexOf(SECTION_END);
const contract = parseRules(appCss.slice(sectionStart, sectionEnd));

const root = ported.get(':root');
const hero = ported.get('.media--editorial--hero');
const soft = ported.get('.media--editorial--soft');

let figure;
let image;
let heroFigure;
let softFigure;

beforeEach(() => {
    document.body.innerHTML = [
        '<figure class="media--editorial">',
        '<img src="/images/na/night1.jpg" alt="">',
        '</figure>',
        '<figure class="media--editorial media--editorial--hero">',
        '<img src="/images/na/night1.jpg" alt="">',
        '</figure>',
        '<figure class="media--editorial media--editorial--soft">',
        '<img src="/images/na/night1.jpg" alt="">',
        '</figure>',
    ].join('');

    [figure, heroFigure, softFigure] = document.querySelectorAll('figure');
    image = figure.querySelector('img');
});

describe('_grade.scss compiles', () => {
    it('emits the grade layer without a Sass dependency on tokens', () => {
        expect(compiled.css).toContain('.media--editorial');
        expect(compiled.css).not.toContain('--goji-red');
    });
});

describe('_grade.scss matches the mockup contract', () => {
    it('locates the EDITORIAL IMAGE TREATMENT section in the mockup', () => {
        expect(sectionStart).toBeGreaterThan(-1);
        expect(sectionEnd).toBeGreaterThan(sectionStart);
    });

    it('declares exactly the contract selectors', () => {
        expect([...ported.keys()].sort()).toEqual([...contract.keys()].sort());
    });

    it.each([...contract.keys()])('%s declarations match', (selector) => {
        expect([...ported.get(selector).entries()]).toEqual([
            ...contract.get(selector).entries(),
        ]);
    });
});

describe('probe: <figure class="media--editorial"><img></figure>', () => {
    it('isolates the container so the multiply blend cannot leak', () => {
        const applied = appliedTo(ported, figure);

        expect(applied.get('position')).toBe('relative');
        expect(applied.get('isolation')).toBe('isolate');
    });

    it('filters the image on brightness, contrast and saturation', () => {
        const applied = appliedTo(ported, image);

        expect(applied.get('filter')).toBe(
            'brightness(var(--grade-brightness))'
            + ' contrast(var(--grade-contrast))'
            + ' saturate(var(--grade-saturate))'
        );
    });

    it('paints a multiply tone + vignette overlay over the whole box', () => {
        const overlay = appliedTo(ported, figure, '::after');

        expect(overlay.get('content')).toBe('""');
        expect(overlay.get('position')).toBe('absolute');
        expect(overlay.get('inset')).toBe('0');
        expect(overlay.get('pointer-events')).toBe('none');
        expect(overlay.get('mix-blend-mode')).toBe('multiply');
        expect(overlay.get('background')).toContain('linear-gradient(180deg');
        expect(overlay.get('background')).toContain('radial-gradient(135% 135%');
    });

    it('uses ::after so child content still stacks above the overlay', () => {
        expect([...ported.keys()].some((selector) => selector.includes('::before')))
            .toBe(false);
        expect(ported.has('.media--editorial::after')).toBe(true);
    });

    it('keys every filter and overlay input off a :root grade var', () => {
        expect([...root.keys()]).toEqual(GRADE_VARS);
    });
});

describe('grade modifiers override the base vars', () => {
    it('applies the base rules alongside the modifier', () => {
        expect(appliedTo(ported, heroFigure).get('isolation')).toBe('isolate');
        expect(appliedTo(ported, softFigure).get('isolation')).toBe('isolate');
    });

    it.each([
        ['.media--editorial--hero', hero],
        ['.media--editorial--soft', soft],
    ])('%s only overrides declared :root grade vars', (_selector, modifier) => {
        for (const name of modifier.keys()) {
            expect(GRADE_VARS).toContain(name);
        }
    });

    it('grades --hero heavier than the base', () => {
        expect(Number.parseFloat(hero.get('--grade-brightness')))
            .toBeLessThan(Number.parseFloat(root.get('--grade-brightness')));
        expect(Number.parseFloat(hero.get('--grade-contrast')))
            .toBeGreaterThan(Number.parseFloat(root.get('--grade-contrast')));
        expect(Number.parseFloat(hero.get('--grade-saturate')))
            .toBeLessThan(Number.parseFloat(root.get('--grade-saturate')));
        expect(Number.parseFloat(hero.get('--grade-vig-clear')))
            .toBeLessThan(Number.parseFloat(root.get('--grade-vig-clear')));
        expect(alphaOf(hero.get('--grade-vignette')))
            .toBeGreaterThan(alphaOf(root.get('--grade-vignette')));
    });

    it('grades --soft lighter than the base to preserve detail', () => {
        expect(Number.parseFloat(soft.get('--grade-brightness')))
            .toBeGreaterThan(Number.parseFloat(root.get('--grade-brightness')));
        expect(Number.parseFloat(soft.get('--grade-contrast')))
            .toBeLessThan(Number.parseFloat(root.get('--grade-contrast')));
        expect(Number.parseFloat(soft.get('--grade-saturate')))
            .toBeGreaterThan(Number.parseFloat(root.get('--grade-saturate')));
        expect(Number.parseFloat(soft.get('--grade-vig-clear')))
            .toBeGreaterThan(Number.parseFloat(root.get('--grade-vig-clear')));
        expect(alphaOf(soft.get('--grade-vignette')))
            .toBeLessThan(alphaOf(root.get('--grade-vignette')));
    });

    it('keeps hue restrained so cars stay recognizably true-color', () => {
        for (const saturate of [root, hero, soft].map(
            (scope) => Number.parseFloat(scope.get('--grade-saturate'))
        )) {
            expect(saturate).toBeGreaterThanOrEqual(0.85);
        }
    });
});

describe('reduced-motion guard', () => {
    const guarded = '@media (prefers-reduced-motion: no-preference)'
        + ' .media--editorial > img';

    it('scopes the filter transition to no-preference only', () => {
        expect(ported.has(guarded)).toBe(true);
        expect(ported.get('.media--editorial > img').has('transition')).toBe(false);
    });

    it('consumes the motion tokens instead of hardcoding timing', () => {
        const transition = ported.get(guarded).get('transition');

        expect(transition).toBe('filter var(--dur) var(--ease-out)');
        expect(transition).not.toMatch(/\d+m?s|cubic-bezier/);
    });
});
