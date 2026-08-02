/**
 * Assertions against the committed bundle itself, not the code that builds it.
 *
 * These are the checks that would catch a bad artifact being committed: the pipeline can be
 * correct in isolation and still emit something with a hole in it, a torn coastline, or a
 * district silently missing. Since the bundle is committed, a broken one is a reviewable diff —
 * but only if something is actually looking at it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoArea } from 'd3';
import { describe, expect, it } from 'vitest';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import {
  CENSUS_DISTRICTS,
  CENSUS_DISTRICT_COUNT,
  ROSTER,
  ROSTER_DISTRICT_COUNT,
} from './roster.ts';
import { TERRITORY_CLAIM_POLICY, universeDistricts } from './scenarios.ts';
import { partitionByDominantLanguage } from './mother-tongue-partition.ts';
import { districtCentroids } from './centroids.ts';
import {
  haversineKm,
  partitionByRule,
  type Centroid,
  type PartitionRule,
} from './partitioner.ts';
import { dominantTongues, variantsFrom } from './variants.ts';
import {
  districtsMoved,
  scorecardOf,
  type Scorecard,
} from './scorecard.ts';
import {
  adjacencyProblems,
  buildAdjacency,
  contiguityOf,
  edgeCount,
  isolatedDistricts,
  type AdjacencyGraph,
} from './adjacency.ts';
import {
  AREA_AGREEMENT,
  areaKm2,
  arcsOf,
  boundaryArcs,
  dissolve,
  interiorArcs,
  outlineProblems,
  polygonsOf,
  unclosedRings,
  type PolygonalGeometry,
} from './unit-outlines.ts';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const bundle = JSON.parse(
  readFileSync(resolve(ROOT, 'data/bundle/geography.topojson.json'), 'utf8'),
);
const scenarios = JSON.parse(readFileSync(resolve(ROOT, 'data/bundle/scenarios.json'), 'utf8'));
const outlines = JSON.parse(readFileSync(resolve(ROOT, 'data/bundle/unit-outlines.json'), 'utf8'));
const adjacency = JSON.parse(readFileSync(resolve(ROOT, 'data/bundle/adjacency.json'), 'utf8'));
const statistics = JSON.parse(readFileSync(resolve(ROOT, 'data/bundle/statistics.json'), 'utf8'));

/**
 * The content module's own variants, derived the way the build derives them (#26).
 *
 * Two of the ten have no published district list and are computed from the census and the district
 * borders, so `variants.ts` is a function of both. The context comes from the committed bundle,
 * which is what every other assertion in this file stands on — and it is only used below to
 * compare the *module* against the *artifact*, which is a question the artifact cannot answer
 * about itself.
 */
const VARIANTS = variantsFrom({
  graph: new Map(Object.entries(adjacency.neighbours as Record<string, string[]>)),
  dominant: dominantTongues(
    statistics as { districts: Record<string, { motherTongue?: { dominant?: unknown } }> },
  ),
  populations: new Map(
    Object.entries(statistics.districts as Record<string, { population: number }>).map(
      ([district, record]) => [district, record.population],
    ),
  ),
  // The distance rule A4 states (#28) is measured on the drawn map, so the centroids come from the
  // committed geometry rather than from a table beside it.
  centroids: districtCentroids(bundle as Topology),
});

const layer = (name: string) =>
  feature(bundle, bundle.objects[name]) as unknown as {
    features: { properties: Record<string, string>; geometry: unknown }[];
  };

const districts = layer('districts').features;
const divisions = layer('divisions').features;
const provinces = layer('provinces').features;

const nameOf = (f: { properties: Record<string, string> }) => f.properties['name'] as string;
/** Steradians -> km², for readable assertions. */
const km2 = (g: unknown) => geoArea(g as never) * 6371 * 6371;

describe('bundle tiers', () => {
  it('holds every 2023 district exactly once', () => {
    expect(districts).toHaveLength(ROSTER_DISTRICT_COUNT);
    const names = districts.map(nameOf);
    expect(new Set(names).size).toBe(names.length);
    // Collected rather than asserted one at a time: a bare `toContain` prints the 156-name
    // haystack and leaves the reader to work out which province the needle came from. A
    // missing district is the thing to read off the failure, so it is the thing reported.
    const missing = ROSTER.flatMap((province) =>
      province.districts
        .filter((district) => !names.includes(district))
        .map((district) => `${district} (${province.name})`),
    );
    expect(missing).toEqual([]);
  });

  it('holds 36 census divisions plus the injected ICT pseudo-division', () => {
    expect(divisions).toHaveLength(37);
    const ict = divisions.find((d) => nameOf(d) === 'Islamabad');
    expect(ict?.properties['pseudo']).toBe(true);
  });

  it('holds seven provinces and territories, with their constitutional kind', () => {
    expect(provinces).toHaveLength(ROSTER.length);
    const kinds = Object.fromEntries(provinces.map((p) => [nameOf(p), p.properties['kind']]));
    // Territories are styled as territories and never shaded — D12, D25.
    expect(kinds['Azad Jammu & Kashmir']).toBe('territory');
    expect(kinds['Gilgit-Baltistan']).toBe('territory');
    expect(kinds['Punjab']).toBe('province');
    expect(kinds['Islamabad Capital Territory']).toBe('capital');
  });

  it('spells divisions as PBS does, not as OSM does', () => {
    const names = divisions.map(nameOf);
    expect(names).toContain('Kalat');
    expect(names).toContain('Mekran');
    expect(names).not.toContain('Qalat');
    expect(names).not.toContain('Makran');
  });

  it('emits the published district count for every province, counted from geometry', () => {
    const counted = new Map<string, number>();
    for (const d of districts) {
      const p = d.properties['province'] as string;
      counted.set(p, (counted.get(p) ?? 0) + 1);
    }
    for (const province of ROSTER) {
      expect(counted.get(province.name)).toBe(province.districts.length);
    }
  });

  it('carries the OSM relation ids each district was built from', () => {
    for (const district of districts) {
      const ids = district.properties['osmRelations'] as unknown as number[] | undefined;
      // ICT is injected from admin_level=4, so it has no district relation of its own.
      if (nameOf(district) === 'Islamabad') continue;
      expect(ids?.length).toBeGreaterThan(0);
    }
    // South Waziristan is the folded split: two relations, one 2023 district.
    const sw = districts.find((d) => nameOf(d) === 'South Waziristan');
    expect((sw?.properties['osmRelations'] as unknown as number[]).length).toBe(2);
  });

  it('resolves every district to exactly one division and one province', () => {
    const divisionNames = new Set(divisions.map(nameOf));
    const provinceNames = new Set(provinces.map(nameOf));
    // Each assertion carries the district name, because the value that fails is the *parent* —
    // "expected [Array(37)] to include 'Nowhere'" says which division does not exist and
    // nothing at all about which district points at it, which is the half a reader needs.
    for (const district of districts) {
      expect(divisionNames, nameOf(district)).toContain(district.properties['division']);
      expect(provinceNames, nameOf(district)).toContain(district.properties['province']);
    }
  });

  it('hangs every division off a province, under the same province as its own districts', () => {
    // The tier above the one already checked. A district resolving to a real division and a
    // real province is not enough on its own: the two can disagree, which would put a district
    // in a division belonging to some other province and quietly break every rollup that walks
    // district -> division -> province rather than district -> province.
    const provinceNames = new Set(provinces.map(nameOf));
    const divisionProvince = new Map(divisions.map((d) => [nameOf(d), d.properties['province']]));
    for (const division of divisions) {
      expect(provinceNames, nameOf(division)).toContain(division.properties['province']);
    }
    for (const district of districts) {
      expect(divisionProvince.get(district.properties['division'] as string), nameOf(district)).toBe(
        district.properties['province'],
      );
    }
  });

  it('draws no division that no district belongs to', () => {
    // A division with no districts under it is drawn on the base map and reachable by nothing:
    // it would survive every count check above, since counts only ever look downward.
    const occupied = new Set(districts.map((d) => d.properties['division']));
    const empty = divisions.map(nameOf).filter((name) => !occupied.has(name));
    expect(empty).toEqual([]);
  });

  it('counts 136 census districts across the four provinces and ICT', () => {
    const territories = new Set(
      ROSTER.filter((p) => p.kind === 'territory').map((p) => p.name),
    );
    const census = districts.filter((d) => !territories.has(d.properties['province'] as string));
    expect(census).toHaveLength(CENSUS_DISTRICT_COUNT);
  });
});

describe('bundle geometry', () => {
  it('gives every district a non-degenerate area', () => {
    const degenerate = districts.filter((d) => km2(d.geometry) < 1);
    expect(degenerate.map(nameOf)).toEqual([]);
  });

  it('leaves no hole where the capital should be', () => {
    const islamabad = districts.find((d) => nameOf(d) === 'Islamabad');
    expect(islamabad).toBeDefined();
    // ICT is ~906 km². Generous bounds: this is a "did it land at all" check.
    expect(km2(islamabad!.geometry)).toBeGreaterThan(500);
    expect(km2(islamabad!.geometry)).toBeLessThan(2000);
  });

  it('conserves area when districts dissolve into divisions and provinces', () => {
    // The three tiers merge from one shared arc set, so they must agree to within
    // simplification noise. A real gap or overlap would show up here as a percentage.
    const districtArea = districts.reduce((sum, f) => sum + km2(f.geometry), 0);
    const divisionArea = divisions.reduce((sum, f) => sum + km2(f.geometry), 0);
    const provinceArea = provinces.reduce((sum, f) => sum + km2(f.geometry), 0);
    expect(divisionArea).toBeCloseTo(districtArea, -2);
    expect(provinceArea).toBeCloseTo(districtArea, -2);
  });

  it('covers roughly Pakistan, and only Pakistan', () => {
    const total = provinces.reduce((sum, f) => sum + km2(f.geometry), 0);
    // ~796,000 km² excluding AJK/GB, ~880,000 including them — and the drawn figure sits a
    // little under that, because the territorial waters are clipped away and the LoC cuts AJK
    // and GB short. Wide bounds: the point is to catch a coastline lost to over-simplification
    // or a stray province left in.
    expect(total).toBeGreaterThan(800_000);
    expect(total).toBeLessThan(950_000);

    const [minLon, minLat, maxLon, maxLat] = bundle.bbox as number[];
    expect(minLon).toBeGreaterThan(60);
    expect(maxLon).toBeLessThan(78);
    expect(minLat).toBeGreaterThan(23);
    expect(maxLat).toBeLessThan(38);
  });

  it('excludes relations from India and Afghanistan', () => {
    const names = districts.map(nameOf);
    for (const stray of ['Kupwara', 'Karnah', 'Karezat', 'Leh', 'Spin Boldak']) {
      expect(names).not.toContain(stray);
    }
  });
});

/**
 * Published land areas, PBS Population & Housing Census 2023, Table 1 — the same publication
 * and the same vintage as every other number in the project.
 *
 *   https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_1_sindh_districts.pdf
 *   https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_1_balochistan_districts.pdf
 */
const PUBLISHED_KM2: Record<string, number> = {
  Gwadar: 12_637,
  Kech: 22_539,
  Lasbela: 15_153,
  Awaran: 29_510,
  Thatta: 8_570,
  Sujawal: 8_785,
  Badin: 6_858,
  Keamari: 559,
  'Karachi South': 122,
  'Karachi West': 370,
  'Karachi Central': 69,
  'Karachi East': 139,
  Korangi: 108,
  Malir: 2_160,
  // Interior Balochistan, landlocked, where OSM and PBS simply disagree about where the line
  // between two districts runs. Named here because the bundle's own `knownLimitations` names
  // them, and a narrative that cites the small miss and hides the large one is the failure.
  Khuzdar: 35_380,
  Panjgur: 16_891,
  Punjab: 205_344,
  'Khyber Pakhtunkhwa': 101_741,
  Sindh: 140_914,
  Balochistan: 347_190,
};

/**
 * How far a measured area may sit from its published figure (#38).
 *
 * **5%.** The pipeline's own error budget is far smaller than that: simplification moves these
 * areas by under 0.05% (measured — the clip report and the finished bundle agree to the
 * kilometre), quantization is a 25 m grid, and spherical area on a 6371 km sphere against PBS's
 * planimetric figures is a few tenths of a percent. So 5% is more than an order of magnitude
 * above the method error, which is the point: it cannot be met by accident, and none of the
 * pre-clip figures met it — Gwadar was +105%, Lasbela +59%, Balochistan +5.3%, Sindh +6.2%.
 *
 * It is not loosened past 5% for the districts that miss it. Those are named and explained
 * below and in the bundle's own `knownLimitations`, because the reason they miss is not the
 * coastline.
 *
 * The bundle records this same number as `provenance.coastline.areaTolerance`, so a reader of
 * the artifact gets the acceptance criterion and not only the list of exceptions to it. The
 * two are asserted equal below.
 */
