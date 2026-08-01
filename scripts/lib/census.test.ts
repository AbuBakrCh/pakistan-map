import { describe, expect, it } from 'vitest';
import {
  joinCensus,
  reconcileTotals,
  resolveCensusDistrict,
  resolveCensusDivision,
  resolveCensusProvince,
  sumBy,
  type CensusRow,
} from './census.ts';
import {
  CENSUS_DISTRICT_COUNT,
  POST_CENSUS_DISTRICT_FOLDS,
  POST_CENSUS_FOLD_TABLE,
  ROSTER,
  indexFolds,
} from './roster.ts';

const row = (
  region: string,
  division: string,
  district: string,
  population: number,
): CensusRow => ({ region, division, district, population, households: 1 });

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

describe('the post-census fold table', () => {
  it('folds every post-census district issue #9 names into its census-era parent', () => {
    expect(POST_CENSUS_DISTRICT_FOLDS).toMatchObject({
      Taunsa: 'Dera Ghazi Khan',
      'Kot Addu': 'Muzaffargarh',
      Talagang: 'Chakwal',
      Wazirabad: 'Gujranwala',
      Murree: 'Rawalpindi',
      Paharpur: 'Dera Ismail Khan',
      Allai: 'Batagram',
      'Upper Swat': 'Swat',
      'Central Dir': 'Lower Dir',
    });
  });

  it('folds the whole 2026 Balochistan set, which is noted in copy but never counted', () => {
    expect(POST_CENSUS_DISTRICT_FOLDS).toMatchObject({
      'Quetta East': 'Quetta',
      'Quetta West': 'Quetta',
      Barshore: 'Pishin',
      Wadh: 'Khuzdar',
      Tump: 'Kech',
      'Upper Dera Bugti': 'Dera Bugti',
      'South Dera Bugti': 'Dera Bugti',
    });
  });

  it('folds both halves of a split into the one district the census counted', () => {
    expect(POST_CENSUS_DISTRICT_FOLDS['Upper South Waziristan']).toBe('South Waziristan');
    expect(POST_CENSUS_DISTRICT_FOLDS['Lower South Waziristan']).toBe('South Waziristan');
  });

  it('has no entry for a district that was never created', () => {
    // Taftan is not a district at all — docs/research/balochistan-division-district-set.md.
    expect(POST_CENSUS_DISTRICT_FOLDS['Taftan']).toBeUndefined();
  });

  it('cites the 2026 restructuring folds, which no fetched relation attests', () => {
    // Every other fold is corroborated by an OSM relation the build actually classifies. The
    // 2026 Balochistan set is not in the fetch at all — it is drawn from press reporting alone,
    // so an entry with no note and no source is an unverifiable claim about a live political
    // reorganisation, which the file's own `authority` field forbids.
    const cited = (district: string): void => {
      const fold = POST_CENSUS_FOLD_TABLE.find((f) => f.district === district);
      expect(fold, district).toBeDefined();
      const documented = fold as { note?: string; source?: string };
      expect(
        (documented.note ?? '').length > 0 || (documented.source ?? '').length > 0,
        `${district} is uncited`,
      ).toBe(true);
    };
    for (const district of ['Quetta East', 'Quetta West', 'Barshore', 'Wadh', 'Tump']) {
      cited(district);
    }
    // The two Dera Bugti halves carry a URL, not just a note: neither appears in CLAUDE.md's
    // summary of the notification, so the prose is not itself a source for them.
    for (const district of ['Upper Dera Bugti', 'South Dera Bugti']) {
      cited(district);
      const fold = POST_CENSUS_FOLD_TABLE.find((f) => f.district === district) as {
        source?: string;
      };
      expect(fold.source, district).toMatch(/^Dawn, .*https:\/\/www\.dawn\.com\//);
    }
  });

  it('refuses a district listed twice, rather than letting the later row win', () => {
    // The file is hand-edited whenever Pakistan reorganises, so the realistic failure is the
    // same district pasted twice with two different parents. Only one would ever be reported.
    expect(() =>
      indexFolds([
        { district: 'Kot Addu', into: 'Muzaffargarh' },
        { district: 'Kot Addu', into: 'Layyah' },
      ]),
    ).toThrow(/Kot Addu twice/);
    // Two spellings of one district are the same duplicate wearing a hat.
    expect(() =>
      indexFolds([
        { district: 'Kot Addu', into: 'Muzaffargarh' },
        { district: 'Kot Addu District', into: 'Layyah' },
      ]),
    ).toThrow(/twice/);
  });

  it('names a real roster district as the parent of every fold', () => {
    // The check that matters most in the fold table: a typo in `into` would silently create a
    // district that exists nowhere else, and the population would land on nothing.
    const roster = new Set(ROSTER.flatMap((p) => p.districts));
    for (const fold of POST_CENSUS_FOLD_TABLE) {
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

  it('refuses a row whose region contradicts the roster', () => {
    // Both sides name the same thing: which province this district is in. Preferring one
    // silently would hide the only evidence that a name resolved to the wrong district.
    expect(() => joinCensus([row('Sindh', 'Lahore', 'Lahore', 1)])).toThrow(
      /Lahore in Sindh, the roster puts it in Punjab/,
    );
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
    { district: 'A', province: 'P', division: 'D1', population: 10, households: 1 },
    { district: 'B', province: 'P', division: 'D1', population: 20, households: 1 },
    { district: 'C', province: 'Q', division: 'D2', population: 5, households: 1 },
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
