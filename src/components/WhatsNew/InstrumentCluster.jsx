/**
 * The telemetry instrument cluster: the dash telltale strip over the grid of
 * stat tiles, ported from whats-new.html:26-36 and its tile template at :64-74.
 *
 * The strip is static chrome rather than a second data contract. Its readouts
 * describe the build itself -- runtime floor, image pipeline, analytics stance
 * -- which are properties of the deploy, not measurements that move with the
 * figures on the tiles. Wiring them to data would mean inventing a source that
 * has one row and never changes.
 *
 * The two blocks return as siblings in a fragment because the mockup interleaves
 * them with copy the page owns: the caption under the grid belongs to the page
 * shell (Task 00064), so wrapping strip and grid in a cluster element of their
 * own would put a box around only half of what the mockup treats as one band.
 *
 * `gauge` is the only prop that reaches the DOM as an inline style. It is a
 * per-tile percentage the stylesheet cannot know, which is the one case the
 * mockup's inline styles are not merely standing in for a missing build step.
 *
 * @param {object} props
 * @param {import('./data/metrics').Metric[]} props.metrics telemetry rows, one
 *     tile each; an empty array renders an empty grid, which is a valid state
 *     while the perf pass is still producing numbers.
 */
function InstrumentCluster({ metrics }) {
    return (
        <>
            <div className="tele-strip">
                <span>
                    <i className="live" /> V2.0 &middot; LIVE
                </span>
                <span>
                    BUILD <b>STABLE</b>
                </span>
                <span>
                    NODE <b>&ge;18.17</b>
                </span>
                <span>
                    PIPELINE <b>SHARP &rarr; WEBP</b>
                </span>
                <span>
                    ANALYTICS <b>COOKIELESS</b>
                </span>
            </div>
            <div className="tele-grid">
                {metrics.map(({ value, unit, label, delta, trend, note, gauge, target }) => (
                    <article className="tele-tile" key={label}>
                        <div className="tele-tile__head">
                            <span>{label}</span>
                            <span
                                className={`tele-badge ${
                                    target ? 'tele-badge--target' : 'tele-badge--live'
                                }`}
                            >
                                {target ? 'TARGET' : 'SHIPPED'}
                            </span>
                        </div>
                        <div className="tele-tile__value">
                            {value}
                            <span className="tele-tile__unit">{unit}</span>
                        </div>
                        <div className={`tele-tile__delta is-${trend}`}>{delta}</div>
                        <div className="tele-tile__meter">
                            <i style={{ width: `${gauge}%` }} />
                        </div>
                        <div className="tele-tile__note">{note}</div>
                    </article>
                ))}
            </div>
        </>
    );
}

export default InstrumentCluster;
