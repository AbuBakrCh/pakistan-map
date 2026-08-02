/**
 * The map, in its three strata (#18) — over the baseline of current provinces and divisions
 * (#4), with Kashmir drawn honestly (#7).
 *
 * Stratum 1 is the fill, which is data and never unit membership (D14). Stratum 2 is the current
 * boundaries, which fade back rather than disappear once a basis is active — a proposal is only
 * legible against the map it wants to replace. Stratum 3 is the active variant's unit outlines,
 * drawn heavy, cased so they survive a busy fill beneath them, and labelled in their own colour
 * rather than filling the units they name (which would be stratum 1 saying something it must not).
 *
 * The strata are switched by `show`, which is the seam the selectors drive. Everything in it is
 * a matter of attributes and a path join: the projection, the label anchors and the arc sets are
 * all recomputed only when the view or the frame actually changes.
 *
 * Everything with a decision in it — where a name goes, which names survive a collision, how the
 * cone is cut, which stretch of border is the ceasefire line — lives in `lib/` behind pure
 * functions with tests. What is left here is plumbing: make the SVG, bind the paths, and re-run
 * the label layout whenever the transform changes.
 *
 * Districts are deliberately not drawn. They are the building block every unit is composed from
 * (D23), but on the baseline they would bury the two tiers that orient a reader.
 *
 * Boundaries are drawn **by arc rather than by shape**, which is the one structural difference
 * from the tiers alone. Stroking each polygon draws every internal boundary twice and, worse,
 * draws the Line of Control solid underneath its own dash — see `tierArcs` in `lib/geography.ts`.
 */

import { geoContains, geoPath, pointer, select, zoom, zoomIdentity, type ZoomTransform } from 'd3';
import type { Topology } from 'topojson-specification';
import type { CensusStatistics, UnitKind } from './bundle.ts';
import { readCities, readSilhouettes } from './lib/context.ts';
import { linesFromArcs, readDistricts, readGeography, tierArcs } from './lib/geography.ts';
import { districtLocator, type DistrictFeature } from './lib/hit-test.ts';
import {
  districtTooltip,
  placeTooltip,
  spokenTooltip,
  type DistrictTooltip,
  type UnitMembership,
} from './lib/tooltip.ts';
import type { DistrictFill } from './lib/mother-tongue.ts';
import type { UnitBoundary, UnitTier } from './lib/units.ts';
import {
  baselineLabelSites,
  districtLabelSites,
  DISTRICT_LABEL_ZOOM,
  labelKey,
  type CitySite,
  layoutLabels,
  measureLabel,
  variantLabelSites,
  type LabelSite,
  type LabelTier,
  type Measurer,
} from './lib/labels.ts';
import {
  arcsOf,
  labelAlongLine,
  readLineOfControl,
  type PlacedLineLabel,
} from './lib/line-of-control.ts';
import { fitProjection, frameInset } from './lib/projection.ts';
import { isTap, selectsByTap, tapResolves } from './lib/touch.ts';
import { isSheetLayout } from './sheet.ts';

/**
 * Must match `--font-serif` in styles.css: the canvas measures what the browser will draw.
 *
 * Exported because the PNG band (#32) sets its type in the same face and measures it the same way.
 * A second copy of the stack would be a second face the moment either is edited, and the export's
 * whole claim is that it looks like the page it came from.
 */
export const SERIF =
  '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif';

/** Mirrors `.label-province` and `.label-division` in styles.css; the canvas measures from it. */
const TYPE: Record<LabelTier, { size: number; tracking: number; caps: boolean }> = {
  // A unit's name is set at the province size and in the province's manner, because that is what
  // it claims to be. It is told apart by colour, which matches its own outline — not by being set
  // larger, which would be this app putting a proposal above the country.
  unit: { size: 13, tracking: 1.5, caps: true },
  // The building block, named only once the reader has zoomed in far enough for the names to be
  // readable (#34). Smaller than a division and roman, because it sits under one.
  district: { size: 8.5, tracking: 0, caps: false },
  // A city is not a tier of the administrative hierarchy and is not set as one: smaller than a
  // division name, in lower case, so it reads as a place on the map rather than as a unit of it.
  city: { size: 9.5, tracking: 0, caps: false },
  // Province names are set larger and tracked out, the way an atlas sets a country's first-level
  // units. Tracking is added to the measured width by hand — canvas cannot measure letter-spacing.
  province: { size: 13, tracking: 1.5, caps: true },
  division: { size: 10.5, tracking: 0, caps: false },
};

/** SVG fill for one district. `none` leaves the unshaded baseline showing through. */
const fillPaint = (fill: DistrictFill | undefined): string => {
  if (fill === undefined || fill.kind === 'no-data') return 'none';
  return fill.kind === 'category' ? fill.colour : 'url(#no-dominant-stipple)';
};

/**
 * Districts are stroked in their own fill colour, which closes the antialiasing seam between two
 * that share a language — a language region has to read as one shape, not as a grid of tiles.
 * The two absences are stroked by the stylesheet instead: a pattern makes a poor hairline.
 */
const strokePaint = (fill: DistrictFill | undefined): string | null =>
  fill?.kind === 'category' ? fill.colour : null;

/**
 * The ceasefire line's own label. Not a tier: one line, named along itself.
 *
 * Two forms, because in a crowded frame the choice is between shortening this name and drawing it
 * through someone else's. The abbreviation is the one every map of Kashmir uses, and it is a
 * concession made only when the full name has nowhere clear to go — never a first choice.
 */
const LOC_LABEL = 'Line of Control';
const LOC_LABEL_SHORT = 'LoC';
const LOC_TYPE = { size: 9.5, tracking: 1.6 };

/**
 * How the line's name is placed. `offset` clears the dash; `minRun` is the shortest visible
 * stretch worth naming, so a reader zoomed onto a corner of it is not told what a 20px stub is.
 */
const LOC_LABEL_OPTIONS = { margin: 10, offset: 11, minRun: 70, reach: 34 };

