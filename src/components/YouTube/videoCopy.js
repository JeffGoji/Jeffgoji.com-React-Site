/**
 * Every user-visible string on the videos surfaces, in one place.
 *
 * WHY THIS EXISTS IN A SITE WITH NO i18n LIBRARY
 * This project ships no translation layer and none is warranted at its size, but
 * two of the properties an i18n layer buys are worth having anyway and cost
 * nothing here: copy is editable without opening a component, and the tests can
 * assert against a key rather than against resolved English — so rewording the
 * hub does not fail the suite. If an i18n primitive is ever adopted, this object
 * is the extraction list and every call site is already indirected through it.
 *
 * Values are plain strings rather than lookup calls on purpose: a fake `t()`
 * over a literal map would imply a translation pipeline that does not exist.
 */
export const VIDEO_COPY = {
    hub: {
        eyebrow: 'On camera',
        title: 'Videos',
        leadPrefix: 'Builds, autocross runs and long drives from ',
        leadSuffix: '.',
        channelFallbackLabel: 'the YouTube channel',
    },
    featured: {
        eyebrowPrefix: 'Latest',
        publishedLabel: 'Published',
        seriesLabel: 'Series',
        play: 'Play now',
        watch: 'Watch on YouTube',
    },
    filters: {
        seriesLabel: 'Series',
        seriesGroup: 'Filter by series',
        tagLabel: 'Tagged',
        tagGroup: 'Filter by tag',
        all: 'All',
        any: 'Any',
        sortLabel: 'Sort',
        clear: 'Clear',
        countOf: (shown, total) => `${shown} of ${total}`,
    },
    sorts: {
        newest: 'Newest first',
        oldest: 'Oldest first',
    },
    card: {
        playPrefix: 'Play',
    },
    modal: {
        close: 'Close player',
        publishedLabel: 'Published',
        watch: 'Watch on YouTube',
    },
    states: {
        loading: 'Loading videos',
        emptyEyebrow: 'Nothing to play',
        emptyTitle: 'The video list is empty',
        emptyHint: 'Nothing has been published to the site yet.',
        filteredTitle: 'No videos match those filters',
        filteredHint: 'That combination of series and tag has nothing in it yet.',
        clearFilters: 'Clear filters',
        errorEyebrow: 'Off track',
        errorTitle: 'The video list did not load',
        errorBody:
            'Something went wrong fetching the channel index. Everything is still on YouTube in the meantime.',
        retry: 'Try again',
        openChannel: 'Open the channel',
    },
    teaser: {
        eyebrow: 'On camera',
        title: 'Videos',
        sub: 'Onboards, build recaps and autocross runs from the YouTube channel.',
        all: 'All videos',
        fallback: 'The latest uploads are on the channel.',
    },
};
