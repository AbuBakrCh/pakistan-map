/**
 * The PNG export (#32, D22) — the sanctioned copy, so the copies that circulate carry their own
 * disclaimer.
 *
 * Imperative DOM work like `map.ts` and `panel.ts`, and carrying no tests for the same reason: every
 * decision in it is upstream in `lib/export-band.ts`, which composes every word and every position,
 * and in `map.image()`, which decides what to photograph. What is left here is the mechanical part —
 * clone, inline, serialise, raster, download — and it is mechanical precisely because the two things
 * that could be wrong about it are settled elsewhere.
 *
 * **Entirely client-side**, which is the acceptance criterion and also D19. Nothing here opens a
 * socket: the SVG is serialised into a `data:` URL and decoded by an `<img>` in the same document,
 * and the canvas is read back with `toBlob`. No server ever sees the map, which matters more than
 * usual for this app — an export is a reader's own composition of a politically live picture, and
 * posting it to a service to be rendered would put that composition somewhere they did not choose.
 *
 * Three things this file has to do that are not obvious:
 *
 * - **Inline every computed style.** An `<img>` rasterising an SVG document does not load the page's
 *   stylesheet, so a clone that merely references classes rasterises as black-on-transparent
 *   nonsense. The fix is to walk the live tree and the clone in step and copy the computed value of
 *   every property that paints. This is also what makes "fonts and colours match the on-screen
 *   rendering" true by construction rather than by a table of hexes kept in sync by hand.
 * - **Bake `text-transform` into the text.** Province and unit names are set in caps by the
 *   stylesheet, not in the DOM. `text-transform` on SVG text is unevenly honoured by the
 *   `<img>` rasteriser, so the clone's text nodes are upper-cased outright and the property
 *   neutralised — the alternative is an image whose labels are lower case on some browsers.
 * - **Clip the map to its own crop.** The neighbour silhouettes run to the edge of the context
 *   extent, well outside the frame. Without a clip they would paint straight through the hairline
 *   and across the band, which is the one part of the image that must stay legible.
 */

import type {
  BasisId,
  CensusStatistics,
  Provenance,
  ScenarioBundle,
  VariantRecord,
} from './bundle.ts';
import {
  BAND_HATCH,
  BAND_METRICS,
  BAND_STIPPLE,
  BAND_TYPE,
  exportBand,
  exportFileName,
  layoutBand,
  swatchInk,
  type BandMeasurer,
  type BandPalette,
  type BandStyle,
} from './lib/export-band.ts';
import type { DevelopmentIndexBundle } from './lib/development.ts';
import { SERIF, type MapHandle, type MapImage } from './map.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The resolution the ticket asks for. A 2× raster is legible when a phone re-encodes it. */
const SCALE = 2;

/**
 * Every property that paints, and nothing that lays out.
 *
 * Copying the whole computed style would bloat the serialised document by two orders of magnitude
 * and drag in properties (`inline-size`, `transform-origin`) that change how the rasteriser places
 * things. This list is what the map's own stylesheet actually sets on SVG.
 */
const PAINTED = [
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'paint-order',
  'vector-effect',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'letter-spacing',
  'text-anchor',
  'dominant-baseline',
  'display',
  'visibility',
] as const;

/**
 * One colour, read from the stylesheet that painted the map.
 *
 * No hex fallback. A default here would be a second copy of the palette that could drift from
 * `styles.css` without anything going red — and the colour it defended against is only missing if
 * the stylesheet did not load at all, in which case the export would be wrong in every other way
 * too. Better to fail naming the custom property than to ship an image in colours the page is not
 * using.
 */
const cssVariable = (name: string): string => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (value === '') {
    throw new Error(
      `The stylesheet defines no ${name}, so this image cannot be painted in the map's own ` +
        `colours. The export matches the page or it does not go out.`,
    );
  }
  return value;
};

/** The map's own colours, read from the stylesheet that painted it rather than typed again here. */
function readPalette(): BandPalette {
  return {
    paper: cssVariable('--paper'),
    ink: cssVariable('--ink'),
    inkSoft: cssVariable('--ink-soft'),
    inkFaint: cssVariable('--ink-faint'),
    land: cssVariable('--land'),
    landHatch: cssVariable('--land-hatch'),
    accent: cssVariable('--accent'),
    ruleUnit: cssVariable('--rule-unit'),
    ruleProvince: cssVariable('--rule-province'),
    ruleDivision: cssVariable('--rule-division'),
  };
}

/** Measured on a canvas in the page's own face, exactly as `map.ts` measures its labels. */
function bandMeasurer(): BandMeasurer {
  const ruler = document.createElement('canvas').getContext('2d');
  return (text: string, style: BandStyle): number => {
    const { size } = BAND_TYPE[style];
    if (ruler === null) return text.length * size * 0.5;
    ruler.font = `${size}px ${SERIF}`;
    return ruler.measureText(text).width;
  };
}

/**
 * Copy the painting half of the computed style from the live tree onto the clone.
 *
 * The two trees are walked in step and are the same shape by construction — the clone is a
 * `cloneNode(true)` of the live node and nothing has been added to it yet.
 */
