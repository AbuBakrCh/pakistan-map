/**
 * The scenario schema — what a variant *is* — and the check that every variant is a complete
 * partition of Pakistan (#14, D6).
 *
 * Pure: no filesystem, no geometry. What needs reviewing here is the judgements, as everywhere
 * else in `scripts/lib/` — which districts a claim covers, what the card says about it, and
 * whether the map it describes has a hole in it.
 *
 * Three rules carry over from the rest of the pipeline and shape every type below.
 *
 *  - **Nothing is dropped silently.** A claimed district that is not a district fails the build
 *    naming it; a district two units both claim fails naming it *and both units*; a district no
 *    unit claims fails naming it. A count alone would leave a reader to diff 156 names by hand.
 *  - **Absence is stated, never defaulted.** A variant nobody advocates says so in a field of its
 *    own (L7, D1) rather than carrying an empty advocacy list that reads like an oversight. A
 *    variant that must not show 2023 population (H2, whose boundaries are 1947's) says that too,
 *    with a reason, and the reason is card copy.
 *  - **The opposition line is not optional.** `opposedBy` is a non-empty tuple, so a variant
 *    without one does not typecheck, and the validator checks it again for the JSON path. Without
 *    it the app reads as advocating whatever is on screen.
 *
 * The claim and the drawing are kept apart on purpose. A unit lists the districts **as its
 * advocates state them** — including districts created after the census, which the movement names
 * and this map cannot draw — and the validator resolves those onto the 2023 set through the same
 * fold table the geometry uses (ADR-0001). South Punjab is stated as 13 districts, was 11 before
 * 2022, and draws as 11 here; all three numbers are true and the artifact records each, because
 * any one alone reads as a miscount.
 */

import {
  CENSUS_DISTRICTS,
  POST_CENSUS_DISTRICT_FOLDS,
  ROSTER,
  kindOf,
  normalizeName,
  provinceOf,
  resolveRosterName,
} from './roster.ts';

/** A list the type system refuses to let go empty. */
export type NonEmpty<T> = readonly [T, ...T[]];

export type BasisId = 'language' | 'administrative' | 'historical' | 'development';

/**
 * The provenance vocabulary, exactly as CLAUDE.md's basis table spells it. A badge is a claim
 * about where a boundary came from, so the set is closed: a new one is a new kind of claim and
 * wants deciding, not typing.
 */
export type ProvenanceBadge =
  | 'official'
  | 'census'
  | 'proxy'
  | 'derived'
  | 'documented'
  | 'synthesized';

export interface Basis {
  readonly id: BasisId;
  readonly name: string;
  /** What the boundaries are argued from, and what the map shades by. */
  readonly source: string;
  /** The default badges for variants on this basis; a variant may carry its own (L7). */
  readonly badges: NonEmpty<ProvenanceBadge>;
}

export const BASES: Readonly<Record<BasisId, Basis>> = {
  language: {
    id: 'language',
    name: 'Language / dialect',
    source: 'PBS 2023 Census Table 11 — mother tongue by district',
    badges: ['census', 'proxy'],
  },
  administrative: {
    id: 'administrative',
    name: 'Administrative',
    source: '2023 census population + derived geometry',
    badges: ['census', 'derived'],
  },
  historical: {
    id: 'historical',
    name: 'Historical',
    source: 'Documented past demarcations, 1947 onward',
    badges: ['documented'],
  },
  development: {
    id: 'development',
    name: 'Development',
    source: 'PBS 2023 Census — literacy (10+), improved drinking water, improved sanitation',
    badges: ['census', 'synthesized'],
  },
};

/**
 * Which district set a partition has to cover. Stated per variant, because the two sets are
 * different sizes and both are legitimate answers to "all of Pakistan":
 *
 *  - `drawn` — all 156 districts the map draws, AJK's 10 and GB's 10 included. Every drawn
 *    district gets a unit, so the map has no uncoloured hole.
 *  - `census` — the 136 districts PBS published 2023 results for: the four provinces and ICT.
 *    AJK and GB are outside the partition entirely, drawn and named but belonging to no unit,
 *    which is what D25 already says about shading them.
 *
 * Left implicit, this is the sort of thing that gets decided by whichever variant was written
 * first. Named in the data, a reader of the artifact can see which claim each variant is making
 * about territory it does not mention.
 */
