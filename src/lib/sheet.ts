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
 * How tall `peek` is is **not** stated here.
 *
 * It is the height of the grip, which is a thing the stylesheet draws — one line of type and
 * something to grab — so the stylesheet states it, as `--sheet-peek`, and it is passed in. The
 * alternative was a number here and a length in the CSS, and those two drifted the moment the root
 * font-size moved: `56` against `3.5rem` agree at a 16px root and are 14px apart at a 20px one, so
 * the collapsed sheet clipped the very line `peek` exists to show whole. Same arrangement as
 * `--switch` and `--sheet`, and for the same reason.
 *
 * A fixed length rather than a fraction, whatever its value: what `peek` holds is a fixed thing, and
 * a fraction would make it two lines on a tablet and half a line on a small phone.
 */

/** What `half` and `full` are, as fractions of the viewport. */
const FRACTION: Readonly<Record<Exclude<Detent, 'peek'>, number>> = {
  // "Roughly 40%", which is the ticket's own figure: enough for the name, the badges and the first
  // paragraph of the rationale, with the majority of the screen still map.
  half: 0.4,
  // Not 1. The sheet stops short of the top so that a strip of map stays visible behind it — the
  // reader is still on a map, and a sheet that covers the screen is a page they have navigated to.
  full: 0.92,
};

/** The viewport the sheet stands in, and the grip height the stylesheet gave it. Both CSS px. */
export interface SheetFrame {
  readonly viewportPx: number;
  readonly peekPx: number;
}

/**
 * How tall the sheet stands at a detent, in the frame it stands in.
 *
 * Clamped in both directions and in this order, so the invariant survives a viewport small enough
 * to break it: `peek` never exceeds the viewport, `half` is never shorter than `peek`, and `full`
 * is never shorter than `half`. On a landscape phone 40% of the height is under the grip's own
 * height, and without the clamp the sheet would get *shorter* as the reader expanded it.
 */
export function heightOf(detent: Detent, frame: SheetFrame): number {
  const peek = Math.min(Math.max(0, frame.peekPx), Math.max(0, frame.viewportPx));
  if (detent === 'peek') return peek;
  const full = Math.max(peek, Math.round(frame.viewportPx * FRACTION.full));
  if (detent === 'full') return full;
  return Math.min(full, Math.max(peek, Math.round(frame.viewportPx * FRACTION.half)));
}

/**
 * How far the sheet stands *mid-drag*, while the finger is still down.
 *
 * Here rather than in the renderer because it is a decision and not plumbing: the sheet follows the
 * finger between the two positions a release could reach, and travel past either end is refused —
 * `settle` cannot reach beyond them, so a sheet that stretched there would have to snap back from
 * somewhere the reader was allowed to drag it to. The renderer had its own copy of this clamp,
 * which made it the one bound in the gesture that nothing tested.
 */
export function heightDuring(from: Detent, offsetPx: number, frame: SheetFrame): number {
  const resting = heightOf(from, frame);
  return Math.min(
    heightOf('full', frame),
    Math.max(heightOf('peek', frame), resting - offsetPx),
  );
}

/** One position of the finger on the grip, in the same space and clock the drag is measured in. */
export interface DragSample {
  /** Vertical position in CSS px. Downward is positive, as screen space is. */
  readonly y: number;
  /** Milliseconds, from any clock, so long as it is the same one throughout a drag. */
  readonly t: number;
}

/**
 * How long a window at the end of a drag counts as "how fast it was going", in ms.
 *
 * Short enough to be the last flick of the wrist and long enough not to be one stray sample.
 */
export const VELOCITY_WINDOW_MS = 100;

/**
 * How fast the finger was moving when it left, in px/s — measured over the **end** of the drag.
 *
 * Averaging displacement over the whole gesture is the obvious implementation and it is wrong, in a
 * way that quietly deletes the rule `settle` exists to apply. The case that rule is written for is a
 * reader who drags the sheet down and then flicks it back up; over the whole drag that gesture has a
 * net displacement near zero and so an average velocity near zero, and `settle` would see no flick,
 * no distance, and leave the sheet where it started — the exact outcome the rule was written to
 * avoid. Only the tail of the gesture says what the hand was doing when it let go.
 *
 * Zero from fewer than two samples, and zero across a window with no elapsed time: a drag nobody
 * moved has no velocity, and neither reading may divide by zero and hand `settle` an infinity that
 * would flick the sheet on a gesture that never happened.
 */
export function velocityFrom(
  samples: readonly DragSample[],
  windowMs: number = VELOCITY_WINDOW_MS,
): number {
  const last = samples[samples.length - 1];
  if (last === undefined || samples.length < 2) return 0;
  // The earliest sample still inside the window — falling back to the one before last, so a drag
  // whose samples arrive further apart than the window is measured rather than reported as still.
  const within = samples.filter((sample) => last.t - sample.t <= windowMs);
  const first = (within.length >= 2 ? within[0] : samples[samples.length - 2]) as DragSample;
  const elapsed = last.t - first.t;
  if (elapsed <= 0) return 0;
  return ((last.y - first.y) / elapsed) * 1000;
}

/**
 * How far a finger may wander on the grip and still be pressing it rather than dragging it.
 *
 * Its own figure and not `DRAG_THRESHOLD_PX`: that one asks whether a finished drag moved the
 * sheet, this one asks whether there was a drag at all. A press is never perfectly still, and a
 * grip that answered a two-pixel tremor as a drag would swallow the press that a reader who cannot
 * drag depends on — the `<button>` half of the handle would read as dead.
 */
export const PRESS_SLOP_PX = 2;

/** Did the finger drag the grip, or merely press it? */
export function draggedRatherThanPressed(offsetPx: number): boolean {
  return Math.abs(offsetPx) > PRESS_SLOP_PX;
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
