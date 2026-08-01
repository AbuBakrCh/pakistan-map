/**
 * Join the PBS 2023 Digital Census onto the district set the bundle draws.
 *
 * Pure — no filesystem, no parsing — because what needs reviewing here is the judgements, not
 * the plumbing: which census row is which district, which districts the census never counted,
 * and whether the districts still add up to what PBS published above them.
 *
 * Two rules carry over from the geometry pipeline and are the reason this module exists at all:
 *
 *  - **Nothing is dropped silently.** A census row that matches no district, and a district
 *    that no census row covers, are both reported and both fail the build. A dropped row is a
 *    province quietly short by one district's population, and nobody would notice.
 *  - **Absence is stated, never defaulted.** AJK and Gilgit-Baltistan are drawn but were not
 *    covered by the 2023 census results, so their districts carry no population at all — not
 *    zero, not null-by-accident. They are listed as such (D25).
 */

import {
  ICT_PSEUDO_DIVISION,
  POST_CENSUS_DISTRICT_FOLDS,
  ROSTER,
  normalizeName,
  provinceOf,
  resolveRosterName,
} from './roster.ts';

/** One published district row, as the census tables give it. */
export interface CensusRow {
  readonly region: string;
  readonly division: string;
  readonly district: string;
  readonly population: number;
  readonly households: number;
  readonly population2017: number;
}

/** One district's statistics, keyed and labelled the way the geography bundle is. */
export interface DistrictStatistics {
  readonly district: string;
  readonly province: string;
  readonly division: string;
  readonly population: number;
  readonly households: number;
  readonly population2017: number;
}

export interface CensusJoin {
  /** Roster district id -> statistics. Exactly the 136 census districts, when the join is clean. */
  readonly districts: ReadonlyMap<string, DistrictStatistics>;
  /** Census rows matching no district. Always a build failure. */
  readonly unmatched: readonly CensusRow[];
  /** Census districts no row covered. Always a build failure. */
  readonly missing: readonly string[];
  /** Drawn districts the census never covered — AJK and GB. Expected, and stated explicitly. */
  readonly withoutCensusData: readonly string[];
}

/**
 * Census spelling -> roster spelling, where the census tables and the PBS district list
 * genuinely disagree. Spelling-only differences go through `normalizeName` and the roster's own
 * alias table; this covers the cases where the census calls a unit something else entirely.
 */
const CENSUS_NAME_ALIASES: Readonly<Record<string, string>> = {
  // The capital is its own region, division and district in the census, all three called ICT.
  ict: 'Islamabad',
  // Malakand is administered as a "Protected Area" and appears under that name in the tables.
  'malakand protected area': 'Malakand',
  'kambar shahdad kot': 'Kambar Shahdadkot',
  'umer kot': 'Umerkot',
  'kolai palas kohistan': 'Kolai Pallas Kohistan',
};

/** Census region code -> the province name the bundle draws. */
const CENSUS_PROVINCE_ALIASES: Readonly<Record<string, string>> = {
  kp: 'Khyber Pakhtunkhwa',
  ict: 'Islamabad Capital Territory',
};

/** Resolve a census district name to its roster id, or `null` if it is not a 2023 district. */
export function resolveCensusDistrict(name: string): string | null {
  return CENSUS_NAME_ALIASES[normalizeName(name)] ?? resolveRosterName(name);
}

/** Resolve a census region to the province name the bundle draws, or `null`. */
export function resolveCensusProvince(name: string): string | null {
  const aliased = CENSUS_PROVINCE_ALIASES[normalizeName(name)];
  if (aliased !== undefined) return aliased;
  const normalized = normalizeName(name);
  return ROSTER.find((p) => normalizeName(p.name) === normalized)?.name ?? null;
}

/**
 * Resolve a census division name to the division name the bundle draws.
 *
 * The two agree everywhere except the capital, which has no division tier in the census — the
 * bundle injects a pseudo-division so the province -> division -> district hierarchy is total.
 */
export function resolveCensusDivision(name: string): string {
  return normalizeName(name) === 'ict' ? ICT_PSEUDO_DIVISION : name;
}

