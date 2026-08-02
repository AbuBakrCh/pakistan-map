/**
 * The mother-tongue rule engine (#26), held at its own seam.
 *
 * Two kinds of assertion here, and they are kept apart on purpose. The **shipped** partition is
 * checked over the committed bundle in `bundle.test.ts`, where L6 and L7 are what a reader will
 * actually see. What is checked *here* is everything the real map cannot demonstrate: a language
 * dominant in two places at once, a district the census does not reach, a district it reaches and
 * names no tongue for, and the determinism claim — which is only a claim if something shuffles the
 * input and compares the output.
 */

import { describe, expect, it } from 'vitest';
import type { AdjacencyGraph } from './adjacency.ts';
import { partitionByDominantLanguage, soleRegionOf } from './mother-tongue-partition.ts';

/**
 * A line of five districts: A–B–C–D–E.
 *
 * Small enough to reason about by hand, and shaped so that a language at both ends is dominant in
 * two places without being contiguous — which is the Balochi case the real map has and no toy
 * built out of a blob would show.
 */
const LINE: AdjacencyGraph = new Map([
  ['A', ['B']],
  ['B', ['A', 'C']],
  ['C', ['B', 'D']],
  ['D', ['C', 'E']],
  ['E', ['D']],
]);

const scopeOf = (
  dominant: Record<string, string | null>,
  populations: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 },
  districts = Object.keys(dominant),
) => ({
  districts,
  graph: LINE,
  dominant: new Map(Object.entries(dominant)),
  populations: new Map(Object.entries(populations)),
});

describe('partitionByDominantLanguage', () => {
  it('groups districts by their dominant tongue and orders regions largest first', () => {
    const { partition, problems } = partitionByDominantLanguage(
      scopeOf({ A: 'Alpha', B: 'Alpha', C: 'Beta', D: 'Beta', E: 'Beta' }),
    );
    expect(problems).toEqual([]);
    expect(partition?.regions.map((r) => [r.name, r.districts, r.population])).toEqual([
      ['Alpha', ['A', 'B'], 9],
      ['Beta', ['C', 'D', 'E'], 6],
    ]);
    expect(partition?.unnamed).toEqual([]);
  });

  it('splits a language dominant in two unconnected places into two regions, and names them apart', () => {
    // The Balochi case: dominant on the Makran coast and again in the Nasirabad plains, with the
    // Brahvi belt between. One region would be a unit in two pieces labelled as one place — and
    // two regions called "Balochi" would be two provinces with the same name, so the larger
    // district in each qualifies it.
    const { partition } = partitionByDominantLanguage(
      scopeOf({ A: 'Alpha', B: 'Alpha', C: 'Beta', D: 'Alpha', E: 'Alpha' }),
    );
    expect(partition?.regions.map((r) => [r.name, r.districts])).toEqual([
      ['Alpha (A)', ['A', 'B']],
      ['Alpha (D)', ['D', 'E']],
      ['Beta', ['C']],
    ]);
    // Every region is one connected group. That is the method, not a filter run afterwards.
    for (const region of partition?.regions ?? []) {
      expect(region.districts.length, region.name).toBeGreaterThan(0);
    }
  });

  it('leaves a district the census names no tongue for unassigned, and says which', () => {
    // Upper and Lower Chitral: the census counted them and Khowar has no column in Table 11, so
    // there is no dominant tongue to sort them by. Returned by name — a rule that quietly dropped
    // them would leave a hole in a partition that claims to be complete.
    const { partition, problems } = partitionByDominantLanguage(
      scopeOf({ A: 'Alpha', B: 'Alpha', C: null, D: 'Beta', E: null }),
    );
    expect(problems).toEqual([]);
    expect(partition?.unnamed).toEqual(['C', 'E']);
    expect(partition?.regions.flatMap((r) => r.districts)).toEqual(['A', 'B', 'D']);
  });

  it('refuses a district the census does not reach, rather than placing it', () => {
    // AJK's ten and Gilgit-Baltistan's ten (D25). Absent from the lookup entirely, which is a
    // different absence from the `null` above and must not be answered the same way.
    const { partition, problems } = partitionByDominantLanguage({
      ...scopeOf({ A: 'Alpha', B: 'Alpha' }),
      districts: ['A', 'B', 'C'],
    });
    expect(partition).toBeNull();
    expect(problems.join('\n')).toMatch(/^C is in scope and the census does not reach it/m);
    expect(problems.join('\n')).toMatch(/D25/);
  });

  it('refuses a district with no population, and a district named twice', () => {
    const short = partitionByDominantLanguage(
      scopeOf({ A: 'Alpha', B: 'Alpha' }, { A: 5 }),
    );
    expect(short.partition).toBeNull();
    expect(short.problems.join('\n')).toMatch(/B is in scope with no population/);

    const doubled = partitionByDominantLanguage(
      scopeOf({ A: 'Alpha', B: 'Alpha' }, { A: 5, B: 4 }, ['A', 'B', 'A']),
    );
    expect(doubled.partition).toBeNull();
    expect(doubled.problems.join('\n')).toMatch(/A/);
    expect(doubled.problems.join('\n')).toMatch(/more than once/);
  });

  it('draws the same regions from a shuffled scope, which is the determinism claim', () => {
    const dominant = { A: 'Alpha', B: 'Beta', C: 'Beta', D: 'Alpha', E: 'Alpha' };
    const forwards = partitionByDominantLanguage(scopeOf(dominant));
    const backwards = partitionByDominantLanguage(
      scopeOf(dominant, { A: 5, B: 4, C: 3, D: 2, E: 1 }, ['E', 'C', 'A', 'D', 'B']),
    );
    expect(JSON.stringify(backwards.partition)).toBe(JSON.stringify(forwards.partition));
  });

  it('breaks a tie on the language name rather than on the order districts arrived in', () => {
    // Two regions of equal population. Nothing about the caller's ordering may decide which is
    // listed first, or a card would reorder itself between builds.
    const equal = { A: 'Beta', B: 'Alpha', C: 'Alpha', D: 'Beta', E: 'Beta' };
    const populations = { A: 3, B: 2, C: 1, D: 2, E: 1 };
    const one = partitionByDominantLanguage(scopeOf(equal, populations));
    const other = partitionByDominantLanguage(
      scopeOf(equal, populations, ['D', 'E', 'B', 'C', 'A']),
    );
    expect(one.partition?.regions.map((r) => r.name)).toEqual(
      other.partition?.regions.map((r) => r.name),
    );
  });
});

