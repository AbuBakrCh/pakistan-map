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

/**
 * The one polygon a shape's name is measured against: the largest.
 *
 * A division's name belongs on its mainland, not averaged between the mainland and an island —
 * which is why `labelAnchor` has always searched this polygon alone. The room the name has to fit
 * in is asked of the *same* polygon, because a name anchored on the mainland and measured against
 * a bounding box that includes an island would be told it has room the ground under it does not
 * have. Exported so the renderer and the suite project the same ring set.
 */
export function labelPolygon(shape: Shape): Polygon {
  return polygonsOf(shape).reduce((biggest, polygon) =>
    geoArea(polygon) > geoArea(biggest) ? polygon : biggest,
  );
}

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
 *
 * Memoised per shape, and weakly, so a variant's outlines are collected with the variant. The
 * answer is a pure function of geometry that does not move under a zoom or a re-fit; what the
 * cache catches is the caller that asks twice — the division tier is rebuilt on every variant
 * layout, and the interior search below is the most expensive thing in this file.
 */
const anchors = new WeakMap<object, [number, number]>();

export function labelAnchor(shape: Shape): [number, number] {
  const cached = anchors.get(shape);
  if (cached !== undefined) return cached;
  const computed = computeAnchor(shape);
  anchors.set(shape, computed);
  return computed;
}

function computeAnchor(shape: Shape): [number, number] {
  const largest = labelPolygon(shape);
  const vertices = largest.coordinates.flat();
  const clearanceAt = (point: readonly [number, number]): number => {
    let clearance = Infinity;
    for (const vertex of vertices) {
      clearance = Math.min(
        clearance,
        Math.hypot((vertex[0] as number) - point[0], (vertex[1] as number) - point[1]),
      );
    }
    return clearance;
  };

  const centroid = geoCentroid(largest) as [number, number];
  /*
   * Inside is necessary and not sufficient, which took the interior fit to find out.
   *
   * D1's Khuzdar and A4's Killa Abdullah have centroids that `geoContains` answers yes for and
   * that stand a *tenth of a pixel* from their own boundary — a hairline of the polygon left by
   * the dissolve, technically interior and no use to anybody. That was invisible while a name was
   * measured against a bounding box, and it is fatal once the name has to fit the room at the
   * anchor: the room is nil, so the unit's own name is thrown onto a leader or dropped, and the
   * cause is not in the layout at all. So the centroid has to be *comfortable* as well as inside,
   * and where it is not the pole of inaccessibility answers instead — which is the case the search
   * below was written for and which this simply widens from "outside" to "outside or useless".
   *
   * A tenth of the shape's own scale. A disc's centroid clears its boundary by about 0.56 of it,
   * so the bar is low on purpose: this is a guard against degenerate geometry and not an opinion
   * about where a name looks best.
   */
  const comfortable = Math.sqrt(geoArea(largest)) * 0.1;
  if (geoContains(largest, centroid) && clearanceAt(centroid) >= comfortable) return centroid;

  const [[west, south], [east, north]] = geoBounds(largest);
  let best: [number, number] = centroid;
  let bestClearance = -Infinity;

  for (let i = 1; i < SEARCH_STEPS; i++) {
    for (let j = 1; j < SEARCH_STEPS; j++) {
      const point: [number, number] = [
        west + ((east - west) * i) / SEARCH_STEPS,
        south + ((north - south) * j) / SEARCH_STEPS,
      ];
      if (!geoContains(largest, point)) continue;
      const clearance = clearanceAt(point);
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

/** The unit's own attested short form, where it has one. Nothing here is invented. */
export const shortFormOf = (name: string): string | undefined => SHORT_FORMS[name];

/** A point and a ring of them, in screen px — the shape as the page is about to draw it. */
export type Point = readonly [number, number];
export type Ring = readonly Point[];

/**
 * Clear space kept between a name and the boundary of the ground it names, in px.
 *
 * A name that touches its own unit's edge reads as belonging to whatever is on the other side of
 * it, which is the failure this whole pass exists to close: on a map about which district belongs
 * to whom, a name crowding a boundary is a name making a claim nobody wrote. Three px is a hairline
 * plus the casing the outline is drawn with, so the type never meets the line it is set inside.
 */
export const LABEL_CLEARANCE = 3;

/**
 * The room a shape leaves at a point, in screen px.
 *
 * `reach` is the raw distance from the point to the shape's own boundary along each axis, found by
 * casting a ray each way and keeping the nearest crossing — so a hole, a neighbour's bite out of a
 * crescent and the outer edge all stop it alike. `width` and `height` are what a box *centred* on
 * that point may occupy: twice the smaller reach on each axis, less the clearance, which is why a
 * name anchored off-centre in its own ground is measured against the short side rather than the
 * average of the two.
 *
 * A bounding box would have answered a different question and answered it wrongly. Balochistan's
 * box is most of the country; the room at the anchor of a crescent, a coastal strip or one of #28's
 * rule-drawn slivers is a fraction of it, and it is the room the reader actually sees.
 */
export interface Room {
  readonly width: number;
  readonly height: number;
  readonly reach: {
    readonly left: number;
    readonly right: number;
    readonly up: number;
    readonly down: number;
  };
}

/** Nearest boundary crossing each way along one axis of the ray through `at`. */
function crossings(rings: readonly Ring[], at: Point, axis: 0 | 1): [number, number] {
  const along = at[axis];
  const across = at[axis === 0 ? 1 : 0];
  let before = -Infinity;
  let after = Infinity;
  for (const ring of rings) {
    for (let i = 0; i + 1 < ring.length; i++) {
      const p = ring[i] as Point;
      const q = ring[i + 1] as Point;
      const a = p[axis === 0 ? 1 : 0];
      const b = q[axis === 0 ? 1 : 0];
      // Half-open on purpose: a vertex exactly on the ray is counted once, not twice.
      if (a > across === b > across) continue;
      const t = (across - a) / (b - a);
      const hit = p[axis] + t * (q[axis] - p[axis]);
      if (hit <= along) before = Math.max(before, hit);
      else after = Math.min(after, hit);
    }
  }
  return [before, after];
}

/**
 * How far the drawn land reaches left and right along one row, or `null` where that row misses it.
 *
 * The *extreme* crossings rather than the nearest ones, which is what makes this a different
 * question from `crossings`: a callout is looking for the paper beyond the country, and a name
 * stopped at the first inlet of the coast or the first bite of an internal boundary would be set
 * over Pakistan with a gap behind it. So both ends of the row are taken whole, and everything
 * between them — sea inside a bay included — counts as ground the name may not sit on.
 */
export function landSpanAt(rings: readonly Ring[], y: number): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (const ring of rings) {
    for (let i = 0; i + 1 < ring.length; i++) {
      const p = ring[i] as Point;
      const q = ring[i + 1] as Point;
      // Half-open on the same rule the room's rays use: a vertex on the row is counted once.
      if (p[1] > y === q[1] > y) continue;
      const x = p[0] + ((y - p[1]) / (q[1] - p[1])) * (q[0] - p[0]);
      min = Math.min(min, x);
      max = Math.max(max, x);
    }
  }
  return Number.isFinite(min) ? [min, max] : null;
}

/** Even-odd containment against the same rings the room is measured from. */
function contains(rings: readonly Ring[], [x, y]: Point): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0; i + 1 < ring.length; i++) {
      const [px, py] = ring[i] as Point;
      const [qx, qy] = ring[i + 1] as Point;
      if (py > y === qy > y) continue;
      if (x < px + ((y - py) / (qy - py)) * (qx - px)) inside = !inside;
    }
  }
  return inside;
}

/**
 * Whether a box centred here, with this much clearance around it, lies wholly in the shape.
 *
 * The room is measured along two rays and a box has four sides, which is a difference a diagonal
 * boundary can fall through: Sindh, A1's Hyderabad and D1's Quetta each left enough room along both
 * axes at their anchor and still put a *corner* of the name over the province next door. So the
 * room is the fast question and this is the exact one — the perimeter of the box, corners and edge
 * midpoints alike, every point of it inside the same rings.
 */
