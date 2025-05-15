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
                  <h1 className="text-center">Suspension Tuning</h1>
                    <p className="text-center">
                      This is my section on suspension tuning, and even more specifically dampers. Please have a look and enjoy.
                      </p>
              </Col>
          </Row>
          <Row>   
              <Col lg={12} className="text-center">
              <Accordion defaultActiveKey="0">
      <Accordion.Item eventKey="0">
        <Accordion.Header><strong>Compression Damping</strong></Accordion.Header>
        <Accordion.Body>
                              <CompDamping />
                          </Accordion.Body>
                      </Accordion.Item>
                      <Accordion.Item eventKey="1">
        <Accordion.Header><strong>Rebound Damping</strong></Accordion.Header>
        <Accordion.Body>
                              <ReboundDamping />
                          </Accordion.Body>
                      </Accordion.Item>
                      <Accordion.Item eventKey="2">
                          <Accordion.Header><strong>Combining it together</strong></Accordion.Header>
        <Accordion.Body>
        <Combined />
                          </Accordion.Body>
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