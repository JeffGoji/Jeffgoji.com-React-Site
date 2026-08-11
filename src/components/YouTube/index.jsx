import { useCallback, useEffect, useMemo, useState } from 'react';

import FeaturedVideo from './FeaturedVideo';
import VideoCard from './VideoCard';
import VideoPlayerModal from './VideoPlayerModal';
import { EmptyState, ErrorState, LoadingStatus, VideoGridSkeleton } from './VideoStates';
import { CHANNEL_FALLBACK, loadVideoManifest } from './videoManifest';
import { VIDEO_COPY } from './videoCopy';
import { SORTS, byNewest, channelLabelFor, seriesIn, tagsIn } from './videoFormat';

/** The sentinel for "no filter on this axis". Not a playlist id or a tag. */
const ALL = '__all__';

/**
 * The videos hub at /youtube — Option B's filter grid with Option A's featured
 * hero on top of it.
 *
 * ONE OWNER FOR THE LIST
 * The hub fetches the manifest, holds it, and derives everything the surfaces
 * below it read: the featured video, the filtered and sorted list, the series
 * and tag axes, the counts. Nothing downstream recomputes any of that — the
 * cards and the overlay are handed finished values and a callback, which is what
 * keeps the grid and the count from ever disagreeing about what is on screen.
 *
 * WHY THE FILTER ROWS ARE CONDITIONAL
 * The manifest is built from ONE playlist, so `seriesIn` returns one entry and
 * the series row would be a control with a single choice — a chip row that can
 * only ever say "All" is worse than no chip row. The RSS feed carries no tags at
 * all, so that row has nothing to build from either. Both are rendered off the
 * data rather than switched off by a flag, so the day a second playlist lands in
 * the manifest the row appears with no code change, and the day it does not the
 * hub is simply a sorted grid.
 *
 * IFRAME COST
 * Grid cards never mount a player: `onOpen` lifts the click to the hub, which
 * opens the overlay, so the document holds exactly one iframe while something is
 * playing and zero the rest of the time no matter how many videos a visitor
 * works through. The hero is the one exception and plays in place, because there
 * is only ever one of it. Posters stay lazy <img>s, and a filter that hides a
 * card removes its poster request along with it.
 *
 * THE ERROR STATE IS THE STEADY STATE FOR NOW
 * Until VIDEOS_PLAYLIST_ID is configured and `videos:build` has run, there is no
 * manifest at /videos/manifest.json and this renders its error state with a link
 * to the channel. That is the intended degradation, not a defect.
 */
