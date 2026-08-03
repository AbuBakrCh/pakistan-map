/**
 * The development-band rule engine (#31) — D1, the one variant drawn from what the census says
 * about service access rather than from what anybody proposes.
 *
 * Nobody publishes a district list for "put the districts the census serves alike together". So the
 * boundary is computed here, under the discipline `partitioner.ts` and `mother-tongue-partition.ts`
 * already work under: the rule is stated, the arithmetic is reproducible, the same rule always draws
 * the same map, and the card says the line was computed rather than transcribed. A partition a
 * reader cannot re-derive is an editorial opinion wearing a `derived` badge.
 *
 * ## The rule, entire
 *
 * A unit is a **maximal group of districts that share a development band, share a province, and
 * reach each other across shared district borders**. Nothing else. Three conditions, and each of
 * the three is doing work:
 *
 *  - **The same band.** The four are the shading's own — under 50%, 50 to 65%, 65 to 80%, 80% and
 *    above — at the fixed cuts `development-index.ts` sets, so the line drawn over a district is
 *    the line between two colours a reader can already see. They are not recomputed here and they
 *    are not quantiles: a district's band is a property of its own score.
 *  - **The same province.** A band does not stop at a provincial boundary and this rule does,
 *    deliberately: Punjab's best-served districts and Khyber Pakhtunkhwa's are the same colour and
 *    are not the same place, and joining them across the boundary would draw a province out of two
 *    provinces' halves — a redraw of the federation rather than of a province. The province is the
 *    frame every one of these claims is argued inside.
 *  - **Adjacency.** Contiguity is the **method** here rather than a filter, exactly as it is in the
 *    two engines next door: a unit is a connected component of the graph, so it cannot come out in
 *    two pieces and there is nothing to flag. Sindh's two under-50 groups — Thatta with Sujawal,
 *    Tharparkar with Umerkot — are two units and not one scattered one, because the districts
 *    between them are better served and sit in a band of their own.
 *
 * ## What this rule is not, and what it costs
 *
 * It is **not a cut into halves and there is no optimisation in it at all** — no natural break, no
 * criterion being maximised, nothing to tune. The number of units is a **finding** and not a
 * setting: on the 2023 census it is 33 across the five census entities, and the card says so rather
 * than the rule being adjusted until the number looks like a federation somebody would design.
 *
 * Two costs fall out of that and both are reported rather than smoothed away:
 *
 *  - **Fragments are units.** A district whose neighbours are all in other bands is a unit of one —
 *    eleven of the thirty-three are, Gwadar and Hyderabad and Layyah among them. Absorbing them
 *    into a neighbour would be a second rule with nothing published behind it and a threshold
 *    nobody sourced, so they are drawn.
 *  - **The spread is enormous.** One 80%-and-above group runs from Attock to Vehari and holds 89
 *    million people; Upper Chitral holds 195,528. The rule is stated in service access and says
 *    nothing whatever about population, and a map drawn from it has no reason to be even.
 *
 * ## What the rule cannot reach
 *
 *  - **A district the census does not cover** — Azad Jammu & Kashmir's ten and Gilgit-Baltistan's
 *    ten (D25) — is refused by name if it is handed to this engine. There is no band to group it
 *    into, and a zero would make twenty districts the least developed ground in Pakistan on every
 *    component at once.
 *  - **A province whose own districts are not connected** needs no special case: the components are
 *    what the rule returns, so a detached district simply comes out as its own unit or joins the
 *    group it touches.
 *
 * Pure, like its neighbours: no filesystem, no geometry, no bundle. The caller supplies the
 * districts, the graph, the bands, the scores and the populations.
 */

import type { AdjacencyGraph } from './adjacency.ts';

/** One province, and everything the rule needs to group it. */
export interface ProvinceScope {
  readonly province: string;
  /** The province's districts. Every one of them ends up in exactly one unit, or nothing does. */
  readonly districts: readonly string[];
}

/**
 * A band, as the shading defines it. Only the identity and the words are needed here — the cuts
 * belong to `development-index.ts` and a district arrives already banded, so this engine cannot
 * disagree with the legend about which colour a district is.
 */
export interface BandLabel {
  readonly id: string;
  /** The legend's own words — "65% to 80%". What a unit's note prints. */
  readonly label: string;
}