const TOLERANCE = 0.05;

const areaOf = (name: string): number => {
  const found = [...districts, ...provinces].find((f) => nameOf(f) === name);
  if (found === undefined) throw new Error(`${name} is not in the bundle`);
  return km2(found.geometry);
};

const ratio = (names: readonly string[]): number =>
  names.reduce((sum, n) => sum + areaOf(n), 0) /
  names.reduce((sum, n) => sum + (PUBLISHED_KM2[n] as number), 0);

describe('bundle coastline', () => {
  it('keeps landlocked provinces on their published areas, which the clip must not disturb', () => {
    // Deliberately *not* phrased as "unchanged by the clip". Clipping moved the bundle's
    // bounding box (23.4342°N -> 24.0516°N at the south edge), which moves the quantization
    // grid every arc in the file is snapped to, so no arc survives the clip verbatim and the
    // landlocked provinces did shift — Punjab by -0.31 km², KP by -0.55, GB by -0.98, AJK by
    // +0.34, all under 0.0005%. A test in this file cannot see the previous bundle, so it
    // cannot assert "did not move"; what it can assert, against a published source rather than
    // against a prior artifact, is that they still sit on their PBS figures. 0.3% is a tenth
    // of the tolerance the coastal provinces are held to and well inside method error
    // (spherical vs planimetric area, simplification), so a clip that leaked inland would
    // fail here.
    expect(Math.abs(ratio(['Punjab']) - 1)).toBeLessThan(0.003);
    expect(Math.abs(ratio(['Khyber Pakhtunkhwa']) - 1)).toBeLessThan(0.003);
  });

  it('brings both coastal provinces within tolerance of their published areas', () => {
    // Before clipping: Balochistan 365,457 (+5.3%), Sindh 149,691 (+6.2%).
    expect(Math.abs(ratio(['Balochistan']) - 1)).toBeLessThan(TOLERANCE);
    expect(Math.abs(ratio(['Sindh']) - 1)).toBeLessThan(TOLERANCE);
  });

  it('stops coastal districts at the sea instead of in territorial waters', () => {
    // The failure this replaces: Gwadar read 25,913 km² against a published 12,637, Lasbela
    // 24,090 against 15,153. Nothing may read meaningfully larger than its published area again.
    //
    // Two thresholds rather than one blanket ceiling. A single ceiling has to clear the worst
    // legitimate survivor — Malir, at 1.226, where OSM puts the Karachi/Malir line further out
    // than PBS's areas assume — and a ceiling set just above Malir is no test at all: Malir
    // could re-inflate most of the way back and still pass. So Malir is pinned to a narrow
    // band of its own, and every other district is held an order of magnitude tighter.
    const provinceNames = new Set(provinces.map(nameOf));
    const inflated = Object.entries(PUBLISHED_KM2)
      .filter(([name]) => !provinceNames.has(name) && name !== 'Malir')
      .filter(([name, published]) => areaOf(name) / published > 1.1)
      .map(([name]) => name);
    expect(inflated).toEqual([]);

    const malir = areaOf('Malir') / (PUBLISHED_KM2['Malir'] as number);
    expect(malir).toBeGreaterThan(1.2);
    expect(malir).toBeLessThan(1.25);
  });

  it('lands within tolerance wherever OSM and PBS draw the same lines', () => {
    expect(Math.abs(ratio(['Lasbela']) - 1)).toBeLessThan(TOLERANCE);
    expect(Math.abs(ratio(['Badin']) - 1)).toBeLessThan(TOLERANCE);
    // Individually Gwadar reads -10% and Kech +5%: OSM puts the line between them somewhere
    // else than PBS's areas assume. As a pair they agree, which is what shows the clip is right.
    expect(Math.abs(ratio(['Gwadar', 'Kech']) - 1)).toBeLessThan(TOLERANCE);
    // Same story across Karachi's 2020 seven-district split.
    expect(
      Math.abs(
        ratio([
          'Karachi Central',
          'Karachi East',
          'Karachi South',
          'Karachi West',
          'Keamari',
          'Korangi',
          'Malir',
        ]) - 1,
      ),
    ).toBeLessThan(TOLERANCE);
  });

  it('reads the Indus delta low, by the documented amount and no more', () => {
    // PBS counts a delta district's tidal creeks as its area; natural=coastline does not, so
    // the clip removes them. That leaves a gap of ~6,500 km², the largest accepted deviation
    // in the bundle. What the gap is *not* claimed to be is the measured size of the creek
    // system: no source this project uses publishes that, so the bundle states the arithmetic
    // and the mechanism and stops there. Pinned as a band — a known deviation, not a free one.
    const delta = ratio(['Thatta', 'Sujawal']);
    expect(delta).toBeGreaterThan(0.55);
    expect(delta).toBeLessThan(0.7);
  });

  it('names the large interior-Balochistan misses, not only the small one', () => {
    // Awaran (-12.7%) was the only one the narrative used to name, which read as an isolated
    // curiosity. Khuzdar misses by more, in both percentage and absolute terms.
    expect(Math.abs(ratio(['Khuzdar']) - 1)).toBeGreaterThan(TOLERANCE);
    expect(Math.abs(ratio(['Panjgur']) - 1)).toBeGreaterThan(TOLERANCE);
    const text = (bundle.provenance.knownLimitations as string[]).join(' ');
    for (const name of ['Khuzdar', 'Panjgur', 'Awaran']) expect(text).toContain(name);
  });
});

