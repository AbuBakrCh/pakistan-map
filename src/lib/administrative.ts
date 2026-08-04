/**
 * Stratum 1 for the Administrative basis: what each drawn district is filled with.
 *
 * Pure, and takes the statistics artifact as an argument rather than importing it, for the same
 * reason `mother-tongue.ts` does.
 *
 * ## Why population, and not something derived from it
 *
 * The basis declares its source as *2023 census population + derived geometry*, and the shading is
 * the first half of that sentence flat: **the district's population as PBS published it**, banded.
 * Fill is data and never unit membership (D14), and the data an administrative argument is made of
 * is how many people a unit holds. It is also, precisely, what the rule engine behind A1, A2 and A3
 * partitions on — so the fill under those boundaries is the quantity the boundaries were cut at,
 * and a reader can see the line disagreeing with its own evidence where it does. That is the whole
 * point of shading a proposal against its basis rather than against itself.
 *
 * Two candidates were rejected, and both for the same reason rather than on taste. **Density**
 * (population over PBS's published area) is the cartographically tidier choropleth — a rate, not a
 * count — but no administrative variant in this app argues from it: A1 to A3 are about headcount
 * and A4 is about kilometres, so density would be a fill nothing on top of it was drawn from.
 * **Distance to the provincial seat** is A4's own evidence and would be the right fill for A4
 * alone, out of five.
 *
 * The cost of counts on a choropleth is real and is not hidden: a large, empty Balochistan district
 * takes the same ink per person as a small dense Punjabi one, so the map over-reads area. The
 * legend states the band's figures rather than a colour alone, and the tooltip prints the district's
 * own population in full — which is the answer to the over-reading, and it is why this basis needs
 * no `DistrictShading` of its own the way Development does (#31). That machinery exists because the
 * development composite is a figure nobody published and a colour is the only thing on screen
 * explaining it. Here the figure was already on the tooltip, with its source, before this basis
 * could be drawn at all.
 *
 * ## The bands are fixed, and are not quantiles
 *
 * Four cuts, stated here: under 500,000; 500,000 to 1,500,000; 1,500,000 to 3,000,000; and
 * 3,000,000 and above. Fixed for the reason the development composite's are (#31) — a quantile
 * band would make a district's colour a function of every *other* district's population, so a
 * district could change colour at the next census without one person moving into it, and the legend
 * would mean something different each time. They fall 34 / 37 / 42 / 23 across the 136, which is a
 * finding rather than a target: the cuts are round numbers a reader can hold, and the spread is
 * what the census puts inside them.
 *
 * **Nothing here is computed that the artifact does not already state.** The population is PBS's
 * own figure, read off `statistics.json`; this module only decides which of four bands it falls in
 * and what colour that band is. The development composite is baked at build time instead because it
 * is a *number this project defines* and because D1's boundary is cut at it — neither is true of a
 * banding, and no boundary anywhere in the app is drawn from these four cuts.
 *
 * There are two outcomes, and the second is an absence that must not read as a low figure:
 *
 * - `band` — the census published a population for the district, and it falls in one of four bands.
 * - `no-data` — PBS published no row at all. Azad Jammu & Kashmir's ten districts and
 *   Gilgit-Baltistan's ten (D25). Rendered by taking no fill, so the unshaded baseline shows
 *   through. Never the lowest band, which would put twenty districts on the map as the emptiest
 *   ground in Pakistan on the strength of a question nobody asked there.
 *
 * There is no `no-dominant` here, for the reason there is none under Development: a published
 * population always has a value, where a dominant mother tongue is an answer the census can fail to
 * name.
 */

import type { CensusStatistics } from '../bundle.ts';
import { groupDigits } from './figures.ts';
import { NO_DATA, type DistrictFill, type LegendEntry } from './fill.ts';
import { POPULATION_BAND_FILL } from './palette.ts';

/**
 * The four bands, lowest first — half-open, `from` inclusive and `to` exclusive, so every
 * population lands in exactly one and the boundary figure itself is not quietly in both.
 *
 * Exported because the palette test re-derives its claims from the ids here rather than from a
 * literal of its own: a fifth band added without a colour would render as an absence, which is the
 * map saying "not counted" about a district PBS published in full.
 */
export const POPULATION_BANDS = [
  { id: 'under-500k', from: 0, to: 500_000, label: 'Under 500,000' },
  { id: '500k-1.5m', from: 500_000, to: 1_500_000, label: '500,000 – 1,500,000' },
  { id: '1.5m-3m', from: 1_500_000, to: 3_000_000, label: '1,500,000 – 3,000,000' },
  { id: '3m-plus', from: 3_000_000, to: Infinity, label: '3,000,000 and above' },
] as const;

