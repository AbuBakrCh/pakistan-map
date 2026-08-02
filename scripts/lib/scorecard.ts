/**
 * The scorecard (#20) — the few things about a variant that are arithmetic rather than argument.
 *
 * Every other line on a variant card is somebody's position: who wants this, who does not, why it
 * would be better. These four are not. How many units a partition makes, how unevenly it spreads
 * the population, how far apart its largest and smallest units are, and how much ground actually
 * changes hands are answers, and a reader comparing seventeen proposals has nothing else to compare
 * them on. So they are computed here, from the census the rest of the app is pinned to, and baked
 * into the artifact rather than worked out on the page — a figure the runtime derives is a figure
 * nobody reviewed.
 *
 * The fifth line, contiguity, is deliberately **not** computed here. #16 already answered it off
 * the adjacency graph and wrote it onto every unit and into `counts.nonContiguousUnits`; asking the
 * question a second way would give this app two answers to it, and the interesting failure is the
 * one where they disagree and nobody notices which is on screen.
 *
 * Two rules from the rest of the pipeline decide the whole shape of what follows.
 *
 *  - **Never a zero standing in for an absence.** PBS published the 2023 census for 136 districts —
 *    the four provinces and Islamabad — and for none of AJK's or Gilgit-Baltistan's twenty (D25). A
 *    unit made of those districts has no population, and `null` is what it carries: summing the
 *    districts that *do* have a figure would publish a number that is short by an unknowable amount
 *    and looks exactly like a number that is right.
 *  - **An absence is stated, and the two kinds are stated apart.** A unit *entirely* outside the
 *    census is not a gap in the data — it is the census's own coverage, so it is set aside by name
 *    and the spread is taken over the rest. A unit *partly* outside it is a hole, and it voids the
 *    whole variant's population figures: comparing a largest against a smallest when one of them is
 *    missing people is worse than comparing nothing. A variant may also withhold modern figures of
 *    its own accord (H2 draws 1947's map), and that reason is the variant's own words.
 *
 * Pure, like its neighbours: no filesystem, no geometry, no bundle. `scripts/build-scenarios.ts`
 * supplies the census and the roster, and `src/lib/card.ts` decides what any of it is called on
 * screen — nothing here composes a sentence for the reader.
 */

import { normalizeName } from './roster.ts';

/** A unit as the scorecard needs it: who it is, and which 2023 districts the map draws it from. */
export interface ScorecardUnit {
  readonly id: string;
  readonly name: string;
  readonly kind: 'proposed' | 'unchanged' | 'territory';
  /** Resolved onto the 2023 set — the districts drawn, never the districts a claim names. */
  readonly districts: readonly string[];
}

/**
 * District -> its 2023 census population. A district the map draws and the census did not cover is
 * **absent from this map**, never present as zero: absence is the whole thing this module has to
 * be able to tell apart from a small number.
 */
export type DistrictPopulations = ReadonlyMap<string, number>;

/** District -> the first-level entity it belongs to today. What "moved" is measured against. */
export type DistrictOrigins = ReadonlyMap<string, string>;

export interface UnitPopulation {
  readonly unit: string;
  readonly name: string;
  /** The sum of its districts' census populations, or `null` where any district has none. */
  readonly population: number | null;
  /** Districts of this unit PBS published no 2023 figure for, named rather than counted. */
  readonly uncounted: readonly string[];
}

/**
 * Each unit's population, and which of its districts the census does not reach.
 *
 * The sum is exact and is only ever a sum: the census publishes by district, this map is composed
 * of districts, and nothing between the two is interpolated or apportioned. One missing district is
 * enough to make the unit's figure `null` — a unit is one province's worth of people or it is
 * nothing, and 90% of a population presented as a population is a false figure about Pakistan.
 */
export function unitPopulations(
  units: readonly ScorecardUnit[],
  populations: DistrictPopulations,
): readonly UnitPopulation[] {
  return units.map((unit) => {
    const uncounted = unit.districts.filter((district) => !populations.has(district));
    return {
      unit: unit.id,
      name: unit.name,
      population:
        uncounted.length > 0
          ? null
          : unit.districts.reduce((n, district) => n + (populations.get(district) ?? 0), 0),
      uncounted,
    };
  });
}

