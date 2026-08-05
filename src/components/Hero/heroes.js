import c8Driveway from '../../assets/images/c8/c8-002.jpg'
import naNight from '../../assets/images/na/night1.jpg'
import msmWet from '../../assets/images/nb/HoosierWet01.jpg'
import ncOverlook from '../../assets/images/ncEdit.jpg'
import ndBackRoad from '../../assets/images/nd/nd-001.jpg'

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
 * `srcSet` is the seam Feature C (Task 00056 emits the renditions, Task 00059
 * wires them) fills in. Until it does, each entry carries only the full-size
 * JPG and the Hero omits the srcset/sizes pair entirely — a srcset naming
 * renditions that do not exist would 404 and trip the error fallback.
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
export const heroes = [
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

/**
 * The frame the Hero falls back to when the picked one fails to load — the
 * original night hero, which is also the NA entry's frame. Keeping the two on
 * one import means the fallback can never itself be a missing file.
 *
 * @type {HeroShot}
 */
export const nightHero = heroes.find((shot) => shot.key === 'na')
