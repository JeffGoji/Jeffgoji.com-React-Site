import { Link } from 'react-router-dom';

import Hero from '../Hero';
import DriverIntro from '../DriverIntro';
import VideoTeaser from '../YouTube/VideoTeaser';
import CarCard from '../common/CarCard';
import carsData from '../Garage/Cars.json';

/**
 * How many cars the home strip previews. The mockup (home.html:121) showed
 * three, but on a wide screen the auto-fill grid lays out four columns, so three
 * left an empty slot; the CPO chose to show the whole five-car stable and let
 * the fifth card wrap onto its own row. The hub at /garage still carries the
 * fuller hub cards (number tags, build-log buttons).
 */
export const PREVIEW_COUNT = 5;

/**
 * The V2 home surface, composed from home.html's four sections in the mockup's
 * own order: hero, driver intro, garage preview, videos.
 *
 * This replaces the pre-V2 eager Intro + Garage + YouTube mount. Mounting the
 * hub component here gave the page a second masthead with its own <h1> under
 * the hero's; the preview strip below reuses the shared CarCard directly
 * instead, so the hub's chrome stays on the route that owns it.
 *
 * The videos section follows the same rule for the same reason: /youtube's hub
 * carries its own <h1> and filter bar, so Home mounts VideoTeaser — a four-card
 * strip reading the same build-time manifest — rather than the hub itself.
 *
 * The strip does not filter the retired car out. CarCard reads
 * `bloglink` and renders a retired car as a plain <article> rather than a link,
 * so the slice can stay a straight read of the data's own order.
 *
 * The whole page is one <main>: the shell's <header> owns the banner landmark
 * and nothing here competes with it.
 */
function Home() {
    const preview = carsData.cars.slice(0, PREVIEW_COUNT);

    return (
        <main>
            <Hero />
            <DriverIntro />
            <div className="checker-strip" />
            <section className="section" id="garage">
                <div className="garage-preview__inner">
                    <div className="section-head garage-preview__head">
                        <div>
                            <div className="eyebrow">The stable</div>
                            <h2>Car Blogs</h2>
                        </div>
                        <Link className="btn btn--ghost btn--sm" to="/garage">
                            All builds &rsaquo;
                        </Link>
                    </div>
                    <div className="garage-grid">
                        {preview.map((car) => (
                            <CarCard key={car.id} variant="preview" {...car} />
                        ))}
                    </div>
                </div>
            </section>
            <VideoTeaser />
        </main>
    );
}

export default Home;