/**
 * District -> its published area in km², from PBS Census-2023 Table 1 (#49).
 *
 * The same shape and the same rule as `DistrictPopulations`, and for the same reason: PBS
 * published Table 1 for the four provinces and the capital, so the twenty AJK and
 * Gilgit-Baltistan districts are **absent from this map** rather than present as zero. The two
 * absences are the same absence — one census, one coverage — which is why a unit set aside from
 * the population figures is the same unit set aside from the area, and nothing here keeps a second
 * list of them.
 *
 * Published, never measured. The drawn polygons are clipped to OSM's coastline and knowingly
 * disagree with PBS by thousands of km² on the Indus delta; a measured area would be a figure of
 * ours printed under a `census` badge.
 */
export type DistrictAreas = ReadonlyMap<string, number>;

export interface UnitArea {
  readonly unit: string;
  readonly name: string;
  /** The sum of its districts' published areas, or `null` where any district has none. */
  readonly area: number | null;
  /** Districts of this unit PBS published no area for, named rather than counted. */
  readonly withoutPublishedArea: readonly string[];
}

/**
 * Each unit's area, on exactly the terms its population is computed on: a sum of published
 * district figures, `null` the moment one of them is missing, and never a partial sum.
 */
export function unitAreas(
  units: readonly ScorecardUnit[],
  areas: DistrictAreas,
): readonly UnitArea[] {
  return units.map((unit) => {
    const withoutPublishedArea = unit.districts.filter((district) => !areas.has(district));
    return {
      unit: unit.id,
      name: unit.name,
      area:
        withoutPublishedArea.length > 0
          ? null
          : unit.districts.reduce((km2, district) => km2 + (areas.get(district) ?? 0), 0),
      withoutPublishedArea,
    };
  });
}

/**
 * The variant's ground, added up.
 *
 * Deliberately not a spread: no largest, no smallest, no ratio. Area is here because H2 draws 1947
 * and can carry no 2023 figure (#49) — ground is what has not moved since — and a second set of
 * extremes would be a comparison nobody asked for on a card that is already a column of five.
 */
export interface AreaTotal {
  /** How many units the figure is over — not the variant's unit count where any is set aside. */
  readonly units: number;
  /** Those units' km², added up, as published. */
  readonly total: number;
}

export interface PopulationExtreme {
  readonly unit: string;
  readonly name: string;
  readonly population: number;
}

export interface PopulationSpread {
  /** How many units the figures are over. Not the variant's unit count where any is set aside. */
  readonly units: number;
  /** Those units' people, added up. */
  readonly total: number;
  readonly largest: PopulationExtreme;
  readonly smallest: PopulationExtreme;
  /**
   * Largest divided by smallest, to two decimals. `null` where one unit carries figures and there
   * is nothing to compare it against — a ratio of a thing to itself is 1 and means nothing.
   */
  readonly ratio: number | null;
}

/**
 * Why there are no population figures. Three different states, kept three, because a card that
 * worded them the same would tell a reader a census gap and an editorial decision were one thing.
 */
export type PopulationWithholding =
  /** The variant suppresses modern figures itself, and supplies the reason (H2 draws 1947). */
  | { readonly kind: 'variant'; readonly reason: string }
  /** A unit reaches into ground the census does not cover, so its own figure would be short. */
  | {
      readonly kind: 'incomplete';
      readonly units: readonly { readonly unit: string; readonly name: string; readonly uncounted: readonly string[] }[];
    }
  /** Nothing in the partition is inside the census at all. Degenerate, and spelled out anyway. */
  | { readonly kind: 'uncounted' };

/** A unit wholly outside the census: set aside from the figures by name, and never as a zero. */
export interface OutsideTheCensus {
  readonly unit: string;
  readonly name: string;
  readonly districts: readonly string[];
}

