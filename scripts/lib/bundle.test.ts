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
import { geoArea } from 'd3-geo';
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
    // ~796,000 km² excluding AJK/GB, ~880,000 including them. Wide bounds: the point is to
    // catch a coastline lost to over-simplification or a stray province left in.
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

describe('bundle provenance', () => {
  it('stamps generation date, vintage and source URLs', () => {
    const p = bundle.provenance;
    expect(Date.parse(p.generated)).not.toBeNaN();
    expect(p.vintage).toMatch(/2023/);
    expect(p.sources.boundaries).toMatch(/openstreetmap|overpass/i);
    expect(p.sources.roster).toMatch(/pbs\.gov\.pk/);
    expect(p.osmBaseTimestamp.district).toMatch(/^\d{4}-\d{2}-\d{2}T/);
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
