/**
 * Colour-difference arithmetic, so the palette's colourblind safety is a computed claim rather
 * than an opinion. Nothing renders through this — it exists to be asserted against.
 *
 * The method and its thresholds are the `dataviz` skill's, reproduced here rather than depended
 * on, because the skill is not a package this repo can install and a claim the test suite cannot
 * re-derive is a claim nobody can check on a fresh clone. Three pieces:
 *
 * - **OKLab**, for a difference that is roughly perceptually uniform.
 * - **ΔE** = Euclidean distance in OKLab × 100.
 * - **Machado, Oliveira & Fernandes (2009)** at severity 1.0, in linear RGB, for protanopia,
 *   deuteranopia and tritanopia. The simulation model is part of the standard, not an
 *   implementation detail: the thresholds are calibrated to it, and swapping in Viénot-1999
 *   would move borderline pairs and require recalibrating them.
 */

export type Deficiency = 'protan' | 'deutan' | 'tritan';

/** Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear RGB. */
const MACHADO: Readonly<Record<Deficiency, readonly (readonly number[])[]>> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

const clamp = (c: number): number => Math.max(0, Math.min(1, c));

function srgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`"${hex}" is not a six-digit hex colour.`);
  const at = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  return [at(0), at(2), at(4)];
}

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

const linear = (hex: string): [number, number, number] =>
  srgb(hex).map(toLinear) as [number, number, number];

function oklab([r, g, b]: readonly number[]): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r! + 0.5363325363 * g! + 0.0514459929 * b!);
  const m = Math.cbrt(0.2119034982 * r! + 0.6806995451 * g! + 0.1073969566 * b!);
  const s = Math.cbrt(0.0883024619 * r! + 0.2817188376 * g! + 0.6299787005 * b!);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLCH lightness and chroma. Lightness runs 0–1; chroma is unbounded but rarely past 0.37. */
export function lightnessChroma(hex: string): { lightness: number; chroma: number } {
  const [L, a, b] = oklab(linear(hex));
  return { lightness: L, chroma: Math.hypot(a, b) };
}

function simulate(hex: string, kind: Deficiency): [number, number, number] {
  const [r, g, b] = linear(hex);
  const M = MACHADO[kind];
  return M.map((row) => clamp(row[0]! * r + row[1]! * g + row[2]! * b)) as [number, number, number];
}

/**
 * ΔE between two colours, in OKLab × 100. With a deficiency, both are simulated first; without
 * one, this is the separation an unimpaired reader sees.
 */
export function deltaE(a: string, b: string, kind?: Deficiency): number {
  const [la, lb] = [
    oklab(kind === undefined ? linear(a) : simulate(a, kind)),
    oklab(kind === undefined ? linear(b) : simulate(b, kind)),
  ];
  return 100 * Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

/**
 * The worst a pair looks to a dichromat — the smaller of the protanopic and deuteranopic
 * separations, which is what the skill's CVD gate is measured on. Tritanopia is reported
 * separately there and is checked separately here.
 */
export const dichromatSeparation = (a: string, b: string): number =>
  Math.min(deltaE(a, b, 'protan'), deltaE(a, b, 'deutan'));

/** WCAG relative luminance, and the contrast ratio built from it. */
function luminance(hex: string): number {
  const [r, g, b] = linear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
