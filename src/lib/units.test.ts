/**
 * Stratum 3, read off the committed pair of artifacts (#18).
 *
 * The outlines carry arc indices and no arcs. Everything below is about that: that they are
 * married to the geometry they were cut against and to no other, that stroking them cannot put a
 * solid line along the ceasefire line, and that every drawn district is accounted for by exactly
 * one of them.
 */

import { geoArea, geoContains } from 'd3';
import { describe, expect, it } from 'vitest';
import geography from '../../data/bundle/geography.topojson.json';
import scenarios from '../../data/bundle/scenarios.json';
import outlines from '../../data/bundle/unit-outlines.json';
import type { ScenarioBundle, UnitOutlineBundle } from '../bundle.ts';
import statistics from '../../data/bundle/statistics.json';
import type { CensusStatistics } from '../bundle.ts';
import { variantCard } from './card.ts';
import { motherTongueFills } from './mother-tongue.ts';
import { readDistricts } from './geography.ts';
import { labelAnchor } from './labels.ts';
import { arcsOf } from './line-of-control.ts';
import {
  KEY_MAX_COLUMNS,
  KEY_ROWS_PER_COLUMN,
  keyColumns,
  readUnitOutlines,
  unitBoundaries,
  unitByDistrict,
  unitLegend,
  unitRoster,
  unitsProposedFirst,
  type UnitRosterEntry,
} from './units.ts';

const censusStatistics = statistics as unknown as CensusStatistics;

const topology = geography as never;
const bundle = outlines as unknown as UnitOutlineBundle;
const variants = (scenarios as unknown as ScenarioBundle).variants;
const l1 = variants.find((v) => v.id === 'l1');
if (l1 === undefined) throw new Error('l1 is not in the scenario bundle');

const locArcs = arcsOf((geography as never as { objects: Record<string, never> }).objects[
  'lineOfControl'
] as never);

/** A unit's geometry as the outline bundle stores it — arc indices, before any read. */
const geometryOf = (variant: string, unit: string): never => {
  const found = bundle.objects[variant]?.geometries.find(
    (g) => (g.properties as { unit?: string } | undefined)?.unit === unit,
  );
  if (found === undefined) throw new Error(`${unit} is not a unit of ${variant}`);
  return found as never;
};
const bundleGeometry = (unit: string): never => geometryOf('l1', unit);

describe('readUnitOutlines', () => {
  const units = readUnitOutlines(topology, bundle, 'l1');

  it('returns one drawable shape per unit, named and classified', () => {
    expect(units.features).toHaveLength(l1.counts.units);
    expect(units.features.map((f) => f.properties.name)).toEqual(l1.units.map((u) => u.name));
    expect(units.features.filter((f) => f.properties.kind === 'proposed')).toHaveLength(1);
  });

  it('draws South Punjab from the eleven districts the 2023 vintage leaves it, not the thirteen claimed', () => {
    const south = units.features.find((f) => f.properties.unit === 'south-punjab');
    expect(south?.properties.districts).toBe(11);
    // Three pieces, and none of them a contiguity finding: Rahim Yar Khan is three polygons in
    // OSM, two of them islands under 200 km².
    expect(south?.properties.polygons).toBe(3);
  });

  it('covers the drawn map exactly once, with no district in two units', () => {
    const claimed = l1.units.flatMap((u) => u.districts);
    expect(new Set(claimed).size).toBe(claimed.length);
    expect(claimed).toHaveLength(readDistricts(topology).features.length);
  });

  it('measures what the districts measure, so no ground was lost in the read', () => {
    // The build already checked this against the members; this checks that reading it back
    // through `feature()` — delta decoding and all — produces the same country.
    const drawn = units.features.reduce((sum, f) => sum + geoArea(f as never), 0);
    const districts = readDistricts(topology).features.reduce(
      (sum, f) => sum + geoArea(f as never),
      0,
    );
    expect(drawn).toBeCloseTo(districts, 9);
  });

  it('refuses geometry it was not cut against, rather than drawing against the wrong arcs', () => {
    // The failure this exists to prevent is silent: arc 412 still resolves, to whatever edge now
    // holds that position, and every unit on screen is wrong with nothing rendering an error.
    const stale = { ...(geography as object), provenance: { generated: '2020-01-01T00:00:00.000Z' } };
    expect(() => readUnitOutlines(stale as never, bundle, 'l1')).toThrow(/cut against the geometry/);

    const shortened = { ...(geography as object), arcs: [] };
    expect(() => readUnitOutlines(shortened as never, bundle, 'l1')).toThrow(/0/);
  });

  it('refuses a variant nothing was dissolved for', () => {
    // Deliberately not a variant id this project will ever mint — it used to be `l7`, which the
    // mother-tongue rule then made real, and a test whose premise is "this one is not written
    // yet" quietly stops testing anything the week it is.
    expect(() => readUnitOutlines(topology, bundle, 'no-such-variant')).toThrow(
      /no units for variant "no-such-variant"/,
    );
  });
});

