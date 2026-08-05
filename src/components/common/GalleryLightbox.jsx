import { useEffect, useRef, useState } from 'react'
import ReactImageGallery from 'react-image-gallery'

import 'react-image-gallery/styles/css/image-gallery.css'

/**
 * The lightbox's own slide markup, replacing react-image-gallery's default.
 *
 * The soft editorial grade reads `.media--editorial > img`, so the graded
 * wrapper has to be the image's direct parent — which rules out grading the
 * library's own slide element from the outside.
 *
 * @param {{original: string, alt: string}} frame
 */
function renderFrame(frame) {
    return (
        <div className="lightbox__frame media--editorial media--editorial--soft">
            <img className="image-gallery-image" src={frame.original} alt={frame.alt} />
        </div>
    )
}

/**
 * The full-view overlay behind the hub's thumbnail grid, ported from the
 * mockups' gallery.html. react-image-gallery carries the slide transition, the
 * arrow keys and touch swipe; this component supplies the mockup's chrome and
 * the two behaviours the library does not have an opinion about — Escape to
 * close, and a caption in the mockup's format.
 *
 * The overlay is mounted only while it is open, so mounting IS the open state:
 * the mockup's `.is-open` toggle class has no React counterpart and is not
 * ported. Everything else in the chrome is the mockup's structure verbatim.
 *
 * Navigation wraps at both ends because `infinite` is on; the library's own
 * `slideToIndex` already normalises an out-of-range index to the other end of
 * the set, which is why the prev/next handlers pass a raw offset.
 *
 * `alt` doubles as the caption's label. The hub has already resolved the
 * manifest's own label through its degradation chain by the time a frame gets
 * here, and inventing a second chain for the caption would let the thumbnail and
 * the caption disagree about the same frame.
 *
 * @param {object} props
 * @param {Array<{original: string, thumbnail: string, alt: string}>} props.items
 * @param {number} [props.startIndex]
 * @param {() => void} props.onClose
 */
function GalleryLightbox({ items, startIndex = 0, onClose }) {
    const [index, setIndex] = useState(startIndex)
    const gallery = useRef(null)
    const closeButton = useRef(null)

    useEffect(() => {
        function handleKeyDown(event) {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        window.addEventListener('keydown', handleKeyDown)

        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

    /** The grid behind the overlay must not scroll under it. */
    useEffect(() => {
        const restore = document.body.style.overflow

        document.body.style.overflow = 'hidden'

        return () => {
            document.body.style.overflow = restore
        }
    }, [])

    /**
     * Focus moves into the overlay on open, so a keyboard visitor is not left
     * on the thumb behind it with no route to the close control.
     */
    useEffect(() => {
        closeButton.current?.focus()
    }, [])

    const slideBy = (offset) => gallery.current?.slideToIndex(index + offset)

    return (
        <div
            className="lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Gallery viewer"
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onClose()
                }
            }}
        >
            <button
                ref={closeButton}
                type="button"
                className="btn btn--ghost btn--sm lightbox__close"
                onClick={onClose}
            >
                ✕ Close
            </button>
            <button
                type="button"
                className="lightbox__nav lightbox__nav--prev"
                aria-label="Previous"
                onClick={() => slideBy(-1)}
            >
                ‹
            </button>
            <div className="lightbox__stage">
                <ReactImageGallery
                    ref={gallery}
                    items={items}
                    startIndex={startIndex}
                    renderItem={renderFrame}
                    onBeforeSlide={setIndex}
                    infinite
                    showNav={false}
                    showThumbnails={false}
                    showBullets={false}
                    showIndex={false}
                    showPlayButton={false}
                    showFullscreenButton={false}
                />
            </div>
            <div className="lightbox__cap">
                {`${String(index + 1).padStart(2, '0')} / ${items.length} · ${items[index].alt}`}
            </div>
            <button
                type="button"
                className="lightbox__nav lightbox__nav--next"
                aria-label="Next"
                onClick={() => slideBy(1)}
            >
                ›
            </button>
        </div>
    )
}

export default GalleryLightbox
