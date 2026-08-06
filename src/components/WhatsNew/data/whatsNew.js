/**
 * Content source for the /whats-new ledger (the numbered changelog).
 *
 * SHARED SOURCE FILE -- two owners, one file:
 *   frontend-engineer owns the SHAPE (the `WhatsNewEntry` typedef below, the export
 *     name, and the empty-safe contract). Changing a field name is a frontend change
 *     because the component reads these keys directly.
 *   tech-writer owns the VALUES (Story 00063). `ver`/`tag`/`goal`/`title`/`body` were
 *     authored in Task 00070; `why`/`how` were authored and the whole set audited
 *     against the shipped record in Task 00071.
 *
 * Every claim in an entry must trace to work that actually shipped (AC-015). The
 * ordering is deliberate -- it walks a reader from what they can see (the redesign,
 * the navigation, the home page) down to what they cannot (imagery, galleries, the
 * build). Numeric claims deliberately live in the metric tiles, not here.
 *
 * TRACEABILITY (Task 00071 audit -- each entry's `how` to its resolved source):
 *   1 redesign      -> Feature 00003, Stories 00007/00008/00009 (tokens, fonts, logo,
 *                      three-stylesheet collapse); Task 00016 (logo.svg).
 *   2 navigation    -> Feature 00003, Stories 00010/00011 (NavMenu, Header, Footer
 *                      first render, coming-soon removal); Task 00024 (/totdtrip);
 *                      Task 00025 (route-parity guard). AC-002, AC-018.
 *   3 home page     -> Feature 00004, Tasks 00030 (hero), 00033 (CarCard/garage hub),
 *                      00032 (Home compose). Ryoko's detail is Cars.json id 3 verbatim.
 *   4 imagery       -> Feature 00005, Tasks 00057 (ResponsiveImage), 00058, 00059,
 *                      00060 (OG image + gallery srcset). AC-010, AC-011.
 *   5 galleries     -> Feature 00005 Story 00044 (Tasks 00053-00056) for the pipeline;
 *                      Feature 00004 Story 00029 (Tasks 00039-00041) for the hub, the
 *                      set-switcher and the legacy redirects. AC-009.
 *   6 under the     -> Feature 00005 Story 00042: Task 00047 (es2015 + SSR residue),
 *     bonnet           Task 00046 (Node pin), Tasks 00049/00050 (analytics). Feature
 *                      00004 Task 00031 (poster-facade video grid). AC-003, 012, 013.
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
        why: 'GOAL 1, the enthusiast-native visual system. A site about cars ought to look like it was built by somebody who likes cars, and the old one looked like it was built by somebody filing a tax return.',
        how: 'One design-token layer — charcoal canvas, brand red #E10600, self-hosted Archivo, Inter and Space Mono — collapsing the three overlapping stylesheets into a single entry path, plus The Goji Line SVG replacing logo.gif.'
    },
    {
        ver: 'V2.0 — NAVIGATION',
        tag: 'NAVIGATION',
        goal: 'GOAL 1',
        title: 'You can now find things. Revolutionary, I know.',
        body: 'There is a real navigation bar. It stays at the top where you left it, and on a phone it folds into a tidy menu rather than sliding off the edge of the screen and into the sea. There is also a footer — a genuine, fully-built footer that had been sitting in the codebase all this time without ever once being plugged in, like a spare engine left in a crate. The two gallery links that had been promising themselves as "coming soon" since roughly the Bronze Age have been shown the door, as has a duplicate address pointing at a gallery you could already reach by another name. And there is now a permanent red pill in the navbar marked WHAT\'S NEW, which brings you here, to the page whose entire job is to announce that this page exists. Yes. We are aware.',
        why: 'GOAL 1 again, because a visual system nobody can navigate is just an expensive screensaver. The site has to work at every width from a phone to a monitor, and it has to be honest about what it actually contains.',
        how: 'Rebuilt NavMenu (sticky, collapses to a mobile menu, red-underline active state, permanent What\'s New pill) and Header; the built-but-never-mounted Footer rendered for the first time; both "coming soon" gallery placeholders and the orphaned /totdtrip duplicate route removed — and a route-parity test added so none of it quietly comes back.'
    },
    {
        ver: 'V2.0 — THE HOME PAGE',
        tag: 'HOME',
        goal: 'GOAL 1',
        title: 'The front page picks a different car every time you turn up.',
        body: 'The old home page did not so much begin as simply happen — no hero, no arrival, you were just abruptly there, like waking up halfway through a flight. It now opens with one full-width shot of one car, chosen at random when the page loads and then held for the rest of your visit so it does not shuffle about underneath you while you are reading. Five cars, five different arrivals, and no way of knowing which you will get. Below it, the garage has become a proper numbered five-bay hub, and Ryoko — the NC, totalled in a flood back in 2018 — now has a bay of her own marked as a tribute, rather than a card that quietly bounced you back to the home page.',
        why: 'GOAL 1, aimed at the one page everybody sees. The front door should introduce the cars, not merely list them — and it should be a different car often enough that coming back is worth doing.',
        how: 'A rotating multi-car hero (one shot per car, picked once at mount and held stable for the session) and the rebuilt five-bay number-tag garage hub, including a retired-car tribute state for Ryoko.'
    },
    {
        ver: 'V2.0 — IMAGERY',
        tag: 'IMAGERY',
        goal: 'GOAL 2',
        title: 'The photographs now load before you retire.',
        body: 'On the old site, opening a gallery was a commitment. You clicked, you put the kettle on, you possibly started a family, and eventually — triumphantly — a full-resolution JPEG the size of a small moon would arrive. No longer. The galleries, the rotating hero and the article photography are all built to webp now, at the sizes real screens actually use, and handed to your browser as a menu it can choose from. Every image on the site goes through one shared component, and the ones below the fold wait until they are nearly in view instead of sabotaging the ones you can already see. Also: the image that was supposed to appear whenever anybody shared this site turned out to be pointing at a file that has never existed. Not once. Not since the day the tag was written. Every link anyone has ever posted has been quietly improvising. There is a real one now.',
        why: 'GOAL 2, performance — the co-equal goal, and the one the old site failed hardest. None of the rest of this matters if the photographs never turn up.',
        how: 'One shared ResponsiveImage component across every image-bearing surface, fed by build-time webp renditions with a full responsive srcset ladder on the galleries, the hero and the C8 article; below-fold images marked loading="lazy"; and the OG/Twitter/JSON-LD social image repointed at a correctly-sized rendition that, unlike its predecessor, resolves.'
    },
    {
        ver: 'V2.0 — THE GALLERIES',
        tag: 'GALLERIES',
        goal: 'GOAL 1 + 2',
        title: 'Six galleries. Three ways of doing the same job. No good reason for any of it.',
        body: 'This is the part that should embarrass me. There were six photo galleries on this site and, through nothing but accumulated enthusiasm, three completely different mechanisms for displaying them. One shoved full-size originals straight into the download. Another built its thumbnails inside your browser, at runtime, using your battery, to produce something a build machine could have made once and kept forever. Only the third did anything sensible. They now all come off that one pipeline and live behind a single address with a switcher across the top, and every old gallery link still works because it quietly forwards you to the new one. The build was also emitting a complete second copy of every photograph in the galleries still using the old import trick — deploy weight that nothing on the site had ever asked for. It is not any more.',
        why: 'GOAL 1 and GOAL 2 at the same time, which is rare and worth saying out loud: one place to find the photographs, and one pipeline to deliver them properly.',
        how: 'All six gallery sets consolidated onto the single scripts/build-gallery.mjs sharp→webp pipeline behind one /galleries hub with a set-switcher; every legacy per-gallery route redirects in; the static full-res import arrays, the runtime canvas thumbnailer and the duplicate build output they caused are all retired.'
    },
    {
        ver: 'V2.0 — UNDER THE BONNET',
        tag: 'DRIVETRAIN',
        goal: 'GOAL 2',
        title: 'We removed several parts whose only function was weight.',
        body: 'Somewhere in the engine bay was a setting that made the whole site ship a larger, older, slower version of itself purely to support a feature that had been switched off years earlier — the automotive equivalent of towing a caravan you never unpack. Gone, along with the leftover bracketry that held it on. The three YouTube players that used to fire up on the home page whether or not you ever watched anything are now simply posters: click one and it loads, ignore them and they cost you nothing at all. The build is pinned to one fixed toolchain so the machine it is written on and the machine it is deployed from finally agree with each other, which is the sort of thing nobody notices until the day it stops being true. And the site now has analytics that sets no cookies, needs no consent banner, and knows nothing about you beyond the fact that a page was looked at.',
        why: 'GOAL 2 once more — performance and build reliability. Weight you are not carrying is the cheapest speed there is, and none of the gains count for much unless they can be measured without spying on anybody.',
        how: 'Dropped the vestigial es2015 down-transpile and the dead SSR residue it existed for; replaced the three eager YouTube iframes with click-to-load poster facades; pinned Node via .nvmrc and NODE_VERSION so the sharp image pipeline builds identically everywhere; added cookieless analytics across every route.'
    }
];
