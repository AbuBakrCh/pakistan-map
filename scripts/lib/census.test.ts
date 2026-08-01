import { describe, expect, it } from 'vitest';
import {
  foldToCensusDistrict,
  joinCensus,
  reconcileTotals,
  resolveCensusDistrict,
  resolveCensusDivision,
  resolveCensusProvince,
  sumBy,
  type CensusRow,
} from './census.ts';
import { CENSUS_DISTRICT_COUNT, POST_CENSUS_FOLD_TABLE, ROSTER } from './roster.ts';

const row = (
  region: string,
  division: string,
  district: string,
  population: number,
): CensusRow => ({ region, division, district, population, households: 1, population2017: 1 });

describe('resolveCensusDistrict', () => {
  it('accepts a name PBS spells the same way twice', () => {
    expect(resolveCensusDistrict('Lahore')).toBe('Lahore');
    expect(resolveCensusDistrict('Karachi South')).toBe('Karachi South');
  });

  it('reconciles the census spelling to the roster spelling', () => {
    // PBS's own documents disagree with each other; the census tables and the district list are
    // two of them. Neither is wrong — the roster spelling is simply the one the bundle keys on.
    expect(resolveCensusDistrict('Abbottabad')).toBe('Abbotabad');
    expect(resolveCensusDistrict('Kambar Shahdad Kot')).toBe('Kambar Shahdadkot');
    expect(resolveCensusDistrict('Umer Kot')).toBe('Umerkot');
    expect(resolveCensusDistrict('Kolai Palas Kohistan')).toBe('Kolai Pallas Kohistan');
    expect(resolveCensusDistrict('Musakhel')).toBe('Musa Khel');
    expect(resolveCensusDistrict('Kachhi')).toBe('Kachhi (Bolan)');
  });

  it('resolves the two names the census gives that are not district names at all', () => {
    // The census carries the capital as its own region, division and district, all called ICT.
    expect(resolveCensusDistrict('ICT')).toBe('Islamabad');
    // Malakand is a "Protected Area" in the census tables and a district in the roster.
    expect(resolveCensusDistrict('Malakand Protected Area')).toBe('Malakand');
  });

  it('returns null for a name it cannot place, rather than a plausible guess', () => {
    expect(resolveCensusDistrict('Somewhere Entirely New')).toBeNull();
    // A post-census district has no census row; it must never resolve to one by name.
    expect(resolveCensusDistrict('Kot Addu')).toBeNull();
  });
});

describe('resolveCensusProvince and resolveCensusDivision', () => {
  it('expands the census abbreviations to the names the bundle draws', () => {
    expect(resolveCensusProvince('KP')).toBe('Khyber Pakhtunkhwa');
    expect(resolveCensusProvince('ICT')).toBe('Islamabad Capital Territory');
    expect(resolveCensusProvince('Punjab')).toBe('Punjab');
    expect(resolveCensusProvince('Nowhere')).toBeNull();
  });

  it('maps the capital onto the injected pseudo-division', () => {
    // ICT has no division tier in the census; the bundle injects one so the hierarchy is total.
    expect(resolveCensusDivision('ICT')).toBe('Islamabad');
    expect(resolveCensusDivision('Malakand')).toBe('Malakand');
  });
});

describe('foldToCensusDistrict', () => {
  it('leaves a census district alone', () => {
    expect(foldToCensusDistrict('Dera Ghazi Khan')).toBe('Dera Ghazi Khan');
  });

  it('folds a post-census district into its census-era parent', () => {
    // Every district named in issue #9 as affected.
    expect(foldToCensusDistrict('Taunsa')).toBe('Dera Ghazi Khan');
    expect(foldToCensusDistrict('Kot Addu')).toBe('Muzaffargarh');
    expect(foldToCensusDistrict('Talagang')).toBe('Chakwal');
    expect(foldToCensusDistrict('Wazirabad')).toBe('Gujranwala');
    expect(foldToCensusDistrict('Murree')).toBe('Rawalpindi');
    expect(foldToCensusDistrict('Paharpur')).toBe('Dera Ismail Khan');
    expect(foldToCensusDistrict('Allai')).toBe('Batagram');
    expect(foldToCensusDistrict('Upper Swat')).toBe('Swat');
    expect(foldToCensusDistrict('Central Dir')).toBe('Lower Dir');
  });

  it('folds the whole 2026 Balochistan set, which is noted in copy but never counted', () => {
    expect(foldToCensusDistrict('Quetta East')).toBe('Quetta');
    expect(foldToCensusDistrict('Quetta West')).toBe('Quetta');
    expect(foldToCensusDistrict('Barshore')).toBe('Pishin');
    expect(foldToCensusDistrict('Wadh')).toBe('Khuzdar');
    expect(foldToCensusDistrict('Tump')).toBe('Kech');
    expect(foldToCensusDistrict('Upper Dera Bugti')).toBe('Dera Bugti');
  });

  it('folds both halves of a split into the one district the census counted', () => {
    expect(foldToCensusDistrict('Upper South Waziristan')).toBe('South Waziristan');
    expect(foldToCensusDistrict('Lower South Waziristan')).toBe('South Waziristan');
  });

  it('returns null for a district it has never heard of', () => {
    expect(foldToCensusDistrict('Taftan')).toBeNull();
  });

  it('names a real roster district as the parent of every fold', () => {
    // The check that matters most in the fold table: a typo in `into` would silently create a
    // district that exists nowhere else, and the population would land on nothing.
    const roster = new Set(ROSTER.flatMap((p) => p.districts));
    for (const fold of POST_CENSUS_FOLD_TABLE.folds) {
      expect(roster.has(fold.into), `${fold.district} -> ${fold.into}`).toBe(true);
      // And the child itself must not be a census district, or the fold would erase a real one.
      expect(roster.has(fold.district), `${fold.district} is a 2023 district`).toBe(false);
    }
  });
});

