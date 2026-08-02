import { describe, expect, it } from 'vitest';
import { classifyDistrict, classifyDivision, reconcileDistricts } from './reconcile.ts';
import {
  CENSUS_DISTRICT_COUNT,
  NAME_ALIASES,
  PINNED_RELATION_IDS,
  ROSTER,
  ROSTER_DISTRICT_COUNT,
  normalizeName,
  provinceOf,
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

describe('official name for display, OSM name for the join', () => {
  // docs/research/ajk-district-set.md settles which name goes where for AJK, and the rule has
  // two halves that are easy to swap by accident: the roster name is what every rendered
  // surface prints, and the alias is only ever the spelling somebody else uses to find it.
  // Both directions are asserted, because inverting the pair leaves a build that passes every
  // join test while displaying a headquarters town where a district should be.

  it('displays the AJK government name and not the OSM one', () => {
    const ajk = ROSTER.find((p) => p.code === 'AJK')?.districts ?? [];
    // Official: AJ&K Bureau of Statistics, "AJ&K at a Glance – 2025".
    expect(ajk).toContain('Jhelum Valley');
    // OSM's "Hattian Bala District" is the headquarters town and the tehsil, not the district.
    expect(ajk).not.toContain('Hattian Bala');
    expect(ajk).toContain('Sudhnoti');
    expect(ajk).not.toContain('Sudhanoti');
  });

  it('still resolves the OSM name onto it, by name and by relation id', () => {
    expect(resolveRosterName('Hattian Bala District')).toBe('Jhelum Valley');
    expect(PINNED_RELATION_IDS['Jhelum Valley']).toBe(8192278);
    expect(classifyDistrict(rel(8192278, 'Hattian Bala District'))).toEqual({
      kind: 'unit',
      name: 'Jhelum Valley',
    });
    // And the official name is not a second way in that the id would fail to vouch for.
    expect(classifyDistrict(rel(999_003, 'Jhelum Valley District'))).toEqual({
      kind: 'unclassified',
    });
  });

  it('does not confuse Jhelum Valley with Punjab’s own Jhelum', () => {
    expect(resolveRosterName('Jhelum District')).toBe('Jhelum');
    expect(provinceOf('Jhelum')).toBe('Punjab');
    expect(provinceOf('Jhelum Valley')).toBe('Azad Jammu & Kashmir');
  });

  it('carries both of Neelum’s outside spellings', () => {
    // The canonical name being right is not evidence that the aliases are: OSM and the AJK
    // Election Commission spell it two different ways, and neither is the roster name.
    expect(resolveRosterName('Neelam Valley District')).toBe('Neelum'); // OSM
    expect(resolveRosterName('District Neelum Valley')).toBe('Neelum'); // AJK EC
    expect(resolveRosterName('Neelum District')).toBe('Neelum');
  });

  it('never lets an alias be a name the app displays', () => {
    // The inversion guard. An alias key that normalizes to a roster district's own name means
    // some district is displayed under the spelling that was meant to be the join key.
    const displayed = new Map(
      ROSTER.flatMap((p) => p.districts).map((d) => [normalizeName(d), d] as const),
    );
    for (const key of Object.keys(NAME_ALIASES)) {
      const collision = displayed.get(key);
      expect(
        collision === undefined,
        `${key} is an alias and also the displayed name of ${collision} — ` +
          'the display/join rule is inverted',
      ).toBe(true);
    }
  });

  it('points every alias at a district that exists', () => {
    const districts = new Set(ROSTER.flatMap((p) => p.districts));
    for (const [key, target] of Object.entries(NAME_ALIASES)) {
      expect(districts.has(target), `${key} aliases ${target}, which is not a roster district`)
        .toBe(true);
    }
    for (const name of Object.keys(PINNED_RELATION_IDS)) {
      expect(districts.has(name), `${name} is pinned to a relation but is not a roster district`)
        .toBe(true);
    }
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
      kind: 'unit',
      name: 'Batagram',
    });
    expect(classifyDistrict(rel(2, 'Tando Allahyar District'))).toEqual({
      kind: 'unit',
      name: 'Tando Allah Yar',
    });
  });

  it('folds a post-census district into its parent', () => {
    expect(classifyDistrict(rel(3, 'Kot Addu District'))).toEqual({
      kind: 'fold',
      name: 'Muzaffargarh',
      from: 'Kot Addu',
    });
  });

  it('folds both halves of a post-census split into one 2023 district', () => {
    const lower = classifyDistrict(rel(16463404, 'Lower South Waziristan District'));
    const upper = classifyDistrict(rel(16463405, 'Upper South Waziristan District'));
    expect(lower).toMatchObject({ kind: 'fold', name: 'South Waziristan' });
    expect(upper).toMatchObject({ kind: 'fold', name: 'South Waziristan' });
  });

  it('trusts the relation id over a misleading name, for Karachi', () => {
    // OSM calls Karachi South plain "Karachi District" and Karachi West "Orangi". Matching on
    // name would misplace population in the largest city in the country.
    expect(classifyDistrict(rel(16350836, 'Karachi District'))).toEqual({
      kind: 'unit',
      name: 'Karachi South',
    });
    expect(classifyDistrict(rel(16347667, 'Orangi District'))).toEqual({
      kind: 'unit',
      name: 'Karachi West',
    });
  });

  it('refuses a name-identical district from across the Line of Control', () => {
    // Indian-administered J&K has its own Poonch and Haveli at the same admin level. Matching
    // on name would absorb territory from the other side of a ceasefire line into AJK.
    expect(classifyDistrict(rel(8191016, 'Poonch District'))).toEqual({
      kind: 'unit',
      name: 'Poonch',
    });
    expect(classifyDistrict(rel(999_001, 'Poonch District'))).toEqual({ kind: 'unclassified' });
    expect(classifyDistrict(rel(999_002, 'Haveli'))).toEqual({ kind: 'unclassified' });
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
      name: 'Hyderabad',
    });
    expect(classifyDivision(rel(2, 'Gujrat Division'))).toMatchObject({
      kind: 'fold',
      name: 'Gujranwala',
    });
  });

  it('keeps a 2023 division, stripping the suffix', () => {
    expect(classifyDivision(rel(3, 'Malakand Division'))).toEqual({
      kind: 'unit',
      name: 'Malakand',
    });
  });

  it('normalises division spelling to PBS, matching the districts inside it', () => {
    // OSM spells the division "Qalat" but the district inside it "Kalat". Without this the
    // bundle would ship the same name spelled two ways depending on which tier you read.
    expect(classifyDivision(rel(4, 'Qalat Division'))).toEqual({ kind: 'unit', name: 'Kalat' });
    expect(classifyDivision(rel(5, 'Makran Division'))).toEqual({ kind: 'unit', name: 'Mekran' });
    expect(classifyDistrict(rel(6, 'Kalat District'))).toEqual({ kind: 'unit', name: 'Kalat' });
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
