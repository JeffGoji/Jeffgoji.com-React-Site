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

function NavMenu() {
    return (
        <>
            <Navbar bg="dark" data-bs-theme="dark" collapseOnSelect expand="lg">
                <Container fluid>
                    <Navbar.Brand
                        as={Link}
                        to="/"
                        aria-label="jeffgoji.com home"
                        className='logo ps-5 ms-2'
                        dangerouslySetInnerHTML={{ __html: logoMarkup }}
                    />
                    <Navbar.Toggle aria-controls="responsive-navbar-nav" />
                    <Navbar.Collapse id="responsive-navbar-nav">
                        <Nav className="me-auto">
                            <Nav.Link as={NavLink} to="/">Home</Nav.Link>
                            <Nav.Link as={NavLink} to="/garage">Car Blogs</Nav.Link>
                            <Nav.Link as={NavLink} to="/youtube">Videos</Nav.Link>
                            <Nav.Link as={NavLink} to="/suspension">Suspension</Nav.Link>
                            {/* <Nav.Link as={NavLink} to="/blogs">Blogs</Nav.Link> */}
                            {/* <Nav.Link as={NavLink} to="/gallery">Galleries</Nav.Link> */}
                            <NavDropdown title="Articles" id="basic-nav-dropdown">
                                <NavDropdown.Item as={NavLink} to="/goodbye-c8">Goodbye C8</NavDropdown.Item>
                                </NavDropdown>
                            <NavDropdown title="Galleries" id="basic-nav-dropdown">
                                <NavDropdown.Item>NA Miata (coming soon)</NavDropdown.Item>
                                <Dropdown drop="end">
                                    <Dropdown.Toggle variant="text" id="dropdown-basic">
                                        NB Mazdaspeed Miata
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu>
                                        <Dropdown.Item as={NavLink} to="/msm-gallery">Texas Hill Country Trip 2023</Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown>
                                <Dropdown drop="end">
                                    <Dropdown.Toggle variant="text" id="dropdown-basic">
                                        NC Miata
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu>
                                        <Dropdown.Item as={NavLink} to="/nc-eastcoast15">East Coast Trip 2015</Dropdown.Item>
                                        <Dropdown.Item as={NavLink} to="/nc-yellowstone15">Yellowstone West Coast Trip 2015</Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown>
                                <Dropdown drop="end">
                                    <Dropdown.Toggle variant="text" id="dropdown-basic">
                                        ND Miata
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu>
                                        <Dropdown.Item as={NavLink} to="/nd-hillcountry">Texas Hill Country</Dropdown.Item>
                                        <Dropdown.Item as={NavLink} to="/totdgallery">Tail of the Dragon 2025</Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown>
                                <Dropdown drop="end">
                                    <Dropdown.Toggle variant="text" id="dropdown-basic">
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
        </>
    )
}

export default NavMenu