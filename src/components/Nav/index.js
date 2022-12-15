import React from 'react'
import { NavLink } from 'react-router-dom'

//Links

//Import logo:
import logo from '../../assets/images/logo.gif'

function Nav() {
    return (
        <nav>
            <ul className="nav nav-tabs">
                <img src={logo} className="m-1 logo image-fluid" />
                {/* <li className="nav-item">
                    <a className="nav-link active" aria-current="page" href="#">Menu</a>
                </li> */}
                <li className="nav-item dropdown">
                    <a className="nav-link dropdown-toggle" data-bs-toggle="dropdown" href="#" role="button" aria-expanded="false">MENU</a>
                    <ul className="dropdown-menu">
                        <li><a className="dropdown-item"
                            href="#">Home</a></li>
                        <li><a className="dropdown-item" href="#">Site News</a></li>
                        <li><NavLink className='dropdown-item' to="miatas">Mazda Miatas</NavLink></li>
                        <li><NavLink className="dropdown-item" to="na-miata">1991 Mazda MX5</NavLink></li>
                        <li><NavLink className="dropdown-item" to="msm-blog">2004 Mazdaspeed MX5</NavLink></li>
                        <li><a className="dropdown-item" href="#">2013 Mazda MX5</a></li>
                        <li><a className="dropdown-item" href="#">Product Reviews</a></li>
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