import { NavLink } from 'react-router-dom'
import { Navbar, Container, Nav, Image } from 'react-bootstrap'

//Import logo:
import logo from '../../assets/images/logo.gif'

function NavMenu() {
    return (
        <>
            <Navbar bg="dark" data-bs-theme="dark" collapseOnSelect expand="lg">
                <Container fluid>
                    <Navbar.Brand href="#home"><Image src={logo} /></Navbar.Brand>
                    <Navbar.Toggle aria-controls="responsive-navbar-nav" />
                    <Navbar.Collapse id="responsive-navbar-nav">
                        <Nav className="me-auto">
                            <Nav.Link as={NavLink} to="/">Home</Nav.Link>
                            <Nav.Link as={NavLink} to="/garage">Garage</Nav.Link>
                            <Nav.Link as={NavLink} to="/youtube">Videos</Nav.Link>
                            {/* <Nav.Link as={NavLink} to="/blogs">Blogs</Nav.Link> */}
                            <Nav.Link as={NavLink} to="/gallery">Galleries</Nav.Link>
                        </Nav>
                    </Navbar.Collapse>
                </Container>
            </Navbar>
        </>
    )
}

export default NavMenu