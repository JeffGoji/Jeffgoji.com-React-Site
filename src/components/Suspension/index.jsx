import { Container, Row, Col } from "react-bootstrap";
import Accordion from 'react-bootstrap/Accordion';
import CompDamping from "./CompDamping";
import ReboundDamping from "./ReboundDamping";
import Combined from "./Combined";

function Suspension() {
  return (
      <Container fluid>
          <Row>
              <Col lg={12} className="text-center">
                  <h1 className="text-center"><strong>Suspension Tuning</strong></h1>
                    <p className="text-center">
                      This is my section on suspension tuning, and even more specifically dampers. Please have a look and enjoy.
                      </p>
              </Col>
          </Row>
          <Row>   
              <Col lg={12} className="text-center">
                    <h4 className="text-center">Springs</h4>
              </Col>
              <Col lg={12} className="text-center">
                    <h4 className="text-center">way-bars</h4>
              </Col>
              <Col lg={12} className="text-center">
                    <h4 className="text-center">Bumpstops</h4>
              </Col>
              <Col lg={12} className="text-center">
                  <h4>Dampers</h4>
              <Accordion>
      <Accordion.Item eventKey="0">
        <Accordion.Header><strong>Compression Damping</strong></Accordion.Header>
        <Accordion.Body className=' mb-5'>
                              <CompDamping />
                          </Accordion.Body>
                      </Accordion.Item>
                      <Accordion.Item eventKey="1">
        <Accordion.Header><strong>Rebound Damping</strong></Accordion.Header>
        <Accordion.Body className=' mb-5'>
                              <ReboundDamping />
                          </Accordion.Body >
                      </Accordion.Item>
                      <Accordion.Item eventKey="2">
                          <Accordion.Header><strong>Combined Damping</strong></Accordion.Header>
        <Accordion.Body className=' mb-5 pb-5'>
        <Combined />
                          </Accordion.Body >
                      </Accordion.Item>
                      <Accordion.Item eventKey="3">
                      </Accordion.Item>
                      </Accordion>
              </Col>
        </Row>
    </Container>
  );
}

export default Suspension;