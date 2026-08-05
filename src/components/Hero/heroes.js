import c8Driveway from '../../assets/images/c8/c8-002.jpg'
import naNight from '../../assets/images/na/night1.jpg'
import msmWet from '../../assets/images/nb/HoosierWet01.jpg'
import ncOverlook from '../../assets/images/ncEdit.jpg'
import ndBackRoad from '../../assets/images/nd/nd-001.jpg'

/**
 * The width ladders scripts/build-heroes.mjs emitted on the last build, keyed by
 * the same `key` the shot list uses.
 *
 * Read through `import.meta.glob` rather than a plain import because
 * `public/hero/` is generated and gitignored: a fresh clone has no manifest, and
 * a bare import of a missing file is a hard resolve failure that would take the
 * whole bundle — and the test run — down with it. A glob that matches nothing
 * yields an empty record instead, which is precisely the pre-pipeline state this
 * module already degrades to.
 *
 * Resolved at build time rather than fetched: the hero is the home surface's LCP
 * element, and making its candidate list wait on a network round trip would cost
 * more than the ladder saves.
 */
const manifests = import.meta.glob('../../../public/hero/manifest.json', {
    eager: true,
    import: 'default',
});

const renditions = Object.values(manifests)[0]?.heroes ?? {};

/**
 * Pairs each shot with the ladder the pipeline emitted for it, if any.
 *
 * The manifest's `srcSet` is taken verbatim. Its ladders are not uniform — `nc`
 * stops at 800w and `na` at 1024w because those source photos are narrower than
 * the nominal ceiling — so the string cannot be rebuilt from a constant on this
 * side without silently advertising files the build never wrote.
 *
 * @param {HeroShot[]} shots
 * @param {Record<string, {srcSet?: string}>} ladders
 * @returns {HeroShot[]}
 */
export function withRenditions(shots, ladders) {
    return shots.map((shot) => {
        const srcSet = ladders?.[shot.key]?.srcSet;

        return srcSet ? { ...shot, srcSet } : shot;
    });
}

/**
 * The rotating hero's shot list — the "Random-Background-Feature" from Spec
 * 00002. One frame per car in the garage; the Hero picks one per session so a
 * return visit lands on a different car.
 *
 * These are the designer's locked picks: every file here is byte-identical to
 * the corresponding assets/img/hero-*.jpg in the spec-00002 mockup, so the
 * frames are ported by reference to the real in-repo photo rather than by
 * copying the mockup's duplicate (production never imports from a mockup path).
 * The `alt` strings are the designer's, verbatim from the mockup's mock-data.js.
 *
 * `srcSet` is absent whenever the pipeline has not run, and the Hero then omits
 * the srcset/sizes pair entirely — a srcset naming renditions that do not exist
 * would 404 and trip the error fallback.
 *
 * @typedef {object} HeroShot
 * @property {string} key   Stable identity for the car, used as the React key.
 * @property {string} img   Resolved URL of the full-size frame.
 * @property {string} [srcSet] Candidate-set descriptor, once renditions exist.
 * @property {string} name  The car's name, as the nameplate shows it.
 * @property {string} car   The chassis, as the nameplate shows it.
 * @property {string} alt   Descriptive alternative text for the frame.
 *
 * @type {HeroShot[]}
 */
const SHOTS = [
    {
        key: 'na',
        img: naNight,
        name: 'Miyoshi',
        car: 'NA6 Miata',
        alt: 'Miyoshi, the 1991 NA6 Miata, on a rooftop deck against the lit Houston night skyline',
    },
    {
        key: 'msm',
        img: msmWet,
        name: 'Kiryu',
        car: 'NB Mazdaspeed',
        alt: 'Kiryu, the NB Mazdaspeed Miata, throwing a wall of spray through a wet autocross course',
    },
    {
        key: 'nc',
        img: ncOverlook,
        name: 'Ryoko',
        car: 'NC Club',
        alt: 'Ryoko, the 2013 NC Club Miata, parked at a fall-colored mountain overlook',
    },
    {
        key: 'nd',
        img: ndBackRoad,
        name: 'Kasumi',
        car: 'ND MX-5 RF',
        alt: 'Kasumi, the 2023 ND MX-5 RF, on an open country back road under an open sky',
    },
    {
        key: 'c8',
        img: c8Driveway,
        name: 'Panda',
        car: 'C8 Corvette Z51',
        alt: 'Panda, the 2023 C8 Corvette Z51, on a tree-lined driveway in soft evening light',
    },
]

/** @type {HeroShot[]} */
export const heroes = withRenditions(SHOTS, renditions)

/**
 * The frame the Hero falls back to when the picked one fails to load — the
 * original night hero, which is also the NA entry's frame. Keeping the two on
 * one import means the fallback can never itself be a missing file.
 *
 * It carries whatever ladder the manifest gave the NA entry, which is safe for
 * the same reason: the manifest and the renditions are written by one script in
 * one pass, so a build that can name `na`'s candidates has also written them.
 *
 * @type {HeroShot}
 */
export const nightHero = heroes.find((shot) => shot.key === 'na')
