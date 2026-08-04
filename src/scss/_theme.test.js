/**
 * Contract probe for src/scss/_theme.scss.
 *
 * _theme.scss re-points Bootstrap's theme slots at the V2 palette (Spec 00002,
 * Part P1). Two things make it correct, and this suite asserts both rather than
 * restating hex values: it mirrors _tokens.scss without drifting, and the
 * override actually reaches Bootstrap's generated CSS when imported first.
 *
 * The ordering half is asserted against a negative control -- the same two
 * imports in the reverse order -- so the suite fails if the override ever
 * degrades into the no-op that styles.scss:2 is today.
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as sass from 'sass';
import { describe, expect, it } from 'vitest';

const scssDir = dirname(fileURLToPath(import.meta.url));
const nodeModules = dirname(
    dirname(createRequire(import.meta.url).resolve('bootstrap/package.json'))
);

const compileOptions = {
    loadPaths: [scssDir, nodeModules],
    quietDeps: true,
    logger: sass.Logger.silent,
};

const compile = (source) => sass.compileString(source, compileOptions).css;

/** Strips Sass and CSS comments so declaration splitting cannot trip over them. */
const stripComments = (source) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/**
 * Merges the declarations of every rule whose selector list contains `selector`
 * into a name -> value map. Bootstrap emits :root twice and pairs it with
 * [data-bs-theme=light], so matching a single literal rule is not enough.
 */