export interface DistrictsMoved {
  /** Districts that change hands. */
  readonly count: number;
  /** Out of how many the partition covers, so the count is readable without the card's help. */
  readonly of: number;
  /** Where they come from, largest contributor first. Named: "11 out of Punjab" is the finding. */
  readonly byOrigin: readonly { readonly from: string; readonly districts: number }[];
}

export interface Scorecard {
  readonly units: number;
  readonly proposedUnits: number;
  /** `null` exactly when `populationWithheld` is set. Never both, and never neither. */
  readonly population: PopulationSpread | null;
  readonly populationWithheld: PopulationWithholding | null;
  /**
   * The ground the variant covers, from PBS's published district areas (#49).
   *
   * Never `null`, unlike the population: a variant may withhold modern *figures* — H2 does, because
   * 2023 counts do not describe 1947 boundaries — and area is exactly the figure that survives
   * that, since ground has not moved since. It is `null` only in the degenerate case where no unit
   * of the variant has a published area at all, which the shipped set does not contain.
   */
  readonly area: AreaTotal | null;
  /** Units the census does not reach, set aside from the spread and listed rather than dropped. */
  readonly outsideTheCensus: readonly OutsideTheCensus[];
  readonly districtsMoved: DistrictsMoved;
}

/**
 * One decimal. Fixed here so the artifact is byte-stable across rebuilds of the same data — and
 * fixed at the precision the card actually sets, so the bundle and the screen cannot disagree.
 *
 * The card was rounding a second time on the way out, which meant a figure the artifact carried
 * was one nothing could ever display: 36.94 baked, `36.9 : 1` printed. A ratio of two census
 * counts does not carry a hundredth anyway, so the rounding happens once, here, and the card
 * formats what it is given rather than deciding it again.
 */
const RATIO_DECIMALS = 1;
const round = (value: number): number =>
  Math.round(value * 10 ** RATIO_DECIMALS) / 10 ** RATIO_DECIMALS;

/**
 * Which districts change hands, and out of where.
 *
 * Not "change province": a district's current first-level entity may be Islamabad Capital
 * Territory, Azad Jammu & Kashmir or Gilgit-Baltistan, none of which is a province, and this map's
 * vocabulary is careful about that everywhere else. Hence `DistrictOrigins` and `byOrigin` — the
 * thing a district comes *out of*, whatever kind of thing that is.
 *
 * A district has moved iff the unit holding it is not the one carrying its current first-level
 * entity forward, and *carrying forward* is decided on the unit's **name**: the unit called Punjab
 * is Punjab whatever it has lost, and the unit called South Punjab is not, however much of Punjab
 * it is made of. Two structural alternatives were rejected for saying something false. Counting the
 * districts of every `proposed` unit calls Gilgit-Baltistan's ten "moved" in a variant that only
 * changes its constitutional status, when no ground changes hands at all; requiring a unit's
 * districts to be exactly its province's calls the twenty-five districts left in Punjab "moved" when
 * they have not gone anywhere and it is the province that shrank.
 *
 * The cost of keying on a name is stated rather than hidden: a variant that renames a province it
 * otherwise leaves alone would read as moving all of it. The variants are curated and reviewed as a
 * diff, and a rename that is not a proposal is a thing to catch in that review — but it is this
 * function's one blind spot and belongs in the open.
 *
 * Matching goes through `normalizeName`, never raw equality, for the same reason every other join
 * in this repo does. It is deliberately the **looser** of the two name comparators #28 left in the
 * repo: `promotedTerritoryOf` in `scenarios.ts` asks for exact equality, because there a suffix is
 * a rename slipping past the condition written to catch renames, whereas here a suffix is noise
 * between a unit's name and the roster's. Exact is strictly narrower, so a unit the validator
 * admits as a promotion carries its territory forward here too and moves nought districts; the two
 * cannot disagree in that direction, which is the only direction A5 depends on.
 */
