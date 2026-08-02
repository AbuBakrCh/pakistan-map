/**
 * Which districts share a border, and whether a unit's districts hang together (#16).
 *
 * Contiguity is one of the few *objective* things that can be said about a redistricting proposal
 * — every other line on a variant card is somebody's argument — so the app states it. It states
 * it and does not act on it: a unit in two pieces is flagged, never rejected (D7). Hard
 * enforcement would refuse real proposals, and refusing to draw a claim is a stronger editorial
 * act than drawing it with a note.
 *
 * The graph is built from **shared arcs, not from geometric intersection**, on exactly the
 * reasoning that governs the dissolve next door in `unit-outlines.ts`. The geography bundle draws
 * all three administrative tiers out of one shared arc set, so where two districts touch, the edge
 * between them *is one arc*, used once from each side. Adjacency is therefore a set question with
 * an exact answer, asked of integers: two districts are neighbours iff some arc index appears in
 * both. Testing polygons for intersection would ask the same question of floating-point
 * coordinates and get an answer that depends on a tolerance — two districts a millimetre apart
 * after simplification would come out as strangers, and a proposal would be reported as broken
 * because a clipper rounded.
 *
 * That the coastline clip does not disturb this is worth stating rather than hoping: a coastal
 * district's *seaward* arcs are its own and shared with nobody, but the clip only ever replaced
 * the seaward part of a ring, so its inland arcs — the ones its neighbours use — survive the clip
 * and the topology unchanged. Measured over the committed bundle, all 156 drawn districts form a
 * single connected component and not one is isolated, coastal or otherwise. Islands are the
 * mirror of the same point: Karachi South's offshore pieces are polygons of their own and share no
 * arc with anything, which is why the number of polygons a unit *draws* as and the number of
 * pieces it *is* are two different numbers — see `polygonsOf`.
 *
 * Pure and topological, like its neighbour module: no filesystem, no variants, no geometry beyond
 * arc indices. `scripts/build-scenarios.ts` supplies the districts and names the unit when
 * something is wrong.
 */

import { arcsOf, type PolygonalGeometry } from './unit-outlines.ts';

/** A district as this module needs it: a name to report, and arcs to compare. */
export interface NamedGeometry {
  readonly name: string;
  readonly geometry: PolygonalGeometry;
}

/** District -> its neighbours, each named once, ascending. Symmetric by construction. */
export type AdjacencyGraph = ReadonlyMap<string, readonly string[]>;

/**
 * Which districts use each arc.
 *
 * The whole derivation, before it is turned round. In a well-formed topology every arc is used by
 * one district (an outside edge — a frontier, a coast, an island) or by two (a shared border).
 * Three would mean an arc had not been cut where three districts meet, and the map would have a
 * border that belongs to more than two sides; the committed bundle has none, and
 * `adjacencyProblems` says so by name rather than by count if that ever changes.
 */
export function arcOwners(districts: readonly NamedGeometry[]): ReadonlyMap<number, readonly string[]> {
  const owners = new Map<number, string[]>();
  for (const { name, geometry } of districts) {
    for (const arc of arcsOf(geometry)) {
      const found = owners.get(arc);
      if (found === undefined) owners.set(arc, [name]);
      else found.push(name);
    }
  }
  return owners;
}

/** The adjacency graph: two districts are neighbours iff they share an arc. */
export function buildAdjacency(districts: readonly NamedGeometry[]): AdjacencyGraph {
  const neighbours = new Map<string, Set<string>>();
  for (const { name } of districts) neighbours.set(name, new Set());

  for (const owners of arcOwners(districts).values()) {
    for (const a of owners) {
      for (const b of owners) {
        // A district that uses an arc twice — the two sides of a pinch — is not its own neighbour.
        if (a !== b) neighbours.get(a)?.add(b);
      }
    }
  }

  return new Map(
    [...neighbours].map(([name, found]) => [name, [...found].sort((x, y) => x.localeCompare(y))]),
  );
}

/** Undirected edges: each shared border counted once, not twice. */
export const edgeCount = (graph: AdjacencyGraph): number =>
  [...graph.values()].reduce((n, found) => n + found.length, 0) / 2;

/**
 * Districts with no neighbour at all.
 *
 * Not an error in principle — a district entirely surrounded by sea would be one, honestly — but
 * there is none on this map, and one appearing would far more likely mean a district had been cut
 * loose from the topology than that Pakistan had grown an island province. Reported by name so the
 * suite can hold the list empty and say which district if it is not.
 */
export const isolatedDistricts = (graph: AdjacencyGraph): readonly string[] =>
  [...graph].filter(([, found]) => found.length === 0).map(([name]) => name);

