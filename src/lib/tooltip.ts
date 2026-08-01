/**
 * What the hover tooltip says about a district, and where it sits (#13).
 *
 * Both halves are here rather than in the renderer because both are decisions, and `src/map.ts`
 * carries no tests. What the tooltip *says* is the more consequential of the two: a district
 * either has a figure, or it has an absence, and this app has two different absences that must
 * not be flattened into one grey "N/A" —
 *
 * - **counted, and the census names a dominant tongue.** Population and language, both exact.
 * - **counted, and the census names none.** Chitral: Khowar has no column in Table 11, so the
 *   residual holds the district. The population is still published and is still shown — the
 *   absence is in one column, not in the district. The language line says the census names none
 *   and quotes that district's own residual. It never prints `Others`: a residual is not a
 *   language, and printing the largest *named* category instead would put "Urdu" over a district
 *   where 150 people in 195,161 speak it.
 * - **never counted.** AJK's ten districts and GB's ten (D25). No figures at all — not a zero,
 *   not a blank — and a line saying the census does not cover them, so the absence reads as
 *   coverage rather than as data that failed to load.
 *
 * The province a district sits in decides only its *standing*; whether it has figures is decided
 * by whether the artifact has a row for it, which is the question actually being asked.
 */

import type { CensusStatistics } from '../bundle.ts';
import { describeKind, type DistrictProperties, type ProvinceKind } from './geography.ts';

/**
 * The population badge. Typed here rather than lifted from the artifact's provenance block,
 * which carries the full citation with its URL — too long for a tooltip and wrong to truncate
 * mechanically. The suite checks this short form against that block, so the two cannot drift.
 */
const POPULATION_SOURCE = 'PBS 2023 Digital Census';

/** One line of the tooltip. `value` is null when the census filed no answer — never `0`, never `''`. */
export interface TooltipFigure {
  readonly label: string;
  readonly value: string | null;
  /** The share, the universe, or the reason there is no value. */
  readonly note: string | null;
  /** No unsourced surface anywhere, tooltips included. The two figures come from two releases. */
  readonly source: string | null;
}

export interface DistrictTooltip {
  readonly name: string;
  /**
   * The district's name in Urdu, when the bundle carries one.
   *
   * Read, never invented. OSM holds `name:ur` on 155 of the 156 drawn district relations, but
   * `normalize-geometry.ts` does not carry it into the bundle today, so this is null everywhere
   * and the tooltip sets no Urdu line at all. Transliterating one here would be this app's only
   * unsourced surface.
   */
  readonly nameUrdu: string | null;
  readonly division: string;
  readonly province: string;
  /** Province, capital territory, or territory-and-not-a-province (D12). */
  readonly standing: string;
  readonly coverage: 'counted' | 'not-counted';
  readonly figures: readonly TooltipFigure[];
  /** Why there are no figures. Set only when there are none. */
  readonly absence: string | null;
}

/** What the tooltip needs off the geometry. The Urdu name is optional because the bundle has none. */
export type TooltipDistrict = DistrictProperties & { readonly nameUrdu?: string | null };

const grouped = (value: number): string => value.toLocaleString('en-GB');
const percent = (share: number): string => `${(share * 100).toFixed(1)}%`;

export function districtTooltip(
  district: TooltipDistrict,
  kind: ProvinceKind,
  statistics: CensusStatistics,
): DistrictTooltip {
  const { status, coverage } = describeKind(kind);
  const record = statistics.districts[district.name];
  const common = {
    name: district.name,
    nameUrdu: district.nameUrdu ?? null,
    division: district.division,
    province: district.province,
    standing: status,
  } as const;

  if (record === undefined) {
    return {
      ...common,
      coverage: 'not-counted',
      figures: [],
      // A territory says it in its own words (D25). Anything else the artifact leaves out gets
      // the plain statement rather than an invented reason.
      absence:
        coverage ??
        'PBS published no 2023 census row for this district, so no figures are shown. ' +
          'Absent, not zero.',
    };
  }

  const tongue = record.motherTongue;
  const language: TooltipFigure =
    tongue.dominant === null || tongue.dominantShare === null
      ? {
          label: 'Dominant mother tongue',
          value: null,
          note:
            `The census names none: ${percent(tongue.residualShare)} of those counted fall under ` +
            `${statistics.motherTongue.residualCategory}, which is a residual and not a language.`,
          source: motherTongueSource(statistics),
        }
      : {
          label: 'Dominant mother tongue',
          value: tongue.dominant,
          // Against Table 11's own universe, not the district's population: the two differ, and
          // a share quoted against the wrong denominator is a wrong share.
          note: `${percent(tongue.dominantShare)} of the ${grouped(tongue.counted)} the census counted`,
          source: motherTongueSource(statistics),
        };

  return {
    ...common,
    coverage: 'counted',
    figures: [
      {
        label: 'Population',
        value: grouped(record.population),
        note: null,
        source: POPULATION_SOURCE,
      },
      language,
    ],
    absence: null,
  };
}

/** The table, without the sentence describing it — the artifact's own citation, shortened at its dash. */
const motherTongueSource = (statistics: CensusStatistics): string =>
  statistics.motherTongue.source.split(' — ')[0] ?? statistics.motherTongue.source;

export interface Box {
  readonly width: number;
  readonly height: number;
}

export interface Placement {
  readonly x: number;
  readonly y: number;
  readonly flippedX: boolean;
  readonly flippedY: boolean;
}

export interface PlacementOptions {
  /** Clearance between the pointer and the box, so the tooltip never sits under the cursor. */
  readonly gap?: number;
  /** Clearance between the box and the frame's edge. */
  readonly margin?: number;
}

/**
 * Where the tooltip goes, in the frame's own coordinates.
 *
 * Below and to the right of the pointer by default — the reading direction — flipping to the
 * other side of the pointer rather than sliding along the edge, because a box that slides ends
 * up under the cursor it is describing. The clamp after the flip is what a tooltip wider than
 * the frame needs: at the 390px bar a wide box has no side to sit on, and clamped to the margin
 * is legible where placed off-screen is a tooltip that does not exist.
 */
export function placeTooltip(
  pointer: readonly [number, number],
  size: Box,
  bounds: Box,
  { gap = 12, margin = 8 }: PlacementOptions = {},
): Placement {
  const axis = (at: number, extent: number, limit: number) => {
    let value = at + gap;
    const flipped = value + extent > limit - margin;
    if (flipped) value = at - gap - extent;
    // Order matters: the lower clamp is applied last, so a box too big for the frame lands on
    // the near margin rather than off the far edge.
    return { value: Math.max(margin, Math.min(value, limit - margin - extent)), flipped };
  };

  const x = axis(pointer[0], size.width, bounds.width);
  const y = axis(pointer[1], size.height, bounds.height);
  return { x: x.value, y: y.value, flippedX: x.flipped, flippedY: y.flipped };
}
