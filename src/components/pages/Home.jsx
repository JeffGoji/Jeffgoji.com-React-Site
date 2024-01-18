
import Intro from './Intro';
import Garage from '../Garage';
import YouTube from '../YouTube';

function Home() {
    return (
        <div className='row pb-5'>
            {/* <div className='col-lg-12 col-md-12 col-sm-12'> */}
            <Intro />
            <Garage />
            <YouTube />

            {/* </div> */}
        </div>
    );
}

export default Home;
