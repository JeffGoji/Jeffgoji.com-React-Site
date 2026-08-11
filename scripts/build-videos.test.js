/**
 * Unit coverage for the videos manifest build script.
 *
 * The script is imported for its exports, which is only safe because it gates
 * `main()` behind an entry-point check — if that gate regresses, this suite
 * starts making network calls and writing into public/ and the failure is loud.
 *
 * WHY A FIXTURE RATHER THAN A LIVE FEED
 * The parser was verified end-to-end against two real playlist feeds during
 * development (see the report for Task 00082). What is pinned here is the SHAPE,
 * as a hand-written Atom document: a live feed in a unit suite would make the
 * suite fail when YouTube is slow, when the machine is offline, or when the
 * playlist's contents change — none of which are defects in this script. The
 * fixture below is a faithful reduction of a real response, entity encoding and
 * playlist-ordered (not date-ordered) entries included.
 *
 * Default (node) environment: nothing here touches the DOM.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
    DESCRIPTION_MAX,
    MANIFEST_PUBLIC_PATH,
    PLAYLIST_ENV_VAR,
    buildVideos,
    decodeEntities,
    feedUrlFor,
    main,
    manifestFrom,
    parseFeed,
    posterFallbackFor,
    resolvePlaylistId,
    shortDescription,
} from './build-videos.mjs';

const PLAYLIST_ID = 'PLtestPlaylist01';

/**
 * A reduction of a real playlist feed. Four entries, deliberately shaped to
 * exercise every branch the parser has:
 *   - entries are in PLAYLIST order, not date order (real feeds are)
 *   - the document's own <published> precedes the first entry and must not be
 *     mistaken for one
 *   - one title carries `&amp;`, `&#39;` and an accented numeric entity
 *   - one entry has no <media:thumbnail>, so the poster falls back
 *   - one description opens with a bare URL line above its prose
 *   - one entry has no <yt:videoId> at all and must be dropped
 */
const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <link rel="self" href="http://www.youtube.com/feeds/videos.xml?playlist_id=${PLAYLIST_ID}"/>
 <id>yt:playlist:${PLAYLIST_ID}</id>
 <yt:playlistId>${PLAYLIST_ID}</yt:playlistId>
 <title>jeffgoji.com</title>
 <author>
  <name>Jeff Goji</name>
  <uri>https://www.youtube.com/channel/UCtestchannelid</uri>
 </author>
 <published>2020-01-01T00:00:00+00:00</published>
 <entry>
  <id>yt:video:aaaaaaaaaaa</id>
  <yt:videoId>aaaaaaaaaaa</yt:videoId>
  <title>Cones &amp; consequences &#8212; Jeff&#39;s fastest run</title>
  <published>2025-03-04T18:00:00+00:00</published>
  <media:group>
   <media:title>Cones &amp; consequences</media:title>
   <media:thumbnail url="https://i2.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg" width="480" height="360"/>
   <media:description>A clean run at the LSR PCA event.

Timing sheets and setup notes below.
https://example.com/setup</media:description>
  </media:group>
 </entry>
 <entry>
  <id>yt:video:bbbbbbbbbbb</id>
  <yt:videoId>bbbbbbbbbbb</yt:videoId>
  <title>Houston BMW/PCA autocross</title>
  <published>2026-01-09T12:30:00+00:00</published>
  <media:group>
   <media:description>https://example.com/sponsor
Full session, every run, no cuts.</media:description>
  </media:group>
 </entry>
 <entry>
  <id>yt:video:ccccccccccc</id>
  <yt:videoId>ccccccccccc</yt:videoId>
  <title>Suspension install, start to finish</title>
  <published>2024-11-20T09:00:00+00:00</published>
  <media:group>
   <media:thumbnail url="https://i4.ytimg.com/vi/ccccccccccc/hqdefault.jpg" width="480" height="360"/>
   <media:description></media:description>
  </media:group>
 </entry>
 <entry>
  <id>yt:video:broken</id>
  <title>An entry with no video id</title>
  <published>2026-02-02T00:00:00+00:00</published>
  <media:group>
   <media:description>Should never reach the manifest.</media:description>
  </media:group>
 </entry>
