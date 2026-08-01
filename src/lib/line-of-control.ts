/**
 * The ceasefire line: reading it out of the bundle, and deciding where its name goes (#7, D12).
 *
 * The Line of Control is drawn **dashed** because a solid line would say "international border",
 * which is a claim this app's data cannot support and its provenance rules forbid it from
 * making. The dash is not decoration; it is the qualification, and it is the reason the line has
 * to be a stratum of its own rather than a variant of the province stroke — it is a *segment* of
 * a boundary, not a whole one.
 *
 * Where it comes from is settled in the build (`scripts/lib/line-of-control.ts`): an OSM way
 * that belongs both to a drawn territory and to India-administered Jammu and Kashmir or Ladakh
 * is on the line. What arrives here is that derivation, sharing arcs with the district and
 * province boundaries it runs along, so the dash can never drift off the edge it qualifies.
 *
 * Labelling it is the other half. A boundary that is drawn differently and not *said* to be
 * different is a visual riddle: the reader sees a dashed line and has to already know why. So
 * the line carries its name along it, in the frame, at every zoom — which means the name has to
 * follow whichever part of the line the reader is currently looking at.
 */

import { feature } from 'topojson-client';
import type { Feature, MultiLineString } from 'geojson';
import type { GeometryObject, Topology } from 'topojson-specification';

export interface LineOfControlProperties {
  readonly name: string;
  /** `ceasefire-line`, as opposed to any boundary the app would draw solid. */
  readonly kind: string;
  /** What the app is entitled to say about it. Carried with the geometry, not typed in here. */
  readonly note: string;
  readonly osmWays: readonly number[];
}

/**
 * Throws rather than returning nothing, for the same reason `readGeography` refuses an unknown
 * `kind`: the fallback is invisible. A bundle without the line still draws Azad Kashmir's and
 * Gilgit-Baltistan's eastern edge — as an ordinary, solid outline, asserting a settled border
 * where there is a ceasefire line. A missing dash looks like a map; it is a claim.
 */
export function readLineOfControl(
  topology: Topology,
): Feature<MultiLineString, LineOfControlProperties> {
  const object = topology.objects['lineOfControl'];
  if (object === undefined) {
    throw new Error(
      'The bundle carries no Line of Control. Without it the eastern boundary of the ' +
        'territories renders as an ordinary border, which is a claim this app does not make. ' +
        'Re-run npm run build:data:normalize.',
    );
  }

  const line = feature(topology, object as never) as unknown as Feature<
    MultiLineString,
    LineOfControlProperties
  >;
  if (line.geometry.coordinates.length === 0) {
    throw new Error('The bundle carries an empty Line of Control.');
  }
  return line;
}

/**
 * Every arc index a topology object is built from, sign stripped.
 *
 * Exported because it is what makes the ticket's central claim checkable against the shipped
 * artifact: *this dashed line is the boundary with India-administered Kashmir, and no other
 * stretch of border*. Under a shared-arc topology that is a set question on integers, exact and
 * cheap — where a nearest-point comparison against the drawn edge would only ever be evidence.
 */
export function arcsOf(object: GeometryObject): Set<number> {
  const found = new Set<number>();
  const walk = (node: unknown): void => {
    if (typeof node === 'number') {
      found.add(node < 0 ? ~node : node);
      return;
    }
    if (Array.isArray(node)) node.forEach(walk);
  };
  walk((object as { arcs?: unknown }).arcs);
  for (const child of (object as { geometries?: GeometryObject[] }).geometries ?? []) {
    for (const arc of arcsOf(child)) found.add(arc);
  }
  return found;
}

export interface LineLabelOptions {
  readonly bounds: { readonly width: number; readonly height: number };
  /** Keep the label this far inside the frame; a name clipped by the edge is worse than none. */
  readonly margin: number;
  /** Perpendicular distance from the line, in px, so the name is not struck through by it. */
  readonly offset: number;
  /**
   * A point the label is pushed away from — in practice the middle of the drawn country.
   *
   * Which of the two sides gets the name is not a taste question. The line has Pakistan on one
   * side and ground this app draws nothing on at all on the other, so offsetting outward puts
   * the name on empty paper, and offsetting inward would set it over districts it does not
   * name. A fixed compass direction cannot do this: the line runs north for most of its length
   * but turns east at both ends, and "east of the line" is over Kashmir at the top of it.
   */
  readonly awayFrom: Point;
  /** Shortest visible run worth naming. Below it the label says more than the line does. */
  readonly minRun: number;
  /** Half the chord the angle is taken from. Larger follows the run of the line, not a kink. */
  readonly reach: number;
  /**
   * Whether the name may be set here — in practice, whether it lands off the drawn land and
   * clear of the names already on the map. Optional; without it the side is chosen by
   * `awayFrom` alone.
   *
   * `awayFrom` gets the side right along most of this line and wrong where it matters. The
   * ceasefire line turns east twice, and on those stretches "away from the middle of Pakistan"
   * is north — which is Gilgit-Baltistan, not India. The name would then sit over a territory it
   * does not name, which is the one thing `layoutLabels` refuses to do for every other name on
   * the map. So both sides and a few positions along the run are tried in turn, and the first
   * one the caller accepts wins.
   */
  readonly clear?: (candidate: PlacedLineLabel) => boolean;
}

