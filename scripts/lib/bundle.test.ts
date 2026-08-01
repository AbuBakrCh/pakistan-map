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
import { CENSUS_DISTRICT_COUNT, ROSTER, ROSTER_DISTRICT_COUNT } from './roster.ts';
import { TERRITORY_CLAIM_POLICY, universeDistricts } from './scenarios.ts';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const bundle = JSON.parse(
  readFileSync(resolve(ROOT, 'data/bundle/geography.topojson.json'), 'utf8'),
);
const scenarios = JSON.parse(readFileSync(resolve(ROOT, 'data/bundle/scenarios.json'), 'utf8'));

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
}
interface EmittedVariant {
  readonly id: string;
  readonly basis: string;
  readonly name: string;
  readonly badges: readonly string[];
  readonly rationale: string;
  readonly status: string;
  readonly advocacy:
    | { readonly kind: 'advocated'; readonly by: readonly string[] }
    | { readonly kind: 'unadvocated'; readonly note: string };
  readonly opposedBy: readonly string[];
  readonly sources: readonly { readonly label: string }[];
  readonly partition: { readonly universe: 'drawn' | 'census'; readonly districts: number };
  readonly counts: Readonly<Record<string, number>>;
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
    const claimed = variants.flatMap((variant) =>
      variant.units
        .filter((unit) => unit.kind !== 'territory')
        .flatMap((unit) =>
          unit.districts
            .filter((d) => territoryDistricts.has(d))
            .map((d) => `${variant.id} "${unit.name}" claims ${d}`),
        ),
    );
    expect(claimed).toEqual([]);
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
