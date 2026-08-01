import { describe, expect, it } from 'vitest';
import {
  CENSUS_LANGUAGES,
  RESIDUAL_CATEGORY,
  joinMotherTongue,
  resolveCensusLanguage,
  sumLanguagesByProvince,
  type MotherTongueRow,
} from './mother-tongue.ts';

const row = (
  district: string,
  tehsil: string,
  language: string,
  speakers: number | null,
): MotherTongueRow => ({ district, tehsil, language, speakers });

/** One tehsil's worth of rows: every category published, most of them empty. */
const tehsil = (
  district: string,
  name: string,
  spoken: Readonly<Record<string, number>>,
): MotherTongueRow[] => [
  ...CENSUS_LANGUAGES.map((language) =>
    row(district, name, language.toUpperCase(), spoken[language] ?? null),
  ),
  // The published table carries a TOTAL row per unit alongside the languages.
  row(district, name, 'TOTAL', Object.values(spoken).reduce((a, b) => a + b, 0)),
];

describe('resolveCensusLanguage', () => {
  it('accepts every category the census publishes, in the census spelling', () => {
    expect(resolveCensusLanguage('PUSHTO')).toBe('Pushto');
    expect(resolveCensusLanguage('SARAIKI')).toBe('Saraiki');
    // PBS's own spelling of Kohistani, reproduced rather than corrected.
    expect(resolveCensusLanguage('KOHIOSTANI')).toBe('Kohiostani');
    expect(resolveCensusLanguage('OTHERS')).toBe('Others');
  });

  it('refuses a category it does not know, rather than bucketing it into Others', () => {
    // A new column in a future release must stop the build. Folding it into Others would
    // publish a distribution that silently omits a language PBS chose to name.
    expect(resolveCensusLanguage('PASHTO')).toBeNull();
    expect(resolveCensusLanguage('BURUSHASKI')).toBeNull();
  });

  it('does not treat the TOTAL row as a language', () => {
    expect(resolveCensusLanguage('TOTAL')).toBeNull();
  });
});

