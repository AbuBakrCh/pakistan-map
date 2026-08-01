/**
 * Join the three PBS Census-2023 development indicators onto the 2023 district set (#11).
 *
 * Literacy from **Table 12**, improved drinking water from **Table 23**, toilet facilities from
 * **Table 24**. Published rates, never combined: the census sees *service access*, not income,
 * consumption, child mortality or nutrition, and a composite of the three is a separate,
 * `synthesized` thing (#31) that has no business being baked in here where it would look like a
 * census figure.
 *
 * Pure, for the same reason `census.ts` and `mother-tongue.ts` are: what needs reviewing is the
 * judgements, not the plumbing. There are four of them, and each one decides what a shaded
 * district actually claims.
 *
 *  - **Every rate is recomputed from the published counts, not read off a published percentage.**
 *    All three tables are tehsil-level — the same shape as Table 11, 591 units and no district
 *    tier — so the district figure has to be added up, and a rate does not add up. Averaging 591
 *    tehsil percentages would weight Zamoran's 6,000 people like Lahore's; the counts are summed
 *    and divided once, which is what a population-weighted rate *is*. Table 12 does publish a
 *    `Literate %` per tehsil, and it agrees with the counts to within 0.005 percentage points
 *    across all 591 — it is not read all the same, because the district tier it would be needed
 *    for does not exist.
 *  - **Each indicator keeps the denominator PBS gave it, and the denominators are different.**
 *    Literacy is over **population 10 years and above** (171,714,532 nationally), not over the
 *    district's population. Water and sanitation are over **households as Tables 23 and 24 count
 *    them** (38,292,556) — which is *not* the household figure the district table carries
 *    (38,340,566), a difference of 48,010 that shows up in all 136 districts. Both denominators
 *    are therefore emitted alongside their numerators, so nothing downstream has to guess which
 *    one a share was taken over.
 *  - **Shares are proportions in 0–1, never percentages.** One convention, stated once, because a
 *    60.65 and a 0.6065 are indistinguishable in a fill colour and distinguishable only by a
 *    factor of a hundred everywhere else.
 *  - **Sanitation is the census's categories, unmerged.** PBS classifies drinking water into
 *    improved and not — `DRINK_WTR_IMPROVE` is its own published column — and publishes no such
 *    column for toilets. It prints flush, non-flush and none, and a non-flush toilet may be
 *    improved (a pit latrine with a slab) or not (an open pit); the census does not say which.
 *    So there is no *improved sanitation* figure to join, and inventing one by adding flush to
 *    non-flush would be this project's own definition wearing a `census` badge. The four
 *    published counts are carried as published and `flushToilet` is the share the map shades by.
 *
 * Nothing is dropped silently, exactly as in the mother-tongue join: a published district name
 * matching no roster district, two names merging into one, a census district no row covered, a
 * count that exceeds its own denominator — all are reported, and all fail the build.
 */

import { CENSUS_DISTRICTS, provinceOf } from './roster.ts';
import { resolveCensusDistrict } from './census.ts';

/** The `VARS` rows of Table 12 this join reads. PBS's own labels, spelling included. */
export const LITERACY_POPULATION_VAR = 'Population >=10';
export const LITERACY_LITERATE_VAR = 'Literate >=10';

/** The `REGION` row of Tables 23 and 24 this join reads. `RURAL` and `URBAN` partition it. */
export const HOUSING_REGION = 'OVERALL';

/**
 * One published Table 12 cell: a tehsil, one of the fifteen `VARS` indicators, and its figure.
 *
 * `unit` is the tehsil's own key — `DISTRICT | TEHSIL | ADMIN_UNIT`, all three. Two of the 591
 * units share a district-and-tehsil name and differ only in `ADMIN_UNIT` (Rajanpur is published
 * as both a `TEHSIL` and a `DE-EXCLUDED_AREA`), so a key of the first two would silently drop
 * one of them.
 */
export interface LiteracyRow {
  readonly district: string;
  readonly unit: string;
  readonly indicator: string;
  /** `null` where PBS printed nothing, which for these tables means nobody. */
  readonly people: number | null;
}

/** One published Table 23 row: a tehsil, a region, and its drinking-water counts. */
export interface WaterRow {
  readonly district: string;
  readonly region: string;
  readonly households: number | null;
  readonly improved: number | null;
}

