// Task 00076 verification probe.
// Snapshots every gallery source's EXIF orientation + as-displayed dims, and
// the dims/metadata of a built gallery tree.
//
// usage: node t76-probe.mjs <repoRoot> <builtGalleryRoot> <outJson>
import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const [, , REPO, BUILT, OUT] = process.argv;

const { GALLERIES } = await import(
    pathToFileURL(path.join(REPO, "scripts", "build-gallery.mjs")).href
);

const rows = [];

for (const g of GALLERIES) {
    const srcAbs = path.resolve(REPO, g.srcDir);
    const files = await fg(["**/*.{jpg,jpeg,png,webp}"], {
        cwd: srcAbs,
        absolute: true,
        ignore: g.ignore ?? [],
    });

    for (const fileAbs of files) {
        const filename = path.basename(fileAbs);
        const m = await sharp(fileAbs).metadata();
        const o = m.orientation ?? 1;
        const swap = o >= 5 && o <= 8; // 5-8 transpose the frame
        const dispW = swap ? m.height : m.width;
        const dispH = swap ? m.width : m.height;

        const row = {
            gallery: g.id,
            filename,
            format: m.format,
            orientation: o,
            storedW: m.width,
            storedH: m.height,
            dispW,
            dispH,
        };

        for (const [kind, p] of [
            ["thumb", path.join(BUILT, g.id, "thumbs", `${filename}.webp`)],
            ["display", path.join(BUILT, g.id, "display", `${filename}.webp`)],
            ["original", path.join(BUILT, g.id, "original", filename)],
        ]) {
            try {
                const om = await sharp(p).metadata();
                row[`${kind}W`] = om.width;
                row[`${kind}H`] = om.height;
                row[`${kind}Orient`] = om.orientation ?? null;
                row[`${kind}Meta`] = [
                    om.exif && "exif",
                    om.icc && "icc",
                    om.xmp && "xmp",
                    om.iptc && "iptc",
                ]
                    .filter(Boolean)
                    .join(",");
            } catch {
                row[`${kind}W`] = null;
                row[`${kind}H`] = null;
            }
        }

        rows.push(row);
    }
}

await fs.writeFile(OUT, JSON.stringify(rows, null, 1), "utf8");
console.log(`rows=${rows.length} -> ${OUT}`);

const nonId = rows.filter((r) => r.orientation !== 1);
console.log(`non-identity EXIF orientation: ${nonId.length}`);
const byGallery = {};
for (const r of nonId) byGallery[r.gallery] = (byGallery[r.gallery] ?? 0) + 1;
console.log(JSON.stringify(byGallery));
for (const r of nonId) {
    console.log(
        `  ${r.gallery}/${r.filename} o=${r.orientation} stored=${r.storedW}x${r.storedH} disp=${r.dispW}x${r.dispH} | thumb=${r.thumbW}x${r.thumbH} display=${r.displayW}x${r.displayH} original=${r.originalW}x${r.originalH}`
    );
}
