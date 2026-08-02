/**
 * The footer band a PNG export carries with it (#32, D22).
 *
 * The case for this module is the case for the whole ticket. A map of Pakistan with a heavy
 * coloured province outline on it is going to travel as a WhatsApp forward whether this app helps
 * or not, and a screenshot strips off every one of the four things that make the picture honest:
 * whose proposal it is, what the colours are, where the boundary came from, and that it is not the
 * country's map. So the sanctioned export bakes them into the image itself — below the map, inside
 * the same PNG, where a crop is the only way to lose them and a crop is visible.
 *
 * Everything here is a decision about *words and arithmetic*, so it is pure and under test.
 * `src/export-image.ts` does the rasterising and composes not one sentence, exactly as `panel.ts`
 * composes none of the card's.
 *
 * Four things this module refuses to do quietly:
 *
 * - **The disclaimer is not conditional prose.** Every band carries a standing line, and the line
 *   says which of the two maps this is. A proposal says *Proposed — not official*; the baseline
 *   says it is the official geography. An export with no standing line at all would be the one
 *   image this app produces that a reader cannot place, and it would be the image most likely to
 *   be forwarded without its page.
 * - **A vintage that was inherited says it was inherited.** A variant may date its own boundary
 *   (H2 draws 1947); where it does not, it is read at its basis's and the band says so — printing
 *   the census's year flat against a 1947 boundary is the exact failure #21 exists to prevent.
 * - **The legend is derived, never transcribed.** It is built from the same `unitLegend` and
 *   `motherTongueLegend` the on-screen key is built from, so a band that keys a colour the map no
 *   longer draws is impossible rather than merely unlikely.
 * - **The attribution names no figure source the variant does not use** (#49). The licence line
 *   credited every picture's figures to the 2023 census and stamped it "pinned to" that vintage,
 *   H2's included — a variant that publishes no figure at all precisely because 2023 numbers do not
 *   describe 1947 boundaries. It is not a figure leaking, which is why the withholding's own checks
 *   did not catch it; it is a provenance claim the variant disclaims, printed where nothing beside
 *   the image can correct it.
 */

import type {
  BasisId,
  BasisRecord,
  CensusStatistics,
  Provenance,
  ScenarioBundle,
  UnitKind,
  VariantRecord,
} from '../bundle.ts';
import { provenanceBadge, type CardBadge } from './card.ts';
import { developmentLegend, type DevelopmentIndexBundle } from './development.ts';
import { motherTongueLegend } from './mother-tongue.ts';
import { figuresWithheld } from './tooltip.ts';
import { unitLegend, type UnitSwatch } from './units.ts';

/**
 * What a legend swatch is, in the terms the export can actually paint.
 *
 * The on-screen key wears CSS classes; a serialised SVG rasterised in an `<img>` has no stylesheet,
 * so the band's swatches carry their paint explicitly. The kinds are the screen's kinds and no
 * others — a swatch shape that exists only in the export would be the legend disagreeing with the
 * map about what it is keying.
 */
export type BandSwatch =
  | { readonly kind: 'colour'; readonly colour: string }
  | { readonly kind: 'stipple' }
  | { readonly kind: 'hatch' }
  | { readonly kind: 'unit'; readonly unit: UnitKind }
  | { readonly kind: 'rule'; readonly rule: 'province' | 'territory' | 'division' | 'dashed' };

export interface BandLegendEntry {
  readonly label: string;
  readonly swatch: BandSwatch;
}

/**
 * The band's content: what it says, before anything has decided where it goes.
 *
 * Split from the layout deliberately. What the image asserts about a proposal is a content
 * decision reviewed as content; how many lines it takes at 900px is arithmetic, and the two failing
 * together would make either hard to change.
 */
