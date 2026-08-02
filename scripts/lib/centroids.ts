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
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';
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
  // `topojson-client` types `feature` as returning a feature *or* a collection depending on the
  // object it is handed, and it cannot know which from a `GeometryObject` typed this widely; the
  // districts object is a `GeometryCollection`, so the answer is a `FeatureCollection`.
  const collection = feature(topology, object) as FeatureCollection<Geometry, GeoJsonProperties>;
  const found = new Map<string, Centroid>();
  for (const shape of collection.features) {
    const name = shape.properties?.['name'];
    if (typeof name !== 'string') {
      throw new Error(
        `the geography bundle draws a district with no \`name\` property (${describe(shape)}), so ` +
          'there is nothing to key its centroid on. Skipping it would drop a district out of ' +
          'every distance rule silently, which is how the district set drifts.',
      );
    }
    // `geoCentroid` takes d3-geo's own `ExtendedFeature`, whose `geometry` excludes
    // `GeometryCollection`; a GeoJSON `Feature<Geometry>` does not narrow to it.
    found.set(name, geoCentroid(shape as never) as Centroid);
  }
  return found;
}

/** Enough of a nameless feature to find it in the artifact, since its name is what is missing. */
function describe(shape: Feature<Geometry, GeoJsonProperties>): string {
  const id = shape.id === undefined ? 'no id' : `id ${String(shape.id)}`;
  return `${id}, ${shape.geometry?.type ?? 'no geometry'}`;
}
