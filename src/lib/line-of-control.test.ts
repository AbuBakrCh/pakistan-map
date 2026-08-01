/**
 * The ceasefire line, checked against the artifact that ships.
 *
 * The claim this ticket rests on is not "a dashed line is drawn" — it is "the dashed line is the
 * *right stretch*". That is provable here rather than by eye, because the bundle is a shared-arc
 * topology: the line and the boundary it qualifies are made of literally the same arcs, so
 * "which boundary is this?" is a set question on integer arc indices, with no tolerance in it.
 */

import { geoLength } from 'd3';
import { describe, expect, it } from 'vitest';
import bundle from '../../data/bundle/geography.topojson.json';
import { arcsOf, labelAlongLine, readLineOfControl } from './line-of-control.ts';
import { fitProjection } from './projection.ts';
import { readGeography } from './geography.ts';
import { labelAnchor } from './labels.ts';

const topology = bundle as never as Parameters<typeof readLineOfControl>[0];

/** Arc indices of every first-level shape, by name. */
const provinceArcs = new Map(
  (
    (bundle as unknown as { objects: { provinces: { geometries: { properties: { name: string } }[] } } })
      .objects.provinces.geometries
  ).map((geometry) => [geometry.properties.name, arcsOf(geometry as never)]),
);

describe('readLineOfControl', () => {
  it('reads one continuous line out of the committed bundle', () => {
    const line = readLineOfControl(topology);
    expect(line.geometry.coordinates).toHaveLength(1);
    expect(line.properties.name).toBe('Line of Control');
  });

  it('runs from the Chenab in Jammu to the Karakoram, not from anywhere else', () => {
    // Named rather than counted. The southern end is the ceasefire line's own terminus, where
    // the Working Boundary takes over; the northern end is in the Siachen area. If the
    // derivation ever picks up the Working Boundary or the China frontier, one of these moves.
    const [chain] = readLineOfControl(topology).geometry.coordinates;
    const [south, north] = [chain?.[0] as number[], chain?.[chain.length - 1] as number[]];
    expect(south[0]).toBeCloseTo(74.46, 1);
    expect(south[1]).toBeCloseTo(32.78, 1);
    expect(north[0]).toBeCloseTo(76.78, 1);
    expect(north[1]).toBeCloseTo(35.66, 1);
  });

  it('is as long on the page as the provenance says it is', () => {
    // Not a published figure and not claimed as one: published LoC lengths are lengths of the
    // line as a claim. This is the length of the line in the artifact, measured here and stated
    // there by two different code paths, so prose and geometry cannot drift apart quietly.
    const drawn = geoLength(readLineOfControl(topology).geometry as never) * 6371;
    const stated = (bundle as unknown as { provenance: { lineOfControl: { lengthKm: number } } })
      .provenance.lineOfControl.lengthKm;
    expect(drawn).toBeCloseTo(stated, 0);
    // And in the right order of magnitude for a line from the Chenab to the Karakoram, so a
    // wholesale change of stretch cannot pass by moving both numbers together.
    expect(stated).toBeGreaterThan(850);
    expect(stated).toBeLessThan(1050);
  });

  it('refuses a bundle with no line rather than letting the eastern edge render solid', () => {
    const without = { ...(bundle as object), objects: { provinces: {}, divisions: {} } };
    expect(() => readLineOfControl(without as never)).toThrow(/Line of Control/);
  });
});

describe('the stretch it names', () => {
  const line = arcsOf(
    (bundle as unknown as { objects: { lineOfControl: unknown } }).objects.lineOfControl as never,
  );

  it('is made only of arcs belonging to the two territories', () => {
    const elsewhere = [...provinceArcs]
      .filter(([name]) => name !== 'Azad Jammu & Kashmir' && name !== 'Gilgit-Baltistan')
      .flatMap(([name, arcs]) => [...line].filter((arc) => arcs.has(arc)).map(() => name));
    // Punjab is the one that would show up here: Sialkot and Narowal share boundary ways with
    // Jammu and Kashmir too, but that stretch is the Working Boundary, not the ceasefire line.
    expect(elsewhere).toEqual([]);
  });

  it('is the whole of Azad Jammu & Kashmir’s outer boundary', () => {
    // AJK meets no country but India-administered Kashmir, so every arc of its boundary that is
    // not shared with another Pakistani unit must be on the line. Any shortfall is a gap.
    const exterior = exteriorArcsOf('Azad Jammu & Kashmir');
    expect([...exterior].filter((arc) => !line.has(arc))).toEqual([]);
  });

  it('is only part of Gilgit-Baltistan’s, the rest being the China and Afghanistan frontier', () => {
    // The complement is the point of this one: a rule that swept up GB's whole outer edge would
    // be drawing the Karakoram border as a ceasefire line, which it is not.
    const frontier = [...exteriorArcsOf('Gilgit-Baltistan')].filter((arc) => !line.has(arc));
    expect(frontier).toHaveLength(3);
    // Those three run along the north, above the northernmost point the ceasefire line reaches.
    const northOf = (arcs: number[]) =>
      Math.max(...arcs.flatMap((arc) => positionsOfArc(arc).map(([, lat]) => lat)));
    expect(northOf(frontier)).toBeGreaterThan(northOf([...line]));
  });

  it('names the districts it runs along', () => {
    const along = (
      bundle as unknown as { provenance: { lineOfControl: { alongDistricts: string[] } } }
    ).provenance.lineOfControl.alongDistricts;
    expect(along).toEqual([
      'Astore',
      'Bagh',
      'Bhimber',
      'Ghanche',
      'Hattian Bala',
      'Haveli',
      'Kharmaung',
      'Kotli',
      'Neelum',
      'Poonch',
      'Shigar',
      'Skardu',
    ]);
  });
});