function declarationsOf(css, selector) {
    const declarations = new Map();

    for (const [, selectors, body] of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const list = selectors
            .split(';')
            .pop()
            .split(',')
            .map((entry) => entry.trim());

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

const themeCode = stripComments(readFileSync(resolve(scssDir, '_theme.scss'), 'utf8'));

/**
 * Emits every mirrored Sass variable as a custom property so the partial's
 * compile-time values can be diffed against the token layer's runtime ones.
 */
const mirrored = declarationsOf(
    compile(`
        @use "theme" as theme;
        :probe {
            --goji-red: #{theme.$goji-red};
            --goji-red-bright: #{theme.$goji-red-bright};
            --goji-red-deep: #{theme.$goji-red-deep};
            --goji-red-ink: #{theme.$goji-red-ink};
            --ink-1000: #{theme.$ink-1000};
            --ink-900: #{theme.$ink-900};
            --ink-800: #{theme.$ink-800};
            --ink-700: #{theme.$ink-700};
            --ink-600: #{theme.$ink-600};
            --ink-500: #{theme.$ink-500};
            --ink-400: #{theme.$ink-400};
            --text-hi: #{theme.$text-hi};
            --text-mid: #{theme.$text-mid};
            --text-lo: #{theme.$text-lo};
            --silver: #{theme.$silver};
            --carbon: #{theme.$carbon};
            --color-success: #{theme.$status-success};
            --color-warning: #{theme.$status-warning};
            --color-on-accent: #{theme.$on-accent};
        }
    `),
    ':probe'
);

const tokens = declarationsOf(compile('@use "tokens";'), ':root');

/** Follows var() indirection so semantic token aliases compare as literals. */
function token(name) {
    let value = tokens.get(name);

    while (value && /^var\(\s*--[\w-]+\s*\)$/.test(value)) {
        value = tokens.get(value.slice(4, -1).trim());
    }

    expect(value, `unknown token ${name}`).toBeDefined();

    return value.toUpperCase();
}

const themed = compile('@import "theme"; @import "bootstrap/scss/bootstrap";');
const unthemed = compile('@import "bootstrap/scss/bootstrap"; @import "theme";');

describe('_theme.scss is authorable before Bootstrap', () => {
    it('compiles standalone', () => {
        expect(() => compile('@use "theme";')).not.toThrow();
    });

    it('emits no CSS of its own', () => {
        expect(compile('@use "theme";').trim()).toBe('');
    });

    it('calls no Bootstrap-provided function', () => {
        expect(themeCode).not.toMatch(/\b(shade-color|tint-color|shift-color|color-contrast)\s*\(/);
    });
});

describe('_theme.scss mirrors the _tokens.scss palette', () => {
    it.each([...mirrored.keys()])('%s matches the token layer', (name) => {
        expect(mirrored.get(name).toUpperCase()).toBe(token(name));
    });
});

describe('the retired pre-V2 palette is gone', () => {
    it.each(['$primary-0', '$primary-1', '$primary-2', '$primary-3', '$primary-4', '$primary-text'])(
        'does not declare %s',
        (name) => {
            expect(themeCode).not.toContain(name);
        }
    );

    it.each(['#ff0000', '#797979', '#475374', '#162f71', '#072370'])('does not use %s', (hex) => {
        expect(themeCode.toLowerCase()).not.toContain(hex);
    });
});

describe('theme-then-Bootstrap reaches Bootstrap generated CSS', () => {
    const root = declarationsOf(themed, ':root');

    it.each([
        ['--bs-primary', '--goji-red'],
        ['--bs-danger', '--color-danger'],
        ['--bs-dark', '--ink-1000'],
        ['--bs-secondary', '--ink-400'],
        ['--bs-info', '--silver'],
        ['--bs-light', '--text-hi'],
        ['--bs-success', '--color-success'],
        ['--bs-warning', '--color-warning'],
        ['--bs-body-bg', '--color-bg'],
        ['--bs-body-color', '--color-text'],
        ['--bs-emphasis-color', '--color-heading'],
        ['--bs-heading-color', '--color-heading'],
        ['--bs-border-color', '--color-border'],
        ['--bs-secondary-bg', '--ink-800'],
        ['--bs-tertiary-bg', '--color-surface'],
        ['--bs-secondary-color', '--color-muted'],
        ['--bs-link-color', '--color-accent'],
        ['--bs-link-hover-color', '--color-accent-hover'],
    ])('%s is driven by %s', (property, name) => {
        expect(root.get(property)?.toUpperCase()).toBe(token(name));
    });

    it('exposes the brand red as an rgb triplet for alpha utilities', () => {
        const [, r, g, b] = token('--goji-red').match(/^#(..)(..)(..)$/);
        const expected = [r, g, b].map((pair) => parseInt(pair, 16)).join(', ');

        expect(root.get('--bs-primary-rgb')).toBe(expected);
    });

    it('.btn-primary is backed by the brand red', () => {
        const button = declarationsOf(themed, '.btn-primary');

        expect(button.get('--bs-btn-bg')?.toUpperCase()).toBe(token('--goji-red'));
        expect(button.get('--bs-btn-border-color')?.toUpperCase()).toBe(token('--goji-red'));
        expect(button.get('--bs-btn-color')?.toUpperCase()).toBe(token('--color-on-accent'));
    });

    it('.bg-primary is driven by the primary slot', () => {
        expect(declarationsOf(themed, '.bg-primary').get('background-color')).toContain(
            'var(--bs-primary-rgb)'
        );
    });

    it('.text-bg-primary is driven by the primary slot', () => {
        const rule = declarationsOf(themed, '.text-bg-primary');

        expect(rule.get('background-color').toLowerCase()).toContain('var(--bs-primary-rgb)');
        expect(rule.get('color').toUpperCase()).toContain(token('--color-on-accent'));
    });
});

describe('Bootstrap-then-theme is the ineffective order', () => {
    it('leaves Bootstrap defaults in place, proving the ordering contract', () => {
        const root = declarationsOf(unthemed, ':root');

        expect(root.get('--bs-primary')?.toUpperCase()).not.toBe(token('--goji-red'));
        expect(root.get('--bs-body-bg')?.toUpperCase()).not.toBe(token('--color-bg'));
        expect(declarationsOf(unthemed, '.btn-primary').get('--bs-btn-bg')?.toUpperCase()).not.toBe(
            token('--goji-red')
        );
    });
});