</feed>`;

const parsed = parseFeed(FIXTURE, PLAYLIST_ID);

describe('the feed url is the keyless RSS endpoint, not the Data API', () => {
    it('addresses the playlist feed', () => {
        expect(feedUrlFor(PLAYLIST_ID)).toBe(
            `https://www.youtube.com/feeds/videos.xml?playlist_id=${PLAYLIST_ID}`
        );
    });

    /** A key or a quota in this URL is the thing this whole approach exists to avoid. */
    it('carries no api key and does not touch googleapis', () => {
        const url = feedUrlFor(PLAYLIST_ID);

        expect(url).not.toContain('googleapis.com');
        expect(url).not.toContain('key=');
    });

    it('escapes the id rather than concatenating it raw', () => {
        expect(feedUrlFor('a b&c')).toContain('a%20b%26c');
    });

    /** The whole script must stay free of the paid client, not just the URL. */
    it('names no Data API surface anywhere in the source', () => {
        const source = readFileSync(resolve(process.cwd(), 'scripts/build-videos.mjs'), 'utf8');

        expect(source).not.toContain('googleapis');
        expect(source).not.toMatch(/\bAPI_KEY\b/);
    });
});

describe('entity decoding', () => {
    it('decodes the named entities YouTube emits', () => {
        expect(decodeEntities('&lt;b&gt; &quot;x&quot; &apos;y&apos;')).toBe('<b> "x" \'y\'');
    });

    it('decodes decimal and hexadecimal references', () => {
        expect(decodeEntities('Jeff&#39;s &#x2014; run')).toBe("Jeff's — run");
    });

    /**
     * `&amp;` must be decoded LAST. Decoding it first turns a literal
     * `&amp;lt;` — which is how a feed escapes the text "&lt;" — into a real
     * `<`, which is the classic double-decode bug.
     */
    it('does not double-decode an escaped entity', () => {
        expect(decodeEntities('&amp;lt;script&amp;gt;')).toBe('&lt;script&gt;');
    });
});

describe('description shortening', () => {
    it('keeps only the first paragraph', () => {
        expect(shortDescription('First para.\n\nSecond para.')).toBe('First para.');
    });

    it('flattens single newlines inside that paragraph', () => {
        expect(shortDescription('One\ntwo\nthree')).toBe('One two three');
    });

    /** A sponsor link at the top would otherwise become the card's whole blurb. */
    it('skips lines that are nothing but a url', () => {
        expect(shortDescription('https://example.com/x\nActual prose.')).toBe('Actual prose.');
    });

    it('falls through to the first paragraph with any prose in it', () => {
        expect(shortDescription('https://example.com/x\n\nProse at last.')).toBe('Prose at last.');
    });

    it('returns empty for an empty description rather than throwing', () => {
        expect(shortDescription('')).toBe('');
        expect(shortDescription(undefined)).toBe('');
    });

    it('truncates long prose on a word boundary', () => {
        const long = `${'word '.repeat(120)}end`;
        const short = shortDescription(long);

        expect(short.length).toBeLessThanOrEqual(DESCRIPTION_MAX + 1);
        expect(short.endsWith('…')).toBe(true);
        expect(short).not.toContain(' …');
    });
});

