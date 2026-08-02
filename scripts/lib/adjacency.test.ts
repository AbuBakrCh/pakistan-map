/**
 * Adjacency and contiguity, over a topology small enough to read (#16).
 *
 * `bundle.test.ts` holds the graph that ships, against the geometry it was derived from. What that
 * cannot show is a *non-contiguous unit*, because no variant proposes one: the committed set is
 * eight units and every one of them hangs together. So the case the whole ticket exists for — a
 * unit in two pieces, flagged and not rejected (D7) — is held here, on three squares.
 *
 * The same three squares `unit-outlines.test.ts` uses, deliberately: two that share an edge and
 * one nowhere near them is the smallest arrangement in which "touches" and "draws as one shape"
 * are different facts, and it is the arrangement both modules are about.
 */

import { describe, expect, it } from 'vitest';
import type { Polygon, Topology } from 'topojson-specification';
import {
  adjacencyProblems,
  arcOwners,
  buildAdjacency,
  contiguityOf,
  describeContiguity,
  edgeCount,
  isolatedDistricts,
  type AdjacencyGraph,
  type NamedGeometry,
} from './adjacency.ts';
import { dissolve, polygonsOf } from './unit-outlines.ts';

/**
 * Three unit squares. West and East share the edge at x = 1 — arc 0, which East carries reversed
 * as `~0`, exactly as a neighbour draws a shared border. Far is off at x = 5 and shares nothing.
 *
 *   arc 0  the shared edge, (1,1) -> (1,0)
 *   arc 1  West's other three sides
 *   arc 2  East's other three sides
 *   arc 3  Far, closed on itself
 */
