import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import ResponsiveImage from '../common/ResponsiveImage'
import { galleryHubPath } from '../common/gallerySets'
import { LATEST_GALLERY_FALLBACK, loadLatestGallery } from '../common/latestGallery'

import { heroes, nightHero } from './heroes'

/** Reads once per mount, through useState's lazy initializer — see below. */
const pickHero = () => heroes[Math.floor(Math.random() * heroes.length)]

/**
 * The home surface's rotating hero, ported from the mockups' home.html hero
 * block and its `rotateHero` script (assets/app.css:246-292).
 *
 * The mockup script picks a car at load and writes it into the DOM by hand. The
 * pick lives in `useState`'s lazy initializer here rather than in an effect or
 * in the render body: an effect would paint an empty hero for one frame, and a
 * bare `pickHero()` call in the body would re-roll on every re-render, so the
 * car would change under the visitor whenever a parent re-rendered. The
 * initializer runs exactly once per mount, which is the "session-stable" part of
 * the Random-Background-Feature.
 *
 * Two darkening layers stack over the photo and both are required for legible
 * copy over any of the five frames: the `media--editorial--hero` grade tones the
 * image, and `.hero__scrim` washes the corner the headline sits in.
 *
 * The nameplate keeps naming the picked car even after a load failure swaps the
 * frame, matching the mockup — it labels the rotation, not the pixels.
 *
 * The frame loads eagerly: it is the home surface's LCP element, and
 * ResponsiveImage defers by default. `sizes` is a flat `100vw` because the block
 * is full-bleed at every breakpoint; it is passed unconditionally and lands on
 * the DOM only when the shot actually carries a ladder.
 *
 * The ghost CTA points at whichever gallery scripts/build-gallery.mjs found
 * most recently touched (public/gallery/latest.json), not a fixed set — so
 * uploading new photos to any gallery, or adding a new one, repoints and
 * relabels the button on the next build with no code change here.
 */
function Hero() {
    const [hero] = useState(pickHero)
    const [failed, setFailed] = useState(false)
    const [latestGallery, setLatestGallery] = useState(LATEST_GALLERY_FALLBACK)

    useEffect(() => {
        let current = true

        loadLatestGallery().then((result) => {
            if (!current) {
                return
            }

            setLatestGallery({ slug: result.slug, label: result.label })
        })

        return () => {
            current = false
        }
    }, [])

    const shown = failed ? nightHero : hero

    return (
        <section className="hero">
            <div className="hero__media media--editorial media--editorial--hero">
                <ResponsiveImage
                    src={shown.img}
                    srcSet={shown.srcSet}
                    sizes="100vw"
                    alt={shown.alt}
                    loading="eager"
                    onError={() => setFailed(true)}
                />
            </div>
            <div className="hero__scrim" />
            <div className="hero__nameplate">
                <span className="hero__nameplate-label">Today in the garage</span>
                <span className="hero__nameplate-name">
                    <b>{hero.name}</b> · <span>{hero.car}</span>
                </span>
            </div>
            <div className="hero__content">
                <div className="hero__inner">
                    <div className="eyebrow">Miata · Corvette · Autocross · Great drives</div>
                    <h1 className="hero__title">
                        Find the <span className="accent">line.</span>
                        <br />
                        Keep the story.
                    </h1>
                    <p className="hero__lead">
                        A single-driver garage log — four Miatas, one mid-engine Corvette, and
                        every apex, road trip and questionable purchase in between.
                    </p>
                    <div className="hero__cta">
                        <Link className="btn btn--primary" to="/garage">
                            Enter the garage ›
                        </Link>
                        <Link className="btn btn--ghost" to={galleryHubPath(latestGallery.slug)}>
                            {latestGallery.label} gallery
                        </Link>
                    </div>
                </div>
            </div>
            <div className="hero__flag" />
        </section>
    )
}

export default Hero