describe('labelAlongLine', () => {
  const options = {
    bounds: { width: 400, height: 400 },
    margin: 8,
    offset: 10,
    minRun: 60,
    reach: 30,
    // The country lies west of this line, as Pakistan lies west of the real one.
    awayFrom: [0, 200] as [number, number],
  };

  it('sets the label along the line, reading up a line that runs north', () => {
    const placed = labelAlongLine([[[200, 300], [200, 100]]], options);
    expect(placed).not.toBeNull();
    expect(placed?.y).toBeCloseTo(200, 5);
    expect(placed?.angle).toBeCloseTo(-90, 5);
    // Offset away from the country, so the name never sits over ground it does not describe.
    expect(placed?.x).toBeCloseTo(210, 5);
  });

  it('puts the name on the far side of the line whichever way the line turns', () => {
    // The real line turns east at both ends. A fixed compass offset would drop the name onto
    // Kashmir there; offsetting away from the country keeps it on the empty side.
    const eastward = labelAlongLine([[[100, 200], [300, 200]]], {
      ...options,
      awayFrom: [200, 400],
    });
    expect(eastward?.y).toBeCloseTo(190, 5);
  });

  it('follows the part of the line that is actually on screen', () => {
    // Zooming pushes most of the line out of the frame. The label belongs on what is left, not
    // at the midpoint of a line whose midpoint is no longer visible.
    const placed = labelAlongLine([[[200, 900], [200, 700], [200, 300], [200, 100]]], options);
    expect(placed?.y).toBeGreaterThan(100);
    expect(placed?.y).toBeLessThan(300);
  });

  it('draws no label rather than a label on a stub of line', () => {
    expect(labelAlongLine([[[200, 200], [200, 220]]], options)).toBeNull();
    expect(labelAlongLine([[[-50, 200], [-40, 220]]], options)).toBeNull();
  });

  it('takes the other side of the line when the outward side is over land', () => {
    // The stretch where this bites is the one that turns east: outward from the middle of the
    // country is north there, and north is Gilgit-Baltistan.
    // Everything east of the line is land here; only the west side is clear.
    const placed = labelAlongLine([[[200, 300], [200, 100]]], {
      ...options,
      forms: [{ text: 'Line of Control', permits: () => true, prefers: (c) => c.x < 200 }],
    });
    expect(placed?.x).toBeCloseTo(190, 5);
  });

  it('walks along the line before giving up on a clear side', () => {
    // Only the northern third of this line has anywhere clear to put the name.
    const placed = labelAlongLine([[[200, 380], [200, 20]]], {
      ...options,
      forms: [{ text: 'Line of Control', permits: () => true, prefers: (c) => c.y < 120 }],
    });
    expect(placed?.y).toBeLessThan(120);
  });

  /*
   * The concession ladder. Land is a compromise the name may make; another name is not — two
   * names on top of each other leaves neither readable, and the map already refuses that for
   * every tier name. So the order is: full name on clear paper, full name over land, short name
   * on clear paper, short name over land, nothing.
   */
  it('gives up clear ground before it gives up the full name', () => {
    // Nowhere on this line is off the land, but nothing is in the way of a name.
    const placed = labelAlongLine([[[200, 380], [200, 20]]], {
      ...options,
      forms: [
        { text: 'Line of Control', permits: () => true, prefers: () => false },
        { text: 'LoC', permits: () => true },
      ],
    });
    expect(placed?.text).toBe('Line of Control');
  });

  it('shortens the name rather than setting it over another name', () => {
    // The full name collides everywhere; the short one fits. An abbreviation costs a reader a
    // little, and a collision costs them both names.
    const placed = labelAlongLine([[[200, 380], [200, 20]]], {
      ...options,
      forms: [
        { text: 'Line of Control', permits: () => false },
        { text: 'LoC', permits: () => true },
      ],
    });
    expect(placed?.text).toBe('LoC');
  });

  it('draws no name at all rather than one over another name', () => {
    // Not a fallback onto the middle: the legend keys the dash under every basis, so an unnamed
    // line is still an explained one, and a name through a name is not.
    const placed = labelAlongLine([[[200, 380], [200, 20]]], {
      ...options,
      forms: [
        { text: 'Line of Control', permits: () => false },
        { text: 'LoC', permits: () => false },
      ],
    });
    expect(placed).toBeNull();
  });

  it('never returns a placement its own form refuses, however crowded the frame', () => {
    // The property behind the three cases above, asserted rather than sampled: whatever the line
    // and whatever is in the way, a returned placement satisfies the form that produced it.
    const banned = { x0: 150, y0: 100, x1: 250, y1: 300 };
    const permits = (c: { x: number; y: number }) =>
      !(c.x > banned.x0 && c.x < banned.x1 && c.y > banned.y0 && c.y < banned.y1);
    for (const line of [
      [[200, 380] as const, [200, 20] as const],
      [[100, 200] as const, [300, 200] as const],
      [[300, 100] as const, [100, 300] as const],
    ]) {
      const placed = labelAlongLine([line], {
        ...options,
        forms: [
          { text: 'Line of Control', permits },
          { text: 'LoC', permits },
        ],
      });
      if (placed !== null) expect(permits(placed), `${placed.text} at ${placed.x},${placed.y}`).toBe(true);
    }
  });

  it('never sets the name upside down', () => {
    const placed = labelAlongLine([[[300, 100], [100, 300]]], options);
    expect(placed?.angle).toBeGreaterThan(-90);
    expect(placed?.angle).toBeLessThanOrEqual(90);
  });
});

