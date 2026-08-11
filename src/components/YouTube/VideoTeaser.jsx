import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import VideoCard from './VideoCard';
import { VideoGridSkeleton } from './VideoStates';
import { CHANNEL_FALLBACK, loadVideoManifest } from './videoManifest';
import { VIDEO_COPY } from './videoCopy';
import { byNewest } from './videoFormat';

/** How many uploads the home strip previews. The hub at /youtube carries them all. */
export const TEASER_COUNT = 3;

/**
 * The home page's videos section.
 *
 * WHY THIS IS NOT THE HUB
 * Home already composes a preview strip rather than mounting GalleryHub, for a
 * reason that applies here identically: the hub owns an <h1>, and mounting it
 * under the hero gave the page a second masthead. Same trade, same shape — a
 * small purpose-built section reading the same manifest, so the hub's chrome
 * stays on the route that owns it.
 *
 * The cards carry no `onOpen`, so they play in place. The overlay exists to stop
 * a long grid from accumulating live players; three cards on a home page do not
 * need it, and an overlay is a heavier interaction than a home teaser earns.
 *
 * DEGRADATION
 * The section's box is held whatever happens — skeleton while the fetch is in
 * flight, a line of copy and a channel link when the manifest is missing or
 * empty. It never renders nothing: this section closes the home page, so
 * collapsing it after mount would move the footer by its whole height, which is
 * the shift Bug 00077 was about.
 */
function VideoTeaser() {
    const [videos, setVideos] = useState([]);
    const [channel, setChannel] = useState(CHANNEL_FALLBACK);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let current = true;

        loadVideoManifest().then((result) => {
            if (!current) {
                return;
            }

            setVideos([...result.items].sort(byNewest).slice(0, TEASER_COUNT));
            setChannel(result.channel);
            setLoading(false);
        });

        return () => {
            current = false;
        };
    }, []);

    return (
        <section className="section section--videos" id="videos">
            <div className="container">
                <div className="section-head videos-teaser__head">
                    <div>
                        <div className="eyebrow">{VIDEO_COPY.teaser.eyebrow}</div>
                        <h2>{VIDEO_COPY.teaser.title}</h2>
                        <p className="sub">{VIDEO_COPY.teaser.sub}</p>
                    </div>
                    <Link className="btn btn--ghost btn--sm" to="/youtube">
                        {VIDEO_COPY.teaser.all} &rsaquo;
                    </Link>
                </div>

                {loading && <VideoGridSkeleton count={TEASER_COUNT} size="md" />}

                {!loading && videos.length === 0 && (
                    <p className="videos-hub__status">
                        {VIDEO_COPY.teaser.fallback}{' '}
                        <a
                            className="videos-hub__channel"
                            href={channel.url}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            {VIDEO_COPY.states.openChannel}
                        </a>
                    </p>
                )}

                {!loading && videos.length > 0 && (
                    <div className="video-grid">
                        {videos.map((video) => (
                            <VideoCard key={video.videoId} video={video} size="md" />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

export default VideoTeaser;
