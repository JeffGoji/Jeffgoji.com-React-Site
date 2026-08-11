/**
 * Builds the videos hub's manifest from one YouTube playlist's public RSS feed.
 *
 * WHY RSS AND NOT THE DATA API
 * `https://www.youtube.com/feeds/videos.xml?playlist_id=<id>` needs no API key,
 * no OAuth, no billing account and has no quota. The Data API needs all four,
 * and the only things it would buy this site are a duration and a view count —
 * neither of which the hub renders. The trade is deliberate: the feed carries
 * less, so the hub shows less, rather than the site growing a paid dependency to
 * decorate a card.
 *
 * WHAT THE FEED ACTUALLY CARRIES (verified against a live feed, 2026-08-10)
 * Each <entry> has <yt:videoId>, <title>, <published> (ISO 8601), and inside
 * <media:group> a <media:thumbnail url> and a <media:description>. There is NO
 * duration anywhere in the format. There IS a <media:community><media:statistics
 * views> on some entries, but it is deliberately not parsed: view counts are
 * frozen at whatever the feed cached, and a stale number rendered as a fact is
 * worse than no number.
 *
 * Two properties of the format drive the parser below:
 *   - entries arrive in PLAYLIST order, not date order, and the feed's own
 *     document-level <published> precedes the first entry — so dates must be
 *     read per entry and the list sorted here rather than trusted as it lands.
 *   - the feed is capped at the 15 most recent playlist items. A longer playlist
 *     silently truncates. That is a limit of the source, not of this script.
 *
 * WHY NO XML PARSER DEPENDENCY
 * The shape is one flat repeated element with no namespaced attributes to
 * resolve, no mixed content and no optional nesting — a published, stable
 * format YouTube has not changed in a decade. `parseDateAlt` in
 * build-gallery.mjs is the precedent for hand-parsing a known-shape string here
 * rather than taking a package for it. The one genuinely fiddly part, entity
 * decoding, is handled explicitly below and covered by tests.
 *
 * WHY THE PLAYLIST ID IS ENVIRONMENT-ONLY
 * The channel this builds for has private playlists mixed in with the public
 * one. A committed default is one typo away from publishing a personal
 * music-mix playlist to the front page, so there is no default at all: an unset
 * variable is a hard failure with a message naming the variable.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** The one configuration input. Named in every failure message on purpose. */
export const PLAYLIST_ENV_VAR = "VIDEOS_PLAYLIST_ID";

export const OUT_DIR = "public/videos";
export const MANIFEST_FILENAME = "manifest.json";

/** The path the hub fetches at runtime. Mirrors /gallery/<id>/manifest.json. */
export const MANIFEST_PUBLIC_PATH = "/videos/manifest.json";

/**
 * How much of a description survives into the manifest.
 *
 * A YouTube description box is a link dump with prose at the top; the card and
 * the hero both want the prose and neither has room for the dump.
 */
export const DESCRIPTION_MAX = 200;

