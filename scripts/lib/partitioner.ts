/**
 * The administrative rule engine (#27, rewritten) — a partition of Pakistan drawn by a stated rule
 * rather than by us, and drawn **inside the provinces that already exist**.
 *
 * Every other basis in this app carries somebody else's line. The Language variants transcribe
 * what a movement published, the Historical ones transcribe what a commission drew, and where a
 * boundary is derived instead of transcribed the card has to say so (`composition.kind`). The
 * Administrative basis has no such line to transcribe: nobody publishes a district list for
 * "no province above 25 million people, seated at a divisional headquarters". So the boundary is
 * computed here, and the thing that keeps it from being *our* boundary is that the rule is stated,
 * the arithmetic is reproducible, and the same rule always yields the same map. A partition a
 * reader cannot re-derive is an editorial opinion wearing a `derived` badge.
 *
 * ## The rule, in the order it runs
 *
 * 1. **The province is the frame.** Each of the four provinces and the capital territory is
 *    partitioned on its own, and **no unit crosses a provincial boundary**. That is the change
 *    from the engine this replaces, and it is the one assumption that most narrows what the rule
 *    can say: a map that redrew across provincial lines would be answering a question about
 *    administrative load with a rearrangement of the federation, and every real proposal in this
 *    app argues inside one province at a time.
 * 2. **A centre is a divisional headquarters that the census finds well enough served** — the
 *    development index at or above the stated floor. Seeds are taken in population order, the
 *    most populous qualifying centre first.
 * 3. **The unit grows outward across shared district borders** — the adjacency graph #16 derives
 *    from the arcs the map is drawn from — taking the **nearest unassigned district** on its edge
 *    each time, so a unit is connected at every step by construction and compact around its own
 *    centre. A district is admitted only while both limits hold: the unit stays **at or below the
 *    population ceiling**, and the district is **within the distance limit of the centre**.
 * 4. **When neither limit admits anything more, the unit is closed** and the next centre is seeded
 *    from what is left of the province. The province is finished when nothing is left.
 *
 * The ceiling is a limit and not a target: a district that would carry the unit past it is
 * refused, so every unit lands at or below the figure rather than at or just above it. Both halves
 * are stated on the card in those words.
 *
 * ## Two costs, stated rather than smoothed
 *
 * **"Travel distance" is measured as a straight line, centroid to centroid.** There is no road
 * network in this bundle and no routing source at this project's vintage, and inventing one would
 * put an unsourced number under a boundary. So the limit is a great-circle distance and the card
 * says so in those words rather than calling it travel time — a straight line is shorter than any
 * road, which makes the limit the more generous of the two readings, and a centroid is not where
 * anybody lives.
 *
 * **Sequential seeding strands districts, and a stranded district becomes a unit.** A unit closed
 * by the distance limit can leave a pocket of the province with no qualifying centre left in it;
 * the fallback then seeds on the **most populous remaining district**, whatever its development
 * index and whether or not it is a headquarters, because a rule that refused would leave part of a
 * province in no unit and a partition with a hole in it is not a partition (D6). Every unit seeded
 * that way is recorded, so the card can name them rather than let a one-district province pass as
 * an intended output.
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
 * The development index is refused on the same terms and for a sharper reason: the floor is a
 * *threshold*, so a missing score read as zero would not fail loudly, it would quietly disqualify
 * a headquarters and move a boundary.
 *
 * `scorecard.ts` reaches the same conclusion from the other end and states it the same way: never
 * a zero standing in for an absence.
 *
 * ## Where the centres come from
 *
 * A rule that says a unit is grown around an administrative centre still has to say which
 * districts hold one, and this is the one place the engine makes a choice, so it is made in the
 * open and stated on the card. **A division's headquarters is the district that carries the
 * division's own name**; where no district does, it is the **most populous district in the
 * division**. That is a rule and not a transcription, deliberately — PBS publishes the division
 * each district belongs to and does not publish a seat column, and typing one out of a provincial
 * gazetteer would put the one unsourced table in this repo underneath every Administrative
 * boundary. Twenty-seven of the thirty-one divisions are named after a district and resolve by
 * name; four are not, and the card names all four and the district the rule seats each at.
 *
 * The seats of the first-level units need no clause of their own: every provincial capital is
 * already the headquarters of the division it names, and Islamabad is the whole of its own
 * pseudo-division (#3).
 *
 * ## What this module does not do
 *
 * It does not name a province. A generated unit carries the name of its centre, because the engine
 * has no source for a name and inventing one would be exactly the editorial voice the rule is here
 * to keep out. It does not decide which rule is interesting, and it does not tune one until the
 * map looks right — the number of units is a *finding*, never an input, and nothing in between is
 * available to be chosen.
 *
 * Pure, like its neighbours: no filesystem, no geometry, no bundle. The caller supplies the
 * districts, the graph, the census, the divisions, the development index and the centroids.
 */

