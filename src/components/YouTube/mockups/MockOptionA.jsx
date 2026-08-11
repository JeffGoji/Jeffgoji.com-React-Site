import { useState } from 'react'

import MockVideoCard from './MockVideoCard'
import { EmptyState, ErrorState, LoadingStatus, VideoGridSkeleton } from './MockStates'
import {
    CHANNEL,
    FEATURED_VIDEO_ID,
    SAMPLE_PLAYLISTS,
    SAMPLE_VIDEOS,
} from './sampleVideos'
import {
    byNewest,
    embedUrlFor,
    formatDuration,
    formatPublishedLong,
    formatViews,
    playlistTitleFor,
    posterUrlFor,
    watchUrlFor,
} from './videoFormat'

/**
 * MOCKUP OPTION A — "Featured + Rails".
 *
 * A magazine cover treatment over a stack of per-series horizontal shelves. The
 * hub opens on one video given the full width of an editorial spread — poster on
 * the left, headline and telemetry chips on the right — and everything else is
 * organised into rails, one per playlist, newest first inside each.
 *
 * WHY RAILS RATHER THAN A GRID
 * A rail spends vertical space at a fixed rate no matter how deep the series is,
 * so five series fit above the point where a grid would still be showing the
 * first two. That makes the whole channel legible in one scroll, which is what a
 * hub is for. The cost is that depth is hidden sideways: video nine in a series
 * is reachable only by scrolling a rail, and mouse users have no good gesture for
 * that, so the rails carry visible arrow controls rather than relying on the
 * trackpad swipe that makes this pattern work on phones.
 *
 * IFRAME COST
 * Every card on this surface, the featured one included, is the production
 * facade: a lazy <img> and no iframe until a click. Rails make that cheaper than
 * a grid does rather than more expensive — a rail's off-screen cards are also
 * off-axis, so their posters sit outside the viewport in both directions and
 * `loading="lazy"` declines to fetch them until the visitor scrolls the rail. A
 * twelve-video channel paints roughly the four posters actually on screen.
 *
 * @param {object} props
 * @param {'ready'|'loading'|'empty'|'error'} [props.state]
 * @param {() => void} [props.onRetry]
 */
