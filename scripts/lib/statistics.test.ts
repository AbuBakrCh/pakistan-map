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
import {
  CENSUS_DISTRICTS,
  CENSUS_DISTRICT_COUNT,
  ROSTER,
  ROSTER_DISTRICT_COUNT,
} from './roster.ts';

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
  motherTongue: {
    dominant: string | null;
    dominantShare: number | null;
    residualShare: number;
    counted: number;
    speakers: Record<string, number>;
  };
  development: {
    literacy: { population10Plus: number; literate10Plus: number; rate: number };
    water: { households: number; improved: number; improvedShare: number };
    sanitation: {
      households: number;
      flushToilet: number;
      nonFlushToilet: number;
      noToilet: number;
      separateToilet: number;
      flushToiletShare: number;
      noToiletShare: number;
    };
  };
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
    for (const district of CENSUS_DISTRICTS) expect(districts[district]).toBeDefined();
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
        'development',
        'division',
        'households',
        'motherTongue',
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

/**
 * Mother tongue as PBS printed it — Census-2023 Table 11 (national),
 * https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_11_national.pdf
 *
 * The same discipline as the population totals above: typed out, not read back off the artifact,
 * so the check is against the published table rather than against the build's own arithmetic.
 * One column per language kept short of the full 15 × 6 grid — these are the four that decide
 * what the map is shaded, plus the national universe, and the build reconciles every column.
 */
const PUBLISHED_LANGUAGE_TOTALS: Record<string, Record<string, number>> = {
  Punjab: { Punjabi: 85_309_591, Saraiki: 26_282_637 },
  Sindh: { Sindhi: 33_462_299, Urdu: 12_409_745 },
  'Khyber Pakhtunkhwa': { Pushto: 32_919_592, Hindko: 3_815_327 },
  Balochistan: { Balochi: 5_811_185, Brahvi: 2_507_157 },
  'Islamabad Capital Territory': { Punjabi: 1_154_540, Urdu: 358_922 },
};
const PUBLISHED_MOTHER_TONGUE_UNIVERSE = 240_458_089;
/** The census's own fifteen categories, in the census's own spelling — Kohiostani included. */
const CENSUS_LANGUAGES = [
  'Urdu', 'Punjabi', 'Sindhi', 'Pushto', 'Balochi', 'Kashmiri', 'Saraiki', 'Hindko', 'Brahvi',
  'Shina', 'Balti', 'Mewati', 'Kalasha', 'Kohiostani', 'Others',
];

