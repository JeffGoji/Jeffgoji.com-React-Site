/**
 * The runtime seam between the home hero's CTA and the build-time "which
 * gallery moved most recently" summary, mirroring YouTube/videoManifest.js:
 * fetched rather than imported because it is written into public/ by
 * scripts/build-gallery.mjs and can change on a rebuild without shipping new
 * JavaScript.
 */
export const LATEST_GALLERY_PUBLIC_PATH = '/gallery/latest.json';

/**
 * What the hero's CTA shows before the fetch resolves and if it never does.
 * Matches the gallery build script's own label for this slug, so the
 * fallback reads exactly like the real thing would once the fetch lands.
 */
export const LATEST_GALLERY_FALLBACK = {
    slug: 'nd-totd2025',
    label: 'Tail of the Dragon 2025',
};

/**
 * Reads `public/gallery/latest.json`, falling back on anything short of a
 * well-formed `{slug, label}` payload — missing file, non-OK response, a
 * response body that fails to parse as JSON, or JSON missing either field.
 *
 * The SPA fallback in public/_redirects answers an unknown path with
 * index.html and a 200, so a missing file arrives as HTML that only fails at
 * parse time — the same reason loadVideoManifest guards the parse rather than
 * trusting `response.ok` alone.
 *
 * @returns {Promise<{ok: boolean, slug: string, label: string}>}
 */
export async function loadLatestGallery() {
    try {
        const response = await fetch(LATEST_GALLERY_PUBLIC_PATH);

        if (!response.ok) {
            return { ok: false, ...LATEST_GALLERY_FALLBACK };
        }

        const data = await response.json();

        if (!data?.slug || !data?.label) {
            return { ok: false, ...LATEST_GALLERY_FALLBACK };
        }

        return { ok: true, slug: data.slug, label: data.label };
    } catch {
        return { ok: false, ...LATEST_GALLERY_FALLBACK };
    }
}
