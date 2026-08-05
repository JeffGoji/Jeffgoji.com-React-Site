/**
 * Unit coverage for the gallery build script's pure helpers plus the
 * empty-source guard (Task 00053).
 *
 * The script is imported for its exports, which is only safe because it gates
 * `main()` behind an entry-point check — if that gate regresses, this suite
 * starts running a full sharp build and the failure is loud.
 *
 * Default (node) environment: nothing here touches the DOM.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    GALLERIES,
    buildGallery,
    cleanName,
    parseDateAlt,
    sortKeys,
} from './build-gallery.mjs';

describe('parseDateAlt', () => {
    const label = 'ND Hill Country';

    it('renders a camera-style filename as a readable date', () => {
        expect(parseDateAlt('20221112_101351.jpg', label)).toEqual({
            alt: 'ND Hill Country — 11/12/2022 10:13',
            description: 'ND Hill Country photo taken 11/12/2022 10:13',
        });
    });

    it('tolerates the duplicate-download "(1)" suffix', () => {
        expect(parseDateAlt('20221112_101351(2).jpg', label).alt).toBe(
            'ND Hill Country — 11/12/2022 10:13'
        );
    });

    it('matches the extension case-insensitively', () => {
        expect(parseDateAlt('20221112_101351.JPEG', label).alt).toBe(
            'ND Hill Country — 11/12/2022 10:13'
        );
    });

    it('falls back to the bare filename when the name carries no date', () => {
        expect(parseDateAlt('nc-1.jpg', 'NC East Coast Trip 2015')).toEqual({
            alt: 'NC East Coast Trip 2015 — nc-1.jpg',
            description: 'NC East Coast Trip 2015 photo',
        });
    });

    it('does not mistake a partial or malformed date for a real one', () => {
        for (const filename of [
            '2022111_101351.jpg',
            '20221112_1013.jpg',
            'IMG_20221112_101351.jpg',
            '20221112-101351.jpg',
        ]) {
            expect(parseDateAlt(filename, label).description).toBe(`${label} photo`);
        }
    });
});

describe('sortKeys', () => {
    it('orders embedded numbers by value, not by digit', () => {
        const names = ['nc-10.jpg', 'nc-2.jpg', 'nc-1.jpg', 'nc-9.jpg'];

        expect([...names].sort(sortKeys)).toEqual([
            'nc-1.jpg',
            'nc-2.jpg',
            'nc-9.jpg',
            'nc-10.jpg',
        ]);
    });

    it('keeps chronological filenames in chronological order', () => {
        const names = ['20221112_101351.jpg', '20221108_195054.jpg', '20221110_172909.jpg'];

        expect([...names].sort(sortKeys)).toEqual([
            '20221108_195054.jpg',
            '20221110_172909.jpg',
            '20221112_101351.jpg',
        ]);
    });

    it('ignores case so mixed-case sources do not split into two runs', () => {
        expect(sortKeys('IMG_9415.jpg', 'img_9416.jpg')).toBeLessThan(0);
        expect(sortKeys('autox001.jpg', 'AUTOX001.jpg')).toBe(0);
    });
});

describe('cleanName', () => {
    it('rewrites Windows separators into URL separators', () => {
        expect(cleanName('\\gallery\\nd-totd2025\\thumbs\\a.jpg.webp')).toBe(
            '/gallery/nd-totd2025/thumbs/a.jpg.webp'
        );
    });

    it('leaves an already-clean path untouched', () => {
        expect(cleanName('/gallery/c8-autox/display/b.jpg.webp')).toBe(
            '/gallery/c8-autox/display/b.jpg.webp'
        );
    });

    it('normalises a mixed-separator path', () => {
        expect(cleanName('/gallery\\nc-eastcoast15/original\\nc-1.jpg')).toBe(
            '/gallery/nc-eastcoast15/original/nc-1.jpg'
        );
    });
});

describe('GALLERIES', () => {
    it('declares a unique id and a source directory for every set', () => {
        const ids = GALLERIES.map((gallery) => gallery.id);

        expect(new Set(ids).size).toBe(ids.length);

        for (const gallery of GALLERIES) {
            expect(gallery.label).toBeTruthy();
            expect(gallery.srcDir).toMatch(/^src\/assets\/images\//);
        }
    });

    it('covers every slug the hub offers', async () => {
        const { GALLERY_SETS } = await import('../src/components/common/gallerySets.js');

        expect(GALLERIES.map((gallery) => gallery.id).sort()).toEqual(
            GALLERY_SETS.map((set) => set.slug).sort()
        );
    });
});

describe('buildGallery refuses to ship an empty gallery', () => {
    it('throws when the source directory does not exist', async () => {
        await expect(
            buildGallery({
                id: 'fixture-missing',
                label: 'Fixture',
                srcDir: 'src/assets/images/does-not-exist-00053',
            })
        ).rejects.toThrow(/no images found/);
    });

    it('throws when the source directory exists but holds no images', async () => {
        const srcDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gallery-empty-'));

        try {
            await fs.writeFile(path.join(srcDir, 'README.txt'), 'not an image', 'utf8');

            await expect(
                buildGallery({ id: 'fixture-empty', label: 'Fixture', srcDir })
            ).rejects.toThrow(/no images found/);
        } finally {
            await fs.rm(srcDir, { recursive: true, force: true });
        }
    });

    it('names the gallery and the resolved directory in the failure', async () => {
        const error = await buildGallery({
            id: 'fixture-named',
            label: 'Fixture',
            srcDir: 'src/assets/images/does-not-exist-00053',
        }).catch((thrown) => thrown);

        expect(error.message).toContain('[gallery:fixture-named]');
        expect(error.message).toContain(path.resolve('src/assets/images/does-not-exist-00053'));
    });

    it('creates no output tree for the gallery it rejected', async () => {
        await buildGallery({
            id: 'fixture-no-output',
            label: 'Fixture',
            srcDir: 'src/assets/images/does-not-exist-00053',
        }).catch(() => {});

        await expect(
            fs.access(path.resolve('public/gallery/fixture-no-output'))
        ).rejects.toThrow();
    });
});

/**
 * Exercises the real pipeline over a generated fixture set rather than unit
 * testing `processOne`, which is not exported: the thing under test is the JSON
 * that reaches the hub over the network, and only a real build produces it.
 *
 * Three frames, two of them date-stamped, because the defect this schema closes
 * is per-image fields collapsing to one shared string — which a single-frame
 * fixture cannot show.
 */
