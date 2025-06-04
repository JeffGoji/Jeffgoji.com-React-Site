
import AdSenseSlot from "../AdSense/AdSenseSlot";

function Intro() {

    return (
        <div className="container-fluid splash-background text-white">
            <div className="row mt-5 justify-content-center">
            <AdSenseSlot client='ca-pub-8417979887134577' slot='1042016675' />
                <div className="col-lg-8 col-md-12 text-center">
                    <div className='row mt-5 justify-content-center'>
                        <div className='col-lg-12'>
                             <h1 className="text-center text-outline fw-bold mt-5">Jeff Goji&apos;s Car Blogs</h1>
                            <h3 className='fw-bold mt-3'>
                                Hey there! I’m Jeff, a lifelong car enthusiast with a soft spot for Miatas and Autocross. Here you will find my thoughts on modifications, event recaps, and the joys (and headaches) of driving. Dive into The Garage or catch up on my latest autocross videos below!
                            </h3>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Intro;