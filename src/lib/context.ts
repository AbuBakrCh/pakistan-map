/**
 * The map's geographic context: what is across each border, and where the reader is (#8).
 *
 * Two things that are furniture rather than subject. The neighbour silhouettes exist so that
 * Pakistan's outline — and the dashed Line of Control most of all — has something on the far side
 * of it: a boundary against blank paper reads as a coast, and the one place this map cannot afford
 * to be misread is Kashmir. The city dots exist because there is no basemap (D11), so a reader
 * with no dot to hang a name on has only the boundaries to orient by.
 *
 * Both are held to being subordinate *structurally*, not just by styling. They come from a
 * different bundle, which shares no arc with the country's; they are read here and handed to the
 * renderer as inert shapes; and nothing anywhere asks them a question — hover is put to the
 * district polygons in lon/lat (`hit-test.ts`), so a silhouette cannot answer for ground it covers
 * even if the stylesheet forgot to say `pointer-events: none`.
 */

import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry, MultiPolygon, Point, Polygon } from 'geojson';
import type { Topology } from 'topojson-specification';

export interface NeighbourProperties {
  readonly iso: string;
  readonly name: string;
  /** Which stretch of Pakistan's own outline this country lies across. */
  readonly faces: string;
}

/** What a dot is the seat of, so the dot and the unit are joined rather than merely adjacent. */
export interface CityProperties {
  readonly name: string;
  readonly of: string;
  readonly kind: 'province' | 'territory' | 'capital';
  readonly osmNode: number;
}

export type Silhouettes = FeatureCollection<Polygon | MultiPolygon, NeighbourProperties>;
export type Cities = FeatureCollection<Point, CityProperties>;

/**
 * What the context bundle says about itself, and the only part of it the page prints.
 *
 * The Durand note is here rather than in the renderer for the same reason the ceasefire line's
 * note is in the geography bundle: the caveat travels with the geometry, so it cannot be lost
 * while the line it qualifies is still on screen.
 */
/**
 * A footnote a drawn boundary carries, with the provenance every surface in this app carries.
 *
 * Declared here rather than imported from `scripts/lib/neighbours.ts`: the runtime reads the
 * committed bundle and never reaches into the build, so the two halves agree by the artifact
 * between them. `badge` is the closed vocabulary's `documented` — the note asserts only dated
 * documents, which is the same ground the Historical basis stands on.
 */
export interface BoundaryNote {
  readonly text: string;
  readonly source: string;
  readonly badge: 'documented';
}

export interface ContextProvenance {
  readonly sources: Readonly<Record<string, string>>;
  readonly neighbours: {
    readonly method: string;
    readonly kashmir: string;
    readonly countries: readonly NeighbourProperties[];
    readonly boundaryNotes: Readonly<Record<string, BoundaryNote>>;
  };
  readonly cities: {
    readonly criterion: string;
    /** Why the criterion is administrative rather than demographic. */
    readonly why: string;
    /** The larger cities the criterion leaves off, named so the omission reads as a rule. */
    readonly omits: string;
    readonly badge: string;
    readonly join: string;
    readonly count: number;
  };
}

export function readSilhouettes(topology: Topology): Silhouettes {
  return read<NeighbourProperties, Polygon | MultiPolygon>(topology, 'neighbours');
}

export function readCities(topology: Topology): Cities {
  return read<CityProperties, Point>(topology, 'cities');
}

function read<P, G extends Geometry>(topology: Topology, object: string): FeatureCollection<G, P> {
  const geometry = topology.objects[object];
  if (geometry === undefined) {
    throw new Error(
      `The context bundle has no ${object}. It is a committed artifact and both of its objects ` +
        `are drawn, so a missing one is a build that did not finish, not a layer to skip.`,
    );
  }
  return feature(topology, geometry as never) as unknown as FeatureCollection<G, P>;
}

/**
 * The footnote the Durand Line carries.
 *
 * The line itself is drawn as an ordinary international boundary — solid, at province weight,
 * with no rule of its own anywhere in the renderer. That is the decision, not an oversight: the
 * dash means *ceasefire line* (D12), and spending it on a disputed international boundary would
 * tell a reader the two are the same kind of thing. What the dispute gets instead is this, in
 * words, under the map.
 *
 * Returned by ISO code rather than by country name so the call site cannot drift onto a spelling.
 * The note arrives with its source and its badge attached rather than as bare prose, because a
 * footnote is a surface and this app sources every surface it draws.
 */
export function boundaryNote(provenance: ContextProvenance, iso: string): BoundaryNote | null {
  return provenance.neighbours.boundaryNotes[iso] ?? null;
}
