import { useEffect, useMemo, useState } from "react";
import ReactImageGallery from "react-image-gallery";
import { buildChunkMap } from "../../../Gallery/_thumbs/chunk";
import "react-image-gallery/styles/css/image-gallery.css";

function TailOfTheDragonGallery() {
  const chunkSize = 120;

  const [allImages, setAllImages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load manifest on mount
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const resp = await fetch("/gallery/nd-totd2025/manifest.json");
        const json = await resp.json();

        if (alive) {
          setAllImages(json.items || []);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load gallery manifest:", err);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // Build chunk map AFTER images load
  const chunkMap = useMemo(() => {
    return buildChunkMap(allImages, chunkSize, "Tail of the Dragon - Gallery");
  }, [allImages]);

  const chunkLabels = useMemo(() => Object.keys(chunkMap), [chunkMap]);

  const [selectedLabel, setSelectedLabel] = useState("");

  // Select first chunk once available
  useEffect(() => {
    if (!selectedLabel && chunkLabels.length) {
      setSelectedLabel(chunkLabels[0]);
    }
  }, [chunkLabels, selectedLabel]);

  const items = chunkMap[selectedLabel] || [];

  if (loading) {
    return <div className="text-white mt-2">Loading gallery…</div>;
  }

  return (
    <div className="Gallery mt-2">
      <div className="d-flex align-items-center gap-2 mb-2">
        <label className="text-white">Choose set:</label>
        <select
          className="form-select form-select-sm"
          style={{ maxWidth: 420 }}
          value={selectedLabel}
          onChange={(e) => setSelectedLabel(e.target.value)}
        >
          {chunkLabels.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <ReactImageGallery items={items} />
    </div>
  );
}

export default TailOfTheDragonGallery;