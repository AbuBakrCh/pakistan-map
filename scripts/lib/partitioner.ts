/**
 * The administrative rule engine (#27) — partitions of Pakistan drawn by a stated rule rather
 * than by us.
 *
 * Every other basis in this app carries somebody else's line. The Language variants transcribe
 * what a movement published, the Historical ones transcribe what a commission drew, and where a
 * boundary is derived instead of transcribed the card has to say so (`composition.kind`). The
 * Administrative basis has no such line to transcribe: nobody publishes a district list for "no
 * province above 25 million people". So the boundary is computed here, and the thing that keeps it
 * from being *our* boundary is that the rule is stated, the arithmetic is reproducible, and the
 * same rule always yields the same map. A partition a reader cannot re-derive is an editorial
 * opinion wearing a `derived` badge.
 *
 * Three rules, exactly the three the ticket names, and each one fully determines a partition:
 *
 *  - `unit-count` — how many provinces there should be. The published argument at 240 million is
 *    twelve to fourteen; the rule takes the number and draws it.
 *  - `population-ceiling` — no province above N people, and the fewest provinces for which that
 *    holds. Punjab is ~128 million governed from Lahore, which is the whole of the argument.
 *  - `distance-to-capital` — no district more than N km from the seat that administers it, and
 *    the fewest provinces for which that holds. Balochistan's districts are the case: 14.9 million
 *    people spread over the largest province in the country, where population says nothing.
 *
 * ## What a rule can and cannot see
 *
 * **PBS published the 2023 census for 136 districts** — the four provinces and Islamabad — and for
 * none of Azad Jammu & Kashmir's ten or Gilgit-Baltistan's ten (D25). A district with no census
 * row is not a district with a census row of zero, and the difference matters more here than
 * anywhere else in the app: a zero would let a unit take twenty districts of ground for free,
 * under a ceiling it never came close to, and the resulting map would look like an answer. So a
 * district in scope that the census does not reach is **refused by name**, and the caller
 * partitions the 136 and carries AJK and Gilgit-Baltistan through as themselves — which is what
 * `TERRITORY_CLAIM_POLICY` already requires of every other variant (open item 2b).
 *
 * `scorecard.ts` reaches the same conclusion from the other end and states it the same way: never
 * a zero standing in for an absence.
 *
 * ## How a unit is grown, and why it is contiguous
 *
 * Every unit starts at a capital and grows **outward across shared district borders** — the
 * adjacency graph #16 derived from the arcs the map is drawn from — so a unit is connected at
 * every step by construction and cannot be otherwise. That is the reason contiguity is a property
 * of the method here rather than a filter applied afterwards: a partitioner that assigned
 * districts freely and then discarded the broken results would be choosing between maps, and
 * choosing is the thing this module exists not to do. `contiguityOf` is nonetheless run over the
 * finished units and names any that is not whole, because a guarantee nothing checks is a comment.
 *
 * At each step the unit with the **fewest people** takes the next district, and it takes the
 * smallest one available to it. Ties go to the lower district name and the lower capital name, so
 * nothing depends on the order the caller happened to hand anything over. That is the whole of the
 * determinism claim, and `partitioner.test.ts` holds it against a shuffled input rather than
 * against this paragraph.
 *
 * ## Where the capitals come from
 *
 * A rule that says how many provinces there are still has to say where they start, and this is the
 * one place the engine makes a choice, so it is made in the open and stated on the card:
 *
 *  - For the two population rules, capitals are **the most populous districts, no two of them
 *    sharing a border** — a province is administered from its largest city, and two capitals in
 *    adjacent districts are one metropolis with two governments. Where the non-adjacency cannot be
 *    honoured (more capitals wanted than the map has room for) it is relaxed, in population order,
 *    rather than the rule failing.
 *  - For the distance rule, capitals are **as far as possible from the capitals already chosen**,
 *    starting from the most populous district — because the rule is about distance, and seating
 *    every capital in Punjab would answer a question about Balochistan with a fact about Lahore.
 *
 * The cost is stated rather than hidden: population-ranked capitals are Punjab-heavy, because
 * Punjab is where the people are, so a `unit-count` partition can hand Balochistan's western
 * districts to a unit seated a very long way away. That is what a population rule *says*, and it
 * is why the distance rule exists beside it rather than instead of it.
 *
 * ## What this module does not do
 *
 * It does not name a province. A generated unit carries the name of its capital, because the
 * engine has no source for a name and inventing one would be exactly the editorial voice the rule
 * is here to keep out; the variants that ship (#28) rename them in reviewed copy. It does not
 * decide which rule is interesting, and it does not tune one until the map looks right — the
 * number of units is either stated by the rule or is the fewest the constraint admits, and nothing
 * in between is available to be chosen.
 *
 * Pure, like its neighbours: no filesystem, no geometry, no bundle. The caller supplies the
 * districts, the graph, the census and — for the distance rule — the centroids.
 */

