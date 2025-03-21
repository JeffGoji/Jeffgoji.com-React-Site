import { Container, Row, Col, Card, Image, ListGroup } from 'react-bootstrap';
import data from '../../../assets/Data/MsmBlog.json';

function MsmBlog() {

    const msmBlogList = data.map((data) =>
        <Row className='justify-content-center mb-4' key={data.id}>
            <Col lg={6} md={10} sm={12} className="mt-3">
                <Card className='bg-dark rounded p-2 img-shadow-red text-white'>
                    <div className='text-center'>
                        <Image src={data.picture} className="img-fluid rounded" alt="this post's pic" />
                    </div>
                    <ListGroup className='mt-3 rounded'>
                        <ListGroup.Item className='p-1 rounded bg-dark text-white'>Date: {data.date}</ListGroup.Item>
                        <ListGroup.Item className='p-1 rounded bg-dark text-white'>Mileage: {data.mileage} miles</ListGroup.Item>
                        <ListGroup.Item className='p-1 rounded bg-dark text-white'>Cost for this entry: {data.cost}</ListGroup.Item>
                    </ListGroup>
                    <hr />
                    <Card.Text style={{ whiteSpace: "pre-line" }}>{data.entry}</Card.Text>
                    <p className='text-center'><a href="#top">Back to top</a></p>
                    <hr className="bloghr" />
                </Card>
            </Col>
        </Row>
    );

    return (
        <Container fluid>
            <Row className='justify-content-center text-white mt-0 bg-primary-1'>
                <Col lg={9} md={12} sm={12}>
                    <h2 className='text-center text-shadow text-black'>Mazdaspeed Miata Blog</h2>
                    {msmBlogList}
                </Col>
            </Row>
        </Container>
    );
}

export default MsmBlog;
