/**
 * How tall the map is on a phone (#33) — measured against the room actually left, never guessed.
 *
 * On a wide screen the frame is a flex item and the browser settles its height for us. On a phone
 * it cannot be: the frame is sized to its contents (`flex: 0 0 auto`, argued in the stylesheet)
 * because the colophon and the audit panel underneath it would otherwise squeeze the country to a
 * thumbnail, and the two action chips, the division toggle and the sheet's grip are all `fixed` to
 * the bottom of the viewport. A fixed height in the stylesheet therefore had no way of knowing
 * whether the country it was drawing ended above that furniture or behind it — and on the shorter
 * phones it ended behind it, so a reader met a map with its southern third under three buttons.
 *
 * So the height is arithmetic rather than a constant: the room between the top of the frame and the
 * top of the furniture, less what the legend under the map is about to take. Every term is read off
 * the page, so nothing here restates a number the stylesheet already owns — the sheet's peek, the
 * chips' heights and the gaps between them are all measured where they are drawn.
 *
 * Two of those terms are given *back* to the stylesheet, and that is the second half of the fix.
 * The division toggle sits a chip's height above the two actions, and the page reserves room under
 * itself for both; each was written as a hard `44px`, which is the touch-target floor and not the
 * height either row actually comes to once its label has wrapped. Measured and published as
 * `--action-h` and `--toggle-h`, the stack cannot drift out of line with the chips it is stacking.
 *
 * The floor is the one thing this module will not trade away. Where the room genuinely runs out —
 * a short screen, a wrapped control strip — the page scrolls, which is what a page does; the
 * country is not shrunk past the point where the 390px bar is met.
 */

import { isSheetLayout } from './sheet.ts';

/**
 * The shortest the map is ever drawn on a phone.
 *
 * Below this the hard bar of #33 — map legible and variant switching functional at 390px — stops
 * being met, so the page gives up the *no-scroll* property rather than the map: the frame runs past
 * the bottom of the screen and a reader scrolls a few dozen pixels, exactly as they already do to
 * reach the colophon.
 */
const MAP_FLOOR_PX = 260;

/** The gap the stylesheet sets between the furniture's rows, in `rem`, read back here in px. */
const ROW_GAP_REM = 0.35;

function pxOfRem(rem: number): number {
  const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return (Number.isFinite(root) ? root : 16) * rem;
}

function pxOfVar(name: string): number {
  const value = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
  );
  return Number.isFinite(value) ? value : 0;
}

/**
 * Re-fit the map to the phone's viewport. A no-op above the breakpoint, where the properties are
 * removed rather than left standing: a height set here would survive the breakpoint and pin a
 * desktop frame to the size of a phone.
 */
export function fitPhoneFrame(): void {
  const root = document.documentElement;
  const well = document.getElementById('map');
  if (well === null) return;
  const frame = well.closest('.frame');
  if (frame === null) return;

  if (!isSheetLayout()) {
    root.style.removeProperty('--map-h');
    root.style.removeProperty('--action-h');
    root.style.removeProperty('--toggle-h');
    return;
  }

  const legend = document.getElementById('legend');
  const actions = document.querySelector('.control-actions');
  const toggle = document.getElementById('map-controls');

  // The chips' own heights, given back to the stylesheet so the stack and the page's bottom
  // padding are measured against what is drawn rather than against the touch-target floor.
  const gap = pxOfRem(ROW_GAP_REM);
  const actionH = actions instanceof HTMLElement ? actions.offsetHeight : 0;
  const toggleH = toggle instanceof HTMLElement ? toggle.offsetHeight : 0;
  if (actionH > 0) root.style.setProperty('--action-h', `${Math.round(actionH)}px`);
  if (toggleH > 0) root.style.setProperty('--toggle-h', `${Math.round(toggleH)}px`);

  /*
   * What the furniture takes off the bottom of the screen. The sheet is counted at its *peek*
   * height and never at `--sheet-h`, for the reason the page's own padding is: a height tied to
   * the live sheet would re-fit the map on every frame of a drag, and the country does not move
   * under a gesture.
   */
  const reserved = pxOfVar('--sheet-peek') + actionH + toggleH + gap * 3;

  const legendH = legend instanceof HTMLElement ? legend.offsetHeight : 0;
  const wellH = well.getBoundingClientRect().height;
  // The frame's own border and padding, taken as what is left of it once the map and the legend
  // are accounted for — so a change of border weight in the stylesheet needs no change here.
  const chrome = Math.max(0, frame.getBoundingClientRect().height - wellH - legendH);
  // Where the frame starts, measured from the top of the document: this is the fit at rest, and at
  // rest the page is scrolled to the top. Nothing above the frame depends on the map's height, so
  // this term does not move when the property below is set.
  const frameTop = frame.getBoundingClientRect().top + window.scrollY;

  const room = window.innerHeight - frameTop - legendH - chrome - reserved;
  root.style.setProperty('--map-h', `${Math.round(Math.max(MAP_FLOOR_PX, room))}px`);
}
