/**
 * Hover becomes tap (#33).
 *
 * The renderer is untested here as everywhere — `map.ts` is imperative D3 against the DOM and the
 * repo has no jsdom, deliberately. What is testable is what the gesture *decides*, and each of
 * these decisions fails silently rather than loudly: a pan read as a tap, a pinch read as a tap,
 * or a tooltip a finger has no way to put away.
 */

import { describe, expect, it } from 'vitest';
import {
  isTap,
  selectsByTap,
  tapResolves,
  TAP_HOLD_MS,
  TAP_SLOP_PX,
  type TapCandidate,
} from './touch.ts';

/** A finger down and up in the same place, briefly — the gesture as intended. */
const tap = (over: Partial<TapCandidate> = {}): TapCandidate => ({
  downAt: [100, 100],
  upAt: [100, 100],
  heldMs: 90,
  pointers: 1,
  ...over,
});

describe('selectsByTap', () => {
  it('routes a finger to tap and everything else to hover', () => {
    expect(selectsByTap('touch')).toBe(true);
    expect(selectsByTap('mouse')).toBe(false);
    // A stylus reports hover while it is near the glass, so it keeps the continuous readout a
    // finger cannot have — and a pen that does not hover still ends with the `pointerleave` that
    // clears the tooltip, which is the failure a finger has and a pen does not.
    expect(selectsByTap('pen')).toBe(false);
  });

  it('leaves an unrecognised pointer hovering, because hover cleans up after itself', () => {
    // The asymmetry is the reason: a tooltip put up by a mistaken hover is taken down by the next
    // `pointerleave`; one put up by a mistaken tap is not.
    for (const type of ['', 'unknown', 'TOUCH']) {
      expect(selectsByTap(type), type).toBe(false);
    }
  });
});

describe('isTap', () => {
  it('accepts one finger, still and brief', () => {
    expect(isTap(tap())).toBe(true);
  });

  it('refuses a pan, which is the map being moved rather than read', () => {
    expect(isTap(tap({ upAt: [100 + TAP_SLOP_PX + 1, 100] }))).toBe(false);
    expect(isTap(tap({ upAt: [100, 100 - TAP_SLOP_PX - 1] }))).toBe(false);
    // Diagonally, the distance is the distance and not the larger of the two axes: 10px across
    // and 10px down is 14px travelled, which is a pan.
    expect(isTap(tap({ upAt: [110, 110] }))).toBe(false);
    // And the slop itself is inclusive, or a finger that is merely unsteady reads as a pan.
    expect(isTap(tap({ upAt: [100 + TAP_SLOP_PX, 100] }))).toBe(true);
  });

  it('refuses a pinch even when it ends on one finger', () => {
    // Counted across the whole gesture rather than at its end. A zoom that finishes with one
    // finger lifted a moment early arrives here looking exactly like a tap.
    expect(isTap(tap({ pointers: 2 }))).toBe(false);
  });

  it('refuses a press-and-hold, which already belongs to the platform', () => {
    expect(isTap(tap({ heldMs: TAP_HOLD_MS + 1 }))).toBe(false);
    expect(isTap(tap({ heldMs: TAP_HOLD_MS }))).toBe(true);
  });
});

describe('tapResolves', () => {
  it('shows the district that was tapped', () => {
    expect(tapResolves('Larkana', null)).toBe('show');
  });

  it('moves to a different district in one tap rather than two', () => {
    // The common act is comparing two districts, and charging it a dismissing tap first would
    // make the map feel stuck.
    expect(tapResolves('Larkana', 'Sukkur')).toBe('show');
  });

  it('gives a finger the two ways of putting the tooltip away that a mouse gets for free', () => {
    // A mouse clears the box by leaving the district. A finger cannot leave anything, so without
    // these the tooltip sits over the ground it was tapped to explain for the rest of the visit.
    expect(tapResolves('Larkana', 'Larkana')).toBe('dismiss');
    expect(tapResolves(null, 'Larkana')).toBe('dismiss');
  });

  it('does nothing surprising when a tap lands on nothing and nothing is showing', () => {
    expect(tapResolves(null, null)).toBe('dismiss');
  });
});
