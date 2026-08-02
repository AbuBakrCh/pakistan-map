/**
 * The one place the geography bundle enters the application.
 *
 * It is `import`ed, not fetched. The bundle is a committed build artifact (D19) and Vite inlines
 * it into the module graph, so the running page makes no network call for it — which is the
 * point: an upstream OSM edit cannot change a boundary between two page loads, only a commit can.
 */

import type { GeometryCollection, Topology } from 'topojson-specification';
import topology from '../data/bundle/geography.topojson.json';
import context from '../data/bundle/context.topojson.json';
import statistics from '../data/bundle/statistics.json';
import scenarios from '../data/bundle/scenarios.json';
import outlines from '../data/bundle/unit-outlines.json';
import developmentIndex from '../data/bundle/development-index.json';
import type { ContextProvenance } from './lib/context.ts';
import type { DevelopmentIndexBundle } from './lib/development.ts';

/** The subset of the bundle's provenance block the baseline map puts on screen. */
export interface Provenance {
  readonly generated: string;
  readonly vintage: string;
  readonly sources: Readonly<Record<string, string>>;
  readonly counts: Readonly<Record<string, number>>;
  /**
   * When OSM itself was last edited under each query, per tier — the vintage of the *boundaries*,
   * which is not the vintage of the census they are pinned to and must not be printed as though
   * it were (#21). Read by the About panel and by nothing else.
   */
  readonly osmBaseTimestamp: Readonly<Record<string, string>>;
  /** How the coastline was chained and which districts it cut. Surfaced as a source, not a method. */
  readonly coastline: {
    readonly ways: number;
    readonly districtsConsidered: number;
    readonly districtsClipped: number;
  };
  /**
   * Where this bundle's geometry knowingly disagrees with PBS's published areas, in the build's
   * own words. On the About panel because a source list that hid them would be the tidier half of
   * the truth.
   */
  readonly knownLimitations: readonly string[];
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
 * The context bundle (#8): neighbour silhouettes and city dots, kept in a file of its own.
 *
 * Separate from the geography deliberately. That topology's integrity is arc sharing between its
 * three tiers and the ceasefire line, and nothing here shares an edge with any of it — Afghanistan
 * is OSM's Afghan relation, not Pakistan's. Merging them would renumber every arc in the country
 * to add a background, and would imply the two sides of a border are one line.
 */
export const contextTopology = context as unknown as Topology;
export const contextProvenance = (context as { provenance: unknown })
  .provenance as ContextProvenance;

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

/**
 * The three published development rates, as PBS publishes them and with the denominators PBS gave
 * them — which are not the same denominator (#11). The third is **flush toilets**, named for the
 * column that exists: PBS publishes no improved-sanitation figure, and calling this one by that
 * name would be a definition of ours wearing a `census` badge.
 */
export interface DevelopmentRecord {
  readonly literacy: {
    readonly population10Plus: number;
    readonly literate10Plus: number;
    readonly rate: number;
  };
  readonly water: {
    readonly households: number;
    readonly improved: number;
    readonly improvedShare: number;
  };
  readonly sanitation: {
    readonly households: number;
    readonly flushToilet: number;
    readonly nonFlushToilet: number;
    readonly noToilet: number;
    readonly separateToilet: number;
    readonly flushToiletShare: number;
    readonly noToiletShare: number;
  };
}

export interface DistrictRecord {
  readonly population: number;
  readonly division: string;
  readonly province: string;
  readonly motherTongue: MotherTongueRecord;
  readonly development: DevelopmentRecord;
}

export interface CensusStatistics {
  /** The census join's own header: when it ran, at which vintage, and off which published tables. */
  readonly provenance: {
    readonly generated: string;
    readonly vintage: string;
    readonly sources: Readonly<Record<string, string>>;
    readonly counts: Readonly<Record<string, number>>;
  };
  readonly districts: Readonly<Record<string, DistrictRecord>>;
  readonly withoutCensusData: { readonly reason: string; readonly districts: readonly string[] };
  readonly motherTongue: {
    readonly source: string;
    readonly categories: readonly string[];
    readonly residualCategory: string;
    readonly dominance: string;
    readonly districtsWithoutNamedDominant: readonly { district: string; residualShare: number }[];
    readonly universe: {
      readonly counted: number;
      readonly population: number;
      /** Table 11's universe less Table 1's — negative, and PBS does not explain it. */
      readonly difference: number;
      readonly note: string;
    };
  };
  /**
   * The three published development rates and the one place PBS's own two releases disagree.
   *
   * Carried in full rather than narrowed to what shades a district, because the disagreement is
   * the part a reader auditing this app most needs: a source list that printed the tables and hid
   * the 6,374 households would be worse than no list at all (#21).
   */
  readonly development: {
    readonly source: string;
    readonly indicators: Readonly<
      Record<
        string,
        { readonly table: string; readonly numerator: string; readonly denominator: string; readonly note: string }
      >
    >;
    readonly improvedWaterDifference: {
      readonly summed: number;
      readonly published: number;
      readonly difference: number;
      readonly note: string;
    };
  };
  /** How the district sums were checked upward, and against which source at each tier. */
  readonly reconciliation: {
    readonly method: string;
    readonly national: { readonly summed: number; readonly published: number; readonly source: string };
  };
}

export const censusStatistics = statistics as unknown as CensusStatistics;

/**
 * The development composite (#31), on the same terms as everything else: a committed artifact,
 * imported.
 *
 * A file of its own rather than a field of `statistics.json`, and the separation is the point.
 * That artifact is PBS's figures; this one is **the only number in the app that nobody published**
 * — the unweighted mean of three published rates, defined by this project and badged `synthesized`
 * for exactly that reason. It carries its own formula, its own band cuts and its own build date,
 * so a reader can see that it was computed rather than found.
 */
export const developmentIndexBundle = developmentIndex as unknown as DevelopmentIndexBundle;

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
  /**
   * When the data this basis shades from was collected (#21).
   *
   * Required, matching the build's schema. It was briefly optional with a fallback to the bundle
   * header's vintage, which was worse than it looked: the header carries the *census* vintage, and
   * the Historical basis's vintage is explicitly not that — so a bundle baked before the field
   * existed rendered a confidently wrong date under Historical rather than failing. An audit panel
   * that guesses is the one thing an audit panel may not do.
   */
  readonly vintage: string;
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
  /**
   * The sum of its districts' 2023 census populations (#20), and `null` where the census does not
   * reach all of them — the twenty AJK and Gilgit-Baltistan districts PBS published no results for
   * (D25). Never a partial sum: `uncounted` names the districts that are missing, so a unit with no
   * figure says which ground the census did not cover rather than reading as a zero.
   */
  readonly population: number | null;
  readonly uncounted: readonly string[];
}

/** A unit at one end of the population spread. */
export interface PopulationExtreme {
  readonly unit: string;
  readonly name: string;
  readonly population: number;
}

/**
 * Why a variant has no population figures. Three states, kept apart, because a census that does not
 * cover ground and an editorial decision to withhold figures are not the same claim.
 */
export type PopulationWithholding =
  | { readonly kind: 'variant'; readonly reason: string }
  | {
      readonly kind: 'incomplete';
      readonly units: readonly {
        readonly unit: string;
        readonly name: string;
        readonly uncounted: readonly string[];
      }[];
    }
  | { readonly kind: 'uncounted' };

/**
 * The scorecard (#20) as the build computed it: the figures a proposal can be judged on rather than
 * argued over. Contiguity is not among them — it is answered once, off the adjacency graph, and
 * lives on the units and in `counts.nonContiguousUnits`.
 */
export interface ScorecardRecord {
  readonly units: number;
  readonly proposedUnits: number;
  /** `null` exactly when `populationWithheld` is set. Never both, and never neither. */
  readonly population: {
    readonly units: number;
    readonly total: number;
    readonly largest: PopulationExtreme;
    readonly smallest: PopulationExtreme;
    /** Largest over smallest. `null` where one unit carries figures and nothing compares to it. */
    readonly ratio: number | null;
  } | null;
  readonly populationWithheld: PopulationWithholding | null;
  /** Units wholly outside the census, set aside from the spread by name rather than as zeroes. */
  readonly outsideTheCensus: readonly {
    readonly unit: string;
    readonly name: string;
    readonly districts: readonly string[];
  }[];
  readonly districtsMoved: {
    readonly count: number;
    readonly of: number;
    readonly byOrigin: readonly { readonly from: string; readonly districts: number }[];
  };
}

export interface VariantRecord {
  readonly id: string;
  readonly basis: BasisId;
  readonly name: string;
  readonly tagline: string | null;
  readonly badges: readonly ProvenanceBadge[];
  /** The date of this boundary's own source, where the variant has one (H2 draws 1947). */
  readonly vintage?: string;
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
  readonly scorecard: ScorecardRecord;
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
    readonly sources: Readonly<Record<string, string>>;
    readonly counts: Readonly<Record<string, number>>;
    /** The geometry build these outlines were cut against, so a stale pairing is detectable. */
    readonly geography: { readonly generated: string; readonly arcs: number };
  };
  readonly objects: Readonly<Record<string, GeometryCollection<UnitOutlineProperties>>>;
}

export const unitOutlineBundle = outlines as unknown as UnitOutlineBundle;
