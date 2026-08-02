/**
 * What the variant card says (#19).
 *
 * The card is the one surface where a proposal is argued rather than drawn, so every sentence on
 * it is a decision and every decision is here — `panel.ts` renders this object and chooses no
 * words of its own, the same division `tooltip.ts` keeps with `map.ts` and for the same reason:
 * the renderer carries no tests.
 *
 * Four rules shape the whole module.
 *
 * - **The opposition line is not optional, and its absence is not silence.** `opposedBy` is a
 *   non-empty tuple in the schema and the build refuses an empty one, so a card reaching this
 *   module without opposition is a bundle that was not built by that build. It still prints a
 *   line — one saying the opposition is *missing from the data*, which is a different claim from
 *   "nobody opposes this" and the only one this app is entitled to make. Rendering nothing would
 *   quietly make the other.
 * - **A badge is a claim about where a boundary came from**, so the vocabulary is closed and each
 *   word is glossed on the card. A badge outside it throws naming the variant and the word: an
 *   unglossed badge on screen is a provenance claim a reader cannot check, which is the precise
 *   thing the working agreement forbids.
 * - **The app reports what people call things and adjudicates nothing.** A unit is named as its
 *   own advocates name it and its alternatives are set beside it, never instead of it.
 * - **A count is never printed alone where two are true.** South Punjab is stated as 13 districts
 *   and drawn as 11 (ADR-0001); either number by itself reads as a miscount, so the card sets
 *   both and the footnote says why.
 *
 * The scorecard (#20) is now among them — the five figures a proposal can be judged on rather than
 * argued over, set between the units they summarise and the footnotes that qualify them. It obeys
 * the same rules as everything else here, and one more of its own: **a figure that cannot be given
 * is said to be missing, in the words of whatever is missing it.** A unit made of AJK's or
 * Gilgit-Baltistan's districts has no population because PBS published none (D25), and a card that
 * printed a zero, a dash, or nothing at all would each say something untrue about ground Pakistan
 * administers. Not one figure on the card is computed here: they are read off the bundle, where the
 * build summed them from the census, and this module decides only what they are called.
 */

import type {
  BasisRecord,
  ProvenanceBadge,
  ScenarioBundle,
  ScorecardRecord,
  UnitKind,
  UnitRecord,
  VariantRecord,
} from '../bundle.ts';
import { groupDigits } from './figures.ts';

/**
 * What each provenance word means, in the reader's terms rather than the pipeline's.
 *
 * Typed as the closed vocabulary, so adding a badge to the union is a compile error here until
 * somebody decides what it claims — which is the point of the vocabulary being closed at all.
 */
export const PROVENANCE_GLOSS: Readonly<Record<ProvenanceBadge, string>> = {
  official: 'official — the administrative geography as government publishes it',
  census: 'census — read from published census figures, never interpolated',
  proxy: 'proxy — the data stands in for what is argued about, and is not the same thing',
  derived: 'derived — computed by this build from published data, under the rule stated below',
  documented: 'documented — transcribed from a published document, not computed here',
  synthesized: 'synthesized — a composite this project defines; no published figure states it',
};

export interface CardBadge {
  readonly label: string;
  /** The gloss. On the card itself, not in a `title`: a 390px phone has no hover. */
  readonly gloss: string;
}

/** "Advocated by", "Opposed by" — a heading, a list, and what to say when the list is empty. */
export interface CardList {
  readonly label: string;
  readonly items: readonly string[];
  /** Said instead of the list when there is none. Never both, and never neither. */
  readonly note: string | null;
}

export interface CardUnit {
  readonly id: string;
  readonly name: string;
  /** "also: Saraikistan, Saraiki Wasaib" — shown as the card's spec words it, never adjudicated. */
  readonly alsoKnownAs: string | null;
  readonly kind: UnitKind;
  /** Proposed, carried through, or a territory left as itself. */
  readonly standing: string;
  /** The claim's own district count and this map's, said together wherever they differ. */
  readonly districts: string;
  /** Its people, or the sentence saying the census does not reach them. Never a zero, never blank. */
  readonly population: string;
  readonly note: string | null;
}

