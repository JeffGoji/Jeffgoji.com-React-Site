import { useEffect, useState } from "react";
import ReactImageGallery from "react-image-gallery";
import images, { hydrateThumbnails } from "./images";
import "react-image-gallery/styles/css/image-gallery.css";

function TailOfTheDragonGallery() {
  const [items, setItems] = useState(images);

  useEffect(() => {
    let alive = true;

    (async () => {
      const hydrated = await hydrateThumbnails(images, { batchSize: 6 });
      if (alive) setItems(hydrated);
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="Gallery mt-2">
      <ReactImageGallery items={items} className="img-fluid" />
    </div>
  );
}

export default TailOfTheDragonGallery;
