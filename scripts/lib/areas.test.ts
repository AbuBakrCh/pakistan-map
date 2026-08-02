/**
 * What the area join does when the transcription is wrong (#49).
 *
 * `statistics.test.ts` holds the 136 figures that ship and the totals they reconcile to. What it
 * cannot show is any of the ways a hand-typed table goes wrong, because the committed one is
 * right: a district name PBS spells differently, two rows landing on one district, a row filed
 * under the wrong province, a district nobody typed. Each of those produces a plausible-looking
 * artifact — a province short by one district's ground, or a unit whose area is quietly somebody
 * else's — so each is refused **by name** here, on a roster small enough to check by eye.
 *
 * The one check that is not about names is the reason the reference file carries a population
 * column at all: two areas swapped between neighbouring districts sum to their province exactly,
 * and every other check in this module passes.
 */

import { describe, expect, it } from 'vitest';
import {
  TABLE_1_POPULATION_DELTAS,
  joinAreas,
  reconcileTranscription,
  sumAreasByProvince,
  type AreaRow,
} from './areas.ts';
import { CENSUS_DISTRICT_COUNT } from './roster.ts';

const row = (district: string, province: string, areaSqKm: number, population2023 = 1): AreaRow => ({
  district,
  province,
  areaSqKm,
  population2023,
});

/** Three real districts of one real province, which is all any of these cases needs. */
const LAHORE = row('LAHORE', 'Punjab', 1_772);
const KASUR = row('KASUR', 'Punjab', 3_995);
const JHELUM = row('JHELUM', 'Punjab', 3_587);

describe('joining Table 1 onto the roster', () => {
  it('resolves PBS’s own spelling rather than requiring the roster’s', () => {
    // Table 1's Sindh table prints TANDO AHYAR where PBS's district list prints Tando Allah Yar.
    // The transcription carries what the source prints; the alias table resolves it, exactly as it
    // does for every other disagreement between PBS's own documents.
    const join = joinAreas([row('TANDO AHYAR', 'Sindh', 1_554)]);
    expect(join.unmatched).toEqual([]);
    expect(join.areas.get('Tando Allah Yar')).toBe(1_554);
  });

  it('refuses a row that matches no district, naming it rather than dropping it', () => {
    const join = joinAreas([LAHORE, row('TANDO ALLAHYARISTAN', 'Sindh', 10)]);
    expect(join.unmatched.map((found) => found.district)).toEqual(['TANDO ALLAHYARISTAN']);
    // A dropped row is a district with no published area, and a unit containing it would carry
    // none at all — which is indistinguishable, on the card, from ground PBS never published.
    expect(join.areas.has('Lahore')).toBe(true);
  });

  it('names both spellings where two rows land on one district', () => {
    // The failure this catches is not the duplicate: it is the district that quietly ends up with
    // no row at all while the count still looks plausible.
    const join = joinAreas([LAHORE, row('LAHORE DISTRICT', 'Punjab', 9_999)]);
    expect(join.collisions).toEqual([
      { district: 'Lahore', publishedNames: ['LAHORE', 'LAHORE DISTRICT'] },
    ]);
  });

  it('refuses a row whose province the roster disagrees with, naming both', () => {
    // One of the two names resolved to the wrong district, and the province is the cheap way to
    // find out — the same check `joinCensus` makes of the census rows.
    const join = joinAreas([row('LAHORE', 'Sindh', 1_772)]);
    expect(join.misplaced).toEqual([
      { district: 'Lahore', published: 'Sindh', roster: 'Punjab' },
    ]);
    expect(join.areas.has('Lahore')).toBe(false);
  });

  it('names every census district no row covered', () => {
    const join = joinAreas([LAHORE]);
    expect(join.missing).toHaveLength(CENSUS_DISTRICT_COUNT - 1);
    expect(join.missing).toContain('Kasur');
    expect(join.missing).not.toContain('Lahore');
    // Never AJK's or GB's: they are not census districts, so a table that does not cover them is
    // complete rather than short (D25).
    expect(join.missing).not.toContain('Neelum');
  });

  it('sums into the province tier and nowhere else', () => {
    // PBS publishes an area for the four provinces and the capital, and none for a division —
    // which is why this is the only tier the transcription is checked against.
    const totals = sumAreasByProvince(joinAreas([LAHORE, KASUR, JHELUM]).areas);
    expect(totals.get('Punjab')).toBe(1_772 + 3_995 + 3_587);
    expect([...totals.keys()]).toEqual(['Punjab']);
  });
});

describe('the transcription check', () => {
  const populations = new Map([
    ['Lahore', 13_004_135],
    ['Kasur', 3_842_314],
  ]);

  it('passes a row whose printed population is the one the bundle already carries', () => {
    expect(
      reconcileTranscription([row('LAHORE', 'Punjab', 1_772, 13_004_135)], populations),
    ).toEqual([]);
  });

  it('catches two areas swapped between neighbours, which every other check lets through', () => {
    // The whole reason the population column is transcribed. Swap the two areas and the province
    // still sums exactly, every name still resolves, and nothing else in this module notices.
    const swapped = [
      row('LAHORE', 'Punjab', 3_842, 3_842_314),
      row('KASUR', 'Punjab', 1_772, 13_004_135),
    ];
    expect(sumAreasByProvince(joinAreas(swapped).areas).get('Punjab')).toBe(3_842 + 1_772);
    expect(reconcileTranscription(swapped, populations).map((found) => found.name)).toEqual([
      'Lahore',
      'Kasur',
    ]);
  });

  it('allows exactly the districts PBS’s own two releases disagree on, and no others', () => {
    // Pinned per district rather than tolerated as a margin: any other difference, at any other
    // district, is a typo in the transcription and fails.
    const jhang = 3_065_639;
    const pinned = TABLE_1_POPULATION_DELTAS['Jhang'] ?? 0;
    expect(pinned).toBe(-12_081);
    const carried = new Map([['Jhang', jhang]]);
    expect(reconcileTranscription([row('JHANG', 'Punjab', 8_809, jhang + pinned)], carried)).toEqual(
      [],
    );
    expect(
      reconcileTranscription([row('JHANG', 'Punjab', 8_809, jhang + pinned + 1)], carried),
    ).toHaveLength(1);
  });

  it('is four cancelling pairs of neighbours, so no province total moves', () => {
    // Which is why both releases agree to the person at province and national level, and why this
    // is a disagreement to state rather than a figure to choose between.
    expect(Object.keys(TABLE_1_POPULATION_DELTAS)).toHaveLength(8);
    const pairs = [
      ['Jhang', 'Toba Tek Singh'],
      ['Karachi East', 'Malir'],
      ['Kalat', 'Surab'],
      ['Kachhi (Bolan)', 'Nasirabad'],
    ] as const;
    for (const [one, other] of pairs) {
      expect(
        (TABLE_1_POPULATION_DELTAS[one] ?? 0) + (TABLE_1_POPULATION_DELTAS[other] ?? 0),
        `${one} and ${other}`,
      ).toBe(0);
    }
  });

  it('reports a district the bundle has no population for rather than passing it', () => {
    expect(reconcileTranscription([row('MULTAN', 'Punjab', 3_720, 5_362_305)], populations)).toEqual(
      [{ name: 'Multan', summed: null, published: 5_362_305, delta: null }],
    );
  });
});