function VideosHub() {
    const [status, setStatus] = useState('loading');
    const [videos, setVideos] = useState([]);
    const [channel, setChannel] = useState(CHANNEL_FALLBACK);
    const [seriesId, setSeriesId] = useState(ALL);
    const [tag, setTag] = useState(ALL);
    const [sortId, setSortId] = useState(SORTS[0].id);
    const [openVideo, setOpenVideo] = useState(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let current = true;

        setStatus('loading');
        setOpenVideo(null);

        loadVideoManifest().then((result) => {
            if (!current) {
                return;
            }

            setVideos(result.items);
            setChannel(result.channel);
            setStatus(result.ok ? 'ready' : 'error');
        });

        return () => {
            current = false;
        };
    }, [attempt]);

    const series = useMemo(() => seriesIn(videos), [videos]);
    const tags = useMemo(() => tagsIn(videos), [videos]);

    /**
     * The hero is the newest video across the whole library, not the newest
     * inside the current filter: it is the page's masthead, and a masthead that
     * changes identity when a chip is pressed reads as the grid having reordered
     * rather than as a filter having applied.
     */
    const featured = useMemo(() => [...videos].sort(byNewest)[0] ?? null, [videos]);

    const visible = useMemo(() => {
        const compare = SORTS.find((sort) => sort.id === sortId)?.compare ?? SORTS[0].compare;

        return videos
            .filter(
                (video) =>
                    (seriesId === ALL || video.playlistId === seriesId) &&
                    (tag === ALL || (video.tags ?? []).includes(tag))
            )
            .sort(compare);
    }, [videos, seriesId, tag, sortId]);

    const reset = useCallback(() => {
        setSeriesId(ALL);
        setTag(ALL);
    }, []);

    const isFiltered = seriesId !== ALL || tag !== ALL;
    const showSeriesRow = series.length > 1;
    const showTagRow = tags.length > 0;
    const showFilterBar = status === 'ready' && videos.length > 0;
    const hasGrid = status === 'ready' && visible.length > 0;

    return (
        <div className="videos-hub">
            <header className="videos-hub__head">
                <div className="videos-hub__inner">
                    <div className="eyebrow">{VIDEO_COPY.hub.eyebrow}</div>
                    <h1 className="videos-hub__title">{VIDEO_COPY.hub.title}</h1>
                    <p className="videos-hub__lead">
                        {VIDEO_COPY.hub.leadPrefix}
                        <a
                            href={channel.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="videos-hub__channel"
                        >
                            {channelLabelFor(channel)}
                        </a>
                        {VIDEO_COPY.hub.leadSuffix}
                    </p>
                </div>
            </header>

            {status === 'ready' && featured && (
                <FeaturedVideo video={featured} showSeries={showSeriesRow} />
            )}

            {showFilterBar && (
                <div className="videos-filterbar">
                    <div className="videos-hub__inner">
                        {showSeriesRow && (
                            <div className="videos-filterbar__row">
                                <span className="label videos-filterbar__label">
                                    {VIDEO_COPY.filters.seriesLabel}
                                </span>
                                <div
                                    className="videos-filterbar__chips"
                                    role="group"
                                    aria-label={VIDEO_COPY.filters.seriesGroup}
                                >
                                    <FilterChip
                                        label={VIDEO_COPY.filters.all}
                                        active={seriesId === ALL}
                                        onClick={() => setSeriesId(ALL)}
                                    />
                                    {series.map((entry) => (
                                        <FilterChip
                                            key={entry.id}
                                            label={entry.title}
                                            active={seriesId === entry.id}
                                            onClick={() => setSeriesId(entry.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {showTagRow && (
                            <div className="videos-filterbar__row">
                                <span className="label videos-filterbar__label">
                                    {VIDEO_COPY.filters.tagLabel}
                                </span>
                                <div
                                    className="videos-filterbar__chips"
                                    role="group"
                                    aria-label={VIDEO_COPY.filters.tagGroup}
                                >
                                    <FilterChip
                                        label={VIDEO_COPY.filters.any}
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
                        )}

                        <div className="videos-filterbar__row videos-filterbar__row--end">
                            <span className="videos-filterbar__count">
                                {VIDEO_COPY.filters.countOf(visible.length, videos.length)}
                            </span>
                            <label className="label" htmlFor="videos-sort">
                                {VIDEO_COPY.filters.sortLabel}
                            </label>
                            <select
                                id="videos-sort"
                                className="select videos-filterbar__sort"
                                value={sortId}
                                onChange={(event) => setSortId(event.target.value)}
                            >
                                {SORTS.map((sort) => (
                                    <option key={sort.id} value={sort.id}>
                                        {sort.label}
                                    </option>
                                ))}
                            </select>
                            {(showSeriesRow || showTagRow) && (
                                <button
                                    type="button"
                                    className="btn btn--ghost btn--sm videos-filterbar__reset"
                                    onClick={reset}
                                    disabled={!isFiltered}
                                >
                                    {VIDEO_COPY.filters.clear}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div
                className={`videos-hub__inner videos-hub__body${
                    hasGrid ? '' : ' videos-hub__body--reserved'
                }`}
            >
                {status === 'loading' && (
                    <>
                        <LoadingStatus />
                        <VideoGridSkeleton count={9} size="sm" />
                    </>
                )}

                {status === 'error' && (
                    <ErrorState
                        channelUrl={channel.url}
                        onRetry={() => setAttempt((value) => value + 1)}
                    />
                )}

                {status === 'ready' && videos.length === 0 && <EmptyState />}

                {status === 'ready' && videos.length > 0 && visible.length === 0 && (
                    <EmptyState
                        title={VIDEO_COPY.states.filteredTitle}
                        hint={VIDEO_COPY.states.filteredHint}
                        onReset={reset}
                    />
                )}

                {hasGrid && (
                    <div className="video-grid video-grid--sm">
                        {visible.map((video) => (
                            <VideoCard
                                key={video.videoId}
                                video={video}
                                size="sm"
                                showSeries={showSeriesRow}
                                onOpen={setOpenVideo}
                            />
                        ))}
                    </div>
                )}
            </div>

            {openVideo && (
                <VideoPlayerModal
                    video={openVideo}
                    showSeries={showSeriesRow}
                    onClose={() => setOpenVideo(null)}
                />
            )}
        </div>
    );
}

/**
 * A filter chip.
 *
 * It borrows the site's `.chip` telemetry look rather than inventing a control,
 * but ships as a <button> with `aria-pressed`: the visual chip is a static data
 * badge everywhere else on the site, and a toggle that signals its state with a
 * colour alone is unusable without sight of it.
 *
 * @param {{label: string, active: boolean, onClick: () => void}} props
 */
function FilterChip({ label, active, onClick }) {
    return (
        <button
            type="button"
            className={`chip chip--toggle${active ? ' is-on' : ''}`}
            aria-pressed={active}
            onClick={onClick}
        >
            {label}
        </button>
    );
}

export default VideosHub;