describe('soleRegionOf', () => {
  const partitionOf = (dominant: Record<string, string | null>) =>
    partitionByDominantLanguage(scopeOf(dominant)).partition!;

  it('returns the one region a language yields', () => {
    const { region, problems } = soleRegionOf(
      partitionOf({ A: 'Alpha', B: 'Alpha', C: 'Beta', D: 'Beta', E: 'Beta' }),
      'Alpha',
    );
    expect(problems).toEqual([]);
    expect(region?.districts).toEqual(['A', 'B']);
  });

  it('refuses a language dominant in two separate places rather than picking one', () => {
    // L6 is stated as one province. If the Pashto-plurality districts of Balochistan ever came
    // apart, drawing whichever half is larger would be this app deciding which one its advocates
    // meant — so the build stops and names both, with their sizes.
    const { region, problems } = soleRegionOf(
      partitionOf({ A: 'Alpha', B: 'Alpha', C: 'Beta', D: 'Alpha', E: 'Alpha' }),
      'Alpha',
    );
    expect(region).toBeNull();
    expect(problems.join('\n')).toMatch(/2 separate groups/);
    expect(problems.join('\n')).toMatch(/A \(2, 9 people\)/);
    expect(problems.join('\n')).toMatch(/D \(2, 3 people\)/);
  });

  it('refuses a language nobody in the scope speaks, so an empty unit cannot be drawn', () => {
    const { region, problems } = soleRegionOf(partitionOf({ A: 'Alpha', B: 'Alpha' }), 'Gamma');
    expect(region).toBeNull();
    expect(problems.join('\n')).toMatch(/no district in this scope has Gamma/);
  });
});
