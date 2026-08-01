/**
 * Assertions against the committed statistics artifact, not the code that builds it.
 *
 * Same reasoning as `bundle.test.ts`: the join can be correct in isolation and still commit an
 * artifact with a district missing, a population attached to the wrong province, or a zero
 * standing in for "PBS never published this". Since the artifact is committed, a bad one is a
 * reviewable diff — but only if something is actually reading it.
 *
 * The last block is the one that matters most: the statistics and the geography must agree on
 * what a district is called, because a later issue joins them on exactly that string.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { feature } from 'topojson-client';
import { CENSUS_DISTRICT_COUNT, ROSTER, ROSTER_DISTRICT_COUNT } from './roster.ts';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const statistics = JSON.parse(readFileSync(resolve(ROOT, 'data/bundle/statistics.json'), 'utf8'));
const geography = JSON.parse(
  readFileSync(resolve(ROOT, 'data/bundle/geography.topojson.json'), 'utf8'),
);

interface DistrictStatisticsRecord {
  population: number;
  households: number;
  division: string;
  province: string;
}

const districts = statistics.districts as Record<string, DistrictStatisticsRecord>;
const entries = Object.entries(districts);

/**
 * Province and national totals as PBS published them — Census-2023 Table 1 (national),
 * https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_1_national.pdf
 *
 * Typed out here rather than read from the artifact on purpose. An artifact checked against
 * itself agrees with itself no matter how wrong it is; these are the numbers a reader can
 * verify against the published table without running anything.
 */
const PUBLISHED_PROVINCE_TOTALS: Record<string, number> = {
  Punjab: 127_688_922,
  Sindh: 55_696_147,
  'Khyber Pakhtunkhwa': 40_856_097,
  Balochistan: 14_894_402,
  'Islamabad Capital Territory': 2_363_863,
};
const PUBLISHED_NATIONAL_TOTAL = 241_499_431;

describe('statistics coverage', () => {
  it('carries every one of the 136 census districts, exactly once', () => {
    expect(entries).toHaveLength(CENSUS_DISTRICT_COUNT);
    const censusAtom = ROSTER.filter((p) => p.kind !== 'territory').flatMap((p) => p.districts);
    for (const district of censusAtom) expect(districts[district]).toBeDefined();
  });

  it('gives every district a real population, never null and never zero', () => {
    for (const [name, record] of entries) {
      expect(Number.isInteger(record.population), name).toBe(true);
      expect(record.population, name).toBeGreaterThan(0);
      expect(record.households, name).toBeGreaterThan(0);
    }
  });

  it('carries 2023 figures only, per the single-vintage rule', () => {
    // ADR-0001. A 2017 population in the bundle is an invitation to the cross-vintage
    // comparison the rule exists to prevent, on a district set reorganised in between.
    for (const [name, record] of entries) {
      expect(Object.keys(record).sort(), name).toEqual([
        'division',
        'households',
        'population',
        'province',
      ]);
    }
  });

  it('states AJK and GB as absent rather than representing them as zero', () => {
    // D25. The 20 drawn-but-uncounted districts must be listed and must not appear as data.
    const absent = statistics.withoutCensusData.districts as string[];
    expect(absent).toHaveLength(ROSTER_DISTRICT_COUNT - CENSUS_DISTRICT_COUNT);
    const territories = ROSTER.filter((p) => p.kind === 'territory').flatMap((p) => p.districts);
    expect(new Set(absent)).toEqual(new Set(territories));
    for (const district of absent) expect(districts[district]).toBeUndefined();
    expect(statistics.withoutCensusData.reason).toMatch(/136/);
  });
});

describe('statistics totals', () => {
  const sumBy = (key: 'province' | 'division'): Map<string, number> => {
    const totals = new Map<string, number>();
    for (const record of Object.values(districts)) {
      totals.set(record[key], (totals.get(record[key]) ?? 0) + record.population);
    }
    return totals;
  };

  it('sums districts to the province totals PBS published', () => {
    const summed = sumBy('province');
    for (const [province, published] of Object.entries(PUBLISHED_PROVINCE_TOTALS)) {
      expect(summed.get(province), province).toBe(published);
    }
    expect([...summed.keys()].sort()).toEqual(Object.keys(PUBLISHED_PROVINCE_TOTALS).sort());
  });

  it('sums districts to the national total PBS published', () => {
    const national = Object.values(districts).reduce((sum, d) => sum + d.population, 0);
    expect(national).toBe(PUBLISHED_NATIONAL_TOTAL);
    expect(statistics.totals.pakistan).toBe(PUBLISHED_NATIONAL_TOTAL);
  });

  it('sums districts to every published division total, all 31 of them', () => {
    // The check that catches a fold landing a district in the wrong place: a district moved
    // between divisions leaves the province total intact and breaks exactly two divisions.
    const summed = sumBy('division');
    const reconciled = statistics.reconciliation.divisions as {
      name: string;
      summed: number;
      published: number;
    }[];
    expect(reconciled).toHaveLength(31);
    for (const division of reconciled) {
      expect(division.summed, division.name).toBe(division.published);
      expect(summed.get(division.name), division.name).toBe(division.published);
    }
  });

  it('carries totals that agree with the districts they were derived from', () => {
    expect(statistics.totals.provinces).toEqual(Object.fromEntries(sumBy('province')));
    expect(statistics.totals.divisions).toEqual(Object.fromEntries(sumBy('division')));
  });
});

