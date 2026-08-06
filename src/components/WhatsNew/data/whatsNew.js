/**
 * Content source for the /whats-new ledger (the numbered changelog).
 *
 * SHARED SOURCE FILE -- two owners, one file:
 *   frontend-engineer owns the SHAPE (the `WhatsNewEntry` typedef below, the export
 *     name, and the empty-safe contract). Changing a field name is a frontend change
 *     because the component reads these keys directly.
 *   tech-writer owns the VALUES (Story 00063). `ver`/`tag`/`goal`/`title`/`body` were
 *     authored in Task 00070; the `why`/`how` readout rows below are working drafts
 *     that Task 00071 refines in place.
 *
 * Every claim in an entry must trace to work that actually shipped (AC-015). The
 * ordering is deliberate -- it walks a reader from what they can see (the redesign,
 * the navigation, the home page) down to what they cannot (imagery, galleries, the
 * build). Numeric claims deliberately live in the metric tiles, not here.
 *
 * Same JSON-as-CMS spirit as `src/assets/Data/*Blog.json` and `Garage/Cars.json`,
 * kept as `.js` rather than `.json` so the shape contract can be documented here
 * where both owners will see it.
 *
 * The array may be empty. The consumer derives the ledger numbering from the map
 * index, so nothing here depends on a fixed length or on a specific entry existing.
 */

/**
 * @typedef {Object} WhatsNewEntry
 * @property {string} ver   Version + section banner, e.g. "V2.0 -- THE REDESIGN".
 * @property {string} tag   Short category chip on the ledger row.
 * @property {string} goal  Which V2 goal the entry advances; the chip beside `tag`.
 * @property {string} title Headline for the entry.
 * @property {string} body  Prose paragraph. Plain text -- this is NOT run through
 *                          react-markdown, unlike the blog `entry` field.
 * @property {string} why   The "WHY ->" readout row.
 * @property {string} how   The "HOW ->" readout row.
 */

