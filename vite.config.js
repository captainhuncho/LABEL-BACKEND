import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Each build gets an id; the app compares it with /version.json to spot a newer deploy.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());

export default defineConfig({
  plugins: [react(), {
    name: 'imss-version',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) }); },
  }],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  server: { port: 5173, open: true },
});
