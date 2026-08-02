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
import {
  BASELINE,
  refusalLines,
  selectBasis,
  selectVariant,
  type BasisChoice,
  type Selection,
} from './lib/selection.ts';

export interface PanelHandle {
  /** Redraw the controls for a selection made elsewhere — a deep link, or a later ticket's undo. */
  show(selection: Selection): void;
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

  function show(selection: Selection): void {
    basisButtons.attr('aria-checked', (option) =>
      option.id === (selection?.basis ?? null) ? 'true' : 'false',
    );

    const active = choices.find((choice) => choice.basis.id === selection?.basis);
    // Empty at the baseline: an empty proposal row is not hidden but collapsed, so the controls
    // do not change height as a basis is chosen and the map below them does not jump.
    root.attr('data-variants', active === undefined ? 'none' : 'some');
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

  show(BASELINE);
  return { show };
}
