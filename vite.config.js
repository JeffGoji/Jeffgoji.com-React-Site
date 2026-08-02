// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite configuration.
 *
 * @remarks
 * `build.target` is pinned to the oldest browsers that natively support
 * `Object.hasOwn`, which react-markdown v10 calls at render time on every blog
 * page. esbuild's target downlevels syntax only and never polyfills built-ins,
 * so Vite's default target (which reaches back to safari14 / chrome87) would
 * advertise a floor the bundle cannot actually meet and would throw a
 * TypeError on those browsers. Do not lower this without either adding an
 * `Object.hasOwn` polyfill ahead of the module entry or dropping react-markdown.
 */
export default defineConfig({
  build: {
    target: ['chrome93', 'safari15.4', 'firefox92', 'edge93']
  },
  plugins: [
    react()
  ],
  base: '/'
})
