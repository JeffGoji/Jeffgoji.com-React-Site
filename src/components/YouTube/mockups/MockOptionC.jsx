import { useState } from 'react'

import MockVideoCard from './MockVideoCard'
import { EmptyState, ErrorState, LoadingStatus, VideoGridSkeleton } from './MockStates'
import { CHANNEL, SAMPLE_PLAYLISTS, SAMPLE_VIDEOS } from './sampleVideos'
import { byNewest, formatDuration, formatViews } from './videoFormat'

/**
 * MOCKUP OPTION C — "Series Hub".
 *
 * The galleries hub's shape, applied to video. A head band carries the selected
 * series' name, its blurb and a "Choose series" <select>; the body shows that
 * series' newest upload at double width followed by the rest of it in a grid.
 * One series is on screen at a time.
 *
 * WHY IT MIRRORS GalleryHub
 * The site already taught its visitors this interaction on /galleries, and it is
 * the only option of the three whose nav, URL and page all agree: a series is a
 * selectable thing with a name, so it can be a query parameter, a nav entry and
 * a page title at once — exactly what `galleryHubPath(slug)` does for photos.
 * That buys deep links and a per-series nav dropdown for free. The tradeoff is
 * that nothing crosses series: there is no "newest across the channel" view and
 * no way to see the whole library at once, so a visitor who does not already
 * know which series they want has to try them.
 *
 * The lead card is the one deviation from the gallery hub, and it is there
 * because video has a natural "watch this one" that photos do not — a grid of
 * equal-weight thumbnails gives a visitor no reason to start anywhere.
 *
 * IFRAME COST
 * Production's facade, unchanged, activating in place. Switching series unmounts
 * the previous series' cards and any player among them, so a session spent
 * browsing series never accumulates iframes — the switcher does the cleanup the
 * modal does in Option B, as a side effect of what it already is.
 *
 * @param {object} props
 * @param {'ready'|'loading'|'empty'|'error'} [props.state]
 * @param {() => void} [props.onRetry]
 */
function MockOptionC({ state = 'ready', onRetry }) {
    const [playlistId, setPlaylistId] = useState(SAMPLE_PLAYLISTS[0].id)

    const playlist =
        SAMPLE_PLAYLISTS.find((entry) => entry.id === playlistId) ?? SAMPLE_PLAYLISTS[0]

    const videos = SAMPLE_VIDEOS.filter((video) => video.playlistId === playlist.id).sort(
        byNewest
    )

    const [lead, ...rest] = videos
    const totalRuntime = videos.reduce((sum, video) => sum + video.durationSeconds, 0)
    const hasVideos = state === 'ready' && videos.length > 0

    return (
        <div className="vx-hub vx-hub--c">
            <header className="vx-hub__head">
                <div className="vx-hub__inner">
                    <div className="eyebrow">On camera · {CHANNEL.handle}</div>
                    <h1 className="vx-hub__title">{playlist.title}</h1>
                    {playlist.blurb && <p className="vx-hub__lead">{playlist.blurb}</p>}

                    <div className="spec-row vx-hub__chooser">
                        <label className="label" htmlFor="vx-c-series">
                            Choose series
                        </label>
                        <select
                            id="vx-c-series"
                            className="select vx-hub__select"
                            value={playlist.id}
                            onChange={(event) => setPlaylistId(event.target.value)}
                        >
                            {SAMPLE_PLAYLISTS.map((entry) => (
                                <option key={entry.id} value={entry.id}>
                                    {entry.title}
                                </option>
                            ))}
                        </select>
                        {hasVideos && (
                            <>
                                <span className="chip">
                                    <b>Videos</b> {videos.length}
                                </span>
                                <span className="chip">
                                    <b>Runtime</b> {formatDuration(totalRuntime)}
                                </span>
                                <span className="chip">
                                    <b>Views</b>{' '}
                                    {formatViews(
                                        videos.reduce((sum, video) => sum + video.viewCount, 0)
                                    )}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <div
                className={`vx-hub__inner vx-hub__body${
                    hasVideos ? '' : ' vx-hub__body--reserved'
                }`}
            >
                {state === 'loading' && (
                    <>
                        <LoadingStatus label={`Loading ${playlist.title}`} />
                        <VideoGridSkeleton count={6} size="md" />
                    </>
                )}

                {state === 'error' && (
                    <ErrorState channelUrl={CHANNEL.url} onRetry={onRetry} />
                )}

                {state === 'empty' && (
                    <EmptyState
                        title={`Nothing in ${playlist.title} yet`}
                        hint="Pick another series — this one has not been filled in."
                    />
                )}

                {state === 'ready' && videos.length === 0 && (
                    <EmptyState
                        title={`Nothing in ${playlist.title} yet`}
                        hint="Pick another series — this one has not been filled in."
                    />
                )}

                {hasVideos && (
                    <>
                        <div className="vx-lead">
                            <MockVideoCard video={lead} size="lg" showPlaylist={false} />
                        </div>

                        {rest.length > 0 && (
                            <>
                                <h2 className="vx-hub__subhead">
                                    More from {playlist.title}
                                </h2>
                                <div className="vx-grid vx-grid--md">
                                    {rest.map((video) => (
                                        <MockVideoCard
                                            key={video.videoId}
                                            video={video}
                                            size="md"
                                            showPlaylist={false}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

export default MockOptionC
