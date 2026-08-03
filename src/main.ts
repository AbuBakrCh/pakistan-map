/**
 * Entry point: the selection, and everything that answers to it.
 *
 * Runtime state is two values (D20) — the active basis and variant, or the baseline; and whether
 * compare is held. The first is written into the URL and read back out of it (#23), so the value
 * the page holds and the value the address bar shows are the same value and cannot come apart. The
 * second deliberately is not: a comparison is a key held down, not a view worth addressing, and
 * putting it in the URL would make a shared link restore a gesture nobody is performing.
 *
 * Nothing here is a framework's job: a selection changes, four surfaces redraw, and each of them is
 * told the whole answer rather than a patch. The decisions those surfaces render are all upstream
 * in `lib/`, under test; what is here is the wiring, and the three history calls, which have no
 * seam to be tested at.
 *
 * Provenance travels with every one of them. A basis shades districts, a variant draws provinces
 * that do not exist, and both are on screen at once — so the legend says what the colours mean,
 * the colophon says which table and whose proposal, and neither is allowed to fall out of step
 * with the map by being written once at load.
 */

import './styles.css';
import {
  censusStatistics,
  contextProvenance,
  contextTopology,
  geographyTopology,
  provenance,
  developmentIndexBundle,
  scenarioBundle,
  unitOutlineBundle,
  type BasisId,
  type VariantRecord,
} from './bundle.ts';
import {
  answersSpaceItself,
  comparedDescription,
  compareGesture,
  holdsCompare,
  releasesCompare,
} from './lib/compare.ts';
import { boundaryNote } from './lib/context.ts';
import { hashFor, readRoute } from './lib/deep-link.ts';
import { shortFormExpansions } from './lib/labels.ts';
import { arcsOf, readLineOfControl } from './lib/line-of-control.ts';
import type { DistrictFill, LegendEntry } from './lib/fill.ts';
import { bandPaint, developmentFills, developmentLegend } from './lib/development.ts';
import { motherTongueFills, motherTongueLegend } from './lib/mother-tongue.ts';
import {
  BASELINE,
  basisChoices,
  mapDescription,
  variantOf,
  type Selection,
} from './lib/selection.ts';
import { figuresWithheld, type DistrictShading, type UnitMembership } from './lib/tooltip.ts';
import {
  readUnitOutlines,
  unitBoundaries,
  unitByDistrict,
  unitLegend,
  unitRoster,
  type UnitRosterEntry,
} from './lib/units.ts';
import { aboutTheData } from './lib/about.ts';
import { variantCard } from './lib/card.ts';
import { exportPng } from './export-image.ts';
import { EXPORT_FAILED } from './lib/export-band.ts';
import { renderMap, type MapView } from './map.ts';
import { renderAbout, renderControls, renderMapControls, renderVariantCard } from './panel.ts';
import { DIVISIONS_SHOWN_BY_DEFAULT } from './lib/divisions.ts';
import { attachSheet } from './sheet.ts';

const mount = document.getElementById('map');
if (mount === null) throw new Error('#map is missing from index.html');
const controlMount = document.getElementById('controls');
if (controlMount === null) throw new Error('#controls is missing from index.html');
const mapControlMount = document.getElementById('map-controls');
if (mapControlMount === null) throw new Error('#map-controls is missing from index.html');
const cardMount = document.getElementById('card');
if (cardMount === null) throw new Error('#card is missing from index.html');
const aboutMount = document.getElementById('about');
if (aboutMount === null) throw new Error('#about is missing from index.html');

/**
 * What each basis shades districts with — and, by being the same object, which bases may be
 * selected at all.
 *
 * Two entries. The administrative and historical bases have their variants in the bundle and no
 * fill in the renderer, and the selector says exactly that rather than offering a basis that would
 * shade nothing. Stated once so the menu and the map cannot disagree: a basis offered here and
 * unshaded there is a basis that switches the boundaries back and explains nothing.
 */
const FILLS: Partial<Record<BasisId, ReadonlyMap<string, DistrictFill>>> = {
  language: motherTongueFills(censusStatistics),
  development: developmentFills(developmentIndexBundle, censusStatistics),
};
const SHADEABLE = new Set(Object.keys(FILLS) as BasisId[]);

