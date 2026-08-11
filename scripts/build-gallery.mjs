import { execFileSync } from "node:child_process";
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
        id: "nd-miatasatthegap2026",
        label: "Miatas at the Gap 2026",
        srcDir: "src/assets/images/nd/MiatasAtTheGap2026",
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

/**
 * The git commit date of the newest change under `srcDir`, or `null` if git
 * has nothing to say (no repo, or no commit has touched the path yet).
 *
 * Filesystem mtime is not a usable substitute: Netlify clones the repo fresh
 * for every build, which stamps every file with the checkout time and erases
 * any real difference between a gallery updated last year and one updated
 * yesterday. `execFileSync` (not a shelled-out string) so a `srcDir` with
 * spaces — this repo's own working copy lives under one — never needs
 * quoting.
 */
export function lastCommitDate(srcDir) {
    try {
        const out = execFileSync("git", ["log", "-1", "--format=%aI", "--", srcDir], {
            stdio: ["ignore", "pipe", "ignore"],
        })
            .toString()
            .trim();
        return out || null;
    } catch {
        return null;
    }
}

/** Fallback for `lastCommitDate`: the newest mtime among a gallery's own source files. */
async function newestMtimeIso(files) {
    let newest = 0;
    for (const f of files) {
        const { mtimeMs } = await fs.stat(f);
        if (mtimeMs > newest) newest = mtimeMs;
    }
    return new Date(newest).toISOString();
}

/**
 * Picks the entry with the newest `updatedAt`, or `null` for an empty list.
 * Pure so the "which gallery is latest" decision is testable without a real
 * build.
 */
export function pickLatest(results) {
    return results.reduce(
        (latest, r) => (!latest || new Date(r.updatedAt) > new Date(latest.updatedAt) ? r : latest),
        null
    );
}

/**
 * Writes `public/gallery/latest.json`, the summary the home hero's CTA reads
 * to point at whichever gallery moved most recently — see
 * src/components/common/latestGallery.js.
 */
export async function writeLatest(results) {
    const latest = pickLatest(results);
    if (!latest) return;

    await ensureDir(path.resolve(OUT_ROOT));
    await fs.writeFile(
        path.resolve(OUT_ROOT, "latest.json"),
        JSON.stringify(
            { slug: latest.id, label: latest.label, updatedAt: latest.updatedAt },
            null,
            2
        ),
        "utf8"
    );
}

// Sizes
const THUMB_W = 320;
const DISPLAY_W = 1600;

/**
 * Builds one manifest item.
 *
 * `thumbnailAlt` and `label` are the two fields the hub's degradation chain
 * (`GalleryHub.jsx`'s `thumbnailAltFor`) prefers over `alt`, and the lightbox
 * caption reads whichever one wins — so all three are derived from the single
 * string `parseDateAlt` returns rather than from separate rules. A second
 * derivation would let the same frame be described one way under its thumbnail
 * and another way in its caption, which is the exact failure the chain exists to
 * prevent. They are emitted alongside `alt`, not instead of it: the hub's
 * fallbacks still have to serve manifests built before this schema.
 */
async function processOne(fileAbs, g, outDir) {
    const filename = path.basename(fileAbs);
    const { alt, description } = parseDateAlt(filename, g.label);

    const outThumb = path.join(outDir, "thumbs", `${filename}.webp`);
    const outDisplay = path.join(outDir, "display", `${filename}.webp`);
    const outOriginal = path.join(outDir, "original", filename);

    const input = sharp(fileAbs, { failOn: "none" });

    /**
     * `rotate()` takes no argument on purpose: it bakes the source's EXIF
     * orientation into the pixels. Every rendition needs it, because sharp
     * writes no metadata unless `withMetadata()` is called — which this
     * deliberately does not, so camera and GPS tags do not reach the web — and
     * 17 of the source frames carry a non-identity orientation they would
     * otherwise rely on to hang the right way up. It precedes `resize()` so the
     * width bound applies to the upright frame rather than the stored one.
     */

    /**
     * The `full` rendition is re-encoded rather than copied. Every source is
     * untouched camera output, so a byte copy shipped ~880MB of frames carrying
     * no compression at all; mozjpeg at q85 roughly halves that at unchanged
     * display dimensions, which the download/wallpaper use case depends on.
     *
     * Every source is a JPEG (the glob also admits png/webp; none exist), so
     * the encoder is unconditional.
     */
    await input
        .clone()
        .rotate()
        .jpeg({ quality: 85, mozjpeg: true })
        .toFile(outOriginal);

    // Build thumb + display
    await input
        .clone()
        .rotate()
        .resize({ width: THUMB_W, withoutEnlargement: true })
        .webp({ quality: 70 })
        .toFile(outThumb);

    await input
        .clone()
        .rotate()
        .resize({ width: DISPLAY_W, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(outDisplay);

    return {
        original: cleanName(`/gallery/${g.id}/display/${filename}.webp`),
        thumbnail: cleanName(`/gallery/${g.id}/thumbs/${filename}.webp`),
        // If you want “download full res” later:
        full: cleanName(`/gallery/${g.id}/original/${filename}`),
        alt,
        thumbnailAlt: alt,
        label: alt,
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

    const updatedAt = lastCommitDate(g.srcDir) ?? (await newestMtimeIso(files));

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

    return { id: g.id, label: g.label, updatedAt };
}

async function main() {
    await ensureDir(path.resolve(OUT_ROOT));
    const results = [];
    for (const g of GALLERIES) {
        results.push(await buildGallery(g));
    }
    await writeLatest(results);
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