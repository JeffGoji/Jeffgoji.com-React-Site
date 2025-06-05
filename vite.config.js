// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { htmlPrerender } from 'vite-plugin-html-prerender';
import path from 'path';
import { fileURLToPath } from 'url';

export default defineConfig({
  plugins: [
    react(),

    htmlPrerender({
      staticDir: path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist'),

      // Prerender each route so crawlers see content + <ins> together:
      routes: [
        '/',                 // Home
        '/garage',
        '/intro',
        '/na-blog',
        '/msm-blog',
        '/nd-blog',
        '/c8-blog',
        '/suspension',
        '/gallery',
        '/msm-gallery',
        '/nc-eastcoast15',
        '/nc-yellowstone15',
        '/nd-hillcountry',
        '/c8-autox',
      ],

      // (Optional) Wait for a selector before snapshotting (e.g. <main>)
      // selector: 'main'
    }),
  ],

  // If you have a custom base, adjust; otherwise '/' is fine.
  base: '/',
});
