import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


export default defineConfig({
  plugins: [
    react(),
    // …any other plugins you originally had
  ],
  base: '/',
})
