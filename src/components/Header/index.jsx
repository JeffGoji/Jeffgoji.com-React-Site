import React from 'react';
import {
    BrowserRouter, Route, Routes,
} from "react-router-dom";
import Nav from '../Nav';

function Header() {

    return (

        <header className='row'>
            <Nav />
        </header >


    )
};



export default Header;