function boxInside(rings: readonly Ring[], at: Point, width: number, height: number): boolean {
  const halfWidth = width / 2 + LABEL_CLEARANCE;
  const halfHeight = height / 2 + LABEL_CLEARANCE;
  for (const dx of [-1, 0, 1]) {
    for (const dy of [-1, 0, 1]) {
      if (dx === 0 && dy === 0) continue;
      if (!contains(rings, [at[0] + dx * halfWidth, at[1] + dy * halfHeight])) return false;
    }
  }
  return true;
}

/**
 * Grid resolution of the roomiest-point search, and how many of the results are worth trying.
 *
 * Coarser than `SEARCH_STEPS`, which is the anchor's own search and runs once per shape for the
 * life of the app. This one runs per frame for a name that would otherwise be a callout, and each
 * sample costs two ray casts across every segment of the ground — so 11×11 is chosen against that
 * budget rather than against the geometry. It is enough to find a lobe; it is not a precise answer,
 * and it does not need to be, since the ladder is coarse too.
 *
 * Three candidates rather than one because the roomiest point can still fail `boxInside` — the room
 * is two rays and the box has four corners — and the second-roomiest lobe is usually a different
 * part of the shape rather than the pixel next door.
 */
const WIDEST_STEPS = 11;
const WIDEST_CANDIDATES = 3;

/**
 * The roomiest places to write inside a shape, roomiest first.
 *
 * Scored on the **area of the box that would actually fit** — `interiorRoom`'s usable width times
 * its usable height — rather than on distance from the boundary, which is what the anchor's own
 * search maximises. The two are different questions and a lopsided unit answers them differently: a
 * pole of inaccessibility is the point with the most room in *every* direction, and a name is wide
 * and short, so the point that best carries one is very often not it.
 *
 * Every point returned is interior, tested against the same rings the room is measured from.
 */
export function widestInterior(rings: readonly Ring[], steps = WIDEST_STEPS): Point[] {
  let west = Infinity;
  let north = Infinity;
  let east = -Infinity;
  let south = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      west = Math.min(west, x);
      east = Math.max(east, x);
      north = Math.min(north, y);
      south = Math.max(south, y);
    }
  }
  if (!Number.isFinite(west)) return [];

  const scored: { point: Point; score: number }[] = [];
  for (let i = 1; i < steps; i++) {
    for (let j = 1; j < steps; j++) {
      const point: Point = [west + ((east - west) * i) / steps, north + ((south - north) * j) / steps];
      if (!contains(rings, point)) continue;
      const room = interiorRoom(rings, point);
      const score = room.width * room.height;
      if (score <= 0) continue;
      scored.push({ point, score });
    }
  }
  // Ties break on position so the same shape never answers two ways between frames.
  scored.sort((a, b) => b.score - a.score || a.point[0] - b.point[0] || a.point[1] - b.point[1]);
  return scored.slice(0, WIDEST_CANDIDATES).map((entry) => entry.point);
}

export function interiorRoom(rings: readonly Ring[], at: Point): Room {
  const [west, east] = crossings(rings, at, 0);
  const [north, south] = crossings(rings, at, 1);
  const span = (near: number, far: number) =>
    Number.isFinite(near) && Number.isFinite(far) ? Math.abs(far - near) : 0;
  const reach = {
    left: span(west, at[0]),
    right: span(east, at[0]),
    up: span(north, at[1]),
    down: span(south, at[1]),
  };
  const usable = (a: number, b: number) => Math.max(0, 2 * (Math.min(a, b) - LABEL_CLEARANCE));
  return {
    width: usable(reach.left, reach.right),
    height: usable(reach.up, reach.down),
    reach,
  };
}

/**
 * How a name breaks over more than one line: on the bracket, and on nothing else.
 *
 * L7's regions are named `Pushto (Keamari)` and `Balochi (Kech)` — a language and, in brackets, the
 * place that tells one of its two regions from the other. Set on one line the box is as wide as the
 * sum of both; set on two it is as wide as the wider, which on a phone is the difference between a
 * name and no name. Broken *only* at the bracket: hyphenating would coin a spelling no source uses,
 * and wrapping on measurement would break the same name in different places at different zooms, so
 * a reader zooming in would watch a proposal's name reflow.
 */
export function labelLines(text: string): readonly string[] {
  const bracket = text.indexOf(' (');
  if (bracket < 0 || !text.endsWith(')')) return [text];
  return [text.slice(0, bracket), text.slice(bracket + 1)];
}

/**
 * The same name over two lines, broken between words — the atlas answer to a long name on a
 * compact ground, and the reason `Rahim Yar Khan` can be written inside Rahim Yar Khan.
 *
 * A three-word name set on one line is as wide as the sum of its words; set on two it is as wide as
 * the wider half, which on this map is routinely the difference between a name on its own ground
 * and a name out on a line pointing at it. It is offered *after* the name has been tried whole and
 * *before* the unit's attested abbreviation, because keeping the name a reader is looking for is
 * worth more than keeping it on one line, and worth less than nothing invented.
 *
 * **Where it breaks is decided by the text and never by the measurement**, which is the objection
 * `labelLines` records and it is a real one: a name broken wherever the type happened to run out
 * breaks in a different place at every zoom, and a reader watching a proposal's name reflow as they
 * lean in is reading the layout rather than the map. So the split is the one that leaves the two
 * halves closest in length, ties going to the earlier space — a property of the string, identical
 * at every size and on every frame. What may change with zoom is whether the name is set on one
 * line or two, which is the same concession the size ladder and the abbreviation already make.
 *
 * Two lines and never three. Three lines of 6.5px type stacked inside a district is a paragraph,
 * not a label, and the ground that could hold it can hold two lines of something larger.
 */
export function wrappedLines(text: string): readonly string[] {
  // A bracketed name already breaks, and breaking it again would put its own qualifier on a third
  // line. Nothing to wrap in a single word either.
  if (labelLines(text).length > 1) return [text];
  const spaces: number[] = [];
  for (let i = text.indexOf(' '); i >= 0; i = text.indexOf(' ', i + 1)) spaces.push(i);
  if (spaces.length === 0) return [text];
  let best = spaces[0] as number;
  for (const space of spaces) {
    const difference = Math.abs(space - (text.length - space - 1));
    if (difference < Math.abs(best - (text.length - best - 1))) best = space;
  }
  return [text.slice(0, best), text.slice(best + 1)];
}

/**
 * How far a unit's name may be set down to fit its ground, as a fraction of the tier's own size.
 *
 * Bounded at both ends and neither end is arbitrary. It is never set **larger** than the province
 * size, because a unit is set as a province is — told apart by colour, not by scale, since setting
 * a proposal larger than the country would be this app putting the two in an order. And never so
 * small that the name stops being read and becomes a mark: 0.58 of 13px is 7.5px, which is the
 * floor this map will set type at.
 *
 * **The floor used to be the district tier's 8.5px and is not any more**, because that bound was
 * defending a collision that cannot happen. District names are not laid out at all below
 * `DISTRICT_LABEL_ZOOM`, and at 6× a unit has room to spare and is nowhere near the floor — so the
 * two tiers never co-occur at a size where a reader could compare them. What remains is the
 * absolute legibility floor, which is the half of that rule that was ever load-bearing. The gain is
 * ~12% of width, which is a trim rather than a rescue: the names that are badly over their ground
 * are over by multiples, and those go out on a leader.
 *
 * The ladder is coarse rather than continuous. A name that settles at whatever fraction happens to
 * clear its ground puts sixteen sizes of type on one map, and a reader reads that as sixteen tiers.
 */
export const MIN_UNIT_LABEL_SCALE = 0.5;
const SHRINK_LADDER: readonly number[] = [1, 0.88, 0.78, 0.68, 0.58, MIN_UNIT_LABEL_SCALE];

