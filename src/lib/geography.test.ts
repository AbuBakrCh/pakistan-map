import { geoLength } from 'd3';
import { describe, expect, it } from 'vitest';
import bundle from '../../data/bundle/geography.topojson.json';
import { describeKind, linesFromArcs, readGeography, tierArcs } from './geography.ts';
import { arcsOf, readLineOfControl } from './line-of-control.ts';

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

describe('describeKind', () => {
  it('says what a territory is, and why it carries no figures', () => {
    const { status, coverage } = describeKind('territory');
    expect(status).toMatch(/not constitutionally a province/);
    expect(coverage).toMatch(/does not cover/);
    // It names PBS only to say PBS publishes nothing here. AJK's population reaches us relayed
    // through the AJK Bureau of Statistics and never direct, so a PBS-badged figure for it must
    // not exist anywhere in the app — including in the line that explains its absence.
    expect(coverage).toMatch(/PBS publishes no/);
  });

  it('leaves provinces and the capital to be described by their data, not by an absence', () => {
    expect(describeKind('province').coverage).toBeNull();
    expect(describeKind('capital').coverage).toBeNull();
  });
});

describe('tierArcs and linesFromArcs', () => {
  const topology = bundle as never as Parameters<typeof tierArcs>[0];

  it('accounts for every arc of the province tier exactly once across the strata drawn', () => {
    // This is what stops the dashed line being underlined by a solid one. Each arc of the
    // outline belongs to exactly one stratum: ordinary border, territory border, or ceasefire
    // line — and the three together are the whole outline, so nothing goes undrawn either.
    const provinces = tierArcs(topology, 'provinces');
    const kinds = new Map(
      readGeography(topology).provinces.features.map((f) => [f.properties.name, f.properties.kind]),
    );
    const all = new Set([...provinces.values()].flatMap((arcs) => [...arcs]));
    const territory = new Set(
      [...provinces]
        .filter(([name]) => kinds.get(name) === 'territory')
        .flatMap(([, arcs]) => [...arcs]),
    );
    const line = arcsOf(
      (bundle as unknown as { objects: { lineOfControl: unknown } }).objects.lineOfControl as never,
    );

    const ordinary = [...all].filter((arc) => !territory.has(arc) && !line.has(arc));
    const territoryOnly = [...territory].filter((arc) => !line.has(arc));

    expect(new Set([...ordinary, ...territoryOnly, ...line]).size).toBe(all.size);
    expect(ordinary.filter((arc) => line.has(arc))).toEqual([]);
    expect(territoryOnly.filter((arc) => line.has(arc))).toEqual([]);
  });

  it('rebuilds the same line work the topology holds', () => {
    const line = readLineOfControl(topology);
    const rebuilt = linesFromArcs(
      topology,
      arcsOf(
        (bundle as unknown as { objects: { lineOfControl: unknown } }).objects.lineOfControl as never,
      ),
    );
    // Same ground, arc by arc: one continuous chain against the arcs it was cut into.
    expect(geoLength(rebuilt.geometry as never)).toBeCloseTo(geoLength(line.geometry as never), 9);
  });

  it('refuses a tier the bundle does not have', () => {
    expect(() => tierArcs(topology, 'units')).toThrow(/units/);
  });
});
