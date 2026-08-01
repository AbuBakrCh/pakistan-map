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
  DROPPED_RELATIONS,
  ICT_PSEUDO_DIVISION,
  POST_CENSUS_DISTRICT_FOLDS,
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

export type Classification =
  /** A 2023 census district, drawn as itself. */
  | { readonly kind: 'district'; readonly district: string }
  /** Created after the census; its geometry merges into `district`, and it is never drawn. */
  | { readonly kind: 'fold'; readonly district: string; readonly from: string }
  /** Not Pakistan, or not a district at all. */
  | { readonly kind: 'dropped'; readonly reason: string }
  /** Matched nothing. Always a build failure. */
  | { readonly kind: 'unclassified' };

export function classifyDistrict(relation: OsmRelation): Classification {
  const dropped = DROPPED_RELATIONS[relation.id];
  if (dropped !== undefined) return { kind: 'dropped', reason: dropped };

  const override = RELATION_OVERRIDES[relation.id];
  if (override !== undefined) return { kind: 'district', district: override };

  const direct = resolveRosterName(relation.name);
  if (direct !== null) return { kind: 'district', district: direct };

  const normalized = normalizeName(relation.name);
  for (const [child, parent] of Object.entries(POST_CENSUS_DISTRICT_FOLDS)) {
    if (normalizeName(child) === normalized) {
      return { kind: 'fold', district: parent, from: child };
    }
  }

  return { kind: 'unclassified' };
}

export function classifyDivision(relation: OsmRelation): Classification {
  const normalized = normalizeName(relation.name);
  for (const [child, parent] of Object.entries(POST_CENSUS_DIVISION_FOLDS)) {
    if (normalizeName(child) === normalized) {
      return { kind: 'fold', district: parent, from: child };
    }
  }
  // Divisions have no roster of their own; OSM is the authority on the division tier, and the
  // census list is the authority on which of them existed in 2023. Anything not folded stands.
  return { kind: 'district', district: stripSuffix(relation.name) };
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
      case 'district':
        assignments.set(relation.id, result.district);
        break;
      case 'fold':
        assignments.set(relation.id, result.district);
        folded.push({ relation, into: result.district });
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

/** The province a roster district belongs to. */
export function provinceOf(district: string): string | null {
  for (const province of ROSTER) {
    if (province.districts.includes(district)) return province.name;
  }
  return null;
}

export { ICT_PSEUDO_DIVISION };
