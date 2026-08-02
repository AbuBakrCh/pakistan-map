/**
 * Join PBS Census-2023 Table 1's published district areas onto the district set the bundle draws.
 *
 * Area is the one figure this project needs from the census that the `PakPC2023` package does not
 * republish: its district table carries households, population and growth rates and no area
 * column at all. So the areas are transcribed from the PDFs PBS publishes Table 1 as, committed as
 * `data/reference/pbs-table-1-district-areas.json`, and joined here — the same source, the same
 * table and the same vintage as the population beside it, reached a different way because the
 * structured release drops the column.
 *
 * **Published, never measured** (#49). This project draws districts clipped to OSM's coastline and
 * knows exactly where that disagrees with PBS: `normalize-geometry.ts` records the gaps and the
 * About panel prints them. Measuring the drawn polygons would therefore have put a figure of ours
 * on a card under a `census` badge, and one that disagrees with PBS by thousands of km² on the
 * Indus delta. A district's area is a published statistic here, exactly as its population is.
 *
 * Pure, like `census.ts` beside it: what needs reviewing is which row is which district and
 * whether the districts still add up to what PBS printed above them, not the file reading.
 */

import { CENSUS_DISTRICTS, normalizeName, provinceOf } from './roster.ts';
import { resolveCensusDistrict, type Discrepancy } from './census.ts';

/** One transcribed Table 1 row, as the reference file carries it. */
export interface AreaRow {
  /** The name Table 1 prints, upper case and all — somebody else's document, not our names. */
  readonly district: string;
  readonly province: string;
  readonly areaSqKm: number;
  /**
   * The population Table 1 prints beside the area.
   *
   * Never read into any artifact — the bundle's populations come from the `PakPC2023` cache, and a
   * second published population in the tree would be a second lineage. It is transcribed so that a
   * row can be *shown* to be the district it claims to be: two areas swapped between neighbours
   * still sum to their province and would otherwise pass every check this module makes.
   */
  readonly population2023: number;
}

export interface AreaJoin {
  /** Roster district id -> published area, km². Exactly the 136 census districts when clean. */
  readonly areas: ReadonlyMap<string, number>;
  /** Rows matching no district in the roster. Always a build failure. */
  readonly unmatched: readonly AreaRow[];
  /** Census districts no row covered. Always a build failure. */
  readonly missing: readonly string[];
  /** Rows two of which resolved to one district, naming both spellings. Always a build failure. */
  readonly collisions: readonly { readonly district: string; readonly publishedNames: readonly string[] }[];
  /** Rows whose province disagrees with the roster's. Always a build failure. */
  readonly misplaced: readonly { readonly district: string; readonly published: string; readonly roster: string }[];
}

/**
 * Resolve every transcribed row onto the roster.
 *
 * Nothing is dropped silently, on the rule the census join already states: a row that matches no
 * district is a district quietly missing its area, and a district with no row would be a unit whose
 * area is short by an unknowable amount — which is the failure mode `null` exists to prevent.
 *
 * A row refused for naming the wrong province leaves its district in `missing` as well, because it
 * is: no area was taken from it. The build reports the misplacement first, since that names the
 * fault and "no published area" only names the symptom.
 */
export function joinAreas(rows: readonly AreaRow[]): AreaJoin {
  const areas = new Map<string, number>();
  const publishedNames = new Map<string, string[]>();
  const unmatched: AreaRow[] = [];
  const misplaced: AreaJoin['misplaced'][number][] = [];

  for (const row of rows) {
    const district = resolveCensusDistrict(row.district);
    if (district === null) {
      unmatched.push(row);
      continue;
    }
    const roster = provinceOf(district);
    if (roster !== null && normalizeName(roster) !== normalizeName(row.province)) {
      misplaced.push({ district, published: row.province, roster });
      continue;
    }
    publishedNames.set(district, [...(publishedNames.get(district) ?? []), row.district]);
    areas.set(district, row.areaSqKm);
  }

  return {
    areas,
    unmatched,
    missing: CENSUS_DISTRICTS.filter((district) => !areas.has(district)),
    collisions: [...publishedNames]
      .filter(([, names]) => names.length > 1)
      .map(([district, names]) => ({ district, publishedNames: names })),
    misplaced,
  };
}

/** Sum published areas into the province tier, the one PBS publishes a total for. */
export function sumAreasByProvince(areas: ReadonlyMap<string, number>): Map<string, number> {
  const totals = new Map<string, number>();
  for (const [district, area] of areas) {
    const province = provinceOf(district);
    if (province === null) continue;
    totals.set(province, (totals.get(province) ?? 0) + area);
  }
  return totals;
}

/**
 * Where Table 1's own district populations disagree with the `PakPC2023` package's, pinned.
 *
 * Eight districts, in four pairs of neighbours: PBS's PDF and PBS's structured release put a
 * tehsil's worth of people on different sides of a district line, and each pair's difference
 * cancels exactly within the province — which is why the province and national totals agree to the
 * person in both. Stated rather than tolerated, on the same terms as the 6,374 improved-water
 * households: the delta is pinned per district, and any other value fails the build.
 *
 * Table 1 minus the package, so a positive figure is a district Table 1 counts more people in.
 *
 * Which side of the disagreement is which is worth reading, because it decides whether this is a
 * transcription error or an upstream one: three of these four pairs already appear in the census
 * join's "counted above their population" report, where Table 11's tehsil rows exceed the package's
 * district population by exactly 12,081, 946 and 62 — the same three numbers. Two independently
 * published PBS tables therefore put those people where this transcription does, and the package's
 * district table is the odd one out. The Karachi East / Malir pair is the fourth and is not exact
 * (Table 11 exceeds by 15,777 against Table 1's 28,289), which is why the deltas are pinned per
 * district rather than described as one phenomenon.
 */
export const TABLE_1_POPULATION_DELTAS: Readonly<Record<string, number>> = {
  Jhang: -12_081,
  'Toba Tek Singh': 12_081,
  'Karachi East': -28_289,
  Malir: 28_289,
  Kalat: -946,
  Surab: 946,
  'Kachhi (Bolan)': 62,
  Nasirabad: -62,
};

/**
 * Check each transcribed row against the population the bundle already carries for that district.
 *
 * This is what makes the transcription checkable rather than merely self-consistent. Two areas
 * swapped between neighbouring districts sum to their province exactly and pass every other check
 * here; the population printed on the same printed line does not swap with them.
 */
export function reconcileTranscription(
  rows: readonly AreaRow[],
  populations: ReadonlyMap<string, number>,
): Discrepancy[] {
  const discrepancies: Discrepancy[] = [];
  for (const row of rows) {
    const district = resolveCensusDistrict(row.district);
    if (district === null) continue;
    const ours = populations.get(district) ?? null;
    const expected = (ours ?? 0) + (TABLE_1_POPULATION_DELTAS[district] ?? 0);
    if (ours === null || expected !== row.population2023) {
      discrepancies.push({
        name: district,
        summed: ours,
        published: row.population2023,
        delta: ours === null ? null : row.population2023 - ours,
      });
    }
  }
  return discrepancies;
}
