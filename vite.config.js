// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { ViteReactSSG } from 'vite-react-ssg';

export default defineConfig({
  base: '/',
  plugins: [
    react(),

    ViteReactSSG({
      // point to your SSR entry file that already lists out every route:
      entry: 'src/entry-ssr.jsx',

      // if you need to wait for ads to mount before snapshotting:
      onBeforeRender: () => new Promise((r) => setTimeout(r, 2000)),
    }),
  ],
});