/**
 * What the Development basis's fill *is*, per district, for the tooltip (#31).
 *
 * The one basis whose shading is a figure nobody published, so the one basis whose shading has to
 * explain itself where it is read. Assembled once from the committed artifact — the formula, the
 * badge and the component labels are all the artifact's words, and nothing here composes a
 * sentence out of them; `tooltip.ts` does that.
 */
const developmentShading = (district: string): DistrictShading | null => {
  const record = developmentIndexBundle.districts[district];
  if (record === undefined) return null;
  return {
    basis: 'development',
    score: record.score,
    // Through the same lookup the fill and the legend use, which refuses a band the artifact does
    // not name rather than falling back to its id: `80-plus` set in a sentence is the legend's
    // words replaced by a slug, and a reader has no way to tell that from a band actually called
    // that. The map, the key and the tooltip now fail together or agree.
    bandLabel: bandPaint(developmentIndexBundle, record.band, district).label,
    formula: developmentIndexBundle.provenance.formula,
    badge: developmentIndexBundle.provenance.badge,
    components: developmentIndexBundle.provenance.components as DistrictShading['components'],
  };
};

/** Which bases explain their own fill on hover. Only the one whose fill nobody published does. */
const SHADING: Partial<Record<BasisId, (district: string) => DistrictShading | null>> = {
  development: developmentShading,
};

/**
 * The ceasefire line's arcs, held out of every unit outline.
 *
 * Azad Jammu & Kashmir is a unit in every variant, and its outline runs along the Line of
 * Control. Stroking it solid over the dash would fill the dash's gaps in and leave a line that
 * looks like an international border, which is the one thing this map must not draw (D12).
 */
const locArcs = arcsOf(geographyTopology.objects['lineOfControl'] as never);

const choices = basisChoices(scenarioBundle, SHADEABLE);

/** Everything a selection puts on the map, assembled in one place so no half-view can exist. */
function viewFor(selection: Selection): MapView {
  const variant = variantOf(scenarioBundle, selection);
  const description = mapDescription(scenarioBundle, selection);
  if (selection === null || variant === null) {
    return {
      fill: null,
      units: null,
      boundaries: null,
      membershipOf: null,
      shadingOf: null,
      description,
    };
  }

  const owner = unitByDistrict(variant);
  return {
    fill: FILLS[selection.basis] ?? null,
    shadingOf: SHADING[selection.basis] ?? null,
    units: readUnitOutlines(geographyTopology, unitOutlineBundle, variant.id),
    boundaries: unitBoundaries(geographyTopology, unitOutlineBundle, variant.id, locArcs),
    membershipOf: (district): UnitMembership => {
      const unit = owner.get(district);
      return {
        variant: variant.name,
        universe: variant.partition.universe,
        unit: unit === undefined ? null : { name: unit.name, kind: unit.kind },
        // A variant that attaches no 2023 figures says so on every district it covers (H2, #30).
        // Asked of the one predicate the card asks (#48), so the tooltip and the card give one
        // reason and not two — this file decides it no more than it composes a sentence.
        withholds: figuresWithheld(variant),
      };
    },
    description,
  };
}

/**
 * The opening view is the URL's, and the map is built into it rather than switched into it (#23).
 *
 * Read before the first render, not after: entering a variant by cross-fading out of a baseline
 * the reader never asked for would animate a change that did not happen, and would make a shared
 * link visibly a redirect. A link is an address, so the page opens *at* it.
 */
const opening = readRoute(window.location.hash, scenarioBundle, choices);
let selection: Selection = opening.selection;

/**
 * The second runtime value: whether the current map is standing in for the selection (#22).
 *
 * Held, never merged into the selection. A comparison is not a thing you have chosen to look at —
 * it is the selection, momentarily out of the way — so the moment it ends the map has to come
 * back to exactly what it was, zoom and pan included, and that is only free if the selection was
 * never touched. Keeping the two apart is also what keeps the gesture out of the URL: the address
 * bar follows the selection, and the selection does not move while compare is held.
 */
const compare = compareGesture();

