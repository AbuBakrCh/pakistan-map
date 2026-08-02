/**
 * "About the data" — the one surface where the whole app can be audited (#21).
 *
 * The working agreement's central claim is that there is **no unsourced surface anywhere**. Until
 * now that claim was checkable by us and by nobody else: the badges are on the card, the vintage
 * is in the colophon, the reconciliations are in `data/bundle/statistics.json`, and a reader who
 * wanted to know where the shading under a proposal came from had to take three of those on
 * trust. This module is the answer in one place — every source, its vintage, its badge, and the
 * date the bundle was built — so the claim is something a reader can test rather than something
 * this app asserts about itself.
 *
 * Three rules shape it, and the third is the one that earns the panel its place.
 *
 * - **Words are decided here; `panel.ts` composes none.** The same division `card.ts` keeps, for
 *   the same reason: the renderer carries no tests, so nothing that can be wrong may live in it.
 * - **No figure is invented here.** Every number and every quoted caveat is read off a committed
 *   artifact. This module may write a sentence around them — that is what it is for — but a
 *   figure retyped into it would be a fourth copy of a census total with nothing checking it.
 * - **A source list that hid the discrepancies would be worse than no list.** Four of the things
 *   a reader most needs are places where PBS's own releases disagree with each other, or where
 *   this build's geometry disagrees with PBS's published areas. Printing the tables and omitting
 *   those would use the audit surface to make the data look tidier than it is, which is the exact
 *   failure the panel exists to prevent. They get a section of their own, in the words the build
 *   already wrote, above the fold rather than in a footnote.
 *
 * What is deliberately **not** on the panel is stated on the panel: the cache digests, the
 * province and division reconciliation tables, and the per-district mother-tongue excesses. Those
 * are an auditor's appendix — 170-odd rows of figures — and they are in the committed artifacts,
 * checked by the suite on every run. The panel says where they are rather than setting them at
 * 390px, which is the width this has to work at.
 */

import type {
  BasisRecord,
  CensusStatistics,
  Provenance,
  ProvenanceBadge,
  ScenarioBundle,
  UnitOutlineBundle,
} from '../bundle.ts';
import { PROVENANCE_GLOSS } from './card.ts';
import type { ContextProvenance } from './context.ts';
import { groupDigits } from './figures.ts';

/** A badge and its gloss, on the panel itself: the hard bar is a 390px phone, which has no hover. */
export interface AboutBadge {
  readonly label: ProvenanceBadge;
  readonly gloss: string;
}

/** When one committed artifact was baked. */
export interface AboutStamp {
  readonly label: string;
  /** The stamp as the artifact carries it, so a reader can match it against the file. */
  readonly iso: string;
  readonly date: string;
}

/** One surface of the map, and everything it is entitled to be asked. */
export interface AboutSource {
  readonly what: string;
  readonly source: string;
  /** Of the *data*, never of the build. The two differ and are never printed as one. */
  readonly vintage: string;
  readonly badges: readonly AboutBadge[];
  /** What is known to be wrong or incomplete about it. `null` only where nothing is. */
  readonly caveat: string | null;
}

export interface AboutBasis {
  readonly name: string;
  readonly source: string;
  readonly vintage: string;
  readonly badges: readonly AboutBadge[];
}

export interface AboutDiscrepancy {
  readonly label: string;
  /** The size of it, where the artifact carries one as a figure. Never rounded, never estimated. */
  readonly figure: string | null;
  readonly text: string;
}

export interface AboutTheData {
  readonly title: string;
  readonly summary: string;
  readonly lead: string;
  readonly vintage: { readonly statement: string; readonly consequence: string };
  readonly built: { readonly lead: string; readonly stamps: readonly AboutStamp[] };
  readonly bases: { readonly lead: string; readonly items: readonly AboutBasis[] };
  readonly sources: { readonly lead: string; readonly items: readonly AboutSource[] };
  readonly discrepancies: { readonly lead: string; readonly items: readonly AboutDiscrepancy[] };
  /** What this panel leaves off, and where the rest of it is. Never silence. */
  readonly omitted: string;
  readonly licences: readonly string[];
}

