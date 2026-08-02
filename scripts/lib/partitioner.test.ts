/**
 * The rule engine (#27), held against the map that ships.
 *
 * Everything here that can be asked of the real country is asked of the real country: the 136
 * census districts, the committed adjacency graph, the committed census and the committed
 * geometry's own centroids. No fixture, because a partitioner that works on a toy graph and
 * strands Gwadar is a partitioner that does not work, and because the properties worth holding —
 * complete, contiguous, deterministic, valid — are properties of the artifact rather than of the
 * algorithm.
 *
 * Three things the shipped map cannot demonstrate are held on five hand-made districts instead:
 * what the engine does when the districts it is given are not all connected, when a ceiling is
 * below a district that cannot be split, and when a scope reaches into ground the census never
 * covered. All three are refusals, and a refusal names the district.
 */

import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoCentroid } from 'd3';
import { feature } from 'topojson-client';
import { describe, expect, it } from 'vitest';
import { contiguityOf, type AdjacencyGraph } from './adjacency.ts';
import {
  capitalsByDistance,
  capitalsByPopulation,
  haversineKm,
  partitionByRule,
  proposedUnits,
  type Centroid,
  type GeneratedPartition,
  type PartitionInput,
  type PartitionRule,
} from './partitioner.ts';
import { CENSUS_DISTRICTS, ROSTER } from './roster.ts';
import {
  intactProvince,
  validateVariant,
  type NonEmpty,
  type Unit,
  type Variant,
} from './scenarios.ts';
import { scorecardOf, type ScorecardUnit } from './scorecard.ts';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const read = (path: string): unknown => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));

const adjacency = read('data/bundle/adjacency.json') as {
  neighbours: Record<string, string[]>;
};
const statistics = read('data/bundle/statistics.json') as {
  districts: Record<string, { population: number }>;
};
const geography = read('data/bundle/geography.topojson.json') as {
  objects: Record<string, unknown>;
};

const NEIGHBOURS: AdjacencyGraph = new Map(Object.entries(adjacency.neighbours));
const POPULATIONS: ReadonlyMap<string, number> = new Map(
  Object.entries(statistics.districts).map(([district, row]) => [district, row.population]),
);

const districtFeatures = (
  feature(geography as never, geography.objects['districts'] as never) as unknown as {
    features: { properties: Record<string, string>; geometry: unknown }[];
  }
).features;

/** Centroids from the geometry that ships, so the distance rule is measured on the drawn map. */
const CENTROIDS: ReadonlyMap<string, Centroid> = new Map(
  districtFeatures.map((f) => [
    f.properties['name'] as string,
    geoCentroid(f as never) as unknown as Centroid,
  ]),
);

/** PBS Table 1's national figure, typed rather than read back off the artifact. */
const PAKISTAN = 241_499_431;

const CENSUS_INPUT: PartitionInput = {
  scope: CENSUS_DISTRICTS,
  neighbours: NEIGHBOURS,
  populations: POPULATIONS,
  centroids: CENTROIDS,
};

/** A generated partition, or a failure that names what went wrong rather than `undefined`. */
const generate = (rule: PartitionRule, input: PartitionInput = CENSUS_INPUT): GeneratedPartition => {
  const { partition, problems } = partitionByRule(rule, input);
  expect(problems).toEqual([]);
  if (partition === null) throw new Error('no partition');
  return partition;
};

const allDistricts = (partition: GeneratedPartition): string[] =>
  partition.units.flatMap((unit) => [...unit.districts]);