/** One figure, what it is called, and the qualification it cannot honestly be read without. */
export interface CardScorecardLine {
  readonly label: string;
  readonly value: string;
  readonly note: string | null;
}

export interface CardScorecard {
  readonly lines: readonly CardScorecardLine[];
  /**
   * Said in place of the population lines where there are none, never instead of the scorecard.
   * The other figures are arithmetic on districts and survive a census that does not reach them.
   */
  readonly withheld: string | null;
}

export type CardFootnoteKind =
  | 'district-count'
  | 'derived-boundary'
  | 'omission'
  | 'contested-edge'
  | 'note';

export interface CardFootnote {
  readonly kind: CardFootnoteKind;
  readonly label: string;
  readonly text: string;
}

export interface CardSource {
  readonly label: string;
  readonly url: string | null;
}

export interface VariantCard {
  readonly id: string;
  readonly name: string;
  readonly tagline: string | null;
  /** Which basis this is argued on. Named, not abbreviated: it is half the provenance. */
  readonly basis: CardBadge;
  readonly provenance: readonly CardBadge[];
  /**
   * Set only where the variant's own provenance differs from its basis's. L1 is a Language variant
   * whose boundary is `documented` rather than `census · proxy`, and a reader comparing the
   * outline against the shading beneath it is owed the reason the two badges disagree.
   */
  readonly provenanceNote: string | null;
  /** Unit count, and what each kind of unit is. The first thing the card owes the reader. */
  readonly summary: string;
  /** Which district set the partition covers, and what it therefore says nothing about. */
  readonly coverage: string;
  readonly rationale: string;
  /** Where the proposal stands in the world — implemented, dormant, never tabled. */
  readonly status: string;
  /** Transcribed from a document, or derived from data under a stated rule. */
  readonly composition: string;
  readonly advocacy: CardList;
  readonly opposition: CardList;
  readonly units: readonly CardUnit[];
  /**
   * The five figures a proposal is judged on rather than argued over (#20): how many units, how the
   * population falls between them, how far apart the largest and the smallest are, how much ground
   * changes hands, and whether every unit hangs together. Set between the units it summarises and
   * the footnotes that qualify them.
   */
  readonly scorecard: CardScorecard;
  /** Why there are no modern figures, where a variant suppresses them (H2 draws 1947). */
  readonly figuresWithheld: string | null;
  readonly footnotes: readonly CardFootnote[];
  readonly notes: readonly { readonly label: string; readonly text: string }[];
  readonly sources: readonly CardSource[];
}

const FOOTNOTE_LABELS: Readonly<Record<CardFootnoteKind, string>> = {
  'district-count': 'District count',
  'derived-boundary': 'Boundary derived from data',
  omission: 'Claimed and not drawn',
  'contested-edge': 'Contested edge',
  note: 'Note',
};

/**
 * The order footnotes are set in, which is not the order they are written in.
 *
 * The two that explain a *difference between the claim and the map* come first, because a reader
 * counting districts on screen and getting a different number from the one the card prints has
 * found the app's most alarming-looking discrepancy and is owed the answer before anything else.
 * A plain note is last: it is context, not a correction.
 */
const FOOTNOTE_ORDER: readonly CardFootnoteKind[] = [
  'district-count',
  'derived-boundary',
  'omission',
  'contested-edge',
  'note',
];

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** "A", "A and B", "A, B and C" — the card is prose, and a comma before the last is not. */
const sentenceList = (items: readonly string[]): string =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/**
 * One badge, glossed — and the closed vocabulary enforced at the point of use.
 *
 * Exported because the card is no longer the only surface that badges a boundary: the PNG band
 * (#32) badges the same claim in an image that travels without its page, and a second copy of this
 * check would be a second vocabulary that could quietly drift from this one. `subject` is whatever
 * carries the badge — a variant id, or the baseline map — so the message names it either way.
 */
