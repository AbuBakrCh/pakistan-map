/**
 * The palette's colourblind safety, computed rather than eyeballed.
 *
 * Held over the real committed bundle, through the real palette, the way the label tests are:
 * the pairs checked are the pairs that actually share a border on the map that ships, and the
 * pairs that fail are **named**, not counted. Fifteen categories is well past the number any
 * categorical palette keeps pairwise-distinct, so a floor of "no more than N weak pairs" would
 * pass while the two colours a reader most needs to tell apart collapsed into one another.
 */

import { describe, expect, it } from 'vitest';
import bundle from '../../data/bundle/geography.topojson.json';
import statistics from '../../data/bundle/statistics.json';
import type { CensusStatistics } from '../bundle.ts';
import { contrastRatio, deltaE, dichromatSeparation, lightnessChroma } from './colour-vision.ts';
import { motherTongueFills } from './mother-tongue.ts';
import {
  ACCENT,
  LAND,
  MOTHER_TONGUE_CATEGORIES,
  UNSEPARATED_PAIRS,
  motherTongueFill,
  type MotherTongue,
} from './palette.ts';

const census = statistics as unknown as CensusStatistics;

/**
 * The `dataviz` skill's gates, in OKLab ΔE × 100. `CVD_TARGET` is the number the skill wants on
 * the active pairlist; `NORMAL_FLOOR` is its hard gate for unimpaired vision, which secondary
 * encoding does not excuse.
 */
const CVD_TARGET = 8;
/**
 * Tritanopia is reported rather than gated by the skill — its thresholds are calibrated on
 * protan and deutan. It is held here at the skill's own lower CVD floor rather than at its
 * target, which is the honest bar: strong enough that a tritanope is not handed two identical
 * fills across a border, not so strong that it would dictate a palette for a deficiency two
 * orders of magnitude rarer than the ones the target is for.
 */
const TRITAN_FLOOR = 6;
const NORMAL_FLOOR = 15;
/**
 * How far a fill must sit from the unshaded land tone. Not from the paper margin: a district
 * that is not shaded shows land, so land is what a shaded one must not be mistaken for.
 */
const LAND_FLOOR = 10;

const colours = MOTHER_TONGUE_CATEGORIES.map((c) => motherTongueFill[c]);

