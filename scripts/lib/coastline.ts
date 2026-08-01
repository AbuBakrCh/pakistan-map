/**
 * Turn OSM's `natural=coastline` way network into a land polygon, and clip district geometry
 * to it (#38).
 *
 * OSM boundary relations for coastal districts extend into territorial waters, so Gwadar reads
 * 25,913 km² against a published 12,637. Fixing that needs a shoreline, and OSM's shoreline is
 * **not a relation**: it is a bare network of ways with two rules attached to it, both of which
 * this module depends on.
 *
 *   1. Ways join end-to-end by shared **node id**, never by coordinate. Two ways may pass
 *      through the same position without meeting there.
 *   2. **Land lies to the LEFT** of a way's direction. Direction is meaning, not bookkeeping —
 *      which is why this module never reverses a way, where `rings.ts` freely does. A way that
 *      only fits when flipped is a mapping error upstream, and flipping it here would be
 *      inventing which side the sea is on.
 *
 * Pakistan's coast does not close: it runs from the Iranian border at Gwatar Bay to Sir Creek
 * and stops. So the chain is closed against a rectangular **extent** that contains the whole
 * country — walk the chain, then walk the extent back to where the chain entered, keeping the
 * land on the left throughout. Everything inside the resulting ring is land; the sea is what
 * was cut away.
 */

import polygonClipping from 'polygon-clipping';
import { type Position, type Ring, signedArea } from './rings.ts';

export interface CoastlineWay {
  readonly id: number;
  /** Node ids, in the way's own direction. This is what ways are chained on. */
  readonly nodes: readonly number[];
  readonly geometry: readonly { readonly lat: number; readonly lon: number }[];
}

/** One connected run of coastline. `closed` means it came back to its own first node: an island. */
export interface Chain {
  readonly points: Position[];
  readonly closed: boolean;
}

/** A lon/lat rectangle. Must contain every polygon that will be clipped against it. */
export interface Extent {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

/**
 * Chain ways head-to-tail on shared node ids, preserving direction.
 *
 * `headToHead` lists node ids where two ways both start, or both end. That is the signature of
 * a way drawn backwards upstream, and it is returned rather than repaired: the caller fails the
 * build on it. Reversing the way would silently move the land to the other side of it.
 */
export function chainCoastline(ways: readonly CoastlineWay[]): {
  chains: Chain[];
  headToHead: number[];
} {
  const usable = ways.filter((way) => way.nodes.length >= 2 && way.geometry.length === way.nodes.length);

  const collide = (pick: (way: CoastlineWay) => number): number[] => {
    const seen = new Set<number>();
    const clashes = new Set<number>();
    for (const way of usable) {
      const node = pick(way);
      if (seen.has(node)) clashes.add(node);
      seen.add(node);
    }
    return [...clashes];
  };

  const headToHead = [
    ...new Set([...collide((w) => w.nodes[0] as number), ...collide((w) => w.nodes.at(-1) as number)]),
  ].sort((a, b) => a - b);
  if (headToHead.length > 0) return { chains: [], headToHead };

  const startingAt = new Map<number, CoastlineWay>();
  const endNodes = new Set<number>();
  for (const way of usable) {
    startingAt.set(way.nodes[0] as number, way);
    endNodes.add(way.nodes.at(-1) as number);
  }

  // Open chains first: seeding from a way whose start node nothing feeds into guarantees each
  // open run is walked from its true head. Whatever is left over is a closed ring, and can be
  // seeded anywhere.
  const heads = usable.filter((way) => !endNodes.has(way.nodes[0] as number));
  const used = new Set<number>();
  const chains: Chain[] = [];

  for (const seed of [...heads, ...usable]) {
    if (used.has(seed.id)) continue;
    const points: Position[] = [];
    let way: CoastlineWay | undefined = seed;
    let lastNode = seed.nodes[0] as number;

    while (way !== undefined && !used.has(way.id)) {
      used.add(way.id);
      for (let i = points.length === 0 ? 0 : 1; i < way.geometry.length; i++) {
        const point = way.geometry[i] as { lat: number; lon: number };
        points.push([point.lon, point.lat]);
      }
      lastNode = way.nodes.at(-1) as number;
      way = startingAt.get(lastNode);
    }

    chains.push({ points, closed: lastNode === (seed.nodes[0] as number) });
  }

  return { chains, headToHead };
}

/**
 * Liang–Barsky: the visible span of one segment, or null. Parametric rather than
 * corner-cased so that a segment cutting across a corner of the extent is clipped at both
 * ends in a single pass.
 */
function clipSegment(a: Position, b: Position, e: Extent): [Position, Position] | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;

