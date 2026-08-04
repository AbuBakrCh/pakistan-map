/**
 * The mother-tongue rule engine (#26) — the two Language variants whose boundary nobody published.
 *
 * L1 to L5 transcribe a line somebody drew: a secretariat's remit, a party's stated extent, a
 * division as PBS publishes it. L6 and L7 have no such line. Nobody publishes a district list for
 * "the Pashto-plurality districts of Balochistan", and nobody at all proposes assigning every
 * district in Pakistan by its plurality mother tongue — so the boundary is computed here, under
 * the same discipline `partitioner.ts` works under: the rule is stated, the arithmetic is
 * reproducible, and the card says the line was drawn from data rather than copied from a proposal.
 * A partition a reader cannot re-derive is an editorial opinion wearing a `derived` badge.
 *
 * ## The rule, entire
 *
 * A district joins the region of the mother tongue the census records as dominant there, and each
 * language's districts are then split into **connected groups over the shared district borders**
 * of #16's graph. One group is one region. That second half is not a tidying step: Balochi is
 * dominant in the Makran coast and again in the Nasirabad plains with the Brahvi belt between
 * them, and calling those one province would draw a unit in two pieces and label it as though it
 * were one place.
 *
 * ## What the rule cannot reach, and what it must not invent
 *
 * Three absences, each different, and none of them a zero:
 *
 *  - **A district the census does not cover** — AJK's ten and Gilgit-Baltistan's ten (D25) — is
 *    refused by name if it is handed to this engine. There is no mother tongue to sort it by, and
 *    guessing one would put a language on ground PBS published nothing about.
 *  - **A district the census covers and names no dominant tongue for** — Upper and Lower Chitral,
 *    since Khowar has no column in Table 11 — is returned in `unnamed` rather than assigned. The
 *    rule does not reach them and says so; the caller decides what the variant does about it, and
 *    that decision is card copy rather than a default hidden in here.
 *  - **A residual is not a language.** `Others` is a leftover, and the census join already refuses
 *    to let it win a dominance, so nothing in this module has to special-case it.
 *
 * ## Naming, which is the one thing the engine will not do
 *
 * A region is named for its language, because that is the only name the data carries. Where a
 * language yields more than one region the bare word would name two different provinces the same
 * thing, so the region is qualified by its most populous district — `Balochi (Kech)` — which is
 * still a name out of the data and not one of ours. The variants that ship say on the card that
 * these are descriptions of what the rule produced and not names anybody uses.
 *
 * Pure, like its neighbours: no filesystem, no geometry, no bundle. The caller supplies the scope,
 * the graph, the census's dominant tongues and the census's populations.
 */

import { contiguityOf, type AdjacencyGraph } from './adjacency.ts';
import { groupDigits } from './digits.ts';
import { unitName } from './unit-names.ts';

/**
 * What the rule is applied to.
 *
 * `dominant` distinguishes the two absences the module header sets out: a district **absent from
 * the map** is one the census does not cover, and a district **present with `null`** is one the
 * census covers and names no dominant tongue for. Collapsing them into one optional lookup is
 * exactly the confusion stratum 1 draws two different ways on purpose (#17).
 */
export interface LanguageScope {
  /** The districts the rule is applied to — 136 for L7, Balochistan's 34 for L6. */
  readonly districts: readonly string[];
  readonly graph: AdjacencyGraph;
  /** District -> the census's dominant mother tongue, or `null` where it names none. */
  readonly dominant: ReadonlyMap<string, string | null>;
  readonly populations: ReadonlyMap<string, number>;
}

/** One connected group of districts sharing a dominant mother tongue. */
export interface LanguageRegion {
  readonly language: string;
  /** Sorted, so a rebuild writes the same list. */
  readonly districts: readonly string[];
  readonly population: number;
  /** The most populous district in the region — what qualifies the name where a language repeats. */
  readonly principal: string;
  /** `Balochi`, or `Balochi (Kech)` where the language yields more than one region. */
  readonly name: string;
}

export interface LanguagePartition {
  /** Ordered largest population first, ties on the name — the order a card lists them in. */
  readonly regions: readonly LanguageRegion[];
  /**
   * In scope, counted by the census, and left with no dominant tongue to be sorted by. Named, so
   * the caller has to do something deliberate about them rather than lose them to a filter.
   */
  readonly unnamed: readonly string[];
}

export interface LanguagePartitionResult {
  /** `null` when anything failed: a partition with a hole in it must not reach a variant. */
  readonly partition: LanguagePartition | null;
  readonly problems: readonly string[];
}

/**
 * Apply the rule to a scope.
 *
 * Problems are collected rather than thrown at the first one, so a bad scope is reported as
 * everything wrong with it and not as whichever district happens to sort first.
 */
