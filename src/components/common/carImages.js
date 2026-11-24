import na6 from '../../assets/images/na/night4.jpg';
import msm from '../../assets/images/nb/41923629_10215428433037365_6642417182418403328_o.jpg';
import ncClub from '../../assets/images/ncEdit.jpg';
import ndRf from '../../assets/images/nd/nd-002.jpg';
import c8Z51 from '../../assets/images/c8/c8-002.jpg';

/**
 * Car portraits, keyed by the `img` field each car carries in Cars.json.
 *
 * Keyed by the data's own path rather than by car id, which is what the pre-V2
 * map did: that map carried a sixth entry (a Fireball photo at id 6) for a car
 * Cars.json has never held, so the image was unreachable and the mapping could
 * drift from the data without anything failing. Keying off the field the data
 * declares makes an unresolved portrait a property of the data, which
 * Garage/index.test.jsx asserts against.
 *
 * The imports are static because Vite has to see each asset at build time to
 * hash it into dist/ -- a runtime `new URL(path)` would resolve against the
 * dev-server tree and 404 in production.
 */
const carImages = {
    'na/night4.jpg': na6,
    'nb/41923629_10215428433037365_6642417182418403328_o.jpg': msm,
    'ncEdit.jpg': ncClub,
    'nd/nd-002.jpg': ndRf,
    'c8/c8-002.jpg': c8Z51,
};

/**
 * @param {string} img path a Cars.json entry declares, relative to src/assets/images/
 * @returns {string | undefined} the bundled asset url, or undefined when unmapped
 */
export const resolveCarImage = (img) => carImages[img];

/**
 * The width ladders scripts/build-car-cards.mjs emitted on the last build, keyed
 * by the same Cars.json `img` path as the imports above.
 *
 * Read through `import.meta.glob` for the reason heroes.js gives: `public/cars/`
 * is generated and gitignored, so a fresh clone has no manifest, and a glob that
 * matches nothing yields an empty record instead of a hard resolve failure. With
 * no manifest the cards simply render the bundled JPG, as they always did.
 */
const manifests = import.meta.glob('../../../public/cars/manifest.json', {
    eager: true,
    import: 'default',
});

const renditions = Object.values(manifests)[0]?.cards ?? {};

/**
 * Pure lookup, split out so the ladder handling is testable without a build.
 * The manifest's `srcSet` is taken verbatim: ladders are truncated per source
 * (night4.jpg tops out at 1024w), so it cannot be rebuilt from a constant here.
 *
 * @param {string} img
 * @param {Record<string, {srcSet?: string}> | undefined} cards
 * @returns {string | undefined}
 */
export const carSrcSetFrom = (img, cards) => cards?.[img]?.srcSet || undefined;

/**
 * @param {string} img path a Cars.json entry declares
 * @returns {string | undefined} the card's srcset, once the pipeline has run
 */
export const resolveCarSrcSet = (img) => carSrcSetFrom(img, renditions);

/**
 * The box a car card's image occupies in `.garage-grid` (auto-fill,
 * minmax(280px, 1fr), 24px gaps, inside a 1240px measure with 24px gutters):
 * one full-width column below 632px, two columns to 935px, three to 1239px,
 * and four 280px columns from there up.
 */
export const CAR_CARD_SIZES =
    '(max-width: 631px) calc(100vw - 48px), (max-width: 935px) calc(50vw - 36px), (max-width: 1239px) calc(33vw - 32px), 280px';

export default carImages;
