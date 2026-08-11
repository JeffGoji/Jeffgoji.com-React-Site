import { useEffect, useRef } from 'react';

import { VIDEO_COPY } from './videoCopy';
import { embedUrlFor, formatPublishedLong, watchUrlFor } from './videoFormat';

const FOCUSABLE =
    'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

/**
 * The single-player overlay the hub's cards activate into.
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
 * FOCUS
 * The mockup handed focus trapping over as production work and this is it. The
 * overlay takes focus on open, Escape closes it, Tab cycles inside the panel,
 * and focus returns to whatever had it before — which on this surface is always
 * the grid cell the visitor can no longer see.
 *
 * The overlay owns no data. Which video is open is the hub's state; this
 * component is handed one and a way to say it is done.
 *
 * `showSeries` is the hub's derived flag, not a check on the item: with one
 * playlist in the manifest every video shares a series and naming it is noise.
 *
 * @param {object} props
 * @param {import('./videoManifest').VideoItem} props.video
 * @param {() => void} props.onClose
 * @param {boolean} [props.showSeries]
 */
function VideoPlayerModal({ video, onClose, showSeries = false }) {
    const panelRef = useRef(null);

    useEffect(() => {
        const previouslyFocused = document.activeElement;

        panelRef.current?.focus();

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();

                return;
            }

            if (event.key !== 'Tab' || !panelRef.current) {
                return;
            }

            const focusable = [...panelRef.current.querySelectorAll(FOCUSABLE)];

            if (focusable.length === 0) {
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;

            if (event.shiftKey && (active === first || active === panelRef.current)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('keydown', onKeyDown);
            previouslyFocused?.focus?.();
        };
    }, [onClose]);

    return (
        <div
            className="video-modal"
            role="dialog"
            aria-modal="true"
            aria-label={video.title}
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="video-modal__panel" ref={panelRef} tabIndex={-1}>
                <button
                    type="button"
                    className="video-modal__close"
                    onClick={onClose}
                    aria-label={VIDEO_COPY.modal.close}
                >
                    <span aria-hidden="true">&times;</span>
                </button>

                <div className="video-modal__frame">
                    <iframe
                        className="video__player"
                        src={embedUrlFor(video.videoId)}
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    />
                </div>

                <div className="video-modal__body">
                    {showSeries && video.seriesTitle && (
                        <div className="card__kicker">{video.seriesTitle}</div>
                    )}
                    <h2 className="video-modal__title">{video.title}</h2>
                    <div className="spec-row video-modal__specs">
                        <span className="chip">
                            <b>{VIDEO_COPY.modal.publishedLabel}</b>{' '}
                            {formatPublishedLong(video.publishedAt)}
                        </span>
                    </div>
                    {video.description && (
                        <p className="video-modal__desc">{video.description}</p>
                    )}
                    <a
                        className="btn btn--ghost"
                        href={watchUrlFor(video.videoId)}
                        target="_blank"
                        rel="noreferrer noopener"
                    >
                        {VIDEO_COPY.modal.watch}
                    </a>
                </div>
            </div>
        </div>
    );
}

export default VideoPlayerModal;
