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
import type { CardList, CardScorecard, CardUnit, VariantCard } from './lib/card.ts';
import { COMPARE_HINT, COMPARE_LABEL, COMPARE_TITLE } from './lib/compare.ts';
import {
  BASELINE,
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
  onSelect: (selection: Selection) => void,
  /** The button half of the compare gesture (#22). The key half is wired in `main.ts`. */
  onCompare: () => void,
): PanelHandle {
  const options: BasisOption[] = [
    {
      id: null,
      label: 'Current',
      title: 'The map as it stands: provinces, territories and divisions, and nothing proposed.',
      available: true,
    },
    ...choices.map((choice) => ({
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

  const basisButtons = bases
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
  const compare = root.append('div').attr('class', 'control control-compare');
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

  function show(selection: Selection, comparing: boolean): void {
    basisButtons.attr('aria-checked', (option) =>
      option.id === (selection?.basis ?? null) ? 'true' : 'false',
    );

    // The button shows the state the key can put it in as well, or a reader who held Space would
    // watch an unpressed button while the map beside it was plainly comparing.
    compareButton.attr('aria-pressed', comparing ? 'true' : 'false');

    const active = choices.find((choice) => choice.basis.id === selection?.basis);
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
  }

  show(BASELINE, false);
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

    // Two columns on a wide screen, stacked on a narrow one, and the same order either way: the
    // argument first, then what it is made of. A single 68ch measure inside a full-width well
    // leaves half the box empty, and prose set the full width of the page is prose nobody reads.
    const argument = el(node, 'div', 'card-column card-column-argument');
    const detail = el(node, 'div', 'card-column card-column-detail');

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
      const footnotes = el(detail, 'section', 'card-section');
      el(footnotes, 'h3', 'card-section-label', 'Footnotes');
      const items = el(footnotes, 'ul', 'card-footnotes');
      for (const footnote of card.footnotes) {
        const row = el(items, 'li', `card-footnote card-footnote-${footnote.kind}`);
        el(row, 'span', 'card-footnote-label', footnote.label);
        el(row, 'span', 'card-footnote-text', footnote.text);
      }
    }

    for (const note of card.notes) {
      const row = el(detail, 'section', 'card-section card-crossref');
      el(row, 'h3', 'card-section-label', note.label);
      el(row, 'p', 'card-crossref-text', note.text);
    }

    // No unsourced surface anywhere, the card least of all: it is the surface that states what a
    // movement wants and who is against it.
    const sources = el(detail, 'section', 'card-section');
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
