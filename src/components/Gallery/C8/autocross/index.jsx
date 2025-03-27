import ReactImageGallery from "react-image-gallery";

//Images
import images from "./images";

import "react-image-gallery/styles/css/image-gallery.css";

function C8AutoxGallery() {

    return (
        <div className="Gallery mt-2">
            <ReactImageGallery items={images} className='img-fluid' />
        </div>
    );
}

export default C8AutoxGallery;