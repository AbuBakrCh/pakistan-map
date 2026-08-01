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

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const bundle = JSON.parse(
  readFileSync(resolve(ROOT, 'data/bundle/geography.topojson.json'), 'utf8'),
);

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
    for (const province of ROSTER) {
      for (const district of province.districts) expect(names).toContain(district);
    }
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
    for (const district of districts) {
      expect(divisionNames).toContain(district.properties['division']);
      expect(provinceNames).toContain(district.properties['province']);
    }
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
  it('leaves landlocked provinces exactly where they were', () => {
    // The clip is a no-op away from the shore, and this is the guard on it: districts nowhere
    // near the coast are never handed to the clipper, so these two must not move at all.
    expect(ratio(['Punjab'])).toBeCloseTo(1, 2);
    expect(ratio(['Khyber Pakhtunkhwa'])).toBeCloseTo(1, 2);
  });

  it('brings both coastal provinces within tolerance of their published areas', () => {
    // Before clipping: Balochistan 365,457 (+5.3%), Sindh 149,691 (+6.2%).
    expect(Math.abs(ratio(['Balochistan']) - 1)).toBeLessThan(TOLERANCE);
    expect(Math.abs(ratio(['Sindh']) - 1)).toBeLessThan(TOLERANCE);
  });

  it('stops coastal districts at the sea instead of in territorial waters', () => {
    // The failure this replaces: Gwadar read 25,913 km² against a published 12,637, Lasbela
    // 24,090 against 15,153. Nothing may read meaningfully larger than its published area again.
    const provinceNames = new Set(provinces.map(nameOf));
    const inflated = Object.entries(PUBLISHED_KM2)
      .filter(([name]) => !provinceNames.has(name))
      .filter(([name, published]) => areaOf(name) / published > 1.25)
      .map(([name]) => name);
    expect(inflated).toEqual([]);
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
    // the clip removes them. The gap is ~6,500 km², which is the size the delta creek system is
    // independently reported at. Pinned as a band: it is a known deviation, not a free one.
    const delta = ratio(['Thatta', 'Sujawal']);
    expect(delta).toBeGreaterThan(0.55);
    expect(delta).toBeLessThan(0.7);
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

  it('agrees with the roster on counts', () => {
    expect(bundle.provenance.counts).toMatchObject({
      districts: ROSTER_DISTRICT_COUNT,
      censusDistricts: CENSUS_DISTRICT_COUNT,
      divisions: 37,
      provinces: 7,
    });
  });
});