describe('the line on the page', () => {
  const geography = readGeography(topology);
  const project = fitProjection(geography.provinces, { width: 1400, height: 900, padding: 36 });
  const projected = readLineOfControl(topology).geometry.coordinates.map(
    (chain) => chain.map((point) => project(point as [number, number]) ?? [NaN, NaN]) as [number, number][],
  );

  const ajk = geography.provinces.features.find(
    (f) => f.properties.name === 'Azad Jammu & Kashmir',
  );
  const centre = project(labelAnchor(ajk as never)) as [number, number];
  const options = {
    bounds: { width: 1400, height: 900 },
    margin: 10,
    offset: 11,
    minRun: 70,
    reach: 34,
    awayFrom: centre,
  };

  it('is labelled at default zoom, north-east of Azad Kashmir and inside the frame', () => {
    const placed = labelAlongLine(projected, options);
    expect(placed).not.toBeNull();
    // The label lands on the Neelum stretch, where the line runs roughly west to east — so it
    // is set nearly level, not vertically. Named rather than assumed: the run of the line is
    // what decides, and at the middle of this line the run is not the north–south one.
    expect(placed?.angle).toBeGreaterThan(-30);
    expect(placed?.angle).toBeLessThan(10);
    expect(placed?.x).toBeGreaterThan(centre[0]);
    expect(placed?.y).toBeLessThan(centre[1]);
    expect(placed?.x).toBeLessThan(1400);
    expect(placed?.y).toBeGreaterThan(0);
  });

  it('keeps a label when the reader zooms onto one end of the line', () => {
    // Zoom 8 on the southern end. The line's true midpoint is far off screen by then; a label
    // pinned to it would silently vanish exactly where the reader is looking hardest.
    const k = 8;
    const focus = projected[0]?.[0] as [number, number];
    const zoomed = projected.map((chain) =>
      chain.map(
        ([x, y]) => [(x - focus[0]) * k + 700, (y - focus[1]) * k + 700] as [number, number],
      ),
    );
    const placed = labelAlongLine(zoomed, options);
    expect(placed).not.toBeNull();
  });
});

/** Arcs a shape uses that no other first-level shape does: its boundary with the outside. */
function exteriorArcsOf(name: string): Set<number> {
  const mine = provinceArcs.get(name);
  if (mine === undefined) throw new Error(`${name} is not in the province tier`);
  const shared = new Set(
    [...provinceArcs]
      .filter(([other]) => other !== name)
      .flatMap(([, arcs]) => [...arcs])
      .filter((arc) => mine.has(arc)),
  );
  return new Set([...mine].filter((arc) => !shared.has(arc)));
}

/**
 * Lon/lat of one arc. Absolute, not delta-encoded: `presimplify` dequantizes the topology on its
 * way through, which is why the committed bundle carries no `transform`.
 */
function positionsOfArc(index: number): [number, number][] {
  const { arcs } = bundle as unknown as { arcs: [number, number][][] };
  return arcs[index] as [number, number][];
}
