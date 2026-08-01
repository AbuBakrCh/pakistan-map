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

import { geoContains, geoPath, select, zoom, zoomIdentity, type ZoomTransform } from 'd3';
import type { Topology } from 'topojson-specification';
import { describeKind, linesFromArcs, readGeography, tierArcs } from './lib/geography.ts';
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

/** The ceasefire line's own label. Not a tier: one line, named along itself. */
const LOC_LABEL = 'Line of Control';
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

export function renderBaselineMap(container: HTMLElement, topology: Topology): void {
  const geography = readGeography(topology);
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
    .attr(
      'aria-label',
      'Map of Pakistan showing current provinces, territories and divisions, with the Line of ' +
        `Control drawn dashed. ${lineOfControl.properties.note}`,
    )
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

  const world = svg.append('g').attr('class', 'world');
  const landLayer = world.append('g').attr('class', 'stratum-land');
  // The hover wash is a fill and never a stroke: an outline drawn under the pointer would put a
  // second line along the ceasefire line, solid, which is the one thing this map must not draw.
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
   * A readout rather than a cursor tooltip. The tooltip is #13's, and it is about districts and
   * their statistics; what belongs here is the one thing a territory can say for itself — its
   * name and its standing — parked where it will not fight the pointer for the same pixels.
   */
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
    return labelAlongLine(projected, {
      ...LOC_LABEL_OPTIONS,
      bounds: size,
      awayFrom: transform.apply(interior) as [number, number],
      clear: (candidate) => {
        // Not over a name already on the map, and not over ground the map draws. The second is
        // asked of the geography rather than of the DOM, and both are asked only until a
        // candidate answers — in practice the first one does.
        const box = footprint(candidate);
        if (taken.some((other) => overlaps(box, other))) return false;
        const ground = project.invert?.(transform.invert([candidate.x, candidate.y]));
        return (
          ground === undefined ||
          ground === null ||
          !geoContains(geography.provinces as never, ground)
        );
      },
    });
  }

  /**
   * The rectangle a name on its side actually occupies. A label measured lying flat and drawn
   * rotated reserves the wrong ground, which is how a division name comes to sit across it.
   */
  function footprint(placed: PlacedLineLabel): Rect {
    const width =
      ruler === null
        ? LOC_LABEL.length * LOC_TYPE.size * 0.62
        : (() => {
            ruler.font = `${LOC_TYPE.size}px ${SERIF}`;
            return (
              ruler.measureText(LOC_LABEL.toUpperCase()).width + LOC_TYPE.tracking * LOC_LABEL.length
            );
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
      .text(LOC_LABEL);
  }

  /**
   * Name the shape under the pointer, and say what kind of thing it is.
   *
   * Territories are interactive and *say why they carry no numbers* — which is the whole
   * difference between a unit the census does not reach and a unit whose data failed to load
   * (D25). Nothing here is a statistic: the district tooltip and its figures are #13's, and
   * AJK's population reaches this project only relayed through the AJK Bureau of Statistics, so
   * there is no PBS figure for a territory to show even when there are figures to show.
   */
  function showReadout(name: string, kind: Parameters<typeof describeKind>[0], d: string | null) {
    const { status, coverage } = describeKind(kind);
    readout
      .classed('is-shown', true)
      .html(
        `<span class="readout-name">${name}</span>` +
          `<span class="readout-status readout-status-${kind}">${status}</span>` +
          (coverage === null ? '' : `<span class="readout-note">${coverage}</span>`),
      );
    hoverLayer.selectAll('path').data([d]).join('path').attr('class', 'hover-wash').attr('d', d);
  }

  function clearReadout(): void {
    readout.classed('is-shown', false).html('');
    hoverLayer.selectAll('path').remove();
  }

  /** d3-zoom keeps the current transform on the node itself; a resize must not reset it. */
  const zoomTransformOf = (): ZoomTransform =>
    (svg.node() as SVGSVGElement & { __zoom?: ZoomTransform }).__zoom ?? zoomIdentity;

  function draw(): void {
    const { width, height } = container.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    size = { width, height };
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
      .attr('d', (f) => path(f))
      .on('pointerenter', (_event, f) => showReadout(f.properties.name, f.properties.kind, path(f)))
      .on('pointerleave', clearReadout);

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
}
