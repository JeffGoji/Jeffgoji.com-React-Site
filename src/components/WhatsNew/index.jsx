import Changelog from './Changelog';
import InstrumentCluster from './InstrumentCluster';

/**
 * The V2 "What's New" surface, ported from the mockups' whats-new.html: a
 * telemetry dashboard band over a numbered changelog ledger.
 *
 * The mockup hangs `<header class="wn-dash">` and `<main class="section">` off
 * <body> as siblings. Both regions are kept, but the header is nested inside the
 * page's one <main> here: a <header> that is not inside an article/aside/main/
 * nav/section maps to the banner landmark, and the shell already mounts one in
 * components/Header. Nesting it demotes it to a plain sectioning header and
 * leaves the shell's banner unrivalled, which is the same trade Home makes.
 *
 * The mockups' `.container` is not ported — Bootstrap owns that class name and
 * its ladder is still live on un-migrated surfaces — so each region repeats the
 * measure on its own `__inner`, matching `.garage-preview__inner` and siblings.
 *
 * The two clusters are children rather than inline markup so the tile grid
 * (Task 00067) and the ledger (Task 00068) can be built and tested against their
 * own data contracts. Neither is wired to data yet: Task 00065's
 * `data/{metrics,whatsNew}.js` is imported here and threaded down as props when
 * it lands.
 */
function WhatsNew() {
    return (
        <main>
            <header className="wn-dash">
                <div className="wn-dash__inner">
                    <div className="eyebrow">Version 2.0 &middot; Telemetry &amp; changelog</div>
                    <h1 className="wn-dash__title">The site got a full engine swap.</h1>
                    <p className="hero__lead wn-dash__lead">
                        Every claim below is a thing that actually shipped. No vapourware. No
                        &ldquo;coming soon&rdquo;. We got rid of that too. Here are the numbers
                        &mdash; then the ledger of exactly what changed and why.
                    </p>
                    <InstrumentCluster />
                    <p className="tele-caption">
                        <b>Note:</b> figures marked TARGET are the V2 performance goals used here
                        as representative placeholders &mdash; the real measured numbers land when
                        the perf/analytics pass ships. Everything in the ledger below is already
                        done.
                    </p>
                </div>
            </header>
            <section className="section">
                <div className="wn-ledger__inner">
                    <Changelog />
                    <p className="card__text wn-legend">
                        Every entry traces to shipped work &middot; GOAL 1 = enthusiast-native
                        visual system &middot; GOAL 2 = performance
                    </p>
                </div>
            </section>
        </main>
    );
}

export default WhatsNew;
