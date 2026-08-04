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
 * **A basis nobody has written a variant for is offered and refused, not hidden.** A basis short of
 * its variants or its shading is still listed, because the bases are the argument the app is making
 * about what a boundary can be argued from; one quietly missing from the menu reads as a basis that
 * does not exist. What it says instead is which half is missing — the variants, the shading, or
 * both — because "coming soon" is the one answer that tells a reader nothing.
 *
 * **Withholding a basis is a separate act, and a louder one.** `HIDDEN_BASES` takes a basis off the
 * menu altogether, which is not the refusal above and must never be reached by drifting into it: a
 * basis is hidden because this build has decided not to offer it, not because a fill is late. So it
 * is named as data here rather than expressed as an absence, it is `hidden` on the choice rather
 * than a missing row, and it is *unavailable* — a hidden basis that a control or a URL still asks
 * for is refused by name, exactly as an unshaded one is. What it does not do is print a refusal
 * line: a chip that is not on the strip has nothing to explain.
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

/**
 * The bases this build does not offer at all.
 *
 * Historical is here. It is the only basis still short of a fill, and the refusal it was getting
 * said so out loud on a chip nobody could press; the decision is to withhold the basis rather than
 * to advertise the gap. It stays in `BASIS_ORDER` and in the bundle: H1 to H4 are written, the
 * suite still holds them, `about.ts` still sources the basis on the audit panel, and a hash naming
 * it is still a hash naming something this app has heard of — which is what keeps `#/historical/l1`
 * a correctable link rather than a malformed one.
 */
export const HIDDEN_BASES: ReadonlySet<BasisId> = new Set<BasisId>(['historical']);

export interface VariantChoice {
  readonly id: string;
  readonly name: string;
  readonly tagline: string | null;
}

export interface BasisChoice {
  readonly basis: BasisRecord;
  readonly variants: readonly VariantChoice[];
  /** Withheld from the menu by this build (`HIDDEN_BASES`), whatever it is or is not short of. */
  readonly hidden: boolean;
  /** Selectable: offered at all, with something to draw and something to shade it against. */
  readonly available: boolean;
  /**
   * What it is short of, one clause per missing half. Empty when it is available. Written without
   * a pronoun so the same clause reads whether it is said of one basis or of three.
   */
  readonly missing: readonly string[];
  /** Why not, as one sentence about this basis alone. Null when it is available. */
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
    if (variants.length === 0) missing.push('no variant is written yet');
    if (!shadeable.has(id)) missing.push('no shading is built yet');

    // A hidden basis keeps whatever it is short of on the record — the withholding is this build's
    // decision and says nothing about the data — but it is not selectable and its sentence is about
    // the withholding, since that is the reason a caller reaching it was wrong.
    const hidden = HIDDEN_BASES.has(id);
    const refusal = hidden
      ? `${basis.name}: not offered in this build.`
      : missing.length === 0
        ? null
        : `${basis.name}: ${missing.join(', and ')}.`;

    return {
      basis,
      variants,
      missing,
      hidden,
      available: !hidden && missing.length === 0,
      unavailable: refusal,
    };
  });
}

/** The bases the menu actually offers — every one this build has not withheld. */
export function offeredBases(choices: readonly BasisChoice[]): readonly BasisChoice[] {
  return choices.filter((choice) => !choice.hidden);
}

/**
 * The refusals as sentences to print, one per distinct reason, naming the bases it applies to.
 *
 * A hidden basis contributes nothing: the line exists to say why a chip on the strip is dimmed, and
 * a basis this build does not offer has no chip. Printing one would advertise the withholding in
 * the one place a reader could do nothing about it.
 *
 * On screen and not only in a `title`, because a `title` is reachable by a hovering mouse and by
 * nothing else — and this app's hard bar is a 390px phone, where there is no hover and a disabled
 * control takes no tap. A basis offered and silently inert is worse than one not offered at all.
 * Grouped by reason so three bases short of the same two things are one line rather than three.
 */
export function refusalLines(choices: readonly BasisChoice[]): readonly string[] {
  const byReason = new Map<string, string[]>();
  for (const choice of choices) {
    if (choice.available || choice.hidden) continue;
    const reason = choice.missing.join(', and ');
    byReason.set(reason, [...(byReason.get(reason) ?? []), choice.basis.name]);
  }
  return [...byReason].map(([reason, names]) => {
    const named =
      names.length === 1
        ? `${names[0]} is`
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are`;
    return `${named} not selectable yet — ${reason}.`;
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
    `Map of Pakistan drawn as the variant "${variant.name}" would draw it, over districts shaded ` +
    `by ${basis.name.toLowerCase()}. Current provinces and divisions are faded behind it. ` +
    `${variant.counts.units} units, of which ${drawn}`
  );
}