export function provenanceBadge(subject: string, name: ProvenanceBadge): CardBadge {
  const gloss = (PROVENANCE_GLOSS as Readonly<Record<string, string | undefined>>)[name];
  if (gloss === undefined) {
    throw new Error(
      `${subject} carries the provenance badge "${name}", which is not one of ` +
        `${Object.keys(PROVENANCE_GLOSS).join(', ')}. The vocabulary is closed because a badge is ` +
        `a claim about where a boundary came from; an unglossed one on screen is a claim a ` +
        `reader cannot check.`,
    );
  }
  return { label: name, gloss };
}

/**
 * The unit count, said as what the units *are*.
 *
 * "8 units" alone is the number a reader is least able to use: seven of L1's eight are current
 * provinces carried through, and a card that does not say so invites the reading that the
 * proposal creates eight provinces. The three kinds are counted separately and the ones with no
 * members are left out rather than printed as zero.
 */
function summaryOf(variant: VariantRecord): string {
  const count = (kind: UnitKind): number => variant.units.filter((u) => u.kind === kind).length;
  const parts = [
    { n: count('proposed'), text: (n: number) => `${plural(n, 'proposed province')}` },
    {
      n: count('unchanged'),
      // Not "current provinces": one of L1's five is Islamabad, which is a capital territory, and
      // the unit vocabulary has no word for that. Said as what is true of all of them.
      text: (n: number) => `${n} carried through from the current map unchanged`,
    },
    {
      n: count('territory'),
      text: (n: number) => `${plural(n, 'territory', 'territories')} left as they are`,
    },
  ]
    .filter((part) => part.n > 0)
    .map((part) => part.text(part.n));

  const { claimedDistricts, drawnDistricts } = variant.counts;
  // Both counts, wherever they differ. The footnote says why; this says that they do, so the
  // number on screen and the number in the source are never silently one of two.
  const moved =
    claimedDistricts === drawnDistricts
      ? `${plural(drawnDistricts, 'district')} change province`
      : `stated as ${plural(claimedDistricts, 'district')} and drawn as ${drawnDistricts}`;
  return `${plural(variant.units.length, 'unit')} — ${sentenceList(parts)}. In all, ${moved}.`;
}

/**
 * Which ground the partition is complete over.
 *
 * Both universes are complete partitions, of different sets, and the difference is exactly the
 * twenty AJK and Gilgit-Baltistan districts a reader is most likely to be checking. Left unsaid,
 * a `census` variant looks like a variant with a hole in it.
 */
function coverageOf(variant: VariantRecord): string {
  return variant.partition.universe === 'census'
    ? `Covers the ${variant.partition.districts} districts PBS published 2023 results for — the ` +
        `four provinces and Islamabad. Azad Jammu & Kashmir and Gilgit-Baltistan are outside this ` +
        `partition: drawn and named, and in no unit.`
    : `Covers all ${variant.partition.districts} districts the map draws, Azad Jammu & Kashmir ` +
        `and Gilgit-Baltistan included, so no ground is left uncoloured.`;
}

function compositionOf(variant: VariantRecord): string {
  return variant.composition.kind === 'transcribed'
    ? `Transcribed from ${variant.composition.from}.`
    : // Said in the card's own voice, not badged and left there: a boundary this build computed
      // is the one kind of line on the map that nobody published, and the rule that produced it
      // is the whole of its provenance.
      `Derived from data rather than transcribed from a proposal — ${variant.composition.rule}, ` +
      `applied to ${variant.composition.from}.`;
}

function unitStanding(kind: UnitKind): string {
  switch (kind) {
    case 'proposed':
      return 'Proposed — not official';
    case 'territory':
      return 'Territory, unchanged — not constitutionally a province';
    default:
      // Islamabad is one of these and is not a province, so the line says what is true of every
      // unit of this kind: the variant leaves it exactly as it is.
      return 'Unchanged from the current map';
  }
}


/**
 * What a unit's population line says, including when there is none to say.
 *
 * Three absences, worded three ways, because `null` in the bundle means three different things and
 * a card that read only that field would print the wrong one of them.
 *
 * **The census's own coverage is asked first**, and the order is the decision here. On H2 (#30) no
 * unit carries a figure at all, but they are missing for two different reasons: Punjab's 2023
 * population is perfectly well known and is being *declined*, while Azad Jammu & Kashmir's *does
 * not exist* — PBS published none (D25). A district the census never counted has no figure for a
 * variant to withhold, so answering the withholding first would describe the census as reaching
 * ground it does not, on the one basis whose whole subject is what used to be true. `tooltip.ts`
 * asks the same two questions in the same order, for the same reason.
 */
