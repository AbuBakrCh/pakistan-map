/**
 * The baseline map: current provinces and divisions, named, and nothing else (#4) — with
 * Kashmir drawn honestly (#7).
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
import type { CensusStatistics } from './bundle.ts';
import { linesFromArcs, readDistricts, readGeography, tierArcs } from './lib/geography.ts';
import { districtLocator, type DistrictFeature } from './lib/hit-test.ts';
import {
  districtTooltip,
  placeTooltip,
  spokenTooltip,
  type DistrictTooltip,
} from './lib/tooltip.ts';
import type { DistrictFill } from './lib/mother-tongue.ts';
import {
  baselineLabelSites,
  labelKey,
  layoutLabels,
  measureLabel,
  type LabelTier,
  type Measurer,
} from './lib/labels.ts';
import {
  arcsOf,
  labelAlongLine,
  readLineOfControl,
  type PlacedLineLabel,
} from './lib/line-of-control.ts';
import { fitProjection } from './lib/projection.ts';

/** Must match `--font-serif` in styles.css: the canvas measures what the browser will draw. */
const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif';

/** Mirrors `.label-province` and `.label-division` in styles.css; the canvas measures from it. */
const TYPE: Record<LabelTier, { size: number; tracking: number; caps: boolean }> = {
  // Province names are set larger and tracked out, the way an atlas sets a country's first-level
  // units. Tracking is added to the measured width by hand — canvas cannot measure letter-spacing.
  province: { size: 13, tracking: 1.5, caps: true },
  division: { size: 10.5, tracking: 0, caps: false },
};

/**
 * Frame inset, in px. Proportional, but capped at both ends: a fixed 36px inset would cost a
 * 390px phone a fifth of its map, and a fixed 12px would crowd a desktop frame.
 */
const padding = (width: number) => Math.max(12, Math.min(36, width * 0.05));

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
 * What the caller gets back, so a later ticket can switch strata on without reaching into the
 * DOM. #18 owns the basis selector and the fade-back; this is the seam it will drive.
 */
export interface MapHandle {
  /** Turn stratum 1 — fill = data — on or off. Off is the baseline, unchanged. */
  setDataFill(on: boolean): void;
}

