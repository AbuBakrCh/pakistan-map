/**
 * Digits grouped, for the build's own messages.
 *
 * One spelling for `scripts/`, because there were two: the rule engines both quote populations in
 * their refusals, and a number that reads 6,163,599 in one failure and 6163599 in the next is the
 * same failure wearing two faces. `src/lib/figures.ts` keeps its own copy on purpose — that one is
 * shipped to the browser and the runtime bundle does not reach into `scripts/` — and its docstring
 * carries the reasoning about locales and rounding that applies to both.
 */
export function groupDigits(value: number): string {
  const digits = String(Math.trunc(Math.abs(value)));
  const grouped = digits.replace(/\B(?=(\d{3})+$)/g, ',');
  return value < 0 ? `-${grouped}` : grouped;
}