describe('statistics folds', () => {
  const folds = statistics.folds.into as Record<string, string>;

  it('resolves every post-census district to a district that carries a population', () => {
    // The acceptance criterion, read off the artifact: no post-census district is left null.
    // The Gilgit-Baltistan folds are the exception by construction — their parents are drawn
    // but uncounted, so they resolve to a district that is listed as absent, not to nothing.
    const absent = new Set(statistics.withoutCensusData.districts as string[]);
    for (const [child, parent] of Object.entries(folds)) {
      expect(districts[parent] ?? absent.has(parent), `${child} -> ${parent}`).toBeTruthy();
      expect(districts[child], `${child} must not be counted separately`).toBeUndefined();
    }
  });

  it('folds the districts issue #9 names as affected', () => {
    expect(folds['Taunsa']).toBe('Dera Ghazi Khan');
    expect(folds['Kot Addu']).toBe('Muzaffargarh');
    expect(folds['Talagang']).toBe('Chakwal');
    expect(folds['Wazirabad']).toBe('Gujranwala');
    expect(folds['Murree']).toBe('Rawalpindi');
    expect(folds['Paharpur']).toBe('Dera Ismail Khan');
    expect(folds['Allai']).toBe('Batagram');
    expect(folds['Upper Swat']).toBe('Swat');
    expect(folds['Central Dir']).toBe('Lower Dir');
  });

  it('folds the 2026 Balochistan restructuring, which is noted in copy but never counted', () => {
    for (const district of ['Quetta East', 'Quetta West', 'Barshore', 'Wadh', 'Tump']) {
      expect(folds[district], district).toBeDefined();
      expect(districts[district], district).toBeUndefined();
    }
  });

  it('keeps the fold table provenance, one entry per fold', () => {
    const table = statistics.folds.table as { district: string; into: string }[];
    expect(table).toHaveLength(Object.keys(folds).length);
    expect(statistics.folds.source).toBe('data/reference/post-census-district-folds.json');
  });
});

describe('statistics provenance', () => {
  it('stamps generation date, vintage, source and licence', () => {
    const p = statistics.provenance;
    expect(Date.parse(p.generated)).not.toBeNaN();
    expect(p.vintage).toMatch(/2023/);
    expect(p.sources.census).toMatch(/pbs\.gov\.pk/);
    expect(p.sources.censusPackage).toMatch(/PakPC2023/);
    expect(p.sources.censusPackageLicence).toBe('GPL-2');
    expect(p.unit).toBe('district');
  });

  it('pins the census cache it was built from, so the numbers are traceable to bytes', () => {
    for (const digest of Object.values(statistics.provenance.cacheDigests as Record<string, string>)) {
      expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it('carries all three district counts, so none of them reads as a bug', () => {
    expect(statistics.provenance.counts).toMatchObject({
      censusDistricts: CENSUS_DISTRICT_COUNT,
      drawnDistricts: ROSTER_DISTRICT_COUNT,
      districtsWithoutCensusData: ROSTER_DISTRICT_COUNT - CENSUS_DISTRICT_COUNT,
    });
  });
});

describe('statistics and geography join', () => {
  const drawn = (
    feature(geography, geography.objects['districts']) as unknown as {
      features: { properties: Record<string, string> }[];
    }
  ).features.map((f) => f.properties);

  it('accounts for every drawn district, either with data or as explicitly absent', () => {
    const absent = new Set(statistics.withoutCensusData.districts as string[]);
    for (const district of drawn) {
      const name = district['name'] as string;
      expect(districts[name] !== undefined || absent.has(name), name).toBe(true);
    }
    expect(drawn).toHaveLength(entries.length + absent.size);
  });

  it('agrees with the geography on which division and province each district is in', () => {
    // Two artifacts, two derivations: the geography reads division membership off OSM relations,
    // the statistics read it off the census tables. Disagreeing means one of them is wrong.
    for (const district of drawn) {
      const record = districts[district['name'] as string];
      if (record === undefined) continue;
      expect(record.division, district['name']).toBe(district['division']);
      expect(record.province, district['name']).toBe(district['province']);
    }
  });
});
