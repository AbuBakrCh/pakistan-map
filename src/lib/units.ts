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
import { NO_DATA, type DistrictFill, type LegendEntry } from './fill.ts';
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

/**
 * A variant's units, proposed first.
 *
 * Not the bundle's order, which is the order the partition was written in — remainders after the
 * claim they are the remainder of. Every surface that *lists* units reads them this way, because
 * each is about what the variant proposes and a reader scanning eighteen units for the one that
 * does not exist should not have to. Exported so the card and the map's own key are one order
 * rather than two that happen to agree today: they are read one after the other, and a unit that
 * came third on the paper and seventh in the card would read as two different units.
 */
export function unitsProposedFirst(variant: VariantRecord): readonly UnitRecord[] {
  const rank: Readonly<Record<UnitKind, number>> = { proposed: 0, unchanged: 1, territory: 2 };
  return [...variant.units]
    .map((unit, index) => ({ unit, index }))
    .sort((a, b) => rank[a.unit.kind] - rank[b.unit.kind] || a.index - b.index)
    .map(({ unit }) => unit);
}

/**
 * One colour under a unit, and how much of the unit wears it.
 *
 * A unit is **never filled** (D14) — what is under it is stratum 1, which is the basis's data — so
 * a unit's "colour" is not one colour at all: Punjab covers four mother tongues, and a swatch
 * showing one of them would be this app naming a dominant language for a province that the census
 * publishes no such figure for. So the swatch is the unit's *own* districts in the fills the map
 * actually paints them, in proportion.
 *
 * The proportion is **of districts**, which is the atom every unit is composed of (D23) and the one
 * quantity here that is exact and needs no source: it is a count of what is drawn. Not of people
 * and not of ground — either would be a published figure being implied by a 20px picture, and PBS
 * publishes neither of them cut this way.
 */
export interface UnitFillSegment {
  /** The same swatch vocabulary the legend under the frame uses: a colour, or one of two absences. */
  readonly swatch: LegendEntry['swatch'];
  /** How many of the unit's own districts the map paints this way. */
  readonly districts: number;
  /** That count as a share of the unit's districts. The segments of a unit sum to 1. */
  readonly share: number;
}

/** One line of the map's own key: a unit, the stroke it is outlined in, and the ground under it. */
export interface UnitRosterEntry {
  readonly name: string;
  readonly swatch: UnitSwatch;
  /**
   * The fills under this unit, widest first. **Empty** where the basis shades nothing — the
   * Administrative and Historical bases draw boundaries over an unshaded country — in which case
   * there is no ground colour to key and the outline's own stroke is all a row can carry.
   */
  readonly fills: readonly UnitFillSegment[];
}

export interface UnitRoster {
  /** How many units the variant cuts the country into, in the words the map sets. */
  readonly heading: string;
  readonly entries: readonly UnitRosterEntry[];
}

/**
 * What the map paints one unit's districts, in proportion, widest first.
 *
 * Keyed on the district the map *draws* rather than the one the claim names, exactly as the hover
 * is: the claim may say Taunsa, and the shape under the pointer is Dera Ghazi Khan.
 *
 * A district the fill map has never heard of is `no-data` — the same absence AJK's and GB's twenty
 * carry — because that is what the map does with it: it takes no fill and the unshaded baseline
 * shows through. The two absences stay apart here as they do everywhere else (#17): a question the
 * census could not answer is stippled, and one it never asked here is hatched.
 */
function fillsUnder(
  unit: UnitRecord,
  fills: ReadonlyMap<string, DistrictFill> | null,
): readonly UnitFillSegment[] {
  if (fills === null || unit.districts.length === 0) return [];

  const counts = new Map<string, { swatch: LegendEntry['swatch']; districts: number }>();
  for (const district of unit.districts) {
    const fill = fills.get(district) ?? NO_DATA;
    const swatch: LegendEntry['swatch'] =
      fill.kind === 'category' || fill.kind === 'band'
        ? { kind: 'colour', colour: fill.colour }
        : fill.kind === 'no-dominant'
          ? { kind: 'stipple' }
          : { kind: 'hatch' };
    const key = swatch.kind === 'colour' ? swatch.colour : swatch.kind;
    const seen = counts.get(key);
    if (seen === undefined) counts.set(key, { swatch, districts: 1 });
    else seen.districts += 1;
  }

  // Widest first, ties broken on the key itself, so a unit's swatch is the same picture on every
  // build — two fills of equal width would otherwise swap places with the district order.
  return [...counts.entries()]
    .sort(([keyA, a], [keyB, b]) => b.districts - a.districts || keyA.localeCompare(keyB))
    .map(([, segment]) => ({
      swatch: segment.swatch,
      districts: segment.districts,
      share: segment.districts / unit.districts.length,
    }));
}

/**
 * The roster the map frame carries in its own corner, beside the boundaries it names.
 *
 * `unitLegend` says what the three strokes *mean*; this says which unit is which, on the paper,
 * where the reader is looking. It names **every** unit and not only the proposed ones, for the
 * reason the card lists them all: a variant is a complete partition, and a key naming only what is
 * new would leave a reader unable to say what the rest of the country had become. The count leads
 * it because that is the first thing asked of a proposal — how many provinces would there be.
 *
 * No population and no district count, deliberately. Those are the scorecard's (#20) and they are
 * printed in full where they belong; a second set of figures on the paper is a second place for
 * them to be wrong. This answers *what am I looking at* and stops there.
 *
 * Each row carries **two** things about a unit and they are two different facts. Its outline's own
 * stroke, which says whether the unit is proposed — the accent means that and nothing else (D14) —
 * and the ground beneath it, which is the basis's data and belongs to no unit. Handed the fills
 * rather than reaching for them, so this module knows nothing about which basis is active.
 */
export function unitRoster(
  variant: VariantRecord,
  fills: ReadonlyMap<string, DistrictFill> | null = null,
): UnitRoster {
  const units = unitsProposedFirst(variant);
  return {
    heading: `${units.length} ${units.length === 1 ? 'unit' : 'units'}`,
    entries: units.map((unit) => ({
      name: unit.name,
      swatch: `unit-${unit.kind}` as UnitSwatch,
      fills: fillsUnder(unit, fills),
    })),
  };
}

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