export interface PlacedLineLabel {
  readonly x: number;
  readonly y: number;
  /** Degrees, for an SVG rotate. Never outside ±90, so the name is never upside down. */
  readonly angle: number;
}

type Point = readonly [number, number];

const distance = (a: Point, b: Point): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

/**
 * Place a name along a line, on the part of it the reader can currently see.
 *
 * Screen space, not geography: the caller hands in the line already projected and already
 * transformed by the zoom, so this re-runs on every zoom frame and the name goes wherever the
 * line has gone. That is what keeps the labelling alive when the reader zooms into one end of
 * it, where a name pinned to the line's true midpoint would simply be off screen.
 *
 * Returns `null` rather than placing a label on a stub. Same rule as `layoutLabels`: a name is
 * drawn where it describes something, or it is not drawn.
 */
export function labelAlongLine(
  lines: readonly (readonly Point[])[],
  { bounds, margin, offset, minRun, reach, awayFrom, clear }: LineLabelOptions,
): PlacedLineLabel | null {
  const inside = (point: Point): boolean =>
    point[0] >= margin &&
    point[1] >= margin &&
    point[0] <= bounds.width - margin &&
    point[1] <= bounds.height - margin;

  // Runs of consecutive on-screen points. Cut at the frame rather than clipped to it: the
  // vertices are dense enough that the run's ends land within a vertex of the edge.
  const runs: Point[][] = [];
  for (const line of lines) {
    let run: Point[] = [];
    for (const point of line) {
      if (inside(point)) run.push(point);
      else if (run.length > 0) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length > 0) runs.push(run);
  }

  const lengthOf = (run: readonly Point[]): number =>
    run.reduce((sum, point, i) => (i === 0 ? 0 : sum + distance(run[i - 1] as Point, point)), 0);

  let best: Point[] | null = null;
  let bestLength = minRun;
  for (const run of runs) {
    const length = lengthOf(run);
    if (length >= bestLength) {
      best = run;
      bestLength = length;
    }
  }
  if (best === null) return null;

  /** Walk `along` px into the run and return where that lands. */
  const at = (along: number): Point => {
    let walked = 0;
    for (let i = 1; i < best.length; i += 1) {
      const from = best[i - 1] as Point;
      const to = best[i] as Point;
      const step = distance(from, to);
      if (walked + step >= along) {
        const t = step === 0 ? 0 : (along - walked) / step;
        return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
      }
      walked += step;
    }
    return best[best.length - 1] as Point;
  };

  /** The name set at `along` px into the run, offset to whichever side `outward` picks. */
  const place = (along: number, outward: boolean): PlacedLineLabel => {
    const anchor = at(along);
    const from = at(Math.max(0, along - reach));
    const to = at(Math.min(bestLength, along + reach));

    // Reading direction: left to right on screen, so the name is never mirrored. A line running
    // north reads bottom-to-top (-90°), which is how an atlas sets a name along a meridian.
    const run: Point =
      to[0] >= from[0] ? [to[0] - from[0], to[1] - from[1]] : [from[0] - to[0], from[1] - to[1]];
    const span = Math.hypot(run[0], run[1]) || 1;
    const candidate: Point = [run[1] / span, -run[0] / span];
    const away =
      distance([anchor[0] + candidate[0], anchor[1] + candidate[1]], awayFrom) >
      distance([anchor[0] - candidate[0], anchor[1] - candidate[1]], awayFrom);
    const sign = away === outward ? 1 : -1;

    return {
      x: anchor[0] + candidate[0] * offset * sign,
      y: anchor[1] + candidate[1] * offset * sign,
      angle: (Math.atan2(run[1], run[0]) * 180) / Math.PI,
    };
  };

  // Nearest the middle first, then either way along the run: a name at the middle of what is on
  // screen is the one a reader finds without hunting for it.
  const fractions = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74];
  for (const outward of [true, false]) {
    for (const fraction of fractions) {
      const candidate = place(bestLength * fraction, outward);
      if (!inside([candidate.x, candidate.y])) continue;
      if (clear === undefined || clear(candidate)) return candidate;
    }
  }

  // Nowhere clear: fall back to the middle, on the side away from the country. Better a name
  // over land than a boundary drawn differently from every other one and left unexplained.
  return place(bestLength / 2, true);
}
