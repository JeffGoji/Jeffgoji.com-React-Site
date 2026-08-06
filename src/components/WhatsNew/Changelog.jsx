/**
 * The numbered changelog ledger, ported from whats-new.html:77-97.
 *
 * SECURITY (Spec 00002 part P8 / AC-016): `title`, `body`, `why` and `how` are
 * PLAIN TEXT. They land as JSX children, which React escapes — there is no
 * markdown renderer and no `dangerouslySetInnerHTML` on this path, unlike the
 * blog's `entry` field. The mockup builds these rows by assigning `innerHTML`
 * from a template literal, so a port that reproduced that mechanism would mount
 * whatever HTML a content author typed into `data/whatsNew.js`. Introducing a
 * raw-HTML path here re-opens stored XSS through the content file and is
 * guarded by Changelog.test.jsx.
 *
 * The ledger number is derived from the map index rather than stored on the
 * entry: the mockup numbers rows by their position, so an authored `num` field
 * could disagree with the order the rows actually paint in. The index is the
 * React key for the same reason — position IS the row's identity here, on a
 * fixed-order authored list with no insertion, reordering or per-row state for
 * a positional key to desynchronise.
 *
 * `whatsNew` may be empty. The head is the section's own copy rather than an
 * entry's, so it stands whether or not any row follows it.
 */

/**
 * @param {Object} props
 * @param {import('./data/whatsNew').WhatsNewEntry[]} props.whatsNew
 */
function Changelog({ whatsNew }) {
    return (
        <div className="changelog">
            <div className="cl-head">
                <div className="eyebrow">The ledger</div>
                <h2 className="cl-head__title">What changed, in order.</h2>
            </div>
            {whatsNew.map((entry, index) => (
                <section className="cl-item" key={index}>
                    <div className="cl-num">{String(index + 1).padStart(2, '0')}</div>
                    <div className="cl-card">
                        <div className="cl-meta">
                            <span className="cl-tag">{entry.tag}</span>
                            <span className="cl-goal">{entry.goal}</span>
                        </div>
                        <h3 className="cl-card__title">{entry.title}</h3>
                        <p className="cl-card__body">{entry.body}</p>
                        <div className="cl-readout">
                            <div className="cl-readout__row">
                                <span className="cl-readout__k">
                                    <b>WHY &rarr;</b>
                                </span>
                                <span className="cl-readout__v">{entry.why}</span>
                            </div>
                            <div className="cl-readout__row">
                                <span className="cl-readout__k">
                                    <b>HOW &rarr;</b>
                                </span>
                                <span className="cl-readout__v">{entry.how}</span>
                            </div>
                        </div>
                    </div>
                </section>
            ))}
        </div>
    );
}

export default Changelog;