import { type AdjacencyGraph, contiguityOf } from './adjacency.ts';
import { groupDigits as group } from './digits.ts';
import { provinceOf } from './roster.ts';
import { slug, type NonEmpty, type Unit } from './scenarios.ts';

/**
 * The stated rule, and all three numbers it is stated in.
 *
 * One kind rather than a union, because the three parameters are one rule: a ceiling with no
 * distance limit would run a unit the length of Balochistan, and a distance limit with no ceiling
 * would put half of Punjab in one unit. `kind` is kept so a statement, a failure and a test all
 * name the rule the same way.
 */
export interface PartitionRule {
  readonly kind: 'within-province-centres';
  /** No unit may exceed this many people. A limit, never a target. */
  readonly ceiling: number;
  /** No district may be further than this from its unit's centre, in kilometres. */
  readonly km: number;
  /** A centre must score at least this on the development index — a proportion in 0 to 1. */
  readonly developmentFloor: number;
}

/** A district centroid, longitude then latitude, as `d3.geoCentroid` returns it. */
export type Centroid = readonly [number, number];

/** How a unit's centre was arrived at, which is the one thing about it worth saying on a card. */
export type CentreKind =
  /** A divisional headquarters clearing the development floor — what the rule is stated in. */
  | 'headquarters'
  /** Nothing left in the province qualified, so the most populous remainder seeded the unit. */
  | 'fallback';

export interface PartitionInput {
  /** The districts to partition. Every one of them ends up in exactly one unit, or nothing does. */
  readonly scope: readonly string[];
  /** Which districts share a border — the graph #16 derives from the arcs the map is drawn from. */
  readonly neighbours: AdjacencyGraph;
  /** District -> 2023 census population. A district the census does not reach is **absent**. */
  readonly populations: ReadonlyMap<string, number>;
  /**
   * District -> the province it is in, which is the frame the whole rule is drawn inside.
   *
   * Supplied rather than read off the roster this module already imports, because the frame is the
   * rule's central claim: a caller partitioning some other set of districts has to say what the
   * provinces of that set are, and an engine that answered the question for itself would silently
   * draw the wrong frame the first time it was handed a scope the roster does not describe.
   */
  readonly provinces: ReadonlyMap<string, string>;
  /** District -> the division PBS files it under, which is where the headquarters rule looks. */
  readonly divisions: ReadonlyMap<string, string>;
  /** District -> its development index. A district the composite does not reach is **absent**. */
  readonly development: ReadonlyMap<string, number>;
  /** District centroids, longitude then latitude. The distance limit is measured against these. */
  readonly centroids: ReadonlyMap<string, Centroid>;
}

export interface GeneratedUnit {
  /** Slug of the centre, so a unit's identity survives a rename in reviewed copy. */
  readonly id: string;
  /** The centre's name, until a reviewed one replaces it. See the module note. */
  readonly name: string;
  /** The district the unit was grown from, and the seat the distance limit measures against. */
  readonly centre: string;
  /** How that centre was arrived at — the rule's own test, or the fallback. */
  readonly centreKind: CentreKind;
  /** The province the unit lies wholly inside. No unit spans two. */
  readonly province: string;
  /** The unit's districts, ascending. The centre is one of them. */
  readonly districts: NonEmpty<string>;
  /** The sum of its districts' census rows. Never a partial sum — see `problems`. */
  readonly population: number;
}