function inlineStyles(live: Element, clone: Element): void {
  const computed = getComputedStyle(live);
  const declarations: string[] = [];
  for (const property of PAINTED) {
    const value = computed.getPropertyValue(property);
    if (value !== '') declarations.push(`${property}:${value}`);
  }
  clone.setAttribute('style', declarations.join(';'));

  // Caps are a stylesheet decision and the DOM holds the lower-case string. Baked in rather than
  // referenced, so the raster cannot disagree with the screen about what a label says.
  if (computed.getPropertyValue('text-transform') === 'uppercase' && clone.textContent !== null) {
    clone.textContent = clone.textContent.toUpperCase();
  }

  const liveChildren = live.children;
  const cloneChildren = clone.children;
  for (let i = 0; i < liveChildren.length && i < cloneChildren.length; i += 1) {
    inlineStyles(liveChildren[i] as Element, cloneChildren[i] as Element);
  }
}

/** The territory texture, at the pitch the map draws it at 1× and at no other. */
function bandHatch(palette: BandPalette): SVGPatternElement {
  const pattern = element('pattern', {
    id: BAND_HATCH,
    patternUnits: 'userSpaceOnUse',
    width: 5,
    height: 5,
    patternTransform: 'rotate(45)',
  });
  pattern.append(element('rect', { width: 5, height: 5, fill: palette.land }));
  pattern.append(
    element('line', { y2: 5, stroke: palette.landHatch, 'stroke-width': 1.6 }),
  );
  return pattern;
}

/** The census counted the district and named no dominant tongue. Dots, never a flat grey. */
function bandStipple(palette: BandPalette): SVGPatternElement {
  const pattern = element('pattern', {
    id: BAND_STIPPLE,
    patternUnits: 'userSpaceOnUse',
    width: 4,
    height: 4,
  });
  pattern.append(element('rect', { width: 4, height: 4, fill: palette.paper }));
  for (const [cx, cy] of [
    [1, 1],
    [3, 3],
  ] as const) {
    pattern.append(element('circle', { cx, cy, r: 0.7, fill: palette.inkFaint }));
  }
  return pattern;
}

const element = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number>,
): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
};

export interface ExportInput {
  readonly map: MapHandle;
  readonly scenarios: ScenarioBundle;
  readonly statistics: CensusStatistics;
  readonly geography: Provenance;
  /** The proposal on screen, or `null` at the baseline — which is a view and gets its own band. */
  readonly variant: VariantRecord | null;
  /** Which basis's fill is on the map, or `null`. The renderer's answer, not the selection's. */
  readonly shadedBy: BasisId | null;
  /** The committed composite (#31), which the Development basis's key is derived from. */
  readonly development: DevelopmentIndexBundle;
}

/**
 * The whole image as one SVG document: the cropped map, a hairline, and the band beneath it.
 *
 * Assembled into a document of its own: nothing is drawn into the page, so the reader's view is the
 * same view afterwards. The map is held still for the length of the read by `photograph`, which owns
 * both halves of that — see `map.ts`.
 */
function composeDocument(input: ExportInput): { svg: SVGSVGElement; width: number; height: number } {
  return input.map.photograph(({ svg: live, crop }) => compose(input, live, crop));
}

function compose(
  input: ExportInput,
  live: SVGSVGElement,
  crop: MapImage['crop'],
): { svg: SVGSVGElement; width: number; height: number } {
  const palette = readPalette();
  const band = exportBand({
    scenarios: input.scenarios,
    statistics: input.statistics,
    geography: input.geography,
    variant: input.variant,
    shadedBy: input.shadedBy,
    development: input.development,
  });
  const laid = layoutBand(band, { width: crop.width, measure: bandMeasurer() });

  const width = crop.width;
  const height = crop.height + laid.height;

  const root = element('svg', {
    xmlns: SVG_NS,
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
  });
  // The page's paper, under everything: an SVG rasterised onto a transparent canvas and saved as a
  // PNG comes out with a transparent ground, which reads as black in most messaging apps.
  root.append(element('rect', { x: 0, y: 0, width, height, fill: palette.paper }));

  const clone = live.cloneNode(true) as SVGSVGElement;
  inlineStyles(live, clone);

  const defs = element('defs', {});
  /*
   * The band's own hatch and stipple, at a fixed pitch.
   *
   * The map's patterns are counter-scaled against the zoom (see `map.ts`), which is right inside the
   * zoomed group and wrong in a legend: exporting at 24× would collapse the territory swatch to
   * near-flat colour and stop it keying anything. Painted from the same palette as the map's, so
   * they look like what they explain.
   */
  defs.append(bandHatch(palette), bandStipple(palette));
  const clip = element('clipPath', { id: 'export-crop' });
  clip.append(element('rect', { x: 0, y: 0, width: crop.width, height: crop.height }));
  defs.append(clip);
  root.append(defs);

  /*
   * Two nested groups, and the nesting is load-bearing rather than tidy.
   *
   * The clip goes on the outer group, which carries no transform, and the shift onto the inner one.
   * A `clip-path` on the *same* element as a `transform` is resolved in that element's own
   * transformed space, so a single group clipped to the crop and shifted by it clips the wrong
   * rectangle — the picture comes out sliced short by exactly the offset, which cost this export
   * the eastern edge of the country, Gilgit-Baltistan's name and the ceasefire line's label the
   * first time it was rendered. Splitting them leaves the clip in the image's own coordinates,
   * where it means what it says.
   */
  const window_ = element('g', { 'clip-path': 'url(#export-crop)' });
  const picture = element('g', { transform: `translate(${-crop.x} ${-crop.y})` });
  // The clone's own children rather than the clone: its `viewBox` would re-fit the whole frame into
  // the crop and quietly rescale everything the reader was looking at.
  for (const child of Array.from(clone.childNodes)) picture.append(child);
  window_.append(picture);
  root.append(window_);

  root.append(drawBand(laid, palette, crop.height, band.proposed));
  return { svg: root, width, height };
}