/** One published Table 24 row: a tehsil, a region, and its toilet counts. */
export interface SanitationRow {
  readonly district: string;
  readonly region: string;
  readonly households: number | null;
  readonly flushToilet: number | null;
  readonly nonFlushToilet: number | null;
  readonly noToilet: number | null;
  readonly separateToilet: number | null;
}

export interface DistrictLiteracy {
  /** Population 10 years and above — PBS's own denominator for a literacy rate. */
  readonly population10Plus: number;
  readonly literate10Plus: number;
  /** `literate10Plus / population10Plus`, a proportion in 0–1. */
  readonly rate: number;
}

export interface DistrictWater {
  /** Households as Table 23 counts them. Not the district table's household figure. */
  readonly households: number;
  readonly improved: number;
  /** `improved / households`, a proportion in 0–1. */
  readonly improvedShare: number;
}

export interface DistrictSanitation {
  /** Households as Table 24 counts them; identical to Table 23's in all 136 districts. */
  readonly households: number;
  readonly flushToilet: number;
  readonly nonFlushToilet: number;
  readonly noToilet: number;
  /** A toilet not shared with another household. Orthogonal to the three above, not a fourth. */
  readonly separateToilet: number;
  /** `flushToilet / households` — the sanitation share the map shades by. */
  readonly flushToiletShare: number;
  /** `noToilet / households`. Carried because it is the one PBS category nobody can misread. */
  readonly noToiletShare: number;
}

export interface DistrictDevelopment {
  readonly district: string;
  readonly literacy: DistrictLiteracy;
  readonly water: DistrictWater;
  readonly sanitation: DistrictSanitation;
}

/** One roster district that more than one published name resolved to. */
export interface NameCollision {
  readonly district: string;
  readonly publishedNames: readonly string[];
}

/** A published figure that is larger than the universe it is a part of. Always a build failure. */
export interface ImpossibleFigure {
  readonly district: string;
  readonly what: string;
  readonly counted: number;
  readonly outOf: number;
}

export interface DevelopmentJoin {
  readonly districts: ReadonlyMap<string, DistrictDevelopment>;
  /** Published district names matching no 2023 district. */
  readonly unmatched: readonly string[];
  /** Two or more published names resolving to one district, with the names that did it. */
  readonly collisions: readonly NameCollision[];
  /** Census districts one or more of the three tables did not cover, and which table. */
  readonly missing: readonly { readonly district: string; readonly table: string }[];
  /** A count exceeding its denominator, or a denominator of zero. */
  readonly impossible: readonly ImpossibleFigure[];
  /**
   * Districts where Table 24's flush + non-flush + none does not equal its own household count.
   * The three are a partition of every household in the published table; where they are not,
   * upstream disagrees with itself and a share taken over that denominator means nothing.
   */
  readonly unpartitioned: readonly string[];
}

/** Sum the counts under each district, keyed by the roster name, reporting anything unplaceable. */
class DistrictSums {
  readonly totals = new Map<string, Map<string, number>>();
  readonly covered = new Set<string>();
  private readonly names = new Map<string, Set<string>>();
  readonly unmatched = new Set<string>();

  add(publishedDistrict: string, field: string, value: number | null): void {
    const district = resolveCensusDistrict(publishedDistrict);
    if (district === null) {
      this.unmatched.add(publishedDistrict);
      return;
    }
    const names = this.names.get(district) ?? new Set<string>();
    names.add(publishedDistrict);
    this.names.set(district, names);
    this.covered.add(district);

    const fields = this.totals.get(district) ?? new Map<string, number>();
    // A blank cell is nobody, not unknown: Tables 23 and 24 leave `TOILET_NONE` empty in the
    // eight tehsils where every household has one. Summing it as zero is right; defaulting a
    // *missing district* to zero would not be, which is why coverage is tracked separately.
    fields.set(field, (fields.get(field) ?? 0) + (value ?? 0));
    this.totals.set(district, fields);
  }

  get(district: string, field: string): number {
    return this.totals.get(district)?.get(field) ?? 0;
  }

