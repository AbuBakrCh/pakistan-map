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
import { readDistricts } from './geography.ts';
import { labelAnchor } from './labels.ts';
import { arcsOf } from './line-of-control.ts';
import { readUnitOutlines, unitBoundaries, unitByDistrict, unitLegend } from './units.ts';

const topology = geography as never;
const bundle = outlines as unknown as UnitOutlineBundle;
const variants = (scenarios as unknown as ScenarioBundle).variants;
const l1 = variants.find((v) => v.id === 'l1');
if (l1 === undefined) throw new Error('l1 is not in the scenario bundle');

const locArcs = arcsOf((geography as never as { objects: Record<string, never> }).objects[
  'lineOfControl'
] as never);

/** A unit's geometry as the outline bundle stores it — arc indices, before any read. */
const bundleGeometry = (unit: string): never => {
  const found = bundle.objects['l1']?.geometries.find(
    (g) => (g.properties as { unit?: string } | undefined)?.unit === unit,
  );
  if (found === undefined) throw new Error(`${unit} is not a unit of l1`);
  return found as never;
};

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
    expect(() => readUnitOutlines(topology, bundle, 'l7')).toThrow(/no units for variant "l7"/);
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
});