const map = renderMap(
  mount,
  geographyTopology,
  contextTopology,
  censusStatistics,
  viewFor(selection),
);
const panel = renderControls(
  controlMount,
  scenarioBundle,
  choices,
  go,
  () => {
    compare.press();
    render();
  },
  download,
);
/**
 * The third runtime value, and the one that is not a view (D20, #33's near-miss counted again).
 *
 * How much of the administrative map a reader has switched on is a property of the device in their
 * hand rather than of the boundaries being argued, so it is kept out of the URL and out of the
 * history exactly as the sheet's detent is — see `lib/divisions.ts`. It is held here rather than in
 * the map because two surfaces answer to it: the map draws the tier, and the legend keys it, and a
 * swatch keying a line nobody is drawing is the failure the About panel exists to prevent.
 */
let divisionsShown = DIVISIONS_SHOWN_BY_DEFAULT;

const mapControls = renderMapControls(mapControlMount, (shown) => {
  divisionsShown = shown;
  map.setDivisions(shown);
  mapControls.show(shown);
  // The legend and nothing else: the card, the colophon and the selection say nothing about the
  // division tier, and redrawing them would be the page moving under a control that moved the map.
  renderLegend(selection, variantOf(scenarioBundle, selection));
});

const card = renderVariantCard(cardMount);
/*
 * On a phone the card is a bottom sheet rather than a column (#33). Attached to the same element
 * the card is rendered into and asked nothing about the card's contents: whether the page is
 * narrow enough for a sheet is a question for the stylesheet, and everything the sheet decides is
 * in `lib/sheet.ts`. On a wide screen it does nothing at all.
 */
const sheet = attachSheet(cardMount);

/*
 * The audit surface (#21), rendered once and never again.
 *
 * Nothing on it answers to the selection: the sources, their vintages and the build dates are the
 * same under every basis and every proposal, and a panel that redrew on each change would be the
 * page moving underneath a reader who is reading it. It takes the committed bundles whole, because
 * the point of it is to be the same files the map is drawn from rather than a description of them.
 */
renderAbout(
  aboutMount,
  aboutTheData({
    geography: provenance,
    context: contextProvenance,
    census: censusStatistics,
    scenarios: scenarioBundle,
    outlines: unitOutlineBundle,
    index: developmentIndexBundle,
  }),
);

/**
 * Whether the map is currently standing in for the selection (#22).
 *
 * One expression, read by the two places that need it — the render and the export — because the two
 * must not disagree about what is on screen. At the baseline there is nothing to hold out of the
 * way, so compare is not on however hard the key is held.
 */
const comparing = (variant: VariantRecord | null): variant is VariantRecord =>
  compare.on && variant !== null;

/**
 * The sanctioned copy (#32, D22).
 *
 * **The band describes the picture, never the selection**, and the difference is the whole of what
 * this function has to get right. While compare is held the map has been given `comparedView` — the
 * baseline, whole, with strata 1 and 3 dropped — and a band built from the selection would caption
 * that picture with the proposal's name, badge it, and stamp it *Proposed — not official*. It would
 * be the one image this app produces that lies about its own contents, and it would lie in the
 * direction the whole ticket exists to prevent: a picture of the real provinces, forwarded, labelled
 * as somebody's proposal. So the export asks what the *map* is showing, and gets the baseline's own
 * band while the comparison is held.
 *
 * `shadedBy` is the renderer's answer for the same reason: three of the four bases can be selected
 * and shade nothing, and a key for a fill the map never drew explains a picture that does not exist.
 *
 * The map itself is photographed as it stands, zoom and pan included — the crop is `map.photograph`'s.
 *
 * Failure is spoken rather than swallowed. There is no network here and very little to go wrong,
 * but a browser that refuses a canvas or a blob would otherwise leave a button that does nothing,
 * and a reader would reasonably conclude the page is broken rather than the feature.
 */
function download(): void {
  const selected = variantOf(scenarioBundle, selection);
  const held = comparing(selected);
  const variant = held ? null : selected;
  exportPng({
    map,
    scenarios: scenarioBundle,
    statistics: censusStatistics,
    geography: provenance,
    variant,
    development: developmentIndexBundle,
    shadedBy:
      variant === null || selection === null || !SHADEABLE.has(selection.basis)
        ? null
        : selection.basis,
  })
    .catch((error: unknown) => {
      console.error(error);
      window.alert(EXPORT_FAILED);
    })
    .finally(() => panel.exportSettled());
}

