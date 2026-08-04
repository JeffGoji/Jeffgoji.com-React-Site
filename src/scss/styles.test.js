/**
 * Assembly probe for src/scss/styles.scss.
 *
 * The sibling partials each prove their own contract; this suite proves the
 * entry point assembles them in an order where those contracts survive. It
 * compiles the real file and asserts against generated Bootstrap output rather
 * than against the presence of @import lines, because the failure mode this
 * Task exists to fix -- Bootstrap imported before the palette (Spec 00002 Part
 * P5) -- is invisible in the source and only shows up in the compiled CSS.
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as sass from 'sass';
import { describe, expect, it } from 'vitest';

const scssDir = dirname(fileURLToPath(import.meta.url));
const entry = resolve(scssDir, 'styles.scss');
const nodeModules = dirname(
    dirname(createRequire(import.meta.url).resolve('bootstrap/package.json'))
);

const source = readFileSync(entry, 'utf8');
const css = sass.compile(entry, {
    loadPaths: [scssDir, nodeModules],
    quietDeps: true,
    logger: sass.Logger.silent,
}).css;

/** Strips comments so declaration splitting cannot trip over them. */
const stripComments = (input) =>
    input.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/**
 * Merges the declarations of every rule whose selector list contains
 * `selector` into a name -> value map. Bootstrap emits :root twice, pairing it
 * with [data-bs-theme=light], so matching one literal rule is not enough.
 */
function declarationsOf(selector) {
    const declarations = new Map();

    for (const [, selectors, body] of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const list = selectors
            .split(';')
            .pop()
            .split(',')
            .map((entry_) => entry_.trim());

        if (!list.includes(selector)) {
            continue;
        }

        for (const declaration of body.split(';')) {
            const [name, ...rest] = declaration.split(':');

            if (name.trim()) {
                declarations.set(name.trim(), rest.join(':').trim().replace(/\s+/g, ' '));
            }
        }
    }

    expect(declarations.size, `no ${selector} declarations emitted`).toBeGreaterThan(0);

    return declarations;
}

const root = declarationsOf(':root');

/**
 * Sass's expanded output preserves CSS block comments, and the partials' header
 * blocks discuss in prose the very things some assertions below forbid. Match
 * against emitted CSS only.
 */
