/**
 * Fetch Pakistan's administrative boundaries from OSM Overpass into a committed raw cache.
 *
 * Scope: network only. No filtering, no ICT injection, no geometry work, no census join —
 * those belong downstream. What lands in `data/raw/` is exactly what Overpass returned,
 * re-serialised, so that every later step has a stable, diffable, offline input.
 *
 * Overpass is rate-limited and periodically returns an HTML error page, a 429, or a
 * silently truncated result. Every one of those must fail loudly rather than overwrite a
 * good cache: the script writes only after a response has passed validation.
 *
 *   npm run build:data:fetch
 *   npm run build:data:fetch -- --level 6      # one level only
 *   npm run build:data:fetch -- --dry-run      # validate, print counts, write nothing
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = resolve(REPO_ROOT, 'data/raw');

/** Overpass instances, tried in order. Falling through all of them is a hard failure. */
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
] as const;

const ATTEMPTS_PER_MIRROR = 3;
const REQUEST_TIMEOUT_MS = 300_000;
const BACKOFF_BASE_MS = 5_000;

/** Fraction of relations that may lack geometry before the response is judged unusable. */
const GEOMETRY_FAILURE_RATIO = 0.1;

/**
 * An admin level we cache. `expectedMin` is a sanity floor, not a target: Overpass
 * happily returns a well-formed response with half the country missing, and the count
 * is the only signal that it did. Floors sit well below the real counts (~39 divisions,
 * ~165 districts) so that genuine upstream churn does not fail the build, while a
 * grossly truncated response does.
 */
export interface LevelSpec {
  readonly adminLevel: 5 | 6;
  readonly name: string;
  readonly file: string;
  readonly expectedMin: number;
}

const LEVELS: readonly LevelSpec[] = [
  { adminLevel: 5, name: 'division', file: 'osm-admin-level-5.json', expectedMin: 25 },
  { adminLevel: 6, name: 'district', file: 'osm-admin-level-6.json', expectedMin: 120 },
];

/**
 * Selects by the relation's own tags rather than by `area`, because Pakistan's area
 * relation is itself occasionally unbuildable on a given mirror. Bounding-box filtering
 * pulls in strays from India and Afghanistan by design — removing them is a downstream
 * concern (see the filtering step), and doing it here would make the cache a judgement
 * rather than a record.
 */
function buildQuery(adminLevel: number): string {
  return [
    '[out:json][timeout:280];',
    'area["ISO3166-1"="PK"]["admin_level"="2"]->.pk;',
    `relation(area.pk)["boundary"="administrative"]["admin_level"="${adminLevel}"];`,
    'out geom;',
  ].join('\n');
}

/** Shape of an Overpass JSON response, to the extent we depend on it. */
interface OverpassResponse {
  version?: number;
  generator?: string;
  osm3s?: { timestamp_osm_base?: string; copyright?: string };
  elements: unknown[];
  remark?: string;
}

class FetchFailure extends Error {}

/**
 * Parses and validates one Overpass response body. Throws on anything that must not
 * reach the cache: HTML error pages, non-object JSON, a missing `elements` array, an
 * Overpass `remark` (how it reports timeouts and runtime errors while still returning
 * HTTP 200 with partial data), or a count below the level's sanity floor.
 */
export function validate(body: string, level: LevelSpec): OverpassResponse {
  const head = body.trimStart().slice(0, 200);
  if (!head.startsWith('{')) {
    throw new FetchFailure(
      `response is not JSON (starts with ${JSON.stringify(head.slice(0, 80))})`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    // Overpass truncates mid-stream when it hits a memory or time limit; the body looks
    // like JSON at the head and simply stops. That surfaces here as a parse error.
    throw new FetchFailure(
      `response is truncated or malformed JSON: ${(error as Error).message}`,
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new FetchFailure('response JSON is not an object');
  }

  const response = parsed as Partial<OverpassResponse>;

  if (typeof response.remark === 'string' && response.remark.length > 0) {
    throw new FetchFailure(`Overpass reported: ${response.remark}`);
  }

  if (!Array.isArray(response.elements)) {
    throw new FetchFailure('response has no `elements` array');
  }

  const relations = response.elements.filter(
    (element) =>
      typeof element === 'object' &&
      element !== null &&
      (element as { type?: unknown }).type === 'relation',
  );

  if (relations.length < level.expectedMin) {
    throw new FetchFailure(
      `only ${relations.length} admin_level=${level.adminLevel} relations returned, ` +
        `expected at least ${level.expectedMin} — treating as truncated`,
    );
  }

  const withoutGeometry = relations.filter((relation) => {
    const members = (relation as { members?: unknown }).members;
    return (
      !Array.isArray(members) ||
      !members.some(
        (member) =>
          typeof member === 'object' &&
          member !== null &&
          Array.isArray((member as { geometry?: unknown }).geometry),
      )
    );
  });

  // A mirror that drops geometry wholesale, or answers with `out body` semantics, strips
  // it from essentially everything — that is a bad response and must not be cached. One
  // or two relations without way members is a different thing entirely: a genuinely
  // broken relation upstream in OSM. Failing on those would make the fetch hostage to
  // any single mapper's mistake, so they are reported and left for the filtering step.
  if (withoutGeometry.length > relations.length * GEOMETRY_FAILURE_RATIO) {
    throw new FetchFailure(
      `${withoutGeometry.length} of ${relations.length} relations came back without ` +
        'member geometry — the mirror is not returning geometry',
    );
  }

  for (const relation of withoutGeometry) {
    const { id, tags } = relation as { id?: number; tags?: Record<string, string> };
    console.warn(
      `    note: relation ${id} (${tags?.['name'] ?? 'unnamed'}) has no member geometry ` +
        '— broken upstream in OSM, passed through to the cache as-is',
    );
  }

  return response as OverpassResponse;
}

async function postOnce(mirror: string, query: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(mirror, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Overpass asks for a contactable UA; anonymous bulk clients get throttled first.
        'User-Agent': 'pakistan-map build:data:fetch (github.com/AbuBakrCh/pakistan-map)',
        Accept: 'application/json',
      },
      body: new URLSearchParams({ data: query }),
      signal: controller.signal,
    });

    const body = await response.text();

    if (!response.ok) {
      throw new FetchFailure(
        `HTTP ${response.status} ${response.statusText}: ${body.trim().slice(0, 200)}`,
      );
    }

    return body;
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

/**
 * Fetches one admin level, retrying each mirror with linear backoff before moving to the
 * next. Only a validated response is returned; every failure mode is exhausted across all
 * mirrors before the script gives up.
 */
async function fetchLevel(level: LevelSpec): Promise<OverpassResponse> {
  const query = buildQuery(level.adminLevel);
  const failures: string[] = [];

  for (const mirror of MIRRORS) {
    for (let attempt = 1; attempt <= ATTEMPTS_PER_MIRROR; attempt += 1) {
      const host = new URL(mirror).host;
      console.log(
        `  → admin_level=${level.adminLevel} via ${host} (attempt ${attempt}/${ATTEMPTS_PER_MIRROR})`,
      );
      try {
        const body = await postOnce(mirror, query);
        const response = validate(body, level);
        console.log(`    ok — ${(body.length / 1_048_576).toFixed(1)} MiB from ${host}`);
        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`    failed: ${message}`);
        failures.push(`${host} attempt ${attempt}: ${message}`);
        if (attempt < ATTEMPTS_PER_MIRROR) {
          const wait = BACKOFF_BASE_MS * attempt;
          console.warn(`    retrying in ${wait / 1000}s`);
          await sleep(wait);
        }
      }
    }
  }

  throw new Error(
    `Could not fetch admin_level=${level.adminLevel} from any Overpass mirror.\n` +
      failures.map((line) => `  - ${line}`).join('\n'),
  );
}