function MockOptionA({ state = 'ready', onRetry }) {
    const featured =
        SAMPLE_VIDEOS.find((video) => video.videoId === FEATURED_VIDEO_ID) ??
        [...SAMPLE_VIDEOS].sort(byNewest)[0]

    return (
        <div className="vx-hub vx-hub--a">
            <header className="vx-hub__head">
                <div className="vx-hub__inner">
                    <div className="eyebrow">On camera</div>
                    <h1 className="vx-hub__title">Videos</h1>
                    <p className="vx-hub__lead">
                        Builds, autocross runs and long drives from{' '}
                        <a
                            href={CHANNEL.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="vx-hub__channel"
                        >
                            {CHANNEL.handle}
                        </a>
                        .
                    </p>
                </div>
            </header>

            {state === 'error' && (
                <div className="vx-hub__inner vx-hub__body">
                    <ErrorState channelUrl={CHANNEL.url} onRetry={onRetry} />
                </div>
            )}

            {state === 'empty' && (
                <div className="vx-hub__inner vx-hub__body">
                    <EmptyState
                        title="The channel index is empty"
                        hint="Nothing has been published to the site yet."
                    />
                </div>
            )}

            {state === 'loading' && (
                <div className="vx-hub__inner vx-hub__body vx-hub__body--reserved">
                    <LoadingStatus label="Loading the channel" />
                    <div className="vx-featured vx-featured--skeleton vx-skeleton">
                        <div className="vx-featured__frame vx-skeleton__block" />
                        <div className="vx-featured__body">
                            <div className="vx-skeleton__line vx-skeleton__line--kicker" />
                            <div className="vx-skeleton__line" />
                            <div className="vx-skeleton__line vx-skeleton__line--short" />
                        </div>
                    </div>
                    <VideoGridSkeleton count={4} size="md" />
                </div>
            )}

            {state === 'ready' && (
                <>
                    <FeaturedVideo video={featured} />

                    <div className="vx-hub__inner vx-hub__body">
                        {SAMPLE_PLAYLISTS.map((playlist) => (
                            <PlaylistRail
                                key={playlist.id}
                                playlist={playlist}
                                videos={SAMPLE_VIDEOS.filter(
                                    (video) => video.playlistId === playlist.id
                                ).sort(byNewest)}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

/**
 * The cover treatment.
 *
 * It owns its own play state instead of borrowing MockVideoCard, because the
 * card's body sits under its poster and this one sits beside it — a layout
 * difference the card would have to grow a variant for, and variants that change
 * structure rather than density are how a card component becomes unreadable.
 */
function FeaturedVideo({ video }) {
    const [isPlaying, setIsPlaying] = useState(false)

    return (
        <section className="vx-featured" aria-labelledby="vx-featured-title">
            <div className="vx-featured__inner">
                {isPlaying ? (
                    <div className="vx-featured__frame">
                        <iframe
                            className="vx-card__player"
                            src={embedUrlFor(video.videoId)}
                            title={video.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                        />
                    </div>
                ) : (
                    <button
                        type="button"
                        className="vx-featured__frame vx-featured__frame--button media--editorial"
                        onClick={() => setIsPlaying(true)}
                        aria-label={`Play ${video.title}`}
                    >
                        <img
                            className="vx-card__poster"
                            src={posterUrlFor(video)}
                            alt=""
                            decoding="async"
                        />
                        <span className="vx-card__play vx-card__play--lg" aria-hidden="true" />
                        <span className="vx-card__duration" aria-hidden="true">
                            {formatDuration(video.durationSeconds)}
                        </span>
                    </button>
                )}

                <div className="vx-featured__body">
                    <div className="eyebrow">Latest · {playlistTitleFor(video.playlistId)}</div>
                    <h2 className="vx-featured__title" id="vx-featured-title">
                        {video.title}
                    </h2>
                    <p className="vx-featured__desc">{video.description}</p>
                    <div className="spec-row vx-featured__specs">
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
                    <div className="vx-featured__actions">
                        <button
                            type="button"
                            className="btn btn--primary"
                            onClick={() => setIsPlaying(true)}
                        >
                            Play now
                        </button>
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
        </section>
    )
}

/**
 * One series as a scroll-snapped shelf.
 *
 * The arrows scroll by one viewport of the rail rather than by a card width, so
 * the gesture is "next page of this series" at every breakpoint without the rail
 * having to know how many cards are visible. A series with nothing in it renders
 * nothing at all — an empty rail with a heading advertises a series the visitor
 * cannot enter.
 */
function PlaylistRail({ playlist, videos }) {
    const [railElement, setRailElement] = useState(null)

    if (videos.length === 0) {
        return null
    }

    const scrollBy = (direction) => {
        railElement?.scrollBy({
            left: direction * railElement.clientWidth * 0.8,
            behavior: 'smooth',
        })
    }

    return (
        <section className="vx-rail" aria-labelledby={`vx-rail-${playlist.id}`}>
            <header className="vx-rail__head">
                <div>
                    <h2 className="vx-rail__title" id={`vx-rail-${playlist.id}`}>
                        {playlist.title}
                    </h2>
                    {playlist.blurb && <p className="vx-rail__blurb">{playlist.blurb}</p>}
                </div>
                <div className="vx-rail__controls">
                    <span className="vx-rail__count">
                        {videos.length} {videos.length === 1 ? 'video' : 'videos'}
                    </span>
                    <button
                        type="button"
                        className="vx-rail__nav"
                        onClick={() => scrollBy(-1)}
                        aria-label={`Scroll ${playlist.title} back`}
                    >
                        <span aria-hidden="true">‹</span>
                    </button>
                    <button
                        type="button"
                        className="vx-rail__nav"
                        onClick={() => scrollBy(1)}
                        aria-label={`Scroll ${playlist.title} forward`}
                    >
                        <span aria-hidden="true">›</span>
                    </button>
                </div>
            </header>

            <div className="vx-rail__track" ref={setRailElement}>
                {videos.map((video) => (
                    <div className="vx-rail__item" key={video.videoId}>
                        <MockVideoCard video={video} size="md" showPlaylist={false} />
                    </div>
                ))}
            </div>
        </section>
    )
}

export default MockOptionA
