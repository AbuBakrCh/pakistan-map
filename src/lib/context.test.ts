/**
 * The furniture (#8), held over the committed context bundle.
 *
 * Two things could go wrong here that nothing else would catch, and both are political rather
 * than cosmetic. A silhouette drawn over ground the map calls Pakistan-administered is a claim
 * this app has made by accident — it would be invisible on screen, because the silhouettes are
 * drawn beneath the land, and would still be in the artifact anyone can read. And a dot labelled
 * as a capital that is not one, or a country labelled as a country it is not, is an unsourced
 * surface with a name on it.
 *
 * Every probe point below is typed in rather than read back off the geometry, so a boundary that
 * moved fails instead of agreeing with itself.
 */

import { geoBounds, geoContains } from 'd3';
import { describe, expect, it } from 'vitest';
import bundle from '../../data/bundle/geography.topojson.json';
import context from '../../data/bundle/context.topojson.json';
import type { ContextProvenance } from './context.ts';
import { boundaryNote, readCities, readSilhouettes } from './context.ts';
import { readDistricts, readGeography } from './geography.ts';

const silhouettes = readSilhouettes(context as never);
const cities = readCities(context as never);
const provenance = (context as { provenance: unknown }).provenance as ContextProvenance;
const districts = readDistricts(bundle as never);
const { provinces } = readGeography(bundle as never);

/** A point that is unambiguously in that country, and nowhere near a line this app draws dashed. */
const ABROAD: readonly [string, [number, number]][] = [
  ['Afghanistan', [69.1723, 34.5281]], // Kabul
  ['Afghanistan', [65.7372, 31.6133]], // Kandahar
  ['China', [75.9877, 39.4704]], // Kashgar
  ['India', [77.209, 28.6139]], // Delhi
  ['India', [72.5714, 23.0225]], // Ahmedabad
  ['Iran', [60.8629, 29.4963]], // Zahedan
  ['Iran', [51.389, 35.6892]], // Tehran
];

describe('the neighbour silhouettes', () => {
  it('draws all four of the countries Pakistan borders, and nothing else', () => {
    expect(silhouettes.features.map((f) => f.properties.name).sort()).toEqual([
      'Afghanistan',
      'China',
      'India',
      'Iran',
    ]);
    expect(silhouettes.features.map((f) => f.properties.iso).sort()).toEqual([
      'AF',
      'CN',
      'IN',
      'IR',
    ]);
  });

  it('puts each country’s own ground inside the shape drawn under its name', () => {
    // Four faint blobs could be four arbitrary countries. This is what makes the names on them a
    // claim rather than a caption: Kabul is in the shape called Afghanistan or the shape is not
    // Afghanistan, whatever the artifact says.
    const wrong = ABROAD.flatMap(([country, point]) => {
      const shape = silhouettes.features.find((f) => f.properties.name === country);
      return shape !== undefined && geoContains(shape as never, point)
        ? []
        : [`${point.join(', ')} is not inside ${country}`];
    });
    expect(wrong).toEqual([]);
  });

  it('says which stretch of Pakistan’s own outline each one lies across', () => {
    for (const f of silhouettes.features) {
      expect(f.properties.faces.length, f.properties.name).toBeGreaterThan(0);
    }
  });

  it('draws no neighbour over any district this map calls Pakistan-administered', () => {
    // The one that matters. OSM draws these four as they are administered rather than as they are
    // claimed, so India stops at the Line of Control and China at Aksai Chin — but that is an
    // upstream property, not a guarantee, and a build that inherited a claimed boundary instead
    // would put India over Gilgit-Baltistan with nothing red anywhere. Asked of all 156 drawn
    // districts, AJK's and GB's twenty included, which are exactly the ones at stake.
    const trespass = districts.features.flatMap((district) => {
      const point = interiorPoint(district);
      if (point === null) return [];
      return silhouettes.features
        .filter((neighbour) => geoContains(neighbour as never, point))
        .map((neighbour) => `${neighbour.properties.name} covers ${district.properties.name}`);
    });
    expect(trespass).toEqual([]);
  });

  it('does not overlap itself, so no two silhouettes stack into a third tone', () => {
    // They are filled flat rather than tinted precisely so an overlap could not show. This says
    // there is none to hide: Aksai Chin is China's here and Ladakh is India's, not both.
    const overlaps: string[] = [];
    for (const a of silhouettes.features) {
      const point = interiorPoint(a);
      if (point === null) continue;
      for (const b of silhouettes.features) {
        if (a === b) continue;
        if (geoContains(b as never, point)) {
          overlaps.push(`${b.properties.name} contains a point inside ${a.properties.name}`);
        }
      }
    }
    expect(overlaps).toEqual([]);
  });
});