export interface ExportBand {
  /** The scenario name, or the country's own, which is the name of the map at the baseline. */
  readonly title: string;
  readonly tagline: string | null;
  /** *Proposed — not official*, or the baseline's own standing. Never absent. */
  readonly standing: string;
  /**
   * Whether that standing line is a proposal's — which is what decides the ink it is set in.
   *
   * The accent belongs to a proposed unit and to nothing else, on the map and therefore here. The
   * baseline proposes nothing, so its standing line is set in the map's own ink: spending the
   * accent on the sentence "this is the official map" would say the opposite of what the accent
   * means everywhere else in this app.
   */
  readonly proposed: boolean;
  /** Which ground the shading argues from. Absent at the baseline, which shades nothing. */
  readonly basis: CardBadge | null;
  readonly provenance: readonly CardBadge[];
  /** The date the boundary on screen is argued at, and — where inherited — whose date it is. */
  readonly vintage: string;
  /** Where the boundary and the figures came from. Always at least the boundaries' own source. */
  readonly sources: readonly string[];
  readonly legend: readonly BandLegendEntry[];
  /** Licence and attribution, which travel with the pixels because the pixels travel. */
  readonly attribution: string;
}

/** The literal D22 asks for, spelled once so the suite can hold the words and not a paraphrase. */
export const NOT_OFFICIAL = 'Proposed — not official';

/**
 * The button's words.
 *
 * "Download PNG" and not "Share" or "Export": it says what lands on the machine, which is the whole
 * point of offering it — a reader who knows they are getting an image file will use this instead of
 * the screenshot key, and the screenshot key is what this feature competes with.
 */
export const EXPORT_LABEL = 'Download PNG';
export const EXPORT_WORKING = 'Preparing…';
export const EXPORT_TITLE =
  'Download this view as an image, with the scenario name, the key, the sources and the data ' +
  'vintage baked into it — so a copy that travels carries its own provenance.';
/** Said when the raster fails. Never silence: a button that does nothing reads as a broken page. */
export const EXPORT_FAILED = 'The image could not be made. The map itself is unaffected.';

/**
 * The baseline's own standing.
 *
 * The current map is not a proposal and must not be labelled as one — an export of the real
 * provinces carrying "not official" would be this app disclaiming the government's own geography.
 */
const OFFICIAL = 'The administrative map as it stands — official, and nothing proposed on it';

/**
 * How the boundary on screen is dated — and, crucially, *whether there is a date to print at all*.
 *
 * Re-derived here rather than imported from `scripts/lib/scenarios.ts`: the runtime reads the
 * committed bundle directory and does not reach into the pipeline.
 *
 * Three outcomes rather than two, and the third is the one that matters. A variant may date its own
 * boundary (H2 draws 1947); where it does not it is read at its basis's, and for three of the four
 * bases that is the project's single vintage (D24) and a real date. The Historical basis is the
 * exception the rule allows for: its demarcations are dated one by one, so what it declares is not
 * a date but *the rule for finding one* — "the date of each demarcation, 1947 onward, stated per
 * variant, not shared". Printing that string after "Vintage:" would put a sentence on the image
 * saying the date is stated per variant, on a variant that states none — the export asserting its
 * own provenance is elsewhere. So the deferral is recognised for what it is and the band sends the
 * reader to the Source line, which is where those dates actually are (H1's sources carry 1955 and
 * 1970; H4's carry 1947).
 *
 * Recognised by comparing against the bundle's own header vintage rather than by matching the
 * words: a basis whose vintage *is* the project's is quoting a date, and one whose is not is, by
 * D24, the documented basis deferring. That keeps this from being a string test that a rewording
 * upstream would silently defeat.
 */
export type BandVintage =
  | { readonly kind: 'own'; readonly vintage: string }
  | { readonly kind: 'basis'; readonly vintage: string; readonly basis: string }
  | { readonly kind: 'per-source'; readonly basis: string };

