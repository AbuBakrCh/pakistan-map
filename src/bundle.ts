/**
 * The one place the geography bundle enters the application.
 *
 * It is `import`ed, not fetched. The bundle is a committed build artifact (D19) and Vite inlines
 * it into the module graph, so the running page makes no network call for it — which is the
 * point: an upstream OSM edit cannot change a boundary between two page loads, only a commit can.
 */

import type { Topology } from 'topojson-specification';
import topology from '../data/bundle/geography.topojson.json';
import statistics from '../data/bundle/statistics.json';

/** The subset of the bundle's provenance block the baseline map puts on screen. */
export interface Provenance {
  readonly generated: string;
  readonly vintage: string;
  readonly sources: Readonly<Record<string, string>>;
  readonly counts: Readonly<Record<string, number>>;
}

export const geographyTopology = topology as unknown as Topology;
export const provenance = (topology as { provenance: unknown }).provenance as Provenance;

/**
 * The census join, on the same terms as the geometry: a committed artifact, imported.
 *
 * Typed structurally here rather than re-declared per consumer, so a change to the shape of
 * `statistics.json` is a compile error in one place instead of a wrong number in several.
 */
export interface MotherTongueRecord {
  readonly dominant: string | null;
  readonly dominantShare: number | null;
  readonly residualShare: number;
  readonly counted: number;
  readonly speakers: Readonly<Record<string, number>>;
}

export interface DistrictRecord {
  readonly population: number;
  readonly division: string;
  readonly province: string;
  readonly motherTongue: MotherTongueRecord;
}

export interface CensusStatistics {
  readonly districts: Readonly<Record<string, DistrictRecord>>;
  readonly withoutCensusData: { readonly reason: string; readonly districts: readonly string[] };
  readonly motherTongue: {
    readonly source: string;
    readonly categories: readonly string[];
    readonly residualCategory: string;
    readonly dominance: string;
    readonly districtsWithoutNamedDominant: readonly { district: string; residualShare: number }[];
    readonly universe: { readonly counted: number; readonly population: number };
  };
}

export const censusStatistics = statistics as unknown as CensusStatistics;
