/**
 * Normalize the raw OSM cache into bundle v0 (#3).
 *
 *   npm run build:data:normalize
 *
 * Turns three levels of raw Overpass output into one committed TopoJSON carrying the
 * province -> division -> district hierarchy at the 2023 census vintage (ADR-0001).
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
import { mergeArcs } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';
import {
  ICT_PSEUDO_DIVISION,
  type OsmRelation,
  classifyDivision,
  provinceOf,
  reconcileDistricts,
} from './lib/reconcile.ts';
import { CENSUS_DISTRICT_COUNT, ROSTER, ROSTER_DISTRICT_COUNT } from './lib/roster.ts';
import { assemblePolygons } from './lib/rings.ts';

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

interface RawFile {
  readonly elements: readonly {
    readonly id: number;
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

const SOURCE_URLS = {
  boundaries: 'https://overpass-api.de/api/interpreter (OpenStreetMap, ODbL)',
  roster:
    'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf',
} as const;

function readRaw(level: number): RawFile {
  return JSON.parse(readFileSync(resolve(RAW_DIR, `osm-admin-level-${level}.json`), 'utf8'));
}

const nameOf = (tags: Record<string, string> | undefined): string =>
  tags?.['name:en'] ?? tags?.['name'] ?? '';

interface UnitFeature {
  readonly type: 'Feature';
  readonly properties: { readonly district: string; readonly division: string; readonly province: string };
  readonly geometry: { readonly type: 'MultiPolygon'; readonly coordinates: unknown[] };
}

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function main(): void {
  console.log('Normalizing OSM boundaries into bundle v0');

  const provinces = readRaw(4);
  const divisions = readRaw(5);
  const districts = readRaw(6);

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
      if (classified.kind !== 'district' && classified.kind !== 'fold') continue;
      const divisionName = classified.district;

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

  // ---- 4. One topology, three tiers merged from the same arcs --------------------------------
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

  const districtToProvince = new Map(
    features.map((f) => [f.properties.district, f.properties.province]),
  );
  const divisionToProvince = new Map(
    features.map((f) => [f.properties.division, f.properties.province]),
  );
  const kindOf = (province: string) =>
    ROSTER.find((p) => p.name === province)?.kind ?? 'province';

  simplified.objects = {
    provinces: mergeTier('province', (name) => ({ kind: kindOf(name) })),
    divisions: mergeTier('division', (name) => ({
      province: divisionToProvince.get(name),
      pseudo: name === ICT_PSEUDO_DIVISION || undefined,
    })),
    districts: mergeTier('district', (name) => ({
      division: divisionOfDistrict.get(name),
      province: districtToProvince.get(name),
    })),
  } as never;

  // ---- 5. Provenance ------------------------------------------------------------------------
  (simplified as unknown as Record<string, unknown>)['provenance'] = {
    generated: new Date().toISOString(),
    vintage: '2023 census (as on 01-03-2023) — geometry and statistics both, per ADR-0001',
    sources: SOURCE_URLS,
    osmBaseTimestamp: {
      province: provinces.osm3s?.timestamp_osm_base,
      division: divisions.osm3s?.timestamp_osm_base,
      district: districts.osm3s?.timestamp_osm_base,
    },
    counts: {
      districts: ROSTER_DISTRICT_COUNT,
      censusDistricts: CENSUS_DISTRICT_COUNT,
      divisions: new Set(divisionOfDistrict.values()).size,
      provinces: ROSTER.length,
    },
    folded: reconciliation.folded.map((f) => ({ from: f.relation.name, into: f.into })),
    dropped: reconciliation.dropped.map((d) => ({ relation: d.relation.id, reason: d.reason })),
    knownLimitations: [
      // Measured against published district areas. Landlocked provinces agree to within 0.2%
      // (Punjab 205,708 vs 205,344; KP 101,579 vs 101,741), which is what rules out an error in
      // ring assembly or simplification and isolates this to the coast.
      'OSM boundary relations for coastal districts extend into territorial waters, so Gwadar, ' +
        'Lasbela, Thatta, Sujawal, Badin and Karachi read larger than their published land ' +
        'areas (Balochistan +6%, Sindh +6%). OSM models it this way at province level too. ' +
        'Clipping to a coastline needs a source we do not yet have, so it is recorded rather ' +
        'than silently corrected.',
      'AJK and Gilgit-Baltistan read smaller than Pakistani published figures (AJK 11,894 vs ' +
        '13,297; GB 66,757 vs 72,971) because OSM draws the de-facto line of control. That is a ' +
        'political difference, not an error, and the dashed LoC treatment is the app response.',
    ],
  };

  mkdirSync(resolve(OUT_FILE, '..'), { recursive: true });
  writeFileSync(OUT_FILE, `${JSON.stringify(simplified)}\n`);

  // ---- 6. Report ----------------------------------------------------------------------------
  const districtCount = (simplified.objects['districts'] as { geometries: unknown[] }).geometries
    .length;
  if (districtCount !== ROSTER_DISTRICT_COUNT) {
    fail(`bundle holds ${districtCount} districts, expected ${ROSTER_DISTRICT_COUNT}`);
  }

  console.log('\nDistricts per province');
  for (const province of ROSTER) {
    console.log(`  ${province.name.padEnd(28)} ${String(province.districts.length).padStart(3)}`);
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
