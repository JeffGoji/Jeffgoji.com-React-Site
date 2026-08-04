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

export default carImages;