export function bandVintage(
  variant: VariantRecord,
  basis: BasisRecord | undefined,
  projectVintage: string,
): BandVintage {
  const own = variant.vintage;
  if (own !== undefined && own.trim() !== '') return { kind: 'own', vintage: own };
  if (basis === undefined) {
    throw new Error(
      `${variant.id} states no vintage of its own and is argued on the basis "${variant.basis}", ` +
        `which this bundle does not describe. An image that dated a boundary by guessing would ` +
        `be the one surface here with an unsourced date on it.`,
    );
  }
  if (basis.vintage !== projectVintage) return { kind: 'per-source', basis: basis.name };
  return { kind: 'basis', vintage: basis.vintage, basis: basis.name };
}

/** The Vintage line, in the words of whichever of the three states the variant is actually in. */
function vintageLine(dated: BandVintage): string {
  switch (dated.kind) {
    case 'own':
      return dated.vintage;
    case 'basis':
      return `${dated.vintage} — the ${dated.basis} basis's vintage; this proposal states none of its own`;
    case 'per-source':
      return (
        `The date of this proposal's own source, listed under Source below — the ${dated.basis} ` +
        `basis dates each demarcation separately and this proposal states no date of its own`
      );
  }
}

/**
 * The key, built from the same two functions the page's own legend is built from.
 *
 * One thing is left off that the page carries: the six categories PBS names which are dominant in
 * no district. On the page they are grouped at the end and cost nothing; in a band they would be
 * six swatches a reader never has to match against the picture, pushing the nine that matter onto
 * another line. The absences stay, because they are what the map draws and are the two states most
 * easily misread as a failed load.
 */
export function bandLegend(
  statistics: CensusStatistics,
  variant: VariantRecord | null,
  /** The basis whose shading is on the map, or `null` where nothing is shaded. */
  shadedBy: BasisId | null,
  /** The committed composite, for the one basis whose key is not a census category (#31). */
  development: DevelopmentIndexBundle,
): readonly BandLegendEntry[] {
  const entries: BandLegendEntry[] = [];

  if (variant === null) {
    entries.push(
      { label: 'Province', swatch: { kind: 'rule', rule: 'province' } },
      {
        label: 'Territory — not constitutionally a province',
        swatch: { kind: 'rule', rule: 'territory' },
      },
      { label: 'Division', swatch: { kind: 'rule', rule: 'division' } },
    );
  } else {
    // Stratum 3 first and stratum 1 second, in the order a reader meets them on the map: the
    // outlines are what the picture is about, the fills are the evidence they are drawn against.
    for (const entry of unitLegend(variant)) {
      entries.push({ label: entry.label, swatch: { kind: 'unit', unit: UNIT_SWATCH[entry.swatch] } });
    }
  }

  if (shadedBy !== null) {
    // Named basis by basis rather than assumed. Two of the four have a fill in the renderer, and a
    // band that answered every shadeable basis with the mother-tongue key would print the wrong
    // key under the right badge — a legend that keys data the map is not drawing is worse than no
    // legend, because it is checkable and wrong. The third and fourth still fail by name here.
    // Each legend is built once and then read twice. Building it per half would derive the same
    // key twice from the same bundle to concatenate the two halves of it, which is work for
    // nothing and, worse, two chances for one basis to answer a question differently.
    const language = shadedBy === 'language' ? motherTongueLegend(statistics) : null;
    // The bands and the one absence, in the order the scale is read. The lead sentence — that no
    // published source states this figure — is not a key entry: it is the badge's gloss, and the
    // band already prints that under `Provenance`.
    const composite = shadedBy === 'development' ? developmentLegend(development) : null;
    const shaded =
      language !== null
        ? [...language.onTheMap, ...language.absences]
        : composite !== null
          ? [...composite.bands, ...composite.absences]
          : null;
    if (shaded === null) {
      throw new Error(
        `The map is shaded by the ${shadedBy} basis and this band has no key for it. A key is ` +
          `derived from the fill it explains; keying one basis's colours under another's name ` +
          `would put a legend on the image that the picture does not match.`,
      );
    }
    for (const entry of shaded) {
      entries.push({
        label: entry.label,
        swatch:
          entry.swatch.kind === 'colour'
            ? { kind: 'colour', colour: entry.swatch.colour }
            : { kind: entry.swatch.kind },
      });
    }
  }

  // Under every basis and at the baseline, exactly as on screen: a ceasefire line with no key is a
  // line a reader is entitled to read as a border, and the export is the copy that travels.
  entries.push({
    label: 'Line of Control — ceasefire line, not an international border',
    swatch: { kind: 'rule', rule: 'dashed' },
  });
  return entries;
}

