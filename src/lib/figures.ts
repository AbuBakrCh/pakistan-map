/**
 * How a census figure is set, in one place, because there is only one right answer and this app
 * prints the same figures on three surfaces.
 *
 * The card, the tooltip and the colophon all set populations, and until this module existed two of
 * them grouped digits by hand and the third asked `toLocaleString`. That is one number wearing two
 * faces on one screen — and the hand-written one was added with a comment explaining why the other
 * was wrong, which is the state a shared helper exists to prevent.
 */

/**
 * Digits grouped in threes — 87,311,346.
 *
 * Written out rather than left to `toLocaleString`, which answers to whatever locale the browser
 * happens to be in: a census figure that renders as 8,73,11,346 in one place and 87.311.346 in
 * another is one number wearing three faces, and the tests would be asserting the test runner's
 * locale rather than the app's words. Never abbreviated to "87.3 m" — the census counted people one
 * at a time and publishes the count, and rounding it is this app interpolating.
 */
export function groupDigits(value: number): string {
  const digits = String(Math.trunc(Math.abs(value)));
  const grouped = digits.replace(/\B(?=(\d{3})+$)/g, ',');
  return value < 0 ? `-${grouped}` : grouped;
}
