/**
 * The scrolling chip strips (#18 on a phone).
 *
 * Both properties here are about a claim the page makes and must not overstate. The position says
 * how many alternatives there are, and must say nothing where saying it would report a state the
 * app does not have — a group of one, or the baseline, which selects no variant at all. The fade
 * says there is more in a direction, and must be gone at the ends, which is exactly where a
 * fractional layout puts it wrong.
 */

import { describe, expect, it } from 'vitest';
import { overflowSides, stripPosition, type StripMetrics } from './strip.ts';

const metrics = (over: Partial<StripMetrics> = {}): StripMetrics => ({
  scrollLeft: 0,
  scrollWidth: 900,
  clientWidth: 370,
  ...over,
});

describe('stripPosition', () => {
  it('names how many there are, and which one is on screen', () => {
    expect(stripPosition(0, 7)).toBe('1/7');
    expect(stripPosition(6, 7)).toBe('7/7');
  });

  it('says nothing of a group with one option in it', () => {
    // Administrative is exactly this: A6 and nothing else. `1/1` is a count of a chip the reader
    // is already looking at whole.
    expect(stripPosition(0, 1)).toBeNull();
    expect(stripPosition(0, 0)).toBeNull();
  });

  it('says nothing where nothing is checked, rather than reporting a position of zero', () => {
    // The baseline selects no variant (#23), and `d3`'s `findIndex` answers -1 for it.
    expect(stripPosition(-1, 7)).toBeNull();
  });

  it('refuses an index the group does not have', () => {
    expect(stripPosition(7, 7)).toBeNull();
  });
});

describe('overflowSides', () => {
  it('points to the end while the chips run past it', () => {
    expect(overflowSides(metrics())).toBe('end');
  });

  it('points both ways in the middle of a strip', () => {
    expect(overflowSides(metrics({ scrollLeft: 200 }))).toBe('both');
  });

  it('points back to the start once there is nothing left to the right', () => {
    expect(overflowSides(metrics({ scrollLeft: 530 }))).toBe('start');
  });

  it('says nothing at all where every chip already fits', () => {
    expect(overflowSides(metrics({ scrollWidth: 340 }))).toBe('none');
  });

  it('is settled at the end, where the arithmetic is fractional', () => {
    // A strip scrolled fully right reports a `scrollLeft` a fraction short of the difference, and
    // an exact test leaves the fade standing at the one place there is nothing beyond it.
    expect(overflowSides(metrics({ scrollLeft: 529.6 }))).toBe('start');
    expect(overflowSides(metrics({ scrollLeft: 0.4 }))).toBe('end');
  });
});
