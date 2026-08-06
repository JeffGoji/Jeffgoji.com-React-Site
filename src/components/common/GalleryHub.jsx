import { useEffect, useState } from 'react'

import GalleryLightbox from './GalleryLightbox'
import ResponsiveImage from './ResponsiveImage'
import { GALLERY_SETS } from './gallerySets'

/**
 * Reads one set's build-time manifest.
 *
 * Every failure resolves to an empty list rather than rejecting, because the
 * visitor-facing outcome of "this set has no manifest yet", "the manifest is
 * there but empty" and "the request failed" is the same empty grid — and one of
 * those is the normal steady state until Feature C's pipeline emits the four
 * slugs it does not build yet (see gallerySets.js).
 *
 * The JSON parse is inside the guard for a reason specific to this host: the
 * SPA fallback in public/_redirects answers an unknown path with index.html and
 * a 200, so a missing manifest arrives as HTML that only fails at parse time.
 * The `ok` check alone would let it through; it earns its place for the dev
 * server, which does answer 404.
 */
async function loadManifestItems(slug) {
    try {
        const response = await fetch(`/gallery/${slug}/manifest.json`)

        if (!response.ok) {
            return []
        }

        const manifest = await response.json()

        return Array.isArray(manifest?.items) ? manifest.items : []
    } catch {
        return []
    }
}

/**
 * The build script emits per-image `thumbnailAlt` and `label`, so the first link
 * of this chain is the one that normally wins. The rest of it is not vestigial:
 * a manifest built before that schema landed carries only `alt`, and the deploy
 * serves `manifest.json` from cache independently of the bundle, so the two can
 * be a cache lifetime out of step with each other.
 */
function thumbnailAltFor(item, set, position) {
    return item.thumbnailAlt || item.alt || item.label || `${set.label} — photo ${position}`
}

/**
 * Normalises the manifest onto the one shape the grid and the lightbox both
 * read, so a frame cannot be described one way under its thumbnail and another
 * way in the lightbox caption. The renditions fall back to each other because
 * the older manifests carry only some of them.
 *
 * `full` — the multi-MB source rendition — is carried through as of Task 00075,
 * where it gained its one deliberate consumer: the lightbox's download control.
 * The rule it used to be dropped under still holds where it mattered. `full` may
 * never reach a `src`, a `srcSet`, a preload or anything else the browser
 * resolves on its own, because one frame of it costs more than a whole set of
 * thumbnails. A `download` anchor is exempt for the reason the old comment was
 * really about: an href is inert until a visitor clicks it.
 *
 * Its fallback to `original` keeps that control from pointing at nothing on a
 * manifest built before the field existed — the deploy serves `manifest.json`
 * from cache independently of the bundle, so the two can be a cache lifetime out
 * of step with each other.
 */
function framesFrom(items, set) {
    return items.map((item, index) => ({
        original: item.original ?? item.thumbnail,
        thumbnail: item.thumbnail ?? item.original,
        full: item.full ?? item.original ?? item.thumbnail,
        alt: thumbnailAltFor(item, set, index + 1),
    }))
}

/**
 * The consolidated galleries hub: one surface, one "Choose set" switcher, one
 * thumbnail grid, replacing the six per-gallery routes the nav used to fan out
 * to. Ported from the mockups' gallery.html.
 *
 * The hub owns the selected slug. `initialSlug` seeds it (so a caller can open
 * the hub on a particular set) but does not steer it afterwards — a second
 * owner for the same value would let the switcher and the caller disagree about
 * what is on screen. An unrecognised `initialSlug` falls back to the first set
 * rather than rendering a hub with nothing selected.
 *
 * The hub also owns which frame the lightbox is open on, because the lightbox
 * needs the whole fetched set and this is the only component that holds it.
 * `onSelectImage` still reports the clicked index outward, but it is a
 * notification rather than the trigger — a caller that ignores it still gets a
 * working lightbox.
 *
 * The thumbs go through `<ResponsiveImage>` for its alt contract and its lazy
 * default, but carry no `srcSet`. The pipeline builds exactly two widths per
 * frame, 320 and 1600, and the grid cell runs roughly 180-330px — so a
 * two-candidate list would resolve to the 1600w display rendition on any phone
 * above 1x DPR and pull a full-size photo per tile, tens of them per set. One
 * correctly sized URL beats a candidate list whose only other rung is wrong.
 * A middle rung in `scripts/build-gallery.mjs` is what would make a `srcSet`
 * here worth having.
 *
 * @param {object} props
 * @param {Array<{slug: string, car: string, label: string}>} [props.sets]
 * @param {string} [props.initialSlug]
 * @param {(index: number) => void} [props.onSelectImage]
 */
function GalleryHub({ sets = GALLERY_SETS, initialSlug, onSelectImage }) {
    const [slug, setSlug] = useState(() =>
        sets.some((set) => set.slug === initialSlug) ? initialSlug : sets[0].slug
    )
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [openIndex, setOpenIndex] = useState(null)

    useEffect(() => {
        let current = true

        setLoading(true)
        setOpenIndex(null)

        loadManifestItems(slug).then((loaded) => {
            if (!current) {
                return
            }

            setItems(loaded)
            setLoading(false)
        })

        return () => {
            current = false
        }
    }, [slug])

    const selectedSet = sets.find((set) => set.slug === slug) ?? sets[0]
    const frames = framesFrom(items, selectedSet)

    return (
        <section className="gallery-hub">
            <header className="gallery-hub__head">
                <div className="gallery-hub__inner">
                    <div className="eyebrow">{selectedSet.car}</div>
                    <h1 className="gallery-hub__title">{selectedSet.label}</h1>
                    <p className="gallery-hub__lead">
                        Every set in one place. Pick a drive and browse the frames.
                    </p>
                    <div className="spec-row gallery-hub__chooser">
                        <label className="label" htmlFor="gallery-hub-set">
                            Choose set
                        </label>
                        <select
                            id="gallery-hub-set"
                            className="select gallery-hub__select"
                            value={slug}
                            onChange={(event) => setSlug(event.target.value)}
                        >
                            {sets.map((set) => (
                                <option key={set.slug} value={set.slug}>
                                    {set.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </header>

            <div className="gallery-hub__inner gallery-hub__body">
                {loading && (
                    <p className="gallery-hub__status" role="status">
                        Loading {selectedSet.label}…
                    </p>
                )}

                {!loading && items.length === 0 && (
                    <p className="gallery-hub__status" role="status">
                        No frames in this set yet — try another one.
                    </p>
                )}

                {!loading && frames.length > 0 && (
                    <div className="gallery-grid">
                        {frames.map((frame, index) => (
                            <button
                                key={frame.thumbnail ?? index}
                                type="button"
                                className="thumb media--editorial"
                                data-index={index}
                                aria-label={`Open image ${index + 1}`}
                                onClick={() => {
                                    setOpenIndex(index)
                                    onSelectImage?.(index)
                                }}
                            >
                                <span className="thumb__idx">
                                    {String(index + 1).padStart(2, '0')}
                                </span>
                                <ResponsiveImage src={frame.thumbnail} alt={frame.alt} />
                            </button>
                        ))}
                    </div>
                )}

                {openIndex !== null && frames.length > 0 && (
                    <GalleryLightbox
                        items={frames}
                        startIndex={openIndex}
                        onClose={() => setOpenIndex(null)}
                    />
                )}
            </div>
        </section>
    )
}

export default GalleryHub
