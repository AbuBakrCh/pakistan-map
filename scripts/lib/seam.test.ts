/**
 * Assertions about the test seam itself, rather than about what it measures.
 *
 * `bundle.test.ts` and `statistics.test.ts` check the committed artifacts. This file checks the
 * two properties that make those checks trustworthy and repeatable: that the suite reaches the
 * network for nothing, and that there is one command which runs all of it — in CI and on a
 * laptop alike.
 *
 * Both are easy to hold today and easy to lose silently. A future test that reaches Overpass
 * "just to confirm the relation is still there" turns a deterministic suite into a flaky one
 * and makes a red build ambiguous: upstream edit, rate limit, or real defect? Given that the
 * whole point of committing the bundle is that boundary changes arrive as dated diffs, a suite
 * that consults upstream at test time is checking the wrong artifact.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Socket } from 'node:net';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const LIB = resolve(ROOT, 'scripts/lib');

const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');
/**
 * This file is excluded from its own scan, and is the only file that ever should be: it names
 * `node:net` in order to take the socket layer away below. Every other exclusion would be the
 * scan being talked out of its own finding.
 */
const libFiles = readdirSync(LIB).filter((f) => f.endsWith('.ts') && f !== 'seam.test.ts');

/**
 * Everything that opens a socket from Node, by the name it is reached under. Deliberately
 * spelled as source patterns rather than as runtime probes: the seam has to stay offline on a
 * machine that happens to have no network, where a runtime probe would pass for the wrong
 * reason.
 */
const NETWORK_PRIMITIVES: readonly (readonly [string, RegExp])[] = [
  ['fetch()', /(^|[^.\w])fetch\s*\(/],
  ['node:http', /['"]node:https?['"]/],
  ['node:net', /['"]node:(net|tls|dgram)['"]/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['WebSocket', /\bnew WebSocket\b/],
];

describe('test seam isolation', () => {
  it('keeps every module the suite loads free of anything that opens a socket', () => {
    // The suite's whole import surface is `scripts/lib` plus committed JSON, so scanning this
    // directory is exhaustive rather than a spot check.
    const offenders = libFiles.flatMap((file) => {
      const source = read(`scripts/lib/${file}`);
      return NETWORK_PRIMITIVES.filter(([, pattern]) => pattern.test(source)).map(
        ([primitive]) => `${file} uses ${primitive}`,
      );
    });
    expect(offenders).toEqual([]);
  });

  it('confines the network to the one script whose job is the network', () => {
    // `fetch-osm.ts` exists precisely so that network flakiness cannot contaminate anything
    // else (the pipeline is split by failure mode). It follows that nothing under test may
    // import it — importing it is how its Overpass calls would arrive in the suite by accident.
    expect(NETWORK_PRIMITIVES.some(([, p]) => p.test(read('scripts/fetch-osm.ts')))).toBe(true);
    for (const file of libFiles) {
      expect(read(`scripts/lib/${file}`), file).not.toMatch(/fetch-osm/);
    }
  });

  it('reads only inputs that are committed, so a fresh clone can run offline', () => {
    // The artifacts under test are committed on purpose (D19). If one were gitignored the
    // suite would still pass here — on a working copy that had built it — and fail for
    // everyone else, which is the failure mode this catches.
    const tracked = execFileSync('git', ['ls-files', 'data/'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    for (const input of [
      'data/bundle/geography.topojson.json',
      'data/bundle/statistics.json',
      'data/reference/post-census-district-folds.json',
    ]) {
      expect(tracked, input).toContain(input);
    }
  });

  it('reads both artifacts with the socket layer taken away', () => {
    // The static scan says no module names a network primitive; this says the artifacts load
    // when there is no socket to open at all, which also covers anything reached indirectly.
    const connect = Socket.prototype.connect;
    Socket.prototype.connect = function fail(): never {
      throw new Error('the bundle test seam opened a socket');
    } as unknown as typeof connect;
    try {
      for (const artifact of ['data/bundle/geography.topojson.json', 'data/bundle/statistics.json'])
        expect(Object.keys(JSON.parse(read(artifact))).length).toBeGreaterThan(0);
    } finally {
      Socket.prototype.connect = connect;
    }
  });
});

describe('test seam entry point', () => {
  const packageJson = JSON.parse(read('package.json')) as {
    scripts: Record<string, string | undefined>;
  };

  it('runs the whole suite from one command, once, with no watcher left running', () => {
    // `vitest` alone watches and never exits, which in CI is a hung job rather than a red one.
    expect(packageJson.scripts['test']).toBe('vitest run');
    expect(packageJson.scripts['typecheck']).toBe('tsc --noEmit');
  });

  it('runs that same command in CI, on every push and every pull request', () => {
    // Asserted against the workflow rather than trusted, because a workflow that quietly stops
    // running the suite looks exactly like a workflow that runs it and passes.
    const workflow = read('.github/workflows/ci.yml');
    expect(workflow).toMatch(/on:\s*\n\s*push:/);
    expect(workflow).toMatch(/pull_request:/);
    expect(workflow).toMatch(/npm run typecheck/);
    expect(workflow).toMatch(/npm test/);
    // Pinned, not floating: `node-version: latest` would make a green build unreproducible.
    expect(workflow).toMatch(/node-version: '\d+'/);
  });

  it('documents that command where the project spec documents its other commands', () => {
    const spec = read('CLAUDE.md');
    expect(spec).toMatch(/### Test seam/);
    expect(spec).toMatch(/npm test/);
  });
});