export interface GeneratedPartition {
  readonly rule: PartitionRule;
  /**
   * The rule in words, for `composition.rule` and the card. Carries the number of units the rule
   * arrived at, because that number is a *finding* and not an input.
   */
  readonly statement: string;
  /** Ordered largest population first, ties on the centre's name. */
  readonly units: NonEmpty<GeneratedUnit>;
}

export interface Generation {
  /** `null` when anything failed. A partition with a hole in it must not reach a variant. */
  readonly partition: GeneratedPartition | null;
  /** Every problem found, each naming the district or the unit rather than counting them. */
  readonly problems: readonly string[];
}

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
 * "no district more than 300 km from its centre". Spelling the ellipsoid out would suggest the
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
 * A division's name and a district's name compared the way this repo compares two spellings of one
 * place: on letters alone, so *D. G. Khan* and *Dera Ghazi Khan* are not asked to match by accident
 * and *Sukkur* and *Sukkur* are not kept apart by a stray point.
 */
const letters = (name: string): string => name.toLowerCase().replace(/[^a-z]/g, '');

/**
 * The divisional headquarters of every division the scope touches.
 *
 * The district carrying the division's own name, and where no district does, the most populous
 * district in the division — a stated rule rather than a transcribed seat column, for the reason
 * in the module note. Divisions are keyed by province *and* name, because two provinces may file
 * a division under the same word and a headquarters is a fact about one of them.
 */
export function divisionalHeadquarters(
  scope: readonly string[],
  divisions: ReadonlyMap<string, string>,
  provinces: ReadonlyMap<string, string>,
  populations: ReadonlyMap<string, number>,
): ReadonlySet<string> {
  const grouped = new Map<string, { readonly division: string; readonly members: string[] }>();
  for (const district of [...scope].sort((a, b) => a.localeCompare(b))) {
    const division = divisions.get(district);
    if (division === undefined) continue;
    const key = `${provinces.get(district) ?? ''} ${division}`;
    const found = grouped.get(key);
    // The division's own spelling is carried beside the key rather than parsed back out of it:
    // province names have spaces in them, and a key a reader has to split is one that will
    // eventually be split wrong.
    if (found === undefined) grouped.set(key, { division, members: [district] });
    else found.members.push(district);
  }

  const seats = new Set<string>();
  for (const [, { division, members }] of [...grouped].sort(([a], [b]) => a.localeCompare(b))) {
    const eponymous = members
      .filter((district) => letters(district) === letters(division))
      .sort((a, b) => a.localeCompare(b))[0];
    const seat = eponymous ?? byPopulationDescending(members, populations)[0];
    if (seat !== undefined) seats.add(seat);
  }
  return seats;
}

/** The centres of a province, in the order the rule seeds them. Excludes nothing; ranks only. */
const centresIn = (
  remaining: ReadonlySet<string>,
  seats: ReadonlySet<string>,
  development: ReadonlyMap<string, number>,
  populations: ReadonlyMap<string, number>,
  floor: number,
): readonly string[] =>
  byPopulationDescending(
    [...remaining].filter((district) => seats.has(district) && (development.get(district) ?? 0) >= floor),
    populations,
  );

