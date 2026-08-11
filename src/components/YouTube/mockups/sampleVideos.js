/**
 * MOCKUP DATA — design exploration only. Not imported by the running app.
 *
 * Nothing under components/YouTube/mockups/ is wired into App.jsx's route table.
 * The folder exists so the CPO can compare three Videos-hub layouts against real
 * V2 chrome before any of them is built for production.
 *
 * SHAPE CONTRACT
 * The fields below are named after the YouTube Data API v3 responses a build-time
 * fetch script would join, so the wiring step is a rename-free port:
 *
 *   videoId        <- playlistItems.snippet.resourceId.videoId
 *   title          <- videos.snippet.title
 *   description    <- videos.snippet.description (first paragraph only; the API
 *                     returns the whole box, including link dumps)
 *   publishedAt    <- videos.snippet.publishedAt (ISO 8601)
 *   durationSeconds<- videos.contentDetails.duration, parsed from ISO 8601
 *                     ("PT6M52S"). Stored as a number, not the raw string: every
 *                     consumer here sorts or formats it, and neither works on
 *                     "PT6M52S".
 *   viewCount      <- videos.statistics.viewCount (the API sends a STRING; the
 *                     fetch script must Number() it or the "most viewed" sort
 *                     will compare lexically and rank 9 above 41200)
 *   playlistId     <- playlists.id
 *   thumbnailUrl   <- videos.snippet.thumbnails.high.url
 *   tags           — DERIVED, not from the API. See TAG NOTE below.
 *
 * `mockPosterUrl` is the one field with no API counterpart and it MUST NOT
 * survive wiring. Nine of the twelve videos below are invented, so their
 * img.youtube.com posters would 404 and the grids would evaluate as broken
 * layouts rather than as designs. Those nine borrow a real webp off the gallery
 * pipeline in public/gallery/ instead. The three with a null mockPosterUrl are
 * the channel's actual uploads (the ids already in components/YouTube/videos.js)
 * and pull their real posters, which is what proves the facade path still works.
 *
 * TAG NOTE
 * Categorisation is deliberately data-driven in two independent axes rather than
 * hardcoded to any category name, because the channel's real playlist set is not
 * known yet:
 *   - `playlistId` — the channel's own ordering, one per video, exclusive.
 *   - `tags` — free-form, many per video, non-exclusive (car chassis, kind of
 *     content). Option B filters on these; A and C ignore them.
 * A component that switch/cases on a literal like 'Autocross' has to be edited
 * when the channel adds a series. None of the three options do.
 */

/** The channel these mockups showcase. */
export const CHANNEL = {
    handle: '@jeffgoji673',
    title: 'JeffGoji',
    url: 'https://www.youtube.com/@jeffgoji673',
    subscriberCount: 412,
    videoCount: 12,
}

/**
 * The channel's series.
 *
 * `blurb` has no API counterpart worth trusting — playlists.snippet.description
 * is usually empty on a hobby channel — so treat it as hand-authored copy the
 * fetch script leaves alone. Options A and C both print it; a null blurb has to
 * degrade to no line rather than to an empty element with margin.
 */
export const SAMPLE_PLAYLISTS = [
    {
        id: 'PLautocross',
        title: 'Autocross',
        blurb: 'Cone runs, fastest laps and the occasional expensive lesson.',
    },
    {
        id: 'PLbuild',
        title: 'Build & Install',
        blurb: 'Wrenching, start to finish, at the pace it actually happened.',
    },
    {
        id: 'PLdrives',
        title: 'Great Drives',
        blurb: 'Long roads, good weather, no cones anywhere.',
    },
    {
        id: 'PLonboard',
        title: 'Onboard & Track',
        blurb: 'Camera on the roll bar, talking kept to a minimum.',
    },
    {
        id: 'PLevents',
        title: 'Event Coverage',
        blurb: 'Meets, road trips and whatever the paddock was doing.',
    },
]

/**
 * @typedef {object} SampleVideo
 * @property {string} videoId
 * @property {string} title
 * @property {string} description
 * @property {string} publishedAt
 * @property {number} durationSeconds
 * @property {number} viewCount
 * @property {string} playlistId
 * @property {string[]} tags
 * @property {string|null} mockPosterUrl Mockup-only. Drop at wiring time.
 */

