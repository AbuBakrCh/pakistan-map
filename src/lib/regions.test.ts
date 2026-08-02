/**
 * The map's regions in words (#35), held over the real bundle rather than over fixtures.
 *
 * The claim being tested is that a reader who cannot see the map is told the same things about it
 * as a reader who can — the same regions, and the same constitutional standing in the same words.
 * A second vocabulary here would be the app saying one thing on hover and another in the list.
 */

import { describe, expect, it } from 'vitest';
import bundle from '../../data/bundle/geography.topojson.json';
import outlines from '../../data/bundle/unit-outlines.json';
import scenarios from '../../data/bundle/scenarios.json';
import type { UnitOutlineBundle } from '../bundle.ts';
import { describeKind, readGeography } from './geography.ts';
import { readUnitOutlines } from './units.ts';
import { regionRoster } from './regions.ts';
import { UNIT_STANDING } from './tooltip.ts';

const { provinces } = readGeography(bundle as never);
const firstLevel = provinces.features.map((f) => ({
  name: f.properties.name,
  kind: f.properties.kind,
}));

describe('regionRoster at the baseline', () => {
  const roster = regionRoster(firstLevel, null);

  it('names every first-level unit the map draws, and nothing it does not', () => {
    expect(roster.items.map((r) => r.name).sort()).toEqual(
      firstLevel.map((f) => f.name).sort(),
    );
  });

  it('joins the name to its standing itself, rather than leaving the renderer to word it', () => {
    // The dash is wording, and wording is decided where it can be tested (`panel.ts` composes no
    // sentence of its own; nor does `map.ts`).
    for (const item of roster.items) {
      expect(item.spoken).toBe(`${item.name} — ${item.standing}`);
    }
  });

  it('says of AJK and Gilgit-Baltistan what the map says of them', () => {
    /*
     * The requirement is drawn *and named* (D12), and for a reader using a screen reader this list
     * is the whole of "named". A territory that arrived here described as a province would be a
     * constitutional claim made in the one place nobody proof-reads.
     */
    const territories = roster.items.filter((r) =>
      ['Azad Jammu & Kashmir', 'Gilgit-Baltistan'].includes(r.name),
    );
    expect(territories).toHaveLength(2);
    for (const territory of territories) {
      expect(territory.standing).toBe(describeKind('territory').status);
      expect(territory.standing).toMatch(/not constitutionally a province/i);
    }
  });

  it('never calls Islamabad a province', () => {
    // The unit vocabulary has no word for a capital territory, and the card is already careful
    // about this. So is this.
    const ict = roster.items.find((r) => r.name === 'Islamabad Capital Territory');
    expect(ict?.standing).toBe(describeKind('capital').status);
    expect(ict?.standing).not.toMatch(/^Province$/);
  });

  it('takes its words from the tooltip´s own, rather than coining a second set', () => {
    // Read off `describeKind` rather than typed here, so a change to the constitutional wording
    // moves both surfaces or fails.
    for (const region of roster.items) {
      const kinds = (['province', 'territory', 'capital'] as const).map(
        (kind) => describeKind(kind).status,
      );
      expect(kinds).toContain(region.standing);
    }
  });
});

describe('regionRoster under a variant', () => {
  for (const variant of scenarios.variants) {
    const units = readUnitOutlines(
      bundle as never,
      outlines as unknown as UnitOutlineBundle,
      variant.id,
    ).features.map((f) => ({ name: f.properties.name, kind: f.properties.kind }));
    const roster = regionRoster(firstLevel, units);

    it(`names every unit of ${variant.id} exactly once, and no province beside them`, () => {
      // Units replace provinces here as they do on the map, or a reader is given "Sindh" twice —
      // once as a province and once as the unit that is the same province carried through — and
      // left to work out whether that is one place or two.
      expect(roster.items.map((r) => r.name)).toEqual(units.map((u) => u.name));
    });

    it(`says of every ${variant.id} unit which of the three kinds it is, in the tooltip's words`, () => {
      // Compared against the exported vocabulary rather than against a literal, so a reword in
      // `tooltip.ts` moves this surface with it or fails here. Pinned to a copy of the string,
      // this test would pass green with two vocabularies live — which is the whole failure it
      // exists to prevent.
      const spoken = Object.values(UNIT_STANDING);
      for (const item of roster.items) {
        expect(spoken, item.name).toContain(item.standing);
      }
    });
  }

  it('says "unchanged" out loud rather than leaving it to inference', () => {
    // The map looks identical either way, which is exactly why it has to be said — the same
    // reasoning the tooltip's third line already follows.
    const units = readUnitOutlines(
      bundle as never,
      outlines as unknown as UnitOutlineBundle,
      'l1',
    ).features.map((f) => ({ name: f.properties.name, kind: f.properties.kind }));
    const roster = regionRoster(firstLevel, units);
    const sindh = roster.items.find((r) => r.name === 'Sindh');
    expect(sindh?.standing).toBe(UNIT_STANDING.unchanged);
  });

  it('keeps a territory a territory inside a proposal', () => {
    // A variant that carries AJK through has not made it a province, and a roster that dropped the
    // qualification would say it had.
    const units = readUnitOutlines(
      bundle as never,
      outlines as unknown as UnitOutlineBundle,
      'l1',
    ).features.map((f) => ({ name: f.properties.name, kind: f.properties.kind }));
    const ajk = regionRoster(firstLevel, units).items.find((r) =>
      r.name.includes('Azad'),
    );
    expect(ajk?.standing).toMatch(/not constitutionally a province/i);
  });

  it('names a proposed province as proposed, and only a proposed one', () => {
    const units = readUnitOutlines(
      bundle as never,
      outlines as unknown as UnitOutlineBundle,
      'l1',
    ).features.map((f) => ({ name: f.properties.name, kind: f.properties.kind }));
    const roster = regionRoster(firstLevel, units);
    const proposed = roster.items.filter((r) => r.standing === UNIT_STANDING.proposed);
    expect(proposed.map((r) => r.name)).toEqual(['South Punjab']);
  });
});
