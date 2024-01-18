import { useState } from 'react';
import EastCoast15 from './EastCoast15';
import Yellowstone15 from './Yellowstone15';

const GallerySwitcher = () => {
    const [gallery, setGallery] = useState('');

    const handleSwitchGallery = (selectedGallery) => {
        setGallery(selectedGallery);
        console.log("Selected Gallery: ", selectedGallery);
    };

    return (
        <div>
            <h5 className='text-white'>Select your Gallery</h5>
            <button onClick={() => handleSwitchGallery('EastCoast15Gallery')} className='btn btn-md btn-danger me-2'>East Coast Trip 2015</button>
            <button onClick={() => handleSwitchGallery('Yellowstone15Gallery')} className='btn btn-md btn-danger me-2'>Yellowstone West Coast Trip 2015</button>
            {gallery === 'EastCoast15Gallery' && <EastCoast15Gallery />}
            {gallery === 'Yellowstone15Gallery' && <Yellowstone15Gallery />}
        </div>
    );
};

const EastCoast15Gallery = () => {
    return (
        <div>
            <h3>East Coast 2015 Gallery</h3>
            <EastCoast15 />
        </div>
    );
};

const Yellowstone15Gallery = () => {
    return (
        <div>
            <h3>Yellowstone 2015 Gallery</h3>
            <Yellowstone15 />
        </div>
    );
};

export default GallerySwitcher;