/**
 * A view the reader chose, which is the only kind that takes a history entry.
 *
 * `pushState`, so back and forward walk the views rather than leaving the site: switching variants
 * is the act this app is for, and a reader comparing three proposals expects the browser's own
 * undo to walk them back through the three. The push is skipped where the hash would not change,
 * or holding a chip down would stack entries that all draw the same map and make back look broken.
 *
 * Corrections are `replaceState` instead, and the distinction is the whole rule: a hash the reader
 * *chose* is history, a hash this app *derived* is not. Following `#/language` and landing on
 * `#/language/l1` (D13) leaves one entry, not two, because there is no earlier view to go back to
 * — the intermediate state it would restore is the one state this app has decided cannot exist.
 */
function go(next: Selection, waypoint = false): void {
  selection = next;
  // A reader who asks to see a proposal has asked to stop comparing. Without this, choosing a
  // variant while the button holds compare would draw the country and leave the new card arguing
  // for boundaries that are not on screen.
  compare.interrupt();
  const hash = hashFor(next);
  if (hash !== window.location.hash) {
    /*
     * A click is a chosen view and takes an entry; an **arrow key inside a radio group is a
     * way-station** and replaces one (#35).
     *
     * The rule is the one this function already follows — a hash the reader chose is history, a
     * hash they merely passed through is not — and the reason is the one the push guard below was
     * written for: an arrow key auto-repeats, and a reader scanning eight variants with a held key
     * would have to press Back eight times to get out of a group they never meant to enter. The
     * variant they stop on is still an entry, because stopping is the choosing.
     */
    window.history[waypoint ? 'replaceState' : 'pushState'](null, '', hash);
  }
  render();
}

/**
 * Back, forward, and a hash edited in the address bar — one listener, because they are one event.
 *
 * `hashchange` rather than `popstate`: `pushState` does not fire it, so the app's own writes
 * cannot loop back through here, while every traversal between two of them does. What arrives is
 * an untrusted string either way — a reader may have typed it — so it is read through the same
 * parser as the opening one and canonicalised on the spot, without a further entry.
 *
 * Compare is released on the way through, for the reason `go` releases it: arriving at a different
 * proposal with the country still drawn would leave the card arguing for outlines that are not on
 * screen. Traversal is a change of view like any other, and the gesture belongs to the view it was
 * started in.
 */
window.addEventListener('hashchange', () => {
  const route = readRoute(window.location.hash, scenarioBundle, choices);
  selection = route.selection;
  compare.interrupt();
  if (!route.asWritten) window.history.replaceState(null, '', hashFor(route.selection));
  render();
});

function render(): void {
  const variant = variantOf(scenarioBundle, selection);
  // The current map compared against itself is not a comparison (D17), so at the baseline the
  // gesture has nothing to hold out of the way and the map is drawn as it always is.
  const held = comparing(variant);
  panel.show(selection, held);
  /*
   * Written **before** the map is shown, because the map lays its names out against whatever is
   * standing on the paper (#33's `occupied` list) and measures this box to do it. Written after,
   * the first layout of a variant would run against the previous variant's key — eight names of
   * ground either freed or covered a frame late.
   */
  renderUnitKey(selection, variant);
  map.show(held ? comparedView(variant) : viewFor(selection));
  // The card is the argument the outlines are drawing, so it arrives and leaves with them: at the
  // baseline there is no proposal on screen and there is no card either (#19).
  card.show(variant === null ? null : variantCard(scenarioBundle, variant));
  // The sheet takes up room only while there is a card to hold, and forgets the reader's detent
  // when the card goes (#33).
  if (variant === null) sheet.releaseCard();
  else sheet.holdCard();
  // The card, the legend and the colophon are given the *selection*, and are not told about the
  // comparison. Compare is a gesture over the map — the reader is looking at the map and has one
  // key down — and rewriting three blocks of prose underneath it would be the page changing
  // rather than the map. The proposal is still selected while it is held off the screen, so the
  // surfaces that say what is selected go on saying it.
  renderLegend(selection, variant);
  renderColophon(selection, variant);
}

