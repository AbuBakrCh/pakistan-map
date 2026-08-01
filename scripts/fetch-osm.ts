/**
 * Fetch Pakistan's boundaries and coastline from OSM Overpass into a committed raw cache.
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
 *   npm run build:data:fetch -- --source 6           # one source only
 *   npm run build:data:fetch -- --source coastline
 *   npm run build:data:fetch -- --dry-run            # validate, print counts, write nothing
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
 * One dataset we cache. `expectedMin` is a sanity floor, not a target: Overpass
 * happily returns a well-formed response with half the country missing, and the count
 * is the only signal that it did. Floors sit well below the counts actually in the committed
 * cache (39 divisions, 170 districts, 862 coastline ways) so that genuine upstream churn does
 * not fail the build, while a grossly truncated response does.
 */
export interface SourceSpec {
  /** What `--source` takes. */
  readonly key: string;
  readonly name: string;
  readonly file: string;
  readonly query: string;
  /** Which OSM primitive carries the geometry — relations for boundaries, ways for coastline. */
  readonly elementType: 'relation' | 'way';
  readonly expectedMin: number;
}

/**
 * Selects by the relation's own tags rather than by `area`, because Pakistan's area
 * relation is itself occasionally unbuildable on a given mirror. Bounding-box filtering
 * pulls in strays from India and Afghanistan by design — removing them is a downstream
 * concern (see the filtering step), and doing it here would make the cache a judgement
 * rather than a record.
 */
function adminQuery(adminLevel: number): string {
  return [
    '[out:json][timeout:280];',
    'area["ISO3166-1"="PK"]["admin_level"="2"]->.pk;',
    `relation(area.pk)["boundary"="administrative"]["admin_level"="${adminLevel}"];`,
    'out geom;',
  ].join('\n');
}

/**
 * The coastline is fetched by bounding box, not by Pakistan's area, and the box reaches
 * well into Iran and India **on purpose**.
 *
 * `natural=coastline` is a way network, not a relation: there is no "Pakistan's coastline"
 * object to ask for. Pakistan's own stretch of it does not close — it runs from the Iranian
 * border at Gwatar Bay to Sir Creek and stops. Assembling a land polygon out of it (see
 * `scripts/lib/coastline.ts`) means closing the chain against an extent, and that only works
 * if the chain runs clear past the ends of Pakistan's land rather than stopping level with
 * them. The overhang into neighbouring coasts is what gives it room to do that.
 *
 * South/west/north/east, as Overpass orders a bbox filter.
 */
const COASTLINE_BBOX = [22.0, 59.0, 26.5, 70.0] as const;

const SOURCES: readonly SourceSpec[] = [
  // Provinces and territories. Fetched for one reason: Islamabad Capital Territory has no
  // division and no district relation, so without this level the map has a hole where the
  // capital should be (#3). Province outlines themselves are derived by dissolving districts,
  // which keeps the tiers guaranteed consistent.
  {
    key: '4',
    name: 'province',
    file: 'osm-admin-level-4.json',
    query: adminQuery(4),
    elementType: 'relation',
    expectedMin: 5,
  },
  {
    key: '5',
    name: 'division',
    file: 'osm-admin-level-5.json',
    query: adminQuery(5),
    elementType: 'relation',
    expectedMin: 25,
  },
  {
    key: '6',
    name: 'district',
    file: 'osm-admin-level-6.json',
    query: adminQuery(6),
    elementType: 'relation',
    expectedMin: 120,
  },
  {
    key: 'coastline',
    name: 'coastline',
    file: 'osm-coastline.json',
    query: [
      '[out:json][timeout:280];',
      `way["natural"="coastline"](${COASTLINE_BBOX.join(',')});`,
      'out geom;',
    ].join('\n'),
    elementType: 'way',
    expectedMin: 500,
  },
];

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
 * Does this element carry coordinates? A way holds them directly; a relation holds them on
 * its way members.
 */
function hasGeometry(element: unknown): boolean {
  const { geometry, members } = element as { geometry?: unknown; members?: unknown };
  if (Array.isArray(geometry)) return true;
  return (
    Array.isArray(members) &&
    members.some(
      (member) =>
        typeof member === 'object' &&
        member !== null &&
        Array.isArray((member as { geometry?: unknown }).geometry),
    )
  );
}

/**
 * Parses and validates one Overpass response body. Throws on anything that must not
 * reach the cache: HTML error pages, non-object JSON, a missing `elements` array, an
 * Overpass `remark` (how it reports timeouts and runtime errors while still returning
 * HTTP 200 with partial data), or a count below the source's sanity floor.
 */
