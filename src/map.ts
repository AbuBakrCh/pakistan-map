/**
 * The baseline map: current provinces and divisions, named, and nothing else (#4).
 *
 * Everything with a decision in it — where a name goes, which names survive a collision, how the
 * cone is cut — lives in `lib/` behind pure functions with tests. What is left here is plumbing:
 * make the SVG, bind the paths, and re-run the label layout whenever the transform changes.
 *
 * Districts are deliberately not drawn. They are the building block every unit is composed from
 * (D23), but on the baseline they would bury the two tiers that orient a reader.
 */

import { geoPath, select, zoom, zoomIdentity, type ZoomTransform } from 'd3';
import type { Topology } from 'topojson-specification';
import { readGeography } from './lib/geography.ts';
import {
  baselineLabelSites,
  layoutLabels,
  measureLabel,
  type LabelTier,
  type Measurer,
} from './lib/labels.ts';
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

export function renderBaselineMap(container: HTMLElement, topology: Topology): void {
  const geography = readGeography(topology);
  const sites = baselineLabelSites(geography);
  const tierOf = new Map(sites.map((site) => [site.key, site.tier]));

  const svg = select(container)
    .append('svg')
    .attr('class', 'map')
    .attr('role', 'img')
    .attr('aria-label', 'Map of Pakistan showing current provinces, territories and divisions')
    .attr('tabindex', 0);

  const defs = svg.append('defs');
  // Territories are hatched rather than tinted a different colour. A different fill would read as
  // a data category under a basis, and the baseline carries no data (D14); a hatch reads as a
  // qualification of status, which is what AJK and GB are (D12).
  defs
    .append('pattern')
    .attr('id', 'territory-hatch')
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 6)
    .attr('height', 6)
    .attr('patternTransform', 'rotate(45)')
    .call((pattern) => {
      pattern.append('rect').attr('width', 6).attr('height', 6).attr('class', 'hatch-ground');
      pattern.append('line').attr('y2', 6).attr('class', 'hatch-rule');
    });

  const world = svg.append('g').attr('class', 'world');
  const landLayer = world.append('g').attr('class', 'stratum-land');
  const divisionLayer = world.append('g').attr('class', 'stratum-divisions');
  const provinceLayer = world.append('g').attr('class', 'stratum-provinces');
  // Labels live outside the zoomed group and are positioned in screen space, so type stays the
  // size it was designed at however far the reader zooms in.
  const labelLayer = svg.append('g').attr('class', 'stratum-labels');

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

  const zoomBehaviour = zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, 24])
    .on('zoom', (event: { transform: ZoomTransform }) => {
      world.attr('transform', event.transform.toString());
      drawLabels(event.transform);
    });
  svg.call(zoomBehaviour);

  let project = fitProjection(geography.provinces, { width: 1, height: 1, padding: 0 });
  let size = { width: 0, height: 0 };
  /** Unzoomed on-screen width of each named shape, refreshed whenever the projection is refitted. */
  const shapeWidth = new Map<string, number>();

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

    labelLayer
      .selectAll<SVGTextElement, { key: string; x: number; y: number }>('text')
      .data(layoutLabels(boxes, { bounds: size, gap: 3 }), (label) => label.key)
      .join('text')
      .attr('class', (label) => `label label-${tierOf.get(label.key)}`)
      .attr('x', (label) => label.x)
      .attr('y', (label) => label.y)
      .text((label) => drawn.get(label.key) ?? '');
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

    landLayer
      .selectAll('path')
      .data(geography.provinces.features)
      .join('path')
      .attr('class', (f) => `land land-${f.properties.kind}`)
      .attr('d', (f) => path(f));

    divisionLayer
      .selectAll('path')
      .data(geography.divisions.features)
      .join('path')
      .attr('class', 'division')
      .attr('d', (f) => path(f));

    provinceLayer
      .selectAll('path')
      .data(geography.provinces.features)
      .join('path')
      .attr('class', (f) => `province province-${f.properties.kind}`)
      .attr('d', (f) => path(f));

    shapeWidth.clear();
    for (const [tier, features] of [
      ['province', geography.provinces.features],
      ['division', geography.divisions.features],
    ] as const) {
      for (const f of features) {
        const [[west], [east]] = path.bounds(f);
        shapeWidth.set(`${tier}:${f.properties.name}`, east - west);
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
