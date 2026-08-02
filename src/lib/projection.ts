/**
 * The map's projection: a Lambert conformal conic cut for Pakistan, fitted to the viewport.
 *
 * There is no basemap and no tile server (D11), so nothing forces Web Mercator on us and there
 * is no reason to accept it: at 24–37°N it inflates the north relative to the south, which on a
 * map whose whole subject is how big one province is against another is a distortion in exactly
 * the dimension being read. A conformal conic with its standard parallels inside the country
 * keeps shape locally and keeps area error small across the span actually drawn — the ordinary
 * atlas choice for a mid-latitude country wider than it is tall.
 *
 * Every parameter is derived from the geometry handed in rather than typed as a constant, so
 * the projection follows the bundle. If the drawn extent ever changes — a territory added, the
 * coastline reclipped — the cone re-cuts itself instead of quietly going stale.
 */

import { geoConicConformal, geoBounds, type GeoProjection } from 'd3';
import type { GeoGeometryObjects } from 'd3-geo';

/**
 * The frame inset, in px — proportional, capped at both ends.
 *
 * A fixed 36px inset would cost a 390px phone a fifth of its map; a fixed 12px would crowd a
 * desktop frame. Here rather than in `map.ts` because the test seam needs the same number: a suite
 * that re-implements the renderer's inset measures a frame the app never draws, and would go on
 * passing after the renderer changed it. `map.ts` imports it from here.
 */
export const frameInset = (width: number): number => Math.max(12, Math.min(36, width * 0.05));

export interface Viewport {
  readonly width: number;
  readonly height: number;
  /** Breathing room at the frame's edge, in px. Labels near the border need it. */
  readonly padding: number;
}

/**
 * Standard parallels at 1/6 and 5/6 of the latitude span — the classic secant cut, which
 * balances the scale error between the two parallels against the error beyond them instead of
 * loading it all onto one edge.
 */
export function standardParallels(south: number, north: number): [number, number] {
  const span = north - south;
  return [south + span / 6, north - span / 6];
}

export function fitProjection(
  features: GeoGeometryObjects | GeoJSON.GeoJsonObject,
  viewport: Viewport,
): GeoProjection {
  const [[west, south], [east, north]] = geoBounds(features as GeoGeometryObjects);
  const { width, height, padding } = viewport;

  return geoConicConformal()
    .parallels(standardParallels(south, north))
    // Rotating the central meridian to 0 rather than passing it as a centre keeps the cone
    // symmetric about the country: east and west edges distort by the same amount.
    .rotate([-(west + east) / 2, 0])
    .center([0, (south + north) / 2])
    .fitExtent(
      [
        [padding, padding],
        [width - padding, height - padding],
      ],
      features as GeoGeometryObjects,
    );
}
