/**
 * The scrolling chip strips, and what they have to say about themselves on a phone.
 *
 * Below `--sheet` the two radio groups stop wrapping and scroll along one line (the stylesheet
 * argues why: wrapped, the bases and the variants cost 330px of an 844px screen at the touch-target
 * height, which is the map's own height spent on a menu). What that buys in room it takes back in
 * information — a variant chip carries a name over a tagline and is close to the width of the
 * screen on its own, so a reader meets **one** proposal and nothing tells them there are six more
 * to the right of it. The alternatives *are* the product (#18); a reader who cannot see that there
 * are alternatives has been shown a different app.
 *
 * Two things are said, and they are deliberately different in kind. The **position** is a fact and
 * is printed in words beside the group's own name — *how many* there are, and which one of them is
 * on screen. The **fade** is an affordance and appears only on the side there is actually something
 * to scroll towards, so it is never the page claiming more than it has.
 *
 * Both are computed here rather than in `panel.ts`, which composes no sentence of its own, and both
 * are pure functions of numbers the caller measures — so the suite can hold them without a DOM.
 */

/**
 * Where the reader is in a strip: `1/7`, or **nothing at all** where there is nothing to be lost.
 *
 * Null under two conditions and each is a refusal to state the obvious. A group of one has no
 * position to be in — `1/1` beside a lone chip is a count of a thing the reader can already see
 * whole — and a group with nothing checked has no *there* to be: the baseline selects no variant,
 * and `0/7` would report a position rather than an absence.
 *
 * The bare fraction rather than "1 of 7". It sits inside a letterspaced small-caps label already
 * carrying the group's name, and on the phone that label sits *beside* the strip and takes its
 * width from it — every character here is a character of chip the reader cannot see.
 */
export function stripPosition(index: number, total: number): string | null {
  if (total < 2) return null;
  if (index < 0 || index >= total) return null;
  return `${index + 1}/${total}`;
}

/** Which edges of a strip have content beyond them. */
export type OverflowSides = 'none' | 'start' | 'end' | 'both';

export interface StripMetrics {
  /** How far the strip has been scrolled from its start edge, in px. */
  readonly scrollLeft: number;
  /** The full width of the chips, in px. */
  readonly scrollWidth: number;
  /** How much of them is on screen, in px. */
  readonly clientWidth: number;
}

/**
 * A pixel of slack at both ends.
 *
 * Layout arithmetic is fractional — a strip scrolled fully to its end reports a `scrollLeft` a
 * fraction of a pixel short of the difference it is compared against — so an exact test leaves the
 * fade standing at the very end of the strip, which is the one place it is a lie.
 */
const SETTLED_PX = 1;

export function overflowSides(metrics: StripMetrics): OverflowSides {
  const { scrollLeft, scrollWidth, clientWidth } = metrics;
  const before = scrollLeft > SETTLED_PX;
  const after = scrollLeft + clientWidth < scrollWidth - SETTLED_PX;
  if (before && after) return 'both';
  if (before) return 'start';
  if (after) return 'end';
  return 'none';
}
