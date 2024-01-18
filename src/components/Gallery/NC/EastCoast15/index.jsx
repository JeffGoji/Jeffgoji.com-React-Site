import ReactImageGallery from "react-image-gallery";

//Images
import images from "./images";



import "react-image-gallery/styles/css/image-gallery.css";

function EastCoast15() {


    return (
        <div className="Gallery">
            <ReactImageGallery items={images} className='img-fluid' />
        </div>
    );
}

export default EastCoast15;