/**
 * The map as compare shows it: the baseline view, whole.
 *
 * Assembled from `viewFor(BASELINE)` rather than by taking fields off the selected view, so
 * compare cannot fall out of step with what the baseline actually is — the strata it drops are
 * dropped because the baseline has none of them, and a fourth stratum added later would be
 * dropped by construction. Only the spoken sentence differs, because for a reader who cannot see
 * the map this is not the baseline: it is a proposal held off the screen and about to return.
 *
 * The zoom and the pan are not mentioned anywhere in here, which is how they survive: `show`
 * re-projects nothing and never touches the transform, so the country does not move under the
 * gesture and releasing it puts the outlines back over exactly the ground they left.
 */
function comparedView(variant: VariantRecord): MapView {
  const baseline = viewFor(BASELINE);
  return { ...baseline, description: comparedDescription(baseline.description, variant.name) };
}

/*
 * The key half of the gesture. Bound to the window rather than to the map, because holding Space
 * should compare wherever the reader is standing on the page — asking them to click the map first
 * makes a shortcut that only works once you have found the thing it is a shortcut for.
 *
 * Two things are settled here and nowhere else, and both are `lib/compare.ts`'s answers:
 * `holdsCompare` decides whether the press is ours, which is what keeps Space out of the way of
 * the focused chips and of the Compare button itself; and `preventDefault` stops the page
 * scrolling, on the repeats as well as on the press, since a key held down goes on firing.
 */
window.addEventListener('keydown', (event) => {
  // Nothing to compare at the baseline, so the key is left alone entirely: Space scrolls a page
  // with no proposal on it, which is what Space is for.
  if (selection === null) return;
  // Read off `Element` rather than off `HTMLElement`: the map itself is SVG and carries focus, so
  // narrowing to HTML would ask the question of everything except the one place a reader is most
  // likely to be standing when they compare.
  const focused = event.target;
  const element =
    focused instanceof Element
      ? {
          tagName: focused.tagName,
          isContentEditable: focused instanceof HTMLElement && focused.isContentEditable,
        }
      : null;
  if (
    !holdsCompare({
      key: event.key,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      onControl: answersSpaceItself(element),
    })
  ) {
    return;
  }
  event.preventDefault();
  if (compare.hold()) render();
});

window.addEventListener('keyup', (event) => {
  if (releasesCompare(event.key) && compare.release()) render();
});

/*
 * Alt-tabbing away with the key down delivers the `keyup` to whatever the reader switched to, and
 * this map would hold the comparison for the rest of the session. The window losing focus is the
 * only notice we get, so it is taken as the release it is.
 */
window.addEventListener('blur', () => {
  if (compare.interrupt()) render();
});

const swatch = (entry: LegendEntry): string =>
  entry.swatch.kind === 'colour'
    ? `<span class="swatch" style="background:${entry.swatch.colour}"></span>`
    : `<span class="swatch swatch-${entry.swatch.kind}"></span>`;
const item = (entry: LegendEntry): string =>
  `<span class="legend-item">${swatch(entry)}${entry.label}</span>`;

/**
 * The dashed line is drawn under every basis, so its legend entry survives every basis too.
 * Stratum 1 replaces what the fills mean, not what the lines mean: a ceasefire line with no key
 * is a line a reader is entitled to read as a border.
 */
const lineOfControlEntry = `
  <span class="legend-item"><span class="swatch swatch-dashed"></span>Line of Control —
    ceasefire line, not an international border</span>`;

/**
 * The map's own key to the units it is drawing, in the frame's top-left corner.
 *
 * Built as elements rather than as markup, for the reason the tooltip is: a unit's name is text
 * and can never be read as HTML. The words and the order are `unitRoster`'s — this composes no
 * sentence of its own, exactly as `panel.ts` composes none of the card's.
 *
 * Emptied at the baseline rather than hidden by a flag, so the stylesheet's `:empty` rule takes it
 * off the paper altogether: there is no proposal on screen and a box saying so would be a caption
 * with nothing to caption. It is *not* given the comparison, on the same grounds as the legend and
 * the card — compare is a gesture over the map, and the proposal is still selected while it is
 * held off the screen.
 */
