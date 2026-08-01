import { describe, expect, it } from 'vitest';
import bundle from '../../data/bundle/geography.topojson.json';
import { readGeography } from './geography.ts';

/** A one-arc square, enough to make a topology the reader will accept as geometry. */
const synthetic = (provinces: unknown[], divisions: unknown[] = []) =>
  ({
    type: 'Topology',
    arcs: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
    objects: {
      provinces: {
        type: 'GeometryCollection',
        geometries: provinces.map((properties) => ({ type: 'Polygon', arcs: [[0]], properties })),
      },
      divisions: {
        type: 'GeometryCollection',
        geometries: divisions.map((properties) => ({ type: 'Polygon', arcs: [[0]], properties })),
      },
    },
  }) as never;

describe('readGeography', () => {
  it('reads the two baseline tiers out of the committed bundle', () => {
    const { provinces, divisions } = readGeography(bundle as never);
    expect(provinces.features).toHaveLength(7);
    expect(divisions.features).toHaveLength(37);
  });

  it('carries the constitutional kind, so territories are never drawn as provinces', () => {
    const { provinces } = readGeography(bundle as never);
    const kinds = new Map(provinces.features.map((f) => [f.properties.name, f.properties.kind]));
    expect(kinds.get('Azad Jammu & Kashmir')).toBe('territory');
    expect(kinds.get('Gilgit-Baltistan')).toBe('territory');
    expect(kinds.get('Islamabad Capital Territory')).toBe('capital');
    expect(kinds.get('Punjab')).toBe('province');
  });

  it('refuses a kind it has no styling rule for, rather than defaulting it to province', () => {
    expect(() => readGeography(synthetic([{ name: 'Bactria', kind: 'region' }]))).toThrow(
      /Bactria.*region/,
    );
  });

  it('refuses a division whose province is not in the province tier', () => {
    expect(() =>
      readGeography(
        synthetic([{ name: 'Punjab', kind: 'province' }], [{ name: 'Kalat', province: 'Balochistan' }]),
      ),
    ).toThrow(/Kalat.*Balochistan/);
  });
});
