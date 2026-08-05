// Task 00076 verification.
// usage: node t76-verify.mjs <beforeJson> <afterJson> <oldGalleryRoot> <newGalleryRoot>
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [, , BEFORE, AFTER, OLD_ROOT, NEW_ROOT] = process.argv;

const before = JSON.parse(await fs.readFile(BEFORE, "utf8"));
const after = JSON.parse(await fs.readFile(AFTER, "utf8"));
const beforeBy = new Map(before.map((r) => [`${r.gallery}/${r.filename}`, r]));

const THUMB_W = 320;
const DISPLAY_W = 1600;

function expected(dispW, dispH, cap) {
    if (dispW <= cap) return [dispW, dispH];
    return [cap, Math.round((dispH * cap) / dispW)];
}

const failures = [];
const note = (k, msg) => failures.push(`${k}: ${msg}`);

for (const r of after) {
    const k = `${r.gallery}/${r.filename}`;

    for (const kind of ["thumb", "display", "original"]) {
        if (!r[`${kind}W`]) note(k, `missing ${kind} output`);
        if (r[`${kind}Orient`] && r[`${kind}Orient`] !== 1)
            note(k, `${kind} carries orientation=${r[`${kind}Orient`]}`);
        if (r[`${kind}Meta`]) note(k, `${kind} leaks metadata: ${r[`${kind}Meta`]}`);
    }

    if (r.originalW !== r.dispW || r.originalH !== r.dispH)
        note(k, `original ${r.originalW}x${r.originalH} != as-displayed ${r.dispW}x${r.dispH}`);

    const [tw, th] = expected(r.dispW, r.dispH, THUMB_W);
    if (Math.abs(r.thumbW - tw) > 1 || Math.abs(r.thumbH - th) > 1)
        note(k, `thumb ${r.thumbW}x${r.thumbH} != expected ${tw}x${th}`);

    const [dw, dh] = expected(r.dispW, r.dispH, DISPLAY_W);
    if (Math.abs(r.displayW - dw) > 1 || Math.abs(r.displayH - dh) > 1)
        note(k, `display ${r.displayW}x${r.displayH} != expected ${dw}x${dh}`);
}

console.log(`=== dimension / metadata sweep over ${after.length} sources x 3 renditions ===`);
console.log(failures.length === 0 ? "PASS: 0 failures" : `FAIL (${failures.length}):`);
for (const f of failures.slice(0, 40)) console.log("  " + f);

// Pixel-level proof for the non-identity-orientation frames: the new rendition
// must equal the OLD (unrotated) rendition turned by the source's EXIF angle.
const ANGLE = { 3: 180, 6: 90, 8: 270 };

async function meanAbsDiff(bufA, bufB) {
    const n = Math.min(bufA.length, bufB.length);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Math.abs(bufA[i] - bufB[i]);
    return sum / n;
}

async function rawAt(file, width) {
    return sharp(file)
        .resize({ width, withoutEnlargement: true })
        .removeAlpha()
        .raw()
        .toBuffer();
}

console.log(`\n=== pixel proof on non-identity-orientation frames ===`);
const rotated = after.filter((r) => r.orientation !== 1);
console.log(`frames: ${rotated.length}`);

let pixPass = 0;
for (const r of rotated) {
    for (const kind of ["thumb", "display"]) {
        const dir = kind === "thumb" ? "thumbs" : "display";
        const oldFile = path.join(OLD_ROOT, r.gallery, dir, `${r.filename}.webp`);
        const newFile = path.join(NEW_ROOT, r.gallery, dir, `${r.filename}.webp`);
        const angle = ANGLE[r.orientation];
        const w = r[`${kind}W`];

        // reference: old output rotated by the EXIF angle, matched to new size
        const ref = await sharp(oldFile)
            .rotate(angle)
            .resize({ width: w })
            .removeAlpha()
            .raw()
            .toBuffer();
        const wrong = await sharp(oldFile)
            .rotate((angle + 180) % 360)
            .resize({ width: w })
            .removeAlpha()
            .raw()
            .toBuffer();
        const actual = await rawAt(newFile, w);

        const dRight = await meanAbsDiff(actual, ref);
        const dWrong = await meanAbsDiff(actual, wrong);
        const dUnrotated = await meanAbsDiff(
            actual,
            await sharp(oldFile).resize({ width: w }).removeAlpha().raw().toBuffer()
        );

        const ok = dRight < dWrong && dRight < dUnrotated;
        if (ok) pixPass++;
        console.log(
            `  ${ok ? "OK  " : "FAIL"} ${r.gallery}/${r.filename} [${kind}] o=${r.orientation} ` +
                `old=${beforeBy.get(`${r.gallery}/${r.filename}`)[`${kind}W`]}x${
                    beforeBy.get(`${r.gallery}/${r.filename}`)[`${kind}H`]
                } -> new=${r[`${kind}W`]}x${r[`${kind}H`]} | ` +
                `diff vs rotate(${angle})=${dRight.toFixed(2)} vs rotate(${
                    (angle + 180) % 360
                })=${dWrong.toFixed(2)} vs unrotated=${dUnrotated.toFixed(2)}`
        );
    }
}
console.log(`pixel proof: ${pixPass}/${rotated.length * 2} rendition checks passed`);

// Sanity: identity-orientation frames must be byte-for-byte unaffected in
// dimension terms vs the previous build.
let drift = 0;
for (const r of after.filter((x) => x.orientation === 1)) {
    const b = beforeBy.get(`${r.gallery}/${r.filename}`);
    if (!b) continue;
    if (b.thumbW !== r.thumbW || b.thumbH !== r.thumbH || b.displayW !== r.displayW || b.displayH !== r.displayH) {
        drift++;
        console.log(`  DRIFT ${r.gallery}/${r.filename}`);
    }
}
console.log(
    `\n=== identity-orientation frames (${after.filter((x) => x.orientation === 1).length}) unchanged: ${
        drift === 0 ? "PASS" : `FAIL (${drift} drifted)`
    } ===`
);

process.exitCode = failures.length === 0 && pixPass === rotated.length * 2 && drift === 0 ? 0 : 1;