export const feedUrlFor = (playlistId) =>
    `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;

/**
 * hqdefault is the one rendition YouTube guarantees for every video, matching
 * the production card's poster convention. Used only when the feed omits its own
 * <media:thumbnail>, which it occasionally does for very fresh uploads.
 */
export const posterFallbackFor = (videoId) =>
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

/**
 * A playlist id is opaque, so this checks shape and nothing else: URL-safe
 * characters, long enough not to be a placeholder. The floor is deliberately
 * well under the shortest id observed in the wild — the canonical `PL` + 32
 * form is 34 characters, but this channel's own list is 13 — because a bound
 * tuned to the ids that exist today would reject whichever length YouTube mints
 * next. It exists only to catch "", " ", "TODO" and "<your-id>" before they
 * become a 404 that reads like a network problem.
 */
const PLAYLIST_ID_SHAPE = /^[A-Za-z0-9_-]{10,}$/;

/**
 * The XML entities YouTube emits. `&amp;` is decoded last: decoding it first
 * would turn a literal `&amp;lt;` in a title into a `<`, which is the classic
 * double-decode bug.
 */
const NAMED_ENTITIES = [
    [/&lt;/g, "<"],
    [/&gt;/g, ">"],
    [/&quot;/g, '"'],
    [/&apos;/g, "'"],
];

export function decodeEntities(text) {
    let out = text;

    for (const [pattern, replacement] of NAMED_ENTITIES) {
        out = out.replace(pattern, replacement);
    }

    out = out
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));

    return out.replace(/&amp;/g, "&");
}

/**
 * Reads one element's text content out of a fragment.
 *
 * The tag name is embedded rather than interpolated from caller input, so the
 * `:` in `yt:videoId` and `media:description` needs no escaping — and matching
 * `<title>` cannot accidentally match `<media:title>`, because the pattern
 * requires the `<` immediately before the name.
 */
function textOf(fragment, tagName) {
    const match = fragment.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`));

    return match ? decodeEntities(match[1]).trim() : "";
}

function attributeOf(fragment, tagName, attribute) {
    const match = fragment.match(new RegExp(`<${tagName}\\b[^>]*\\b${attribute}="([^"]*)"`));

    return match ? decodeEntities(match[1]) : "";
}

/**
 * The first paragraph of a description, flattened to one line.
 *
 * Lines that are nothing but a URL are dropped before the paragraph is chosen:
 * a channel that opens its description with a sponsor link would otherwise have
 * that link become the card's entire blurb.
 */
export function shortDescription(raw) {
    if (!raw) {
        return "";
    }

    const paragraph =
        raw
            .replace(/\r\n/g, "\n")
            .split(/\n\s*\n/)
            .map((block) =>
                block
                    .split("\n")
                    .filter((line) => !/^\s*https?:\/\/\S+\s*$/.test(line))
                    .join(" ")
                    .replace(/\s+/g, " ")
                    .trim()
            )
            .find((block) => block.length > 0) ?? "";

    if (paragraph.length <= DESCRIPTION_MAX) {
        return paragraph;
    }

    const clipped = paragraph.slice(0, DESCRIPTION_MAX);
    const lastSpace = clipped.lastIndexOf(" ");

    return `${(lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).replace(/[\s.,;:—-]+$/, "")}…`;
}

/** Newest first. The channel's own default and the order the manifest ships in. */
export const byNewest = (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt);

/**
 * Turns the feed document into the manifest's item list plus the two bits of
 * channel identity the hub's error state needs.
 *
 * Entries missing a videoId or a published date are dropped rather than
 * defaulted: an item with no id cannot be played and an item with no date cannot
 * be sorted, and either one shipped as a card is a visibly broken tile.
 */
export function parseFeed(xml, playlistId) {
    const head = xml.split("<entry>")[0] ?? "";

    const entries = xml
        .split("<entry>")
        .slice(1)
        .map((chunk) => chunk.split("</entry>")[0]);

    const items = entries
        .map((entry) => {
            const videoId = textOf(entry, "yt:videoId");
            const publishedAt = textOf(entry, "published");

            return {
                videoId,
                title: textOf(entry, "title"),
                description: shortDescription(textOf(entry, "media:description")),
                publishedAt,
                thumbnailUrl:
                    attributeOf(entry, "media:thumbnail", "url") || posterFallbackFor(videoId),
                playlistId,
                seriesTitle: textOf(head, "title"),
            };
        })
        .filter((item) => item.videoId && item.publishedAt)
        .sort(byNewest);

    return {
        playlistTitle: textOf(head, "title"),
        channel: {
            title: textOf(head, "name"),
            url: textOf(head, "uri"),
        },
        items,
    };
}

/**
 * Assembles the whole manifest document.
 *
 * `playlistId` is carried on every item as well as at the top level so the
 * schema already supports a second series without a breaking change — the hub's
 * series filter groups on the item field, and today every item simply carries
 * the same value, which is exactly why the filter row stays hidden.
 */
