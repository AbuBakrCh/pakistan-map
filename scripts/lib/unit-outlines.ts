/**
 * One outline per unit, dissolved out of the districts the unit is made of (#15).
 *
 * A variant states its claim in districts, because that is how every real proposal in Pakistan is
 * stated (D23). It has to *draw* as provinces do — one line round the outside, no internal
 * borders — or a proposal reads as a cluster of districts rather than as the province it argues
 * for.
 *
 * The dissolve is done on **arcs, not on polygons**. The geography bundle merges its three tiers
 * out of a single shared arc set, so a district boundary and the division boundary running along
 * it are literally the same arc; a unit outline cut the same way is exact by construction. Two
 * districts that share an edge share the arc, the arc is used twice, and dropping the arcs used
 * twice leaves the outside edge and nothing else. The alternative — unioning district polygons
 * geometrically — would rebuild every vertex on the way through and leave the slivers and
 * hairline seams the acceptance criteria forbid, at whatever precision the clipper happened to
 * work to.
 *
 * Everything here is pure and topological: no filesystem, no variants, no names. What it knows is
 * arcs. `scripts/build-scenarios.ts` supplies the districts, and names the unit when something is
 * wrong — a failure that says only how many arcs disagreed is a failure nobody can act on.
 */

import { geoArea } from 'd3';
import { feature, mergeArcs } from 'topojson-client';
import type { MultiPolygon, Topology } from 'topojson-specification';

/** Arc indices, nested as a Polygon nests them one deep and a MultiPolygon two. */
export type NestedArcs = readonly (number | NestedArcs)[];

/**
 * What a unit dissolves from: a district's geometry, described by the only two things this
 * module reads off it. Structural rather than `Polygon | MultiPolygon` from the TopoJSON types,
 * which are parameterised by their properties and so do not accept a geometry read back out of a
 * parsed bundle without a cast at every call site.
 */
export interface PolygonalGeometry {
  readonly type: 'Polygon' | 'MultiPolygon';
  readonly arcs: NestedArcs;
}

/**
 * How far a dissolved outline's area may sit from its members' total.
 *
 * The two are the same number, not two measurements of one thing: the members are disjoint, they
 * share arcs exactly, and the merge only ever *drops* arcs — so the arithmetic is spherical area
 * over the identical set of coordinates. Measured across the committed bundle the largest
 * disagreement is one unit in the last place of a double (2.2e-16 relative, on Balochistan's 199
 * pieces). This threshold is seven orders of magnitude above that and still far below anything a
 * real defect could produce: a single lost district moves a unit by percent, not by parts per
 * billion. It is a floating-point allowance, deliberately not a geometric tolerance.
 */
export const AREA_AGREEMENT = 1e-9;

/** Steradians -> km², the unit every other area in this project is quoted in. */
const KM2_PER_STERADIAN = 6371 * 6371;

/** An arc index and its reverse (`~i`) are the same edge, drawn from the two sides that share it. */
const absolute = (index: number): number => (index < 0 ? ~index : index);

function walk(arcs: unknown, visit: (index: number) => void): void {
  if (typeof arcs === 'number') visit(absolute(arcs));
  else if (Array.isArray(arcs)) for (const child of arcs) walk(child, visit);
}

/** Every arc a geometry uses, each once, ascending. Direction is discarded. */
export function arcsOf(geometry: PolygonalGeometry): readonly number[] {
  const found = new Set<number>();
  walk(geometry.arcs, (index) => found.add(index));
  return [...found].sort((a, b) => a - b);
}

/** How many of the given geometries use each arc. One means an outside edge, two an internal one. */
export function arcUses(geometries: readonly PolygonalGeometry[]): ReadonlyMap<number, number> {
  const uses = new Map<number, number>();
  for (const geometry of geometries) {
    for (const index of arcsOf(geometry)) uses.set(index, (uses.get(index) ?? 0) + 1);
  }
  return uses;
}

const arcsUsed = (
  geometries: readonly PolygonalGeometry[],
  keep: (times: number) => boolean,
): readonly number[] =>
  [...arcUses(geometries)]
    .filter(([, times]) => keep(times))
    .map(([index]) => index)
    .sort((a, b) => a - b);

/** The arcs exactly one member uses: the outside edge of the set, and what a dissolve keeps. */
export const boundaryArcs = (geometries: readonly PolygonalGeometry[]): readonly number[] =>
  arcsUsed(geometries, (times) => times === 1);

/** The arcs two members share: the internal borders a dissolve exists to remove. */
export const interiorArcs = (geometries: readonly PolygonalGeometry[]): readonly number[] =>
  arcsUsed(geometries, (times) => times > 1);

