/**
 * Join PBS Census-2023 **Table 11** — population by mother tongue — onto the 2023 district set.
 *
 * Pure, for the same reason `census.ts` is: what needs reviewing is the judgements, not the
 * plumbing. There are three of them here, and each one is a claim the map will make in colour.
 *
 *  - **The categories are the census's own.** Fifteen of them, spelled as PBS spells them,
 *    including `Kohiostani` — PBS's spelling of Kohistani — and the residual `Others`. Nothing is
 *    re-bucketed, merged or corrected: a "Hindko is really Punjabi" or "Brahvi with Balochi"
 *    judgement is exactly the editorial voice this project refuses (D4/D5), and it would be
 *    invisible once it was baked into a fill colour. A category this build does not recognise
 *    stops the build rather than falling into `Others`.
 *  - **`Others` can never be dominant, and where it wins there is no dominant language.** It is a
 *    residual, not a language: shading a district by it would assert a mother tongue the census
 *    did not record, and handing the label to the largest *named* category instead would be
 *    worse. Upper Chitral is the case that settles it — 194,851 of its 195,161 people fall in
 *    `Others`, because Khowar has no column, and the largest named language is Urdu with 150
 *    speakers. "Upper Chitral: Urdu" would be a plainly false claim printed on a map. So
 *    `dominant` is `null` there, and the fill has to say the census does not name it.
 *  - **Nothing is dropped silently.** A published district that matches no roster district, two
 *    published names that would merge into one, a category we do not know, a census district no
 *    row covered, a district published entirely empty: all five are reported, and all five fail
 *    the build. Aggregation is what makes this necessary — the population join could catch a
 *    duplicate because one district meant one row, whereas here two names summing into one
 *    district look exactly like one district with more tehsils.
 *
 * The published table is tehsil-level: PBS's structured release carries no district tier for
 * Table 11, so districts are summed from the tehsils under them. What makes that safe is the
 * reconciliation in `join-census.ts`, which checks the sums against the province and national
 * figures PBS printed — every one of the fifteen columns, not just the total.
 */

import { normalizeName, provinceOf, ROSTER } from './roster.ts';
import { resolveCensusDistrict } from './census.ts';

/**
 * The census's own mother-tongue categories, in the order Table 11 prints its columns.
 *
 * The order is load-bearing in exactly one place — it breaks a tie for dominance, so a district
 * split evenly resolves the same way on every machine and in every rebuild.
 */
export const CENSUS_LANGUAGES = [
  'Urdu',
  'Punjabi',
  'Sindhi',
  'Pushto',
  'Balochi',
  'Kashmiri',
  'Saraiki',
  'Hindko',
  'Brahvi',
  'Shina',
  'Balti',
  'Mewati',
  'Kalasha',
  'Kohiostani',
  'Others',
] as const;

export type CensusLanguage = (typeof CENSUS_LANGUAGES)[number];

/** The residual column. A count, never an answer to "what do they speak". */
export const RESIDUAL_CATEGORY: CensusLanguage = 'Others';

/** The fourteen categories that name a language, i.e. the ones dominance is chosen from. */
export const SPOKEN_LANGUAGES: readonly CensusLanguage[] = CENSUS_LANGUAGES.filter(
  (language) => language !== RESIDUAL_CATEGORY,
);

/** One published cell: a tehsil, a category, and the speakers counted. */
export interface MotherTongueRow {
  readonly district: string;
  readonly tehsil: string;
  /** As published — upper case, and including the per-unit `TOTAL` row, which is not a language. */
  readonly language: string;
  /** `null` where PBS printed nothing, which for this table means nobody. */
  readonly speakers: number | null;
}

export interface DistrictMotherTongue {
  readonly district: string;
  /** Every category, always. A missing key and a published zero are different claims. */
  readonly speakers: Readonly<Record<CensusLanguage, number>>;
  /** The fifteen categories added up — Table 11's own universe, not the district's population. */
  readonly total: number;
  /**
   * The largest *named* language, or `null` where the residual is larger than any of them and
   * the census therefore names no majority tongue for this district.
   */
  readonly dominant: CensusLanguage | null;
  /** The dominant language's share of `total`, 0–1, or `null` alongside a `null` dominant. */
  readonly dominantShare: number | null;
  /** `Others` as a share of `total` — how much of the district the census does not name. */
  readonly residualShare: number;
}

export interface MotherTongueJoin {
  readonly districts: ReadonlyMap<string, DistrictMotherTongue>;
  /** Published district names matching no 2023 district. Always a build failure. */
  readonly unmatched: readonly string[];
  /** Two published names resolving to one district, as `district: name, name`. */
  readonly collisions: readonly string[];
  /** Published categories this build does not know. Never folded into `Others`. */
  readonly unknownCategories: readonly string[];
  /** Census districts no published row covered. */
  readonly missing: readonly string[];
  /** Districts published with every figure empty — data-shaped, but not data. */
  readonly empty: readonly string[];
}

