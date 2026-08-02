/**
 * The bottom sheet (#33).
 *
 * Two properties, and the second is the one worth the file. The heights are arithmetic with an
 * invariant hiding in them — that the sheet never gets shorter as it is opened — which only breaks
 * on a viewport short enough that nobody tests by hand. And where a drag settles is the whole of
 * what makes a sheet feel right or broken, and cannot be found by reading the code back.
 */

import { describe, expect, it } from 'vitest';
import {
  DETENTS,
  DRAG_THRESHOLD_PX,
  draggedRatherThanPressed,
  FLICK_PX_PER_S,
  handleState,
  heightDuring,
  heightOf,
  nextDetent,
  PRESS_SLOP_PX,
  settle,
  velocityFrom,
  type Detent,
  type SheetDrag,
  type SheetFrame,
} from './sheet.ts';

/** A phone held upright — the screen this ticket is about. */
const PHONE = 844;

/**
 * The grip height comes from the stylesheet, so the tests supply one rather than importing a
 * constant that no longer exists. 56px is what `--sheet-peek` declares at a 16px root.
 */
const PEEK_PX = 56;
const frame = (viewportPx: number, peekPx = PEEK_PX): SheetFrame => ({ viewportPx, peekPx });

const drag = (over: Partial<SheetDrag> = {}): SheetDrag => ({
  from: 'half',
  by: 0,
  velocity: 0,
  ...over,
});

