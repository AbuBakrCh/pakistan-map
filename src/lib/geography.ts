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
import type { Feature, FeatureCollection, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { arcsOf } from './line-of-control.ts';

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

/**
 * What each unit in a tier says about itself, beyond its name.
 *
 * Both halves are here rather than in the renderer because both are claims. The status line is
 * a constitutional fact, and the coverage line is the reason a territory shows no statistics —
 * which has to read as *the census does not reach here*, not as a zero and not as a gap where a
 * number failed to load. PBS's 2023 results cover 136 districts, the four provinces and ICT
 * (D25); AJK's population exists only as relayed by the AJK Bureau of Statistics, never direct
 * from PBS, so no PBS-badged figure for it may appear anywhere in this app.
 */
export function describeKind(kind: ProvinceKind): {
  readonly status: string;
  readonly coverage: string | null;
} {
  switch (kind) {
    case 'territory':
      return {
        status: 'Territory — not constitutionally a province',
        coverage:
          'The 2023 census does not cover it. PBS publishes no population, mother tongue or ' +
          'development figures for these districts, so none are shown.',
      };
    case 'capital':
      return { status: 'Capital territory', coverage: null };
    default:
      return { status: 'Province', coverage: null };
  }
}

/**
 * Which arcs each shape in a tier is built from, by name.
 *
 * The renderer needs boundaries *by arc* and not by shape, because one stretch of Pakistan's
 * outline has to be drawn differently from the rest of it. Stroking whole polygons cannot
 * express that: the Line of Control runs along Azad Kashmir's own outline, so a solid territory
 * stroke would be drawn underneath the dash and fill its gaps in — leaving a line that looks
 * solid and says the opposite of what it means. Under a shared-arc topology the fix is exact:
 * draw each arc once, in the one stratum it belongs to.
 */
export function tierArcs(topology: Topology, tier: string): Map<string, Set<number>> {
  const object = topology.objects[tier];
  if (object === undefined) throw new Error(`The bundle has no ${tier} tier`);
  return new Map(
    (object as GeometryCollection<{ name: string }>).geometries.map((geometry) => [
      (geometry.properties as { name?: string } | undefined)?.name ?? '',
      arcsOf(geometry),
    ]),
  );
}

/**
 * Turn a set of arc indices back into drawable line work.
 *
 * Goes through `feature` rather than reading `topology.arcs` directly, so the delta encoding and
 * any quantization transform are the topology's business and not this module's.
 */
export function linesFromArcs(
  topology: Topology,
  arcs: Iterable<number>,
): Feature<MultiLineString, null> {
  return feature(topology, {
    type: 'MultiLineString',
    arcs: [...arcs].sort((a, b) => a - b).map((index) => [index]),
  } as never) as unknown as Feature<MultiLineString, null>;
}
