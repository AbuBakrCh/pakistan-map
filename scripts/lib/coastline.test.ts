import { describe, expect, it } from 'vitest';
import {
  type CoastlineWay,
  type Extent,
  assembleLand,
  chainCoastline,
  clipPolylineToExtent,
  clipToLand,
  closeAgainstExtent,
} from './coastline.ts';
import { type Position, signedArea } from './rings.ts';

/** A coastline way, written the way Overpass `out geom` hands it over. */
const wayOf = (id: number, nodes: number[], coords: [number, number][]): CoastlineWay => ({
  id,
  nodes,
  geometry: coords.map(([lon, lat]) => ({ lat, lon })),
});

const BOX: Extent = { west: 0, south: 0, east: 10, north: 10 };

describe('chainCoastline', () => {
  it('chains two ways that meet head to tail', () => {
    const { chains, headToHead } = chainCoastline([
      wayOf(1, [10, 11], [
        [0, 0],
        [1, 1],
      ]),
      wayOf(2, [11, 12], [
        [1, 1],
        [2, 2],
      ]),
    ]);
    expect(headToHead).toEqual([]);
    expect(chains).toHaveLength(1);
    expect(chains[0]?.points).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
  });

  it('chains ways handed over out of order', () => {
    const { chains } = chainCoastline([
      wayOf(2, [11, 12], [
        [1, 1],
        [2, 2],
      ]),
      wayOf(3, [12, 13], [
        [2, 2],
        [3, 3],
      ]),
      wayOf(1, [10, 11], [
        [0, 0],
        [1, 1],
      ]),
    ]);
    expect(chains).toHaveLength(1);
    expect(chains[0]?.points).toHaveLength(4);
    expect(chains[0]?.closed).toBe(false);
  });

  it('recognises a closed ring — an island', () => {
    const { chains } = chainCoastline([
      wayOf(1, [10, 11, 12], [
        [0, 0],
        [2, 0],
        [2, 2],
      ]),
      wayOf(2, [12, 13, 10], [
        [2, 2],
        [0, 2],
        [0, 0],
      ]),
    ]);
    expect(chains).toHaveLength(1);
    expect(chains[0]?.closed).toBe(true);
  });

  it('keeps separate components separate', () => {
    const { chains } = chainCoastline([
      wayOf(1, [10, 11], [
        [0, 0],
        [1, 1],
      ]),
      wayOf(2, [20, 21], [
        [8, 8],
        [9, 9],
      ]),
    ]);
    expect(chains).toHaveLength(2);
  });

  it('reports a way drawn backwards rather than silently reversing it', () => {
    // OSM's convention is that land lies to the LEFT of a coastline way's direction, so
    // direction is meaning, not bookkeeping. Two ways meeting head-to-head means one of them
    // is drawn backwards upstream; flipping it here would invent which side the land is on.
    const { headToHead } = chainCoastline([
      wayOf(1, [10, 11], [
        [0, 0],
        [1, 1],
      ]),
      wayOf(2, [10, 9], [
        [0, 0],
        [-1, -1],
      ]),
    ]);
    expect(headToHead).toEqual([10]);
  });

  it('reports two ways meeting tail to tail', () => {
    const { headToHead } = chainCoastline([
      wayOf(1, [10, 11], [
        [0, 0],
        [1, 1],
      ]),
      wayOf(2, [12, 11], [
        [2, 2],
        [1, 1],
      ]),
    ]);
    expect(headToHead).toEqual([11]);
  });
});

describe('clipPolylineToExtent', () => {
  it('leaves a polyline that is entirely inside untouched', () => {
    const line: Position[] = [
      [1, 1],
      [5, 5],
      [9, 2],
    ];
    expect(clipPolylineToExtent(line, BOX)).toEqual([line]);
  });

  it('drops a polyline that is entirely outside', () => {
    expect(
      clipPolylineToExtent(
        [
          [-5, -5],
          [-4, -4],
        ],
        BOX,
      ),
    ).toEqual([]);
  });

  it('cuts at the boundary where the polyline enters and leaves', () => {
    const pieces = clipPolylineToExtent(
      [
        [-2, 5],
        [5, 5],
        [5, -2],
      ],
      BOX,
    );
    expect(pieces).toHaveLength(1);
    expect(pieces[0]?.[0]).toEqual([0, 5]);
    expect(pieces[0]?.at(-1)).toEqual([5, 0]);
  });

  it('splits into two pieces when the polyline leaves and comes back', () => {
    const pieces = clipPolylineToExtent(
      [
        [-2, 5],
        [5, 5],
        [5, -2],
        [8, -2],
        [8, 5],
        [12, 5],
      ],
      BOX,
    );
    expect(pieces).toHaveLength(2);
    expect(pieces[1]?.[0]).toEqual([8, 0]);
    expect(pieces[1]?.at(-1)).toEqual([10, 5]);
  });
});

