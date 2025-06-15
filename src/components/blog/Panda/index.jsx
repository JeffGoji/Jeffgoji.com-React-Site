import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Image, ListGroup, Button } from 'react-bootstrap';
import data from '../../../assets/Data/c8Blog.json';

// import AdSenseSlot from '../../AdSense/AdSenseSlot';

const POST_PER_PAGE = 3;

function C8Blog() {

    const [page, setPage] = useState(1);
    const sortedData = [...data].sort((a, b) => b.id - a.id);
    const totalPages = Math.ceil(sortedData.length / POST_PER_PAGE);

    const paginatedData = sortedData.slice(
        (page - 1) * POST_PER_PAGE,
        page * POST_PER_PAGE
    );

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'auto' });
    }, [page]);

    const c8BlogList = paginatedData.map((data) => (
        <Row className='justify-content-center mb-4' key={data.id}>
            <Col lg={6} md={10} sm={12} className="mt-3">
                <Card className='bg-dark rounded p-2 text-white'>
                    <div className='text-center'>
                        <Image src={data.picture} className="img-fluid rounded" alt="this post's pic" />
                    </div>
                    <ListGroup className='mt-3 rounded'>
                        <ListGroup.Item className='p-1 bg-dark text-white'>Date: {data.date}</ListGroup.Item>
                        <ListGroup.Item className='p-1 bg-dark text-white'>Mileage: {data.mileage} miles</ListGroup.Item>
                        <ListGroup.Item className='p-1 bg-dark text-white'>Cost for this entry: {data.cost}</ListGroup.Item>
                    </ListGroup>
                    <hr />
                    <Card.Text style={{ whiteSpace: "pre-line" }}>{data.entry}</Card.Text>
                    <p className='text-center'><a href="#top">Back to top</a></p>
                    <hr className="bloghr" />
                </Card>
            </Col>
        </Row>
    ));

    return (
        <Container fluid>
            <Row className='justify-content-center text-white mt-0 bg-primary-1'>
                <Col lg={12} md={12} sm={12}>
                    {/* <AdSenseSlot client='ca-pub-8417979887134577' slot='1042016675' /> */}
                    <h2 className='text-center mt-3'>C8 Z51 Corvette Blog</h2>
                    {c8BlogList}
                    {totalPages > 1 && (
                        <div className="d-flex justify-content-center my-3">
                            <Button
                                variant="secondary"
                                className="mx-1"
                                style={{ width: "100px" }}
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="secondary"
                                className="mx-1"
                                style={{ width: "100px" }}
                                disabled={page === totalPages}
                                onClick={() => setPage(page + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </Col>
            </Row>
        </Container>
    );
}

export default C8Blog;
