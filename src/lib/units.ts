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

/**
 * The proposed units of one current province, where the variant leaves that province's edge alone.
 *
 * The province is named as the census names it, which is the only place this app has a district's
 * province from — so the heading is `Islamabad Capital Territory` and not a short form of it, and
 * nothing here calls it a province in words. The grouping *is* the claim: these units are what this
 * province would be cut into.
 */
export interface UnitRosterGroup {
  /** The current province the units below it are carved out of, in the census's own name for it. */
  readonly province: string;
  readonly entries: readonly UnitRosterEntry[];
}

export interface UnitRoster {
  /** How many units the variant cuts the country into, in the words the map sets. */
  readonly heading: string;
  readonly entries: readonly UnitRosterEntry[];
  /**
   * The same entries under their current provinces, or **null** where the variant crosses one.
   *
   * A grouping is offered only where it is true of every row: a variant that redraws inside the
   * provinces that already exist is answering *what would this province become*, and a flat list of
   * nineteen names makes the reader do that arithmetic off the map. A variant that crosses a
   * provincial boundary — L3, L7, H1, H2 — has no such answer, and grouping the rows it can group
   * would report a partition as provincial that is not.
   *
   * Every entry appears under exactly one group, in `entries`' own order, so the paper and the card
   * still read as one list; the groups come in the order their first unit does, since nothing in
   * the bundle ranks Sindh against Balochistan.
   */
  readonly groups: readonly UnitRosterGroup[] | null;
  /**
   * How many lines the key actually sets — the rows plus a heading for each group.
   *
   * The count the columns are struck from, and it is not `entries.length` once the rows are
   * grouped: a province heading takes a line of the column exactly as a unit does, and columns
   * struck from the rows alone would push the last group's tail below the box.
   */
  readonly rows: number;
  /**
   * How many columns the rows are set in, so the whole key is on the paper at once.
   *
   * Stated here rather than left to the stylesheet because it is arithmetic over the roster's own
   * length, and the box that carries it is shrink-to-fit: a multi-column box with no column count
   * is one column wide however many columns it draws, and the rows would fall outside their own
   * background — and outside the rectangle the label layout keeps names off.
   */
  readonly columns: number;
}

/**
 * The tallest a column of the key is allowed to get, and how many columns it may run to.
 *
 * The key is **not scrolled**: a rule-drawn variant's rows go beside the first column rather than
 * below the fold, because a key a reader has to discover the rest of is a key that misreports the
 * partition every time they do not.
 *
 * Which leaves *where* the extra rows go, and the two numbers are spent on the answer: **down
 * before across**. The box stands in the frame's top-left corner, and at zoom 1 that corner is the
 * sea and the ground west of Balochistan — deep and narrow. A column of eighteen is what the
 * shortest desktop frame holds under the heading, and holding to two of them keeps the widest key
 * this build sets narrower than that empty strip, where three columns of twelve reached across the
 * country itself. Two columns of eighteen hold thirty-six lines, and the longest key here is D1's
 * thirty-two units under their four provinces — thirty-six exactly, which is why the grouping is
 * what gives way rather than the fold when the two collide (`unitRoster`). The cap is what stops a
 * hypothetical thirty-seventh line from marching over Pakistan to be read.
 */
export const KEY_ROWS_PER_COLUMN = 18;
export const KEY_MAX_COLUMNS = 2;

