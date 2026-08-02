/**
 * The four countries Pakistan borders, reduced to the silhouettes the map draws behind it (#8).
 *
 * They exist for one reason: without them the dashed Line of Control, and every other stretch of
 * Pakistan's outline, floats against blank paper — and a boundary with nothing on the far side of
 * it reads as a coast. So they are context and nothing else: faint, unlabelled, never shaded,
 * never hit-tested, and carrying no statistic of any kind. Nothing about this app's subject is
 * argued from them.
 *
 * They are fetched **whole** and cut down here, which is the opposite way round from the coastline
 * and deliberately so. A country's silhouette is a closed polygon, and Overpass will not hand back
 * a closed polygon for part of one: asking only for the member ways near Pakistan returns an open
 * run of boundary, and closing that run into a shape means deciding which side of it is the
 * country. That decision has no source behind it — it is the same objection D12 makes to a traced
 * Line of Control — so the polygon is taken from OSM closed and then intersected with a rectangle,
 * where the only judgement is where the rectangle goes.
 */

import { type Extent, clipToLand } from './coastline.ts';
import { type OsmMember, type Position, assemblePolygons } from './rings.ts';

/**
 * The rectangle the silhouettes are cut to, and the one judgement in this module.
 *
 * Two pressures, both real. It must be **wider than the frame can ever be at zoom 1**, because
 * its edges are a straight cut through Iran and China that means nothing and a reader must never
 * see one: the projection is fitted to Pakistan, so the widest window the layout permits
 * (1180 px against the map well's 26 rem floor) reaches 40.7°E to 96.8°E and 20.3°N to 38.6°N,
 * and this clears that on every side. And it must stay **within about 30° of the central
 * meridian** (69.3°E),
 * because the projection is a conic cut for Pakistan (`src/lib/projection.ts`) and a conformal
 * conic taken far enough round the cone returns coordinates the size of the sky. China's true
 * eastern edge at 135°E is 66° out and would be projected into a path a browser has to rasterise.
 *
 * Zoom only goes inward — `scaleExtent([1, 24])` with panning bounded to the frame — so zoom 1 is
 * the whole of the worst case.
 */
export const CONTEXT_EXTENT: Extent = { west: 40, south: 10, east: 98, north: 47 };

/**
 * Which neighbour is which, keyed on `ISO3166-1` rather than on a name or a relation id.
 *
 * `faces` is not decoration: it is what makes the set falsifiable. Four silhouettes could be four
 * arbitrary countries, and stating which stretch of Pakistan's own outline each one lies across is
 * what turns "we drew India" into a claim the suite can check by asking whether India is actually
 * over there. The order is the one the boundary runs in, anticlockwise from the Wakhan Corridor.
 */
export interface NeighbourSpec {
  readonly iso: string;
  /** The English name. OSM's `name` on these relations is not always English. */
  readonly name: string;
  readonly faces: string;
  /**
   * A point unambiguously inside that country and inside the extent, so the suite can ask
   * whether the silhouette drawn under this name is that country's ground. Chosen well clear of
   * any disputed stretch — nothing here is on the far side of a line this app draws dashed.
   */
  readonly inside: Position;
}

export const NEIGHBOURS: readonly NeighbourSpec[] = [
  {
    iso: 'AF',
    name: 'Afghanistan',
    faces:
      'the Durand Line, from the Wakhan Corridor south-west to the tri-point with Iran at ' +
      'Koh-i-Malik Siah',
    // Kabul.
    inside: [69.1723, 34.5281],
  },
  {
    iso: 'CN',
    name: 'China',
    faces: 'the Karakoram frontier of Gilgit-Baltistan',
    // Kashgar, in Xinjiang.
    inside: [75.9877, 39.4704],
  },
  {
    iso: 'IN',
    name: 'India',
    faces:
      'the whole eastern side — the Line of Control in Kashmir, the Working Boundary along ' +
      'Sialkot and Narowal, and the international boundary from there to Sir Creek',
    // Delhi.
    inside: [77.209, 28.6139],
  },
  {
    iso: 'IR',
    name: 'Iran',
    faces: 'the western edge of Balochistan, from Koh-i-Malik Siah down to Gwatar Bay',
    // Zahedan, in Sistan and Baluchestan.
    inside: [60.8629, 29.4963],
  },
];

/**
 * What the app has to say out loud about a boundary it draws as an ordinary one.
 *
 * The Durand Line is drawn exactly as Pakistan's other international boundaries are — solid, at
 * province weight, with no dash and no special casing anywhere in the renderer. That is a
 * decision, not an omission: the dash is reserved for a ceasefire line (D12), and spending it
 * here would say the two are the same kind of line, which they are not. What the disagreement
 * costs instead is a footnote, carried with the silhouette of the country that makes it rather
 * than typed into the renderer, so the note cannot be lost while the line is still on screen.
 *
 * A footnote is a surface, so it is sourced and badged like every other one. Everything the note
 * asserts as fact is a dated document — the 1893 agreement and the 1949 Loya Jirga resolution —
 * which is what `documented` means in this app's vocabulary and the badge the Historical basis
 * already wears. Without it the one paragraph of prose the map states in its own voice would be
 * the only claim in the bundle a reader could not trace, which is precisely the failure the
 * working agreement names.
 */
export interface BoundaryNote {
  readonly text: string;
  readonly source: string;
  readonly badge: 'documented';
}

export const BOUNDARY_NOTES: Readonly<Record<string, BoundaryNote>> = {
  AF: {
    text:
      'The Pakistan–Afghanistan boundary is the Durand Line, agreed between the Government of ' +
      'India and Amir Abdur Rahman Khan in 1893 and inherited by Pakistan in 1947. No Afghan ' +
      'government has recognised it: the Loya Jirga of 1949 declared the 1893 agreement void, ' +
      'and no administration since has accepted it as an international border. It is drawn here ' +
      'as an ordinary boundary and not dashed — the dash belongs to the Line of Control, which ' +
      'is a ceasefire line, and using it for a disputed international boundary would say the ' +
      'two are the same kind of line. Pakistan administers up to it and it is the limit of ' +
      'every figure in this app; the dispute is over its standing, not over where it runs.',
    source:
      'Agreement between Amir Abdur Rahman Khan and Sir Mortimer Durand, Kabul, 12 November ' +
      '1893; Afghan Loya Jirga resolution of July 1949 repudiating it.',
    badge: 'documented',
  },
};

/** The extent as a polygon, wound clockwise for d3-geo the way the rest of the bundle is. */
export function extentPolygon(extent: Extent): Position[][][] {
  const { west, south, east, north } = extent;
  return [
    [
      [
        [west, south],
        [west, north],
        [east, north],
        [east, south],
        [west, south],
      ],
    ],
  ];
}

export interface Silhouette {
  readonly polygons: Position[][][];
  /** Rings that could not be stitched shut. A country drawn torn is refused, not drawn. */
  readonly unclosed: number;
}

/**
 * One country's relation members, stitched into closed polygons and cut to the extent.
 *
 * `assemblePolygons` is the district pipeline's own stitcher, used unchanged: a country relation
 * is the same kind of object as a district relation, only larger, and a second stitcher would be
 * a second set of rules about what a ring is.
 */
export function silhouetteOf(members: readonly OsmMember[], extent: Extent): Silhouette {
  const { polygons, unclosed } = assemblePolygons(members);
  if (polygons.length === 0) return { polygons: [], unclosed };
  return { polygons: clipToLand(polygons, extentPolygon(extent)), unclosed };
}
