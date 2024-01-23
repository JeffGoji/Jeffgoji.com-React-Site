
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
import YouTube from './components/YouTube'
// import Nav from './components/Nav';
import Home from './components/pages/Home';
import Garage from './components/Garage';
import Intro from './components/pages/Intro';
import Fireball from './components/blog/Fireball';
import Gallery from "./components/Gallery";
import Footer from './components/Footer'

import './assets/css/style.css';


function App() {
  return (
    <BrowserRouter>
      <div className='container-fluid m-0 p-0'>
        <Header />
        <Routes>

          <Route path="/" element={<Home />} />
          <Route path="garage" element={<Garage />} />
          <Route path="intro" element={<Intro />} />
          <Route path="miatas" element={<Miatas />} />
          <Route path="na-miata" element={<NaMiata />} />
          <Route path="msm-blog" element={<MsmBlog />} />
          <Route path="youtube" element={<YouTube />} />
          <Route path="fireball" element={<Fireball />} />
          <Route path="gallery" element={<Gallery />} />

        </Routes>
        <Footer />
      </div>

    </BrowserRouter>
  );
}

export default App;
