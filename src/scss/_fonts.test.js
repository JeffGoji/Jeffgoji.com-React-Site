/**
 * Self-hosted webfont probe for src/scss/_fonts.scss (Task 00015).
 *
 * The Definition of Done is "Archivo / Inter / Space Mono render from local
 * files with ZERO requests to fonts.googleapis.com or fonts.gstatic.com", so
 * this suite checks the three things that can break that:
 *   1. no third-party font origin survives anywhere in the SCSS layer,
 *   2. every weight/style the mockups use is covered by a declared @font-face,
 *   3. every src url() points at a real, non-placeholder woff2 on disk.
 *
 * Family names are asserted against _tokens.scss rather than restated, because
 * the token layer (Task 00012) is what makes these faces resolve at all.
 */

import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as sass from 'sass';
import { describe, expect, it } from 'vitest';

const scssDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scssDir, '../..');

const GOOGLE_FONT_ORIGINS = /fonts\.googleapis\.com|fonts\.gstatic\.com/;

/** Weights and styles the approved mockups actually use (Spec 00002, Part P1). */
const REQUIRED_FACES = [
    ['Archivo', 400, 'normal'],
    ['Archivo', 600, 'normal'],
    ['Archivo', 700, 'normal'],
    ['Archivo', 800, 'normal'],
    ['Archivo', 900, 'normal'],
    ['Archivo', 800, 'italic'],
    ['Archivo', 900, 'italic'],
    ['Inter', 400, 'normal'],
    ['Inter', 500, 'normal'],
    ['Inter', 600, 'normal'],
    ['Space Mono', 400, 'normal'],
    ['Space Mono', 700, 'normal'],
];

/** The latin subset is the critical path; latin-ext is unicode-range gated. */
const LATIN_MARKER = 'U+0000-00FF';
const LATIN_EXT_MARKER = 'U+0100-02BA';

/**
 * Sass preserves loud comments, and _fonts.scss documents the de-netting goal
 * by naming the origins it removes. Strip comments so the guard below tests
 * declarations rather than prose.
 */
function stripComments(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Pulls every @font-face block out of compiled CSS into a descriptor object.
 * @font-face bodies cannot nest braces, so a flat match is sufficient.
 */
function parseFontFaces(css) {
    const faces = [];

    for (const [, body] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
        const descriptors = new Map();

        for (const declaration of body.split(';')) {
            const [name, ...rest] = declaration.split(':');

            if (!name.trim()) {
                continue;
            }

            descriptors.set(
                name.trim().toLowerCase(),
                rest.join(':').trim().replace(/\s+/g, ' ')
            );
        }

        const weight = (descriptors.get('font-weight') ?? '400').split(' ');

        faces.push({
            family: (descriptors.get('font-family') ?? '').replace(/["']/g, ''),
            style: descriptors.get('font-style') ?? 'normal',
            display: descriptors.get('font-display'),
            src: descriptors.get('src') ?? '',
            unicodeRange: descriptors.get('unicode-range') ?? '',
            weightMin: Number(weight[0]),
            weightMax: Number(weight[weight.length - 1]),
        });
    }

    return faces;
}

/** Extracts the first (primary) family name from a font-family token value. */
function primaryFamily(tokenValue) {
    return tokenValue.split(',')[0].trim().replace(/["']/g, '');
}

function tokenFamilies() {
    const css = sass.compileString('@use "tokens";', { loadPaths: [scssDir] }).css;
    const families = new Map();

    for (const [, name, value] of css.matchAll(/(--font-(?:display|body|mono))\s*:([^;]+);/g)) {
        families.set(name, primaryFamily(value));
    }

    return families;
}

const compiled = stripComments(
    sass.compileString('@use "fonts";', { loadPaths: [scssDir] }).css
);
const faces = parseFontFaces(compiled);

describe('_fonts.scss compiles', () => {
    it('emits an @font-face for every subset of every family', () => {
        expect(faces.length).toBe(10);
    });

    it('declares only the three locked families', () => {
        expect([...new Set(faces.map((face) => face.family))].sort()).toEqual([
            'Archivo',
            'Inter',
            'Space Mono',
        ]);
    });
});

describe('font loading is fully de-netted from Google', () => {
    it('_fonts.scss references no third-party font origin', () => {
        expect(compiled).not.toMatch(GOOGLE_FONT_ORIGINS);
    });

    it('styles.scss no longer @imports Google Fonts', () => {
        const styles = readFileSync(resolve(scssDir, 'styles.scss'), 'utf8');

        expect(styles).not.toMatch(GOOGLE_FONT_ORIGINS);
    });

    it('index.html preloads or links no third-party font origin', () => {
        const html = readFileSync(resolve(repoRoot, 'index.html'), 'utf8');

        expect(html).not.toMatch(GOOGLE_FONT_ORIGINS);
    });

    it.each(faces.map((face) => [`${face.family} ${face.weightMin} ${face.style}`, face]))(
        '%s loads from a local relative url',
        (_label, face) => {
            expect(face.src).toMatch(/^url\("\.\.\/assets\/fonts\/[\w-]+\.woff2"\) format\("woff2"\)$/);
        }
    );
});

describe('every mockup weight and style resolves to a declared face', () => {
    it.each(REQUIRED_FACES)('%s %d %s is covered by latin and latin-ext', (family, weight, style) => {
        const covering = faces.filter(
            (face) =>
                face.family === family &&
                face.style === style &&
                weight >= face.weightMin &&
                weight <= face.weightMax
        );

        expect(covering.some((face) => face.unicodeRange.includes(LATIN_MARKER))).toBe(true);
        expect(covering.some((face) => face.unicodeRange.includes(LATIN_EXT_MARKER))).toBe(true);
    });
});

describe('every declared face points at a real woff2 binary', () => {
    it.each(faces.map((face) => [face.src.match(/url\("([^"]+)"\)/)[1]]))(
        '%s is a complete, non-placeholder woff2',
        (relativePath) => {
            const file = resolve(scssDir, relativePath);
            const binary = readFileSync(file);

            expect(binary.toString('latin1', 0, 4)).toBe('wOF2');

            // The header's declared length must equal the file on disk, which
            // is what separates a genuine vendored face from a truncated
            // download or a hand-made placeholder with the right magic bytes.
            expect(binary.readUInt32BE(8)).toBe(statSync(file).size);
            expect(binary.readUInt16BE(12)).toBeGreaterThan(8);
        }
    );
});

describe('faces honour the loading and format contract', () => {
    it.each(faces.map((face) => [`${face.family} ${face.weightMin} ${face.style}`, face]))(
        '%s uses font-display: swap',
        (_label, face) => {
            expect(face.display).toBe('swap');
        }
    );
});

describe('family names match the token layer', () => {
    const families = tokenFamilies();

    it.each([
        ['--font-display', 'Archivo'],
        ['--font-body', 'Inter'],
        ['--font-mono', 'Space Mono'],
    ])('%s resolves to a self-hosted family', (token, expected) => {
        expect(families.get(token)).toBe(expected);
        expect(faces.some((face) => face.family === expected)).toBe(true);
    });
});
