import { geoPath } from 'd3';
import { describe, expect, it } from 'vitest';
import bundle from '../../data/bundle/geography.topojson.json';
import { readGeography } from './geography.ts';
import { fitProjection, standardParallels } from './projection.ts';

const { provinces } = readGeography(bundle as never);

describe('fitProjection', () => {
  it('fits the whole country inside the padded viewport', () => {
    const viewport = { width: 900, height: 700, padding: 24 };
    const [[west, north], [east, south]] = geoPath(
      fitProjection(provinces, viewport),
    ).bounds(provinces as never);

    expect(west).toBeGreaterThanOrEqual(viewport.padding - 0.5);
    expect(north).toBeGreaterThanOrEqual(viewport.padding - 0.5);
    expect(east).toBeLessThanOrEqual(viewport.width - viewport.padding + 0.5);
    expect(south).toBeLessThanOrEqual(viewport.height - viewport.padding + 0.5);
  });

  it('puts real places where an atlas reader expects them', () => {
    const project = fitProjection(provinces, { width: 900, height: 700, padding: 24 });
    const at = (lon: number, lat: number) => project([lon, lat]) as [number, number];
    const karachi = at(67.0, 24.86);
    const islamabad = at(73.05, 33.68);
    const gwadar = at(62.32, 25.12);
    const lahore = at(74.34, 31.55);

    expect(islamabad[1]).toBeLessThan(karachi[1]); // north is up
    expect(islamabad[0]).toBeGreaterThan(karachi[0]); // east is right
    expect(gwadar[0]).toBeLessThan(lahore[0]);
    // Karachi–Islamabad is ~1,160 km, Gwadar–Lahore ~1,290 km: the second must read longer.
    const span = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    expect(span(gwadar, lahore)).toBeGreaterThan(span(karachi, islamabad));
  });

  it('gives padding back to the frame instead of scaling past it', () => {
    const tight = geoPath(fitProjection(provinces, { width: 900, height: 700, padding: 8 })).bounds(
      provinces as never,
    );
    const loose = geoPath(fitProjection(provinces, { width: 900, height: 700, padding: 80 })).bounds(
      provinces as never,
    );
    expect(loose[1][0] - loose[0][0]).toBeLessThan(tight[1][0] - tight[0][0]);
  });
});

describe('standardParallels', () => {
  it('cuts the cone secant, a sixth of the span in from each edge', () => {
    expect(standardParallels(24, 36)).toEqual([26, 34]);
  });
});