  const edges: [number, number][] = [
    [-dx, a[0] - e.west],
    [dx, e.east - a[0]],
    [-dy, a[1] - e.south],
    [dy, e.north - a[1]],
  ];

  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null; // parallel to this edge and outside it
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }

  const at = (t: number): Position => (t === 0 ? a : t === 1 ? b : [a[0] + t * dx, a[1] + t * dy]);
  return [at(t0), at(t1)];
}

const same = (a: Position, b: Position): boolean => a[0] === b[0] && a[1] === b[1];

/**
 * Cut a polyline down to the part of it that lies inside the extent. A polyline that leaves
 * and comes back yields several pieces, each terminating exactly on the extent boundary.
 */
export function clipPolylineToExtent(
  points: readonly Position[],
  extent: Extent,
): Position[][] {
  const pieces: Position[][] = [];
  let current: Position[] | null = null;

  for (let i = 1; i < points.length; i++) {
    const span = clipSegment(points[i - 1] as Position, points[i] as Position, extent);
    if (span === null) {
      current = null;
      continue;
    }
    const [from, to] = span;
    if (current !== null && same(current[current.length - 1] as Position, from)) {
      if (!same(from, to)) current.push(to);
    } else {
      current = [from, to];
      pieces.push(current);
    }
    // A segment clipped short of its own end has left the extent; the next one starts a piece.
    if (!same(to, points[i] as Position)) current = null;
  }

  return pieces.filter((piece) => piece.length >= 2);
}

/**
 * Where a point on the extent boundary sits along its perimeter, as a number in [0, 4)
 * running **counter-clockwise** from the south-west corner: [0,1) south edge, [1,2) east,
 * [2,3) north, [3,4) west. Counter-clockwise because that is the direction in which a
 * polygon's interior lies to its left — the same rule the coastline itself follows.
 */
function perimeterPosition(p: Position, e: Extent): number {
  const width = e.east - e.west;
  const height = e.north - e.south;
  if (p[1] === e.south && p[0] < e.east) return (p[0] - e.west) / width;
  if (p[0] === e.east && p[1] < e.north) return 1 + (p[1] - e.south) / height;
  if (p[1] === e.north && p[0] > e.west) return 2 + (e.east - p[0]) / width;
  return 3 + (e.north - p[1]) / height;
}

const CORNERS: readonly Position[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

const cornerOf = (index: number, e: Extent): Position => {
  const [u, v] = CORNERS[index] as Position;
  return [u === 0 ? e.west : e.east, v === 0 ? e.south : e.north];
};

export const onExtentBoundary = (p: Position, e: Extent): boolean =>
  p[0] === e.west || p[0] === e.east || p[1] === e.south || p[1] === e.north;

/**
 * Close open coastline pieces into rings by walking the extent between them.
 *
 * From where a piece leaves the extent, follow the perimeter counter-clockwise — inserting the
 * corners passed on the way — until the next piece enters, and continue with that piece. Land
 * is on the left of the coastline, and counter-clockwise keeps it on the left of the extent
 * too, so the ring that comes back is the land side rather than the sea side.
 */
export function closeAgainstExtent(
  pieces: readonly (readonly Position[])[],
  extent: Extent,
): Position[][] {
  const entries = pieces
    .map((piece, index) => ({ index, at: perimeterPosition(piece[0] as Position, extent) }))
    .sort((a, b) => a.at - b.at);

  const used = new Set<number>();
  const rings: Position[][] = [];

  for (let seed = 0; seed < pieces.length; seed++) {
    if (used.has(seed)) continue;
    const ring: Position[] = [];
    let index = seed;

    do {
      used.add(index);
      const piece = pieces[index] as readonly Position[];
      ring.push(...(ring.length === 0 ? piece : piece.slice(same(ring.at(-1) as Position, piece[0] as Position) ? 1 : 0)));

      const exit = perimeterPosition(piece.at(-1) as Position, extent);
      const next =
        entries.find((candidate) => candidate.at > exit) ?? (entries[0] as { index: number; at: number });
      const entry = next.at > exit ? next.at : next.at + 4;

      for (let corner = Math.ceil(exit); corner < entry; corner++) {
        ring.push(cornerOf(corner % 4, extent));
      }
      index = next.index;
    } while (index !== seed);

    ring.push(ring[0] as Position);
    rings.push(ring);
  }

  return rings;
}

export interface AssembledLand {
  /** GeoJSON MultiPolygon coordinates, exteriors wound clockwise for d3-geo. */
  readonly polygons: Position[][][];
  /** Open chains closed against the extent. */
  readonly openPieces: number;
  /** Closed rings wound as land — islands, added as land of their own. */
  readonly islands: number;
  /** Closed rings wound as water. None exist off Pakistan; the caller fails on any that appear. */
  readonly water: Position[][];
  /** Open pieces that stop inside the extent, so cannot be closed. A torn coastline. */
  readonly dangling: Position[][];
}

/** Does any part of this ring fall inside the extent? Cheap bbox test, used to drop far coasts. */
function touchesExtent(points: readonly Position[], e: Extent): boolean {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const p of points) {
    west = Math.min(west, p[0]);
    east = Math.max(east, p[0]);
    south = Math.min(south, p[1]);
    north = Math.max(north, p[1]);
  }
  return west <= e.east && east >= e.west && south <= e.north && north >= e.south;
}