describe('unitBoundaries', () => {
  const boundaries = unitBoundaries(topology, bundle, 'l1', locArcs);

  it('gives every unit its own line work, labelled with the unit it bounds', () => {
    expect(boundaries).toHaveLength(l1.counts.units);
    expect(boundaries.map((b) => b.properties.unit)).toEqual(l1.units.map((u) => u.id));
  });

  it('leaves the ceasefire line out of every unit outline', () => {
    // Azad Jammu & Kashmir is a unit in every variant and the Line of Control is part of its
    // outline. A solid stroke over the dash fills its gaps in and leaves a line that means the
    // opposite of what it says (D12) — so the arcs are held out, not merely drawn under.
    //
    // Asked as arithmetic on arc counts rather than on coordinates, because `linesFromArcs` draws
    // one chain per arc: a unit draws exactly as many chains as it has arcs the line does not.
    const held = boundaries.flatMap((boundary) => {
      const arcs = arcsOf(bundleGeometry(boundary.properties.unit));
      const shared = [...arcs].filter((arc) => locArcs.has(arc));
      return boundary.lines.geometry.coordinates.length === arcs.size - shared.length
        ? []
        : [boundary.properties.name];
    });
    expect(held).toEqual([]);
  });

  it('holds the line out of the two units it actually runs along, and nowhere else', () => {
    // Vacuous otherwise: an exclusion that never excludes anything passes the test above
    // perfectly. AJK and Gilgit-Baltistan are the two units whose outline the line is part of.
    const along = boundaries
      .filter((boundary) =>
        [...arcsOf(bundleGeometry(boundary.properties.unit))].some((arc) => locArcs.has(arc)),
      )
      .map((boundary) => boundary.properties.name);
    expect(along).toEqual(['Azad Jammu & Kashmir', 'Gilgit-Baltistan']);
  });

  it('holds nothing out of a unit that does not touch the line', () => {
    const sindh = boundaries.find((b) => b.properties.unit === 'sindh');
    expect(sindh?.lines.geometry.coordinates.length).toBe(arcsOf(bundleGeometry('sindh')).size);
  });

  it('holds the line out of every variant’s units, whatever those units are called', () => {
    // The property above, asked of the whole shipped set rather than of L1, because the units the
    // line runs along are not the same units from variant to variant. H3 calls Gilgit-Baltistan
    // the Northern Areas, and H1 draws only three units in total — so a renderer that recognised
    // the ceasefire line by unit *name* would put a solid stroke along it the moment a variant
    // renamed a territory. Reported per unit, since the failure is one shape drawn wrong.
    const drawnSolid = variants.flatMap((variant) =>
      unitBoundaries(topology, bundle, variant.id, locArcs).flatMap((boundary) => {
        const arcs = arcsOf(geometryOf(variant.id, boundary.properties.unit));
        const shared = [...arcs].filter((arc) => locArcs.has(arc));
        return boundary.lines.geometry.coordinates.length === arcs.size - shared.length
          ? []
          : [`${variant.id} "${boundary.properties.name}" strokes ${shared.length} ceasefire arcs`];
      }),
    );
    expect(drawnSolid).toEqual([]);

    // And it is held out of exactly two units of each variant — never none, which would make the
    // check above vacuous, and never three.
    const along = Object.fromEntries(
      variants.map((variant) => [
        variant.id,
        variant.units
          .filter((unit) =>
            [...arcsOf(geometryOf(variant.id, unit.id))].some((arc) => locArcs.has(arc)),
          )
          .map((unit) => unit.name),
      ]),
    );
    expect(along).toEqual({
      l1: ['Azad Jammu & Kashmir', 'Gilgit-Baltistan'],
      l2: ['Azad Jammu & Kashmir', 'Gilgit-Baltistan'],
      l3: ['Azad Jammu & Kashmir', 'Gilgit-Baltistan'],
      l4: ['Azad Jammu & Kashmir', 'Gilgit-Baltistan'],
      l5: ['Azad Jammu & Kashmir', 'Gilgit-Baltistan'],
      l6: ['Azad Jammu & Kashmir', 'Gilgit-Baltistan'],
      // L7 replaces every province with a language region and still leaves the two territories as
      // themselves, because the census reaches neither and the rule has nothing to sort them by.
      l7: ['Azad Jammu & Kashmir', 'Gilgit-Baltistan'],
      // A6 partitions inside the existing provinces and so never reaches the territories at all:
      // the rule sees only the 136 districts the census covers, and both are carried through as
      // themselves — which is why the line runs along the same two units here as everywhere else.
      a6: ['Azad Jammu & Kashmir', 'Gilgit-Baltistan'],
      // A5 was the variant this assertion was waiting for — it drew both territories as *proposed
      // provinces* — and it has been retired. The property it proved is not: the renderer decides
      // what to stroke solid from the *arcs* and never from a unit's `kind` or name, which is why
      // H3's Northern Areas and H2's Gilgit Agency below still hold the line out. A variant that
      // argues for provincial status again would need no change here, which was #28's whole point.
      h1: ['Azad Jammu & Kashmir', 'Gilgit-Baltistan'],
      // H2 (#30) is the third name this ground goes by in the shipped set, and the first variant
      // that does not hold the territory in one piece: Hunza and Nagar are drawn out of it as the
      // princely states they were, leaving the rest as the Gilgit Agency. Neither state touches the
      // ceasefire line — both sit on the China frontier in the north-west — so the line is still
      // held out of exactly two units, and the one it runs along is the remainder.
      h2: ['Gilgit Agency and Baltistan', 'Azad Jammu & Kashmir'],
      h3: ['Northern Areas', 'Azad Jammu & Kashmir'],
      h4: ['Azad Jammu & Kashmir', 'Gilgit-Baltistan'],
      // D1 (#31) cuts the four provinces at the census's development gradient and leaves both
      // territories exactly as they are — they have no index to be cut at, because PBS published
      // none of the three rates for their twenty districts (D25).
      d1: ['Azad Jammu & Kashmir', 'Gilgit-Baltistan'],
    });
  });
});