describe('the manifest a build writes', () => {
    const GALLERY_ID = 'fixture-schema-00054';
    const LABEL = 'Fixture Drive';
    const OUT_DIR = path.resolve('public/gallery', GALLERY_ID);

    const DATED = '20221112_101351.jpg';
    const ALSO_DATED = '20240301_080000.jpg';
    const UNDATED = 'scan-01.jpg';

    let items;

    beforeAll(async () => {
        const srcDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gallery-schema-'));

        for (const filename of [DATED, ALSO_DATED, UNDATED]) {
            await sharp({
                create: { width: 8, height: 8, channels: 3, background: '#333' },
            })
                .jpeg()
                .toFile(path.join(srcDir, filename));
        }

        try {
            await buildGallery({ id: GALLERY_ID, label: LABEL, srcDir });
        } finally {
            await fs.rm(srcDir, { recursive: true, force: true });
        }

        const manifest = JSON.parse(
            await fs.readFile(path.join(OUT_DIR, 'manifest.json'), 'utf8')
        );

        items = Object.fromEntries(
            manifest.items.map((item) => [item._thumbId.split('/').pop(), item])
        );
    });

    afterAll(async () => {
        await fs.rm(OUT_DIR, { recursive: true, force: true });
    });

    it('carries the date-stamped label on both new fields', () => {
        const item = items[DATED];

        expect(item.thumbnailAlt).toBe(`${LABEL} — 11/12/2022 10:13`);
        expect(item.label).toBe(`${LABEL} — 11/12/2022 10:13`);
    });

    it('falls back to the bare filename when the name carries no date', () => {
        const item = items[UNDATED];

        expect(item.thumbnailAlt).toBe(`${LABEL} — ${UNDATED}`);
        expect(item.label).toBe(`${LABEL} — ${UNDATED}`);
    });

    it('describes each frame distinctly rather than reusing the set label', () => {
        const built = Object.values(items);

        expect(built).toHaveLength(3);
        expect(new Set(built.map((item) => item.thumbnailAlt)).size).toBe(built.length);
        expect(new Set(built.map((item) => item.label)).size).toBe(built.length);
        expect(new Set(built.map((item) => item.originalAlt))).toEqual(new Set([LABEL]));
    });

    it('agrees with the alt the hub already fell back to, so the two cannot diverge', () => {
        for (const item of Object.values(items)) {
            expect(item.thumbnailAlt).toBe(item.alt);
            expect(item.label).toBe(item.alt);
        }
    });

    it('adds the new fields without dropping any the manifest already carried', () => {
        const item = items[DATED];

        expect(Object.keys(item).sort()).toEqual(
            [
                '_thumbId',
                'alt',
                'description',
                'full',
                'label',
                'loading',
                'original',
                'originalAlt',
                'thumbnail',
                'thumbnailAlt',
            ].sort()
        );
        expect(item.description).toBe(`${LABEL} photo taken 11/12/2022 10:13`);
        expect(item.original).toBe(`/gallery/${GALLERY_ID}/display/${DATED}.webp`);
        expect(item.thumbnail).toBe(`/gallery/${GALLERY_ID}/thumbs/${DATED}.webp`);
    });
});
