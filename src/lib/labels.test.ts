import { geoContains, geoPath } from 'd3';
import { describe, expect, it } from 'vitest';
import bundle from '../../data/bundle/geography.topojson.json';
import context from '../../data/bundle/context.topojson.json';
import outlines from '../../data/bundle/unit-outlines.json';
import type { UnitOutlineBundle } from '../bundle.ts';
import { readCities } from './context.ts';
import { readGeography } from './geography.ts';
import { readUnitOutlines } from './units.ts';
import { fitProjection } from './projection.ts';
import {
  baselineLabelSites,
  labelAnchor,
  labelKey,
  labelText,
  layoutLabels,
  measureLabel,
  variantLabelSites,
  type LabelBox,
  type LabelTier,
} from './labels.ts';

const { provinces, divisions } = readGeography(bundle as never);
/** The city dots, on the same terms the renderer reads them: a name and the point it stands at. */
const cities = readCities(context as never).features.map((f) => ({
  name: f.properties.name,
  anchor: f.geometry.coordinates as [number, number],
}));

describe('labelAnchor', () => {
  it('puts every division label inside the division it names', () => {
    // Muzaffarabad is the case that matters: it wraps around Poonch, so its centroid falls in
    // another division entirely and a label placed there would name the wrong ground.
    const outside = [...divisions.features, ...provinces.features]
      .filter((f) => !geoContains(f as never, labelAnchor(f as never)))
      .map((f) => f.properties.name);
    expect(outside).toEqual([]);
  });
});

describe('baselineLabelSites', () => {
  const sites = baselineLabelSites({ provinces, divisions });

  it('names every province and every real division exactly once', () => {
    expect(sites).toHaveLength(43);
    expect(new Set(sites.map((s) => s.key)).size).toBe(43);
    expect(sites.filter((s) => s.tier === 'province')).toHaveLength(7);
  });

  it('leaves the injected ICT pseudo-division unnamed', () => {
    // Otherwise the capital is labelled twice, once as a thing no one administers.
    expect(sites.map((s) => s.key)).not.toContain('division:Islamabad');
    expect(sites.map((s) => s.key)).toContain('province:Islamabad Capital Territory');
  });

  it('ranks every province above every division, and larger ground above smaller', () => {
    const lowestProvince = Math.min(
      ...sites.filter((s) => s.tier === 'province').map((s) => s.priority),
    );
    const highestDivision = Math.max(
      ...sites.filter((s) => s.tier === 'division').map((s) => s.priority),
    );
    expect(lowestProvince).toBeGreaterThan(highestDivision);

    const priority = new Map(sites.map((s) => [s.key, s.priority]));
    // Balochistan is the largest province and ICT the smallest; Kalat dwarfs Lahore division.
    expect(priority.get('province:Balochistan')).toBeGreaterThan(
      priority.get('province:Islamabad Capital Territory') as number,
    );
    expect(priority.get('division:Kalat')).toBeGreaterThan(
      priority.get('division:Lahore') as number,
    );
  });
});

