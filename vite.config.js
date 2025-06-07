// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { ViteReactSSG } from 'vite-react-ssg'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    ViteReactSSG(
      {
        entry: 'src/entry-ssr.jsx',
        // give AdsIns a second to render before snapshotting
        onBeforeRender: () => new Promise(r => setTimeout(r, 2000)),
      },
      {
        // → tell Vite’s SSR build: don’t try to bundle react-bootstrap yourself
        ssr: {
          external: ['react-bootstrap']
        },
        // ensure .js/.jsx imports resolve properly
        resolve: {
          extensions: ['.mjs', ' .js', '.jsx', '.ts', '.tsx', '.json']
        }
      }
    ),
  ],
})
