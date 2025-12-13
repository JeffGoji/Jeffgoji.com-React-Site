/* eslint-disable react/no-unescaped-entities */
import { Container, Row, Col } from "react-bootstrap";
import c81 from '../../../assets/images/c8/c8-001s.jpg';
import c82 from '../../../assets/images/c8/autocross/c8s-002.jpg';   
import c83 from '../../../assets/images/c8/club-001.jpg';
import c84 from '../../../assets/images/c8/autocross/c84.jpg';
import c85 from '../../../assets/images/c8/shoprally_03292025.jpg';

function GoodbyeC8() {
    return (
        <Container className="article-page">
            <Row className="justify-content-center mt-5 text-center">
                <h1>Goodbye, Panda</h1>
                <Col>
                    <p>
                        Here at the end of a short but fun road. After three years and 16,000 miles, it is time to say goodbye to the C8 Corvette.
                        <br />
                        So as the car departs, I want to give an end-of-life report on it and fill you in on the positives and negatives of owning the first mid-engine Corvette.
                        <br />
                        First, the positives...
                    </p>
                </Col>
            </Row>

            <Row className="justify-content-center text-center mt-3">
                <Col lg={12}>
                    <img src={c81} alt="Panda" className="img-fluid rounded" />
                    <p className="text-start mt-3">
                        The C8 is a blast to drive in any situation and mode selected. The mid-engine layout gives it a handling characteristic that is unlike any previous Corvette; it stays planted and gets power down out of a corner in a brutally efficient manner as the torque piles on from the 6.2-liter LT2 V8.
                        <br />
                        Passing on the highway is also fairly effortless, and you'll find yourself going quite a bit faster than intended from time to time unless you're paying close attention to the speedometer.
                        <br />
                        The V8 engine provides plenty of power, and the dual-clutch transmission shifts quickly and smoothly enough for most daily driving situations. In fact, the DCT in the C8 has to be one of the best dual-clutch transmissions I have ever driven and is easily a gold standard for daily driving and track performance.
                    </p>
                </Col>
            </Row>

            <Row className="justify-content-center text-center mt-3">
                <Col lg={12}>
                    <img src={c82} alt="Panda" className="img-fluid rounded" />
                    <p className="text-start mt-3">
                        The car is fairly large (very wide) and a bit heavy. This C8 has the Z51 performance package, which adds a few extra performance goodies like an aero package, magnetic ride control, and better brakes.
                        <br />
                        I am sure a hundred or more reviewers have said this, but the mag-ride is a game changer for combining ride comfort for daily driving duties and stiffening up for a more spirited canyon-carving experience in Sport mode, or going full stiff in Track mode for the occasional track day or autocross event.
                        <br />
                        The suspension is very compliant in Tour mode, soaking up bumps and rough pavement with ease, making it a surprisingly comfortable car for long drives despite its sports car nature.
                        <br />
                        I found Sport mode to be the best for canyon carving in the Texas Hill Country, as it still allowed some compliance for the rougher roads while keeping body roll in check. It also makes the transmission shift quicker and holds gears longer for better acceleration out of corners.
                        <br />
                        Track mode is best reserved for the track or autocross, as the ride gets very stiff and unforgiving on even what is considered to be "smooth" pavement.
                        <br />
                        This is where the DCT transmission really shines, holding gears longer and downshifting more aggressively for maximum performance.
                        <br />
                        You could always swap to Manual mode for the transmission and use the paddle shifters, but I found the DCT to be so good that I rarely felt the need to intervene.
                    </p>
                </Col>
            </Row>

            <Row className="justify-content-center mt-3 text-center">
                <Col lg={12}>
                    <img src={c84} alt="Panda" className="img-fluid rounded" />
                    <p className="text-start mt-3">
                        One of the coolest features of the Corvette is the PTM (Performance Traction Management) system, which allows you to select different driving modes that adjust the car's traction control, stability control, and other performance settings.
                        <br />
                        This system is especially useful for track days or autocross events, as it allows you to tailor the car's performance to your driving style and track conditions. This is especially helpful if you're not yet comfortable pushing the car to and above its absolute limits.
                        <br />
                        When I was learning the car, the PTM system was absolutely invaluable in helping me build confidence and learn the car's limits without going over them. I am now my absolute fastest in this car with the PTM completely off.
                    </p>
                </Col>
            </Row>

            <Row className="justify-content-center text-center mt-3">
                <Col lg={12}>
                    <img src={c83} alt="Panda" className="img-fluid rounded" />
                    <p className="text-start mt-3">
                        Another positive is the design of the car. The C8 has a sleek and modern look that turns heads wherever it goes and invites lots of random conversations when parked in public.
                    </p>
                    <p className="text-start mt-3">
                        The interior of the first-generation C8 (2020–2024) is a winner for me. Everything is functional and focused like a cockpit in a fighter jet. The viewing area out the front of the car is awesome and is around 40% improved over the previous generation.
                        <br />
                        The infamous "wall of buttons" between the seats can cause minor passenger discomfort, but it makes AC and heated/ventilated seat controls very easy to access.
                        <br />
                        We swapped the race seats for GT2 seats, which are more comfortable for daily driving and long trips while still being very supportive in corners.
                    </p>
                </Col>
            </Row>

            <Row className="justify-content-center text-center mt-3">
                <Col lg={12}>
                    <img src={c85} alt="Panda" className="img-fluid rounded" />
                    <p className="text-start mt-3">
                        Panda is a 70th Anniversary Edition C8 with the Hardtop Convertible package, which replaces the removable roof panel with a power retractable hardtop.
                        <br />
                        It operates seamlessly, with the top going up or down in about 16 seconds at speeds up to 30 mph.
                        <br />
                        If you plan to use your C8 as a grand touring car or live in a state with frequent open-air weather, I highly recommend the Hardtop Convertible option.
                    </p>
                </Col>
            </Row>
        </Container>
    );
}

export default GoodbyeC8;
