// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Garage from "./components/Garage";
import Home from "./components/pages/Home";
import Intro from "./components/pages/Intro";
import YouTube from "./components/YouTube";
import Suspension from "./components/Suspension";
// Blog links
import NaMiata from "./components/pages/NaMiata";
import NABlog from "./components/blog/Miyoshi";
import MsmBlog from "./components/blog/Kiryu";
import NDBlog from "./components/blog/Kasumi";
import C8Blog from "./components/blog/Panda";
// Gallery links
import Gallery from "./components/Gallery";
import MSMGallery from "./components/Gallery/NB/HillCountry";
import EastCoast15 from "./components/Gallery/NC/EastCoast15";
import Yellowstone15 from "./components/Gallery/NC/Yellowstone15";
import NDHillCountry from "./components/Gallery/ND/HillCountry";
import C8AutoxGallery from "./components/Gallery/C8/autocross";
import ScrollToTop from "./components/CustomComponents/ScrollToTop";

import "./assets/css/style.css";

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />

      {/* This root container must render immediately (no data-fetching delays) */}
      <div className="container-fluid m-0 p-0">
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
          <Route path="suspension" element={<Suspension />} />
          <Route path="gallery" element={<Gallery />} />
          <Route path="msm-gallery" element={<MSMGallery />} />
          <Route path="nc-eastcoast15" element={<EastCoast15 />} />
          <Route path="nc-yellowstone15" element={<Yellowstone15 />} />
          <Route path="nd-hillcountry" element={<NDHillCountry />} />
          <Route path="c8-autox" element={<C8AutoxGallery />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