describe('parsing the feed', () => {
    it('reads every entry that can be rendered', () => {
        expect(parsed.items.map((item) => item.videoId)).toEqual([
            'bbbbbbbbbbb',
            'aaaaaaaaaaa',
            'ccccccccccc',
        ]);
    });

    /**
     * Entries arrive in playlist order and the manifest ships newest-first, so
     * the sort is the script's own — not something the feed can be trusted for.
     */
    it('sorts newest first rather than trusting feed order', () => {
        const dates = parsed.items.map((item) => Date.parse(item.publishedAt));

        expect(dates).toEqual([...dates].sort((a, b) => b - a));
    });

    it('drops an entry with no video id', () => {
        expect(parsed.items.some((item) => item.title.includes('no video id'))).toBe(false);
    });

    it('decodes entities in titles', () => {
        expect(parsed.items.find((item) => item.videoId === 'aaaaaaaaaaa').title).toBe(
            "Cones & consequences — Jeff's fastest run"
        );
    });

    /** <title> must not be satisfied by <media:title> inside the same entry. */
    it('takes the entry title, not the media title', () => {
        expect(parsed.items.find((item) => item.videoId === 'aaaaaaaaaaa').title).toContain(
            'fastest run'
        );
    });

    it('prefers the feeds own thumbnail url', () => {
        expect(parsed.items.find((item) => item.videoId === 'aaaaaaaaaaa').thumbnailUrl).toBe(
            'https://i2.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg'
        );
    });

    /** hqdefault is the one rendition YouTube guarantees for every video. */
    it('falls back to the hqdefault poster when the feed omits one', () => {
        expect(parsed.items.find((item) => item.videoId === 'bbbbbbbbbbb').thumbnailUrl).toBe(
            posterFallbackFor('bbbbbbbbbbb')
        );
    });

    it('tolerates an empty description', () => {
        expect(parsed.items.find((item) => item.videoId === 'ccccccccccc').description).toBe('');
    });

    it('reads the channel identity the error state falls back to', () => {
        expect(parsed.channel).toEqual({
            title: 'Jeff Goji',
            url: 'https://www.youtube.com/channel/UCtestchannelid',
        });
    });

    /** The document-level <published> sits above the first entry and is not one. */
    it('does not admit the feeds own published date as a video', () => {
        expect(parsed.items.some((item) => item.publishedAt.startsWith('2020-01-01'))).toBe(false);
    });
});

describe('the manifest the hub reads', () => {
    const manifest = manifestFrom(FIXTURE, PLAYLIST_ID);

    it('counts what it carries', () => {
        expect(manifest.count).toBe(manifest.items.length);
        expect(manifest.count).toBe(3);
    });

    it('records the playlist it was built from', () => {
        expect(manifest.playlistId).toBe(PLAYLIST_ID);
        expect(manifest.playlistTitle).toBe('jeffgoji.com');
    });

    /**
     * Carried per item as well as at the top level so a second playlist is a
     * data change rather than a schema change — the hub groups its series filter
     * on the item field, which is exactly why that row stays hidden today.
     */
    it('stamps every item with its series so a second one needs no migration', () => {
        for (const item of manifest.items) {
            expect(item.playlistId).toBe(PLAYLIST_ID);
            expect(item.seriesTitle).toBe('jeffgoji.com');
        }
    });

    it('carries exactly the fields the cards read', () => {
        expect(Object.keys(manifest.items[0]).sort()).toEqual([
            'description',
            'playlistId',
            'publishedAt',
            'seriesTitle',
            'thumbnailUrl',
            'title',
            'videoId',
        ]);
    });

    /**
     * The CPO dropped these rather than hand-maintaining them, and the feed
     * carries neither a duration nor a trustworthy view count. A field appearing
     * here would put an invented number on a card.
     */
    it('carries no duration and no view count', () => {
        const serialised = JSON.stringify(manifest);

        expect(serialised).not.toContain('duration');
        expect(serialised).not.toContain('viewCount');
        expect(serialised).not.toContain('views');
    });

    /** The hub fetches this literal path; the two constants must not drift. */
    it('is written where the hub looks for it', () => {
        const hubSource = readFileSync(
            resolve(process.cwd(), 'src/components/YouTube/videoManifest.js'),
            'utf8'
        );

        expect(MANIFEST_PUBLIC_PATH).toBe('/videos/manifest.json');
        expect(hubSource).toContain(`'${MANIFEST_PUBLIC_PATH}'`);
    });
});

