// Auto-import all images from src/assets/images/nd/TOTD2025 (recursively)

function sortKeys(a, b) {
  // numeric-aware sort for filenames
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

const modules = import.meta.globEager('../../../../assets/images/nd/TOTD2025/**/*.{jpg,jpeg,png,webp}');
const keys = Object.keys(modules).sort(sortKeys);

const folderCounts = {};
const images = keys.map((key,) => {
  const mod = modules[key];
  const src = (mod && (mod.default || mod)) || key;
  const filename = key.substring(key.lastIndexOf('/') + 1);
  const segments = key.split('/');
  // parent folder name (e.g. "action" or subfolders under TOTD2025)
  const parent = segments[segments.length - 2] || 'TOTD2025';

  // Match filenames like 20250919_112841.jpg (optionally with suffix like (0) before extension)
  const dateMatch = filename.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?:\(\d+\))?\.[^.]+$/i);

  let alt, description;
  if (dateMatch) {
    const [, year, month, day, hour, minute] = dateMatch;
    // human-friendly date/time: MM/DD/YYYY HH:MM
    const dateStr = `${month}/${day}/${year} ${hour}:${minute}`;
    alt = `Tail of the Dragon 2025 — ${dateStr}`;
    description = `${parent} photo taken ${dateStr}`;
  } else {
    // For non-date filenames (e.g. numeric/action images) give a folder-based incremental label
    folderCounts[parent] = (folderCounts[parent] || 0) + 1;
    const num = folderCounts[parent];
    alt = `${parent} photo #${num} — Tail of the Dragon 2025`;
    description = `${parent} photo #${num} from Tail of the Dragon 2025`;
  }

  return {
    original: src,
    thumbnail: src,
    alt: alt,
    loading: 'lazy',
    originalAlt: 'Tail of the Dragon 2025',
    description: description,
    // gallery property added so callers can filter/group by subfolder (e.g. "action")
    gallery: parent
  };
});

// Build a map of galleries (subfolders) -> images array for easy consumption
const galleries = images.reduce((map, img) => {
  const g = img.gallery || 'TOTD2025';
  if (!map[g]) map[g] = [];
  map[g].push(img);
  return map;
}, {});

export { galleries };
export default images;