import { useState } from 'react'

import {
    embedUrlFor,
    formatDuration,
    formatPublished,
    formatViews,
    playlistTitleFor,
    posterUrlFor,
} from './videoFormat'

/**
 * MOCKUP — the card all three layout options paint.
 *
 * FACADE, PRESERVED
 * This keeps the production VideoCard mechanism intact and deliberately: until
 * the visitor clicks, there is no iframe in the tree at all, only a lazy <img>.
 * A twelve-card grid of eager embeds would pull twelve YouTube documents, twelve
 * player bundles and twelve sets of cookies before anyone asked to watch
 * anything, and the hub only gets bigger from here. Every option below scales
 * that cost at one iframe per deliberate click, never per card rendered.
 *
 * TWO ACTIVATION MODES
 * `onOpen` decides which. Without it the card swaps its own poster for a player
 * in place — production's behaviour. With it the card reports the click upward
 * and stays a poster, which is how Option B keeps exactly one iframe in the
 * document no matter how many cards are on screen, and how it avoids a grid cell
 * turning into a player while its neighbours stay stills.
 *
 * The facade is a <button>, not a div: it is the click target, so it has to be
 * reachable by keyboard and announce itself.
 *
 * `size` drives density only ('sm' | 'md' | 'lg'). It never changes which
 * metadata is present, because a card that drops its duration at one size makes
 * the duration look optional to whoever ports this.
 *
 * @param {object} props
 * @param {import('./sampleVideos').SampleVideo} props.video
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {(video: import('./sampleVideos').SampleVideo) => void} [props.onOpen]
 * @param {boolean} [props.showPlaylist]
 */
function MockVideoCard({ video, size = 'md', onOpen, showPlaylist = true }) {
    const [isPlaying, setIsPlaying] = useState(false)

    const activate = () => {
        if (onOpen) {
            onOpen(video)
            return
        }

        setIsPlaying(true)
    }

    return (
        <article className={`vx-card vx-card--${size}`}>
            {isPlaying ? (
                <div className="vx-card__frame">
                    <iframe
                        className="vx-card__player"
                        src={embedUrlFor(video.videoId)}
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    />
                </div>
            ) : (
                <button
                    type="button"
                    className="vx-card__frame vx-card__frame--button media--editorial"
                    onClick={activate}
                    aria-label={`Play ${video.title}`}
                >
                    <img
                        className="vx-card__poster"
                        src={posterUrlFor(video)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                    />
                    <span className="vx-card__play" aria-hidden="true" />
                    <span className="vx-card__duration" aria-hidden="true">
                        {formatDuration(video.durationSeconds)}
                    </span>
                </button>
            )}

            <div className="vx-card__body">
                {showPlaylist && (
                    <div className="card__kicker">{playlistTitleFor(video.playlistId)}</div>
                )}
                <h3 className="vx-card__title">{video.title}</h3>
                <p className="vx-card__meta">
                    <span>{formatPublished(video.publishedAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatViews(video.viewCount)}</span>
                    <span className="vx-card__meta-duration">
                        <span aria-hidden="true">·</span>
                        {formatDuration(video.durationSeconds)}
                    </span>
                </p>
            </div>
        </article>
    )
}

export default MockVideoCard
