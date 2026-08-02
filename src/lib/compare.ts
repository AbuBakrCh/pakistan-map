/**
 * Compare (#22) — the one comparison this app makes.
 *
 * Holding `Space` drops stratum 1 and stratum 3 and gives the current boundaries back at full
 * strength; letting go puts the proposal back exactly as it was, zoom and pan included. That is
 * the whole of it: no side-by-side, no cross-variant table, no second map (D17). The current map
 * is what every proposal argues against, so it is the only thing a variant is ever shown against.
 *
 * Nothing here draws. What is here is the part with a decision in it — **when the key press is
 * ours**, and **what the gesture is on at any moment** — because both are places where being
 * wrong is silent. A gesture that keeps hold of Space takes the space bar away from every control
 * on the page; a gesture that misses a release leaves the map showing the country while the card
 * beside it argues for a proposal that is no longer drawn.
 *
 * The word is *held*, not toggled (CONTEXT.md reserves the term): compare is held by the key
 * while the key is down, and held by the button until the button is pressed again. One state,
 * reached two ways — which is what makes the button *the same gesture* for a reader with no
 * keyboard rather than a second feature that happens to look like it.
 */

/** The key, under both the name browsers report today and the one older ones reported. */
const SPACE: ReadonlySet<string> = new Set([' ', 'Spacebar']);

/** What we need of a `KeyboardEvent`, so the decision below can be tested without one. */
export interface Keystroke {
  readonly key: string;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  /** Whether focus is sitting in something that answers `Space` on its own account. */
  readonly onControl: boolean;
}

/** What we need of the focused element. Two fields, so a plain object stands in for one. */
export interface FocusedElement {
  readonly tagName: string;
  readonly isContentEditable: boolean;
}

/**
 * The elements for which `Space` already means something, and therefore cannot also mean compare.
 *
 * `<button>` is the one that matters here and it is not a hypothetical: the Compare button, the
 * five basis chips and the variant chips are all buttons, and a focused button fires its own
 * `click` on `Space`. Were the hold to fire as well, pressing `Space` on the focused Compare
 * button would hold compare down *and* press the button — the two would cancel, and a keyboard
 * reader would find the control dead. Pressing `Space` on a focused variant chip would switch
 * variants under a map that had just gone to the baseline.
 *
 * So the rule is that the gesture never takes a key another control has already been given.
 * `Space` on a focused control does what that control does, and nothing else; the hold is
 * available everywhere focus is *not* a control, the map included — it carries `tabindex="0"`,
 * so it is reachable by keyboard and is the natural place to stand while comparing.
 *
 * The full accessibility pass is #35's. This is not it: it is the narrower obligation not to
 * leave a conflict behind for #35 to find.
 */
const ANSWERS_SPACE_ITSELF: ReadonlySet<string> = new Set([
  'BUTTON',
  'INPUT',
  'SELECT',
  'TEXTAREA',
  'A',
  'SUMMARY',
  'OPTION',
]);

export function answersSpaceItself(element: FocusedElement | null): boolean {
  if (element === null) return false;
  return element.isContentEditable || ANSWERS_SPACE_ITSELF.has(element.tagName.toUpperCase());
}

/**
 * Is this press the compare gesture?
 *
 * Modified presses are refused rather than swallowed: `Ctrl+Space` and `Shift+Space` belong to
 * the browser, to an input method, and on a Mac to the system — claiming them would be this app
 * taking three shortcuts to be given one.
 *
 * Auto-repeat is deliberately *not* asked about here, and the omission is the point. A key held
 * down repeats its `keydown`, and every one of those repeats would scroll the page if its default
 * were let through — so a repeat is still the gesture's press and is still swallowed. What a
 * repeat must not do is redraw, and that is `hold()`'s answer below: it reports whether the state
 * moved, and on a repeat it has not.
 */
export function holdsCompare(stroke: Keystroke): boolean {
  if (!SPACE.has(stroke.key) || stroke.onControl) return false;
  return !(stroke.altKey || stroke.ctrlKey || stroke.metaKey || stroke.shiftKey);
}

/**
 * Is this release the end of it?
 *
 * Deliberately more forgiving than the press: the key alone, with no modifier check and no
 * question about where focus is. A modifier pressed *during* the hold, or focus moved into a
 * control by something else while the key was down, must still end the gesture — the failure the
 * strictness would buy is a map stuck on the baseline with the card beside it arguing for a
 * proposal that is not drawn, and that is far worse than a release that was never needed.
 */
export function releasesCompare(key: string): boolean {
  return SPACE.has(key);
}

/**
 * Whether the baseline is standing in for the selection right now, and the four things that
 * change it.
 *
 * Every mutator answers whether the state actually moved, so the caller redraws on a change and
 * not on an event. It matters: `keydown` repeats for as long as a key is down, and a redraw per
 * repeat would be a cross-fade restarted forty times a second.
 */
export interface CompareGesture {
  /** True while the current map is shown in place of the selection. */
  readonly on: boolean;
  /** The key went down. */
  hold(): boolean;
  /** The key came up — or the page lost it, which is `interrupt`. */
  release(): boolean;
  /** The button was pressed: it holds compare until it is pressed again. */
  press(): boolean;
  /**
   * Everything let go at once: the window lost focus, or a variant was chosen.
   *
   * A held key whose `keyup` never arrives is not hypothetical — alt-tabbing away with `Space`
   * down delivers the release to whatever the reader switched to, and this map would keep the
   * gesture forever. Choosing a variant clears it for a different reason: a reader who asks to
   * see a proposal has asked to stop comparing.
   */
  interrupt(): boolean;
}

export function compareGesture(): CompareGesture {
  /** Held by the key, for as long as it is down. */
  let byKey = false;
  /** Held by the button, until the button is pressed again. */
  let byButton = false;

  const gesture = {
    get on(): boolean {
      return byKey || byButton;
    },
    hold(): boolean {
      const was = gesture.on;
      byKey = true;
      return gesture.on !== was;
    },
    release(): boolean {
      const was = gesture.on;
      byKey = false;
      return gesture.on !== was;
    },
    press(): boolean {
      const was = gesture.on;
      byButton = !byButton;
      return gesture.on !== was;
    },
    interrupt(): boolean {
      const was = gesture.on;
      byKey = false;
      byButton = false;
      return gesture.on !== was;
    },
  };
  return gesture;
}

/**
 * What the map is while it is being compared, for the reader who cannot see it.
 *
 * `role="img"` hides every shape, so the map's own label is the whole of what it says about
 * itself — and during compare it is saying something different from both of the sentences it
 * otherwise has. It names the variant it is standing in for, because the one thing a reader must
 * not be left with is the impression that the proposal was never drawn or has been abandoned.
 */
export function comparedDescription(baseline: string, variant: string): string {
  return (
    `${baseline}. Compared: the shading and the proposed boundaries of "${variant}" are held ` +
    `off the map, and the current provinces and divisions are drawn at full strength. The ` +
    `proposal returns when compare is released`
  );
}

/** What the button says, and what it says it is. */
export const COMPARE_LABEL = 'Compare';

/**
 * The gesture, in words, beside the button. Printed rather than left in a `title`: a `title`
 * needs a hovering mouse, and this app's hard bar is a 390px phone — where the button is the
 * whole gesture and the sentence is how a reader learns there is a key as well.
 */
export const COMPARE_HINT = 'or hold Space';

export const COMPARE_TITLE =
  'Show the current provinces and divisions at full strength, with the shading and the proposed ' +
  'boundaries held off the map. Hold Space for the same thing.';