/** @type {WhatsNewEntry[]} */
export const whatsNew = [
    {
        ver: 'V2.0 — THE REDESIGN',
        tag: 'REDESIGN',
        goal: 'GOAL 1',
        title: 'We set fire to the old website. On purpose.',
        body: 'The previous jeffgoji.com was, and I say this with enormous affection, a beige Bootstrap car park lit by a red the colour of a 1998 error message. It has been taken behind the shed and dealt with. In its place is a proper dark motorsport-editorial machine: deep charcoal canvas, big imagery, and a red that looks like it came off an actual race car rather than a fire alarm. Underneath, three stylesheets that had spent years quietly disagreeing with one another now answer to one set of design tokens, the typefaces are served from this site instead of borrowed from a stranger mid-corner, and the old logo.gif — a GIF, in this decade — has been replaced by a proper drawn mark called The Goji Line.',
        why: 'Advances GOAL 1 (enthusiast-native visual system) — the site should look like the cars it is about.',
        how: 'New black + premium-red design-token layer, self-hosted Archivo/Inter/Space Mono, The Goji Line SVG logo replacing logo.gif, and one token system replacing three competing stylesheets.'
    },
    {
        ver: 'V2.0 — NAVIGATION',
        tag: 'NAVIGATION',
        goal: 'GOAL 1',
        title: 'You can now find things. Revolutionary, I know.',
        body: 'There is a real navigation bar. It stays at the top where you left it, and on a phone it folds into a tidy menu rather than sliding off the edge of the screen and into the sea. There is also a footer — a genuine, fully-built footer that had been sitting in the codebase for years without ever once being plugged in, like a spare engine left in a crate. The link to a page that had been "coming soon" since roughly the Bronze Age has been shown the door, as has a duplicate address pointing at a gallery you could already reach by another name. And there is now a permanent red pill in the navbar marked WHAT\'S NEW, which brings you here, to the page whose entire job is to announce that this page exists. Yes. We are aware.',
        why: 'Advances GOAL 1 — the site has to be navigable on every screen from 360 to 1440, and honest about what it actually contains.',
        how: 'Rebuilt NavMenu (sticky, mobile-collapsing, red-underline active state, What\'s New pill) and Header, rendered the long-dormant Footer for the first time, removed the "NA Miata (coming soon)" placeholder and the orphaned /totdtrip route.'
    },
    {
        ver: 'V2.0 — THE HOME PAGE',
        tag: 'HOME',
        goal: 'GOAL 1',
        title: 'The front page picks a different car every time you turn up.',
        body: 'The old home page did not so much begin as simply happen — no hero, no arrival, you were just abruptly there, like waking up halfway through a flight. It now opens with one full-width shot of one car, chosen at random when the page loads and then held for the rest of your visit so it does not shuffle about underneath you while you are reading. Five cars, five different arrivals, and no way of knowing which you will get. Below it, the garage has become a proper numbered five-bay hub, and Ryoko — the NC, lost to a flood in 2018 — now gets a tribute bay of her own rather than a dead link, because pretending otherwise felt rude.',
        why: 'Advances GOAL 1 — the home page should introduce the cars, not merely list them.',
        how: 'A rotating multi-car hero (five per-car shots, one picked at mount and held session-stable) plus the rebuilt five-car number-tag garage hub with a retired-car tribute state.'
    },
    {
        ver: 'V2.0 — IMAGERY',
        tag: 'IMAGERY',
        goal: 'GOAL 2',
        title: 'The photographs now load before you retire.',
        body: 'On the old site, opening a gallery was a commitment. You clicked, you put the kettle on, you possibly started a family, and eventually — triumphantly — a full-resolution JPEG the size of a small moon would arrive. No longer. Every image is webp now, built at the sizes real screens actually use and handed to your browser as a menu it can choose from, and the ones below the fold wait until they are nearly in view instead of sabotaging the ones you can already see. Also: the image that was supposed to appear whenever anybody shared this site turned out to be pointing at a file that has never existed. Not once. Not since the day the tag was written. Every link anyone has ever posted has been quietly improvising. There is a real one now.',
        why: 'Advances GOAL 2 (performance) — the co-equal goal, and the one the old site failed hardest.',
        how: 'webp renditions with responsive srcset/sizes across every image-bearing surface, loading="lazy" below the fold, and the OG/Twitter/JSON-LD social image replaced with a correctly-sized rendition that, unlike its predecessor, resolves.'
    },
    {
        ver: 'V2.0 — THE GALLERIES',
        tag: 'GALLERIES',
        goal: 'GOAL 1 + 2',
        title: 'Six galleries. Six entirely different ways of doing the same job.',
        body: 'This is the part that should embarrass me. There were six photo galleries on this site and, through nothing but accumulated enthusiasm, six completely different mechanisms for displaying them. One shoved full-size originals straight into the download. Another built its thumbnails inside your browser, at runtime, using your battery, to produce something a build machine could have made once and kept forever. They now all come off a single pipeline and live behind one address with a switcher across the top, and every old gallery link still works because it quietly forwards you to the new one. The build was also emitting a complete second copy of every photograph that nothing on the site ever asked for. It is not any more.',
        why: 'Advances GOAL 1 and GOAL 2 together — one place to find the photos, one pipeline to deliver them.',
        how: 'All six gallery sets consolidated onto the single sharp-to-webp build pipeline behind one /galleries hub with a set-switcher; old per-gallery routes redirect in; runtime canvas thumbnailing, static full-res imports and duplicate build output all retired.'
    },
    {
        ver: 'V2.0 — UNDER THE BONNET',
        tag: 'DRIVETRAIN',
        goal: 'GOAL 2',
        title: 'We removed several parts whose only function was weight.',
        body: 'Somewhere in the engine bay was a setting that made the whole site ship a larger, older, slower version of itself purely to support a feature that had been switched off years earlier — the automotive equivalent of towing a caravan you never unpack. Gone, along with the leftover bracketry that held it on. The three YouTube players that used to fire up on the home page whether or not you ever watched anything are now simply posters: click one and it loads, ignore them and they cost you nothing at all. The build is pinned to a fixed toolchain so it stops mysteriously failing next month, which used to happen and made everyone very cross. And the site now has analytics that sets no cookies, needs no consent banner, and knows nothing about you beyond the fact that a page was looked at.',
        why: 'Advances GOAL 2 (performance and build reliability) — and makes the gains measurable without spying on anyone.',
        how: 'Dropped the vestigial es2015 down-transpile and the dead SSR residue it existed for, replaced three eager YouTube iframes with click-to-load poster facades, pinned Node so the sharp image pipeline builds cleanly every time, and added cookieless analytics on every route.'
    }
];
