import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

function sortKeys(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function ensureDir(p) {
    return fs.mkdir(p, { recursive: true });
}

function cleanName(p) {
    return p.replace(/\\/g, "/");
}

function parseDateAlt(filename, label) {
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

// ✅ Configure your galleries here
const GALLERIES = [
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

async function buildGallery(g) {
    const srcAbs = path.resolve(g.srcDir);
    const outDir = path.resolve(OUT_ROOT, g.id);

    await ensureDir(path.join(outDir, "thumbs"));
    await ensureDir(path.join(outDir, "display"));
    await ensureDir(path.join(outDir, "original"));

    const files = await fg(["**/*.{jpg,jpeg,png,webp}"], {
        cwd: srcAbs,
        absolute: true,
    });

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

main().catch((e) => {
    console.error("build-gallery failed:", e);
    process.exit(1);
});