/**
 * How hard to simplify, expressed as the share of points to keep.
 *
 * `topojson-simplify` takes a threshold in the units of its own weights, which are areas and mean
 * nothing to a reader: there is no way to look at `1.4e-7` and know whether it will cost a coast
 * its inlets. What a maintainer can reason about is *what fraction of the points survive*, so the
 * two builds state that and this converts it — the weight at the quantile below which points are
 * dropped.
 *
 * Shared rather than copied. Both the geometry build and the context build simplify, they had the
 * same function twice byte for byte, and neither copy was reachable from a test because both sat
 * in a script. A retained fraction is the one knob that decides whether a border keeps its shape,
 * so the arithmetic behind it should be the kind of thing the suite can hold.
 */

interface WeightedTopology {
  readonly arcs: readonly (readonly (readonly [number, number, number?])[])[];
}

/**
 * The threshold that retains `fraction` of the topology's simplification weights.
 *
 * Expects a topology already run through `presimplify`, which is what puts a weight in each
 * point's third slot. A topology with no weights at all returns 0 — simplifying nothing — rather
 * than throwing: it is what an empty or already-simplified input honestly deserves, and a build
 * that wanted geometry has louder ways to find out it has none.
 */
export function thresholdFor(topo: unknown, fraction: number): number {
  const weights: number[] = [];
  for (const arc of (topo as WeightedTopology).arcs) {
    for (const point of arc) if (point[2] !== undefined) weights.push(point[2]);
  }
  if (weights.length === 0) return 0;
  weights.sort((a, b) => a - b);
  const index = Math.floor((1 - fraction) * (weights.length - 1));
  return weights[index] ?? 0;
}
