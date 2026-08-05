/**
 * The single social-unfurl rendition behind index.html's og:image, twitter:image
 * and JSON-LD `image` (Task 00060).
 *
 * Those three tags previously pointed at
 * /assets/images/na/12370920_...o.jpg, which never resolved: the file lives at
 * src/assets/images/na/autocross/ (note the extra path segment), src/assets is
 * not a served root, and no module imports the photo — so Vite emitted no
 * hashed copy of it into dist/assets either. Every unfurl since has fallen back
 * to whatever the crawler could scrape. Emitting into public/ gives the tags a
 * URL that survives a rebuild, which a content-hashed bundle asset cannot: a
 * crawler caches the URL it first saw, and Facebook in particular will keep
 * serving a stale card rather than re-fetching a changed one.
 *
 * JPEG, deliberately, against the webp grain of every other script in this
 * pipeline. Facebook, LinkedIn and X still do not reliably decode webp for link
 * previews, and a card that fails to render is worse than one a few tens of KB
 * heavier. Encoded through mozjpeg so the format choice costs as little as it
 * can.
 *
 * A missing source is fatal rather than skipped: the meta tags name this file
 * unconditionally, and a silent skip would re-break the unfurl this Task exists
 * to fix.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const OUT_ROOT = "public/og";

/** Facebook's and X's documented summary_large_image size; LinkedIn accepts it. */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/**
 * The photo the tags already named. Kept rather than reconsidered — swapping the
 * social card's subject is an editorial decision, not an optimisation one.
 */
export const OG_SOURCE = "src/assets/images/na/autocross/12370920_10207027821827335_8393944522748518224_o.jpg";

export const OG_FILENAME = "og-cover-1200x630.jpg";

/** The path index.html hard-codes; exported so the meta guard asserts one constant. */
export const OG_PUBLIC_PATH = `/og/${OG_FILENAME}`;

/**
 * Lower than the pipeline's 78 because this asset is judged on transfer size by
 * crawlers that impose their own ceilings, and it is rendered at card scale
 * where the difference is not visible. Paired with mozjpeg this lands well under
 * the 200KB budget with headroom for a future source photo.
 */
const QUALITY = 72;

async function isStale(source, target) {
    try {
        const [src, out] = await Promise.all([fs.stat(source), fs.stat(target)]);

        return src.mtimeMs > out.mtimeMs;
    } catch {
        return true;
    }
}

/**
 * The source is 3:2 and the card is 1.91:1, so something has to go. `cover`
 * crops rather than letterboxing: a padded card reads as a broken image in a
 * feed, whereas a tighter crop of the same frame does not.
 */
export async function buildOgImage() {
    const outDir = path.resolve(OUT_ROOT);
    const sourceAbs = path.resolve(OG_SOURCE);
    const target = path.join(outDir, OG_FILENAME);

    await fs.mkdir(outDir, { recursive: true });

    if (!(await isStale(sourceAbs, target))) {
        console.log(`[og] ${OG_FILENAME} up to date`);

        return;
    }

    await sharp(sourceAbs, { failOn: "none" })
        .resize({ width: OG_WIDTH, height: OG_HEIGHT, fit: "cover", position: "centre" })
        .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true })
        .toFile(target);

    const { size } = await fs.stat(target);

    console.log(`[og] ${OG_FILENAME} ${OG_WIDTH}x${OG_HEIGHT} ${(size / 1024).toFixed(1)}KB`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    buildOgImage().catch((e) => {
        console.error("build-og-image failed:", e);
        process.exit(1);
    });
}
