/**
 * District centroids, read off the geometry the map is actually drawn with (#28).
 *
 * One variant needs them — A4 states its rule as a distance to a capital — and three callers have
 * to agree about them: the build that bakes the variant, the suite that re-derives it, and the
 * engine test that measures the result back. A centroid computed two ways is two centroids, and a
 * distance rule is exactly the kind of constraint that would pass its own re-derivation while
 * disagreeing with the map by a district. So the derivation lives here once.
 *
 * `geoCentroid` and not a bounding-box middle: a district's box centre can fall outside the
 * district, and Balochistan is full of shapes where it would. The rule is nonetheless measured
 * centroid to centroid rather than town to town, which is a real approximation and is stated on
 * A4's card rather than buried here — a centroid is not where anybody lives.
 */

import { geoCentroid } from 'd3';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { Centroid } from './partitioner.ts';

/**
 * Every district the geography bundle draws, mapped to its centroid.
 *
 * Keyed on the same `name` property every other artifact joins on, so a centroid and a census row
 * and an adjacency entry are about the same district by construction rather than by a match.
 */
export function districtCentroids(topology: Topology): ReadonlyMap<string, Centroid> {
  const object = topology.objects['districts'];
  if (object === undefined) {
    throw new Error(
      'the geography bundle has no `districts` collection, so there is nothing to take a centroid ' +
        'of. A distance rule measured against nothing would place every district at the capital.',
    );
  }
  const collection = feature(topology, object) as unknown as {
    readonly features: readonly { readonly properties: Record<string, unknown> }[];
  };
  const found = new Map<string, Centroid>();
  for (const shape of collection.features) {
    const name = shape.properties['name'];
    if (typeof name !== 'string') continue;
    found.set(name, geoCentroid(shape as never) as unknown as Centroid);
  }
  return found;
}
