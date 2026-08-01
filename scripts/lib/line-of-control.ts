/**
 * Where the ceasefire line is — derived, never traced (#7).
 *
 * The Line of Control is not an object in anybody's data. It is a *stretch* of the boundary of
 * the ground Pakistan administers, and the only thing that distinguishes it from an
 * international border is what lies on the other side of it. So it is named by identity rather
 * than by geometry: the bbox fetch already pulls India's own `admin_level=4` relations into the
 * raw cache as strays (Jammu and Kashmir, Ladakh), and an OSM **way** that is a member of both
 * a relation we draw and one of theirs is, by construction, a piece of the line between them.
 *
 * That is an exact test on integer ids — no tolerance, no nearest-point matching, and nothing
 * for a hand-traced polyline to drift from. It also fails loudly the moment upstream restructures
 * the ways, which is the behaviour every other join in this pipeline has.
 *
 * Two exclusions fall out of the rule rather than being applied on top of it, and both matter:
 *
 *   - **The Working Boundary is not the LoC.** Sialkot and Narowal share ways with Jammu and
 *     Kashmir too, but they are Punjab: Pakistani province against Indian-administered
 *     territory, south of the ceasefire line's southern terminus on the Chenab. The Pakistani
 *     side of the LoC is exactly the two units that are *not* provinces, so passing only the
 *     drawn territories in leaves the Working Boundary out without a special case.
 *   - **The China and Afghanistan frontiers are not the LoC.** Gilgit-Baltistan's northern edge
 *     is shared with nobody in this cache, so no way of it is ever picked up.
 *
 * What the rule does include, and what the app has to say out loud, is the Siachen stretch at
 * the northern end: beyond map reference NJ9842 the 1972 Simla line was never delimited, and
 * what OSM draws there is where the two armies stand. It is a ceasefire line either way, which
 * is the claim the dashed rendering makes; it is not the 1972 line, which is why the copy says
 * so rather than calling the whole run "the Line of Control" and stopping.
 */

import type { Position } from './rings.ts';

/** A way as an OSM relation carries it: an id, and the geometry Overpass attached to it. */
export interface RelationWay {
  readonly ref: number;
  readonly geometry?: readonly { readonly lat: number; readonly lon: number }[] | undefined;
}

/** One boundary relation, reduced to what the derivation reads. */
export interface BoundaryRelation {
  readonly id: number;
  readonly name: string;
  readonly ways: readonly RelationWay[];
}

/** A way both sides claim, with the geometry taken from the side we actually draw. */
export interface SharedWay {
  readonly ref: number;
  readonly points: Position[];
  /** The relation on our side of it — which district the line runs along. */
  readonly along: string;
}

export interface SharedBoundary {
  readonly ways: SharedWay[];
  /**
   * Ways that are shared but arrived without geometry. Reported rather than skipped: a dropped
   * way puts a gap in the line, and a gap in a dashed line is invisible by construction.
   */
  readonly withoutGeometry: number[];
}

/**
 * The ways that appear on both sides. `near` is the side whose geometry is drawn, `far` the
 * side that only exists in the cache to say what is over there.
 *
 * Sorted by way id so the artifact does not churn on Overpass's member ordering.
 */
export function sharedBoundary(
  near: readonly BoundaryRelation[],
  far: readonly BoundaryRelation[],
): SharedBoundary {
  const opposite = new Set(far.flatMap((relation) => relation.ways.map((way) => way.ref)));

  const found = new Map<number, SharedWay>();
  const withoutGeometry = new Set<number>();

  for (const relation of near) {
    for (const way of relation.ways) {
      if (!opposite.has(way.ref) || found.has(way.ref)) continue;
      if (way.geometry === undefined || way.geometry.length < 2) {
        withoutGeometry.add(way.ref);
        continue;
      }
      found.set(way.ref, {
        ref: way.ref,
        points: way.geometry.map(({ lon, lat }) => [lon, lat] as Position),
        along: relation.name,
      });
    }
  }

  return {
    ways: [...found.values()].sort((a, b) => a.ref - b.ref),
    withoutGeometry: [...withoutGeometry].sort((a, b) => a - b),
  };
}

export interface ChainedBoundary {
  /** Each connected run, end to end, in order. */
  readonly chains: Position[][];
  /**
   * Positions where three or more way ends meet. A boundary that branches cannot be chained
   * without choosing a branch, and choosing one would be this module drawing a line rather than
   * reporting one — so the caller fails the build instead.
   */
  readonly branches: Position[];
}