export function partitionByDominantLanguage(scope: LanguageScope): LanguagePartitionResult {
  const problems: string[] = [];

  const seen = new Set<string>();
  const duplicated = scope.districts.filter((district) => {
    const repeat = seen.has(district);
    seen.add(district);
    return repeat;
  });
  if (duplicated.length > 0) {
    problems.push(
      `the scope names ${[...new Set(duplicated)].join(', ')} more than once. A district counted ` +
        `twice would put its people into a region's total twice.`,
    );
  }

  const byLanguage = new Map<string, string[]>();
  const unnamed: string[] = [];

  for (const district of new Set(scope.districts)) {
    if (!scope.dominant.has(district)) {
      problems.push(
        `${district} is in scope and the census does not reach it, so it has no dominant mother ` +
          `tongue to be sorted by. PBS published 2023 results for the four provinces and ` +
          `Islamabad only (D25); a district it did not cover is not a district with no speakers, ` +
          `and this rule must not place one.`,
      );
      continue;
    }
    if (!scope.populations.has(district)) {
      problems.push(
        `${district} is in scope with no population. A region's population is the sum of its ` +
          `districts' census rows, and a missing one would be added as nothing and read as a ` +
          `figure.`,
      );
      continue;
    }
    const language = scope.dominant.get(district) ?? null;
    if (language === null) {
      unnamed.push(district);
      continue;
    }
    const members = byLanguage.get(language);
    if (members === undefined) byLanguage.set(language, [district]);
    else members.push(district);
  }

  if (problems.length > 0) return { partition: null, problems };

  // Split each language into connected groups, over the same graph every contiguity flag in the
  // app is read off. Contiguity is a property of the method here rather than a filter applied
  // afterwards: a region *is* a connected group, so there is no broken one to discard.
  const found: Omit<LanguageRegion, 'name'>[] = [];
  for (const [language, members] of byLanguage) {
    for (const component of contiguityOf(scope.graph, members).components) {
      const districts = [...component];
      const population = districts.reduce((sum, d) => sum + (scope.populations.get(d) ?? 0), 0);
      const principal = districts.reduce((largest, d) =>
        (scope.populations.get(d) ?? 0) > (scope.populations.get(largest) ?? 0) ? d : largest,
      );
      found.push({ language, districts, population, principal });
    }
  }

  // Largest first, and every tie broken on a name, so nothing about the order the caller handed
  // districts over can move a boundary or reorder a card. That is the whole determinism claim.
  found.sort(
    (a, b) =>
      b.population - a.population ||
      a.language.localeCompare(b.language) ||
      (a.districts[0] ?? '').localeCompare(b.districts[0] ?? ''),
  );

  const repeats = new Set(
    found.filter((region, i) => found.some((other, j) => i !== j && other.language === region.language))
      .map((region) => region.language),
  );

  return {
    partition: {
      regions: found.map((region) => ({
        ...region,
        // Disambiguated by the district the region is named for, through `unitName`: two Urdu
        // regions have to be told apart, and the one around Karachi is the one around the city,
        // not the one around its eastern quarter.
        name: repeats.has(region.language)
          ? `${region.language} (${unitName(region.principal)})`
          : region.language,
      })),
      unnamed: unnamed.sort((a, b) => a.localeCompare(b)),
    },
    problems,
  };
}

/**
 * The one region a language yields in a scope — L6's whole derivation.
 *
 * Refuses rather than picking, in both directions. A language with no region at all means the
 * scope is wrong; a language with two means the claim "the Pashto-plurality districts of
 * Balochistan" names two separate places, and choosing between them would be this app deciding
 * which one a movement meant.
 */
export function soleRegionOf(
  partition: LanguagePartition,
  language: string,
): { readonly region: LanguageRegion | null; readonly problems: readonly string[] } {
  const regions = partition.regions.filter((r) => r.language === language);
  const [first, ...rest] = regions;
  if (first === undefined) {
    return {
      region: null,
      problems: [
        `no district in this scope has ${language} as its dominant mother tongue, so there is no ` +
          `region to draw.`,
      ],
    };
  }
  if (rest.length > 0) {
    return {
      region: null,
      problems: [
        `${language} is dominant in ${regions.length} separate groups of districts here — ` +
          regions
            .map((r) => `${r.principal} (${r.districts.length}, ${groupDigits(r.population)} people)`)
            .join(' and ') +
          `. A claim stated as one province cannot be drawn as two, and picking one would be this ` +
          `app choosing which of them its advocates meant.`,
      ],
    };
  }
  return { region: first, problems: [] };
}
