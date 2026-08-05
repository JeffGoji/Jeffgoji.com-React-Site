import Accordion from 'react-bootstrap/Accordion';

import Springs from './Springs';
import Bumpstops from './Bumpstops';
import CompDamping from './CompDamping';
import ReboundDamping from './ReboundDamping';
import Combined from './Combined';
import CriticalDamping from './CriticalDamping';
import Swaybars from './Swaybars';

/**
 * The suspension-tuning hub.
 *
 * eventKey is scoped to its own <Accordion> root, so each of the four groups
 * numbers from 0. The pre-V2 markup numbered the eight items 0-7 as if a single
 * sequence ran across all four roots, which is how an empty
 * <Accordion.Item eventKey="5"> survived between Combined and Critical damping:
 * once a panel is dropped from a global sequence, renumbering looks riskier than
 * leaving the stub behind. React-Bootstrap renders an item carrying neither
 * header nor body as a bare bordered strip, so the stub painted as an empty row
 * in the damper list.
 *
 * Accordion.Header defaults to rendering an <h2>; `as="h3"` keeps it below the
 * group titles rather than level with them.
 */
function Suspension() {
    return (
        <main className="suspension">
            <header className="section-head">
                <div className="eyebrow">Tech</div>
                <h1>Suspension Tuning</h1>
                <p className="sub">
                    This is my section on suspension tuning, and even more specifically dampers.
                    Please have a look and enjoy.
                </p>
            </header>

            <section className="suspension__group">
                <h2 className="suspension__group-title">Springs</h2>
                <Accordion className="spec-accordion">
                    <Accordion.Item eventKey="0">
                        <Accordion.Header as="h3">Springs</Accordion.Header>
                        <Accordion.Body>
                            <Springs />
                        </Accordion.Body>
                    </Accordion.Item>
                </Accordion>
            </section>

            <section className="suspension__group">
                <h2 className="suspension__group-title">Bumpstops</h2>
                <Accordion className="spec-accordion">
                    <Accordion.Item eventKey="0">
                        <Accordion.Header as="h3">Bumpstops</Accordion.Header>
                        <Accordion.Body>
                            <Bumpstops />
                        </Accordion.Body>
                    </Accordion.Item>
                </Accordion>
            </section>

            <section className="suspension__group">
                <h2 className="suspension__group-title">Dampers</h2>
                <Accordion className="spec-accordion">
                    <Accordion.Item eventKey="0">
                        <Accordion.Header as="h3">Compression Damping</Accordion.Header>
                        <Accordion.Body>
                            <CompDamping />
                        </Accordion.Body>
                    </Accordion.Item>
                    <Accordion.Item eventKey="1">
                        <Accordion.Header as="h3">Rebound Damping</Accordion.Header>
                        <Accordion.Body>
                            <ReboundDamping />
                        </Accordion.Body>
                    </Accordion.Item>
                    <Accordion.Item eventKey="2">
                        <Accordion.Header as="h3">Combined Damping</Accordion.Header>
                        <Accordion.Body>
                            <Combined />
                        </Accordion.Body>
                    </Accordion.Item>
                    <Accordion.Item eventKey="3">
                        <Accordion.Header as="h3">Critical Damping</Accordion.Header>
                        <Accordion.Body>
                            <CriticalDamping />
                        </Accordion.Body>
                    </Accordion.Item>
                </Accordion>
            </section>

            <section className="suspension__group">
                <h2 className="suspension__group-title">Sway-bars</h2>
                <Accordion className="spec-accordion">
                    <Accordion.Item eventKey="0">
                        <Accordion.Header as="h3">Swaybars</Accordion.Header>
                        <Accordion.Body>
                            <Swaybars />
                        </Accordion.Body>
                    </Accordion.Item>
                </Accordion>
            </section>
        </main>
    );
}

export default Suspension;