/**
 * The one size every name out on a leader is set at, as a fraction of the tier's own size.
 *
 * A callout used to be set at full size, on the reasoning that outside the shape there is no ground
 * constraining the type and a name shrunk to fit a room it is no longer in is paying twice. That
 * was sound while the floor was 8.6px and callouts were rare. It is not sound now: an in-ground
 * name may be set as small as 7.5px, so a full-size callout would make the **loudest type on the
 * map** belong to the units that fit worst, at nearly twice the size of a name sitting honestly on
 * its own ground. The inversion is the thing a reader actually sees.
 *
 * So the rule is one sentence — *a name on paper is set one step down from a name on its ground* —
 * and it is one size rather than a ladder, because out on the margin there is no ground to explain
 * why one callout is smaller than the next, and varying them is the "sixteen tiers" failure with
 * none of the context that makes it legible on the map.
 *
 * This does bend "told apart by colour, not by scale" (D14). That doctrine is about a unit against
 * a province, and every callout is already marked as the exception by the line attached to it.
 */
export const CALLOUT_SCALE = 0.78;

/**
 * Leading between the lines of a broken name, as a fraction of the size it is set at. Exported so
 * the renderer sets the lines the distance apart the box was measured to be tall.
 */
export const LINE_SPACING = 1.15;

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
  /**
   * Set where the name did not fit inside its own ground at any size this map will set it, so it
   * has to be taken outside the shape and joined back to it on a leader. `from` is the point on the
   * ground the leader starts at, and `reach` is how far the shape runs each way from it, so the
   * name can be set *clear* of the shape rather than merely away from its anchor.
   */
  readonly callout?: {
    readonly from: Point;
    readonly reach: { readonly left: number; readonly right: number };
  };
  /**
   * The ground this name was fitted inside, where it was fitted to one at all.
   *
   * Carried through to `layoutLabels` so that the **nudges** are held to the same rule the fit is.
   * `measureLabel` checks the box against the unit's own rings and then the layout displaces it by
   * up to two label heights to dodge a collision, and until this was carried the second step could
   * undo the first: L7's `Punjabi` was fitted honestly and then nudged 32px, which put both right
   * corners into the province next door. A latent bug rather than a new one — it only began to bite
   * once names started sitting tight inside a lobe instead of loose near a centroid, which is what
   * the roomiest-point search made them do.
   *
   * Absent on a callout, which is outside its ground by construction, and on every tier that is not
   * fitted to an interior — a division name is a caption on a base map and nudges as it always has.
   */
  readonly ground?: readonly Ring[];
  /**
   * Set where this name may **not** be dropped for want of clear paper.
   *
   * A callout is otherwise set outside the drawn country or not at all, because a name laid on some
   * other unit's ground describes ground it does not name. The one obligation that outranks that is
   * the politically sensitive one: Azad Jammu & Kashmir and Gilgit-Baltistan are drawn *and named*,
   * and a territory drawn anonymous is a claim this map is not entitled to make about ground
   * Pakistan administers. So a territory's name keeps the older placement — beside its own unit,
   * wherever that lands — rather than going unset at a size where the paper has nothing to offer.
   *
   * Deliberately a property of the label and not a rule inside the layout: what may not go unnamed
   * is a fact about the *subject*, and the file that knows a unit is a territory is the one that
   * should say so.
   */
  readonly mustName?: boolean;
}

/** A leader: the anchor on the ground, one elbow, and the dot before the first character. */
export interface Leader {
  readonly from: Point;
  readonly elbow: Point;
  readonly to: Point;
}

export interface PlacedLabel {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  /** Present only where the name was taken outside the ground it names. */
  readonly leader?: Leader;
}

/**
 * How a name is measured on the page. The caller owns the font; this module owns the geometry.
 *
 * `scale` is dimensionless and defaults to 1: this module decides *how much* a name has to give
 * way, and the renderer decides what that means in px, because the sizes and the tracking are the
 * stylesheet's. A caller that ignores it measures every candidate at full size and simply never
 * finds a smaller one that fits, which is the old behaviour rather than a wrong answer.
 */
export type Measurer = (
  text: string,
  tier: LabelTier,
  scale?: number,
) => {
  readonly width: number;
  readonly height: number;
};

/** What a name costs the page: the box, the lines it is set on, and the size it is set at. */
export interface MeasuredLabel {
  readonly box: LabelBox;
  /** The whole name, as one string. */
  readonly text: string;
  /** What is actually set, one entry per line — `Balochi (Kech)` breaks on the bracket. */
  readonly lines: readonly string[];
  /** Fraction of the tier's own size the name is set at. 1 wherever it did not have to give way. */
  readonly scale: number;
}

/**
 * The ground a name has to fit inside, and the page it has to fit on.
 *
 * Passed only for the tier that is fitted this way — the units, whose names are the whole of what a
 * variant view says. Every other tier is measured as it always was: a division name is a caption on
 * a base map that is redrawn on every zoom, where a unit name is the proposal.
 */
export interface FitOptions {
  /** The shape's own rings, in the screen px the page is about to draw them in. */
  readonly rings: readonly Ring[];
}

/**
 * Turn a site into the box the layout will compete over, choosing the text along the way.
 *
 * Shared by the renderer and its tests deliberately: the "labels do not overlap" criterion is
 * only worth asserting if the assertion runs over the same boxes the page draws — and, since this
 * pass, so is "a name sits inside the ground it names", which is a claim about the same box.
 *
 * Four steps, in order, and the first two were already here. The unit's own **attested
 * abbreviation** is tried first (`labelText`, and nothing is ever invented). The name is then
 * **broken on its bracket**, so a box is as wide as its widest line rather than as wide as the sum.
 * Where `fit` is given, the name is then **set down the ladder** until it clears the room the shape
 * actually leaves at the anchor. And where even the floor will not fit, the box is marked for a
 * **callout** and `layoutLabels` takes it outside the shape on a leader.
 */
