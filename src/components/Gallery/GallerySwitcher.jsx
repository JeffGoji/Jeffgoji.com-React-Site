import { useState } from 'react';
import { Button, Container, Row, Col } from 'react-bootstrap';
// NB Miata
import NBHillCountry23 from './NB/HillCountry';
// NC Miata
import EastCoast15 from './NC/EastCoast15';
import Yellowstone15 from './NC/Yellowstone15';
// Nd Miata
import NDHillCountry from './ND/HillCountry';

const GallerySwitcher = () => {
    const [gallery, setGallery] = useState('');

    const handleSwitchGallery = (selectedGallery) => {
        setGallery(selectedGallery);
        // console.log("Selected Gallery: ", selectedGallery);
    };

    return (
        <Container fluid>
            <Row className="mb-3">
                <Col>
                    <h5 className='text-white'>Select your Gallery</h5>
                </Col>
            </Row>
            <Row className="mb-3 text-light">
                <Col>
                    <h4>NA Galleries</h4>
                    <p>coming soon</p>
                    {/* <Button onClick={() => handleSwitchGallery('EastCoast15Gallery')} variant="danger" className='mb-2'>Autocross</Button>
                    <br />
                    <Button onClick={() => handleSwitchGallery('EastCoast15Gallery')} variant="danger" className=''>Scenery Shots</Button> */}
                </Col>
                <Col>
                    <h4>Mazdaspeed Galleries</h4>
                    <Button onClick={() => handleSwitchGallery('NBHillCountry23')} variant="danger" className='mb-2'>Texas Hill Country Trip 2023</Button>
                    <br />
                </Col>
                <Col>
                    <h4>NC Galleries</h4>
                    <Button onClick={() => handleSwitchGallery('EastCoast15Gallery')} variant="danger" className='mb-2'>East Coast Trip 2015</Button>
                    <Button onClick={() => handleSwitchGallery('Yellowstone15Gallery')} variant="danger" className=''>Yellowstone West Coast Trip 2015</Button>
                </Col>
                <Col>
                    <h4>ND Galleries</h4>
                    <Button onClick={() => handleSwitchGallery('NDHillCountry')} variant="danger" className='mb-2'>Texas Hill Country</Button>
                    <br />
                    {/* <Button onClick={() => handleSwitchGallery('EastCoast15Gallery')} variant="danger" className=''>Scenery Shots</Button> */}
                </Col>
                <Col>
                    <h4>C8 Corvette Galleries</h4>
                    <p>coming soon</p>
                    {/* <Button onClick={() => handleSwitchGallery('EastCoast15Gallery')} variant="danger" className='mb-2'>Autocross</Button> */}
                </Col>
            </Row>
            <Row>
                <Col>
                    {gallery === 'EastCoast15Gallery' && <EastCoast15Gallery />}
                    {gallery === 'Yellowstone15Gallery' && <Yellowstone15Gallery />}
                    {gallery === 'NDHillCountry' && <NDHillCountry />}
                    {gallery === 'NBHillCountry23' && <NBHillCountry23 />}
                </Col>
            </Row>
        </Container>
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
