
import {
  BrowserRouter,
  Routes,
  Route,

} from "react-router-dom";

//Pages to import:
import Header from './components/Header';
import NaMiata from './components/pages/NaMiata'
import NABlog from "./components/blog/Miyoshi";
import MsmBlog from './components/blog/Kiryu'
import NDBlog from "./components/blog/Kasumi";
import YouTube from './components/YouTube'
import Home from './components/pages/Home';
import Garage from './components/Garage';
import Intro from './components/pages/Intro';
import Fireball from './components/blog/Fireball';
import C8Blog from "./components/blog/Panda";
import Gallery from "./components/Gallery";
import Footer from './components/Footer'
import ScrollToTop from "./components/CustomComponents/ScrollToTop";

import './assets/css/style.css';


function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className='container-fluid m-0 p-0'>
        <Header />
        <Routes>

          <Route path="/" element={<Home />} />
          <Route path="garage" element={<Garage />} />
          <Route path="intro" element={<Intro />} />
          <Route path="na-miata" element={<NaMiata />} />
          <Route path="na-blog" element={<NABlog />} />
          <Route path="msm-blog" element={<MsmBlog />} />
          <Route path="nd-blog" element={<NDBlog />} />
          <Route path="c8-blog" element={<C8Blog />} />
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
