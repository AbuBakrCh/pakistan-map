/**
 * Read the baseline tiers out of the committed geography bundle.
 *
 * The bundle is imported, not fetched: it is a build artifact committed to the repo (D19), and
 * runtime makes zero network calls. Vite inlines it, so the browser never asks for it either.
 *
 * Only provinces and divisions are exposed. The district tier is in the same file — every unit
 * is composed from it — but the baseline map deliberately does not draw district lines, and a
 * reader that cannot return them cannot accidentally draw them.
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
