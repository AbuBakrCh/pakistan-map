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
   * The forms the name may take, longest first — in practice the full name and an abbreviation.
   * Each is tried everywhere along the line before the next is considered, so the name shortens
   * only when the full one has nowhere left to go.
   */
  readonly forms?: readonly LineLabelForm[];
}

/**
 * One way of setting the name, and the two questions asked of every position it could take.
 *
 * The two are deliberately not one predicate. Sitting over drawn land is a compromise; sitting
 * over another name is a defect — it makes two names unreadable instead of one, and `layoutLabels`
 * refuses it for every other name on this map. Bundled together, the only way to place a name at
 * all in a crowded frame is to give up both at once, which is how "LINE OF CONTROL" came to be
 * drawn through "GILGIT-BALTISTAN" and to truncate "Malakand" to "Mal".
 */
export interface LineLabelForm {
  readonly text: string;
  /**
   * Whether the name may be set here at all — in practice, whether it is clear of every name
   * already on the map. Inviolable: no fallback overrides it, and a form with nowhere left that
   * satisfies it gives way to the next, or the name is not drawn.
   */
  readonly permits: (candidate: PlacedLineLabel) => boolean;
  /**
   * Whether this is also somewhere the name *wants* to be — in practice, off the drawn land.
   * Tried first everywhere, then given up, because a name over land still reads.
   *
   * `awayFrom` gets the side right along most of this line and wrong where it matters. The
   * ceasefire line turns east twice, and on those stretches "away from the middle of Pakistan"
   * is north — which is Gilgit-Baltistan, not India.
   */
  readonly prefers?: (candidate: PlacedLineLabel) => boolean;
}

export interface PlacedLineLabel {
  readonly x: number;
  readonly y: number;
  /** Degrees, for an SVG rotate. Never outside ±90, so the name is never upside down. */
  readonly angle: number;
  /** Which form was placed. The caller draws this, not the name it asked for. */
  readonly text: string;
}

type Point = readonly [number, number];

/** No name and nothing to avoid: the geometry alone decides, which is all a test usually wants. */
const ANONYMOUS: readonly LineLabelForm[] = [{ text: '', permits: () => true }];

const distance = (a: Point, b: Point): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

/**
 * Place a name along a line, on the part of it the reader can currently see.
 *
 * Screen space, not geography: the caller hands in the line already projected and already
 * transformed by the zoom, so this re-runs on every zoom frame and the name goes wherever the
 * line has gone. That is what keeps the labelling alive when the reader zooms into one end of
 * it, where a name pinned to the line's true midpoint would simply be off screen.
 *
 * Returns `null` rather than placing a label on a stub, or on a name. Same rule as `layoutLabels`:
 * a name is drawn where it describes something and where it can be read, or it is not drawn. The
 * dash is keyed in the legend under every basis, so a frame too crowded to name the line still
 * explains it.
 */
export function labelAlongLine(
  lines: readonly (readonly Point[])[],
  { bounds, margin, offset, minRun, reach, awayFrom, forms = ANONYMOUS }: LineLabelOptions,
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
  const place = (along: number, outward: boolean, text: string): PlacedLineLabel => {
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
      text,
    };
  };

  // Nearest the middle first, then either way along the run: a name at the middle of what is on
  // screen is the one a reader finds without hunting for it.
  //
  // Walked finely, because the step between candidates is the real cost of refusing to collide.
  // Now that a crowded frame shortens the name rather than overprinting one, a coarse walk spends
  // the full name on the first gap it fails to find — the label has the whole length of the line
  // available and should be made to use it before it concedes anything.
  const fractions = [0.5];
  for (let step = 1; step <= 9; step += 1) {
    fractions.push(0.5 + step * 0.045, 0.5 - step * 0.045);
  }

  // Each form is exhausted before the next is tried, and within a form the preferred ground is
  // exhausted before it is given up. So the order of concessions is: the full name on clear paper,
  // the full name over land, the short name on clear paper, the short name over land — and then
  // nothing. `permits` is never given up at any step, which is the whole point: a name that
  // cannot be set clear of the other names is not set at all.
  for (const form of forms) {
    for (const insist of [true, false]) {
      for (const outward of [true, false]) {
        for (const fraction of fractions) {
          const candidate = place(bestLength * fraction, outward, form.text);
          if (!inside([candidate.x, candidate.y])) continue;
          if (!form.permits(candidate)) continue;
          if (insist && form.prefers !== undefined && !form.prefers(candidate)) continue;
          return candidate;
        }
      }
    }
  }

  return null;
}
