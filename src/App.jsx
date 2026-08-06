import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Components and Pages
import Header from './components/Header'
import Footer from './components/Footer'
import Garage from './components/Garage'
import Home from './components/pages/Home'
import Intro from './components/pages/Intro'
import YouTube from './components/YouTube'
import Suspension from './components/Suspension'
import WhatsNew from './components/WhatsNew'

// Blog links
import NaMiata from './components/pages/NaMiata'
import NABlog from './components/blog/Miyoshi'
import MsmBlog from './components/blog/Kiryu'
import NDBlog from './components/blog/Kasumi'
import C8Blog from './components/blog/Panda'

// Article links
// import TailOfTheDragon from './components/Articles/2025/tailofthedragon'
import GoodbyeC8 from './components/Articles/2025/GoodbyeC8';

// Gallery links
import GalleryHub from './components/common/GalleryHub'
import { GALLERY_SETS } from './components/common/gallerySets'

import ScrollToTop from './components/CustomComponents/ScrollToTop'
import PageviewTracker from './components/CustomComponents/PageviewTracker'

/**
 * The pre-V2 gallery URLs, every one of which now lands on the single hub.
 *
 * Derived from the set config rather than re-listed here so a set that is
 * renamed or added in the switcher cannot leave its old URL behind
 * unredirected. `/gallery` is appended by hand because it was the switcher
 * landing page rather than a set, so it has no entry to derive from.
 */
const LEGACY_GALLERY_PATHS = [...GALLERY_SETS.map((set) => set.legacyPath), '/gallery']

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <PageviewTracker />
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
          {/* <Route path="tail-of-the-dragon" element={<TailOfTheDragon />} /> */}
          <Route path="goodbye-c8" element={<GoodbyeC8 />} />
          <Route path="youtube" element={<YouTube />} />
          <Route path="suspension" element={<Suspension />} />
          <Route path="galleries" element={<GalleryHub />} />
          <Route path="whats-new" element={<WhatsNew />} />
          {LEGACY_GALLERY_PATHS.map((path) => (
            <Route key={path} path={path} element={<Navigate to="/galleries" replace />} />
          ))}
        </Routes>
        <Footer />
      </div>
    </BrowserRouter>
  )
}

export default App