const emitted = css.replace(/\/\*[\s\S]*?\*\//g, '');

const BRAND_RED = '#E10600';

describe('styles.scss compiles through the Vite SCSS pipeline', () => {
    it('produces CSS', () => {
        expect(css.length).toBeGreaterThan(0);
    });

    it('still includes Bootstrap 5.3 as the base layer', () => {
        expect(source).toContain('@import "bootstrap/scss/bootstrap"');
        expect(css).toContain('.container');
        expect(css).toContain('.row');
    });
});

describe('the palette override reaches Bootstrap generated CSS', () => {
    it('resolves the primary slot to the brand red', () => {
        expect(root.get('--bs-primary').toUpperCase()).toBe(BRAND_RED);
    });

    it('exposes the brand red as the rgb triplet alpha utilities consume', () => {
        expect(root.get('--bs-primary-rgb')).toBe('225, 6, 0');
    });

    it('backs .btn-primary with the brand red', () => {
        const button = declarationsOf('.btn-primary');

        expect(button.get('--bs-btn-bg').toUpperCase()).toBe(BRAND_RED);
        expect(button.get('--bs-btn-border-color').toUpperCase()).toBe(BRAND_RED);
    });

    it('drives .bg-primary from the primary slot', () => {
        expect(declarationsOf('.bg-primary').get('background-color')).toContain(
            'var(--bs-primary-rgb)'
        );
    });

    it('repaints the body surfaces onto the ink ramp', () => {
        expect(root.get('--bs-body-bg').toUpperCase()).toBe('#141418');
        expect(root.get('--bs-body-color').toUpperCase()).toBe('#D8D4CD');
    });
});

describe('every P1 partial is assembled into the output', () => {
    it('emits the token layer as app-wide custom properties', () => {
        expect(root.get('--goji-red').toUpperCase()).toBe(BRAND_RED);
        expect(root.get('--color-bg')).toBe('var(--ink-900)');
        expect(root.get('--font-display')).toContain('"Archivo"');
        expect(root.get('--nav-h')).toBe('68px');
    });

    it('emits a self-hosted @font-face for each V2 family', () => {
        for (const family of ['"Archivo"', '"Inter"', '"Space Mono"']) {
            expect(emitted).toContain(`font-family: ${family}`);
        }

        expect(emitted).toContain('../assets/fonts/');
        expect(emitted).not.toContain('fonts.googleapis.com');
        expect(emitted).not.toContain('fonts.gstatic.com');
    });

    it('emits the editorial image-grade layer', () => {
        expect(emitted).toContain('.media--editorial');
        expect(root.get('--grade-brightness')).toBe('0.95');
    });
});

describe('the retired pre-V2 palette is gone from styles.scss', () => {
    it.each(['$primary-0', '$primary-1', '$primary-2', '$primary-3', '$primary-4', '$primary-text'])(
        'does not declare %s',
        (name) => {
            expect(source).not.toContain(name);
        }
    );

    it.each(['#ff0000', '#797979', '#475374', '#162f71', '#072370'])('does not use %s', (hex) => {
        expect(source.toLowerCase()).not.toContain(hex);
    });

    it.each([0, 1, 2, 3, 4])('does not declare the .color-primary-%i / .bg-primary-%i pair', (n) => {
        expect(source).not.toContain(`.color-primary-${n}`);
        expect(source).not.toContain(`.bg-primary-${n}`);
    });

    it('keeps no stale hand-declared substitute for a Bootstrap theme slot', () => {
        expect(source).not.toContain('.color-primary-text');
    });
});

describe('the legacy stylesheet is absorbed rather than layered (Task 00018)', () => {
    it.each([
        ['.splash-background', 'the home hero wash'],
        ['.na-background', 'the NA Miata page wash'],
        ['.img-hover:hover', 'the garage card affordance'],
    ])('carries %s forward for %s', (selector) => {
        expect(emitted).toContain(selector);
    });

    it('drives the card hover glow from the palette instead of a raw red', () => {
        expect(declarationsOf('.img-hover:hover').get('box-shadow')).toBe('var(--glow-red)');
    });

    it('strips link underlines app-wide, as every mockup surface does', () => {
        expect(declarationsOf('a').get('text-decoration')).toBe('none');
    });

    it.each([
        ['rgb(184, 184, 184)', 'the gray nav and footer washes'],
        ['rgb(90, 90, 90)', 'the .bg-gray helper'],
        ['rgb(69, 69, 69)', 'the gray dropdown menu'],
    ])('drops %s, which the token layer supersedes', (color) => {
        expect(emitted).not.toContain(color);
    });

    it('leaves the body canvas to the ink ramp, not the legacy pure black', () => {
        expect(declarationsOf('body').get('background-color')).toBe('var(--bs-body-bg)');
        expect(root.get('--bs-body-bg').toUpperCase()).toBe('#141418');
    });

    it('drops the 18px root that inflated every rem against the token scale', () => {
        expect(emitted).not.toMatch(/html\s*\{[^}]*font-size:\s*18px/);
    });
});

describe('no unthemed Bootstrap default survives the collapse', () => {
    it('reaches no default blue from :root or a component slot', () => {
        for (const [name, value] of root) {
            if (name === '--bs-blue') {
                continue;
            }

            expect(value.toLowerCase(), `${name} still resolves to a Bootstrap default`).not.toContain(
                '0d6efd'
            );
        }
    });

    it('leaves --bs-blue as an unconsumed palette entry', () => {
        expect(root.get('--bs-blue')).toBe('#0d6efd');
        expect(emitted).not.toContain('var(--bs-blue)');
    });
});