export function measureLabel(
  site: LabelSite,
  point: readonly [number, number],
  shapeWidth: number,
  measure: Measurer,
  fit?: FitOptions,
): MeasuredLabel {
  const chosen = labelText(site.text, shapeWidth, (c) => measure(c, site.tier).width);
  const [dx, dy] = site.offset ?? [0, 0];
  const at: Point = [point[0] + dx, point[1] + dy];

  const sized = (lines: readonly string[], scale: number) => {
    const each = lines.map((line) => measure(line, site.tier, scale));
    const size = Math.max(...each.map((m) => m.height));
    return {
      lines,
      width: Math.max(...each.map((m) => m.width)),
      height: size * (1 + (lines.length - 1) * LINE_SPACING),
    };
  };

  const box = (
    text: string,
    scale: number,
    callout?: LabelBox['callout'],
    origin: Point = at,
    broken: readonly string[] = labelLines(text),
  ): MeasuredLabel => {
    const { lines, width, height } = sized(broken, scale);
    const base = {
      key: site.key,
      x: origin[0],
      y: origin[1],
      width,
      height,
      priority: site.priority,
    };
    return {
      // A name set *on* its ground carries that ground with it, so the layout's nudges are held to
      // the rule the fit just applied; a callout does not, being outside it by construction.
      box:
        callout === undefined
          ? fit === undefined
            ? base
            : { ...base, ground: fit.rings }
          : { ...base, callout },
      text,
      lines,
      scale,
    };
  };

  if (fit === undefined) return box(chosen, 1);

  /*
   * The name is centred in the room rather than on the anchor, where the two differ.
   *
   * `layoutLabels` will not move a name more than a nudge off its own anchor, for the reason it
   * states — a name displaced to make it fit ends up over ground it does not describe. This
   * displacement is the one exception the rule allows for, because it is bounded by the shape
   * itself: the midpoint of the interior span is inside the same unit the anchor is, so the name
   * cannot walk onto a neighbour however far it slides. What it buys is the difference between
   * twice the *shorter* reach and the whole span — on Balochistan at the 390px bar, 95px against
   * 106px, which is the difference between the province being named and not.
   *
   * Taken only where a second ray cast at the new point agrees. A midpoint can fall outside a
   * concave shape or into a narrower part of it, and asking the geometry again is cheaper than
   * reasoning about which shapes those are: where the answer is not better, the anchor stands.
   */
  const anchored = interiorRoom(fit.rings, at);
  const midpoint: Point = [
    at[0] + (anchored.reach.right - anchored.reach.left) / 2,
    at[1] + (anchored.reach.down - anchored.reach.up) / 2,
  ];
  const centred = interiorRoom(fit.rings, midpoint);
  const better =
    Math.min(centred.width, centred.height) > 0 &&
    centred.width * centred.height > anchored.width * anchored.height;
  const origin = better ? midpoint : at;
  const room = better ? centred : anchored;

  /*
   * The abbreviation is asked twice, and the second time is the one that matters here.
   *
   * `labelText` asks it of the shape's *width*, which is what it has always done and is right for
   * a tier measured that way. Khyber Pakhtunkhwa's bounding box is 250px wide at a desktop size, so
   * the full name is kept — and the room at its anchor is 50px, because the province is a long
   * diagonal and a box says nothing about that. Left there, `KHYBER PAKHTUNKHWA` goes out on a
   * 400px leader over Kashmir while `KP` would have sat in Peshawar. So where the room will not
   * take the full name at any size, the unit's own short form is offered the same ladder before a
   * callout is. Still nothing invented: a unit without one goes straight out on its leader.
   */
  const short = shortFormOf(site.text);
  /*
   * The forms this name may take on its own ground, in the order they are conceded.
   *
   * Whole, then wrapped between its words, then the unit's attested short form — each offered the
   * whole size ladder and every place inside the unit before the next is considered. The order is
   * the argument: a reader looking for Rahim Yar Khan finds `RAHIM YAR / KHAN` and has to be told
   * that `RYK` is it. Nothing here is invented — the wrap is the same words in the same order, and
   * a unit with no attested abbreviation simply has one fewer form.
   */
  const wrapped = wrappedLines(chosen);
  const forms: readonly (readonly { readonly text: string; readonly lines: readonly string[] }[])[] =
    [
      // The name itself, whole and then broken between its words — offered together at each size,
      // because a wrapped name set large is more legible than the same name squeezed onto one line
      // at the floor, and both say exactly what the unit is called.
      wrapped.length > 1
        ? [
            { text: chosen, lines: labelLines(chosen) },
            { text: chosen, lines: wrapped },
          ]
        : [{ text: chosen, lines: labelLines(chosen) }],
      // And only where the name will not go on this ground at any size, in any shape, the unit's
      // own attested abbreviation — which is a different word, and is conceded last for that
      // reason. A unit without one has one fewer form and goes out on its leader.
      ...(short !== undefined && short !== chosen
        ? [[{ text: short, lines: labelLines(short) }]]
        : []),
    ];

  /*
   * The **roomiest parts of the unit's own ground**, wherever they are.
   *
   * The anchor answers *where does this name honestly belong* — a centroid, or a pole of
   * inaccessibility where the centroid lands on a neighbour — and the midpoint above widens that by
   * the span of one interior ray. Neither asks the question a long, thin or lopsided unit actually
   * poses, which is *where on this ground is there room to write*. A crescent, a coastal strip and
   * one of #28's rule-drawn slivers can all have a cramped anchor and a broad lobe elsewhere, and
   * without this the name pays for the anchor's room while the lobe goes unused.
   *
   * The displacement is bounded by the same thing that bounds the midpoint's, which is why it is
   * allowed at all: every candidate is *inside the same unit*, so however far the name slides it
   * cannot walk onto a neighbour and cannot name ground it does not describe. What it costs is that
   * a name may sit well off the unit's visual centre, which is the atlas answer to a lopsided shape.
   *
   * Computed **lazily and at most once**, on the first rung the anchor cannot take at that size. A
   * unit whose name fits at full size where it belongs never runs the search at all, which is what
   * keeps a grid of ray casts off the frames that do not need one.
   */
  let lobes: readonly (readonly [Point, Room])[] | null = null;
  const roomier = (): readonly (readonly [Point, Room])[] => {
    // Compared by value, not by identity: `widestInterior` allocates fresh points, so `!==` here
    // would be a filter that never filters — it would read as a guard and do nothing.
    const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
    lobes ??= widestInterior(fit.rings)
      .filter((place) => !same(place, origin) && !same(place, at))
      .map((place) => [place, interiorRoom(fit.rings, place)] as const);
    return lobes;
  };

  /*
   * Rungs outermost, places innermost — and that ordering *is* the decision here.
   *
   * A name set at full size in the roomiest part of its own ground is a better answer than the same
   * name set two rungs down on its anchor: both are inside the unit, both name it correctly, and
   * only one of them is legible. So every place inside the unit is offered at each size before the
   * type is set down, rather than the anchor being offered the whole ladder first — which is what
   * this did until now, and why a name like `Saraiki` shrank in a narrow neck while a broad lobe of
   * the same unit stood empty. The ladder is the last thing spent, not the first.
   *
   * Within one rung the order is anchor, then interior midpoint, then lobes by room: the honest
   * place is preferred wherever it will take the name at the size under test, and the search only
   * moves the name as far as that size requires.
   */
  const nearby: readonly (readonly [Point, Room])[] =
    origin === at
      ? [[at, anchored]]
      : [
          [origin, room],
          [at, anchored],
        ];

  for (const group of forms) {
    for (const scale of SHRINK_LADDER) {
      for (const { text, lines } of group) {
        const { width, height } = sized(lines, scale);
        // The room said yes and the corners said no, which is a diagonal boundary: the anchor is
        // still worth asking, since the midpoint is the point that slid toward the edge.
        for (const [place, there] of nearby) {
          if (width > there.width || height > there.height) continue;
          if (boxInside(fit.rings, place, width, height)) {
            return box(text, scale, undefined, place, lines);
          }
        }
        for (const [place, there] of roomier()) {
          if (width > there.width || height > there.height) continue;
          if (boxInside(fit.rings, place, width, height)) {
            return box(text, scale, undefined, place, lines);
          }
        }
      }
    }
  }

  // Outside the shape there is no ground constraining the type, so the name goes back to its full
  // form: it was shortened to fit a room it is no longer in. It does *not* go back to full size —
  // see `CALLOUT_SCALE`, which is one step down and the same step for every callout.
  //
  // The leader still starts at the **anchor**, never at the roomiest point: a callout's whole job is
  // to say which ground the name belongs to, and it should point at the place that honestly answers
  // that rather than at wherever the search happened to look last.
  //
  // The reach is the **anchor's** and never the midpoint's, because `from` is the anchor: `room`
  // may be the room measured at the interior midpoint, and pairing one point's reach with another
  // point's x is how a callout comes to stop short of the unit's own edge — a name set inside the
  // ground it is being taken out of, which is the claim this whole pass exists to prevent.
  return box(chosen, CALLOUT_SCALE, {
    from: at,
    reach: { left: anchored.reach.left, right: anchored.reach.right },
  });
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
  /**
   * The drawn country's own rings, in the same screen px — what a callout has to get *clear* of.
   *
   * Optional, and its absence is a working answer rather than a missing input: without it a callout
   * clears only its own unit, which is what this layout did before and is still the right answer for
   * a caller with no geography to hand. With it, the name is taken past the land on its row and onto
   * paper. See `placeCallout`.
   */
  readonly land?: readonly Ring[];
  /**
   * The longest leader this frame will draw, in px. Past it the name is dropped.
   *
   * Bounds the one thing reaching for the margin could otherwise cost: A1 to A3 strand four to six
   * rule-drawn units in the middle of Punjab, and uncapped they would fan that many leaders the
   * width of the country into a single margin. A cap expressed against the frame degrades the same
   * way at every screen size, where a cap on the *number* of callouts would silence units by quota
   * and leave a reader unable to tell why this one and not that one.
   */
  readonly maxLeader?: number;
}