/**
 * The census-vintage district that carries a given district's people.
 *
 * For a 2023 district that is itself; for a district created since, it is the parent it was
 * carved out of. This is the vintage rule in one function: a unit with no census row does not
 * get a null population, and it does not get an invented one — it gets no separate existence.
 *
 * `null` means the name is neither, which is a build failure everywhere it is used.
 */
export function foldToCensusDistrict(name: string): string | null {
  let current = name;
  // The table is flat today. Following it to a fixed point costs nothing and means a future
  // two-step reorganisation (a district carved from a district carved from a 2023 parent)
  // resolves instead of silently landing on a unit that does not exist.
  for (let step = 0; step <= Object.keys(POST_CENSUS_DISTRICT_FOLDS).length; step += 1) {
    const resolved = resolveRosterName(current);
    if (resolved !== null) return resolved;
    const parent = matchFold(current);
    if (parent === null) return null;
    current = parent;
  }
  throw new Error(`fold table loops on ${name}`);
}

function matchFold(name: string): string | null {
  const normalized = normalizeName(name);
  for (const [child, parent] of Object.entries(POST_CENSUS_DISTRICT_FOLDS)) {
    if (normalizeName(child) === normalized) return parent;
  }
  return null;
}

/** Districts drawn by the bundle that the census did not cover — AJK and GB (D25). */
function districtsWithoutCensusData(): string[] {
  return ROSTER.filter((p) => p.kind === 'territory').flatMap((p) => [...p.districts]);
}

export function joinCensus(rows: readonly CensusRow[]): CensusJoin {
  const districts = new Map<string, DistrictStatistics>();
  const unmatched: CensusRow[] = [];

  for (const row of rows) {
    const district = resolveCensusDistrict(row.district);
    const province = resolveCensusProvince(row.region);
    if (district === null || province === null) {
      unmatched.push(row);
      continue;
    }
    if (districts.has(district)) {
      throw new Error(
        `two census rows claim ${district}. One district, one row — a duplicate means a name ` +
          `resolved to the wrong district and some other district is now missing.`,
      );
    }
    districts.set(district, {
      district,
      // The row's own region is what matched; the roster is what the bundle labels by. They are
      // the same thing said twice, so disagreeing is a mis-resolved name, not a judgement call.
      province: provinceOf(district) ?? province,
      division: resolveCensusDivision(row.division),
      population: row.population,
      households: row.households,
      population2017: row.population2017,
    });
  }

  const censusAtom = ROSTER.filter((p) => p.kind !== 'territory').flatMap((p) => p.districts);
  const missing = censusAtom.filter((d) => !districts.has(d));

  return { districts, unmatched, missing, withoutCensusData: districtsWithoutCensusData() };
}

/** Sum district populations into the tier above them. */
export function sumBy(
  districts: Iterable<DistrictStatistics>,
  key: 'province' | 'division',
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const district of districts) {
    const name = district[key];
    totals.set(name, (totals.get(name) ?? 0) + district.population);
  }
  return totals;
}

export interface Discrepancy {
  readonly name: string;
  /** `null` when the tier exists upstream but no district summed into it. */
  readonly summed: number | null;
  /** `null` when districts summed into a tier PBS never published. */
  readonly published: number | null;
  /** `summed - published`, or `null` when one side is absent. */
  readonly delta: number | null;
}

/**
 * Compare district sums against the totals PBS published for the tier above.
 *
 * This is the strongest check available on the join, and it is why the province and division
 * rows are cached alongside the district rows: PBS published those totals independently, so a
 * fold that double-counts a district or a name that resolved to the wrong one shows up here as
 * an exact arithmetic difference rather than as a plausible-looking number.
 */
export function reconcileTotals(
  summed: ReadonlyMap<string, number>,
  published: ReadonlyMap<string, number>,
): Discrepancy[] {
  const discrepancies: Discrepancy[] = [];
  for (const name of new Set([...summed.keys(), ...published.keys()])) {
    const ours = summed.get(name) ?? null;
    const theirs = published.get(name) ?? null;
    if (ours === null || theirs === null) {
      discrepancies.push({ name, summed: ours, published: theirs, delta: null });
    } else if (ours !== theirs) {
      discrepancies.push({ name, summed: ours, published: theirs, delta: ours - theirs });
    }
  }
  return discrepancies;
}
