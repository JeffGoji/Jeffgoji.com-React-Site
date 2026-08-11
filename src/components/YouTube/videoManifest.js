/**
 * The runtime seam between the hub and the build-time manifest.
 *
 * The manifest is fetched rather than imported for the same reason the gallery
 * manifests are: it is written into public/ by a build script, is served as a
 * static file independently of the bundle, and can therefore be refreshed by a
 * rebuild without shipping new JavaScript. Bundling it would put the channel's
 * upload list inside a content-hashed chunk and make every new video a code
 * change.
 *
 * @typedef {object} VideoItem
 * @property {string} videoId      YouTube id. React key, poster path segment and
 *                                 embed path segment, so it must be unique.
 * @property {string} title
 * @property {string} description  First paragraph of the feed's description.
 * @property {string} publishedAt  ISO 8601.
 * @property {string} thumbnailUrl
 * @property {string} playlistId   The series the item belongs to.
 * @property {string} [seriesTitle]
 * @property {string[]} [tags]     Never present today; see videoFormat.tagsIn.
 */

/**
 * Where `scripts/build-videos.mjs` writes, restated rather than imported: that
 * script reaches for `node:fs`, so importing it here would drag Node built-ins
 * into the browser bundle. The two constants are held in step by an assertion in
 * scripts/build-videos.test.js rather than by the module graph.
 */
export const MANIFEST_PUBLIC_PATH = '/videos/manifest.json';

/**
 * The channel the hub points at when it has no manifest to read one from.
 *
 * The canonical channel URL reported by the playlist's own feed, not the
 * `@jeffgoji673` handle the designer's mockup guessed at — that handle belongs
 * to a different channel from the one hosting this playlist. A channel id URL
 * also survives a handle change, which a handle URL does not.
 *
 * It is used ONLY as the href of the error state's escape hatch: a populated
 * manifest carries the channel the feed reported and that always wins.
 */
export const CHANNEL_FALLBACK = {
    title: 'Jeff Goji',
    url: 'https://www.youtube.com/channel/UCWFYo-fK6vyfANHBeF2O9BA',
};

/**
 * Reads the manifest, distinguishing "did not load" from "loaded and is empty".
 *
 * The two are separate here — unlike GalleryHub, which collapses them — because
 * the designs give them different treatments: an empty manifest is a statement
 * about the channel, a failed fetch is a dead end that has to offer a way out.
 * Both are normal: until the playlist id is configured and `videos:build` has
 * run, there is no manifest at this path at all.
 *
 * The JSON parse sits inside the guard for a reason specific to this host: the
 * SPA fallback in public/_redirects answers an unknown path with index.html and
 * a 200, so a missing manifest arrives as HTML that only fails at parse time.
 * The `ok` check alone would let it through; it earns its place for the dev
 * server, which does answer 404.
 *
 * @returns {Promise<{ok: boolean, items: VideoItem[], channel: {title: string, url: string}}>}
 */
export async function loadVideoManifest() {
    try {
        const response = await fetch(MANIFEST_PUBLIC_PATH);

        if (!response.ok) {
            return { ok: false, items: [], channel: CHANNEL_FALLBACK };
        }

        const manifest = await response.json();

        return {
            ok: true,
            items: Array.isArray(manifest?.items) ? manifest.items : [],
            channel: {
                title: manifest?.channel?.title || CHANNEL_FALLBACK.title,
                url: manifest?.channel?.url || CHANNEL_FALLBACK.url,
            },
        };
    } catch {
        return { ok: false, items: [], channel: CHANNEL_FALLBACK };
    }
}