describe('a rule partitions the country', () => {
  it('gives every census district to exactly one unit, and every unit a capital of its own', () => {
    const partition = generate({ kind: 'unit-count', units: 13 });
    const placed = allDistricts(partition);

    const missing = CENSUS_DISTRICTS.filter((d) => !placed.includes(d));
    expect(missing).toEqual([]);
    const twice = placed.filter((d, i) => placed.indexOf(d) !== i);
    expect(twice).toEqual([]);
    expect(placed).toHaveLength(CENSUS_DISTRICTS.length);

    expect(partition.units).toHaveLength(13);
    for (const unit of partition.units) {
      expect(unit.districts, unit.name).toContain(unit.capital);
      expect(unit.id, unit.name).not.toBe('');
    }
    expect(new Set(partition.units.map((u) => u.id)).size).toBe(13);
  });

  it('never reaches a district the census does not cover, so no unit is short by an unknown amount', () => {
    // The other half of the same rule: the twenty AJK and GB districts are not in the scope, and
    // the engine refuses them if they ever are. Named here because the failure to catch would be
    // a province drawn across a ceasefire line with a population nobody can source.
    const partition = generate({ kind: 'unit-count', units: 13 });
    const territory = ROSTER.filter((p) => p.kind === 'territory').flatMap((p) => p.districts);
    const reached = allDistricts(partition).filter((d) => territory.includes(d));
    expect(reached).toEqual([]);
  });

  it('sums each unit out of its own census rows, and the whole partition out of Table 1', () => {
    const partition = generate({ kind: 'unit-count', units: 13 });
    const wrong = partition.units
      .filter(
        (unit) =>
          unit.population !== unit.districts.reduce((n, d) => n + (POPULATIONS.get(d) ?? 0), 0),
      )
      .map((unit) => unit.name);
    expect(wrong).toEqual([]);
    expect(partition.units.reduce((n, unit) => n + unit.population, 0)).toBe(PAKISTAN);
  });

  it('grows every unit into one piece, checked against the graph the map is drawn from', () => {
    for (const rule of [
      { kind: 'unit-count', units: 13 },
      { kind: 'population-ceiling', ceiling: 25_000_000 },
      { kind: 'distance-to-capital', km: 300 },
    ] as const) {
      const partition = generate(rule);
      const broken = partition.units
        .filter((unit) => !contiguityOf(NEIGHBOURS, unit.districts).contiguous)
        .map((unit) => `${rule.kind}: ${unit.name}`);
      expect(broken).toEqual([]);
    }
  });
});

describe('the rule is recorded, in the words a card can print', () => {
  it('states the ceiling, and states the unit count as the finding it is', () => {
    const partition = generate({ kind: 'population-ceiling', ceiling: 25_000_000 });
    expect(partition.statement).toContain('No unit above 25,000,000 people');
    expect(partition.statement).toContain(`${partition.units.length} units is the fewest`);
    expect(partition.statement).toContain('PBS 2023 census');
    // The rule itself travels with the partition, so #28 need not restate it in prose that can
    // drift away from the arithmetic it describes.
    expect(partition.rule).toEqual({ kind: 'population-ceiling', ceiling: 25_000_000 });
  });

  it('says where the capitals came from, because that is the one choice the engine makes', () => {
    expect(generate({ kind: 'unit-count', units: 12 }).statement).toContain(
      'no two of them sharing a border',
    );
    expect(generate({ kind: 'distance-to-capital', km: 300 }).statement).toContain(
      'as far as possible from the capitals already chosen',
    );
  });
});

describe('the same rule always draws the same map', () => {
  const shuffle = <T>(items: readonly T[]): readonly T[] => {
    // A fixed, reproducible reordering rather than a random one: a test that shuffles differently
    // on every run reports a determinism failure that nobody can reproduce.
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = (i * 7919 + 13) % (i + 1);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  };

  const RULES: readonly PartitionRule[] = [
    { kind: 'unit-count', units: 13 },
    { kind: 'population-ceiling', ceiling: 25_000_000 },
    { kind: 'distance-to-capital', km: 300 },
  ];

  it('draws the identical partition twice', () => {
    for (const rule of RULES) {
      expect(JSON.stringify(generate(rule)), rule.kind).toBe(JSON.stringify(generate(rule)));
    }
  });

  it('draws the identical partition from inputs handed over in a different order', () => {
    // The determinism that matters is not that the function is not random — it is that nothing
    // about the *caller* can move a boundary. So the scope is reordered and every map is rebuilt
    // with its keys inserted the other way round, which is what changes iteration order in JS.
    const reorder = <V>(map: ReadonlyMap<string, V>): ReadonlyMap<string, V> =>
      new Map([...map].reverse());
    const shuffled: PartitionInput = {
      scope: shuffle(CENSUS_DISTRICTS),
      neighbours: new Map(
        [...NEIGHBOURS].reverse().map(([d, found]) => [d, [...found].reverse()]),
      ),
      populations: reorder(POPULATIONS),
      centroids: reorder(CENTROIDS),
    };
    expect(shuffled.scope).not.toEqual(CENSUS_DISTRICTS);

    for (const rule of RULES) {
      expect(JSON.stringify(generate(rule, shuffled)), rule.kind).toBe(
        JSON.stringify(generate(rule)),
      );
    }
  });
});

