import { useEffect, useMemo, useState } from "react";
import ReactImageGallery from "react-image-gallery";
import images from "./images";
import { hydrateThumbnails } from "../../_thumbs/thumbs";
import { buildChunkMap } from "../../_thumbs/chunk";
import "react-image-gallery/styles/css/image-gallery.css";

function HillCountryGallery() {
  const chunkSize = 25;

  const chunkMap = useMemo(() => {
    return buildChunkMap(images, chunkSize, "ND Hill Country - Gallery");
  }, [chunkSize]);

  const chunkLabels = useMemo(() => Object.keys(chunkMap), [chunkMap]);

  const [selectedLabel, setSelectedLabel] = useState(chunkLabels[0]);
  const [items, setItems] = useState(chunkMap[chunkLabels[0]] || []);

  useEffect(() => {
    let alive = true;

    (async () => {
      const current = chunkMap[selectedLabel] || [];

      setItems(current);

      const hydrated = await hydrateThumbnails(current, {
        namespace: `nd-hillcountry-${selectedLabel}`,
        batchSize: 10,
        width: 320,
        height: 213,
        quality: 65,
      });

      if (alive) setItems(hydrated);
    })();

    return () => {
      alive = false;
    };
  }, [selectedLabel, chunkMap]);

  if (!chunkLabels.length) {
    return (
      <div className="Gallery mt-2 text-white">
        No images found for this gallery.
      </div>
    );
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
            <option value={label} key={label}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <ReactImageGallery items={items} className="img-fluid" />
    </div>
  );
}

export default HillCountryGallery;
