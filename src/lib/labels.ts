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
 * Only forms the units use for themselves are here. **Nothing is invented**: a shortening this app
 * made up would be a name no source uses, and a unit with no attested short form keeps its full
 * name and takes the overflow instead — which is a real cost and not a hypothetical one. H3's
 * *Northern Areas* has no attested initialism, so at 390px it keeps its full name, loses the
 * layout, and goes unnamed; that is stated in the suite by name rather than papered over with a
 * coinage. The expansions are printed under the map.
 */
const SHORT_FORMS: Readonly<Record<string, string>> = {
  'Azad Jammu & Kashmir': 'AJK',
  /*
   * Gilgit-Baltistan. Added for the 390px bar (#34), where it is not a nicety: fifteen characters
   * set at province size is far wider than the ground it names on a phone, so the layout dropped
   * the name entirely — and a territory drawn but *anonymous* is exactly the failure the
   * politically sensitive rendering section exists to prevent. AJK, whose full name is longer
   * still, kept its place only because it had an abbreviation to fall back to.
   *
   * **The weakest-sourced entry here, and it is flagged rather than dressed up.** The other four
   * name a publishing agency — AJK is the AJK Bureau of Statistics' own initialism, ICT and KP are
   * PBS's, and NWFP and FATA are the forms those units were administered under and the ones the
   * GADM-derived sets D2/D3 rejects still carry. "GB" is in general use by the territory's own
   * government and assembly, but this project has not yet checked it against a published document
   * the way `docs/research/ajk-district-set.md` checked AJK's district names. It is open item 5,
   * and it is here rather than absent because the alternative is leaving the territory unnamed,
   * which breaks a harder rule than this one.
   */
  'Gilgit-Baltistan': 'GB',
  'Islamabad Capital Territory': 'ICT',
  'Khyber Pakhtunkhwa': 'KP',
  /*
   * The two units H3 draws that no longer exist, at the forms they were administered under — the
   * same forms the GADM-derived sets D2/D3 rejects still print, which is where this project has
   * them attested. Without these, H3 was three units short of a full set of names at 390px.
   */
  'North-West Frontier Province': 'NWFP',
  'Federally Administered Tribal Areas': 'FATA',
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

export type LabelTier = 'unit' | 'province' | 'city' | 'division' | 'district';

/**
 * The zoom at which district names start being offered to the layout (#34).
 *
 * Districts are the building block every proposal is stated in (D23), not a tier the base map
 * draws: 156 names over a 369px phone frame is not a map, it is a word search. So they are the one
 * tier with a threshold — below it they are not laid out at all, and a reader gets a district by
 * **tapping** it, which answers with the name, its division, its province, its population and its
 * dominant mother tongue rather than with a name alone. Above it there is room for the names to
 * mean something, and they come in under every other tier.
 *
 * 6x rather than the 4x the district *lines* appear at: a line only has to be seen, a name has to
 * be read, and at 4x the smaller districts of central Punjab are still too close together to take
 * one.
 */
export const DISTRICT_LABEL_ZOOM = 6;

/**
 * District names, ranked beneath everything else on the map.
 *
 * The floor is negative, which is what keeps them there: every other tier's floor is zero or
 * above and `geoArea` is a fraction of the sphere, so no district can climb past a division however
 * large it is. A district name is the first thing to give way in a crowded frame, and at this zoom
 * the frame is not crowded by anything else.
 */
export const districtLabelSites = (districts: readonly Shape[]): LabelSite[] =>
  sitesOf(districts, 'district', -10);

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
  { divisions = true }: TierOptions = {},
): LabelSite[] {
  return [
    ...sitesOf(geography.provinces.features, 'province', 10),
    ...citySites(cities),
    ...(divisions ? divisionSites(geography, cities) : []),
  ];
}

/**
 * Which optional tiers the map is currently drawing.
 *
 * One entry: the division tier, which the reader turns on and off from the map frame. It is a
 * property of what the reader has asked to see and not of the selection, so it is passed in here
 * rather than carried on a variant — and it is the *whole* tier that goes, lines and names
 * together, because a division name floating over ground with no division boundary under it names
 * a shape the map is no longer drawing.
 *
 * Defaulting to `true` is deliberate: this function's answer is "every name the map can offer",
 * and a caller that has said nothing about the divisions has not asked for them to be withheld.
 * The renderer says so explicitly, in both directions.
 */
