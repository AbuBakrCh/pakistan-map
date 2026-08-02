/**
 * Bake the map's geographic context: neighbour silhouettes, city dots and the Durand footnote (#8).
 *
 *   npm run build:data:context
 *
 * A **separate artifact from `geography.topojson.json`, on purpose.** That bundle draws three
 * tiers and a ceasefire line out of one shared arc set, and the whole of its integrity rests on
 * arcs being shared — `src/lib/line-of-control.test.ts` asks an exact set question on arc indices.
 * Nothing here shares an edge with anything in there: Afghanistan's outline is OSM's Afghan
 * relation, not Pakistan's, and the two are separately maintained upstream. Putting them in one
 * topology would renumber every arc in the country to add a background, and would invite a reader
 * to believe the two sides of a border are one line, which is exactly the thing this app is
 * careful about.
 *
 * So they are two files, and the seam between them is visible: the silhouettes are drawn *under*
 * the land, they take no pointer events, and nothing in the app ever asks them a question.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoArea, geoContains } from 'd3';
import { quantize } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';
import {
  BOUNDARY_NOTES,
  CONTEXT_EXTENT,
  NEIGHBOURS,
  silhouetteOf,
} from './lib/neighbours.ts';
import { ROSTER } from './lib/roster.ts';
import { thresholdFor } from './lib/simplify.ts';
import { type FirstLevelRelation, type SeatNode, resolveSeats } from './lib/seats.ts';
import type { Position } from './lib/rings.ts';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const RAW_DIR = resolve(ROOT, 'data/raw');
const OUT_FILE = resolve(ROOT, 'data/bundle/context.topojson.json');

/**
 * Coarser than the country's own quantization (1e5) because the box is three times as wide and
 * because nothing here is ever measured. 1e4 over 56° of longitude is about 600 m, which is under
 * a pixel until roughly 12× zoom and invisible in a fill that is barely off the paper.
 *
 * Applied **after** simplification and not before, which is the opposite order from the geography
 * build. That build quantizes first because it holds only polygons, and `presimplify` restores
 * absolute coordinates for the arcs it weights. It does not touch *point* geometries — so a city
 * quantized on the way in comes out the other side still holding its grid index, and every dot
 * lands in the Bay of Bengal. Quantizing last is the only order under which both objects survive.
 */
const QUANTIZATION = 1e4;

/**
 * Fraction of points kept. Far more aggressive than the country's 0.3, and the reason is what the
 * silhouettes are: an unlabelled tint behind the map. The one place the coarseness could show is
 * the border with Pakistan, where OSM's Afghan relation and OSM's Pakistani districts run along
 * the same ground and this file simplifies one of them and not the other — so at deep zoom the
 * two disagree by a few hundred metres. It is drawn *under* the land, so a disagreement can only
 * ever show as a hairline of paper between two nearly-identical tones, never as sea drawn as land
 * or a country drawn over Pakistan. Tuned against that, not against fidelity.
 */
const SIMPLIFY_RETAIN = 0.04;

const SOURCE_URLS = {
  neighbours:
    'https://overpass-api.de/api/interpreter — boundary=administrative, admin_level=2, ' +
    'ISO3166-1 in {AF, CN, IN, IR} (OpenStreetMap, ODbL)',
  seats:
    'https://overpass-api.de/api/interpreter — the admin_centre node of each Pakistani ' +
    'admin_level=4 relation (OpenStreetMap, ODbL)',
} as const;

interface RawFile {
  readonly elements: readonly {
    readonly id: number;
    readonly lat?: number;
    readonly lon?: number;
    readonly tags?: Record<string, string>;
    readonly members?: readonly {
      type: string;
      role?: string;
      ref?: number;
      geometry?: { lat: number; lon: number }[];
    }[];
  }[];
  readonly osm3s?: { readonly timestamp_osm_base?: string };
}

const readRaw = (name: string): RawFile =>
  JSON.parse(readFileSync(resolve(RAW_DIR, `osm-${name}.json`), 'utf8'));

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

const km2 = (coordinates: Position[][][]): number =>
  geoArea({ type: 'MultiPolygon', coordinates } as never) * 6371 * 6371;

