import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Each build gets an id; the app compares it with /version.json to spot a newer deploy.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());

export default defineConfig({
  plugins: [react(), {
    // artist.imssrecords.com is served artist.html (vercel.json): the same app,
    // with its own tab title and link-preview text.
    name: 'imss-artist-page',
    enforce: 'post',
    generateBundle(_, bundle) {
      const page = bundle['index.html'];
      if (!page) return;
      const html = String(page.source)
        .replaceAll('IMSS Records — Label Operations', 'IMSS Records — For Artists')
        .replaceAll('IMSS Records Ops. Invite only.', 'The IMSS Records artist portal. Invite only.');
      this.emitFile({ type: 'asset', fileName: 'artist.html', source: html });
    },
  }, {
    name: 'imss-version',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) }); },
  }],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  // Hide the stack: no source maps in production builds.
  build: { sourcemap: false },
  server: { port: 5173, open: true },
});
