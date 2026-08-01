import { describe, expect, it } from 'vitest';
import {
  HOUSING_REGION,
  LITERACY_LITERATE_VAR,
  LITERACY_POPULATION_VAR,
  householdDenominatorConflicts,
  joinDevelopment,
  sumDevelopmentByProvince,
  type LiteracyRow,
  type SanitationRow,
  type WaterRow,
} from './development.ts';

/** One tehsil's Table 12 rows — the two this join reads, plus one it must ignore. */
const literacy = (
  district: string,
  unit: string,
  population10Plus: number | null,
  literate10Plus: number | null,
): LiteracyRow[] => [
  { district, unit, indicator: LITERACY_POPULATION_VAR, people: population10Plus },
  { district, unit, indicator: LITERACY_LITERATE_VAR, people: literate10Plus },
  { district, unit, indicator: 'Enrolment Primary', people: 999_999 },
];

const water = (
  district: string,
  households: number | null,
  improved: number | null,
  region: string = HOUSING_REGION,
): WaterRow => ({ district, region, households, improved });

const sanitation = (
  district: string,
  households: number,
  toilets: { flush: number; nonFlush: number; none: number | null; separate?: number },
  region: string = HOUSING_REGION,
): SanitationRow => ({
  district,
  region,
  households,
  flushToilet: toilets.flush,
  nonFlushToilet: toilets.nonFlush,
  noToilet: toilets.none,
  separateToilet: toilets.separate ?? toilets.flush,
});

/** A complete, self-consistent district, for tests that vary one thing about it. */
const lahore = () => ({
  literacy: literacy('LAHORE', 'LAHORE CITY', 800, 600),
  water: [water('LAHORE', 200, 180)],
  sanitation: [sanitation('LAHORE', 200, { flush: 150, nonFlush: 30, none: 20 })],
});

