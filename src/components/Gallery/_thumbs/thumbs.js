// Vite-safe thumbnail generator (no external deps)
// - Fetch original image
// - Resize in browser using Canvas
// - Convert to WEBP dataURL
// - Cache in localStorage
// - Hydrate react-image-gallery items

function sanitizeKey(s) {
    return String(s || "").replace(/[^\w.-]/g, "_");
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function decodeImage(blob) {
    // createImageBitmap is fastest (and avoids DOM <img> issues)
    if ("createImageBitmap" in window) {
        return await createImageBitmap(blob);
    }

    // fallback to HTMLImageElement
    const url = URL.createObjectURL(blob);
    try {
        const img = new Image();
        img.decoding = "async";
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
        });
        return img;
    } finally {
        URL.revokeObjectURL(url);
    }
}

function computeTargetSize(srcW, srcH, maxW, maxH) {
    const scale = Math.min(maxW / srcW, maxH / srcH, 1);
    return {
        w: Math.max(1, Math.round(srcW * scale)),
        h: Math.max(1, Math.round(srcH * scale)),
    };
}

async function toWebpDataUrl(imageLike, width, height, quality) {
    // OffscreenCanvas if available, else regular canvas
    let canvas;
    let ctx;

    if (typeof OffscreenCanvas !== "undefined") {
        canvas = new OffscreenCanvas(width, height);
        ctx = canvas.getContext("2d", { alpha: false });
    } else {
        canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        ctx = canvas.getContext("2d", { alpha: false });
    }

    // High quality downscale
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(imageLike, 0, 0, width, height);

    // OffscreenCanvas returns a Blob; HTMLCanvasElement returns dataURL
    if (canvas.convertToBlob) {
        const blob = await canvas.convertToBlob({
            type: "image/webp",
            quality: quality / 100,
        });

        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }

    // Fallback: toDataURL
    return canvas.toDataURL("image/webp", quality / 100);
}

async function buildThumbDataUrlFromUrl(originalUrl, opts) {
    const resp = await fetch(originalUrl, { cache: "force-cache" });
    const blob = await resp.blob();
    const img = await decodeImage(blob);

    const srcW = img.width || img.naturalWidth;
    const srcH = img.height || img.naturalHeight;

    const { w, h } = computeTargetSize(srcW, srcH, opts.width, opts.height);
    const dataUrl = await toWebpDataUrl(img, w, h, opts.quality);

    // Cleanup createImageBitmap resources when possible
    if (img && typeof img.close === "function") {
        img.close();
    }

    return dataUrl;
}

/**
 * Hydrates react-image-gallery items with cached/generated base64 thumbnails.
 *
 * items must include:
 *  - original: url
 *  - thumbnail: url (can initially be original)
 *
 * options:
 *  - namespace (required-ish): unique prefix per gallery/chunk
 *  - batchSize
 *  - width, height
 *  - quality (0-100)
 */
async function hydrateThumbnails(items, options) {
    const opts = {
        namespace: options?.namespace || "gallery",
        batchSize: options?.batchSize ?? 6,
        width: options?.width ?? 320,
        height: options?.height ?? 220,
        quality: options?.quality ?? 65,
    };

    const out = [...items];

    for (let i = 0; i < out.length; i += opts.batchSize) {
        const batch = out.slice(i, i + opts.batchSize);

        await Promise.all(
            batch.map(async (img, idx) => {
                const originalUrl = img?.original;
                if (!originalUrl) return;

                const stableId = sanitizeKey(img._thumbId || originalUrl);
                const cacheKey = `${opts.namespace}:thumb:${stableId}`;

                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    out[i + idx] = { ...img, thumbnail: cached };
                    return;
                }

                try {
                    const thumb64 = await buildThumbDataUrlFromUrl(originalUrl, opts);

                    // localStorage can throw if full; catch and continue gracefully
                    try {
                        localStorage.setItem(cacheKey, thumb64);
                    } catch {
                        // ignore cache write failures
                    }

                    out[i + idx] = { ...img, thumbnail: thumb64 };
                } catch {
                    // fallback to original thumbnail if anything fails
                    out[i + idx] = img;
                }
            })
        );

        // yield to browser so UI stays responsive
        await sleep(0);
    }

    return out;
}

function clearThumbnailCache(namespace) {
    const prefix = `${namespace}:thumb:`;
    const toRemove = [];

    for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) toRemove.push(k);
    }

    toRemove.forEach((k) => localStorage.removeItem(k));
}

export { hydrateThumbnails, clearThumbnailCache };
