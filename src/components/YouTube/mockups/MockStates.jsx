/**
 * MOCKUP — the non-populated states every option has to survive.
 *
 * They are shared rather than reimplemented per option for the same reason the
 * formatters are: a difference between A, B and C should be a layout decision,
 * not a divergence in how a failure reads.
 *
 * WHY THESE FOUR
 * The production data path will be a build-time YouTube Data API fetch written
 * to a manifest, then read over the network at runtime exactly like the gallery
 * hub reads manifest.json. That path has all four outcomes:
 *   loading — the fetch is in flight (first paint on a cold cache)
 *   empty   — the manifest is there and has nothing matching (a filter that
 *             excludes everything, or a series with no uploads yet)
 *   error   — the fetch failed, or the API quota was exhausted at build time and
 *             the manifest was never written
 *   ready   — the populated grid
 *
 * The skeleton reserves the grid's height rather than collapsing to a line of
 * status text. GalleryHub had to add `--reserved` after a 0.812 CLS regression
 * (Bug 00077) caused by exactly that collapse; the videos hub inherits the same
 * fetch-after-mount shape and should not have to learn it twice.
 */

/** @param {{count?: number, size?: 'sm'|'md'|'lg'}} props */
export function VideoGridSkeleton({ count = 8, size = 'md' }) {
    return (
        <div className={`vx-grid vx-grid--${size}`} aria-hidden="true">
            {Array.from({ length: count }, (_, index) => (
                <div key={index} className={`vx-card vx-card--${size} vx-skeleton`}>
                    <div className="vx-card__frame vx-skeleton__block" />
                    <div className="vx-card__body">
                        <div className="vx-skeleton__line vx-skeleton__line--kicker" />
                        <div className="vx-skeleton__line" />
                        <div className="vx-skeleton__line vx-skeleton__line--short" />
                    </div>
                </div>
            ))}
        </div>
    )
}

/**
 * The live-region announcement that rides alongside the skeleton.
 *
 * Split from the skeleton because the skeleton is aria-hidden decoration; a
 * screen reader needs one sentence, not eight fake cards.
 */
export function LoadingStatus({ label = 'Loading videos' }) {
    return (
        <p className="vx-status" role="status">
            {label}…
        </p>
    )
}

/** @param {{title?: string, hint?: string, onReset?: () => void}} props */
export function EmptyState({
    title = 'No videos here yet',
    hint = 'Try another series, or clear the filters.',
    onReset,
}) {
    return (
        <div className="vx-state" role="status">
            <div className="eyebrow">Nothing to play</div>
            <h3 className="vx-state__title">{title}</h3>
            <p className="vx-state__body">{hint}</p>
            {onReset && (
                <button type="button" className="btn btn--ghost" onClick={onReset}>
                    Clear filters
                </button>
            )}
        </div>
    )
}

/**
 * The failure state points at the channel rather than only apologising: the
 * videos exist on YouTube whether or not this site managed to list them, so the
 * dead end is recoverable without a retry.
 *
 * @param {{channelUrl: string, onRetry?: () => void}} props
 */
export function ErrorState({ channelUrl, onRetry }) {
    return (
        <div className="vx-state vx-state--error" role="alert">
            <div className="eyebrow">Off track</div>
            <h3 className="vx-state__title">The video list did not load</h3>
            <p className="vx-state__body">
                Something went wrong fetching the channel index. Everything is still on
                YouTube in the meantime.
            </p>
            <div className="vx-state__actions">
                {onRetry && (
                    <button type="button" className="btn btn--primary" onClick={onRetry}>
                        Try again
                    </button>
                )}
                <a
                    className="btn btn--ghost"
                    href={channelUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                >
                    Open the channel
                </a>
            </div>
        </div>
    )
}
