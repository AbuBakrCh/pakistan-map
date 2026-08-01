import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  root: '.',
  json: {
    // The geography bundle is ~2 MB and is imported, not fetched (D19). Emitted as a
    // `JSON.parse` of a string literal it parses several times faster than the equivalent
    // object literal the bundler would otherwise inline, which is most of the page's startup.
    stringify: true,
  },
  test: {
    // Agent worktrees live under `.claude/worktrees/` and carry their own copy of every test.
    // Left in, `npm test` runs the suite once per in-flight worktree and reports the total, so
    // a count that should be a fixed property of the artifact drifts with whatever happens to
    // be checked out. CI never sees this — there are no worktrees there — which is exactly why
    // it has to be excluded here rather than noticed later.
    // Extending the defaults rather than replacing them — `exclude` overwrites, and spelling
    // out a shorter list here would quietly re-collect `.git/` and the config files.
    exclude: [...configDefaults.exclude, '.claude/worktrees/**'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // The bundle is committed geometry, not code that grew: a size warning on it is noise.
    chunkSizeWarningLimit: 3000,
  },
});
