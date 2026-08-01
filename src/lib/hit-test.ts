/**
 * Which district the pointer is over.
 *
 * Asked of the geometry rather than of the DOM, on purpose. The browser would answer it for free
 * from the district paths — but only while those paths are drawn and taking pointer events, and
 * stratum 1 is `display: none` on the baseline (D14, and the basis selector is #18's). Hover has
 * to work under every basis and under none, so the question is put to the same polygons the map
 * draws, in lon/lat, before anything about strata or CSS is involved.
 *
 * Which makes it pure, and therefore testable against the real bundle — `src/map.ts` carries no
 * tests, so a decision left in there is a decision nothing checks.
 *
 * Two stages, and the first one is the whole performance story. `geoContains` against all 156
 * drawn districts costs on the order of 20 ms per pointer move, which is three frames dropped on
 * every mouse movement; against the districts whose bounding box actually contains the point it
 * costs a fraction of a millisecond. The boxes are computed once, at construction.
 */

import { geoBounds, geoContains } from 'd3';
import type { DistrictProperties, Tier } from './geography.ts';

export type DistrictFeature = Tier<DistrictProperties>['features'][number];

/** A district's lon/lat bounding box, kept next to the feature it belongs to. */
interface Boxed {
  readonly feature: DistrictFeature;
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

export interface DistrictLocator {
  /** The district containing the point, or null — the sea, or across a border. */
  at(point: readonly [number, number]): DistrictFeature | null;
  /**
   * The bounding-box shortlist a point costs, by name. Part of the contract rather than an
   * internal: the claim that hover is fast *is* the claim that this list is short, and a claim
   * the suite cannot see is a claim nobody can keep.
   */
  candidates(point: readonly [number, number]): readonly string[];
}

export function districtLocator(districts: Tier<DistrictProperties>): DistrictLocator {
  const boxed: Boxed[] = districts.features.map((feature) => {
    const [[west, south], [east, north]] = geoBounds(feature as never);
    return { feature, west, south, east, north };
  });

  const shortlist = (point: readonly [number, number]): Boxed[] => {
    const [lon, lat] = point;
    return boxed.filter(
      (box) => lon >= box.west && lon <= box.east && lat >= box.south && lat <= box.north,
    );
  };

  return {
    at(point) {
      // Ordinary point-in-polygon after the shortlist: districts do not overlap, so the first
      // containing polygon is the only one, and there is nothing to arbitrate between.
      for (const box of shortlist(point)) {
        if (geoContains(box.feature as never, point as [number, number])) return box.feature;
      }
      return null;
    },
    candidates(point) {
      return shortlist(point).map((box) => box.feature.properties.name);
    },
  };
}