  collisions(): NameCollision[] {
    return [...this.names]
      .filter(([, names]) => names.size > 1)
      .map(([district, names]) => ({ district, publishedNames: [...names].sort() }))
      .sort((a, b) => a.district.localeCompare(b.district));
  }
}

export function joinDevelopment(
  literacyRows: readonly LiteracyRow[],
  waterRows: readonly WaterRow[],
  sanitationRows: readonly SanitationRow[],
): DevelopmentJoin {
  const sums = new DistrictSums();
  /**
   * Coverage is tracked per published row, not per table. A district carrying `Population >=10`
   * rows but no `Literate >=10` rows would otherwise sum to a literacy rate of exactly zero and
   * pass every bound — the one shape of missing data that looks like data.
   */
  const covered = {
    literacyPopulation: new Set<string>(),
    literacyLiterate: new Set<string>(),
    water: new Set<string>(),
    sanitation: new Set<string>(),
  };

  for (const row of literacyRows) {
    // Table 12 prints fifteen indicators per tehsil; two of them are a literacy rate's numerator
    // and denominator and the other thirteen are enrolment and out-of-school figures this app
    // does not shade by. Selected rather than rejected: an unread indicator is not a lost one.
    if (row.indicator !== LITERACY_POPULATION_VAR && row.indicator !== LITERACY_LITERATE_VAR) {
      continue;
    }
    const district = resolveCensusDistrict(row.district);
    sums.add(row.district, row.indicator, row.people);
    if (district === null) continue;
    if (row.indicator === LITERACY_POPULATION_VAR) covered.literacyPopulation.add(district);
    else covered.literacyLiterate.add(district);
  }

  for (const row of waterRows) {
    if (row.region !== HOUSING_REGION) continue;
    const district = resolveCensusDistrict(row.district);
    sums.add(row.district, 'waterHouseholds', row.households);
    sums.add(row.district, 'improvedWater', row.improved);
    if (district !== null) covered.water.add(district);
  }

  for (const row of sanitationRows) {
    if (row.region !== HOUSING_REGION) continue;
    const district = resolveCensusDistrict(row.district);
    sums.add(row.district, 'sanitationHouseholds', row.households);
    sums.add(row.district, 'flushToilet', row.flushToilet);
    sums.add(row.district, 'nonFlushToilet', row.nonFlushToilet);
    sums.add(row.district, 'noToilet', row.noToilet);
    sums.add(row.district, 'separateToilet', row.separateToilet);
    if (district !== null) covered.sanitation.add(district);
  }

  const missing = CENSUS_DISTRICTS.flatMap((district) =>
    (
      [
        ['literacyPopulation', `Table 12 (${LITERACY_POPULATION_VAR})`],
        ['literacyLiterate', `Table 12 (${LITERACY_LITERATE_VAR})`],
        ['water', 'Table 23'],
        ['sanitation', 'Table 24'],
      ] as const
    )
      .filter(([which]) => !covered[which].has(district))
      .map(([, table]) => ({ district, table })),
  );

  const districts = new Map<string, DistrictDevelopment>();
  const impossible: ImpossibleFigure[] = [];
  const unpartitioned: string[] = [];

  for (const district of CENSUS_DISTRICTS) {
    if (missing.some((m) => m.district === district)) continue;

    const population10Plus = sums.get(district, LITERACY_POPULATION_VAR);
    const literate10Plus = sums.get(district, LITERACY_LITERATE_VAR);
    const waterHouseholds = sums.get(district, 'waterHouseholds');
    const improved = sums.get(district, 'improvedWater');
    const sanitationHouseholds = sums.get(district, 'sanitationHouseholds');
    const flushToilet = sums.get(district, 'flushToilet');
    const nonFlushToilet = sums.get(district, 'nonFlushToilet');
    const noToilet = sums.get(district, 'noToilet');
    const separateToilet = sums.get(district, 'separateToilet');

    // A share is only a share if its denominator is a real universe and its numerator fits
    // inside it. Both failures produce a number in the artifact that reads perfectly plausibly
    // — a rate above 1, or a division by zero — so they stop the build rather than shade a map.
    const check = (what: string, counted: number, outOf: number): boolean => {
      if (outOf > 0 && counted >= 0 && counted <= outOf) return true;
      impossible.push({ district, what, counted, outOf });
      return false;
    };
    const usable =
      [
        check('literate 10+', literate10Plus, population10Plus),
        check('improved drinking water', improved, waterHouseholds),
        check('flush toilet', flushToilet, sanitationHouseholds),
        check('non-flush toilet', nonFlushToilet, sanitationHouseholds),
        check('no toilet', noToilet, sanitationHouseholds),
        check('separate toilet', separateToilet, sanitationHouseholds),
      ].every(Boolean);
    if (flushToilet + nonFlushToilet + noToilet !== sanitationHouseholds) {
      unpartitioned.push(district);
    }
    if (!usable) continue;

    districts.set(district, {
      district,
      literacy: {
        population10Plus,
        literate10Plus,
        rate: literate10Plus / population10Plus,
      },
      water: {
        households: waterHouseholds,
        improved,
        improvedShare: improved / waterHouseholds,
      },
      sanitation: {
        households: sanitationHouseholds,
        flushToilet,
        nonFlushToilet,
        noToilet,
        separateToilet,
        flushToiletShare: flushToilet / sanitationHouseholds,
        noToiletShare: noToilet / sanitationHouseholds,
      },
    });
  }

  return {
    districts,
    unmatched: [...sums.unmatched].sort(),
    collisions: sums.collisions(),
    missing,
    impossible,
    unpartitioned,
  };
}