/** One province's worth of the partition, grown unit by unit until nothing is left of it. */
function partitionProvince(
  province: string,
  scope: readonly string[],
  rule: PartitionRule,
  input: PartitionInput,
  seats: ReadonlySet<string>,
): readonly GeneratedUnit[] {
  const { neighbours, populations, development, centroids } = input;
  const remaining = new Set(scope);
  const units: GeneratedUnit[] = [];

  const distance = (from: string, to: string): number =>
    haversineKm(centroids.get(from) as Centroid, centroids.get(to) as Centroid);

  while (remaining.size > 0) {
    const qualifying = centresIn(remaining, seats, development, populations, rule.developmentFloor);
    const centre = qualifying[0] ?? byPopulationDescending([...remaining], populations)[0];
    if (centre === undefined) break;
    const centreKind: CentreKind = qualifying[0] === undefined ? 'fallback' : 'headquarters';

    const members = [centre];
    remaining.delete(centre);
    let population = populations.get(centre) ?? 0;

    for (;;) {
      // The unit's own edge: every unassigned district of this province that borders something it
      // already holds. Confined to the province, which is what makes the frame a frame rather
      // than a preference the growth could grow out of.
      const edge = new Set<string>();
      for (const member of members) {
        for (const other of neighbours.get(member) ?? []) {
          if (remaining.has(other)) edge.add(other);
        }
      }
      // Nearest first, ties on the lower district name. Nearest and not least populous, because
      // the rule is stated as a distance from a centre: taking the far side of a province before
      // the near one would satisfy the same limit and draw a different, worse-shaped map, and the
      // card has to be a sentence a reader can redraw the map from.
      const admissible = [...edge]
        .filter(
          (district) =>
            population + (populations.get(district) ?? 0) <= rule.ceiling &&
            distance(centre, district) <= rule.km,
        )
        .sort((a, b) => distance(centre, a) - distance(centre, b) || a.localeCompare(b));

      const take = admissible[0];
      if (take === undefined) break;
      members.push(take);
      remaining.delete(take);
      population += populations.get(take) ?? 0;
    }

    const sorted = [...members].sort((a, b) => a.localeCompare(b));
    const [first, ...rest] = sorted;
    units.push({
      id: slug(centre),
      name: centre,
      centre,
      centreKind,
      province,
      districts: [first as string, ...rest] as NonEmpty<string>,
      population,
    });
  }

  return units;
}

const CENTRE_RULE =
  'A centre is the headquarters of a division — the district carrying the division’s own name, ' +
  'or, where no district does, the most populous district in it — scoring at least ' +
  'DEVELOPMENT_FLOOR on the development index; centres are seeded most populous first, and where ' +
  'nothing left in a province qualifies, the most populous remaining district seeds the unit.';

const GROWTH_RULE =
  'each unit grows outward from its centre across shared district borders, taking the nearest ' +
  'unassigned district on its edge each time and stopping when neither limit admits another, ' +
  'ties going to the lower district name.';

const CENSUS = 'Populations are the PBS 2023 census district rows.';

function statementFor(rule: PartitionRule, units: number, provinces: number): string {
  const floor = `${(rule.developmentFloor * 100).toFixed(0)}%`;
  return (
    `Each province is partitioned on its own and no unit crosses a provincial boundary; ` +
    `${provinces} provinces come to ${units} units, which is a finding and not an input. No unit ` +
    `above ${group(rule.ceiling)} people, and no district more than ${group(rule.km)} km from its ` +
    `unit’s centre, measured centroid to centroid in a straight line rather than along a road. ` +
    `${CENTRE_RULE.replace('DEVELOPMENT_FLOOR', floor)} Then ${GROWTH_RULE} ${CENSUS}`
  );
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

  if (!(rule.ceiling > 0)) {
    problems.push(`a ceiling of ${rule.ceiling} people admits no district at all.`);
  }
  if (!(rule.km > 0)) {
    problems.push(`a limit of ${rule.km} km leaves every district outside its own centre.`);
  }
  if (!(rule.developmentFloor >= 0 && rule.developmentFloor <= 1)) {
    problems.push(
      `a development floor of ${rule.developmentFloor} is not a proportion; the index is a mean ` +
        `of three published rates and runs from 0 to 1.`,
    );
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
    if (!input.divisions.has(district)) {
      problems.push(
        `${named(district)} is filed under no division, so the headquarters rule has nothing to ` +
          `seat a unit at. Every census district belongs to a division; ICT's is the pseudo-` +
          `division the roster injects so the hierarchy is total (#3).`,
      );
    }
    if (!input.development.has(district)) {
      problems.push(
        `${named(district)} has no development index, so the centre test cannot be applied to ` +
          `it. A missing score is not a score of zero — read as zero it would silently ` +
          `disqualify a headquarters and move a boundary, which is the one failure here that ` +
          `looks exactly like a working answer.`,
      );
    }
    if (!input.centroids.has(district)) {
      problems.push(`${named(district)} has no centroid, so its distance to a centre is unknown.`);
    }
    if (!input.provinces.has(district)) {
      problems.push(
        `${district} is in no province, and the province is the frame this rule is drawn inside. ` +
          `A district with no province could not be partitioned without crossing the boundary ` +
          `the rule exists to respect.`,
      );
    }
    const population = input.populations.get(district) ?? 0;
    if (population > rule.ceiling) {
      problems.push(
        `${named(district)} has ${group(population)} people on its own, above the ceiling of ` +
          `${group(rule.ceiling)}. A district is the atom here (D23) and cannot be split, so no ` +
          `partition satisfies this ceiling.`,
      );
    }
  }

  return problems;
}

