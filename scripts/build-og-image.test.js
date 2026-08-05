/**
 * Unit coverage for the social-card build script's contract (Task 00060).
 *
 * The script is imported for its exports, which is only safe because it gates
 * `buildOgImage()` behind an entry-point check — if that gate regresses, this
 * suite starts writing into public/ and the failure is loud.
 *
 * The encode itself is not exercised here: it is one sharp call with no
 * branching, and running it would put a file write in the unit suite for no
 * assertion the constants below do not already make. What the suite does cover
 * is every way the card can silently stop resolving.
 *
 * Default (node) environment: nothing here touches the DOM.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
    OG_FILENAME,
    OG_HEIGHT,
    OG_PUBLIC_PATH,
    OG_SOURCE,
    OG_WIDTH,
} from './build-og-image.mjs';

describe('the card is sized the way crawlers expect', () => {
    it('renders at the documented summary_large_image dimensions', () => {
        expect([OG_WIDTH, OG_HEIGHT]).toEqual([1200, 630]);
    });

    /**
     * Facebook, LinkedIn and X still do not reliably decode webp for link
     * previews. This is the one asset in the pipeline that must break format
     * with the rest of it.
     */
    it('emits a format social crawlers decode, not the pipeline default', () => {
        expect(OG_FILENAME).toMatch(/\.jpg$/);
        expect(OG_FILENAME).not.toMatch(/\.webp$/);
    });
});

describe('the emitted url is reachable', () => {
    /**
     * public/ is copied verbatim, so this path survives a rebuild. A bundled
     * asset would not: Vite content-hashes it, and a crawler that cached the old
     * URL would keep serving a stale card rather than re-fetching.
     */
    it('addresses a served public/ path rather than a bundled asset', () => {
        expect(OG_PUBLIC_PATH).toBe(`/og/${OG_FILENAME}`);
        expect(OG_PUBLIC_PATH).not.toContain('/assets/');
    });

    it('is the path index.html actually names', async () => {
        const markup = await fs.readFile(path.resolve('index.html'), 'utf8');

        expect(markup).toContain(`https://jeffgoji.com${OG_PUBLIC_PATH}`);
    });
});

describe('the source photo', () => {
    it('exists at the path the script resolves', async () => {
        await expect(fs.access(path.resolve(OG_SOURCE))).resolves.toBeUndefined();
    });

    /**
     * A `cover` resize upscales a source smaller than the target rather than
     * refusing, so a future source swap could ship a soft card that no other
     * assertion here would notice.
     */
    it('is large enough to crop the card from without upscaling', async () => {
        const { width, height } = await sharp(path.resolve(OG_SOURCE)).metadata();

        expect(width).toBeGreaterThanOrEqual(OG_WIDTH);
        expect(height).toBeGreaterThanOrEqual(OG_HEIGHT);
    });
});
