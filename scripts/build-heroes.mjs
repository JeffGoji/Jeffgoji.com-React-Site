/**
 * Responsive webp renditions for the rotating home hero (Task 00056).
 *
 * `src/components/Hero/heroes.js` imports one full-size JPG per car and hands it
 * to an <img> that spans the viewport. Vite 4 emits an asset import as a single
 * URL with no width variants, so the hero — the home surface's LCP element —
 * ships a 200-700KB JPG at its native width to every device regardless of how
 * many pixels that device can show. This script pre-renders the width ladder the
 * hero's `srcSet` advertises.
 *
 * Output mirrors the public/gallery/ and public/articles/ precedent: generated
 * into public/, ignored by git, rebuilt by the build chain rather than committed.
 *
 * Task 00059 wires the emitted URLs into the `srcSet` seam heroes.js already
 * carries. Until it does, this script's output is inert — the Hero omits the
 * srcset/sizes pair when `srcSet` is absent.
 *
 * A missing source is fatal rather than skipped: every entry below is destined
 * for a candidate list, and a silent skip would ship a 404 into a srcset.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const OUT_ROOT = "public/hero";

/**
 * The nominal ladder, chosen to bracket a 100vw element: 480 covers a phone at
 * 1x, 960 covers the same phone at 2x and most tablets, and 1600 matches the
 * gallery pipeline's DISPLAY_W so the site has one ceiling rather than two.
 * Deliberately capped at 1600 — this Story exists to cut image bytes, and a
 * 2560 rung would hand the widest desktops a file several times the size of the
 * JPG being replaced.
 */
export const HERO_WIDTHS = [480, 960, 1600];

/**
 * Matches build-article-images.mjs rather than the gallery's 82. The hero sits
 * under two stacked darkening layers (the editorial grade plus `.hero__scrim`),
 * which absorb the artefacts the extra four points would buy back.
 */
const QUALITY = 78;

/**
 * One entry per car in `src/components/Hero/heroes.js`. `key` must match that
 * file's `key` field verbatim — it is the slug the emitted URLs are addressed
 * by, so a mismatch produces renditions no hero entry can reach. The source
 * paths are duplicated from heroes.js by necessity: that module imports its
 * frames through Vite's asset pipeline, which does not resolve outside a Vite
 * process, so a build script cannot read the list from it.
 */
export const HEROES = [
    { key: "na", src: "src/assets/images/na/night1.jpg" },
    { key: "msm", src: "src/assets/images/nb/HoosierWet01.jpg" },
    { key: "nc", src: "src/assets/images/ncEdit.jpg" },
    { key: "nd", src: "src/assets/images/nd/nd-001.jpg" },
    { key: "c8", src: "src/assets/images/c8/c8-002.jpg" },
];

/**
 * Resolves the ladder for one source, dropping rungs wider than the source and
 * appending the source's own width when the ladder stops short of it.
 *
 * The append is what keeps a small source honest. `ncEdit.jpg` is 800px wide, so
 * filtering alone would leave it a single 480w candidate — and because a browser
 * ignores `src` once `srcSet` is present, a full-bleed desktop hero would resolve
 * to 480px and render visibly softer than it does today with no srcset at all.
 * Carrying the native width means the candidate list always tops out at the real
 * resolution of the file, so adding a srcset can never lose detail.
 *
 * @param {number} sourceWidth Pixel width of the source image.
 * @returns {number[]} Ascending widths to render, never wider than the source.
 */
export function ladderFor(sourceWidth) {
    const rungs = HERO_WIDTHS.filter((width) => width <= sourceWidth);

    if (rungs[rungs.length - 1] !== sourceWidth && sourceWidth < Math.max(...HERO_WIDTHS)) {
        rungs.push(sourceWidth);
    }

    return rungs;
}

async function isStale(source, target) {
    try {
        const [src, out] = await Promise.all([fs.stat(source), fs.stat(target)]);

        return src.mtimeMs > out.mtimeMs;
    } catch {
        return true;
    }
}

async function buildOne(hero, outDir) {
    const sourceAbs = path.resolve(hero.src);
    const input = sharp(sourceAbs, { failOn: "none" });
    const { width } = await input.metadata();
    const widths = ladderFor(width);

    let emitted = 0;

    for (const w of widths) {
        const target = path.join(outDir, `${hero.key}-${w}.webp`);

        if (!(await isStale(sourceAbs, target))) continue;

        await input.clone().resize({ width: w }).webp({ quality: QUALITY }).toFile(target);
        emitted += 1;
    }

    return {
        emitted,
        entry: {
            key: hero.key,
            source: hero.src,
            widths,
            widest: `/hero/${hero.key}-${widths[widths.length - 1]}.webp`,
            srcSet: widths.map((w) => `/hero/${hero.key}-${w}.webp ${w}w`).join(", "),
        },
    };
}

/**
 * Writes the ladder the frontend consumes alongside the renditions. The URLs are
 * derivable from `HERO_WIDTHS` alone only for sources wider than 1600px; the
 * appended native-width rung is data-dependent, so Task 00059 needs the emitted
 * list rather than the nominal one.
 */
export async function buildHeroes() {
    const outDir = path.resolve(OUT_ROOT);

    await fs.mkdir(outDir, { recursive: true });

    const heroes = {};
    let emitted = 0;

    for (const hero of HEROES) {
        const result = await buildOne(hero, outDir);

        emitted += result.emitted;
        heroes[hero.key] = result.entry;
    }

    await fs.writeFile(
        path.join(outDir, "manifest.json"),
        JSON.stringify({ widths: HERO_WIDTHS, quality: QUALITY, heroes }, null, 2),
        "utf8"
    );

    console.log(`[hero] ${HEROES.length} sources, ${emitted} derivatives written`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    buildHeroes().catch((e) => {
        console.error("build-heroes failed:", e);
        process.exit(1);
    });
}