const TOPOLOGY = {
  type: 'Topology',
  arcs: [
    [
      [1, 1],
      [1, 0],
    ],
    [
      [1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [1, 1],
      [2, 1],
      [2, 0],
      [1, 0],
    ],
    [
      [5, 0],
      [5, 1],
      [6, 1],
      [6, 0],
      [5, 0],
    ],
  ],
  objects: {},
} as unknown as Topology;

const west: Polygon = { type: 'Polygon', arcs: [[0, 1]] };
const east: Polygon = { type: 'Polygon', arcs: [[2, ~0]] };
const far: Polygon = { type: 'Polygon', arcs: [[3]] };

const DISTRICTS: readonly NamedGeometry[] = [
  { name: 'West', geometry: west },
  { name: 'East', geometry: east },
  { name: 'Far', geometry: far },
];

const graph = buildAdjacency(DISTRICTS);

describe('buildAdjacency', () => {
  it('makes neighbours of two districts that share an arc, in both directions', () => {
    expect(graph.get('West')).toEqual(['East']);
    expect(graph.get('East')).toEqual(['West']);
  });

  it('reads an arc and its reverse as the one border they are', () => {
    // West carries arc 0 and East carries ~0. Counted as two different arcs — which is what any
    // derivation that forgot the reversed-index encoding would do — the two squares would share
    // nothing, and every unit made of them would be reported as broken in two.
    expect(arcOwners(DISTRICTS).get(0)).toEqual(['West', 'East']);
    expect(graph.get('West')).toContain('East');
  });

  it('gives a district that shares no arc no neighbours, rather than leaving it out', () => {
    expect(graph.get('Far')).toEqual([]);
    expect(isolatedDistricts(graph)).toEqual(['Far']);
    expect([...graph.keys()].sort()).toEqual(['East', 'Far', 'West']);
  });

  it('counts each shared border once', () => {
    expect(edgeCount(graph)).toBe(1);
  });
});

describe('adjacencyProblems', () => {
  it('passes a graph derived from the arcs it is asked about', () => {
    expect(adjacencyProblems(graph, DISTRICTS)).toEqual([]);
  });

  it('names both sides of an edge only one of them admits to', () => {
    // What a graph built by walking one district's neighbours and forgetting to walk back looks
    // like. It reports "Far" as adjacent to "West" and "West" as adjacent to nothing, so the same
    // unit comes out contiguous or not depending on which district the walk started from.
    const asymmetric: AdjacencyGraph = new Map([
      ['West', ['East']],
      ['East', []],
      ['Far', []],
    ]);
    const problems = adjacencyProblems(asymmetric, DISTRICTS);

    expect(problems.join(' ')).toContain('West names East as a neighbour but East does not name West');
  });

  it('names a district in the graph that the map does not draw, and one drawn that is missing', () => {
    const stray: AdjacencyGraph = new Map([
      ['West', ['Atlantis']],
      ['East', []],
      ['Atlantis', ['West']],
    ]);
    const problems = adjacencyProblems(stray, DISTRICTS).join(' ');

    expect(problems).toContain('Atlantis is in the graph but is not a drawn district');
    expect(problems).toContain('Far is drawn but has no entry in the graph');
  });

  it('names an arc three districts share, which means a border was never cut', () => {
    // A fourth square drawn on West's own shared edge: arc 0 now has three owners. Nothing about
    // the neighbour lists looks wrong — the failure is upstream, in the topology, and the message
    // has to point there rather than at whichever pair looks odd.
    const overlapping = [...DISTRICTS, { name: 'Ghost', geometry: { type: 'Polygon', arcs: [[0, 1]] } as Polygon }];
    const problems = adjacencyProblems(buildAdjacency(overlapping), overlapping).join(' ');

    expect(problems).toContain('arc 0 is used by West, East, Ghost');
  });
});

describe('contiguityOf', () => {
  it('calls a unit of two districts that touch one piece', () => {
    const contiguity = contiguityOf(graph, ['West', 'East']);

    expect(contiguity.contiguous).toBe(true);
    expect(contiguity.pieces).toBe(1);
    expect(contiguity.detached).toEqual([]);
    expect(contiguity.components).toEqual([['East', 'West']]);
  });

  it('flags a unit whose districts do not touch, and names the stranded one', () => {
    // The acceptance criterion of the ticket, and the case the shipped bundle cannot show. It is
    // reported, and there is nothing here that can refuse it: a `Contiguity` has no error state.
    const contiguity = contiguityOf(graph, ['West', 'East', 'Far']);

    expect(contiguity.contiguous).toBe(false);
    expect(contiguity.pieces).toBe(2);
    // Largest first, so `detached` is the ground stranded away from the body of the unit.
    expect(contiguity.components).toEqual([['East', 'West'], ['Far']]);
    expect(contiguity.detached).toEqual([['Far']]);
    expect(describeContiguity('l1 unit "Two and a Half"', contiguity)).toBe(
      'l1 unit "Two and a Half" is in 2 pieces; Far touches none of it. Flagged, not rejected (D7).',
    );
  });

  it('walks only the unit’s own districts, not out through their neighbours', () => {
    // West and Far are joined by nothing; but if the walk were allowed to leave the unit it would
    // reach East from West, and from East reach nothing new — the bug does not show on three
    // squares unless the bridging district is *outside* the unit, which is exactly this case with
    // East removed. On the real map, where all 156 districts are one component, an unconfined
    // walk reports every unit contiguous and the flag becomes decoration.
    expect(contiguityOf(graph, ['West', 'Far']).contiguous).toBe(false);
    expect(contiguityOf(graph, ['West', 'Far']).components).toEqual([['Far'], ['West']]);
  });

  it('calls a single district contiguous, and an empty set no pieces at all', () => {
    expect(contiguityOf(graph, ['Far']).contiguous).toBe(true);
    expect(contiguityOf(graph, []).pieces).toBe(0);
  });

  it('orders its output the same way whichever order the districts arrive in', () => {
    // The artifact is committed, so a rebuild that reshuffles this writes a diff that means
    // nothing and hides one that means something.
    expect(contiguityOf(graph, ['Far', 'East', 'West'])).toEqual(
      contiguityOf(graph, ['West', 'East', 'Far']),
    );
  });

  it('treats a district the graph does not know as a piece of its own rather than dropping it', () => {
    const contiguity = contiguityOf(graph, ['West', 'East', 'Atlantis']);

    expect(contiguity.pieces).toBe(2);
    expect(contiguity.detached).toEqual([['Atlantis']]);
  });
});

describe('pieces drawn and pieces joined', () => {
  it('keeps polygons and contiguity apart: the numbers answer different questions', () => {
    // The distinction this ticket exists to make drawable. `polygonsOf` counts shapes on paper;
    // contiguity counts groups in the graph. Two districts that touch dissolve to one polygon and
    // one piece; two that do not, to two of each — so far they agree, and that agreement is what
    // makes `polygons` look like a contiguity measure.
    expect(polygonsOf(dissolve(TOPOLOGY, [west, east]))).toBe(1);
    expect(contiguityOf(graph, ['West', 'East']).pieces).toBe(1);
    expect(polygonsOf(dissolve(TOPOLOGY, [west, far]))).toBe(2);
    expect(contiguityOf(graph, ['West', 'Far']).pieces).toBe(2);

    // They come apart the moment a single district is drawn as more than one shape — an island,
    // or a district OSM holds as several polygons. Far alone draws as one here; on the real map
    // Rahim Yar Khan draws as three, which is why South Punjab is one piece and three polygons.
    // See `bundle.test.ts`, where that pair of numbers is asserted over the shipped bundle.
    expect(contiguityOf(graph, ['Far']).contiguous).toBe(true);
  });
});