import { type AdjacencyGraph, contiguityOf } from './adjacency.ts';
import { provinceOf } from './roster.ts';
import type { NonEmpty, Unit } from './scenarios.ts';

/** The stated rule. Three kinds, each of which determines a partition on its own. */
export type PartitionRule =
  /** Exactly this many units. The number is the argument. */
  | { readonly kind: 'unit-count'; readonly units: number }
  /** No unit above this many people, in the fewest units for which that holds. */
  | { readonly kind: 'population-ceiling'; readonly ceiling: number }
  /** No district further than this from its capital, in the fewest units for which that holds. */
  | { readonly kind: 'distance-to-capital'; readonly km: number };

/** A district centroid, longitude then latitude, as `d3.geoCentroid` returns it. */
export type Centroid = readonly [number, number];

export interface PartitionInput {
  /** The districts to partition. Every one of them ends up in exactly one unit, or nothing does. */
  readonly scope: readonly string[];
  /** Which districts share a border — the graph #16 derives from the arcs the map is drawn from. */
  readonly neighbours: AdjacencyGraph;
  /** District -> 2023 census population. A district the census does not reach is **absent**. */
  readonly populations: ReadonlyMap<string, number>;
  /** Required by `distance-to-capital` and unused by the others. */
  readonly centroids?: ReadonlyMap<string, Centroid>;
}

export interface GeneratedUnit {
  /** Slug of the capital, so a unit's identity survives a rename in #28's copy. */
  readonly id: string;
  /** The capital's name, until a reviewed one replaces it. See the module note. */
  readonly name: string;
  /** The district the unit was grown from, and the seat the distance rule measures against. */
  readonly capital: string;
  /** The unit's districts, ascending. The capital is one of them. */
  readonly districts: NonEmpty<string>;
  /** The sum of its districts' census rows. Never a partial sum — see `problems`. */
  readonly population: number;
}

export interface GeneratedPartition {
  readonly rule: PartitionRule;
  /**
   * The rule in words, for `composition.rule` and the card. Carries the number of units the rule
   * arrived at, because for two of the three rules that number is a *finding* and not an input.
   */
  readonly statement: string;
  /** Ordered largest population first, ties on the capital's name. */
  readonly units: NonEmpty<GeneratedUnit>;
}

export interface Generation {
  /** `null` when anything failed. A partition with a hole in it must not reach a variant. */
  readonly partition: GeneratedPartition | null;
  /** Every problem found, each naming the district or the unit rather than counting them. */
  readonly problems: readonly string[];
}

/** Digits grouped, the way the card sets a census figure — never rounded to a headline. */
const group = (value: number): string => value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** A district named the way every failure in this repo names one: with where it is. */
const named = (district: string): string => {
  const province = provinceOf(district);
  return province === null ? district : `${district} (${province})`;
};

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance between two centroids, in kilometres.
 *
 * A sphere and not the ellipsoid: the rule it serves is a limit of hundreds of kilometres stated
 * as a round number, and the ~0.3% the flattening would move it is far inside the precision of
 * "no district more than 300 km from its capital". Spelling the ellipsoid out would suggest the
 * rule is exact to a metre, which it is not — it is measured centroid to centroid, and a centroid
 * is not where anybody lives.
 */
