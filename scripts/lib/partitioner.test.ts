/**
 * The rule engine (#27), held against the map that ships.
 *
 * Everything here that can be asked of the real country is asked of the real country: the 136
 * census districts, the committed adjacency graph, the committed census, the committed composite
 * and the committed geometry's own centroids. No fixture, because a partitioner that works on a
 * toy graph and strands Gwadar is a partitioner that does not work, and because the properties
 * worth holding — complete, contiguous, inside one province, deterministic, valid — are properties
 * of the artifact rather than of the algorithm.
 *
 * What the shipped map cannot demonstrate is held on seven hand-made districts instead: what the
 * engine does when a ceiling is below a district that cannot be split, when a scope reaches into
 * ground the census never covered, when a district is filed under no division, and when the
 * headquarters test seats nothing. All of those are refusals but the last, and a refusal names the
 * district.
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
  divisionalHeadquarters,
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
  districts: Record<string, { population: number; areaSqKm: number; division: string; province: string }>;
};
const developmentIndex = read('data/bundle/development-index.json') as {
  districts: Record<string, { score: number }>;
};
const geography = read('data/bundle/geography.topojson.json') as {
  objects: Record<string, unknown>;
};

const NEIGHBOURS: AdjacencyGraph = new Map(Object.entries(adjacency.neighbours));
const POPULATIONS: ReadonlyMap<string, number> = new Map(
  Object.entries(statistics.districts).map(([district, row]) => [district, row.population]),
);
const AREAS: ReadonlyMap<string, number> = new Map(
  Object.entries(statistics.districts).map(([district, row]) => [district, row.areaSqKm]),
);
const DIVISIONS: ReadonlyMap<string, string> = new Map(
  Object.entries(statistics.districts).map(([district, row]) => [district, row.division]),
);
const PROVINCES: ReadonlyMap<string, string> = new Map(
  ROSTER.flatMap((province) => province.districts.map((d) => [d, province.name] as const)),
);
const DEVELOPMENT: ReadonlyMap<string, number> = new Map(
  Object.entries(developmentIndex.districts).map(([district, row]) => [district, row.score]),
);

const districtFeatures = (
  feature(geography as never, geography.objects['districts'] as never) as unknown as {
    features: { properties: Record<string, string>; geometry: unknown }[];
  }
).features;

/** Centroids from the geometry that ships, so the distance limit is measured on the drawn map. */
const CENTROIDS: ReadonlyMap<string, Centroid> = new Map(
  districtFeatures.map((f) => [
    f.properties['name'] as string,
    geoCentroid(f as never) as unknown as Centroid,
  ]),
);

/** PBS Table 1's national figure, typed rather than read back off the artifact. */
const PAKISTAN = 241_499_431;

/** The rule the Administrative basis actually ships, stated here as the variant states it. */
const RULE: PartitionRule = {
  kind: 'within-province-centres',
  ceiling: 25_000_000,
  km: 300,
  developmentFloor: 0.5,
};

const CENSUS_INPUT: PartitionInput = {
  scope: CENSUS_DISTRICTS,
  neighbours: NEIGHBOURS,
  populations: POPULATIONS,
  provinces: PROVINCES,
  divisions: DIVISIONS,
  development: DEVELOPMENT,
  centroids: CENTROIDS,
};

/** A generated partition, or a failure that names what went wrong rather than `undefined`. */
const generate = (rule: PartitionRule = RULE, input: PartitionInput = CENSUS_INPUT): GeneratedPartition => {
  const { partition, problems } = partitionByRule(rule, input);
  expect(problems).toEqual([]);
  if (partition === null) throw new Error('no partition');
  return partition;
};

const allDistricts = (partition: GeneratedPartition): string[] =>
  partition.units.flatMap((unit) => [...unit.districts]);