describe('a population ceiling', () => {
  const CEILING = 25_000_000;
  const partition = generate({ kind: 'population-ceiling', ceiling: CEILING });

  it('holds on every unit, named where it does not', () => {
    const over = partition.units
      .filter((unit) => unit.population > CEILING)
      .map((unit) => `${unit.name} at ${unit.population}`);
    expect(over).toEqual([]);
  });

  it('uses no more units than it has to — the arithmetic lower bound, not our own answer', () => {
    // Checked against a bound that exists whatever this engine does: 241,499,431 people under a
    // 25,000,000 ceiling need at least ten units however they are drawn. The engine counts upward
    // from that bound and stops at the first count that works, so this is the floor its answer
    // sits on rather than a restatement of it.
    expect(partition.units.length).toBeGreaterThanOrEqual(Math.ceil(PAKISTAN / CEILING));
  });

  it('is a different map at a different ceiling, and a tighter one needs more units', () => {
    const tighter = generate({ kind: 'population-ceiling', ceiling: 15_000_000 });
    expect(tighter.units.length).toBeGreaterThan(partition.units.length);
    for (const unit of tighter.units) expect(unit.population, unit.name).toBeLessThanOrEqual(15_000_000);
  });
});

describe('a distance limit to the capital', () => {
  const KM = 300;
  const partition = generate({ kind: 'distance-to-capital', km: KM });

  it('holds for every district, measured again from the committed geometry', () => {
    const far = partition.units.flatMap((unit) =>
      unit.districts
        .map((district) => ({
          district,
          km: haversineKm(
            CENTROIDS.get(unit.capital) as Centroid,
            CENTROIDS.get(district) as Centroid,
          ),
        }))
        .filter((found) => found.km > KM)
        .map((found) => `${found.district} is ${Math.round(found.km)} km from ${unit.capital}`),
    );
    expect(far).toEqual([]);
  });

  it('seats capitals in the places population would never seat one', () => {
    // The whole reason the rule exists. Population-ranked capitals are Punjab's largest cities;
    // a distance rule has to reach Balochistan's west, and the two seedings are named apart in
    // the module because they answer different questions.
    const byDistance = capitalsByDistance(CENSUS_DISTRICTS, CENTROIDS, POPULATIONS, 10);
    const byPopulation = capitalsByPopulation(CENSUS_DISTRICTS, NEIGHBOURS, POPULATIONS, 10);
    expect(byDistance).toContain('Chagai');
    expect(byPopulation).not.toContain('Chagai');
    expect(byPopulation[0]).toBe('Lahore');
    expect(byDistance[0]).toBe('Lahore');
  });

  it('measures a distance anyone can check on an atlas', () => {
    const km = haversineKm(
      CENTROIDS.get('Karachi South') as Centroid,
      CENTROIDS.get('Lahore') as Centroid,
    );
    // Karachi to Lahore is about 1,020 km great-circle. Centroid to centroid, so the tolerance is
    // the width of a district and not a rounding.
    expect(km).toBeGreaterThan(950);
    expect(km).toBeLessThan(1_100);
    expect(haversineKm([0, 0], [0, 0])).toBe(0);
  });
});

describe('capitals', () => {
  it('are the most populous districts, and no two of them share a border', () => {
    const capitals = capitalsByPopulation(CENSUS_DISTRICTS, NEIGHBOURS, POPULATIONS, 13);
    expect(capitals).toHaveLength(13);
    expect(capitals[0]).toBe('Lahore');
    const touching = capitals.flatMap((capital) =>
      (NEIGHBOURS.get(capital) ?? [])
        .filter((other) => capitals.includes(other))
        .map((other) => `${capital} borders ${other}`),
    );
    expect(touching).toEqual([]);
  });

  it('relax the border rule rather than fail, once the map has no room for another', () => {
    // Asking for one capital per district is asking for the constraint to be impossible. The
    // engine gives them all rather than refusing, because the alternative is a rule that fails
    // on a preference — and the escalating search for a ceiling depends on being able to get
    // there.
    const capitals = capitalsByPopulation(
      CENSUS_DISTRICTS,
      NEIGHBOURS,
      POPULATIONS,
      CENSUS_DISTRICTS.length,
    );
    expect(new Set(capitals).size).toBe(CENSUS_DISTRICTS.length);
    expect(capitals[0]).toBe('Lahore');
  });
});

// ---------------------------------------------------------------------------------------------
// What a generated partition becomes
// ---------------------------------------------------------------------------------------------