describe('heightOf', () => {
  it('peeks at the handle and the name, and halves at roughly the ticket´s 40%', () => {
    expect(heightOf('peek', frame(PHONE))).toBe(PEEK_PX);
    // "Roughly 40%" is the acceptance criterion, so it is asserted as a share of the screen
    // rather than as the px it happens to come to.
    expect(heightOf('half', frame(PHONE)) / PHONE).toBeCloseTo(0.4, 2);
  });

  it('stops short of the top, so the reader is still on a map', () => {
    // A sheet that covers the screen is a page the reader has navigated to, and this one has not
    // navigated anywhere: the outlines it is arguing for are still drawn behind it.
    expect(heightOf('full', frame(PHONE))).toBeLessThan(PHONE);
    expect(heightOf('full', frame(PHONE)) / PHONE).toBeGreaterThan(0.85);
  });

  it('never gets shorter as it is opened, on any viewport including absurd ones', () => {
    // The invariant the clamps exist for. On a landscape phone 40% of the height is under the
    // peek height, and without them the sheet would shrink when the reader expanded it — which
    // is the one thing a drag upward must never do.
    for (const viewport of [0, 1, 40, 60, 120, 320, 500, PHONE, 1600]) {
      const heights = DETENTS.map((detent) => heightOf(detent, frame(viewport)));
      expect(heights, `viewport ${viewport}`).toEqual([...heights].sort((a, b) => a - b));
      for (const height of heights) {
        expect(height, `viewport ${viewport}`).toBeLessThanOrEqual(Math.max(viewport, PEEK_PX));
        expect(height, `viewport ${viewport}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('never asks for more room than the viewport has', () => {
    for (const viewport of [0, 30, 55, 200]) {
      for (const detent of DETENTS) {
        expect(heightOf(detent, frame(viewport)), `${detent} at ${viewport}`).toBeLessThanOrEqual(
          Math.max(viewport, 0) === 0 ? 0 : Math.max(viewport, PEEK_PX),
        );
      }
    }
  });
});

describe('settle', () => {
  it('leaves a drag that went nowhere where it started', () => {
    // There is no resting position between two detents, so a sheet that stopped here would have
    // to slide somewhere on its own the moment the finger left it.
    expect(settle(drag({ from: 'half', by: DRAG_THRESHOLD_PX - 1 }))).toBe('half');
    expect(settle(drag({ from: 'half', by: -(DRAG_THRESHOLD_PX - 1) }))).toBe('half');
  });

  it('opens on a drag up and closes on a drag down', () => {
    expect(settle(drag({ from: 'peek', by: -DRAG_THRESHOLD_PX }))).toBe('half');
    expect(settle(drag({ from: 'half', by: -DRAG_THRESHOLD_PX }))).toBe('full');
    expect(settle(drag({ from: 'full', by: DRAG_THRESHOLD_PX }))).toBe('half');
    expect(settle(drag({ from: 'half', by: DRAG_THRESHOLD_PX }))).toBe('peek');
  });

  it('answers a flick that never travelled far, which is the gesture people make', () => {
    // Judging on distance alone refuses the short, fast pull that is what a sheet is actually
    // dragged with, and the sheet reads as having missed it.
    expect(settle(drag({ from: 'peek', by: -4, velocity: -FLICK_PX_PER_S }))).toBe('half');
    expect(settle(drag({ from: 'half', by: 4, velocity: FLICK_PX_PER_S }))).toBe('peek');
    expect(settle(drag({ from: 'peek', by: -4, velocity: -(FLICK_PX_PER_S - 1) }))).toBe('peek');
  });

  it('takes the flick over the distance where the two disagree', () => {
    // A reader who dragged the sheet down and then flicked it back up has changed their mind, and
    // the last thing the hand did is the better evidence of what was meant.
    expect(settle(drag({ from: 'half', by: 200, velocity: -900 }))).toBe('full');
    expect(settle(drag({ from: 'half', by: -200, velocity: 900 }))).toBe('peek');
  });

  it('moves one detent per drag and never two', () => {
    // Mapping distance onto detents makes any brisk pull skip `half`, which is the position the
    // whole ticket is about.
    expect(settle(drag({ from: 'peek', by: -900, velocity: -4000 }))).toBe('half');
    expect(settle(drag({ from: 'full', by: 900, velocity: 4000 }))).toBe('half');
  });

  it('will not drag the card off the screen, because there is no state without one', () => {
    // `peek` is the floor. The card arrives and leaves with the outlines (#19), so while a
    // proposal is drawn there is no view in which nothing says whose boundaries those are.
    expect(settle(drag({ from: 'peek', by: 900, velocity: 4000 }))).toBe('peek');
    expect(settle(drag({ from: 'full', by: -900, velocity: -4000 }))).toBe('full');
  });
});

describe('heightDuring', () => {
  it('follows the finger between the two positions the release could reach', () => {
    const at = heightOf('half', frame(PHONE));
    // Dragged 60px up, the sheet stands 60px taller — the gesture is something the reader is
    // doing, not something they ask for and are then shown.
    expect(heightDuring('half', -60, frame(PHONE))).toBe(at + 60);
    expect(heightDuring('half', 60, frame(PHONE))).toBe(at - 60);
  });

  it('refuses to stretch anywhere a release could not leave it', () => {
    // `settle` reaches neither past `full` nor below `peek`, so a sheet allowed to travel there
    // would have to snap back from ground the reader was allowed to drag it onto.
    expect(heightDuring('full', -5000, frame(PHONE))).toBe(heightOf('full', frame(PHONE)));
    expect(heightDuring('peek', 5000, frame(PHONE))).toBe(heightOf('peek', frame(PHONE)));
  });
});

describe('velocityFrom', () => {
  it('reports nothing for a drag that has no two positions to compare', () => {
    // Never a division by zero: an infinity here reads to `settle` as a flick, and would move the
    // sheet on a gesture that never happened.
    expect(velocityFrom([])).toBe(0);
    expect(velocityFrom([{ y: 10, t: 0 }])).toBe(0);
    expect(velocityFrom([{ y: 10, t: 5 }, { y: 90, t: 5 }])).toBe(0);
  });

  it('measures px per second in the direction the finger went', () => {
    expect(velocityFrom([{ y: 0, t: 0 }, { y: 50, t: 50 }])).toBeCloseTo(1000, 5);
    expect(velocityFrom([{ y: 50, t: 0 }, { y: 0, t: 50 }])).toBeCloseTo(-1000, 5);
  });

  it('reads the END of the drag, which is the whole reason it is not an average', () => {
    /*
     * The gesture `settle`'s flick rule is written for: dragged a long way down over 500ms, then
     * flicked back up in the last 60ms. Averaged over the whole drag this has a net displacement
     * near zero and so no velocity at all — `settle` would see no flick, no distance, and leave
     * the sheet where it started, which is precisely the outcome the rule exists to prevent.
     */
    const samples = [
      { y: 0, t: 0 },
      { y: 200, t: 500 },
      { y: 140, t: 540 },
      { y: 40, t: 560 },
    ];
    const average = ((40 - 0) / 560) * 1000;
    expect(Math.abs(average)).toBeLessThan(FLICK_PX_PER_S);
    const measured = velocityFrom(samples);
    expect(measured).toBeLessThan(-FLICK_PX_PER_S);
    // And it therefore reaches the branch the flick rule is written for.
    expect(settle({ from: 'half', by: 40, velocity: measured })).toBe('full');
  });

  it('measures a drag whose samples arrive further apart than the window', () => {
    // A slow or throttled pointer can deliver nothing inside the window at all; reported as still,
    // every such drag would lose its flick.
    expect(velocityFrom([{ y: 0, t: 0 }, { y: 300, t: 300 }], 100)).toBeCloseTo(1000, 5);
  });
});

describe('draggedRatherThanPressed', () => {
  it('lets a press through the tremor that every press has', () => {
    // Its own figure, not `DRAG_THRESHOLD_PX`: that asks whether a finished drag moved the sheet,
    // this asks whether there was a drag at all. Answer a 2px wobble as a drag and the grip
    // swallows the press that a reader who cannot drag depends on — the button would read as dead.
    expect(draggedRatherThanPressed(0)).toBe(false);
    expect(draggedRatherThanPressed(PRESS_SLOP_PX)).toBe(false);
    expect(draggedRatherThanPressed(-PRESS_SLOP_PX)).toBe(false);
    expect(draggedRatherThanPressed(PRESS_SLOP_PX + 1)).toBe(true);
    expect(draggedRatherThanPressed(-(PRESS_SLOP_PX + 1))).toBe(true);
  });

  it('is far below the distance that actually moves the sheet', () => {
    expect(PRESS_SLOP_PX).toBeLessThan(DRAG_THRESHOLD_PX);
  });
});

describe('nextDetent', () => {
  it('reaches every resting position a drag can reach', () => {
    // The handle is a button as well as a grip: a drag is not available to every reader, and a
    // sheet whose middle position only a finger can find is a sheet with a state behind a gesture.
    const seen = new Set<Detent>();
    let at: Detent = 'peek';
    for (let i = 0; i < DETENTS.length; i += 1) {
      seen.add(at);
      at = nextDetent(at);
    }
    expect([...seen].sort()).toEqual([...DETENTS].sort());
    // And it is a cycle, so pressing past the top comes back rather than sticking.
    expect(at).toBe('peek');
  });
});

describe('handleState', () => {
  it('says what the press will do, and leaves where the sheet is to aria-expanded', () => {
    // A button labelled "Collapsed" leaves a reader guessing which way it goes.
    expect(handleState('peek').label).toMatch(/expand/i);
    expect(handleState('half').label).toMatch(/expand/i);
    expect(handleState('full').label).toMatch(/collapse/i);
  });

  it('counts the sheet as expanded exactly where it is showing more than the name', () => {
    expect(handleState('peek').expanded).toBe(false);
    expect(handleState('half').expanded).toBe(true);
    expect(handleState('full').expanded).toBe(true);
  });

  it('names the card rather than the mechanism, on every detent', () => {
    // "Sheet" is a thing the interface does, not a thing the app is about. A screen reader is
    // told which card it is being offered.
    for (const detent of DETENTS) {
      expect(handleState(detent).label, detent).toMatch(/card/i);
    }
  });
});