export interface AboutInputs {
  readonly geography: Provenance;
  readonly context: ContextProvenance;
  readonly census: CensusStatistics;
  readonly scenarios: ScenarioBundle;
  readonly outlines: UnitOutlineBundle;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * An ISO stamp as a date a reader can say out loud — 1 August 2026.
 *
 * Written out rather than left to `toLocaleDateString`, for the reason `groupDigits` gives about
 * `toLocaleString`: a date that renders as 01/08/2026 in one browser and 8/1/2026 in another is
 * one date wearing two faces, and one of them says a different day. The ISO string is printed
 * beside it anyway, because that is what matches the file.
 */
export function readableDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match === null) return iso;
  const [, year, month, day] = match as unknown as [string, string, string, string];
  const name = MONTHS[Number(month) - 1];
  if (name === undefined) return iso;
  return `${Number(day)} ${name} ${year}`;
}

function badge(label: ProvenanceBadge): AboutBadge {
  const gloss = (PROVENANCE_GLOSS as Readonly<Record<string, string | undefined>>)[label];
  if (gloss === undefined) {
    throw new Error(
      `The About panel would print the provenance badge "${label}", which is not one of ` +
        `${Object.keys(PROVENANCE_GLOSS).join(', ')}. The vocabulary is closed because a badge ` +
        `is a claim about where a surface came from, and an unglossed one on the panel that ` +
        `exists to explain the badges is a claim explaining itself.`,
    );
  }
  return { label, gloss };
}

const badges = (...labels: ProvenanceBadge[]): readonly AboutBadge[] => labels.map(badge);

/**
 * The four bases, each with the three things #21 requires of it: a badge, a source and a vintage.
 *
 * The vintage falls back to the bundle's own header where the basis carries none of its own — the
 * field was added to the schema after this bundle was baked, and a panel that printed nothing
 * there would report a gap in the data that is really a gap between two commits.
 */
function basesOf(scenarios: ScenarioBundle): readonly AboutBasis[] {
  return Object.values(scenarios.bases).map((basis: BasisRecord) => ({
    name: basis.name,
    source: basis.source,
    vintage: basis.vintage ?? scenarios.provenance.vintage,
    badges: basis.badges.map(badge),
  }));
}

/**
 * Every surface the map draws, and where each came from.
 *
 * The vintages are not one string repeated. OSM's own base timestamps are the vintage of the
 * *boundaries* and PBS's census is the vintage of the *figures*; they are months and years apart,
 * and a panel that printed the census date under a boundary would be asserting that the border
 * was surveyed by the census. Each row takes its own.
 */
