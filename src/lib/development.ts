/**
 * Stratum 1 for the Development basis: what each drawn district is filled with (#31).
 *
 * Pure, and takes the committed index artifact as an argument rather than importing it, for the
 * same reason `mother-tongue.ts` takes the statistics: the decision in here — which of three
 * treatments a district gets — is worth testing against the real bundle *and* against a hand-made
 * one.
 *
 * **Nothing here computes the composite.** The score and the band are read off
 * `data/bundle/development-index.json`, where the formula is applied once at build time; the
 * renderer's only job is to turn a band into a colour. That is not fastidiousness: the same file
 * is what D1's boundary was cut at, and a runtime that recomputed the mean would be free to shade
 * a district on one number while the line drawn over it had been decided on another.
 *
 * There are three outcomes, and two of them are absences that must not look alike:
 *
 * - `band` — the district has a composite, and falls in one of the four bands.
 * - `no-data` — PBS published none of the three rates for it. Azad Jammu & Kashmir's ten districts
 *   and Gilgit-Baltistan's ten (D25). Rendered by taking no fill, so the unshaded baseline shows
 *   through: the basis does not reach them. Never a zero, which would paint twenty districts as
 *   the least served in Pakistan on all three counts at once.
 * - There is no `no-dominant` here, and that is a real difference from the language basis rather
 *   than an omission: a mean of three published rates always has a value, where a dominant mother
 *   tongue is an answer the census can fail to name.
 */

import type { CensusStatistics } from '../bundle.ts';
import { NO_DATA, type DistrictFill, type LegendEntry } from './fill.ts';
import { DEVELOPMENT_BAND_FILL } from './palette.ts';

/** The committed composite, as `development-index.json` carries it. */
export interface DevelopmentIndexBundle {
  readonly provenance: {
    readonly generated: string;
    readonly vintage: string;
    readonly badge: string;
    readonly what: string;
    readonly formula: string;
    readonly notPoverty: string;
    readonly components: readonly {
      readonly key: string;
      readonly label: string;
      readonly table: string;
      readonly numerator: string;
      readonly denominator: string;
    }[];
    readonly bands: readonly {
      readonly id: string;
      readonly from: number;
      readonly to: number;
      readonly label: string;
      readonly districts: number;
    }[];
    readonly bandMethod: string;
    readonly range: {
      readonly lowest: { readonly district: string; readonly score: number };
      readonly highest: { readonly district: string; readonly score: number };
    };
    readonly counts: { readonly districts: number; readonly byBand: Readonly<Record<string, number>> };
    readonly withoutIndex: { readonly reason: string; readonly districts: readonly string[] };
    readonly statistics: { readonly generated: string | null; readonly districts: number };
    readonly sources: Readonly<Record<string, string>>;
  };
  readonly districts: Readonly<Record<string, { readonly score: number; readonly band: string }>>;
}

/**
 * Every district the index reaches, keyed exactly as the geometry names it.
 *
 * Throws on a band the palette has no colour for, rather than falling back to a neutral. A silent
 * fallback is how a district comes to be shaded as "not reached" when the census reached it — the
 * display-side twin of the build refusing a score that falls in no band.
 */
/**
 * What one band is painted and called — resolved in one place, and refusing in one place.
 *
 * Every surface that renders a band needs both halves: the district fill needs the colour and the
 * words, the legend needs the colour beside the words, and the tooltip needs the words alone. Each
 * of them had its own lookup, and only the first of them refused an unknown band — so the same
 * missing colour threw a paragraph naming the district on the map and rendered an **empty swatch**
 * in the legend and in the exported PNG beside it, which is the quiet wrongness this module's own
 * header is about. `saidOf` is what the failure names, so the message says which surface asked.
 */
export function bandPaint(
  index: DevelopmentIndexBundle,
  band: string,
  saidOf: string,
): { readonly colour: string; readonly label: string } {
  const colour = DEVELOPMENT_BAND_FILL[band];
  const label = index.provenance.bands.find((entry) => entry.id === band)?.label;
  if (colour === undefined || label === undefined) {
    throw new Error(
      `${saidOf} falls in the development band "${band}", which ` +
        `${colour === undefined ? 'the palette has no colour for' : 'the artifact does not name'}. ` +
        `The artifact declares ${index.provenance.bands.length} bands; the ramp must cover every ` +
        `one of them, because a band with no colour would render as an absence — the map saying ` +
        `"not measured" about a district the census published in full — and a band with no label ` +
        `would key the legend with an id.`,
    );
  }
  return { colour, label };
}

export function developmentFills(
  index: DevelopmentIndexBundle,
  statistics: CensusStatistics,
): Map<string, DistrictFill> {
  const fills = new Map<string, DistrictFill>();

  for (const [name, record] of Object.entries(index.districts)) {
    const { colour, label } = bandPaint(index, record.band, name);
    fills.set(name, { kind: 'band', band: record.band, label, colour });
  }

  // The twenty the census does not reach (D25). Set after, and unconditionally, so a district that
  // somehow appeared in both is an absence rather than a figure.
  for (const name of statistics.withoutCensusData.districts) fills.set(name, NO_DATA);

  return fills;
}

export interface DevelopmentLegend {
  /** What the shading is, in one line, above the swatches. The composite is nobody else's figure. */
  readonly lead: string;
  /** The four bands, lowest first — the order the scale is read in. */
  readonly bands: readonly LegendEntry[];
  /** The one absence this basis has. */
  readonly absences: readonly LegendEntry[];
  /** The formula, and the sentence saying what the index is not. Both on the page, not in a title. */
  readonly formula: string;
  readonly notPoverty: string;
}

/**
 * Derived from the artifact, never typed: which bands exist, what they are called and how many
 * districts fall in each are properties of the committed composite. A legend that named a band the
 * map does not use — or omitted one it does — is the kind of quiet wrongness that survives review.
 *
 * A band no district falls in is still keyed, with the fact said out loud. It is the opposite case
 * from the language legend's six nowhere-dominant categories, which are grouped away because there
 * are fifteen of them; there are four bands here, they are an ordered scale, and dropping one out
 * of the middle would make the ramp read as three even steps.
 */
export function developmentLegend(index: DevelopmentIndexBundle): DevelopmentLegend {
  const { bands, formula, notPoverty, range, counts } = index.provenance;
  return {
    lead:
      `Development index — ${counts.districts} districts, from ` +
      `${range.lowest.district} at ${(range.lowest.score * 100).toFixed(1)}% to ` +
      `${range.highest.district} at ${(range.highest.score * 100).toFixed(1)}%. ` +
      `A composite this project defines; no published source states it.`,
    bands: bands.map((band) => ({
      label:
        band.districts === 0
          ? `${band.label} — no district falls in this band`
          : `${band.label} (${band.districts})`,
      // Through the same lookup the fill uses, so a band the ramp cannot paint fails here as
      // loudly as it does on the map. A blank swatch keys nothing and says so to nobody.
      swatch: { kind: 'colour', colour: bandPaint(index, band.id, `the legend's ${band.label}`).colour },
    })),
    absences: [
      {
        label: 'No census data, not shaded — Azad Jammu & Kashmir, Gilgit-Baltistan',
        swatch: { kind: 'hatch' },
      },
    ],
    formula,
    notPoverty,
  };
}
