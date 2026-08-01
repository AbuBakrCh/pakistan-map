/**
 * Assemble OSM relation members into GeoJSON polygons.
 *
 * Overpass `out geom` hands back a relation as an unordered bag of ways, each carrying its own
 * coordinates and a role of `outer` or `inner`. Ways are fragments: a single ring is usually
 * several ways, they are not in order, and any of them may be reversed. This module stitches
 * them back into closed rings and nests the holes.
 *
 * Correctness matters more here than anywhere else in the pipeline — a mis-stitched ring is a
 * district with the wrong shape, which is exactly the kind of silent error the committed-bundle
 * discipline exists to catch.
 */

export type Position = readonly [number, number];
export type Ring = readonly Position[];

export interface OsmMember {
  readonly type: string;
  readonly role?: string;
  readonly geometry?: readonly { readonly lat: number; readonly lon: number }[];
}

/** GeoJSON winding is [lon, lat]; OSM gives lat/lon. */
function toPositions(geometry: readonly { lat: number; lon: number }[]): Position[] {
  return geometry.map((p) => [p.lon, p.lat] as const).map((p) => [p[0], p[1]] as Position);
}

const key = (p: Position) => `${p[0]},${p[1]}`;

const isClosed = (ring: Ring) =>
  ring.length > 3 && key(ring[0] as Position) === key(ring[ring.length - 1] as Position);

/**
 * Chain unordered, arbitrarily-directed way fragments into closed rings.
 *
 * Greedy: take any unused fragment, then repeatedly attach whichever remaining fragment shares
 * the current endpoint, flipping it if it is the fragment's tail that matches. A ring that
 * cannot be closed is dropped and reported rather than emitted half-open — an unclosed ring
 * renders as a torn polygon, and silently keeping it would put a visibly broken district on the
 * map with no indication anything went wrong.
 */
export function stitchRings(fragments: readonly Position[][]): {
  rings: Position[][];
  unclosed: number;
} {
  const remaining = fragments.filter((f) => f.length >= 2).map((f) => [...f]);
  const used = new Set<number>();
  const rings: Position[][] = [];
  let unclosed = 0;

  for (let i = 0; i < remaining.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const ring: Position[] = [...(remaining[i] as Position[])];

    let extended = true;
    while (extended && !isClosed(ring)) {
      extended = false;
      const tail = ring[ring.length - 1] as Position;

      for (let j = 0; j < remaining.length; j++) {
        if (used.has(j)) continue;
        const candidate = remaining[j] as Position[];
        const head = candidate[0] as Position;
        const last = candidate[candidate.length - 1] as Position;

        if (key(head) === key(tail)) {
          ring.push(...candidate.slice(1));
        } else if (key(last) === key(tail)) {
          ring.push(...[...candidate].reverse().slice(1));
        } else {
          continue;
        }
        used.add(j);
        extended = true;
        break;
      }
    }

    if (isClosed(ring)) rings.push(ring);
    else unclosed++;
  }

  return { rings, unclosed };
}

/** Twice the signed area. Positive is counter-clockwise. Used for ring orientation and nesting. */
export function signedArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    const a = ring[i] as Position;
    const b = ring[i + 1] as Position;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum;
}

export function ringContains(ring: Ring, point: Position): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
    const a = ring[i] as Position;
    const b = ring[j] as Position;
    const straddles = a[1] > point[1] !== b[1] > point[1];
    if (straddles && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}

export interface AssembledPolygon {
  readonly polygons: Position[][][];
  readonly unclosed: number;
}

/**
 * Turn one relation's members into GeoJSON Polygon coordinate arrays.
 *
 * Inner rings are nested into whichever outer ring contains them, rather than assumed to belong
 * to the first — a district with two separate landmasses, each holed, would otherwise put both
 * holes in the same polygon and punch a hole through the wrong one.
 */
export function assemblePolygons(members: readonly OsmMember[]): AssembledPolygon {
  const byRole = (role: string) =>
    members
      .filter((m) => m.type === 'way' && (m.role ?? 'outer') === role && m.geometry?.length)
      .map((m) => toPositions(m.geometry as { lat: number; lon: number }[]));

  const outer = stitchRings(byRole('outer'));
  const inner = stitchRings(byRole('inner'));

  // Smallest first, so `findIndex` below lands a hole in the *tightest* ring containing it
  // rather than in some larger ring that also encloses it. Reversing this sort silently puts
  // holes in the wrong polygon.
  const outers = outer.rings
    .map((ring) => ({ ring, area: Math.abs(signedArea(ring)) }))
    .sort((a, b) => a.area - b.area);

  const polygons: Position[][][] = outers.map(({ ring }) => [orient(ring, CLOCKWISE)]);

  for (const hole of inner.rings) {
    const probe = hole[0] as Position;
    const index = outers.findIndex(({ ring }) => ringContains(ring, probe));
    const target = index === -1 ? 0 : index;
    polygons[target]?.push(orient(hole, !CLOCKWISE));
  }

  return { polygons, unclosed: outer.unclosed + inner.unclosed };
}

/**
 * Exterior rings are wound **clockwise** — d3-geo's spherical convention, which is the
 * *opposite* of the RFC 7946 right-hand rule.
 *
 * This is deliberate and load-bearing. d3-geo treats a polygon as the region to the left of its
 * boundary on the sphere, so a counter-clockwise exterior ring is not a district: it is the
 * entire planet minus that district. Wound the RFC way, every fill would render inside-out and
 * `geoArea` would report ~5×10⁸ km² for a one-degree square. Since D11 commits the app to D3
 * for rendering, D3's convention is the one the bundle has to satisfy.
 */
const CLOCKWISE = true;

function orient(ring: Position[], clockwise: boolean): Position[] {
  const isClockwise = signedArea(ring) < 0;
  return isClockwise === clockwise ? ring : [...ring].reverse();
}