/** @type {SampleVideo[]} */
export const SAMPLE_VIDEOS = [
    {
        videoId: 'A1matg2026',
        title:
            'Miatas at the Gap 2026 — four days, eleven mountain roads and one very tired ND',
        description:
            'The whole trip cut down to the parts worth keeping: the Gap itself, the Cherohala, and the parking lot at the end of it.',
        publishedAt: '2026-08-09T14:00:00Z',
        durationSeconds: 863,
        viewCount: 1290,
        playlistId: 'PLevents',
        tags: ['ND Miata', 'Road trip', 'Event'],
        mockPosterUrl: '/gallery/nd-miatasatthegap2026/display/20260808_124814.jpg.webp',
    },
    {
        videoId: 'A2ohlins',
        title: 'Ohlins Road & Track on the ND — the full install',
        description:
            'Corner weights, ride height, and every bolt I rounded off getting the old struts out.',
        publishedAt: '2025-06-21T16:30:00Z',
        durationSeconds: 1735,
        viewCount: 11840,
        playlistId: 'PLbuild',
        tags: ['ND Miata', 'Suspension', 'Install'],
        mockPosterUrl: '/gallery/nd-totd2025/display/5065083.jpg.webp',
    },
    {
        videoId: 'A3totd',
        title: 'Tail of the Dragon 2025 — the whole run, uncut',
        description: '318 corners, no edit, no music. Put it on in the background.',
        publishedAt: '2025-05-12T09:15:00Z',
        durationSeconds: 2951,
        viewCount: 7405,
        playlistId: 'PLdrives',
        tags: ['ND Miata', 'Road trip', 'Onboard'],
        mockPosterUrl: '/gallery/nd-totd2025/display/5065082.jpg.webp',
    },
    {
        videoId: 'UySrXUfHA_k',
        title: "Jeff's fastest run — LSR PCA autocross",
        description: 'Clean run, finally. The one before this had two cones in it.',
        publishedAt: '2025-03-16T18:45:00Z',
        durationSeconds: 231,
        viewCount: 4213,
        playlistId: 'PLautocross',
        tags: ['ND Miata', 'Autocross'],
        mockPosterUrl: null,
    },
    {
        videoId: 'Q2B8mA3vgP0',
        title: 'Houston BMW/PCA autocross — full session',
        description: 'All six runs, including the two that were not worth keeping.',
        publishedAt: '2025-02-09T20:00:00Z',
        durationSeconds: 1462,
        viewCount: 2870,
        playlistId: 'PLautocross',
        tags: ['ND Miata', 'Autocross'],
        mockPosterUrl: null,
    },
    {
        videoId: 'XVjs7LRCBak',
        title: "Jeff's fastest run — Houston BMW/PCA autocross",
        description: 'The one run out of six that came together.',
        publishedAt: '2025-02-09T20:20:00Z',
        durationSeconds: 187,
        viewCount: 5602,
        playlistId: 'PLautocross',
        tags: ['ND Miata', 'Autocross'],
        mockPosterUrl: null,
    },
    {
        videoId: 'A7c8autox',
        title: 'C8 first autocross — learning the car the hard way',
        description:
            'Mid-engine, 3,600 lb, and a course designed for Miatas. It went how you would expect.',
        publishedAt: '2024-09-21T15:00:00Z',
        durationSeconds: 622,
        viewCount: 9034,
        playlistId: 'PLautocross',
        tags: ['C8 Corvette', 'Autocross'],
        mockPosterUrl: '/gallery/c8-autox/display/c8s-002.jpg.webp',
    },
    {
        videoId: 'A8c8onboard',
        title: 'C8 Z51 onboard — Sunday morning laps',
        description: 'No commentary. Exhaust does the talking.',
        publishedAt: '2024-09-22T11:00:00Z',
        durationSeconds: 401,
        viewCount: 3311,
        playlistId: 'PLonboard',
        tags: ['C8 Corvette', 'Onboard'],
        mockPosterUrl: '/gallery/c8-autox/display/1726961254977.jpg.webp',
    },
    {
        videoId: 'A9msmboost',
        title: 'Mazdaspeed Miata boost leak — chasing 3 psi for a week',
        description:
            'Smoke tester, six clamps, and the one hose nobody checks. Longest week of the build.',
        publishedAt: '2023-11-04T13:00:00Z',
        durationSeconds: 1104,
        viewCount: 18620,
        playlistId: 'PLbuild',
        tags: ['NB Mazdaspeed', 'Turbo', 'Diagnosis'],
        mockPosterUrl: '/gallery/nb-hillcountry/display/20221108_195054.jpg.webp',
    },
    {
        videoId: 'B1msmhill',
        title: 'Texas Hill Country in the MSM — Willow City Loop',
        description: 'Boost, bluebonnets, and a cattle guard I took far too fast.',
        publishedAt: '2023-06-18T08:30:00Z',
        durationSeconds: 738,
        viewCount: 2205,
        playlistId: 'PLdrives',
        tags: ['NB Mazdaspeed', 'Road trip'],
        mockPosterUrl: '/gallery/nb-hillcountry/display/20221110_172909.jpg.webp',
    },
    {
        videoId: 'B2ncyellow',
        title: 'Yellowstone in an NC — 4,800 miles with no air conditioning',
        description: 'Two weeks, one Miata, and a decision I would make again.',
        publishedAt: '2015-08-02T17:00:00Z',
        durationSeconds: 1583,
        viewCount: 41200,
        playlistId: 'PLdrives',
        tags: ['NC Miata', 'Road trip'],
        mockPosterUrl: '/gallery/nc-yellowstone15/display/nc-15.jpg.webp',
    },
    {
        videoId: 'B3nceast',
        title: 'East Coast trip 2015 — the long way to Maine',
        description: 'Before the channel had a name. Camera was a phone on a vent mount.',
        publishedAt: '2015-07-06T12:00:00Z',
        durationSeconds: 1247,
        viewCount: 15980,
        playlistId: 'PLdrives',
        tags: ['NC Miata', 'Road trip'],
        mockPosterUrl: '/gallery/nc-eastcoast15/display/nc-9.jpg.webp',
    },
]

/**
 * The video the hub leads with.
 *
 * Held as an explicit id rather than "whatever sorts newest" so the CPO can see
 * the featured treatment carrying a hand-picked video. Production can key it off
 * either rule; the layout does not care which, but a hand-pick needs somewhere
 * to live and this is it.
 */
export const FEATURED_VIDEO_ID = 'A1matg2026'

export default SAMPLE_VIDEOS
