import GallerySwitcher from "./NC"


function Gallery() {
    return (
        <div className="container-fluid">
            <div className="row justify-content-center mt-1 bg-dark rounded">
                <div className="col-12 col-md-12 col-lg-8">
                    <GallerySwitcher />
                </div>
            </div>
        </div>
    )
}

export default Gallery