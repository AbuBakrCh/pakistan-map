import { geoContains, geoPath } from 'd3';
import { describe, expect, it } from 'vitest';
import bundle from '../../data/bundle/geography.topojson.json';
import { readGeography } from './geography.ts';
import { fitProjection } from './projection.ts';
import {
  baselineLabelSites,
  labelAnchor,
  labelText,
  layoutLabels,
  measureLabel,
  type LabelBox,
} from './labels.ts';

const { provinces, divisions } = readGeography(bundle as never);

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
  const measure = (text: string, tier: 'province' | 'division') => {
    const size = tier === 'province' ? 13 : 10.5;
    return tier === 'province'
      ? { width: text.length * (size * 0.68 + 1.5), height: size }
      : { width: text.length * size * 0.5, height: size };
  };
  const shapeWidth = new Map(
    [...provinces.features, ...divisions.features].map((f) => {
      const [[west], [east]] = path.bounds(f as never);
      return [f.properties.name, east - west];
    }),
  );

  const measured = baselineLabelSites({ provinces, divisions }).flatMap((site) => {
    const point = project(site.anchor);
    if (point === null) return [];
    return [measureLabel(site, point, shapeWidth.get(site.text) ?? Infinity, measure)];
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

  it('names every province and all but a handful of divisions', () => {
    const drawn = new Set(keys(result));
    for (const province of provinces.features) {
      expect(drawn).toContain(`province:${province.properties.name}`);
    }
    const divisionsDrawn = [...drawn].filter((k) => k.startsWith('division:'));
    expect(divisionsDrawn.length).toBeGreaterThanOrEqual(34);
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
