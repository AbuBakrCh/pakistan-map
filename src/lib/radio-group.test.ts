/**
 * The radio groups on the keyboard (#35).
 *
 * The renderer is untested here as everywhere. What is testable is where a key lands, and the two
 * places that go wrong silently: the wrap at either end, and the three bases that are `disabled`
 * and will not take focus however hard this points at one.
 */

import { describe, expect, it } from 'vitest';
import { rovingTarget, tabStop } from './radio-group.ts';

/**
 * A basis group with most of its options dimmed — five chips, three of them `disabled`.
 *
 * Not the group as it ships: the strip currently offers Current and three live bases and disables
 * none of them, since the one basis that could not be drawn is now withheld from the menu outright
 * rather than dimmed on it. The stub is kept, and kept this lopsided on purpose — the skipping is
 * what breaks silently, and a group with nothing to skip would stop testing it the moment the app
 * stopped needing it.
 */
const BASES = { count: 5, skip: [2, 3, 4] };

describe('rovingTarget', () => {
  it('moves on both axes, because which one means "next" depends on the frame', () => {
    // The groups wrap onto rows on a narrow screen and scroll along one line on a phone, so the
    // control should not have an opinion about which arrow a reader reaches for.
    for (const key of ['ArrowRight', 'ArrowDown']) {
      expect(rovingTarget(key, { from: 0, count: 4 }), key).toBe(1);
    }
    for (const key of ['ArrowLeft', 'ArrowUp']) {
      expect(rovingTarget(key, { from: 1, count: 4 }), key).toBe(0);
    }
  });

  it('wraps at both ends', () => {
    // A group that stops dead leaves a reader pressing a live key that does nothing, with no way
    // to tell that from a control that has broken.
    expect(rovingTarget('ArrowRight', { from: 3, count: 4 })).toBe(0);
    expect(rovingTarget('ArrowLeft', { from: 0, count: 4 })).toBe(3);
  });

  it('jumps to the ends on Home and End', () => {
    expect(rovingTarget('Home', { from: 2, count: 4 })).toBe(0);
    expect(rovingTarget('End', { from: 2, count: 4 })).toBe(3);
  });

  it('steps over options that cannot take focus, rather than at them', () => {
    // A basis chip that cannot be selected is `disabled`, so the browser refuses it focus. Landing
    // on one makes the arrow key look broken — the ring appears to swallow it.
    expect(rovingTarget('ArrowRight', { from: 1, ...BASES })).toBe(0);
    expect(rovingTarget('ArrowLeft', { from: 0, ...BASES })).toBe(1);
    expect(rovingTarget('End', { from: 0, ...BASES })).toBe(1);
    expect(rovingTarget('Home', { from: 1, ...BASES })).toBe(0);
  });

  it('stays put in a group with one landable option, rather than reporting a move', () => {
    expect(rovingTarget('ArrowRight', { from: 0, count: 3, skip: [1, 2] })).toBe(0);
  });

  it('answers nothing at all when there is nowhere to land', () => {
    expect(rovingTarget('ArrowRight', { from: 0, count: 0 })).toBeNull();
    expect(rovingTarget('Home', { from: 0, count: 2, skip: [0, 1] })).toBeNull();
  });

  it('leaves every other key alone — Space above all', () => {
    /*
     * `Space` is the compare gesture (#22), and `holdsCompare` already refuses it wherever focus
     * is on a control so the control keeps its own click. If this module claimed it too, the key
     * would be taken back from exactly the control that was given it, and a focused chip would
     * both switch variants and drop the map to the baseline.
     */
    for (const key of [' ', 'Spacebar', 'Enter', 'Tab', 'Escape', 'a', 'PageDown']) {
      expect(rovingTarget(key, { from: 0, count: 4 }), key).toBeNull();
    }
  });

  it('recovers from a focus index that is not landable, instead of jamming', () => {
    // Nothing should produce this, but a stale index that returned null forever would leave the
    // group permanently unusable rather than briefly wrong.
    expect(rovingTarget('ArrowRight', { from: 3, ...BASES })).toBe(0);
    expect(rovingTarget('ArrowLeft', { from: 3, ...BASES })).toBe(1);
  });
});

describe('tabStop', () => {
  it('makes the group one stop on the tab ring, at whatever is currently true', () => {
    // Not one stop per option: tabbing through five bases and eight variants to reach the map is
    // a keyboard journey nobody finishes.
    expect(tabStop({ from: 0, count: 4, checked: 2 })).toBe(2);
  });

  it('is still enterable when nothing is checked', () => {
    expect(tabStop({ from: 0, count: 4, checked: null })).toBe(0);
    // And when what is checked is a basis that cannot take focus, so the stop never points at a
    // control the browser will skip.
    expect(tabStop({ from: 0, checked: 2, ...BASES })).toBe(0);
  });

  it('has no stop at all for a group with nothing in it', () => {
    // The variant row before a basis is chosen. It must not become a tab stop that goes nowhere.
    expect(tabStop({ from: 0, count: 0, checked: null })).toBeNull();
  });
});
