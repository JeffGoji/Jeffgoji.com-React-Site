import introGarage from '../../assets/images/c8/c8_and_nd-001.jpg'

/**
 * The driver-intro section that follows the hero on the home surface, ported
 * from home.html's second <section>.
 *
 * The mockup carries this section's grid, measures and chip spacing on style
 * attributes; they are class-borne here for the same reason the footer's were.
 *
 * This is a net-new component rather than a rewrite of components/pages/Intro:
 * that one is the pre-V2 full-bleed splash and is retired with the rest of the
 * eager Intro/Garage/YouTube composition in Task 00032.
 */
function DriverIntro() {
    return (
        <section className="driver-intro">
            <div className="driver-intro__inner">
                <div>
                    <div className="eyebrow">The driver</div>
                    <h2 className="driver-intro__name">Jeff &quot;Goji&quot; Anderson-Lester</h2>
                    <p className="driver-intro__bio">
                        I&apos;ve been driving, breaking and fixing Miatas since 2003 — from a
                        197,000-mile NA6 daily to an SCCA-championship-winning Mazdaspeed. These
                        pages are the running log: what changed, what it cost, and what it felt
                        like on the road.
                    </p>
                    <div className="spec-row driver-intro__chips">
                        <span className="chip">
                            CARS <b>5</b>
                        </span>
                        <span className="chip">
                            CHAMPIONSHIPS <b>2</b>
                        </span>
                        <span className="chip">
                            EST. <b>2003</b>
                        </span>
                    </div>
                </div>
                <div className="driver-intro__portrait media--editorial">
                    <img
                        src={introGarage}
                        alt="The C8 Corvette and the ND MX-5 parked together in the garage"
                        loading="lazy"
                    />
                </div>
            </div>
        </section>
    )
}

export default DriverIntro
