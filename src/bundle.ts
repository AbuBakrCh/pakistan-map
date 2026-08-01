/**
 * The one place the geography bundle enters the application.
 *
 * It is `import`ed, not fetched. The bundle is a committed build artifact (D19) and Vite inlines
 * it into the module graph, so the running page makes no network call for it — which is the
 * point: an upstream OSM edit cannot change a boundary between two page loads, only a commit can.
 */

import type { Topology } from 'topojson-specification';
import topology from '../data/bundle/geography.topojson.json';

/** The subset of the bundle's provenance block the baseline map puts on screen. */
export interface Provenance {
  readonly generated: string;
  readonly vintage: string;
  readonly sources: Readonly<Record<string, string>>;
  readonly counts: Readonly<Record<string, number>>;
}

export const geographyTopology = topology as unknown as Topology;
export const provenance = (topology as { provenance: unknown }).provenance as Provenance;
