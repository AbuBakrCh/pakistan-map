import { geoArea } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import {
  type OsmMember,
  type Position,
  assemblePolygons,
  ringContains,
  signedArea,
  stitchRings,
} from './rings.ts';

/** A way fragment, written as OSM hands it over: lat/lon objects. */
const way = (role: string, coords: readonly [number, number][]): OsmMember => ({
  type: 'way',
  role,
  geometry: coords.map(([lon, lat]) => ({ lat, lon })),
});

const square: [number, number][] = [
  [0, 0],
  [4, 0],
  [4, 4],
  [0, 4],
  [0, 0],
];

describe('stitchRings', () => {
  it('closes a ring already given whole', () => {
    const { rings, unclosed } = stitchRings([square as Position[]]);
    expect(unclosed).toBe(0);
    expect(rings).toHaveLength(1);
  });

  it('chains fragments given out of order', () => {
    const { rings, unclosed } = stitchRings([
      [
        [4, 4],
        [0, 4],
        [0, 0],
      ],
      [
        [0, 0],
        [4, 0],
        [4, 4],
      ],
    ] as Position[][]);
    expect(unclosed).toBe(0);
    expect(rings).toHaveLength(1);
    expect(rings[0]?.[0]).toEqual(rings[0]?.[rings[0].length - 1]);
  });

  it('flips a fragment that is stored backwards', () => {
    const { rings, unclosed } = stitchRings([
      [
        [0, 0],
        [4, 0],
      ],
      // Reversed: its *tail* meets the previous fragment's head.
      [
        [0, 0],
        [0, 4],
        [4, 4],
      ],
      [
        [4, 0],
        [4, 4],
      ],
    ] as Position[][]);
    expect(unclosed).toBe(0);
    expect(rings).toHaveLength(1);
  });

  it('separates two disjoint rings', () => {
    const far: [number, number][] = [
      [10, 10],
      [12, 10],
      [12, 12],
      [10, 10],
    ];
    const { rings } = stitchRings([square, far] as Position[][]);
    expect(rings).toHaveLength(2);
  });

  it('reports a ring it cannot close rather than emitting it torn', () => {
    const { rings, unclosed } = stitchRings([
      [
        [0, 0],
        [4, 0],
      ],
      [
        [9, 9],
        [8, 8],
      ],
    ] as Position[][]);
    expect(rings).toHaveLength(0);
    expect(unclosed).toBe(2);
  });
});

describe('signedArea and ringContains', () => {
  it('signs by winding direction', () => {
    expect(signedArea(square as Position[])).toBeGreaterThan(0);
    expect(signedArea([...square].reverse() as Position[])).toBeLessThan(0);
  });

  it('tests point containment', () => {
    expect(ringContains(square as Position[], [2, 2])).toBe(true);
    expect(ringContains(square as Position[], [9, 9])).toBe(false);
  });
});

describe('assemblePolygons', () => {
  it("orients an outer ring clockwise, per d3-geo's spherical convention", () => {
    // Not the RFC 7946 right-hand rule: d3-geo reads a counter-clockwise exterior as the whole
    // sphere minus the polygon, so RFC winding would render every district inside-out.
    for (const input of [square, [...square].reverse()]) {
      const { polygons, unclosed } = assemblePolygons([way('outer', input)]);
      expect(unclosed).toBe(0);
      expect(signedArea(polygons[0]?.[0] as Position[])).toBeLessThan(0);
    }
  });

  it('agrees with d3-geo on the area of a known square', () => {
    const degree: [number, number][] = [
      [70, 30],
      [71, 30],
      [71, 31],
      [70, 31],
      [70, 30],
    ];
    const { polygons } = assemblePolygons([way('outer', degree)]);
    const area = geoArea({ type: 'Polygon', coordinates: polygons[0] } as never) * 6371 * 6371;
    expect(area).toBeGreaterThan(10_000);
    expect(area).toBeLessThan(11_500);
  });

  it("nests a hole inside its own outer ring, not simply the first", () => {
    // Two separate landmasses; the hole sits inside the second one.
    const island: [number, number][] = [
      [10, 10],
      [20, 10],
      [20, 20],
      [10, 20],
      [10, 10],
    ];
    const hole: [number, number][] = [
      [12, 12],
      [14, 12],
      [14, 14],
      [12, 12],
    ];
    const { polygons } = assemblePolygons([
      way('outer', square),
      way('outer', island),
      way('inner', hole),
    ]);

    expect(polygons).toHaveLength(2);
    const holed = polygons.filter((p) => p.length > 1);
    expect(holed).toHaveLength(1);
    // The holed polygon must be the island, not the unit square.
    expect(ringContains(holed[0]?.[0] as Position[], [15, 15])).toBe(true);
    // …and the hole winds opposite its exterior: counter-clockwise.
    expect(signedArea(holed[0]?.[1] as Position[])).toBeGreaterThan(0);
  });

  it('ignores non-way members such as admin_centre nodes and subarea relations', () => {
    const { polygons } = assemblePolygons([
      { type: 'node', role: 'admin_centre' },
      { type: 'relation', role: 'subarea' },
      way('outer', square),
    ]);
    expect(polygons).toHaveLength(1);
  });
});
