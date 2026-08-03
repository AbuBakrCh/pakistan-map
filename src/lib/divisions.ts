/**
 * The division tier, and the one control that decides whether it is drawn.
 *
 * The base map has always drawn two tiers — province and division — because the divisions are what
 * give a reader the country's administrative structure. But they are also 39 boundaries and 37
 * names over one frame, and once a variant is on screen the reader is looking at a *third* set of
 * lines drawn over both. So the tier is offered rather than assumed: turned off, the map is the
 * first-level units, the seven seats and the ceasefire line, which is the least paper a proposal
 * can honestly be argued against.
 *
 * **Off by default**, because the default view is the one a link arrives at and the one a
 * screenshot travels as, and the tier a reader has not asked for is the tier they have not asked
 * for. It comes back with one press, and the press is a `<button>` rather than a hover, so it is
 * reachable at 390px.
 *
 * **Not in the URL, and not in the browser's history.** How much administrative detail a reader
 * has switched on is a property of the device in their hand, exactly as the bottom sheet's detent
 * is (#33) — a shared link argues about a proposal, and restoring the sender's detail setting would
 * change a stranger's map without saying anything about the boundaries under discussion.
 *
 * The words live here rather than in `panel.ts` for the reason every other control's do: that file
 * composes no sentence of its own.
 */

/** Whether the division tier is drawn when the page opens. See above — it is not. */
export const DIVISIONS_SHOWN_BY_DEFAULT = false;

export const DIVISIONS_LABEL = 'Show all divisions';

/**
 * What the control does, said in full. On the button itself rather than in a `title` alone, because
 * the hard bar is a 390px phone and a `title` is reachable there by nothing — so this is set as the
 * accessible description and the visible word beside it is the short form.
 */
export const DIVISIONS_TITLE =
  'Draw the 39 divisions — their boundaries and their names — beneath the first-level units. ' +
  'Off, the map shows provinces or proposed units, the seven first-level seats and the Line of ' +
  'Control only.';

/** What a screen reader is told the control is currently doing, since the map itself is `role="img"`. */
export const divisionsState = (shown: boolean): string =>
  shown
    ? 'Divisions drawn beneath the first-level units.'
    : 'Divisions not drawn; the map shows first-level units only.';