describe('unitByDistrict', () => {
  const owner = unitByDistrict(l1);

  it('answers for every drawn district, which is what a hover needs', () => {
    const districts = readDistricts(topology).features.map((f) => f.properties.name);
    expect(districts.filter((d) => !owner.has(d))).toEqual([]);
    expect(owner.size).toBe(districts.length);
  });

  it('keys on the district the map draws, never on the district the claim names', () => {
    // The claim names Taunsa; the ground under the pointer is Dera Ghazi Khan, which is what
    // carries Taunsa under the 2023 vintage.
    expect(owner.get('Dera Ghazi Khan')?.name).toBe('South Punjab');
    expect(owner.has('Taunsa')).toBe(false);
  });

  it('puts the rest of Punjab in a different unit from the south', () => {
    expect(owner.get('Multan')?.id).toBe('south-punjab');
    expect(owner.get('Lahore')?.id).toBe('punjab');
  });
});

describe('unitLegend', () => {
  const entries = unitLegend(l1);

  it('names the proposed units and says they are not official', () => {
    // The accent means "this is the proposal". A reader has to be able to find which shape that
    // is without hovering — and a heavy coloured province outline is exactly what travels as a
    // screenshot (D22), so the caveat rides with it.
    expect(entries[0]?.swatch).toBe('unit-proposed');
    expect(entries[0]?.label).toBe('Proposed — South Punjab. Not official.');
  });

  it('keys the unchanged units and the territories apart', () => {
    expect(entries.map((e) => e.swatch)).toEqual([
      'unit-proposed',
      'unit-unchanged',
      'unit-territory',
    ]);
    expect(entries[2]?.label).toContain('not constitutionally a province');
  });

  it('keys only the kinds a variant actually contains', () => {
    const noProposal = { ...l1, units: l1.units.filter((u) => u.kind !== 'proposed') };
    expect(unitLegend(noProposal).map((e) => e.swatch)).toEqual([
      'unit-unchanged',
      'unit-territory',
    ]);

    // And the same over a variant that really is short a kind rather than one edited to be:
    // One Unit is a single province and the two territories, with nothing left unchanged, so the
    // legend has no `unit-unchanged` row to key at all.
    const h1 = variants.find((v) => v.id === 'h1');
    if (h1 === undefined) throw new Error('h1 is not in the scenario bundle');
    expect(h1.units.map((u) => u.kind)).toEqual(['proposed', 'territory', 'territory']);
    expect(unitLegend(h1).map((e) => e.swatch)).toEqual(['unit-proposed', 'unit-territory']);
  });
});

