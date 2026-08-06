import { Link, NavLink } from 'react-router-dom'
import { Navbar, Container, Nav, NavDropdown, Dropdown } from 'react-bootstrap'

import { galleryHubPath } from '../common/gallerySets'

/**
 * The logo is injected as markup rather than referenced with <Image src>: its
 * wordmark is live <text>, so it only resolves the self-hosted Archivo /
 * Space Mono faces when it lives in this document. An <img> renders the SVG in
 * an isolated document where those @font-face rules do not exist. The asset is
 * a checked-in design artifact with no script, no on* handlers and no external
 * references (verified in Task 00016), which is what makes injecting it safe.
 */
import logoMarkup from '../../assets/logo.svg?raw'

/**
 * Primary navigation.
 *
 * The chrome is the mockups' `.nav` block, ported onto `.site-nav` in
 * src/scss/styles.scss. Bootstrap's `bg="dark"` / `data-bs-theme="dark"` is
 * deliberately absent: that is Bootstrap's own dark ramp, independent of the V2
 * token layer, and on this element it shadowed it.
 *
 * The active-route underline rides the `active` class React Router's NavLink
 * appends. `isActive` as a render prop is unavailable here: react-bootstrap's
 * Nav.Link folds `className` through the `classnames` package, which silently
 * drops function arguments before the router ever sees them.
 *
 * The Galleries panel still fans out per set, but every entry in it now names
 * the one `/galleries` hub and identifies its set in the query rather than
 * pointing at the pre-V2 per-gallery URL. Routing through the old URL only to
 * be redirected off it was what discarded the set the visitor had picked, so
 * all six entries opened the same gallery (Bug 00079).
 *
 * These are plain `Link`s where the rest of the nav uses `NavLink`: the active
 * match ignores the query, so six links that share `/galleries` would all mark
 * themselves current the moment the hub is open.
 *
 * The trailing "What's New" pill is permanent chrome (AC-014). It shipped ahead
 * of its destination and dead-ended until Task 00064 registered `/whats-new`;
 * the route-parity guard in App.test.jsx is what keeps the two together.
 */
function NavMenu() {
    return (
        <Navbar collapseOnSelect expand="lg" className="site-nav">
            <Container fluid className="site-nav__inner">
                <Navbar.Brand
                    as={Link}
                    to="/"
                    aria-label="jeffgoji.com home"
                    className='logo'
                    dangerouslySetInnerHTML={{ __html: logoMarkup }}
                />
                <Navbar.Toggle aria-controls="responsive-navbar-nav" />
                <Navbar.Collapse id="responsive-navbar-nav">
                    <Nav className="ms-auto">
                        {/* `end` keeps "/" from prefix-matching every route and underlining Home everywhere. */}
                        <Nav.Link as={NavLink} to="/" end>Home</Nav.Link>
                        <Nav.Link as={NavLink} to="/garage">Car Blogs</Nav.Link>
                        <Nav.Link as={NavLink} to="/youtube">Videos</Nav.Link>
                        <Nav.Link as={NavLink} to="/suspension">Suspension</Nav.Link>
                        <NavDropdown title="Articles" id="articles-nav-dropdown">
                            <NavDropdown.Item as={NavLink} to="/goodbye-c8">Goodbye C8</NavDropdown.Item>
                        </NavDropdown>
                        <NavDropdown title="Galleries" id="galleries-nav-dropdown">
                            <Dropdown drop="end">
                                <Dropdown.Toggle variant="text" id="nb-gallery-dropdown-toggle">
                                    NB Mazdaspeed Miata
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                    <Dropdown.Item as={Link} to={galleryHubPath('nb-hillcountry')}>Texas Hill Country Trip 2023</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                            <Dropdown drop="end">
                                <Dropdown.Toggle variant="text" id="nc-gallery-dropdown-toggle">
                                    NC Miata
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                    <Dropdown.Item as={Link} to={galleryHubPath('nc-eastcoast15')}>East Coast Trip 2015</Dropdown.Item>
                                    <Dropdown.Item as={Link} to={galleryHubPath('nc-yellowstone15')}>Yellowstone West Coast Trip 2015</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                            <Dropdown drop="end">
                                <Dropdown.Toggle variant="text" id="nd-gallery-dropdown-toggle">
                                    ND Miata
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                    <Dropdown.Item as={Link} to={galleryHubPath('nd-hillcountry')}>Texas Hill Country</Dropdown.Item>
                                    <Dropdown.Item as={Link} to={galleryHubPath('nd-totd2025')}>Tail of the Dragon 2025</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                            <Dropdown drop="end">
                                <Dropdown.Toggle variant="text" id="c8-gallery-dropdown-toggle">
                                    C8 Corvette
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                    <Dropdown.Item as={Link} to={galleryHubPath('c8-autox')}>Autocross</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        </NavDropdown>
                        <Nav.Link as={NavLink} to="/whats-new" className="site-nav__link--flag">
                            What&apos;s New
                        </Nav.Link>
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    )
}

export default NavMenu