/**
 * Draw the partition the rule states.
 *
 * There is no search here and nothing to tune: the province set is given, the centres follow from
 * the divisions and the index, and the growth is deterministic, so the rule has exactly one
 * output. The number of units is whatever the two limits cost — which is why the statement says
 * the count is a finding, and why the engine cannot be asked for a different one.
 */
export function partitionByRule(rule: PartitionRule, input: PartitionInput): Generation {
  const problems = [...inputProblems(rule, input)];
  if (problems.length > 0) return { partition: null, problems };

  const seats = divisionalHeadquarters(
    input.scope,
    input.divisions,
    input.provinces,
    input.populations,
  );

  const byProvince = new Map<string, string[]>();
  for (const district of [...input.scope].sort((a, b) => a.localeCompare(b))) {
    const province = input.provinces.get(district) as string;
    const found = byProvince.get(province);
    if (found === undefined) byProvince.set(province, [district]);
    else found.push(district);
  }

  const units: GeneratedUnit[] = [];
  for (const [province, districts] of [...byProvince].sort(([a], [b]) => a.localeCompare(b))) {
    units.push(...partitionProvince(province, districts, rule, input, seats));
  }

  const placed = new Set(units.flatMap((unit) => unit.districts));
  const unplaced = input.scope.filter((district) => !placed.has(district)).sort((a, b) => a.localeCompare(b));
  if (unplaced.length > 0) {
    problems.push(
      `${unplaced.map(named).join(', ')} ended in no unit. Every district seeds a unit of its own ` +
        `rather than being left out, so a district with nowhere to go means the province grouping ` +
        `and the scope disagree.`,
    );
  }

  // Contiguity is guaranteed by growing across borders and is checked anyway: a guarantee nothing
  // looks at is a comment, and the one thing this engine must never do quietly is hand a variant a
  // province in two pieces.
  for (const unit of units) {
    const contiguity = contiguityOf(input.neighbours, unit.districts);
    if (contiguity.contiguous) continue;
    problems.push(
      `${unit.name} came out in ${contiguity.pieces} pieces — ` +
        contiguity.detached.map((piece) => piece.join(', ')).join('; ') +
        ` touch none of it. A unit is grown outward from its centre across shared borders and ` +
        `cannot be in two pieces, so the graph and the growth disagree.`,
    );
  }
  if (problems.length > 0) return { partition: null, problems };

  const ordered = [...units].sort(
    (a, b) => b.population - a.population || a.centre.localeCompare(b.centre),
  );
  const [head, ...rest] = ordered;
  if (head === undefined) {
    return { partition: null, problems: ['the rule placed every district in no unit at all.'] };
  }
  return {
    partition: {
      rule,
      statement: statementFor(rule, ordered.length, byProvince.size),
      units: [head, ...rest],
    },
    problems: [],
  };
}

/**
 * The generated units as the scenario schema wants them, so a variant is written and not a loop.
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