/**
 * The screen legend's swatch class for a unit, and the kind it stands for.
 *
 * A table rather than `swatch.slice('unit-'.length)`: parsing a domain word back out of a CSS class
 * gives an unrecognised class a plausible-looking kind and no failure at all, and `swatchInk` would
 * then fall out of its own switch and paint nothing. Exhaustive over `UnitKind`, so a fourth kind is
 * a compile error here rather than a blank swatch in a picture that travels.
 */
const UNIT_SWATCH: Readonly<Record<UnitSwatch, UnitKind>> = {
  'unit-proposed': 'proposed',
  'unit-unchanged': 'unchanged',
  'unit-territory': 'territory',
};

export interface BandInput {
  readonly scenarios: ScenarioBundle;
  readonly statistics: CensusStatistics;
  readonly geography: Provenance;
  /** The proposal on screen, or `null` for the baseline — which is a view, not the absence of one. */
  readonly variant: VariantRecord | null;
  /**
   * Which basis's shading is on the map, or `null` where none is.
   *
   * The *renderer's* answer and not the selection's: three of the four bases can be selected and
   * shade nothing, and a band that keyed a fill the map never drew would be a legend for a picture
   * that does not exist.
   */
  readonly shadedBy: BasisId | null;
  /** The committed composite (#31) — the one fill whose key is not a census category. */
  readonly development: DevelopmentIndexBundle;
}

/**
 * A source string, or a failure naming the key.
 *
 * No `??` fallback. A renamed bundle key would otherwise substitute a vaguer label of our own
 * invention onto the one surface that travels with no page behind it — which is exactly the silence
 * the About panel's tests exist to prevent ("a row lost to a renamed bundle key is a failure and not
 * a silence"). An export with an unsourced source line is worse than no export.
 */
function sourceOf(sources: Readonly<Record<string, string>>, key: string): string {
  const found = sources[key];
  if (found === undefined || found.trim() === '') {
    throw new Error(
      `The geography bundle carries no "${key}" source, so this image would name its own ` +
        `provenance from nothing. Every surface here traces to a published source; a picture that ` +
        `travels alone least of all may invent one.`,
    );
  }
  return found;
}

/**
 * The licence line — and, on one variant, a lineage it may not claim (#49).
 *
 * Two forms rather than one, because the line is a *provenance* claim and not decoration. Every
 * band credits the boundaries to OpenStreetMap under ODbL and every band credits the district set
 * to PBS's 2023 census, because both are true of every picture this app draws: the 156 drawn
 * districts *are* the census's set (ADR-0001), which is why even H4 dates itself by the district
 * set rather than by the province it argues for.
 *
 * What is conditional is the *figures*. H2 publishes none — no unit population, no total, no
 * spread, no mother tongue and no development composite — on the ground that 2023 census numbers do
 * not describe 1947 boundaries. Crediting its figures to the census and stamping the image "pinned
 * to" that vintage asserted exactly the lineage the variant exists to disclaim, on the one surface
 * that travels with nothing beside it to correct the record. So a withholding variant's band names
 * what it does use and says plainly that there are no figures on it, rather than dropping the line
 * — an export with no attribution at all would breach the licence the boundaries come under.
 *
 * Whether a variant withholds is asked of `figuresWithheld` (#48) and never of the field: the card
 * prints the reason above its units and the tooltip prints it where the district's figures would
 * be, and a fresh ternary here would be a third derivation of one fact for a third surface to
 * disagree on. The baseline withholds nothing — it is the census's own map — so it takes the
 * ordinary form, which is also what a band built while compare is held gets, since that band
 * describes the baseline picture the map has been given rather than the selection behind it.
 */
