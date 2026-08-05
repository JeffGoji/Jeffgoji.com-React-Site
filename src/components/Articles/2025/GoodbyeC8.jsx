/* eslint-disable react/no-unescaped-entities */
import ResponsiveImage from '../../common/ResponsiveImage';

import c81 from '../../../assets/images/c8/c8-002.jpg';
import c82 from '../../../assets/images/c8/autocross/1726961254977.jpg';
import c83 from '../../../assets/images/c8/club-001.jpg';
import c84 from '../../../assets/images/c8/autocross/c84.jpg';
import c85 from '../../../assets/images/c8/shoprally_03292025.jpg';
import C86 from '../../../assets/images/c8/autocross/20240317_092336.jpg';
import C87 from '../../../assets/images/c8/c8_and_nd-001.jpg';

/**
 * The width ladder scripts/build-article-images.mjs renders, and the box the
 * rendered <img> actually occupies.
 *
 * `.article` is capped at 760px including its own gutters, so the panel is the
 * full viewport below that cap and a fixed 760px above it — which is exactly
 * what `sizes` has to say for the browser to pick the right candidate before
 * layout. Getting this wrong is the usual way a correct srcset still downloads
 * the largest file.
 */
const DERIVATIVE_WIDTHS = [640, 960, 1280, 1600];
const DERIVATIVE_ROOT = '/articles/goodbye-c8';
const PANEL_SIZES = '(max-width: 760px) 100vw, 760px';

/**
 * Intrinsic geometry of each source, carried here so the <img> can reserve its
 * box (no layout shift on load) and so the width ladder is truncated at the
 * source's real width — the build script refuses to upscale, so advertising a
 * candidate wider than the original would point at a file that does not exist.
 */
const MEDIA = {
    c81: { src: c81, slug: 'c8-002', width: 1920, height: 909 },
    c82: { src: c82, slug: '1726961254977', width: 1080, height: 721 },
    c83: { src: c83, slug: 'club-001', width: 3840, height: 1775 },
    c84: { src: c84, slug: 'c84', width: 1768, height: 879 },
    c85: { src: c85, slug: 'shoprally_03292025', width: 4000, height: 1848 },
    c86: { src: C86, slug: '20240317_092336', width: 4000, height: 1848 },
    c87: { src: C87, slug: 'c8_and_nd-001', width: 1919, height: 446 },
};

/**
 * The candidate list for one source, truncated at its intrinsic width.
 *
 * `scripts/build-article-images.mjs` emits its derivatives flat, with no
 * manifest, and silently declines to upscale — so a rung wider than the source
 * names a file that was never written. `MEDIA`'s recorded `width` is the only
 * record of where each ladder actually stops, which is why the filter lives here
 * rather than in the shared component.
 *
 * @param {{slug: string, width: number}} media
 * @returns {Array<{width: number, url: string}>}
 */
function srcSetFor({ slug, width }) {
    return DERIVATIVE_WIDTHS.filter((candidate) => candidate <= width).map((candidate) => ({
        width: candidate,
        url: `${DERIVATIVE_ROOT}/${slug}-${candidate}.webp`,
    }));
}

/**
 * One photo inside a `.post` panel.
 *
 * The Vite-imported original stays on `src` so there is always a valid, hashed
 * fallback behind the generated webp ladder. `eager` is reserved for the lead
 * photo, which sits inside the first viewport on a phone; everything below it
 * defers.
 *
 * `decoding` and `fetchpriority` are spelled out alongside `loading` rather than
 * inherited: ResponsiveImage deliberately leaves the three uncoupled so each
 * surface tunes them itself, and on this one the lead photo is the LCP element.
 */
function ArticleMedia({ media, alt, eager = false }) {
    return (
        <figure className="post__media media--editorial">
            <ResponsiveImage
                src={media.src}
                srcSet={srcSetFor(media)}
                sizes={PANEL_SIZES}
                width={media.width}
                height={media.height}
                alt={alt}
                loading={eager ? 'eager' : 'lazy'}
                decoding={eager ? 'sync' : 'async'}
                fetchpriority={eager ? 'high' : undefined}
            />
        </figure>
    );
}

/**
 * "Goodbye, Panda" — the 2025 C8 Corvette end-of-ownership article.
 *
 * Task 00036 ports this off the Bootstrap Container/Row/Col + `img-fluid`
 * scaffold onto the V2 editorial reading surface (`.article` > `.section-head` +
 * `.post`, see src/scss/styles.scss). The surface has no dedicated mockup, so it
 * reuses the mockups' blog-post language rather than introducing classes of its
 * own; the only article-specific rules are the ones released from the feed's
 * uniform 16/9 crop, since these photos are the content.
 *
 * Prose is carried across verbatim. Two things about the markup deliberately
 * changed beyond the class names: each block's original DOM order is preserved
 * even where that means the photo follows the copy (Final Thoughts), and the
 * seven identical `alt="Panda"` values are replaced with descriptions of what
 * each photo actually shows — seven interchangeable labels give a screen-reader
 * user no way to tell the images apart.
 */
