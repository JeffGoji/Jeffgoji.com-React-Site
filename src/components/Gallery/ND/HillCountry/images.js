// Auto-import all images from src/assets/images/nd/HillCountry (recursively)

function sortKeys(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

const modules = import.meta.globEager(
    "../../../../assets/images/nd/HillCountry/**/*.{jpg,jpeg,png,webp}"
);

const keys = Object.keys(modules).sort(sortKeys);

const images = keys.map((key, index) => {
    const mod = modules[key];
    const src = (mod && (mod.default || mod)) || key;

    const filename = key.substring(key.lastIndexOf("/") + 1);

    // Match filenames like 20230610_084825.jpg (optionally with suffix like (0))
    const dateMatch = filename.match(
        /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?:\(\d+\))?\.[^.]+$/i
    );

    let alt;
    let description;

    if (dateMatch) {
        const [, year, month, day, hour, minute] = dateMatch;
        const dateStr = `${month}/${day}/${year} ${hour}:${minute}`;
        alt = `ND TexasHill Country trip — ${dateStr}`;
        description = `ND Texas Hill Country trip photo taken ${dateStr}`;
    } else {
        const num = index + 1;
        alt = `ND Texas Hill Country photo #${num}`;
        description = `ND Texas Hill Country trip photo #${num}`;
    }

    return {
        original: src,
        thumbnail: src, // replaced at runtime by hydrateThumbnails
        alt,
        loading: "lazy",
        originalAlt: "ND Texas Hill Country trip",
        description,

        // Stable cache key for thumbnails
        _thumbId: `ND/HillCountry/${filename}`,
    };
});

export default images;