export type PartitionUniverse = 'drawn' | 'census';

export function universeDistricts(universe: PartitionUniverse): readonly string[] {
  return universe === 'census' ? CENSUS_DISTRICTS : ROSTER.flatMap((p) => p.districts);
}

/**
 * What a unit is, relative to today's map.
 *
 *  - `proposed` — a new province the variant argues for.
 *  - `unchanged` — a current province or the capital, carried through so the partition is
 *    complete. Not a proposal, and the card should not read as one.
 *  - `territory` — AJK or Gilgit-Baltistan left as itself: drawn, named, never shaded, and
 *    constitutionally not a province (D12, D25).
 */
export type UnitKind = 'proposed' | 'unchanged' | 'territory';

export interface Unit {
  /** Stable within the variant; the deep link and the outline both key on it. */
  readonly id: string;
  /** As the unit's own advocates name it (CLAUDE.md, "Naming"). */
  readonly name: string;
  /** Alternatives the card shows — "South Punjab (also: Saraikistan, Saraiki Wasaib)". */
  readonly alsoKnownAs?: readonly string[];
  readonly kind: UnitKind;
  /**
   * The districts the claim names, in the source's own words. May name a post-census district
   * (Taunsa, Kot Addu, Paharpur); the validator resolves it to the 2023 district that carries it.
   */
  readonly claims: NonEmpty<string>;
  /**
   * Districts the claim explicitly does **not** include, where saying so is part of the claim —
   * L3 has never included the Waziristans, and drawing them inside Saraikistan would defame the
   * advocates. Checked to be real districts and checked not to be claimed as well.
   */
  readonly excludes?: readonly string[];
  readonly note?: string;
}

/**
 * Where the boundary came from. `transcribed` is a line someone published; `derived` is a line
 * this build computed from census data under a stated rule (L6, L7, A1–A4, D1). The distinction
 * is card copy, not bookkeeping: a derived boundary must say on screen that it was drawn from
 * data rather than copied from a proposal.
 */
export type Composition =
  | { readonly kind: 'transcribed'; readonly from: string }
  | { readonly kind: 'derived'; readonly rule: string; readonly from: string };

/**
 * Who argues for this. A variant with no advocate is a real case — L7 and D1 apply a rule to
 * census data and nobody proposes their output — and it is spelled as its own shape so that
 * "nobody advocates this" can never be an empty array somebody forgot to fill in.
 */
export type Advocacy =
  | { readonly kind: 'advocated'; readonly by: NonEmpty<string> }
  | { readonly kind: 'unadvocated'; readonly note: string };

export type FootnoteKind =
  /** The claim's own district count differs from what this map draws (L1, L4). */
  | 'district-count'
  /** The boundary follows census data because no published district list exists (L6). */
  | 'derived-boundary'
  /** Something the claim includes that cannot be drawn — Amb and Phulra in H2. */
  | 'omission'
  /** A part of the claim its own subjects reject — Mianwali and Bhakkar in L2. */
  | 'contested-edge'
  | 'note';

export interface Footnote {
  readonly kind: FootnoteKind;
  readonly text: string;
}

/** An editorial cross-reference: "Collision with L1–L3", "Relationship to L1–L6". */
export interface Note {
  readonly label: string;
  readonly text: string;
  /** Variant ids this note points at. Checked to exist, so a rename cannot orphan a card. */
  readonly relatedVariants?: readonly string[];
}

export interface Source {
  readonly label: string;
  readonly url?: string;
}

/**
 * Whether 2023 figures may be attached to this variant. H2 draws the 1947 map, where they would
 * describe boundaries that no longer existed by the time anyone was counted, so it carries
 * `false` — and a reason, because the card has to say why the scorecard is empty rather than
 * looking broken. Absent means figures are shown.
 */
export type StatisticsPolicy =
  | { readonly modernFigures: true }
  | { readonly modernFigures: false; readonly reason: string };