/**
 * Build the land polygon: the open coast closed against the extent, plus every island.
 *
 * Nothing is discarded quietly except coastline that lies wholly outside the extent — Oman and
 * peninsular India come back in the same query, and they are as irrelevant to Pakistan's
 * districts as the Indian boundary relations the reconciler drops. Everything else that cannot
 * be turned into land is handed back for the caller to fail on.
 */
export function assembleLand(chains: readonly Chain[], extent: Extent): AssembledLand {
  const open: Position[][] = [];
  const dangling: Position[][] = [];
  const islandRings: Position[][] = [];
  const water: Position[][] = [];

  for (const chain of chains) {
    if (!touchesExtent(chain.points, extent)) continue;

    if (chain.closed) {
      // Land on the left of a ring that encloses it means counter-clockwise. Clockwise is the
      // other thing a closed coastline can be: water with land all around it.
      if (signedArea(chain.points) > 0) islandRings.push(chain.points);
      else water.push(chain.points);
      continue;
    }

    for (const piece of clipPolylineToExtent(chain.points, extent)) {
      const ends = [piece[0] as Position, piece.at(-1) as Position];
      if (ends.every((p) => onExtentBoundary(p, extent))) open.push(piece);
      else dangling.push(piece);
    }
  }

  const rings = [...closeAgainstExtent(open, extent), ...islandRings];
  return {
    polygons: rings.map((ring) => [orientClockwise(ring)]),
    openPieces: open.length,
    islands: islandRings.length,
    water,
    dangling,
  };
}

/**
 * Exteriors wind **clockwise** — d3-geo's spherical convention, the opposite of RFC 7946.
 * `rings.ts` explains why the whole bundle is built that way; `polygon-clipping` speaks RFC,
 * so every ring crossing this boundary has to be turned around.
 */
function orientClockwise(ring: Ring): Position[] {
  return signedArea(ring) < 0 ? [...ring] : [...ring].reverse();
}

function orientCounterClockwise(ring: Ring): Position[] {
  return signedArea(ring) > 0 ? [...ring] : [...ring].reverse();
}

/**
 * Intersect one district's polygons with the land, dropping whatever was territorial water.
 *
 * Only ever called for districts that actually reach the coast. A landlocked district is left
 * byte-identical rather than passed through the clipper for a no-op result: `polygon-clipping`
 * drops collinear vertices even when it changes nothing, and an inland boundary that came back
 * with a different vertex count from its neighbour's copy would stop sharing an arc.
 */
export function clipToLand(
  polygons: readonly (readonly (readonly Position[])[])[],
  land: readonly (readonly (readonly Position[])[])[],
): Position[][][] {
  const clipped = polygonClipping.intersection(
    polygons as never,
    land as never,
  ) as unknown as Position[][][];

  return clipped.map((polygon) =>
    polygon.map((ring, index) => (index === 0 ? orientClockwise(ring) : orientCounterClockwise(ring))),
  );
}
