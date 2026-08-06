import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useSearchParams,
} from 'react-router-dom'

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
import {
  GALLERY_SETS,
  GALLERY_SET_PARAM,
  galleryHubPath,
} from './components/common/gallerySets'

import ScrollToTop from './components/CustomComponents/ScrollToTop'
import PageviewTracker from './components/CustomComponents/PageviewTracker'

/**
 * The pre-V2 gallery URLs, every one of which now lands on the single hub, each
 * paired with the set it used to serve.
 *
 * Derived from the set config rather than re-listed here so a set that is
 * renamed or added in the switcher cannot leave its old URL behind
 * unredirected. Carrying the slug is what keeps a standing bookmark on one of
 * these URLs pointed at the gallery it was taken on: the redirect used to drop
 * that identity and land every one of them on the hub's first set (Bug 00079).
 *
 * `/gallery` is appended by hand with no slug because it was the switcher
 * landing page rather than a set, so the hub's own default is the correct
 * destination for it.
 */
const LEGACY_GALLERY_REDIRECTS = [
  ...GALLERY_SETS.map((set) => ({ path: set.legacyPath, slug: set.slug })),
  { path: '/gallery', slug: undefined },
]

/**
 * `<Navigate>` commits its navigation from an effect and renders nothing until
 * it does, so the browser can paint one frame with the shell holding no route
 * content at all — the footer directly under the nav, a viewport away from
 * where the hub is about to put it. That frame is a measured layout shift of its
 * own (Bug 00077: 0.31 desktop / 0.78 mobile on /totdgallery, intermittent
 * because it depends on whether the paint beats the effect).
 *
 * Holding a viewport of height for that one frame keeps the footer below the
 * fold across the swap, which is the same contract `.gallery-hub__body--reserved`
 * carries on the destination.
 *
 * @param {object} props
 * @param {string} [props.slug] the set this pre-V2 URL served, handed to the
 *   hub through its query so the redirect does not spend it.
 */
export function LegacyGalleryRedirect({ slug }) {
  return (
    <div className="route-reserve">
      <Navigate to={galleryHubPath(slug)} replace />
    </div>
  )
}

/**
 * Binds the hub to the URL in the one direction the hub allows.
 *
 * `?set=` seeds the hub and nothing more; the switcher never writes it back,
 * because a second owner for the selected slug would let the URL and the
 * on-screen selection disagree (see GalleryHub's own docblock). Seeding alone
 * is not enough on this route, though: React Router reuses a mounted element
 * across a navigation that resolves to the same path, so a nav click from one
 * set to another changed the URL and left the screen on the previous set.
 * Keying on the location is what forces the fresh mount that re-runs the seed.
 *
 * The key is the location rather than the query so that re-clicking the entry
 * the switcher has since been moved off also lands where it says it will. Only
 * a navigation mints a new location key, and the switcher performs none — so
 * this cannot reach back into the selection the switcher owns.
 */
export function GalleryHubRoute() {
  const location = useLocation()
  const [searchParams] = useSearchParams()

  return (
    <GalleryHub
      key={location.key}
      initialSlug={searchParams.get(GALLERY_SET_PARAM) ?? undefined}
    />
  )
}

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
          <Route path="galleries" element={<GalleryHubRoute />} />
          <Route path="whats-new" element={<WhatsNew />} />
          {LEGACY_GALLERY_REDIRECTS.map(({ path, slug }) => (
            <Route key={path} path={path} element={<LegacyGalleryRedirect slug={slug} />} />
          ))}
        </Routes>
        <Footer />
      </div>
    </BrowserRouter>
  )
}

export default App
