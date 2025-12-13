// images.js
// Auto-import all images from src/assets/images/nd/TOTD2025 (recursively)
// Generates lightweight thumbnails client-side (no Sharp / no imagetools build crashes)

import Resizer from "react-image-file-resizer";

function sortKeys(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

const modules = import.meta.globEager(
  "../../../../assets/images/nd/TOTD2025/**/*.{jpg,jpeg,png,webp}"
);

const keys = Object.keys(modules).sort(sortKeys);

const folderCounts = {};
const images = keys.map((key) => {
  const mod = modules[key];
  const src = (mod && (mod.default || mod)) || key;

  const filename = key.substring(key.lastIndexOf("/") + 1);
  const segments = key.split("/");
  const parent = segments[segments.length - 2] || "TOTD2025";

  const dateMatch = filename.match(
    /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?:\(\d+\))?\.[^.]+$/i
  );

  let alt, description;
  if (dateMatch) {
    const [, year, month, day, hour, minute] = dateMatch;
    const dateStr = `${month}/${day}/${year} ${hour}:${minute}`;
    alt = `Tail of the Dragon 2025 — ${dateStr}`;
    description = `${parent} photo taken ${dateStr}`;
  } else {
    folderCounts[parent] = (folderCounts[parent] || 0) + 1;
    const num = folderCounts[parent];
    alt = `${parent} photo #${num} — Tail of the Dragon 2025`;
    description = `${parent} photo #${num} from Tail of the Dragon 2025`;
  }

  return {
    original: src,
    // TEMP: set thumb to original at first; we’ll replace at runtime
    thumbnail: src,
    alt,
    loading: "lazy",
    originalAlt: "Tail of the Dragon 2025",
    description,
    gallery: parent,
    // cache key so thumbs persist
    _thumbKey: `totd-thumb:${filename}`,
  };
});

// Build a map of galleries (subfolders) -> images array
const galleries = images.reduce((map, img) => {
  const g = img.gallery || "TOTD2025";
  if (!map[g]) map[g] = [];
  map[g].push(img);
  return map;
}, {});

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function resizeFile(file) {
  return new Promise((resolve) => {
    Resizer.imageFileResizer(
      file,
      320, // width
      220, // height (acts as max)
      "WEBP", // output format
      65, // quality
      0, // rotation
      (uri) => resolve(uri),
      "base64"
    );
  });
}

/**
 * Generates thumbnails for an items array (react-image-gallery format).
 * - Uses localStorage cache
 * - Generates thumbs in small batches so UI doesn’t freeze
 */
async function hydrateThumbnails(items, opts = {}) {
  const batchSize = opts.batchSize ?? 6;

  const out = [...items];

  for (let i = 0; i < out.length; i += batchSize) {
    const batch = out.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (img, idx) => {
        const key = img._thumbKey;
        if (!key) return;

        const cached = localStorage.getItem(key);
        if (cached) {
          out[i + idx] = { ...img, thumbnail: cached };
          return;
        }

        try {
          const resp = await fetch(img.original);
          const blob = await resp.blob();

          // Convert to File for the resizer
          const file = new File([blob], "thumb", { type: blob.type });

          const thumb64 = await resizeFile(file);

          localStorage.setItem(key, thumb64);
          out[i + idx] = { ...img, thumbnail: thumb64 };
        } catch {
          // If anything fails, keep thumbnail as original
          out[i + idx] = img;
        }
      })
    );

    // give the browser a breath
    await new Promise((r) => setTimeout(r, 0));
  }

  return out;
}

export { galleries, hydrateThumbnails };
export default images;
