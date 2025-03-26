import { useState } from 'react';
import { Button, Container, Row, Col } from 'react-bootstrap';
// NB Miata
import NBHillCountry23 from './HillCountry';


const MSMGallerySwitcher = () => {
    const [gallery, setGallery] = useState('');

    const handleSwitchGallery = (selectedGallery) => {
        setGallery(selectedGallery);
        // console.log("Selected Gallery: ", selectedGallery);
    };

    return (
        <Container fluid className='justify-content-center bg-dark h-100'>
            <Row className="mb-3 text-light text-center">
                <Col>
                    <h4>Mazdaspeed Galleries</h4>
                    <Button onClick={() => handleSwitchGallery('NBHillCountry23')} variant="danger" className='mb-2'>Texas Hill Country Trip 2023</Button>
                    <br />
                </Col>

            </Row>
            <Row className='justify-content-center bg-dark'>
                <Col lg='10'>
                    {gallery === 'NBHillCountry23' && <NBHillCountry23 />}
                </Col>
            </Row>
        </Container>
    );
};


export default MSMGallerySwitcher;
