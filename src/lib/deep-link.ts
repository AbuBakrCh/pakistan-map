/**
 * The selection, written as a URL and read back out of one (#23).
 *
 * The point of this module is that an argument about Pakistan's provinces can be conducted by
 * pointing at the live thing rather than at a screenshot: `#/language/l1` is a proposal drawn over
 * its own evidence, with its badges, its sources and its "Opposed by" line still attached, which
 * is exactly what a screenshot strips off. So the hash is not a convenience — it is the sanctioned
 * way this content travels, the same argument D22 makes for the PNG export.
 *
 * Which makes what an *unreadable* hash does the whole design question here, and there are only
 * two defensible answers: draw something near what was asked for, or draw the country. This module
 * draws the country. A link naming a variant this build has never heard of is answered with the
 * baseline and never with the basis's first variant, because substituting one proposal for another
 * puts a claim on screen that the link did not make — and a reader arriving from a stranger's URL
 * has no way to tell the two apart. Only one substitution is made, and it is the one D13 forces:
 * a hash naming a **basis alone** is a hash naming its first variant, because there is no state in
 * this app that means "shaded, with nothing proposed over it".
 *
 * Nothing here throws. `selectBasis` and `variantOf` throw on a selection that names nothing,
 * because arriving there means a *control* ignored what it was told; a hash is typed by strangers,
 * mangled by chat clients and truncated by mailers, and refusing to render the page over one would
 * be answering a bad link with a blank screen.
 */

import type { BasisId, ScenarioBundle } from '../bundle.ts';
import { BASELINE, type BasisChoice, type Selection } from './selection.ts';

/**
 * The baseline's own URL, and a real one.
 *
 * The baseline is a view, not the absence of one — it is what every variant is argued against
 * (D17) — so it is linkable like any other. `#/` rather than an empty hash so that a shared link
 * to the current map is visibly a link *to* something, and so that leaving a variant is a change
 * to the URL rather than a silent deletion of it.
 */
export const BASELINE_HASH = '#/';

/** What a hash resolves to, and whether the hash already said it. */
export interface Route {
  readonly selection: Selection;
  /**
   * True when the hash reads exactly as `hashFor(selection)` — nothing was corrected.
   *
   * This is what tells the caller whether the address bar is owed a rewrite, and the rewrite is a
   * `replaceState`: a reader who followed `#/language` did not choose `#/language/l1`, and a view
   * nobody chose has no business sitting in their back button.
   */
  readonly asWritten: boolean;
}

/** The selection as a URL fragment. Round-trips through `readRoute` for every selection. */
export function hashFor(selection: Selection): string {
  if (selection === null) return BASELINE_HASH;
  return `#/${selection.basis}/${selection.variant}`;
}

/**
 * Split a fragment into its segments, forgivingly.
 *
 * Case, surrounding whitespace, a missing or doubled leading slash and any number of trailing
 * ones are all the same route: none of them is a different thing to ask for, and a link that has
 * been through an email client is a link that has been through something. Percent-decoding is
 * attempted and its failure is not an error — `decodeURIComponent` throws on a lone `%`, which is
 * an ordinary way for a URL to arrive truncated, and the segments are then simply not a route.
 */
function segmentsOf(hash: string): readonly string[] {
  const raw = hash.trim().replace(/^#/, '');
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Left as written. It will not match a basis or a variant either way, which is the answer.
  }
  return decoded
    .toLowerCase()
    .split('/')
    .filter((segment) => segment !== '');
}

/**
 * Read a fragment as a selection, falling back to the baseline rather than erroring.
 *
 * `choices` is passed in for the same reason `basisChoices` takes `shadeable`: whether a basis can
 * be drawn is a property of this build's renderer and not of the artifact. A link to a basis whose
 * shading has not been written yet must land on the baseline, not on a faded map explaining
 * nothing — the URL is not a way in through the back of a control that already refuses it out
 * loud.
 */
export function readRoute(
  hash: string,
  scenarios: ScenarioBundle,
  choices: readonly BasisChoice[],
): Route {
  const selection = resolve(segmentsOf(hash), scenarios, choices);
  return { selection, asWritten: hash === hashFor(selection) };
}

function resolve(
  segments: readonly string[],
  scenarios: ScenarioBundle,
  choices: readonly BasisChoice[],
): Selection {
  // Nothing asked for, and more than a basis and a variant asked for, are both the baseline: the
  // second is a URL this app did not write, and guessing which two of three segments were meant
  // is guessing.
  if (segments.length === 0 || segments.length > 2) return BASELINE;

  const [first, second] = segments;
  if (second === undefined) {
    // A basis alone. D13: selecting a basis is selecting its first variant, so a link that names
    // one is a link to that variant — the only substitution this module makes.
    const choice = choices.find((candidate) => candidate.basis.id === first);
    const firstVariant = choice?.variants[0];
    if (choice === undefined || !choice.available || firstVariant === undefined) return BASELINE;
    return { basis: choice.basis.id, variant: firstVariant.id };
  }

  // The first segment must name a basis this app has heard of, even though the variant is what
  // decides which one is used. A hash naming no basis at all is not a link with a disagreement in
  // it — it is a link this app did not write, and #23 says a malformed hash falls back to the
  // baseline. Reading `#/nonsense/l1` as L1 would put a proposal on screen on the strength of the
  // half of the URL that happened to parse.
  if (!choices.some((candidate) => candidate.basis.id === first)) return BASELINE;

  const variant = scenarios.variants.find((candidate) => candidate.id === second);
  if (variant === undefined) return BASELINE;
  // Between two segments that each name something real, the basis is the variant's own, exactly as
  // it is when a control switches variants: a variant shaded against evidence it was not argued
  // from would be a different claim. So `#/historical/l1` is not refused — the variant wins and the
  // URL is corrected under the reader.
  if (!drawable(choices, variant.basis)) return BASELINE;
  return { basis: variant.basis, variant: variant.id };
}

/** Whether this build can put that basis on screen at all — variants written *and* shading built. */
function drawable(choices: readonly BasisChoice[], basis: BasisId): boolean {
  return choices.find((candidate) => candidate.basis.id === basis)?.available === true;
}
