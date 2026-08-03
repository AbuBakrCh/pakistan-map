/**
 * What the development-band rule does at its own seam (#31) — the cases the real map cannot show,
 * and the ones it can show only once.
 *
 * The shipped map is re-derived in `bundle.test.ts`, district by district, against what was baked.
 * What is here is the behaviour that has no example in Pakistan, or that Pakistan shows once and
 * would stop showing if the census moved: a band that comes out in two separate groups, a province
 * boundary the rule refuses to cross, a district the census does not reach, and the determinism
 * claim — the same map from a shuffled scope, which is the only reason a `derived` badge is honest.
 */

import { describe, expect, it } from 'vitest';
import type { AdjacencyGraph } from './adjacency.ts';
import { BAND_RULE, groupByDevelopmentBand, type BandLabel } from './development-partition.ts';

/** A line of six districts, A–F, each bordering only its neighbours. */
const line: AdjacencyGraph = new Map([
  ['A', ['B']],
  ['B', ['A', 'C']],
  ['C', ['B', 'D']],
  ['D', ['C', 'E']],
  ['E', ['D', 'F']],
  ['F', ['E']],
]);

/** The shading's four, as the caller hands them over: lowest first, and the legend's own words. */
const bands: readonly BandLabel[] = [
  { id: 'under-50', label: 'Under 50%' },
  { id: '50-65', label: '50% to 65%' },
  { id: '65-80', label: '65% to 80%' },
  { id: '80-plus', label: '80% and above' },
];

const scores = new Map([
  ['A', 0.2],
  ['B', 0.22],
  ['C', 0.24],
  ['D', 0.82],
  ['E', 0.84],
  ['F', 0.86],
]);

/** A, B, C in the lowest band; D, E, F in the highest. Handed in rather than recomputed here. */
const districtBands = new Map([
  ['A', 'under-50'],
  ['B', 'under-50'],
  ['C', 'under-50'],
  ['D', '80-plus'],
  ['E', '80-plus'],
  ['F', '80-plus'],
]);

const populations = new Map([
  ['A', 100],
  ['B', 300],
  ['C', 200],
  ['D', 500],
  ['E', 900],
  ['F', 400],
]);

const run = (
  districts: readonly string[],
  graph = line,
  inBand = districtBands,
  province = 'Test',
) =>
  groupByDevelopmentBand({
    provinces: [{ province, districts }],
    graph,
    bands,
    districtBands: inBand,
    scores,
    populations,
  });

