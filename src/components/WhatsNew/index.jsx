import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { CATEGORIES, recentUpdates } from './data/recentUpdates';

/**
 * /whats-new: a dated timeline of what changed on the site, newest first, with
 * every entry linking straight to the page, gallery or post it is about.
 *
 * Replaced the V2 launch ledger in November 2026. That page is kept, unchanged,
 * in ./V2Launch.jsx and served at /whats-new/v2-launch.
 *
 * Layout: the dashboard band (reusing `.wn-dash`, nested inside the one <main>
 * for the landmark reason V2Launch.jsx documents) carries the headline, a strip
 * of counts derived from the data and the single newest update; the section
 * below carries category filters and the month-grouped timeline.
 *
 * All entry fields are plain text rendered as React children.
 */

const ALL = 'All';
const ARCHIVE_PATH = '/whats-new/v2-launch';

/** Parses YYYY-MM-DD as a local date so no timezone can shift the day. */
function parseDate(iso) {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day);
}

export function formatDate(iso) {
    return parseDate(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function formatMonth(date) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** Newest first; a stable sort keeps authored order within the same day. */
function sortNewestFirst(updates) {
    return [...updates].sort((a, b) => b.date.localeCompare(a.date));
}

/** Groups already-sorted updates into [{ key, label, items }] by month. */
export function groupByMonth(updates) {
    const groups = [];

    updates.forEach((update) => {
        const key = update.date.slice(0, 7);
        const last = groups[groups.length - 1];

        if (last && last.key === key) {
            last.items.push(update);
        } else {
            groups.push({ key, label: formatMonth(parseDate(update.date)), items: [update] });
        }
    });

    return groups;
}

function slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function UpdateLinks({ links, primary = false }) {
    return (
        <div className="ru-links">
            {links.map((link, index) => (
                <Link
                    key={link.to + link.label}
                    to={link.to}
                    className={`btn btn--sm ${
                        primary && index === 0 ? 'btn--primary' : 'btn--ghost'
                    }`}
                >
                    {link.label}
                </Link>
            ))}
        </div>
    );
}

function UpdateCard({ update }) {
    return (
        <li className="ru-item">
            <article className="ru-card">
                <div className="ru-meta">
                    <time className="ru-date" dateTime={update.date}>
                        {formatDate(update.date)}
                    </time>
                    <span className={`ru-tag ru-tag--${slugify(update.category)}`}>
                        {update.category}
                    </span>
                </div>
                <h4 className="ru-card__title">{update.title}</h4>
                <p className="ru-card__body">{update.summary}</p>
                <UpdateLinks links={update.links} />
            </article>
        </li>
    );
}

/**
 * @param {object} props
 * @param {import('./data/recentUpdates').RecentUpdate[]} [props.updates]
 *     defaults to the content module; a test can pass a fixture.
 */
function WhatsNew({ updates = recentUpdates }) {
    const [filter, setFilter] = useState(ALL);

    const sorted = useMemo(() => sortNewestFirst(updates), [updates]);
    const latest = sorted[0];

    const visible = useMemo(
        () => (filter === ALL ? sorted : sorted.filter((u) => u.category === filter)),
        [sorted, filter]
    );
    const groups = useMemo(() => groupByMonth(visible), [visible]);

    const countOf = (category) => sorted.filter((u) => u.category === category).length;
    const categories = CATEGORIES.filter((category) => countOf(category) > 0);

    const range =
        sorted.length > 0
            ? `${formatMonth(parseDate(sorted[sorted.length - 1].date))} – ${formatMonth(
                  parseDate(latest.date)
              )}`
            : null;

    return (
        <main>
            <header className="wn-dash ru-dash">
                <div className="wn-dash__inner">
                    <div className="eyebrow">What&rsquo;s new{range ? ` · ${range}` : ''}</div>
                    <h1 className="wn-dash__title">Fresh off the trailer.</h1>
                    <p className="hero__lead wn-dash__lead">
                        Everything that has changed on the site over the last six months: new
                        galleries, new videos, new build log entries and the fixes in between.
                        Every update links straight to the thing that changed.
                    </p>

                    <dl className="ru-stats">
                        <div className="ru-stat">
                            <dt>Updates</dt>
                            <dd>{sorted.length}</dd>
                        </div>
                        {categories.map((category) => (
                            <div className="ru-stat" key={category}>
                                <dt>{category}</dt>
                                <dd>{countOf(category)}</dd>
                            </div>
                        ))}
                    </dl>

                    {latest ? (
                        <article className="ru-latest" aria-labelledby="ru-latest-title">
                            <div className="ru-meta">
                                <span className="ru-latest__flag">Latest</span>
                                <time className="ru-date" dateTime={latest.date}>
                                    {formatDate(latest.date)}
                                </time>
                                <span className={`ru-tag ru-tag--${slugify(latest.category)}`}>
                                    {latest.category}
                                </span>
                            </div>
                            <h2 className="ru-latest__title" id="ru-latest-title">
                                {latest.title}
                            </h2>
                            <p className="ru-card__body">{latest.summary}</p>
                            <UpdateLinks links={latest.links} primary />
                        </article>
                    ) : null}
                </div>
            </header>

            <section className="section" aria-labelledby="ru-timeline-title">
                <div className="wn-ledger__inner">
                    <div className="ru-head">
                        <div>
                            <div className="eyebrow">The timeline</div>
                            <h2 className="cl-head__title" id="ru-timeline-title">
                                Every update, newest first.
                            </h2>
                        </div>
                        <div className="ru-filters" role="group" aria-label="Filter updates">
                            {[ALL, ...categories].map((category) => (
                                <button
                                    key={category}
                                    type="button"
                                    className="chip chip--toggle"
                                    aria-pressed={filter === category}
                                    onClick={() => setFilter(category)}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    </div>

                    {groups.length === 0 ? (
                        <p className="ru-empty">Nothing here yet. Check back soon.</p>
                    ) : (
                        groups.map((group) => (
                            <section className="ru-month" key={group.key}>
                                <h3 className="ru-month__title">{group.label}</h3>
                                <ol className="ru-list">
                                    {group.items.map((update) => (
                                        <UpdateCard
                                            key={update.date + update.title}
                                            update={update}
                                        />
                                    ))}
                                </ol>
                            </section>
                        ))
                    )}

                    <p className="ru-archive">
                        Looking for the full story of the V2 redesign?{' '}
                        <Link to={ARCHIVE_PATH}>Read the original launch ledger</Link>.
                    </p>
                </div>
            </section>
        </main>
    );
}

export default WhatsNew;