function sourcesOf(inputs: AboutInputs): readonly AboutSource[] {
  const { geography, context, census, outlines } = inputs;
  const osm = (tier: string): string => {
    const stamp = geography.osmBaseTimestamp[tier];
    return stamp === undefined
      ? 'OpenStreetMap, as fetched for this build'
      : `OpenStreetMap as at ${readableDate(stamp)}`;
  };
  const contextOsm = (tier: string): string => {
    const stamp = context.osmBaseTimestamp[tier];
    return stamp === undefined
      ? 'OpenStreetMap, as fetched for this build'
      : `OpenStreetMap as at ${readableDate(stamp)}`;
  };
  const censusVintage = census.provenance.vintage;
  const { counts } = geography;

  return [
    {
      what: `Provinces, territories and divisions — ${counts['provinces']} and ${counts['divisions']}, drawn and named on every view`,
      source: geography.sources['boundaries'] ?? '',
      vintage: osm('province'),
      badges: badges('official'),
      caveat: null,
    },
    {
      what: `District boundaries — ${counts['districts']} drawn, the building block every proposal is stated in`,
      source: `${geography.sources['boundaries'] ?? ''}; the district set from ${geography.sources['roster'] ?? ''}`,
      vintage: osm('district'),
      badges: badges('official'),
      caveat:
        `OpenStreetMap returns ${counts['osmDistrictRelations']} current-day district relations. ` +
        `The map draws the ${counts['districts']} of the 2023 census set: districts created since ` +
        `are folded into the parent that carries their census row, so the boundary is the 2023 ` +
        `one and not today's (ADR-0001).`,
    },
    {
      what: 'Coastline — where the land stops, and what the coastal districts are cut against',
      source: geography.sources['coastline'] ?? '',
      vintage: osm('coastline'),
      badges: badges('documented', 'derived'),
      caveat:
        `${geography.coastline.ways} coastline ways chained into a shoreline; of the ` +
        `${geography.coastline.districtsConsidered} districts whose bounding box meets it, ` +
        `${geography.coastline.districtsClipped} were actually cut. Natural Earth was rejected: a ` +
        `second lineage at a different vintage would need ADR-0001 amended.`,
    },
    {
      what: `Line of Control — the ${geography.lineOfControl.lengthKm} km drawn dashed, along ${geography.lineOfControl.alongDistricts.length} districts`,
      source: `Derived from ${geography.sources['boundaries'] ?? 'OpenStreetMap'} — the ${geography.lineOfControl.ways} ways belonging both to a drawn territory and to ${geography.lineOfControl.againstRelations
        .map((relation) => relation.name)
        .join(' or ')}`,
      vintage: osm('district'),
      // Never `documented`: nobody published this line as a line. It is a segment of a boundary
      // this map already draws, selected by identity — which is exactly what `derived` claims.
      badges: badges('derived'),
      caveat:
        'A ceasefire line, not an international border, which is what the dash says. Its northern ' +
        'end beyond NJ9842 in the Siachen area was never delimited even as a ceasefire line. The ' +
        'Sialkot–Narowal stretch south of the Chenab is the Working Boundary, a different line, ' +
        'and is not drawn dashed.',
    },
    {
      what: `Neighbour silhouettes — ${context.neighbours.countries.map((country) => country.name).join(', ')}, drawn faint and unlabelled`,
      source: context.sources['neighbours'] ?? '',
      vintage: contextOsm('neighbours'),
      // `official` for the relations, `derived` for the rectangle they are cut to — which is this
      // build's only judgement in the row, and so the only part that needs the second badge.
      badges: badges('official', 'derived'),
      caveat: context.neighbours.kashmir,
    },
    {
      what: `City dots — ${context.cities.count}, and "major" means the seat of a first-level unit`,
      source: context.sources['seats'] ?? '',
      vintage: contextOsm('seats'),
      badges: badges('official'),
      caveat: `${context.cities.why} ${context.cities.omits}`,
    },
    {
      what: 'Population — every district figure, and every unit total summed from them',
      source: `${census.provenance.sources['census'] ?? ''}; extracted from ${census.provenance.sources['censusPackage'] ?? ''}; checked against ${census.provenance.sources['publishedTotals'] ?? ''}`,
      vintage: censusVintage,
      badges: badges('census'),
      caveat: census.reconciliation.method,
    },
    {
      what: 'District areas — what the drawn geometry is measured against',
      source: geography.sources['publishedAreas'] ?? '',
      vintage: censusVintage,
      badges: badges('census'),
      caveat: null,
    },
    {
      what: `Mother tongue — the ${census.motherTongue.categories.length} categories the Language basis shades by`,
      source: census.motherTongue.source,
      vintage: censusVintage,
      badges: badges('census', 'proxy'),
      caveat: census.motherTongue.dominance,
    },
    {
      what: 'Development — literacy, improved drinking water, and households with a flush toilet',
      source: census.development.source,
      vintage: censusVintage,
      badges: badges('census'),
      caveat: census.development.indicators['sanitation']?.note ?? null,
    },
    {
      what: `Proposed unit outlines — ${outlines.provenance.counts['units'] ?? 0} across ${outlines.provenance.counts['variants'] ?? 0} variant(s), drawn on top of everything`,
      source: `${outlines.provenance.sources['content'] ?? ''}; dissolved out of ${outlines.provenance.arcsFrom}`,
      vintage: `The date of each proposal's own source — stated on its card, variant by variant`,
      // The one drawn surface with no published line behind it: an outline is the merge of its
      // districts' arcs, computed here. Where the *claim* came from is the card's business, and
      // the row says so rather than answering for seventeen different documents.
      badges: badges('derived'),
      caveat: outlines.provenance.method,
    },
  ];
}

/**
 * Where the data disagrees with itself, and where this map disagrees with PBS.
 *
 * Every item is quoted from the artifact that found it rather than restated here. Four are PBS's
 * own releases disagreeing with each other, one is the limit of what a cross-check can prove, and
 * the last is this build's geometry against PBS's published areas. None of them is closed, and
 * saying so is the point: an app that reconciled a census gap by inventing a residual would have
 * published a figure nobody counted.
 */
function discrepanciesOf(census: CensusStatistics, geography: Provenance): readonly AboutDiscrepancy[] {
  const { universe } = census.motherTongue;
  const water = census.development.improvedWaterDifference;
  const items: AboutDiscrepancy[] = [
    {
      label: 'Table 11 counts a smaller Pakistan than Table 1',
      figure: `${groupDigits(universe.population - universe.counted)} people`,
      text: universe.note,
    },

    {
      label: "PBS's two releases of Table 23 disagree on improved water",
      figure: `${groupDigits(water.difference)} households`,
      text: water.note,
    },
    {
      label: 'There is no improved-sanitation figure to publish',
      figure: null,
      text: census.development.indicators['sanitation']?.note ?? '',
    },
    {
      label: 'The rates do not share a denominator',
      figure: null,
      text: census.development.indicators['water']?.note ?? '',
    },
    {
      label: 'The division totals are a cross-check, not a second source',
      figure: null,
      text: census.reconciliation.method,
    },
    ...geography.knownLimitations.map((limitation, index) => ({
      label:
        index === 0
          ? 'The drawn geometry against PBS’s published areas'
          : 'The drawn geometry against PBS’s published areas, continued',
      figure: null,
      text: limitation,
    })),
  ];
  return items;
}