describe('grouping a province by band, adjacency and province', () => {
  it('makes one unit of each run of districts that share a band and touch', () => {
    const { partition, problems } = run(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(problems).toEqual([]);
    expect(partition?.units.map((unit) => unit.districts)).toEqual([
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
    ]);
    // The band travels with the unit, because the unit's note prints the legend's own words for it.
    expect(partition?.units.map((unit) => unit.band.label)).toEqual([
      'Under 50%',
      '80% and above',
    ]);
  });

  it('returns the units of a province lowest band first, so a rebuild writes the same list', () => {
    const { partition } = run(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(partition?.units.map((unit) => unit.band.id)).toEqual(['under-50', '80-plus']);
  });

  it('names each unit for its most populous district, since it has no source for a name', () => {
    const { partition } = run(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(partition?.units.map((unit) => unit.principal)).toEqual(['B', 'E']);
    expect(partition?.units.map((unit) => unit.population)).toEqual([600, 1800]);
  });

  it('draws the same map from a shuffled scope, which is the whole determinism claim', () => {
    const straight = run(['A', 'B', 'C', 'D', 'E', 'F']).partition;
    const shuffled = run(['E', 'A', 'F', 'C', 'B', 'D']).partition;
    expect(JSON.stringify(shuffled)).toBe(JSON.stringify(straight));
  });

  it('splits one band into two units where its districts do not reach each other', () => {
    /*
     * The case the rule is actually *for*, and the one Sindh shows on this census: two groups of
     * the same colour with better-served ground between them are two units, not one unit in two
     * pieces. Contiguity is the method here rather than a flag afterwards, so there is nothing for
     * a contiguity report to say — which is asserted by there being two units and not one.
     */
    const stripes = new Map([
      ['A', 'under-50'],
      ['B', 'under-50'],
      ['C', '80-plus'],
      ['D', '80-plus'],
      ['E', 'under-50'],
      ['F', 'under-50'],
    ]);
    const { partition } = run(['A', 'B', 'C', 'D', 'E', 'F'], line, stripes);
    expect(partition?.units.map((unit) => unit.districts)).toEqual([
      ['A', 'B'],
      ['E', 'F'],
      ['C', 'D'],
    ]);
    expect(partition?.units.every((unit) => unit.band.id !== undefined)).toBe(true);
  });

  it('will not join two provinces, however alike the census finds them', () => {
    /*
     * The province is a boundary this rule does not cross, and it is the condition most easily lost
     * by accident: A to F are one unbroken run of one band here, and they still come out as two
     * units because a provincial boundary runs down the middle of them. Joining them would draw a
     * province out of two provinces' halves, which is a redraw of the federation rather than of a
     * province and is nobody's argument.
     */
    const alike = new Map(
      ['A', 'B', 'C', 'D', 'E', 'F'].map((district) => [district, '65-80'] as const),
    );
    const { partition, problems } = groupByDevelopmentBand({
      provinces: [
        { province: 'West', districts: ['A', 'B', 'C'] },
        { province: 'East', districts: ['D', 'E', 'F'] },
      ],
      graph: line,
      bands,
      districtBands: alike,
      scores,
      populations,
    });
    expect(problems).toEqual([]);
    expect(partition?.units.map((unit) => [unit.province, unit.districts])).toEqual([
      ['West', ['A', 'B', 'C']],
      ['East', ['D', 'E', 'F']],
    ]);
  });

  it('makes a unit of a district whose neighbours are all served differently', () => {
    // Eleven of the thirty-five this draws on the 2023 census are one district, and they are drawn
    // rather than absorbed: absorbing them would take a second rule with nothing published behind
    // it, and a size below which a group is too small to be a province is a number nobody states.
    const island = new Map([...districtBands, ['C', '50-65']]);
    const { partition } = run(['A', 'B', 'C', 'D', 'E', 'F'], line, island);
    expect(partition?.units.map((unit) => unit.districts)).toEqual([
      ['A', 'B'],
      ['C'],
      ['D', 'E', 'F'],
    ]);
    expect(partition?.units[1]?.principal).toBe('C');
  });

  it('carries a province of one district through as a unit of one, with no special case', () => {
    // Where the old rule needed a carve-out — a province of one district has no gradient to cut —
    // this one needs none: one district is one group, and Islamabad is only kept out of the scope
    // by the caller so that it can be drawn as the capital territory it is rather than renamed.
    const { partition, problems } = run(['A'], line, districtBands, 'Capital');
    expect(problems).toEqual([]);
    expect(partition?.units.map((unit) => unit.districts)).toEqual([['A']]);
    expect(partition?.ungrouped).toEqual([]);
  });
});

describe('what the rule refuses, each naming its district', () => {
  it('refuses a district the census does not reach, rather than banding it lowest', () => {
    const { partition, problems } = groupByDevelopmentBand({
      provinces: [{ province: 'Test', districts: ['A', 'B', 'Neelum'] }],
      graph: new Map([...line, ['Neelum', ['A']]]),
      bands,
      districtBands,
      scores,
      populations: new Map([...populations, ['Neelum', 200]]),
    });
    expect(partition).toBeNull();
    expect(problems.join(' ')).toContain('Neelum');
    expect(problems.join(' ')).toContain('not a district scoring zero');
  });

  it('refuses a district banded outside the four the map shades by', () => {
    // A unit is a group of districts a reader can see share a colour, so a band with no colour is a
    // unit with no legend entry — and it would be drawn, and keyed by nothing.
    const stray = new Map([...districtBands, ['C', 'middling']]);
    const { partition, problems } = run(['A', 'B', 'C'], line, stray);
    expect(partition).toBeNull();
    expect(problems.join(' ')).toContain('C (Test)');
    expect(problems.join(' ')).toContain('middling');
  });

  it('refuses a district handed to it twice', () => {
    const { problems } = groupByDevelopmentBand({
      provinces: [
        { province: 'One', districts: ['A', 'B'] },
        { province: 'Two', districts: ['B', 'C'] },
      ],
      graph: line,
      bands,
      districtBands,
      scores,
      populations,
    });
    expect(problems.join(' ')).toContain('B is in scope twice');
  });

  it('refuses a district the map does not draw, since nothing can reach it', () => {
    const { partition, problems } = groupByDevelopmentBand({
      provinces: [{ province: 'Test', districts: ['A', 'B', 'Ghost'] }],
      graph: line,
      bands,
      districtBands: new Map([...districtBands, ['Ghost', 'under-50']]),
      scores: new Map([...scores, ['Ghost', 0.3]]),
      populations: new Map([...populations, ['Ghost', 10]]),
    });
    expect(partition).toBeNull();
    expect(problems.join(' ')).toContain('Ghost');
    expect(problems.join(' ')).toContain('adjacency graph');
  });

  it('needs no report for a province whose districts do not hang together', () => {
    /*
     * Where the cutting rule had to refuse this outright — a chain of shared borders cannot be
     * grown across a gap — the grouping rule has nothing to refuse: the components *are* the
     * answer, so a detached district comes out as its own unit and the province is still covered
     * whole. Asserted because it is a behaviour change and not an oversight.
     */
    const broken: AdjacencyGraph = new Map([
      ['A', ['B']],
      ['B', ['A']],
      ['E', ['F']],
      ['F', ['E']],
    ]);
    const apart = new Map([
      ['A', 'under-50'],
      ['B', 'under-50'],
      ['E', 'under-50'],
      ['F', 'under-50'],
    ]);
    const { partition, problems } = groupByDevelopmentBand({
      provinces: [{ province: 'Torn', districts: ['A', 'B', 'E', 'F'] }],
      graph: broken,
      bands,
      districtBands: apart,
      scores,
      populations,
    });
    expect(problems).toEqual([]);
    expect(partition?.units.map((unit) => unit.districts)).toEqual([
      ['A', 'B'],
      ['E', 'F'],
    ]);
  });
});

describe('the rule statement', () => {
  it('states all three conditions, since any two of them draw a different map', () => {
    expect(BAND_RULE).toContain('same development band');
    expect(BAND_RULE).toContain('same province');
    expect(BAND_RULE).toContain('shared district borders');
  });

  it('states the cuts, so a reader can put a district in a band without the artifact', () => {
    for (const cut of ['under 50%', '50% to 65%', '65% to 80%', '80% and above']) {
      expect(BAND_RULE).toContain(cut);
    }
    expect(BAND_RULE).toContain('unweighted mean');
    expect(BAND_RULE).toContain('flush-toilet');
  });

  it('says out loud that nothing is optimised, which is what a reader would otherwise assume', () => {
    // The old rule maximised a statistic and this one maximises nothing; a card that did not say so
    // would leave "steepest", "best" or "most even" to be inferred from a map that means none of
    // them. The unit count is a finding, and the sentence says that too.
    expect(BAND_RULE).toContain('Nothing is optimised');
    expect(BAND_RULE).toContain('single district');
  });
});
