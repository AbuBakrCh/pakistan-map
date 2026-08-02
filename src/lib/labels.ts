/**
 * Where a name goes, and which names survive when they collide.
 *
 * Two separable problems, kept separate. *Anchoring* is geography — a point on the ground that
 * belongs to the thing being named. *Layout* is typography — 37 division names over one country,
 * most of them clustered in Punjab, and a map whose labels overlap is worse than one that names
 * fewer things.
 */

import { geoArea, geoBounds, geoCentroid, geoContains } from 'd3';
import type { Feature, MultiPolygon, Polygon } from 'geojson';

type Shape = Feature<Polygon | MultiPolygon, unknown>;

const polygonsOf = (shape: Shape): Polygon[] =>
  shape.geometry.type === 'Polygon'
    ? [shape.geometry]
    : shape.geometry.coordinates.map((coordinates) => ({ type: 'Polygon', coordinates }));

/** Grid resolution of the interior search. 24×24 over the bbox resolves Pakistan's thinnest arm. */
const SEARCH_STEPS = 24;

/**
 * A point on the ground that the label can honestly point at.
 *
 * The centroid answers this for almost every shape, and is used where it does. It fails on a
 * crescent — Muzaffarabad wraps around Poonch, so its centroid lands in Poonch, and a label
 * drawn there would name the wrong ground. The fallback is a coarse pole of inaccessibility:
 * sample a grid inside the shape and keep the interior point furthest from any boundary vertex,
 * which is the point with the most room around it for text.
 *
 * Only the largest polygon is considered. A division's name belongs on its mainland, not
 * averaged between the mainland and an island.
 */
export function labelAnchor(shape: Shape): [number, number] {
  const largest = polygonsOf(shape).reduce((biggest, polygon) =>
    geoArea(polygon) > geoArea(biggest) ? polygon : biggest,
  );

  const centroid = geoCentroid(largest) as [number, number];
  if (geoContains(largest, centroid)) return centroid;

  const [[west, south], [east, north]] = geoBounds(largest);
  const vertices = largest.coordinates.flat();
  let best: [number, number] = centroid;
  let bestClearance = -Infinity;

  for (let i = 1; i < SEARCH_STEPS; i++) {
    for (let j = 1; j < SEARCH_STEPS; j++) {
      const point: [number, number] = [
        west + ((east - west) * i) / SEARCH_STEPS,
        south + ((north - south) * j) / SEARCH_STEPS,
      ];
      if (!geoContains(largest, point)) continue;
      let clearance = Infinity;
      for (const vertex of vertices) {
        clearance = Math.min(
          clearance,
          Math.hypot((vertex[0] as number) - point[0], (vertex[1] as number) - point[1]),
        );
      }
      if (clearance > bestClearance) {
        bestClearance = clearance;
        best = point;
      }
    }
  }

  return best;
}

/**
 * Abbreviations to fall back on where a name is wider than the ground it names.
 *
 * Only forms the units use for themselves are here — AJK is the AJK Bureau of Statistics'
 * own initialism, ICT and KP are PBS's. Nothing is invented: a shortening this app made up
 * would be a name no source uses, and a unit with no attested short form keeps its full name
 * and takes the overflow instead. The expansions are printed under the map.
 */
const SHORT_FORMS: Readonly<Record<string, string>> = {
  'Azad Jammu & Kashmir': 'AJK',
  'Islamabad Capital Territory': 'ICT',
  'Khyber Pakhtunkhwa': 'KP',
};

/** The expansions the colophon has to carry, so an abbreviation on the map is never unexplained. */
export const shortFormExpansions: readonly (readonly [string, string])[] = Object.entries(
  SHORT_FORMS,
).map(([full, short]) => [short, full] as const);

/**
 * The text to actually draw: the full name where the shape has room for it, otherwise the unit's
 * own abbreviation. `shapeWidth` is the width of the shape on screen — a name wider than that is
 * lying about which ground it names, not merely crowding its neighbours.
 */
export function labelText(
  name: string,
  shapeWidth: number,
  measure: (text: string) => number,
): string {
  const short = SHORT_FORMS[name];
  return short !== undefined && measure(name) > shapeWidth ? short : name;
}

export type LabelTier = 'unit' | 'province' | 'city' | 'division';

/**
 * What identifies a name across the tiers.
 *
 * Tier-qualified because the tiers collide: Peshawar, Quetta, Lahore and a dozen others name
 * both a division and a district, and Islamabad names a province and a pseudo-division. Built
 * here rather than spelled inline at each site, because a caller that composes the string
 * itself and drifts does not fail — it misses a `Map` lookup and falls back, so abbreviations
 * silently stop firing and the layout silently loses its width data. Nothing goes red.
 */
