/**
 * The one place the geography bundle enters the application.
 *
 * It is `import`ed, not fetched. The bundle is a committed build artifact (D19) and Vite inlines
 * it into the module graph, so the running page makes no network call for it — which is the
 * point: an upstream OSM edit cannot change a boundary between two page loads, only a commit can.
 */

import type { GeometryCollection, Topology } from 'topojson-specification';
import topology from '../data/bundle/geography.topojson.json';
import statistics from '../data/bundle/statistics.json';
import scenarios from '../data/bundle/scenarios.json';
import outlines from '../data/bundle/unit-outlines.json';

/** The subset of the bundle's provenance block the baseline map puts on screen. */
export interface Provenance {
  readonly generated: string;
  readonly vintage: string;
  readonly sources: Readonly<Record<string, string>>;
  readonly counts: Readonly<Record<string, number>>;
  /** How the ceasefire line was derived, so the page can say it rather than assert it (#7). */
  readonly lineOfControl: {
    readonly ways: number;
    readonly lengthKm: number;
    readonly alongDistricts: readonly string[];
    readonly againstRelations: readonly { readonly id: number; readonly name: string }[];
  };
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

/**
 * The scenario bundle: every basis, and every variant resolved onto the 2023 district set.
 *
 * Read as the build wrote it, in full, rather than narrowed to what today's screen uses. Every
 * field here is card copy — rationale, status, advocacy, opposition, footnotes — and the card
 * (#19) renders it from this same artifact. Narrowing the type now would mean widening it later
 * and re-deciding which fields are load-bearing, which is how a card comes to be missing its
 * "Opposed by" line.
 */
export type BasisId = 'language' | 'administrative' | 'historical' | 'development';
export type ProvenanceBadge =
  | 'official'
  | 'census'
  | 'proxy'
  | 'derived'
  | 'documented'
  | 'synthesized';

/** What a unit is relative to today's map: a proposal, a province carried through, a territory. */
export type UnitKind = 'proposed' | 'unchanged' | 'territory';

export interface BasisRecord {
  readonly id: BasisId;
  readonly name: string;
  readonly source: string;
  readonly badges: readonly ProvenanceBadge[];
}

export interface UnitRecord {
  readonly id: string;
  readonly name: string;
  readonly alsoKnownAs: readonly string[];
  readonly kind: UnitKind;
  readonly note: string | null;
  /** The districts as the claim names them, including any created after the census. */
  readonly claimed: readonly string[];
  /** The 2023 districts the unit is actually drawn from. */
  readonly districts: readonly string[];
  readonly folded: readonly { readonly from: string; readonly into: string }[];
  readonly excludes: readonly string[];
  /**
   * Whether the unit's districts hang together, read off the adjacency graph rather than off the
   * shape it draws as (#16). Flagged, never blocked (D7). Not the same number as the outline's
   * `polygons`, which counts shapes on paper and so counts islands: South Punjab is one piece and
   * three polygons. `detached` is every group but the largest, named, and is empty for a
   * contiguous unit — so the card renders it without asking first.
   */
  readonly contiguity: {
    readonly contiguous: boolean;
    readonly pieces: number;
    readonly detached: readonly (readonly string[])[];
  };
}

export interface VariantRecord {
  readonly id: string;
  readonly basis: BasisId;
  readonly name: string;
  readonly tagline: string | null;
  readonly badges: readonly ProvenanceBadge[];
  readonly rationale: string;
  readonly status: string;
  readonly advocacy:
    | { readonly kind: 'advocated'; readonly by: readonly string[] }
    | { readonly kind: 'unadvocated'; readonly note: string };
  readonly opposedBy: readonly string[];
  readonly composition:
    | { readonly kind: 'transcribed'; readonly from: string }
    | { readonly kind: 'derived'; readonly rule: string; readonly from: string };
  readonly footnotes: readonly { readonly kind: string; readonly text: string }[];
  readonly notes: readonly {
    readonly label: string;
    readonly text: string;
    readonly relatedVariants?: readonly string[];
  }[];
  readonly sources: readonly { readonly label: string; readonly url?: string }[];
  readonly statistics:
    | { readonly modernFigures: true }
    | { readonly modernFigures: false; readonly reason: string };
  /** Which district set this variant partitions — all 156 drawn, or the 136 the census covers. */
  readonly partition: {
    readonly universe: 'drawn' | 'census';
    readonly districts: number;
    readonly claimed: number;
  };
  readonly counts: {
    readonly units: number;
    readonly proposedUnits: number;
    readonly claimedDistricts: number;
    readonly drawnDistricts: number;
    /** The scorecard's contiguity line (#20), over every unit and not only the proposed ones. */
    readonly nonContiguousUnits: number;
  };
  readonly units: readonly UnitRecord[];
}

export interface ScenarioBundle {
  readonly provenance: {
    readonly generated: string;
    readonly vintage: string;
    readonly sources: Readonly<Record<string, string>>;
    readonly universes: Readonly<Record<string, number | string>>;
  };
  readonly bases: Readonly<Record<BasisId, BasisRecord>>;
  readonly variants: readonly VariantRecord[];
}

export const scenarioBundle = scenarios as unknown as ScenarioBundle;

/**
 * The dissolved unit outlines (#15).
 *
 * It carries **no arcs of its own** — its geometries are arc indices into the geography bundle, so
 * an outline and the boundary beneath it cannot come apart. That is why it is not a `Topology`:
 * it becomes one only when married to the geography's arcs, which `readUnitOutlines` does, and
 * only after checking that these are the arcs it was cut against.
 */
export interface UnitOutlineProperties {
  readonly variant: string;
  readonly unit: string;
  readonly name: string;
  readonly kind: UnitKind;
  readonly districts: number;
  /** How many disjoint pieces the outline draws as. A drawing fact, not a contiguity measure. */
  readonly polygons: number;
  readonly areaKm2: number;
}

export interface UnitOutlineBundle {
  readonly provenance: {
    readonly generated: string;
    readonly method: string;
    readonly arcsFrom: string;
    /** The geometry build these outlines were cut against, so a stale pairing is detectable. */
    readonly geography: { readonly generated: string; readonly arcs: number };
  };
  readonly objects: Readonly<Record<string, GeometryCollection<UnitOutlineProperties>>>;
}

export const unitOutlineBundle = outlines as unknown as UnitOutlineBundle;