/**
 * How long a leader may be, as a fraction of the frame's shorter side.
 *
 * Against the shorter side rather than the width, because it is the axis with the least paper on it
 * — the projection fits the country to the tighter of the two — and a cap measured on the roomy
 * axis would be no cap at all on a phone.
 *
 * **0.6 is measured rather than chosen**, by sweeping it across every variant at the 390px bar and
 * reading off what each value costs. It was 0.4 on argument alone for one round, and 0.4 silently
 * drops H3's *Northern Areas* — which is Gilgit-Baltistan under the name that variant gives it, so
 * a cap picked for tidiness was quietly leaving a territory anonymous. That name is anchored 298px
 * into a 369px frame and is 113px wide, so it has to travel left across the country: 202px of
 * leader, where 0.4 allowed 134. 0.55 is where it comes back and 0.6 also recovers L6's *Southern
 * Pakhtunkhwa* and one of A3's; 0.7 buys nothing further, so the knee is here rather than at the
 * ceiling.
 */
export const MAX_LEADER_FRACTION = 0.95;

const DEFAULT_NUDGES: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, -1],
  [0, 1],
  [0, -2],
  [0, 2],
];

export interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/**
 * Clear paper a callout keeps around itself, in whole lines of its own type.
 *
 * **A callout reserves its room rather than looking for it**, and finding out why cost a wrong fix
 * first. The layout is greedy by priority and the units outrank everything, so a unit's callout is
 * placed while the paper around it is still empty — asking it to *prefer* a quiet spot achieves
 * nothing, because at that moment every spot is quiet. The thicket arrives afterwards, built out of
 * the names that rank below it: `HINDKO` was set on clear paper east of Hazara and then had
 * `Muzaffarabad`'s dot pack in 9px away, `Mardan` 10px, and `Malakand` 3px at the phone bar — each
 * of them legal, since 3px is the layout's own floor, and the four of them together unreadable.
 *
 * So the rect a callout contributes to `taken` is **larger than the rect it draws**. It is the one
 * kind of name that earns this: every other label sits on the ground it names and is read straight
 * off it, where a callout has been dragged onto paper and is read by *following a line into it* —
 * and a line that arrives in a pile of four other words has not delivered the reader anywhere.
 *
 * The cost is real and is the point: a division or a city name that would have fitted beside a
 * callout is now dropped instead. That is the trade being made deliberately — a base-map caption
 * that gives way comes back on the first zoom step, where an unreadable proposal name does not.
 */
export const CALLOUT_RESERVE = 1;

/** A callout's footprint for collision purposes: the box it draws, plus its reserved paper. */
export const calloutReserve = (rect: Rect, height: number): Rect => ({
  x0: rect.x0 - height * CALLOUT_RESERVE,
  y0: rect.y0 - height * CALLOUT_RESERVE,
  x1: rect.x1 + height * CALLOUT_RESERVE,
  y1: rect.y1 + height * CALLOUT_RESERVE,
});

const overlaps = (a: Rect, b: Rect, gap: number): boolean =>
  a.x0 - gap < b.x1 && b.x0 - gap < a.x1 && a.y0 - gap < b.y1 && b.y0 - gap < a.y1;

/**
 * The leader's own dimensions, in screen px at every zoom — it is furniture, like the names it
 * carries and like the dots the cities are marked with.
 *
 * `CLEAR` is how far past the shape's own edge the whole assembly sits, so a leader leaves the
 * ground it points at rather than ending on its boundary. `GAP` is the space between the dot and
 * the first character, and `DOT` is the dot's own radius, which the renderer draws.
 *
 * **There is no cap on how much ground a leader may cross**, and that is a decision made twice over
 * rather than an omission: it was tried at 26px and at 80px and both were removed.
 *
 * The rule this map is held to is that **every unit is named** — on its own ground where the name
 * fits, and otherwise outside the drawn country on a line back to it. One of the two must be
 * present, because a proposed province drawn on the map and named nowhere on it is a shape the
 * reader cannot ask about. An interior unit has no route to the paper that does not cross somebody
 * else's ground, so any finite allowance is a quota on which units get named, and it silenced
 * Layyah, Tank, Mastung and Kambar Shahdadkot — each on the map, in the key and in the card, and
 * nameless on the one surface a reader is actually looking at.
 *
 * What the attempts left behind is the *ranking* rather than the refusal: candidates are ordered by
 * a cost that charges the run out, the bend and the wrong margin, so a leader is as short and as
 * straight and as close to its own province as the paper allows. And what carries the clutter is
 * `segmentsNear` — no two leaders may run within a clearance of each other — which is the
 * constraint that actually distinguishes a legible margin from a thicket. Lines cross the country;
 * no two of them are read as one.
 */
const LEADER = { CLEAR: 10, GAP: 5, DOT: 1.6 } as const;

/**
 * What a rung of vertical drop costs, against a pixel of horizontal run, when candidates are ranked.
 *
 * Above 1, so a bend is never taken for a marginal saving. It is a ranking weight and not a limit:
 * every candidate is still tried, so nothing here can cost a unit its name — it only decides which
 * acceptable leader is reached for first.
 */
const ELBOW_COST = 4;

/**
 * What a name costs for going the wrong way, in the same currency as a pixel of leader.
 *
 * `WRONG_SIDE_COST` is charged to a name taken out into the margin *away* from its own ground — a
 * Khyber Pakhtunkhwa unit named over in Punjab's margin — and it is heavy, because that placement is
 * not merely longer but harder to read: the reader follows the line back across the whole country.
 * It is worth about a third of a frame, so it is given up only when the near side is genuinely full
 * rather than merely tight. `WRONG_WAY_COST` is the same idea on the other axis and is lighter, since a
 * rung or two the wrong way up is a small thing next to a name on the wrong side altogether.
 *
 * Both are ranking weights and neither is a limit: every candidate is still tried, so no unit can
 * lose its name to a preference.
 */
const WRONG_SIDE_COST = 320;
const WRONG_WAY_COST = 60;

/**
 * The radius the elbow is turned through, in screen px. Drawn by the renderer, which is why it is
 * exported: a right angle in a hairline reads as a corner of a box, and a turned one reads as a
 * line going somewhere. It is capped against each leg, so a short leader turns a smaller corner
 * rather than overshooting its own ends.
 */
export const LEADER_ELBOW_RADIUS = 5;
export const LEADER_DOT_RADIUS = LEADER.DOT;
/**
 * The other two, exported for the same reason the radius is: the suite has to be able to say why a
 * name could not be called out, and it may not do that with a copy of these numbers.
 */
export const LEADER_CLEAR = LEADER.CLEAR;
export const LEADER_GAP = LEADER.GAP;

/**
 * How far above and below its own ground a callout will look, in whole label heights.
 *
 * Nearest first, so a name stays as close to the ground it names as the paper allows — a callout
 * three lines below its unit is still pointing at it, and one eight lines below is a name a reader
 * has to follow rather than read. Rung zero is a plain horizontal leader with no elbow at all,
 * which is what a rightward callout on unobstructed paper gets.
 */
const CALLOUT_RUNGS: readonly number[] = Array.from({ length: 27 }, (_, i) =>
  i === 0 ? 0 : (i % 2 === 1 ? -1 : 1) * Math.ceil(i / 2),
);

type Segment = readonly [Point, Point];

const side = (a: Point, b: Point, p: Point): number =>
  (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);

/** Proper crossing of two segments. Touching at an endpoint is not a crossing. */
function segmentsCross([a, b]: Segment, [c, d]: Segment): boolean {
  const [s1, s2, s3, s4] = [side(a, b, c), side(a, b, d), side(c, d, a), side(c, d, b)];
  return s1 > 0 !== s2 > 0 && s3 > 0 !== s4 > 0;
}

/** The centre of a set of rings' bounding box. One pass, called once per layout. */
function centreOf(rings: readonly Ring[]): Point {
  let west = Infinity;
  let east = -Infinity;
  let north = Infinity;
  let south = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < west) west = x;
      if (x > east) east = x;
      if (y < north) north = y;
      if (y > south) south = y;
    }
  }
  return [(west + east) / 2, (north + south) / 2];
}