describe('statistics mother tongue', () => {
  it('gives every census district a distribution over the census\'s own categories', () => {
    for (const [name, record] of entries) {
      expect(Object.keys(record.motherTongue.speakers).sort(), name).toEqual(
        [...CENSUS_LANGUAGES].sort(),
      );
      // A published zero is a figure. Every category is present for every district, so a
      // missing key can never pass for "nobody here speaks it".
      for (const language of CENSUS_LANGUAGES) {
        expect(Number.isInteger(record.motherTongue.speakers[language]), `${name}/${language}`)
          .toBe(true);
      }
      expect(record.motherTongue.counted, name).toBeGreaterThan(0);
    }
  });

  it('sums the speakers it lists to the district total it publishes', () => {
    for (const [name, record] of entries) {
      const summed = CENSUS_LANGUAGES.reduce(
        (sum, l) => sum + (record.motherTongue.speakers[l] ?? 0),
        0,
      );
      expect(summed, name).toBe(record.motherTongue.counted);
    }
  });

  it('sums districts to the language totals PBS published for each province', () => {
    // The check that makes summing tehsils into districts safe. PBS publishes Table 11 at tehsil
    // level only, so the district tier is added up here; a tehsil added to the wrong district
    // inside a province moves whole languages and would show up as an exact difference.
    const summed = new Map<string, Record<string, number>>();
    for (const record of Object.values(districts)) {
      const totals = summed.get(record.province) ?? {};
      for (const language of CENSUS_LANGUAGES) {
        totals[language] = (totals[language] ?? 0) + (record.motherTongue.speakers[language] ?? 0);
      }
      summed.set(record.province, totals);
    }
    for (const [province, published] of Object.entries(PUBLISHED_LANGUAGE_TOTALS)) {
      for (const [language, count] of Object.entries(published)) {
        expect(summed.get(province)?.[language], `${province}/${language}`).toBe(count);
      }
    }
  });

  it("counts Table 11's own universe, which is not the census population", () => {
    // 1,041,342 fewer people than Table 1. Asserted rather than tolerated: if a rebuild ever
    // closed the gap, something would have started inventing a residual to make it close.
    const counted = Object.values(districts).reduce((sum, d) => sum + d.motherTongue.counted, 0);
    expect(counted).toBe(PUBLISHED_MOTHER_TONGUE_UNIVERSE);
    expect(statistics.motherTongue.universe.counted).toBe(PUBLISHED_MOTHER_TONGUE_UNIVERSE);
    expect(statistics.motherTongue.universe.difference).toBe(
      PUBLISHED_MOTHER_TONGUE_UNIVERSE - PUBLISHED_NATIONAL_TOTAL,
    );
  });

  it('names a dominant language only where the census names one', () => {
    for (const [name, record] of entries) {
      const { dominant, dominantShare, speakers, counted } = record.motherTongue;
      if (dominant === null) {
        // The residual won. Both districts that reach this are in Chitral, where Khowar has no
        // column; the alternative is printing "Urdu" on a district where 150 people speak it.
        expect(dominantShare, name).toBeNull();
        expect(record.motherTongue.residualShare, name).toBeGreaterThan(0.5);
        continue;
      }
      expect(dominant, name).not.toBe('Others');
      const largest = Math.max(
        ...CENSUS_LANGUAGES.filter((l) => l !== 'Others').map((l) => speakers[l] ?? 0),
      );
      expect(speakers[dominant], name).toBe(largest);
      expect(speakers[dominant], name).toBeGreaterThanOrEqual(speakers['Others'] ?? 0);
      expect(dominantShare, name).toBeCloseTo((speakers[dominant] ?? 0) / counted, 5);
    }
  });

  it('lists the districts where the census names no majority tongue', () => {
    const unnamed = statistics.motherTongue.districtsWithoutNamedDominant as {
      district: string;
      residualShare: number;
    }[];
    expect(unnamed.map((d) => d.district).sort()).toEqual(['Lower Chitral', 'Upper Chitral']);
    for (const district of unnamed) expect(districts[district.district]?.motherTongue.dominant).toBeNull();
  });

  it('names the districts PBS counts above their own population, rather than smoothing them', () => {
    // A table cannot cover more people than live somewhere. Where Table 11 does, upstream
    // disagrees with itself, and the artifact says which districts and by how much.
    const above = statistics.motherTongue.districtsCountedAbovePopulation as {
      district: string;
      excess: number;
    }[];
    for (const record of above) {
      expect(districts[record.district]?.motherTongue.counted, record.district).toBe(
        (districts[record.district]?.population ?? 0) + record.excess,
      );
    }
    const names = new Set(above.map((d) => d.district));
    for (const [name, record] of entries) {
      if (record.motherTongue.counted > record.population) expect(names, name).toContain(name);
    }
  });

  it('states where the mother-tongue figures came from, table and all', () => {
    expect(statistics.motherTongue.source).toMatch(/Table 11/);
    expect(statistics.motherTongue.source).toMatch(/table_11_national\.pdf/);
    expect(statistics.motherTongue.categories).toEqual(CENSUS_LANGUAGES);
    expect(statistics.motherTongue.residualCategory).toBe('Others');
  });
});

/**
 * The development counts as PBS printed them — Census-2023 Tables 12, 23 and 24 (national),
 * https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_12_national.pdf and
 * `table_23_national.pdf`, `table_24_national.pdf`.
 *
 * Counts, not rates, and typed out rather than read back off the artifact — same discipline as
 * the population and language totals above. A province literacy rate is population-weighted and
 * cannot be recovered from district rates, so the only checkable figures are the numerator and
 * the denominator, both of which PBS prints.
 */