/**
 * Chain the shared ways head-to-tail into continuous runs.
 *
 * On *coordinate* identity, not on node id: Overpass returns relation members with geometry but
 * without node ids, and the coordinates are exact — both sides of the line quote the same OSM
 * nodes, so the numbers are equal to the last digit rather than merely close. `coastline.ts`
 * chains on node ids because it can and because direction carries meaning there; here neither
 * applies, and a way is freely reversed to fit.
 *
 * Chaining is not cosmetic. It is what lets the line be labelled: a label wants the run of the
 * line, and 69 unordered fragments do not have one.
 */
export function chainWays(ways: readonly SharedWay[]): ChainedBoundary {
  const key = (point: Position): string => `${point[0]},${point[1]}`;
  const first = (way: SharedWay): Position => way.points[0] as Position;
  const last = (way: SharedWay): Position => way.points[way.points.length - 1] as Position;

  const atEnd = new Map<string, SharedWay[]>();
  for (const way of ways) {
    for (const end of [first(way), last(way)]) {
      atEnd.set(key(end), [...(atEnd.get(key(end)) ?? []), way]);
    }
  }

  const branches = [...atEnd.entries()]
    .filter(([, meeting]) => meeting.length > 2)
    .map(([, meeting]) => first(meeting[0] as SharedWay));
  if (branches.length > 0) return { chains: [], branches };

  const used = new Set<number>();
  const chains: Position[][] = [];

  /** Walk from one end of `way` until the run stops or closes on itself. */
  const extend = (points: Position[], forwards: boolean): Position[] => {
    for (;;) {
      const tip = forwards ? (points[points.length - 1] as Position) : (points[0] as Position);
      const next = (atEnd.get(key(tip)) ?? []).find((candidate) => !used.has(candidate.ref));
      if (next === undefined) return points;
      used.add(next.ref);
      // Oriented to meet the tip: running away from it when extending forwards, into it when
      // extending backwards. A way is reversed freely — which end OSM drew first is bookkeeping.
      const meets = forwards ? key(first(next)) === key(tip) : key(last(next)) === key(tip);
      const run = meets ? next.points : [...next.points].reverse();
      points = forwards ? [...points, ...run.slice(1)] : [...run.slice(0, -1), ...points];
    }
  };

  // Ways with a free end are chained first, so an open run is walked from its end rather than
  // from its middle and does not come back as two pieces.
  const startOrder = [...ways].sort(
    (a, b) =>
      Number(freeEnds(b, atEnd, key) > 0) - Number(freeEnds(a, atEnd, key) > 0) || a.ref - b.ref,
  );

  for (const way of startOrder) {
    if (used.has(way.ref)) continue;
    used.add(way.ref);
    chains.push(orient(extend(extend([...way.points], true), false)));
  }

  chains.sort((a, b) => b.length - a.length);
  return { chains, branches: [] };
}

/**
 * A chain has no inherent direction — which end the walk happened to start from is an accident
 * of way ids. Orienting on the lower endpoint makes it one anyway, so the committed artifact
 * does not flip between builds and the label does not read the other way up with it.
 */
const orient = (points: Position[]): Position[] => {
  const head = points[0] as Position;
  const tail = points[points.length - 1] as Position;
  const later = tail[0] < head[0] || (tail[0] === head[0] && tail[1] < head[1]);
  return later ? [...points].reverse() : points;
};

const freeEnds = (
  way: SharedWay,
  atEnd: Map<string, SharedWay[]>,
  key: (point: Position) => string,
): number =>
  [way.points[0] as Position, way.points[way.points.length - 1] as Position].filter(
    (end) => (atEnd.get(key(end)) ?? []).length < 2,
  ).length;

const EARTH_RADIUS_KM = 6371;

/**
 * How long a run of line is on the ground, in km. Measured rather than quoted: published LoC
 * lengths are of the line as a claim, and this is the length of the line as OSM draws it.
 */
export function lengthKm(points: readonly Position[]): number {
  const radians = Math.PI / 180;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1] as Position;
    const [x1, y1] = points[i] as Position;
    const dy = (y1 - y0) * radians;
    const dx = (x1 - x0) * radians * Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
    total += Math.hypot(dx, dy) * EARTH_RADIUS_KM;
  }
  return total;
}