/** How many columns a key of `rows` rows is set in. Pure, so the box and the suite agree. */
export function keyColumns(rows: number): number {
  if (rows <= 0) return 1;
  return Math.min(KEY_MAX_COLUMNS, Math.ceil(rows / KEY_ROWS_PER_COLUMN));
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
 * The proposed units under their current provinces, or **null** where the variant crosses one.
 *
 * The question is asked of the variant rather than of the basis, and that is the whole point of it
 * being derived here: *the Administrative and Development bases draw inside the provinces that
 * already exist* is a fact about A6's and D1's district lists, and a variant added tomorrow that
 * broke it would have to break this check first. It is answered district by district — a unit whose
 * districts sit in two provinces crosses one, and so does a unit reaching ground the census does
 * not publish a province for, since a group headed by a province this app had to guess would be
 * exactly the unsourced surface the working agreement forbids.
 *
 * All or nothing. A partition half of whose units respect the provinces is a partition that does
 * not, and grouping the obedient half would say otherwise on the paper.
 */
function unitsByProvince(
  units: readonly UnitRecord[],
  entries: readonly UnitRosterEntry[],
  provinceOf: ReadonlyMap<string, string> | null,
): readonly UnitRosterGroup[] | null {
  if (provinceOf === null || units.length === 0) return null;

  const grouped = new Map<string, UnitRosterEntry[]>();
  for (const [index, unit] of units.entries()) {
    const provinces = new Set(unit.districts.map((district) => provinceOf.get(district)));
    // One province, and one this app has a name for. A unit of no districts has no province either
    // and is not evidence that the partition respects them.
    if (provinces.size !== 1) return null;
    const [province] = [...provinces];
    if (province === undefined) return null;
    const entry = entries[index];
    if (entry === undefined) return null;
    const rows = grouped.get(province);
    if (rows === undefined) grouped.set(province, [entry]);
    else rows.push(entry);
  }
  // Insertion order, which is the order the units are already in — so the groups read down the key
  // in the order the card reads down the page.
  return [...grouped.entries()].map(([province, rows]) => ({ province, entries: rows }));
}

/**
 * The roster the map frame carries in its own corner, beside the boundaries it names.
 *
 * `unitLegend` says what the three strokes *mean*; this says which unit is which, on the paper,
 * where the reader is looking. It names **the proposed units**, which are the ones a reader cannot
 * name from the map they already know, and it **counts what it names**: a key of three rows headed
 * by the partition's eight leads with a number none of its own rows accounts for. The word
 * `proposed` is in the heading rather than left to the accent, so the count is never read as the
 * whole partition — which is the card's and the scorecard's, printed in full on both, along with
 * the units the variant leaves alone.
 *
 * **Nothing is ever below a fold.** The rows run into a second and a third column rather than
 * scrolling (`keyColumns`), because a key that continues out of sight is one a reader takes for the
 * whole proposal until they happen to find the rest.
 *
 * No population and no district count, deliberately. Those are the scorecard's (#20) and they are
 * printed in full where they belong; a second set of figures on the paper is a second place for
 * them to be wrong. This answers *what am I looking at* and stops there.
 *
 * Each row carries **two** things about a unit and they are two different facts. Its outline's own
 * stroke, which says whether the unit is proposed — the accent means that and nothing else (D14) —
 * and the ground beneath it, which is the basis's data and belongs to no unit. Handed the fills
 * rather than reaching for them, so this module knows nothing about which basis is active.
 *
 * **And where the variant redraws inside the provinces that already exist, the rows are grouped
 * under them.** Nineteen names in a column is a list; the same nineteen under Punjab, Sindh, Khyber
 * Pakhtunkhwa, Balochistan and Islamabad Capital Territory is the proposal's own structure, and it
 * is the structure the reader is looking at, since every one of those outer edges is still on the
 * map in the boundary stratum's own weight. Handed the district's province rather than reaching for
 * it, exactly as the fills are: this module knows nothing about the census.
 */
export function unitRoster(
  variant: VariantRecord,
  fills: ReadonlyMap<string, DistrictFill> | null = null,
  provinceOf: ReadonlyMap<string, string> | null = null,
): UnitRoster {
  const units = unitsProposedFirst(variant).filter((unit) => unit.kind === 'proposed');
  const entries = units.map((unit) => ({
    name: unit.name,
    swatch: `unit-${unit.kind}` as UnitSwatch,
    fills: fillsUnder(unit, fills),
  }));

  // Grouped where it is true of every unit, and then only where the headings still fit on the paper:
  // a province heading costs a line, and the key's first obligation is that nothing is below a fold
  // (`keyColumns`). Where the two collide the grouping is what gives way, because it is an
  // improvement to a key that already worked and a row out of sight is a partition misreported.
  const grouped = unitsByProvince(units, entries, provinceOf);
  const groups =
    grouped !== null && entries.length + grouped.length <= KEY_ROWS_PER_COLUMN * KEY_MAX_COLUMNS
      ? grouped
      : null;
  const rows = entries.length + (groups?.length ?? 0);

  return {
    // The count of the *proposal*, which is what the rows below it are and what the word `proposed`
    // in it says: the key would otherwise lead with a number none of its own rows accounts for.
    // The partition's own count is the scorecard's and the card's, printed in full on both. The
    // headings below it are not units and are not counted here.
    heading: `${units.length} proposed ${units.length === 1 ? 'unit' : 'units'}`,
    entries,
    groups,
    rows,
    columns: keyColumns(rows),
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
