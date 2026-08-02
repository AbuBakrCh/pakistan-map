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
 * The scorecard — population spread, largest:smallest ratio, districts moved, non-contiguous
 * units — is **#20's, not this module's**. It needs the adjacency graph (#16) and per-variant
 * derived statistics, neither of which exists yet. Its seam is `VariantCard.scorecard`, declared
 * here as `null` and rendered by `panel.ts` between the units and the footnotes.
 */

import type {
  BasisRecord,
  ProvenanceBadge,
  ScenarioBundle,
  UnitKind,
  VariantRecord,
} from '../bundle.ts';

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
  readonly note: string | null;
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
   * #20's seam. Null until the scorecard exists — population spread, largest:smallest ratio,
   * districts moved and non-contiguous units all wait on the adjacency graph (#16) and on
   * per-variant derived statistics, and a card that invented any of them would be sourcing a
   * figure to itself.
   */
  readonly scorecard: null;
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

function badge(variantId: string, name: ProvenanceBadge): CardBadge {
  const gloss = (PROVENANCE_GLOSS as Readonly<Record<string, string | undefined>>)[name];
  if (gloss === undefined) {
    throw new Error(
      `${variantId} carries the provenance badge "${name}", which is not one of ` +
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
      note: unit.note,
    }));
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

  const provenance = variant.badges.map((name) => badge(variant.id, name));
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
    scorecard: null,
    figuresWithheld: variant.statistics.modernFigures ? null : variant.statistics.reason,
    footnotes: footnotesOf(variant),
    notes: variant.notes.map((note) => ({ label: note.label, text: note.text })),
    sources: variant.sources.map((source) => ({ label: source.label, url: source.url ?? null })),
  };
}