describe('baselineLabelSites, with the city dots on the map', () => {
  const sites = baselineLabelSites({ provinces, divisions }, cities);
  const keysOf = (tier: string) => sites.filter((s) => s.tier === tier).map((s) => s.text);

  it('names all seven seats', () => {
    expect(keysOf('city').sort()).toEqual([
      'Gilgit',
      'Islamabad',
      'Karachi',
      'Lahore',
      'Muzaffarabad',
      'Peshawar',
      'Quetta',
    ]);
  });

  it('hands a division’s name to the dot where the division is named after its own seat', () => {
    // Six of the seven are: Karachi, Lahore, Peshawar, Quetta, Gilgit and Muzaffarabad each name
    // a division as well as a city. Drawing both would set the same word twice inside one
    // division, once on a dot and once floating in the middle of the ground around it. The dot
    // wins because it is the more precise of the two claims — the division is named *after* it.
    const handed = ['Gilgit', 'Karachi', 'Lahore', 'Muzaffarabad', 'Peshawar', 'Quetta'];
    for (const name of handed) {
      expect(divisions.features.map((d) => d.properties.name)).toContain(name);
      expect(sites.map((s) => s.key)).not.toContain(`division:${name}`);
      expect(sites.map((s) => s.key)).toContain(`city:${name}`);
    }
    // Islamabad is the seventh seat and its division is the injected pseudo-division, which was
    // already unnamed — so the handover costs the map no division name it was drawing.
    expect(keysOf('division')).toHaveLength(36 - handed.length);
  });

  it('ranks the dots under the provinces and over the divisions', () => {
    // A dot is where it says it is and a division name floats at a centroid, so between those two
    // the precise one should win the pixels. Between a dot and a province it should not: a map
    // that has lost "Balochistan" and kept "Quetta" is disorienting in a way the reverse is not.
    const range = (tier: string) => {
      const priorities = sites.filter((s) => s.tier === tier).map((s) => s.priority);
      return { low: Math.min(...priorities), high: Math.max(...priorities) };
    };
    expect(range('province').low).toBeGreaterThan(range('city').high);
    expect(range('city').low).toBeGreaterThan(range('division').high);
  });

  it('sets a city’s name off its own dot rather than on top of it', () => {
    const city = sites.find((s) => s.tier === 'city');
    expect(city?.offset).toBeDefined();
    expect(measureLabel(city as never, [100, 100], Infinity, () => ({ width: 20, height: 10 })).box)
      .toMatchObject({ x: 100, y: 109 });
    // A shape's name goes in the middle of the shape, so it takes no offset at all.
    const province = sites.find((s) => s.tier === 'province');
    expect(province?.offset).toBeUndefined();
  });
});

describe('labelText', () => {
  // Width in "characters" so the test says what it means: 1 unit of width per character.
  const measure = (text: string) => text.length;

  it('spells a name out wherever the ground it names has room for it', () => {
    expect(labelText('Islamabad Capital Territory', 40, measure)).toBe('Islamabad Capital Territory');
  });

  it('falls back to the unit’s own abbreviation where the full name would not fit', () => {
    // ICT is ~906 km², so at any zoom that shows the country its name is wider than it is.
    // Spilling it across Punjab and Azad Kashmir would name ground it does not cover.
    expect(labelText('Islamabad Capital Territory', 8, measure)).toBe('ICT');
    expect(labelText('Azad Jammu & Kashmir', 8, measure)).toBe('AJK');
  });

  it('keeps the full name where no abbreviation is attested, however tight the fit', () => {
    // Made-up short forms would be this app inventing names, which it does not do.
    expect(labelText('Shaheed Benazirabad', 4, measure)).toBe('Shaheed Benazirabad');
  });
});

/**
 * The acceptance criterion itself — division names legible and not overlapping at default zoom —
 * asserted against the real 44 names on a real projection. Text is measured by estimate here
 * rather than by a browser, so the width is generous: a layout that clears at 0.58em per
 * character clears at whatever the serif actually measures.
 */
