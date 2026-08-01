import { describe, expect, it } from 'vitest';
import { type BoundaryRelation, chainWays, lengthKm, sharedBoundary } from './line-of-control.ts';

const way = (ref: number, ...points: [number, number][]): BoundaryRelation['ways'][number] => ({
  ref,
  geometry: points.map(([lon, lat]) => ({ lon, lat })),
});

const relation = (id: number, name: string, ways: BoundaryRelation['ways']): BoundaryRelation => ({
  id,
  name,
  ways,
});

describe('sharedBoundary', () => {
  it('keeps only the ways both sides carry, with the geometry from the side we draw', () => {
    const ours = relation(1, 'Neelam Valley', [
      way(10, [74, 34], [74.5, 34.5]),
      way(11, [70, 30], [70.5, 30.5]),
    ]);
    const theirs = relation(2, 'Jammu and Kashmir', [way(10), way(12)]);

    const { ways } = sharedBoundary([ours], [theirs]);

    expect(ways.map((w) => w.ref)).toEqual([10]);
    expect(ways[0]?.points).toEqual([
      [74, 34],
      [74.5, 34.5],
    ]);
    expect(ways[0]?.along).toBe('Neelam Valley');
  });

  it('leaves out a unit that shares nothing, which is how the Working Boundary stays out', () => {
    // Sialkot shares ways with Jammu and Kashmir in the real cache. It is excluded not by name
    // but by never being passed in: the Pakistani side of a ceasefire line is Pakistan-
    // administered Kashmir, and Sialkot is Punjab.
    const punjab = relation(3, 'Sialkot', [way(20, [74.5, 32.5], [74.6, 32.6])]);
    const theirs = relation(2, 'Jammu and Kashmir', [way(20)]);

    expect(sharedBoundary([], [theirs]).ways).toEqual([]);
    expect(sharedBoundary([punjab], [theirs]).ways.map((w) => w.ref)).toEqual([20]);
  });

  it('reports a shared way that arrived without geometry rather than dropping it', () => {
    const ours = relation(1, 'Skardu', [{ ref: 30 }]);
    const theirs = relation(2, 'Ladakh', [way(30)]);

    const { ways, withoutGeometry } = sharedBoundary([ours], [theirs]);

    expect(ways).toEqual([]);
    expect(withoutGeometry).toEqual([30]);
  });
});

describe('chainWays', () => {
  const shared = (ref: number, ...points: [number, number][]) => ({
    ref,
    points: points as [number, number][],
    along: 'somewhere',
  });

  it('joins ways end to end regardless of the direction each was drawn in', () => {
    const { chains } = chainWays([
      shared(2, [1, 0], [2, 0]),
      // Drawn backwards against its neighbours, as OSM ways freely are.
      shared(1, [1, 0], [0, 0]),
      shared(3, [3, 0], [2, 0]),
    ]);

    expect(chains).toHaveLength(1);
    expect(chains[0]).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ]);
  });

  it('returns disconnected runs separately, longest first', () => {
    const { chains } = chainWays([
      shared(1, [0, 0], [1, 0]),
      shared(2, [1, 0], [2, 0]),
      shared(3, [9, 9], [9, 8]),
    ]);

    expect(chains.map((chain) => chain.length)).toEqual([3, 2]);
  });

  it('refuses to chain a branch instead of choosing one of its arms', () => {
    const { chains, branches } = chainWays([
      shared(1, [0, 0], [1, 0]),
      shared(2, [1, 0], [2, 0]),
      shared(3, [1, 0], [1, 1]),
    ]);

    expect(chains).toEqual([]);
    expect(branches).toHaveLength(1);
  });
});

describe('lengthKm', () => {
  it('measures a degree of latitude as the ~111 km it is', () => {
    expect(
      lengthKm([
        [74, 33],
        [74, 34],
      ]),
    ).toBeCloseTo(111.2, 1);
  });
});
