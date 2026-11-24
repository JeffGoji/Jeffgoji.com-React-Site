/**
 * Responsive webp renditions for the car card portraits.
 *
 * CarCard renders each car's Cars.json `img` at roughly 280-430 CSS px wide (the
 * garage grid's 280px column floor, up to a full-width card on a phone), but
 * Vite emits an asset import as one URL at its native size: a 1920px, 714KB JPG
 * for Panda's card. This script pre-renders a small width ladder so the card can
 * advertise a srcset and a phone or a 1x desktop fetches tens of KB, not
 * hundreds.
 *
 * The car list is read straight from src/components/Garage/Cars.json rather than
 * restated here (build-heroes.mjs has to restate its list because heroes.js
 * imports through Vite; Cars.json is plain JSON, so there is nothing to
 * duplicate). Adding a car to Cars.json is therefore all it takes.
 *
 * Output follows the public/hero/ precedent: generated into public/cars/,
 * ignored by git, rebuilt by the build chain. A missing source is fatal, for the
 * same reason as the hero: a silent skip would ship a 404 into a srcset.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const OUT_ROOT = "public/cars";
const CARS_JSON = "src/components/Garage/Cars.json";
const IMAGES_ROOT = "src/assets/images";

/**
 * 400 covers a 280px desktop card at 1x and leaves headroom for the wider 2- and
 * 3-column layouts; 800 covers those at 2x; 1200 covers a full-width phone card
 * (~360px) at 3x. Nothing the grid lays out needs more.
 */
export const CARD_WIDTHS = [400, 800, 1200];

/**
 * Lower than the hero's 78: the card is a small thumbnail under the editorial
 * grade, where the difference does not show and the bytes do.
 */
const QUALITY = 74;

/**
 * Same rule as the hero ladder: drop rungs wider than the source, and top the
 * ladder out at the source's own width when the rungs stop short of it, so the
 * srcset never advertises less detail than the original file has.
 *
 * @param {number} sourceWidth
 * @returns {number[]} ascending widths, never wider than the source
 */
export function ladderFor(sourceWidth) {
    const rungs = CARD_WIDTHS.filter((width) => width <= sourceWidth);

    if (rungs[rungs.length - 1] !== sourceWidth && sourceWidth < Math.max(...CARD_WIDTHS)) {
        rungs.push(sourceWidth);
    }

    return rungs;
}

/**
 * The file-name stem for a Cars.json `img` path: `nd/nd-002.jpg` -> `nd-nd-002`.
 *
 * @param {string} img
 * @returns {string}
 */
export function stemFor(img) {
    return img
        .replace(/\.[^.]+$/, "")
        .replace(/[^A-Za-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/** @returns {Promise<string[]>} every car's `img`, in Cars.json order */
export async function carImagePaths() {
    const data = JSON.parse(await fs.readFile(path.resolve(CARS_JSON), "utf8"));

    return data.cars.map((car) => car.img);
}

async function isStale(source, target) {
    try {
        const [src, out] = await Promise.all([fs.stat(source), fs.stat(target)]);

        return src.mtimeMs > out.mtimeMs;
    } catch {
        return true;
    }
}

async function buildOne(img, outDir) {
    const sourceAbs = path.resolve(IMAGES_ROOT, img);
    const input = sharp(sourceAbs, { failOn: "none" });
    const { width } = await input.metadata();
    const widths = ladderFor(width);
    const stem = stemFor(img);

    let emitted = 0;

    for (const w of widths) {
        const target = path.join(outDir, `${stem}-${w}.webp`);

        if (!(await isStale(sourceAbs, target))) continue;

        await input.clone().resize({ width: w }).webp({ quality: QUALITY }).toFile(target);
        emitted += 1;
    }

    return {
        emitted,
        entry: {
            source: img,
            widths,
            srcSet: widths.map((w) => `/cars/${stem}-${w}.webp ${w}w`).join(", "),
        },
    };
}

/**
 * Writes the renditions plus `public/cars/manifest.json`, keyed by the same
 * Cars.json `img` path carImages.js keys its imports by.
 */
export async function buildCarCards() {
    const outDir = path.resolve(OUT_ROOT);

    await fs.mkdir(outDir, { recursive: true });

    const images = await carImagePaths();
    const cards = {};
    let emitted = 0;

    for (const img of images) {
        const result = await buildOne(img, outDir);

        emitted += result.emitted;
        cards[img] = result.entry;
    }

    await fs.writeFile(
        path.join(outDir, "manifest.json"),
        JSON.stringify({ widths: CARD_WIDTHS, quality: QUALITY, cards }, null, 2),
        "utf8"
    );

    console.log(`[cars] ${images.length} sources, ${emitted} derivatives written`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    buildCarCards().catch((e) => {
        console.error("build-car-cards failed:", e);
        process.exit(1);
    });
}