describe('joinCensus', () => {
  it('keys statistics on the same district ids the geography bundle uses', () => {
    const join = joinCensus([row('KP', 'Hazara', 'Abbottabad', 1_500_000)]);
    expect(join.districts.get('Abbotabad')).toMatchObject({
      district: 'Abbotabad',
      province: 'Khyber Pakhtunkhwa',
      division: 'Hazara',
      population: 1_500_000,
    });
  });

  it('reports a census row it cannot place rather than dropping it', () => {
    const join = joinCensus([row('Punjab', 'Lahore', 'Atlantis', 1)]);
    expect(join.unmatched.map((r) => r.district)).toEqual(['Atlantis']);
  });

  it('reports a census district that no row covers', () => {
    const join = joinCensus([row('Punjab', 'Lahore', 'Lahore', 1)]);
    expect(join.missing).toContain('Multan');
    expect(join.missing).not.toContain('Lahore');
    // AJK and GB are absent by design and must never be reported as missing data.
    expect(join.missing).not.toContain('Muzaffarabad');
    expect(join.missing).toHaveLength(CENSUS_DISTRICT_COUNT - 1);
  });

  it('refuses two rows claiming the same district', () => {
    expect(() =>
      joinCensus([row('Punjab', 'Lahore', 'Lahore', 1), row('Punjab', 'Lahore', 'Lahore', 2)]),
    ).toThrow(/Lahore/);
  });

  it('lists AJK and GB as drawn without census data, never as zero', () => {
    const join = joinCensus([]);
    expect(join.withoutCensusData).toHaveLength(20);
    expect(join.withoutCensusData).toContain('Neelum');
    expect(join.withoutCensusData).toContain('Skardu');
    expect(join.districts.get('Neelum')).toBeUndefined();
  });
});

describe('sumBy and reconcileTotals', () => {
  const districts = [
    { district: 'A', province: 'P', division: 'D1', population: 10, households: 1, population2017: 1 },
    { district: 'B', province: 'P', division: 'D1', population: 20, households: 1, population2017: 1 },
    { district: 'C', province: 'Q', division: 'D2', population: 5, households: 1, population2017: 1 },
  ];

  it('sums districts into the tier above them', () => {
    expect(Object.fromEntries(sumBy(districts, 'province'))).toEqual({ P: 30, Q: 5 });
    expect(Object.fromEntries(sumBy(districts, 'division'))).toEqual({ D1: 30, D2: 5 });
  });

  it('agrees with published totals when the districts add up', () => {
    expect(reconcileTotals(sumBy(districts, 'province'), new Map([['P', 30], ['Q', 5]]))).toEqual(
      [],
    );
  });

  it('reports the tier where a district was dropped or double-counted', () => {
    // The whole point of the check: a fold that loses a district shows up as a province short
    // by exactly that district's population.
    const discrepancies = reconcileTotals(
      sumBy(districts, 'province'),
      new Map([['P', 42], ['Q', 5]]),
    );
    expect(discrepancies).toEqual([{ name: 'P', summed: 30, published: 42, delta: -12 }]);
  });

  it('reports a tier that is published but never summed, and vice versa', () => {
    const discrepancies = reconcileTotals(new Map([['P', 30]]), new Map([['R', 7]]));
    expect(discrepancies).toEqual([
      { name: 'P', summed: 30, published: null, delta: null },
      { name: 'R', summed: null, published: 7, delta: null },
    ]);
  });
});
