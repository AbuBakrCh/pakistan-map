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
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Socket } from 'node:net';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const LIB = resolve(ROOT, 'scripts/lib');
/**
 * `src/` is scanned as well as `scripts/lib/`, and matters more.
 *
 * The pipeline libraries were the whole import surface when this file was written; the renderer
 * landed after it, and the scan went on covering only the half where a stray `fetch` would have
 * been least consequential. D19 is a claim about the *runtime*: the bundle is baked and
 * committed so the page makes zero network calls, so `src/bundle.ts` and `src/map.ts` are
 * exactly the files the offline property is about. Directories, not a file list, so a new
 * module is covered by existing.
 */
const SRC = resolve(ROOT, 'src');

const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

/** Every `.ts` under a directory, at any depth — `src/` has a `lib/` under it. */
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });

/**
 * This file is excluded from its own scan, and is the only file that ever should be: it names
 * `node:net` in order to take the socket layer away below. Every other exclusion would be the
 * scan being talked out of its own finding.
 */
const sourceFiles = [...walk(LIB), ...walk(SRC)].filter((f) => !f.endsWith('scripts/lib/seam.test.ts'));

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
    // The suite's import surface is `scripts/lib` and `src` plus committed JSON — both
    // directories entire, so this is exhaustive rather than a spot check.
    const offenders = sourceFiles.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return NETWORK_PRIMITIVES.filter(([, pattern]) => pattern.test(source)).map(
        ([primitive]) => `${relative(ROOT, file)} uses ${primitive}`,
      );
    });
    expect(offenders).toEqual([]);
  });

  it('scans the renderer, which is where the offline claim is actually about', () => {
    // Guards the guard. The scan silently covered only `scripts/lib` once `src/` existed, and
    // nothing went red — a scan that has stopped looking at the right directory passes exactly
    // as loudly as one that looked and found nothing.
    const scanned = sourceFiles.map((f) => relative(ROOT, f));
    expect(scanned).toContain('src/bundle.ts');
    expect(scanned).toContain('src/map.ts');
  });

  it('confines the network to the one script whose job is the network', () => {
    // `fetch-osm.ts` exists precisely so that network flakiness cannot contaminate anything
    // else (the pipeline is split by failure mode). It follows that nothing under test may
    // import it — importing it is how its Overpass calls would arrive in the suite by accident.
    expect(NETWORK_PRIMITIVES.some(([, p]) => p.test(read('scripts/fetch-osm.ts')))).toBe(true);
    for (const file of sourceFiles) {
      expect(readFileSync(file, 'utf8'), relative(ROOT, file)).not.toMatch(/fetch-osm/);
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
      'data/bundle/scenarios.json',
      'data/bundle/unit-outlines.json',
      'data/bundle/adjacency.json',
      'data/reference/post-census-district-folds.json',
    ]) {
      expect(tracked, input).toContain(input);
    }
  });

  it('reads every artifact with the socket layer taken away', () => {
    // The static scan says no module names a network primitive; this says the artifacts load
    // when there is no socket to open at all, which also covers anything reached indirectly.
    const connect = Socket.prototype.connect;
    Socket.prototype.connect = function fail(): never {
      throw new Error('the bundle test seam opened a socket');
    } as unknown as typeof connect;
    try {
      for (const artifact of [
        'data/bundle/geography.topojson.json',
        'data/bundle/statistics.json',
        'data/bundle/scenarios.json',
        'data/bundle/unit-outlines.json',
        'data/bundle/adjacency.json',
      ])
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
