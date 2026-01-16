import naData from '../../assets/Data/naBlog.json';
import nbData from '../../assets/Data/MsmBlog.json';
import ndData from '../../assets/Data/ndBlog.json'

import { Card, Container, Row, Col } from 'react-bootstrap';

function Intro() {

    const latestNaBlog = [...naData].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
    )[0];

    const latestNbBlog = [...nbData].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
    )[0];

    const latestNdBlog = [...ndData].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
    )[0];

    return (
        <Container fluid className="splash-background text-white">
            <Row className='justify-content-center mt-5'>
                <Col lg={3}>            
                            {latestNaBlog && (
                                <Card className="text-dark h-75">
                                    {latestNaBlog.picture && (
                                        <Card.Img
                                            variant="top"
                                            src={latestNaBlog.picture}
                                            alt={latestNaBlog.title ?? 'Blog image'}
                                        />
                                    )}
                                    <Card.Body>
                                        <Card.Text>{latestNaBlog.intro}</Card.Text>
                            </Card.Body>
                            <Card.Footer>
                            </Card.Footer>
                                </Card>
                    )}
                    </Col>
                    <Col lg={3}>
                            {latestNbBlog && (
                                <Card className="text-dark mx-auto h-75">
                                    {latestNbBlog.picture && (
                                        <Card.Img
                                            variant="top"
                                            src={latestNbBlog.picture}
                                            alt={latestNbBlog.title ?? 'Blog image'}
                                        />
                                    )}
                                    <Card.Body>
                                        <Card.Text>{latestNbBlog.intro}</Card.Text>
                            </Card.Body>
                            <Card.Footer>
                                </Card.Footer>
                                </Card>
                            )}
                </Col>
                <Col lg={3}>
                    <Card className="text-dark mx-auto h-75">
                        {latestNdBlog && (
                            <>
                                {latestNdBlog.picture && (
                                    <Card.Img
                                        variant="top"
                                        src={latestNdBlog.picture}
                                        alt={latestNdBlog.title ?? 'Blog image'}
                                    />
                                )}
                                <Card.Body>
                                    <Card.Text>{latestNdBlog.intro}</Card.Text>
                                </Card.Body>
                                <Card.Footer>
                                </Card.Footer>
                            </>
                        )}
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}

export default Intro;