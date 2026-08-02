/**
 * Moving between the options of a radio group with the keyboard (#35).
 *
 * The two selectors have declared `role="radiogroup"` and `role="radio"` since #18, and that is a
 * promise about the keyboard as much as about the accessible name: a radio group is **one** stop on
 * the tab ring, and the arrow keys move within it and select as they go. Until this ticket the
 * markup said radio group and the behaviour said "five separate buttons" — a screen-reader user was
 * told to expect arrow keys and given nothing when they pressed them, which is worse than an
 * undeclared list, because the wrong instruction costs more than no instruction.
 *
 * Nothing here touches the DOM. What is here is the part with a decision in it — **where a key
 * lands** — and it is worth its own file for two reasons that are easy to get wrong silently: the
 * wrap at either end, and the three bases that cannot be selected at all. A group that stops dead
 * at the last option leaves a reader pressing a key that does nothing; a group that lands on a
 * disabled basis puts focus somewhere `disabled` will not let it go, and the ring appears to
 * swallow the press.
 */

/** What we need to know about the group to answer where a key goes. */
export interface RovingOptions {
  /** Which option has focus now. */
  readonly from: number;
  /** How many options the group has. */
  readonly count: number;
  /**
   * Options that cannot be landed on.
   *
   * The three bases with no variants and no shading are rendered `disabled`, so the browser will
   * not focus them however hard this module points at one. They are skipped rather than removed:
   * the working agreement has them *offered and refused out loud*, and the refusal is a line of
   * text beside the chip, which a screen reader reads in flow whether or not the chip takes focus.
   */
  readonly skip?: readonly number[];
}

const FORWARD: ReadonlySet<string> = new Set(['ArrowRight', 'ArrowDown']);
const BACKWARD: ReadonlySet<string> = new Set(['ArrowLeft', 'ArrowUp']);

/**
 * Where this key leaves focus, or `null` if the key is not the group's.
 *
 * Both axes are answered, and deliberately: the two groups wrap onto several rows on a narrow
 * screen and scroll along one line on a phone, so which of "right" and "down" means *next* is a
 * question about the frame rather than about the control. Answering both means the group behaves
 * the same however it happens to have been laid out.
 *
 * `null` for everything else, and that is the important half. `Tab` belongs to the browser,
 * `Enter` and `Space` to the option itself, and `Space` most of all — it is the compare gesture
 * (#22), and this module claiming it would take the key back from the very control `holdsCompare`
 * refuses it for.
 */
export function rovingTarget(key: string, options: RovingOptions): number | null {
  const landable = usable(options);
  if (landable.length === 0) return null;

  if (key === 'Home') return landable[0] as number;
  if (key === 'End') return landable[landable.length - 1] as number;

  const step = FORWARD.has(key) ? 1 : BACKWARD.has(key) ? -1 : 0;
  if (step === 0) return null;

  // Where the current option sits among the landable ones. A focus that is somewhere unlandable —
  // which nothing should produce, but a stale index would — is treated as sitting just before the
  // first, so the next press still moves somewhere sensible instead of returning null forever.
  const at = landable.indexOf(options.from);
  if (at === -1) return (step === 1 ? landable[0] : landable[landable.length - 1]) as number;

  // Wraps, because a group that stops at its last option leaves a reader pressing a live key that
  // does nothing and no way to tell that from a broken one.
  const next = (at + step + landable.length) % landable.length;
  return landable[next] as number;
}

/** The options focus may actually land on, in order. */
function usable(options: RovingOptions): number[] {
  const skip = new Set(options.skip ?? []);
  const landable: number[] = [];
  for (let i = 0; i < options.count; i += 1) if (!skip.has(i)) landable.push(i);
  return landable;
}

/**
 * Which option is the group's single tab stop.
 *
 * A radio group is one stop on the tab ring, not one per option: tabbing through five bases and
 * then eight variants to reach the map is a keyboard journey nobody finishes. The stop is the
 * checked option, so returning to the group puts focus on what is currently true — and where
 * nothing is checked, the first option a reader could land on, so the group is never a stop that
 * cannot be entered.
 */
export function tabStop(options: RovingOptions & { readonly checked: number | null }): number | null {
  const landable = usable(options);
  if (landable.length === 0) return null;
  if (options.checked !== null && landable.includes(options.checked)) return options.checked;
  return landable[0] as number;
}