export const labelKey = (tier: LabelTier, name: string): string => `${tier}:${name}`;

/** A name and the ground it belongs to, before anything is known about the page. */
export interface LabelSite {
  readonly key: string;
  readonly text: string;
  readonly tier: LabelTier;
  /** Anchor in lon/lat, so the site survives zooming and the projection changing under it. */
  readonly anchor: [number, number];
  readonly priority: number;
  /**
   * Where the text sits relative to the anchor, in screen px. Zero for a shape, whose name goes
   * in the middle of it; non-zero for a city, whose anchor is a dot the name must sit *beside*
   * rather than on. Carried on the site rather than applied by the renderer so that the box the
   * layout competes over is the box the page draws, which is the whole reason `measureLabel` is
   * shared between the two.
   */
  readonly offset?: readonly [number, number];
}

/**
 * Every name the baseline map draws, ranked.
 *
 * Provinces outrank divisions unconditionally — a map that has lost "Balochistan" but kept
 * "Kalat" is disorienting in a way the reverse is not. Within a tier, ranking is by ground
 * covered: where two names compete for the same few pixels, the larger shape has more of the
 * map to be confusing about.
 *
 * ICT's division is skipped. It is a pseudo-division injected so the tier covers the country,
 * not a division anyone administers, and drawing its name would put "Islamabad" on the map twice
 * with only one of them sourced.
 *
 * Anchors are geographic and computed once. Reprojecting 43 points on every zoom frame is free;
 * re-running the interior search is not.
 */
export function baselineLabelSites(
  geography: {
    provinces: { features: readonly Shape[] };
    divisions: { features: readonly Shape[] };
  },
  cities: readonly CitySite[] = [],
): LabelSite[] {
  return [
    ...sitesOf(geography.provinces.features, 'province', 10),
    ...citySites(cities),
    ...divisionSites(geography, cities),
  ];
}

/**
 * The names drawn while a variant is active: the units, and the divisions under them.
 *
 * **Units replace the provinces rather than joining them.** Seven of L1's eight units *are*
 * current provinces carried through unchanged, so drawing both tiers would set "Sindh" twice, a
 * few pixels apart, in two colours — and on the one unit that differs it would set the proposal's
 * name beside the name of the province it is being carved out of, which reads as two claims about
 * the same ground rather than as one replacing the other. The faded province *boundaries* stay
 * (stratum 2); it is only the names that hand over.
 *
 * Units outrank everything for the same reason provinces outrank divisions: they are what the
 * screen is about. The floors keep the tiers apart outright — `geoArea` is a fraction of the
 * sphere, well under 1, so no division climbs past a province and no province past a unit.
 */
export function variantLabelSites(
  geography: { divisions: { features: readonly Shape[] } },
  units: readonly Shape[],
  cities: readonly CitySite[] = [],
): LabelSite[] {
  return [...sitesOf(units, 'unit', 20), ...citySites(cities), ...divisionSites(geography, cities)];
}

const sitesOf = (features: readonly Shape[], tier: LabelTier, floor: number): LabelSite[] =>
  features.map((f) => ({
    key: labelKey(tier, (f.properties as { name: string }).name),
    text: (f.properties as { name: string }).name,
    tier,
    anchor: labelAnchor(f),
    priority: floor + geoArea(f as never),
  }));

/** A city dot, before anything is known about the page: a name and the point it stands at. */
export interface CitySite {
  readonly name: string;
  readonly anchor: [number, number];
}

/**
 * How far a city's name sits from its own dot, in px. Below the dot rather than beside it: a name
 * set to one side reads as pointing at whatever is on that side, and half the seven have a border
 * within a few pixels.
 */
export const CITY_LABEL_OFFSET: readonly [number, number] = [0, 9];

/**
 * The dots' names, ranked between the provinces and the divisions.
 *
 * Above the divisions because a dot is a *place* and a division name floats at a centroid: where
 * the two compete for the same few pixels, the one that is exactly where it says it is should
 * win. Below the provinces for the reason provinces already outrank divisions — a map that has
 * lost "Balochistan" and kept "Quetta" is disorienting in a way the reverse is not.
 *
 * They rank equally among themselves, which costs nothing: no two of the seven are within a
 * hundred kilometres of each other, so they never compete, and `layoutLabels` breaks the tie on
 * the key so the same map never renders two ways.
 */
const citySites = (cities: readonly CitySite[]): LabelSite[] =>
  cities.map((city) => ({
    key: labelKey('city', city.name),
    text: city.name,
    tier: 'city' as const,
    anchor: city.anchor,
    priority: 5,
    offset: CITY_LABEL_OFFSET,
  }));

