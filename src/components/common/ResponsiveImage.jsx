/**
 * Joins a candidate list into a `srcset` attribute value, or passes a pre-built
 * one through untouched.
 *
 * Two shapes rather than two props: the three rendition sources this project
 * builds disagree on whether the candidate list arrives assembled.
 * `scripts/build-heroes.mjs` writes a finished `srcSet` string into
 * `public/hero/manifest.json` (it has to — the width ladder is truncated to each
 * source photo's native width, so `nc` tops out at 800w while `na` reaches
 * 1024w, and no consumer can derive that from a constant). The gallery manifest
 * and the article derivatives instead expose discrete URLs a caller pairs with
 * the widths it knows. Accepting both on one prop keeps the component from
 * growing a mode flag, and keeps every caller writing the same JSX.
 *
 * An empty list resolves to `undefined` rather than `''` so React omits the
 * attribute entirely; `srcset=""` would suppress the `src` fallback on some
 * engines and leave a blank frame.
 *
 * @param {string | Array<{width: number, url: string}> | undefined} candidates
 * @returns {string | undefined} a `srcset` value, or undefined when there is none
 */
export function buildSrcSet(candidates) {
    if (typeof candidates === 'string') return candidates.trim() || undefined;
    if (!Array.isArray(candidates) || candidates.length === 0) return undefined;

    return candidates.map(({ url, width }) => `${url} ${width}w`).join(', ');
}

/**
 * The project's one responsive `<img>`.
 *
 * It is deliberately ignorant of every manifest shape. A caller reads its own
 * source — `public/gallery/<id>/manifest.json`, `public/hero/manifest.json`, or
 * the flat `/articles/<id>/<slug>-<w>.webp` files that
 * `scripts/build-article-images.mjs` emits with no manifest at all — and hands
 * over a `src` plus candidates. Teaching this component the gallery's field
 * names would bind it to pipeline constants (`THUMB_W` / `DISPLAY_W`) that live
 * in the build script, and the two would desync the first time the ladder
 * changed.
 *
 * Two contract violations throw rather than degrade, because this repo has
 * neither TypeScript nor `prop-types` and a silent miss here ships to
 * production:
 *
 * - Missing `alt`. An `<img>` with no alt attribute is an accessibility defect a
 *   reviewer cannot see in a screenshot. `alt=""` is accepted and passed
 *   through — that is the deliberate marker for a decorative image, and is a
 *   different statement from having forgotten the prop.
 * - A candidate set with no `sizes`. `sizes` has no correct default: it
 *   describes the box the image occupies in a layout this component knows
 *   nothing about, and the browser's fallback of `100vw` is what makes a
 *   correct `srcset` still download the widest file. It is required only
 *   alongside candidates, since `sizes` means nothing without them — an image
 *   with a single rendition is a legitimate use of this component.
 *
 * `loading` defaults to lazy. Above-the-fold images opt out with `eager`; the
 * hero is the case that must, being the home surface's LCP element. Related
 * hints (`decoding`, `fetchpriority`, intrinsic `width`/`height`) are not
 * coupled to that opt-out — they ride the rest spread, so a caller tunes them
 * per surface instead of inheriting one surface's judgement.
 *
 * @param {object} props
 * @param {string} props.src fallback URL, used when the browser ignores srcset
 * @param {string | Array<{width: number, url: string}>} [props.srcSet] pre-built
 *   candidate string, or the candidates to build one from
 * @param {string} [props.sizes] layout hint; required whenever candidates exist
 * @param {string} props.alt alt text; `''` marks a decorative image
 * @param {'lazy' | 'eager'} [props.loading]
 */
function ResponsiveImage({ src, srcSet, sizes, alt, loading = 'lazy', ...rest }) {
    if (typeof alt !== 'string') {
        throw new Error(
            `ResponsiveImage: \`alt\` is required (pass alt="" only to mark a decorative image). Received: ${typeof alt}. src=${src}`
        );
    }

    const candidateSet = buildSrcSet(srcSet);

    if (candidateSet && typeof sizes !== 'string') {
        throw new Error(
            `ResponsiveImage: \`sizes\` is required whenever srcSet candidates are present, and has no safe default. src=${src}`
        );
    }

    return (
        <img
            src={src}
            srcSet={candidateSet}
            sizes={candidateSet ? sizes : undefined}
            alt={alt}
            loading={loading}
            {...rest}
        />
    );
}

export default ResponsiveImage;