const variantAround = (units: NonEmpty<Unit>, universe: 'census' | 'drawn'): Variant => ({
  id: 'a0',
  basis: 'administrative',
  name: 'A test of the rule engine',
  rationale: 'Generated by rule, to check that what the engine emits is a variant.',
  status: 'Not a proposal — a fixture for the engine test.',
  advocacy: { kind: 'unadvocated', note: 'Nobody proposes the output of a rule.' },
  opposedBy: ['Nobody, because this is not published.'],
  universe,
  composition: { kind: 'derived', rule: 'stated in the test', from: 'PBS 2023 census' },
  units,
  footnotes: [],
  sources: [{ label: 'PBS 2023 Digital Census' }],
});

describe('what the engine hands to #28', () => {
  const partition = generate({ kind: 'population-ceiling', ceiling: 25_000_000 });

  it('validates as a complete partition of the census districts', () => {
    const result = validateVariant(variantAround(proposedUnits(partition), 'census'));
    expect(result.problems).toEqual([]);
    expect(result.partition?.districts).toBe(CENSUS_DISTRICTS.length);
  });

  it('validates over the drawn map once the territories are carried through as themselves', () => {
    // The composition every administrative variant will have: the census districts partitioned by
    // rule, AJK and Gilgit-Baltistan drawn and named and unchanged. It passes with
    // `TERRITORY_CLAIM_POLICY` at `forbid`, which is the point — no generated unit reaches into
    // ground PBS never counted (open item 2b).
    const units = [
      ...proposedUnits(partition),
      intactProvince('Azad Jammu & Kashmir'),
      intactProvince('Gilgit-Baltistan'),
    ] as unknown as NonEmpty<Unit>;
    const result = validateVariant(variantAround(units, 'drawn'));
    expect(result.problems).toEqual([]);
    expect(result.partition?.units.filter((u) => u.kind === 'territory')).toHaveLength(2);
  });

  it('scores on the scorecard with no absence to declare', () => {
    // Consistency with #20 rather than a second answer to it: every generated unit is wholly
    // inside the census, so there is a spread and nothing set aside — which is exactly what a
    // partition of the 136 should produce.
    const units: ScorecardUnit[] = partition.units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      kind: 'proposed',
      districts: unit.districts,
    }));
    const origins = new Map(
      ROSTER.flatMap((province) => province.districts.map((d) => [d, province.name] as const)),
    );
    const scorecard = scorecardOf(units, {
      populations: POPULATIONS,
      origins,
      modernFigures: { modernFigures: true },
    });
    expect(scorecard.populationWithheld).toBeNull();
    expect(scorecard.outsideTheCensus).toEqual([]);
    expect(scorecard.population?.total).toBe(PAKISTAN);
    expect(scorecard.population?.units).toBe(partition.units.length);
  });
});

// ---------------------------------------------------------------------------------------------
// What the engine refuses, and how it says so
// ---------------------------------------------------------------------------------------------

/**
 * Five districts in a line, plus one across the water, plus one the census never counted. Small
 * enough that every refusal below can be read off the table rather than off the code.
 *
 *   Alpha — Bravo — Charlie — Delta        Echo (touches nothing)        Far (no census row)
 */
const TOY: AdjacencyGraph = new Map([
  ['Alpha', ['Bravo']],
  ['Bravo', ['Alpha', 'Charlie']],
  ['Charlie', ['Bravo', 'Delta']],
  ['Delta', ['Charlie']],
  ['Echo', []],
  ['Far', []],
]);
const TOY_POPULATIONS = new Map([
  ['Alpha', 1_000_000],
  ['Bravo', 2_000_000],
  ['Charlie', 4_000_000],
  ['Delta', 8_000_000],
  ['Echo', 500_000],
]);
const toy = (scope: readonly string[]): PartitionInput => ({
  scope,
  neighbours: TOY,
  populations: TOY_POPULATIONS,
});

