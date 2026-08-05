import VideoCard from './VideoCard';
import { videos } from './videos';

/**
 * The videos section, ported from the mockups' home.html video block.
 *
 * Serves two surfaces unchanged: the home page's video section, and the whole
 * of /youtube. It is still the default export of components/YouTube because
 * both call sites import it from there — the component behind the name changed,
 * the module seam deliberately did not.
 *
 * The three eager <iframe> columns this replaces mounted a YouTube player on
 * every visit to either surface whether or not anyone pressed play. The cards
 * below mount none until clicked.
 */
function VideoGrid() {
    return (
        <section className="section section--videos" id="videos">
            <div className="container">
                <div className="section-head">
                    <div className="eyebrow">On camera</div>
                    <h2>Videos</h2>
                    <p className="sub">
                        Onboards, build recaps and autocross runs from the YouTube channel.
                    </p>
                </div>
                <div className="video-grid">
                    {videos.map((video) => (
                        <VideoCard key={video.id} video={video} />
                    ))}
                </div>
            </div>
        </section>
    );
}

export default VideoGrid;
