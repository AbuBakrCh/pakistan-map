/**
 * Stratum 1 for the language basis: what each drawn district is filled with.
 *
 * Pure, and takes the statistics artifact as an argument rather than importing it, for the same
 * reason `geography.ts` takes the topology: the decision in here — which of three treatments a
 * district gets — is worth testing against the real bundle *and* against a hand-made one.
 *
 * There are three outcomes, and collapsing any two of them would publish a false claim:
 *
 * - `category` — the census names a dominant mother tongue. Filled with that category's colour.
 * - `no-dominant` — the census counted the district and names *no* dominant tongue, because the
 *   language most of it speaks has no column in Table 11. Chitral, and only Chitral: Khowar is
 *   unpublished, so `Others` holds 99.8% of Upper Chitral. Rendered as an explicit blank, never
 *   as `Others` (a residual is not a language) and never as a grey that would read as a
 *   sixteenth category.
 * - `no-data` — PBS published no row at all. AJK's ten districts and GB's ten (D25). Rendered by
 *   taking no fill, so the unshaded baseline shows through: the basis does not reach them.
 *
 * The last two are different absences and must not look alike. `no-dominant` is a question the
 * census asked and got an answer it could not file; `no-data` is a question it never asked here.
 */

import type { CensusStatistics } from '../bundle.ts';
import { motherTongueFill, type MotherTongue } from './palette.ts';

export type DistrictFill =
  | { readonly kind: 'category'; readonly category: MotherTongue; readonly colour: string }
  | { readonly kind: 'no-dominant' }
  | { readonly kind: 'no-data' };

export const NO_DOMINANT: DistrictFill = { kind: 'no-dominant' };
export const NO_DATA: DistrictFill = { kind: 'no-data' };

/**
 * Every district the bundle knows about, keyed exactly as the geometry names it.
 *
 * Throws on a dominant category the palette has no colour for, rather than falling back to a
 * neutral. A silent fallback is how a district comes to be shaded as "no answer" when the census
 * gave one — the display-side twin of the build failing on an unknown language column.
 */
export function motherTongueFills(statistics: CensusStatistics): Map<string, DistrictFill> {
  const fills = new Map<string, DistrictFill>();

  for (const [name, record] of Object.entries(statistics.districts)) {
    const dominant = record.motherTongue.dominant;
    if (dominant === null) {
      fills.set(name, NO_DOMINANT);
      continue;
    }
    const colour = motherTongueFill[dominant as MotherTongue] as string | undefined;
    if (colour === undefined) {
      throw new Error(
        `${name}'s dominant mother tongue is "${dominant}", which the palette has no colour for. ` +
          `PBS Table 11 publishes ${statistics.motherTongue.categories.length} categories; the ` +
          `palette must cover every one of them.`,
      );
    }
    fills.set(name, { kind: 'category', category: dominant as MotherTongue, colour });
  }

  for (const name of statistics.withoutCensusData.districts) fills.set(name, NO_DATA);

  return fills;
}

export interface LegendEntry {
  readonly label: string;
  readonly swatch: { kind: 'colour'; colour: string } | { kind: 'stipple' } | { kind: 'hatch' };
}

export interface Legend {
  /** The categories some district is actually shaded by, in the census's own order. */
  readonly onTheMap: readonly LegendEntry[];
  /**
   * Categories PBS names that are dominant in no district — so they have a colour and never
   * wear it. Grouped in the legend, **not** merged in the data: whether Kalasha or Balti belongs
   * with a bigger neighbour is exactly the argument this app declines to settle. Grouping them
   * is also what keeps the legend readable: fifteen swatches in one row is past the number a
   * reader can hold, and these six are the six that never need matching to the map.
   */
  readonly namedButNowhereDominant: readonly LegendEntry[];
  /** The two absences, which are different absences and are drawn differently. */
  readonly absences: readonly LegendEntry[];
}

/**
 * Derived from the artifact, never typed: which categories appear is a property of the census,
 * and a legend listing a colour the map does not use — or omitting one it does — is the kind of
 * quiet wrongness that survives review.
 */
export function motherTongueLegend(statistics: CensusStatistics): Legend {
  const fills = motherTongueFills(statistics);
  const drawn = new Set(
    [...fills.values()].flatMap((f) => (f.kind === 'category' ? [f.category] : [])),
  );
  // `Others` is in the group for a different reason from the other five: they are dominant
  // nowhere as a matter of fact, it is dominant nowhere as a matter of definition — a residual
  // cannot win a dominance, and the say-so is the pipeline's. The label says which.
  const entry = (category: string): LegendEntry => ({
    label:
      category === statistics.motherTongue.residualCategory
        ? `${category} — a residual, not a language`
        : category,
    swatch: { kind: 'colour', colour: motherTongueFill[category as MotherTongue] as string },
  });

  const unnamed = statistics.motherTongue.districtsWithoutNamedDominant.map((d) => d.district);

  return {
    onTheMap: statistics.motherTongue.categories.filter((c) => drawn.has(c as MotherTongue)).map(entry),
    namedButNowhereDominant: statistics.motherTongue.categories
      .filter((c) => !drawn.has(c as MotherTongue))
      .map(entry),
    absences: [
      {
        label: `Census names no dominant language — ${unnamed.join(', ')}`,
        swatch: { kind: 'stipple' },
      },
      {
        label: 'No census data, not shaded — Azad Jammu & Kashmir, Gilgit-Baltistan',
        swatch: { kind: 'hatch' },
      },
    ],
  };
}
