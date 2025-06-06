// src/entry-ssg.jsx
import App from './App.jsx'
import { ViteSSG } from 'vite-react-ssg'

export const createApp = ViteSSG(
  App,
  {
    // routes → exactly the same paths you have in <Routes>
    routes: [
      { path: '/', component: () => import('./components/pages/Home.jsx') },
      { path: '/garage', component: () => import('./components/Garage.jsx') },
      { path: '/intro', component: () => import('./components/pages/Intro.jsx') },
      { path: '/na-blog', component: () => import('./components/blog/Miyoshi.jsx') },
      { path: '/msm-blog', component: () => import('./components/blog/Kiryu.jsx') },
      { path: '/nd-blog', component: () => import('./components/blog/Kasumi.jsx') },
      { path: '/c8-blog', component: () => import('./components/blog/Panda.jsx') },
      { path: '/youtube', component: () => import('./components/YouTube.jsx') },
      { path: '/suspension', component: () => import('./components/Suspension.jsx') },
      { path: '/gallery', component: () => import('./components/Gallery.jsx') },
      { path: '/msm-gallery', component: () => import('./components/Gallery/NB/HillCountry.jsx') },
      { path: '/nc-eastcoast15', component: () => import('./components/Gallery/NC/EastCoast15.jsx') },
      { path: '/nc-yellowstone15', component: () => import('./components/Gallery/NC/Yellowstone15.jsx') },
      { path: '/nd-hillcountry', component: () => import('./components/Gallery/ND/HillCountry.jsx') },
      { path: '/c8-autox', component: () => import('./components/Gallery/C8/autocross.jsx') },
    ],
    base: '/',
    // give AdSense slots a moment to hydrate before we snapshot
    onBeforeRender() {
      return new Promise(res => setTimeout(res, 1000))
    },
  }
)
