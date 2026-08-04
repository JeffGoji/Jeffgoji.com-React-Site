import { Link } from 'react-router-dom';

import { resolveCarImage } from './carImages';

/**
 * The bloglink a car carries when it has no build log of its own.
 *
 * Cars.json points every live car at its blog route and parks the retired one
 * on the site root, so the absence of a log is expressed as "links home" rather
 * than as a separate flag. Reading that sentinel here keeps the tribute state
 * derived from the one field the data already owns instead of adding a second,
 * desyncable one.
 */
export const RETIRED_BLOGLINK = '/';

/**
 * @param {string} bloglink a car's `bloglink` field
 * @returns {boolean} whether the car is retired and gets the tribute treatment
 */
export const isRetired = (bloglink) => bloglink === RETIRED_BLOGLINK;

/**
 * A single car, in the two shapes the V2 surfaces ask for.
 *
 * Props mirror a `Garage/Cars.json` entry field for field, so every call site
 * spreads one: `<CarCard variant="hub" {...car} />`. `img` is therefore the
 * data's own src-relative path, resolved to a bundled asset url here rather
 * than by each caller -- an unresolved path is a data defect, not a per-surface
 * one, and centralising it keeps a consumer from silently rendering a broken
 * portrait.
 *
 * variant `hub` (the /garage page) carries the number tag and a build-log call
 * to action; variant `preview` (the home garage strip) drops both and makes the
 * whole card the link, which is the only structural difference between the two
 * mockups.
 *
 * A retired car has no build log to open, so neither variant wraps it in a
 * link: `hub` swaps the call to action for a non-interactive tribute chip and
 * `preview` renders a plain article. That is what keeps the retired car off a
 * link that would otherwise route the reader home for no reason.
 *
 * @param {object} props a Cars.json entry plus `variant`
 * @param {number} props.id
 * @param {string} props.make
 * @param {string} props.model
 * @param {number} props.year
 * @param {string} props.label short identity line, used as the image's alt text
 * @param {string} props.tag editorial descriptor shown in the kicker
 * @param {string} props.img path relative to src/assets/images/
 * @param {string} props.description
 * @param {string} props.name the car's name
 * @param {string} props.bloglink router path to the car's build log
 * @param {'hub' | 'preview'} [props.variant]
 */
function CarCard({
    id,
    make,
    model,
    year,
    label,
    tag,
    img,
    description,
    name,
    bloglink,
    variant = 'preview',
}) {
    const isHub = variant === 'hub';
    const retired = isRetired(bloglink);

    const content = (
        <>
            <div className="card__media media--editorial">
                <img src={resolveCarImage(img)} alt={`${name} - ${label}`} loading="lazy" />
                {isHub && <span className="numtag card__numtag">#{id}</span>}
            </div>
            <div className="card__body">
                <div className="card__kicker">
                    {year} {make} &middot; {tag}
                </div>
                <h3 className="card__title">
                    {name} <small>{model}</small>
                </h3>
                <p className="card__text">{description}</p>
                {isHub &&
                    (retired ? (
                        <span className="btn btn--ghost btn--sm is-retired">Retired &middot; tribute</span>
                    ) : (
                        <Link className="btn btn--primary btn--sm" to={bloglink}>
                            Read the build log &rsaquo;
                        </Link>
                    ))}
            </div>
        </>
    );

    const className = `card car-card car-card--${variant}`;

    if (isHub || retired) {
        return <article className={className}>{content}</article>;
    }

    return (
        <Link className={className} to={bloglink}>
            {content}
        </Link>
    );
}

export default CarCard;
