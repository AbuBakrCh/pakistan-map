/**
 * Normalize the raw OSM cache into bundle v0 (#3).
 *
 *   npm run build:data:normalize
 *
 * Turns three levels of raw Overpass output into one committed TopoJSON carrying the
 * province -> division -> district hierarchy at the 2023 census vintage (ADR-0001), with the
 * coastal districts clipped to OSM's own shoreline so they stop at the sea rather than running
 * out into territorial waters (#38).
 *
 * The three tiers are merged out of a *single shared arc set*, so a district boundary and the
 * division boundary running along it are literally the same arcs. That is the reason for using
 * TopoJSON rather than three GeoJSON layers: no slivers, no hairline gaps between tiers when
 * the map is zoomed, and simplification cannot pull two tiers apart because it moves the arc
 * they share.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoArea } from 'd3';
import { mergeArcs } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';
import {
  type CoastlineWay,
  type Extent,
  assembleLand,
  chainCoastline,
  clipToLand,
} from './lib/coastline.ts';
import { type OsmRelation, classifyDivision, reconcileDistricts } from './lib/reconcile.ts';
import {
  CENSUS_DISTRICT_COUNT,
  ICT_PSEUDO_DIVISION,
  ROSTER,
  ROSTER_DISTRICT_COUNT,
  kindOf,
  provinceOf,
} from './lib/roster.ts';
import { type Position, assemblePolygons } from './lib/rings.ts';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const RAW_DIR = resolve(ROOT, 'data/raw');
const OUT_FILE = resolve(ROOT, 'data/bundle/geography.topojson.json');

/** Islamabad Capital Territory: no division tier, no district relation. Injected by hand. */
const ICT_RELATION_ID = 358002;
const ICT_DISTRICT = 'Islamabad';

/**
 * Quantization grid. 1e5 over Pakistan's ~23 degrees of longitude is roughly 25 m — well below
 * what is visible at country zoom, and it is what makes the arc deltas compress.
 */
const QUANTIZATION = 1e5;

/**
 * Fraction of the original points kept by simplification. Tuned by eye at country zoom: the
 * acceptance bar is "small without visible degradation", and coastline detail around the Indus
 * delta is the first thing to go if this drops much further.
 */
const SIMPLIFY_RETAIN = 0.3;

/**
 * The rectangle the coastline is closed against to make a land polygon (#38).
 *
 * Two constraints, pulling in opposite directions. It must **contain every district with room
 * to spare**, or clipping would cut the country off at the box rather than at the sea — so the
 * build asserts that before it clips. And its south edge has to cross the coastline chain
 * cleanly: at 23°N the chain leaves the box exactly once, in Kori Creek south of Sir Creek,
 * whereas 23.4°N catches the creek's own jagged shore and cuts the chain four times. The
 * closure handles either, but one exit is the honest picture of one coast.
 *
 * 23°N is still comfortably south of Pakistan's southernmost land (~23.69°N, at Sir Creek).
 */
const LAND_EXTENT: Extent = { west: 60, south: 23, east: 79, north: 38.5 };

interface RawFile {
  readonly elements: readonly {
    readonly id: number;
    readonly tags?: Record<string, string>;
    readonly nodes?: readonly number[];
    readonly geometry?: readonly { lat: number; lon: number }[];
    readonly members?: readonly {
      type: string;
      role?: string;
      ref?: number;
      geometry?: { lat: number; lon: number }[];
    }[];
  }[];
  readonly osm3s?: { readonly timestamp_osm_base?: string };
}

