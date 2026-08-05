import { useState } from 'react';

/**
 * hqdefault is the one rendition YouTube guarantees for every video — maxres
 * 404s on anything never uploaded at 720p+, which would leave a broken poster.
 * It is 4:3 with letterbox bars; the 16:9 frame crops them off.
 */
const posterUrlFor = (id) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

/**
 * autoplay=1 is what keeps the facade a one-click affordance: the click that
 * mounts the player is the click that starts it, rather than the visitor paying
 * for the swap with a second click on YouTube's own play button.
 */
const embedUrlFor = (id) => `https://www.youtube.com/embed/${id}?autoplay=1`;

/**
 * One video, mounted as a poster facade.
 *
 * The card owns whether it is playing; the grid hands it data and nothing else.
 * Until the visitor clicks, there is no iframe in the tree at all — the poster
 * is a plain <img>, so the surface costs three image requests instead of three
 * embedded YouTube players, each of which pulls its own document, player bundle
 * and cookies before anyone has asked to watch anything.
 *
 * The facade is a <button> rather than the mockup's inert <div>: it is the
 * click target, so it has to be reachable by keyboard and announce itself.
 *
 * @param {object} props
 * @param {import('./videos').Video} props.video
 */
function VideoCard({ video }) {
    const [isPlaying, setIsPlaying] = useState(false);

    return (
        <article className="video">
            {isPlaying ? (
                <div className="video__frame">
                    <iframe
                        className="video__player"
                        src={embedUrlFor(video.id)}
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    />
                </div>
            ) : (
                <button
                    type="button"
                    className="video__frame"
                    onClick={() => setIsPlaying(true)}
                    aria-label={`Play ${video.title}`}
                >
                    <img
                        className="video__poster"
                        src={posterUrlFor(video.id)}
                        alt=""
                        width="480"
                        height="360"
                        loading="lazy"
                    />
                    <span className="video__play" aria-hidden="true" />
                </button>
            )}
            <div className="video__body">
                <div className="card__kicker">{video.meta}</div>
                <h4 className="video__title">{video.title}</h4>
            </div>
        </article>
    );
}

export default VideoCard;