function unitPopulation(unit: UnitRecord, withholding: boolean): string {
  // The twenty AJK and Gilgit-Baltistan districts (D25). Said as coverage — the census did not ask
  // here — rather than as a failure, and never as a zero, which would be a claim about who lives
  // on ground Pakistan administers.
  if (unit.uncounted.length === unit.districts.length) {
    return 'The 2023 census does not cover its districts, so it carries no population figure';
  }
  if (withholding) {
    return (
      'No population figure — this variant does not attach 2023 census figures to its ' +
      'boundaries, for the reason it gives above'
    );
  }
  if (unit.population !== null) return `${groupDigits(unit.population)} people`;
  return `${plural(unit.uncounted.length, 'district')} of it lie outside the 2023 census, so its ` +
    `population would be short by an unknown amount and is not given`;
}

function unitDistricts(unit: VariantRecord['units'][number]): string {
  return unit.claimed.length === unit.districts.length
    ? plural(unit.districts.length, 'district')
    : `${plural(unit.claimed.length, 'district')} as claimed, ${unit.districts.length} as drawn ` +
        `(${sentenceList(unit.folded.map((fold) => `${fold.from} inside ${fold.into}`))})`;
}

/**
 * The units, proposed first.
 *
 * Not the bundle's order, which is the order the partition was written in — remainders after the
 * claim they are the remainder of. The card is about what the variant *proposes*, and a reader
 * scanning eight units for the one that does not exist should not have to.
 */
function unitsOf(variant: VariantRecord): readonly CardUnit[] {
  const rank: Readonly<Record<UnitKind, number>> = { proposed: 0, unchanged: 1, territory: 2 };
  // A property of the variant, read once: whether *this card* prints a population anywhere.
  const withholding = !variant.statistics.modernFigures;
  return [...variant.units]
    .map((unit, index) => ({ unit, index }))
    .sort((a, b) => rank[a.unit.kind] - rank[b.unit.kind] || a.index - b.index)
    .map(({ unit }) => ({
      id: unit.id,
      name: unit.name,
      alsoKnownAs: unit.alsoKnownAs.length === 0 ? null : `also: ${unit.alsoKnownAs.join(', ')}`,
      kind: unit.kind,
      standing: unitStanding(unit.kind),
      districts: unitDistricts(unit),
      population: unitPopulation(unit, withholding),
      note: unit.note,
    }));
}

/**
 * The scorecard's five lines (#20).
 *
 * Contiguity is read off the units and off `counts.nonContiguousUnits`, which #16 already wrote —
 * never recounted here, because two derivations of one fact are two answers to it and a card is the
 * last place to discover they disagree. The other four are read off `scorecard`, which the build
 * summed from the census. Nothing on this card is arithmetic of its own.
 */
