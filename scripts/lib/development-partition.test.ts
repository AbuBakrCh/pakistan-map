/**
 * What the development-gradient rule does at its own seam (#31) — the cases the real map cannot
 * show, and the two it can show only once.
 *
 * The shipped map is re-derived in `bundle.test.ts`, district by district, against what was baked.
 * What is here is the behaviour that has no example in Pakistan: a province whose districts do not
 * hang together, a cut that would leave the rest of a province in two pieces, a district the
 * census does not reach, and the determinism claim — the same map from a shuffled scope, which is
 * the only reason a `derived` badge is honest.
 */

import { describe, expect, it } from 'vitest';
import type { AdjacencyGraph } from './adjacency.ts';
import { GRADIENT_RULE, splitByDevelopmentGradient } from './development-partition.ts';

/** A line of six districts, A–F, each bordering only its neighbours. */
const line: AdjacencyGraph = new Map([
  ['A', ['B']],
  ['B', ['A', 'C']],
  ['C', ['B', 'D']],
  ['D', ['C', 'E']],
  ['E', ['D', 'F']],
  ['F', ['E']],
]);

const scores = new Map([
  ['A', 0.2],
  ['B', 0.22],
  ['C', 0.24],
  ['D', 0.8],
  ['E', 0.82],
  ['F', 0.84],
]);

const populations = new Map([
  ['A', 100],
  ['B', 300],
  ['C', 200],
  ['D', 500],
  ['E', 900],
  ['F', 400],
]);

const run = (districts: readonly string[], graph = line, s = scores) =>
  splitByDevelopmentGradient({
    provinces: [{ province: 'Test', districts }],
    graph,
    scores: s,
    populations,
  });

