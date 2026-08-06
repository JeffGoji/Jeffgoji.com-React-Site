/**
 * Content source for the /whats-new ledger (the numbered changelog).
 *
 * SHARED SOURCE FILE -- two owners, one file:
 *   frontend-engineer owns the SHAPE (the `WhatsNewEntry` typedef below, the export
 *     name, and the empty-safe contract). Changing a field name is a frontend change
 *     because the component reads these keys directly.
 *   tech-writer owns the VALUES (Story 00063). Every entry below is a structural
 *     placeholder; replace the copy in place rather than adding a parallel file.
 *
 * Same JSON-as-CMS spirit as `src/assets/Data/*Blog.json` and `Garage/Cars.json`,
 * kept as `.js` rather than `.json` so the shape contract can be documented here
 * where both owners will see it.
 *
 * The array may be empty. The consumer derives the ledger numbering from the map
 * index, so nothing here depends on a fixed length or on a specific entry existing.
 */

/**
 * @typedef {Object} WhatsNewEntry
 * @property {string} ver   Version + section banner, e.g. "V2.0 -- THE REDESIGN".
 * @property {string} tag   Short category chip on the ledger row.
 * @property {string} goal  Which V2 goal the entry advances; the chip beside `tag`.
 * @property {string} title Headline for the entry.
 * @property {string} body  Prose paragraph. Plain text -- this is NOT run through
 *                          react-markdown, unlike the blog `entry` field.
 * @property {string} why   The "WHY ->" readout row.
 * @property {string} how   The "HOW ->" readout row.
 */

/** @type {WhatsNewEntry[]} */
export const whatsNew = [
    {
        ver: 'V2.0 -- PLACEHOLDER',
        tag: 'PLACEHOLDER',
        goal: 'GOAL 1',
        title: 'Placeholder entry -- copy pending.',
        body: 'Structural placeholder so the ledger renders before the authored copy lands. Replace every field of this entry.',
        why: 'Advances GOAL 1 (enthusiast-native visual system).',
        how: 'Replace with the shipped work this entry accounts for.'
    },
    {
        ver: 'V2.0 -- PLACEHOLDER',
        tag: 'PLACEHOLDER',
        goal: 'GOAL 2',
        title: 'Second placeholder entry -- copy pending.',
        body: 'A second placeholder so the ledger renders more than one row and both goal chips are exercised. Replace every field of this entry.',
        why: 'Advances GOAL 2 (performance).',
        how: 'Replace with the shipped work this entry accounts for.'
    }
];