export interface TierOptions {
  readonly divisions?: boolean;
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
 *
 * Within the tier there are two floors rather than one, so that the two territories are not ranked
 * last by the very thing that makes them hard to name. See `TERRITORY_FLOOR`.
 */
export function variantLabelSites(
  geography: { divisions: { features: readonly Shape[] } },
  units: readonly Shape[],
  cities: readonly CitySite[] = [],
  { divisions = true }: TierOptions = {},
): LabelSite[] {
  return [
    ...unitSites(units),
    ...citySites(cities),
    ...(divisions ? divisionSites(geography, cities) : []),
  ];
}

/**
 * The unit tier's two floors, and why it needs two where every other tier needs one.
 *
 * Ranking inside a tier is by ground covered, for the reason the divisions are ranked that way:
 * where two names want the same few pixels, the larger shape has more of the map to be confusing
 * about. Applied to the units without exception, that rule is backwards for exactly the units it
 * can least afford to be backwards for. Azad Jammu & Kashmir and Gilgit-Baltistan are the smallest
 * first-level ground on this map after ICT, so ranking on area puts the two names this app is
 * least free to drop at the bottom of the tier — and the politically sensitive rendering section
 * requires both drawn **and named**, because a territory drawn and anonymous says something about
 * Pakistan-administered ground that nobody here decided to say. A division that gives way is a
 * degraded base map and comes back on the first zoom step; a territory that gives way is a claim.
 *
 * At the baseline the tiers already did this work — a territory is a province-tier name and the
 * provinces outrank the cities and the divisions outright — so the failure appeared only under a
 * variant, and only under one crowded enough for the units to start evicting each other. #28's
 * rule-drawn partitions are the first that are: A2 and A3 draw fourteen and sixteen units, and at
 * 390px Rawalpindi's name — 103px of type over 42px of ground — took the corner AJK's own 31px
 * name fits in.
 *
 * A territory is recognised by **the kind the bundle records**, never by its name. H3 calls
 * Gilgit-Baltistan the *Northern Areas*, and a rule that read names would stop protecting the
 * territory the moment a variant renamed one — which is the exact failure #34's review found in
 * the criterion it was asserting.
 *
 * Two things this does not buy, both stated because both are real. It cannot rescue a name **wider
 * than the paper left beside it**: H3's *Northern Areas* is 145px set at an anchor 71px from the
 * right edge, so it runs off the frame at any priority, and it is unnameable at the bar for a
 * reason no ranking touches. And it is not free — A1 already named AJK by nudging it clear, and
 * giving it the corner outright is what puts *Rawalpindi* off that variant's map. That price is
 * named in the suite rather than absorbed into a count.
 *
 * A5 is the deliberate exception. Its two units are AJK and GB **promoted** — argued as provinces,
 * recorded as `proposed`, and ranked as the proposals they are, which is what a promotion is. It
 * draws seven units and names all seven, and that it does is asserted per variant rather than
 * assumed here.
 */
const UNIT_FLOOR = 20;
const TERRITORY_FLOOR = 21;

const unitSites = (units: readonly Shape[]): LabelSite[] =>
  units.map((f) => {
    const { name, kind } = f.properties as { name: string; kind?: string };
    return {
      key: labelKey('unit', name),
      text: name,
      tier: 'unit' as const,
      anchor: labelAnchor(f),
      priority: (kind === 'territory' ? TERRITORY_FLOOR : UNIT_FLOOR) + geoArea(f as never),
    };
  });

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
 * The divisions — including the six named after a city already on the map, which say so.
 *
 * Almost every provincial capital shares its name with the division it administers: Karachi,
 * Lahore, Peshawar, Quetta, Gilgit and Muzaffarabad are six of the seven. Drawing both as the
 * bare word would set it twice within one division, once on a dot and once floating in the ground
 * around it, and a reader cannot tell which of the two things is being named. Dropping the
 * division name instead costs the default view the administrative structure it exists to show.
 *
 * So the division keeps its name and is qualified: **Lahore Division** beside **Lahore**. That is
 * the unit's own full official style rather than something invented here, which is why it can be
 * set without inventing a source — and it is applied *only* where the collision is real, because
 * a map that suffixed all 37 would be shouting a distinction that matters six times.
 *
 * What happens when there is no room for both is not decided here. The dot already outranks the
 * division (`citySites`), and `layoutLabels` drops what does not fit and is recomputed on every
 * zoom — so the city wins the crowded frame, and the qualified division name reappears as soon as
 * zooming makes room. One mechanism, not a second one bolted alongside.
 *
 * ICT's pseudo-division is still skipped, for its own unrelated reason — see `baselineLabelSites`.
 */
const DIVISION_SUFFIX = ' Division';

const divisionSites = (
  geography: { divisions: { features: readonly Shape[] } },
  cities: readonly CitySite[],
): LabelSite[] => {
  const named = new Set(cities.map((city) => city.name));
  return geography.divisions.features
    .filter((f) => (f.properties as { pseudo?: boolean }).pseudo !== true)
    .map((f) => {
      const name = (f.properties as { name: string }).name;
      return {
        // Keyed on the division's own name, never on the qualified text. The key is what the
        // renderer looks a shape's width up by; keying it on what happens to be drawn would mean
        // the six that collide silently miss that lookup and lose their width data.
        key: labelKey('division', name),
        text: named.has(name) ? `${name}${DIVISION_SUFFIX}` : name,
        tier: 'division' as const,
        anchor: labelAnchor(f),
        priority: geoArea(f as never),
      };
    });
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
  /**
   * Ground already spoken for by something that is not a label, in the same screen px.
   *
   * One caller today: the tooltip, which on a phone docks to the top of the frame rather than
   * following a finger that is standing on the district it describes (#33). Docked, it is an
   * opaque bar across northern Pakistan — over Gilgit-Baltistan, Azad Kashmir and the ceasefire
   * line's own name — and the layout cannot see it, so without this the four-step yielding order
   * would be bypassed by an element outside its scoring and a reader would lose both the box and
   * the name underneath it. Seeded into `taken`, the bar simply joins the contest: names nudge out
   * from under it, or give way, exactly as they do for each other.
   */
  readonly occupied?: readonly Rect[];
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
  { bounds, gap, nudges = DEFAULT_NUDGES, occupied = [] }: LayoutOptions,
): PlacedLabel[] {
  const order = [...labels].sort(
    (a, b) => b.priority - a.priority || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );

  // Seeded, not empty: whatever is already on the frame outranks every name, because it is not
  // competing for the ground — it is on it.
  const taken: Rect[] = [...occupied];
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
