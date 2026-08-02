import { geoBounds, geoContains } from 'd3';
import { describe, expect, it } from 'vitest';
import bundle from '../../data/bundle/geography.topojson.json';
import context from '../../data/bundle/context.topojson.json';
import { readCities } from './context.ts';
import { readDistricts } from './geography.ts';
import { districtLocator } from './hit-test.ts';

const districts = readDistricts(bundle as never);
const locate = districtLocator(districts);
const nameAt = (point: [number, number]) => locate.at(point)?.properties.name ?? null;

/**
 * Independent of the bundle: city coordinates, and the district each city is in. Nothing here is
 * read back off the geometry, so a boundary that moved would fail rather than agree with itself.
 */
const CITIES: readonly [string, [number, number], string][] = [
  ['Lahore', [74.3436, 31.5497], 'Lahore'],
  ['Islamabad', [73.0479, 33.6844], 'Islamabad'],
  ['Quetta', [67.0011, 30.1798], 'Quetta'],
  ['Peshawar', [71.5785, 34.0151], 'Peshawar'],
  ['Multan', [71.4753, 30.1575], 'Multan'],
  ['Sukkur', [68.8574, 27.7052], 'Sukkur'],
  ['Muzaffarabad', [73.4711, 34.37], 'Muzaffarabad'],
  ['Gilgit', [74.314, 35.9208], 'Gilgit'],
  ['Chitral town', [71.7864, 35.8518], 'Lower Chitral'],
];

describe('districtLocator', () => {
  it('names the district a known city stands in', () => {
    const wrong = CITIES.flatMap(([city, point, district]) => {
      const found = nameAt(point);
      return found === district ? [] : [`${city}: ${String(found)} ≠ ${district}`];
    });
    expect(wrong).toEqual([]);
  });

  it('answers for the territories as readily as for the provinces', () => {
    // AJK and GB are drawn, named and interrogable (D12). They carry no statistics, which is the
    // tooltip's problem; being un-hoverable would be a different and worse answer.
    expect(nameAt([73.4711, 34.37])).toBe('Muzaffarabad');
    expect(nameAt([74.314, 35.9208])).toBe('Gilgit');
  });

  it('returns nothing over the sea and nothing across a border', () => {
    // A tooltip on open water, or over Delhi, would name a district the pointer is not in.
    expect(nameAt([66.6, 23.8])).toBeNull();
    expect(nameAt([77.209, 28.6139])).toBeNull();
    expect(nameAt([69.1723, 34.5281])).toBeNull();
  });

  it('leaves the neighbour silhouettes unreachable, wherever the pointer lands on one', () => {
    // The silhouettes are drawn ground (#8) and the only drawn ground on this map that is not
    // Pakistan. They must answer nothing: a tooltip over Kandahar naming a Pakistani district
    // would be this app claiming ground, and it would look exactly like a hover that worked.
    // Held here rather than in the stylesheet because that is where it is actually true — hover
    // is put to the district polygons in lon/lat, so `pointer-events` never enters into it.
    const abroad: readonly [string, [number, number]][] = [
      ['Kandahar', [65.7372, 31.6133]],
      ['Kabul', [69.1723, 34.5281]],
      ['Kashgar', [75.9877, 39.4704]],
      ['Zahedan', [60.8629, 29.4963]],
      ['Srinagar', [74.7973, 34.0837]],
      ['Amritsar', [74.8723, 31.634]],
    ];
    const answered = abroad.flatMap(([place, point]) => {
      const found = nameAt(point);
      return found === null ? [] : [`${place} resolves to ${found}`];
    });
    expect(answered).toEqual([]);
  });

  it('stands every city dot on Pakistani ground, in the unit it is the seat of', () => {
    // A dot in the sea or across a border would be a landmark pointing at nothing. Asked of the
    // hit test rather than of the province polygons because this is the question a reader asks by
    // pointing at it: the district under the dot is what the tooltip would name.
    const cities = readCities(context as never);
    const adrift = cities.features.flatMap((city) => {
      const district = locate.at(city.geometry.coordinates as [number, number]);
      if (district === null) return [`${city.properties.name} stands on no drawn district`];
      return district.properties.province === city.properties.of
        ? []
        : [
            `${city.properties.name} stands in ${district.properties.province}, ` +
              `not in ${city.properties.of}`,
          ];
    });
    expect(adrift).toEqual([]);
    expect(cities.features).toHaveLength(7);
  });

  it('shortlists at most a handful of districts for any point, which is why hover is not slow', () => {
    // The acceptance criterion is that hover has no perceptible lag across the full district set.
    // Point-in-polygon against all 156 drawn districts costs ~20 ms a move; against the bounding
    // boxes that actually contain the point it costs a fraction of a millisecond. The property
    // held here is the shortlist, not the clock: a timing assertion on a shared CI box is noise.
    const [[west, south], [east, north]] = [
      [60.87, 23.69],
      [77.84, 37.09],
    ];
    let worst = { point: [0, 0] as [number, number], shortlist: [] as readonly string[] };
    for (let x = 0; x < 40; x++) {
      for (let y = 0; y < 40; y++) {
        const point: [number, number] = [
          west + ((east - west) * x) / 39,
          south + ((north - south) * y) / 39,
        ];
        const shortlist = locate.candidates(point);
        if (shortlist.length > worst.shortlist.length) worst = { point, shortlist };
      }
    }
    expect(worst.shortlist.length, `${worst.point.join(', ')} shortlists ${worst.shortlist.join(', ')}`)
      .toBeLessThanOrEqual(12);
  });

  it('finds every one of the 156 drawn districts from inside itself, and names any it cannot', () => {
    // A district that answers with a neighbour's name is a district no reader can ever hover.
    // The probe is `geoContains` on that district alone — the same containment the locator has
    // to agree with, asked without its index — so this catches a shortlist that drops a box,
    // which is the one way the two stages can disagree.
    const unreachable = districts.features.flatMap((f) => {
      const point = interiorPoint(f);
      if (point === null) return [`${f.properties.name} (no interior point found)`];
      const found = nameAt(point);
      return found === f.properties.name ? [] : [`${f.properties.name}: found ${String(found)}`];
    });
    expect(unreachable).toEqual([]);
    expect(districts.features).toHaveLength(156);
  });
});

/** A point the district itself contains, found by sampling its own bounding box from the middle out. */
function interiorPoint(feature: (typeof districts.features)[number]): [number, number] | null {
  const [[west, south], [east, north]] = geoBounds(feature as never);
  const steps = 21;
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