/** How far a point is from a segment, in px. The distance test crossing alone cannot make. */
function pointToSegment(p: Point, [a, b]: Segment): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const span = dx * dx + dy * dy;
  const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / span));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Whether two leaders come within `clear` of each other anywhere — crossing, or merely running
 * alongside.
 *
 * Crossing was the whole test and it was the wrong one. Two leaders that never cross can still be
 * laid a few px apart down the same margin, and what a reader sees there is not two annotations but
 * a bracket: `MASTUNG` dropped its elbow past `QUETTA`'s own dot and ran its arm underneath
 * `QUETTA`'s, and every check passed because the two lines are parallel. A leader is read by
 * following it, and two lines close enough to be followed into each other cost the reader both.
 *
 * So the same clearance the names keep from each other is asked of the lines that carry them, at
 * the same two-pass ladder: room first, then merely not colliding.
 */
function segmentsNear(a: Segment, b: Segment, clear: number): boolean {
  if (segmentsCross(a, b)) return true;
  const gap = Math.min(
    pointToSegment(a[0], b),
    pointToSegment(a[1], b),
    pointToSegment(b[0], a),
    pointToSegment(b[1], a),
  );
  return gap < clear;
}

const inside = (p: Point, r: Rect): boolean =>
  p[0] >= r.x0 && p[0] <= r.x1 && p[1] >= r.y0 && p[1] <= r.y1;

/**
 * Whether a leader segment touches a rectangle at all — passing through it, or ending in it.
 *
 * The rectangle is grown by `gap` first, and that is not fussiness. A leader that misses a name by
 * a pixel is drawn as a rule under its descenders: `URDU (KARACHI EAST)` came out underlined by its
 * own leader, which cleared the box by one pixel and passed every check. The same clearance the
 * names keep from each other.
 */
function meetsRect(segment: Segment, rect: Rect, gap = 0): boolean {
  const r: Rect = { x0: rect.x0 - gap, y0: rect.y0 - gap, x1: rect.x1 + gap, y1: rect.y1 + gap };
  if (inside(segment[0], r) || inside(segment[1], r)) return true;
  const corners: Point[] = [
    [r.x0, r.y0],
    [r.x1, r.y0],
    [r.x1, r.y1],
    [r.x0, r.y1],
  ];
  return corners.some((corner, i) =>
    segmentsCross(segment, [corner, corners[(i + 1) % corners.length] as Point]),
  );
}

/**
 * Where a name goes when it will not fit inside the ground it names.
 *
 * Outside the shape, set horizontally, and joined back to its own ground by a **single-elbow**
 * leader ending in a dot immediately before the first character — which is the atlas answer to a
 * unit too small or too thin for its own name, and the honest alternative to the two this map
 * refuses: overflowing the name across a neighbour (a claim nobody wrote) and dropping it outright
 * (a proposed province drawn as an unlabelled shape).
 *
 * **The elbow is orthogonal, and it has to be.** The leader runs from the anchor along the anchor's
 * own line to the dot's column, and then down or up into the dot. The obvious alternative — a
 * diagonal to an elbow beside the dot, then a flat run into it — draws beautifully to the right and
 * cannot be drawn to the left at all: the name always runs *rightwards* from its dot, so a leader
 * approaching a dot on the left of a name it started to the right of has to travel the width of the
 * name to get there, and converges on the dot's own line as it does. It crosses its own words at
 * every offset short of about twenty times the type size. Routed orthogonally, one rung of clearance
 * is enough and both sides work, which is what keeps a unit in the eastern half of a phone frame
 * from being unnameable for a reason that is really about the shape of a polyline.
 *
 * **The name is taken clear of the country, not merely clear of its own unit.** Until this pass the
 * leader stopped `LEADER.CLEAR` past the unit's own reach at the anchor, which on any unit with a
 * neighbour — which is most of them — put the name squarely on somebody else's ground. On a map
 * whose whole subject is which district belongs to whom, a name set inside a unit it does not name
 * is the same claim `measureLabel`'s interior fit exists to prevent, made a second way and made
 * worse: the reader has a *line* telling them the name belongs to something, and the ground under
 * it says which. So the dot's column is found from `landSpanAt` — past the drawn land on that row —
 * and the paper the name lands on is paper.
 *
 * The four faint neighbour silhouettes count as clear, deliberately. The failure being closed is a
 * name reading as though it labels a different **unit**, which is a claim about Pakistani ground;
 * India and Afghanistan are drawn unlabelled and name nothing, so nothing there can be misread as
 * named. It is the narrower rule than the ceasefire line's name follows — that one asks about the
 * silhouettes too, because it is a claim about a *border* — and the two are kept apart on purpose.
 *
 * **Nearest first, and bounded.** Candidates are ranked by the length of the leader they need, so a
 * name sits as close to its ground as the paper allows, and any leader longer than `maxLeader` is
 * refused. Without the cap, A1 to A3 — which strand four to six rule-drawn units in central Punjab —
 * would fan five or six leaders the width of the country into one margin, and the map's subject
 * would be overdrawn by its own furniture. The cap makes "appropriately close" a number.
 *
 * Two things it will not do. A leader may not **cross another label or another leader**, nor
 * anything already standing on the paper, nor the name it is carrying — a leader that crosses is
 * worse than no leader, since it points at a word rather than at a piece of ground. It *may* cross
 * other units' land, and has to: that is the only way to reach the margin, and a line over ground
 * is not a name over ground. And where no candidate is clear the name is **dropped**, exactly as an
 * unplaceable name is dropped today: the layout is recomputed on every zoom, and the room is what
 * brings it back.
 */
