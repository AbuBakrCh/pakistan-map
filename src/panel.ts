/**
 * The two controls: which basis, and which variant within it (#18).
 *
 * Imperative D3 against the DOM, like `map.ts` and for the same reason — everything with a
 * decision in it is upstream in `lib/selection.ts`, under test. What is left here is which
 * element gets which attribute.
 *
 * Both controls are radio groups rather than menus. A basis and a variant are each one-of-N and
 * always exactly one (D9, D10): a dropdown would hide the alternatives behind a click, and the
 * alternatives *are* the product. The baseline sits in the same group as the four bases, first,
 * because returning to the real map is the same kind of act as choosing a basis — it is the
 * comparison every proposal is argued against, not a reset button.
 */

import { select } from 'd3';
import type { BasisId, ScenarioBundle } from './bundle.ts';
import type { AboutBadge, AboutTheData } from './lib/about.ts';
import type { CardList, CardScorecard, CardUnit, VariantCard } from './lib/card.ts';
import { COMPARE_HINT, COMPARE_LABEL, COMPARE_TITLE } from './lib/compare.ts';
import {
  DIVISIONS_LABEL,
  DIVISIONS_SHOWN_BY_DEFAULT,
  DIVISIONS_TITLE,
  divisionsState,
} from './lib/divisions.ts';
import { EXPORT_LABEL, EXPORT_TITLE, EXPORT_WORKING } from './lib/export-band.ts';
import { rovingTarget, tabStop } from './lib/radio-group.ts';
import {
  BASELINE,
  offeredBases,
  refusalLines,
  selectBasis,
  selectVariant,
  type BasisChoice,
  type Selection,
} from './lib/selection.ts';

export interface PanelHandle {
  /**
   * Redraw the controls for a selection made elsewhere — a deep link, or a later ticket's undo —
   * and for the compare gesture, which is held by the key as often as by the button and must
   * show the same state either way.
   */
  show(selection: Selection, comparing: boolean): void;
  /**
   * The export has finished — successfully or not — and the button may be pressed again (#32).
   *
   * Separate from `show` because it is not a property of the selection: an export in flight is a
   * fact about the button, and folding it into the view would make every redraw of the controls
   * have an opinion about whether a download is running.
   */
  exportSettled(): void;
}

/** What a basis button offers, with the baseline folded in as the first of them. */
interface BasisOption {
  readonly id: BasisId | null;
  readonly label: string;
  readonly title: string;
  readonly available: boolean;
}

