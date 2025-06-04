import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import prerender from 'vite-prerender-plugin';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),

    prerender({
      // Folder where Vite will output built files:
      staticDir: path.join(__dirname, 'dist'),

      // List of routes to prerender so Googlebot sees content + <ins> immediately:
      routes: [
        '/',                 // Home
        '/garage',
        '/intro',
        '/na-miata',
        '/na-blog',
        '/msm-blog',
        '/nd-blog',
        '/c8-blog',
        '/youtube',
        '/suspension',
        '/fireball',
        '/gallery',
        '/msm-gallery',
        '/nc-eastcoast15',
        '/nc-yellowstone15',
        '/nd-hillcountry',
        '/c8-autox',
      ],
    }),
  ],

  // If you use a custom base path, adjust this. Otherwise leave as '/'.
  base: '/',
});
