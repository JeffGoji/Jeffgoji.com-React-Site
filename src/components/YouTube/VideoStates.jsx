import { VIDEO_COPY } from './videoCopy';

/**
 * The non-populated states the videos surfaces have to survive.
 *
 * WHY THESE FOUR
 * The data path is a build-time RSS fetch written to a manifest, then read over
 * the network at runtime exactly as the gallery hub reads its own. That path has
 * all four outcomes:
 *   loading — the fetch is in flight (first paint on a cold cache)
 *   empty   — the manifest is there and has nothing in it, or a filter excludes
 *             everything
 *   error   — the fetch failed, or `videos:build` never ran and the manifest was
 *             never written. This is the STEADY STATE until the playlist id is
 *             configured, not an exotic branch.
 *   ready   — the populated grid
 *
 * The skeleton reserves the grid's height rather than collapsing to a line of
 * status text. GalleryHub had to add `--reserved` after a 0.812 CLS regression
 * (Bug 00077) caused by exactly that collapse; this hub inherits the same
 * fetch-after-mount shape and does not have to learn it twice.
 */

/** @param {{count?: number, size?: 'sm'|'md'|'lg'}} props */
export function VideoGridSkeleton({ count = 8, size = 'md' }) {
    return (
        <div className={`video-grid video-grid--${size}`} aria-hidden="true">
            {Array.from({ length: count }, (_, index) => (
                <div key={index} className={`video video--${size} video-skeleton`}>
                    <div className="video__frame video-skeleton__block" />
                    <div className="video__body">
                        <div className="video-skeleton__line video-skeleton__line--kicker" />
                        <div className="video-skeleton__line" />
                        <div className="video-skeleton__line video-skeleton__line--short" />
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * The live-region announcement that rides alongside the skeleton.
 *
 * Split from the skeleton because the skeleton is aria-hidden decoration; a
 * screen reader needs one sentence, not eight fake cards.
 */
export function LoadingStatus({ label = VIDEO_COPY.states.loading }) {
    return (
        <p className="videos-hub__status" role="status">
            {label}…
        </p>
    );
}

/** @param {{title?: string, hint?: string, onReset?: () => void}} props */
export function EmptyState({
    title = VIDEO_COPY.states.emptyTitle,
    hint = VIDEO_COPY.states.emptyHint,
    onReset,
}) {
    return (
        <div className="videos-state" role="status">
            <div className="eyebrow">{VIDEO_COPY.states.emptyEyebrow}</div>
            <h2 className="videos-state__title">{title}</h2>
            <p className="videos-state__body">{hint}</p>
            {onReset && (
                <button type="button" className="btn btn--ghost" onClick={onReset}>
                    {VIDEO_COPY.states.clearFilters}
                </button>
            )}
        </div>
    );
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
        <div className="videos-state videos-state--error" role="alert">
            <div className="eyebrow">{VIDEO_COPY.states.errorEyebrow}</div>
            <h2 className="videos-state__title">{VIDEO_COPY.states.errorTitle}</h2>
            <p className="videos-state__body">{VIDEO_COPY.states.errorBody}</p>
            <div className="videos-state__actions">
                {onRetry && (
                    <button type="button" className="btn btn--primary" onClick={onRetry}>
                        {VIDEO_COPY.states.retry}
                    </button>
                )}
                <a
                    className="btn btn--ghost"
                    href={channelUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                >
                    {VIDEO_COPY.states.openChannel}
                </a>
            </div>
        </div>
    );
}