export interface Variant {
  /** Deep-link id — `#/language/l1`. Unique across all variants. */
  readonly id: string;
  readonly basis: BasisId;
  readonly name: string;
  /** The one-line editorial gloss: "the version that partly exists". */
  readonly tagline?: string;
  /** Overrides the basis default, for a variant whose provenance differs (L7, D1). */
  readonly badges?: NonEmpty<ProvenanceBadge>;
  /** Two to three sentences. Rendered on the card. */
  readonly rationale: string;
  /** Where the proposal actually stands in the world. */
  readonly status: string;
  readonly advocacy: Advocacy;
  /** Required, and required non-empty. See the module note. */
  readonly opposedBy: NonEmpty<string>;
  readonly universe: PartitionUniverse;
  readonly composition: Composition;
  readonly units: NonEmpty<Unit>;
  readonly footnotes: readonly Footnote[];
  readonly notes?: readonly Note[];
  readonly sources: NonEmpty<Source>;
  readonly statistics?: StatisticsPolicy;
}

/**
 * Whether a unit that is not a territory may take an AJK or Gilgit-Baltistan district.
 *
 * **This is CLAUDE.md open item 2b, and it is a product decision that is not settled.** L2 and
 * H2 reference AJK districts; those districts are drawn but carry no PBS statistic of any kind,
 * so a unit containing one has a population that is short by an unknowable amount and a shading
 * with a hole in it. Both answers are expressible — the policy is a parameter, and both branches
 * are tested — so settling it is a one-line change here rather than a rewrite.
 *
 * The default is `forbid`, deliberately, on the same reasoning as everything else in this
 * project: a build that fails naming the district is a question asked out loud, whereas `allow`
 * would let the first variant that needs it answer a live constitutional question on its own and
 * publish a province drawn across a ceasefire line with a population nobody can source.
 */
export type TerritoryClaimPolicy = 'forbid' | 'allow';
export const TERRITORY_CLAIM_POLICY: TerritoryClaimPolicy = 'forbid';

export interface ValidationOptions {
  readonly territoryClaims?: TerritoryClaimPolicy;
}

/** A claimed district, resolved onto the 2023 set the map draws. */
export interface ResolvedUnit {
  readonly id: string;
  readonly name: string;
  readonly kind: UnitKind;
  /** The districts as claimed, unresolved, in the source's own words. */
  readonly claimed: readonly string[];
  /** The 2023 districts the unit draws as, in claim order, deduplicated by the folds. */
  readonly districts: readonly string[];
  /** Post-census districts the claim names and this map cannot draw, and where each landed. */
  readonly folded: readonly { readonly from: string; readonly into: string }[];
  /** Exclusions, resolved. Empty for most units. */
  readonly excludes: readonly string[];
}

export interface ResolvedPartition {
  readonly universe: PartitionUniverse;
  readonly units: readonly ResolvedUnit[];
  /** Districts covered — equal to the universe's size when the partition is complete. */
  readonly districts: number;
  /** Districts as claimed, before folding. Differs from `districts` wherever a fold collapsed. */
  readonly claimed: number;
}

export interface Validation {
  /** `null` when anything failed: an invalid partition must not reach the artifact. */
  readonly partition: ResolvedPartition | null;
  /** Every problem found, each naming the district and the unit(s) involved. */
  readonly problems: readonly string[];
}

/**
 * Resolve a claimed district name onto the 2023 district that carries it.
 *
 * Two paths, both of which the geometry pipeline already uses: the roster's normalized-name and
 * alias matching, then the post-census fold table. Anything else is `null` and fails the build —
 * a claim naming a district nobody can find is either a typo or a movement talking about ground
 * this map does not have, and both want a human.
 */
export function resolveClaimedDistrict(
  name: string,
): { readonly district: string; readonly foldedFrom: string | null } | null {
  const direct = resolveRosterName(name);
  if (direct !== null) return { district: direct, foldedFrom: null };

  const normalized = normalizeName(name);
  for (const [child, parent] of Object.entries(POST_CENSUS_DISTRICT_FOLDS)) {
    if (normalizeName(child) === normalized) return { district: parent, foldedFrom: child };
  }
  return null;
}

/** Slug for a unit id, so `intactProvince` need not be told one. */
const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * A province's districts, less the ones a proposed unit has taken.
 *
 * Every variant is a complete partition, so most units in most variants are "the rest of
 * somewhere" — hand-listing 25 remaining Punjab districts per variant would be 17 chances to
 * mistype one. The remainder is computed, and then checked like everything else: the partition
 * validator does not know or care that a list was derived.
 */
