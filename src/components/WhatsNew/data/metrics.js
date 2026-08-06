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
 * The three perf tiles below carry the Spec's V2 TARGET figures, badged TARGET
 * rather than SHIPPED, and stay that way until real measurements replace them.
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

/**
 * The three `target: true` values are Spec 00002's AC-006/007/008 bars verbatim
 * (>=50% image-byte reduction, <=2.5s LCP, >=90 desktop / >=80 mobile Lighthouse) --
 * do not round them up. The V1 figures quoted in `delta` are medians from the
 * measured baseline at `.claude/strap/project-docs/v1-perf-baseline.md`; AC-007 and
 * the 80 bar are mobile-profile criteria, which is why the copy says so.
 *
 * @type {Metric[]}
 */
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
        delta: '▼ from 11-13s',
        trend: 'down',
        note: 'largest contentful paint · mobile',
        gauge: 62,
        target: true
    },
    {
        value: '90',
        unit: '+',
        label: 'Lighthouse',
        delta: '▲ desktop · 80+ mobile',
        trend: 'up',
        note: 'performance, lab score',
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
