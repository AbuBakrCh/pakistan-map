import type { BasisId } from '../bundle';
import type { Selection } from './selection.ts';

/**
 * The method note (#52): in a few sentences, how the map on screen was built, said on the paper.
 *
 * The card beside the map says what a variant *claims* and who claims it; the legend says what a
 * colour means; the scorecard says what the partition comes to. None of the three says the one thing
 * a reader looking at a boundary asks first — *how did you get this line?* That answer lives in
 * `docs/derived-variants.md` and on no surface a reader of the map ever sees.
 *
 * So it is a short prose summary of the rule, on the paper, in the corner the other two keys are not
 * in. Four properties, and the first three are the on-paper keys' own:
 *
 * - **It composes nothing.** The sentences are written here, reviewed here, and rendered verbatim by
 *   `main.ts` — the rule the card already follows (`lib/card.ts` holds the words, `panel.ts` holds
 *   none).
 * - **A basis with no summary written for it gets no box**, rather than a heading over an empty one:
 *   the entry is absent and the stylesheet's `:empty` takes the box off the paper, exactly as the
 *   baseline empties the unit key. An invented summary would be this app's editorial voice on a
 *   surface every other sentence of which is sourced.
 * - **It answers to the basis, not to the comparison.** Compare is a gesture over the map and the
 *   proposal is still selected while it is held off the screen, which is what the legend, the
 *   colophon, the card and both keys already do.
 * - **The rule is the basis's and the reading is the variant's.** The shared paragraphs are the
 *   basis's — the ground every one of its boundaries is argued on — and a variant may add one
 *   paragraph of its own saying what *this* map does with that ground. It adds; it never replaces,
 *   because a variant that overwrote the shared rule would be free to describe a method the map
 *   beside it was not drawn by. A variant with nothing to add gets the basis's paragraphs alone.
 */
export interface MethodNote {
  /** The box's own heading, in the basis's own terms. */
  readonly heading: string;
  /** The summary, one entry per paragraph, as plain text — never markup. */
  readonly paragraphs: readonly string[];
}

/** What is written for one basis: its shared rule, and what each of its variants adds to it. */
export interface BasisMethod {
  readonly heading: string;
  /** The rule the whole basis is argued on — printed under every one of its variants. */
  readonly shared: readonly string[];
  /**
   * One paragraph per variant, keyed by the variant's own id, appended after the shared rule. Partial
   * on purpose: a variant absent here is one with nothing of its own to say, not an error.
   */
  readonly variants?: Readonly<Record<string, string>>;
}

/**
 * The summaries, one per basis, and only where one has been written.
 *
 * A partial record on purpose: a missing basis is a basis whose summary has not been reviewed yet,
 * and it draws no box at all rather than a placeholder sentence.
 *
 * Exported for the suite, which holds every key in it against the committed bundle: a basis id or a
 * variant id written here that the bundle does not have is a summary describing a map nobody can
 * select, and a retired id is worse — it is a rule attached to a proposal this app has withdrawn.
 */
export const METHODS: Readonly<Partial<Record<BasisId, BasisMethod>>> = {
  language: {
    heading: 'How this map is built',
    shared: [
      'We divide Pakistan into units based on the language or dialect most commonly spoken at home ' +
        'in each district, using the 2023 census. Neighbouring districts where the same language or ' +
        'dialect is the majority are grouped into the same province. When the same language or ' +
        'dialect forms separate clusters, each becomes its own province rather than one province ' +
        'split into disconnected parts.',
    ],
    variants: {
      l1:
        'This map shows South Punjab as a separate province using the existing boundary of the ' +
        'South Punjab Secretariat, which already covers the divisions of Multan, Bahawalpur and ' +
        'Dera Ghazi Khan.',
      l2:
        'The PPP’s proposal keeps the same three divisions as the South Punjab Secretariat, while ' +
        'also including the districts of Mianwali and Bhakkar.',
      l3:
        'The Saraikistan proposal extends the PPP’s version by adding the Khyber Pakhtunkhwa ' +
        'districts of Dera Ismail Khan, Tank and Paharpur. It is the only proposal here that ' +
        'crosses a provincial boundary.',
      l4:
        'This map shows Hazara Division as a separate province. The proposal follows the division ' +
        'exactly as it exists today, without changing its boundaries.',
      l5:
        'This map shows Karachi Division as a separate province. Although some versions of the ' +
        'claim extend further into urban Sindh, Karachi Division is the only part with clearly ' +
        'defined district boundaries.',
      l6:
        'This map shows a province formed from the Pushto-speaking districts of Balochistan, ' +
        'identified using the 2023 census.',
      l7:
        'This map extends the same idea across the whole country, grouping neighbouring districts ' +
        'where the same language or dialect is spoken by most households.',
    },
  },
  administrative: {
    heading: 'How this map is built',
    shared: [
      'We divide each of Pakistan’s five provinces into administrative units centred on major ' +
        'administrative cities. Headquarters are chosen from cities scoring at least 50% on our ' +
        'development measure, based on literacy, access to safe drinking water and sanitation.',
      'Each unit grows to nearby districts until it reaches 25 million people or 300 km from its ' +
        'headquarters, creating 19 administrative units across the five provinces.',
    ],
  },
  development: {
    heading: 'How this map is built',
    shared: [
      'We divide Pakistan into provinces based on levels of development, measured using literacy, ' +
        'access to safe drinking water and sanitation from the 2023 census. This brings together ' +
        'neighbouring districts with similar development levels, allowing less-developed regions to ' +
        'form provinces in their own right.',
    ],
  },
};

/**
 * The note for a selection, or nothing at all where none is written.
 *
 * `null` at the baseline: the current map is not built by a rule of ours — it is the official
 * geography, which is what the colophon and the `official` badge already say.
 */
export function methodNote(active: Selection): MethodNote | null {
  if (active === null) return null;
  const method = METHODS[active.basis];
  if (method === undefined) return null;
  const own = method.variants?.[active.variant];
  return {
    heading: method.heading,
    paragraphs: own === undefined ? method.shared : [...method.shared, own],
  };
}