function placeCallout(
  label: LabelBox,
  {
    bounds,
    gap,
    land,
    maxLeader = Infinity,
    spans,
    middle,
    opaque = [],
  }: {
    bounds: LayoutOptions['bounds'];
    gap: number;
    land: readonly Ring[] | undefined;
    maxLeader: number | undefined;
    /** The middle of the drawn country. A name is ranked by how far *outward* of it the name sits. */
    middle: Point | null;
    /**
     * One frame's answers from `landSpanAt`, keyed on the row.
     *
     * Not an optimisation looking for a problem. A scan walks every segment of the drawn country —
     * some twenty thousand points — and a callout asks for three rows per candidate, twenty-two
     * candidates, two land modes, and again on the retry that ignores the reserves. That is a few
     * hundred full scans **per name**, and A1 to A3 strand six names each, on a layout that reruns
     * on every zoom and pan frame. The rows repeat heavily across all of that, so one cache across
     * the whole frame turns it back into a few dozen scans. Owned by `layoutLabels` rather than by
     * this function for exactly that reason: the sharing that matters is *between* callouts.
     */
    spans: Map<number, [number, number] | null>;
    /**
     * The boxes that are not names — the unit key, a docked tooltip, the sheet (#33).
     *
     * Held apart from `taken` because the last-resort pass gives up clearance against *names* and
     * may not give up anything against these: a name a leader passes under is still legible and the
     * leader is still followable, where a leader that runs under an opaque panel is a line that
     * disappears. Refused at every pass, including the one that exists to place a name at any cost.
     */
    opaque: readonly Rect[];
  },
  taken: readonly Rect[],
  leaders: readonly Segment[],
): { placed: PlacedLabel; rect: Rect; leader: Segment[] } | null {
  const callout = label.callout as NonNullable<LabelBox['callout']>;
  /*
   * How far apart two rungs of the ladder are.
   *
   * A whole line of type between the boxes, not the layout's bare minimum. At `height + gap` the
   * rungs are one pixel further apart than a box is tall, so two names on neighbouring rungs clear
   * each other by exactly `gap` — and since every unit's ladder is hung from its *own* anchor, two
   * ladders offset by a few pixels put their rungs almost on top of each other. The roomy pass then
   * refuses every candidate and the crowded pass takes whatever is left, which is how a margin with
   * plenty of paper in it came to have no room for `SOUTH WAZIRISTAN` between `DERA ISMAIL KHAN`
   * and `JAFFARABAD`. Wider rungs are cheap: over paper they cost nothing at all, and over ground
   * they are charged for by `offGround` like everything else.
   */
  const step = label.height + gap;

  /**
   * Where the assembly's leading edge goes on one row: past the land if there is land on that row,
   * and past the unit's own reach if there is not.
   *
   * Asked of the box's top, middle and bottom rather than of its centre line alone, because a name
   * is a box and a coastline is diagonal: a callout beside Gwadar clears the land at its own row and
   * takes a corner of Balochistan two lines up. Where `land` is absent this is the pre-#50 answer
   * unchanged, which is what keeps every caller that has no geography — the suite included — working
   * on the terms it was written for.
   */
  const pastOwnUnit = (direction: 1 | -1): number =>
    callout.from[0] +
    direction * ((direction > 0 ? callout.reach.right : callout.reach.left) + LEADER.CLEAR);

  const leadingEdge = (y: number, direction: 1 | -1, useLand: boolean): number => {
    if (land === undefined || !useLand) return pastOwnUnit(direction);
    let edge: number | null = null;
    for (const row of [y - label.height / 2, y, y + label.height / 2]) {
      let span = spans.get(row);
      if (span === undefined) {
        span = landSpanAt(land, row);
        spans.set(row, span);
      }
      if (span === null) continue;
      const end = direction > 0 ? span[1] : span[0];
      edge = edge === null ? end : direction > 0 ? Math.max(edge, end) : Math.min(edge, end);
    }
    // A row that misses the country entirely is all paper, so the name has no reason to travel: it
    // sits beside its own unit, which is as close to the ground it names as it can get.
    return edge === null ? pastOwnUnit(direction) : edge + direction * LEADER.CLEAR;
  };

  interface Candidate {
    readonly y: number;
    readonly dotX: number;
    readonly rungs: number;
    readonly direction: 1 | -1;
    readonly length: number;
  }

  const candidatesFor = (useLand: boolean): Candidate[] => {
    const found: Candidate[] = [];
    for (const rungs of CALLOUT_RUNGS) {
      for (const direction of [1, -1] as const) {
        const y = callout.from[1] + rungs * step;
        // The assembly always reads dot-then-name, so a leftward callout is laid out from its far
        // edge back: the whole of it — dot, gap, name — sits clear of the land's left side.
        const clear = leadingEdge(y, direction, useLand);
        const dotX = direction > 0 ? clear : clear - LEADER.GAP - label.width;
        const length = Math.abs(dotX - callout.from[0]) + Math.abs(rungs * step);
        if (length > maxLeader) continue;
        found.push({ y, dotX, rungs, direction, length });
      }
    }
    /*
     * Nearest first — but *nearest* is a cost and not a raw length, and the difference is what the
     * margin looks like.
     *
     * Ranked on raw length, a leader that drops two rungs to save three pixels of run beats the
     * plain horizontal one, and a column of names each bent a different amount is what a reader
     * gets. The drop is therefore charged at `ELBOW_COST` times its length: a bend has to *earn*
     * itself against the straight run it replaces, so a name sits on its own row unless moving off
     * it buys something real. Rung zero has no elbow to follow at all, which is the neatest leader
     * this map can draw and the one it reaches for first — **where the assembly allows it**, which
     * is rightward only: a leftward callout reads dot-then-name like every other, so its name sits
     * between its dot and its own ground and a leader on that row would run straight through it.
     * That is why the western margin's names step off their row and the eastern margin's do not.
     *
     * Ties break on the side and then on the signed rung, so the same map never renders two ways.
     */
    /*
     * The side this unit's name belongs on, and it is asked of the **unit** rather than of the
     * country.
     *
     * Which margin is nearer to its own ground: the western one for Khyber Pakhtunkhwa and the
     * Baloch west, the eastern one for Punjab, the southern for Sindh's coast — so a reader looking
     * at a province finds that province's names beside it, which is the whole of what this
     * preference is for. Measured at the anchor's own row, once, so every candidate is judged
     * against the same side and the ladder does not wander from rung to rung.
     *
     * The country's *middle* was tried here first and is the wrong question. It answers well for a
     * unit out at an edge and arbitrarily for one near the centre: Tank is a Khyber Pakhtunkhwa
     * unit a few pixels east of the country's midline, and being pushed "outward" sent its name
     * across into Punjab's margin — further from its own ground, and past the Afghan frontier that
     * was sitting a short run to its west. What the middle is still good for is the *vertical*
     * sense, where a unit in the north wants its name above rather than below.
     */
    const runTo = (direction: 1 | -1): number =>
      Math.abs(leadingEdge(callout.from[1], direction, true) - callout.from[0]);
    const nearSide: 1 | -1 = land === undefined ? 1 : runTo(1) <= runTo(-1) ? 1 : -1;
    const outwardY = middle === null ? 0 : Math.sign(callout.from[1] - middle[1]);
    const cost = (c: Candidate): number =>
      Math.abs(c.dotX - callout.from[0]) +
      ELBOW_COST * Math.abs(c.rungs * step) +
      (land !== undefined && c.direction !== nearSide ? WRONG_SIDE_COST : 0) +
      (outwardY !== 0 && c.rungs !== 0 && Math.sign(c.rungs) !== outwardY ? WRONG_WAY_COST : 0);
    return found.sort(
      (a, b) =>
        cost(a) - cost(b) ||
        Math.abs(a.rungs) - Math.abs(b.rungs) ||
        b.direction - a.direction ||
        a.rungs - b.rungs,
    );
  };

  /**
   * One candidate, judged at a stated clearance. `null` where it will not do at that clearance.
   *
   * The frame is checked against the frame and everything else against `clear`, so raising the bar
   * asks for breathing room from the other names without asking the paper to be bigger than it is.
   */
  const judge = (
    { y, dotX }: Candidate,
    clear: number,
    apart: boolean,
    clearOfNames = true,
  ): { placed: PlacedLabel; rect: Rect; leader: Segment[] } | null => {
    const to: Point = [dotX, y];
    const elbow: Point = [dotX, callout.from[1]];
    const x = dotX + LEADER.GAP + label.width / 2;

    const rect: Rect = {
      x0: x - label.width / 2,
      y0: y - label.height / 2,
      x1: x + label.width / 2,
      y1: y + label.height / 2,
    };
    if (rect.x0 < 0 || rect.y0 < 0 || rect.x1 > bounds.width || rect.y1 > bounds.height) return null;
    if (elbow[0] < 0 || elbow[0] > bounds.width) return null;
    if (taken.some((other) => overlaps(rect, other, clear))) return null;
    if (leaders.some((segment) => meetsRect(segment, rect, clear))) return null;

    const segments: Segment[] = [
      [callout.from, elbow],
      [elbow, to],
    ];
    if (segments.some((s) => opaque.some((other) => meetsRect(s, other, clear)))) return null;
    if (clearOfNames && segments.some((s) => taken.some((other) => meetsRect(s, other, clear)))) {
      return null;
    }
    if (segments.some((s) => meetsRect(s, rect, clear))) return null;
    if (apart && segments.some((s) => leaders.some((other) => segmentsNear(s, other, clear)))) {
      return null;
    }

    return {
      placed: { key: label.key, x, y, leader: { from: callout.from, elbow, to } },
      rect,
      leader: segments,
    };
  };

  /*
   * The whole candidate list is walked twice: once asking for **breathing room**, and once asking
   * only not to collide.
   *
   * `gap` is the clearance below which two names read as one word — it is a floor on legibility, and
   * a callout that clears it by a pixel passes every check in `judge` and still lands in a thicket.
   * `HINDKO` came out on a leader wedged between Azad Kashmir, Muzaffarabad, the ceasefire line's own
   * name and `KOHIOSTANI`: no overlap anywhere, and unreadable, because a name out on a line is read
   * by following the line to it and there was nothing around it to follow it *into*. So the roomy
   * pass asks for a whole line of type of clear space on every side, which is enough to make the
   * name a thing on paper rather than a fifth word in a pile.
   *
   * The passes are ordered rather than scored, and the nearest-first ranking is preserved inside
   * each. That keeps the two criteria in a stated order — *close to its ground* is worth more than
   * *comfortable*, since a callout that drifts to the far side of the country to find quiet paper
   * has stopped pointing at anything — and it means the crowded placement is a **fallback and not a
   * failure**: a name with nowhere quiet to go is still drawn where it was drawn before, rather than
   * dropped for want of elegance.
   */
  const roomy = Math.max(gap, label.height);
  /*
   * Four passes, in a stated order of concession, and the last one is what makes **every unit is
   * named** true rather than aspirational.
   *
   *  1. A whole line of type of clear space on every side, and no leader within that of another.
   *  2. The layout's own `gap` — enough that two names are two names.
   *  3. A hairline. Tight, and still two names and two lines.
   *  4. The same hairline between the *names*, and the lines let cross.
   *
   * The first three are the map as it should look and the fourth is the map keeping its promise. A
   * crossed leader is a poor annotation — it points at a line rather than at a piece of ground — and
   * it is recoverable by following it, where a unit drawn on the map and named nowhere on it is a
   * shape the reader cannot ask about at all. That is the order, and it is why the concession is to
   * the *lines* and never to the names: two labels are never allowed to overlap at any pass.
   *
   * In practice the fourth is reached only in the northern cluster of D1 and A1 to A3, where eight
   * or nine units the size of a district compete for the same few rows of margin.
   */
  const passes: readonly {
    readonly clear: number;
    readonly apart: boolean;
    readonly clearOfNames?: boolean;
  }[] = [
    ...(roomy > gap ? [{ clear: roomy, apart: true }] : []),
    { clear: gap, apart: true },
    { clear: 1, apart: true },
    { clear: 1, apart: false },
    // The fifth, and the only thing left to give. A leader may pass beneath a name it does not
    // belong to — which reads as that name being underlined, and is the last concession available
    // before a unit goes unnamed. Two labels still never overlap, at this pass as at every other.
    { clear: 1, apart: false, clearOfNames: false },
  ];

  /*
   * **Reaching paper is not a preference. A callout is on clear paper or it is not drawn.**
   *
   * There are two honest places for a unit's name: on its own ground, where it needs no leader at
   * all, and outside the drawn country on a leader back to it. This function is the second, and it
   * used to have a third mode behind it — clear of the unit's *own* reach and nothing else, which
   * is the answer it gave before it was taught about the land. That mode puts a name on some other
   * unit's ground, and once a frame strands half a dozen of them the map is read through a thicket
   * of words belonging to shapes underneath other shapes. Every one of them is a name over ground it
   * does not describe, which is the exact failure the clearance rule at the top of this file exists
   * to prevent; the leader made it look like an answer rather than the same defect with a line
   * attached.
   *
   * The cost is real and is paid rather than dodged: where the paper has nothing to offer under the
   * leader cap, the name is **dropped**. It is dropped the way every unplaceable name here is —
   * the layout reruns on every zoom and pan, so the room is what brings it back, and the unit is
   * still named in the map's own key, in the card's unit list and in the tooltip.
   *
   * **One obligation outranks this and it is not a matter of taste**: a *territory* drawn and
   * anonymous is a claim the politically sensitive rendering section exists not to make, and at the
   * 390px bar H3's *Northern Areas* — Gilgit-Baltistan under the name that variant gives it — has no
   * paper-clearing candidate. So `mustName` keeps the old mode for those and for nothing else. It is
   * a carve-out for a constitutional claim, not a fallback for a crowded frame.
   */
  const modes: (boolean | 'own-reach')[] =
    land === undefined ? ['own-reach'] : label.mustName === true ? [true, 'own-reach'] : [true];
  for (const mode of modes) {
    const candidates = candidatesFor(mode === true);
    for (const pass of passes) {
      for (const candidate of candidates) {
        const placed = judge(candidate, pass.clear, pass.apart, pass.clearOfNames ?? true);
        if (placed !== null) return placed;
      }
    }
  }
  return null;
}

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
  { bounds, gap, nudges = DEFAULT_NUDGES, occupied = [], land, maxLeader }: LayoutOptions,
): PlacedLabel[] {
  /*
   * The middle of the drawn country, which every callout is pushed *away* from.
   *
   * It is what makes the margin legible as a map rather than as a list: a name belonging to ground
   * in the north-west goes out into the north-west, one belonging to the south-east goes out into
   * the south-east, and a reader looking at Balochistan finds Balochistan's names beside
   * Balochistan. Without it the ranking only ever asked which leader was shortest, and a unit whose
   * own side of the frame was full took the first slot it could reach — which is how a Balochistan
   * unit came to be named up beside Khyber Pakhtunkhwa, pointing back across the country.
   *
   * The bounding box's centre and not a centroid, deliberately: what is wanted is the middle of the
   * *frame the country occupies*, so that "outward" means toward the nearest paper, and a centroid
   * dragged west by Balochistan's bulk would send Punjab's names further east than the paper is.
   * Computed once per layout — one pass over rings the callouts then read from a cache.
   */
  const middle = land === undefined ? null : centreOf(land);
  const order = [...labels].sort(
    (a, b) => b.priority - a.priority || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );

  // Seeded, not empty: whatever is already on the frame outranks every name, because it is not
  // competing for the ground — it is on it.
  const taken: Rect[] = [...occupied];
  /*
   * A callout's reserved paper, kept apart from the ground it actually occupies.
   *
   * Two lists rather than one, because a reserve that could cost a name would be worth less than
   * the clutter it prevents. Everything below is placed in **two passes**: first respecting the
   * reserves, and then — only if that found nowhere at all — ignoring them and asking the original
   * question, which is whether the name collides with anything real. So a reserve moves names that
   * have somewhere else to go and never drops one that does not. Merging the two lists is what
   * this did when it first landed, and it cost `Hindko` its name outright at the 390px bar.
   */
  const reserved: Rect[] = [];
  /** Shared across every callout in this frame — see `placeCallout`'s `spans`. */
  const spans = new Map<number, [number, number] | null>();
  const placed: PlacedLabel[] = [];
  const leaders: Segment[] = [];

  for (const label of order) {
    if (label.callout !== undefined) {
      const options = { bounds, gap, land, maxLeader, spans, middle, opaque: occupied };
      const outside =
        placeCallout(label, options, [...taken, ...reserved], leaders) ??
        placeCallout(label, options, taken, leaders);
      if (outside !== null) {
        taken.push(outside.rect);
        // Reserved as well as occupied — see `CALLOUT_RESERVE`. Everything placed after this one,
        // which is everything ranked below it, keeps a line of type clear of the name where it can.
        reserved.push(calloutReserve(outside.rect, label.height));
        leaders.push(...outside.leader);
        placed.push(outside.placed);
      }
      continue;
    }
    const nudged = (obstacles: readonly Rect[]): { x: number; y: number; rect: Rect } | null => {
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
        if (rect.x0 < 0 || rect.y0 < 0 || rect.x1 > bounds.width || rect.y1 > bounds.height) {
          continue;
        }
        // A name fitted to its own ground may only be displaced *within* it. Without this the
        // layout can undo the fit — see `LabelBox.ground`. The zero nudge is re-checked with the
        // rest rather than trusted, which costs nothing and keeps one rule instead of two.
        if (
          label.ground !== undefined &&
          !boxInside(label.ground, [x, y], label.width, label.height)
        ) {
          continue;
        }
        if (obstacles.some((other) => overlaps(rect, other, gap))) continue;
        // A leader already drawn is ground taken, exactly as a name is. Checked here as well as in
        // `placeCallout` because the two run in priority order and either can be the later of the
        // pair: a leader must not cross a name, whichever of them was placed first.
        if (leaders.some((segment) => meetsRect(segment, rect, gap))) continue;
        return { x, y, rect };
      }
      return null;
    };
    const spot = nudged([...taken, ...reserved]) ?? nudged(taken);
    if (spot !== null) {
      taken.push(spot.rect);
      placed.push({ key: label.key, x: spot.x, y: spot.y });
    }
  }

  return placed;
}