describe('a rule partitions the country', () => {
  const partition = generate();

  it('gives every census district to exactly one unit, and every unit a centre of its own', () => {
    const placed = allDistricts(partition);

    const missing = CENSUS_DISTRICTS.filter((d) => !placed.includes(d));
    expect(missing).toEqual([]);
    const twice = placed.filter((d, i) => placed.indexOf(d) !== i);
    expect(twice).toEqual([]);
    expect(placed).toHaveLength(CENSUS_DISTRICTS.length);

    for (const unit of partition.units) {
      expect(unit.districts, unit.name).toContain(unit.centre);
      expect(unit.id, unit.name).not.toBe('');
    }
    expect(new Set(partition.units.map((u) => u.id)).size).toBe(partition.units.length);
  });

  it('never reaches a district the census does not cover, so no unit is short by an unknown amount', () => {
    // The twenty AJK and GB districts are not in the scope, and the engine refuses them if they
    // ever are. Named here because the failure to catch would be a province drawn across a
    // ceasefire line with a population nobody can source.
    const territory = ROSTER.filter((p) => p.kind === 'territory').flatMap((p) => p.districts);
    const reached = allDistricts(partition).filter((d) => territory.includes(d));
    expect(reached).toEqual([]);
  });

  it('sums each unit out of its own census rows, and the whole partition out of Table 1', () => {
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
    const broken = partition.units
      .filter((unit) => !contiguityOf(NEIGHBOURS, unit.districts).contiguous)
      .map((unit) => unit.name);
    expect(broken).toEqual([]);
  });
});

describe('the province is the frame', () => {
  const partition = generate();

  it('leaves no unit holding districts from two provinces, which is the whole change', () => {
    // The property this rule exists for, asserted district by district rather than on the unit's
    // own `province` field — which the engine wrote and could be wrong in the same way twice.
    const crossing = partition.units
      .map((unit) => ({
        unit: unit.name,
        provinces: [...new Set(unit.districts.map((d) => PROVINCES.get(d)))].sort(),
      }))
      .filter((found) => found.provinces.length > 1)
      .map((found) => `${found.unit} spans ${found.provinces.join(' and ')}`);
    expect(crossing).toEqual([]);
  });

  it('partitions every province, and leaves each one whole between its units', () => {
    // A frame that dropped a province would be a partition with a hole in it that every other
    // check here would still pass, because the districts left out would simply not be asked about.
    const byProvince = new Map<string, string[]>();
    for (const unit of partition.units) {
      for (const district of unit.districts) {
        const province = PROVINCES.get(district) as string;
        byProvince.set(province, [...(byProvince.get(province) ?? []), district]);
      }
    }
    for (const province of ROSTER.filter((p) => p.kind !== 'territory')) {
      expect([...(byProvince.get(province.name) ?? [])].sort(), province.name).toEqual(
        [...province.districts].sort(),
      );
    }
    expect([...byProvince.keys()].sort()).toEqual(
      ROSTER.filter((p) => p.kind !== 'territory')
        .map((p) => p.name)
        .sort(),
    );
  });

  it('makes Islamabad a unit of one, because a province of one district has nothing to divide', () => {
    const islamabad = partition.units.find((unit) => unit.districts.includes('Islamabad'));
    expect(islamabad?.districts).toEqual(['Islamabad']);
    expect(islamabad?.province).toBe('Islamabad Capital Territory');
  });
});

