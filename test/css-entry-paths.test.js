/**
 * @vitest-environment jsdom
 *
 * Guards the single CSS entry path (Spec 00002 Part P5, Task 00018).
 *
 * The site used to paint itself from three competing stylesheets: the themed
 * SCSS bundle reached through a second <script type="module"> tag, the prebuilt
 * bootstrap.min.css imported by main.jsx, and a legacy src/assets/css/style.css
 * imported by App.jsx. Which one won a given selector depended on module-script
 * load order and CSSOM insertion order, so the V2 palette could be clobbered by
 * Bootstrap's stock #0d6efd in the browser while every source file still looked
 * correct. These assertions are static rather than rendered because that
 * failure mode lives in the wiring, not in any component.
 *
 * index.html is parsed as a static document: its script tags never pass through
 * React. Paths resolve from process.cwd(), which Vitest sets to the project
 * root -- under jsdom, import.meta.url is an http: URL and cannot be converted
 * to a filesystem path.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

const read = (...segments) => readFileSync(resolve(root, ...segments), 'utf8');

/**
 * Strips comments so prose that merely names a retired import cannot be
 * mistaken for a live one. main.jsx documents why bootstrap.min.css is gone.
 */
const stripComments = (input) =>
    input.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const RETIRED_ENTRIES = [
    'bootstrap/dist/css/bootstrap.min.css',
    'src/scss/js/main.js',
    'assets/css/style.css',
];

/** Every hand-authored source file, minus the test files that discuss them. */
function sourceFiles(dir, collected = []) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);

        if (statSync(path).isDirectory()) {
            sourceFiles(path, collected);
        } else if (/\.(jsx?|scss|css)$/.test(name) && !/\.test\.jsx?$/.test(name)) {
            collected.push(path);
        }
    }

    return collected;
}

describe('index.html loads exactly one module entry', () => {
    const scripts = [
        ...new DOMParser()
            .parseFromString(read('index.html'), 'text/html')
            .querySelectorAll('script[type="module"]'),
    ];

    it('declares /src/main.jsx and nothing beside it', () => {
        expect(scripts.map((tag) => tag.getAttribute('src'))).toEqual(['/src/main.jsx']);
    });

    it('no longer references the retired stylesheet script', () => {
        expect(read('index.html')).not.toContain('/src/scss/js/main.js');
    });
});

describe('main.jsx is the single entry for styles and Bootstrap JS', () => {
    const source = stripComments(read('src/main.jsx'));

    it('imports the themed SCSS bundle', () => {
        expect(source).toContain("import './scss/styles.scss'");
    });

    it('imports Bootstrap JS, which the retired script tag used to carry', () => {
        expect(source).toMatch(/import ['"]bootstrap['"]/);
    });

    it('does not import the unthemed prebuilt Bootstrap CSS', () => {
        expect(source).not.toContain('bootstrap.min.css');
    });
});

describe('the retired entry paths are gone from the tree', () => {
    it.each(['src/scss/js/main.js', 'src/assets/css/style.css'])('deletes %s', (path) => {
        expect(existsSync(resolve(root, path))).toBe(false);
    });

    it('leaves App.jsx importing no stylesheet of its own', () => {
        expect(stripComments(read('src/App.jsx'))).not.toMatch(/import\s+['"][^'"]*\.css['"]/);
    });

    it.each(RETIRED_ENTRIES)('has no source file still referencing %s', (entry) => {
        const offenders = sourceFiles(resolve(root, 'src'))
            .filter((path) => stripComments(readFileSync(path, 'utf8')).includes(entry))
            .map((path) => relative(root, path));

        expect(offenders).toEqual([]);
    });
});
