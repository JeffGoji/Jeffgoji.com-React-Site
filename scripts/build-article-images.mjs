/**
 * Responsive derivatives for long-form article photography (Task 00036).
 *
 * The article surfaces import their photos straight out of src/assets/images/,
 * where the originals run 1080-4000px wide and up to 3.2MB each. Vite 4 emits an
 * asset import as a single URL with no width variants, so an <img> on those
 * surfaces ships the full original to a 360px phone. This script pre-renders the
 * width ladder those <img> elements advertise through srcset.
 *
 * Output mirrors the public/gallery/ precedent: generated into public/, ignored
 * by git, rebuilt by the build chain rather than committed.
 *
 * A missing source is fatal rather than skipped (unlike build-gallery.mjs, which
 * globs an unknown directory): every entry below is referenced by a component's
 * srcset, so a silent skip would ship a 404 into a candidate list.
 */

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT_ROOT = "public/articles";

/**
 * The ladder every article image is rendered at. Candidates wider than the
 * source are dropped rather than upscaled, so the emitted width descriptors
 * always match the real pixel width of the file.
 */
const WIDTHS = [640, 960, 1280, 1600];

const ARTICLES = [
    {
        id: "goodbye-c8",
        srcDir: "src/assets/images/c8",
        files: [
            "c8-002.jpg",
            "autocross/1726961254977.jpg",
            "club-001.jpg",
            "autocross/c84.jpg",
            "shoprally_03292025.jpg",
            "autocross/20240317_092336.jpg",
            "c8_and_nd-001.jpg",
        ],
    },
];

/**
 * Derives the slug a component addresses the derivatives by. Sub-directories
 * collapse into the basename, so the component never encodes the source layout.
 */
function slugOf(file) {
    return path.basename(file, path.extname(file));
}

async function isStale(source, target) {
    try {
        const [src, out] = await Promise.all([fs.stat(source), fs.stat(target)]);

        return src.mtimeMs > out.mtimeMs;
    } catch {
        return true;
    }
}

async function buildOne(article, file, outDir) {
    const sourceAbs = path.resolve(article.srcDir, file);
    const input = sharp(sourceAbs, { failOn: "none" });
    const { width } = await input.metadata();
    const slug = slugOf(file);

    let emitted = 0;

    for (const w of WIDTHS.filter((candidate) => candidate <= width)) {
        const target = path.join(outDir, `${slug}-${w}.webp`);

        if (!(await isStale(sourceAbs, target))) continue;

        await input.clone().resize({ width: w }).webp({ quality: 78 }).toFile(target);
        emitted += 1;
    }

    return emitted;
}

async function buildArticle(article) {
    const outDir = path.resolve(OUT_ROOT, article.id);

    await fs.mkdir(outDir, { recursive: true });

    let emitted = 0;

    for (const file of article.files) {
        emitted += await buildOne(article, file, outDir);
    }

    console.log(
        `[articles:${article.id}] ${article.files.length} sources, ${emitted} derivatives written`
    );
}

async function main() {
    for (const article of ARTICLES) {
        await buildArticle(article);
    }
}

main().catch((e) => {
    console.error("build-article-images failed:", e);
    process.exit(1);
});