const PUBLISHED_DEVELOPMENT: Record<string, Record<string, number>> = {
  Punjab: { population10Plus: 93_413_721, literate10Plus: 61_882_702, households: 19_839_980 },
  Sindh: { population10Plus: 38_984_258, literate10Plus: 22_431_392, households: 9_862_870 },
  'Khyber Pakhtunkhwa': {
    population10Plus: 28_225_473,
    literate10Plus: 14_420_285,
    households: 5_861_457,
  },
  Balochistan: { population10Plus: 9_294_080, literate10Plus: 3_904_799, households: 2_317_256 },
  'Islamabad Capital Territory': {
    population10Plus: 1_797_000,
    literate10Plus: 1_508_916,
    households: 410_993,
  },
};
/** Table 24's toilet columns, nationally. Flush + non-flush + none is every published household. */
const PUBLISHED_TOILETS = { flush: 30_870_460, nonFlush: 2_499_076, none: 4_923_020 };
const PUBLISHED_HOUSEHOLDS = 38_292_556;
/** Table 23's printed improved-water figure, and the amount its own tehsil rows exceed it by. */
const PUBLISHED_IMPROVED_WATER = 35_194_430;
const IMPROVED_WATER_TEHSIL_EXCESS = 6_374;

describe('statistics development', () => {
  it('gives every census district all three indicators, with both halves of each rate', () => {
    for (const [name, record] of entries) {
      const { literacy, water, sanitation } = record.development;
      for (const [what, value] of [
        ['population10Plus', literacy.population10Plus],
        ['literate10Plus', literacy.literate10Plus],
        ['water households', water.households],
        ['improved water', water.improved],
        ['sanitation households', sanitation.households],
        ['flush toilet', sanitation.flushToilet],
        ['non-flush toilet', sanitation.nonFlushToilet],
        ['no toilet', sanitation.noToilet],
        ['separate toilet', sanitation.separateToilet],
      ] as const) {
        expect(Number.isInteger(value), `${name}/${what}`).toBe(true);
        expect(value, `${name}/${what}`).toBeGreaterThanOrEqual(0);
      }
      // Both denominators are real universes, never zero — a share over zero is not a share.
      expect(literacy.population10Plus, name).toBeGreaterThan(0);
      expect(water.households, name).toBeGreaterThan(0);
    }
  });

  it('keeps every rate a proportion in 0–1, and equal to its own two halves', () => {
    // Percentages and proportions are indistinguishable in a fill colour and differ by a factor
    // of a hundred everywhere else, so the convention is asserted rather than assumed.
    for (const [name, record] of entries) {
      const { literacy, water, sanitation } = record.development;
      for (const [what, share, numerator, denominator] of [
        ['literacy rate', literacy.rate, literacy.literate10Plus, literacy.population10Plus],
        ['improved water', water.improvedShare, water.improved, water.households],
        [
          'flush toilet',
          sanitation.flushToiletShare,
          sanitation.flushToilet,
          sanitation.households,
        ],
        ['no toilet', sanitation.noToiletShare, sanitation.noToilet, sanitation.households],
      ] as const) {
        expect(share, `${name}/${what}`).toBeGreaterThanOrEqual(0);
        expect(share, `${name}/${what}`).toBeLessThanOrEqual(1);
        expect(share, `${name}/${what}`).toBeCloseTo(numerator / denominator, 5);
      }
    }
  });

  it("uses each indicator's own denominator, not the district's population or households", () => {
    // Three indicators, two denominators, neither of them the district population. Literacy is
    // over population 10+, which is always smaller; water and sanitation are over the housing
    // tables' household count, which differs from the district table's in all 136 districts.
    for (const [name, record] of entries) {
      expect(record.development.literacy.population10Plus, name).toBeLessThan(record.population);
      expect(record.development.water.households, name).toBe(
        record.development.sanitation.households,
      );
      expect(record.development.water.households, name).not.toBe(record.households);
    }
  });

  it("keeps Table 24's three toilet categories a partition of its own households", () => {
    for (const [name, record] of entries) {
      const s = record.development.sanitation;
      expect(s.flushToilet + s.nonFlushToilet + s.noToilet, name).toBe(s.households);
    }
  });

  it('sums districts to the counts PBS published for each province', () => {
    // The check that makes summing tehsils into districts safe, applied to all three tables: a
    // tehsil added to the wrong district inside a province leaves the province total intact only
    // if it went nowhere, so an exact match on both halves is the strongest available check.
    interface Counts {
      population10Plus: number;
      literate10Plus: number;
      households: number;
    }
    const summed = new Map<string, Counts>();
    for (const record of Object.values(districts)) {
      const totals = summed.get(record.province) ?? {
        population10Plus: 0,
        literate10Plus: 0,
        households: 0,
      };
      totals.population10Plus += record.development.literacy.population10Plus;
      totals.literate10Plus += record.development.literacy.literate10Plus;
      totals.households += record.development.water.households;
      summed.set(record.province, totals);
    }
    for (const [province, published] of Object.entries(PUBLISHED_DEVELOPMENT)) {
      for (const [field, count] of Object.entries(published)) {
        expect(summed.get(province)?.[field as keyof Counts], `${province}/${field}`).toBe(count);
      }
    }
  });

  it('sums districts to the national counts PBS published', () => {
    const total = (read: (r: DistrictStatisticsRecord) => number) =>
      Object.values(districts).reduce((sum, r) => sum + read(r), 0);
    expect(total((r) => r.development.water.households)).toBe(PUBLISHED_HOUSEHOLDS);
    expect(total((r) => r.development.sanitation.flushToilet)).toBe(PUBLISHED_TOILETS.flush);
    expect(total((r) => r.development.sanitation.nonFlushToilet)).toBe(PUBLISHED_TOILETS.nonFlush);
    expect(total((r) => r.development.sanitation.noToilet)).toBe(PUBLISHED_TOILETS.none);
    // Both sides of the 48,010-household gap, pinned. The housing tables' total alone would let
    // the district table's drift on a rebuild while the suite stayed green — and the difference
    // is quoted in the artifact, in CLAUDE.md and in the research note, so it has to be a figure
    // the build can falsify rather than one three documents merely agree about.
    expect(total((r) => r.households)).toBe(38_340_566);
    expect(total((r) => r.development.water.households)).toBe(38_292_556);
    expect(total((r) => r.households) - total((r) => r.development.water.households)).toBe(48_010);
    expect(total((r) => r.development.literacy.population10Plus)).toBe(171_714_532);
    expect(total((r) => r.development.literacy.literate10Plus)).toBe(104_148_094);
  });

  it("states the one column PBS's two releases disagree about, rather than smoothing it", () => {
    // Table 23's tehsil rows count 6,374 more improved-water households than Table 23's own
    // printed province rows. Asserted exactly: a rebuild that closed the gap would mean
    // something had started reconciling upstream to itself, and a tehsil going missing would
    // change it too. Neither should pass quietly.
    const summed = Object.values(districts).reduce((sum, r) => sum + r.development.water.improved, 0);
    expect(summed).toBe(PUBLISHED_IMPROVED_WATER + IMPROVED_WATER_TEHSIL_EXCESS);
    const stated = statistics.development.improvedWaterDifference;
    expect(stated.summed).toBe(summed);
    expect(stated.published).toBe(PUBLISHED_IMPROVED_WATER);
    expect(stated.difference).toBe(IMPROVED_WATER_TEHSIL_EXCESS);
    expect(
      Object.values(stated.byProvince as Record<string, number>).reduce((a, b) => a + b, 0),
    ).toBe(IMPROVED_WATER_TEHSIL_EXCESS);
  });

  it('publishes the rates as published, never pre-combined into an index', () => {
    // #11's own acceptance criterion, read off the artifact. A composite of the three is #31's
    // job and carries a `synthesized` badge; one baked in here would wear a `census` one.
    for (const [name, record] of entries) {
      expect(Object.keys(record.development).sort(), name).toEqual([
        'literacy',
        'sanitation',
        'water',
      ]);
    }
  });

  it('says that PBS publishes no improved-sanitation figure, rather than inventing one', () => {
    // The census classifies drinking-water sources as improved or not and prints the result. It
    // does not do that for toilets — a non-flush toilet may be improved or not, and Table 24
    // does not say which — so the shaded share is flush toilets, named as flush toilets.
    const sanitation = statistics.development.indicators.sanitation;
    expect(sanitation.table).toMatch(/Table 24/);
    expect(sanitation.numerator).toBe('TOILET_FLUSH');
    expect(sanitation.note).toMatch(/no improved-sanitation column/);
    expect(statistics.development.indicators.water.numerator).toBe('DRINK_WTR_IMPROVE');
    expect(statistics.development.indicators.literacy.denominator).toBe('Population >=10');
  });

  it('states where the development figures came from, table by table', () => {
    expect(statistics.development.source).toMatch(/Table 12/);
    expect(statistics.development.source).toMatch(/Table 23/);
    expect(statistics.development.source).toMatch(/Table 24/);
    expect(statistics.development.source).toMatch(/table_12_national\.pdf/);
    expect(statistics.development.unit).toMatch(/tehsil/);
    expect(statistics.development.shares).toMatch(/0–1/);
  });

  it('leaves AJK and GB with no indicator at all, absent rather than zero', () => {
    // D25. PBS's 2023 results cover the four provinces and ICT; no AJK or GB district has a
    // literacy, water or sanitation figure, and a zero would shade them as the worst in Pakistan.
    for (const district of statistics.withoutCensusData.districts as string[]) {
      expect(districts[district], district).toBeUndefined();
    }
    expect(statistics.withoutCensusData.reason).toMatch(/literacy/);
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

  it('leaves every folded district reading its mother tongue off its 2023 parent', () => {
    // The vintage rule, applied to Table 11: a district created after the census has no row of
    // its own in it either, so the distribution it inherits is its parent's — which is the same
    // thing as saying it is drawn as part of that parent. Nothing carries a distribution of its
    // own here; the check is that the parent has one to inherit.
    const absent = new Set(statistics.withoutCensusData.districts as string[]);
    for (const [child, parent] of Object.entries(folds)) {
      expect(districts[child], `${child} must not carry its own distribution`).toBeUndefined();
      if (absent.has(parent)) continue; // AJK/GB parents are drawn but never shaded (D25).
      expect(districts[parent]?.motherTongue.speakers, `${child} -> ${parent}`).toBeDefined();
    }
  });

  it('leaves every folded district reading its indicators off its 2023 parent', () => {
    // The vintage rule applied to Tables 12, 23 and 24 (#11). A district created after the
    // census has no row in any of them, so it carries no literacy, water or sanitation figure of
    // its own; it inherits its parent's because it is drawn as part of that parent. Kot Addu
    // shades as Muzaffargarh, not as a hole in Punjab.
    const absent = new Set(statistics.withoutCensusData.districts as string[]);
    for (const [child, parent] of Object.entries(folds)) {
      expect(districts[child], `${child} must not carry its own indicators`).toBeUndefined();
      if (absent.has(parent)) continue; // AJK/GB parents are drawn but never shaded (D25).
      expect(districts[parent]?.development.literacy.rate, `${child} -> ${parent}`).toBeDefined();
      expect(districts[parent]?.development.water.improvedShare, `${child} -> ${parent}`)
        .toBeDefined();
      expect(districts[parent]?.development.sanitation.flushToiletShare, `${child} -> ${parent}`)
        .toBeDefined();
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
    const digests = statistics.provenance.cacheDigests as Record<string, string>;
    // One per table read, mother tongue included — a cache file nobody digests is a file that
    // can change under the artifact without the diff saying so.
    expect(Object.keys(digests).sort()).toEqual([
      'district',
      'division',
      'literacy',
      'motherTongue',
      'province',
      'sanitation',
      'water',
    ]);
    for (const digest of Object.values(digests)) expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/);
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
