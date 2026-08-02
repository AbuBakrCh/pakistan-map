/**
 * The card as a bottom sheet (#33) — the imperative half.
 *
 * A file of its own rather than more of `panel.ts`, for the reason `map.ts` and `panel.ts` are
 * already apart: this is a mechanism over the card, not a part of the card. `panel.ts` decides
 * which element gets which class and composes not one sentence; this decides how tall the box is
 * and nothing about what is in it, and the two never need to know each other. The card is
 * rendered into `#card` exactly as it was on a wide screen; on a narrow one, this puts a grip on
 * the same element and gives it a height.
 *
 * Every decision it makes is upstream in `lib/sheet.ts`, under test. What is left here is pointer
 * plumbing and two custom properties, neither of which has a seam to be asserted at — the repo has
 * no jsdom, deliberately.
 *
 * Whether the sheet applies at all is asked of the stylesheet rather than answered again here, the
 * same way `map.ts` reads `--switch`: a breakpoint stated in two places is a breakpoint that
 * eventually disagrees with itself, and a sheet whose JS thinks it is a sheet while its CSS thinks
 * it is a column would set a height on a box that is not positioned to have one.
 */

import {
  handleState,
  heightOf,
  nextDetent,
  settle,
  type Detent,
  type SheetDrag,
} from './lib/sheet.ts';

/**
 * Is the page narrow enough that the card is a sheet?
 *
 * Asked of the stylesheet, which owns the breakpoint, and exported because `map.ts` needs the same
 * answer: where the sheet exists the tooltip has to dock rather than follow the finger, and a
 * second copy of `560px` in the renderer is the disagreement this arrangement exists to prevent.
 */
export function isSheetLayout(): boolean {
  return getComputedStyle(document.documentElement).getPropertyValue('--sheet').trim() === '1';
}

export interface SheetHandle {
  /**
   * A card arrived or left. The sheet arrives and leaves with it, because the card does: at the
   * baseline there is no proposal on screen and there is nothing for a sheet to hold.
   */
  show(hasCard: boolean): void;
}

/** Where a proposal first presents itself: the ticket's own 40%. */
const OPENS_AT: Detent = 'half';

export function attachSheet(container: HTMLElement): SheetHandle {
  /*
   * The grip. Inserted ahead of the card rather than inside it, because `renderVariantCard`
   * replaces the article's children on every switch and a handle inside it would be thrown away
   * with the last proposal's prose.
   *
   * A `<button>` and not a bare div with a drag on it. A drag is a gesture some readers do not
   * have, and the middle detent must not be a state that only a finger can reach; making it a
   * button costs nothing and settles the keyboard case before #35 arrives at it.
   */
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'sheet-handle';
  const grip = handle.appendChild(document.createElement('span'));
  grip.className = 'sheet-grip';
  grip.setAttribute('aria-hidden', 'true');
  const label = handle.appendChild(document.createElement('span'));
  label.className = 'sheet-handle-label';
  container.insertBefore(handle, container.firstChild);

  let detent: Detent = OPENS_AT;
  /** Null except between a pointer going down on the grip and coming back up. */
  let dragging: { readonly from: Detent; readonly y: number; readonly at: number } | null = null;
  /** How far the sheet has been pulled mid-drag, so releasing can be told from resting. */
  let offset = 0;
  /**
   * Whether the pointer moved between going down on the grip and coming up.
   *
   * Kept past the end of the drag on purpose. A `<button>` fires `click` after `pointerup`, so a
   * drag that has already settled arrives here a second time as a press — and without this flag
   * every drag would settle at one detent and then advance itself to the next.
   */
  let dragged = false;

  function paint(): void {
    if (!isSheetLayout()) {
      // On a wide screen the card is a column in the flow and must be left alone entirely: a
      // height set here would survive the breakpoint and pin the desktop card to 40% of a screen
      // it is not anchored to.
      container.removeAttribute('data-detent');
      document.documentElement.style.removeProperty('--sheet-h');
      handle.hidden = true;
      return;
    }
    handle.hidden = false;
    const state = handleState(detent);
    label.textContent = state.label;
    handle.setAttribute('aria-expanded', state.expanded ? 'true' : 'false');
    handle.setAttribute('aria-controls', container.id);

    const resting = heightOf(detent, window.innerHeight);
    // Mid-drag the sheet follows the finger between the detents it could settle at, so the gesture
    // is something the reader is doing rather than something they ask for and are then shown. The
    // travel is clamped to the outer two, since `settle` can reach neither past them.
    const height = Math.min(
      heightOf('full', window.innerHeight),
      Math.max(heightOf('peek', window.innerHeight), resting - offset),
    );
    container.setAttribute('data-detent', detent);
    container.toggleAttribute('data-dragging', dragging !== null);
    document.documentElement.style.setProperty('--sheet-h', `${Math.round(height)}px`);
  }

  handle.addEventListener('pointerdown', (event) => {
    if (!isSheetLayout()) return;
    dragging = { from: detent, y: event.clientY, at: event.timeStamp };
    offset = 0;
    dragged = false;
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener('pointermove', (event) => {
    if (dragging === null) return;
    offset = event.clientY - dragging.y;
    // A press is never perfectly still, so a pixel or two of tremor is not a drag — otherwise a
    // reader who taps the grip firmly gets nothing at all.
    if (Math.abs(offset) > 2) dragged = true;
    paint();
  });

  function endDrag(event: PointerEvent): void {
    if (dragging === null) return;
    const by = event.clientY - dragging.y;
    const elapsed = Math.max(1, event.timeStamp - dragging.at);
    const drag: SheetDrag = { from: dragging.from, by, velocity: (by / elapsed) * 1000 };
    dragging = null;
    offset = 0;
    detent = settle(drag);
    paint();
  }

  handle.addEventListener('pointerup', endDrag);
  // A capture lost to the system — a call arriving, the page being scrolled out from under the
  // gesture — has to settle the sheet somewhere rather than leave it stranded between detents with
  // `dragging` still set and every subsequent move dragging it further.
  handle.addEventListener('pointercancel', endDrag);
  handle.addEventListener('lostpointercapture', endDrag);

  /*
   * The press — the half of the handle that is a button.
   *
   * Refused after a drag, because a drag on a `<button>` ends with a `click` as well as a
   * `pointerup`: without the guard every drag would settle where the reader put it and then
   * advance itself a further detent on its own. A keyboard activation reports `detail === 0` and
   * carries no drag with it, so it is let through whatever the last finger did.
   */
  handle.addEventListener('click', (event) => {
    if (!isSheetLayout()) return;
    if (event.detail !== 0 && dragged) return;
    dragged = false;
    detent = nextDetent(detent);
    paint();
  });

  // The viewport changing is the breakpoint changing as often as not, and the heights are
  // fractions of it either way.
  window.addEventListener('resize', paint);

  function show(hasCard: boolean): void {
    if (!hasCard) {
      // Reset rather than remember. The next proposal is a different argument and presents itself
      // the same way the first one did; a sheet left at `full` from two variants ago would open
      // the next one over the map the reader chose it to look at.
      detent = OPENS_AT;
    }
    paint();
  }

  paint();
  return { show };
}