/**
 * The map's own key (the count, the names, the strokes), held over every variant.
 *
 * Two things are worth more than the wording here. That the roster and the *card* list the same
 * units in the same order — they are read one after the other, and a unit third on the paper and
 * seventh in the card reads as two units. And that every unit gets a stroke the map actually draws
 * it in: a swatch that keys nothing is the failure the export band's own key refuses by name.
 */
describe('unitRoster', () => {
  /**
   * L1 with every unit proposed, for the checks that are about the *swatch* rather than the roster.
   *
   * A unit's ground is a property of its own districts and has nothing to do with whether the key
   * prints it, so the arithmetic is asked of the whole partition — Punjab's four mother tongues,
   * Khyber Pakhtunkhwa's stipple and the two territories' hatch included, none of which the shipped
   * key lists, because none of them is proposed.
   */
  const everyUnitProposed = {
    ...l1,
    units: l1.units.map((u) => ({ ...u, kind: 'proposed' as const })),
  };

  it('counts what it names, and says the count is the proposal’s', () => {
    // It leads with the number of units below it, not the partition's — a key of one row headed by
    // l1's eight leads with a number none of its own rows accounts for. The whole partition is the
    // card's and the scorecard's, and both print it in full.
    expect(unitRoster(l1).heading).toBe('1 proposed unit');
    expect(l1.counts.units).toBe(8);

    // Held over the whole set, in the variant's own arithmetic rather than a literal, so the two
    // cannot drift: D1's thirty-two are the longest, and A6 proposes nineteen of twenty-one.
    for (const variant of variants) {
      const proposed = variant.units.filter((u) => u.kind === 'proposed').length;
      expect(unitRoster(variant).heading, variant.id).toBe(
        `${proposed} proposed ${proposed === 1 ? 'unit' : 'units'}`,
      );
    }
    expect(unitRoster(everyUnitProposed).heading).toBe(`${l1.units.length} proposed units`);
  });

  it('names the proposed units of every variant exactly once, in the accent’s own stroke', () => {
    // The proposal is what a reader cannot name off the map they already know. The provinces a
    // variant leaves alone are on the card, in full, with the rest of the partition.
    for (const variant of variants) {
      const proposed = variant.units.filter((u) => u.kind === 'proposed');
      const roster = unitRoster(variant);
      expect(roster.entries.map((e) => e.name), variant.id).toEqual(proposed.map((u) => u.name));
      expect(new Set(roster.entries.map((e) => e.swatch)), variant.id).toEqual(
        new Set(proposed.length === 0 ? [] : ['unit-proposed']),
      );
    }
  });

  it('sets every row at once, in columns, rather than putting any of them below a fold', () => {
    // A key that scrolls is one a reader takes for the whole proposal until they happen to find the
    // rest, so the rows run sideways instead. Held over the whole set: no variant's key is ever
    // deeper than a column holds, D1's thirty-two proposed units included, which is the longest.
    for (const variant of variants) {
      const roster = unitRoster(variant);
      expect(roster.columns, variant.id).toBeLessThanOrEqual(KEY_MAX_COLUMNS);
      expect(roster.columns * KEY_ROWS_PER_COLUMN, variant.id).toBeGreaterThanOrEqual(
        roster.entries.length,
      );
      // And no column is opened that the rows do not need: an empty second column is white space
      // taken out of the map for nothing.
      expect((roster.columns - 1) * KEY_ROWS_PER_COLUMN, variant.id).toBeLessThan(
        roster.entries.length || 1,
      );
    }

    const longest = Math.max(
      ...variants.map((v) => v.units.filter((u) => u.kind === 'proposed').length),
    );
    expect(longest).toBe(32);
    expect(keyColumns(longest)).toBe(2);
    // Down before across: the corner the box stands in is deep and narrow, so the second column is
    // opened only once a column of eighteen is full, and there is never a third.
    expect(keyColumns(KEY_ROWS_PER_COLUMN)).toBe(1);
    expect(keyColumns(KEY_ROWS_PER_COLUMN + 1)).toBe(2);
  });

  /**
   * The grouping, which is a property of the *variant* and never of the basis it is filed under.
   *
   * "The Administrative and Development bases redraw inside the provinces that already exist" is a
   * fact about A6's and D1's district lists, so it is asserted as one: the check is run over every
   * variant in the bundle and each is held to the answer its own districts give. A variant added
   * tomorrow that crossed a provincial edge would fail here rather than quietly picking up a
   * heading it has not earned.
   */
  describe('grouped by the provinces it redraws inside', () => {
    const byName = (a: UnitRosterEntry, b: UnitRosterEntry): number => a.name.localeCompare(b.name);
    const provinceOf: ReadonlyMap<string, string> = new Map(
      Object.entries(censusStatistics.districts).map(([d, r]) => [d, r.province]),
    );
    /** Whether a variant's proposed units each sit inside one province the census names. */
    const respectsProvinces = (variant: (typeof variants)[number]): boolean =>
      variant.units
        .filter((u) => u.kind === 'proposed')
        .every((u) => new Set(u.districts.map((d) => provinceOf.get(d))).size === 1
          && u.districts.every((d) => provinceOf.has(d)));

    it('groups exactly the variants whose units stay inside one province, and no others', () => {
      for (const variant of variants) {
        const roster = unitRoster(variant, null, provinceOf);
        expect(roster.groups !== null, variant.id).toBe(respectsProvinces(variant));
      }

      // Named as well as derived, because these are the sentences a reader would dispute. A6 cuts
      // five current units into nineteen and D1 four into thirty-two; L3 is the one *transcribed*
      // proposal whose province crosses an existing provincial boundary, and L7, H1 and H2 cross
      // one too — none of them has a provincial structure to report.
      const groupsOf = (id: string): readonly string[] | null => {
        const variant = variants.find((v) => v.id === id);
        if (variant === undefined) throw new Error(`${id} is not in the bundle`);
        return unitRoster(variant, null, provinceOf).groups?.map((g) => g.province) ?? null;
      };
      expect(groupsOf('a6')).toEqual([
        'Sindh',
        'Punjab',
        'Khyber Pakhtunkhwa',
        'Balochistan',
        'Islamabad Capital Territory',
      ]);
      expect(groupsOf('d1')).toEqual(['Khyber Pakhtunkhwa', 'Punjab', 'Sindh', 'Balochistan']);
      for (const id of ['l3', 'l7', 'h1', 'h2']) expect(groupsOf(id), id).toBeNull();
    });

    it('puts every row under exactly one province, and keeps the card’s order inside each', () => {
      // Grouping is the one thing that may move a row, and it moves it as little as it can: the
      // rows are the flat list's own rows, every one of them exactly once, and inside a province
      // the card's order stands. So a reader reading the key and then the card meets the units in
      // a different arrangement but never in a different order within the ground they share.
      for (const variant of variants) {
        const roster = unitRoster(variant, null, provinceOf);
        if (roster.groups === null) continue;
        const rows = roster.groups.flatMap((g) => g.entries);
        expect([...rows].sort(byName), variant.id).toEqual([...roster.entries].sort(byName));
        expect(rows, variant.id).toHaveLength(roster.entries.length);
        const flat = roster.entries.map((e) => e.name);
        for (const group of roster.groups) {
          const order = group.entries.map((e) => flat.indexOf(e.name));
          expect(order, `${variant.id} / ${group.province}`).toEqual(
            [...order].sort((a, b) => a - b),
          );
        }
        // And the groups themselves come in the order their first unit does, so nothing here ranks
        // Sindh against Balochistan — the bundle does not, and inventing a rank would be this app
        // ordering the provinces by something no source states.
        const firsts = roster.groups.map((g) => flat.indexOf(g.entries[0]?.name ?? ''));
        expect(firsts, variant.id).toEqual([...firsts].sort((a, b) => a - b));
        // And each group's province is the province of every district under it, off the census.
        const units = variant.units.filter((u) => u.kind === 'proposed');
        for (const group of roster.groups) {
          for (const entry of group.entries) {
            const unit = units.find((u) => u.name === entry.name);
            expect(unit, entry.name).toBeDefined();
            for (const district of unit?.districts ?? []) {
              expect(provinceOf.get(district), `${entry.name} / ${district}`).toBe(group.province);
            }
          }
        }
      }
    });

    it('refuses to group a unit reaching ground the census names no province for', () => {
      // A unit over AJK or Gilgit-Baltistan has no province in `statistics.json` (D25), and a
      // heading this app had to guess would be exactly the unsourced surface the working agreement
      // forbids. So the whole key falls back to the flat list rather than grouping what it can.
      const a6 = variants.find((v) => v.id === 'a6');
      if (a6 === undefined) throw new Error('a6 is not in the bundle');
      expect(unitRoster(a6, null, provinceOf).groups).not.toBeNull();

      const reaching = {
        ...a6,
        units: a6.units.map((u, i) =>
          i === 0 && u.kind === 'proposed' ? { ...u, districts: [...u.districts, 'Skardu'] } : u,
        ),
      };
      expect(provinceOf.has('Skardu')).toBe(false);
      expect(unitRoster(reaching, null, provinceOf).groups).toBeNull();
    });

    it('is not offered at all where nothing tells it which province a district is in', () => {
      // The default, and what every other assertion in this file is asked under: the roster is
      // handed the answer rather than reaching for it, exactly as it is handed the fills.
      for (const variant of variants) {
        expect(unitRoster(variant).groups, variant.id).toBeNull();
        expect(unitRoster(variant).rows, variant.id).toBe(unitRoster(variant).entries.length);
      }
    });

    it('counts a province heading as a line, and gives the grouping up before the fold', () => {
      // A heading takes a row of the column exactly as a unit does, so the columns are struck from
      // the two together — D1 is thirty-two units under four provinces, thirty-six lines, which is
      // precisely what two columns of eighteen hold.
      for (const variant of variants) {
        const roster = unitRoster(variant, null, provinceOf);
        expect(roster.rows, variant.id).toBe(roster.entries.length + (roster.groups?.length ?? 0));
        expect(roster.columns, variant.id).toBeLessThanOrEqual(KEY_MAX_COLUMNS);
        expect(roster.columns * KEY_ROWS_PER_COLUMN, variant.id).toBeGreaterThanOrEqual(roster.rows);
      }
      const d1 = variants.find((v) => v.id === 'd1');
      if (d1 === undefined) throw new Error('d1 is not in the bundle');
      expect(unitRoster(d1, null, provinceOf).rows).toBe(KEY_ROWS_PER_COLUMN * KEY_MAX_COLUMNS);

      // And where one more line would put a row out of sight, the *grouping* is what gives way: it
      // is an improvement to a key that already worked, and a row below the fold is a partition
      // misreported. A thirty-third unit in a fifth province is thirty-eight lines, so the key is
      // set flat at thirty-three and every one of them is still on the paper.
      const proposed = d1.units.find((u) => u.kind === 'proposed');
      if (proposed === undefined) throw new Error('d1 proposes nothing');
      const overflowing = {
        ...d1,
        units: [
          ...d1.units,
          { ...proposed, id: 'spare', name: 'Spare', districts: ['Islamabad'] },
        ],
      };
      const flat = unitRoster(overflowing, null, provinceOf);
      expect(flat.groups).toBeNull();
      expect(flat.rows).toBe(33);
      expect(flat.columns).toBe(2);
    });
  });

  it('shades each unit with the ground the map actually paints under it, in proportion', () => {
    const fills = motherTongueFills(censusStatistics);
    // Over l1 with every unit proposed, so the swatch arithmetic is asked of the whole partition
    // and not only of the one unit l1 keys — the shading is a property of a unit's districts and
    // has nothing to do with which of them the key prints.
    const roster = unitRoster(everyUnitProposed, fills);
    const entry = (name: string): UnitRosterEntry => {
      const found = roster.entries.find((e) => e.name === name);
      if (found === undefined) throw new Error(`${name} is not a unit of l1`);
      return found;
    };

    for (const unit of l1.units) {
      const segments = entry(unit.name).fills;
      // Every district of the unit is in exactly one segment, and the shares sum to the whole:
      // a swatch short of a district would be a picture of ground the unit does not cover.
      expect(segments.reduce((sum, s) => sum + s.districts, 0)).toBe(unit.districts.length);
      expect(segments.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1, 10);
      // Widest first, so the swatch reads left to right as the unit's own ground does.
      expect(segments.map((s) => s.districts)).toEqual(
        [...segments.map((s) => s.districts)].sort((a, b) => b - a),
      );
    }

    /*
     * And the segments are what make the swatch worth having, rather than a colour per unit.
     *
     * South Punjab is **8 Saraiki districts and 3 Punjabi ones** — Khanewal, Vehari and
     * Bahawalnagar — and the Punjab it leaves behind is 23 Punjabi and 2 Saraiki. A single colour
     * would report the Seraiki claim as coextensive with the Seraiki language, which is precisely
     * the disagreement between an outline and the shading beneath it that this map exists to show.
     * Named rather than counted, because that is the sentence a reader would dispute.
     */
    const colourOf = (district: string): string => {
      const fill = fills.get(district);
      if (fill?.kind !== 'category') throw new Error(`${district} is not shaded by a category`);
      return fill.colour;
    };
    expect(entry('South Punjab').fills).toEqual([
      { swatch: { kind: 'colour', colour: colourOf('Multan') }, districts: 8, share: 8 / 11 },
      { swatch: { kind: 'colour', colour: colourOf('Khanewal') }, districts: 3, share: 3 / 11 },
    ]);
    expect(entry('Punjab').fills.map((f) => f.districts)).toEqual([23, 2]);
  });

  it('keys the two absences apart, and neither of them as a colour', () => {
    const roster = unitRoster(everyUnitProposed, motherTongueFills(censusStatistics));
    const fillsOf = (name: string): readonly { swatch: { kind: string } }[] =>
      roster.entries.find((e) => e.name === name)?.fills ?? [];

    // The census reached neither territory at all (D25), so the whole unit is the one absence —
    // hatched, exactly as the legend under the frame keys it, and never a low band or a colour.
    for (const territory of ['Azad Jammu & Kashmir', 'Gilgit-Baltistan']) {
      expect(fillsOf(territory).map((f) => f.swatch)).toEqual([{ kind: 'hatch' }]);
    }

    // And the other absence is a different swatch on the same map: Khyber Pakhtunkhwa holds both
    // Chitrals, which the census reached and named no dominant tongue for (#17).
    expect(fillsOf('Khyber Pakhtunkhwa').map((f) => f.swatch.kind)).toContain('stipple');
    expect(fillsOf('Khyber Pakhtunkhwa').map((f) => f.swatch.kind)).not.toContain('hatch');
  });

  it('keys nothing where the basis shades nothing, rather than inventing a colour', () => {
    // The Administrative and Historical bases draw boundaries over an unshaded country. There is no
    // ground colour to show, so the row falls back to the outline's own stroke — which is why the
    // stroke is carried on every entry and not only where the fills are missing.
    for (const entry of unitRoster(everyUnitProposed).entries) expect(entry.fills).toEqual([]);
  });

  it('reads in the card’s order, so the paper and the card agree which unit is the proposal', () => {
    // The card lists the whole partition, proposed first; the key lists the proposal. So the key is
    // the card's own opening rows, name for name — they are read one after the other, and a unit
    // third on the paper and seventh in the card reads as two different units.
    for (const variant of variants) {
      const card = variantCard(scenarios as unknown as ScenarioBundle, variant);
      const keyed = unitRoster(variant).entries.map((e) => e.name);
      expect(keyed, variant.id).toEqual(card.units.slice(0, keyed.length).map((u) => u.name));
    }
  });

  it('puts the proposed units first even where the partition was written the other way round', () => {
    // The bundle's own order is the order the partition was written in — remainders after the
    // claim they are the remainder of — so this is asserted against a variant reversed rather than
    // against one that happens to already be in the right order.
    const written = [...l1.units].reverse();
    const reversed = { ...l1, units: written };
    expect(unitsProposedFirst(reversed).map((u) => u.kind)).toEqual([
      'proposed',
      ...written.filter((u) => u.kind === 'unchanged').map(() => 'unchanged'),
      ...written.filter((u) => u.kind === 'territory').map(() => 'territory'),
    ]);

    // Only the *kinds* are reordered. Inside one kind the partition's own order stands, because
    // nothing in the bundle ranks Sindh against Balochistan and inventing a rank here would be
    // this app ordering the provinces by something no source states.
    const inWrittenOrder = (kind: string): string[] =>
      written.filter((u) => u.kind === kind).map((u) => u.name);
    expect(unitsProposedFirst(reversed).map((u) => u.name)).toEqual([
      ...inWrittenOrder('proposed'),
      ...inWrittenOrder('unchanged'),
      ...inWrittenOrder('territory'),
    ]);
  });
});

