/**
 * The videos the grid paints, in render order.
 *
 * Kept out of the markup so adding a video is a data edit rather than a markup
 * edit — the pre-V2 component hand-wrote one <iframe> block per video, which is
 * why a fourth video meant copying a fifteen-line column.
 *
 * `meta` is net-new for V2 (the mockup's kicker line). It carries the category
 * and when the run was shot rather than the mockup's placeholder "duration ·
 * category": a duration is a factual claim about a specific upload and none is
 * known for these three, so an invented one would ship as a visible mistruth.
 *
 * @typedef {object} Video
 * @property {string} id    YouTube video id. Doubles as the React key, the
 *                          poster path segment and the embed path segment, so
 *                          it must be unique across the array.
 * @property {string} title Card heading, and the accessible name of both the
 *                          facade button and the player that replaces it.
 * @property {string} meta  Kicker line above the title.
 */

/** @type {Video[]} */
export const videos = [
    {
        id: 'UySrXUfHA_k',
        title: "Jeff's fastest run — LSR PCA autocross",
        meta: 'Autocross · March 2025',
    },
    {
        id: 'Q2B8mA3vgP0',
        title: 'Houston BMW/PCA autocross — full session',
        meta: 'Autocross · Houston',
    },
    {
        id: 'XVjs7LRCBak',
        title: "Jeff's fastest run — Houston BMW/PCA autocross",
        meta: 'Autocross · Houston',
    },
];
