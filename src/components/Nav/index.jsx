import { NavLink } from 'react-router-dom'

//Import logo:
import logo from '../../assets/images/logo.gif'

function Nav() {
    return (
        <nav className='bg-dark navbar sticky-top'>
            <ul className="nav">
                <img src={logo} className="m-1 logo image-fluid" alt='main logo' />
                {/* <li className="nav-item">
                    <a className="nav-link active" aria-current="page" href="#">Menu</a>
                </li> */}
                <li className="nav-item dropdown bg-dark">
                    <a className="nav-link dropdown-toggle" data-bs-toggle="dropdown" href="/" role="button" aria-expanded="false">MENU</a>
                    <ul className="dropdown-menu">
                        <li><NavLink className="dropdown-item"
                            to="/">Home</NavLink></li>
                        {/* <li><a className="dropdown-item" href="#">Site News</a></li> */}
                        {/* <li><NavLink className='dropdown-item' to="miatas">Mazda Miatas</NavLink></li> */}
                        <li><NavLink className="dropdown-item" to="na-miata">1991 Mazda MX5</NavLink></li>
                        <li><NavLink className="dropdown-item" to="msm-blog">2004 Mazdaspeed MX5</NavLink></li>
                        <li><a className="dropdown-item" href="#">2013 Mazda MX5</a></li>
                        <li><NavLink className="dropdown-item" to="fireball">Fireball</NavLink></li>
                        <li><NavLink className="dropdown-item" to="gallery">Gallery</NavLink></li>
                    </ul>
                </li>
                {/* <li className="nav-item">
                    <a className="nav-link" href="#">Link</a>
                </li> */}

            </ul>
        </nav>

    )
}

export default Nav