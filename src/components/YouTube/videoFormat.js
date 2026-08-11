/**
 * The presentation rules every videos surface shares.
 *
 * Ported from the mockups' videoFormat.js minus everything the RSS feed cannot
 * supply. `formatDuration`, `formatViews` and the "most watched" / "longest
 * first" sorts are deliberately absent rather than stubbed: the playlist RSS
 * feed carries no duration at all and no trustworthy view count, and a formatter
 * with no data behind it is how an invented number reaches a card.
 */

import { VIDEO_COPY } from './videoCopy';

/**
 * hqdefault is the one rendition YouTube guarantees for every video — maxres
 * 404s on anything never uploaded at 720p+, which would leave a broken poster.
 * The feed normally supplies its own thumbnail URL and the build script prefers
 * it; this is the fallback for a manifest item that arrived without one.
 */
export const posterUrlFor = (video) =>
    video.thumbnailUrl || `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`;

/**
 * autoplay=1 is what keeps the facade a one-click affordance: the click that
 * mounts the player is the click that starts it, rather than the visitor paying
 * for the swap with a second click on YouTube's own play button.
 */
export const embedUrlFor = (videoId) => `https://www.youtube.com/embed/${videoId}?autoplay=1`;

export const watchUrlFor = (videoId) => `https://www.youtube.com/watch?v=${videoId}`;

/** Month + year only: a card meta line has no room for a day and no use for one. */
export function formatPublished(isoDate) {
    return new Date(isoDate).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
    });
}

export function formatPublishedLong(isoDate) {
    return new Date(isoDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
}

/** Newest first. The channel's own default and the only order that needs no label. */
export const byNewest = (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt);

/**
 * The two orders `publishedAt` can express, and the only two the feed supports.
 *
 * Kept as a list rather than a boolean so a third order becomes a data edit if
 * the manifest ever grows a field that can carry one.
 */
export const SORTS = [
    { id: 'newest', label: VIDEO_COPY.sorts.newest, compare: byNewest },
    { id: 'oldest', label: VIDEO_COPY.sorts.oldest, compare: (a, b) => -byNewest(a, b) },
];

/**
 * Every distinct series across a set, in newest-first order of first appearance,
 * carrying whichever title the manifest recorded for it.
 *
 * Derived rather than declared so a chip row cannot advertise a filter that
 * matches nothing — and so that a manifest holding exactly one playlist (which
 * is the whole of today's data) yields exactly one entry, which is what lets the
 * hub decide not to render the row at all.
 */
export function seriesIn(videos) {
    const byId = new Map();

    for (const video of videos) {
        if (video.playlistId && !byId.has(video.playlistId)) {
            byId.set(video.playlistId, {
                id: video.playlistId,
                title: video.seriesTitle || video.playlistId,
            });
        }
    }

    return [...byId.values()];
}

/**
 * Every distinct tag across a set, in first-appearance order.
 *
 * The RSS feed carries no tags, so this returns an empty list against today's
 * manifest and the tag row does not render. It is kept rather than removed
 * because the manifest schema tolerates a `tags` array and a future authoring
 * step could fill one without touching the hub.
 */
export function tagsIn(videos) {
    return [...new Set(videos.flatMap((video) => video.tags ?? []))];
}

/**
 * The label for the channel link, degrading to generic copy when the manifest
 * failed to load and there is no channel title to name.
 */
export function channelLabelFor(channel) {
    return channel?.title || VIDEO_COPY.hub.channelFallbackLabel;
}