/** Counts relations by admin_level, so drift in either direction is visible in the log. */
function summarise(response: OverpassResponse): {
  relations: number;
  named: number;
  byLevel: Map<string, number>;
} {
  let relations = 0;
  let named = 0;
  const byLevel = new Map<string, number>();

  for (const element of response.elements) {
    if (
      typeof element !== 'object' ||
      element === null ||
      (element as { type?: unknown }).type !== 'relation'
    ) {
      continue;
    }
    relations += 1;
    const tags = (element as { tags?: Record<string, string> }).tags ?? {};
    if (tags['name']) named += 1;
    const key = tags['admin_level'] ?? 'untagged';
    byLevel.set(key, (byLevel.get(key) ?? 0) + 1);
  }

  return { relations, named, byLevel };
}

/**
 * Serialises the response with one element per line. Still ordinary JSON, but a
 * boundary edit then shows up as one changed line naming one district, instead of a
 * single multi-megabyte line that git cannot review.
 */
function serialise(response: OverpassResponse): string {
  const { elements, ...envelope } = response;
  const head = JSON.stringify(envelope).replace(/}$/, '');
  const prefix = head === '{' ? '{' : `${head},`;
  const lines = elements.map((element) => JSON.stringify(element));
  return `${prefix}\n"elements":[\n${lines.join(',\n')}\n]}\n`;
}

function parseArgs(argv: readonly string[]): { levels: readonly LevelSpec[]; dryRun: boolean } {
  const dryRun = argv.includes('--dry-run');
  const levelIndex = argv.indexOf('--level');
  if (levelIndex === -1) return { levels: LEVELS, dryRun };

  const requested = Number(argv[levelIndex + 1]);
  const match = LEVELS.find((level) => level.adminLevel === requested);
  if (!match) {
    throw new Error(`--level must be one of ${LEVELS.map((l) => l.adminLevel).join(', ')}`);
  }
  return { levels: [match], dryRun };
}

async function main(): Promise<void> {
  const { levels, dryRun } = parseArgs(process.argv.slice(2));

  console.log('Fetching OSM administrative boundaries for Pakistan');
  console.log(`  cache: ${RAW_DIR}${dryRun ? '  (dry run — nothing will be written)' : ''}`);

  await mkdir(RAW_DIR, { recursive: true });

  const counts: string[] = [];

  for (const level of levels) {
    console.log(`\n${level.name} boundaries (admin_level=${level.adminLevel})`);
    const response = await fetchLevel(level);
    const { relations, named, byLevel } = summarise(response);

    const breakdown = [...byLevel.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([adminLevel, count]) => `admin_level=${adminLevel}: ${count}`)
      .join(', ');

    console.log(`    ${relations} relations (${named} named) — ${breakdown}`);
    console.log(`    OSM base timestamp: ${response.osm3s?.timestamp_osm_base ?? 'unknown'}`);
    counts.push(`${level.name} (admin_level=${level.adminLevel}): ${relations}`);

    if (!dryRun) {
      const path = resolve(RAW_DIR, level.file);
      await writeFile(path, serialise(response), 'utf8');
      console.log(`    wrote ${path}`);
    }
  }

  console.log('\nFeature counts');
  for (const line of counts) console.log(`  ${line}`);
  console.log(
    '\nRaw cache is committed on purpose: every boundary change should be a reviewable diff.',
  );
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href;

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error('\nfetch-osm failed.\n');
    console.error(error instanceof Error ? error.message : String(error));
    console.error(
      '\nNothing was written — the existing cache (if any) is untouched.\n' +
        'Overpass mirrors are frequently rate-limited; wait a few minutes and retry.',
    );
    process.exitCode = 1;
  });
}