export function validate(body: string, source: SourceSpec): OverpassResponse {
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

  const wanted = response.elements.filter(
    (element) =>
      typeof element === 'object' &&
      element !== null &&
      (element as { type?: unknown }).type === source.elementType,
  );

  if (wanted.length < source.expectedMin) {
    throw new FetchFailure(
      `only ${wanted.length} ${source.name} ${source.elementType}s returned, ` +
        `expected at least ${source.expectedMin} — treating as truncated`,
    );
  }

  const withoutGeometry = wanted.filter((element) => !hasGeometry(element));

  // A mirror that drops geometry wholesale, or answers with `out body` semantics, strips
  // it from essentially everything — that is a bad response and must not be cached. One
  // or two elements without geometry is a different thing entirely: a genuinely broken
  // relation upstream in OSM. Failing on those would make the fetch hostage to any single
  // mapper's mistake, so they are reported and left for the filtering step.
  if (withoutGeometry.length > wanted.length * GEOMETRY_FAILURE_RATIO) {
    throw new FetchFailure(
      `${withoutGeometry.length} of ${wanted.length} ${source.elementType}s came back ` +
        'without geometry — the mirror is not returning geometry',
    );
  }

  for (const element of withoutGeometry) {
    const { id, tags } = element as { id?: number; tags?: Record<string, string> };
    console.warn(
      `    note: ${source.elementType} ${id} (${tags?.['name'] ?? 'unnamed'}) has no geometry ` +
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
 * Fetches one source, retrying each mirror with linear backoff before moving to the
 * next. Only a validated response is returned; every failure mode is exhausted across all
 * mirrors before the script gives up.
 */
async function fetchSource(source: SourceSpec): Promise<OverpassResponse> {
  const failures: string[] = [];

  for (const mirror of MIRRORS) {
    for (let attempt = 1; attempt <= ATTEMPTS_PER_MIRROR; attempt += 1) {
      const host = new URL(mirror).host;
      console.log(
        `  → ${source.name} via ${host} (attempt ${attempt}/${ATTEMPTS_PER_MIRROR})`,
      );
      try {
        const body = await postOnce(mirror, source.query);
        const response = validate(body, source);
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
    `Could not fetch ${source.name} from any Overpass mirror.\n` +
      failures.map((line) => `  - ${line}`).join('\n'),
  );
}

/**
 * Counts the source's own elements — relations for the boundary sources, ways for the
 * coastline — and buckets them by admin_level so drift in either direction is visible in the
 * log. Coastline ways have no admin_level, so they all land in `untagged`; the count is the
 * only signal there.
 */
function summarise(
  response: OverpassResponse,
  source: SourceSpec,
): { elements: number; named: number; byAdminLevel: Map<string, number> } {
  let elements = 0;
  let named = 0;
  const byAdminLevel = new Map<string, number>();

  for (const element of response.elements) {
    if (
      typeof element !== 'object' ||
      element === null ||
      (element as { type?: unknown }).type !== source.elementType
    ) {
      continue;
    }
    elements += 1;
    const tags = (element as { tags?: Record<string, string> }).tags ?? {};
    if (tags['name']) named += 1;
    const key = tags['admin_level'] ?? 'untagged';
    byAdminLevel.set(key, (byAdminLevel.get(key) ?? 0) + 1);
  }

  return { elements, named, byAdminLevel };
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

function parseArgs(argv: readonly string[]): { sources: readonly SourceSpec[]; dryRun: boolean } {
  const dryRun = argv.includes('--dry-run');
  const index = argv.indexOf('--source');
  if (index === -1) return { sources: SOURCES, dryRun };

  const requested = argv[index + 1];
  const match = SOURCES.find((source) => source.key === requested);
  if (!match) {
    throw new Error(`--source must be one of ${SOURCES.map((s) => s.key).join(', ')}`);
  }
  return { sources: [match], dryRun };
}

async function main(): Promise<void> {
  const { sources, dryRun } = parseArgs(process.argv.slice(2));

  console.log('Fetching OSM administrative boundaries and coastline for Pakistan');
  console.log(`  cache: ${RAW_DIR}${dryRun ? '  (dry run — nothing will be written)' : ''}`);

  await mkdir(RAW_DIR, { recursive: true });

  const counts: string[] = [];

  for (const source of sources) {
    console.log(`\n${source.name} (${source.elementType}s)`);
    const response = await fetchSource(source);
    const { elements, named, byAdminLevel } = summarise(response, source);

    const breakdown = [...byAdminLevel.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([adminLevel, count]) => `admin_level=${adminLevel}: ${count}`)
      .join(', ');

    console.log(`    ${elements} ${source.elementType}s (${named} named) — ${breakdown}`);
    console.log(`    OSM base timestamp: ${response.osm3s?.timestamp_osm_base ?? 'unknown'}`);
    counts.push(`${source.name}: ${elements}`);

    if (!dryRun) {
      const path = resolve(RAW_DIR, source.file);
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
