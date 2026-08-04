/**
 * Token parity probe for src/scss/_tokens.scss.
 *
 * _tokens.scss is a Tier-1 verbatim port of the approved mockup contract at
 * .claude/strap/mockups/spec-00002/assets/tokens.css (Spec 00002, Part P1).
 * The mockup is the source of truth, so this suite compiles the partial and
 * diffs its :root block against the mockup's rather than restating values.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as sass from 'sass';
import { describe, expect, it } from 'vitest';

const scssDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scssDir, '../..');
const mockupTokens = resolve(
    repoRoot,
    '.claude/strap/mockups/spec-00002/assets/tokens.css'
);

/**
 * Pulls the custom properties out of a :root block into a name -> value map.
 * Comments are stripped first so declaration splitting cannot trip over them.
 */
function parseRootTokens(css) {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const block = stripped.match(/:root\s*\{([^}]*)\}/);

    expect(block, 'no :root block found').not.toBeNull();

    const tokens = new Map();

    for (const declaration of block[1].split(';')) {
        const [name, ...rest] = declaration.split(':');

        if (!name.trim().startsWith('--')) {
            continue;
        }

        tokens.set(name.trim(), rest.join(':').trim().replace(/\s+/g, ' '));
    }

    return tokens;
}

/**
 * Follows var() indirection so semantic aliases can be asserted against the
 * literal they ultimately land on.
 */
function resolveToken(tokens, name) {
    let value = tokens.get(name);

    while (value && /^var\(\s*--[\w-]+\s*\)$/.test(value)) {
        value = tokens.get(value.slice(4, -1).trim());
    }

    return value;
}

const compiled = sass.compileString('@use "tokens";', { loadPaths: [scssDir] });
const ported = parseRootTokens(compiled.css);
const contract = parseRootTokens(readFileSync(mockupTokens, 'utf8'));

describe('_tokens.scss compiles', () => {
    it('emits a :root block with every token', () => {
        expect(ported.size).toBe(contract.size);
    });
});

describe('_tokens.scss matches the mockup contract', () => {
    it('declares exactly the contract token names', () => {
        expect([...ported.keys()].sort()).toEqual([...contract.keys()].sort());
    });

    it.each([...contract.entries()])('%s === %s', (name, value) => {
        expect(ported.get(name)).toBe(value);
    });
});

describe('semantic aliases resolve through the ink ramp', () => {
    it.each([
        ['--color-bg', '#141418'],
        ['--color-reading', '#202027'],
        ['--color-surface', '#202027'],
        ['--color-border', '#33333B'],
        ['--color-accent', '#E10600'],
        ['--color-text', '#D8D4CD'],
        ['--color-heading', '#F1EEE9'],
    ])('%s resolves to %s', (name, literal) => {
        expect(resolveToken(ported, name)).toBe(literal);
    });

    it('keeps semantic aliases as var() indirection, not folded literals', () => {
        expect(ported.get('--color-bg')).toBe('var(--ink-900)');
        expect(ported.get('--color-reading')).toBe('var(--ink-700)');
    });
});
