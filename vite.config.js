import { defineConfig } from 'vite';

// base './' keeps asset URLs relative, so the build works on GitHub Pages (project sites) and any static host.
export default defineConfig({
  base: './',
  build: { target: 'esnext', chunkSizeWarningLimit: 4600 },
  server: { host: true },
});
