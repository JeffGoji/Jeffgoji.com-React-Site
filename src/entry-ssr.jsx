// src/entry-ssr.jsx
import App from './App.jsx';
import { ViteSSG } from 'vite-plugin-ssg/react';

export const createApp = ViteSSG(
  App,
  {
    // 1) List out every route path and point to the component(s) you imported
    routes: [
      { path: '/', component: () => import('./components/pages/Home.jsx') },
      { path: '/garage', component: () => import('./components/Garage.jsx') },
      { path: '/intro', component: () => import('./components/pages/Intro.jsx') },
      { path: '/na-blog', component: () => import('./components/blog/Miyoshi.jsx') },
      { path: '/msm-blog', component: () => import('./components/blog/Kiryu.jsx') },
      { path: '/nd-blog', component: () => import('./components/blog/Kasumi.jsx') },
      { path: '/c8-blog', component: () => import('./components/blog/Panda.jsx') },
      { path: '/suspension', component: () => import('./components/Suspension.jsx') },
      { path: '/gallery', component: () => import('./components/Gallery.jsx') },
      { path: '/msm-gallery', component: () => import('./components/Gallery/NB/HillCountry.jsx') },
      { path: '/nc-eastcoast15', component: () => import('./components/Gallery/NC/EastCoast15.jsx') },
      { path: '/nc-yellowstone15', component: () => import('./components/Gallery/NC/Yellowstone15.jsx') },
      { path: '/nd-hillcountry', component: () => import('./components/Gallery/ND/HillCountry.jsx') },
      { path: '/c8-autox', component: () => import('./components/Gallery/C8/autocross.jsx') },
      // …etc for every route you need
    ],
    base: '/',
    // Optional: wait a bit so AdSense <ins> slots have time to render client-side
    // onBeforeRender(ctx) {
    //   // e.g. return new Promise(r => setTimeout(r, 1000));
    // }
  }
);
