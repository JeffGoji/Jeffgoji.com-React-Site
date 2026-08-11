import { useEffect, useRef } from 'react'

import {
    embedUrlFor,
    formatDuration,
    formatPublishedLong,
    formatViews,
    playlistTitleFor,
    watchUrlFor,
} from './videoFormat'

/**
 * MOCKUP — the single-player overlay Option B activates cards into.
 *
 * WHY AN OVERLAY AT ALL
 * It is the same move GalleryHub makes with its lightbox, applied to the one
 * resource on this site that is genuinely expensive to mount. Exactly one iframe
 * can exist at a time because exactly one overlay can be open, so a visitor who
 * plays nine videos in a session has cost the page one player, not nine — an
 * in-place swap leaves every previously clicked card holding a live player, each
 * still running its own document, and a grid of them will eventually stutter on
 * a phone. It also keeps the grid geometry fixed: no cell grows, nothing below
 * it moves.
 *
 * The iframe is mounted by this component's existence, so closing unmounts the
 * player and stops playback with it. No pause plumbing, no postMessage.
 *
 * FOCUS AND ESCAPE
 * The overlay takes focus on open and Escape closes it, because the visitor's
 * previous focus was a grid cell they can no longer see. Full focus trapping is
 * out of scope for an exploration mockup and is called out in the handoff as
 * production work, not as a solved problem.
 *
 * @param {object} props
 * @param {import('./sampleVideos').SampleVideo} props.video
 * @param {() => void} props.onClose
 */
function MockPlayerModal({ video, onClose }) {
    const dialogRef = useRef(null)

    useEffect(() => {
        dialogRef.current?.focus()

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        document.addEventListener('keydown', onKeyDown)

        return () => document.removeEventListener('keydown', onKeyDown)
    }, [onClose])

    return (
        <div
            className="vx-modal"
            role="dialog"
            aria-modal="true"
            aria-label={video.title}
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onClose()
                }
            }}
        >
            <div className="vx-modal__panel" ref={dialogRef} tabIndex={-1}>
                <button
                    type="button"
                    className="vx-modal__close"
                    onClick={onClose}
                    aria-label="Close player"
                >
                    <span aria-hidden="true">×</span>
                </button>

                <div className="vx-modal__frame">
                    <iframe
                        className="vx-card__player"
                        src={embedUrlFor(video.videoId)}
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    />
                </div>

                <div className="vx-modal__body">
                    <div className="card__kicker">{playlistTitleFor(video.playlistId)}</div>
                    <h2 className="vx-modal__title">{video.title}</h2>
                    <div className="spec-row vx-modal__specs">
                        <span className="chip">
                            <b>Runtime</b> {formatDuration(video.durationSeconds)}
                        </span>
                        <span className="chip">
                            <b>Published</b> {formatPublishedLong(video.publishedAt)}
                        </span>
                        <span className="chip">
                            <b>Views</b> {formatViews(video.viewCount)}
                        </span>
                    </div>
                    <p className="vx-modal__desc">{video.description}</p>
                    <a
                        className="btn btn--ghost"
                        href={watchUrlFor(video.videoId)}
                        target="_blank"
                        rel="noreferrer noopener"
                    >
                        Watch on YouTube
                    </a>
                </div>
            </div>
        </div>
    )
}

export default MockPlayerModal
