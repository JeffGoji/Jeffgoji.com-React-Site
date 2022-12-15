import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,

} from "react-router-dom";

//Pages to import:
import Header from './components/Header';
import Miatas from './components/pages/Miatas'
import NaMiata from './components/pages/NaMiata'
import MsmBlog from './components/MsmBlog'
// import Nav from './components/Nav';
import Intro from './components/pages/Intro';
import Footer from './components/Footer'

//Import the CSS styling:
import './assets/css/style.css';

function App() {
  return (
    <BrowserRouter>
      <div className='container-fluid'>
        <Header />
        {/* <Nav /> */}
        <Routes>

          <Route path="/" element={<Intro />} />
          <Route path="miatas" element={<Miatas />} />
          <Route path="na-miata" element={<NaMiata />} />
          <Route path="msm-blog" element={<MsmBlog />} />

        </Routes>
        <Footer />
      </div>

    </BrowserRouter>
  );
}

export default App;