/** Published category -> the spelling the bundle carries, or `null` if it is not a language. */
const BY_PUBLISHED_NAME = new Map<string, CensusLanguage>(
  CENSUS_LANGUAGES.map((language) => [normalizeName(language), language]),
);

export function resolveCensusLanguage(published: string): CensusLanguage | null {
  return BY_PUBLISHED_NAME.get(normalizeName(published)) ?? null;
}

/**
 * The per-unit `TOTAL` row, which is a checksum rather than a category.
 *
 * Deliberately not read as data. It is the one column of Table 11 the published extract
 * disagrees with itself on — for Rajanpur tehsil it is 41,741 short of that unit's own language
 * rows — so the totals this build carries are summed from the languages, and the published
 * `TOTAL` is left where it is. See `docs/research/mother-tongue-table-11.md`.
 */
const TOTAL_ROW = 'total';

const zeroed = (): Record<CensusLanguage, number> =>
  Object.fromEntries(CENSUS_LANGUAGES.map((l) => [l, 0])) as Record<CensusLanguage, number>;

export function joinMotherTongue(rows: readonly MotherTongueRow[]): MotherTongueJoin {
  const speakersByDistrict = new Map<string, Record<CensusLanguage, number>>();
  /** Roster district -> the published names that resolved to it, for the collision report. */
  const publishedNames = new Map<string, Set<string>>();
  const unmatched = new Set<string>();
  const unknownCategories = new Set<string>();

  for (const row of rows) {
    if (normalizeName(row.language) === TOTAL_ROW) continue;
    const language = resolveCensusLanguage(row.language);
    if (language === null) {
      unknownCategories.add(row.language);
      continue;
    }
    const district = resolveCensusDistrict(row.district);
    if (district === null) {
      unmatched.add(row.district);
      continue;
    }
    const names = publishedNames.get(district) ?? new Set<string>();
    names.add(row.district);
    publishedNames.set(district, names);

    const speakers = speakersByDistrict.get(district) ?? zeroed();
    speakers[language] += row.speakers ?? 0;
    speakersByDistrict.set(district, speakers);
  }

  const districts = new Map<string, DistrictMotherTongue>();
  const empty: string[] = [];
  for (const [district, speakers] of speakersByDistrict) {
    const total = CENSUS_LANGUAGES.reduce((sum, l) => sum + speakers[l], 0);
    if (total === 0) {
      empty.push(district);
      continue;
    }
    const dominant = dominantLanguage(speakers);
    districts.set(district, {
      district,
      speakers,
      total,
      dominant,
      dominantShare: dominant === null ? null : speakers[dominant] / total,
      residualShare: speakers[RESIDUAL_CATEGORY] / total,
    });
  }

  const collisions = [...publishedNames]
    .filter(([, names]) => names.size > 1)
    .map(([district, names]) => `${district}: ${[...names].sort().join(', ')}`)
    .sort();

  const censusAtom = ROSTER.filter((p) => p.kind !== 'territory').flatMap((p) => p.districts);
  const missing = censusAtom.filter((d) => !districts.has(d) && !empty.includes(d));

  return {
    districts,
    unmatched: [...unmatched].sort(),
    collisions,
    unknownCategories: [...unknownCategories].sort(),
    missing,
    empty: empty.sort(),
  };
}

/**
 * The largest named language, ties going to the census's own column order — or `null` where the
 * residual beats every named one.
 *
 * The `null` is the important half. Two districts in the current data reach it, both in Chitral,
 * where the census has no Khowar column and nearly everyone lands in `Others`; naming the largest
 * remaining category would put "Urdu" on a district where 150 people out of 195,161 speak it.
 * A district whose language the census does not name is a fact about the census, and the map has
 * to be able to say so.
 */
function dominantLanguage(
  speakers: Readonly<Record<CensusLanguage, number>>,
): CensusLanguage | null {
  let dominant = SPOKEN_LANGUAGES[0] as CensusLanguage;
  for (const language of SPOKEN_LANGUAGES) {
    if (speakers[language] > speakers[dominant]) dominant = language;
  }
  return speakers[RESIDUAL_CATEGORY] > speakers[dominant] ? null : dominant;
}

/** Add districts up into the province that contains them, category by category. */
export function sumLanguagesByProvince(
  districts: Iterable<DistrictMotherTongue>,
): Map<string, Record<CensusLanguage, number>> {
  const totals = new Map<string, Record<CensusLanguage, number>>();
  for (const district of districts) {
    const province = provinceOf(district.district);
    if (province === null) continue;
    const accumulated = totals.get(province) ?? zeroed();
    for (const language of CENSUS_LANGUAGES) accumulated[language] += district.speakers[language];
    totals.set(province, accumulated);
  }
  return totals;
}