/** Which band a published population falls in. Refuses by name rather than clamping. */
export function bandOf(population: number, saidOf: string): (typeof POPULATION_BANDS)[number] {
  const band = POPULATION_BANDS.find((b) => population >= b.from && population < b.to);
  if (band === undefined) {
    // Reachable only on a negative population — which is not a census figure, and is worth failing
    // over rather than painting: the lowest band standing in for a nonsense number is how a broken
    // join comes to look like a sparsely populated district.
    throw new Error(
      `${saidOf} has a population of ${population}, which falls in none of the ` +
        `${POPULATION_BANDS.length} bands. The bands cover every figure from zero upward; a ` +
        `population outside them is a broken join, not a district to be shaded.`,
    );
  }
  return band;
}

/**
 * What one band is painted and called — resolved in one place and refusing in one place, exactly
 * as `bandPaint` is for the development ramp and for its reason: the fill, the legend and the
 * export band all need both halves, and a lookup that fails in only one of them renders an empty
 * swatch beside a map that threw. `saidOf` is what the failure names, so the message says which
 * surface asked.
 */
export function populationPaint(band: string, saidOf: string): { colour: string; label: string } {
  const colour = POPULATION_BAND_FILL[band];
  const label = POPULATION_BANDS.find((b) => b.id === band)?.label;
  if (colour === undefined || label === undefined) {
    throw new Error(
      `${saidOf} falls in the population band "${band}", which ` +
        `${colour === undefined ? 'the palette has no colour for' : 'this module does not name'}. ` +
        `The ramp must cover every one of the ${POPULATION_BANDS.length} bands, because a band ` +
        `with no colour would render as an absence — the map saying "not counted" about a ` +
        `district PBS published in full — and a band with no label would key the legend with an id.`,
    );
  }
  return { colour, label };
}

/** Every district the census reaches, keyed exactly as the geometry names it. */
export function populationFills(statistics: CensusStatistics): Map<string, DistrictFill> {
  const fills = new Map<string, DistrictFill>();

  for (const [name, record] of Object.entries(statistics.districts)) {
    const band = bandOf(record.population, name);
    const { colour, label } = populationPaint(band.id, name);
    fills.set(name, { kind: 'band', band: band.id, label, colour });
  }

  // The twenty the census does not reach (D25). Set after, and unconditionally, so a district that
  // somehow appeared in both is an absence rather than a figure.
  for (const name of statistics.withoutCensusData.districts) fills.set(name, NO_DATA);

  return fills;
}

export interface PopulationLegend {
  /**
   * What the on-paper key is headed with — the *fill*, not the basis. Every other surface names
   * the basis, because the basis is what a reader selected; the key in the frame's corner is
   * beside the colours themselves, where the useful thing to say is which figure they are.
   */
  readonly heading: string;
  /** What the shading is, in one line, above the swatches — and whose figure it is. */
  readonly lead: string;
  /** The four bands, lowest first — the order the scale is read in. */
  readonly bands: readonly LegendEntry[];
  /** The one absence this basis has. */
  readonly absences: readonly LegendEntry[];
}

/**
 * Derived from the artifact, never typed: how many districts fall in each band is a property of the
 * census, and a legend that counted them by hand would be a second figure to keep honest.
 *
 * A band no district falls in is still keyed, with the fact said out loud — the development
 * legend's rule and for its reason: four bands are an ordered scale, and dropping one out of the
 * middle would make the ramp read as three even steps.
 */
export function populationLegend(statistics: CensusStatistics): PopulationLegend {
  const fills = populationFills(statistics);
  const counts = new Map<string, number>();
  for (const fill of fills.values()) {
    if (fill.kind === 'band') counts.set(fill.band, (counts.get(fill.band) ?? 0) + 1);
  }

  const counted = Object.entries(statistics.districts).map(([district, record]) => ({
    district,
    population: record.population,
  }));
  const ordered = [...counted].sort((a, b) => a.population - b.population);
  const [lowest, highest] = [ordered[0], ordered[ordered.length - 1]];

  return {
    heading: 'Population distribution',
    lead:
      `District population — ${counted.length} districts, from ${lowest?.district ?? '—'} at ` +
      `${groupDigits(lowest?.population ?? 0)} to ${highest?.district ?? '—'} at ` +
      `${groupDigits(highest?.population ?? 0)}. PBS Census-2023 Table 1, as published: the ` +
      `count, not a density and not a rate.`,
    bands: POPULATION_BANDS.map((band) => {
      const count = counts.get(band.id) ?? 0;
      return {
        label:
          count === 0 ? `${band.label} — no district falls in this band` : `${band.label} (${count})`,
        // Through the same lookup the fill uses, so a band the ramp cannot paint fails here as
        // loudly as it does on the map. A blank swatch keys nothing and says so to nobody.
        swatch: { kind: 'colour', colour: populationPaint(band.id, `the legend's ${band.label}`).colour },
      };
    }),
    absences: [
      {
        label: 'No census data, not shaded — Azad Jammu & Kashmir, Gilgit-Baltistan',
        swatch: { kind: 'hatch' },
      },
    ],
  };
}
