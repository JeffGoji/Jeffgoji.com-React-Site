/**
 * Content source for /whats-new: the dated timeline of site updates.
 *
 * Every entry traces to shipped work in the git history (the commit dates are
 * the entry dates), and every link points at a route the site actually serves,
 * so a reader can go straight to the thing that changed. App.test.jsx's route
 * list and the guard in recentUpdates.test.js keep those links honest.
 *
 * To add an update: put a new object at the TOP of the array (newest first),
 * pick one of CATEGORIES, and give it at least one link. Fields are PLAIN TEXT;
 * they are rendered as React children, never as HTML or markdown.
 *
 * Gallery links go through galleryHubPath() so a set that is renamed in
 * gallerySets.js cannot leave a stale link here. Blog links can target one post
 * with `#post-<id>`, the anchor BlogList puts on each entry.
 */

import { galleryHubPath } from '../../common/gallerySets';

/** Filter chips, in display order. */
export const CATEGORIES = ['Galleries', 'Videos', 'Build logs', 'Site', 'Fixes'];

/**
 * @typedef {Object} UpdateLink
 * @property {string} label Button text.
 * @property {string} to    In-site route (may carry a query or #hash).
 */

/**
 * @typedef {Object} RecentUpdate
 * @property {string} date     ISO date, YYYY-MM-DD.
 * @property {string} category One of CATEGORIES.
 * @property {string} title
 * @property {string} summary
 * @property {UpdateLink[]} links
 */

/** @type {RecentUpdate[]} */
export const recentUpdates = [
    {
        date: '2026-11-10',
        category: 'Galleries',
        title: 'New gallery: NB Autocross 2008–2019',
        summary:
            'Eleven years of cones, in one place. 79 photos of the NB Mazdaspeed Miata at autocross events from 2008 to 2019, from grainy early phone shots to proper trackside photography.',
        links: [{ label: 'Open the gallery', to: galleryHubPath('nb-autox') }],
    },
    {
        date: '2026-11-10',
        category: 'Fixes',
        title: 'The download button stays where you can reach it',
        summary:
            'Two lightbox fixes from October and November: on short phone screens the full-resolution download button could be pushed off the bottom edge, and on wide, short screens the photo could spill over it and swallow the click. It now stays visible and clickable at every screen size.',
        links: [{ label: 'Try it in the galleries', to: '/galleries' }],
    },
    {
        date: '2026-08-11',
        category: 'Galleries',
        title: 'Nine more photos from Miatas at the Gap 2026',
        summary:
            'The Miatas at the Gap 2026 gallery picked up nine new shots from the trip.',
        links: [{ label: 'See the new photos', to: galleryHubPath('nd-miatasatthegap2026') }],
    },
    {
        date: '2026-08-11',
        category: 'Site',
        title: 'The home page always points at the newest gallery',
        summary:
            'The gallery button on the home page hero now picks up whichever gallery was added most recently, so there is always a fresh set one click from the front door.',
        links: [{ label: 'Go to the home page', to: '/' }],
    },
    {
        date: '2026-08-10',
        category: 'Galleries',
        title: 'New gallery: Miatas at the Gap 2026',
        summary:
            'The ND at Miatas at the Gap 2026, the big Miata gathering at Deals Gap and the Tail of the Dragon.',
        links: [{ label: 'Open the gallery', to: galleryHubPath('nd-miatasatthegap2026') }],
    },
    {
        date: '2026-08-10',
        category: 'Videos',
        title: 'A proper video hub',
        summary:
            'The YouTube page used to be three hand-picked videos. It is now a full hub that keeps itself in sync with the jeffgoji.com playlist, with a featured video, a grid you can filter and sort, and a player that only loads when you press play.',
        links: [{ label: 'Watch the videos', to: '/youtube' }],
    },
    {
        date: '2026-08-10',
        category: 'Fixes',
        title: 'Navigation fixes on phones and in the gallery menu',
        summary:
            'The mobile menu now closes itself after you pick a page, long gallery submenus no longer run off the screen, and picking a gallery from the menu opens that gallery instead of always landing on Tail of the Dragon.',
        links: [{ label: 'Browse the galleries', to: '/galleries' }],
    },
    {
        date: '2026-08-05',
        category: 'Galleries',
        title: 'Download any photo at full resolution',
        summary:
            'Every photo in the gallery lightbox now has a download button for the full-resolution original, handy for wallpapers. Sideways phone photos are also rotated the right way up in every size.',
        links: [{ label: 'Open the galleries', to: '/galleries' }],
    },
    {
        date: '2026-08-05',
        category: 'Site',
        title: 'The What’s New page arrives',
        summary:
            'A permanent home for site news, with a red WHAT’S NEW pill in the navigation bar. The original launch page, with the full story of the V2 redesign, is kept in the archive.',
        links: [{ label: 'Read the V2 launch ledger', to: '/whats-new/v2-launch' }],
    },
    {
        date: '2026-08-04',
        category: 'Site',
        title: 'The V2 redesign goes live',
        summary:
            'The whole site was rebuilt with a dark motorsport look: new logo, new fonts, a sticky navigation bar, a real footer, a home page hero that picks a different car each visit, and a numbered garage with a bay for every car. The NA Miata page, the suspension guide and the Goodbye C8 article were all re-skinned to match.',
        links: [
            { label: 'Home', to: '/' },
            { label: 'The garage', to: '/garage' },
            { label: 'NA Miata', to: '/na-miata' },
            { label: 'Suspension guide', to: '/suspension' },
            { label: 'Goodbye C8', to: '/goodbye-c8' },
        ],
    },
    {
        date: '2026-08-04',
        category: 'Galleries',
        title: 'Every gallery under one roof, with a lightbox',
        summary:
            'All the photo galleries now live on a single page with a switcher across the top, and every photo opens in a full-screen lightbox. Photos load as small, fast webp images sized to your screen. Old gallery bookmarks still work and forward to the right set.',
        links: [{ label: 'Open the galleries', to: '/galleries' }],
    },
    {
        date: '2026-08-04',
        category: 'Build logs',
        title: 'Build logs redesigned',
        summary:
            'All four car build logs share a new reading layout, with date, mileage and cost shown as chips on each entry and the newest posts first.',
        links: [
            { label: 'Kasumi (ND)', to: '/nd-blog' },
            { label: 'Kiryu (NB MSM)', to: '/msm-blog' },
            { label: 'Miyoshi (NA)', to: '/na-blog' },
            { label: 'Panda (C8)', to: '/c8-blog' },
        ],
    },
    {
        date: '2026-08-01',
        category: 'Site',
        title: 'Faster pages and cookie-free analytics',
        summary:
            'The site dropped old build baggage, the home page videos stopped loading until you click them, and visitor counting moved to analytics that sets no cookies and needs no consent banner.',
        links: [{ label: 'Read the details', to: '/whats-new/v2-launch' }],
    },
    {
        date: '2026-05-27',
        category: 'Build logs',
        title: 'Kasumi at 35,000 miles',
        summary:
            'New ND build log entry: brake fluid and rear differential service at 35,000 miles, plus street impressions of the new sway bar and shock settings ahead of the next autocross.',
        links: [{ label: 'Read the entry', to: '/nd-blog#post-9' }],
    },
];