/** The count fields a province total can be reconciled on — numerators and denominators alike. */
export const RECONCILED_FIELDS = [
  'population10Plus',
  'literate10Plus',
  'households',
  'improvedWater',
  'flushToilet',
  'nonFlushToilet',
  'noToilet',
  'separateToilet',
] as const;

export type ReconciledField = (typeof RECONCILED_FIELDS)[number];

export type FieldTotals = Record<ReconciledField, number>;

const readField = (district: DistrictDevelopment, field: ReconciledField): number => {
  switch (field) {
    case 'population10Plus':
      return district.literacy.population10Plus;
    case 'literate10Plus':
      return district.literacy.literate10Plus;
    // Tables 23 and 24 publish the same household count for every one of the 136 districts, and
    // the build asserts it, so one `households` row reconciles both tables' denominator.
    case 'households':
      return district.water.households;
    case 'improvedWater':
      return district.water.improved;
    case 'flushToilet':
      return district.sanitation.flushToilet;
    case 'nonFlushToilet':
      return district.sanitation.nonFlushToilet;
    case 'noToilet':
      return district.sanitation.noToilet;
    case 'separateToilet':
      return district.sanitation.separateToilet;
  }
};

/**
 * Add districts up into the province that contains them, count by count.
 *
 * Counts, not rates — a province literacy rate is not the mean of its districts' rates, it is
 * literate people over people, and the only way to check a rate against a published one is to
 * check both of its halves. Districts whose water and sanitation households disagree would be
 * summed inconsistently here, which is why the build refuses them first.
 */
export function sumDevelopmentByProvince(
  districts: Iterable<DistrictDevelopment>,
): Map<string, FieldTotals> {
  const totals = new Map<string, FieldTotals>();
  for (const district of districts) {
    const province = provinceOf(district.district);
    // Unreachable from `joinDevelopment`, which only ever admits roster districts — thrown
    // rather than skipped so that a district silently missing from its province surfaces here
    // by name instead of downstream as an unexplained delta on a literacy total.
    if (province === null) {
      throw new Error(`${district.district} is not a district of any province in the roster`);
    }
    const accumulated =
      totals.get(province) ??
      (Object.fromEntries(RECONCILED_FIELDS.map((f) => [f, 0])) as FieldTotals);
    for (const field of RECONCILED_FIELDS) accumulated[field] += readField(district, field);
    totals.set(province, accumulated);
  }
  return totals;
}

/** The households Tables 23 and 24 disagree about, if any. Empty in the current release. */
export function householdDenominatorConflicts(
  districts: Iterable<DistrictDevelopment>,
): { district: string; water: number; sanitation: number }[] {
  return [...districts]
    .filter((d) => d.water.households !== d.sanitation.households)
    .map((d) => ({
      district: d.district,
      water: d.water.households,
      sanitation: d.sanitation.households,
    }));
}