/** An axis-aligned box in screen px, for keeping the line's name off the names already placed. */
interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Everything the map draws that is not the baseline — the whole of what a selection changes.
 *
 * Passed in whole rather than assembled here: which basis shades, which variant draws and what a
 * hover says about it are decisions made in `lib/`, under test, and the renderer is the one part
 * of this app that carries none. A view is a complete answer, so there is no state in here that
 * can be half-switched — the baseline is the view with every field empty.
 */
export interface MapView {
  /** Stratum 1, per district. Null for a map with no data stratum at all. */
  readonly fill: ReadonlyMap<string, DistrictFill> | null;
  /** Stratum 3's shapes, for label anchors. Null at the baseline. */
  readonly units: UnitTier | null;
  /** Stratum 3's line work, drawn by arc so the ceasefire line stays a dash. Null at the baseline. */
  readonly boundaries: readonly UnitBoundary[] | null;
  /** What the active variant makes of a district, for the tooltip's third line. */
  readonly membershipOf: ((district: string) => UnitMembership | null) | null;
  /** The one sentence a screen reader gets, since `role="img"` hides the shapes. */
  readonly description: string;
}

/**
 * The live SVG, and the rectangle of it worth putting in an image (#32).
 *
 * The crop is the map's own answer because the map is the only thing that knows it: the country's
 * extent is a projection question, and where the names ended up is a layout question, and both are
 * settled in here. It is the union of the drawn land and every name and dot placed over it, clipped
 * to the frame — so a reader zoomed into Balochistan exports Balochistan, and an unzoomed frame on
 * a wide desktop exports the country rather than the country between two panels of empty paper.
 *
 * The labels are in the union rather than the land alone, which is the whole reason this is not one
 * line of arithmetic: the ceasefire line's name is deliberately placed on *clear paper* beside the
 * line, and a crop taken to the coastline would slice it off the one image that travels without a
 * page to explain the dash.
 */
export interface MapImage {
  readonly svg: SVGSVGElement;
  readonly crop: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

export interface MapHandle {
  /** Draw a view. The transition between two views is a cross-fade, never a cut. */
  show(view: MapView): void;
  /**
   * Hold the map still and hand it to `take`, which photographs it (#32).
   *
   * A callback rather than a getter returning the node, because *stilling the map* and *reading the
   * map* have to be one operation. Both of this map's animations have to be settled for the length
   * of the read — the strata fade in CSS and the outlines fade in the renderer — and a getter would
   * either leave the caller to suspend them (reaching into the map's own element and its own
   * stylesheet from outside) or return a node whose styles were still moving. Owning both ends here
   * keeps the knowledge of what animates in the one file that animates it, and guarantees the map is
   * restored afterwards whatever `take` does.
   */
  photograph<T>(take: (image: MapImage) => T): T;
}

export function renderMap(
  container: HTMLElement,
  topology: Topology,
  /**
   * The context bundle (#8) — neighbour silhouettes and city dots. A second topology and not a
   * second tier: nothing in it shares an arc with anything in `topology`, nothing in it is ever
   * asked a question, and it is drawn beneath everything.
   */
  context: Topology,
  /** The census join, for the hover tooltip. Read here, decided in `lib/tooltip.ts`. */
  statistics: CensusStatistics,
  initial: MapView,
): MapHandle {
  const geography = readGeography(topology);
  const districts = readDistricts(topology);
  const silhouettes = readSilhouettes(context);
  const cities = readCities(context);
  const citySites: CitySite[] = cities.features.map((f) => ({
    name: f.properties.name,
    anchor: f.geometry.coordinates as [number, number],
  }));
  const locate = districtLocator(districts);
  const provinceOf = new Map(
    geography.provinces.features.map((f) => [f.properties.name, f] as const),
  );
  const kindOf = new Map(
    geography.provinces.features.map((f) => [f.properties.name, f.properties.kind]),
  );

  let view = initial;
  /**
   * The names on screen, and what each is. Recomputed only when the view changes: the anchors are
   * an interior search over 156-district unions, which is cheap once per variant and not once per
   * zoom frame.
   */
  let sites: LabelSite[] = [];
  let tierOf = new Map<string, LabelTier>();
  /** Which kind of unit a unit label names, so the name can be set in its own outline's colour. */
  let unitKindOf = new Map<string, UnitKind>();

  /**
   * District names, built once and only if a reader ever zooms far enough to want them (#34).
   *
   * Lazy because it is not free — `labelAnchor` runs an interior search on any district whose
   * centroid falls outside itself — and because most readers never cross the threshold. Built from
   * the drawn set, so it follows the bundle rather than a second list.
   */
  let districtSites: LabelSite[] | null = null;
  const districtNames = (): LabelSite[] =>
    (districtSites ??= districtLabelSites(districts.features as never));

  function readSites(): void {
    sites =
      view.units === null
        ? baselineLabelSites(geography, citySites)
        : variantLabelSites(geography, view.units.features, citySites);
    tierOf = new Map(sites.map((site) => [site.key, site.tier]));
    unitKindOf = new Map(
      (view.units?.features ?? []).map((f) => [
        labelKey('unit', f.properties.name),
        f.properties.kind,
      ]),
    );
  }

  const lineOfControl = readLineOfControl(topology);
  const locArcs = arcsOf(topology.objects['lineOfControl'] as never);

  // Every arc of the outline, sorted into the one stratum that draws it. The territories' own
  // border is separated from the provinces' because they are a different kind of unit; the
  // ceasefire line is separated from both because it is a different kind of *line*.
  const provinceArcs = tierArcs(topology, 'provinces');
  const outline = new Set([...provinceArcs.values()].flatMap((arcs) => [...arcs]));
  const territory = new Set(
    [...provinceArcs]
      .filter(([name]) => kindOf.get(name) === 'territory')
      .flatMap(([, arcs]) => [...arcs]),
  );
  const divisionInterior = new Set(
    [...tierArcs(topology, 'divisions').values()]
      .flatMap((arcs) => [...arcs])
      .filter((arc) => !outline.has(arc)),
  );

  const borders = {
    province: linesFromArcs(
      topology,
      [...outline].filter((arc) => !territory.has(arc) && !locArcs.has(arc)),
    ),
    territory: linesFromArcs(
      topology,
      [...territory].filter((arc) => !locArcs.has(arc)),
    ),
    division: linesFromArcs(topology, divisionInterior),
  };

  const svg = select(container)
    .append('svg')
    .attr('class', 'map')
    .attr('role', 'img')
    // One label for the whole graphic: `role="img"` means assistive technology never reaches the
    // paths inside it, so anything the map says has to be said here or in the readout below it.
    // It says what is on screen, so it is set by `setDataFill` rather than fixed here.
    .attr('tabindex', 0);

  const defs = svg.append('defs');
  // Territories are hatched rather than tinted a different colour. A different tint would read
  // as a data category under a basis, and the baseline carries no data (D14). A hatch reads as a
  // different *kind* of unit, which is what AJK and GB are (D12) — and, unlike a wash or a
  // dotted outline, it says so without saying "faint", "provisional" or "less".
  const hatch = defs
    .append('pattern')
    .attr('id', 'territory-hatch')
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 6)
    .attr('height', 6)
    .call((pattern) => {
      pattern.append('rect').attr('width', 6).attr('height', 6).attr('class', 'hatch-ground');
      pattern.append('line').attr('y2', 6).attr('class', 'hatch-rule');
    });

