/**
 * The silhouette cut, on shapes small enough to check by hand.
 *
 * The committed bundle says the four countries came out right (`src/lib/context.test.ts`). This
 * says *why* they did: that a country entirely inside the extent is passed through untouched, that
 * one straddling the edge is cut at the edge and not dropped, and that the extent is wide enough
 * that the cut cannot appear inside the frame — which is the only judgement in the module.
 */

import { geoArea, geoContains } from 'd3';
import { describe, expect, it } from 'vitest';
import {
  BOUNDARY_NOTES,
  CONTEXT_EXTENT,
  NEIGHBOURS,
  extentPolygon,
  silhouetteOf,
} from './neighbours.ts';
import type { OsmMember } from './rings.ts';

/** One square, as Overpass hands a relation back: a way member carrying lat/lon. */
const square = (west: number, south: number, east: number, north: number): OsmMember[] => [
  {
    type: 'way',
    role: 'outer',
    geometry: [
      { lat: south, lon: west },
      { lat: north, lon: west },
      { lat: north, lon: east },
      { lat: south, lon: east },
      { lat: south, lon: west },
    ],
  },
];

const extent = { west: 0, south: 0, east: 10, north: 10 };

describe('silhouetteOf', () => {
  it('passes a country that is wholly inside the extent through unchanged', () => {
    const { polygons, unclosed } = silhouetteOf(square(2, 2, 6, 6), extent);
    expect(unclosed).toBe(0);
    expect(polygons).toHaveLength(1);
    const uncut = {
      type: 'Polygon',
      coordinates: [
        [
          [2, 2],
          [2, 6],
          [6, 6],
          [6, 2],
          [2, 2],
        ],
      ],
    };
    expect(geoArea({ type: 'MultiPolygon', coordinates: polygons } as never)).toBeCloseTo(
      geoArea(uncut as never),
      9,
    );
  });

  it('cuts a country that runs off the edge at the edge, rather than dropping it', () => {
    // Iran and China both do this. A country dropped for leaving the box would leave the border
    // it shares with Pakistan facing blank paper, which is the exact thing the silhouettes exist
    // to prevent.
    const { polygons } = silhouetteOf(square(-20, 2, 6, 6), extent);
    expect(polygons).toHaveLength(1);
    const shape = { type: 'MultiPolygon', coordinates: polygons };
    expect(geoContains(shape as never, [1, 4])).toBe(true);
    expect(geoContains(shape as never, [-5, 4])).toBe(false);
  });

  it('returns nothing for a country the extent does not reach', () => {
    expect(silhouetteOf(square(40, 40, 50, 50), extent).polygons).toEqual([]);
  });

  it('reports a ring it cannot stitch shut instead of emitting a torn country', () => {
    const open: OsmMember[] = [
      {
        type: 'way',
        role: 'outer',
        geometry: [
          { lat: 2, lon: 2 },
          { lat: 6, lon: 2 },
          { lat: 6, lon: 6 },
        ],
      },
    ];
    expect(silhouetteOf(open, extent).unclosed).toBe(1);
  });
});

describe('extentPolygon', () => {
  it('is a closed rectangle wound the way the rest of the bundle is', () => {
    const ring = extentPolygon(extent)[0]?.[0] as readonly (readonly number[])[];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    // Clockwise for d3-geo, which reads a polygon as the region to its left on the sphere. Wound
    // the other way this is the whole planet minus the box, and every silhouette clips to nothing.
    expect(geoContains({ type: 'Polygon', coordinates: [ring] } as never, [5, 5])).toBe(true);
  });
});

describe('the context extent', () => {
  it('reaches past the widest frame the layout can produce at zoom 1', () => {
    // The projection is fitted to Pakistan, so the window a reader sees at zoom 1 depends on the
    // frame's aspect. The widest the layout permits (1180 px against the map well's 26 rem floor)
    // reaches 40.7°E–96.8°E and 20.3°N–38.6°N. The extent's edges are a straight cut through Iran
    // and China that means nothing, so they have to fall outside that on every side.
    expect(CONTEXT_EXTENT.west).toBeLessThanOrEqual(40.7);
    expect(CONTEXT_EXTENT.east).toBeGreaterThanOrEqual(96.8);
    expect(CONTEXT_EXTENT.south).toBeLessThanOrEqual(20.3);
    expect(CONTEXT_EXTENT.north).toBeGreaterThanOrEqual(38.6);
  });

  it('stays within reach of the cone the map is projected on', () => {
    // A conformal conic cut for Pakistan (central meridian ~69.3°E) returns coordinates the size
    // of the sky far enough round the cone. China's true eastern edge at 135°E is 66° out; this
    // keeps every drawn vertex inside 30°.
    expect(69.3 - CONTEXT_EXTENT.west).toBeLessThan(30);
    expect(CONTEXT_EXTENT.east - 69.3).toBeLessThan(30);
  });
});

describe('the neighbour roster', () => {
  it('is the four countries Pakistan borders, each with the stretch it lies across', () => {
    expect(NEIGHBOURS.map((n) => n.iso).sort()).toEqual(['AF', 'CN', 'IN', 'IR']);
    for (const neighbour of NEIGHBOURS) {
      expect(neighbour.faces.length, neighbour.name).toBeGreaterThan(0);
      // The probe that makes the name falsifiable is only useful if it is inside the extent.
      const [lon, lat] = neighbour.inside;
      expect(lon, neighbour.name).toBeGreaterThan(CONTEXT_EXTENT.west);
      expect(lon, neighbour.name).toBeLessThan(CONTEXT_EXTENT.east);
      expect(lat, neighbour.name).toBeGreaterThan(CONTEXT_EXTENT.south);
      expect(lat, neighbour.name).toBeLessThan(CONTEXT_EXTENT.north);
    }
  });

  it('carries a note only for the boundary that is disputed as a boundary', () => {
    // Afghanistan's, and no other. The Iranian and Chinese boundaries are settled by treaty; the
    // Indian one is not an ordinary boundary at all along the stretch that is disputed, and that
    // stretch is drawn dashed and explained on its own terms (D12).
    expect(Object.keys(BOUNDARY_NOTES)).toEqual(['AF']);
    expect(BOUNDARY_NOTES['AF']).toMatch(/never been|No Afghan government has recognised it/);
  });
});
