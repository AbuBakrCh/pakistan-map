/**
 * The development-gradient rule engine (#31) — D1, the one variant drawn from what the census
 * says about service access rather than from what anybody proposes.
 *
 * Nobody publishes a district list for "split each province where its development gradient is
 * steepest". So the boundary is computed here, under the discipline `partitioner.ts` and
 * `mother-tongue-partition.ts` already work under: the rule is stated, the arithmetic is
 * reproducible, the same rule always draws the same map, and the card says the line was computed
 * rather than transcribed. A partition a reader cannot re-derive is an editorial opinion wearing a
 * `derived` badge.
 *
 * ## The rule, entire
 *
 * Each province is cut into **two** units, and the cut is chosen in two steps.
 *
 *  1. **The candidates are connected by construction.** Starting from the province's
 *     lowest-scoring district, the lower unit grows outward across shared district borders,
 *     taking at each step the **lowest-scoring district on its edge** (ties to the lower name).
 *     That produces one nested chain of connected sets — the province's districts in the order the
 *     gradient reaches them — and every prefix of it is a candidate lower unit. Contiguity is the
 *     method here rather than a filter, exactly as it is next door; the *complement* is checked
 *     too, since a lower unit that is whole can still leave the rest of the province in two pieces,
 *     and such a cut is simply not among the candidates.
 *  2. **The cut is the one-dimensional natural break.** Among those candidates the rule takes the
 *     one maximising `k(n − k)(mean_high − mean_low)² / n²` — the between-group variance of the
 *     split, which is Fisher's and Jenks's own criterion for where a distribution divides most
 *     sharply. It is not our statistic and it does not need to be tuned.
 *
 * **Why not simply the largest step between two consecutive districts**, which is what "steepest"
 * first suggests? Because on this census that rule peels off one district: Punjab's largest single
 * step is Rajanpur to Dera Ghazi Khan, so Punjab would be Rajanpur and everything else. A largest
 * gap finds an outlier; a natural break finds a division. The cost of the choice is stated on D1's
 * own card rather than buried here — in Punjab the break falls between two districts only 0.002
 * apart, because Punjab's gradient is a long smooth slope and not a cliff, so what the rule finds
 * there is where the province divides most cleanly overall and not where two neighbours differ
 * most.
 *
 * ## What the rule cannot reach
 *
 *  - **A district the census does not cover** — Azad Jammu & Kashmir's ten and Gilgit-Baltistan's
 *    ten (D25) — is refused by name if it is handed to this engine. There is no score to sort it
 *    by, and a zero would make twenty districts the least developed ground in Pakistan on every
 *    component at once.
 *  - **A province of one district cannot be split**, and is returned as `unsplit` with the reason
 *    rather than dropped. Islamabad Capital Territory is one district; the caller carries it
 *    through unchanged and the card says so, because a partition silently missing a first-level
 *    entity is a hole in the map.
 *  - **A province whose own districts are not connected** would make the growth chain stop with
 *    districts left over, and is reported rather than completed by jumping the gap.
 *
 * Pure, like its neighbours: no filesystem, no geometry, no bundle. The caller supplies the
 * districts, the graph, the scores and the populations.
 */

import { contiguityOf, type AdjacencyGraph } from './adjacency.ts';

/** One province, and everything the rule needs to cut it. */
export interface ProvinceScope {
  readonly province: string;
  /** The province's districts. Every one of them ends up in exactly one half, or nothing does. */
  readonly districts: readonly string[];
}

export interface GradientInput {
  readonly provinces: readonly ProvinceScope[];
  readonly graph: AdjacencyGraph;
  /** District -> its development index. A district the census does not reach is **absent**. */
  readonly scores: ReadonlyMap<string, number>;
  /** District -> 2023 census population, which is what names a half. Absent is refused. */
  readonly populations: ReadonlyMap<string, number>;
}

/** One half of a province, as the rule left it. */
export interface GradientHalf {
  /** Sorted, so a rebuild writes the same list. */
  readonly districts: readonly string[];
  /** The unweighted mean of its districts' index scores. */
  readonly mean: number;
  /** Its most populous district — what names the unit, since the engine has no source for a name. */
  readonly principal: string;
  readonly population: number;
}