function scorecardOf(variant: VariantRecord): CardScorecard {
  const scorecard: ScorecardRecord = variant.scorecard;
  const lines: CardScorecardLine[] = [
    {
      label: 'Units',
      value: `${plural(scorecard.units, 'unit')} — ${scorecard.proposedUnits} proposed`,
      note: null,
    },
  ];

  const { population, outsideTheCensus } = scorecard;
  if (population !== null) {
    // The units the census does not reach are named on the line the figures are on, not in a
    // footnote below it: a total described as the country's when two territories are missing from
    // it is a wrong number, and the qualification is what makes it a right one.
    const setAside =
      outsideTheCensus.length === 0
        ? `${groupDigits(population.total)} people in all.`
        : `${groupDigits(population.total)} people across the ${population.units} units the 2023 ` +
          `census covers. ${sentenceList(outsideTheCensus.map((unit) => unit.name))} ` +
          `${outsideTheCensus.length === 1 ? 'is' : 'are'} outside the figures: PBS published no ` +
          `2023 results for their districts.`;
    lines.push({
      label: 'Population spread',
      value:
        `${population.largest.name} ${groupDigits(population.largest.population)} at the largest, ` +
        `${population.smallest.name} ${groupDigits(population.smallest.population)} at the smallest`,
      note: setAside,
    });
    lines.push(
      population.ratio === null
        ? {
            label: 'Largest to smallest',
            // Not "1 : 1", which is a number and would read as a perfectly even partition.
            value: 'Not given',
            note:
              'Only one unit of this variant lies inside the 2023 census, so there is nothing to ' +
              'compare it against.',
          }
        : {
            label: 'Largest to smallest',
            value: `${population.ratio.toFixed(1)} : 1`,
            note: null,
          },
    );
  }

  const { districtsMoved } = scorecard;
  lines.push({
    label: 'Districts moved',
    value:
      districtsMoved.count === 0
        ? `None of ${districtsMoved.of}`
        : `${districtsMoved.count} of ${districtsMoved.of}`,
    note:
      districtsMoved.count === 0
        ? // Not "the province it is in today": eleven of the districts this sentence covers are in
          // Islamabad, Azad Jammu & Kashmir or Gilgit-Baltistan, none of which is a province, and
          // the card is the one surface that must never say otherwise.
          'Every district stays where it is today.'
        : `${sentenceList(
            districtsMoved.byOrigin.map((origin) => `${origin.districts} out of ${origin.from}`),
          )}.`,
  });

  const broken = variant.units.filter((unit) => !unit.contiguity.contiguous);
  lines.push({
    label: 'Contiguity',
    value:
      variant.counts.nonContiguousUnits === 0
        ? `All ${plural(variant.counts.units, 'unit')} in one piece`
        : `${variant.counts.nonContiguousUnits} of ${variant.counts.units} in more than one piece`,
    // Named, never counted: which districts are stranded away from the body of a proposal is the
    // whole of what a reader wants from this line. Flagged, never blocked (D7).
    note:
      broken.length === 0
        ? null
        : `${sentenceList(
            broken.map(
              (unit) =>
                `${unit.name} is in ${plural(unit.contiguity.pieces, 'piece')}, with ` +
                `${sentenceList(unit.contiguity.detached.flatMap((group) => group))} touching ` +
                `none of the rest of it`,
            ),
          )}. Flagged, not refused.`,
  });

  return { lines, withheld: withheldOf(scorecard) };
}

/** Why there are no population figures — in the words of whatever is missing them. */
function withheldOf(scorecard: ScorecardRecord): string | null {
  const withheld = scorecard.populationWithheld;
  if (withheld === null) return null;
  switch (withheld.kind) {
    case 'variant':
      // The bare fact, and not the reason. The variant's own words are already on this card, in
      // the argument column, as `figuresWithheld` — printing them here as well would set the same
      // sentence twice a few centimetres apart and read as though the card had two things to say.
      // So the scorecard states the absence, which is what a reader looking for figures needs, and
      // leaves the editorial reason where it was already being made.
      return 'No population figures — this variant withholds modern ones, for the reason given above.';
    case 'incomplete':
      return (
        `No population figures. ` +
        `${sentenceList(
          withheld.units.map(
            (unit) =>
              `${unit.name} takes in ${sentenceList([...unit.uncounted])}, which PBS published no ` +
              `2023 results for`,
          ),
        )}, so its population would be short by an unknown amount — and a largest compared ` +
        `against a smallest that is missing people is worse than no comparison at all.`
      );
    case 'uncounted':
      return (
        'No population figures: no unit of this variant lies inside the 136 districts PBS ' +
        'published 2023 results for.'
      );
  }
  // Named rather than defaulted. A fourth kind of absence added upstream would otherwise fall into
  // whichever branch happened to be last and be described as something it is not — and telling the
  // kinds of absence apart is the entire job of this function.
  const unreachable: never = withheld;
  throw new Error(
    `Unknown population withholding: ${JSON.stringify(unreachable)}. Every kind of absence has to ` +
      `be worded as itself.`,
  );
}

