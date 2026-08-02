/**
 * Walking the districts with the keyboard (#35).
 *
 * The map's per-district readout — the population, the dominant mother tongue, what the variant
 * makes of it — reaches a screen reader through a live region, and until this ticket the only thing
 * that ever wrote to that region was a pointer: `pointermove` on a desktop, a tap on a phone. A
 * reader with no pointer could focus the map and never make it say a word, which in a ticket called
 * *usable without a mouse* is the gap that matters most. So the map is walkable.
 *
 * **The walk is a reading order, not a compass.** Arrow keys here do not mean north and south, and
 * they are not pretended to: a spatial walk over 156 irregular polygons has no honest answer for
 * "which district is left of Gwadar" at a coastline, and a reader who cannot see the map cannot
 * check the answer it invented. What they can rely on is an order that is stable, complete and the
 * same every time — every district reachable, none twice, and the same key always going the same
 * way. The order is the administrative hierarchy the map itself is built on (D23): province, then
 * division, then district, which is also the order the tooltip reads a district's own address in.
 *
 * Nothing here touches the DOM and nothing here draws.
 */

/** What we need of a district to place it in the walk. */
export interface WalkStop {
  readonly name: string;
  readonly division: string;
  readonly province: string;
}

/**
 * The districts in the order the keyboard walks them.
 *
 * Sorted rather than taken in bundle order, because bundle order is arc order — a fact about how
 * the topology was built, which would put a reader in Sindh, then Punjab, then Sindh again and give
 * them no way to know where they are in the country. Compared with `localeCompare` so that the
 * order is the one a reader would write the list in.
 */
export function walkOrder(districts: readonly WalkStop[]): readonly WalkStop[] {
  return [...districts].sort(
    (a, b) =>
      a.province.localeCompare(b.province, 'en') ||
      a.division.localeCompare(b.division, 'en') ||
      a.name.localeCompare(b.name, 'en'),
  );
}

/** Which keys the walk claims, and what each one means. */
const NEXT: ReadonlySet<string> = new Set(['ArrowRight', 'ArrowDown']);
const PREVIOUS: ReadonlySet<string> = new Set(['ArrowLeft', 'ArrowUp']);

/**
 * Where a key takes the walk, or `null` if the key is not the walk's.
 *
 * `from` is the district the reader is on, or `null` if they have only just focused the map — in
 * which case any step starts the walk rather than doing nothing, since a first press that appears
 * to be swallowed is indistinguishable from a map that cannot be walked at all.
 *
 * It **wraps**, for the reason the radio groups wrap, and `Home` and `End` reach the ends directly
 * because 156 presses is not a way to reach the last district.
 *
 * `Escape` leaves the walk — the one key that answers `null` for the *stop* and still means
 * something, which is why it is asked separately by `leavesWalk`. `Space` is refused here as it is
 * everywhere: it belongs to the compare gesture (#22), and a reader walking the districts with one
 * hand must still be able to hold the country up against the proposal with the other.
 */
export function walkTarget(
  key: string,
  from: number | null,
  count: number,
): number | null {
  if (count === 0) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;

  const step = NEXT.has(key) ? 1 : PREVIOUS.has(key) ? -1 : 0;
  if (step === 0) return null;
  // A walk that has not started begins at either end, so the first press always moves.
  if (from === null) return step === 1 ? 0 : count - 1;
  return (from + step + count) % count;
}

/** Does this key end the walk and put the readout away? */
export function leavesWalk(key: string): boolean {
  return key === 'Escape';
}
