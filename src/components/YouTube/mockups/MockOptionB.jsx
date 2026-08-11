import { useMemo, useState } from 'react'

import MockPlayerModal from './MockPlayerModal'
import MockVideoCard from './MockVideoCard'
import { EmptyState, ErrorState, LoadingStatus, VideoGridSkeleton } from './MockStates'
import { CHANNEL, SAMPLE_PLAYLISTS, SAMPLE_VIDEOS } from './sampleVideos'
import { SORTS, tagsIn } from './videoFormat'

const ALL = '__all__'

/**
 * MOCKUP OPTION B — "Filter Grid".
 *
 * One dense grid over the whole library, narrowed by a sticky filter bar: a chip
 * row of series, a second chip row of tags (car chassis and content kind), and a
 * sort control. Cards activate into a single overlay player rather than swapping
 * in place.
 *
 * WHY TWO CHIP ROWS RATHER THAN ONE SWITCHER
 * The two axes are genuinely independent — "everything on the ND" cuts across
 * every series, and "all the autocross" cuts across every car — and a single
 * <select> can only express one of them. Chips also show the shape of the
 * library at rest: a visitor reads what the channel is about without interacting
 * with anything. Both rows are built from the data (`SAMPLE_PLAYLISTS` and a
 * derived tag set), so a new series or a new car appears without a code change.
 *
 * WHY THE COUNT AND THE CLEAR CONTROL ARE ALWAYS PRESENT
 * Multi-axis filters are the easy way to reach an empty result and not
 * understand why. A live count in the timing-sheet voice plus a permanently
 * available reset is the cheapest fix; the empty state repeats the reset rather
 * than making the visitor scroll back to the bar.
 *
 * IFRAME COST
 * Cards never mount a player. `onOpen` lifts the click to the hub, which opens
 * MockPlayerModal — so the document holds exactly one iframe while something is
 * playing and zero the rest of the time, no matter how many videos the visitor
 * works through in a session. Closing unmounts it, which is also what stops
 * playback. Posters stay lazy <img>s, and a filter that hides a card removes its
 * poster request along with it.
 *
 * @param {object} props
 * @param {'ready'|'loading'|'empty'|'error'} [props.state]
 * @param {() => void} [props.onRetry]
 */
function MockOptionB({ state = 'ready', onRetry }) {
    const [playlistId, setPlaylistId] = useState(ALL)
    const [tag, setTag] = useState(ALL)
    const [sortId, setSortId] = useState(SORTS[0].id)
    const [openVideo, setOpenVideo] = useState(null)

    const tags = useMemo(() => tagsIn(SAMPLE_VIDEOS), [])

    const visible = useMemo(() => {
        const compare = SORTS.find((sort) => sort.id === sortId)?.compare ?? SORTS[0].compare

        return SAMPLE_VIDEOS.filter(
            (video) =>
                (playlistId === ALL || video.playlistId === playlistId) &&
                (tag === ALL || video.tags.includes(tag))
        ).sort(compare)
    }, [playlistId, tag, sortId])

    const reset = () => {
        setPlaylistId(ALL)
        setTag(ALL)
    }

    const isFiltered = playlistId !== ALL || tag !== ALL

    return (
        <div className="vx-hub vx-hub--b">
            <header className="vx-hub__head">
                <div className="vx-hub__inner">
                    <div className="eyebrow">On camera</div>
                    <h1 className="vx-hub__title">Videos</h1>
                    <p className="vx-hub__lead">
                        Every upload from{' '}
                        <a
                            href={CHANNEL.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="vx-hub__channel"
                        >
                            {CHANNEL.handle}
                        </a>{' '}
                        in one place. Filter by series or by car.
                    </p>
                </div>
            </header>

            <div className="vx-filterbar">
                <div className="vx-hub__inner">
                    <div className="vx-filterbar__row">
                        <span className="label vx-filterbar__label">Series</span>
                        <div className="vx-chips" role="group" aria-label="Filter by series">
                            <FilterChip
                                label="All"
                                active={playlistId === ALL}
                                onClick={() => setPlaylistId(ALL)}
                            />
                            {SAMPLE_PLAYLISTS.map((playlist) => (
                                <FilterChip
                                    key={playlist.id}
                                    label={playlist.title}
                                    active={playlistId === playlist.id}
                                    onClick={() => setPlaylistId(playlist.id)}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="vx-filterbar__row">
                        <span className="label vx-filterbar__label">Tagged</span>
                        <div className="vx-chips" role="group" aria-label="Filter by tag">
                            <FilterChip
                                label="Any"
                                active={tag === ALL}
                                onClick={() => setTag(ALL)}
                            />
                            {tags.map((value) => (
                                <FilterChip
                                    key={value}
                                    label={value}
                                    active={tag === value}
                                    onClick={() => setTag(value)}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="vx-filterbar__row vx-filterbar__row--end">
                        <span className="vx-filterbar__count">
                            {visible.length} of {SAMPLE_VIDEOS.length}
                        </span>
                        <label className="label" htmlFor="vx-b-sort">
                            Sort
                        </label>
                        <select
                            id="vx-b-sort"
                            className="select vx-filterbar__sort"
                            value={sortId}
                            onChange={(event) => setSortId(event.target.value)}
                        >
                            {SORTS.map((sort) => (
                                <option key={sort.id} value={sort.id}>
                                    {sort.label}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            className="btn btn--ghost btn--sm vx-filterbar__reset"
                            onClick={reset}
                            disabled={!isFiltered}
                        >
                            Clear
                        </button>
                    </div>
                </div>
            </div>

            <div
                className={`vx-hub__inner vx-hub__body${
                    state === 'ready' && visible.length > 0 ? '' : ' vx-hub__body--reserved'
                }`}
            >
                {state === 'loading' && (
                    <>
                        <LoadingStatus label="Loading videos" />
                        <VideoGridSkeleton count={9} size="sm" />
                    </>
                )}

                {state === 'error' && (
                    <ErrorState channelUrl={CHANNEL.url} onRetry={onRetry} />
                )}

                {state === 'empty' && (
                    <EmptyState
                        title="The channel index is empty"
                        hint="Nothing has been published to the site yet."
                    />
                )}

                {state === 'ready' && visible.length === 0 && (
                    <EmptyState
                        title="No videos match those filters"
                        hint="That combination of series and tag has nothing in it yet."
                        onReset={reset}
                    />
                )}

                {state === 'ready' && visible.length > 0 && (
                    <div className="vx-grid vx-grid--sm">
                        {visible.map((video) => (
                            <MockVideoCard
                                key={video.videoId}
                                video={video}
                                size="sm"
                                onOpen={setOpenVideo}
                            />
                        ))}
                    </div>
                )}
            </div>

            {openVideo && (
                <MockPlayerModal video={openVideo} onClose={() => setOpenVideo(null)} />
            )}
        </div>
    )
}

/**
 * A filter chip.
 *
 * It borrows the site's `.chip` telemetry look rather than inventing a control,
 * but ships as a <button> with `aria-pressed`: the visual chip is a static data
 * badge everywhere else on the site, and a toggle that only signals its state
 * with a colour is unusable without sight of it.
 */
function FilterChip({ label, active, onClick }) {
    return (
        <button
            type="button"
            className={`chip vx-chip${active ? ' vx-chip--on' : ''}`}
            aria-pressed={active}
            onClick={onClick}
        >
            {label}
        </button>
    )
}

export default MockOptionB
