/**
 * The compare gesture (#22) — which presses are ours, and what is on screen because of them.
 *
 * The renderer is untested here as everywhere: `map.ts` and `main.ts` are imperative D3 against
 * the DOM and the repo has no jsdom, deliberately. What is testable is what the gesture *decides*,
 * and both halves of that are places where being wrong is silent — a key claimed from a control
 * that had already been given it, or a hold that never ends.
 */

import { describe, expect, it } from 'vitest';
import {
  answersSpaceItself,
  comparedDescription,
  compareGesture,
  holdsCompare,
  releasesCompare,
  type Keystroke,
} from './compare.ts';

/** An unmodified press of `Space` with focus nowhere in particular — the gesture as intended. */
const press = (over: Partial<Keystroke> = {}): Keystroke => ({
  key: ' ',
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  onControl: false,
  ...over,
});

describe('holdsCompare', () => {
  it('claims an unmodified Space, which is the gesture the ticket asks for', () => {
    expect(holdsCompare(press())).toBe(true);
    // Reported as 'Spacebar' by older engines. The same key, so the same gesture.
    expect(holdsCompare(press({ key: 'Spacebar' }))).toBe(true);
  });

  it('claims nothing else on the keyboard', () => {
    for (const key of ['Enter', 'c', 'Escape', 'ArrowLeft', 'Tab']) {
      expect(holdsCompare(press({ key })), key).toBe(false);
    }
  });

  it('leaves a modified Space to the browser, the input method and the system', () => {
    // Ctrl+Space, Alt+Space and Cmd+Space are already spoken for outside this page. Swallowing
    // three shortcuts in order to be given one is not a trade a single-page map may make.
    const modified: readonly (readonly [string, Partial<Keystroke>])[] = [
      ['Alt', { altKey: true }],
      ['Ctrl', { ctrlKey: true }],
      ['Cmd', { metaKey: true }],
      ['Shift', { shiftKey: true }],
    ];
    for (const [name, stroke] of modified) {
      expect(holdsCompare(press(stroke)), name).toBe(false);
    }
  });

  it('does not take Space from a control that has already been given it', () => {
    // The conflict this rule exists for: the Compare button is itself a button, and a focused
    // button fires its own click on Space. Firing the hold as well would press the button *and*
    // hold the key — the two cancel, and the control reads as dead to a keyboard reader.
    expect(holdsCompare(press({ onControl: true }))).toBe(false);
  });
});

describe('answersSpaceItself', () => {
  const focused = (tagName: string) => ({ tagName, isContentEditable: false });

  it('names the controls this page actually has — every one of them a button', () => {
    // The Compare button, the five basis chips and the variant chips. Space on any of them does
    // what that control does, and compare is reached from anywhere focus is not one.
    expect(answersSpaceItself(focused('BUTTON'))).toBe(true);
    expect(answersSpaceItself(focused('button'))).toBe(true);
  });

  it('covers the rest of the interactive vocabulary, ahead of anything needing it', () => {
    for (const tag of ['INPUT', 'SELECT', 'TEXTAREA', 'A', 'SUMMARY', 'OPTION']) {
      expect(answersSpaceItself(focused(tag)), tag).toBe(true);
    }
    expect(answersSpaceItself({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('leaves the map itself, which is where a reader stands to compare', () => {
    // The SVG carries `tabindex="0"` so it is reachable by keyboard, and it is not a control:
    // Space over the map means compare and nothing else.
    expect(answersSpaceItself(focused('svg'))).toBe(false);
    expect(answersSpaceItself(focused('BODY'))).toBe(false);
    expect(answersSpaceItself(null)).toBe(false);
  });
});

describe('releasesCompare', () => {
  it('ends on the key alone, whatever was held with it and wherever focus went', () => {
    // Deliberately more forgiving than the press. A modifier pressed during the hold, or focus
    // moved into a control while the key was down, must still end it: the alternative is a map
    // stuck on the baseline while the card beside it argues for a proposal that is not drawn.
    expect(releasesCompare(' ')).toBe(true);
    expect(releasesCompare('Spacebar')).toBe(true);
    expect(releasesCompare('Enter')).toBe(false);
  });
});

describe('compareGesture', () => {
  it('starts off, because the baseline is not a comparison of itself', () => {
    expect(compareGesture().on).toBe(false);
  });

  it('is on while the key is down and off the moment it comes up', () => {
    const gesture = compareGesture();
    expect(gesture.hold()).toBe(true);
    expect(gesture.on).toBe(true);
    expect(gesture.release()).toBe(true);
    expect(gesture.on).toBe(false);
  });

  it('reports a change and not an event, which is what the auto-repeat needs it to do', () => {
    // A held key repeats its `keydown` several times a second, and each repeat is still the
    // gesture's press — swallowed, so the page does not scroll. What none of them may do is
    // redraw: a cross-fade restarted mid-fade forty times over is the whole gesture flickering.
    const gesture = compareGesture();
    gesture.hold();
    expect(gesture.hold()).toBe(false);
    gesture.release();
    expect(gesture.release()).toBe(false);
  });

  it('holds by the button until the button is pressed again — the same gesture, no keyboard', () => {
    const gesture = compareGesture();
    expect(gesture.press()).toBe(true);
    expect(gesture.on).toBe(true);
    expect(gesture.press()).toBe(true);
    expect(gesture.on).toBe(false);
  });

  it('does not let a key release cancel what the button is holding', () => {
    // Both reach one state, so the two can be mixed; neither may quietly undo the other. A reader
    // who pressed the button and then rested a finger on Space must not lose the comparison when
    // the finger comes off.
    const gesture = compareGesture();
    gesture.press();
    gesture.hold();
    expect(gesture.release()).toBe(false);
    expect(gesture.on).toBe(true);
  });

  it('lets everything go when the page loses the key, or the reader asks for a proposal', () => {
    // Alt-tabbing with Space down delivers the keyup somewhere else entirely, and this map would
    // keep the gesture forever. Choosing a variant clears it for the other reason: someone who
    // asks to see a proposal has asked to stop comparing.
    const gesture = compareGesture();
    gesture.press();
    gesture.hold();
    expect(gesture.interrupt()).toBe(true);
    expect(gesture.on).toBe(false);
    expect(gesture.interrupt()).toBe(false);
  });
});

describe('comparedDescription', () => {
  it('says the proposal is held off the map, not that it is gone', () => {
    // `role="img"` hides every shape, so this sentence is the whole of what the map says about
    // itself while it is being compared. A reader told only "current provinces and divisions"
    // would have no way to know the proposal is still selected and one key away.
    const spoken = comparedDescription(
      'Map of Pakistan showing current provinces, territories and divisions',
      'South Punjab Secretariat',
    );
    expect(spoken).toContain('current provinces, territories and divisions');
    expect(spoken).toContain('South Punjab Secretariat');
    expect(spoken).toContain('full strength');
    expect(spoken).toContain('returns when compare is released');
  });
});