export function remainderOf(province: string, without: readonly string[] = []): NonEmpty<string> {
  const taken = new Set(
    without.flatMap((claim) => {
      const match = resolveClaimedDistrict(claim);
      return match === null ? [] : [match.district];
    }),
  );
  const found = ROSTER.find((p) => p.name === province);
  if (found === undefined) throw new Error(`${province} is not a province in the roster`);
  const remaining = found.districts.filter((d) => !taken.has(d));
  const [first, ...rest] = remaining;
  if (first === undefined) {
    throw new Error(
      `${province} has no districts left after removing ${[...taken].join(', ')} — a unit that ` +
        `takes a whole province should be written as itself, not as a remainder`,
    );
  }
  return [first, ...rest];
}

/**
 * A current province or territory, carried through a variant unchanged.
 *
 * Its `kind` comes from the roster rather than from the caller: AJK and GB are territories, not
 * provinces, and this project's own rule is that nothing may call them one by accident.
 */
export function intactProvince(province: string, without: readonly string[] = []): Unit {
  return {
    id: slug(province),
    name: province,
    kind: kindOf(province) === 'territory' ? 'territory' : 'unchanged',
    claims: remainderOf(province, without),
  };
}

/** The districts of AJK and Gilgit-Baltistan, which no `proposed` unit may take by default. */
const TERRITORY_DISTRICTS = new Map<string, string>(
  ROSTER.filter((p) => p.kind === 'territory').flatMap((p) =>
    p.districts.map((d) => [d, p.name] as const),
  ),
);