function renderUnitKey(active: Selection, variant: VariantRecord | null): void {
  // Looked up per render rather than held, exactly as the legend and the colophon are: these three
  // are the surfaces this file writes markup into, and they are found the same way.
  const mount = document.getElementById('unit-key');
  if (mount === null) return;
  mount.replaceChildren();
  if (variant === null) return;

  // The same fill map the map itself is drawing with — read from `FILLS` rather than recomputed, so
  // a swatch in the key and the ground under the outline cannot be two different answers.
  const roster = unitRoster(variant, active === null ? null : (FILLS[active.basis] ?? null));
  const heading = document.createElement('p');
  heading.className = 'unit-key-heading';
  heading.textContent = roster.heading;
  mount.append(heading);

  const list = document.createElement('ul');
  list.className = 'unit-key-list';
  for (const entry of roster.entries) {
    const row = document.createElement('li');
    // The unit's name is set in its own outline's colour, which is what the map does with unit
    // names: the accent says *proposed* and says it in the one place a reader is already reading.
    row.className = `unit-key-item unit-key-${entry.swatch}`;
    row.append(unitKeySwatch(entry));
    const name = document.createElement('span');
    name.textContent = entry.name;
    row.append(name);
    list.append(row);
  }
  mount.append(list);
}

/**
 * A unit's ground, as the map paints it: its own districts' fills, in proportion, widest first.
 *
 * A unit is never filled (D14), so this is not the unit's colour — it is what stratum 1 has put
 * under it, and a unit covering four mother tongues gets four segments. Where the basis shades
 * nothing the roster returns no segments at all and the row falls back to the outline's own stroke,
 * which is the only thing there is to key on an unshaded map.
 */
function unitKeySwatch(entry: UnitRosterEntry): HTMLElement {
  if (entry.fills.length === 0) {
    const stroke = document.createElement('span');
    stroke.className = `swatch swatch-${entry.swatch}`;
    return stroke;
  }

  const bar = document.createElement('span');
  bar.className = 'unit-key-fill';
  for (const segment of entry.fills) {
    const part = document.createElement('span');
    part.className =
      segment.swatch.kind === 'colour' ? 'unit-key-part' : `unit-key-part swatch-${segment.swatch.kind}`;
    if (segment.swatch.kind === 'colour') part.style.background = segment.swatch.colour;
    // Sized by the share the roster computed — a count of the unit's own districts, which is the
    // one quantity here that needs no source because it is a fact about what is drawn.
    part.style.flexGrow = `${segment.share}`;
    bar.append(part);
  }
  return bar;
}

function renderLegend(active: Selection, variant: VariantRecord | null): void {
  const legend = document.getElementById('legend');
  if (legend === null) return;

  if (variant === null || active === null) {
    legend.innerHTML = `
      <span class="legend-item"><span class="swatch swatch-province"></span>Province</span>
      <span class="legend-item"><span class="swatch swatch-territory"></span>Territory — not
        constitutionally a province</span>
      ${
        // Keyed only while the tier is drawn. A swatch for a line the map is not drawing explains
        // a picture that does not exist — which is the same rule the export band's key follows
        // when it refuses to key a basis it has no fill for.
        divisionsShown
          ? '<span class="legend-item"><span class="swatch swatch-rule"></span>Division</span>'
          : ''
      }
      ${lineOfControlEntry}
    `;
    return;
  }

  // Stratum 3 is keyed first and stratum 1 second, in the order a reader meets them: the outlines
  // are what the screen is about, and the fills are the evidence they are drawn against.
  const units = unitLegend(variant)
    .map(
      (entry) =>
        `<span class="legend-item"><span class="swatch swatch-${entry.swatch}"></span>${entry.label}</span>`,
    )
    .join('');
  const fill =
    active.basis === 'language'
      ? motherTongueKey()
      : active.basis === 'development'
        ? developmentKey()
        : { key: '', grouped: '' };
  // The grouped categories go last, after the line's own entry: they are the six a reader never
  // has to match to the map, and putting them mid-legend pushes the ones they do off the end.
  legend.innerHTML = `${units}${fill.key}${lineOfControlEntry}${fill.grouped}`;
}

/** Stratum 1's key under the language basis, in the census's own order. */
function motherTongueKey(): { key: string; grouped: string } {
  const { onTheMap, namedButNowhereDominant, absences } = motherTongueLegend(censusStatistics);
  return {
    key: `${onTheMap.map(item).join('')}${absences.map(item).join('')}`,
    grouped: `
      <span class="legend-group">
        <span class="legend-group-label">Named by the census, dominant in no district</span>
        ${namedButNowhereDominant.map(item).join('')}
      </span>`,
  };
}