describe('the units on the ground', () => {
  const units = readUnitOutlines(topology, bundle, 'l1');

  it('contains its own name’s anchor point, so no unit is labelled over another', () => {
    // The same property `labels.test.ts` holds for the tiers, asked of the shapes stratum 3
    // actually draws: a dissolved unit can be a crescent where neither of its districts was.
    const outside = units.features
      .filter((f) => !geoContains(f as never, labelAnchor(f as never)))
      .map((f) => f.properties.name);
    expect(outside).toEqual([]);
  });

  it('anchors every unit of every variant inside itself, including the awkward shapes', () => {
    // L1's eight are all compact. The set now contains shapes that are not: West Pakistan is 261
    // polygons and a hole where nothing is, and North-West Frontier Province is a crescent around
    // the tribal districts it does not contain. A crescent's centroid falls outside it, so this is
    // where a naive anchor would put a province's name on ground belonging to another unit.
    const misplaced = variants.flatMap((variant) =>
      readUnitOutlines(topology, bundle, variant.id)
        .features.filter((f) => !geoContains(f as never, labelAnchor(f as never)))
        .map((f) => `${variant.id} "${f.properties.name}"`),
    );
    expect(misplaced).toEqual([]);
    // Fifteen variants' worth of pole-of-inaccessibility searches over 149 outlines, one of them
    // the whole of the four provinces: slower than the 5s default, and worth the wall clock,
    // because a unit name set outside its own shape is the one label error a reader reads as a
    // fact. The rule-drawn administrative units (#28) are the awkward ones now — a unit grown
    // outward from a capital takes whatever shape the arithmetic leaves it, and several are long
    // and bent in ways no proposal would draw on purpose. 60s against a ~13s run: headroom for a
    // slower machine, not four times the budget the work actually needs.
  }, 60_000);
});