export function validateVariant(variant: Variant, options: ValidationOptions = {}): Validation {
  const policy = options.territoryClaims ?? TERRITORY_CLAIM_POLICY;
  const problems: string[] = [];
  const at = `${variant.id}`;

  // ---- card fields -----------------------------------------------------------------------
  if (variant.opposedBy.length === 0) {
    problems.push(
      `${at} has no "Opposed by" line. Every card carries one — without it the app reads as ` +
        `advocating whatever is on screen.`,
    );
  }
  if (variant.advocacy.kind === 'advocated' && variant.advocacy.by.length === 0) {
    problems.push(
      `${at} claims to be advocated but names nobody. A variant nobody proposes is written as ` +
        `unadvocated, with a note saying so.`,
    );
  }
  if (variant.advocacy.kind === 'unadvocated' && variant.advocacy.note.trim() === '') {
    problems.push(`${at} is unadvocated and says nothing about why — the note is card copy.`);
  }
  if (variant.statistics?.modernFigures === false && variant.statistics.reason.trim() === '') {
    problems.push(
      `${at} suppresses modern figures and gives no reason. The card has to say why its ` +
        `scorecard is empty, or it looks broken.`,
    );
  }
  if (variant.sources.length === 0) {
    problems.push(`${at} cites no source. No unsourced surface anywhere.`);
  }

  // ---- units -----------------------------------------------------------------------------
  const unitIds = new Set<string>();
  const resolved: ResolvedUnit[] = [];
  /** District -> the unit that claimed it, so a collision names both sides. */
  const owner = new Map<string, ResolvedUnit>();
  const universe = new Set(universeDistricts(variant.universe));

  for (const unit of variant.units) {
    if (unitIds.has(unit.id)) {
      problems.push(`${at} has two units with the id ${unit.id}; one of them is unreachable.`);
    }
    unitIds.add(unit.id);

    const districts: string[] = [];
    const folded: { from: string; into: string }[] = [];
    const seen = new Map<string, string>();

    for (const claim of unit.claims) {
      const match = resolveClaimedDistrict(claim);
      if (match === null) {
        problems.push(
          `${at} unit "${unit.name}" claims ${claim}, which is not a 2023 district and not a ` +
            `post-census district that folds into one.`,
        );
        continue;
      }
      const previous = seen.get(match.district);
      if (previous !== undefined) {
        // Two different claims folding onto one district is normal — Taunsa and Dera Ghazi Khan
        // are the same ground here. The same name twice is a paste, and worth stopping for.
        if (normalizeName(previous) === normalizeName(claim)) {
          problems.push(`${at} unit "${unit.name}" names ${claim} twice.`);
        }
        if (match.foldedFrom !== null) folded.push({ from: match.foldedFrom, into: match.district });
        continue;
      }
      seen.set(match.district, claim);
      districts.push(match.district);
      if (match.foldedFrom !== null) folded.push({ from: match.foldedFrom, into: match.district });
    }

    const excludes: string[] = [];
    for (const excluded of unit.excludes ?? []) {
      const match = resolveClaimedDistrict(excluded);
      if (match === null) {
        problems.push(
          `${at} unit "${unit.name}" excludes ${excluded}, which is not a district. An exclusion ` +
            `is part of the claim; a misspelt one reads as deliberate and silently excludes ` +
            `nothing.`,
        );
        continue;
      }
      if (seen.has(match.district)) {
        problems.push(
          `${at} unit "${unit.name}" both claims and excludes ${match.district}. The card would ` +
            `say one thing and the map draw the other.`,
        );
      }
      excludes.push(match.district);
    }

    const resolvedUnit: ResolvedUnit = {
      id: unit.id,
      name: unit.name,
      kind: unit.kind,
      claimed: [...unit.claims],
      districts,
      folded,
      excludes,
    };
    resolved.push(resolvedUnit);

    for (const district of districts) {
      const taken = owner.get(district);
      if (taken !== undefined) {
        problems.push(
          `${at} gives ${district} to two units: "${taken.name}" and "${resolvedUnit.name}". A ` +
            `district belongs to exactly one unit — territory cannot be in two provinces.`,
        );
        continue;
      }
      owner.set(district, resolvedUnit);

      if (!universe.has(district)) {
        problems.push(
          `${at} unit "${resolvedUnit.name}" claims ${district} (${provinceOf(district)}), which ` +
            `is outside the ${variant.universe} district set this variant partitions.`,
        );
      }

      const territory = TERRITORY_DISTRICTS.get(district);
      if (territory !== undefined && resolvedUnit.kind !== 'territory' && policy === 'forbid') {
        problems.push(
          `${at} unit "${resolvedUnit.name}" claims ${district}, a district of ${territory}. ` +
            `Whether a variant may claim territory is an open product decision (CLAUDE.md open ` +
            `item 2b): AJK and Gilgit-Baltistan are drawn but carry no PBS statistic, so a unit ` +
            `containing one has a population short by an unknowable amount. Settle it and set ` +
            `TERRITORY_CLAIM_POLICY.`,
        );
      }
    }
  }

  // ---- completeness ----------------------------------------------------------------------
  const uncovered = [...universe].filter((district) => !owner.has(district));
  if (uncovered.length > 0) {
    problems.push(
      `${at} leaves ${uncovered.length} district(s) in no unit at all, so the map has a hole ` +
        `where they are: ${uncovered.map((d) => `${d} (${provinceOf(d)})`).join(', ')}.`,
    );
  }

  if (problems.length > 0) return { partition: null, problems };
  return {
    partition: {
      universe: variant.universe,
      units: resolved,
      districts: owner.size,
      claimed: resolved.reduce((n, u) => n + u.claimed.length, 0),
    },
    problems,
  };
}

export interface ScenarioValidation {
  readonly variants: readonly { readonly variant: Variant; readonly partition: ResolvedPartition }[];
  readonly problems: readonly string[];
}

/**
 * Validate the whole scenario set: every variant a complete partition, and the cross-variant
 * properties no single variant can see — unique deep-link ids, and notes that point at a variant
 * that exists.
 */
export function validateScenarios(
  variants: readonly Variant[],
  options: ValidationOptions = {},
): ScenarioValidation {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const variant of variants) {
    if (ids.has(variant.id)) {
      problems.push(
        `two variants share the id ${variant.id}; the deep link #/${variant.basis}/${variant.id} ` +
          `would be ambiguous.`,
      );
    }
    ids.add(variant.id);
  }

  const validated: { variant: Variant; partition: ResolvedPartition }[] = [];
  for (const variant of variants) {
    for (const note of variant.notes ?? []) {
      for (const related of note.relatedVariants ?? []) {
        if (!ids.has(related)) {
          problems.push(
            `${variant.id} note "${note.label}" points at ${related}, which is not a variant. A ` +
              `card cross-reference that leads nowhere is a broken sentence on screen.`,
          );
        }
      }
    }
    const result = validateVariant(variant, options);
    problems.push(...result.problems);
    if (result.partition !== null) validated.push({ variant, partition: result.partition });
  }

  return { variants: validated, problems };
}