export function districtsMoved(
  units: readonly ScorecardUnit[],
  origins: DistrictOrigins,
): DistrictsMoved {
  const out = new Map<string, number>();
  let count = 0;
  let of = 0;

  for (const unit of units) {
    const carriesForward = normalizeName(unit.name);
    for (const district of unit.districts) {
      of += 1;
      const origin = origins.get(district);
      if (origin === undefined || normalizeName(origin) === carriesForward) continue;
      count += 1;
      out.set(origin, (out.get(origin) ?? 0) + 1);
    }
  }

  return {
    count,
    of,
    byOrigin: [...out]
      .map(([from, districts]) => ({ from, districts }))
      .sort((a, b) => b.districts - a.districts || a.from.localeCompare(b.from)),
  };
}

export interface ScorecardInput {
  readonly populations: DistrictPopulations;
  readonly areas: DistrictAreas;
  readonly origins: DistrictOrigins;
  /** The variant's own statistics policy. `false` withholds every population figure, with a reason. */
  readonly modernFigures: { readonly modernFigures: true } | { readonly modernFigures: false; readonly reason: string };
}

/** The whole scorecard for one variant. Pure: give it a census and a roster and it decides nothing else. */
export function scorecardOf(units: readonly ScorecardUnit[], input: ScorecardInput): Scorecard {
  const moved = districtsMoved(units, input.origins);
  const populations = unitPopulations(units, input.populations);
  // Area is computed for every variant and not only for the one that prints it. A figure derived
  // for a single card is a figure nothing else can check, and the suite re-derives this one over
  // all seventeen; which cards *show* it is `card.ts`'s decision and is stated there.
  const measured = unitAreas(units, input.areas).filter(
    (found): found is UnitArea & { area: number } => found.area !== null,
  );
  const base = {
    units: units.length,
    proposedUnits: units.filter((unit) => unit.kind === 'proposed').length,
    area:
      measured.length === 0
        ? null
        : { units: measured.length, total: measured.reduce((km2, found) => km2 + found.area, 0) },
    districtsMoved: moved,
  };

  const byId = new Map(units.map((unit) => [unit.id, unit]));
  // Wholly outside the census (AJK, GB) against partly outside it: the first is the census's
  // coverage and is set aside, the second is a hole and voids the comparison.
  const outsideTheCensus: OutsideTheCensus[] = [];
  const incomplete: { unit: string; name: string; uncounted: readonly string[] }[] = [];
  for (const found of populations) {
    if (found.uncounted.length === 0) continue;
    const districts = byId.get(found.unit)?.districts ?? [];
    if (found.uncounted.length === districts.length) {
      outsideTheCensus.push({ unit: found.unit, name: found.name, districts: found.uncounted });
    } else {
      incomplete.push({ unit: found.unit, name: found.name, uncounted: found.uncounted });
    }
  }

  const withhold = (populationWithheld: PopulationWithholding): Scorecard => ({
    ...base,
    population: null,
    populationWithheld,
    outsideTheCensus,
  });

  if (!input.modernFigures.modernFigures) {
    return withhold({ kind: 'variant', reason: input.modernFigures.reason });
  }
  if (incomplete.length > 0) return withhold({ kind: 'incomplete', units: incomplete });

  const counted = populations.filter(
    (found): found is UnitPopulation & { population: number } => found.population !== null,
  );
  if (counted.length === 0) return withhold({ kind: 'uncounted' });

  const ranked = [...counted].sort(
    (a, b) => b.population - a.population || a.name.localeCompare(b.name),
  );
  const largest = ranked[0] as UnitPopulation & { population: number };
  const smallest = ranked[ranked.length - 1] as UnitPopulation & { population: number };
  const extreme = (found: UnitPopulation & { population: number }): PopulationExtreme => ({
    unit: found.unit,
    name: found.name,
    population: found.population,
  });

  return {
    ...base,
    population: {
      units: counted.length,
      total: counted.reduce((n, found) => n + found.population, 0),
      largest: extreme(largest),
      smallest: extreme(smallest),
      // A single counted unit has nothing to be a ratio against. Said as absent rather than as 1,
      // which is a number and would read as a perfectly even partition.
      ratio: counted.length < 2 ? null : round(largest.population / smallest.population),
    },
    populationWithheld: null,
    outsideTheCensus,
  };
}
