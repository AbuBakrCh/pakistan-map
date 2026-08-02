import { describe, expect, it } from 'vitest';

import { thresholdFor } from './simplify.ts';

/**
 * The arithmetic behind the one knob that decides whether a border keeps its shape.
 *
 * This lived twice in two build scripts, identical and untestable in both, until it was pulled
 * here. The cases below are the ones a copy could have drifted on without either build noticing:
 * the fraction is of *points*, the weights arrive unsorted and spread across arcs, and the two
 * ends of the range have to mean what they say.
 */

/** A topology of one arc whose points carry the given weights, shaped as `presimplify` leaves it. */
const weighted = (...weights: (number | undefined)[]) => ({
  arcs: [weights.map((w) => [0, 0, w] as [number, number, number?])],
});

describe('thresholdFor', () => {
  it('reads the weight at the quantile, counting points across every arc', () => {
    // Ten points spread over two arcs. Keeping half means the threshold sits at the 5th weight
    // from the bottom — which is 5, whichever arc it happens to be in.
    const topo = {
      arcs: [
        [1, 3, 5, 7, 9].map((w) => [0, 0, w] as [number, number, number?]),
        [2, 4, 6, 8, 10].map((w) => [0, 0, w] as [number, number, number?]),
      ],
    };
    expect(thresholdFor(topo, 0.5)).toBe(5);
  });

  it('does not care what order the weights arrive in', () => {
    // The same ten weights, shuffled. A copy that forgot to sort would pass the case above by
    // luck on already-ordered input and fail here.
    expect(thresholdFor(weighted(9, 2, 7, 4, 10, 1, 8, 3, 6, 5), 0.5)).toBe(5);
  });

  it('keeps everything at a fraction of 1 and drops to the top weight at 0', () => {
    // Both ends are load-bearing: 1 must not simplify at all, and 0 must not return undefined.
    expect(thresholdFor(weighted(1, 2, 3, 4), 1)).toBe(1);
    expect(thresholdFor(weighted(1, 2, 3, 4), 0)).toBe(4);
  });

  it('ignores points that carry no weight rather than counting them as zero', () => {
    // presimplify leaves ring endpoints unweighted. Counting them would pull every threshold down
    // and quietly simplify less than asked.
    expect(thresholdFor(weighted(undefined, 2, undefined, 4, 6), 0.5)).toBe(4);
  });

  it('simplifies nothing when there is nothing weighted to simplify', () => {
    expect(thresholdFor({ arcs: [] }, 0.5)).toBe(0);
    expect(thresholdFor(weighted(undefined, undefined), 0.5)).toBe(0);
  });
});