  // The census counted this district and named no dominant tongue. A stipple, deliberately not a
  // hatch: AJK and GB are already hatched, and the two absences must not look like one another.
  // Dots read as "nothing recorded here"; a flat grey would read as a sixteenth category.
  defs
    .append('pattern')
    .attr('id', 'no-dominant-stipple')
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 5)
    .attr('height', 5)
    .call((pattern) => {
      pattern.append('rect').attr('width', 5).attr('height', 5).attr('class', 'stipple-ground');
      pattern
        .append('circle')
        .attr('class', 'stipple-dot')
        .attr('cx', 1.5)
        .attr('cy', 1.5)
        .attr('r', 0.8);
      pattern
        .append('circle')
        .attr('class', 'stipple-dot')
        .attr('cx', 4)
        .attr('cy', 4)
        .attr('r', 0.8);
    });

  const world = svg.append('g').attr('class', 'world');
  // Below everything, including the land: OSM draws these four as they are administered, so none
  // of them reaches over ground Pakistan administers — but drawing them underneath means that
  // even if upstream changed its mind, no silhouette could appear over a Pakistani district.
  const contextLayer = world.append('g').attr('class', 'stratum-context');
  const landLayer = world.append('g').attr('class', 'stratum-land');
  // Stratum 1 — fill = data, never unit membership (D14). Above the land so it replaces it, below
  // the boundary rules so those keep reading over the top of it.
  const fillLayer = world.append('g').attr('class', 'stratum-fill');
  // The hover wash is a fill and never a stroke: an outline drawn under the pointer would put a
  // second line along the ceasefire line, solid, which is the one thing this map must not draw.
  // Above the data fill, so the wash reads over a shaded district as well as an unshaded one.
  const hoverLayer = world.append('g').attr('class', 'stratum-hover');
  const divisionLayer = world.append('g').attr('class', 'stratum-divisions');
  const provinceLayer = world.append('g').attr('class', 'stratum-provinces');
  // Stratum 3, in two layers that carry the same join: a casing in the paper's own colour under
  // the outline itself. A single heavy stroke is legible over the unshaded land and disappears
  // into a busy categorical fill, which is exactly the map where a proposal's edge matters most.
  const unitCasingLayer = world.append('g').attr('class', 'stratum-units stratum-units-casing');
  const unitLayer = world.append('g').attr('class', 'stratum-units stratum-units-line');
  const locLayer = world.append('g').attr('class', 'stratum-loc');
  // Labels live outside the zoomed group and are positioned in screen space, so type stays the
  // size it was designed at however far the reader zooms in. The city dots are in screen space for
  // the same reason and drawn from the same pass: a circle has no `vector-effect` for its radius,
  // so a dot inside the zoomed group would grow into a blot at 24×.
  const cityLayer = svg.append('g').attr('class', 'stratum-cities');
  const labelLayer = svg.append('g').attr('class', 'stratum-labels');
  const locLabelLayer = svg.append('g').attr('class', 'stratum-labels');

  const ruler = document.createElement('canvas').getContext('2d');
  // Measured as the browser will draw it: province names are set in caps by the stylesheet, and
  // caps run a quarter wider. Measuring the lower-case string is how labels come to overlap
  // despite a layout that says they cannot.
  const measure: Measurer = (text, tier) => {
    const { size, tracking, caps } = TYPE[tier];
    const drawn = caps ? text.toUpperCase() : text;
    if (ruler === null) return { width: drawn.length * size * 0.62, height: size };
    ruler.font = `${size}px ${SERIF}`;
    return { width: ruler.measureText(drawn).width + tracking * drawn.length, height: size };
  };

  /**
   * The cursor tooltip (#13), and its spoken twin.
   *
   * The visible box follows the pointer, which is where a reader's attention already is. The
   * readout beside it carries the same words to a screen reader and is not drawn: `role="img"`
   * on the SVG means assistive technology never reaches the paths, so a live region is the only
   * way a hover says anything at all. It was a visible corner panel until this ticket, when the
   * tooltip took over saying it on screen — two boxes saying the same sentence is one too many.
   */
  const tooltip = select(container)
    .append('div')
    .attr('class', 'tooltip')
    .attr('aria-hidden', 'true');
  const readout = select(container)
    .append('div')
    .attr('class', 'readout')
    .attr('role', 'status')
    .attr('aria-live', 'polite');

  const zoomBehaviour = zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, 24])
    .on('zoom', (event: { transform: ZoomTransform }) => {
      world.attr('transform', event.transform.toString());
      // The hatch is defined in the zoomed group's user space, so without this its pitch grows
      // with the transform and the territories read as plain fill at anything past a light zoom.
      // Counter-scaling keeps the texture the same texture at 1× and at 24×.
      hatch.attr('patternTransform', `rotate(45) scale(${1 / event.transform.k})`);
      drawLabels(event.transform);
    });
  svg.call(zoomBehaviour);
  hatch.attr('patternTransform', 'rotate(45) scale(1)');

  /**
   * Hover, asked of the geometry rather than of the DOM.
   *
   * The pointer is taken back through the zoom transform and then through the projection, and
   * the district is found in lon/lat by `districtLocator` — so hover works identically whether
   * stratum 1 is drawn or not, and the district paths keep `pointer-events: none`. Bound to the
   * SVG rather than to 156 paths: one listener, and the sea answers as clearly as the land.
   */
  /** What is under a point on the SVG, asked in lon/lat rather than of the DOM. */
  function districtAt(at: [number, number]): DistrictFeature | null {
    const ground = project.invert?.(zoomTransformOf().invert(at));
    return ground === undefined || ground === null ? null : locate.at(ground as [number, number]);
  }

  /*
   * A finger is not a pointer that hovers (#33), so it is given the other gesture.
   *
   * Down and up are tracked rather than moves: on a touchscreen every pan across the country is a
   * `pointermove`, and answering those would drag a tooltip along behind the thumb over the ground
   * it covers. `pointerleave` arrives on the lift rather than on leaving anything, so it is left to
   * the pointers that mean it — a finger's tooltip stays until another tap moves or dismisses it,
   * which is the only way to put one away on a device with nowhere to move the pointer *to*.
   *
   * Both decisions — which pointer taps, and what a tap does — are `lib/touch.ts`'s and under test.
   */
  let touch: { readonly at: [number, number]; readonly began: number } | null = null;
  /** The most fingers down at any moment of the gesture, so a pinch is never read as a tap. */
  let fingers = 0;

  svg
    .on('pointermove', (event: PointerEvent) => {
      if (selectsByTap(event.pointerType)) return;
      const at = pointer(event, svg.node()) as [number, number];
      const found = districtAt(at);
      if (found === null) clearHover();
      else showDistrict(found, at);
    })
    .on('pointerleave', (event: PointerEvent) => {
      if (selectsByTap(event.pointerType)) return;
      clearHover();
    })
    .on('pointerdown', (event: PointerEvent) => {
      if (!selectsByTap(event.pointerType)) return;
      fingers = touch === null ? 1 : fingers + 1;
      if (touch !== null) return;
      touch = { at: pointer(event, svg.node()) as [number, number], began: event.timeStamp };
    })
    .on('pointerup pointercancel', (event: PointerEvent) => {
      if (!selectsByTap(event.pointerType) || touch === null) return;
      const at = pointer(event, svg.node()) as [number, number];
      const candidate = {
        downAt: touch.at,
        upAt: at,
        heldMs: event.timeStamp - touch.began,
        pointers: fingers,
      };
      touch = null;
      fingers = 0;
      // A pan and a pinch are the map being moved, and the map has already answered them. Only a
      // still, brief, single finger means "this one".
      if (event.type === 'pointercancel' || !isTap(candidate)) return;
      const found = districtAt(at);
      if (tapResolves(found?.properties.name ?? null, hovered) === 'dismiss') clearHover();
      else if (found !== null) showDistrict(found, at);
    });

  let project = fitProjection(geography.provinces, { width: 1, height: 1, padding: 0 });
  let size = { width: 0, height: 0 };
  /** The middle of the drawn country, in unzoomed screen px. The line's name is pushed away
   * from it, which is what keeps the name off Pakistani ground wherever the line turns. */
  let interior: [number, number] = [0, 0];
  /** Unzoomed on-screen width of each named shape, refreshed whenever the projection is refitted. */
  const shapeWidth = new Map<string, number>();

  /**
   * The ceasefire line's name, laid along whichever part of the line is on screen.
   *
   * Placed *after* the tier names and around them rather than competing with them. Giving it a
   * winning priority in the shared layout cost Azad Kashmir and Islamabad their own names, which
   * is not a trade this map may make — the territories are drawn *and named* (D12). It does not
   * need to win: it has the whole length of the line to be placed along, so it walks until it
   * finds room instead of taking someone else's.
   */
  function locLabel(transform: ZoomTransform, taken: readonly Rect[]): PlacedLineLabel | null {
    const projected = lineOfControl.geometry.coordinates.map((chain) =>
      chain.flatMap((point) => {
        const screen = project(point as [number, number]);
        return screen === null ? [] : [transform.apply(screen) as [number, number]];
      }),
    );
    // Never over another name; preferably not over drawn land either. Ground is asked of the
    // geography rather than of the DOM, and both are asked only until a candidate answers.
    //
    // "Clear paper" has to mean paper, not merely ground outside Pakistan. Until #8 the far side
    // of the ceasefire line was blank, so the two were the same question and asking only about
    // the provinces answered it. Now India is drawn there, and a placement scored as clear would
    // in fact be sitting on a silhouette — the top-ranked spot would be the one over foreign
    // ground rather than the one over none. Both sides are asked, so the ordering means again
    // what CLAUDE.md says it means.
    const form = (text: string) => ({
      text,
      permits: (candidate: PlacedLineLabel) =>
        !taken.some((other) => overlaps(footprint(candidate, text), other)),
      prefers: (candidate: PlacedLineLabel) => {
        const ground = project.invert?.(transform.invert([candidate.x, candidate.y]));
        return (
          ground === undefined ||
          ground === null ||
          (!geoContains(geography.provinces as never, ground) &&
            !geoContains(silhouettes as never, ground))
        );
      },
    });

    return labelAlongLine(projected, {
      ...LOC_LABEL_OPTIONS,
      bounds: size,
      awayFrom: transform.apply(interior) as [number, number],
      forms: [form(LOC_LABEL), form(LOC_LABEL_SHORT)],
    });
  }

  /**
   * The rectangle a name on its side actually occupies. A label measured lying flat and drawn
   * rotated reserves the wrong ground, which is how a division name comes to sit across it.
   */
  function footprint(placed: PlacedLineLabel, text: string): Rect {
    const width =
      ruler === null
        ? text.length * LOC_TYPE.size * 0.62
        : (() => {
            ruler.font = `${LOC_TYPE.size}px ${SERIF}`;
            return ruler.measureText(text.toUpperCase()).width + LOC_TYPE.tracking * text.length;
          })();
    const radians = (placed.angle * Math.PI) / 180;
    const [cos, sin] = [Math.abs(Math.cos(radians)), Math.abs(Math.sin(radians))];
    const half = [
      (width * cos + LOC_TYPE.size * sin) / 2,
      (width * sin + LOC_TYPE.size * cos) / 2,
    ] as const;
    return {
      x0: placed.x - half[0],
      y0: placed.y - half[1],
      x1: placed.x + half[0],
      y1: placed.y + half[1],
    };
  }

  /**
   * The ground the docked tooltip is standing on, for the label layout to keep off (#33).
   *
   * Empty on every wide screen and empty whenever no district is showing, so on a desktop this
   * costs the layout nothing at all. On a phone the box is an opaque bar across the top of the
   * frame — which is northern Pakistan, where Gilgit-Baltistan, Azad Kashmir and the ceasefire
   * line's own name sit — and the four-step yielding order has to see it, or a reader loses both
   * the box and the name it landed on. Measured from the element rather than assumed, because its
   * height is whatever the district's own figures came to.
   */
  function dockedTooltip(): readonly { x0: number; y0: number; x1: number; y1: number }[] {
    const node = tooltip.node() as HTMLElement | null;
    if (node === null || hovered === null || !isSheetLayout()) return [];
    const well = container.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return [];
    return [
      {
        x0: box.left - well.left,
        y0: box.top - well.top,
        x1: box.right - well.left,
        y1: box.bottom - well.top,
      },
    ];
  }

  function drawLabels(transform: ZoomTransform): void {
    // The dots are drawn unconditionally; only their names take part in the layout below. That is
    // the yielding rule the ceasefire line's name already follows, applied to a point: the datum
    // is the position, and the name is what gives way when the frame is crowded — a dot with no
    // name still tells a reader where a place is relative to a boundary, which is what it is for.
    const dots = cities.features.flatMap((f) => {
      const point = project(f.geometry.coordinates as [number, number]);
      if (point === null) return [];
      const [x, y] = transform.apply(point);
      return [{ name: f.properties.name, kind: f.properties.kind, x, y }];
    });
    cityLayer
      .selectAll<SVGCircleElement, (typeof dots)[number]>('circle')
      .data(dots, (dot) => dot.name)
      .join('circle')
      .attr('class', (dot) => `city-dot city-dot-${dot.kind}`)
      .attr('r', 2.2)
      .attr('cx', (dot) => dot.x)
      .attr('cy', (dot) => dot.y);

    const drawn = new Map<string, string>();
    /*
     * The districts join the contest only past the threshold, and they join it *last* — ranked
     * under every other tier, so a district name can never take the frame from the province it
     * sits in. Below the threshold they are not measured at all, which is what keeps 156 extra
     * boxes off the layout on the phone frame that cannot afford them.
     */
    const named =
      transform.k >= DISTRICT_LABEL_ZOOM ? [...sites, ...districtNames()] : sites;
    // Built from what is actually being laid out, not from the view's own tier map: the districts
    // are not in that one, and a name whose tier does not resolve is set with no class at all.
    const tierByKey = new Map(named.map((site) => [site.key, site.tier]));
    const boxes = named.flatMap((site) => {
      const point = project(site.anchor);
      if (point === null) return [];
      // How wide the shape is on screen right now, which is what decides whether its name fits
      // inside it. It grows as the reader zooms, so abbreviations expand back into full names.
      const shape = shapeWidth.get(site.key) ?? Infinity;
      const { box, text } = measureLabel(site, transform.apply(point), shape * transform.k, measure);
      drawn.set(site.key, text);
      return [box];
    });

    const placed = layoutLabels(boxes, { bounds: size, gap: 3, occupied: dockedTooltip() });
    labelLayer
      .selectAll<SVGTextElement, { key: string; x: number; y: number }>('text')
      .data(placed, (label) => label.key)
      .join('text')
      // A unit's name is set in its own outline's colour, which is what ties the two together
      // without filling the unit — the fill belongs to the data and to nothing else (D14).
      .attr('class', (label) => {
        const kind = unitKindOf.get(label.key);
        const tier = tierByKey.get(label.key) ?? tierOf.get(label.key);
        return `label label-${tier}${kind === undefined ? '' : ` label-unit-${kind}`}`;
      })
      .attr('x', (label) => label.x)
      .attr('y', (label) => label.y)
      .text((label) => drawn.get(label.key) ?? '');

    const sized = new Map(boxes.map((box) => [box.key, box]));
    const taken = placed.flatMap((label) => {
      const box = sized.get(label.key);
      return box === undefined
        ? []
        : [
            {
              x0: label.x - box.width / 2,
              y0: label.y - box.height / 2,
              x1: label.x + box.width / 2,
              y1: label.y + box.height / 2,
            },
          ];
    });

    /*
     * The docked box is put to the ceasefire line's name as well, and not only to the tier names.
     *
     * It is a separate placement path with its own `taken` list, and leaving it out was worse than
     * doing nothing: the tier names yielded from under the bar, which freed the north, and the
     * line's name then walked into exactly that space and set itself — at full length — underneath
     * an opaque box. The four-step order ends in "no name at all" rather than in a name a reader
     * cannot see (D12).
     */
    const line = locLabel(transform, [...dockedTooltip(), ...taken]);
    locLabelLayer
      .selectAll<SVGTextElement, PlacedLineLabel>('text')
      .data(line === null ? [] : [line])
      .join('text')
      .attr('class', 'label label-loc')
      .attr('x', (label) => label.x)
      .attr('y', (label) => label.y)
      .attr('transform', (label) => `rotate(${label.angle} ${label.x} ${label.y})`)
      .text((label) => label.text);
  }

  /** The district the pointer is in, so a move inside one costs no rebuild. */
  let hovered: string | null = null;
  /** The tooltip's own size, measured once per district rather than once per pointer event. */
  let tooltipSize = { width: 0, height: 0 };

  /**
   * Show the district under the pointer: wash the district, wash the province it belongs to, and
   * set the tooltip beside the cursor.
   *
   * Both highlights are fills and neither is a stroke. An outline drawn under the pointer along
   * Azad Kashmir or Gilgit-Baltistan would put a second, solid line along the ceasefire line,
   * which is the one thing this map must not draw (D12).
   */
  function showDistrict(feature: DistrictFeature, at: [number, number]): void {
    const path = geoPath(project);
    if (feature.properties.name !== hovered) {
      hovered = feature.properties.name;
      // Standing comes from the province the district sits in; whether it has *figures* comes
      // from whether the census has a row for it, which is `districtTooltip`'s question.
      //
      // Both lookups throw rather than falling back, for the reason `readGeography` gives: a
      // missing `kind` defaulted to `province` prints "Province" under Muzaffarabad, which is a
      // constitutional claim this app does not make (D12), and a district whose province is not
      // in the tier means the bundle has come apart and is to be fixed, not rendered around.
      const province = provinceOf.get(feature.properties.province);
      const kind = kindOf.get(feature.properties.province);
      if (province === undefined || kind === undefined) {
        throw new Error(
          `${feature.properties.name} sits in "${feature.properties.province}", which is not a ` +
            `province in this bundle. The district and province tiers disagree.`,
        );
      }
      const content = districtTooltip(
        feature.properties,
        kind,
        statistics,
        view.membershipOf?.(feature.properties.name) ?? null,
      );
      renderTooltip(content);
      readout.text(spokenTooltip(content));

      hoverLayer
        .selectAll<SVGPathElement, { role: string; d: string | null }>('path')
        .data([
          { role: 'province', d: path(province) },
          { role: 'district', d: path(feature) },
        ])
        .join('path')
        .attr('class', (d) => `hover-wash hover-wash-${d.role}`)
        .attr('d', (d) => d.d);
    }
    place(at);
    relayoutUnderDock();
  }

  /**
   * True only while `draw()` is rebuilding, so the two paths do not lay the names out twice.
   *
   * `draw()` clears the hover on its way through and lays the labels out itself at the end, against
   * a projection it has not refitted yet at the moment it clears. Without this the clear would run
   * a layout against the *old* cone and have it immediately thrown away.
   */
  let redrawing = false;

  /**
   * The docked box appeared or went away, so the names get another go at the frame.
   *
   * Only on a phone, and only a label pass — no re-projection and no re-fit, which is the whole
   * reason this is cheap enough to run on a tap. On a desktop the tooltip follows the pointer and
   * takes part in no layout, so this does nothing at all.
   */
  function relayoutUnderDock(): void {
    if (redrawing || !isSheetLayout()) return;
    drawLabels(zoomTransformOf());
  }

  /**
   * Where the box sits, recomputed on every move: the decision is `placeTooltip`'s.
   *
   * The box is measured when its content changes, not when it moves. Reading its rectangle on
   * every pointer event forces a layout on every event, which is exactly the perceptible lag the
   * ticket asks not to have.
   */
  function place(at: [number, number]): void {
    const node = tooltip.node() as HTMLElement;
    /*
     * On a phone the box docks to the top of the map instead of following the pointer (#33), and
     * the stylesheet puts it there — so the inline placement is *removed* rather than recomputed.
     *
     * Two reasons, and the first is not cosmetic. The pointer is a finger, and it is standing on
     * the district whose figures the box is about: a tooltip beside the finger is a tooltip over
     * the answer. The second is that the sheet overlays the lower part of the map, so a box placed
     * against the map's own frame can be clamped perfectly inside it and still come out underneath
     * the card — clipped at whichever line the sheet happens to reach.
     */
    if (isSheetLayout()) {
      node.style.removeProperty('left');
      node.style.removeProperty('top');
      return;
    }
    const placed = placeTooltip(at, tooltipSize, size, { gap: 14, margin: 8 });
    node.style.left = `${placed.x}px`;
    node.style.top = `${placed.y}px`;
  }

  function clearHover(): void {
    const wasShowing = hovered !== null;
    hovered = null;
    tooltip.classed('is-shown', false).text('');
    readout.text('');
    hoverLayer.selectAll('path').remove();
    // The names that gave way to the docked box get their ground back.
    if (wasShowing) relayoutUnderDock();
  }

  /**
   * Built as elements rather than as markup, so a district name is text and can never be read as
   * HTML — and so the absences keep their own shapes. A figure with no value prints its note and
   * no value at all: no dash, no "N/A", nothing that could be mistaken for a zero.
   */
  function renderTooltip(content: DistrictTooltip): void {
    const node = tooltip.classed('is-shown', true).node() as HTMLElement;
    node.replaceChildren();
    const line = (className: string, text: string, parent: HTMLElement = node): HTMLElement => {
      const element = parent.appendChild(document.createElement('span'));
      element.className = className;
      element.textContent = text;
      return element;
    };

    line('tooltip-name', content.name);
    line('tooltip-where', `${content.division} division · ${content.province}`);
    if (content.standing !== 'Province') line('tooltip-standing', content.standing);

    for (const figure of content.figures) {
      const row = node.appendChild(document.createElement('span'));
      row.className = 'tooltip-figure';
      line('tooltip-label', figure.label, row);
      if (figure.value !== null) line('tooltip-value', figure.value, row);
      if (figure.note !== null) line('tooltip-note', figure.note, row);
      if (figure.source !== null) line('tooltip-source', figure.source, row);
    }

    if (content.absence !== null) line('tooltip-absence', content.absence);

    // Last, and in its own block: the two lines above it are what the census recorded, and this
    // one is what somebody proposes. A proposal set among the figures would read as one of them.
    if (content.unit !== null) {
      const row = node.appendChild(document.createElement('span'));
      row.className = `tooltip-figure tooltip-unit tooltip-unit-${content.unit.kind ?? 'none'}`;
      line('tooltip-label', content.unit.label, row);
      if (content.unit.value !== null) line('tooltip-value', content.unit.value, row);
      if (content.unit.note !== null) line('tooltip-note', content.unit.note, row);
    }

    const { width, height } = node.getBoundingClientRect();
    tooltipSize = { width, height };
  }

  /** d3-zoom keeps the current transform on the node itself; a resize must not reset it. */
  const zoomTransformOf = (): ZoomTransform =>
    (svg.node() as SVGSVGElement & { __zoom?: ZoomTransform }).__zoom ?? zoomIdentity;

  function draw(): void {
    const { width, height } = container.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    redrawing = true;
    try {
      redraw(width, height);
    } finally {
      redrawing = false;
    }
  }

  function redraw(width: number, height: number): void {
    size = { width, height };
    // The washes were drawn against the old projection, and the tooltip was placed against the
    // old frame. Both are about a pointer that is no longer where it was.
    clearHover();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // The whole country, not one province, decides the cone: the frame must hold every variant
    // that will later be drawn into it, and all of them cover the same ground.
    project = fitProjection(geography.provinces, { width, height, padding: frameInset(width) });
    const path = geoPath(project);
    interior = path.centroid(geography.provinces as never) as [number, number];

    contextLayer
      .selectAll<SVGPathElement, (typeof silhouettes.features)[number]>('path')
      .data(silhouettes.features, (f) => f.properties.iso)
      .join('path')
      .attr('class', 'neighbour')
      .attr('d', (f) => path(f));

    landLayer
      .selectAll<SVGPathElement, (typeof geography.provinces.features)[number]>('path')
      .data(geography.provinces.features)
      .join('path')
      .attr('class', (f) => `land land-${f.properties.kind}`)
      .attr('d', (f) => path(f));

    fillLayer
      .selectAll('path')
      .data(districts.features)
      .join('path')
      .attr('d', (f) => path(f));
    paintDistricts();

    divisionLayer
      .selectAll('path')
      .data([borders.division])
      .join('path')
      .attr('class', 'division')
      .attr('d', (f) => path(f));

    provinceLayer
      .selectAll('path')
      .data([
        { kind: 'province', lines: borders.province },
        { kind: 'territory', lines: borders.territory },
      ])
      .join('path')
      .attr('class', (d) => `province province-${d.kind}`)
      .attr('d', (d) => path(d.lines));

    drawUnits(path, false);

    // Drawn last of the boundary strata and alone along its own stretch, so nothing is beneath
    // it filling the gaps back in. A dash with a solid line under it is a solid line.
    locLayer
      .selectAll('path')
      .data([lineOfControl])
      .join('path')
      .attr('class', 'line-of-control')
      .attr('d', (f) => path(f));

    measureShapes(path);

    // Panning is bounded by the frame, so the country cannot be dragged off screen and lost.
    zoomBehaviour.translateExtent([
      [0, 0],
      [width, height],
    ]);
    drawLabels(zoomTransformOf());
  }

  /**
   * Stratum 1's paint, which is the only thing about a district that a change of basis changes.
   *
   * `no-data` takes no fill and no stroke at all, so the unshaded baseline underneath shows
   * through: AJK and GB keep their land tone and their territory hatch, and the basis visibly
   * does not reach them. The stroke elsewhere is the fill's own colour — a hairline that closes
   * the antialiasing seam between two districts that share a language, so a language region
   * reads as one shape rather than as a grid of tiles.
   */
  function paintDistricts(): void {
    fillLayer
      .selectAll<SVGPathElement, (typeof districts.features)[number]>('path')
      .attr('class', (f) => `district district-${view.fill?.get(f.properties.name)?.kind ?? 'none'}`)
      .attr('fill', (f) => fillPaint(view.fill?.get(f.properties.name)))
      .attr('stroke', (f) => strokePaint(view.fill?.get(f.properties.name)));
  }

  /**
   * Stratum 3: one cased outline per unit, joined on the unit's own id.
   *
   * Joining on the id rather than on position is what makes switching variants a change rather
   * than a redraw — a unit both variants contain keeps its element, and only what actually
   * differs fades. `animate` is false whenever the frame or the projection moved, because a
   * resize is not a change of variant and should not look like one.
   */
  function drawUnits(path: ReturnType<typeof geoPath>, animate: boolean): void {
    const boundaries = view.boundaries ?? [];
    const duration = animate ? switchDuration() : 0;

    for (const [layer, className] of [
      [unitCasingLayer, 'unit-casing'],
      [unitLayer, 'unit-line'],
    ] as const) {
      const join = layer
        .selectAll<SVGPathElement, UnitBoundary>('path')
        .data(boundaries, (boundary) => boundary.properties.unit);

      join
        .exit()
        .transition()
        .duration(duration)
        .attr('opacity', 0)
        .remove();

      join
        .enter()
        .append('path')
        .attr('opacity', 0)
        .attr('d', (b) => path(b.lines))
        .transition()
        .duration(duration)
        .attr('opacity', 1);

      layer
        .selectAll<SVGPathElement, UnitBoundary>('path')
        .attr('class', (b) => `${className} ${className}-${b.properties.kind}`);
      join.each(function move(b) {
        moveEdge(select(this), path(b.lines), duration);
      });
    }
  }

  /**
   * Move a unit's edge from where the last variant put it to where this one does.
   *
   * A path string is not interpolable — two outlines have different numbers of vertices, and
   * tweening the text between them draws nonsense — so the swap is made at the *trough of a
   * dissolve*: out, change, back in. Which is the criterion the ticket actually asks for, since
   * what a reader needs to see is that this edge moved, not a rubber sheet pretending it slid.
   *
   * An edge that has not moved is left alone. A unit both variants contain unchanged must not
   * flicker, or every switch would announce eight changes and mean one.
   */
  function moveEdge(
    element: ReturnType<typeof select<SVGPathElement, UnitBoundary>>,
    edge: string | null,
    duration: number,
  ): void {
    if (duration === 0 || element.attr('d') === edge) {
      element.interrupt().attr('d', edge).attr('opacity', 1);
      return;
    }
    element
      .transition()
      .duration(duration / 2)
      .attr('opacity', 0)
      .transition()
      .duration(duration / 2)
      .on('start', function swap() {
        select(this).attr('d', edge);
      })
      .attr('opacity', 1);
  }

  /**
   * How wide each named shape is on screen, which is what decides whether its own name fits
   * inside it. Units are measured alongside the tiers because they are named on the same terms:
   * an abbreviation fires for "Khyber Pakhtunkhwa" whether it is a province or a unit.
   */
  function measureShapes(path: ReturnType<typeof geoPath>): void {
    shapeWidth.clear();
    const measured: readonly (readonly [LabelTier, readonly { properties: { name: string } }[]])[] =
      [
        ['province', geography.provinces.features],
        ['division', geography.divisions.features],
        ['unit', view.units?.features ?? []],
      ];
    for (const [tier, features] of measured) {
      for (const f of features) {
        const [[west], [east]] = path.bounds(f as never);
        shapeWidth.set(labelKey(tier, f.properties.name), east - west);
      }
    }
  }

  /**
   * How long a switch takes, asked of the stylesheet rather than typed here.
   *
   * The strata fade in CSS and the outlines fade in the renderer, and the two have to agree or a
   * switch half-animates — so there is one number and the stylesheet owns it. It also settles
   * reduced motion for free: `prefers-reduced-motion` sets `--switch` to `0ms`, and a zero
   * duration here is a straight swap. Read per switch, so a reader who changes the setting
   * mid-session is obeyed at once.
   */
  const switchDuration = (): number =>
    Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--switch')) || 0;

  /**
   * Switch views. No re-projection and no re-layout of anything the change did not touch: the
   * district paths are already drawn, so a basis is a repaint, and a variant is one path join.
   */
  function show(next: MapView): void {
    view = next;
    // The tooltip on screen was answered for the previous view, and one of its three lines is
    // about the variant. Clearing is what stops it standing there saying the wrong proposal.
    clearHover();
    readSites();

    svg
      .attr('data-fill', view.fill === null ? null : 'on')
      .attr('data-variant', view.boundaries === null ? null : 'on')
      .attr(
        'aria-label',
        // Whichever strata are on, the ceasefire line is still drawn, so the sentence that says
        // so belongs on every label. `role="img"` means this is the only place it can be said.
        `${view.description}, with the Line of Control drawn dashed. ${lineOfControl.properties.note}`,
      );

    paintDistricts();
    measureShapes(geoPath(project));
    drawUnits(geoPath(project), true);
    drawLabels(zoomTransformOf());
  }

  /**
   * Photograph the map: still it, hand the crop and the node to `take`, and let it go again.
   *
   * Two animations have to be settled and neither settles the other's way. The strata fade in CSS,
   * so the stylesheet's transitions are suspended for the length of the read and every property
   * computes to the value it was already travelling to; stratum 3 fades in this file, so the units
   * are simply drawn again with `animate` false, which interrupts the transition and puts each edge
   * where it was going. Without both, pressing Download inside `--switch` of a variant change bakes
   * one proposal half dissolved into another, with nothing in the picture to say so.
   *
   * The map is left exactly as it was found. Nothing here changes what is drawn — it only finishes
   * arriving at it — and the class comes off in a `finally`, so a throw inside `take` cannot strand
   * the live map with its transitions disabled.
   */
  function photograph<T>(take: (image: MapImage) => T): T {
    const node = svg.node() as SVGSVGElement;
    drawUnits(geoPath(project), false);
    node.classList.add('is-exporting');
    try {
      return take({ svg: node, crop: cropToCountry() });
    } finally {
      node.classList.remove('is-exporting');
    }
  }

  /**
   * The rectangle an export should photograph: the country, and everything named over it.
   *
   * Taken against the *current* transform rather than against the projection alone, so the picture
   * is the one the reader is looking at. At zoom 1 that is the whole country and the crop trims the
   * empty paper either side of it; zoomed in, the frame is already inside the country and the crop
   * is the frame. Clamped to the frame in both cases, because ground scrolled off the edge was
   * never drawn and cannot be photographed.
   *
   * The names are in the union and not just the land, which is the whole reason this is not one
   * line of arithmetic: the ceasefire line's name is deliberately placed on *clear paper* beside the
   * line, and a crop taken to the coastline would slice it off the one image that travels without a
   * page to explain the dash.
   */
  function cropToCountry(): MapImage['crop'] {
    const transform = zoomTransformOf();
    const [[west, north], [east, south]] = geoPath(project).bounds(geography.provinces as never);
    const [left, top] = transform.apply([west, north]);
    const [right, bottom] = transform.apply([east, south]);
    let box = {
      x0: Math.min(left, right),
      y0: Math.min(top, bottom),
      x1: Math.max(left, right),
      y1: Math.max(top, bottom),
    };

    // The names and the dots are drawn in screen space, outside the zoomed group, so their own
    // boxes are already in the crop's coordinates. An empty layer reports a zero box, which would
    // drag the crop to the origin — hence the guard rather than a blind union.
    for (const layer of [labelLayer, locLabelLayer, cityLayer]) {
      const node = layer.node();
      if (node === null) continue;
      const bounds = node.getBBox();
      if (bounds.width === 0 && bounds.height === 0) continue;
      box = {
        x0: Math.min(box.x0, bounds.x),
        y0: Math.min(box.y0, bounds.y),
        x1: Math.max(box.x1, bounds.x + bounds.width),
        y1: Math.max(box.y1, bounds.y + bounds.height),
      };
    }

    const margin = 10;
    const x = Math.max(0, box.x0 - margin);
    const y = Math.max(0, box.y0 - margin);
    return {
      x,
      y,
      width: Math.max(1, Math.min(size.width, box.x1 + margin) - x),
      height: Math.max(1, Math.min(size.height, box.y1 + margin) - y),
    };
  }

  readSites();
  draw();
  new ResizeObserver(draw).observe(container);
  show(initial);
  return { show, photograph };
}