/**
 * Stratum 1's key under the Development basis, lowest band first — the order the scale is read in.
 *
 * The lead sentence goes in the `grouped` slot rather than beside the swatches: it is the sentence
 * saying this figure is nobody else's, and a legend row that said so per band would say it four
 * times. The swatches themselves carry their own numbers, because identity is never colour alone —
 * the more so here, where the ramp's adjacent steps are the closest two fills in the app.
 */
function developmentKey(): { key: string; grouped: string } {
  const legend = developmentLegend(developmentIndexBundle);
  return {
    key: `${legend.bands.map(item).join('')}${legend.absences.map(item).join('')}`,
    grouped: `
      <span class="legend-group">
        <span class="legend-group-label">${legend.lead}</span>
      </span>`,
  };
}

function renderColophon(active: Selection, variant: VariantRecord | null): void {
  const colophon = document.getElementById('colophon');
  if (colophon === null) return;
  const { counts, sources, vintage, lineOfControl } = provenance;
  const loc = readLineOfControl(geographyTopology);
  colophon.innerHTML = `
    ${variant === null ? '' : variantProvenance(variant)}
    <p><strong>Boundaries</strong> OpenStreetMap, ODbL — ${counts['provinces']} provinces and
      territories, ${counts['divisions']} divisions, dissolved to the 2023 census set.
      Districts are not drawn on the baseline.</p>
    <p><strong>Kashmir</strong> Azad Jammu &amp; Kashmir and Gilgit-Baltistan are drawn and named
      but are not provinces, and are not shaded under any basis: PBS's 2023 results cover 136
      districts — the four provinces and Islamabad — so no figure exists for either. ${loc.properties.note}
      The line is not traced by hand: it is the ${lineOfControl.ways} OpenStreetMap ways that
      belong both to a drawn territory and to
      ${lineOfControl.againstRelations.map((r) => r.name).join(' or ')}, ${lineOfControl.lengthKm} km
      of boundary running along ${lineOfControl.alongDistricts.length} districts. South of its
      terminus on the Chenab, the Punjab–Jammu stretch is the Working Boundary and is a different
      line; it is not drawn dashed.</p>
    ${durandFootnote()}
    ${contextProvenanceLine()}
    <p><strong>Vintage</strong> ${vintage}. Administrative units created since are folded into
      their 2023 parent, so the map is knowingly not today's map: the Balochistan restructuring
      of 8 July 2026 is not drawn.</p>
    <p><strong>On the map</strong> ${shortFormExpansions
      .map(([short, full]) => `${short} — ${full}`)
      .join(' · ')}. Names are shortened only where the full name is wider than the ground it
      names, and only to the form the unit uses for itself.</p>
    ${active?.basis === 'language' ? motherTongueProvenance() : ''}
    ${active?.basis === 'development' ? developmentProvenance() : ''}
    <p><strong>Sources</strong> ${sources['boundaries']} · roster: PBS.</p>
  `;
}

/**
 * The Durand Line's footnote (#8).
 *
 * The line is drawn as an ordinary international boundary and nothing in the renderer knows it
 * apart from any other stretch of Pakistan's outline — which is the decision, not an oversight.
 * A dash means *ceasefire line* (D12), and there is exactly one of those on this map; using it a
 * second time for a boundary of a different kind would cost the dash its meaning. So the dispute
 * is carried in words, and the words come out of the bundle rather than out of this file, so they
 * cannot be lost while the line is still on screen.
 */
function durandFootnote(): string {
  const note = boundaryNote(contextProvenance, 'AF');
  if (note === null) return '';
  // The badge and the source ride with the prose. A footnote making historical assertions in the
  // app's own voice is the last place an unsourced claim should be able to hide.
  return (
    `<p><strong>Durand Line</strong> <span class="badge">${note.badge}</span> ${note.text} ` +
    `<span class="source">${note.source}</span></p>`
  );
}

/**
 * What the furniture is, and what it is not.
 *
 * The silhouettes and the dots are the only things on this map that are not Pakistan, and the
 * working agreement puts the same obligation on them as on everything else: a shape on screen
 * says where it came from. The city criterion needs saying most of all, because "major city" is
 * the kind of phrase a reader assumes means *largest* — here it means *seat*, and the four larger
 * cities it leaves off are named so the omission reads as a rule and not as an oversight.
 */
