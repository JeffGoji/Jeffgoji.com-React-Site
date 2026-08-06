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
 * The tiles below carry the mockup's V2 TARGET figures, badged TARGET rather than
 * SHIPPED, and stay that way until real measurements replace them.
 *
 * The array may be empty. The consumer maps over it with no index arithmetic, so
 * an empty cluster is a valid render.
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