/** The band itself, from positions `layoutBand` already decided. Nothing here chooses a word. */
function drawBand(
  laid: ReturnType<typeof layoutBand>,
  palette: BandPalette,
  top: number,
  proposed: boolean,
): SVGGElement {
  const group = element('g', { transform: `translate(0 ${top})` });
  const colour: Record<BandStyle, string> = {
    title: palette.ink,
    tagline: palette.inkSoft,
    // A proposal's disclaimer is set in the ink this page reserves for a proposal, so the eye
    // lands on it. The baseline's standing line is not a disclaimer and does not get the accent.
    standing: proposed ? palette.accent : palette.ink,
    meta: palette.ink,
    legend: palette.ink,
    fine: palette.inkSoft,
  };

  for (const row of laid.rows) {
    if (row.kind === 'rule') {
      group.append(
        element('line', {
          x1: 0,
          y1: row.y,
          x2: laid.width,
          y2: row.y,
          stroke: palette.ruleProvince,
          'stroke-width': 1,
        }),
      );
      continue;
    }

    if (row.kind === 'text') {
      const { size } = BAND_TYPE[row.style];
      const text = element('text', {
        x: row.x,
        y: row.y,
        fill: colour[row.style],
        'font-family': SERIF,
        'font-size': size,
        'font-weight': row.style === 'title' ? 600 : 400,
        ...(row.style === 'tagline' ? { 'font-style': 'italic' } : {}),
      });
      text.textContent = row.text;
      group.append(text);
      continue;
    }

    const ink = swatchInk(row.swatch, palette);
    const { size } = BAND_TYPE.legend;
    if (ink.shape === 'block') {
      group.append(
        element('rect', {
          x: row.x,
          y: row.y - size * 0.72,
          width: BAND_METRICS.swatchWidth,
          height: size * 0.78,
          fill: ink.fill,
          stroke: ink.stroke,
          'stroke-width': 1,
        }),
      );
    } else {
      group.append(
        element('line', {
          x1: row.x,
          y1: row.y - size * 0.33,
          x2: row.x + BAND_METRICS.swatchWidth,
          y2: row.y - size * 0.33,
          stroke: ink.stroke,
          'stroke-width': ink.width,
          ...(ink.dash === null ? {} : { 'stroke-dasharray': ink.dash }),
        }),
      );
    }
    const label = element('text', {
      x: row.labelX,
      y: row.y,
      fill: palette.ink,
      'font-family': SERIF,
      'font-size': size,
    });
    label.textContent = row.label;
    group.append(label);
  }
  return group;
}

/**
 * The finished image, before anything has decided what to do with it.
 *
 * Split from the download because they are two different jobs and only one of them can be looked
 * at: this half is the picture, and `exportPng` is the browser gesture that saves it. Keeping the
 * seam here is what lets the composed image be rendered and inspected without a file dialog.
 *
 * Asynchronous only because decoding an image and encoding a PNG are: there is nothing to wait for
 * off this machine. Rejects rather than half-succeeding, so the caller can say so out loud — a
 * button that silently does nothing is worse than one that reports a failure.
 */
async function renderExportImage(input: ExportInput): Promise<{ blob: Blob }> {
  const { svg, width, height } = composeDocument(input);
  const serialised = new XMLSerializer().serializeToString(svg);
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialised)}`;

  const image = new Image();
  image.width = width;
  image.height = height;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('The map could not be rasterised for export.'));
    image.src = source;
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * SCALE);
  canvas.height = Math.round(height * SCALE);
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('This browser offers no 2D canvas to export onto.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (blob === null) throw new Error('The exported image could not be encoded as a PNG.');
  return { blob };
}

/** Make the image and hand it to the browser's own download. */
export async function exportPng(input: ExportInput): Promise<void> {
  const { blob } = await renderExportImage(input);
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = exportFileName(input.variant);
  anchor.click();
  // Released on the next turn of the loop: revoking it synchronously races the click in Safari.
  setTimeout(() => URL.revokeObjectURL(href), 0);
}