describe('the baseline map at default zoom', () => {
  const viewport = { width: 1200, height: 800, padding: 32 };
  const project = fitProjection(provinces, viewport);
  const path = geoPath(project);
  // No browser here, so widths are estimated — generously, and with the stylesheet's capitals and
  // tracking accounted for, because a layout that clears at these widths clears at the real ones.
  // Units are set as provinces are — same size, same tracking, told apart by colour and not by
  // scale — so they measure the same way here.
  const measure = (text: string, tier: LabelTier) => {
    if (tier === 'division') return { width: text.length * 10.5 * 0.5, height: 10.5 };
    // A city name is set roman and smaller than a division's — it names a point, not an area.
    if (tier === 'city') return { width: text.length * 9.5 * 0.5, height: 9.5 };
    return { width: text.length * (13 * 0.68 + 1.5), height: 13 };
  };
  const width = (f: { geometry: unknown }) => {
    const [[west], [east]] = path.bounds(f as never);
    return east - west;
  };
  // Keyed exactly as the renderer keys it — by `labelKey`, not by the display text. Keying by
  // text here would agree with production by coincidence and stop agreeing the moment a name
  // is abbreviated or a division and a province share one.
  const shapeWidth = new Map([
    ...provinces.features.map(
      (f) => [labelKey('province', f.properties.name), width(f)] as const,
    ),
    ...divisions.features.map(
      (f) => [labelKey('division', f.properties.name), width(f)] as const,
    ),
  ]);

  const measured = baselineLabelSites({ provinces, divisions }, cities).flatMap((site) => {
    const point = project(site.anchor);
    if (point === null) return [];
    return [measureLabel(site, point, shapeWidth.get(site.key) ?? Infinity, measure)];
  });
  const result = layoutLabels(
    measured.map((m) => m.box),
    { bounds: viewport, gap: 3 },
  );
  const sized = new Map(measured.map((m) => [m.box.key, m.box]));

  it('draws no two names on top of one another', () => {
    for (const a of result) {
      const boxA = sized.get(a.key) as LabelBox;
      for (const b of result) {
        if (a.key === b.key) continue;
        const boxB = sized.get(b.key) as LabelBox;
        const apart =
          Math.abs(a.x - b.x) >= (boxA.width + boxB.width) / 2 ||
          Math.abs(a.y - b.y) >= (boxA.height + boxB.height) / 2;
        expect(apart, `${a.key} overlaps ${b.key}`).toBe(true);
      }
    }
  });

  it('names every province, including both territories', () => {
    const drawn = new Set(keys(result));
    // AJK and GB are named here or they are named nowhere: CLAUDE.md requires both drawn *and*
    // named, and unlike a division neither has a second chance further down the tier.
    const unnamed = provinces.features
      .map((p) => p.properties.name)
      .filter((name) => !drawn.has(labelKey('province', name)));
    expect(unnamed).toEqual([]);
  });

  it('drops these divisions at default zoom, and no others', () => {
    // Named rather than counted. A floor of "at least 34" passes while three divisions go
    // silently unnamed and never says which — and which ones matter: a drop is only acceptable
    // because the name returns on zoom, so a change in this list is a change in what the
    // opening view of the country says, and belongs in a diff.
    //
    // A division named after its own seat is not counted as dropped: its name is on the map, at
    // the dot. It is drawn under `city:` rather than `division:`, which is the handover and not
    // a loss — so the test asks for the *name*, at either key, and Poonch is still the one
    // division whose name is nowhere.
    const drawn = new Set(keys(result));
    const dropped = divisions.features
      .filter((d) => d.properties.pseudo !== true)
      .map((d) => d.properties.name)
      .filter(
        (name) =>
          !drawn.has(labelKey('division', name)) && !drawn.has(labelKey('city', name)),
      );
    expect(dropped.sort()).toEqual(['Poonch']);
  });

  it('names every seat, since a dot with no name is a landmark a reader cannot use', () => {
    // The dots are drawn whatever happens; it is the names that take part in the layout. Seven of
    // them at default zoom is what the whole point of the tier being sparse buys.
    const drawn = new Set(keys(result));
    const unnamed = cities
      .map((city) => city.name)
      .filter((name) => !drawn.has(labelKey('city', name)));
    expect(unnamed).toEqual([]);
  });
});

