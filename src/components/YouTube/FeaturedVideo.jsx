import { useState } from 'react';

import { VIDEO_COPY } from './videoCopy';
import {
    embedUrlFor,
    formatPublishedLong,
    posterUrlFor,
    watchUrlFor,
} from './videoFormat';

/**
 * The cover treatment over the grid — Option A's magazine spread grafted onto
 * Option B's filter grid.
 *
 * It owns its own play state instead of borrowing VideoCard, because the card's
 * body sits under its poster and this one sits beside it — a layout difference
 * the card would have to grow a variant for, and variants that change structure
 * rather than density are how a card component becomes unreadable.
 *
 * It plays IN PLACE rather than opening the hub's overlay. The overlay exists to
 * stop a grid of cells from each holding a live player; there is exactly one
 * hero, it is already the width of an editorial spread, and pushing it into a
 * modal would shrink the video the page is built around.
 *
 * The telemetry chips carry a published date, plus a series when the surface
 * says naming one is meaningful. The mockup's runtime and view-count chips are
 * gone: the playlist RSS feed carries no duration and no trustworthy view count,
 * and a chip labelled with an invented number is worse than a chip that is not
 * there.
 *
 * `showSeries` is the hub's own derived flag rather than a check on the item:
 * with one playlist in the manifest, every video belongs to the same series and
 * naming it reads as noise — the live playlist is titled "jeffgoji.com", so the
 * chip would say "Series jeffgoji.com" on a page of that site.
 *
 * @param {object} props
 * @param {import('./videoManifest').VideoItem} props.video
 * @param {boolean} [props.showSeries]
 */
function FeaturedVideo({ video, showSeries = false }) {
    const [isPlaying, setIsPlaying] = useState(false);

    return (
        <section className="videos-featured" aria-labelledby="videos-featured-title">
            <div className="videos-featured__inner">
                {isPlaying ? (
                    <div className="videos-featured__frame">
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
                        className="videos-featured__frame videos-featured__frame--button media--editorial"
                        onClick={() => setIsPlaying(true)}
                        aria-label={`${VIDEO_COPY.card.playPrefix} ${video.title}`}
                    >
                        <img
                            className="video__poster"
                            src={posterUrlFor(video)}
                            alt=""
                            width="480"
                            height="360"
                            decoding="async"
                        />
                        <span className="video__play video__play--lg" aria-hidden="true" />
                    </button>
                )}

                <div className="videos-featured__body">
                    <div className="eyebrow">
                        {showSeries && video.seriesTitle
                            ? `${VIDEO_COPY.featured.eyebrowPrefix} · ${video.seriesTitle}`
                            : VIDEO_COPY.featured.eyebrowPrefix}
                    </div>
                    <h2 className="videos-featured__title" id="videos-featured-title">
                        {video.title}
                    </h2>
                    {video.description && (
                        <p className="videos-featured__desc">{video.description}</p>
                    )}
                    <div className="spec-row videos-featured__specs">
                        <span className="chip">
                            <b>{VIDEO_COPY.featured.publishedLabel}</b>{' '}
                            {formatPublishedLong(video.publishedAt)}
                        </span>
                        {showSeries && video.seriesTitle && (
                            <span className="chip">
                                <b>{VIDEO_COPY.featured.seriesLabel}</b> {video.seriesTitle}
                            </span>
                        )}
                    </div>
                    <div className="videos-featured__actions">
                        {!isPlaying && (
                            <button
                                type="button"
                                className="btn btn--primary"
                                onClick={() => setIsPlaying(true)}
                            >
                                {VIDEO_COPY.featured.play}
                            </button>
                        )}
                        <a
                            className="btn btn--ghost"
                            href={watchUrlFor(video.videoId)}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            {VIDEO_COPY.featured.watch}
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default FeaturedVideo;
