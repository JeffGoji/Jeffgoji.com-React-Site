/**
 * MOCKUP HELPERS — design exploration only.
 *
 * The presentation rules the three layout options share. They live apart from
 * the options so a difference between A, B and C is always a layout difference
 * and never an accidental formatting one.
 */

import { SAMPLE_PLAYLISTS } from './sampleVideos'

/**
 * hqdefault is the one rendition YouTube guarantees for every video, matching
 * the production VideoCard. maxres 404s on anything never uploaded at 720p+,
 * which would leave a broken poster.
 */
export const posterUrlFor = (video) =>
    video.mockPosterUrl ?? `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`

/**
 * autoplay=1 keeps the facade a one-click affordance: the click that mounts the
 * player is the click that starts it. Same contract as production.
 */
export const embedUrlFor = (videoId) =>
    `https://www.youtube.com/embed/${videoId}?autoplay=1`

export const watchUrlFor = (videoId) => `https://www.youtube.com/watch?v=${videoId}`

/**
 * Timing-sheet duration: m:ss under an hour, h:mm:ss over it.
 *
 * The hour segment is not zero-padded and the minute segment is padded only when
 * an hour is present, which is how every video platform writes it — "6:52", not
 * "06:52", but "1:04:20".
 */
export function formatDuration(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const paddedSeconds = String(seconds).padStart(2, '0')

    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`
        : `${minutes}:${paddedSeconds}`
}

/**
 * Compact view counts. Thousands collapse to one decimal ("41.2K") so a card's
 * meta line cannot grow wide enough to wrap under a long duration.
 */
export function formatViews(count) {
    if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M views`
    }

    if (count >= 1000) {
        return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K views`
    }

    return `${count} views`
}

/** Month + year only: a card meta line has no room for a day and no use for one. */
export function formatPublished(isoDate) {
    return new Date(isoDate).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
    })
}

export function formatPublishedLong(isoDate) {
    return new Date(isoDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    })
}

export function playlistTitleFor(playlistId) {
    return SAMPLE_PLAYLISTS.find((playlist) => playlist.id === playlistId)?.title ?? 'Videos'
}

/**
 * Every distinct tag across a set, in first-appearance order.
 *
 * Derived rather than declared so a chip row cannot advertise a filter that
 * matches nothing, which is the failure mode of a hand-maintained tag list.
 */
export function tagsIn(videos) {
    return [...new Set(videos.flatMap((video) => video.tags))]
}

/** Newest first. The channel's own default and the only order that needs no label. */
export const byNewest = (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)

export const SORTS = [
    { id: 'newest', label: 'Newest first', compare: byNewest },
    { id: 'oldest', label: 'Oldest first', compare: (a, b) => -byNewest(a, b) },
    { id: 'views', label: 'Most watched', compare: (a, b) => b.viewCount - a.viewCount },
    {
        id: 'longest',
        label: 'Longest first',
        compare: (a, b) => b.durationSeconds - a.durationSeconds,
    },
]