describe('joinDevelopment', () => {
  it('sums a district from the tehsils published under it and divides once', () => {
    const join = joinDevelopment(
      [...literacy('LAHORE', 'LAHORE CITY', 800, 600), ...literacy('LAHORE', 'LAHORE CANTT', 200, 100)],
      [water('LAHORE', 150, 140), water('LAHORE', 50, 30)],
      [
        sanitation('LAHORE', 150, { flush: 120, nonFlush: 20, none: 10 }),
        sanitation('LAHORE', 50, { flush: 30, nonFlush: 10, none: 10 }),
      ],
    );
    const d = join.districts.get('Lahore');
    expect(d?.literacy.population10Plus).toBe(1000);
    expect(d?.literacy.literate10Plus).toBe(700);
    // Population-weighted, which is what summing the counts and dividing once gives. The mean
    // of the two tehsil rates (75% and 50%) would be 62.5% — a figure nobody published.
    expect(d?.literacy.rate).toBe(0.7);
    expect(d?.water.improvedShare).toBe(170 / 200);
    expect(d?.sanitation.flushToiletShare).toBe(150 / 200);
    expect(d?.sanitation.noToiletShare).toBe(20 / 200);
  });

  it('reads only the two Table 12 indicators a literacy rate is made of', () => {
    // Thirteen of the fifteen published `VARS` are enrolment and out-of-school figures. One of
    // them landing in the denominator would produce a plausible rate over the wrong universe.
    const join = joinDevelopment(...Object.values(lahore()) as [LiteracyRow[], WaterRow[], SanitationRow[]]);
    expect(join.districts.get('Lahore')?.literacy.population10Plus).toBe(800);
  });

  it('reads only the OVERALL region, since RURAL and URBAN partition it', () => {
    const base = lahore();
    const join = joinDevelopment(
      base.literacy,
      [...base.water, water('LAHORE', 120, 100, 'RURAL'), water('LAHORE', 80, 80, 'URBAN')],
      [
        ...base.sanitation,
        sanitation('LAHORE', 120, { flush: 90, nonFlush: 20, none: 10 }, 'RURAL'),
        sanitation('LAHORE', 80, { flush: 60, nonFlush: 10, none: 10 }, 'URBAN'),
      ],
    );
    expect(join.districts.get('Lahore')?.water.households).toBe(200);
    expect(join.districts.get('Lahore')?.sanitation.households).toBe(200);
  });

  it('treats a blank cell as nobody, which is what PBS prints it for', () => {
    const join = joinDevelopment(
      literacy('LAHORE', 'LAHORE CITY', 800, 600),
      [water('LAHORE', 200, 180)],
      [sanitation('LAHORE', 200, { flush: 200, nonFlush: 0, none: null })],
    );
    expect(join.districts.get('Lahore')?.sanitation.noToilet).toBe(0);
    expect(join.unpartitioned).toEqual([]);
  });

  it('names a published district that matches no district in the 2023 roster', () => {
    const base = lahore();
    const join = joinDevelopment(
      [...base.literacy, ...literacy('ATLANTIS', 'ATLANTIS', 10, 5)],
      base.water,
      base.sanitation,
    );
    expect(join.unmatched).toEqual(['ATLANTIS']);
  });

  it('names two published spellings that would have merged into one district', () => {
    // The failure aggregation makes possible and the population join could not: one district,
    // one row there; here two names summing together look exactly like one district's tehsils.
    const base = lahore();
    const join = joinDevelopment(
      [...base.literacy, ...literacy('Lahore', 'LAHORE CANTT', 10, 5)],
      base.water,
      base.sanitation,
    );
    expect(join.collisions).toEqual([
      { district: 'Lahore', publishedNames: ['LAHORE', 'Lahore'] },
    ]);
  });

  it('names the district and the table when one of the three does not cover it', () => {
    const base = lahore();
    const join = joinDevelopment(base.literacy, [], base.sanitation);
    expect(join.missing).toContainEqual({ district: 'Lahore', table: 'Table 23' });
    expect(join.districts.has('Lahore')).toBe(false);
  });

  it('refuses a district with a denominator but no numerator, rather than rating it zero', () => {
    // The one shape of missing data that looks like data: no `Literate >=10` row sums to zero
    // literate people, which is a perfectly plausible-looking 0% on a map.
    const base = lahore();
    const join = joinDevelopment(
      base.literacy.filter((r) => r.indicator !== LITERACY_LITERATE_VAR),
      base.water,
      base.sanitation,
    );
    expect(join.missing).toContainEqual({
      district: 'Lahore',
      table: `Table 12 (${LITERACY_LITERATE_VAR})`,
    });
    expect(join.districts.has('Lahore')).toBe(false);
  });

  it('refuses a count larger than the universe it is a part of', () => {
    const base = lahore();
    const join = joinDevelopment(base.literacy, [water('LAHORE', 200, 260)], base.sanitation);
    expect(join.impossible).toContainEqual({
      district: 'Lahore',
      what: 'improved drinking water',
      counted: 260,
      outOf: 200,
    });
    expect(join.districts.has('Lahore')).toBe(false);
  });

  it('refuses a zero denominator rather than emitting a division by it', () => {
    const base = lahore();
    const join = joinDevelopment(base.literacy, [water('LAHORE', 0, 0)], base.sanitation);
    expect(join.impossible.map((i) => i.what)).toContain('improved drinking water');
    expect(join.districts.has('Lahore')).toBe(false);
  });

  it('names a district whose toilet categories do not partition its own households', () => {
    // Flush, non-flush and none cover every published household. Where they do not, a share
    // taken over that denominator is a share of something upstream cannot account for.
    const base = lahore();
    const join = joinDevelopment(base.literacy, base.water, [
      sanitation('LAHORE', 200, { flush: 150, nonFlush: 30, none: 5 }),
    ]);
    expect(join.unpartitioned).toEqual(['Lahore']);
  });

  it('keeps every rate a proportion in 0–1, never a percentage', () => {
    const join = joinDevelopment(...(Object.values(lahore()) as [LiteracyRow[], WaterRow[], SanitationRow[]]));
    const d = join.districts.get('Lahore');
    expect(d?.literacy.rate).toBeLessThanOrEqual(1);
    expect(d?.water.improvedShare).toBeLessThanOrEqual(1);
    expect(d?.sanitation.flushToiletShare).toBeLessThanOrEqual(1);
  });
});

describe('sumDevelopmentByProvince', () => {
  it('adds counts, not rates, so the province figure is population-weighted', () => {
    const join = joinDevelopment(
      [
        ...literacy('LAHORE', 'LAHORE CITY', 1000, 700),
        ...literacy('KASUR', 'KASUR', 100, 20),
      ],
      [water('LAHORE', 200, 180), water('KASUR', 50, 25)],
      [
        sanitation('LAHORE', 200, { flush: 150, nonFlush: 30, none: 20 }),
        sanitation('KASUR', 50, { flush: 20, nonFlush: 10, none: 20 }),
      ],
    );
    const punjab = sumDevelopmentByProvince(join.districts.values()).get('Punjab');
    expect(punjab?.population10Plus).toBe(1100);
    expect(punjab?.literate10Plus).toBe(720);
    // 720/1100 = 65.5%, not the 45% mean of 70% and 20%.
    expect((punjab?.literate10Plus ?? 0) / (punjab?.population10Plus ?? 1)).toBeCloseTo(0.6545, 4);
    expect(punjab?.improvedWater).toBe(205);
    expect(punjab?.households).toBe(250);
  });
});

describe('householdDenominatorConflicts', () => {
  it('names a district whose two housing tables disagree on how many households it has', () => {
    const join = joinDevelopment(
      literacy('LAHORE', 'LAHORE CITY', 800, 600),
      [water('LAHORE', 200, 180)],
      [sanitation('LAHORE', 201, { flush: 150, nonFlush: 30, none: 21 })],
    );
    expect(householdDenominatorConflicts(join.districts.values())).toEqual([
      { district: 'Lahore', water: 200, sanitation: 201 },
    ]);
  });
});
