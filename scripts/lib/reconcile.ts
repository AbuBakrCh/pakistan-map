/**
 * Reconcile the raw OSM relation set against the 2023 census roster.
 *
 * This module is pure — no filesystem, no geometry — because it encodes the judgements that
 * actually need reviewing: which relations are Pakistan, which are the census vintage, and
 * which post-census units fold into which parent.
 *
 * The governing rule is that **every relation must be classified**. A relation that matches
 * nothing is not skipped; it is reported and fails the build. Silent discards are how a
 * district set drifts without anyone noticing, and the whole point of committing the bundle
 * is that boundary changes are reviewable diffs.
 */

import {
  DIVISION_ALIASES,
  DROPPED_RELATIONS,
  POST_CENSUS_DISTRICT_FOLDS,
  PINNED_RELATION_IDS,
  POST_CENSUS_DIVISION_FOLDS,
  RELATION_OVERRIDES,
  ROSTER,
  normalizeName,
  resolveRosterName,
} from './roster.ts';

export interface OsmRelation {
  readonly id: number;
  readonly name: string;
}

/**
 * Where one OSM relation's geometry ends up. `name` is a district when classifying the district
 * tier and a division when classifying the division tier — deliberately neutral, because
 * CONTEXT.md keeps District and Division as distinct terms and calling this field `district`
 * would make `classifyDivision` return division names in a field named district.
 */
export type Classification =
  /** A 2023 census unit, drawn as itself. */
  | { readonly kind: 'unit'; readonly name: string }
  /** Created after the census; its geometry merges into `name`, and it is never drawn. */
  | { readonly kind: 'fold'; readonly name: string; readonly from: string }
  /** Not Pakistan, or not a unit at all. */
  | { readonly kind: 'dropped'; readonly reason: string }
  /** Matched nothing. Always a build failure. */
  | { readonly kind: 'unclassified' };

/** Look up `name` in a fold table, matching on normalized spelling. */
function matchFold(
  table: Readonly<Record<string, string>>,
  name: string,
): Classification | null {
  const normalized = normalizeName(name);
  for (const [child, parent] of Object.entries(table)) {
    if (normalizeName(child) === normalized) return { kind: 'fold', name: parent, from: child };
  }
  return null;
}

export function classifyDistrict(relation: OsmRelation): Classification {
  const dropped = DROPPED_RELATIONS[relation.id];
  if (dropped !== undefined) return { kind: 'dropped', reason: dropped };

  const override = RELATION_OVERRIDES[relation.id];
  if (override !== undefined) return { kind: 'unit', name: override };

  const direct = resolveRosterName(relation.name);
  if (direct !== null) {
    const pinned = PINNED_RELATION_IDS[direct];
    if (pinned !== undefined && pinned !== relation.id) {
      // A second relation answering to a pinned name is the across-the-LoC collision case.
      // Refuse it by name and let it surface as unclassified rather than absorbing territory
      // from the other side of a ceasefire line into a Pakistani district.
      return { kind: 'unclassified' };
    }
    return { kind: 'unit', name: direct };
  }

  return matchFold(POST_CENSUS_DISTRICT_FOLDS, relation.name) ?? { kind: 'unclassified' };
}

export function classifyDivision(relation: OsmRelation): Classification {
  const folded = matchFold(POST_CENSUS_DIVISION_FOLDS, relation.name);
  if (folded !== null) return folded;

  // Divisions have no roster of their own — OSM is the authority on which divisions exist, and
  // the PBS list is the authority on their spelling. Without the alias step the bundle would
  // ship OSM's "Qalat" and "Makran" for divisions while normalising the districts inside them
  // to PBS's "Kalat" and "Mekran": the same name spelled two ways in one file.
  const bare = stripSuffix(relation.name);
  return { kind: 'unit', name: DIVISION_ALIASES[normalizeName(bare)] ?? bare };
}

function stripSuffix(name: string): string {
  return name.replace(/\s+Division$/i, '').trim();
}

export interface DistrictReconciliation {
  /** OSM relation id -> the 2023 district its geometry contributes to. */
  readonly assignments: ReadonlyMap<number, string>;
  readonly dropped: readonly { readonly relation: OsmRelation; readonly reason: string }[];
  readonly folded: readonly { readonly relation: OsmRelation; readonly into: string }[];
  readonly unclassified: readonly OsmRelation[];
  /** Roster districts with no OSM geometry at all. ICT is expected here; it is injected. */
  readonly missing: readonly string[];
}

export function reconcileDistricts(relations: readonly OsmRelation[]): DistrictReconciliation {
  const assignments = new Map<number, string>();
  const dropped: { relation: OsmRelation; reason: string }[] = [];
  const folded: { relation: OsmRelation; into: string }[] = [];
  const unclassified: OsmRelation[] = [];

  for (const relation of relations) {
    const result = classifyDistrict(relation);
    switch (result.kind) {
      case 'unit':
        assignments.set(relation.id, result.name);
        break;
      case 'fold':
        assignments.set(relation.id, result.name);
        folded.push({ relation, into: result.name });
        break;
      case 'dropped':
        dropped.push({ relation, reason: result.reason });
        break;
      case 'unclassified':
        unclassified.push(relation);
        break;
    }
  }

  const covered = new Set(assignments.values());
  const missing = ROSTER.flatMap((p) => p.districts).filter((d) => !covered.has(d));

  return { assignments, dropped, folded, unclassified, missing };
}

