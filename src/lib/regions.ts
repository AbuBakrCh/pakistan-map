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
 * Two rules it inherits rather than invents. The **standing words are not written here at all** —
 * a current unit's comes from `describeKind` and a proposed one's from `UNIT_STANDING`, both next
 * door, because a reader who hovers a district and then reads this list must not be given two
 * different words for one constitutional fact, and two copies of a string drift the first time one
 * is edited. And a unit is *said* to be unchanged rather than left to inference, for the reason the
 * tooltip says it: the map looks identical either way.
 */

import { describeKind, type ProvinceKind } from './geography.ts';
import { UNIT_STANDING } from './tooltip.ts';
import type { UnitKind } from '../bundle.ts';

/** One region, named and placed in its constitutional standing. */
export interface Region {
  readonly name: string;
  readonly standing: string;
  /**
   * The two joined, as the list actually reads them out.
   *
   * Composed here rather than in the renderer, for the reason `panel.ts` composes no sentence of
   * its own: the dash is wording, and wording is decided where it can be tested. One item rather
   * than two, so a reader stepping the list is never handed a name whose standing arrives
   * separately.
   */
  readonly spoken: string;
}

const spoken = (name: string, standing: string): string => `${name} — ${standing}`;

export interface RegionRoster {
  /** What the list is, said before it — a heading, not a caption. */
  readonly heading: string;
  readonly items: readonly Region[];
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
      items: units.map((unit) => ({
        name: unit.name,
        standing: UNIT_STANDING[unit.kind],
        spoken: spoken(unit.name, UNIT_STANDING[unit.kind]),
      })),
    };
  }
  return {
    heading: 'The provinces and territories on this map',
    items: provinces.map((province) => ({
      name: province.name,
      standing: describeKind(province.kind).status,
      spoken: spoken(province.name, describeKind(province.kind).status),
    })),
  };
}