export interface BandedInput {
  readonly provinces: readonly ProvinceScope[];
  readonly graph: AdjacencyGraph;
  /**
   * The bands in the order the scale is read, lowest first. Units come back in this order within a
   * province, so a rebuild writes the same list and the card reads up the ramp.
   */
  readonly bands: readonly BandLabel[];
  /** District -> its band id. A district the census does not reach is **absent**. */
  readonly districtBands: ReadonlyMap<string, string>;
  /** District -> its development index. Only for the mean a unit's note prints. Absent is refused. */
  readonly scores: ReadonlyMap<string, number>;
  /** District -> 2023 census population, which is what names a unit. Absent is refused. */
  readonly populations: ReadonlyMap<string, number>;
}

/** One unit: a province's districts of one band that reach each other. */
export interface BandedUnit {
  readonly province: string;
  readonly band: BandLabel;
  /** Sorted, so a rebuild writes the same list. */
  readonly districts: readonly string[];
  /** The unweighted mean of its districts' index scores. Inside the band by construction. */
  readonly mean: number;
  /** Its most populous district — what names the unit, since the engine has no source for a name. */
  readonly principal: string;
  readonly population: number;
}

/** A province the rule was not asked to group, and why. Named rather than dropped. */
export interface UngroupedProvince {
  readonly province: string;
  readonly districts: readonly string[];
  readonly reason: string;
}

export interface BandedPartition {
  /**
   * Every unit, provinces in the order they were handed over and bands lowest first inside each —
   * so the caller decides the card's order and a rebuild writes the same file.
   */
  readonly units: readonly BandedUnit[];
  readonly ungrouped: readonly UngroupedProvince[];
}

export interface BandedResult {
  /** `null` when anything failed: a partition with a hole in it must not reach a variant. */
  readonly partition: BandedPartition | null;
  readonly problems: readonly string[];
}

const mean = (districts: readonly string[], scores: ReadonlyMap<string, number>): number =>
  districts.reduce((sum, district) => sum + (scores.get(district) ?? 0), 0) / districts.length;

/**
 * The connected components of one province's districts of one band.
 *
 * Grown across the graph rather than filtered out of it, which is what makes every unit contiguous
 * by construction and leaves nothing for a contiguity flag to report. Seeds are walked in name
 * order and each component's members are sorted, so nothing about the caller's ordering can move a
 * boundary or reorder a list.
 */
function componentsOf(
  districts: readonly string[],
  graph: AdjacencyGraph,
): readonly (readonly string[])[] {
  const inBand = new Set(districts);
  const seen = new Set<string>();
  const components: string[][] = [];

  for (const seed of [...districts].sort((a, b) => a.localeCompare(b))) {
    if (seen.has(seed)) continue;
    const component: string[] = [];
    const frontier = [seed];
    seen.add(seed);
    while (frontier.length > 0) {
      const district = frontier.pop() as string;
      component.push(district);
      for (const other of graph.get(district) ?? []) {
        if (inBand.has(other) && !seen.has(other)) {
          seen.add(other);
          frontier.push(other);
        }
      }
    }
    components.push(component.sort((a, b) => a.localeCompare(b)));
  }

  return components;
}

function unitOf(
  province: string,
  band: BandLabel,
  districts: readonly string[],
  scores: ReadonlyMap<string, number>,
  populations: ReadonlyMap<string, number>,
): BandedUnit {
  const principal = districts.reduce((largest, district) =>
    (populations.get(district) ?? 0) > (populations.get(largest) ?? 0) ? district : largest,
  );
  return {
    province,
    band,
    districts,
    mean: mean(districts, scores),
    principal,
    population: districts.reduce((sum, district) => sum + (populations.get(district) ?? 0), 0),
  };
}

/**
 * Group every province's districts into units of one band that reach each other.
 *
 * Problems are collected across the whole input rather than thrown at the first, so a bad scope is
 * reported as everything wrong with it and not as whichever district happens to sort first.
 */