function GoodbyeC8() {
    return (
        <main className="article">
            <header className="section-head">
                <h1>Goodbye, Panda</h1>
                <p className="article__lede">
                    Here at the end of a short but fun road. After three years and 16,000 miles, it is time to say goodbye to the C8 Corvette.
                    <br />
                    So as the car departs, I want to give an end of life report on it and fill you in on the positives and negatives of owning the first mid-engine Corvette.
                    <br />
                    First, the positives...
                </p>
            </header>

            <article className="post">
                <ArticleMedia media={MEDIA.c81} alt="Panda, the 70th Anniversary Edition C8 Corvette, in profile" eager />
                <div className="post__body">
                    <div className="post__entry">
                        <p>
                            The C8 is a blast to drive in any situation and mode selected. The mid-engine layout gives it a handling characteristic that is unlike any previous Corvette; it stays planted and gets power down out of a corner in a brutally efficient manner as the torque piles on from the 6.2 liter LT2 V8.
                            <br />
                            Passing on the highway is also fairly effortless, and you'll find yourself going quite a bit faster than intended from time to time unless you're paying close attention to the speedometer.
                            The V8 engine provides plenty of power, and the dual-clutch transmission shifts quickly and smoothly enough for most daily driving situations. In fact, the DCT in the C8 has to be one of the best dual-clutch transmissions I have ever driven, and is easily a gold standard for daily driving and track performance.
                        </p>
                    </div>
                </div>
            </article>

            <article className="post">
                <ArticleMedia media={MEDIA.c82} alt="Panda on an autocross course" />
                <div className="post__body">
                    <div className="post__entry">
                        <p>
                            The car is fairly large (very wide) and a bit heavy. This C8 has the Z51 performance package, which adds a few extra performance goodies, like an aero package, magnetic ride control, and better brakes.
                            <br />
                            I am sure a hundred or more reviewers have said this, but the mag-ride is a game changer for combining ride comfort for daily driving duties and stiffening up for a more spirited canyon-carving experience in sport mode, or going full-stiff in track mode for the occasional track day or autocross event.
                            <br />
                            The suspension is very compliant in tour mode, soaking up bumps and rough pavement with ease, making it a surprisingly comfortable car for long drives despite its sports car nature.
                            <br />
                            I found Sport Mode to be the best for canyon carving in the Texas Hill Country, as it still allowed some compliance for the rougher roads while keeping body roll in check. It also makes the transmission shift quicker and holds gears longer for better acceleration out of corners.
                            <br />
                            Track mode is best reserved for the track or autocross, as the ride gets very stiff and unforgiving on even what is considered to be "smooth" pavement.
                            <br />
                            This is where the DCT transmission really shines, holding gears longer and downshifting more aggressively for maximum performance.
                            <br />
                            You could always swap to Manual mode for the transmission and use the paddle shifters, but I found the DCT to be so good that I rarely felt the need to intervene.
                        </p>
                    </div>
                </div>
            </article>

            <article className="post">
                <ArticleMedia media={MEDIA.c84} alt="Panda cornering through an autocross element" />
                <div className="post__body">
                    <div className="post__entry">
                        <p>
                            One of the coolest features of the Corvette is the PTM (Performance Traction Management) system, which allows you to select different driving modes that adjust the car's traction control, stability control, and other performance settings.
                            <br />
                            This system is especially useful for track days or autocross events, as it allows you to tailor the car's performance to your driving style and the conditions of the track. This is especially useful if you're not yet comfortable pushing the car to and above its absolute limits.
                            <br />
                            The system intervenes in a couple of ways. First, it has several levels of traction and stability control that it can apply, allowing for more slip and wheelspin as you go up in the settings from wet, to dry, to sport, to track 1, to track 2, and finally completely off.
                            <br />
                            The second way it intervenes is it will tighten the driving line by applying the brakes to individual wheels to help rotate the car and keep it on the intended line. This also has several levels from aggressive to completely off.
                            <br />
                            When I was learning the car, the PTM system was absolutely invaluable in helping me build confidence and learn the car's limits without going over them. As I got more comfortable, I was able to dial back the intervention and eventually turn it off completely for maximum performance.
                            <br />
                            I am now my absolute fastest in this car with the PTM completely off.
                        </p>
                    </div>
                </div>
            </article>

            <article className="post">
                <ArticleMedia media={MEDIA.c83} alt="Panda parked at a car club meet" />
                <div className="post__body">
                    <div className="post__entry">
                        <p>
                            Another positive is the design of the car. The C8 has a sleek and modern look that turns heads wherever it goes. It also invites lots of questions and random conversations from various people about the car whenever it's parked in public spots.
                        </p>
                        <p>
                            The interior of the first generation C8 (2020 to 2024) is a winner for me. Everything about it is functional and is focused like a cockpit in a fighter jet for the driver. The viewing area out the front of the car is awesome and is somewhere around 40% improved over the previous generation.
                            <br />
                            There is the infamous "wall of buttons" between the seats, which can lead to a tiny amount of passenger discomfort, but it makes AC and ventilated/heated seat control very easy to access for the passenger.
                            This car came with the excellent race seats, and they were awesome for track and autocross but could be tiring on a long drive due to the high bolsters on the thighs.
                            <br />
                            We swapped those out for the mid-range GT2 seats, which are more comfortable for daily driving and long trips, and they are still very supportive in the corners.
                        </p>
                    </div>
                </div>
            </article>

            <article className="post">
                <ArticleMedia media={MEDIA.c85} alt="Panda with its retractable hardtop down at a shop rally" />
                <div className="post__body">
                    <div className="post__entry">
                        <p>
                            So Panda is a 70th Anniversary Edition C8 with the Hardtop Convertible package, which replaces the removable roof panel with a power retractable hardtop.
                            <br />
                            This is a great option for those who want the open-air experience of a convertible without having to deal with removing and storing a roof panel. It also operates seamlessly, with the top going up or down in about 16 seconds and can be done at speeds up to 30 mph.
                            <br />
                            If you ever intend to use your C8 as a grand touring car or live in a state where you can enjoy open air driving often, I highly recommend the hardtop convertible option.
                        </p>
                    </div>
                </div>
            </article>

            <header className="section-head">
                <h2>The Negatives</h2>
                <p className="sub">
                    While there are many positives to owning a C8 Corvette, there are also some negatives to consider. Here are a few of the downsides I've experienced during my ownership of Panda.
                </p>
            </header>

            <article className="post">
                <ArticleMedia media={MEDIA.c86} alt="Panda staged in the grid at an autocross event" />
                <div className="post__body">
                    <div className="post__entry">
                        <ul>
                            <li>
                                First, the car is fairly large and wide, which can make it difficult to maneuver in tight spaces or park in small spots. This problem is only worse when you try to open what are probably the widest doors in existence and find that you have to pull a contortionist maneuver just to go grocery shopping.
                                <br />
                                In retrospect, it becomes obvious why a lot of exotic cars have gullwing or scissor doors. However, this Corvette was designed for a lower price point and mass production, so such door designs were not feasible.
                            </li>
                            <li>
                                The car's low ground clearance can also be a challenge on steep driveways or speed bumps, requiring careful approach angles to avoid scraping the front splitter. Panda has the nose lift option, which is a MUST HAVE in general.
                            </li>
                            <li>
                                Another negative is the car's fuel economy... Yeah, it's virtually non-existent.
                                I'm not sure if it's the HTC (Hard Top Convertible) and its aerodynamics, the lower gearing of the Z51 package, or a combination of both, but 12 mpg combined is pretty much the norm.
                                Best I've seen on the highway is around 24 mpg.
                            </li>
                            <li>
                                Stock class autocross is Super Street class. And unfortunately, the C8 Stingray just can't compete with the higher performance cars in class, including two of its brothers, the C8 Z06 and C8 E-Ray. Both have wider wheelbases, much more power, and wider, stickier tires.
                                So if you're looking to win consistently at local events, hope the faster cars don't show up. If you're looking to win Nationals, forget about it. The car is still a blast to drive and have fun in, but it's not a consistent winner in stock class.
                            </li>
                            <li>
                                The final issue, which is a bit of a silly one, is the Corvette stereotype.
                                <br />
                                Even though the C8 is basically a supercar in terms of performance and design, it still carries the image of an owner who wears oversized New Balance shoes, jorts (shorts made from denim), and has a large collection of Hawaiian shirts in their closet.
                                <br />
                                I would say it's a ridiculous stereotype, but I've actually seen this exact outfit in person more than once at car meets and autocross events.
                                <br />
                                So if you own a C8, be prepared for some interesting assumptions about your fashion sense and lifestyle from time to time.
                            </li>
                        </ul>
                    </div>
                </div>
            </article>

            <header className="section-head">
                <h2>Final Thoughts</h2>
            </header>

            <article className="post">
                <div className="post__body">
                    <div className="post__entry">
                        <p>
                            Overall, owning a C8 Corvette has been a fantastic experience. The car is a blast to drive, looks great, and has plenty of performance features that make it a joy to own.
                            <br />
                            While there are some negatives to consider, they are outweighed by the positives for me.
                            <br />
                            As I say goodbye to Panda, I will cherish the memories and experiences I've had with this amazing car.
                        </p>
                    </div>
                </div>
                <ArticleMedia media={MEDIA.c87} alt="Panda alongside the ND Miata" />
            </article>
        </main>
    );
}

export default GoodbyeC8;
