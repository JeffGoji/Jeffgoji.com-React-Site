// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  build: {
    // transpile optional chaining, nullish coalescing, etc. down to ES2015 so the JSDOM can parse it correctly for netlify.
    target: 'es2015'
  },
  plugins: [
    react()
  ],
  base: '/'
})