describe('variantLabelSites', () => {
  const units = readUnitOutlines(bundle as never, outlines as unknown as UnitOutlineBundle, 'l1');
  const sites = variantLabelSites({ divisions }, units.features);

  it('names every unit of the active variant exactly once', () => {
    const named = sites.filter((s) => s.tier === 'unit').map((s) => s.text);
    expect(named).toEqual(units.features.map((f) => f.properties.name));
    expect(new Set(named).size).toBe(named.length);
  });

  it('hands the province names over to the units rather than drawing both', () => {
    // Seven of L1's eight units *are* current provinces carried through unchanged, so drawing
    // both tiers would set "Sindh" twice a few pixels apart, in two colours — and beside South
    // Punjab it would set the proposal's name next to the name of the province it is carved out
    // of, which reads as two claims about one piece of ground.
    expect(sites.filter((s) => s.tier === 'province')).toEqual([]);
    const punjab = sites.filter((s) => s.text === 'Punjab');
    expect(punjab).toHaveLength(1);
    expect(punjab[0]?.tier).toBe('unit');
  });

  it('keeps the divisions, and keeps skipping the injected ICT pseudo-division', () => {
    const divisionKeys = sites.filter((s) => s.tier === 'division').map((s) => s.key);
    expect(divisionKeys).toHaveLength(36);
    expect(divisionKeys).not.toContain('division:Islamabad');
  });

  it('ranks every unit above every division', () => {
    const lowestUnit = Math.min(...sites.filter((s) => s.tier === 'unit').map((s) => s.priority));
    const highest = Math.max(...sites.filter((s) => s.tier === 'division').map((s) => s.priority));
    expect(lowestUnit).toBeGreaterThan(highest);
  });

  it('anchors South Punjab inside South Punjab, not inside the province it leaves', () => {
    const south = units.features.find((f) => f.properties.unit === 'south-punjab');
    const site = sites.find((s) => s.text === 'South Punjab');
    expect(geoContains(south as never, site?.anchor as [number, number])).toBe(true);
    const punjab = units.features.find((f) => f.properties.unit === 'punjab');
    expect(geoContains(punjab as never, site?.anchor as [number, number])).toBe(false);
  });
});

const box = (key: string, x: number, y: number, priority = 0): LabelBox => ({
  key,
  x,
  y,
  width: 40,
  height: 12,
  priority,
});

const frame = { bounds: { width: 400, height: 300 }, gap: 2 };
const keys = (result: readonly { key: string }[]) => result.map((l) => l.key);

describe('layoutLabels', () => {
  it('leaves labels that do not collide on their own anchors', () => {
    expect(layoutLabels([box('a', 50, 50), box('b', 300, 200)], frame)).toEqual([
      { key: 'a', x: 50, y: 50 },
      { key: 'b', x: 300, y: 200 },
    ]);
  });

  it('keeps the higher-priority label on its anchor and moves the other off it', () => {
    const result = layoutLabels([box('small', 100, 100, 1), box('big', 104, 102, 9)], frame);
    expect(result).toContainEqual({ key: 'big', x: 104, y: 102 });
    const moved = result.find((l) => l.key === 'small');
    expect(moved?.y).not.toBe(100);
  });

  it('drops a label that cannot be placed anywhere clear, rather than overlapping', () => {
    // Eight labels stacked on one point: more than the nudge ladder can find room for.
    const crowd = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => box(`l${n}`, 200, 150, n));
    const result = layoutLabels(crowd, frame);
    expect(result.length).toBeLessThan(crowd.length);
    for (const a of result) {
      for (const b of result) {
        if (a.key === b.key) continue;
        expect(Math.abs(a.x - b.x) >= 42 || Math.abs(a.y - b.y) >= 14).toBe(true);
      }
    }
  });

  it('drops labels that have panned outside the frame', () => {
    expect(keys(layoutLabels([box('in', 200, 150), box('out', -400, 150)], frame))).toEqual(['in']);
  });

  it('does not depend on the order labels arrive in', () => {
    const labels = [box('a', 100, 100, 1), box('b', 104, 102, 1), box('c', 108, 104, 1)];
    expect(layoutLabels(labels, frame)).toEqual(layoutLabels([...labels].reverse(), frame));
  });
});