const SOURCE_URLS = {
  boundaries: 'https://overpass-api.de/api/interpreter (OpenStreetMap, ODbL)',
  roster:
    'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf',
  // The PBS list above covers AJK and GB as *administrative* units (10 districts each), which is
  // what the roster needs. It is the census *results* that stop at 136 province/ICT districts —
  // which is why AJK and GB are drawn but never shaded (D25). These two verifications
  // corroborate the AJK and Balochistan sets independently and record what could not be
  // resolved; they are the residual provenance requirement from #5 and #6.
  ajkVerification: 'docs/research/ajk-district-set.md (AJK Bureau of Statistics, PBS)',
  balochistanVerification:
    'docs/research/balochistan-division-district-set.md (PBS Census-2023 Table 1)',
  karachiIdentities: 'https://www.wikidata.org — Q6367790, Q6367734, Q6367745, Q6367783',
  // The shoreline coastal districts are clipped to (#38). Deliberately the same source, the
  // same query, the same licence and the same base timestamp as the boundaries themselves —
  // Natural Earth's coastline was rejected precisely because it would have been a second
  // provenance lineage at a different vintage. See docs/adr/0001-single-vintage-2023-geometry.md.
  coastline:
    'https://overpass-api.de/api/interpreter — natural=coastline (OpenStreetMap, ODbL)',
  // What the clipped areas are measured against.
  publishedAreas:
    'PBS Census 2023 Table 1, by province — ' +
    'https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_1_sindh_districts.pdf, ' +
    'https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_1_balochistan_districts.pdf',
} as const;

function readRaw(name: string): RawFile {
  return JSON.parse(readFileSync(resolve(RAW_DIR, `osm-${name}.json`), 'utf8'));
}

const nameOf = (tags: Record<string, string> | undefined): string =>
  tags?.['name:en'] ?? tags?.['name'] ?? '';

interface UnitFeature {
  readonly type: 'Feature';
  readonly properties: { readonly district: string; readonly division: string; readonly province: string };
  geometry: { readonly type: 'MultiPolygon'; coordinates: Position[][][] };
}

/** Steradians -> km², the unit every published area figure this is measured against uses. */
const km2 = (coordinates: Position[][][]): number =>
  geoArea({ type: 'MultiPolygon', coordinates } as never) * 6371 * 6371;

interface Box {
  west: number;
  south: number;
  east: number;
  north: number;
}