export function renderControls(
  container: HTMLElement,
  scenarios: ScenarioBundle,
  choices: readonly BasisChoice[],
  /** `waypoint` is true for an arrow key inside a group — a view passed through, not chosen. */
  onSelect: (selection: Selection, waypoint?: boolean) => void,
  /** The button half of the compare gesture (#22). The key half is wired in `main.ts`. */
  onCompare: () => void,
  /** Download the current view as a PNG with its provenance baked in (#32, D22). */
  onExport: () => void,
): PanelHandle {
  /** The basis whose variants the second group is currently offering, for the arrow keys. */
  let active: BasisChoice | undefined;

  const options: BasisOption[] = [
    {
      id: null,
      label: 'Current',
      title: 'The map as it stands: provinces, territories and divisions, and nothing proposed.',
      available: true,
    },
    // The bases this build offers, which is not every basis it knows: a withheld one is off the
    // strip entirely rather than dimmed, so it takes no chip, no tab stop and no arrow key.
    ...offeredBases(choices).map((choice) => ({
      id: choice.basis.id,
      label: choice.basis.name,
      // The source is on the button itself, not only on the card: a reader choosing what to argue
      // from is entitled to know what it is argued from before they choose it.
      title: choice.unavailable ?? `${choice.basis.name} — ${choice.basis.source}`,
      available: choice.available,
    })),
  ];

  const root = select(container).append('div').attr('class', 'controls');

  const bases = root
    .append('div')
    .attr('class', 'control control-basis')
    .attr('role', 'radiogroup')
    .attr('aria-label', 'Basis — the ground a proposal is argued from');
  bases.append('span').attr('class', 'control-label').text('Basis');
  // The chips in a strip of their own, as the variants already are. It costs nothing on a wide
  // screen and is what lets a phone scroll the five bases along one line instead of wrapping them
  // into three rows of the map's height — the refusal lines still wrap underneath, where they can
  // be read rather than scrolled to.
  const basisList = bases.append('div').attr('class', 'control-options');

  const basisButtons = basisList
    .selectAll<HTMLButtonElement, BasisOption>('button')
    .data(options, (option) => option.id ?? 'baseline')
    .join('button')
    .attr('type', 'button')
    .attr('role', 'radio')
    .attr('class', 'chip')
    .attr('title', (option) => option.title)
    .property('disabled', (option) => !option.available)
    .text((option) => option.label)
    .on('click', (_event, option) => {
      if (!option.available) return;
      onSelect(option.id === null ? BASELINE : selectBasis(choices, option.id));
    });

  /*
   * The keyboard half of `role="radiogroup"` (#35).
   *
   * Declaring the role is a promise about the arrow keys as much as about the accessible name, and
   * until this it was a promise the markup made and the behaviour did not keep. Selecting on move
   * is the radio pattern rather than a shortcut: for a radio group, focus and selection travel
   * together, and this app has no state in which a basis is focused but not chosen anyway (D13).
   *
   * Where a key lands is `lib/radio-group.ts`'s, under test. What is here is the plumbing, and one
   * rule with teeth: only keys the group actually claims have their default suppressed, so `Tab`
   * still leaves, `Enter` still activates, and **`Space` is never touched** — it belongs to the
   * compare gesture (#22) and to the button's own click, and taking it here would undo the care
   * `holdsCompare` takes to leave it alone.
   */
  /**
   * The roving tabindex: one stop per group, on whatever is checked (#35).
   *
   * A `disabled` button is already out of the ring, so the stop is computed over the ones that can
   * take focus — otherwise a group whose checked option is unavailable would have a tab stop the
   * browser refuses to enter, and the whole group would become unreachable.
   */
  /** The options the browser will not give focus to. One computation, read by both helpers. */
  const skipped = (buttons: readonly HTMLButtonElement[]): number[] =>
    buttons.flatMap((button, index) => (button.disabled ? [index] : []));

  function rove(buttons: readonly HTMLButtonElement[], checked: number): void {
    const skip = skipped(buttons);
    const stop = tabStop({
      from: 0,
      count: buttons.length,
      skip,
      checked: checked === -1 ? null : checked,
    });
    buttons.forEach((button, index) => {
      button.tabIndex = index === stop ? 0 : -1;
    });
  }

  function steerGroup(
    group: d3.Selection<HTMLDivElement, unknown, null, undefined>,
    activate: (index: number) => void,
  ): void {
    group.on('keydown', (event: KeyboardEvent) => {
      const buttons = [...group.selectAll<HTMLButtonElement, unknown>('button').nodes()];
      const from = buttons.findIndex((button) => button === event.target);
      if (from === -1) return;
      const to = rovingTarget(event.key, {
        from,
        count: buttons.length,
        skip: skipped(buttons),
      });
      if (to === null) return;
      event.preventDefault();
      buttons[to]?.focus();
      activate(to);
    });
  }

  steerGroup(basisList, (index) => {
    const option = options[index];
    if (option === undefined || !option.available) return;
    onSelect(option.id === null ? BASELINE : selectBasis(choices, option.id), true);
  });

  // Why the dimmed chips are dimmed, printed rather than left in their `title`. A `title` is
  // reachable by a hovering mouse and by nothing else, and a disabled control takes no tap — so
  // on the 390px bar this line is the whole of "offered and refused out loud".
  bases
    .selectAll('span.control-refusal')
    .data(refusalLines(choices))
    .join('span')
    .attr('class', 'control-refusal')
    .text((line) => line);

  const variants = root
    .append('div')
    .attr('class', 'control control-variant')
    .attr('role', 'radiogroup')
    .attr('aria-label', 'Variant — a complete, sourced proposal');
  // "Variant" and not "Proposal": the glossary reserves one word for this, and a control that
  // says one thing while its own accessible name says another gives a reader two terms for it.
  variants.append('span').attr('class', 'control-label').text('Variant');
  const variantList = variants.append('div').attr('class', 'control-options');
  steerGroup(variantList, (index) => {
    const list = active?.variants ?? [];
    const variant = list[index];
    if (variant !== undefined) onSelect(selectVariant(scenarios, variant.id), true);
  });

  /*
   * Compare (#22). Not a radio and not a member of either group: it does not choose what the map
   * shows, it holds what the map shows out of the way. `aria-pressed` rather than `aria-checked`
   * for exactly that reason — this is a control that is on or off, not one of a set of four.
   *
   * It arrives and leaves with the outlines, like the card: at the baseline there is no proposal
   * on screen, and the current map compared against itself is not a comparison (D17). Hidden
   * rather than removed, so entering a basis does not move the controls under the pointer — the
   * same treatment the variant row already gets.
   */
  /*
   * Compare and the export share a row, because they are the same kind of control — neither
   * chooses what the map shows, and both act on whatever is already on it. On a wide screen the
   * grouping costs nothing and reads as what it is; on a phone it is what lets the pair sit in the
   * corner a thumb reaches as one 44px row rather than as a stack tall enough to cover the
   * tooltip's own third line.
   */
  const actions = root.append('div').attr('class', 'control control-actions');
  const compare = actions.append('div').attr('class', 'control-action control-compare');
  const compareButton = compare
    .append('button')
    .attr('type', 'button')
    .attr('class', 'chip chip-compare')
    .attr('title', COMPARE_TITLE)
    .attr('aria-pressed', 'false')
    .text(COMPARE_LABEL)
    .on('click', () => onCompare());
  // Printed beside the button, not tucked into its `title`: a `title` needs a hovering mouse, and
  // the key is the faster half of the gesture for everyone who has one.
  compare.append('span').attr('class', 'control-hint').text(COMPARE_HINT);

  /*
   * The export (#32, D22). Present at the baseline as well as under a proposal, unlike Compare:
   * the current map is exactly as likely to be screenshotted as a proposed one, and the sanctioned
   * copy is the one that carries its own sources. What the band says changes with the view; that it
   * is there does not.
   *
   * A plain button and no menu — one format, one resolution. The whole argument for this feature is
   * that it must be the path of least resistance compared with pressing the screenshot key.
   */
  const download = actions.append('div').attr('class', 'control-action control-export');
  const exportButton = download
    .append('button')
    .attr('type', 'button')
    .attr('class', 'chip chip-export')
    .attr('title', EXPORT_TITLE)
    .text(EXPORT_LABEL)
    .on('click', () => {
      // Disabled for the duration rather than debounced: encoding a 2× PNG takes long enough on a
      // phone for a second press to land, and two exports of one view is a confusing answer to one
      // press. The label says what is happening, since nothing else on the page will change.
      exportButton.property('disabled', true).text(EXPORT_WORKING);
      onExport();
    });

  /** Re-enabled by `main.ts` once the file is handed to the browser, or once it has failed. */
  function exportSettled(): void {
    exportButton.property('disabled', false).text(EXPORT_LABEL);
  }

  function show(selection: Selection, comparing: boolean): void {
    basisButtons.attr('aria-checked', (option) =>
      option.id === (selection?.basis ?? null) ? 'true' : 'false',
    );
    // One stop on the tab ring per group, at whatever is currently true (#35). Tabbing through
    // five bases and then eight variants to reach the map is a journey nobody finishes.
    rove(basisButtons.nodes(), options.findIndex((o) => o.id === (selection?.basis ?? null)));

    // The button shows the state the key can put it in as well, or a reader who held Space would
    // watch an unpressed button while the map beside it was plainly comparing.
    compareButton.attr('aria-pressed', comparing ? 'true' : 'false');

    active = choices.find((choice) => choice.basis.id === selection?.basis);
    // Empty at the baseline: an empty proposal row is not hidden but collapsed, so the controls
    // do not change height as a basis is chosen and the map below them does not jump.
    root.attr('data-variants', active === undefined ? 'none' : 'some');
    root.attr('data-compare', selection === null ? 'none' : 'some');
    variantList
      .selectAll<HTMLButtonElement, { id: string; name: string; tagline: string | null }>('button')
      .data(active?.variants ?? [], (variant) => variant.id)
      .join('button')
      .attr('type', 'button')
      .attr('role', 'radio')
      .attr('class', 'chip')
      .attr('aria-checked', (variant) => (variant.id === selection?.variant ? 'true' : 'false'))
      .attr('title', (variant) => variant.tagline ?? variant.name)
      // The basis comes from the variant, never from the control's own idea of what is active.
      .on('click', (_event, variant) => onSelect(selectVariant(scenarios, variant.id)))
      .each(function render(variant) {
        this.replaceChildren();
        const name = this.appendChild(document.createElement('span'));
        name.className = 'chip-name';
        name.textContent = variant.name;
        if (variant.tagline !== null) {
          const tagline = this.appendChild(document.createElement('span'));
          tagline.className = 'chip-tagline';
          tagline.textContent = variant.tagline;
        }
      });

    rove(
      [...variantList.selectAll<HTMLButtonElement, unknown>('button').nodes()],
      (active?.variants ?? []).findIndex((variant) => variant.id === selection?.variant),
    );
  }

  show(BASELINE, false);
  return { show, exportSettled };
}

