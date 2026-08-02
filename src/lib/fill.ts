/**
 * What stratum 1 paints a district with — the vocabulary, shared by the bases that have a fill.
 *
 * Here rather than inside one basis's module because there are two of them now (#31), and the
 * renderer takes whichever the selection hands it. The kinds are deliberately few and deliberately
 * distinct: **fill is data and never unit membership** (D14), and the two absences below are two
 * different absences that must not be painted alike.
 *
 * - `category` — a categorical answer. The language basis's dominant mother tongue.
 * - `band` — an ordered answer: which step of a sequential scale a district falls in. The
 *   development composite. Carries its own label as well as its colour, because a band that is
 *   only a colour is a claim a reader cannot check against the legend without counting swatches.
 * - `no-dominant` — the basis reached the district and could file no answer. Chitral, where Khowar
 *   has no column in Table 11. Drawn as an explicit blank.
 * - `no-data` — the basis never reached the district at all. Azad Jammu & Kashmir's ten and
 *   Gilgit-Baltistan's ten, which PBS published nothing for (D25). Drawn by taking no fill, so the
 *   unshaded baseline shows through.
 *
 * The last two are a question the census asked and could not file, and a question it did not ask
 * here. One grey for both would say the map knows less than it does.
 */

export type DistrictFill =
  | { readonly kind: 'category'; readonly category: string; readonly colour: string }
  | { readonly kind: 'band'; readonly band: string; readonly label: string; readonly colour: string }
  | { readonly kind: 'no-dominant' }
  | { readonly kind: 'no-data' };

export const NO_DOMINANT: DistrictFill = { kind: 'no-dominant' };
export const NO_DATA: DistrictFill = { kind: 'no-data' };

/** One row of a legend: a swatch and the words beside it. Identity is never colour alone. */
export interface LegendEntry {
  readonly label: string;
  readonly swatch: { kind: 'colour'; colour: string } | { kind: 'stipple' } | { kind: 'hatch' };
}
