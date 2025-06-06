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
      // Point at the exact dist folder that Vite outputs
      staticDir: path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist'),

      // List every React Router route exactly as you wrote <Route path="…">
      routes: [
        '/',             // Home
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

      // Remove ANY "selector" option. Instead, wait exactly 2000 ms:
      renderAfterTime: 2000,
    }),
  ],

  // Make sure base is "/"
  base: '/',
});