export function bandAttribution(variant: VariantRecord | null, censusVintage: string): string {
  const boundaries = 'Boundaries © OpenStreetMap contributors, ODbL';
  // The attributor names and the licence are the wording those licences *require*, not a figure
  // read from the data — so they are typed here, and the vintage beside them is the bundle's own.
  if (variant !== null && figuresWithheld(variant) !== null) {
    return (
      `${boundaries} · district set: Pakistan Bureau of Statistics, 2023 Digital Census · ` +
      `this map carries no census figures, so none is dated by that census`
    );
  }
  return (
    `${boundaries} · figures: Pakistan Bureau of Statistics, ` +
    `2023 Digital Census · pinned to ${censusVintage}`
  );
}

/** Everything the band says, from the committed bundle. Pure: no DOM, no measurement, no markup. */
export function exportBand(input: BandInput): ExportBand {
  const { scenarios, statistics, geography, variant, shadedBy, development } = input;
  const legend = bandLegend(statistics, variant, shadedBy, development);
  const attribution = bandAttribution(variant, statistics.provenance.vintage);

  if (variant === null) {
    return {
      title: 'Pakistan — provinces, territories and divisions',
      tagline: null,
      standing: OFFICIAL,
      proposed: false,
      basis: null,
      provenance: [provenanceBadge('the baseline map', 'official')],
      vintage: geography.vintage,
      sources: [sourceOf(geography.sources, 'boundaries'), sourceOf(geography.sources, 'roster')],
      legend,
      attribution,
    };
  }

  const basis: BasisRecord | undefined = scenarios.bases[variant.basis];
  const dated = bandVintage(variant, basis, scenarios.provenance.vintage);
  return {
    title: variant.name,
    tagline: variant.tagline,
    standing: NOT_OFFICIAL,
    proposed: true,
    basis: basis === undefined ? null : { label: basis.name, gloss: basis.source },
    provenance: variant.badges.map((name) => provenanceBadge(variant.id, name)),
    // A date that was inherited says whose it is, and a basis that has no date to lend says that
    // instead. The alternative is an image asserting the census's year against a boundary the
    // census had nothing to do with — or quoting a deferral as though it were a date.
    vintage: vintageLine(dated),
    // The proposal's own documents, and not the boundary pipeline's endpoint on top of them: the
    // attribution line already names OpenStreetMap and its licence, and repeating the Overpass URL
    // here pushes the documents that actually date the claim further down a crowded band.
    sources: variant.sources.map((source) => source.label),
    legend,
    attribution,
  };
}

/**
 * What the downloaded file is called.
 *
 * A decision and not plumbing, so it lives here under test rather than in the renderer: the name is
 * the only part of the export a reader sees before they open it, and a folder of `map (3).png` is
 * exactly the friction this feature exists to remove. The proposal's own name, slugged; the
 * baseline says what it is rather than borrowing a variant's shape.
 */
export function exportFileName(variant: VariantRecord | null): string {
  if (variant === null) return 'pakistan-current-provinces.png';
  const slug = variant.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `pakistan-${variant.id}${slug === '' ? '' : `-${slug}`}.png`;
}

/* ------------------------------------------------------------------------------------------- *
 * Layout — where each of those words goes, in the band's own coordinates.
 * ------------------------------------------------------------------------------------------- */

/** The band's type scale, in px at 1×. The image is rasterised at 2×, so these are drawn twice up. */
export type BandStyle = 'title' | 'tagline' | 'standing' | 'meta' | 'legend' | 'fine';

export const BAND_TYPE: Readonly<Record<BandStyle, { size: number; leading: number }>> = {
  title: { size: 17, leading: 22 },
  tagline: { size: 12, leading: 16 },
  standing: { size: 12, leading: 16 },
  meta: { size: 10.5, leading: 14 },
  legend: { size: 9.5, leading: 13 },
  fine: { size: 9, leading: 12 },
};