export function haversineKm(a: Centroid, b: Centroid): number {
  const toRad = (degrees: number): number => (degrees * Math.PI) / 180;
  const [lonA, latA] = a;
  const [lonB, latB] = b;
  const dLat = toRad(latB - latA);
  const dLon = toRad(lonB - lonA);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Districts ordered as every population question in this module orders them. */
const byPopulationDescending = (
  scope: readonly string[],
  populations: ReadonlyMap<string, number>,
): readonly string[] =>
  [...scope].sort(
    (a, b) => (populations.get(b) ?? 0) - (populations.get(a) ?? 0) || a.localeCompare(b),
  );

/**
 * The most populous districts, no two of them sharing a border.
 *
 * Two passes, and the second one is the honest part: the non-adjacency constraint caps how many
 * capitals the map has room for, and a rule asking for more of them should get them rather than
 * fail on a preference. So the first pass honours the constraint, and the second fills the
 * remainder in the same population order, relaxing it.
 */
export function capitalsByPopulation(
  scope: readonly string[],
  neighbours: AdjacencyGraph,
  populations: ReadonlyMap<string, number>,
  wanted: number,
): readonly string[] {
  const ranked = byPopulationDescending(scope, populations);
  const chosen: string[] = [];
  const taken = new Set<string>();
  const adjacentToChosen = new Set<string>();

  for (const district of ranked) {
    if (chosen.length === wanted) break;
    if (adjacentToChosen.has(district)) continue;
    chosen.push(district);
    taken.add(district);
    for (const other of neighbours.get(district) ?? []) adjacentToChosen.add(other);
  }
  for (const district of ranked) {
    if (chosen.length === wanted) break;
    if (taken.has(district)) continue;
    chosen.push(district);
    taken.add(district);
  }
  return chosen;
}

/**
 * Capitals spread as far apart as they can be — the greedy farthest-point choice, from the most
 * populous district outward.
 *
 * Population picks the first one because *something* has to, and the largest city is the least
 * arbitrary something available. Every capital after it is the district furthest from the nearest
 * capital already chosen, which is the only seeding that answers the question the distance rule
 * asks: seating capitals by population puts them all in Punjab and leaves Chagai 500 km from one.
 */
export function capitalsByDistance(
  scope: readonly string[],
  centroids: ReadonlyMap<string, Centroid>,
  populations: ReadonlyMap<string, number>,
  wanted: number,
): readonly string[] {
  const ranked = byPopulationDescending(scope, populations);
  const first = ranked[0];
  if (first === undefined || wanted < 1) return [];

  const chosen: string[] = [first];
  const nearest = new Map<string, number>();
  const distanceFrom = (capital: string, district: string): number => {
    const a = centroids.get(capital);
    const b = centroids.get(district);
    return a === undefined || b === undefined ? 0 : haversineKm(a, b);
  };
  for (const district of scope) nearest.set(district, distanceFrom(first, district));

  while (chosen.length < wanted) {
    let pick: string | null = null;
    let best = -1;
    // Walked in name order rather than the caller's, and taken on a strict improvement, so two
    // districts equally far from everything chosen resolve to the lower name and the order the
    // scope arrived in cannot move a capital.
    for (const district of [...scope].sort((a, b) => a.localeCompare(b))) {
      if (chosen.includes(district)) continue;
      const found = nearest.get(district) ?? 0;
      if (found > best) {
        best = found;
        pick = district;
      }
    }
    if (pick === null) break;
    chosen.push(pick);
    for (const district of scope) {
      nearest.set(district, Math.min(nearest.get(district) ?? 0, distanceFrom(pick, district)));
    }
  }
  return chosen;
}

/** Whether a unit may take a district — the constraint, and the only thing a rule contributes. */
type Admits = (capital: string, population: number, district: string) => boolean;

interface Grown {
  /** District -> the capital of the unit holding it. */
  readonly assignment: ReadonlyMap<string, string>;
  /** Districts the rule could not place, named and ascending. */
  readonly unplaced: readonly string[];
}

/**
 * Grow every unit outward from its capital until no unit has a legal move left.
 *
 * The unit with the fewest people moves first and takes the smallest district available to it,
 * which is what makes the result balanced under a ceiling and even under a bare count: a unit that
 * has fallen behind catches up, and a unit that has run out of room simply stops having moves. A
 * district only ever joins a unit it *borders*, so every unit is one connected piece at every step
 * and at the end.
 */
function grow(
  scope: readonly string[],
  neighbours: AdjacencyGraph,
  populations: ReadonlyMap<string, number>,
  capitals: readonly string[],
  admits: Admits,
): Grown {
  const inScope = new Set(scope);
  const assignment = new Map<string, string>();
  const members = new Map<string, string[]>();
  const population = new Map<string, number>();

  for (const capital of capitals) {
    assignment.set(capital, capital);
    members.set(capital, [capital]);
    population.set(capital, populations.get(capital) ?? 0);
  }

  for (;;) {
    const order = [...capitals].sort(
      (a, b) => (population.get(a) ?? 0) - (population.get(b) ?? 0) || a.localeCompare(b),
    );
    let moved = false;

    for (const capital of order) {
      const candidates = new Set<string>();
      for (const member of members.get(capital) ?? []) {
        for (const other of neighbours.get(member) ?? []) {
          if (inScope.has(other) && !assignment.has(other)) candidates.add(other);
        }
      }
      const legal = [...candidates]
        .filter((district) => admits(capital, population.get(capital) ?? 0, district))
        .sort(
          (a, b) => (populations.get(a) ?? 0) - (populations.get(b) ?? 0) || a.localeCompare(b),
        );
      const take = legal[0];
      if (take === undefined) continue;

      assignment.set(take, capital);
      members.get(capital)?.push(take);
      population.set(capital, (population.get(capital) ?? 0) + (populations.get(take) ?? 0));
      moved = true;
      break;
    }

    if (!moved) break;
  }

  return {
    assignment,
    unplaced: scope.filter((district) => !assignment.has(district)).sort((a, b) => a.localeCompare(b)),
  };
}

/** Turn a finished assignment into units, ordered largest first. */
function unitsOf(
  capitals: readonly string[],
  assignment: ReadonlyMap<string, string>,
  populations: ReadonlyMap<string, number>,
): readonly GeneratedUnit[] {
  const members = new Map<string, string[]>(capitals.map((capital) => [capital, []]));
  for (const [district, capital] of assignment) members.get(capital)?.push(district);

  return [...members]
    .map(([capital, districts]) => {
      const sorted = [...districts].sort((a, b) => a.localeCompare(b));
      const [first, ...rest] = sorted;
      return {
        id: slug(capital),
        name: capital,
        capital,
        districts: [first as string, ...rest] as NonEmpty<string>,
        population: sorted.reduce((n, district) => n + (populations.get(district) ?? 0), 0),
      };
    })
    .sort((a, b) => b.population - a.population || a.capital.localeCompare(b.capital));
}

const CAPITAL_RULE_POPULATION =
  'Capitals are the most populous districts, no two of them sharing a border (relaxed in ' +
  'population order where the map has no room for another); each unit grows outward from its ' +
  'capital across shared district borders, the unit with the fewest people taking the next ' +
  'district each time.';

const CAPITAL_RULE_DISTANCE =
  'Capitals are chosen as far as possible from the capitals already chosen, starting from the ' +
  'most populous district; each unit grows outward from its capital across shared district ' +
  'borders, the unit with the fewest people taking the next district each time.';

const CENSUS = 'Populations are the PBS 2023 census district rows.';

function statementFor(rule: PartitionRule, units: number): string {
  switch (rule.kind) {
    case 'unit-count':
      return `${units} units. ${CAPITAL_RULE_POPULATION} ${CENSUS}`;
    case 'population-ceiling':
      return (
        `No unit above ${group(rule.ceiling)} people; ${units} units is the fewest for which ` +
        `that holds. ${CAPITAL_RULE_POPULATION} ${CENSUS}`
      );
    case 'distance-to-capital':
      return (
        `No district more than ${group(rule.km)} km from its unit's capital, measured centroid ` +
        `to centroid; ${units} units is the fewest for which that holds. ` +
        `${CAPITAL_RULE_DISTANCE} ${CENSUS}`
      );
  }
}

/** Everything wrong with the inputs before a rule is allowed to run. Each names its district. */
function inputProblems(rule: PartitionRule, input: PartitionInput): readonly string[] {
  const problems: string[] = [];

  if (input.scope.length === 0) {
    problems.push('the rule was given no districts to partition.');
    return problems;
  }

  const duplicated = input.scope.filter((district, i) => input.scope.indexOf(district) !== i);
  for (const district of [...new Set(duplicated)].sort((a, b) => a.localeCompare(b))) {
    problems.push(`${named(district)} appears twice in the scope; a district is in one unit.`);
  }

  for (const district of [...input.scope].sort((a, b) => a.localeCompare(b))) {
    if (!input.neighbours.has(district)) {
      problems.push(
        `${named(district)} is in the scope but not in the adjacency graph, so nothing can grow ` +
          `into it. The graph is derived from the arcs the map is drawn from; a district missing ` +
          `from it is a district this build does not draw.`,
      );
    }
    if (!input.populations.has(district)) {
      problems.push(
        `${named(district)} has no 2023 census population, so a rule stated in people cannot ` +
          `see it. PBS published the census for 136 districts — the four provinces and ` +
          `Islamabad — and for none of AJK's or Gilgit-Baltistan's twenty (D25). A district ` +
          `with no figure is not a district with a figure of zero: admitting it would let a ` +
          `unit take ground for free under a ceiling it never came near. Partition the census ` +
          `districts and carry the territories through as themselves.`,
      );
    }
  }

  switch (rule.kind) {
    case 'unit-count':
      if (!Number.isInteger(rule.units) || rule.units < 1) {
        problems.push(`a partition of ${rule.units} units is not a number of units.`);
      } else if (rule.units > input.scope.length) {
        problems.push(
          `the rule asks for ${rule.units} units out of ${input.scope.length} districts. A unit ` +
            `is made of districts, so there is nothing for the last ${
              rule.units - input.scope.length
            } of them to be made of.`,
        );
      }
      break;
    case 'population-ceiling': {
      if (!(rule.ceiling > 0)) {
        problems.push(`a ceiling of ${rule.ceiling} people admits no district at all.`);
        break;
      }
      const over = [...input.scope]
        .filter((district) => (input.populations.get(district) ?? 0) > rule.ceiling)
        .sort((a, b) => a.localeCompare(b));
      for (const district of over) {
        problems.push(
          `${named(district)} has ${group(input.populations.get(district) ?? 0)} people on its ` +
            `own, above the ceiling of ${group(rule.ceiling)}. A district is the atom here ` +
            `(D23) and cannot be split, so no partition satisfies this ceiling.`,
        );
      }
      break;
    }
    case 'distance-to-capital': {
      if (!(rule.km > 0)) {
        problems.push(`a limit of ${rule.km} km leaves every district outside its own capital.`);
        break;
      }
      const centroids = input.centroids;
      if (centroids === undefined) {
        problems.push(
          'a distance rule was given no district centroids; distance to a capital cannot be ' +
            'measured without them.',
        );
        break;
      }
      for (const district of [...input.scope].sort((a, b) => a.localeCompare(b))) {
        if (!centroids.has(district)) {
          problems.push(`${named(district)} has no centroid, so its distance to a capital is unknown.`);
        }
      }
      break;
    }
  }

  return problems;
}

/**
 * Draw the partition a rule states.
 *
 * For `unit-count` there is one attempt and the count is the rule. For the other two the count is
 * a *finding*: the engine starts at the fewest units the constraint could conceivably be met with
 * and adds one until it is, which is what makes "no province above 25 million" a complete
 * instruction rather than half of one. The search is bounded by the scope — a unit per district
 * satisfies any ceiling that no single district already breaks, and any distance at all — so it
 * terminates, and it terminates on the smallest answer because it counts upward.
 */
export function partitionByRule(rule: PartitionRule, input: PartitionInput): Generation {
  const problems = [...inputProblems(rule, input)];
  if (problems.length > 0) return { partition: null, problems };

  const { scope, neighbours, populations } = input;
  const centroids = input.centroids ?? new Map<string, Centroid>();

  const admits: Admits = (capital, population, district) => {
    switch (rule.kind) {
      case 'unit-count':
        return true;
      case 'population-ceiling':
        return population + (populations.get(district) ?? 0) <= rule.ceiling;
      case 'distance-to-capital': {
        const a = centroids.get(capital);
        const b = centroids.get(district);
        return a !== undefined && b !== undefined && haversineKm(a, b) <= rule.km;
      }
    }
  };

  const total = scope.reduce((n, district) => n + (populations.get(district) ?? 0), 0);
  const first =
    rule.kind === 'unit-count'
      ? rule.units
      : rule.kind === 'population-ceiling'
        ? Math.max(1, Math.ceil(total / rule.ceiling))
        : 1;
  const last = rule.kind === 'unit-count' ? rule.units : scope.length;

  let lastUnplaced: readonly string[] = [];
  for (let wanted = first; wanted <= last; wanted += 1) {
    const capitals =
      rule.kind === 'distance-to-capital'
        ? capitalsByDistance(scope, centroids, populations, wanted)
        : capitalsByPopulation(scope, neighbours, populations, wanted);
    const { assignment, unplaced } = grow(scope, neighbours, populations, capitals, admits);
    lastUnplaced = unplaced;
    if (unplaced.length > 0) continue;

    const units = unitsOf(capitals, assignment, populations);
    // Contiguity is guaranteed by growing across borders and is checked anyway: a guarantee
    // nothing looks at is a comment, and the one thing this engine must never do quietly is hand
    // #28 a province in two pieces.
    for (const unit of units) {
      const contiguity = contiguityOf(neighbours, unit.districts);
      if (contiguity.contiguous) continue;
      problems.push(
        `${unit.name} came out in ${contiguity.pieces} pieces — ` +
          contiguity.detached.map((piece) => piece.join(', ')).join('; ') +
          ` touch none of it. A unit is grown outward from its capital across shared borders and ` +
          `cannot be in two pieces, so the graph and the growth disagree.`,
      );
    }
    if (problems.length > 0) return { partition: null, problems };

    const [head, ...rest] = units;
    if (head === undefined) {
      return { partition: null, problems: ['the rule placed every district in no unit at all.'] };
    }
    return {
      partition: {
        rule,
        statement: statementFor(rule, units.length),
        units: [head, ...rest],
      },
      problems: [],
    };
  }

  problems.push(
    rule.kind === 'unit-count'
      ? `${rule.units} units leave ${lastUnplaced.map(named).join(', ')} in no unit: they border ` +
        `nothing the rule placed, so the districts given to it are not all connected.`
      : `no partition of up to ${last} units satisfies the rule; the last attempt left ` +
        `${lastUnplaced.map(named).join(', ')} unplaced.`,
  );
  return { partition: null, problems };
}

/**
 * The generated units as the scenario schema wants them, so #28 writes a variant and not a loop.
 *
 * Every one of them is `proposed` — that is what a generated boundary is — and the claim is the
 * 2023 districts themselves, so nothing here needs the fold table: the engine only ever saw
 * districts the map draws.
 */
export function proposedUnits(partition: GeneratedPartition): NonEmpty<Unit> {
  const [first, ...rest] = partition.units.map(
    (unit): Unit => ({
      id: unit.id,
      name: unit.name,
      kind: 'proposed',
      claims: unit.districts,
    }),
  );
  if (first === undefined) {
    throw new Error('a generated partition with no units cannot become a variant');
  }
  return [first, ...rest];
}
