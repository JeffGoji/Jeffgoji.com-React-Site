import { Link, NavLink } from 'react-router-dom'
import { Navbar, Container, Nav, NavDropdown, Dropdown } from 'react-bootstrap'

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
 * Galleries still fan out per set. Spec 00002's adopted delta routes them
 * through one `/galleries` hub, but Feature B has not built that route yet, so
 * pointing at it here would 404.
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
                                    <Dropdown.Item as={NavLink} to="/msm-gallery">Texas Hill Country Trip 2023</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                            <Dropdown drop="end">
                                <Dropdown.Toggle variant="text" id="nc-gallery-dropdown-toggle">
                                    NC Miata
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                    <Dropdown.Item as={NavLink} to="/nc-eastcoast15">East Coast Trip 2015</Dropdown.Item>
                                    <Dropdown.Item as={NavLink} to="/nc-yellowstone15">Yellowstone West Coast Trip 2015</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                            <Dropdown drop="end">
                                <Dropdown.Toggle variant="text" id="nd-gallery-dropdown-toggle">
                                    ND Miata
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                    <Dropdown.Item as={NavLink} to="/nd-hillcountry">Texas Hill Country</Dropdown.Item>
                                    <Dropdown.Item as={NavLink} to="/totdgallery">Tail of the Dragon 2025</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                            <Dropdown drop="end">
                                <Dropdown.Toggle variant="text" id="c8-gallery-dropdown-toggle">
                                    C8 Corvette
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                    <Dropdown.Item as={NavLink} to="/c8-autox">Autocross</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        </NavDropdown>
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    )
}

export default NavMenu
