
import Intro from './Intro';
import Garage from '../Garage';
import YouTube from '../YouTube';

function Home() {
    return (
        <div className='container-fluid m-0 p-0'>
            <div className='row pb-5 justify-content-center m-0 p-0'>
                <div className='col-lg-12 col-md-12 col-sm-12 m-0 p-0'>
                    <Intro />
                    <Garage />
                    <YouTube />

                </div>
            </div>
        </div>
    );
}

export default Home;