export function manifestFrom(xml, playlistId) {
    const { playlistTitle, channel, items } = parseFeed(xml, playlistId);

    return {
        playlistId,
        playlistTitle,
        channel,
        source: "rss",
        generatedAt: new Date().toISOString(),
        count: items.length,
        items,
    };
}

/**
 * Reads the playlist id out of an environment, refusing anything that is not
 * plausibly one.
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function resolvePlaylistId(env = process.env) {
    const raw = (env[PLAYLIST_ENV_VAR] ?? "").trim();

    if (!raw) {
        throw new Error(
            `[videos] ${PLAYLIST_ENV_VAR} is not set. Set it to the PUBLIC YouTube playlist ` +
                `the videos hub should list, e.g. ${PLAYLIST_ENV_VAR}=PLxxxxxxxxxxxxxxxxxx. ` +
                `There is deliberately no default — a wrong one would publish a private playlist.`
        );
    }

    if (!PLAYLIST_ID_SHAPE.test(raw)) {
        throw new Error(
            `[videos] ${PLAYLIST_ENV_VAR}="${raw}" does not look like a YouTube playlist id ` +
                `(expected a long URL-safe token such as PLxxxxxxxxxxxxxxxxxx). ` +
                `Copy the list= value out of the playlist's URL.`
        );
    }

    return raw;
}

/**
 * Fetches, parses and writes the manifest.
 *
 * An empty feed is fatal for the same reason build-gallery treats an empty
 * source directory as fatal: a private playlist, a deleted playlist and a typo
 * in the id are all indistinguishable from a legitimately empty one at this
 * layer, and shipping `count: 0` turns any of them into a silently blank hub
 * that only a visitor would ever notice.
 *
 * @param {object} [options]
 * @param {string} [options.playlistId]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {string} [options.outDir]
 */
export async function buildVideos({
    playlistId = resolvePlaylistId(),
    fetchImpl = fetch,
    outDir = OUT_DIR,
} = {}) {
    const url = feedUrlFor(playlistId);
    const response = await fetchImpl(url);

    if (!response.ok) {
        throw new Error(
            `[videos] ${url} answered ${response.status}. A 404 here almost always means the ` +
                `playlist is Private or Unlisted — the RSS feed only serves Public playlists.`
        );
    }

    const manifest = manifestFrom(await response.text(), playlistId);

    if (manifest.count === 0) {
        throw new Error(
            `[videos] the feed for playlist ${playlistId} parsed to zero videos. Check the ` +
                `playlist is Public and has at least one video in it.`
        );
    }

    const targetDir = path.resolve(outDir);

    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(
        path.join(targetDir, MANIFEST_FILENAME),
        JSON.stringify(manifest, null, 2),
        "utf8"
    );

    console.log(
        `[videos] ${manifest.count} videos from "${manifest.playlistTitle}" -> ${MANIFEST_PUBLIC_PATH}`
    );

    return manifest;
}

/**
 * `--optional` downgrades a MISSING CONFIGURATION to a warning so `npm run dev`
 * still starts on a machine where the playlist has not been chosen yet. It does
 * NOT soften a bad id, a private playlist or a network failure — those stay
 * fatal in every mode, because each of them means the configuration that does
 * exist is wrong rather than absent.
 */
export async function main(argv = process.argv.slice(2), env = process.env) {
    const optional = argv.includes("--optional");
    let playlistId;

    try {
        playlistId = resolvePlaylistId(env);
    } catch (error) {
        if (optional && !(env[PLAYLIST_ENV_VAR] ?? "").trim()) {
            console.warn(`${error.message}\n[videos] skipping (--optional): the hub will render its empty state.`);

            return null;
        }

        throw error;
    }

    return buildVideos({ playlistId });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((e) => {
        console.error(String(e?.message ?? e));
        process.exit(1);
    });
}