describe('the two limits', () => {
  const partition = generate();

  it('never carries a unit past the ceiling, which is a limit and not a target', () => {
    // The answer to the question the rule leaves open: a unit stops *below* 25 million rather
    // than taking the district that crosses it. A target would put every unit at or just above
    // the figure, and this asserts the other reading.
    const over = partition.units
      .filter((unit) => unit.population > RULE.ceiling)
      .map((unit) => `${unit.name} at ${unit.population}`);
    expect(over).toEqual([]);
  });

  it('holds the distance limit for every district, measured again from the committed geometry', () => {
    const far = partition.units.flatMap((unit) =>
      unit.districts
        .map((district) => ({
          district,
          km: haversineKm(
            CENTROIDS.get(unit.centre) as Centroid,
            CENTROIDS.get(district) as Centroid,
          ),
        }))
        .filter((found) => found.km > RULE.km)
        .map((found) => `${found.district} is ${Math.round(found.km)} km from ${unit.centre}`),
    );
    expect(far).toEqual([]);
  });

  it('is bound by the ceiling in Punjab and by the distance in Balochistan', () => {
    // The finding the card states, asserted rather than described. Punjab's units run up against
    // 25 million and Balochistan's stop a long way short of it, which is why the rule needs both
    // limits and why neither alone would draw this map.
    const inProvince = (province: string) =>
      partition.units.filter((unit) => unit.province === province);
    const largestIn = (province: string) =>
      Math.max(...inProvince(province).map((unit) => unit.population));
    expect(largestIn('Punjab')).toBeGreaterThan(0.9 * RULE.ceiling);
    expect(largestIn('Balochistan')).toBeLessThan(0.5 * RULE.ceiling);
    expect(inProvince('Balochistan').length).toBeGreaterThan(1);
  });

  it('draws a different map at a different ceiling, and a tighter one needs more units', () => {
    // 15 million and not 10: Lahore holds 13,004,135 people on its own, and a ceiling under that
    // is refused rather than drawn, which is a different property and is asserted below.
    const tighter = generate({ ...RULE, ceiling: 15_000_000 });
    expect(tighter.units.length).toBeGreaterThan(partition.units.length);
    for (const unit of tighter.units) {
      expect(unit.population, unit.name).toBeLessThanOrEqual(15_000_000);
    }
  });

  it('draws a different map at a different distance, and a shorter one needs more units', () => {
    const shorter = generate({ ...RULE, km: 150 });
    expect(shorter.units.length).toBeGreaterThan(partition.units.length);
    for (const unit of shorter.units) {
      for (const district of unit.districts) {
        expect(
          haversineKm(CENTROIDS.get(unit.centre) as Centroid, CENTROIDS.get(district) as Centroid),
          `${district} in ${unit.name}`,
        ).toBeLessThanOrEqual(150);
      }
    }
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

describe('the centres', () => {
  const partition = generate();
  const seats = divisionalHeadquarters(CENSUS_DISTRICTS, DIVISIONS, PROVINCES, POPULATIONS);

  it('seats one headquarters per division, and takes the district the division is named after', () => {
    const divisions = new Set(CENSUS_DISTRICTS.map((d) => `${PROVINCES.get(d)} ${DIVISIONS.get(d)}`));
    expect(seats.size).toBe(divisions.size);
    // The first clause, on the divisions it answers: the district carrying the division's name.
    for (const district of ['Lahore', 'Multan', 'Peshawar', 'Quetta', 'Hyderabad', 'Islamabad']) {
      expect([...seats], district).toContain(district);
    }
  });

  it('falls to the most populous district in the four divisions no district is named after', () => {
    // Hazara, Rakhshan, Mekran and Karachi. The second clause of the headquarters rule exists for
    // exactly these, and the card names all four — so if the census ever renames one, the copy and
    // the engine part company here rather than silently.
    const unnamed = [...new Set(CENSUS_DISTRICTS.map((d) => DIVISIONS.get(d) as string))].filter(
      (division) =>
        !CENSUS_DISTRICTS.some(
          (d) =>
            DIVISIONS.get(d) === division &&
            d.toLowerCase().replace(/[^a-z]/g, '') === division.toLowerCase().replace(/[^a-z]/g, ''),
        ),
    );
    expect(unnamed.sort()).toEqual(['Hazara', 'Karachi', 'Mekran', 'Rakhshan']);
    // What the second clause actually seats, which is not in every case the gazetted headquarters
    // — Hazara is administered from Abbottabad and the rule seats Mansehra, which is the larger
    // district. The card says the seat is the rule's rather than the gazette's for exactly this,
    // and the four are pinned here so a census that moved one is a failure and not a silent
    // redrawing.
    expect(
      ['Hazara', 'Karachi', 'Mekran', 'Rakhshan'].map(
        (division) =>
          `${division}: ${[...seats].find((seat) => DIVISIONS.get(seat) === division) ?? 'none'}`,
      ),
    ).toEqual(['Hazara: Mansehra', 'Karachi: Karachi East', 'Mekran: Kech', 'Rakhshan: Washuk']);
  });

  it('never seats a unit at a headquarters below the development floor', () => {
    const belowTheFloor = partition.units
      .filter((unit) => unit.centreKind === 'headquarters')
      .filter((unit) => (DEVELOPMENT.get(unit.centre) ?? 0) < RULE.developmentFloor)
      .map((unit) => `${unit.centre} scores ${DEVELOPMENT.get(unit.centre) ?? 'nothing'}`);
    expect(belowTheFloor).toEqual([]);
  });

  it('records every unit the fallback seeded, so a one-district unit is never a silent output', () => {
    // The fallback fires where a province has run out of qualifying headquarters, and the card
    // names the units it drew. Held as the actual list rather than as a count, because the copy
    // that explains them is written about these units and not about "some".
    const fallen = partition.units
      .filter((unit) => unit.centreKind === 'fallback')
      .map((unit) => unit.name)
      .sort();
    expect(fallen).toEqual(['Bhakkar', 'Chagai', 'Ghotki', 'Lasbela', 'Sherani']);
    for (const unit of partition.units) {
      if (unit.centreKind === 'headquarters') expect([...seats], unit.name).toContain(unit.centre);
    }
  });

  it('turns away four headquarters and moves no boundary, which the card says out loud', () => {
    // The finding, held as a property rather than left in prose. The floor disqualifies four of
    // the 31 divisional seats — all in Balochistan — and the map it draws is byte-identical to the
    // map with no floor at all, because every one of those divisions falls inside a unit seated
    // elsewhere before its own seat comes up. A gate that binds nothing is exactly the kind of
    // thing a rule gets credit for, so it is asserted here and stated on the card.
    const seats = divisionalHeadquarters(CENSUS_DISTRICTS, DIVISIONS, PROVINCES, POPULATIONS);
    const refused = [...seats]
      .filter((seat) => (DEVELOPMENT.get(seat) ?? 0) < RULE.developmentFloor)
      .sort();
    expect(refused).toEqual(['Kalat', 'Nasirabad', 'Washuk', 'Zhob']);
    expect(refused.map((seat) => PROVINCES.get(seat))).toEqual(Array(4).fill('Balochistan'));
    // The units and not the whole partition: the statement quotes the floor, so the two
    // statements differ by the number they are supposed to differ by, and the claim being made
    // here is about the map.
    expect(JSON.stringify(generate({ ...RULE, developmentFloor: 0 }).units)).toBe(
      JSON.stringify(partition.units),
    );
  });
});

describe('the rule is recorded, in the words a card can print', () => {
  const partition = generate();

  it('states both limits, the frame and the unit count as the finding it is', () => {
    expect(partition.statement).toContain('no unit crosses a provincial boundary');
    expect(partition.statement).toContain('No unit above 25,000,000 people');
    expect(partition.statement).toContain('no district more than 300 km');
    expect(partition.statement).toContain(`${partition.units.length} units, which is a finding`);
    expect(partition.statement).toContain('PBS 2023 census');
    // The rule itself travels with the partition, so the variant need not restate it in prose that
    // can drift away from the arithmetic it describes.
    expect(partition.rule).toEqual(RULE);
  });

  it('says the distance is a straight line, because there is no source for any other kind', () => {
    // The one place this rule could most easily overclaim. "Travel distance" would be a figure
    // with no source under every boundary on the map; the statement says what was measured.
    expect(partition.statement).toContain('in a straight line rather than along a road');
    expect(partition.statement).not.toMatch(/travel (distance|time)/);
  });

  it('says where the centres came from, because that is the one choice the engine makes', () => {
    expect(partition.statement).toContain('headquarters of a division');
    expect(partition.statement).toContain('most populous district in it');
    expect(partition.statement).toContain('50% on the development index');
    expect(partition.statement).toContain('nearest unassigned district');
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

  it('draws the identical partition twice', () => {
    expect(JSON.stringify(generate())).toBe(JSON.stringify(generate()));
  });

  it('draws the identical partition from inputs handed over in a different order', () => {
    // The determinism that matters is not that the function is not random — it is that nothing
    // about the *caller* can move a boundary. So the scope is reordered and every map is rebuilt
    // with its keys inserted the other way round, which is what changes iteration order in JS.
    const reorder = <V>(map: ReadonlyMap<string, V>): ReadonlyMap<string, V> =>
      new Map([...map].reverse());
    const shuffled: PartitionInput = {
      scope: shuffle(CENSUS_DISTRICTS),
      neighbours: new Map([...NEIGHBOURS].reverse().map(([d, found]) => [d, [...found].reverse()])),
      populations: reorder(POPULATIONS),
      provinces: reorder(PROVINCES),
      divisions: reorder(DIVISIONS),
      development: reorder(DEVELOPMENT),
      centroids: reorder(CENTROIDS),
    };
    expect(shuffled.scope).not.toEqual(CENSUS_DISTRICTS);
    expect(JSON.stringify(generate(RULE, shuffled))).toBe(JSON.stringify(generate()));
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

describe('what the engine hands to the variant', () => {
  const partition = generate();

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
      areas: AREAS,
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
 * Seven districts, small enough that every refusal below can be read off the table rather than off
 * the code. Four in a line in one province, one across the water, one the census never counted,
 * and one filed under no division.
 *
 *   Northshire:  Alpha — Bravo — Charlie — Delta        Echo (touches nothing)
 *   elsewhere:   Far (no census row)                    Undivided (no division)
 */
const TOY: AdjacencyGraph = new Map([
  ['Alpha', ['Bravo']],
  ['Bravo', ['Alpha', 'Charlie']],
  ['Charlie', ['Bravo', 'Delta']],
  ['Delta', ['Charlie']],
  ['Echo', []],
  ['Far', []],
  ['Undivided', []],
]);
const TOY_POPULATIONS = new Map([
  ['Alpha', 1_000_000],
  ['Bravo', 2_000_000],
  ['Charlie', 4_000_000],
  ['Delta', 8_000_000],
  ['Echo', 500_000],
  ['Undivided', 100_000],
]);
const TOY_PROVINCES = new Map(
  ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Far', 'Undivided'].map((d) => [d, 'Northshire']),
);
const TOY_DIVISIONS = new Map(
  ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Far'].map((d) => [d, 'Alpha']),
);
const TOY_DEVELOPMENT = new Map(
  ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Far', 'Undivided'].map((d) => [d, 0.8]),
);
const TOY_CENTROIDS = new Map<string, Centroid>(
  (['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Far', 'Undivided'] as const).map((d, i) => [
    d,
    [70 + i * 0.1, 30] as Centroid,
  ]),
);
const toy = (scope: readonly string[]): PartitionInput => ({
  scope,
  neighbours: TOY,
  populations: TOY_POPULATIONS,
  provinces: TOY_PROVINCES,
  divisions: TOY_DIVISIONS,
  development: TOY_DEVELOPMENT,
  centroids: TOY_CENTROIDS,
});

const TOY_RULE: PartitionRule = {
  kind: 'within-province-centres',
  ceiling: 25_000_000,
  km: 300,
  developmentFloor: 0.5,
};

describe('what the engine refuses', () => {
  it('names a district the census does not reach rather than counting it as nobody', () => {
    const { partition, problems } = partitionByRule(TOY_RULE, toy(['Alpha', 'Bravo', 'Far']));
    expect(partition).toBeNull();
    expect(problems.join('\n')).toContain('Far has no 2023 census population');
    expect(problems.join('\n')).toContain('not a district with a figure of zero');
  });

  it('names every AJK and GB district when a real scope reaches into the territories', () => {
    // The live version of the same refusal, over the map that ships: all twenty are named, not
    // counted, so a maintainer reads which ground the rule cannot see off the failure itself.
    const { partition, problems } = partitionByRule(RULE, {
      ...CENSUS_INPUT,
      scope: ROSTER.flatMap((p) => p.districts),
    });
    expect(partition).toBeNull();
    const named = problems.filter((p) => p.includes('has no 2023 census population'));
    expect(named).toHaveLength(20);
    expect(problems.join('\n')).toContain('Neelum (Azad Jammu & Kashmir)');
    expect(problems.join('\n')).toContain('Skardu (Gilgit-Baltistan)');
  });

  it('names a district the development composite does not reach, for the sharper reason', () => {
    // A missing population fails loudly wherever it is used; a missing score would not — it would
    // read as zero, quietly disqualify a headquarters and move a boundary. So it is refused by
    // name too, and the failure says which failure mode it is guarding.
    const { partition, problems } = partitionByRule(TOY_RULE, {
      ...toy(['Alpha', 'Bravo']),
      development: new Map([['Alpha', 0.8]]),
    });
    expect(partition).toBeNull();
    expect(problems.join('\n')).toContain('Bravo has no development index');
    expect(problems.join('\n')).toContain('not a score of zero');
  });

  it('names a district filed under no division, since there is nothing to be the seat of', () => {
    const { partition, problems } = partitionByRule(TOY_RULE, toy(['Alpha', 'Undivided']));
    expect(partition).toBeNull();
    expect(problems.join('\n')).toContain('Undivided is filed under no division');
  });

  it('names a district in no province, because the province is the frame', () => {
    const { partition, problems } = partitionByRule(TOY_RULE, {
      ...toy(['Alpha', 'Bravo']),
      provinces: new Map([['Alpha', 'Northshire']]),
    });
    expect(partition).toBeNull();
    expect(problems.join('\n')).toContain('Bravo is in no province');
    expect(problems.join('\n')).toContain('the frame this rule is drawn inside');
  });

  it('names the district a ceiling is below, because a district cannot be split', () => {
    const { partition, problems } = partitionByRule(
      { ...TOY_RULE, ceiling: 5_000_000 },
      toy(['Alpha', 'Bravo', 'Charlie', 'Delta']),
    );
    expect(partition).toBeNull();
    expect(problems.join('\n')).toContain('Delta has 8,000,000 people on its own');
    expect(problems.join('\n')).toContain('above the ceiling of 5,000,000');
  });

  it('names the same district over the real map, where it is Lahore', () => {
    const { partition, problems } = partitionByRule({ ...RULE, ceiling: 10_000_000 }, CENSUS_INPUT);
    expect(partition).toBeNull();
    expect(problems.join('\n')).toContain('Lahore (Punjab) has 13,004,135 people on its own');
  });

  it('refuses a limit that admits nothing, and a floor that is not a proportion', () => {
    expect(partitionByRule({ ...TOY_RULE, ceiling: 0 }, toy(['Alpha'])).problems.join()).toContain(
      'admits no district at all',
    );
    expect(partitionByRule({ ...TOY_RULE, km: 0 }, toy(['Alpha'])).problems.join()).toContain(
      'leaves every district outside its own centre',
    );
    expect(
      partitionByRule({ ...TOY_RULE, developmentFloor: 50 }, toy(['Alpha'])).problems.join(),
    ).toContain('is not a proportion');
  });

  it('names a district it was handed twice, and one the map does not draw', () => {
    expect(partitionByRule(TOY_RULE, toy(['Alpha', 'Alpha'])).problems.join()).toContain(
      'Alpha appears twice',
    );
    expect(
      partitionByRule(TOY_RULE, {
        ...toy(['Alpha', 'Nowhere']),
        populations: new Map([...TOY_POPULATIONS, ['Nowhere', 1]]),
        divisions: new Map([...TOY_DIVISIONS, ['Nowhere', 'Alpha']]),
        development: new Map([...TOY_DEVELOPMENT, ['Nowhere', 0.8]]),
        centroids: new Map([...TOY_CENTROIDS, ['Nowhere', [70, 30] as Centroid]]),
      }).problems.join(),
    ).toContain('Nowhere is in the scope but not in the adjacency graph');
  });

  it('seeds a stranded district rather than leaving it in no unit', () => {
    // Echo touches nothing, so nothing can grow into it. The rule does not refuse: it seeds a unit
    // there, because a partition with a hole in it is not a partition (D6) — and the unit is
    // recorded as the fallback's, since Echo is not its division's seat.
    const partition = generate(TOY_RULE, toy(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']));
    const echo = partition.units.find((unit) => unit.districts.includes('Echo'));
    expect(echo?.centre).toBe('Echo');
    expect(echo?.districts).toEqual(['Echo']);
    expect(echo?.centreKind).toBe('fallback');
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
