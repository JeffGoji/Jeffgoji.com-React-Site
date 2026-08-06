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
    ])('carries %s forward for %s', (selector) => {
        expect(emitted).toContain(selector);
    });

    /**
     * `.na-background` was migrated forward by Task 00018 and retired by Task
     * 00038: the photo it washed had already been deleted from the tree, so it
     * only ever painted a flat 60% veil, and the V2 re-skin of that surface has
     * no fixed-attachment wash at all.
     */
    it('no longer carries .na-background, retired with the NA6 re-skin', () => {
        expect(source).not.toContain('.na-background');
        expect(emitted).not.toContain('.na-background');
    });

    it('keeps background-attachment: fixed out of the stylesheet entirely', () => {
        expect(emitted).not.toContain('background-attachment: fixed');
    });

    /**
     * `.img-hover` was the legacy garage card affordance, kept alive only until
     * the mockup's own card treatment landed. Task 00033 ported that treatment
     * and deleted the one element that carried the class, so the rule goes with
     * it rather than lingering as dead CSS.
     */
    it('retires the legacy .img-hover affordance the ported card supersedes', () => {
        expect(emitted).not.toContain('.img-hover');
        expect(declarationsOf('.card:hover').get('transform')).toBe('translateY(-4px)');
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

const escapeForRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * `declarationsOf` folds an @media copy of a rule into its base rule -- its
 * block matcher cannot see the at-rule wrapper. The nav is styled at two
 * breakpoints, so these assertions read the desktop rule on its own. Sass's
 * expanded output indents anything nested in an at-rule, so anchoring the
 * selector at column zero isolates it. Comments are deliberately not stripped
 * here: the toggler glyph is a data URI containing `//`, which the line-comment
 * pass would eat along with the rest of its declaration.
 */
function topLevelDeclarationsOf(selector) {
    const match = css.match(
        new RegExp(`^${escapeForRegExp(selector)} \\{([^{}]*)\\}`, 'm')
    );

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

describe('the primary nav ports the mockup chrome (Task 00020)', () => {
    /**
     * Values are the mockups' own, read from
     * .claude/strap/mockups/spec-00002/assets/app.css:67-100. This suite exists
     * so the port is checked against those declarations rather than eyeballed.
     */
    it('gives the bar the mockups sticky blurred chrome', () => {
        const nav = topLevelDeclarationsOf('.site-nav');

        expect(nav.get('position')).toBe('sticky');
        expect(nav.get('top')).toBe('0');
        expect(nav.get('z-index')).toBe('50');
        expect(nav.get('height')).toBe('var(--nav-h)');
        expect(nav.get('background')).toBe('rgba(5, 5, 6, 0.82)');
        expect(nav.get('backdrop-filter')).toBe('blur(12px)');
        expect(nav.get('border-bottom')).toBe('var(--hairline)');
    });

    it('holds the inner row to the wide container measure', () => {
        const inner = topLevelDeclarationsOf('.site-nav__inner');

        expect(inner.get('max-width')).toBe('var(--container-wide)');
        expect(inner.get('margin-inline')).toBe('auto');
        expect(inner.get('padding-inline')).toBe('var(--space-5)');
        expect(inner.get('height')).toBe('100%');
    });

    it('sets the links in the display face the mockup uses', () => {
        const link = topLevelDeclarationsOf('.site-nav .navbar-nav .nav-link');

        expect(link.get('font-family')).toBe('var(--font-display)');
        expect(link.get('font-weight')).toBe('600');
        expect(link.get('font-size')).toBe('var(--fs-sm)');
        expect(link.get('letter-spacing')).toBe('0.04em');
        expect(link.get('text-transform')).toBe('uppercase');
        expect(link.get('padding')).toBe('var(--space-2) var(--space-3)');
        expect(link.get('position')).toBe('relative');
    });

    it('underlines the active route in brand red', () => {
        const underline = topLevelDeclarationsOf(
            '.site-nav .navbar-nav .nav-link.active:not(.dropdown-toggle)::after'
        );

        expect(underline.get('background')).toBe('var(--goji-red)');
        expect(underline.get('height')).toBe('2px');
        expect(underline.get('bottom')).toBe('2px');
        expect(underline.get('left')).toBe('var(--space-3)');
        expect(underline.get('right')).toBe('var(--space-3)');
    });

    /**
     * Dropping data-bs-theme="dark" from the Navbar re-exposes Bootstrap's
     * light-mode component defaults. These slots are what keeps the toggler
     * glyph and the dropdown panel on the token layer instead.
     */
    it('re-points the Bootstrap navbar and dropdown slots at the tokens', () => {
        const nav = topLevelDeclarationsOf('.site-nav');

        expect(nav.get('--bs-navbar-color')).toBe('var(--text-mid)');
        expect(nav.get('--bs-navbar-active-color')).toBe('var(--text-hi)');
        expect(nav.get('--bs-navbar-padding-y')).toBe('0');
        expect(nav.get('--bs-dropdown-bg')).toBe('var(--ink-800)');
        expect(nav.get('--bs-dropdown-link-active-bg')).toBe('var(--goji-red)');
    });

    /**
     * Bootstrap ships the glyph as a data URI, which cannot reference a custom
     * property, so the override is a literal and drifts silently if the ink
     * ramp moves. Asserted against --text-hi's declared value for that reason.
     */
    it('paints the collapse toggler glyph in the warm off-white', () => {
        const glyph = topLevelDeclarationsOf('.site-nav').get(
            '--bs-navbar-toggler-icon-bg'
        );

        expect(glyph).toContain("stroke='%23F1EEE9'");
        expect(root.get('--text-hi').toUpperCase()).toBe('#F1EEE9');
    });

    /** The mockups collapse the bar into a stacked sheet; so does this port. */
    it('stacks the links and drops the underline below the collapse breakpoint', () => {
        expect(emitted).toMatch(/@media \(max-width: 991\.98px\)/);

        const collapsed = emitted
            .split('@media (max-width: 991.98px)')
            .pop();

        expect(collapsed).toContain('.site-nav .navbar-nav .nav-link');
        expect(collapsed).toContain('padding: var(--space-4)');
        expect(collapsed).toContain('display: none');
    });
});

/**
 * Bug 00077. The shell paints one frame with no route content while a
 * client-side redirect commits; a viewport of reserved height is what keeps the
 * footer below the fold across that frame. Sized in viewport units on purpose --
 * the reservation is against the fold, not against a fixed page height.
 */
describe('the redirect frame reserves the height the shell is about to need', () => {
    it('holds at least a viewport', () => {
        const reserve = topLevelDeclarationsOf('.route-reserve').get('min-height');

        expect(reserve).toMatch(/^\d+vh$/);
        expect(Number.parseInt(reserve, 10)).toBeGreaterThanOrEqual(100);
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