describe('closeAgainstExtent', () => {
  it('closes an open piece by walking the extent with the land on its left', () => {
    // Travelling south-east from the west edge to the south edge, land is to the north-east.
    const rings = closeAgainstExtent(
      [
        [
          [0, 5],
          [5, 0],
        ],
      ],
      BOX,
    );
    expect(rings).toHaveLength(1);
    expect(rings[0]).toEqual([
      [0, 5],
      [5, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 5],
    ]);
    // Counter-clockwise: the interior is on the left, which is where the land is.
    expect(signedArea(rings[0] as Position[])).toBeGreaterThan(0);
  });

  it('threads several pieces into one ring, following the extent between them', () => {
    // Two shores cutting two corners off the box. The land is what is left, and it is one
    // region — so the pieces belong to the same ring, joined along the extent.
    const rings = closeAgainstExtent(
      [
        [
          [0, 5],
          [5, 0],
        ],
        [
          [8, 0],
          [10, 5],
        ],
      ],
      BOX,
    );
    expect(rings).toHaveLength(1);
    expect(rings[0]).toEqual([
      [0, 5],
      [5, 0],
      [8, 0],
      [10, 5],
      [10, 10],
      [0, 10],
      [0, 5],
    ]);
  });

  it('returns nothing when there is no open piece to close', () => {
    expect(closeAgainstExtent([], BOX)).toEqual([]);
  });
});

describe('assembleLand', () => {
  const openChain = { points: [[0, 5] as Position, [5, 0] as Position], closed: false };
  const island = {
    points: [
      [7, 1],
      [8, 1],
      [8, 2],
      [7, 1],
    ] as Position[],
    closed: true,
  };

  it("orients land clockwise, per d3-geo's spherical convention", () => {
    const { polygons, openPieces } = assembleLand([openChain], BOX);
    expect(openPieces).toBe(1);
    expect(signedArea(polygons[0]?.[0] as Position[])).toBeLessThan(0);
  });

  it('carries islands as land of their own', () => {
    const { polygons, islands } = assembleLand([openChain, island], BOX);
    expect(islands).toBe(1);
    expect(polygons).toHaveLength(2);
  });

  it('reports a closed ring wound as water rather than guessing at a hole', () => {
    const lake = { points: [...island.points].reverse(), closed: true };
    const { water } = assembleLand([openChain, lake], BOX);
    expect(water).toHaveLength(1);
  });

  it('reports an open chain that stops inside the extent and so cannot be closed', () => {
    const stub = { points: [[3, 3] as Position, [4, 4] as Position], closed: false };
    const { dangling } = assembleLand([openChain, stub], BOX);
    expect(dangling).toEqual([
      [
        [3, 3],
        [4, 4],
      ],
    ]);
  });
});

describe('clipToLand', () => {
  // Land is everything north-east of a diagonal shore; the rest of the box is sea.
  const land = assembleLand(
    [{ points: [[0, 5] as Position, [5, 0] as Position], closed: false }],
    BOX,
  ).polygons;

  it('is a no-op for a polygon that lies wholly on land', () => {
    const inland: Position[][][] = [
      [
        [
          [6, 6],
          [6, 8],
          [8, 8],
          [8, 6],
          [6, 6],
        ],
      ],
    ];
    const clipped = clipToLand(inland, land);
    expect(clipped).toEqual(inland);
  });

  it('cuts the sea off a polygon that straddles the shore', () => {
    // A unit square straddling the diagonal shore: exactly half of it is land.
    const straddling: Position[][][] = [
      [
        [
          [0, 0],
          [0, 5],
          [5, 5],
          [5, 0],
          [0, 0],
        ],
      ],
    ];
    const clipped = clipToLand(straddling, land);
    // `signedArea` returns twice the area, per its own contract.
    const area = clipped.reduce((sum, p) => sum + Math.abs(signedArea(p[0] as Position[])) / 2, 0);
    expect(area).toBeCloseTo(12.5, 6);
  });

  it('removes a polygon that is entirely at sea', () => {
    const atSea: Position[][][] = [
      [
        [
          [1, 1],
          [1, 2],
          [2, 2],
          [2, 1],
          [1, 1],
        ],
      ],
    ];
    expect(clipToLand(atSea, land)).toEqual([]);
  });

  it("hands back exteriors clockwise and holes counter-clockwise, as the bundle needs", () => {
    const holed: Position[][][] = [
      [
        [
          [6, 6],
          [6, 9],
          [9, 9],
          [9, 6],
          [6, 6],
        ],
        [
          [7, 7],
          [8, 7],
          [8, 8],
          [7, 7],
        ],
      ],
    ];
    const clipped = clipToLand(holed, land);
    expect(clipped[0]).toHaveLength(2);
    expect(signedArea(clipped[0]?.[0] as Position[])).toBeLessThan(0);
    expect(signedArea(clipped[0]?.[1] as Position[])).toBeGreaterThan(0);
  });
});