/**
 * The structural invariants of the graph, each violation named.
 *
 * None of these can happen by construction — which is the reason to check them: the derivation is
 * eleven lines and the artifact is read by things that will assume all three. A graph that has
 * quietly become asymmetric reports a unit as contiguous from one district and not from another.
 */
export function adjacencyProblems(
  graph: AdjacencyGraph,
  districts: readonly NamedGeometry[],
): readonly string[] {
  const problems: string[] = [];

  const known = new Set(districts.map((d) => d.name));
  for (const name of graph.keys()) {
    if (!known.has(name)) problems.push(`${name} is in the graph but is not a drawn district.`);
  }
  for (const name of known) {
    if (!graph.has(name)) problems.push(`${name} is drawn but has no entry in the graph.`);
  }

  for (const [name, found] of graph) {
    if (found.includes(name)) problems.push(`${name} is listed as its own neighbour.`);
    if (new Set(found).size !== found.length) {
      problems.push(`${name} lists a neighbour twice, so its degree overcounts.`);
    }
    for (const other of found) {
      if (!known.has(other)) {
        problems.push(`${name} names ${other} as a neighbour, which is not a drawn district.`);
        continue;
      }
      if (!(graph.get(other) ?? []).includes(name)) {
        problems.push(
          `${name} names ${other} as a neighbour but ${other} does not name ${name}. A shared ` +
            `border is one arc seen from both sides; asymmetry means the graph was not derived ` +
            `from it.`,
        );
      }
    }
  }

  for (const [arc, owners] of arcOwners(districts)) {
    if (owners.length > 2) {
      problems.push(
        `arc ${arc} is used by ${owners.join(', ')} — more than two districts. An arc is a ` +
          `border between two sides; one shared by three was not cut where they meet.`,
      );
    }
  }

  return problems;
}

/**
 * How a set of districts falls apart, if it does.
 *
 * `components` is every connected group, each named and sorted, the groups themselves ordered
 * largest first and ties broken on the first name — so a rebuild of the same bundle writes the
 * same artifact, and a diff in it means the ground moved.
 */
export interface Contiguity {
  readonly contiguous: boolean;
  /** How many connected groups the districts form. One is contiguous; the flag says so anyway. */
  readonly pieces: number;
  readonly components: readonly (readonly string[])[];
  /**
   * Every group but the largest, named. Empty for a contiguous unit — which is why the card can
   * render this without asking, and why a contiguous unit costs the artifact nothing. The
   * districts a reader wants named are the ones stranded away from the body of the unit, not the
   * body itself.
   */
  readonly detached: readonly (readonly string[])[];
}

/**
 * Walk the graph over a unit's own districts, and report the groups.
 *
 * The walk is confined to `members`: a unit's districts may each have neighbours outside the unit
 * — almost all of them do — and following those would find every unit contiguous, since the whole
 * map is one component. Membership is what makes the question about the proposal rather than
 * about Pakistan.
 *
 * A district the graph has never heard of is its own piece rather than an exception, so a unit
 * built on a name the geometry does not draw reads as maximally broken instead of silently
 * dropping ground. The build fails on that name long before it gets here; this is what happens if
 * it ever does not.
 */
export function contiguityOf(graph: AdjacencyGraph, members: readonly string[]): Contiguity {
  const remaining = new Set(members);
  const components: string[][] = [];

  for (const start of members) {
    if (!remaining.has(start)) continue;
    remaining.delete(start);
    const queue = [start];
    const component: string[] = [];
    while (queue.length > 0) {
      const district = queue.pop() as string;
      component.push(district);
      for (const other of graph.get(district) ?? []) {
        if (remaining.delete(other)) queue.push(other);
      }
    }
    components.push(component.sort((a, b) => a.localeCompare(b)));
  }

  components.sort(
    (a, b) => b.length - a.length || (a[0] ?? '').localeCompare(b[0] ?? ''),
  );

  return {
    contiguous: components.length <= 1,
    pieces: components.length,
    components,
    detached: components.slice(1),
  };
}

/** One sentence for a build log or a card, naming the stranded districts rather than counting. */
export function describeContiguity(label: string, contiguity: Contiguity): string {
  if (contiguity.contiguous) return `${label} is contiguous.`;
  return (
    `${label} is in ${contiguity.pieces} pieces; ` +
    contiguity.detached
      .map((group) => `${group.join(', ')} ${group.length === 1 ? 'touches' : 'touch'} none of it`)
      .join('; ') +
    '. Flagged, not rejected (D7).'
  );
}
