/**
 * The map's regions, in words, for a reader who cannot see it (#35).
 *
 * `role="img"` on the SVG means assistive technology never reaches a single path inside it — which
 * is deliberate, and right: 156 unlabelled `<path>` elements announced one by one is not a map, it
 * is noise. But it leaves the graphic with exactly one accessible name for the whole country, and
 * the ticket's requirement is that the *regions* have names.
 *
 * So the regions are named in text instead: the same first-level units the map draws and labels,
 * each with the standing it is drawn with, in a list beside the graphic that is available to a
 * screen reader and not painted. That is the ordinary answer for a complex image — an equivalent,
 * rather than a pantomime of one — and it is a better answer than making 156 paths focusable, which
 * would give a keyboard reader a hundred and fifty-six stops and no way to skip them.
 *
 * Two rules it inherits rather than invents. The **standing words are the tooltip's own**, taken
 * from `describeKind` and from the unit vocabulary, because a reader who hovers a district and then
 * reads this list must not be given two different words for one constitutional fact. And a unit is
 * *said* to be unchanged rather than left to inference, for the reason the tooltip says it: the map
 * looks identical either way.
 */

import { describeKind, type ProvinceKind } from './geography.ts';
import type { UnitKind } from '../bundle.ts';

/** One region, named and placed in its constitutional standing. */
export interface Region {
  readonly name: string;
  readonly standing: string;
}

export interface RegionRoster {
  /** What the list is, said before it — a heading, not a caption. */
  readonly heading: string;
  readonly items: readonly Region[];
}

/**
 * What a unit's kind is, in the words the tooltip already uses for it.
 *
 * `unchanged` is spelled out rather than left blank, and `territory` keeps its constitutional
 * qualification inside a proposal exactly as it does outside one: a variant that carries AJK
 * through has not made it a province, and a list that dropped the qualification here would say it
 * had.
 */
function unitStanding(kind: UnitKind): string {
  switch (kind) {
    case 'proposed':
      return 'Proposed province — not official';
    case 'territory':
      return 'Territory, unchanged — not constitutionally a province';
    default:
      return 'Unchanged from the current map';
  }
}

/**
 * The regions on screen: the current first-level units, or the active variant's.
 *
 * Units *replace* provinces here as they do on the map (#18) rather than joining them, or a reader
 * would be given "Sindh" twice — once as a province and once as a unit that is the same province
 * carried through — and left to work out whether that is one place or two.
 */
export function regionRoster(
  provinces: readonly { readonly name: string; readonly kind: ProvinceKind }[],
  units: readonly { readonly name: string; readonly kind: UnitKind }[] | null,
): RegionRoster {
  if (units !== null) {
    return {
      heading: 'The units this proposal draws',
      items: units.map((unit) => ({ name: unit.name, standing: unitStanding(unit.kind) })),
    };
  }
  return {
    heading: 'The provinces and territories on this map',
    items: provinces.map((province) => ({
      name: province.name,
      standing: describeKind(province.kind).status,
    })),
  };
}