export interface GradientSplit {
  readonly province: string;
  /** The half on the low side of the break. */
  readonly lower: GradientHalf;
  readonly higher: GradientHalf;
  /**
   * The square root of the natural-break statistic — the separation the cut achieves, in index
   * points, discounted by how uneven the two halves are. Comparable between provinces, which is
   * what makes "Punjab's gradient is the shallowest of the four" a statement and not an
   * impression.
   */
  readonly separation: number;
  /** The two districts either side of the break, and how far apart they are. Card copy. */
  readonly seam: {
    readonly below: string;
    readonly above: string;
    readonly difference: number;
  };
}

/** A province the rule could not cut, and why. Named rather than dropped. */
export interface UnsplitProvince {
  readonly province: string;
  readonly districts: readonly string[];
  readonly reason: string;
}

export interface GradientPartition {
  /** In the order the provinces were handed over, so the caller decides the card's order. */
  readonly splits: readonly GradientSplit[];
  readonly unsplit: readonly UnsplitProvince[];
}

export interface GradientResult {
  /** `null` when anything failed: a partition with a hole in it must not reach a variant. */
  readonly partition: GradientPartition | null;
  readonly problems: readonly string[];
}

const mean = (districts: readonly string[], scores: ReadonlyMap<string, number>): number =>
  districts.reduce((sum, district) => sum + (scores.get(district) ?? 0), 0) / districts.length;

/**
 * The chain: the province's districts in the order the lower unit reaches them.
 *
 * Every prefix is connected because every district joins across a border it shares with the
 * prefix before it. Returns `null` where the province's own districts do not hang together, which
 * would leave the chain short — the caller reports that rather than jumping the gap, since a
 * province in two pieces is a fact about the geometry and not something a rule may paper over.
 */
function growthChain(
  scope: ProvinceScope,
  graph: AdjacencyGraph,
  scores: ReadonlyMap<string, number>,
): readonly string[] | null {
  const inProvince = new Set(scope.districts);
  const ranked = [...scope.districts].sort(
    (a, b) => (scores.get(a) ?? 0) - (scores.get(b) ?? 0) || a.localeCompare(b),
  );
  const first = ranked[0];
  if (first === undefined) return null;

  const chain = [first];
  const taken = new Set(chain);
  while (chain.length < scope.districts.length) {
    const candidates = new Set<string>();
    for (const member of chain) {
      for (const other of graph.get(member) ?? []) {
        if (inProvince.has(other) && !taken.has(other)) candidates.add(other);
      }
    }
    // Walked in name order and taken on a strict improvement, so two equally-scored districts on
    // the edge resolve to the lower name and nothing about the caller's ordering moves a boundary.
    let pick: string | null = null;
    for (const candidate of [...candidates].sort((a, b) => a.localeCompare(b))) {
      if (pick === null || (scores.get(candidate) ?? 0) < (scores.get(pick) ?? 0)) pick = candidate;
    }
    if (pick === null) return null;
    chain.push(pick);
    taken.add(pick);
  }
  return chain;
}

function halfOf(
  districts: readonly string[],
  scores: ReadonlyMap<string, number>,
  populations: ReadonlyMap<string, number>,
): GradientHalf {
  const sorted = [...districts].sort((a, b) => a.localeCompare(b));
  const principal = sorted.reduce((largest, district) =>
    (populations.get(district) ?? 0) > (populations.get(largest) ?? 0) ? district : largest,
  );
  return {
    districts: sorted,
    mean: mean(sorted, scores),
    principal,
    population: sorted.reduce((sum, district) => sum + (populations.get(district) ?? 0), 0),
  };
}

/**
 * Cut every province at its steepest development gradient.
 *
 * Problems are collected across the whole input rather than thrown at the first, so a bad scope is
 * reported as everything wrong with it and not as whichever district happens to sort first.
 */
