/* ============================================================================
   jeffgoji.com V2 — MOCK DATA (hand-off surface for the wiring step)
   ---------------------------------------------------------------------------
   Shapes mirror the production JSON-as-CMS + build-gallery manifest contracts:
     - MOCK.cars      -> src/components/Garage/Cars.json         (garage hub)
     - MOCK.blog[key] -> src/assets/Data/{naBlog,MsmBlog,ndBlog,c8Blog}.json
                         fields: { id, date, mileage, picture, cost, entry(md) }
     - MOCK.gallery   -> public/gallery/<slug>/manifest.json  items:
                         { original, thumbnail, originalAlt, thumbnailAlt }
                         (react-image-gallery item shape)
     - MOCK.videos    -> YouTube embeds (id + title)
     - MOCK.whatsNew  -> /whats-new content entries (authored last in prod)
   Images use `picture` = the real production root-relative path (no leading
   slash, per convention). The mockup render layer synthesizes an offline SVG
   placeholder from `label`; production replaces that with responsive
   <img srcset/sizes loading="lazy"> pointing at built webp renditions.
   ============================================================================ */
window.MOCK = {
  /* ---- GARAGE / car-blogs hub (Cars.json shape + bloglink) ---- */
  /* ---- HOME HERO ROTATION ----
     One entry per car; the home hero randomly picks one on each page load
     (the "Random-Background-Feature"). Maps in production to a `heroes`
     constant array + a random pick on mount in the Home component.
     Every image gets the .media--editorial--hero grade + .hero__scrim, so
     whichever loads reads cohesively moody. `alt` doubles as the a11y label. */
  heroes: [
    { key: "na",  img: "assets/img/hero-na.jpg",  name: "Miyoshi", car: "NA6 Miata",
      alt: "Miyoshi, the 1991 NA6 Miata, on a rooftop deck against the lit Houston night skyline" },
    { key: "msm", img: "assets/img/hero-msm.jpg", name: "Kiryu",   car: "NB Mazdaspeed",
      alt: "Kiryu, the NB Mazdaspeed Miata, throwing a wall of spray through a wet autocross course" },
    { key: "nc",  img: "assets/img/hero-nc.jpg",  name: "Ryoko",   car: "NC Club",
      alt: "Ryoko, the 2013 NC Club Miata, parked at a fall-colored mountain overlook" },
    { key: "nd",  img: "assets/img/hero-nd.jpg",  name: "Kasumi",  car: "ND MX-5 RF",
      alt: "Kasumi, the 2023 ND MX-5 RF, on an open country back road under an open sky" },
    { key: "c8",  img: "assets/img/hero-c8.jpg",  name: "Panda",   car: "C8 Corvette Z51",
      alt: "Panda, the 2023 C8 Corvette Z51, on a tree-lined driveway in soft evening light" }
  ],

  cars: [
    { id: 1, make: "Mazda", model: "NA6 Miata", year: 1991, name: "Miyoshi",
      label: "1991 NA6", tag: "Daily / Resto", img: "assets/img/car-na.jpg",
      description: "First car, bought in 2003 and never let go. Heavily sorted daily driver: bushings, suspension, exhaust, intake. Still turns heads at every meet.",
      bloglink: "blog.html" },
    { id: 2, make: "Mazdaspeed", model: "NB Mazdaspeed", year: 2004, name: "Kiryu",
      label: "2004 MSM", tag: "Autocross weapon", img: "assets/img/car-msm.jpg",
      description: "Two-time local SCCA champion. Bump in power, wide wheels and tires, stiff race suspension. Always hunting fastest time of day.",
      bloglink: "blog.html" },
    { id: 3, make: "Mazda", model: "NC Club", year: 2013, name: "Ryoko",
      label: "2013 NC", tag: "Retired / tribute", img: "assets/img/car-nc.jpg",
      description: "Coast-to-coast tourer with a power hardtop and the 2.0. Lost to a flood in 2018 — kept in the garage for completion's sake.",
      bloglink: "#" },
    { id: 4, make: "Mazda", model: "ND GTS RF", year: 2023, name: "Kasumi",
      label: "2023 ND RF", tag: "Current fun", img: "assets/img/car-nd.jpg",
      description: "The newest Miata. A Retractable Fastback departure from the soft-top norm — economical, sharp, and endlessly fun on a back road.",
      bloglink: "blog.html" },
    { id: 5, make: "Chevrolet", model: "C8 Corvette Z51", year: 2023, name: "Panda",
      label: "2023 C8 Z51", tag: "Mid-engine", img: "assets/img/car-c8.jpg",
      description: "Mid-engine supercar handling in white-and-black 'Panda' trim. Kept stock for autocross and great-drives road trips.",
      bloglink: "blog.html" }
  ],

  /* ---- BLOG posts, keyed by car (naBlog.json shape) ---- */
  blog: {
    // Realistic NA (Miyoshi) + ND + C8 content, drawn from the live data model.
    na: [
      { id: 3, date: "2/07/2026", mileage: "197,307", picture: "assets/img/blog-na-01.jpg",
        label: "NA · Paint refresh", cost: "$1250 (new cat, head unit, speakers, trans + diff fluid)",
        entry: "True to my word, I bought a new catalytic converter and had it installed which did a great job of quieting down the car and fixed a really nasty exhaust leak.\n\nThere wasn't much point wasting a trip to the shop for one item, so I checked off several more: fresh differential and transmission fluid, and new clutch and brake hydraulic fluid. The car felt much smoother and more responsive afterwards.\n\n![New head unit](assets/img/na-headunit.jpg)\n\nThen the audio system. The old Pioneer from 2004 finally retired for a modern $65 Bluetooth/Android Auto unit, plus the Millennium 5 speaker kit. It won't set the world on fire, but night-mode dimming and a touch screen beat the OEM unit in my 2023 car.\n\nFinally a paint clean-and-wax. A 20-year-old single-stage repaint is now in 'preservation mode' — maintenance washes and cleaner-wax from here on out. But she's looking better than she has in years." },
      { id: 2, date: "12/28/2025", mileage: "196,802", picture: "assets/img/blog-na-02.jpg",
        label: "NA · Year in review", cost: "$0",
        entry: "Here we are at the close of the year and, as the mileage tells you, not much has changed for Miyoshi. A couple issues remain: an exhaust leak where the header meets the cat, and an AC system that struggles in the Houston heat.\n\nNow that winter (or what passes for it here) has arrived, I'm driving her more and more — the AC keeps up below 80 degrees and it's the only Miata I have on all-season tires I don't have to baby on cold mornings.\n\nA tune-up is planned for January: spark plugs, wires, and maybe a new cat-back to fix that leak. Other than that, just enjoying having the old girl around again." },
      { id: 1, date: "1/30/2025", mileage: "196,175", picture: "assets/img/blog-na-03.jpg",
        label: "NA · Back on the road", cost: "$4000 (subframe swap, a-arms, wheels, tires, alignment, shock)",
        entry: "After a month of downtime while Clint at Gas Head Motorworks swapped a front subframe — courtesy of being run off the road into a curb — I finally got her back. And she came home wearing a set of shiny '94 hollow-spoke wheels wrapped in fresh Falken Sincera SN250 all-seasons.\n\nThe drive home was an experience: a temporary Comp shock up front, brand-new tires still slick with mold release, and a shoestring alignment just to make it. In the rain. And it didn't matter one bit. Even the little slide off the 290-to-610 ramp couldn't touch how good it felt to drive the old girl again. It genuinely brought a tear to my eye.\n\nThree weeks later the proper Xida XL shock arrived from 949 Racing, one more visit to Clint for install and alignment, and she was whole again." }
    ]
  },

  /* ---- GALLERY (react-image-gallery manifest shape) ---- */
  gallerySlug: "nd-totd2025",
  galleryTitle: "Tail of the Dragon — ND RF, 2025",
  gallery: [
    { original: "assets/img/gallery-01.jpg", thumbnail: "assets/img/gallery-01.jpg", label: "TOTD · Deals Gap", originalAlt: "ND Miata at Deals Gap", thumbnailAlt: "ND at Deals Gap" },
    { original: "assets/img/gallery-02.jpg", thumbnail: "assets/img/gallery-02.jpg", label: "TOTD · The 318 curves", originalAlt: "Switchbacks on US-129", thumbnailAlt: "US-129 switchbacks" },
    { original: "assets/img/gallery-03.jpg", thumbnail: "assets/img/gallery-03.jpg", label: "TOTD · Overlook", originalAlt: "Overlook stop", thumbnailAlt: "Overlook" },
    { original: "assets/img/gallery-04.jpg", thumbnail: "assets/img/gallery-04.jpg", label: "TOTD · Apex", originalAlt: "Apex through a hairpin", thumbnailAlt: "Hairpin apex" },
    { original: "assets/img/gallery-05.jpg", thumbnail: "assets/img/gallery-05.jpg", label: "TOTD · Tree of Shame", originalAlt: "The Tree of Shame", thumbnailAlt: "Tree of Shame" },
    { original: "assets/img/gallery-06.jpg", thumbnail: "assets/img/gallery-06.jpg", label: "TOTD · Roadside", originalAlt: "Roadside portrait", thumbnailAlt: "Roadside" },
    { original: "assets/img/gallery-07.jpg", thumbnail: "assets/img/gallery-07.jpg", label: "TOTD · Top down", originalAlt: "Top down cruising", thumbnailAlt: "Top down" },
    { original: "assets/img/gallery-08.jpg", thumbnail: "assets/img/gallery-08.jpg", label: "TOTD · Fog", originalAlt: "Morning fog in the mountains", thumbnailAlt: "Mountain fog" },
    { original: "", thumbnail: "", label: "TOTD · Convoy", originalAlt: "Miata convoy", thumbnailAlt: "Convoy" },
    { original: "", thumbnail: "", label: "TOTD · Golden hour", originalAlt: "Golden hour on the ridge", thumbnailAlt: "Golden hour" },
    { original: "", thumbnail: "", label: "TOTD · Detail", originalAlt: "Wheel and brake detail", thumbnailAlt: "Detail" },
    { original: "", thumbnail: "", label: "TOTD · Summit", originalAlt: "Summit panorama", thumbnailAlt: "Summit" }
  ],

  /* ---- VIDEOS (YouTube) ---- */
  videos: [
    { id: "dQw4w9WgXcQ", title: "ND RF — Tail of the Dragon, full run", meta: "8:42 · Great Drives" },
    { id: "dQw4w9WgXcQ", title: "MSM autocross — SCCA Solo, FTD chase", meta: "5:11 · Autocross" },
    { id: "dQw4w9WgXcQ", title: "C8 Z51 — first autocross of the season", meta: "6:30 · Autocross" },
    { id: "dQw4w9WgXcQ", title: "NA6 subframe swap — the comeback", meta: "12:04 · Build" }
  ],

  /* ---- TELEMETRY METRICS (instrument cluster for /whats-new dashboard) ----
     These are V2 TARGET figures used as representative placeholders. The real
     measured numbers get filled in when the performance/analytics pass ships.
     Shape -> feeds the stat tiles:
       value  : the numeral (rendered in Space Mono)
       unit   : trailing unit/symbol shown small next to the value
       label  : short instrument label under the value
       delta  : the change readout (arrow glyph + short text)
       trend  : "down" | "up" | "flat"  (semantic direction of the change)
       note   : one-line context under the tile
       gauge  : 0–100 meter fill for the instrument bar
       target : true = aspirational placeholder (badged "TARGET"), false = shipped fact
  ---------------------------------------------------------------------------- */
  metrics: [
    { value: "−50", unit: "%", label: "Image payload", delta: "▼ lighter", trend: "down",
      note: "webp + responsive srcset diet", gauge: 50, target: true },
    { value: "2.5", unit: "s", label: "LCP", delta: "▼ from ~4s+", trend: "down",
      note: "largest contentful paint", gauge: 62, target: true },
    { value: "90", unit: "+", label: "Lighthouse", delta: "▲ perf · 80+ field", trend: "up",
      note: "mobile lab score", gauge: 90, target: true },
    { value: "100", unit: "%", label: "Shipped", delta: "0 vapourware", trend: "flat",
      note: "every claim below = real work", gauge: 100, target: false }
  ],

  /* ---- WHATS NEW (Top Gear / Clarkson voice) — changelog-as-readout ----
     Enriched for the timeline: `tag` = short category chip, `goal` = which
     V2 goal the entry advances (chip on the ledger row). ver/title/body/why/how
     unchanged. ---------------------------------------------------------------- */
  whatsNew: [
    { ver: "V2.0 — THE REDESIGN", tag: "REDESIGN", goal: "GOAL 1", title: "We set fire to the old website. On purpose.",
      body: "The previous jeffgoji.com was, and I mean this with great affection, a beige Bootstrap car park with a flashing red the colour of a 1998 error message. It has been dragged behind the shed and dealt with. In its place: a proper dark, motorsport-editorial machine — deep charcoal, big imagery, and a red that looks like it came off an actual race car rather than a fire alarm.",
      why: "Advances GOAL 1 (enthusiast-native visual system).",
      how: "New black + premium-red palette (#E10600), new SVG logo, one coherent design system replacing three fighting stylesheets." },
    { ver: "V2.0 — IMAGERY", tag: "IMAGERY", goal: "GOAL 2", title: "The photos now load before you retire.",
      body: "On the old site, opening the Tail of the Dragon gallery was a commitment. You'd click, put the kettle on, possibly start a family, and eventually — triumphantly — a full-resolution JPEG the size of a small moon would arrive. No longer. Every image is now webp, properly sized for your screen, and lazy-loaded so the ones you can't see aren't sabotaging the ones you can.",
      why: "Advances GOAL 2 (performance) — the co-equal goal.",
      how: "All galleries consolidated onto the sharp→webp build pipeline; responsive srcset/sizes; below-fold loading='lazy'; the multi-MB social image put on a diet to under 200KB." },
    { ver: "V2.0 — NAVIGATION", tag: "NAVIGATION", goal: "GOAL 1", title: "You can now find things. Revolutionary, I know.",
      body: "There's a real navbar that collapses into a tidy menu on your phone instead of falling off the edge of the screen and into the sea. There's a footer — an actual one, that was built years ago and never plugged in, like a spare engine left in a crate. And the ghostly 'coming soon' link that led precisely nowhere has been shown the door.",
      why: "Advances GOAL 1 — usable on every screen, 360 to 1440.",
      how: "Rebuilt NavMenu + Header, rendered the long-dormant Footer, added this permanent 'What's New' page, removed the dead placeholder and the orphaned /totdtrip route." },
    { ver: "V2.0 — UNDER THE BONNET", tag: "DRIVETRAIN", goal: "GOAL 2", title: "We removed a part that did nothing but add weight.",
      body: "Somewhere in the engine bay was a setting that made the whole site ship a larger, slower bundle to support a feature that was switched off years ago — the automotive equivalent of towing a caravan you never unpack. Gone. The build is pinned so it doesn't mysteriously stop working next month, which is the sort of thing that used to happen and made everyone very cross.",
      why: "Advances GOAL 2 (performance + build reliability).",
      how: "Dropped the es2015 down-transpile, removed dead SSR residue, pinned Node ≥18.17 so the sharp image pipeline builds cleanly on Netlify every time." }
  ]
};