function main(): void {
  console.log('Baking the map context: neighbour silhouettes and city dots');

  const neighbours = readRaw('neighbours');
  const provinces = readRaw('admin-level-4');
  const centres = readRaw('admin-centres');

  // ---- 1. The four silhouettes ---------------------------------------------------------------
  const features = NEIGHBOURS.map((spec) => {
    const element = neighbours.elements.find((candidate) => candidate.tags?.['ISO3166-1'] === spec.iso);
    if (element === undefined) {
      fail(
        `No admin_level=2 relation in the cache carries ISO3166-1=${spec.iso}, so ${spec.name} ` +
          `cannot be drawn. Pakistan borders it either way — a missing silhouette is upstream ` +
          `having moved, not a country having gone.`,
      );
    }

    const { polygons, unclosed } = silhouetteOf(element.members ?? [], CONTEXT_EXTENT);
    if (unclosed > 0) {
      fail(
        `${unclosed} ring(s) of ${spec.name} could not be stitched shut, so it would draw torn. ` +
          `A silhouette with a hole in it reads as a second country, which is worse than no ` +
          `silhouette at all.`,
      );
    }
    if (polygons.length === 0) {
      fail(
        `${spec.name} clipped away to nothing against the context extent. It faces ` +
          `${spec.faces}, so either the extent has moved off Pakistan or the relation is empty.`,
      );
    }

    const feature = {
      type: 'Feature' as const,
      properties: { iso: spec.iso, name: spec.name, faces: spec.faces },
      geometry: { type: 'MultiPolygon' as const, coordinates: polygons },
    };

    // The point that makes the name on this silhouette falsifiable. Asserted here as well as in
    // the suite because the suite reads the *simplified* shape and this reads the exact one: a
    // country that never contained its own capital was mis-assembled, not over-simplified.
    if (!geoContains(feature as never, spec.inside as [number, number])) {
      fail(
        `The polygon drawn as ${spec.name} does not contain ${spec.inside.join(', ')}, which is ` +
          `inside ${spec.name}. Whatever this shape is, it is not the country it is named as.`,
      );
    }

    console.log(
      `  ${spec.name.padEnd(12)} ${polygons.length.toString().padStart(3)} piece(s), ` +
        `${Math.round(km2(polygons)).toLocaleString('en-US').padStart(11)} km² inside the extent`,
    );
    return feature;
  });

  // ---- 2. The seven dots ----------------------------------------------------------------------
  const relations: FirstLevelRelation[] = provinces.elements.map((element) => ({
    id: element.id,
    iso: element.tags?.['ISO3166-2'],
    members: element.members ?? [],
  }));
  const nodes: SeatNode[] = centres.elements
    .filter((element) => element.lat !== undefined && element.lon !== undefined)
    .map((element) => ({
      id: element.id,
      lat: element.lat as number,
      lon: element.lon as number,
      // The English name and only the English name, as everywhere else in this bundle: OSM's
      // primary `name` on all seven of these nodes is Urdu.
      name: element.tags?.['name:en'] ?? '',
    }));

  const { seats, missing, unnamed } = resolveSeats(
    relations,
    nodes,
    ROSTER.map((province) => ({ code: province.code, name: province.name, kind: province.kind })),
  );
  if (missing.length > 0) {
    fail(
      `${missing.length} first-level unit(s) have no admin_centre node in the cache: ` +
        `${missing.join(', ')}. The seven seats are the whole of the city set, so one absent is ` +
        `a province with no dot on it — which looks like a province whose capital is not major.`,
    );
  }
  if (unnamed.length > 0) {
    fail(
      `${unnamed.length} first-level unit(s) name an admin_centre the cache holds but which ` +
        `carries no English name: ${unnamed.map((u) => `${u.unit} (node ${u.node})`).join(', ')}. ` +
        `The seat is there and the query is right — OSM's primary name on it is not English, the ` +
        `way it is not on the AJK districts. That is an alias to add, not a query to change.`,
    );
  }

  console.log('\n  Seats');
  for (const seat of seats) {
    console.log(`    ${seat.name.padEnd(14)} ${seat.of} (${seat.kind}) — node ${seat.node}`);
  }

  // ---- 3. One topology, simplified hard --------------------------------------------------------
  const topo = topology(
    {
      neighbours: { type: 'FeatureCollection', features },
      cities: {
        type: 'FeatureCollection',
        features: seats.map((seat) => ({
          type: 'Feature',
          properties: { name: seat.name, of: seat.of, kind: seat.kind, osmNode: seat.node },
          geometry: { type: 'Point', coordinates: seat.position },
        })),
      },
    } as never,
  );
  const weighted = presimplify(topo as never);
  const simplified = quantize(
    simplify(weighted, thresholdFor(weighted, SIMPLIFY_RETAIN)) as never,
    QUANTIZATION,
  ) as unknown as Record<string, unknown>;

  simplified['provenance'] = {
    generated: new Date().toISOString(),
    sources: SOURCE_URLS,
    osmBaseTimestamp: {
      neighbours: neighbours.osm3s?.timestamp_osm_base,
      province: provinces.osm3s?.timestamp_osm_base,
      seats: centres.osm3s?.timestamp_osm_base,
    },
    neighbours: {
      method:
        'Each country fetched whole as its own admin_level=2 relation, stitched into closed ' +
        'polygons by the same stitcher the districts use, then intersected with a lon/lat ' +
        'extent. Fetched whole and cut down here rather than fetched near Pakistan and closed, ' +
        'because closing an open run of boundary into a shape means choosing which side of it ' +
        'is the country, and that choice has no source behind it. Drawn faint, unlabelled and ' +
        'under everything; they take no pointer events and carry no statistic. They are context ' +
        'for the boundary, not a subject of this map.',
      kashmir:
        'OSM draws these four as they are administered, not as they are claimed, and that is ' +
        'what is drawn here: India\'s silhouette stops at the same Line of Control this app ' +
        'draws dashed and covers Indian-administered Jammu and Kashmir, Ladakh and the Siachen ' +
        'area; China\'s covers Aksai Chin; neither reaches over Azad Jammu & Kashmir or ' +
        'Gilgit-Baltistan, and the four do not overlap one another. Nothing was cut away to ' +
        'achieve that — a boundary relation trimmed by this app would be this app adjudicating ' +
        'a claim. It is checked rather than assumed, because a neighbour drawn over ground the ' +
        'map calls Pakistan-administered would be a claim made by accident. The renderer does ' +
        'not depend on it either: silhouettes are drawn beneath Pakistan\'s land and filled ' +
        'flat, so an overlap could not show even if upstream introduced one.',
      extent: CONTEXT_EXTENT,
      countries: NEIGHBOURS.map(({ iso, name, faces }) => ({ iso, name, faces })),
      // Carried with the geometry rather than typed into the renderer, so the caveat cannot be
      // lost while the line it qualifies is still drawn — the same rule the ceasefire line's own
      // note follows in the geography bundle.
      boundaryNotes: BOUNDARY_NOTES,
    },
    cities: {
      criterion:
        'The seat of a first-level unit — the four provincial capitals, the federal capital and ' +
        'the capital of each of the two territories.',
      why:
        'Administrative and not demographic, because PBS publishes the 2023 census by district ' +
        'and a city is not a district: no city population exists at this vintage from this ' +
        'source, and ranking by an OpenStreetMap population tag would put a second lineage at an ' +
        'unstated vintage under a dot.',
      omits:
        'Faisalabad, Rawalpindi, Gujranwala and Multan are larger than three of the seven and ' +
        'are deliberately not drawn: a set mixing "capital" with "large" would be two criteria ' +
        'wearing one badge, and only one of them has a source.',
      badge: 'official',
      join:
        'By identity — the node the unit\'s own OSM boundary relation names as its admin_centre, ' +
        'not a place node whose name happens to match.',
      count: seats.length,
    },
    counts: {
      neighbours: features.length,
      cities: seats.length,
    },
  };

  mkdirSync(resolve(OUT_FILE, '..'), { recursive: true });
  writeFileSync(OUT_FILE, `${JSON.stringify(simplified)}\n`);
  const bytes = readFileSync(OUT_FILE).byteLength;
  console.log(
    `\n✓ ${OUT_FILE.replace(`${ROOT}/`, '')} — ${features.length} silhouettes, ` +
      `${seats.length} cities, ${(bytes / 1024).toFixed(0)} KiB`,
  );
}


main();
