/**
 * The NA6 spec page.
 *
 * Task 00038 re-skins this surface onto the V2 component language — the
 * `.post` reading panel for the intro, `.card` for each modification group and
 * a `.chip` per entry — and retires `.na-background`. That class was a
 * fixed-attachment wash over a photo that had already been deleted from the
 * tree, so it had been painting a flat 60% black veil over the whole page.
 *
 * Every string is carried over verbatim from the pre-V2 markup; this Task is a
 * re-skin, not a content edit. They live in the two constants below rather than
 * inline in JSX because several carry an apostrophe or an inch mark, which JSX
 * text would need escaped — that escaping is what the file's old
 * `eslint-disable react/no-unescaped-entities` header existed to suppress.
 *
 * The mod list was previously one <ul> with <h4> headings as direct children,
 * which is invalid — <ul> may only contain <li>. Grouping into one card per
 * category gives each heading a legal home and is also what the V2 grid wants.
 *
 * There is no i18n primitive in this project (no i18next, no resource bundles);
 * every other component hardcodes its copy the same way.
 */

const TITLE = '1991 NA 1.6 Miata - "Miyoshi"'

const INTRO =
    "I bought this 1991 Miata on February 23rd 2003, and I'm the third owner. The car is pretty amazing"

const MODIFICATIONS = [
    {
        category: 'Suspension',
        mods: [
            'Xida XL coilovers (300/200 lb/in spring rates)',
            'RacingBeat 15/16" front swaybar',
            'ILM suspension bushing kit',
        ],
    },
    {
        category: 'Engine',
        mods: ['RacingBeat Header', "Flyin'Miata high-flow cat", 'Borla cat-back exhaust'],
    },
    {
        category: 'Drivetrain',
        mods: ['Mazdaspeed Miata 6-speed Transmission', '4.10 Torsen differential'],
    },
]

const NaMiata = () => {
    return (
        <main className="section">
            <div className="container">
                <div className="section-head">
                    <h1>{TITLE}</h1>
                </div>

                <article className="post">
                    <div className="post__body">
                        <p className="post__entry mb-0">{INTRO}</p>
                    </div>
                </article>

                <div className="section-head">
                    <h2>Modifications</h2>
                </div>

                <div className="row g-4">
                    {MODIFICATIONS.map(({ category, mods }) => (
                        <div className="col-md-6 col-lg-4" key={category}>
                            <section className="card h-100">
                                <div className="card__body">
                                    <h3 className="card__title">{category}</h3>
                                    <ul className="spec-row list-unstyled mb-0">
                                        {mods.map((mod) => (
                                            <li className="chip" key={mod}>
                                                {mod}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </section>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    )
}

export default NaMiata
