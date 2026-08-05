import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

/**
 * Orders filenames the way a human reads them, so `nc-9` precedes `nc-10`
 * instead of sorting between `nc-1` and `nc-2`.
 */
export function sortKeys(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function ensureDir(p) {
    return fs.mkdir(p, { recursive: true });
}

/**
 * Normalises a path for use in a URL. Windows separators would otherwise reach
 * the manifest verbatim and produce hrefs no browser can resolve.
 */
export function cleanName(p) {
    return p.replace(/\\/g, "/");
}

/**
 * Derives alt text and a description from a camera-style `YYYYMMDD_HHMMSS`
 * filename, falling back to the bare filename when the name carries no date.
 */
export function parseDateAlt(filename, label) {
    const m = filename.match(
        /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?:\(\d+\))?\.[^.]+$/i
    );
    if (!m) return { alt: `${label} — ${filename}`, description: `${label} photo` };

    const [, year, month, day, hour, minute] = m;
    const dateStr = `${month}/${day}/${year} ${hour}:${minute}`;
    return {
        alt: `${label} — ${dateStr}`,
        description: `${label} photo taken ${dateStr}`,
    };
}

/**
 * Every gallery the pipeline builds.
 *
 * `id` is the slug the hub fetches at `/gallery/<id>/manifest.json`; it must
 * match `src/components/common/gallerySets.js` verbatim or the hub renders that
 * set's empty state with no other signal. `label` is not read by the hub — it
 * feeds the per-image alt text and description, so it reads as prose.
 *
 * `ignore` is fast-glob's exclusion list, relative to `srcDir`. The two NC sets
 * carry a `thumb/` directory of pre-web-era `tn_*` thumbnails: one per frame,
 * same photos, a fraction of the resolution, referenced by nothing in `src/`.
 * The glob is recursive (`nd-totd2025` depends on that to reach its `action/`
 * subdirectory), so without this those sets would ship at double length with a
 * low-resolution duplicate of every frame.
 */
export const GALLERIES = [
    {
        id: "nd-totd2025",
        label: "Tail of the Dragon 2025",
        srcDir: "src/assets/images/nd/TOTD2025",
    },
    {
        id: "nd-hillcountry",
        label: "ND Hill Country",
        srcDir: "src/assets/images/nd/HillCountry",
    },
    {
        id: "c8-autox",
        label: "C8 Autocross",
        srcDir: "src/assets/images/c8/autocross",
    },
    {
        id: "nb-hillcountry",
        label: "NB Texas Hill Country Trip",
        srcDir: "src/assets/images/nb/HillCountry",
    },
    {
        id: "nc-eastcoast15",
        label: "NC East Coast Trip 2015",
        srcDir: "src/assets/images/nc/15east",
        ignore: ["thumb/**"],
    },
    {
        id: "nc-yellowstone15",
        label: "NC Yellowstone West Coast Trip 2015",
        srcDir: "src/assets/images/nc/yellowstone",
        ignore: ["thumb/**"],
    },
];

// Output under /public so it’s served as static files
const OUT_ROOT = "public/gallery";

// Sizes
const THUMB_W = 320;
const DISPLAY_W = 1600;

async function processOne(fileAbs, g, outDir) {
    const filename = path.basename(fileAbs);
    const { alt, description } = parseDateAlt(filename, g.label);

    const outThumb = path.join(outDir, "thumbs", `${filename}.webp`);
    const outDisplay = path.join(outDir, "display", `${filename}.webp`);
    const outOriginal = path.join(outDir, "original", filename);

    // Copy original (optional but nice)
    await fs.copyFile(fileAbs, outOriginal);

    // Build thumb + display
    const input = sharp(fileAbs, { failOn: "none" });

    await input
        .clone()
        .resize({ width: THUMB_W, withoutEnlargement: true })
        .webp({ quality: 70 })
        .toFile(outThumb);

    await input
        .clone()
        .resize({ width: DISPLAY_W, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(outDisplay);

    return {
        original: cleanName(`/gallery/${g.id}/display/${filename}.webp`),
        thumbnail: cleanName(`/gallery/${g.id}/thumbs/${filename}.webp`),
        // If you want “download full res” later:
        full: cleanName(`/gallery/${g.id}/original/${filename}`),
        alt,
        description,
        loading: "lazy",
        originalAlt: g.label,
        _thumbId: `${g.id}/${filename}`,
    };
}

/**
 * Builds one gallery. Throws when the source directory yields no images: a
 * renamed or emptied directory is indistinguishable from a legitimately empty
 * one to fast-glob, and shipping `count: 0` turns that mistake into a silently
 * blank gallery that only a visitor would notice.
 *
 * The glob runs before any directory is created so a failing gallery leaves no
 * half-built output tree behind.
 */
export async function buildGallery(g) {
    const srcAbs = path.resolve(g.srcDir);
    const outDir = path.resolve(OUT_ROOT, g.id);

    const files = await fg(["**/*.{jpg,jpeg,png,webp}"], {
        cwd: srcAbs,
        absolute: true,
        ignore: g.ignore ?? [],
    });

    if (files.length === 0) {
        throw new Error(
            `[gallery:${g.id}] no images found in "${g.srcDir}" (resolved to ${srcAbs}). ` +
                `The directory is missing, empty, or was renamed — fix srcDir in GALLERIES ` +
                `or restore the source images.`
        );
    }

    await ensureDir(path.join(outDir, "thumbs"));
    await ensureDir(path.join(outDir, "display"));
    await ensureDir(path.join(outDir, "original"));

    files.sort((a, b) => sortKeys(path.basename(a), path.basename(b)));

    const items = [];
    const skipped = [];

    for (const fileAbs of files) {
        try {
            const item = await processOne(fileAbs, g, outDir);
            items.push(item);
        } catch (e) {
            skipped.push({ file: fileAbs, error: String(e) });
            // Don’t crash; just skip bad files
            console.warn(`[gallery:${g.id}] SKIP ${fileAbs}`);
            console.warn(`  ${String(e)}`);
        }
    }

    const manifest = {
        id: g.id,
        label: g.label,
        count: items.length,
        items,
        skipped,
    };

    await fs.writeFile(
        path.join(outDir, "manifest.json"),
        JSON.stringify(manifest, null, 2),
        "utf8"
    );

    console.log(`[gallery:${g.id}] done: ${items.length} items, skipped: ${skipped.length}`);
}

async function main() {
    await ensureDir(path.resolve(OUT_ROOT));
    for (const g of GALLERIES) {
        await buildGallery(g);
    }
}

/**
 * Only build when this file is the process entry point. Importing it for its
 * exports — the unit tests do — must not kick off a full sharp run.
 * `pathToFileURL` rather than a `file://` template literal: on Windows
 * `process.argv[1]` is a drive-letter path that never string-matches
 * `import.meta.url`.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((e) => {
        console.error("build-gallery failed:", e);
        process.exit(1);
    });
}