export function splitByDevelopmentGradient(input: GradientInput): GradientResult {
  const problems: string[] = [];
  const { graph, scores, populations } = input;

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
      if (!scores.has(district)) {
        problems.push(
          `${district} (${scope.province}) is in scope with no development index, so a rule ` +
            `stated in service access cannot see it. PBS published the 2023 census for 136 ` +
            `districts — the four provinces and Islamabad — and for none of Azad Jammu & ` +
            `Kashmir's or Gilgit-Baltistan's twenty (D25). A district with no figure is not a ` +
            `district scoring zero: admitting it would draw the twenty least-developed districts ` +
            `in Pakistan out of ground nobody measured.`,
        );
      }
      if (!populations.has(district)) {
        problems.push(
          `${district} (${scope.province}) is in scope with no population. Each half of a ` +
            `province is named for its most populous district, and a missing figure would be ` +
            `read as nobody living there.`,
        );
      }
      if (!graph.has(district)) {
        problems.push(
          `${district} (${scope.province}) is in the scope but not in the adjacency graph, so ` +
            `nothing can grow into it. The graph is derived from the arcs the map is drawn from; ` +
            `a district missing from it is a district this build does not draw.`,
        );
      }
    }
  }
  if (problems.length > 0) return { partition: null, problems };

  const splits: GradientSplit[] = [];
  const unsplit: UnsplitProvince[] = [];

  for (const scope of input.provinces) {
    if (scope.districts.length < 2) {
      unsplit.push({
        province: scope.province,
        districts: [...scope.districts],
        reason:
          `${scope.province} is a single district, so it has no internal gradient to cut and is ` +
          `carried through exactly as it is.`,
      });
      continue;
    }

    const chain = growthChain(scope, graph, scores);
    if (chain === null) {
      const contiguity = contiguityOf(graph, scope.districts);
      problems.push(
        `${scope.province}'s own districts do not form one connected group — ` +
          `${contiguity.detached.map((piece) => piece.join(', ')).join('; ')} ` +
          `touch none of the rest — so there is no chain of shared borders for a unit to grow ` +
          `along. The rule will not jump a gap it cannot see across.`,
      );
      continue;
    }

    let best: { lower: readonly string[]; higher: readonly string[]; value: number } | null = null;
    for (let k = 1; k < chain.length; k += 1) {
      const lower = chain.slice(0, k);
      const higher = chain.slice(k);
      // The lower half is connected by construction; the higher half is not, and a cut that
      // leaves the rest of the province in two pieces is not a candidate rather than a flagged
      // result. Contiguity is the method here (D7 is about claims somebody made, not about a line
      // this build drew).
      if (!contiguityOf(graph, higher).contiguous) continue;
      const difference = mean(higher, scores) - mean(lower, scores);
      const value = (lower.length * higher.length * difference * difference) / chain.length ** 2;
      if (best === null || value > best.value + 1e-12) best = { lower, higher, value };
    }

    if (best === null) {
      problems.push(
        `${scope.province} admits no cut at all: every way of taking its districts in gradient ` +
          `order leaves the rest of the province in more than one piece.`,
      );
      continue;
    }

    const below = best.lower[best.lower.length - 1] as string;
    const above = best.higher[0] as string;
    splits.push({
      province: scope.province,
      lower: halfOf(best.lower, scores, populations),
      higher: halfOf(best.higher, scores, populations),
      separation: Math.sqrt(best.value),
      seam: {
        below,
        above,
        difference: (scores.get(above) ?? 0) - (scores.get(below) ?? 0),
      },
    });
  }

  if (problems.length > 0) return { partition: null, problems };
  return { partition: { splits, unsplit }, problems };
}

/**
 * The rule in words, for `composition.rule` and the card.
 *
 * Written out to the tie-break, on `partitioner.ts`'s own reasoning: the premise is that this
 * boundary is the rule's and not ours, and a reader can only hold us to that if the sentence on
 * the card is enough to redraw the map from. Which district the lower unit takes next is the half
 * that actually decides where the line lands.
 */
export const GRADIENT_RULE =
  'Each province is cut in two. The lower unit starts at the province’s lowest-scoring district ' +
  'and grows outward across shared district borders, taking at each step the lowest-scoring ' +
  'district on its edge, ties going to the lower district name — so every cut it can make is ' +
  'connected, and so is the rest of the province, which is checked. Of those cuts the rule takes ' +
  'the one-dimensional natural break: the split maximising the variance between the two halves, ' +
  'k(n−k)(mean high − mean low)² ÷ n², which is Fisher’s and Jenks’s own criterion for where a ' +
  'distribution divides most sharply rather than where one outlier sits. Scores are the ' +
  'development index — the unweighted mean of the 2023 census’s literacy, improved-drinking-water ' +
  'and flush-toilet rates.';