/**
 * The one control that sits on the map: whether the division tier is drawn.
 *
 * Not in the controls well with the two radio groups, because it is not one of a set and does not
 * choose what the map argues — it decides how much of the administrative map the argument is drawn
 * over. That is the same kind of control Compare and the export are (neither chooses what the map
 * shows), and it is put on the paper rather than beside it because what it changes is the paper.
 *
 * A pressed-state button rather than a checkbox: every control on this page is a `<button>`, which
 * is what `holdsCompare` relies on when it refuses `Space` to a focused control (#22) — a checkbox
 * answers `Space` too, but nothing else here is one and a single exception is how that rule comes
 * to have a hole in it. `aria-pressed` says which way it is, and the description says what that
 * means for the map, since `role="img"` means the map itself can be asked nothing.
 *
 * Every word of it is `lib/divisions.ts`'s. This file composes none, exactly as it composes none of
 * the card's.
 */
export interface DivisionsHandle {
  /** Whether the tier is currently drawn — the button reflects state it does not itself own. */
  show(shown: boolean): void;
}

export function renderMapControls(
  container: HTMLElement,
  onToggle: (shown: boolean) => void,
): DivisionsHandle {
  let shown = DIVISIONS_SHOWN_BY_DEFAULT;

  const description = select(container)
    .append('span')
    .attr('class', 'visually-hidden')
    .attr('id', 'divisions-state');

  const button = select(container)
    .append('button')
    .attr('type', 'button')
    .attr('class', 'chip chip-divisions')
    .attr('title', DIVISIONS_TITLE)
    .attr('aria-describedby', 'divisions-state')
    .text(DIVISIONS_LABEL)
    .on('click', () => onToggle(!shown));

  function show(next: boolean): void {
    shown = next;
    button.attr('aria-pressed', shown ? 'true' : 'false');
    description.text(divisionsState(shown));
  }

  show(shown);
  return { show };
}