function contextProvenanceLine(): string {
  const { neighbours, cities } = contextProvenance;
  return `
    <p><strong>Context</strong> ${neighbours.countries.map((c) => c.name).join(', ')} are drawn
      faint and unlabelled from their own OpenStreetMap boundary relations, cut to a rectangle
      around the frame. They are background: nothing is shaded, measured or hovered on them, and
      they sit beneath Pakistan's own land. ${neighbours.kashmir}</p>
    <p><strong>Cities</strong> ${cities.count} dots, badged ${cities.badge}. ${cities.criterion}
      ${cities.why} ${cities.omits} ${cities.join} Where a division is named after the city at its
      seat — six of the seven are — the name is set at the dot rather than at the division's
      centroid, because the dot is the more precise of the two claims.</p>`;
}

/**
 * Where the boundaries on screen came from, and that they are not the country's.
 *
 * The variant card (#19) is where the rationale, the advocacy and the opposition go. This is the
 * smaller obligation the working agreement puts on any surface at all: a heavy accent outline
 * drawn over Pakistan is a claim, and a claim carries its badge and its source in the same view
 * as itself — not one click away.
 */
function variantProvenance(variant: VariantRecord): string {
  const composition =
    variant.composition.kind === 'transcribed'
      ? `Transcribed from ${variant.composition.from}.`
      : `Derived — ${variant.composition.rule}, from ${variant.composition.from}.`;
  const folded = variant.units
    .flatMap((unit) => unit.folded)
    .map((fold) => `${fold.from} into ${fold.into}`);
  return `
    <p><strong>On screen</strong> ${variant.name} — a proposal, not official. ${composition}
      ${variant.badges.join(' · ')}. ${variant.counts.units} units, of which
      ${variant.counts.proposedUnits} proposed; stated as ${variant.counts.claimedDistricts}
      districts and drawn as ${variant.counts.drawnDistricts}${
        folded.length === 0 ? '' : `, folding ${folded.join(' and ')} under the 2023 vintage`
      }. ${variant.sources[0]?.label ?? ''}</p>`;
}

/**
 * No unsourced surface anywhere — including a shading. A fill on screen with no line saying
 * where it came from is exactly what the working agreement forbids, so the moment stratum 1 is
 * on, the colophon says which table it is, what its universe is, and where it is silent.
 */
function motherTongueProvenance(): string {
  const { source, universe, categories } = censusStatistics.motherTongue;
  const gap = (universe.population - universe.counted).toLocaleString('en-GB');
  return `
    <p><strong>Mother tongue</strong> ${source.split('.')[0]}. ${categories.length} categories,
      the census's own and unmerged. Its universe is ${universe.counted.toLocaleString('en-GB')} —
      ${gap} below Table 1's population, a difference PBS shares with Table 10 and does not
      explain, so it is stated and not closed. Khowar has no column, so the census names no
      dominant language in Chitral and the map says so rather than guessing one.</p>`;
}

/**
 * No unsourced surface anywhere — and this is the one fill on the map that is not a published
 * figure, so it owes the most.
 *
 * The colophon says what the composite is, what it is a mean of, that no source states it, and
 * that it is not a poverty measure. The last of those is not decoration: three access indicators
 * are what the census has, income and consumption and child mortality are what it does not, and a
 * shaded map of "development" read as a map of poverty is the single most likely misreading of
 * this basis.
 */
function developmentProvenance(): string {
  const { formula, notPoverty, badge, range, counts, bandMethod } = developmentIndexBundle.provenance;
  return `
    <p><strong>Development index</strong> <span class="badge">${badge}</span> ${formula}
      ${notPoverty} Shaded over ${counts.districts} districts, from ${range.lowest.district} at
      ${(range.lowest.score * 100).toFixed(1)}% to ${range.highest.district} at
      ${(range.highest.score * 100).toFixed(1)}%. ${bandMethod}</p>`;
}

render();

// The address bar is brought into line with what is actually drawn — a bare `#/language` expanded
// to the variant it means, a dead variant id dropped for the baseline, and a first visit with no
// hash at all given the baseline's own URL. `replaceState`, so the entry the reader arrived on is
// corrected rather than buried: pressing back must still leave the site, not undo a rewrite they
// never made.
if (!opening.asWritten) window.history.replaceState(null, '', hashFor(selection));