function boundsOf(coordinates: Position[][][], into?: Box): Box {
  const box = into ?? { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
  for (const polygon of coordinates) {
    for (const ring of polygon) {
      for (const [lon, lat] of ring) {
        box.west = Math.min(box.west, lon);
        box.east = Math.max(box.east, lon);
        box.south = Math.min(box.south, lat);
        box.north = Math.max(box.north, lat);
      }
    }
  }
  return box;
}

const overlaps = (a: Box, b: Box): boolean =>
  a.west <= b.east && a.east >= b.west && a.south <= b.north && a.north >= b.south;

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function main(): void {
  console.log('Normalizing OSM boundaries into bundle v0');

  const provinces = readRaw('admin-level-4');
  const divisions = readRaw('admin-level-5');
  const districts = readRaw('admin-level-6');
  const coastline = readRaw('coastline');

  // ---- 1. Which OSM relation is which 2023 district ----------------------------------------
  const districtRelations: OsmRelation[] = districts.elements.map((e) => ({
    id: e.id,
    name: nameOf(e.tags),
  }));
  const reconciliation = reconcileDistricts(districtRelations);

  if (reconciliation.unclassified.length > 0) {
    fail(
      `${reconciliation.unclassified.length} OSM relation(s) matched no 2023 district and no ` +
        `fold rule. Every relation must be classified — add it to the roster, the fold table ` +
        `or the drop table in scripts/lib/roster.ts:\n` +
        reconciliation.unclassified.map((r) => `    ${r.id}  ${r.name}`).join('\n'),
    );
  }

  const missing = reconciliation.missing.filter((d) => d !== ICT_DISTRICT);
  if (missing.length > 0) {
    fail(`${missing.length} roster district(s) have no OSM geometry: ${missing.join(', ')}`);
  }

  console.log(
    `  districts: ${districtRelations.length} relations → ${new Set(reconciliation.assignments.values()).size} ` +
      `census districts (${reconciliation.folded.length} folded, ${reconciliation.dropped.length} dropped)`,
  );
  for (const { relation, reason } of reconciliation.dropped) {
    console.log(`    dropped ${relation.id} ${relation.name} — ${reason}`);
  }
  for (const { relation, into } of reconciliation.folded) {
    console.log(`    folded  ${relation.name} → ${into}`);
  }

  // ---- 2. Which division each district sits in ----------------------------------------------
  const foldedRelationIds = new Set(reconciliation.folded.map((f) => f.relation.id));

  /**
   * Only a district's *own* 2023 relation may decide its division. A post-census district was
   * often reassigned to a post-census division at the same time it was created — Talagang, split
   * from Chakwal, moved into Mianwali division — so letting a folded child vote would drag its
   * 2023 parent out of the division the census puts it in.
   *
   * Folded children are still used as a fallback, for the one case where the 2023 district has
   * no relation of its own: South Waziristan exists in OSM only as Upper and Lower.
   */
  const collectMemberships = (useFolded: boolean): Map<string, string> => {
    const found = new Map<string, string>();
    for (const element of divisions.elements) {
      const classified = classifyDivision({ id: element.id, name: nameOf(element.tags) });
      if (classified.kind !== 'unit' && classified.kind !== 'fold') continue;
      const divisionName = classified.name;

      for (const member of element.members ?? []) {
        if (member.type !== 'relation' || member.role !== 'subarea' || member.ref === undefined) {
          continue;
        }
        if (foldedRelationIds.has(member.ref) !== useFolded) continue;
        // Members that are not assigned districts are skipped by construction — this is what
        // filters out Nag Tehsil, an admin_level=7 relation sitting directly in Rakhshan.
        const district = reconciliation.assignments.get(member.ref);
        if (district === undefined) continue;

        const existing = found.get(district);
        if (!useFolded && existing !== undefined && existing !== divisionName) {
          fail(
            `${district} is claimed by two divisions (${existing} and ${divisionName}). ` +
              `Every district must resolve to exactly one division.`,
          );
        }
        if (existing === undefined) found.set(district, divisionName);
      }
    }
    return found;
  };

  const divisionOfDistrict = collectMemberships(false);
  for (const [district, division] of collectMemberships(true)) {
    if (!divisionOfDistrict.has(district)) divisionOfDistrict.set(district, division);
  }
  divisionOfDistrict.set(ICT_DISTRICT, ICT_PSEUDO_DIVISION);

  const orphans = ROSTER.flatMap((p) => p.districts).filter((d) => !divisionOfDistrict.has(d));
  if (orphans.length > 0) {
    fail(`${orphans.length} district(s) resolve to no division: ${orphans.join(', ')}`);
  }
  console.log(`  divisions: ${new Set(divisionOfDistrict.values()).size} (ICT injected)`);

  // ---- 3. Geometry --------------------------------------------------------------------------
  const features: UnitFeature[] = [];
  let unclosedTotal = 0;

  const addFeature = (
    district: string,
    members: readonly { type: string; role?: string; geometry?: { lat: number; lon: number }[] }[],
  ): void => {
    const { polygons, unclosed } = assemblePolygons(members);
    unclosedTotal += unclosed;
    if (polygons.length === 0) return;
    const division = divisionOfDistrict.get(district);
    const province = provinceOf(district);
    if (division === undefined || province === null) fail(`${district} has no place in the hierarchy`);
    features.push({
      type: 'Feature',
      properties: { district, division, province },
      geometry: { type: 'MultiPolygon', coordinates: polygons },
    });
  };

  for (const element of districts.elements) {
    const district = reconciliation.assignments.get(element.id);
    if (district === undefined) continue;
    addFeature(district, element.members ?? []);
  }

  const ict = provinces.elements.find((e) => e.id === ICT_RELATION_ID);
  if (ict === undefined) fail(`ICT relation ${ICT_RELATION_ID} not in the admin_level=4 cache`);
  addFeature(ICT_DISTRICT, ict.members ?? []);

  if (unclosedTotal > 0) {
    fail(`${unclosedTotal} ring(s) could not be closed — geometry would render torn`);
  }

  // ---- 4. Clip the coast off the sea ---------------------------------------------------------
  // OSM's coastal district relations run out into territorial waters, which is how OSM models
  // Pakistan rather than anything the stitching introduced — landlocked provinces already land
  // within 0.2% of published areas. `natural=coastline` is the shoreline at the same vintage and
  // from the same source as the boundaries, so clipping to it costs no second provenance
  // lineage (#38, ADR-0001).
  const coastlineWays = coastline.elements
    .filter((element) => element.nodes !== undefined && element.geometry !== undefined)
    .map(
      (element): CoastlineWay => ({
        id: element.id,
        nodes: element.nodes as readonly number[],
        geometry: element.geometry as readonly { lat: number; lon: number }[],
      }),
    );

  const { chains, headToHead } = chainCoastline(coastlineWays);
  if (headToHead.length > 0) {
    fail(
      `${headToHead.length} coastline node(s) have two ways meeting head-to-head, so one of ` +
        `each pair is drawn backwards upstream. Land lies to the LEFT of a coastline way, and ` +
        `flipping one here would decide which side the sea is on: ${headToHead.join(', ')}`,
    );
  }

  const land = assembleLand(chains, LAND_EXTENT);
  if (land.dangling.length > 0) {
    fail(
      `${land.dangling.length} coastline chain(s) stop inside the extent instead of running ` +
        `through it, so the coast cannot be closed into a land polygon. A torn coastline would ` +
        `clip districts against a shoreline with a gap in it. First break at ` +
        `${(land.dangling[0] as Position[])[0]?.join(', ')}`,
    );
  }
  if (land.water.length > 0) {
    fail(
      `${land.water.length} closed coastline ring(s) are wound as water enclosed by land. None ` +
        `exist off Pakistan, so this is unhandled rather than supported — they would have to ` +
        `become holes in the land polygon.`,
    );
  }
  console.log(
    `  coastline: ${coastlineWays.length} ways → ${chains.length} chains → ` +
      `${land.openPieces} open piece(s) closed against the extent + ${land.islands} islands`,
  );

  // The shoreline's own bounding box, taken off the coastline chains rather than off the land
  // polygon: the land polygon fills the whole extent, so it would nominate every district in
  // the country for clipping.
  const shore: Box = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
  for (const chain of chains) {
    boundsOf(
      [
        [
          chain.points.filter(
            ([lon, lat]) =>
              lon >= LAND_EXTENT.west &&
              lon <= LAND_EXTENT.east &&
              lat >= LAND_EXTENT.south &&
              lat <= LAND_EXTENT.north,
          ),
        ],
      ],
      shore,
    );
  }

  // Keyed by district, not by feature: a district assembled from two relations (Lasbela, which
  // absorbs the post-census Hub) is two features and would otherwise be reported twice.
  const clipped = new Map<string, { before: number; after: number }>();
  for (const feature of features) {
    const bounds = boundsOf(feature.geometry.coordinates);
    if (
      bounds.west < LAND_EXTENT.west ||
      bounds.east > LAND_EXTENT.east ||
      bounds.south < LAND_EXTENT.south ||
      bounds.north > LAND_EXTENT.north
    ) {
      fail(
        `${feature.properties.district} reaches outside the land extent, so clipping would cut ` +
          `it against the box rather than against the sea. Widen LAND_EXTENT.`,
      );
    }
    // Districts nowhere near the coast are left byte-identical rather than run through the
    // clipper for a no-op: an inland boundary rebuilt on one side of a shared line and not the
    // other is how two tiers stop sharing an arc.
    if (!overlaps(bounds, shore)) continue;

    const before = km2(feature.geometry.coordinates);
    const land_ = clipToLand(feature.geometry.coordinates, land.polygons);
    if (land_.length === 0) {
      fail(`${feature.properties.district} clipped away to nothing — the land polygon is wrong`);
    }
    feature.geometry.coordinates = land_;
    const after = km2(land_);
    // A metre-scale difference is the clipper rebuilding a ring, not sea being removed.
    if (before - after <= 1) continue;
    const running = clipped.get(feature.properties.district) ?? { before: 0, after: 0 };
    clipped.set(feature.properties.district, {
      before: running.before + before,
      after: running.after + after,
    });
  }

  const clipReport = [...clipped]
    .map(([district, areas]) => ({ district, ...areas }))
    .sort((a, b) => b.before - b.after - (a.before - a.after));

  console.log('\nClipped to the coastline (km², before → after)');
  for (const { district, before, after } of clipReport) {
    console.log(
      `  ${district.padEnd(20)} ${before.toFixed(0).padStart(7)} → ${after.toFixed(0).padStart(7)}` +
        `  (−${(100 * (1 - after / before)).toFixed(1)}%)`,
    );
  }

  // ---- 5. One topology, three tiers merged from the same arcs --------------------------------
  const topo = topology({ units: { type: 'FeatureCollection', features } } as never, QUANTIZATION);
  // presimplify attaches a removal weight to every point; the threshold can only be chosen
  // once those weights exist.
  const weighted = presimplify(topo as never);
  const simplified = simplify(weighted, thresholdFor(weighted, SIMPLIFY_RETAIN));

  const unitGeometries = (simplified.objects['units'] as { geometries: unknown[] }).geometries;
  const groupBy = (key: 'district' | 'division' | 'province') => {
    const groups = new Map<string, unknown[]>();
    unitGeometries.forEach((geometry, index) => {
      const value = features[index]?.properties[key] as string;
      const bucket = groups.get(value);
      if (bucket) bucket.push(geometry);
      else groups.set(value, [geometry]);
    });
    return groups;
  };

  const mergeTier = (
    key: 'district' | 'division' | 'province',
    decorate: (name: string) => Record<string, unknown>,
  ) => ({
    type: 'GeometryCollection' as const,
    geometries: [...groupBy(key)].map(([name, geometries]) => ({
      ...(mergeArcs(simplified as never, geometries as never) as object),
      properties: { name, ...decorate(name) },
    })),
  });

  const relationsOfDistrict = new Map<string, number[]>();
  for (const [relationId, district] of reconciliation.assignments) {
    relationsOfDistrict.set(district, [...(relationsOfDistrict.get(district) ?? []), relationId]);
  }

  const districtToProvince = new Map(
    features.map((f) => [f.properties.district, f.properties.province]),
  );
  const divisionToProvince = new Map(
    features.map((f) => [f.properties.division, f.properties.province]),
  );
  simplified.objects = {
    provinces: mergeTier('province', (name) => ({ kind: kindOf(name) })),
    divisions: mergeTier('division', (name) => ({
      province: divisionToProvince.get(name),
      pseudo: name === ICT_PSEUDO_DIVISION || undefined,
    })),
    districts: mergeTier('district', (name) => ({
      division: divisionOfDistrict.get(name),
      province: districtToProvince.get(name),
      // The OSM relations this district's geometry came from — the only stable, *sourced*
      // identifier available. PBS publishes census codes for the 136 province/ICT districts but
      // not for AJK or GB, so a code column would be part real and part invented; relation ids
      // are neither, and they are what the join-on-id rule keys on. Two ids means a post-census
      // split was folded back (South Waziristan).
      osmRelations: relationsOfDistrict.get(name)?.sort((a, b) => a - b),
    })),
  } as never;

  const districtGeometries = (): { properties: { province: string } }[] =>
    (simplified.objects['districts'] as unknown as {
      geometries: { properties: { province: string } }[];
    }).geometries;

  // ---- 6. Provenance ------------------------------------------------------------------------
  (simplified as unknown as Record<string, unknown>)['provenance'] = {
    generated: new Date().toISOString(),
    vintage: '2023 census (as on 01-03-2023) — geometry and statistics both, per ADR-0001',
    sources: SOURCE_URLS,
    osmBaseTimestamp: {
      province: provinces.osm3s?.timestamp_osm_base,
      division: divisions.osm3s?.timestamp_osm_base,
      district: districts.osm3s?.timestamp_osm_base,
      coastline: coastline.osm3s?.timestamp_osm_base,
    },
    coastline: {
      method:
        'natural=coastline ways chained on shared node ids, direction preserved (land lies to ' +
        'the LEFT of a coastline way), the open coast closed against a lon/lat extent and ' +
        'islands added as land of their own. Coastal district polygons are intersected with ' +
        'the result; districts away from the shore are left byte-identical.',
      extent: LAND_EXTENT,
      ways: coastlineWays.length,
      chains: chains.length,
      islands: land.islands,
      districtsClipped: clipReport.length,
      // Every district whose area the clip actually moved, so the effect is reviewable without
      // re-running the build.
      areaKm2: Object.fromEntries(
        clipReport.map(({ district, before, after }) => [
          district,
          { before: Math.round(before), after: Math.round(after) },
        ]),
      ),
    },
    counts: {
      districts: ROSTER_DISTRICT_COUNT,
      censusDistricts: CENSUS_DISTRICT_COUNT,
      divisions: new Set(divisionOfDistrict.values()).size,
      provinces: ROSTER.length,
      // Both counts, on purpose. The 2023 set and the current-day OSM set differ, and carrying
      // only one makes the other look like a bug when someone compares them.
      osmDistrictRelations: districtRelations.length,
      osmDivisionRelations: divisions.elements.length,
    },
    folded: reconciliation.folded.map((f) => ({ from: f.relation.name, into: f.into })),
    dropped: reconciliation.dropped.map((d) => ({ relation: d.relation.id, reason: d.reason })),
    knownLimitations: [
      // Narrowed from "coastal districts include territorial waters" (#38). The sea is gone —
      // Balochistan +5.3% -> -1.4%, Sindh +6.2% -> -4.2% against PBS. What is left is a
      // difference in what "area" means in tidal country, not water still being drawn as land.
      'In the Indus delta the shoreline and the published area measure different things. PBS ' +
        'counts a district\'s tidal creeks and mangrove flats as its area; natural=coastline ' +
        'puts them on the sea side, so the clip removes them. Thatta and Sujawal together read ' +
        '10,834 km² against a published 17,355, and the ~6,500 km² difference is the size the ' +
        'delta creek system is independently reported at. Closing it would mean drawing a ' +
        'shoreline no source draws.',
      // Kept separate from the delta on purpose: this one is not about water at all, and
      // conflating them would make the coastline clip look like it had failed.
      'Some district areas disagree with PBS because OSM draws the line between them somewhere ' +
        'else, not because of the coast. Each pair sums correctly: Gwadar reads -10% and Kech ' +
        '+5% but together they land within 0.6%; Karachi\'s seven districts vary by up to 49% ' +
        'individually (the 2020 Keamari split) yet the division totals 3,582 km² against a ' +
        'published 3,527. Landlocked Awaran reads -12.7% with no coast anywhere near it.',
      'AJK and Gilgit-Baltistan read smaller than Pakistani published figures (AJK 11,894 vs ' +
        '13,297; GB 66,757 vs 72,971) because OSM draws the de-facto line of control. That is a ' +
        'political difference, not an error, and the dashed LoC treatment is the app response.',
    ],
  };

  mkdirSync(resolve(OUT_FILE, '..'), { recursive: true });
  writeFileSync(OUT_FILE, `${JSON.stringify(simplified)}\n`);

  // ---- 7. Report ----------------------------------------------------------------------------
  const districtCount = districtGeometries().length;
  if (districtCount !== ROSTER_DISTRICT_COUNT) {
    fail(`bundle holds ${districtCount} districts, expected ${ROSTER_DISTRICT_COUNT}`);
  }

  // Counted off the emitted geometries, not off the roster — a count read back from the roster
  // would report what we expected rather than what we shipped, and agree with itself even if
  // the bundle were wrong.
  const emitted = new Map<string, number>();
  for (const geometry of districtGeometries()) {
    const province = geometry.properties.province;
    emitted.set(province, (emitted.get(province) ?? 0) + 1);
  }

  console.log('\nDistricts per province (counted from the bundle)');
  for (const province of ROSTER) {
    const actual = emitted.get(province.name) ?? 0;
    const flag = actual === province.districts.length ? '' : ` ✗ roster says ${province.districts.length}`;
    console.log(`  ${province.name.padEnd(28)} ${String(actual).padStart(3)}${flag}`);
    if (flag) fail(`${province.name} emitted ${actual} districts, roster says ${province.districts.length}`);
  }
  const bytes = readFileSync(OUT_FILE).byteLength;
  console.log(
    `\n✓ ${OUT_FILE.replace(`${ROOT}/`, '')} — ${districtCount} districts, ` +
      `${(bytes / 1024 / 1024).toFixed(2)} MiB`,
  );
}

/** Pick the simplification threshold that retains `fraction` of the topology's points. */
function thresholdFor(topo: unknown, fraction: number): number {
  const weights: number[] = [];
  for (const arc of (topo as { arcs: [number, number, number?][][] }).arcs) {
    for (const point of arc) if (point[2] !== undefined) weights.push(point[2]);
  }
  if (weights.length === 0) return 0;
  weights.sort((a, b) => a - b);
  const index = Math.floor((1 - fraction) * (weights.length - 1));
  return weights[index] ?? 0;
}

main();