export function groupByDevelopmentBand(input: BandedInput): BandedResult {
  const problems: string[] = [];
  const { graph, bands, districtBands, scores, populations } = input;

  const known = new Map(bands.map((band) => [band.id, band]));
  if (known.size !== bands.length) {
    problems.push(
      `the band list repeats an id, so two bands would claim the same districts and one of them ` +
        `would silently win. The bands are the shading's own and each is one colour on the legend.`,
    );
  }

  const seen = new Set<string>();
  for (const scope of input.provinces) {
    for (const district of scope.districts) {
      if (seen.has(district)) {
        problems.push(
          `${district} is in scope twice; a district belongs to one province and to one unit, and ` +
            `counted twice its people would be in a unit's total twice.`,
        );
      }
      seen.add(district);

      const band = districtBands.get(district);
      if (band === undefined) {
        problems.push(
          `${district} (${scope.province}) is in scope with no development band, so a rule stated ` +
            `in service access cannot see it. PBS published the 2023 census for 136 districts — ` +
            `the four provinces and Islamabad — and for none of Azad Jammu & Kashmir's or ` +
            `Gilgit-Baltistan's twenty (D25). A district with no figure is not a district scoring ` +
            `zero: admitting it would draw the twenty least-developed districts in Pakistan out ` +
            `of ground nobody measured.`,
        );
      } else if (!known.has(band)) {
        problems.push(
          `${district} (${scope.province}) is banded "${band}", which is not one of the ` +
            `${bands.length} bands the map shades by. A unit is a group of districts a reader can ` +
            `see share a colour, so a band with no colour is a unit with no legend entry.`,
        );
      }
      if (!scores.has(district)) {
        problems.push(
          `${district} (${scope.province}) is in scope with no development index. Every unit ` +
            `prints the mean of its districts' scores, and a missing one would be read as a zero.`,
        );
      }
      if (!populations.has(district)) {
        problems.push(
          `${district} (${scope.province}) is in scope with no population. Each unit is named for ` +
            `its most populous district, and a missing figure would be read as nobody living there.`,
        );
      }
      if (!graph.has(district)) {
        problems.push(
          `${district} (${scope.province}) is in the scope but not in the adjacency graph, so ` +
            `nothing can reach it. The graph is derived from the arcs the map is drawn from; a ` +
            `district missing from it is a district this build does not draw.`,
        );
      }
    }
  }
  if (problems.length > 0) return { partition: null, problems };

  const units: BandedUnit[] = [];
  const ungrouped: UngroupedProvince[] = [];

  for (const scope of input.provinces) {
    if (scope.districts.length === 0) {
      ungrouped.push({
        province: scope.province,
        districts: [],
        reason:
          `${scope.province} was handed over with no districts, so there is nothing to group and ` +
          `nothing is drawn for it.`,
      });
      continue;
    }

    // Bands in the order the scale is read, so the units of a province come back lowest first.
    for (const band of bands) {
      const inBand = scope.districts.filter((district) => districtBands.get(district) === band.id);
      if (inBand.length === 0) continue;
      for (const component of componentsOf(inBand, graph)) {
        units.push(unitOf(scope.province, band, component, scores, populations));
      }
    }
  }

  return { partition: { units, ungrouped }, problems };
}

/**
 * The rule in words, for `composition.rule` and the card.
 *
 * Written out to the three conditions, on `partitioner.ts`'s own reasoning: the premise is that
 * this boundary is the rule's and not ours, and a reader can only hold us to that if the sentence
 * on the card is enough to redraw the map from. It also says what the rule does *not* do, because
 * the absence of any optimisation is the thing about it most likely to be assumed rather than read.
 */
export const BAND_RULE =
  'A unit is a group of districts that fall in the same development band, lie in the same ' +
  'province, and reach each other across shared district borders — the largest such group each ' +
  'time. The bands are the four the map shades by, at fixed cuts: under 50%, 50% to 65%, 65% to ' +
  '80%, and 80% and above. Scores are the development index — the unweighted mean of the 2023 ' +
  'census’s literacy, improved-drinking-water and flush-toilet rates. Nothing is optimised and ' +
  'nothing is tuned: the province is a boundary the rule does not cross, adjacency is how a unit ' +
  'is built rather than a test applied afterwards, and the number of units is whatever the census ' +
  'turns out to make — including units of a single district, where a district’s neighbours are ' +
  'all served differently from it.';