describe('the playlist id comes from the environment and nowhere else', () => {
    it('reads the documented variable', () => {
        expect(PLAYLIST_ENV_VAR).toBe('VIDEOS_PLAYLIST_ID');
        expect(resolvePlaylistId({ [PLAYLIST_ENV_VAR]: PLAYLIST_ID })).toBe(PLAYLIST_ID);
    });

    it('trims surrounding whitespace a shell may have left', () => {
        expect(resolvePlaylistId({ [PLAYLIST_ENV_VAR]: `  ${PLAYLIST_ID}  ` })).toBe(PLAYLIST_ID);
    });

    it('fails with a message naming the variable when it is unset', () => {
        expect(() => resolvePlaylistId({})).toThrow(PLAYLIST_ENV_VAR);
    });

    it('treats a blank value as unset', () => {
        expect(() => resolvePlaylistId({ [PLAYLIST_ENV_VAR]: '   ' })).toThrow(PLAYLIST_ENV_VAR);
    });

    it('rejects a placeholder that is not a plausible id', () => {
        expect(() => resolvePlaylistId({ [PLAYLIST_ENV_VAR]: 'TODO' })).toThrow(/playlist id/);
        expect(() => resolvePlaylistId({ [PLAYLIST_ENV_VAR]: '<your-id>' })).toThrow(/playlist id/);
    });

    /**
     * The channel has private playlists mixed in with the public one. A
     * committed default is one typo away from publishing a personal music mix to
     * the front page, so the source must contain no id-shaped literal at all.
     */
    it('hardcodes no playlist id anywhere in the source', () => {
        const source = readFileSync(resolve(process.cwd(), 'scripts/build-videos.mjs'), 'utf8');

        expect(source).not.toMatch(/["'`](PL|UU|FL|LL|OL|RD)[A-Za-z0-9_-]{8,}["'`]/);
    });
});

describe('the build', () => {
    const respondWith = (body, ok = true, status = 200) =>
        vi.fn(async () => ({ ok, status, text: async () => body }));

    it('fetches the configured playlist and returns the parsed manifest', async () => {
        const fetchImpl = respondWith(FIXTURE);

        const manifest = await buildVideos({
            playlistId: PLAYLIST_ID,
            fetchImpl,
            outDir: 'node_modules/.tmp-videos-test',
        });

        expect(fetchImpl).toHaveBeenCalledWith(feedUrlFor(PLAYLIST_ID));
        expect(manifest.count).toBe(3);
    });

    /**
     * A 404 here is almost always a Private or Unlisted playlist rather than a
     * network fault, and the message has to say so or the next person debugs the
     * wrong thing.
     */
    it('fails loudly on a non-ok response and blames the right thing', async () => {
        await expect(
            buildVideos({
                playlistId: PLAYLIST_ID,
                fetchImpl: respondWith('', false, 404),
                outDir: 'node_modules/.tmp-videos-test',
            })
        ).rejects.toThrow(/Private or Unlisted/);
    });

    /**
     * Same trade build-gallery makes on an empty source directory: a private
     * playlist, a deleted one and a typo are indistinguishable here, and a
     * zero-item manifest turns any of them into a silently blank hub.
     */
    it('fails rather than writing an empty manifest', async () => {
        const empty = FIXTURE.replace(/<entry>[\s\S]*<\/entry>/, '');

        await expect(
            buildVideos({
                playlistId: PLAYLIST_ID,
                fetchImpl: respondWith(empty),
                outDir: 'node_modules/.tmp-videos-test',
            })
        ).rejects.toThrow(/zero videos/);
    });
});

describe('--optional softens a missing configuration and nothing else', () => {
    it('skips with a warning when the variable is unset', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(main(['--optional'], {})).resolves.toBeNull();
        expect(warn).toHaveBeenCalled();

        warn.mockRestore();
    });

    it('still fails on a configured but implausible id', async () => {
        await expect(main(['--optional'], { [PLAYLIST_ENV_VAR]: 'TODO' })).rejects.toThrow(
            /playlist id/
        );
    });

    it('fails on a missing variable without the flag', async () => {
        await expect(main([], {})).rejects.toThrow(PLAYLIST_ENV_VAR);
    });
});
