/**
 * What is on screen: the active basis and the active variant, and which of them may be chosen.
 *
 * Two rules from the spec are the whole of this module, and both are decisions rather than
 * plumbing — which is why they are here, under test, and not inside the panel that draws them.
 *
 * **A basis is never active on its own.** Selecting a basis is selecting its first variant (D13:
 * the basis *is* the overlay). A basis with the shading on and no unit outlines over it would be
 * a data map wearing a proposal's clothes, and there is no state in this app that means that.
 *
 * **A basis nobody has written a variant for is offered and refused, not hidden.** All four are
 * listed under every state, because the four are the argument the app is making about what a
 * boundary can be argued from; a basis quietly missing from the menu reads as a basis that does
 * not exist. What it says instead is which half is missing — the variants, the shading, or both
 * — because "coming soon" is the one answer that tells a reader nothing.
 */

import type { BasisId, BasisRecord, ScenarioBundle, VariantRecord } from '../bundle.ts';

/** The baseline is the absence of a selection, so it cannot be half-entered or half-left. */
export type Selection = { readonly basis: BasisId; readonly variant: string } | null;

export const BASELINE: Selection = null;

/** CLAUDE.md's own order for the bases table. Not the artifact's key order, which is incidental. */
export const BASIS_ORDER: readonly BasisId[] = [
  'language',
  'administrative',
  'historical',
  'development',
];

export interface VariantChoice {
  readonly id: string;
  readonly name: string;
  readonly tagline: string | null;
}

export interface BasisChoice {
  readonly basis: BasisRecord;
  readonly variants: readonly VariantChoice[];
  /** Selectable: something to draw, and something to shade it against. */
  readonly available: boolean;
  /** Why not, in the words the control puts on screen. Null when it is available. */
  readonly unavailable: string | null;
}

/**
 * The menu, derived from the artifact and from what the app can actually shade.
 *
 * `shadeable` is passed in rather than read off the bundle because it is a property of this
 * build's renderer, not of the data: PBS publishes the development tables today and nothing here
 * draws them yet. Deriving availability from the bundle alone would offer a basis that shades
 * nothing, which is the failure this argument exists to prevent.
 */
export function basisChoices(
  scenarios: ScenarioBundle,
  shadeable: ReadonlySet<BasisId>,
): readonly BasisChoice[] {
  return BASIS_ORDER.map((id) => {
    const basis = scenarios.bases[id];
    const variants = scenarios.variants
      .filter((variant) => variant.basis === id)
      .map((variant) => ({ id: variant.id, name: variant.name, tagline: variant.tagline }));

    const missing: string[] = [];
    if (variants.length === 0) missing.push('no variant is written for it yet');
    if (!shadeable.has(id)) missing.push('the map cannot shade districts by it yet');

    return {
      basis,
      variants,
      available: missing.length === 0,
      unavailable: missing.length === 0 ? null : `${basis.name}: ${missing.join(', and ')}.`,
    };
  });
}

/**
 * Enter a basis, on its first variant.
 *
 * Throws on a basis with nothing to draw, rather than returning a selection that renders an empty
 * map: the control that offers an unavailable basis has already been told it is unavailable, so
 * arriving here means a caller ignored that, and a silent baseline would look like a dead button.
 */
export function selectBasis(choices: readonly BasisChoice[], id: BasisId): Selection {
  const choice = choices.find((candidate) => candidate.basis.id === id);
  if (choice === undefined) throw new Error(`${id} is not a basis in this bundle`);
  const first = choice.variants[0];
  if (!choice.available || first === undefined) {
    throw new Error(
      `${id} cannot be selected: ${choice.unavailable ?? 'it has no variants'} A basis is only ` +
        `ever active with a variant under it.`,
    );
  }
  return { basis: id, variant: first.id };
}

/** Switch variants within the active basis. The basis is the variant's own, never the caller's. */
export function selectVariant(scenarios: ScenarioBundle, variantId: string): Selection {
  const variant = scenarios.variants.find((candidate) => candidate.id === variantId);
  if (variant === undefined) throw new Error(`${variantId} is not a variant in this bundle`);
  return { basis: variant.basis, variant: variant.id };
}

/** The variant on screen, or null at the baseline. */
export function variantOf(scenarios: ScenarioBundle, selection: Selection): VariantRecord | null {
  if (selection === null) return null;
  const variant = scenarios.variants.find((candidate) => candidate.id === selection.variant);
  if (variant === undefined) {
    throw new Error(
      `${selection.variant} is selected and is not a variant in this bundle. A selection that ` +
        `names nothing draws a baseline that claims to be a proposal.`,
    );
  }
  return variant;
}

/**
 * What the map is, in one sentence, for the reader who cannot see it.
 *
 * `role="img"` on the SVG means assistive technology never reaches the shapes, so this sentence
 * is the whole of what the map says about itself. It names the proposal *as a proposal* — a
 * screen reader told only "map of Pakistan with units" would have no way to know that the
 * boundaries it is being told about are not the country's.
 */
export function mapDescription(scenarios: ScenarioBundle, selection: Selection): string {
  const variant = variantOf(scenarios, selection);
  if (variant === null || selection === null) {
    return 'Map of Pakistan showing current provinces, territories and divisions';
  }
  const basis = scenarios.bases[selection.basis];
  const proposed = variant.units.filter((unit) => unit.kind === 'proposed');
  const drawn =
    proposed.length === 0
      ? 'no new province'
      : `${proposed.map((unit) => unit.name).join(', ')} — proposed, not official`;
  return (
    `Map of Pakistan under the proposal "${variant.name}", drawn over districts shaded by ` +
    `${basis.name.toLowerCase()}. Current provinces and divisions are faded behind it. ` +
    `${variant.counts.units} units, of which ${drawn}`
  );
}