describe('joinMotherTongue', () => {
  it('sums a district from the tehsils published under it', () => {
    const join = joinMotherTongue([
      ...tehsil('LAHORE', 'LAHORE CITY', { Punjabi: 100, Urdu: 60 }),
      ...tehsil('LAHORE', 'LAHORE CANTT', { Punjabi: 40, Urdu: 20, Others: 5 }),
    ]);
    const lahore = join.districts.get('Lahore');
    expect(lahore?.speakers['Punjabi']).toBe(140);
    expect(lahore?.speakers['Urdu']).toBe(80);
    expect(lahore?.speakers['Others']).toBe(5);
    expect(lahore?.total).toBe(225);
  });

  it('carries every published category, including the ones nobody in the district speaks', () => {
    // A missing key and a published zero are different claims. The census published Kalasha for
    // Lahore; it published it as nothing, which is a figure, not an absence.
    const join = joinMotherTongue(tehsil('LAHORE', 'LAHORE CITY', { Punjabi: 10 }));
    expect(Object.keys(join.districts.get('Lahore')!.speakers).sort()).toEqual(
      [...CENSUS_LANGUAGES].sort(),
    );
    expect(join.districts.get('Lahore')?.speakers['Kalasha']).toBe(0);
  });

  it('names the largest language as dominant, with its share of the district', () => {
    const join = joinMotherTongue(tehsil('QUETTA', 'QUETTA CITY', { Pushto: 60, Brahvi: 40 }));
    expect(join.districts.get('Quetta')?.dominant).toBe('Pushto');
    expect(join.districts.get('Quetta')?.dominantShare).toBeCloseTo(0.6, 10);
  });

  it('names no dominant language where the residual beats every named one', () => {
    // Upper Chitral, in miniature: Khowar has no census column, so the district lands in Others
    // and the largest named language is a rounding error. Naming it would print a false claim;
    // naming "Others" would invent a language. The honest answer is that the census does not say.
    const join = joinMotherTongue(tehsil('UPPER CHITRAL', 'MASTUJ', { Others: 90, Urdu: 10 }));
    const chitral = join.districts.get('Upper Chitral');
    expect(chitral?.dominant).toBeNull();
    expect(chitral?.dominantShare).toBeNull();
    expect(chitral?.speakers[RESIDUAL_CATEGORY]).toBe(90);
    expect(chitral?.residualShare).toBeCloseTo(0.9, 10);
    // Still counted, still reconcilable — absent a label, not absent from the totals.
    expect(chitral?.total).toBe(100);
  });

  it('keeps the dominant language where the residual is merely large', () => {
    const join = joinMotherTongue(tehsil('GWADAR', 'GWADAR', { Others: 40, Balochi: 45 }));
    expect(join.districts.get('Gwadar')?.dominant).toBe('Balochi');
    expect(join.districts.get('Gwadar')?.residualShare).toBeCloseTo(40 / 85, 10);
  });

  it('breaks a tie by the order the census prints its columns, not by chance', () => {
    const join = joinMotherTongue(tehsil('KASUR', 'KASUR', { Punjabi: 50, Urdu: 50 }));
    // Urdu is column 2 and Punjabi column 3; the earlier column wins.
    expect(join.districts.get('Kasur')?.dominant).toBe('Urdu');
  });

  it('reconciles the census spelling to the roster spelling', () => {
    const join = joinMotherTongue(tehsil('UMER KOT', 'UMERKOT', { Sindhi: 10 }));
    expect([...join.districts.keys()]).toEqual(['Umerkot']);
  });

  it('reports a published district it cannot place, rather than dropping it', () => {
    const join = joinMotherTongue(tehsil('ATLANTIS', 'ATLANTIS', { Urdu: 10 }));
    expect(join.unmatched).toEqual(['ATLANTIS']);
    expect(join.districts.size).toBe(0);
  });

  it('reports two published names that would merge into one district', () => {
    // Aggregation hides this where the population join could not: two names summing into one
    // district look exactly like one district with more tehsils, and some other district is
    // then missing entirely.
    const join = joinMotherTongue([
      ...tehsil('ABBOTTABAD', 'ABBOTTABAD', { Hindko: 10 }),
      ...tehsil('ABBOTABAD', 'HAVELIAN', { Hindko: 5 }),
    ]);
    expect(join.collisions).toEqual(['Abbotabad: ABBOTABAD, ABBOTTABAD']);
  });

  it('reports a category the census published that this build does not know', () => {
    const join = joinMotherTongue([row('LAHORE', 'LAHORE CITY', 'BURUSHASKI', 12)]);
    expect(join.unknownCategories).toEqual(['BURUSHASKI']);
  });

  it('reports the census districts no row covered', () => {
    const join = joinMotherTongue(tehsil('LAHORE', 'LAHORE CITY', { Punjabi: 10 }));
    expect(join.missing).toContain('Karachi South');
    expect(join.missing).not.toContain('Lahore');
    // AJK and GB are not census districts and are never expected here (D25).
    expect(join.missing).not.toContain('Muzaffarabad');
  });

  it('reports a district the census covered but left entirely empty', () => {
    // Every published figure null is not a distribution; it is a district with no data wearing
    // one. Shading it would paint whichever language sorts first across an empty district.
    const join = joinMotherTongue(CENSUS_LANGUAGES.map((l) => row('CHAMAN', 'CHAMAN', l.toUpperCase(), null)));
    expect(join.empty).toEqual(['Chaman']);
    expect(join.districts.has('Chaman')).toBe(false);
  });
});

describe('sumLanguagesByProvince', () => {
  it('adds districts up into the province that contains them', () => {
    const join = joinMotherTongue([
      ...tehsil('LAHORE', 'LAHORE CITY', { Punjabi: 100 }),
      ...tehsil('KASUR', 'KASUR', { Punjabi: 50, Urdu: 5 }),
      ...tehsil('KARACHI SOUTH', 'SADDAR', { Urdu: 70 }),
    ]);
    const totals = sumLanguagesByProvince(join.districts.values());
    expect(totals.get('Punjab')?.['Punjabi']).toBe(150);
    expect(totals.get('Punjab')?.['Urdu']).toBe(5);
    expect(totals.get('Sindh')?.['Urdu']).toBe(70);
    expect(totals.get('Sindh')?.['Punjabi']).toBe(0);
  });
});
