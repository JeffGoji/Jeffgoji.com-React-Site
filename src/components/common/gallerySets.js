/**
 * The galleries the hub offers, in switcher order.
 *
 * `slug` is the directory the build pipeline writes under `public/gallery/`, so
 * it is also the fetch path segment — NOT the pre-V2 route name. Two of these
 * slugs are live today (`nd-totd2025`, `nd-hillcountry` are configured in
 * scripts/build-gallery.mjs); the other four are the ids Feature C's AC-009
 * rewire is expected to emit when it moves the remaining sets onto sharp. A set
 * whose manifest is not on disk yet renders the hub's empty state rather than
 * failing, which is what lets this ship ahead of that pipeline work.
 *
 * `legacyPath` records which pre-V2 route each set replaces. It is the mapping
 * Task 00041 redirects from, kept here so the slug and the route it supersedes
 * cannot drift apart in two files.
 *
 * Labels are the ones the nav already used for these sets (components/NavMenu),
 * prefixed with the car so they stay distinguishable once flattened into one
 * list — the nav nested them under a per-car submenu that the hub does not have.
 */
export const GALLERY_SETS = [
    {
        slug: 'nd-totd2025',
        car: 'ND Miata',
        label: 'ND — Tail of the Dragon 2025',
        legacyPath: '/totdgallery',
    },
    {
        slug: 'nd-hillcountry',
        car: 'ND Miata',
        label: 'ND — Texas Hill Country',
        legacyPath: '/nd-hillcountry',
    },
    {
        slug: 'c8-autox',
        car: 'C8 Corvette',
        label: 'C8 — Autocross',
        legacyPath: '/c8-autox',
    },
    {
        slug: 'nb-hillcountry',
        car: 'NB Mazdaspeed Miata',
        label: 'NB — Texas Hill Country Trip 2023',
        legacyPath: '/msm-gallery',
    },
    {
        slug: 'nc-eastcoast15',
        car: 'NC Miata',
        label: 'NC — East Coast Trip 2015',
        legacyPath: '/nc-eastcoast15',
    },
    {
        slug: 'nc-yellowstone15',
        car: 'NC Miata',
        label: 'NC — Yellowstone West Coast Trip 2015',
        legacyPath: '/nc-yellowstone15',
    },
]

export default GALLERY_SETS