describe('the Durand Line footnote', () => {
  const note = boundaryNote(provenance, 'AF');

  it('is carried with Afghanistan’s silhouette rather than typed into the renderer', () => {
    // Same rule the ceasefire line's own note follows: the caveat ships with the geometry, so it
    // cannot be lost while the line it qualifies is still on screen.
    expect(note).not.toBeNull();
  });

  it('says the boundary is the Durand Line and that Afghanistan has never recognised it', () => {
    expect(note?.text).toMatch(/Durand Line/);
    expect(note?.text).toMatch(/1893/);
    expect(note?.text).toMatch(/No Afghan government has recognised it/);
  });

  it('says it is drawn as an ordinary boundary, not dashed', () => {
    // The distinction D12 exists to protect: the dash means *ceasefire line*, and there is one of
    // those on this map. A footnote that did not say which line it is talking about would leave a
    // reader to infer that a disputed boundary and a ceasefire line are the same kind of thing.
    expect(note?.text).toMatch(/not dashed/);
    expect(note?.text).toMatch(/Line of Control/);
  });

  it('cites the documents it argues from, and is badged for the kind of claim it is', () => {
    // The assertions above only check the app says what it means to say — quoting a sentence back
    // at itself proves nothing about whether it is true. What can be checked is that the claim is
    // traceable: every date the note asserts as fact appears in a source line beside it, and the
    // note wears a badge from the closed vocabulary. That is the working agreement's actual
    // requirement — not that the prose be right, but that a reader be able to go and check it.
    expect(note?.badge).toBe('documented');
    expect(note?.source).toMatch(/1893/);
    expect(note?.source).toMatch(/1949/);
    // Every year the prose states as fact is a year the source accounts for.
    const claimed = new Set(note?.text.match(/\b1[89]\d{2}\b/g) ?? []);
    const cited = new Set(note?.source.match(/\b1[89]\d{2}\b/g) ?? []);
    // 1947 is Pakistan's inheritance of the line, not a document the note argues from.
    claimed.delete('1947');
    expect([...claimed].filter((year) => !cited.has(year))).toEqual([]);
  });

  it('is the only boundary note, because it is the only ordinary boundary in dispute', () => {
    expect(Object.keys(provenance.neighbours.boundaryNotes)).toEqual(['AF']);
  });
});

describe('the city dots', () => {
  it('draws the seat of every first-level unit, and only those', () => {
    expect(cities.features.map((f) => f.properties.name)).toEqual([
      'Gilgit',
      'Islamabad',
      'Karachi',
      'Lahore',
      'Muzaffarabad',
      'Peshawar',
      'Quetta',
    ]);
  });

  it('names each dot as the seat of exactly one unit, covering all seven', () => {
    // A dot is joined to its unit by identity — the node that unit's own relation calls its
    // `admin_centre` — so this is what says the join landed, rather than that seven dots exist.
    const seats = cities.features.map((f) => f.properties.of);
    expect(new Set(seats).size).toBe(seats.length);
    expect(seats.sort()).toEqual(provinces.features.map((f) => f.properties.name).sort());
  });

  it('stands each dot on the unit it is the seat of', () => {
    const misplaced = cities.features.flatMap((city) => {
      const unit = provinces.features.find((f) => f.properties.name === city.properties.of);
      const point = city.geometry.coordinates as [number, number];
      return unit !== undefined && geoContains(unit as never, point)
        ? []
        : [`${city.properties.name} is not inside ${city.properties.of}`];
    });
    expect(misplaced).toEqual([]);
  });

  it('states the criterion, why it is administrative, and what it leaves out', () => {
    // "Major city" reads as *largest*, and here it means *seat*. The four larger cities the rule
    // omits are named in the artifact so the omission reads as a rule rather than an oversight —
    // the working agreement's no-unsourced-surface obligation applied to a dot.
    expect(provenance.cities.badge).toBe('official');
    expect(provenance.cities.criterion).toMatch(/seat of a first-level unit/);
    expect(provenance.cities.why).toMatch(/no city population exists/i);
    expect(provenance.cities.omits).toMatch(/Faisalabad/);
    expect(provenance.cities.count).toBe(cities.features.length);
  });
});

/** A point the shape itself contains, found by sampling its bounding box from the middle out. */
function interiorPoint(feature: { geometry: unknown }): [number, number] | null {
  const [[west, south], [east, north]] = geoBounds(feature as never);
  const steps = 15;
  const middle = (steps - 1) / 2;
  const order = [...Array(steps).keys()].sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle));
  for (const x of order) {
    for (const y of order) {
      const point: [number, number] = [
        west + ((east - west) * x) / (steps - 1),
        south + ((north - south) * y) / (steps - 1),
      ];
      if (geoContains(feature as never, point)) return point;
    }
  }
  return null;
}
