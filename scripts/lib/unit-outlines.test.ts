/**
 * The dissolve, over a topology small enough to read (#15).
 *
 * `bundle.test.ts` holds the outlines that ship, against the geometry they were cut from. What
 * that cannot show is the *shape* of a failure — a dissolve that leaves an internal border in, or
 * one that loses a member — because a correct artifact has none. So the arithmetic is held here,
 * on two squares and a third one nowhere near them.
 */

import { describe, expect, it } from 'vitest';
import type { MultiPolygon, Polygon, Topology } from 'topojson-specification';
import {
  arcsOf,
  boundaryArcs,
  dissolve,
  interiorArcs,
  outlineProblems,
  polygonsOf,
  unclosedRings,
} from './unit-outlines.ts';

/**
 * Two unit squares side by side, sharing the edge at x = 1, and a third square well away from
 * both. Wound clockwise, as `topojson-server` winds an exterior ring and as `d3.geoArea` reads a
 * small area rather than the rest of the sphere.
 *
 *   arc 0  the shared edge, (1,1) -> (1,0), in the direction the west square draws it
 *   arc 1  the west square's other three sides, (1,0) -> (1,1) the long way round
 *   arc 2  the east square's other three sides, (1,1) -> (1,0) the long way round
 *   arc 3  the detached square, closed on itself
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
/** Drawn the other way round the shared edge, as a neighbour is: ~0 is arc 0 reversed. */
const east: Polygon = { type: 'Polygon', arcs: [[2, ~0]] };
const detached: Polygon = { type: 'Polygon', arcs: [[3]] };

const label = 'l1 unit "Two Squares"';

describe('arc bookkeeping', () => {
  it('counts an edge two members share as interior and the rest as boundary', () => {
    expect(interiorArcs([west, east])).toEqual([0]);
    expect(boundaryArcs([west, east])).toEqual([1, 2]);
  });

  it('treats an arc and its reverse as the same edge, which is how neighbours draw it', () => {
    // East carries ~0, west carries 0. Counted as two different arcs, the shared edge would look
    // like two boundary arcs and survive the dissolve as a seam down the middle of the unit.
    expect(arcsOf(east)).toEqual([0, 2]);
  });

  it('calls every arc of a lone member a boundary arc', () => {
    expect(boundaryArcs([detached])).toEqual([3]);
    expect(interiorArcs([detached])).toEqual([]);
  });
});

describe('dissolve', () => {
  it('removes the internal border and keeps exactly the outside edge', () => {
    const outline = dissolve(TOPOLOGY, [west, east]);

    expect(arcsOf(outline)).toEqual(boundaryArcs([west, east]));
    expect(arcsOf(outline)).not.toContain(0);
    expect(polygonsOf(outline)).toBe(1);
  });

  it('gives a unit of non-adjacent members one polygon each, without error', () => {
    // Contiguity is flagged, never blocked (D7). A unit whose districts do not touch is a
    // legitimate proposal and has to draw as two shapes rather than fail to draw.
    const outline = dissolve(TOPOLOGY, [west, detached]);

    expect(polygonsOf(outline)).toBe(2);
    expect(arcsOf(outline)).toEqual([0, 1, 3]);
    expect(outlineProblems(label, TOPOLOGY, [west, detached], outline)).toEqual([]);
  });

  it('leaves a single member exactly as it was', () => {
    expect(arcsOf(dissolve(TOPOLOGY, [detached]))).toEqual([3]);
  });
});

describe('outlineProblems', () => {
  it('passes a dissolve that agrees with its members on both area and arcs', () => {
    expect(outlineProblems(label, TOPOLOGY, [west, east], dissolve(TOPOLOGY, [west, east]))).toEqual(
      [],
    );
  });

  it('names the unit when the outline is not the union of its members', () => {
    // The failure a dissolve run against the wrong district list would produce: an outline that
    // is a real shape, and the wrong one. Both the area and the arc set say so.
    const problems = outlineProblems(label, TOPOLOGY, [west, east], dissolve(TOPOLOGY, [west]));

    expect(problems.length).toBeGreaterThan(0);
    for (const problem of problems) expect(problem).toContain('Two Squares');
    // Half the ground, and the message says so in km² rather than reporting a count of arcs.
    expect(problems.join(' ')).toMatch(/measures [\d.]+ km² dissolved against [\d.]+ km²/);
  });

  it('names an interior arc that survived, rather than reporting a count', () => {
    const seam = { type: 'MultiPolygon', arcs: [[[0, 1]], [[2, ~0]]] } as MultiPolygon;
    const problems = outlineProblems(label, TOPOLOGY, [west, east], seam);

    expect(problems.join(' ')).toContain('arc 0');
  });
});

describe('unclosedRings', () => {
  it('accepts a ring that returns to where it started', () => {
    expect(unclosedRings(TOPOLOGY, dissolve(TOPOLOGY, [west, east]))).toEqual([]);
  });

  it('reports a ring that does not close, which is what a torn outline looks like', () => {
    // Half of a square: an outline that would render as an open shape with the fill leaking out
    // of the gap. Nothing in the arc bookkeeping notices it, which is why it is checked apart.
    const torn = { type: 'MultiPolygon', arcs: [[[1]]] } as MultiPolygon;

    expect(unclosedRings(TOPOLOGY, torn)).toHaveLength(1);
    expect(unclosedRings(TOPOLOGY, torn)[0]).toMatch(/does not close/);
  });
});
