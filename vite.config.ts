import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  json: {
    // The geography bundle is ~2 MB and is imported, not fetched (D19). Emitted as a
    // `JSON.parse` of a string literal it parses several times faster than the equivalent
    // object literal the bundler would otherwise inline, which is most of the page's startup.
    stringify: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // The bundle is committed geometry, not code that grew: a size warning on it is noise.
    chunkSizeWarningLimit: 3000,
  },
});