/**
 * The divisions, minus any named after a city that is already on the map.
 *
 * Almost every provincial capital shares its name with the division it administers — Karachi,
 * Lahore, Peshawar, Quetta, Gilgit and Muzaffarabad are all six of them — so drawing both would
 * set the same word twice within one division, once on a dot and once floating in the middle of
 * the ground around it. The name goes to the dot, which is the more precise of the two claims:
 * the division *is* named after the city, and a reader who finds "Quetta" at a dot has learnt
 * where Quetta is, while a reader who finds it at a centroid has learnt neither.
 *
 * The division's boundary is untouched; it is only its name that hands over — the same trade
 * `variantLabelSites` makes between a unit and the province it replaces.
 */
const divisionSites = (
  geography: { divisions: { features: readonly Shape[] } },
  cities: readonly CitySite[],
): LabelSite[] => {
  const named = new Set(cities.map((city) => city.name));
  return sitesOf(
    geography.divisions.features.filter(
      (f) =>
        (f.properties as { pseudo?: boolean }).pseudo !== true &&
        !named.has((f.properties as { name: string }).name),
    ),
    'division',
    0,
  );
};

/** A name measured for the page: anchor in px, the box the text will occupy, and how much it matters. */
export interface LabelBox {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Higher wins a collision. Province names outrank divisions; bigger divisions outrank smaller. */
  readonly priority: number;
}

export interface PlacedLabel {
  readonly key: string;
  readonly x: number;
  readonly y: number;
}

/** How a name is measured on the page. The caller owns the font; this module owns the geometry. */
export type Measurer = (text: string, tier: LabelTier) => {
  readonly width: number;
  readonly height: number;
};

/**
 * Turn a site into the box the layout will compete over, choosing the text along the way.
 *
 * Shared by the renderer and its tests deliberately: the "labels do not overlap" criterion is
 * only worth asserting if the assertion runs over the same boxes the page draws.
 */
export function measureLabel(
  site: LabelSite,
  point: readonly [number, number],
  shapeWidth: number,
  measure: Measurer,
): { box: LabelBox; text: string } {
  const text = labelText(site.text, shapeWidth, (candidate) => measure(candidate, site.tier).width);
  const { width, height } = measure(text, site.tier);
  const [dx, dy] = site.offset ?? [0, 0];
  return {
    box: {
      key: site.key,
      x: point[0] + dx,
      y: point[1] + dy,
      width,
      height,
      priority: site.priority,
    },
    text,
  };
}

export interface LayoutOptions {
  readonly bounds: { readonly width: number; readonly height: number };
  /** Clear space required between two boxes, in px. Below ~2px they read as one word. */
  readonly gap: number;
  /**
   * Displacements to try, in order, when a label's own anchor is taken. Vertical by default:
   * shifting a name sideways slides it toward a neighbouring shape, up or down usually does not.
   */
  readonly nudges?: readonly (readonly [number, number])[];
}

const DEFAULT_NUDGES: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, -1],
  [0, 1],
  [0, -2],
  [0, 2],
];

interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

const overlaps = (a: Rect, b: Rect, gap: number): boolean =>
  a.x0 - gap < b.x1 && b.x0 - gap < a.x1 && a.y0 - gap < b.y1 && b.y0 - gap < a.y1;

/**
 * Place what fits, drop what does not.
 *
 * Greedy by priority, which is the honest algorithm for this: the alternative — displacing
 * everything a little to fit everything in — ends with every name slightly off the ground it
 * describes, and on a map about which district belongs to whom that is worse than a missing
 * name. So a label either sits within a nudge of its own anchor or it is not drawn, and the
 * layout is recomputed as the user zooms, where the extra room brings the dropped names back.
 *
 * Ties break on `key` so the same map never renders two different ways.
 */
export function layoutLabels(
  labels: readonly LabelBox[],
  { bounds, gap, nudges = DEFAULT_NUDGES }: LayoutOptions,
): PlacedLabel[] {
  const order = [...labels].sort(
    (a, b) => b.priority - a.priority || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );

  const taken: Rect[] = [];
  const placed: PlacedLabel[] = [];

  for (const label of order) {
    for (const [dx, dy] of nudges) {
      const x = label.x + dx * (label.height + gap);
      const y = label.y + dy * (label.height + gap);
      const rect: Rect = {
        x0: x - label.width / 2,
        y0: y - label.height / 2,
        x1: x + label.width / 2,
        y1: y + label.height / 2,
      };
      // Off-frame labels are dropped rather than pulled inside: a name dragged back into view
      // sits over ground it does not name. Panning is what brings it back.
      if (rect.x0 < 0 || rect.y0 < 0 || rect.x1 > bounds.width || rect.y1 > bounds.height) continue;
      if (taken.some((other) => overlaps(rect, other, gap))) continue;
      taken.push(rect);
      placed.push({ key: label.key, x, y });
      break;
    }
  }

  return placed;
}
