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
      // Point at the same "dist" folder that Vite will emit
      staticDir: path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist'),

      // All of your routes exactly as React Router sees them
      routes: [
        '/',
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

      // Instead of waiting for <main>, wait 2 seconds (2000 ms) for React to mount:
      renderAfterTime: 2000,
    }),
  ],
  base: '/',
});