export function renderBaselineMap(
  container: HTMLElement,
  topology: Topology,
  /** The census join, for the hover tooltip. Read here, decided in `lib/tooltip.ts`. */
  statistics: CensusStatistics,
  /**
   * Stratum 1, per district, or null for a map with no data stratum at all. Passed in rather
   * than computed here: which basis is being shaded is not the renderer's decision, and the
   * renderer is the one part of this app with no tests.
   */
  dataFill: ReadonlyMap<string, DistrictFill> | null = null,
): MapHandle {
  const geography = readGeography(topology);
  const districts = readDistricts(topology);
  const locate = districtLocator(districts);
  const provinceOf = new Map(
    geography.provinces.features.map((f) => [f.properties.name, f] as const),
  );
  const sites = baselineLabelSites(geography);
  const tierOf = new Map(sites.map((site) => [site.key, site.tier]));
  const kindOf = new Map(
    geography.provinces.features.map((f) => [f.properties.name, f.properties.kind]),
  );

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
  const locLayer = world.append('g').attr('class', 'stratum-loc');
  // Labels live outside the zoomed group and are positioned in screen space, so type stays the
  // size it was designed at however far the reader zooms in.
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
  svg
    .on('pointermove', (event: PointerEvent) => {
      const at = pointer(event, svg.node()) as [number, number];
      const ground = project.invert?.(zoomTransformOf().invert(at));
      const found =
        ground === undefined || ground === null ? null : locate.at(ground as [number, number]);
      if (found === null) clearHover();
      else showDistrict(found, at);
    })
    .on('pointerleave', clearHover);

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
    const form = (text: string) => ({
      text,
      permits: (candidate: PlacedLineLabel) =>
        !taken.some((other) => overlaps(footprint(candidate, text), other)),
      prefers: (candidate: PlacedLineLabel) => {
        const ground = project.invert?.(transform.invert([candidate.x, candidate.y]));
        return (
          ground === undefined ||
          ground === null ||
          !geoContains(geography.provinces as never, ground)
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

  function drawLabels(transform: ZoomTransform): void {
    const drawn = new Map<string, string>();
    const boxes = sites.flatMap((site) => {
      const point = project(site.anchor);
      if (point === null) return [];
      // How wide the shape is on screen right now, which is what decides whether its name fits
      // inside it. It grows as the reader zooms, so abbreviations expand back into full names.
      const shape = shapeWidth.get(site.key) ?? Infinity;
      const { box, text } = measureLabel(site, transform.apply(point), shape * transform.k, measure);
      drawn.set(site.key, text);
      return [box];
    });

    const placed = layoutLabels(boxes, { bounds: size, gap: 3 });
    labelLayer
      .selectAll<SVGTextElement, { key: string; x: number; y: number }>('text')
      .data(placed, (label) => label.key)
      .join('text')
      .attr('class', (label) => `label label-${tierOf.get(label.key)}`)
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

    const line = locLabel(transform, taken);
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
      const content = districtTooltip(feature.properties, kind, statistics);
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
    const placed = placeTooltip(at, tooltipSize, size, { gap: 14, margin: 8 });
    node.style.left = `${placed.x}px`;
    node.style.top = `${placed.y}px`;
  }

  function clearHover(): void {
    hovered = null;
    tooltip.classed('is-shown', false).text('');
    readout.text('');
    hoverLayer.selectAll('path').remove();
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

    const { width, height } = node.getBoundingClientRect();
    tooltipSize = { width, height };
  }

  /** d3-zoom keeps the current transform on the node itself; a resize must not reset it. */
  const zoomTransformOf = (): ZoomTransform =>
    (svg.node() as SVGSVGElement & { __zoom?: ZoomTransform }).__zoom ?? zoomIdentity;

  function draw(): void {
    const { width, height } = container.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    size = { width, height };
    // The washes were drawn against the old projection, and the tooltip was placed against the
    // old frame. Both are about a pointer that is no longer where it was.
    clearHover();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // The whole country, not one province, decides the cone: the frame must hold every variant
    // that will later be drawn into it, and all of them cover the same ground.
    project = fitProjection(geography.provinces, { width, height, padding: padding(width) });
    const path = geoPath(project);
    interior = path.centroid(geography.provinces as never) as [number, number];

    landLayer
      .selectAll<SVGPathElement, (typeof geography.provinces.features)[number]>('path')
      .data(geography.provinces.features)
      .join('path')
      .attr('class', (f) => `land land-${f.properties.kind}`)
      .attr('d', (f) => path(f));

    // `no-data` takes no fill and no stroke at all, so the unshaded baseline underneath shows
    // through: AJK and GB keep their land tone and their territory hatch, and the basis visibly
    // does not reach them. The stroke elsewhere is the fill's own colour — a hairline that closes
    // the antialiasing seam between two districts that share a language, so a language region
    // reads as one shape rather than as a grid of tiles.
    fillLayer
      .selectAll('path')
      .data(districts.features)
      .join('path')
      .attr('class', (f) => `district district-${dataFill?.get(f.properties.name)?.kind ?? 'none'}`)
      .attr('fill', (f) => fillPaint(dataFill?.get(f.properties.name)))
      .attr('stroke', (f) => strokePaint(dataFill?.get(f.properties.name)))
      .attr('d', (f) => path(f));

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

    // Drawn last of the boundary strata and alone along its own stretch, so nothing is beneath
    // it filling the gaps back in. A dash with a solid line under it is a solid line.
    locLayer
      .selectAll('path')
      .data([lineOfControl])
      .join('path')
      .attr('class', 'line-of-control')
      .attr('d', (f) => path(f));

    shapeWidth.clear();
    for (const [tier, features] of [
      ['province', geography.provinces.features],
      ['division', geography.divisions.features],
    ] as const) {
      for (const f of features) {
        const [[west], [east]] = path.bounds(f);
        shapeWidth.set(labelKey(tier, f.properties.name), east - west);
      }
    }

    // Panning is bounded by the frame, so the country cannot be dragged off screen and lost.
    zoomBehaviour.translateExtent([
      [0, 0],
      [width, height],
    ]);
    drawLabels(zoomTransformOf());
  }

  draw();
  new ResizeObserver(draw).observe(container);

  // The whole of stratum 1 is one attribute on the root, so switching it on costs no re-layout
  // and no re-projection — the paths are already drawn and already coloured.
  const setDataFill = (on: boolean): void => {
    const active = on && dataFill !== null;
    svg.attr('data-data-fill', active ? 'on' : null);
    svg.attr(
      'aria-label',
      // Whichever stratum is on, the ceasefire line is still drawn, so the sentence that says so
      // belongs on both labels. `role="img"` means this is the only place it can be said.
      (active
        ? 'Map of Pakistan, districts shaded by dominant mother tongue at the 2023 census'
        : 'Map of Pakistan showing current provinces, territories and divisions') +
        `, with the Line of Control drawn dashed. ${lineOfControl.properties.note}`,
    );
  };
  setDataFill(false);
  return { setDataFill };
}
