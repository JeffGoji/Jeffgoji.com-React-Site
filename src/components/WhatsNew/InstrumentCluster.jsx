/**
 * The telemetry instrument cluster — placeholder.
 *
 * Task 00067 ports the `.tele-strip` telltales and the `.tele-tile` cards from
 * whats-new.html and takes the `metrics[]` array (Task 00065) as a prop. What
 * stands here is the empty grid that case leaves behind: the mockup's own
 * container, with no tile in it because there is no metric to render one from
 * yet. Keeping the element means the dashboard band's spacing is real from Wave
 * 1 rather than collapsing and re-expanding when the tiles land.
 */
function InstrumentCluster() {
    return <div className="tele-grid" />;
}

export default InstrumentCluster;