/**
 * The variant card (#19) — the one surface where a proposal is argued rather than drawn.
 *
 * Imperative D3 against the DOM, like everything else in this file: every word on the card is
 * decided in `lib/card.ts`, under test, and nothing here composes a sentence. What is left is
 * which element gets which class, and the ordering of the sections — which is itself the card's
 * argument, read top to bottom:
 *
 *   what it is → what it covers → why → where it stands → where the boundary came from →
 *   who is for it → **who is against it** → the units → the scorecard → footnotes → sources
 *
 * The opposition sits immediately under the advocacy and above everything else, rather than at
 * the foot with the small print. A reader who stops halfway down a card has still read both.
 *
 * Not animated. The map cross-fades because a shape moves and the eye needs to follow it; the
 * card is prose, and prose faded in over a third of a second is prose the reader waits for. It is
 * replaced at once, which is why no duration is read here — there is only ever one, and the
 * stylesheet owns it.
 */
export interface CardHandle {
  /** `null` at the baseline: there is no proposal on screen, so there is no card. */
  show(card: VariantCard | null): void;
}

/** Text node helper — content is set as text, never as markup, on every surface. */
function el<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tag: K,
  className: string,
  text?: string | null,
): HTMLElementTagNameMap[K] {
  const node = parent.appendChild(document.createElement(tag));
  node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

/** "Advocated by" / "Opposed by": a list where there is one, the sentence where there is not. */
function renderList(parent: HTMLElement, list: CardList): void {
  const block = el(parent, 'div', 'card-party');
  el(block, 'h3', 'card-party-label', list.label);
  if (list.items.length === 0) {
    // Never an empty list, and never nothing: an absent opposition line reads as the app
    // agreeing with whatever is on screen, which is the failure the line exists to prevent.
    el(block, 'p', 'card-party-note', list.note);
    return;
  }
  const items = el(block, 'ul', 'card-party-list');
  for (const item of list.items) el(items, 'li', 'card-party-item', item);
}

function renderUnit(parent: HTMLElement, unit: CardUnit): void {
  const row = el(parent, 'li', `card-unit card-unit-${unit.kind}`);
  const name = el(row, 'span', 'card-unit-name', unit.name);
  // Beside the advocates' own name, never in place of it: the app reports what people call
  // things and adjudicates nothing.
  if (unit.alsoKnownAs !== null) {
    name.append(' ');
    el(name, 'span', 'card-unit-aka', `(${unit.alsoKnownAs})`);
  }
  el(row, 'span', 'card-unit-standing', unit.standing);
  el(row, 'span', 'card-unit-districts', unit.districts);
  // Area above the population line (#49), where there is one: a card carries areas exactly because
  // it carries no populations, so the figure a reader can have comes before the sentence saying
  // which one they cannot. `card.ts` decides which units have one; this file composes nothing.
  if (unit.area !== null) el(row, 'span', 'card-unit-area', unit.area);
  el(row, 'span', 'card-unit-population', unit.population);
  if (unit.note !== null) el(row, 'span', 'card-unit-note', unit.note);
}

/** The scorecard (#20): a figure, its name, and the qualification it cannot be read without. */
function renderScorecard(parent: HTMLElement, scorecard: CardScorecard): void {
  const section = el(parent, 'section', 'card-section card-scorecard');
  el(section, 'h3', 'card-section-label', 'Scorecard');
  // Said above the figures, not below them: a reader who has been told there are no population
  // figures reads the remaining lines as the whole of the scorecard rather than as what is left
  // of it. Never rendered as a gap — the words are `card.ts`'s, in the voice of whatever is
  // missing them.
  if (scorecard.withheld !== null) {
    el(section, 'p', 'card-scorecard-withheld', scorecard.withheld);
  }
  const figures = el(section, 'dl', 'card-scorecard-figures');
  for (const line of scorecard.lines) {
    el(figures, 'dt', 'card-scorecard-label', line.label);
    const value = el(figures, 'dd', 'card-scorecard-value', line.value);
    if (line.note !== null) el(value, 'span', 'card-scorecard-note', line.note);
  }
}

export function renderVariantCard(container: HTMLElement): CardHandle {
  const root = select(container).append('article').attr('class', 'card');

  function show(card: VariantCard | null): void {
    const node = root.node();
    if (node === null) return;
    node.replaceChildren();
    // Hidden rather than emptied, so the baseline is a page with no card on it at all — an empty
    // frame under the map would read as a card that failed to load.
    container.hidden = card === null;
    if (card === null) return;

    /*
     * Three columns, in one DOM order and never in two.
     *
     * The split is by *where the page puts them* and not by kind: on a wide screen all three sit
     * in a block underneath the map — the argument at a prose measure, the units and the scorecard
     * beside it, and what qualifies them to their right — so that the map keeps the whole width of
     * the page, which is the one thing this page is for. On a narrow one all three stack inside
     * the sheet in exactly this order — the
     * argument, then what it is made of, then what qualifies it — which is the card's own order
     * read top to bottom (#19) and the reason the placement is CSS's rather than this file's.
     *
     * `card-column-notes` is a column and not a footer for the same reason `card-column-detail` is
     * one: the sheet holds the card whole, so nothing here may be a surface a phone does not get.
     */
    const argument = el(node, 'div', 'card-column card-column-argument');
    const detail = el(node, 'div', 'card-column card-column-detail');
    const notes = el(node, 'div', 'card-column card-column-notes');

    const head = el(argument, 'header', 'card-head');
    const heading = el(head, 'h2', 'card-name', card.name);
    if (card.tagline !== null) {
      heading.append(' ');
      el(heading, 'span', 'card-tagline', `— ${card.tagline}`);
    }

    // Two kinds of badge, kept visibly apart: the basis is what the shading argues from, the
    // provenance is where this boundary came from, and one of L1's disagrees with the other.
    const badges = el(head, 'p', 'card-badges');
    el(badges, 'span', 'badge badge-basis', card.basis.label);
    for (const provenance of card.provenance) {
      el(badges, 'span', 'badge badge-provenance', provenance.label);
    }
    // Glossed on the card and not in a `title`: the hard bar is a 390px phone, which has no hover.
    el(
      head,
      'p',
      'card-gloss',
      [card.basis.gloss, ...card.provenance.map((b) => b.gloss)].join(' · '),
    );
    if (card.provenanceNote !== null) el(head, 'p', 'card-note', card.provenanceNote);

    el(argument, 'p', 'card-summary', card.summary);
    el(argument, 'p', 'card-coverage', card.coverage);
    el(argument, 'p', 'card-rationale', card.rationale);

    const facts = el(argument, 'dl', 'card-facts');
    for (const [term, value] of [
      ['Status', card.status],
      ['Boundary', card.composition],
    ] as const) {
      el(facts, 'dt', 'card-term', term);
      el(facts, 'dd', 'card-detail', value);
    }

    const parties = el(argument, 'div', 'card-parties');
    renderList(parties, card.advocacy);
    renderList(parties, card.opposition);

    if (card.figuresWithheld !== null) {
      el(argument, 'p', 'card-withheld', card.figuresWithheld);
    }

    const units = el(detail, 'section', 'card-section');
    el(units, 'h3', 'card-section-label', 'Units');
    const list = el(units, 'ul', 'card-units');
    for (const unit of card.units) renderUnit(list, unit);

    // Between the units it summarises and the footnotes that qualify them (#20).
    renderScorecard(detail, card.scorecard);

    if (card.footnotes.length > 0) {
      const footnotes = el(notes, 'section', 'card-section');
      el(footnotes, 'h3', 'card-section-label', 'Footnotes');
      const items = el(footnotes, 'ul', 'card-footnotes');
      for (const footnote of card.footnotes) {
        const row = el(items, 'li', `card-footnote card-footnote-${footnote.kind}`);
        el(row, 'span', 'card-footnote-label', footnote.label);
        el(row, 'span', 'card-footnote-text', footnote.text);
      }
    }

    for (const note of card.notes) {
      const row = el(notes, 'section', 'card-section card-crossref');
      el(row, 'h3', 'card-section-label', note.label);
      el(row, 'p', 'card-crossref-text', note.text);
    }

    // No unsourced surface anywhere, the card least of all: it is the surface that states what a
    // movement wants and who is against it.
    const sources = el(notes, 'section', 'card-section');
    el(sources, 'h3', 'card-section-label', 'Sources');
    const cited = el(sources, 'ul', 'card-sources');
    for (const source of card.sources) {
      const row = el(cited, 'li', 'card-source');
      if (source.url === null) {
        row.textContent = source.label;
        continue;
      }
      const link = el(row, 'a', 'card-source-link', source.label);
      link.href = source.url;
      link.rel = 'noreferrer';
      link.target = '_blank';
    }
  }

  show(null);
  return { show };
}

/**
 * The "About the data" panel (#21) — the surface the app's own central claim is checked against.
 *
 * Imperative D3 against the DOM like the rest of this file, and like the rest of it composes not
 * one sentence: every word, every figure and every badge gloss is decided in `lib/about.ts`, under
 * test, and read off the committed bundles there. What is left here is which element gets which
 * class.
 *
 * A `<details>` and nothing cleverer. It opens with no JavaScript, is reachable by keyboard and by
 * tap, needs no hover to be discovered, and collapses to a single line of text at 390px — which is
 * the bar this has to clear. A modal would need a close button, a focus trap and a width; a
 * separate route would put the provenance one page away from the map it qualifies.
 *
 * Rendered once, at load. Nothing on it answers to the selection: the sources, the vintages and
 * the build dates are the same under every basis and every proposal, and redrawing it on each
 * change would be the page moving underneath a reader who is reading it.
 */
export function renderAbout(container: HTMLElement, about: AboutTheData): void {
  const root = select(container).append('details').attr('class', 'about').node();
  if (root === null) return;

  el(root, 'summary', 'about-summary', about.summary);
  const body = el(root, 'div', 'about-body');
  el(body, 'h2', 'about-title', about.title);
  el(body, 'p', 'about-lead', about.lead);

  const vintage = section(body, 'Vintage');
  el(vintage, 'p', 'about-vintage-statement', about.vintage.statement);
  el(vintage, 'p', 'about-prose', about.vintage.consequence);

  const built = section(body, 'Built');
  el(built, 'p', 'about-prose', about.built.lead);
  const stamps = el(built, 'dl', 'about-stamps');
  for (const stamp of about.built.stamps) {
    el(stamps, 'dt', 'about-stamp-label', stamp.label);
    const value = el(stamps, 'dd', 'about-stamp-value', stamp.date);
    // The machine-readable form beside the readable one, so a reader can match the line against
    // the timestamp inside the file rather than against a date that could be either of two days.
    const exact = el(value, 'time', 'about-stamp-iso', stamp.iso);
    exact.dateTime = stamp.iso;
  }

  const bases = section(body, 'Bases');
  el(bases, 'p', 'about-prose', about.bases.lead);
  const basisList = el(bases, 'ul', 'about-rows');
  for (const basis of about.bases.items) {
    const row = el(basisList, 'li', 'about-row');
    el(row, 'h4', 'about-row-what', basis.name);
    renderBadges(row, basis.badges);
    el(row, 'p', 'about-row-source', basis.source);
    el(row, 'p', 'about-row-vintage', basis.vintage);
  }

  const sources = section(body, 'Sources');
  el(sources, 'p', 'about-prose', about.sources.lead);
  const sourceList = el(sources, 'ul', 'about-rows');
  for (const source of about.sources.items) {
    const row = el(sourceList, 'li', 'about-row');
    el(row, 'h4', 'about-row-what', source.what);
    renderBadges(row, source.badges);
    el(row, 'p', 'about-row-source', source.source);
    el(row, 'p', 'about-row-vintage', source.vintage);
    if (source.caveat !== null) el(row, 'p', 'about-row-caveat', source.caveat);
  }

  // Not a footnote and not last: a panel that listed the sources and buried the places they
  // disagree would make the data look tidier than it is, which is the failure it exists to
  // prevent.
  const discrepancies = section(body, 'Where the sources disagree');
  el(discrepancies, 'p', 'about-prose', about.discrepancies.lead);
  const items = el(discrepancies, 'ul', 'about-rows');
  for (const item of about.discrepancies.items) {
    const row = el(items, 'li', 'about-row about-row-discrepancy');
    const label = el(row, 'h4', 'about-row-what', item.label);
    if (item.figure !== null) {
      label.append(' ');
      el(label, 'span', 'about-figure', item.figure);
    }
    el(row, 'p', 'about-row-caveat', item.text);
  }

  const rest = section(body, 'Not on this panel');
  el(rest, 'p', 'about-prose', about.omitted);

  const licences = section(body, 'Attribution');
  const list = el(licences, 'ul', 'about-licences');
  for (const licence of about.licences) el(list, 'li', 'about-licence', licence);
}

function section(parent: HTMLElement, label: string): HTMLElement {
  const node = el(parent, 'section', 'about-section');
  el(node, 'h3', 'about-section-label', label);
  return node;
}

/** Glossed on the panel, never in a `title`: the panel that explains the badges least of all. */
function renderBadges(parent: HTMLElement, list: readonly AboutBadge[]): void {
  const row = el(parent, 'p', 'about-badges');
  for (const item of list) el(row, 'span', 'badge badge-provenance', item.label);
  el(parent, 'p', 'about-gloss', list.map((item) => item.gloss).join(' · '));
}
