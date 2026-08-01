import { describe, expect, it } from 'vitest';
import { classifyDistrict, classifyDivision, provinceOf, reconcileDistricts } from './reconcile.ts';
import {
  CENSUS_DISTRICT_COUNT,
  ROSTER,
  ROSTER_DISTRICT_COUNT,
  normalizeName,
  resolveRosterName,
} from './roster.ts';

const rel = (id: number, name: string) => ({ id, name });

describe('the 2023 roster', () => {
  it('holds 156 districts, of which 136 are the census atom', () => {
    // PBS, List of Administrative Districts by Division & Province (as on 01-03-2023).
    // 136 = four provinces + ICT; the extra 20 are AJK and GB, which are drawn but not shaded.
    expect(ROSTER_DISTRICT_COUNT).toBe(156);
    expect(CENSUS_DISTRICT_COUNT).toBe(136);
  });

  it('matches the published per-province counts', () => {
    const counts = Object.fromEntries(ROSTER.map((p) => [p.code, p.districts.length]));
    expect(counts).toEqual({ KP: 35, PB: 36, SD: 30, BA: 34, ICT: 1, AJK: 10, GB: 10 });
  });

  it('has no duplicate district names across provinces', () => {
    const all = ROSTER.flatMap((p) => p.districts);
    expect(new Set(all).size).toBe(all.length);
  });

  it('excludes units created after the census date', () => {
    // Verified in docs/research/balochistan-division-district-set.md.
    for (const name of ['Hub', 'Usta Muhammad', 'Wadh', 'Tump', 'Quetta East', 'Taftan']) {
      expect(resolveRosterName(name)).toBeNull();
    }
  });

  it('keeps Surab, which predates the census despite reading as new', () => {
    // Created between the 2017 and 2023 censuses, so it has a census row and must be drawn.
    expect(resolveRosterName('Surab District')).toBe('Surab');
  });
});

describe('normalizeName', () => {
  it('strips the administrative suffix and punctuation', () => {
    expect(normalizeName('Kech District')).toBe('kech');
    expect(normalizeName('Quetta Division')).toBe('quetta');
    expect(normalizeName('Kolai-Palas  District')).toBe('kolai palas');
  });

  it('does not conflate distinct districts that share a prefix', () => {
    expect(normalizeName('Upper Dir')).not.toBe(normalizeName('Lower Dir'));
  });
});

describe('classifyDistrict', () => {
  it('accepts a district whose OSM spelling differs from PBS', () => {
    expect(classifyDistrict(rel(1, 'Battagram District'))).toEqual({
      kind: 'district',
      district: 'Batagram',
    });
    expect(classifyDistrict(rel(2, 'Tando Allahyar District'))).toEqual({
      kind: 'district',
      district: 'Tando Allah Yar',
    });
  });

  it('folds a post-census district into its parent', () => {
    expect(classifyDistrict(rel(3, 'Kot Addu District'))).toEqual({
      kind: 'fold',
      district: 'Muzaffargarh',
      from: 'Kot Addu',
    });
  });

  it('folds both halves of a post-census split into one 2023 district', () => {
    const lower = classifyDistrict(rel(16463404, 'Lower South Waziristan District'));
    const upper = classifyDistrict(rel(16463405, 'Upper South Waziristan District'));
    expect(lower).toMatchObject({ kind: 'fold', district: 'South Waziristan' });
    expect(upper).toMatchObject({ kind: 'fold', district: 'South Waziristan' });
  });

  it('trusts the relation id over a misleading name, for Karachi', () => {
    // OSM calls Karachi South plain "Karachi District" and Karachi West "Orangi". Matching on
    // name would misplace population in the largest city in the country.
    expect(classifyDistrict(rel(16350836, 'Karachi District'))).toEqual({
      kind: 'district',
      district: 'Karachi South',
    });
    expect(classifyDistrict(rel(16347667, 'Orangi District'))).toEqual({
      kind: 'district',
      district: 'Karachi West',
    });
  });

  it('drops relations outside Pakistan', () => {
    expect(classifyDistrict(rel(10389554, 'Kupwara'))).toMatchObject({ kind: 'dropped' });
  });

  it('drops a district abolished before the census date', () => {
    expect(classifyDistrict(rel(16632271, 'Karezat District'))).toMatchObject({ kind: 'dropped' });
  });

  it('reports anything it cannot place rather than silently skipping it', () => {
    expect(classifyDistrict(rel(999, 'Somewhere Entirely New'))).toEqual({ kind: 'unclassified' });
  });
});

describe('classifyDivision', () => {
  it('folds divisions created after the census', () => {
    expect(classifyDivision(rel(1, 'Banbhore Division'))).toMatchObject({
      kind: 'fold',
      district: 'Hyderabad',
    });
    expect(classifyDivision(rel(2, 'Gujrat Division'))).toMatchObject({
      kind: 'fold',
      district: 'Gujranwala',
    });
  });

  it('keeps a 2023 division, stripping the suffix', () => {
    expect(classifyDivision(rel(3, 'Malakand Division'))).toEqual({
      kind: 'district',
      district: 'Malakand',
    });
  });
});

describe('reconcileDistricts', () => {
  it('maps every folded relation onto a real roster district', () => {
    const result = reconcileDistricts([
      rel(16463404, 'Lower South Waziristan District'),
      rel(16463405, 'Upper South Waziristan District'),
    ]);
    expect([...new Set(result.assignments.values())]).toEqual(['South Waziristan']);
    expect(result.folded).toHaveLength(2);
    expect(provinceOf('South Waziristan')).toBe('Khyber Pakhtunkhwa');
  });

  it('reports roster districts that no relation covers', () => {
    const result = reconcileDistricts([rel(1, 'Lahore District')]);
    expect(result.missing).toContain('Islamabad');
    expect(result.missing).not.toContain('Lahore');
  });
});
