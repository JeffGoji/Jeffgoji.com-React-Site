/**
 * Shared, data-driven build-log surface for every car blog.
 *
 * Collapses the four near-identical `blog/{Miyoshi,Kiryu,Kasumi,Panda}` bodies
 * onto one component: they differ only by which `*Blog.json` they import and
 * what sits in their banner, so both of those arrive as props.
 *
 * SECURITY (Spec 00002 part P8 / AC-016): entries are markdown ONLY. The
 * renderer runs `remark-gfm` and nothing else — no `rehype-raw`, no
 * `rehypePlugins` at all, and no `dangerouslySetInnerHTML` anywhere on this
 * path. Raw HTML authored into a JSON `entry` is therefore escaped to text
 * rather than mounted. Adding a raw-HTML plugin here re-opens stored XSS
 * through the content files and is guarded by BlogList.test.jsx.
 */

import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const POSTS_PER_PAGE = 3;

/**
 * The custom `p` / `img` / `a` renderers carried over verbatim from the
 * per-car blog components. They are the reason entries look the way they do
 * today; the V2 re-skin changes the surface around them, not them.
 *
 * Two corrections travel with them. `node` is pulled out of each props bag
 * because react-markdown hands the mdast node to every component override, and
 * React warns when that non-DOM prop reaches a real element through the spread.
 * And the image is no longer wrapped in a centring <div>: markdown puts an
 * inline image inside a paragraph, so that wrapper was a <div> inside a <p> —
 * invalid nesting the browser resolves by splitting the paragraph. Centring
 * moved to `.post__entry img` in styles.scss, which is where the other three
 * per-car components already left it.
 */
const markdownComponents = {
    p: function P({ node, ...props }) {
        return <p {...props} style={{ whiteSpace: 'pre-line', marginBottom: '1rem' }} />;
    },
    img: function Img({ node, ...props }) {
        return (
            <img
                {...props}
                className="img-fluid rounded"
                alt={props.alt || 'blog image'}
                loading="lazy"
            />
        );
    },
    a: function A({ node, ...props }) {
        return <a {...props} target="_blank" rel="noreferrer" />;
    },
};

function Chip({ label, value, className = 'chip' }) {
    return (
        <span className={className}>
            {label} <b>{value}</b>
        </span>
    );
}

/**
 * The per-entry telemetry row. Fields are dropped rather than printed empty
 * when the JSON omits them — c8Blog.json entry 2 has no `cost`, and an
 * unguarded chip renders a bare "COST" there.
 */
function telemetryChips({ date, mileage, cost }) {
    return [
        { label: 'DATE', value: date, className: 'chip' },
        { label: 'MILEAGE', value: mileage === undefined ? undefined : `${mileage} mi`, className: 'chip' },
        { label: 'COST', value: cost, className: 'chip chip--cost' },
    ].filter((chip) => chip.value !== undefined && chip.value !== null && chip.value !== '');
}

/**
 * Car-identity banner. Ported from the mockups' blog.html header; the two
 * values that mockup carries on style attributes (the 44vh floor and the
 * h1-sized title) are class-borne on `.blog-hero` instead.
 */
function BlogBanner({ image, imageAlt, eyebrow, title, chips }) {
    return (
        <header className="hero blog-hero">
            <div className="hero__media media--editorial">
                <img src={image} alt={imageAlt} />
            </div>
            <div className="hero__scrim" />
            <div className="hero__content">
                <div className="container">
                    {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
                    <h1 className="hero__title blog-hero__title">{title}</h1>
                    {chips.length > 0 ? (
                        <div className="spec-row blog-hero__specs">
                            {chips.map((chip) => (
                                <Chip key={chip.label} label={chip.label} value={chip.value} />
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
            <div className="hero__flag" />
        </header>
    );
}

/**
 * @param {object} props
 * @param {Array<{id:number,date:string,mileage:string,picture:string,cost:string,entry:string}>} props.data
 *   One `src/assets/Data/*Blog.json` array. `id` must be a unique number — both
 *   the newest-first sort and the React key read it.
 * @param {string} props.title Heading over the build log, e.g. "NA6 MX-5 Build Log".
 * @param {string} [props.eyebrow] Kicker above that heading.
 * @param {object} [props.banner] Car-identity banner; omit to render none.
 * @param {string} props.banner.image Banner image src.
 * @param {string} props.banner.imageAlt Banner image alt text.
 * @param {string} [props.banner.eyebrow] e.g. "1991 Mazda · NA6 · Daily / Resto".
 * @param {string} props.banner.title Car name, e.g. "Miyoshi".
 * @param {Array<{label:string,value:string}>} [props.banner.chips] Status chips.
 * @param {number} [props.postsPerPage] Page size; defaults to the spec's 3.
 */
function BlogList({
    data,
    title,
    eyebrow = 'Build log',
    banner = null,
    postsPerPage = POSTS_PER_PAGE,
}) {
    const [page, setPage] = useState(1);

    const sorted = useMemo(() => [...data].sort((a, b) => b.id - a.id), [data]);
    const totalPages = Math.max(1, Math.ceil(sorted.length / postsPerPage));
    const posts = useMemo(
        () => sorted.slice((page - 1) * postsPerPage, page * postsPerPage),
        [sorted, page, postsPerPage]
    );

    /**
     * Scrolling on the click rather than from an effect on `page`: an effect
     * also fires on mount, which fights the router-level ScrollToTop and yanks
     * anyone who lands on the route deep-linked. The mockup's mountBlog scrolls
     * from the handlers for the same reason.
     */
    const goToPage = (next) => {
        setPage(next);
        window.scrollTo({ top: 0, behavior: 'auto' });
    };

    return (
        <>
            {banner ? (
                <BlogBanner
                    image={banner.image}
                    imageAlt={banner.imageAlt}
                    eyebrow={banner.eyebrow}
                    title={banner.title}
                    chips={banner.chips ?? []}
                />
            ) : null}

            <main className="section">
                <div className="container">
                    <div className="blog">
                        <div className="section-head">
                            {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
                            <h2>{title}</h2>
                        </div>

                        {posts.map((post) => (
                            <article className="post" key={post.id}>
                                <div className="post__media media--editorial">
                                    <img
                                        src={post.picture}
                                        alt={`${title} — ${post.date}`}
                                        loading="lazy"
                                    />
                                </div>
                                <div className="post__body">
                                    <div className="spec-row post__specs">
                                        {telemetryChips(post).map((chip) => (
                                            <Chip
                                                key={chip.label}
                                                label={chip.label}
                                                value={chip.value}
                                                className={chip.className}
                                            />
                                        ))}
                                    </div>
                                    <div className="post__entry">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={markdownComponents}
                                        >
                                            {post.entry}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </article>
                        ))}

                        {totalPages > 1 ? (
                            <div className="pager">
                                <button
                                    type="button"
                                    className="btn btn--ghost btn--sm"
                                    disabled={page === 1}
                                    onClick={() => goToPage(page - 1)}
                                >
                                    &lsaquo; Prev
                                </button>
                                <span className="pager__count">
                                    PAGE {page} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    className="btn btn--ghost btn--sm"
                                    disabled={page === totalPages}
                                    onClick={() => goToPage(page + 1)}
                                >
                                    Next &rsaquo;
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </main>
        </>
    );
}

export default BlogList;