function footnotesOf(variant: VariantRecord): readonly CardFootnote[] {
  return variant.footnotes
    .map((footnote) => {
      const label = (FOOTNOTE_LABELS as Readonly<Record<string, string | undefined>>)[footnote.kind];
      if (label === undefined) {
        throw new Error(
          `${variant.id} carries a footnote of kind "${footnote.kind}", which the card has no ` +
            `heading for. A footnote explains a difference between a claim and this map; an ` +
            `unlabelled one leaves the reader to guess which difference it is.`,
        );
      }
      return { kind: footnote.kind as CardFootnoteKind, label, text: footnote.text };
    })
    .sort((a, b) => FOOTNOTE_ORDER.indexOf(a.kind) - FOOTNOTE_ORDER.indexOf(b.kind));
}

/**
 * Who argues for it, and who against.
 *
 * The two are built by one function because they are one obligation: the card carries both lines
 * or it carries neither honestly. The asymmetry is only in what an empty list means — nobody
 * advocating a variant is a real state the schema spells out (L7 and D1 apply a rule to census
 * data and no movement proposes the output), whereas nobody opposing one is not a finding this
 * app can publish and is treated as data that is missing.
 */
function advocacyOf(variant: VariantRecord): CardList {
  if (variant.advocacy.kind === 'unadvocated') {
    return { label: 'Advocated by', items: [], note: variant.advocacy.note };
  }
  return variant.advocacy.by.length === 0
    ? {
        label: 'Advocated by',
        items: [],
        note:
          'No advocate is recorded, and this variant does not say it has none. That is missing ' +
          'data on the card rather than a finding about the proposal.',
      }
    : { label: 'Advocated by', items: variant.advocacy.by, note: null };
}

function oppositionOf(variant: VariantRecord): CardList {
  return variant.opposedBy.length === 0
    ? {
        label: 'Opposed by',
        items: [],
        // Printed, never omitted. The build refuses an empty list, so arriving here means the
        // bundle was not built by that build — and a card that simply drops the line turns
        // missing data into the claim that nobody opposes this.
        note:
          'No opposition is recorded for this variant. That is a gap in this app’s data, not a ' +
          'finding that the proposal is uncontested.',
      }
    : { label: 'Opposed by', items: variant.opposedBy, note: null };
}

/** The whole card, from the committed bundle. Pure: no DOM, no fetch, no formatting of markup. */
export function variantCard(scenarios: ScenarioBundle, variant: VariantRecord): VariantCard {
  const basis: BasisRecord | undefined = scenarios.bases[variant.basis];
  if (basis === undefined) {
    throw new Error(
      `${variant.id} is argued on the basis "${variant.basis}", which this bundle does not ` +
        `describe. A card cannot badge a boundary against a basis it cannot name.`,
    );
  }

  const provenance = variant.badges.map((name) => provenanceBadge(variant.id, name));
  const differs =
    variant.badges.length !== basis.badges.length ||
    variant.badges.some((name) => !basis.badges.includes(name));

  return {
    id: variant.id,
    name: variant.name,
    tagline: variant.tagline,
    basis: { label: basis.name, gloss: basis.source },
    provenance,
    provenanceNote: differs
      ? `The ${basis.name} basis shades from ${basis.badges.join(' · ')}; this variant’s boundary ` +
        `is ${variant.badges.join(' · ')}. The shading and the outline are sourced separately, ` +
        `and the card badges each for what it is.`
      : null,
    summary: summaryOf(variant),
    coverage: coverageOf(variant),
    rationale: variant.rationale,
    status: variant.status,
    composition: compositionOf(variant),
    advocacy: advocacyOf(variant),
    opposition: oppositionOf(variant),
    units: unitsOf(variant),
    scorecard: scorecardOf(variant),
    figuresWithheld: variant.statistics.modernFigures ? null : variant.statistics.reason,
    footnotes: footnotesOf(variant),
    notes: variant.notes.map((note) => ({ label: note.label, text: note.text })),
    sources: variant.sources.map((source) => ({ label: source.label, url: source.url ?? null })),
  };
}