/** How wide a string is when set in one of those styles. Supplied by the caller, which can measure. */
export type BandMeasurer = (text: string, style: BandStyle) => number;

export interface BandTextRow {
  readonly kind: 'text';
  readonly style: BandStyle;
  readonly text: string;
  readonly x: number;
  /** The baseline, not the top: SVG `text` is positioned on its baseline and so is this. */
  readonly y: number;
}

export interface BandLegendRow {
  readonly kind: 'legend';
  readonly swatch: BandSwatch;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  /** Where the label starts, once the swatch has had its width and its gap. */
  readonly labelX: number;
}

export interface BandRuleRow {
  readonly kind: 'rule';
  readonly y: number;
}

export type BandRow = BandTextRow | BandLegendRow | BandRuleRow;

export interface LaidOutBand {
  readonly width: number;
  readonly height: number;
  readonly rows: readonly BandRow[];
}

/** Band metrics, in px at 1×. One object so the export and its tests cannot disagree about them. */
export const BAND_METRICS = {
  padding: 16,
  /** Between the hairline that separates map from band and the first line of type. */
  ruleGap: 12,
  swatchWidth: 18,
  swatchGap: 6,
  /** Between one legend item and the next, along a row. */
  itemGap: 16,
  /** Between a block of type and the next block. */
  blockGap: 7,
} as const;