describe('what the engine refuses', () => {
  it('names a district the census does not reach rather than counting it as nobody', () => {
    const { partition, problems } = partitionByRule(
      { kind: 'unit-count', units: 2 },
      toy(['Alpha', 'Bravo', 'Far']),
    );
    expect(partition).toBeNull();
    expect(problems.join('\n')).toContain('Far has no 2023 census population');
    expect(problems.join('\n')).toContain('not a district with a figure of zero');
  });

  it('names every AJK and GB district when a real scope reaches into the territories', () => {
    // The live version of the same refusal, over the map that ships: all twenty are named, not
    // counted, so a maintainer reads which ground the rule cannot see off the failure itself.
    const { partition, problems } = partitionByRule(
      { kind: 'population-ceiling', ceiling: 25_000_000 },
      { ...CENSUS_INPUT, scope: ROSTER.flatMap((p) => p.districts) },
    );
    expect(partition).toBeNull();
    const named = problems.filter((p) => p.includes('has no 2023 census population'));
    expect(named).toHaveLength(20);
    expect(problems.join('\n')).toContain('Neelum (Azad Jammu & Kashmir)');
    expect(problems.join('\n')).toContain('Skardu (Gilgit-Baltistan)');
  });

  it('names the district a ceiling is below, because a district cannot be split', () => {
    const { partition, problems } = partitionByRule(
      { kind: 'population-ceiling', ceiling: 5_000_000 },
      toy(['Alpha', 'Bravo', 'Charlie', 'Delta']),
    );
    expect(partition).toBeNull();
    expect(problems.join('\n')).toContain('Delta has 8,000,000 people on its own');
    expect(problems.join('\n')).toContain('above the ceiling of 5,000,000');
  });

  it('names the same district over the real map, where it is Lahore', () => {
    const { partition, problems } = partitionByRule(
      { kind: 'population-ceiling', ceiling: 10_000_000 },
      CENSUS_INPUT,
    );
    expect(partition).toBeNull();
    expect(problems.join('\n')).toContain('Lahore (Punjab) has 13,004,135 people on its own');
  });

  it('names the districts a stated unit count cannot reach, rather than dropping them', () => {
    // Echo touches nothing. One unit cannot grow into it, and the engine says which district was
    // left out instead of emitting a partition with a hole where it is.
    const { partition, problems } = partitionByRule(
      { kind: 'unit-count', units: 1 },
      toy(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']),
    );
    expect(partition).toBeNull();
    expect(problems.join('\n')).toContain('leave Echo in no unit');
  });

  it('reaches the stranded district as soon as the count allows a capital in it', () => {
    // Echo is not unreachable in principle — it is unreachable by growth, so it needs a capital
    // of its own, and the count is what decides whether there is one to spare. Four is where the
    // engine has one for it, and the district that touches nothing draws as a unit of one.
    const partition = generate(
      { kind: 'unit-count', units: 4 },
      toy(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']),
    );
    const echo = partition.units.find((unit) => unit.districts.includes('Echo'));
    expect(echo?.capital).toBe('Echo');
    expect(echo?.districts).toEqual(['Echo']);
  });

  it('refuses a count that is not a count, and one there are not districts for', () => {
    expect(
      partitionByRule({ kind: 'unit-count', units: 0 }, toy(['Alpha', 'Bravo'])).problems.join(),
    ).toContain('is not a number of units');
    expect(
      partitionByRule({ kind: 'unit-count', units: 5 }, toy(['Alpha', 'Bravo'])).problems.join(),
    ).toContain('out of 2 districts');
  });

  it('refuses a distance rule with nothing to measure with, and names the district', () => {
    expect(
      partitionByRule({ kind: 'distance-to-capital', km: 300 }, toy(['Alpha', 'Bravo']))
        .problems.join(),
    ).toContain('no district centroids');
    const { problems } = partitionByRule(
      { kind: 'distance-to-capital', km: 300 },
      { ...toy(['Alpha', 'Bravo']), centroids: new Map([['Alpha', [0, 0] as Centroid]]) },
    );
    expect(problems.join()).toContain('Bravo has no centroid');
  });

  it('names a district it was handed twice, and one the map does not draw', () => {
    expect(
      partitionByRule({ kind: 'unit-count', units: 1 }, toy(['Alpha', 'Alpha'])).problems.join(),
    ).toContain('Alpha appears twice');
    expect(
      partitionByRule({ kind: 'unit-count', units: 1 }, toy(['Alpha', 'Nowhere'])).problems.join(),
    ).toContain('Nowhere is in the scope but not in the adjacency graph');
  });
});

describe('the engine is build-time only', () => {
  it('is not reachable from the renderer', () => {
    // Acceptance criterion, and the kind of thing that is true until somebody imports it for a
    // "quick preview". The engine reads a census and searches; none of it belongs in a page whose
    // whole design is that every figure was baked and reviewed (D19).
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(dir, entry.name);
        return entry.isDirectory() ? walk(path) : entry.name.endsWith('.ts') ? [path] : [];
      });
    const offenders = walk(resolve(ROOT, 'src'))
      .filter((file) => /partitioner/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});
