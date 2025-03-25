import { Container, Row, Col } from 'react-bootstrap';

function YouTube() {
    return (
        <Container fluid className="mt-4 pt-4 pb-4 bg-black text-white">
            <Row className="justify-content-center">
                <Row className="justify-content-center">
                    <Col lg={4} md={4} sm={4}>
                        <hr />
                        <hr />
                    </Col>
                    <Col lg={3} md={4} sm={4}>
                        <h2 className="text-center mb-3 text-outline fw-bold">Latest Autocross Videos</h2>
                    </Col>
                    <Col lg={4} md={4} sm={4}>
                        <hr />
                        <hr />
                    </Col>
                </Row>
                <Row className="justify-content-center p-0 m-0">
                    <Col lg={4} md={4} sm={12}>
                        <div className="ratio ratio-16x9">
                            <iframe src="https://www.youtube.com/embed/Q2B8mA3vgP0?si=tQI2IKl5x7PlfD8y" title="Houston BMW/PCA Autocross" allowFullScreen={true}></iframe>
                        </div>
                    </Col>
                    <Col lg={4} md={4} sm={12}>
                        <div className="ratio ratio-16x9">
                            <iframe src="https://www.youtube.com/embed/XVjs7LRCBak?si=wdB0peUKmfe9cFxx" title="Jeff's fastest run, Houston BMW/PCA Autocross" allowFullScreen={true}></iframe>
                        </div>
                    </Col>
                    <Col lg={4} md={4} sm={12}>
                        <div className="ratio ratio-16x9">
                            <iframe src="https://youtu.be/UySrXUfHA_k" title="Jeff's fastest run, LSR PCA Autocross, March 23rd, 2025" allowFullScreen={true}></iframe>
                        </div>
                    </Col>
                </Row>
            </Row>
        </Container>
    );
}

export default YouTube;
