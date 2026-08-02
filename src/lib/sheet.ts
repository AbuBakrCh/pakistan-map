/**
 * The bottom sheet (#33) — where the card sits when the page is a phone.
 *
 * On a wide screen the variant card is a column beside the map and needs no mechanism. On a
 * 390px one it cannot be: a card with a rationale, a unit list, a scorecard and a source list is
 * several screens of prose, and putting it under the map means the map scrolls away the moment a
 * reader reads what is drawn on it. So on a narrow screen the card becomes a sheet anchored to the
 * bottom of the viewport, and the reader chooses how much of the screen it is allowed.
 *
 * Nothing here draws or measures anything. What is here is the part with a decision in it: how
 * tall each resting position is, and — the one that is actually hard — which resting position a
 * drag ends at. A sheet that settles somewhere the reader did not mean is the whole of what makes
 * a bottom sheet feel broken, and it is not a thing that can be found by reading the code back.
 *
 * The card is never dismissed from here, and that is deliberate rather than missing. The card
 * arrives and leaves with the outlines (#19): at the baseline there is no proposal on screen and
 * no sheet either, and while a proposal *is* on screen there is no state in this app that draws
 * boundaries with nothing saying whose they are. So `peek` is the floor — the sheet gets out of
 * the way, and cannot be got rid of.
 */

/** The three resting positions, smallest first. The order is the type. */
export const DETENTS = ['peek', 'half', 'full'] as const;

export type Detent = (typeof DETENTS)[number];

/**
 * How tall `peek` is, in CSS px: the drag handle and the proposal's name, and nothing else.
 *
 * A fixed height rather than a fraction, because what it has to hold is a fixed thing — one line
 * of type and something to grab. A fraction would make it two lines on a tablet and half a line on
 * a small phone.
 */
export const PEEK_PX = 56;

/** What `half` and `full` are, as fractions of the viewport. */
const FRACTION: Readonly<Record<Exclude<Detent, 'peek'>, number>> = {
  // "Roughly 40%", which is the ticket's own figure: enough for the name, the badges and the first
  // paragraph of the rationale, with the majority of the screen still map.
  half: 0.4,
  // Not 1. The sheet stops short of the top so that a strip of map stays visible behind it — the
  // reader is still on a map, and a sheet that covers the screen is a page they have navigated to.
  full: 0.92,
};

/**
 * How tall the sheet stands at a detent, given the viewport it stands in.
 *
 * Clamped in both directions and in this order, so the invariant survives a viewport small enough
 * to break it: `peek` never exceeds the viewport, `half` is never shorter than `peek`, and `full`
 * is never shorter than `half`. On a landscape phone 40% of the height is under 56px, and without
 * the clamp the sheet would get *shorter* as the reader expanded it.
 */
export function heightOf(detent: Detent, viewportPx: number): number {
  const peek = Math.min(PEEK_PX, Math.max(0, viewportPx));
  if (detent === 'peek') return peek;
  const full = Math.max(peek, Math.round(viewportPx * FRACTION.full));
  if (detent === 'full') return full;
  return Math.min(full, Math.max(peek, Math.round(viewportPx * FRACTION.half)));
}

/** How far a drag must travel to move the sheet a detent, in CSS px. */
export const DRAG_THRESHOLD_PX = 48;

/**
 * How fast a drag must be released to move the sheet a detent whatever the distance, in px/s.
 *
 * The gesture people actually make is a flick — short, fast, and over before it has travelled far.
 * Judging on distance alone would refuse it and leave the sheet where it was, which reads as the
 * sheet having missed the gesture rather than as the reader having under-dragged.
 */
export const FLICK_PX_PER_S = 500;

/** What we need of a finished drag on the handle. Downward is positive, as screen space is. */
export interface SheetDrag {
  /** Where the sheet was when the drag began. */
  readonly from: Detent;
  /** How far the handle moved, in CSS px. Positive is down — toward `peek`. */
  readonly by: number;
  /** How fast it was moving when released, in px/s. Positive is down. */
  readonly velocity: number;
}

/**
 * Where a drag leaves the sheet.
 *
 * Velocity is asked first and distance second, and that order is the decision: a reader who drags
 * the sheet down and then flicks it back up has changed their mind, and the last thing their hand
 * did is the better evidence of what they meant than the furthest it got. Where neither the flick
 * nor the distance qualifies, the sheet returns to where it started rather than splitting the
 * difference — there is no resting position between two detents, so anywhere else is a place the
 * sheet would have to slide away from on its own.
 *
 * One detent per drag, never two. A long drag from `peek` past `half` to `full` is a gesture that
 * has to be made twice, because the alternative — mapping distance onto detents — makes the sheet
 * skip `half` on any brisk pull, and `half` is the position the ticket is actually about.
 */
export function settle(drag: SheetDrag): Detent {
  const direction =
    Math.abs(drag.velocity) >= FLICK_PX_PER_S
      ? Math.sign(drag.velocity)
      : Math.abs(drag.by) >= DRAG_THRESHOLD_PX
        ? Math.sign(drag.by)
        : 0;
  if (direction === 0) return drag.from;
  // Down is a smaller sheet, so a positive direction steps *back* through the list.
  return step(drag.from, direction > 0 ? -1 : 1);
}

/** One detent along, stopping at the ends rather than wrapping. */
function step(from: Detent, by: 1 | -1): Detent {
  const at = DETENTS.indexOf(from);
  const next = Math.min(DETENTS.length - 1, Math.max(0, at + by));
  return DETENTS[next] as Detent;
}

/**
 * Where pressing the handle leaves the sheet.
 *
 * The handle is a button as well as something to drag, because a drag is not available to every
 * reader and because the sheet must be reachable from a keyboard (#35 is the full pass; this is
 * the obligation not to leave it a control that only a finger can work). Pressing it opens the
 * sheet one detent and, at the top, returns it to `peek` — a cycle rather than a pair, so every
 * resting position a drag can reach a press can reach too.
 */
export function nextDetent(from: Detent): Detent {
  return from === 'full' ? 'peek' : step(from, 1);
}

/** What the handle says it will do, and whether the sheet counts as open while it says it. */
export interface HandleState {
  /** The button's accessible name — what pressing it does, not where the sheet is. */
  readonly label: string;
  /** `aria-expanded` on the handle: whether the card is showing more than its name. */
  readonly expanded: boolean;
}

/**
 * The handle, in words.
 *
 * Named for what the press *does* rather than for where the sheet *is*, because a button called
 * "Collapsed" leaves a reader guessing whether pressing it collapses or uncollapses. `aria-expanded`
 * carries the state, which is the attribute that exists for exactly that.
 */
export function handleState(detent: Detent): HandleState {
  if (detent === 'full') return { label: 'Collapse the proposal card', expanded: true };
  return {
    label: 'Expand the proposal card',
    expanded: detent !== 'peek',
  };
}
