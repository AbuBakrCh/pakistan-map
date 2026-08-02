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
  draggedRatherThanPressed,
  handleState,
  heightDuring,
  nextDetent,
  settle,
  velocityFrom,
  type Detent,
  type DragSample,
  type SheetFrame,
} from './lib/sheet.ts';

/**
 * Is the page narrow enough that the card is a sheet?
 *
 * Asked of the stylesheet, which owns the breakpoint, and exported because `map.ts` needs the same
 * answer: where the sheet exists the tooltip has to dock rather than follow the finger, and a
 * second copy of `560px` in the renderer is the disagreement this arrangement exists to prevent.
 */
let layoutCache: boolean | null = null;

export function isSheetLayout(): boolean {
  if (layoutCache === null) {
    layoutCache = readRootVar('--sheet') === '1';
  }
  return layoutCache;
}

/*
 * The answer only changes when the viewport crosses the breakpoint, and it is asked on every
 * `pointermove` — `map.ts` puts the question once per frame of a hover to decide whether the
 * tooltip follows the pointer. `getComputedStyle` forces a style resolution, so uncached that is a
 * layout read per pointer event for a value that moves twice a session.
 */
window.addEventListener('resize', () => {
  layoutCache = null;
});

function readRootVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * The frame the sheet stands in: the viewport, and the grip height the **stylesheet** states.
 *
 * `--sheet-peek` is read rather than restated, so the height `heightOf` computes and the height the
 * grip is actually drawn at cannot drift — they did, as a `56` here against a `3.5rem` there, which
 * agree at a 16px root and are 14px apart at a 20px one.
 */
function frame(): SheetFrame {
  const peek = Number.parseFloat(readRootVar('--sheet-peek'));
  return {
    viewportPx: window.innerHeight,
    peekPx: Number.isFinite(peek) ? peek : 0,
  };
}

export interface SheetHandle {
  /**
   * A card arrived, or left.
   *
   * Two things follow from it. The sheet **takes up no room at all** when there is no card —
   * `panel.ts` hides the container at the baseline, and a reserved height left standing behind it
   * would float the furniture that rides above the sheet into the middle of a map with no sheet
   * under it. And a card that leaves takes the reader's detent with it: the next proposal is a
   * different argument and presents itself the way the first one did, rather than opening at
   * `full` because somebody dragged it there two variants ago.
   */
  cardChanged(present: boolean): void;
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
  /** Whether there is a proposal on screen for the sheet to hold. */
  let hasCard = false;
  /** Null except between a pointer going down on the grip and coming back up. */
  let dragging: { readonly from: Detent; readonly y: number } | null = null;
  /**
   * Where the finger has been during this drag.
   *
   * Kept so the release can be judged on the *end* of the gesture rather than on its average. A
   * drag down that finishes with a flick back up has a net displacement near zero, and averaged it
   * would read as no gesture at all.
   */
  let samples: DragSample[] = [];
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
    /*
     * No card, no sheet, and no room kept for one. `--sheet-h` is what the compare and export
     * buttons sit above, so leaving it at the last detent while the card is hidden strands them
     * 338px up a map that has nothing underneath them.
     */
    handle.hidden = !hasCard;
    if (!hasCard) {
      container.removeAttribute('data-detent');
      document.documentElement.style.setProperty('--sheet-h', '0px');
      return;
    }
    const state = handleState(detent);
    label.textContent = state.label;
    handle.setAttribute('aria-expanded', state.expanded ? 'true' : 'false');
    handle.setAttribute('aria-controls', container.id);

    // Mid-drag the sheet follows the finger, so the gesture is something the reader is doing rather
    // than something they ask for and are then shown. Where it may follow it to is `lib/sheet.ts`'s.
    const height = heightDuring(detent, offset, frame());
    container.setAttribute('data-detent', detent);
    container.toggleAttribute('data-dragging', dragging !== null);
    document.documentElement.style.setProperty('--sheet-h', `${Math.round(height)}px`);
  }

  handle.addEventListener('pointerdown', (event) => {
    if (!isSheetLayout()) return;
    dragging = { from: detent, y: event.clientY };
    samples = [{ y: event.clientY, t: event.timeStamp }];
    offset = 0;
    dragged = false;
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener('pointermove', (event) => {
    if (dragging === null) return;
    offset = event.clientY - dragging.y;
    samples.push({ y: event.clientY, t: event.timeStamp });
    if (draggedRatherThanPressed(offset)) dragged = true;
    paint();
  });

  function endDrag(event: PointerEvent): void {
    if (dragging === null) return;
    samples.push({ y: event.clientY, t: event.timeStamp });
    const from = dragging.from;
    const by = event.clientY - dragging.y;
    const velocity = velocityFrom(samples);
    dragging = null;
    samples = [];
    offset = 0;
    detent = settle({ from, by, velocity });
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

  function cardChanged(present: boolean): void {
    if (!present) detent = OPENS_AT;
    hasCard = present;
    paint();
  }

  paint();
  return { cardChanged };
}