describe('the palette', () => {
  it('covers every category the census publishes, and no invented one', () => {
    // Read off the artifact rather than typed: a sixteenth category in a future release must
    // fail here as well as in the build, because a category with no colour would render as an
    // absence — the map saying "not recorded" about a language PBS chose to name.
    expect([...MOTHER_TONGUE_CATEGORIES]).toEqual([...census.motherTongue.categories]);
  });

  it('gives every category its own colour', () => {
    expect(new Set(colours).size).toBe(MOTHER_TONGUE_CATEGORIES.length);
  });

  it('spends no fill on the accent held for unit outlines', () => {
    // Stratum 3 is the accent's alone. Whether an outline in it *reads* over a fill is the
    // contrast assertion above; this one is that no fill is confusable with the accent itself,
    // held at the same floor as any other pair a reader has to tell apart.
    const near = MOTHER_TONGUE_CATEGORIES.filter(
      (c) => deltaE(motherTongueFill[c], ACCENT) < NORMAL_FLOOR,
    );
    expect(near).toEqual([]);
  });

  it('stays muted, and light enough for a heavy outline to read on top', () => {
    // Chroma is capped, not floored: the `dataviz` chroma floor of 0.10 is calibrated for thin
    // marks on white, where a low-chroma hue disappears. These are area fills on warm paper
    // under a heavy accent outline, and CLAUDE.md's visual direction is explicit — muted,
    // desaturated. Lightness likewise sits above the skill's 0.43–0.77 band on purpose: a fill
    // at L 0.5 would swallow the outline it is supposed to sit beneath.
    for (const category of MOTHER_TONGUE_CATEGORIES) {
      const hex = motherTongueFill[category];
      const { lightness, chroma } = lightnessChroma(hex);
      expect(chroma, `${category} ${hex} chroma`).toBeLessThanOrEqual(0.125);
      expect(lightness, `${category} ${hex} lightness`).toBeGreaterThanOrEqual(0.72);
      expect(contrastRatio(hex, ACCENT), `${category} ${hex} against the unit accent`)
        .toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every fill clear of the unshaded land tone', () => {
    // A district the basis does not reach keeps the land tone. A fill too near it would say
    // "no census data" about a district PBS published in full.
    for (const category of MOTHER_TONGUE_CATEGORIES) {
      expect(deltaE(motherTongueFill[category], LAND), `${category} against unshaded land`)
        .toBeGreaterThanOrEqual(LAND_FLOOR);
    }
  });
});

/**
 * Which categories share a border on the real map, derived from the bundle's own arcs: two
 * districts are neighbours exactly when they share one. (#16 will publish an adjacency graph in
 * the artifact; this is the same relation computed locally, and this test should move onto it.)
 *
 * This is the pairlist that matters for a choropleth. The `dataviz` skill's all-pairs rule
 * assumes any two marks can end up side by side — true of a scatter, false of a map, where a
 * fill's neighbours are fixed by geography. Punjabi and Sindhi are never adjacent in Pakistan;
 * Balochi and Brahvi are adjacent everywhere.
 */
function touchingCategories(): { pair: [MotherTongue, MotherTongue]; via: [string, string] }[] {
  const geometries = (bundle as unknown as {
    objects: { districts: { geometries: { arcs: unknown; properties: { name: string } }[] } };
  }).objects.districts.geometries;

  const owners = new Map<number, number[]>();
  geometries.forEach((geometry, index) => {
    const walk = (arcs: unknown): void => {
      if (typeof arcs === 'number') {
        const id = arcs < 0 ? ~arcs : arcs;
        const list = owners.get(id);
        if (list === undefined) owners.set(id, [index]);
        else if (!list.includes(index)) list.push(index);
      } else (arcs as unknown[]).forEach(walk);
    };
    walk(geometry.arcs);
  });

  const fills = motherTongueFills(census);
  const seen = new Map<string, { pair: [MotherTongue, MotherTongue]; via: [string, string] }>();
  for (const owner of owners.values()) {
    for (let i = 0; i < owner.length; i++) {
      for (let j = i + 1; j < owner.length; j++) {
        const [a, b] = [geometries[owner[i]!]!.properties.name, geometries[owner[j]!]!.properties.name];
        const [fa, fb] = [fills.get(a), fills.get(b)];
        if (fa?.kind !== 'category' || fb?.kind !== 'category') continue;
        if (fa.category === fb.category) continue;
        const key = [fa.category, fb.category].sort().join('|');
        if (!seen.has(key)) seen.set(key, { pair: [fa.category, fb.category], via: [a, b] });
      }
    }
  }
  return [...seen.values()];
}

describe('colourblind separation, on the pairs that share a border', () => {
  const touching = touchingCategories();

  it('finds the borders to check on the real bundle', () => {
    // If this ever drops to nothing the rest of the block passes vacuously, which is the one
    // failure mode a max/min assertion cannot see.
    expect(touching.length).toBeGreaterThan(10);
  });

  for (const [deficiency, floor] of [
    ['protan', CVD_TARGET],
    ['deutan', CVD_TARGET],
    ['tritan', TRITAN_FLOOR],
  ] as const) {
    it(`separates every touching pair under ${deficiency}opia`, () => {
      const weak = touching
        .filter(
          ({ pair }) =>
            deltaE(motherTongueFill[pair[0]], motherTongueFill[pair[1]], deficiency) < floor,
        )
        .map(({ pair, via }) => `${pair[0]}↔${pair[1]} (${via[0]}↔${via[1]})`);
      expect(weak).toEqual([]);
    });
  }

  it('separates every touching pair for unimpaired vision too', () => {
    const weak = touching
      .filter(({ pair }) => deltaE(motherTongueFill[pair[0]], motherTongueFill[pair[1]]) < NORMAL_FLOOR)
      .map(({ pair, via }) => `${pair[0]}↔${pair[1]} (${via[0]}↔${via[1]})`);
    expect(weak).toEqual([]);
  });
});

describe('the pairs the palette cannot separate', () => {
  /**
   * Named, not counted, and not hidden. Fifteen categories cannot all be told apart at once —
   * the `dataviz` skill's own reference palette caps an all-pairs form at three slots — so this
   * lists exactly which pairs fall short when any two swatches sit side by side, as they do in
   * the legend. None of them share a border on the map, which is why the palette is usable; if
   * one ever does, the block above fails first.
   */
  const weak = (): string[] => {
    const out: string[] = [];
    for (let i = 0; i < MOTHER_TONGUE_CATEGORIES.length; i++) {
      for (let j = i + 1; j < MOTHER_TONGUE_CATEGORIES.length; j++) {
        const [a, b] = [MOTHER_TONGUE_CATEGORIES[i]!, MOTHER_TONGUE_CATEGORIES[j]!];
        const [ha, hb] = [motherTongueFill[a], motherTongueFill[b]];
        if (
          dichromatSeparation(ha, hb) < CVD_TARGET ||
          deltaE(ha, hb, 'tritan') < TRITAN_FLOOR ||
          deltaE(ha, hb) < NORMAL_FLOOR
        ) {
          out.push(`${a}↔${b}`);
        }
      }
    }
    return out.sort();
  };

  it('is exactly this list, and the list is in the module for a reader to find', () => {
    expect(weak()).toEqual([...UNSEPARATED_PAIRS].sort());
  });

  it('has no pair on it that shares a border', () => {
    const touching = new Set(touchingCategories().map(({ pair }) => [...pair].sort().join('↔')));
    expect(UNSEPARATED_PAIRS.filter((p) => touching.has(p))).toEqual([]);
  });
});
