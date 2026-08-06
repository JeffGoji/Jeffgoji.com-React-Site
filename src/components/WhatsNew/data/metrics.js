/**
 * Telemetry source for the /whats-new instrument cluster (the stat tiles above
 * the ledger).
 *
 * SHARED SOURCE FILE -- two owners, one file:
 *   frontend-engineer owns the SHAPE (the `Metric` typedef below, the export name,
 *     and the empty-safe contract). `trend` and `gauge` are rendered as a CSS class
 *     and a percentage width respectively, so their domains are load-bearing.
 *   tech-writer owns the VALUES (Story 00063), together with whoever runs the
 *     performance pass that produces the measured figures.
 *
 * The array may be empty. The consumer maps over it with no index arithmetic, so
 * an empty cluster is a valid render.
 *
 * SOURCING (Task 00069) -- why the three performance tiles are still TARGET.
 *
 * Each was checked against what Feature C (00005) actually published. Feature C
 * measured build-artifact bytes; it did not measure browser behaviour, because no
 * agent dispatched on this project has had a browser tool. That gap is recorded
 * at Feature 00005 comment c6 and again at Story 00044 c2, both of which decline
 * to claim AC-007/AC-008 met.
 *
 * Image payload -- checked Task 00056 (nd-totd2025 source 463MB to 33.6MB display,
 *   -92.7%; NC sets -95.9% / -91.8%; hero 480w rung -95.3%) and Task 00074
 *   (public/gallery original/ 879.5 MiB to 388.9 MiB, -55.78%). Every one of those
 *   is real and measured, and none of them is this tile's claim. The tile claims
 *   payload delivered to a browser, whose authoritative measure is per-page
 *   cold-load transferred image bytes -- see the "Cold-load transferred image
 *   bytes" section of project-docs/v1-perf-baseline.md, which defines AC-006 and
 *   was never re-run against V2. The distinction is load-bearing, not pedantic:
 *   V1 already served the gallery's webp thumbs and display frames, so -92.7% is
 *   not a V1-to-V2 delta for that page at all, and Task 00074 shrank the `full`
 *   rendition, which no page includes in a cold load.
 *
 * LCP -- no post-V2 measurement exists. Baseline is 13373 ms home mobile against
 *   the 2500 ms target.
 *
 * Lighthouse -- same gap, same record. Baseline is 82 desktop / 67 mobile on home,
 *   93 / 60 on the representative gallery.
 *
 * Flipping any of the three means re-running v1-perf-baseline.md's Methodology
 * unchanged against V2 and recording the result there first. AC-015 forbids a
 * SHIPPED badge on a figure that has not been measured and met.
 *
 * The fourth tile is SHIPPED because it is not a performance measurement: it
 * asserts that the ledger below it enumerates delivered work, which the ledger
 * itself evidences.
 */

/**
 * @typedef {Object} Metric
 * @property {string} value  The numeral, rendered in the mono face. String, not
 *                           number, so signs and separators survive verbatim.
 * @property {string} unit   Trailing unit/symbol shown small beside the value.
 * @property {string} label  Short instrument label.
 * @property {string} delta  Change readout -- arrow glyph plus short text.
 * @property {'up'|'down'|'flat'} trend  Semantic direction; drives the delta colour.
 * @property {string} note   One-line context under the tile.
 * @property {number} gauge  Meter fill, 0-100 inclusive; used as a percentage width.
 * @property {boolean} target  true badges the tile TARGET (aspirational), false
 *                             badges it SHIPPED (measured fact).
 */

/** @type {Metric[]} */
export const metrics = [
    {
        value: '−50',
        unit: '%',
        label: 'Image payload',
        delta: '▼ lighter',
        trend: 'down',
        note: 'webp + responsive srcset diet',
        gauge: 50,
        target: true
    },
    {
        value: '2.5',
        unit: 's',
        label: 'LCP',
        delta: '▼ from ~4s+',
        trend: 'down',
        note: 'largest contentful paint',
        gauge: 62,
        target: true
    },
    {
        value: '90',
        unit: '+',
        label: 'Lighthouse',
        delta: '▲ perf · 80+ field',
        trend: 'up',
        note: 'mobile lab score',
        gauge: 90,
        target: true
    },
    {
        value: '100',
        unit: '%',
        label: 'Shipped',
        delta: '0 vapourware',
        trend: 'flat',
        note: 'every claim below = real work',
        gauge: 100,
        target: false
    }
];