describe('bundle provenance', () => {
  it('stamps generation date, vintage and source URLs', () => {
    const p = bundle.provenance;
    expect(Date.parse(p.generated)).not.toBeNaN();
    expect(p.vintage).toMatch(/2023/);
    expect(p.sources.boundaries).toMatch(/openstreetmap|overpass/i);
    expect(p.sources.roster).toMatch(/pbs\.gov\.pk/);
    expect(p.osmBaseTimestamp.district).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('records the coastline as the same lineage as the boundaries, not a second one', () => {
    const p = bundle.provenance;
    expect(p.sources.coastline).toMatch(/natural=coastline/);
    expect(p.sources.coastline).toMatch(/openstreetmap|overpass/i);
    expect(p.osmBaseTimestamp.coastline).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(p.coastline.districtsClipped).toBeGreaterThan(0);
    expect(p.coastline.areaKm2.Gwadar.before).toBeGreaterThan(p.coastline.areaKm2.Gwadar.after);
  });

  it('carries the area tolerance, not only the exceptions to it', () => {
    expect(bundle.provenance.coastline.areaTolerance).toBe(TOLERANCE);
  });

  it('reports how many districts the shoreline box nominated, not just how many moved', () => {
    // The bbox gate is one rectangle over the whole coast, so it nominates a good many
    // landlocked districts too. Both numbers are recorded because either alone misleads.
    const { districtsConsidered, districtsClipped } = bundle.provenance.coastline;
    expect(districtsConsidered).toBeGreaterThan(districtsClipped);
    expect(districtsConsidered).toBeLessThan(ROSTER_DISTRICT_COUNT);
  });

  it('does not claim districts away from the shore are byte-identical', () => {
    // They are not: clipping moved the bundle's bounding box, which moved the quantization
    // grid, so every arc in the file was rebuilt. What survives is arc *sharing*.
    const method = bundle.provenance.coastline.method as string;
    expect(method).not.toMatch(/away from the shore are left byte-identical/);
    expect(method).toMatch(/requantized|arc sharing/);
  });

  it('does not claim the delta gap is an independently reported creek area', () => {
    const text = (bundle.provenance.knownLimitations as string[]).join(' ');
    expect(text).not.toMatch(/independently reported/i);
  });

  /**
   * The narrative numbers in `knownLimitations` are rendered provenance, not comments — under
   * this project's "no unsourced surface" rule a wrong one is a defect, and one of them (the
   * Karachi division total) had already drifted from 3,682 to a stated 3,582 once. The
   * generator interpolates them from the geometry it is about to write; this re-measures them
   * from the committed artifact, so prose and geometry cannot come apart again.
   */
  it('quotes area figures that the committed geometry actually has', () => {
    const text = (bundle.provenance.knownLimitations as string[]).join(' ');
    const quoted = (pattern: RegExp): number => {
      const match = text.match(pattern);
      if (match === null) throw new Error(`knownLimitations has no match for ${pattern}`);
      return Number((match[1] as string).replace(/,/g, ''));
    };
    // Rounded to the km² in the prose, and the bundle is measured spherically here as it is
    // there, so agreement is to well under a tenth of a percent.
    const agrees = (stated: number, actual: number) =>
      expect(Math.abs(stated / actual - 1)).toBeLessThan(0.001);

    const karachi = divisions.find((d) => nameOf(d) === 'Karachi');
    agrees(quoted(/division totals ([\d,]+) km²/), km2(karachi!.geometry));

    const delta = areaOf('Thatta') + areaOf('Sujawal');
    agrees(quoted(/together read ([\d,]+) km²/), delta);
    agrees(
      quoted(/a gap of ([\d,]+) km²/),
      (PUBLISHED_KM2['Thatta'] as number) + (PUBLISHED_KM2['Sujawal'] as number) - delta,
    );

    agrees(quoted(/Khuzdar reads ([\d,]+) km²/), areaOf('Khuzdar'));
  });

  it('no longer claims coastal districts run into territorial waters', () => {
    const limitations = (bundle.provenance.knownLimitations as string[]).join(' ');
    expect(limitations).not.toMatch(/territorial waters/i);
    expect(limitations).toMatch(/delta/i);
  });

  it('records what was folded and what was dropped, with reasons', () => {
    const p = bundle.provenance;
    expect(p.folded.length).toBeGreaterThan(0);
    expect(p.dropped.length).toBeGreaterThan(0);
    for (const dropped of p.dropped) expect(dropped.reason).toBeTruthy();
    // The post-census split that folds two relations into one 2023 district.
    const waziristan = p.folded.filter((f: { into: string }) => f.into === 'South Waziristan');
    expect(waziristan).toHaveLength(2);
  });

  it('folds every post-census relation into a district the bundle actually draws', () => {
    // `folded` is the audit trail for the dissolve (ADR-0001), and it is prose until something
    // checks the names in it against the geometry. A fold naming a district that is not drawn
    // means territory went somewhere the map cannot show — the exact drift that committing the
    // bundle is meant to make reviewable.
    const drawn = new Set(districts.map(nameOf));
    const stranded = (bundle.provenance.folded as { from: string; into: string }[])
      .filter((fold) => !drawn.has(fold.into))
      .map((fold) => `${fold.from} -> ${fold.into}`);
    expect(stranded).toEqual([]);
  });

  it('agrees with the roster on counts', () => {
    expect(bundle.provenance.counts).toMatchObject({
      districts: ROSTER_DISTRICT_COUNT,
      censusDistricts: CENSUS_DISTRICT_COUNT,
      divisions: 37,
      provinces: 7,
    });
  });
});

/**
 * The committed scenario set (#14), checked against the committed geometry.
 *
 * `scenarios.test.ts` holds the validator: given a variant with a hole in it, does it say which
 * district and which units. These are the same properties asserted over the artifact that ships,
 * and against the geography bundle rather than against the roster the build used — a variant that
 * partitions a district set the map does not draw is a unit outline with nothing underneath it.
 */
interface EmittedUnit {
  readonly id: string;
  readonly name: string;
  readonly kind: 'proposed' | 'unchanged' | 'territory';
  readonly claimed: readonly string[];
  readonly districts: readonly string[];
  readonly folded: readonly { readonly from: string; readonly into: string }[];
  readonly excludes: readonly string[];
  readonly alsoKnownAs: readonly string[];
  /** The unit's own aside on the card — where H2 puts each state's accession date (#30). */
  readonly note: string | null;
  readonly contiguity: {
    readonly contiguous: boolean;
    readonly pieces: number;
    readonly detached: readonly (readonly string[])[];
  };
  readonly population: number | null;
  readonly uncounted: readonly string[];
}
interface EmittedVariant {
  readonly id: string;
  readonly basis: string;
  readonly name: string;
  readonly badges: readonly string[];
  /** Present only where the variant dates its own boundary; absent means "read at the basis's". */
  readonly vintage?: string;
  readonly rationale: string;
  readonly status: string;
  readonly advocacy:
    | { readonly kind: 'advocated'; readonly by: readonly string[] }
    | { readonly kind: 'unadvocated'; readonly note: string };
  readonly opposedBy: readonly string[];
  readonly composition:
    | { readonly kind: 'transcribed'; readonly from: string }
    | { readonly kind: 'derived'; readonly rule: string; readonly from: string };
  readonly sources: readonly { readonly label: string }[];
  readonly footnotes: readonly { readonly kind: string; readonly text: string }[];
  readonly notes: readonly {
    readonly label: string;
    readonly text: string;
    readonly relatedVariants?: readonly string[];
  }[];
  readonly partition: { readonly universe: 'drawn' | 'census'; readonly districts: number };
  readonly counts: Readonly<Record<string, number>>;
  readonly statistics:
    | { readonly modernFigures: true }
    | { readonly modernFigures: false; readonly reason: string };
  readonly scorecard: Scorecard;
  readonly units: readonly EmittedUnit[];
}

const variants = scenarios.variants as EmittedVariant[];
const drawnDistricts = new Set(districts.map(nameOf));
const territoryDistricts = new Set(
  ROSTER.filter((p) => p.kind === 'territory').flatMap((p) => p.districts),
);

describe('bundle scenarios', () => {
  it('ships at least one variant, expressed as data rather than as prose', () => {
    expect(variants.length).toBeGreaterThan(0);
    expect(variants.map((v) => v.id)).toContain('l1');
  });

  /*
   * The bake carries a variant's own vintage, which it did not until #32 went looking for one.
   *
   * The schema has had an optional `vintage` since it was written and the validator has always
   * checked it, so the *module* was right and every review of the content passed. What was missing
   * was one line in `build-scenarios.ts`: the field was never written into the artifact, so every
   * variant reached the runtime dated at its basis and nothing went red — because until the PNG
   * band nothing on screen printed a variant's date.
   *
   * Held against `VARIANTS` rather than only against the artifact, so this compares the two sides
   * of the bake instead of asking the artifact whether it agrees with itself.
   */
  it('carries each variant’s own vintage through the bake, or leaves it to the basis', () => {
    const declared = new Map(VARIANTS.map((variant) => [variant.id, variant.vintage]));
    const lost = variants.flatMap((variant) => {
      const own = declared.get(variant.id);
      if (own === undefined) {
        return variant.vintage === undefined
          ? []
          : [`${variant.id} is dated "${variant.vintage}" in the bundle and nowhere in VARIANTS`];
      }
      return variant.vintage === own
        ? []
        : [`${variant.id} states the vintage "${own}" and the bundle carries ${JSON.stringify(variant.vintage)}`];
    });
    expect(lost).toEqual([]);
  });

  it('dates every Historical variant itself, since its basis defers rather than declaring one', () => {
    // The Historical basis's declared vintage is "the date of each demarcation, 1947 onward —
    // stated per variant, not shared": a rule for finding a date, not a date. A Historical variant
    // that states none therefore resolves to a sentence where a date should be, on the card, in
    // the band and anywhere else the date is printed. Named per variant, never counted.
    const undated = variants
      .filter((variant) => variant.basis === 'historical' && variant.vintage === undefined)
      .map((variant) => `${variant.id} (${variant.name}) states no vintage of its own`);
    expect(undated).toEqual([]);
  });

  it('gives every unit districts the map actually draws', () => {
    // Named per district rather than per variant: "l1 references a district that isn't drawn"
    // leaves the reader to find which of 156 it was.
    const undrawn = variants.flatMap((variant) =>
      variant.units.flatMap((unit) =>
        unit.districts
          .filter((district) => !drawnDistricts.has(district))
          .map((district) => `${variant.id} "${unit.name}" claims undrawn ${district}`),
      ),
    );
    expect(undrawn).toEqual([]);
  });

  it('gives every district in a variant to exactly one unit', () => {
    const overlaps = variants.flatMap((variant) => {
      const owner = new Map<string, string>();
      const clashes: string[] = [];
      for (const unit of variant.units) {
        for (const district of unit.districts) {
          const taken = owner.get(district);
          if (taken !== undefined) clashes.push(`${variant.id}: ${district} in ${taken} and ${unit.name}`);
          else owner.set(district, unit.name);
        }
      }
      return clashes;
    });
    expect(overlaps).toEqual([]);
  });

  it('leaves no district of the set a variant partitions in no unit at all', () => {
    const holes = variants.flatMap((variant) => {
      const covered = new Set(variant.units.flatMap((u) => u.districts));
      return universeDistricts(variant.partition.universe)
        .filter((district) => !covered.has(district))
        .map((district) => `${variant.id} leaves ${district} uncoloured`);
    });
    expect(holes).toEqual([]);
    for (const variant of variants) {
      expect(variant.partition.districts, variant.id).toBe(
        universeDistricts(variant.partition.universe).length,
      );
    }
  });

  it('keeps a census-set partition out of AJK and Gilgit-Baltistan entirely', () => {
    // The 136 are the districts PBS published results for; a census-set variant that reached
    // into a territory would be shading ground with no figure behind it (D25).
    const strays = variants
      .filter((v) => v.partition.universe === 'census')
      .flatMap((variant) =>
        variant.units.flatMap((unit) =>
          unit.districts
            .filter((d) => territoryDistricts.has(d))
            .map((d) => `${variant.id} "${unit.name}" claims ${d}`),
        ),
      );
    expect(strays).toEqual([]);
  });

  it('honours the recorded answer to whether a variant may claim territory', () => {
    // CLAUDE.md open item 2b is a product decision that is not settled. The artifact records
    // which answer it was built under, and this holds the artifact to it — so a variant that
    // takes an AJK district arrives with the decision made, not by drifting past this test.
    expect(scenarios.provenance.territoryClaims.policy).toBe(TERRITORY_CLAIM_POLICY);
    if (TERRITORY_CLAIM_POLICY !== 'forbid') return;

    /**
     * One territory, entire, under its own name — a promotion rather than a claim (#28, A5).
     *
     * The carve-out is `scenarios.ts`'s and is tested at its own seam there; what is held here is
     * that the *artifact* contains no unit exercising it other than by being exactly that. A unit
     * holding nine of Gilgit-Baltistan's ten districts, or ten of them plus a Punjab one, or ten
     * of them under another name, is a claim on territory and would be named below.
     */
    const territories = ROSTER.filter((province) => province.kind === 'territory');
    const promotes = (unit: { name: string; districts: readonly string[] }): boolean =>
      territories.some(
        (territory) =>
          territory.name === unit.name &&
          territory.districts.length === unit.districts.length &&
          territory.districts.every((district) => unit.districts.includes(district)),
      );

    /** Every territory district a unit holds while being neither a territory nor a promotion. */
    const reachesIn = (variant: EmittedVariant): readonly string[] =>
      variant.units
        .filter((unit) => unit.kind !== 'territory' && !promotes(unit))
        .flatMap((unit) =>
          unit.districts
            .filter((d) => territoryDistricts.has(d))
            .map((d) => `${variant.id} "${unit.name}" claims ${d}`),
        );

    // A variant that publishes no population anywhere is the second narrowing (#30, H2): there is
    // no figure that can be short by an unknowable amount, which is the only reason `forbid` was
    // ever answered. Held out here and named on its own below, never merely skipped.
    const claimed = variants
      .filter((variant) => variant.statistics.modernFigures)
      .flatMap(reachesIn);
    expect(claimed).toEqual([]);

    // And neither carve-out is vacuous. A test that only ever proves an exclusion never fires is a
    // test that would pass with the exclusion written wrongly — so both are held to firing for
    // exactly the units they were written for, by name.
    const promoted = variants.flatMap((variant) =>
      variant.units
        .filter((unit) => unit.kind === 'proposed' && promotes(unit))
        .map((unit) => `${variant.id} ${unit.name}`),
    );
    expect(promoted).toEqual(['a5 Gilgit-Baltistan', 'a5 Azad Jammu & Kashmir']);

    // H2 draws Hunza and Nagar as the princely states they were until 1974, and they are districts
    // of Gilgit-Baltistan today — two of ten, so neither is a promotion and `promotedTerritoryOf`
    // correctly does not reach them. These two units, on this one variant, are the whole of what
    // the withholding carve-out admits in the shipped set.
    const withheld = variants
      .filter((variant) => !variant.statistics.modernFigures)
      .flatMap(reachesIn);
    expect(withheld).toEqual(['h2 "Hunza" claims Hunza', 'h2 "Nagar" claims Nagar']);
  });

  it('records what a claim says alongside what this map draws it as', () => {
    // The vintage rule shows up here as a difference: advocates state South Punjab as 13
    // districts, two of which were created in 2022 and fold into their parents (ADR-0001). Both
    // numbers are card content, and a fold has to land on a district the map draws.
    for (const variant of variants) {
      for (const unit of variant.units) {
        expect(unit.claimed.length, `${variant.id} ${unit.name}`).toBeGreaterThanOrEqual(
          unit.districts.length,
        );
        for (const fold of unit.folded) {
          expect(unit.districts, `${variant.id} ${unit.name}`).toContain(fold.into);
          expect(drawnDistricts, `${variant.id} ${fold.from}`).toContain(fold.into);
        }
      }
    }
    const l1 = variants.find((v) => v.id === 'l1');
    expect(l1?.counts['claimedDistricts']).toBe(13);
    expect(l1?.counts['drawnDistricts']).toBe(11);
    // L4 is the same property with a different arithmetic: Hazara Division is nine districts
    // today and Allai is one of them, created out of Battagram after the census. Named rather
    // than counted, because "9 claimed, 8 drawn" with no district attached to the difference is
    // exactly the miscount the footnote exists to prevent a reader from concluding.
    const l4 = variants.find((v) => v.id === 'l4');
    expect(l4?.counts['claimedDistricts']).toBe(9);
    expect(l4?.counts['drawnDistricts']).toBe(8);
    const hazara = l4?.units.find((u) => u.id === 'hazara') as EmittedUnit;
    expect(hazara.folded).toEqual([{ from: 'Allai', into: 'Batagram' }]);
    expect(hazara.claimed).toContain('Allai');
    expect(hazara.districts).not.toContain('Allai');
    expect(hazara.districts).toContain('Batagram');
  });

  it('says in words why a claim and a drawing disagree, on every variant where they do', () => {
    // Both counts printed is half the obligation; the other half is a footnote saying which
    // districts account for the difference. A variant that quietly drew fewer districts than its
    // advocates name would pass every partition check in this file.
    const unexplained = variants
      .filter((v) => v.counts['claimedDistricts'] !== v.counts['drawnDistricts'])
      .filter((v) => !v.footnotes.some((f) => f.kind === 'district-count'))
      .map((v) => `${v.id} draws ${v.counts['drawnDistricts']} of ${v.counts['claimedDistricts']} claimed districts and does not say why`);
    expect(unexplained).toEqual([]);
  });

  it('points every card cross-reference at a variant that is actually in the bundle', () => {
    // A note naming another proposal is a sentence on screen — "Bahawalpur's advocates reject
    // being folded into a single southern province" is only meaningful if the reader can reach
    // the proposal it means. The build refuses a dangling id; this holds the artifact to it.
    const dangling = variants.flatMap((variant) =>
      variant.notes.flatMap((note) =>
        (note.relatedVariants ?? [])
          .filter((related) => !variants.some((v) => v.id === related))
          .map((related) => `${variant.id} note "${note.label}" points at ${related}`),
      ),
    );
    expect(dangling).toEqual([]);

    // And the collision between L1 and H4 is wired both ways. One-sided, the card a reader
    // happens to open first reads as the uncontested one.
    const pointsAt = (from: string, to: string) =>
      (variants.find((v) => v.id === from) as EmittedVariant).notes.some((note) =>
        (note.relatedVariants ?? []).includes(to),
      );
    expect(pointsAt('l1', 'h4'), 'l1 -> h4').toBe(true);
    expect(pointsAt('h4', 'l1'), 'h4 -> l1').toBe(true);
  });

  it('never draws a district a unit says it excludes', () => {
    const contradictions = variants.flatMap((variant) =>
      variant.units.flatMap((unit) =>
        unit.excludes
          .filter((d) => unit.districts.includes(d))
          .map((d) => `${variant.id} "${unit.name}" both claims and excludes ${d}`),
      ),
    );
    expect(contradictions).toEqual([]);
  });

  it('nests the three readings of the Seraiki claim, each strictly inside the next', () => {
    // L1, L2 and L3 are one claim read three ways, and the whole editorial point is that they
    // differ only by what each adds. Asserted as containment rather than as three district lists,
    // because a list would pass while quietly dropping a district from the middle reading — and
    // the three cards say "L1 plus two" and "L2 plus three" in so many words.
    const drawnBy = (variant: string, unit: string) =>
      new Set(
        (variants.find((v) => v.id === variant) as EmittedVariant).units.find((u) => u.id === unit)!
          .districts,
      );
    const l1 = drawnBy('l1', 'south-punjab');
    const l2 = drawnBy('l2', 'south-punjab');
    const l3 = drawnBy('l3', 'saraikistan');

    expect([...l1].filter((d) => !l2.has(d)), 'L1 districts L2 drops').toEqual([]);
    expect([...l2].filter((d) => !l3.has(d)), 'L2 districts L3 drops').toEqual([]);
    expect([...l2].filter((d) => !l1.has(d)).sort()).toEqual(['Bhakkar', 'Mianwali']);
    expect([...l3].filter((d) => !l2.has(d)).sort()).toEqual(['Dera Ismail Khan', 'Tank']);

    // And the counts each card prints, claim against drawing. Paharpur is L3's own fold, on top
    // of the Taunsa and Kot Addu the other two already carry.
    const counts = (id: string) => {
      const v = variants.find((x) => x.id === id) as EmittedVariant;
      return [v.counts['claimedDistricts'], v.counts['drawnDistricts']];
    };
    expect(counts('l1')).toEqual([13, 11]);
    expect(counts('l2')).toEqual([15, 13]);
    expect(counts('l3')).toEqual([18, 15]);
  });

  it('draws L3 across a provincial boundary, and holds the Waziristans out of it by name', () => {
    // The one proposal in the bundle whose unit is not carved from inside a single province — and
    // the reason the project moved to district resolution. At division resolution Saraikistan
    // would have enclosed South Waziristan, which the census shades Pushto at 98%, inside a
    // Seraiki province the movement has never drawn that way.
    const l3 = variants.find((v) => v.id === 'l3') as EmittedVariant;
    const saraikistan = l3.units.find((u) => u.id === 'saraikistan') as EmittedUnit;
    const home = new Map<string, string>(
      ROSTER.flatMap((p) => p.districts.map((d) => [d, p.name] as const)),
    );

    expect(new Set(saraikistan.districts.map((d) => home.get(d)))).toEqual(
      new Set(['Punjab', 'Khyber Pakhtunkhwa']),
    );

    // The exclusion is not decoration: both post-census halves of South Waziristan resolve onto
    // the one district the map draws, that district is drawn, and it is drawn by somebody else.
    expect(saraikistan.excludes).toEqual(['South Waziristan']);
    expect(drawnDistricts).toContain('South Waziristan');
    const holder = l3.units.find((u) => u.districts.includes('South Waziristan'));
    expect(holder?.id).toBe('khyber-pakhtunkhwa');

    // Among the claims this app *transcribes*, only L3 crosses — and *crossing* means taking part
    // of one province and part of another. Merging provinces whole is a different act and H1 does
    // it to five of them: West Pakistan spans the country and cuts through nothing. The derived
    // variants are excluded by construction rather than by exception: L7 assigns districts by
    // language and has never heard of a province, so it crosses in seven places, and that is
    // asserted below rather than waived here.
    const size = new Map(ROSTER.map((p) => [p.name, p.districts.length]));
    const partiallyTaken = (unit: EmittedUnit) => {
      const byProvince = new Map<string, number>();
      for (const district of unit.districts) {
        const province = home.get(district) as string;
        byProvince.set(province, (byProvince.get(province) ?? 0) + 1);
      }
      return [...byProvince].filter(([province, taken]) => taken < (size.get(province) as number));
    };
    const crossingIn = (chosen: readonly EmittedVariant[]) =>
      chosen.flatMap((variant) =>
        variant.units
          .filter((unit) => unit.kind === 'proposed')
          .filter((unit) => partiallyTaken(unit).length > 1)
          .map((unit) => `${variant.id} ${unit.id}`),
      );
    expect(crossingIn(variants.filter((v) => v.composition.kind === 'transcribed'))).toEqual([
      'l3 saraikistan',
    ]);

    // And the derived side, said rather than excluded. A rule stated in mother tongue does not
    // know where a provincial boundary runs, so most of its regions straddle one — which is the
    // most informative thing L7 has to say, and would be invisible if this test simply skipped it.
    expect(crossingIn(variants.filter((v) => v.id === 'l7')).length).toBeGreaterThan(1);
  });

  it('re-derives the two variants nobody published a district list for', () => {
    // L6 and L7 are the only boundaries in the bundle this build drew itself, so they are the only
    // ones a reader cannot check against somebody's document. What replaces that check is this:
    // the rule is re-run here, from the committed census and the committed graph, and compared
    // district by district against what shipped. A derived line nothing re-derives is an editorial
    // opinion wearing a `derived` badge.
    const dominant = dominantTongues(
      statistics as { districts: Record<string, { motherTongue?: { dominant?: unknown } }> },
    );
    const populations = new Map<string, number>(
      Object.entries(statistics.districts as Record<string, { population: number }>).map(
        ([district, record]) => [district, record.population],
      ),
    );
    // The committed graph, which `adjacency` is re-derived from the arcs and compared against
    // further down this file — so a re-derivation here stands on a graph the suite has checked.
    const borders: AdjacencyGraph = new Map(
      Object.entries(adjacency.neighbours as Record<string, string[]>),
    );

    const l7 = variants.find((v) => v.id === 'l7') as EmittedVariant;
    const rerun = partitionByDominantLanguage({
      districts: Object.keys(statistics.districts),
      graph: borders,
      dominant,
      populations,
    });
    expect(rerun.problems).toEqual([]);

    const shipped = new Map(
      l7.units.filter((u) => u.kind === 'proposed').map((u) => [u.name, [...u.districts].sort()]),
    );
    const derived = new Map(
      (rerun.partition?.regions ?? []).map((r) => [r.name, [...r.districts].sort()]),
    );
    // Chitral is the one unit the rule does not produce — it is what the rule could not reach —
    // so it is compared against `unnamed` rather than against a region.
    expect(shipped.get('Chitral')).toEqual([...(rerun.partition?.unnamed ?? [])].sort());
    shipped.delete('Chitral');
    expect([...shipped.keys()].sort()).toEqual([...derived.keys()].sort());
    for (const [name, districts] of shipped) {
      expect(districts, `l7 ${name}`).toEqual(derived.get(name));
    }

    // L6 is the Pashto region of the same rule run over Balochistan alone, and the census's own
    // spelling of the category is what the rule sorts by.
    const balochistan = ROSTER.find((p) => p.name === 'Balochistan')?.districts ?? [];
    const inBalochistan = partitionByDominantLanguage({
      districts: balochistan,
      graph: borders,
      dominant,
      populations,
    });
    const pashto = (inBalochistan.partition?.regions ?? []).filter((r) => r.language === 'Pushto');
    expect(pashto, 'one region, or the claim names two places').toHaveLength(1);

    const l6 = variants.find((v) => v.id === 'l6') as EmittedVariant;
    const southern = l6.units.find((u) => u.id === 'southern-pakhtunkhwa') as EmittedUnit;
    expect([...southern.districts].sort()).toEqual([...(pashto[0]?.districts ?? [])].sort());
    // Named rather than counted: these are the districts the census excludes from the claim, and
    // they are the ones a reader checks the line against on an atlas.
    expect(southern.districts).not.toContain('Mastung');
    expect(southern.districts).toContain('Quetta');
    expect(southern.districts).toHaveLength(12);
  });

  it('says on both derived cards that the line was drawn from data, not copied', () => {
    // The obligation the `derived` badge creates. Held over every derived variant rather than over
    // the two by name, so a third one cannot ship without the sentence that makes it honest.
    const unexplained = variants
      .filter((v) => v.composition.kind === 'derived')
      .filter(
        (v) =>
          !v.footnotes.some((f) => f.kind === 'derived-boundary') ||
          !v.badges.some((b) => b === 'derived' || b === 'synthesized'),
      )
      .map((v) => v.id);
    expect(unexplained).toEqual([]);
    // Named rather than counted: the six boundaries in this bundle that nobody published. Two are
    // the mother-tongue rule's (#26) and four are the administrative engine's (#27, #28), and a
    // seventh appearing here without the sentence and the badge would be caught above.
    expect(variants.filter((v) => v.composition.kind === 'derived').map((v) => v.id)).toEqual([
      'l6',
      'l7',
      'a1',
      'a2',
      'a3',
      'a4',
    ]);

    // L6 names both readings of its claim, because the territory is the same either way and a
    // card that named one would report half a demand.
    const l6 = variants.find((v) => v.id === 'l6') as EmittedVariant;
    const words = l6.footnotes.map((f) => f.text).join('\n');
    expect(words).toMatch(/Khyber Pakhtunkhwa/);
    expect(words).toMatch(/Southern Pakhtunkhwa/);

    // L7 is the one variant nobody advocates, and it says so in its own words rather than
    // shipping an empty list.
    const l7 = variants.find((v) => v.id === 'l7') as EmittedVariant;
    expect(l7.advocacy.kind).toBe('unadvocated');
    expect(l7.opposedBy.length).toBeGreaterThan(0);
    // And it points at the attributed claims its output resembles, rather than taking credit.
    expect(l7.notes.flatMap((n) => n.relatedVariants ?? []).sort()).toEqual([
      'l1',
      'l4',
      'l5',
      'l6',
    ]);
  });

  it('says on the card what is contested about the two wider Seraiki readings', () => {
    // Both are things a reader can see on the map and would otherwise have to guess the meaning
    // of: two districts inside the line whose own politics reject it, and a line that leaves one
    // province and enters another. Asserted on the footnote text because that is the sentence
    // that ships, not on a flag that stands in for it.
    const footnote = (id: string, kind: string) =>
      (variants.find((v) => v.id === id) as EmittedVariant).footnotes.find((f) => f.kind === kind)
        ?.text ?? '';

    const contested = footnote('l2', 'contested-edge');
    expect(contested).toMatch(/Mianwali/);
    expect(contested).toMatch(/Bhakkar/);

    const crosses = variants
      .find((v) => v.id === 'l3')!
      .footnotes.map((f) => f.text)
      .join('\n');
    expect(crosses).toMatch(/Khyber Pakhtunkhwa/);
    expect(crosses).toMatch(/South Waziristan/);
  });

  it('carries every field the variant card renders, on every variant', () => {
    for (const variant of variants) {
      expect(variant.name, variant.id).toBeTruthy();
      expect(variant.rationale, variant.id).toBeTruthy();
      expect(variant.status, variant.id).toBeTruthy();
      expect(variant.badges.length, variant.id).toBeGreaterThan(0);
      expect(variant.sources.length, variant.id).toBeGreaterThan(0);
      expect(Object.keys(scenarios.bases), variant.id).toContain(variant.basis);
      expect(variant.counts['units'], variant.id).toBe(variant.units.length);
      // A variant nobody proposes says so; it never carries an empty advocacy list.
      if (variant.advocacy.kind === 'advocated') {
        expect(variant.advocacy.by.length, variant.id).toBeGreaterThan(0);
      } else {
        expect(variant.advocacy.note, variant.id).toBeTruthy();
      }
    }
  });

  it('carries an "Opposed by" line on every variant, without exception', () => {
    // The one card field that is load-bearing for the app's own neutrality: without it, whatever
    // is on screen reads as the app's position.
    const silent = variants.filter((v) => v.opposedBy.length === 0).map((v) => v.id);
    expect(silent).toEqual([]);
  });

  it('uses badges from the closed provenance vocabulary and nothing else', () => {
    const allowed = ['official', 'census', 'proxy', 'derived', 'documented', 'synthesized'];
    const strange = variants.flatMap((v) =>
      v.badges.filter((b) => !allowed.includes(b)).map((b) => `${v.id}: ${b}`),
    );
    expect(strange).toEqual([]);
  });

  it('keeps variant ids unique, so a deep link resolves to one scenario', () => {
    const ids = variants.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const variant of variants) {
      const unitIds = variant.units.map((u) => u.id);
      expect(new Set(unitIds).size, variant.id).toBe(unitIds.length);
    }
  });
});

/**
 * The Administrative basis (#28), held to the two things it claims about itself.
 *
 * A1 to A4 are boundaries this build computed, so the check that replaces "look it up in their
 * document" is the same one L6 and L7 get: the rule is re-run here from the committed census, the
 * committed borders and the committed geometry, and compared unit by unit against what shipped. A
 * derived line nothing re-derives is an editorial opinion wearing a `derived` badge.
 *
 * A5 is the opposite kind of variant and gets the opposite kind of test: it is asserted to have
 * changed *nothing* — no district in a different unit, no boundary redrawn, both territories
 * still uncounted — because that is the entire content of the proposal.
 */
describe('bundle administrative variants', () => {
  const graph: AdjacencyGraph = new Map(
    Object.entries(adjacency.neighbours as Record<string, string[]>),
  );
  const populations = new Map<string, number>(
    Object.entries(statistics.districts as Record<string, { population: number }>).map(
      ([district, record]) => [district, record.population],
    ),
  );
  const centroids = districtCentroids(bundle as Topology);
  const rerun = (rule: PartitionRule) => {
    const { partition, problems } = partitionByRule(rule, {
      scope: CENSUS_DISTRICTS,
      neighbours: graph,
      populations,
      centroids,
    });
    // Labelled with the rule, because four maps are re-drawn here and a bare empty-array failure
    // would say a partition refused something without saying which one.
    expect({ rule: rule.kind, problems }).toEqual({ rule: rule.kind, problems: [] });
    if (partition === null) throw new Error(`${rule.kind} drew nothing`);
    return partition;
  };

  /** Each rule-drawn variant, against the rule it says it was drawn by. */
  const RULES: readonly (readonly [string, PartitionRule])[] = [
    ['a1', { kind: 'population-ceiling', ceiling: 25_000_000 }],
    ['a2', { kind: 'unit-count', units: 12 }],
    ['a3', { kind: 'unit-count', units: 14 }],
    ['a4', { kind: 'distance-to-capital', km: 300 }],
  ];

  it('re-draws all four rule-drawn maps and finds the districts that shipped', () => {
    for (const [id, rule] of RULES) {
      const variant = variants.find((v) => v.id === id) as EmittedVariant;
      const partition = rerun(rule);
      const shipped = new Map(
        variant.units.filter((u) => u.kind === 'proposed').map((u) => [u.name, [...u.districts].sort()]),
      );
      const derived = new Map(partition.units.map((u) => [u.name, [...u.districts].sort()]));
      expect([...shipped.keys()].sort(), id).toEqual([...derived.keys()].sort());
      for (const [name, districts] of shipped) {
        expect(districts, `${id} ${name}`).toEqual(derived.get(name));
      }
      // And the rule statement on the card is the engine's own, not a paraphrase of it that can
      // drift away from the arithmetic it describes.
      expect(variant.composition.kind, id).toBe('derived');
      if (variant.composition.kind === 'derived') {
        expect(variant.composition.rule, id).toBe(partition.statement);
      }
    }
  });

  it('states the number of units, and states it as a finding where it is one', () => {
    // Two of the four rules are given a count and two find one. A card that printed "12 units"
    // under a ceiling would present an outcome as an instruction, which is the whole difference
    // between a rule a reader can check and a number they have to take.
    const rule = (id: string): string => {
      const variant = variants.find((v) => v.id === id) as EmittedVariant;
      return variant.composition.kind === 'derived' ? variant.composition.rule : '';
    };
    expect(rule('a1')).toContain('No unit above 25,000,000 people; 16 units is the fewest');
    expect(rule('a4')).toContain('10 units is the fewest');
    expect(rule('a2')).toContain('12 units.');
    expect(rule('a3')).toContain('14 units.');
    // The two seedings are named apart, because they answer different questions and the choice of
    // capital is the one choice the engine makes.
    expect(rule('a1')).toContain('no two of them sharing a border');
    expect(rule('a4')).toContain('as far as possible from the capitals already chosen');
  });

  it('trades population parity away and never contiguity, which is what the four are for', () => {
    // The finding, asserted rather than described. Contiguity costs nothing under any of these
    // rules — a unit is grown across shared borders and cannot be in two pieces — so the number
    // that actually moves between them is the spread, and it moves by a factor of thirty.
    const ratio = (id: string): number => {
      const found = (variants.find((v) => v.id === id) as EmittedVariant).scorecard.population;
      if (found?.ratio == null) throw new Error(`${id} has no ratio`);
      return found.ratio;
    };
    for (const [id] of RULES) {
      expect((variants.find((v) => v.id === id) as EmittedVariant).counts['nonContiguousUnits'], id).toBe(0);
    }
    // A ceiling binds the largest unit directly and is the most even; a count only bounds the
    // average, and fourteen is less even than twelve; a distance rule abandons parity outright.
    expect(ratio('a1')).toBeLessThan(ratio('a2'));
    expect(ratio('a2')).toBeLessThan(ratio('a3'));
    expect(ratio('a4')).toBeGreaterThan(20 * ratio('a1'));
  });

  it('measures A4’s limit again from the committed geometry, district by district', () => {
    const a4 = variants.find((v) => v.id === 'a4') as EmittedVariant;
    const capitals = new Map(rerun(RULES[3]?.[1] as PartitionRule).units.map((u) => [u.name, u.capital]));
    const far = a4.units
      .filter((unit) => unit.kind === 'proposed')
      .flatMap((unit) => {
        const capital = capitals.get(unit.name) as string;
        return unit.districts
          .map((district) => ({
            district,
            km: haversineKm(
              centroids.get(capital) as Centroid,
              centroids.get(district) as Centroid,
            ),
          }))
          .filter((found) => found.km > 300)
          .map((found) => `${found.district} is ${Math.round(found.km)} km from ${capital}`);
      });
    expect(far).toEqual([]);
    // The figure the card quotes, checked against the geometry it is quoted from rather than
    // against itself: Gwadar to Quetta is what the rule is arguing about.
    expect(
      Math.round(
        haversineKm(centroids.get('Gwadar') as Centroid, centroids.get('Quetta') as Centroid),
      ),
    ).toBe(635);
    expect(a4.rationale).toContain('635 kilometres from Quetta');
  });

  it('leaves every district exactly where it was in A5, which is the whole proposal', () => {
    // The one variant in the app of which this is true. Nothing is carved, nothing merged, and
    // both territories are still outside the census — so what the card argues for is a word in
    // the Constitution, and the scorecard has to say so rather than reporting a redraw.
    const a5 = variants.find((v) => v.id === 'a5') as EmittedVariant;
    expect(a5.scorecard.districtsMoved.count).toBe(0);
    expect(a5.scorecard.districtsMoved.byOrigin).toEqual([]);
    expect(a5.scorecard.districtsMoved.of).toBe(ROSTER_DISTRICT_COUNT);
    expect(variants.filter((v) => v.scorecard.districtsMoved.count === 0).map((v) => v.id)).toEqual([
      'a5',
    ]);

    // Every unit is exactly one of today's first-level entities, holding exactly its districts.
    const today = new Map(ROSTER.map((province) => [province.name, [...province.districts].sort()]));
    for (const unit of a5.units) {
      expect([...unit.districts].sort(), unit.name).toEqual(today.get(unit.name));
    }
    expect(a5.units.map((u) => u.name).sort()).toEqual([...today.keys()].sort());
  });

  it('draws the two territories as proposed provinces and still gives them no population', () => {
    // The two halves of A5 that have to hold together. They are `proposed`, because a card
    // arguing for provincial status over a map that went on calling them territories would be
    // arguing with itself — and they still carry no figure, because PBS published none (D25) and
    // calling a territory a province does not conjure one. Set aside by name, never as a zero.
    const a5 = variants.find((v) => v.id === 'a5') as EmittedVariant;
    const promoted = a5.units.filter((u) => u.kind === 'proposed');
    expect(promoted.map((u) => u.name)).toEqual(['Gilgit-Baltistan', 'Azad Jammu & Kashmir']);
    for (const unit of promoted) {
      expect(unit.population, unit.name).toBeNull();
      expect(unit.uncounted, unit.name).toHaveLength(10);
    }
    expect(a5.scorecard.outsideTheCensus.map((u) => u.name)).toEqual([
      'Gilgit-Baltistan',
      'Azad Jammu & Kashmir',
    ]);
    // A gap in a unit voids a variant's figures; the census's own coverage does not. A5 is the
    // second kind, so the spread is over the five units that are inside the census.
    expect(a5.scorecard.populationWithheld).toBeNull();
    expect(a5.scorecard.population?.units).toBe(5);
  });

  it('says on A5’s card that the two halves are not equally sourced', () => {
    // The thing this card could most easily get wrong. Gilgit-Baltistan has a dated announcement,
    // a drafted amendment and a resolution of its own assembly; Azad Jammu & Kashmir has none of
    // the three, and drawing the two the same and saying nothing would report a weaker claim as
    // an equal one.
    const a5 = variants.find((v) => v.id === 'a5') as EmittedVariant;
    const words = `${a5.status}\n${a5.footnotes.map((f) => f.text).join('\n')}`;
    expect(words).toContain('1 November 2020');
    expect(words).toMatch(/Legislative Assembly/);
    expect(words).toMatch(/Interim Constitution Act/);
    expect(words).toMatch(/none of the three/);
    // India's rejection is the opposition line the ticket names, and it is not the only one.
    expect(a5.opposedBy.join('\n')).toMatch(/^India, which rejects/m);
    expect(a5.opposedBy.length).toBeGreaterThan(1);
    // And the ceasefire line is unchanged here, said on the card as well as held in `units.test.ts`
    // against the arcs: a variant that promoted these two and then drew a solid province boundary
    // along the Line of Control would settle by rendering the question the proposal leaves open.
    expect(a5.footnotes.map((f) => f.text).join('\n')).toMatch(/dashed and labelled/);
    // Transcribed, not derived — this boundary is nobody's arithmetic, least of all ours.
    expect(a5.composition.kind).toBe('transcribed');
    expect(a5.badges).toEqual(['documented']);
  });

  it('carries the whole basis, and every variant of it argues at the census’s vintage', () => {
    const administrative = variants.filter((v) => v.basis === 'administrative');
    expect(administrative.map((v) => v.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
    // None of the five dates its own boundary: the four rule-drawn ones read the 2023 census and
    // the fifth draws the district set as it stands, so all five are argued at the basis's vintage
    // and none prints a date of its own.
    expect(administrative.filter((v) => v.vintage !== undefined)).toEqual([]);
    expect(scenarios.bases.administrative.vintage).toBe(scenarios.provenance.vintage);
  });
});

/**
 * H2 — the provinces and the acceding princely states, 1947 to 1955 (#30).
 *
 * The variant that publishes no population figure at all, and the only one in the app of which that
 * is true. Everything below is a consequence of that or of the fact that what it draws is older
 * than the districts it is drawn out of, so both are asserted rather than described.
 */
describe('bundle H2, the map with no figures on it', () => {
  const h2 = () => variants.find((v) => v.id === 'h2') as EmittedVariant;

  it('draws each mappable princely state as its own unit, and nothing else as one', () => {
    // The eleven the ticket names. Held as an exact list rather than a count, because a state added
    // or lost is a change to what this map claims existed in 1947.
    const states = h2()
      .units.filter((unit) => unit.kind === 'proposed')
      .map((unit) => unit.name);
    expect(states).toEqual([
      'Bahawalpur',
      'Khairpur',
      'Kalat',
      'Las Bela',
      'Kharan',
      'Makran',
      'Swat',
      'Dir',
      'Chitral',
      'Hunza',
      'Nagar',
      // Not a state: the province under the name it carried until 2010, smaller than Khyber
      // Pakhtunkhwa by the three Malakand states, exactly as H3 draws it.
      'North-West Frontier Province',
    ]);
    // And it is a complete partition of everything drawn, like every other variant (D6).
    expect(h2().partition.universe).toBe('drawn');
    expect(h2().partition.districts).toBe(ROSTER_DISTRICT_COUNT);
  });

  it('names Amb and Phulra as omitted, and says why rather than dropping them silently', () => {
    // The app's standing refusal: what cannot be drawn from a source is named, never approximated.
    // Both states acceded and neither is the size of a district, so drawing either would mean
    // inventing a boundary inside a district this map draws whole.
    const omission = h2().footnotes.filter((note) => note.kind === 'omission');
    expect(omission).toHaveLength(1);
    const text = omission[0]?.text ?? '';
    expect(text).toMatch(/Amb/);
    expect(text).toMatch(/Phulra/);
    expect(text).toMatch(/smaller than any district/);
    expect(text).toMatch(/Mansehra and Haripur/);
  });

  it('carries no population figure anywhere — not a unit, not a total, not a spread', () => {
    // The ticket's hard rule, and the reason the variant needed one: 2023 figures describe none of
    // the units drawn here. Asserted at all three places a figure could appear.
    const variant = h2();
    expect(variant.statistics.modernFigures).toBe(false);
    expect(variant.scorecard.population).toBeNull();
    expect(variant.scorecard.populationWithheld).toEqual({
      kind: 'variant',
      reason: expect.stringContaining('1947'),
    });
    for (const unit of variant.units) {
      expect(unit.population, unit.name).toBeNull();
    }
    // The census-independent lines survive it: a variant that withheld its unit count as well
    // would have nothing left to be judged on.
    expect(variant.scorecard.units).toBe(17);
    expect(variant.scorecard.districtsMoved.of).toBe(ROSTER_DISTRICT_COUNT);
  });

  it('is voided by its own judgement, not by a gap in the census', () => {
    // The two absences the scorecard keeps apart. H2 withholds; it does not reach into ground PBS
    // did not publish and come up short. The territories are still set aside by name, because that
    // is true of them whatever this variant decides about figures.
    const scorecard = h2().scorecard;
    expect(scorecard.populationWithheld?.kind).toBe('variant');
    expect(scorecard.outsideTheCensus.map((unit) => unit.name)).toEqual([
      'Hunza',
      'Nagar',
      'Gilgit Agency and Baltistan',
      'Azad Jammu & Kashmir',
    ]);
  });

  it('dates itself, because its basis declares a rule for finding a date and not a date', () => {
    // The Historical basis defers ("stated per variant, not shared"), so a variant here that stated
    // nothing would print that deferral where a date belongs — which is what #32 caught for H1, H3
    // and H4. H2's own date is the period the arrangement stood, not a day, because the accessions
    // and the abolitions are both spread over years.
    const vintage = h2().vintage ?? '';
    expect(vintage).toMatch(/1947/);
    expect(vintage).toMatch(/1955/);
    expect(vintage).not.toBe(scenarios.provenance.vintage);
    expect(vintage).not.toBe(scenarios.bases.historical.vintage);
  });

  it('shows when the states acceded, and cites the instruments that did it', () => {
    // "Accession dates and sources are shown" — on the units, where a reader meets each state, and
    // in the sources, which is where the claim is answerable.
    const dated = h2().units.filter((unit) => /acceded/i.test(unit.note ?? ''));
    expect(dated.map((unit) => unit.name)).toEqual([
      'Bahawalpur',
      'Khairpur',
      'Kalat',
      'Las Bela',
      'Kharan',
      'Makran',
      'Swat',
      'Dir',
      'Chitral',
      'Hunza',
      'Nagar',
    ]);
    const sources = h2().sources.map((source) => source.label).join('\n');
    expect(sources).toMatch(/Instruments of Accession/);
    expect(sources).toMatch(/27 March 1948/);
    expect(sources).toMatch(/Establishment of West Pakistan Act, 1955/);
  });

  it('prints both district counts where a post-census fold makes them differ', () => {
    // Five states are stated in more districts than are drawn (ADR-0001), so the card owes both
    // numbers and the fold that explains them — the same treatment South Punjab's 13-for-11 gets.
    const folded = h2()
      .units.filter((unit) => unit.claimed.length !== unit.districts.length)
      .map((unit) => `${unit.name} ${unit.claimed.length}/${unit.districts.length}`);
    expect(folded).toEqual([
      'Kalat 4/3',
      'Las Bela 2/1',
      'Makran 4/3',
      'Swat 4/3',
      'Dir 3/2',
    ]);
    const footnote = h2().footnotes.find((note) => note.kind === 'district-count')?.text ?? '';
    for (const fold of ['Wadh', 'Tump', 'Upper Swat', 'Central Dir', 'Hub']) {
      expect(footnote, fold).toMatch(new RegExp(fold));
    }
  });

  it('accounts for every district it calls moved, since almost none of it changes hands', () => {
    // 59 of 156, and the card decomposes it because the bare figure reads as a redraw. The states
    // are the only group that is really ground held by something other than a province; the rest
    // is this map using the names of 1947, which the "moved" rule counts because it decides what
    // carries a unit forward on the unit's name. The footnote states the four numbers, and they
    // are checked here against the partition rather than against themselves.
    const variant = h2();
    const districtsOf = (name: string) =>
      variant.units.find((unit) => unit.name === name)?.districts.length ?? 0;
    const states = variant.units
      .filter((unit) => unit.kind === 'proposed' && unit.name !== 'North-West Frontier Province')
      .reduce((n, unit) => n + unit.districts.length, 0);
    expect(states).toBe(22);
    expect(districtsOf('North-West Frontier Province')).toBe(28);
    expect(districtsOf('Gilgit Agency and Baltistan')).toBe(8);
    expect(variant.scorecard.districtsMoved.count).toBe(states + 28 + 8 + 1);
    expect(variant.scorecard.districtsMoved.count).toBe(59);

    // Azad Jammu & Kashmir keeps its own name and its own ten districts, so it moves nothing —
    // which is what makes the figure a statement about naming rather than about territory.
    expect(
      variant.scorecard.districtsMoved.byOrigin.find((o) => o.from === 'Azad Jammu & Kashmir'),
    ).toBeUndefined();

    const footnote = variant.footnotes.map((note) => note.text).join('\n');
    for (const figure of ['59', '22', '28', '8']) {
      expect(footnote, figure).toMatch(new RegExp(`\\b${figure}\\b`));
    }
  });

  it('says that nobody proposes it, and is opposed anyway', () => {
    // Like H1 and L7: a demarcation that existed is not a proposal, and an empty advocacy list
    // would read as an oversight rather than as the fact it is. The opposition line is still
    // required — without one the app reads as advocating whatever is on screen.
    expect(h2().advocacy.kind).toBe('unadvocated');
    expect(h2().opposedBy.length).toBeGreaterThan(1);
    // The accession of Kalat is itself disputed, and drawing the state states a settlement.
    expect(h2().opposedBy.join('\n')).toMatch(/Kalat/);
  });

  it('wires its collision with the Bahawalpur restoration both ways', () => {
    // H2 draws Bahawalpur as the state it was; H4 argues for it as a province today. A collision
    // only one card knows about reads as neutral from the other.
    const pointsAt = (from: string, to: string) =>
      (variants.find((v) => v.id === from) as EmittedVariant).notes.some((note) =>
        (note.relatedVariants ?? []).includes(to),
      );
    expect(pointsAt('h2', 'h4'), 'h2 -> h4').toBe(true);
    expect(pointsAt('h4', 'h2'), 'h4 -> h2').toBe(true);
  });
});

/**
 * The dissolved unit outlines (#15), checked against the districts they were cut from.
 *
 * `unit-outlines.test.ts` holds the arithmetic on a topology of three squares. This is the same
 * arithmetic over the artifact that ships and the geometry it ships against — 156 real districts,
 * a coastline, and a unit whose claim crosses three divisions.
 *
 * The file carries no arcs of its own: its indices are into `geography.topojson.json`, which is
 * why the first thing asserted is that the two were built from the same arcs. An index that has
 * come to mean a different edge is invisible until a boundary is drawn in the wrong place.
 */
interface EmittedOutline {
  readonly type: 'MultiPolygon';
  readonly arcs: number[][][];
  readonly properties: {
    readonly variant: string;
    readonly unit: string;
    readonly name: string;
    readonly kind: string;
    readonly districts: number;
    readonly polygons: number;
    readonly areaKm2: number;
  };
}

const districtGeometries = new Map<string, PolygonalGeometry>(
  (bundle.objects.districts.geometries as { properties: { name: string } }[]).map((geometry) => [
    geometry.properties.name,
    geometry as unknown as PolygonalGeometry,
  ]),
);

const outlinesOf = (variantId: string): EmittedOutline[] =>
  (outlines.objects[variantId]?.geometries ?? []) as EmittedOutline[];

/** Every unit of every variant, paired with the district geometry it claims. */
const dissolved = variants.flatMap((variant) =>
  variant.units.map((unit) => {
    const outline = outlinesOf(variant.id).find((o) => o.properties.unit === unit.id);
    return {
      label: `${variant.id} "${unit.name}"`,
      unit,
      outline,
      members: unit.districts.flatMap((district) => {
        const geometry = districtGeometries.get(district);
        return geometry === undefined ? [] : [geometry];
      }),
    };
  }),
);

describe('bundle unit outlines', () => {
  it('ships one outline per unit of every variant, and nothing for anything else', () => {
    const missing = dissolved.filter((d) => d.outline === undefined).map((d) => d.label);
    expect(missing).toEqual([]);

    expect(new Set(Object.keys(outlines.objects))).toEqual(new Set(variants.map((v) => v.id)));
    for (const variant of variants) {
      expect(
        outlinesOf(variant.id)
          .map((o) => o.properties.unit)
          .sort(),
      ).toEqual(variant.units.map((u) => u.id).sort());
    }
  });

  it('cuts its arcs against the geometry that ships beside it, not some other build', () => {
    // The two artifacts are one geometry split across two files: the outlines are arc indices and
    // nothing else. Rebuilding the geography without rebuilding the outlines is the failure mode,
    // and it is silent — every index still resolves, to whatever edge now holds that position.
    expect(outlines.provenance.arcsFrom).toBe('data/bundle/geography.topojson.json');
    expect(outlines.provenance.geography.generated).toBe(bundle.provenance.generated);
    expect(outlines.provenance.geography.arcs).toBe(bundle.arcs.length);
    expect(outlines.provenance.geography.bbox).toEqual(bundle.bbox);

    const outOfRange = dissolved.flatMap(({ label, outline }) =>
      arcsOf(outline as unknown as PolygonalGeometry)
        .filter((arc) => arc >= (bundle.arcs as unknown[]).length)
        .map((arc) => `${label} references arc ${arc}`),
    );
    expect(outOfRange).toEqual([]);
  });

  it('draws every unit as exactly the union of the districts it claims', () => {
    // The acceptance criterion of #15, over the whole shipped set: arcs, area and ring closure
    // together. Reported as a flat list of sentences, each naming its unit, so a broken dissolve
    // says which proposal is drawn wrong rather than that one of them is.
    const problems = dissolved.flatMap(({ label, members, outline }) =>
      outlineProblems(label, bundle, members, outline as never),
    );
    expect(problems).toEqual([]);
  });

  it('removes the district borders inside a unit and keeps only its outside edge', () => {
    // Re-derived here rather than taken from the artifact: the arcs a unit's districts share are
    // computable from the geography alone, and the outline has to be their complement exactly.
    // Anything left in is a district line drawn inside a province; anything missing is a gap.
    for (const { label, members, outline } of dissolved) {
      expect(arcsOf(outline as unknown as PolygonalGeometry), label).toEqual(boundaryArcs(members));
    }

    // South Punjab is the case worth naming: eleven districts across three divisions, so there is
    // a great deal of internal border for a dissolve to get wrong.
    const southPunjab = dissolved.find((d) => d.unit.name === 'South Punjab');
    expect(southPunjab).toBeDefined();
    const interior = interiorArcs(southPunjab!.members);
    expect(interior.length).toBeGreaterThan(10);
    const survived = arcsOf(southPunjab!.outline as unknown as PolygonalGeometry).filter((arc) =>
      interior.includes(arc),
    );
    expect(survived).toEqual([]);
  });

  it('measures the same ground dissolved as it does district by district', () => {
    // The reading the arc check cannot make: a dissolve of ten districts out of eleven is
    // perfectly well formed and simply smaller. Quoted in km² because that is what a reader can
    // check against the district figures in this same file.
    for (const { label, members, outline } of dissolved) {
      const union = members.reduce((sum, member) => sum + areaKm2(bundle, member), 0);
      expect(
        areaKm2(bundle, outline as unknown as PolygonalGeometry) / union,
        label,
      ).toBeCloseTo(1, 9);
    }
  });

  it('covers each variant’s whole district set once, with no ground gained or lost', () => {
    for (const variant of variants) {
      const outlineArea = outlinesOf(variant.id).reduce(
        (sum, outline) => sum + areaKm2(bundle, outline as unknown as PolygonalGeometry),
        0,
      );
      const universeArea = universeDistricts(variant.partition.universe).reduce(
        (sum, district) =>
          sum + areaKm2(bundle, districtGeometries.get(district) as PolygonalGeometry),
        0,
      );
      expect(outlineArea / universeArea, variant.id).toBeCloseTo(1, 9);
    }
  });

  it('closes every ring of every outline', () => {
    const torn = dissolved.flatMap(({ label, outline }) =>
      unclosedRings(bundle, outline as never).map((ring) => `${label} ${ring}`),
    );
    expect(torn).toEqual([]);
  });

  it('draws a unit of non-adjacent districts as several pieces, without error', () => {
    // No variant yet proposes a unit whose districts do not touch, and contiguity is flagged and
    // never blocked (D7), so the property is held over the real topology with two districts that
    // could not be further apart: Lower Chitral on the Afghan border and Karachi South on the sea.
    const apart = ['Lower Chitral', 'Karachi South'].map(
      (name) => districtGeometries.get(name) as PolygonalGeometry,
    );
    const outline = dissolve(bundle, apart);

    // Sharing no arc, the two dissolve to as many pieces as they brought — which is nine, not
    // two, because Karachi South keeps its offshore islands as pieces of their own once the
    // coastline clip has taken the water away. That is the reason `polygons` is not a contiguity
    // measure, said in the one place the difference is visible.
    expect(polygonsOf(outline)).toBe(
      apart.reduce((sum, district) => sum + polygonsOf(district as never), 0),
    );
    expect(polygonsOf(outline)).toBeGreaterThan(1);
    expect(interiorArcs(apart)).toEqual([]);
    expect(outlineProblems('two districts apart', bundle, apart, outline)).toEqual([]);
  });

  it('records a polygon count and an area the committed geometry actually has', () => {
    // Rendered provenance, under the project's no-unsourced-surface rule: both numbers are read
    // off the artifact by anything that wants them, so they are re-measured here rather than
    // trusted. `polygons` is a drawing fact and not a contiguity one — South Punjab draws as
    // three pieces because Rahim Yar Khan is three in OSM, two of them under 200 km².
    for (const { label, outline } of dissolved) {
      const geometry = outline as unknown as PolygonalGeometry;
      expect(outline!.properties.polygons, label).toBe(polygonsOf(outline as never));
      expect(outline!.properties.areaKm2, label).toBe(Math.round(areaKm2(bundle, geometry)));
    }
    const southPunjab = dissolved.find((d) => d.unit.name === 'South Punjab');
    expect(southPunjab!.outline!.properties.polygons).toBe(3);
  });

  it('states the floating-point allowance its own check was made to', () => {
    expect(outlines.provenance.validation.areaAgreement).toBe(AREA_AGREEMENT);
    expect(outlines.provenance.counts.units).toBe(dissolved.length);
  });
});

/**
 * The district adjacency graph (#16), checked against the geometry it was derived from.
 *
 * `adjacency.test.ts` holds the derivation on three squares, and holds the case this file cannot
 * show: a unit in two pieces. Nothing in the committed set is one. So what is held here is that
 * the shipped graph *is* the shipped geometry's — re-derived rather than read back — and that the
 * flags on the units agree with it.
 *
 * Like `unit-outlines.json`, the file carries no geometry of its own: it is district names, so a
 * stale copy is not detectable from its own contents. Every name would still resolve, against a
 * topology whose borders had moved.
 */
const districtsByName: readonly { readonly name: string; readonly geometry: PolygonalGeometry }[] = [
  ...districtGeometries,
].map(([name, geometry]) => ({ name, geometry }));

/** The graph as the artifact ships it, in the shape the module works in. */
const shipped: AdjacencyGraph = new Map(
  Object.entries(adjacency.neighbours as Record<string, string[]>),
);
/** The graph the committed geometry actually implies, derived here from its arcs. */
const derived = buildAdjacency(districtsByName);

describe('bundle adjacency', () => {
  it('cuts its graph against the geometry that ships beside it, not some other build', () => {
    expect(adjacency.provenance.arcsFrom).toBe('data/bundle/geography.topojson.json');
    expect(adjacency.provenance.geography.generated).toBe(bundle.provenance.generated);
    expect(adjacency.provenance.geography.arcs).toBe(bundle.arcs.length);
    expect(adjacency.provenance.geography.bbox).toEqual(bundle.bbox);
  });

  it('is exactly the graph the committed arcs imply, district by district', () => {
    // The acceptance criterion, over the whole shipped set. Re-derived from the geography rather
    // than read off the artifact, so an adjacency.json left behind by an earlier geometry fails
    // here naming the districts whose neighbours moved — not merely as a count of differences.
    const disagreements = [...derived].flatMap(([name, expected]) => {
      const found = shipped.get(name);
      if (found === undefined) return [`${name} is drawn but has no entry in adjacency.json`];
      const gained = found.filter((n) => !expected.includes(n));
      const lost = expected.filter((n) => !found.includes(n));
      return [
        ...gained.map((n) => `${name} is listed beside ${n}, which it shares no arc with`),
        ...lost.map((n) => `${name} shares an arc with ${n} and is not listed beside it`),
      ];
    });
    expect(disagreements).toEqual([]);
    expect([...shipped.keys()].sort()).toEqual([...derived.keys()].sort());
  });

  it('holds every drawn district, symmetric, with nobody its own neighbour', () => {
    expect(shipped.size).toBe(ROSTER_DISTRICT_COUNT);
    expect(adjacencyProblems(shipped, districtsByName)).toEqual([]);
    expect(adjacency.provenance.counts).toMatchObject({
      districts: ROSTER_DISTRICT_COUNT,
      edges: edgeCount(shipped),
    });
  });

  it('names real neighbours, and the border it draws for each is checkable on any atlas', () => {
    // An independent anchor. Everything above re-derives the graph with the same code that built
    // it, so a wrong derivation would agree with itself; these are borders a reader can check
    // without this repo. Chaman is the one to keep: it was carved out of Killa Abdullah and every
    // other side of it is Afghanistan, so a graph that had quietly started joining districts
    // across the Durand Line would show up here as a second neighbour.
    const neighbours = (name: string) => shipped.get(name) ?? [];
    expect(neighbours('Islamabad')).toEqual(['Haripur', 'Rawalpindi']);
    expect(neighbours('Chaman')).toEqual(['Killa Abdullah']);
    expect(neighbours('Lahore')).toEqual(['Kasur', 'Nankana Sahib', 'Sheikhupura']);
    expect(neighbours('Lower Chitral')).toEqual(['Upper Chitral', 'Upper Dir']);
    // Across the Working Boundary, which is a boundary and not the ceasefire line: Punjab's
    // Sialkot does border AJK's Bhimber, and the graph says so.
    expect(neighbours('Sialkot')).toContain('Bhimber');
    // Two districts that could not be further apart share nothing, which is what makes the
    // non-contiguous case below a real one rather than an artefact of a loose tolerance.
    expect(neighbours('Karachi South')).not.toContain('Lower Chitral');
  });

  it('leaves no district cut loose by the coastline clip, and joins the map into one piece', () => {
    // The clip replaced the seaward part of a coastal ring and nothing else, so a coastal
    // district's inland arcs — the ones its neighbours use — came through it untouched. Asserted
    // rather than assumed, on the districts the clip moved most: Gwadar lost half its area to it.
    expect(isolatedDistricts(shipped)).toEqual([]);
    expect(shipped.get('Gwadar')).toEqual(['Awaran', 'Kech', 'Lasbela']);
    expect(shipped.get('Sujawal')).toEqual(['Badin', 'Tando Mohammad Khan', 'Thatta']);
    // Offshore islands share no arc with anything, and none of them is a district of its own, so
    // every drawn district reaches every other: 156 districts, one component.
    const whole = contiguityOf(shipped, [...shipped.keys()]);
    expect(whole.pieces).toBe(1);
    expect(adjacency.provenance.counts.components).toBe(1);
    expect(adjacency.provenance.counts.isolated).toBe(0);
    expect(adjacency.provenance.isolated).toEqual([]);
  });
});

describe('bundle contiguity flags', () => {
  it('flags every unit of every variant, and agrees with the graph on each', () => {
    // The flags are written by the build and could drift from the graph they were read off — a
    // reordered pipeline, a variant edited after the fact. Recomputed here from the shipped graph
    // and compared unit by unit, so a disagreement names the proposal.
    for (const variant of variants) {
      for (const unit of variant.units) {
        const label = `${variant.id} "${unit.name}"`;
        const contiguity = contiguityOf(shipped, unit.districts);
        expect(unit.contiguity.contiguous, label).toBe(contiguity.contiguous);
        expect(unit.contiguity.pieces, label).toBe(contiguity.pieces);
        expect(unit.contiguity.detached, label).toEqual(contiguity.detached);
      }
      expect(variant.counts['nonContiguousUnits'], variant.id).toBe(
        variant.units.filter((u) => !u.contiguity.contiguous).length,
      );
    }
    expect(scenarios.provenance.contiguity.nonContiguousUnits).toBe(
      variants.reduce((n, v) => n + v.units.filter((u) => !u.contiguity.contiguous).length, 0),
    );
  });

  it('names the stranded districts on a broken unit rather than only the body of it', () => {
    // `detached` is every group but the largest, so a contiguous unit carries an empty list and a
    // card can render it without asking. That is the whole reason it is not simply `components`.
    for (const variant of variants) {
      for (const unit of variant.units) {
        const label = `${variant.id} "${unit.name}"`;
        if (unit.contiguity.contiguous) {
          expect(unit.contiguity.detached, label).toEqual([]);
          expect(unit.contiguity.pieces, label).toBe(1);
        } else {
          expect(unit.contiguity.detached.length, label).toBe(unit.contiguity.pieces - 1);
          for (const group of unit.contiguity.detached) {
            for (const district of group) expect(unit.districts, label).toContain(district);
          }
        }
      }
    }
  });

  it('keeps contiguity and polygons apart, on the unit where they visibly disagree', () => {
    // The distinction this ticket exists to make. South Punjab draws as three pieces — Rahim Yar
    // Khan is three polygons in OSM, two of them under 200 km² — and is one contiguous region:
    // every one of its eleven districts is reachable from every other through shared borders. Read
    // `polygons` as contiguity and this proposal is reported as broken in three, which is a claim
    // about a real movement's territory that is simply untrue.
    const southPunjab = variants
      .flatMap((v) => v.units)
      .find((u) => u.name === 'South Punjab') as EmittedUnit;
    expect(southPunjab.contiguity).toEqual({ contiguous: true, pieces: 1, detached: [] });
    expect(southPunjab.districts).toContain('Rahim Yar Khan');

    const outline = dissolved.find((d) => d.unit.name === 'South Punjab');
    expect(outline!.outline!.properties.polygons).toBe(3);
    expect(polygonsOf(outline!.outline as never)).not.toBe(
      contiguityOf(shipped, southPunjab.districts).pieces,
    );
  });

  it('flags the one unit the shipped set actually leaves in two pieces, and refuses nothing', () => {
    // H2 (#30) is the first variant in the app with a genuinely broken unit, and it is not a
    // proposed one: with Kalat, Las Bela, Kharan and Makran drawn around it, Awaran touches no
    // other district of the Balochistan it is left in. Flagged and drawn (D7) — there is no error
    // path, because refusing to draw a claim is a stronger editorial act than drawing it with a
    // note, and the note here names the district rather than reporting a count.
    const h2 = variants.find((v) => v.id === 'h2') as EmittedVariant;
    const broken = h2.units.filter((unit) => !unit.contiguity.contiguous);
    expect(broken.map((unit) => unit.name)).toEqual(['Balochistan']);
    expect(broken[0]?.contiguity.pieces).toBe(2);
    expect(broken[0]?.contiguity.detached).toEqual([['Awaran']]);
    expect(h2.counts['nonContiguousUnits']).toBe(1);

    // And it is the only one in the whole set, so the flag is not decoration anywhere else.
    const everywhere = variants.flatMap((variant) =>
      variant.units
        .filter((unit) => !unit.contiguity.contiguous)
        .map((unit) => `${variant.id} ${unit.name}`),
    );
    expect(everywhere).toEqual(['h2 Balochistan']);
  });

  it('flags a non-contiguous unit and refuses nothing, over the real map', () => {
    // The same property at the seam rather than in the artifact, on two districts that share
    // nothing: Lower Chitral on the Afghan border and Karachi South on the sea. There is no error
    // path to exercise — that is the point. A `Contiguity` has no failure state; it reports two
    // pieces and names the stranded one, and `outlineProblems` on the same pair is silent.
    const apart = ['Lower Chitral', 'Karachi South'];
    const contiguity = contiguityOf(shipped, apart);

    expect(contiguity.contiguous).toBe(false);
    expect(contiguity.pieces).toBe(2);
    expect(contiguity.detached).toEqual([['Lower Chitral']]);

    const members = apart.map((name) => districtGeometries.get(name) as PolygonalGeometry);
    expect(outlineProblems('two districts apart', bundle, members, dissolve(bundle, members))).toEqual(
      [],
    );
  });
});

/**
 * The scorecard (#20), re-derived from the census and the partition that ship beside it.
 *
 * `scorecard.test.ts` holds the arithmetic on five districts, and holds every state the committed
 * set cannot show: a unit that reaches into ground the census does not cover, a variant that
 * withholds modern figures, a partition with one counted unit. What is held here is that the
 * figures in the artifact *are* the ones its own inputs imply — recomputed, never read back — and,
 * on the lines where an outside anchor exists, that they agree with PBS rather than only with this
 * repo. A unit's population is a published claim about how many Pakistanis live somewhere; if it is
 * wrong, the app is wrong about the thing it exists to say.
 */
const censusPopulations = new Map<string, number>(
  Object.entries(statistics.districts as Record<string, { population: number }>).map(
    ([district, record]) => [district, record.population],
  ),
);
/** Today's map, which "moved" is measured against — every drawn district, AJK's and GB's included. */
const currentOrigins = new Map<string, string>(
  ROSTER.flatMap((province) => province.districts.map((d) => [d, province.name] as const)),
);
const provinceTotals = statistics.totals.provinces as Record<string, number>;

describe('bundle scorecard', () => {
  it('sums its figures from the census join that ships beside it, not from some other build', () => {
    // The same stamp the outlines and the graph carry, and for a sharper reason: a scorecard is
    // numbers, so a stale one is undetectable from its own contents. Every figure would still add
    // up — to a census that had since been rebuilt underneath it.
    expect(scenarios.provenance.scorecard.from).toBe('data/bundle/statistics.json');
    expect(scenarios.provenance.scorecard.statistics.generated).toBe(
      statistics.provenance.generated,
    );
    expect(scenarios.provenance.scorecard.statistics.districts).toBe(CENSUS_DISTRICT_COUNT);
  });

  it('gives every unit the sum of its own districts’ census populations, and nothing else', () => {
    // Named per unit rather than per variant: a variant whose total is out by a million leaves the
    // reader to find which of its units the million is in.
    const wrong = variants.flatMap((variant) =>
      variant.units.flatMap((unit) => {
        // A variant that withholds modern figures (H2, #30) carries none on its units either. The
        // scorecard's voided spread is not enough on its own: a unit's own line is a second place a
        // figure appears, and a 2023 population set against a princely state of 1947 is exactly the
        // claim the variant exists to refuse. Asserted as `null` rather than merely tolerated, so
        // that suppressing the spread while leaving the units populated fails here.
        if (!variant.statistics.modernFigures) {
          return unit.population === null
            ? []
            : [
                `${variant.id} "${unit.name}" carries a population of ${unit.population} on a ` +
                  `variant that withholds modern figures`,
              ];
        }
        const uncounted = unit.districts.filter((d) => !censusPopulations.has(d));
        if (uncounted.length > 0) {
          return unit.population === null
            ? []
            : [
                `${variant.id} "${unit.name}" carries a population of ${unit.population} while ` +
                  `PBS published none for ${uncounted.join(', ')}`,
              ];
        }
        const sum = unit.districts.reduce((n, d) => n + (censusPopulations.get(d) ?? 0), 0);
        return unit.population === sum
          ? []
          : [
              `${variant.id} "${unit.name}" reads ${unit.population}, and its districts sum to ` +
                `${sum}`,
            ];
      }),
    );
    expect(wrong).toEqual([]);
  });

  it('is exactly the scorecard its own census and partition imply, variant by variant', () => {
    // The acceptance criterion, over the artifact that ships. Recomputed from the committed inputs
    // rather than read off the file, so a scenarios.json left behind by an earlier census fails
    // here on the variant whose figures moved.
    for (const variant of variants) {
      expect(variant.scorecard, variant.id).toEqual(
        scorecardOf(variant.units, {
          populations: censusPopulations,
          origins: currentOrigins,
          modernFigures: variant.statistics,
        }),
      );
    }
  });

  it('never carries a spread and a reason for having none, or neither', () => {
    // Absence is stated, never defaulted. A variant carrying both would put a comparison on the
    // card and, under it, the sentence saying there is none.
    for (const variant of variants) {
      expect(variant.scorecard.population === null, variant.id).toBe(
        variant.scorecard.populationWithheld !== null,
      );
    }
  });

  it('agrees with PBS on the provinces a variant leaves alone, and on the one it carves', () => {
    // An outside anchor. Everything above recomputes with the same code that built the artifact,
    // so a wrong sum would agree with itself. These are the province totals typed from PBS Table 1
    // and reconciled in `statistics.test.ts`: L1 leaves four provinces and the capital exactly as
    // they are, so each unit equals its province to the person — and South Punjab plus the Punjab
    // it leaves behind equal Punjab, because between them they are Punjab.
    const l1 = variants.find((v) => v.id === 'l1') as EmittedVariant;
    const population = (unitId: string) =>
      (l1.units.find((u) => u.id === unitId) as EmittedUnit).population;
    for (const province of ['Sindh', 'Khyber Pakhtunkhwa', 'Balochistan']) {
      expect((l1.units.find((u) => u.name === province) as EmittedUnit).population, province).toBe(
        provinceTotals[province],
      );
    }
    expect(population('islamabad-capital-territory')).toBe(
      provinceTotals['Islamabad Capital Territory'],
    );
    expect((population('south-punjab') as number) + (population('punjab') as number)).toBe(
      provinceTotals['Punjab'],
    );
    // And the whole of a `drawn`-universe partition is the whole of the census: 241,499,431.
    expect(l1.scorecard.population?.total).toBe(statistics.totals.pakistan);
  });

  it('sets the twenty uncounted districts aside by name rather than counting them as nobody', () => {
    // D25. AJK and Gilgit-Baltistan are drawn, named, and in no PBS table, so their units carry no
    // population at all — never a zero, which would be a claim about who lives on ground Pakistan
    // administers, and never a partial sum wearing the look of a whole one.
    const l1 = variants.find((v) => v.id === 'l1') as EmittedVariant;
    const outside = l1.scorecard.outsideTheCensus;
    expect(outside.map((found) => found.name)).toEqual([
      'Azad Jammu & Kashmir',
      'Gilgit-Baltistan',
    ]);
    expect([...outside.flatMap((found) => found.districts)].sort()).toEqual(
      [...(statistics.withoutCensusData.districts as string[])].sort(),
    );
    for (const found of outside) {
      const unit = l1.units.find((u) => u.id === found.unit) as EmittedUnit;
      expect(unit.population, found.name).toBeNull();
      expect(unit.uncounted, found.name).toEqual(unit.districts);
    }
    // The spread is over the units the census reaches, and says how many that was.
    expect(l1.scorecard.population?.units).toBe(l1.units.length - outside.length);
  });

  it('names the ground that actually changes hands, and where it comes from', () => {
    // L1's eleven: the districts of South Punjab, every one of them Punjab's today. Keyed on the
    // 2023 districts the map draws and not on the thirteen the claim names — Taunsa and Kot Addu
    // did not exist when anyone was counted, and counting them here would move ground twice.
    const l1 = variants.find((v) => v.id === 'l1') as EmittedVariant;
    const south = l1.units.find((u) => u.id === 'south-punjab') as EmittedUnit;
    expect(l1.scorecard.districtsMoved).toEqual({
      count: 11,
      of: ROSTER_DISTRICT_COUNT,
      byOrigin: [{ from: 'Punjab', districts: 11 }],
    });
    expect(south.districts).toHaveLength(11);
    expect(south.claimed).toHaveLength(13);
    expect(south.districts.every((d) => currentOrigins.get(d) === 'Punjab')).toBe(true);
    // Every other unit of L1 keeps its own province's name and moves nothing, which is what makes
    // eleven the whole answer rather than the part of it the proposal admits to.
    expect(
      districtsMoved(
        l1.units.filter((u) => u.id !== 'south-punjab'),
        currentOrigins,
      ).count,
    ).toBe(0);
  });

  it('gives a one-unit partition no ratio at all, on the variant that is one', () => {
    // The case `scorecard.test.ts` could only build out of five invented districts, now standing
    // on the real map: One Unit puts every district the census covers into a single province, so
    // there is one counted unit, its population is the country's, and there is nothing for it to
    // be a ratio against. Printed as absent rather than as 1, which is a number and would read as
    // a perfectly even partition.
    const h1 = variants.find((v) => v.id === 'h1') as EmittedVariant;
    const west = h1.units.find((u) => u.id === 'west-pakistan') as EmittedUnit;
    expect(west.districts).toHaveLength(CENSUS_DISTRICT_COUNT);
    expect(west.population).toBe(statistics.totals.pakistan);
    expect(h1.scorecard.population?.units).toBe(1);
    expect(h1.scorecard.population?.ratio).toBeNull();
    expect(h1.scorecard.population?.largest.unit).toBe('west-pakistan');
    expect(h1.scorecard.population?.smallest.unit).toBe('west-pakistan');
    // And the two territories are set aside by name rather than counted as nobody — the same
    // distinction L1 makes, on a variant where they are the whole of the rest of the map.
    expect(h1.scorecard.outsideTheCensus.map((found) => found.name)).toEqual([
      'Azad Jammu & Kashmir',
      'Gilgit-Baltistan',
    ]);
    // Every census district changes hands, because not one of them stays under a unit named after
    // the entity it belongs to today. That is the scheme, not an artefact of the counting rule.
    expect(h1.scorecard.districtsMoved.count).toBe(CENSUS_DISTRICT_COUNT);
  });

  it('counts a renamed unit’s districts as moved, and says so on the variant that renames two', () => {
    // The blind spot `scorecard.ts` names in the open, now visible on the shipped set. H3 renames
    // Khyber Pakhtunkhwa back to North-West Frontier Province and Gilgit-Baltistan back to the
    // Northern Areas, so 38 districts whose boundaries have not moved are counted as having moved,
    // beside the 7 agencies that genuinely changed hands in 2018. The figure is the rule working;
    // what makes it honest is the footnote beside it, so the footnote is asserted too.
    const h3 = variants.find((v) => v.id === 'h3') as EmittedVariant;
    expect(h3.scorecard.districtsMoved).toEqual({
      count: 45,
      of: ROSTER_DISTRICT_COUNT,
      byOrigin: [
        { from: 'Khyber Pakhtunkhwa', districts: 35 },
        { from: 'Gilgit-Baltistan', districts: 10 },
      ],
    });
    // Selected on what the footnote is *about*, not on the digits it happens to contain: filtering
    // for '45' matched any future footnote that mentioned a 45 of anything, and matched nothing at
    // all the day the count changed — passing for the wrong reason and failing for the wrong one.
    // The figure it quotes is then tied to the figure asserted above, so the two cannot drift.
    const explains = h3.footnotes
      .filter((f) => f.text.includes('districts-moved figure'))
      .map((f) => f.text);
    expect(explains).toHaveLength(1);
    expect(explains[0]).toContain(String(h3.scorecard.districtsMoved.count));
    expect(explains[0]).toContain('seven');

    // The Northern Areas is Gilgit-Baltistan's ten districts under another name, and it is still a
    // territory: nothing in this app calls it a province, and under `forbid` nothing else could
    // hold those districts at all.
    const northern = h3.units.find((u) => u.id === 'northern-areas') as EmittedUnit;
    expect(northern.kind).toBe('territory');
    expect(northern.population).toBeNull();
    expect(northern.uncounted).toEqual(northern.districts);
    const gilgitBaltistan = ROSTER.find((p) => p.name === 'Gilgit-Baltistan');
    expect([...northern.districts].sort()).toEqual([...(gilgitBaltistan?.districts ?? [])].sort());
  });

  it('reads its contiguity line off #16 rather than answering the question twice', () => {
    // Deliberately not a field of the scorecard. Contiguity is derived from the adjacency graph and
    // carried on the units; a second derivation here would be a second answer, and the failure
    // worth avoiding is the one where the two disagree and nobody can tell which is on screen.
    for (const variant of variants) {
      expect(Object.keys(variant.scorecard), variant.id).not.toContain('contiguity');
      expect(Object.keys(variant.scorecard), variant.id).not.toContain('nonContiguousUnits');
      expect(variant.counts['nonContiguousUnits'], variant.id).toBe(
        variant.units.filter((u) => !u.contiguity.contiguous).length,
      );
      expect(variant.scorecard.units, variant.id).toBe(variant.counts['units']);
      expect(variant.scorecard.proposedUnits, variant.id).toBe(variant.counts['proposedUnits']);
    }
  });

  it('states the ratio it prints, to the precision it prints it at', () => {
    for (const variant of variants) {
      const spread = variant.scorecard.population;
      if (spread === null) continue;
      const ratio = spread.largest.population / spread.smallest.population;
      // One decimal, which is the precision the card sets — the artifact does not carry a figure
      // that nothing on screen can show. A partition with one counted unit compares that unit
      // against itself, so it carries no ratio at all rather than a 1 that would read as a
      // perfectly even spread.
      expect(spread.ratio, variant.id).toBe(
        spread.units < 2 ? null : Math.round(ratio * 10) / 10,
      );
      expect(spread.largest.population, variant.id).toBeGreaterThanOrEqual(
        spread.smallest.population,
      );
      // Both ends are units of this variant, not of another and not of the roster.
      for (const end of [spread.largest, spread.smallest]) {
        const unit = variant.units.find((u) => u.id === end.unit);
        expect(unit?.name, `${variant.id} ${end.unit}`).toBe(end.name);
        expect(unit?.population, `${variant.id} ${end.unit}`).toBe(end.population);
      }
    }
  });
});