/** Greedy wrap. The band is prose set once at a known width; nothing here needs to be cleverer. */
function wrap(text: string, width: number, style: BandStyle, measure: BandMeasurer): string[] {
  const words = text.split(/\s+/).filter((word) => word !== '');
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = words[0] as string;
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (measure(candidate, style) <= width) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

/**
 * Lay the band out at a given width, and report how tall it came out.
 *
 * The height is a *result*, never a setting: the band carries six things D22 requires of it, and a
 * fixed height would either pad the baseline's short band with empty paper or — far worse — clip a
 * fifteen-category key off the bottom of the one image that travels without its page.
 */
export function layoutBand(band: ExportBand, options: {
  readonly width: number;
  readonly measure: BandMeasurer;
}): LaidOutBand {
  const { width, measure } = options;
  const { padding, ruleGap, swatchWidth, swatchGap, itemGap, blockGap } = BAND_METRICS;
  const inner = Math.max(1, width - padding * 2);
  const rows: BandRow[] = [];
  let y = 0;

  rows.push({ kind: 'rule', y: 0 });
  y += ruleGap;

  const paragraph = (text: string, style: BandStyle): void => {
    const { size, leading } = BAND_TYPE[style];
    for (const line of wrap(text, inner, style, measure)) {
      y += size;
      rows.push({ kind: 'text', style, text: line, x: padding, y });
      y += leading - size;
    }
  };

  paragraph(band.title, 'title');
  if (band.tagline !== null) paragraph(band.tagline, 'tagline');
  y += blockGap;

  // Immediately under the name and above everything else. A reader who takes in nothing but the
  // top two lines of a forwarded image has still been told which of the two maps this is.
  paragraph(band.standing, 'standing');
  y += blockGap;

  const badges = [
    ...(band.basis === null ? [] : [`Basis: ${band.basis.label}`]),
    ...band.provenance.map((badge) => badge.label),
  ].join(' · ');
  if (badges !== '') paragraph(badges, 'meta');
  // The badges are glossed in the image, not in a tooltip a PNG cannot have: a provenance word a
  // reader cannot check is a claim, and this is the copy that arrives with no page behind it.
  const glosses = band.provenance.map((badge) => badge.gloss);
  if (band.basis !== null) glosses.unshift(band.basis.gloss);
  if (glosses.length > 0) paragraph(glosses.join(' · '), 'fine');
  paragraph(`Vintage: ${band.vintage}`, 'meta');
  paragraph(`Source: ${band.sources.join(' · ')}`, 'meta');
  y += blockGap;

  // The key, flowed across the width rather than listed down it: fifteen categories set one to a
  // line would make the band taller than the map it explains.
  const { size: legendSize, leading: legendLeading } = BAND_TYPE.legend;
  let x = padding;
  y += legendSize;
  for (const entry of band.legend) {
    const itemWidth = swatchWidth + swatchGap + measure(entry.label, 'legend');
    if (x > padding && x + itemWidth > padding + inner) {
      x = padding;
      y += legendLeading;
    }
    rows.push({
      kind: 'legend',
      swatch: entry.swatch,
      label: entry.label,
      x,
      y,
      labelX: x + swatchWidth + swatchGap,
    });
    x += itemWidth + itemGap;
  }
  y += legendLeading - legendSize + blockGap;

  paragraph(band.attribution, 'fine');

  return { width, height: y + padding, rows };
}

/**
 * The ink a swatch is painted with — the map's own colours, so the key and the picture agree.
 *
 * A block is filled; a rule is stroked at the weight the map strokes it. The two are kept apart
 * because the difference is the point: a fill means *this ground is that*, and a rule means *this
 * line is that*, and the ceasefire line's entry has to be a dash or it keys nothing.
 */
export interface BandPalette {
  readonly paper: string;
  readonly ink: string;
  readonly inkSoft: string;
  readonly inkFaint: string;
  readonly land: string;
  readonly landHatch: string;
  readonly accent: string;
  readonly ruleUnit: string;
  readonly ruleProvince: string;
  readonly ruleDivision: string;
}

/** Pattern ids the band defines for itself, at a pitch no zoom transform reaches. */
export const BAND_HATCH = 'band-territory-hatch';
export const BAND_STIPPLE = 'band-no-dominant-stipple';

export type SwatchInk =
  | { readonly shape: 'block'; readonly fill: string; readonly stroke: string }
  | {
      readonly shape: 'rule';
      readonly stroke: string;
      readonly width: number;
      readonly dash: string | null;
    };

export function swatchInk(swatch: BandSwatch, palette: BandPalette): SwatchInk {
  switch (swatch.kind) {
    case 'colour':
      return { shape: 'block', fill: swatch.colour, stroke: palette.ruleProvince };
    /*
     * The band's own patterns, not the map's.
     *
     * The map's `#territory-hatch` lives in the zoomed group and carries a `patternTransform` that
     * counter-scales its pitch by 1/k, so that the texture stays the same texture at 24×. A swatch
     * in the band is in image space, where that counter-scale is simply wrong: at a deep zoom the
     * pitch collapses to a fraction of a pixel and the key renders as near-flat colour, keying
     * nothing. So the band defines its own at a fixed pitch, and the two absences stay two
     * absences at every zoom the reader might export from.
     */
    case 'stipple':
      return { shape: 'block', fill: `url(#${BAND_STIPPLE})`, stroke: palette.inkFaint };
    case 'hatch':
      return { shape: 'block', fill: `url(#${BAND_HATCH})`, stroke: palette.inkFaint };
    case 'unit':
      // The accent belongs to `proposed` units and to nothing else. A unit carried through
      // unchanged is drawn at unit weight in the map's own ink, and so is its swatch.
      return swatch.unit === 'proposed'
        ? { shape: 'rule', stroke: palette.accent, width: 2.4, dash: null }
        : { shape: 'rule', stroke: palette.ruleUnit, width: 1.6, dash: null };
    case 'rule':
      switch (swatch.rule) {
        case 'province':
          return { shape: 'block', fill: palette.land, stroke: palette.ruleProvince };
        case 'territory':
          return { shape: 'block', fill: `url(#${BAND_HATCH})`, stroke: palette.inkFaint };
        case 'division':
          return { shape: 'rule', stroke: palette.ruleDivision, width: 1, dash: null };
        case 'dashed':
          // The same dash the map draws, or the entry keys a line the reader cannot find.
          return { shape: 'rule', stroke: palette.ink, width: 1.35, dash: '4 3' };
      }
  }
}
