/**
 * Read the baseline tiers out of the committed geography bundle.
 *
 * The bundle is imported, not fetched: it is a build artifact committed to the repo (D19), and
 * runtime makes zero network calls. Vite inlines it, so the browser never asks for it either.
 *
 * The baseline is provinces and divisions, and `readGeography` returns exactly those. Districts
 * come back from a separate call, `readDistricts`, because they are not baseline furniture: they
 * are the atom a basis shades (D23), and the baseline still draws no district *lines*. Two
 * functions rather than one field so the split is visible at the call site — `renderBaselineMap`
 * asking for districts is a deliberate act, not a property it happened to find on an object.
 */

import { feature } from 'topojson-client';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import type { Topology } from 'topojson-specification';

/** Constitutional standing, carried on every first-level feature. Territories are not provinces. */
export type ProvinceKind = 'province' | 'territory' | 'capital';

export interface ProvinceProperties {
  readonly name: string;
  readonly kind: ProvinceKind;
}

export interface DivisionProperties {
  readonly name: string;
  readonly province: string;
  /** ICT has no real division tier; one is injected so the tier covers the country. */
  readonly pseudo?: boolean;
}

export interface DistrictProperties {
  readonly name: string;
  readonly division: string;
  readonly province: string;
}

export type Tier<P> = FeatureCollection<Polygon | MultiPolygon, P>;

export interface Geography {
  readonly provinces: Tier<ProvinceProperties>;
  readonly divisions: Tier<DivisionProperties>;
}

const KINDS: readonly string[] = ['province', 'territory', 'capital'];

/**
 * Both checks throw rather than falling back, for the same reason the pipeline fails on an
 * unclassified relation: the fallbacks available here are all wrong in a way nobody would see.
 * An unknown `kind` defaulted to `province` draws Azad Kashmir as a province — a constitutional
 * claim this app does not make (D12) — and a division pointing at a province that is not there
 * means the tiers have come apart, which is a bundle to be fixed, not rendered around.
 */
export function readGeography(topology: Topology): Geography {
  const provinces = feature(
    topology,
    topology.objects['provinces'] as never,
  ) as unknown as Tier<ProvinceProperties>;
  const divisions = feature(
    topology,
    topology.objects['divisions'] as never,
  ) as unknown as Tier<DivisionProperties>;

  for (const { properties } of provinces.features) {
    if (!KINDS.includes(properties.kind)) {
      throw new Error(
        `${properties.name} has kind "${properties.kind}", which has no styling rule. ` +
          `Expected one of ${KINDS.join(', ')}.`,
      );
    }
  }

  const known = new Set(provinces.features.map((f) => f.properties.name));
  for (const { properties } of divisions.features) {
    if (!known.has(properties.province)) {
      throw new Error(
        `Division ${properties.name} names province ${properties.province}, which is not in the ` +
          `province tier.`,
      );
    }
  }

  return { provinces, divisions };
}

/**
 * All 156 drawn districts — the 136 the census publishes, plus AJK's ten and GB's ten, which
 * have boundaries and no indicators. The caller decides what to do about the twenty; returning
 * only the 136 here would leave holes in the country wherever a basis is active.
 */
export function readDistricts(topology: Topology): Tier<DistrictProperties> {
  return feature(
    topology,
    topology.objects['districts'] as never,
  ) as unknown as Tier<DistrictProperties>;
}
