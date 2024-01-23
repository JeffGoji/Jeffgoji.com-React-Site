
function YouTube() {
    return (
        <div className="container-fluid mt-4 pt-4 pb-4 bg-black text-white">
            <div className="row justify-content-center">
                <div className="row justify-content-center">
                    <div className="col-lg-4 col-md-4 col-sm-4">
                        <hr />
                        <hr />
                    </div>
                    <div className="col-lg-3 col-md-4 col-sm-4">
                        <h2 className="text-center mb-3 text-outline fw-bold">Latest Autocross Videos</h2>
                    </div>
                    <div className="col-lg-4 col-md-4 col-sm-4">
                        <hr />
                        <hr />
                    </div>
                </div>
                <div className='row justify-content-center p-0 m-0'>
                    <div className="col-lg-4 col-md-4 col-sm-12">
                        <div className="ratio ratio-16x9">
                            <iframe src="https://www.youtube.com/embed/Q2B8mA3vgP0?si=tQI2IKl5x7PlfD8y" title="Houston BMW/PCA Autocross" allowFullScreen={true}></iframe>
                        </div>
                    </div>
                    <div className="col-lg-4 col-md-4 col-sm-12">
                        <div className="ratio ratio-16x9">
                            <iframe src="https://www.youtube.com/embed/XVjs7LRCBak?si=wdB0peUKmfe9cFxx" title="Jeff's fastest run, Houston BMW/PCA Autocross" allowFullScreen={true}></iframe>
                        </div>
                    </div>
                    <div className="col-lg-4 col-md-4 col-sm-12">
                        <div className="ratio ratio-16x9">
                            <iframe src="https://www.youtube.com/embed/cXCUuEsblU8?si=IYxoTk27xIwcyUga" title="Jeff's fastest run, Houston BMW/PCA Autocross" allowFullScreen={true}></iframe>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default YouTube;