/**
 * How many disjoint pieces the outline draws as.
 *
 * **Not a contiguity measure**, and must not be read as one. An island is a piece of its own, so
 * every unit holding a stretch of the Makran or Sindh coast counts in the dozens — Balochistan
 * draws as 199 pieces and is one province. Contiguity is a question about the adjacency graph
 * (#16), asked of the districts, not of the polygons.
 */
export const polygonsOf = (outline: MultiPolygon): number => outline.arcs.length;

/** km² of a geometry in a topology, measured spherically, as every other area here is. */
export const areaKm2 = (topology: Topology, geometry: PolygonalGeometry): number =>
  geoArea(feature(topology, geometry as never) as never) * KM2_PER_STERADIAN;

/**
 * Merge a unit's districts into one outline.
 *
 * A thin name over `topojson-client`'s `mergeArcs`, kept so that the one operation this module
 * exists for is spelled once and the reason for it lives next to it. The result is always a
 * MultiPolygon, with one polygon per connected group of members and the outer ring of each group
 * first.
 */
export const dissolve = (
  topology: Topology,
  members: readonly PolygonalGeometry[],
): MultiPolygon => mergeArcs(topology, members as Parameters<typeof mergeArcs>[1]);

/** Rings that do not return to where they started — an outline with a gap in it. */
export function unclosedRings(topology: Topology, outline: MultiPolygon): readonly string[] {
  const drawn = feature(topology, outline as never) as unknown as {
    geometry: { coordinates: [number, number][][][] };
  };
  const torn: string[] = [];
  drawn.geometry.coordinates.forEach((polygon, p) => {
    polygon.forEach((ring, r) => {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first === undefined || last === undefined) {
        torn.push(`polygon ${p} ring ${r} is empty`);
        return;
      }
      if (first[0] !== last[0] || first[1] !== last[1]) {
        torn.push(
          `polygon ${p} ring ${r} does not close: it starts at ${first.join(', ')} and ends at ` +
            `${last.join(', ')}`,
        );
      }
    });
  });
  return torn;
}

/**
 * Check a dissolved outline against the union of the districts it came from — the acceptance
 * criterion the whole of this module answers to.
 *
 * Three independent readings of the same claim, because each catches what the others cannot:
 *
 *  - **Arcs.** The outline's arcs must be exactly the members' boundary arcs. An interior arc
 *    left in is a district border drawn inside a province; an arc no member owns is territory
 *    from somewhere else; a boundary arc missing is a hole in the outline. Each is named.
 *  - **Area.** The outline must measure what the members measure, to floating point. This is the
 *    reading that notices a member silently absent, which the arc check alone would call
 *    consistent — a dissolve of ten districts out of eleven is perfectly well formed.
 *  - **Closure.** Every ring must return to where it started, which neither of the above can see.
 *
 * `label` is how the caller names the unit; every message carries it, so a failure says which
 * unit of which variant rather than only that one of them is wrong.
 */
export function outlineProblems(
  label: string,
  topology: Topology,
  members: readonly PolygonalGeometry[],
  outline: MultiPolygon,
): readonly string[] {
  const problems: string[] = [];

  const expected = new Set(boundaryArcs(members));
  const interior = new Set(interiorArcs(members));
  const drawn = new Set(arcsOf(outline));

  const named = (arcs: readonly number[]): string => arcs.map((a) => `arc ${a}`).join(', ');

  const survived = [...drawn].filter((arc) => interior.has(arc));
  if (survived.length > 0) {
    problems.push(
      `${label} keeps ${named(survived)}, an internal border between two of its own districts. ` +
        `Dissolving is what removes those; one left in draws a district line inside a province.`,
    );
  }
  const foreign = [...drawn].filter((arc) => !expected.has(arc) && !interior.has(arc));
  if (foreign.length > 0) {
    problems.push(
      `${label} draws ${named(foreign)}, which none of its districts uses. The outline is not ` +
        `made of the ground the unit claims.`,
    );
  }
  const lost = [...expected].filter((arc) => !drawn.has(arc));
  if (lost.length > 0) {
    problems.push(
      `${label} drops ${named(lost)} from its own outside edge, leaving a gap in the outline.`,
    );
  }

  const dissolved = areaKm2(topology, outline);
  const union = members.reduce((sum, member) => sum + areaKm2(topology, member), 0);
  if (union === 0 || Math.abs(dissolved / union - 1) > AREA_AGREEMENT) {
    problems.push(
      `${label} measures ${dissolved.toFixed(3)} km² dissolved against ${union.toFixed(3)} km² ` +
        `across its districts. The two are the same coordinates and must agree to floating ` +
        `point; a difference this size means the outline is not the union of its members.`,
    );
  }

  problems.push(...unclosedRings(topology, outline).map((torn) => `${label} ${torn}`));

  return problems;
}
