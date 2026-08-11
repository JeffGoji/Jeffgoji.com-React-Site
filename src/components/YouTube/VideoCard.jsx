import { useState } from 'react';

import { VIDEO_COPY } from './videoCopy';
import { embedUrlFor, formatPublished, posterUrlFor } from './videoFormat';

/**
 * One video, mounted as a poster facade.
 *
 * FACADE, PRESERVED
 * Until the visitor clicks there is no iframe in the tree at all, only a lazy
 * <img>. A thirteen-card grid of eager embeds would pull thirteen YouTube
 * documents, thirteen player bundles and thirteen sets of cookies before anyone
 * asked to watch anything, and the hub only gets bigger from here. This is the
 * one mechanism carried forward unchanged from the pre-hub VideoCard.
 *
 * TWO ACTIVATION MODES
 * `onOpen` decides which. Without it the card swaps its own poster for a player
 * in place, which is what the home teaser wants — one card, no overlay chrome.
 * With it the card reports the click upward and stays a poster, which is how the
 * hub keeps exactly one iframe in the document no matter how many cards are on
 * screen, and how it avoids a grid cell turning into a player while its
 * neighbours stay stills.
 *
 * The facade is a <button> rather than an inert <div>: it is the click target,
 * so it has to be reachable by keyboard and announce itself.
 *
 * `size` drives density only. It never changes which metadata is present — a
 * card that drops a field at one size makes that field look optional to whoever
 * ports this next.
 *
 * The card owns whether it is playing and nothing else. Which cards exist, in
 * what order, and which one the overlay is showing are all the hub's.
 *
 * @param {object} props
 * @param {import('./videoManifest').VideoItem} props.video
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {(video: import('./videoManifest').VideoItem) => void} [props.onOpen]
 * @param {boolean} [props.showSeries]
 */
function VideoCard({ video, size = 'md', onOpen, showSeries = false }) {
    const [isPlaying, setIsPlaying] = useState(false);

    const activate = () => {
        if (onOpen) {
            onOpen(video);

            return;
        }

        setIsPlaying(true);
    };

    return (
        <article className={`video video--${size}`}>
            {isPlaying ? (
                <div className="video__frame">
                    <iframe
                        className="video__player"
                        src={embedUrlFor(video.videoId)}
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    />
                </div>
            ) : (
                <button
                    type="button"
                    className="video__frame video__frame--button media--editorial"
                    onClick={activate}
                    aria-label={`${VIDEO_COPY.card.playPrefix} ${video.title}`}
                >
                    <img
                        className="video__poster"
                        src={posterUrlFor(video)}
                        alt=""
                        width="480"
                        height="360"
                        loading="lazy"
                        decoding="async"
                    />
                    <span className="video__play" aria-hidden="true" />
                </button>
            )}

            <div className="video__body">
                {showSeries && video.seriesTitle && (
                    <div className="card__kicker">{video.seriesTitle}</div>
                )}
                <h3 className="video__title">{video.title}</h3>
                <p className="video__meta">
                    <span>{formatPublished(video.publishedAt)}</span>
                </p>
            </div>
        </article>
    );
}

export default VideoCard;
