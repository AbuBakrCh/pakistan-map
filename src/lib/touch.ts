/**
 * Hover becomes tap (#33) — which pointer answers which way, and what a tap does.
 *
 * On a phone there is no hover. The pointer arrives, lands somewhere, and leaves; there is no
 * `pointerleave` to put the tooltip away with, and every pan across the country is a `pointermove`
 * that would drag a tooltip along behind the thumb. So a coarse pointer does not hover — it taps,
 * and the tooltip stays where the tap left it until another tap moves or dismisses it.
 *
 * Nothing here touches the DOM. What is here is the part with a decision in it, and all three are
 * places where being wrong is silent rather than loud: a pan read as a tap puts a tooltip up every
 * time a reader moves the map; a pinch read as a tap puts one up in the middle of a zoom; and a
 * tap with no way to dismiss it leaves a box over the country that a reader cannot remove, because
 * on a touchscreen there is nowhere to move the pointer *to*.
 */

/**
 * Does this pointer answer by tapping rather than by hovering?
 *
 * Only `touch` does. A mouse hovers, which is the behaviour this app already had and the one it
 * keeps. A pen is deliberately left with the mouse: a stylus reports hover while it is near the
 * glass, so treating it as a finger would throw away the continuous readout it can actually give,
 * and a pen that never hovers still ends its stroke with a `pointerleave` that clears the tooltip
 * — the failure mode a finger has and a pen does not.
 *
 * An unrecognised or empty `pointerType` hovers, because hovering is the behaviour that cleans up
 * after itself: a tooltip put up by a mistaken hover is removed by the next `pointerleave`, and
 * one put up by a mistaken tap is not.
 */
export function selectsByTap(pointerType: string): boolean {
  return pointerType === 'touch';
}

/** How far a finger may travel and still be tapping, in CSS px. */
export const TAP_SLOP_PX = 12;

/**
 * How long a finger may stay down and still be tapping, in ms.
 *
 * Past this it is a press-and-hold, which on both mobile platforms already means something to the
 * browser — the callout menu, the magnifier, the drag handles. Answering it as well would put a
 * tooltip up underneath the system's own popover.
 */
export const TAP_HOLD_MS = 600;

/** What we need of a finished touch, so the decision below can be tested without a touchscreen. */
export interface TapCandidate {
  /** Where the finger went down, in the same space as `upAt`. */
  readonly downAt: readonly [number, number];
  /** Where it came up. */
  readonly upAt: readonly [number, number];
  /** How long it was down, in ms. */
  readonly heldMs: number;
  /**
   * The most fingers on the glass at any moment between the two.
   *
   * Counted across the whole gesture rather than at its end, because a pinch that finishes with
   * one finger lifted early would otherwise arrive here looking exactly like a tap.
   */
  readonly pointers: number;
}

/**
 * Was that a tap, or was it the map being moved?
 *
 * Three refusals, and each of them is a gesture this map already answers: a second finger is a
 * pinch and the answer is a zoom, travel is a pan and the answer is the country moving under the
 * thumb, and a long hold is the platform's. What is left — one finger, still, and brief — is the
 * only thing on a touchscreen that means "this one".
 */
export function isTap(candidate: TapCandidate): boolean {
  if (candidate.pointers !== 1) return false;
  if (candidate.heldMs > TAP_HOLD_MS) return false;
  const dx = candidate.upAt[0] - candidate.downAt[0];
  const dy = candidate.upAt[1] - candidate.downAt[1];
  return Math.hypot(dx, dy) <= TAP_SLOP_PX;
}

/** What a tap does to the tooltip: put one up, or put the one that is up away. */
export type TapOutcome = 'show' | 'dismiss';

/**
 * A tap landed. What happens?
 *
 * The dismissal rule is the one that has to exist rather than the one that is obvious. A mouse
 * clears the tooltip by leaving the district; a finger cannot leave anything, so without a
 * deliberate way to put the box away it stays over the country for as long as the reader is on the
 * page — covering the very ground they tapped it to read about.
 *
 * So a tap on the district already showing puts it away, and so does a tap on the sea or on a
 * neighbour, which is where a reader's thumb goes when they mean "not this". Tapping a *different*
 * district moves the tooltip rather than needing two taps, because the common act is comparing two
 * districts and charging it double would make the map feel stuck.
 */
export function tapResolves(district: string | null, showing: string | null): TapOutcome {
  if (district === null) return 'dismiss';
  return district === showing ? 'dismiss' : 'show';
}
