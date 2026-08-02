/**
 * Stratum 3 — the active variant's units, read off the committed outline bundle (#18).
 *
 * The outlines were dissolved at build time (#15) and carry **no arcs of their own**: each is a
 * list of arc indices into `geography.topojson.json`. That is the property that keeps a unit
 * outline and the district boundary under it from ever coming apart, and it is why this module
 * exists rather than a `feature()` call at the point of use — the two files have to be married
 * before either can be drawn, and married to *each other* rather than to whatever geometry
 * happens to be sitting beside them.
 *
 * So the first thing here is not a read but a check. The outline bundle records the geometry
 * build it was cut against; if that is not the geometry it is being handed, the arc indices point
 * at whatever edges now hold those positions, and every unit on screen is silently wrong in a way
 * no rendering error would show. The suite holds the same property over the committed pair
 * (`bundle.test.ts`); this holds it at the one moment the two are actually joined.
 */

import type { Feature, FeatureCollection, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import type { GeometryObject, Topology } from 'topojson-specification';
import { feature } from 'topojson-client';
import type {
  UnitKind,
  UnitOutlineBundle,
  UnitOutlineProperties,
  UnitRecord,
  VariantRecord,
} from '../bundle.ts';
import { linesFromArcs } from './geography.ts';
import { arcsOf } from './line-of-control.ts';

export type UnitTier = FeatureCollection<Polygon | MultiPolygon, UnitOutlineProperties>;

/** The geography bundle as this module needs it: arcs to draw with, and the stamp to check. */
export type StampedTopology = Topology & {
  readonly provenance?: { readonly generated?: string };
};

/**
 * One variant's units, as drawable features.
 *
 * Throws rather than falling back, on the same reasoning as `readGeography`: an outline set that
 * does not belong to this geometry draws a province over the wrong ground, and a variant the
 * bundle has never heard of is a selector offering something that was not built. Both are bundles
 * to be fixed, not rendered around.
 */
export function readUnitOutlines(
  geography: StampedTopology,
  outlines: UnitOutlineBundle,
  variantId: string,
): UnitTier {
  const cutAgainst = outlines.provenance.geography;
  const stamp = geography.provenance?.generated;
  if (stamp !== cutAgainst.generated) {
    throw new Error(
      `The unit outlines were cut against the geometry built at ${cutAgainst.generated}, and the ` +
        `geography bundle here was built at ${stamp ?? 'an unrecorded time'}. They carry arc ` +
        `indices and no arcs, so a mismatched pair draws every unit against whatever edges now ` +
        `hold those positions. Rebuild the outlines.`,
    );
  }
  if (geography.arcs.length !== cutAgainst.arcs) {
    throw new Error(
      `The unit outlines were cut against ${cutAgainst.arcs} arcs and this geography has ` +
        `${geography.arcs.length}. Same reasoning as the timestamp: the indices no longer mean ` +
        `what they meant.`,
    );
  }

  const object = outlines.objects[variantId];
  if (object === undefined) {
    throw new Error(
      `The outline bundle has no units for variant "${variantId}". Every variant in ` +
        `scenarios.json is dissolved at build time; a selector offering one that was not built ` +
        `is a bundle half-written.`,
    );
  }

  return feature(geography, object as never) as unknown as UnitTier;
}

/** A unit's outline as line work: what is actually stroked, and what it is a boundary of. */
export interface UnitBoundary {
  readonly properties: UnitOutlineProperties;
  readonly lines: Feature<MultiLineString, null>;
}

/**
 * Each unit's outline **by arc**, with a set of arcs held out — and the reason this exists at all.
 *
 * Stroking the dissolved polygons would be the obvious thing and would draw a solid line along
 * the Line of Control. Azad Jammu & Kashmir is a unit in every variant (it is carried through
 * intact), the ceasefire line is part of its outline, and a heavy solid stroke over the dash
 * fills the gaps in and leaves a line that looks like an international border — the one thing
 * this map must not draw (D12). The province stratum solved this by drawing arcs rather than
 * shapes; stratum 3 has to solve it the same way, because it is drawn *over* the top.
 *
 * The held-out arcs are the caller's to name — `map.ts` passes the ceasefire line's — so this
 * module states the mechanism and nothing about which stretch of border is special.
 */
export function unitBoundaries(
  geography: StampedTopology,
  outlines: UnitOutlineBundle,
  variantId: string,
  without: ReadonlySet<number>,
): readonly UnitBoundary[] {
  const object = outlines.objects[variantId];
  if (object === undefined) throw new Error(`The outline bundle has no units for "${variantId}"`);

  return object.geometries.map((geometry) => ({
    properties: geometry.properties as UnitOutlineProperties,
    lines: linesFromArcs(
      geography,
      [...arcsOf(geometry as unknown as GeometryObject)].filter((arc) => !without.has(arc)),
    ),
  }));
}

/**
 * Which unit each district belongs to under a variant.
 *
 * Keyed on the district name the geometry uses, which is what the hover has in hand. Built from
 * the *resolved* district list and never from the claim: the claim may name Taunsa, and the
 * district under the pointer is Dera Ghazi Khan.
 */
export function unitByDistrict(variant: VariantRecord): ReadonlyMap<string, UnitRecord> {
  const owner = new Map<string, UnitRecord>();
  for (const unit of variant.units) {
    for (const district of unit.districts) owner.set(district, unit);
  }
  return owner;
}

/** The swatch a legend entry wears — the same three classes the outlines are drawn with. */
export type UnitSwatch = 'unit-proposed' | 'unit-unchanged' | 'unit-territory';

export interface UnitLegendEntry {
  readonly label: string;
  readonly swatch: UnitSwatch;
}

/**
 * The key for stratum 3, derived from the variant rather than typed.
 *
 * Only the kinds a variant actually contains get an entry, and the proposed units are named in
 * it: on a map where the accent means *this is the proposal*, a reader has to be able to find
 * which shape that is without hovering. The "not official" clause is not decoration — a heavy
 * coloured province outline is exactly the surface that travels as a screenshot (D22).
 */
export function unitLegend(variant: VariantRecord): readonly UnitLegendEntry[] {
  const named = (kind: UnitKind): string[] =>
    variant.units.filter((unit) => unit.kind === kind).map((unit) => unit.name);

  const proposed = named('proposed');
  const entries: UnitLegendEntry[] = [];
  if (proposed.length > 0) {
    entries.push({
      label: `Proposed — ${proposed.join(', ')}. Not official.`,
      swatch: 'unit-proposed',
    });
  }
  if (named('unchanged').length > 0) {
    entries.push({ label: 'Unchanged — as the map stands today', swatch: 'unit-unchanged' });
  }
  if (named('territory').length > 0) {
    entries.push({
      label: 'Territory, unchanged — not constitutionally a province',
      swatch: 'unit-territory',
    });
  }
  return entries;
}