describe('cutting a province at its steepest gradient', () => {
  it('finds the division rather than the outlier', () => {
    const { partition, problems } = run(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(problems).toEqual([]);
    const split = partition?.splits[0];
    expect(split?.lower.districts).toEqual(['A', 'B', 'C']);
    expect(split?.higher.districts).toEqual(['D', 'E', 'F']);
    // The seam is where the two halves meet, which is what the card quotes.
    expect(split?.seam).toEqual({ below: 'C', above: 'D', difference: expect.closeTo(0.56, 6) });
  });

  it('names each half for its most populous district, since it has no source for a name', () => {
    const split = run(['A', 'B', 'C', 'D', 'E', 'F']).partition?.splits[0];
    expect(split?.lower.principal).toBe('B');
    expect(split?.higher.principal).toBe('E');
  });

  it('draws the same map from a shuffled scope, which is the whole determinism claim', () => {
    const straight = run(['A', 'B', 'C', 'D', 'E', 'F']).partition;
    const shuffled = run(['E', 'A', 'F', 'C', 'B', 'D']).partition;
    expect(JSON.stringify(shuffled)).toBe(JSON.stringify(straight));
  });

  it('takes a natural break and not the largest single step between two districts', () => {
    /*
     * This is Punjab's shape in miniature, and the reason the rule is a break and not a gap. The
     * largest single step here is A→B, at 0.12; taking it would make the province "A, and
     * everything else", which finds an outlier rather than a division. The break the rule takes is
     * D|E, at 0.12 as well but with the two halves near enough in size for the split to mean
     * something.
     */
    const slope = new Map([
      ['A', 0.5],
      ['B', 0.62],
      ['C', 0.64],
      ['D', 0.66],
      ['E', 0.78],
      ['F', 0.8],
    ]);
    const split = run(['A', 'B', 'C', 'D', 'E', 'F'], line, slope).partition?.splits[0];
    expect(split?.lower.districts).toEqual(['A', 'B', 'C', 'D']);
    expect(split?.higher.districts).toEqual(['E', 'F']);
  });

  it('will not make a cut that leaves the rest of the province in two pieces', () => {
    /*
     * A star: the hub H borders all three arms, and the arms border nothing else. Taking the hub
     * into the lower half strands the arms, so that cut is not a candidate at all — the higher
     * half has to hang together as much as the lower one does, and contiguity is the method here
     * rather than a flag afterwards.
     */
    const star: AdjacencyGraph = new Map([
      ['H', ['X', 'Y', 'Z']],
      ['X', ['H']],
      ['Y', ['H']],
      ['Z', ['H']],
    ]);
    const starScores = new Map([
      ['H', 0.3],
      ['X', 0.31],
      ['Y', 0.9],
      ['Z', 0.92],
    ]);
    const { partition, problems } = splitByDevelopmentGradient({
      provinces: [{ province: 'Star', districts: ['H', 'X', 'Y', 'Z'] }],
      graph: star,
      scores: starScores,
      populations: new Map([
        ['H', 10],
        ['X', 20],
        ['Y', 30],
        ['Z', 40],
      ]),
    });
    expect(problems).toEqual([]);
    const split = partition?.splits[0];
    /*
     * The chain reaches H, then X, then Y, then Z — but the only cut whose *higher* half hangs
     * together is the last one, because H is what holds the arms to each other. So the rule takes
     * the cut it can make rather than the cut the scores would prefer, and it does so silently:
     * an inadmissible cut is not a candidate, not a flagged result.
     */
    expect(split?.lower.districts).toEqual(['H', 'X', 'Y']);
    expect(split?.higher.districts).toEqual(['Z']);
  });
});

describe('what the rule refuses, each naming its district', () => {
  it('refuses a district the census does not reach, rather than scoring it zero', () => {
    const { partition, problems } = splitByDevelopmentGradient({
      provinces: [{ province: 'Test', districts: ['A', 'B', 'Neelum'] }],
      graph: new Map([...line, ['Neelum', ['A']]]),
      scores,
      populations: new Map([...populations, ['Neelum', 200]]),
    });
    expect(partition).toBeNull();
    expect(problems.join(' ')).toContain('Neelum');
    expect(problems.join(' ')).toContain('not a district scoring zero');
  });

  it('reports a province whose own districts do not hang together', () => {
    const broken: AdjacencyGraph = new Map([
      ['A', ['B']],
      ['B', ['A']],
      ['E', ['F']],
      ['F', ['E']],
    ]);
    const { partition, problems } = splitByDevelopmentGradient({
      provinces: [{ province: 'Torn', districts: ['A', 'B', 'E', 'F'] }],
      graph: broken,
      scores,
      populations,
    });
    expect(partition).toBeNull();
    expect(problems.join(' ')).toContain('Torn');
    expect(problems.join(' ')).toContain('E, F');
  });

  it('names a province of one district as unsplit, with the reason, rather than dropping it', () => {
    const { partition, problems } = splitByDevelopmentGradient({
      provinces: [{ province: 'Capital', districts: ['A'] }],
      graph: line,
      scores,
      populations,
    });
    expect(problems).toEqual([]);
    expect(partition?.splits).toEqual([]);
    expect(partition?.unsplit[0]?.province).toBe('Capital');
    expect(partition?.unsplit[0]?.reason).toContain('single district');
  });

  it('refuses a district handed to it twice', () => {
    const { problems } = splitByDevelopmentGradient({
      provinces: [
        { province: 'One', districts: ['A', 'B'] },
        { province: 'Two', districts: ['B', 'C'] },
      ],
      graph: line,
      scores,
      populations,
    });
    expect(problems.join(' ')).toContain('B is in scope twice');
  });
});

describe('the rule statement', () => {
  it('states the tie-break, which is the half that decides where the line lands', () => {
    expect(GRADIENT_RULE).toContain('lower district name');
    expect(GRADIENT_RULE).toContain('natural break');
    expect(GRADIENT_RULE).toContain('unweighted mean');
    expect(GRADIENT_RULE).toContain('flush-toilet');
  });
});