/** The whole panel, from the committed bundles. Pure: no DOM, no fetch, no markup. */
export function aboutTheData(inputs: AboutInputs): AboutTheData {
  const { geography, context, census, scenarios, outlines } = inputs;
  const uncounted = census.withoutCensusData.districts.length;

  return {
    title: 'About the data',
    summary: 'About the data — every source, its vintage, and when this map was built',
    lead:
      'This app claims that no surface on it is unsourced: every fill, every figure and every ' +
      'boundary traces to a published document and carries a badge saying which kind of claim it ' +
      'is. Everything needed to check that claim is below. Nothing here is fetched — the map is ' +
      'built from files committed to the repository, so a boundary can only change in a commit, ' +
      'never between two page loads.',
    vintage: {
      statement: geography.vintage,
      consequence:
        `One vintage for the geometry and the statistics both, which is what lets a district be ` +
        `drawn and counted as the same district (ADR-0001). It is knowingly not today's map: the ` +
        `Balochistan restructuring of 8 July 2026 created divisions and districts the 2023 census ` +
        `never counted, so they are named in this note and not drawn. ${uncounted} of the ` +
        `${geography.counts['districts']} districts on screen — Azad Jammu & Kashmir's and ` +
        `Gilgit-Baltistan's — carry no census figure at all. ${census.withoutCensusData.reason}`,
    },
    built: {
      lead:
        'Each file below is a committed build artifact with its own date. They are baked ' +
        'separately and on purpose, so a census rebuild does not restamp a boundary that has not ' +
        'moved — and a diff in the geometry file means a border actually changed.',
      stamps: [
        { label: 'Boundaries, coastline and the Line of Control', iso: geography.generated },
        { label: 'Neighbour silhouettes and city dots', iso: context.generated },
        { label: 'The census join', iso: census.provenance.generated },
        { label: 'The proposals and their scorecards', iso: scenarios.provenance.generated },
        { label: 'The dissolved unit outlines', iso: outlines.provenance.generated },
      ].map((stamp) => ({ ...stamp, date: readableDate(stamp.iso) })),
    },
    bases: {
      lead:
        'A basis is the ground a proposal is argued from, and selecting one shades the districts ' +
        'by its data. Each carries what any other surface here carries: a badge, a source and a ' +
        'vintage.',
      items: basesOf(scenarios),
    },
    sources: {
      lead:
        'Every surface the map draws. The vintage on each row is the vintage of the data, not of ' +
        'the build: OpenStreetMap’s own edit dates are months apart from the census’s, and ' +
        'printing one under the other would say a border had been surveyed by a census. Each ' +
        'proposal’s own boundary, badge and sources are on its card, where the proposal is.',
      items: sourcesOf(inputs),
    },
    discrepancies: {
      lead:
        'Where the sources disagree — with each other, or with this map. These are stated rather ' +
        'than closed: reconciling a census gap by inventing a residual would publish a figure ' +
        'nobody counted, and smoothing an area difference would draw a line no source draws.',
      items: discrepanciesOf(census, geography),
    },
    omitted:
      'Left off this panel and kept in the artifacts: the SHA-256 digests of the census cache ' +
      'files, the district sums reconciled province by province and division by division, and ' +
      'every district PBS counts above its own population. They are an appendix rather than a ' +
      'page — some hundreds of rows of figures — and the test suite re-derives all of them from ' +
      'the committed bundle on every run. They are in data/bundle/statistics.json and ' +
      'data/bundle/geography.topojson.json.',
    licences: [
      'Boundaries, coastline, silhouettes and city dots: © OpenStreetMap contributors, ODbL.',
      `Census figures: ${census.provenance.sources['census'] ?? 'Pakistan Bureau of Statistics'}.`,
      `Structured census extraction: ${census.provenance.sources['censusPackage'] ?? ''} — licence ${census.provenance.sources['censusPackageLicence'] ?? 'GPL-2'}.`,
      'Proposal content: curated and sourced in this repository; each variant cites its own documents on its card.',
    ],
  };
}
