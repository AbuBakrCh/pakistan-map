/**
 * What may be selected, and what the map says it is showing (#18).
 *
 * Run against the committed scenario bundle, like everything else in this suite: the answer to
 * "which bases can be chosen today" is a property of the artifact plus this build's renderer, and
 * a test that stubbed either would assert only that the code agrees with itself.
 */

import { describe, expect, it } from 'vitest';
import scenarios from '../../data/bundle/scenarios.json';
import type { BasisId, ScenarioBundle } from '../bundle.ts';
import {
  BASELINE,
  BASIS_ORDER,
  basisChoices,
  mapDescription,
  refusalLines,
  selectBasis,
  selectVariant,
  variantOf,
} from './selection.ts';

const bundle = scenarios as unknown as ScenarioBundle;
/** What this build can actually shade. `main.ts` derives the same set from its fill table. */
const SHADEABLE = new Set<BasisId>(['language', 'administrative', 'development']);
const choices = basisChoices(bundle, SHADEABLE);

describe('basisChoices', () => {
  it('offers all four bases, in the order the spec sets them out', () => {
    // Not the artifact's key order, which is incidental to how the JSON was written.
    expect(choices.map((c) => c.basis.id)).toEqual([...BASIS_ORDER]);
    expect(choices).toHaveLength(4);
  });

  it('carries each basis with the source it is argued from, for the control to show', () => {
    const language = choices.find((c) => c.basis.id === 'language');
    expect(language?.basis.source).toBe('PBS 2023 Census Table 11 — mother tongue by district');
    expect(language?.basis.badges).toContain('proxy');
  });

  it('makes the language basis selectable, on the variants that are written', () => {
    const language = choices.find((c) => c.basis.id === 'language');
    expect(language?.available).toBe(true);
    expect(language?.unavailable).toBeNull();
    // The order the selector offers them in, which is the order they are written in the module: a
    // reader entering the basis lands on the first (D13), and the three southern readings sit
    // together and widest-last so that walking down the group walks outward from one claim.
    expect(language?.variants.map((v) => v.id)).toEqual([
      'l1',
      'l2',
      'l3',
      'l4',
      'l5',
      'l6',
      'l7',
    ]);
    expect(language?.variants[0]?.tagline).toBe('the secretariat’s existing boundary, drawn as a province');
  });

  it('makes the development basis selectable, on the one variant and the composite behind it', () => {
    // #31 closed both halves at once: D1 is written and dissolved, and the composite it is cut at
    // is also what shades the districts under it. It was the one basis short of both, and it is
    // now the second of the four that can be drawn at all.
    const development = choices.find((c) => c.basis.id === 'development');
    expect(development?.available).toBe(true);
    expect(development?.missing).toEqual([]);
    expect(development?.variants.map((v) => v.id)).toEqual(['d1']);
    // Two badges, because the shading is two claims at once: PBS's three rates, and this
    // project's own mean of them.
    expect(development?.basis.badges).toEqual(['census', 'synthesized']);
  });

  it('makes the administrative basis selectable, on the population its own rules are drawn from', () => {
    // The third of the four to open, and the one whose fill needed no new artifact: A6 is a
    // partition bounded by the 2023 census population, and the shading is that same published
    // figure banded — so the boundary is drawn over the quantity it was cut at.
    const administrative = choices.find((c) => c.basis.id === 'administrative');
    expect(administrative?.available).toBe(true);
    expect(administrative?.missing).toEqual([]);
    // One variant: the basis's second — a constitutional regularisation that moved no district —
    // has been retired, and a basis is offered on the variants it has rather than on a count.
    expect(administrative?.variants.map((v) => v.id)).toEqual(['a6']);
    // `census` for the figure and `derived` for the geometry — the fill answers to the first of
    // the two, and nothing about the shading is this project's own number.
    expect(administrative?.basis.badges).toEqual(['census', 'derived']);
  });

  it('refuses the one that is left, and says which half of it is missing', () => {
    // "Coming soon" is the one answer that tells a reader nothing. Historical has its four
    // variants written and no fill behind them, which is a different refusal from the one
    // Development and Administrative used to get, and the control says which applies.
    const refused = choices.filter((c) => !c.available);
    expect(refused.map((c) => c.basis.id)).toEqual(['historical']);
    for (const choice of refused) expect(choice.unavailable).toContain(choice.basis.name);

    const missing = Object.fromEntries(refused.map((c) => [c.basis.id, c.missing]));
    expect(missing['historical']).toEqual(['no shading is built yet']);
  });

  it('prints the refusal on screen, grouped by reason and naming every basis it applies to', () => {
    // On screen and not only in a `title`: a `title` needs a hovering mouse, a disabled control
    // takes no tap, and the hard bar is a 390px phone. Grouped by what is actually missing, so
    // Historical — which is only short of its fill — is not filed under a sentence saying nobody
    // has written its variants.
    expect(refusalLines(choices)).toEqual([
      'Historical is not selectable yet — no shading is built yet.',
    ]);
  });

  it('says "are" of several refused bases, and nothing at all when none is refused', () => {
    // Held on a stubbed pair rather than on the shipped one, since the shipped refusal is now a
    // single basis: the sentence still has to agree with itself in number, and the plural case is
    // the one the app has just left rather than one it can no longer reach.
    const pair = basisChoices(bundle, new Set<BasisId>(['language', 'development']));
    expect(refusalLines(pair)).toEqual([
      'Administrative and Historical are not selectable yet — no shading is built yet.',
    ]);
    expect(refusalLines(choices.filter((c) => c.available))).toEqual([]);
  });

  it('refuses a basis whose variants exist but whose shading does not', () => {
    // No longer hypothetical: Historical carries the whole basis now — H1 to H4, four complete
    // partitions the build has already dissolved, and there is no fill behind them. It must not be
    // selectable, because a basis that fades the boundaries back and shades nothing is a proposal
    // drawn against no evidence at all (D14). The order is the module's own: H1 stays first, so a
    // reader entering the basis lands on One Unit rather than on the 1947 states (D13).
    const historical = choices.find((c) => c.basis.id === 'historical');
    expect(historical?.available).toBe(false);
    expect(historical?.variants.map((v) => v.id)).toEqual(['h1', 'h2', 'h3', 'h4']);
    expect(historical?.unavailable).toBe('Historical: no shading is built yet.');

    const unshaded = basisChoices(bundle, new Set<BasisId>());
    const language = unshaded.find((c) => c.basis.id === 'language');
    expect(language?.available).toBe(false);
    // What is missing is the fill, not the proposals: the refusal drops no variant, and saying so
    // against the shaded list rather than against a number keeps this test about that.
    expect(language?.variants.map((v) => v.id)).toEqual(
      choices.find((c) => c.basis.id === 'language')?.variants.map((v) => v.id),
    );
    expect(language?.unavailable).toBe('Language / dialect: no shading is built yet.');
  });

  it('places every variant in the bundle under exactly one basis', () => {
    const placed = choices.flatMap((c) => c.variants.map((v) => v.id)).sort();
    expect(placed).toEqual(bundle.variants.map((v) => v.id).sort());
    expect(new Set(placed).size).toBe(placed.length);
  });
});

describe('selectBasis', () => {
  it('enters a basis on its first variant, because a basis is never active alone', () => {
    expect(selectBasis(choices, 'language')).toEqual({ basis: 'language', variant: 'l1' });
  });

  it('refuses a basis with nothing to draw, naming it and saying why', () => {
    // Louder than a silent baseline, which would look like a dead control. Both refusals are held
    // — the shipped one, where the variants exist and the fill does not, and the other half, which
    // no basis is in today and which a new basis with no variants written would be.
    expect(() => selectBasis(choices, 'historical')).toThrow(/historical cannot be selected/);
    expect(() => selectBasis(choices, 'historical')).toThrow(/no shading is built/);

    const unwritten = basisChoices(
      { ...bundle, variants: bundle.variants.filter((v) => v.basis !== 'development') },
      SHADEABLE,
    );
    expect(() => selectBasis(unwritten, 'development')).toThrow(/development cannot be selected/);
    expect(() => selectBasis(unwritten, 'development')).toThrow(/no variant is written/);
  });
});

describe('selectVariant', () => {
  it('takes the basis from the variant rather than from the caller', () => {
    // The two cannot disagree: a variant shown under the wrong basis would be shaded against
    // evidence that is not the evidence it was argued from.
    expect(selectVariant(bundle, 'l1')).toEqual({ basis: 'language', variant: 'l1' });
  });

  it('throws on a variant the bundle has never heard of', () => {
    expect(() => selectVariant(bundle, 'l9')).toThrow(/l9 is not a variant/);
  });
});

describe('variantOf', () => {
  it('is null at the baseline, which is the absence of a selection', () => {
    expect(variantOf(bundle, BASELINE)).toBeNull();
  });

  it('resolves the selection to the variant the map draws', () => {
    expect(variantOf(bundle, { basis: 'language', variant: 'l1' })?.name).toBe(
      'South Punjab Secretariat',
    );
  });

  it('throws rather than falling back to the baseline for a selection naming nothing', () => {
    // A baseline drawn under a selection that claims a proposal is a map lying about itself.
    expect(() => variantOf(bundle, { basis: 'language', variant: 'nope' })).toThrow(
      /nope is selected/,
    );
  });
});

describe('mapDescription', () => {
  it('describes the baseline as the current map', () => {
    expect(mapDescription(bundle, BASELINE)).toBe(
      'Map of Pakistan showing current provinces, territories and divisions',
    );
  });

  it('names the proposal as a proposal, and says what it is drawn over', () => {
    // `role="img"` hides every shape, so this sentence is the whole of what the map says about
    // itself. A reader told only "units" would have no way to know these boundaries are not
    // the country's.
    const spoken = mapDescription(bundle, { basis: 'language', variant: 'l1' });
    expect(spoken).toContain('South Punjab Secretariat');
    expect(spoken).toContain('South Punjab — proposed, not official');
    expect(spoken).toContain('language / dialect');
    expect(spoken).toContain('faded');
    expect(spoken).toContain('8 units');
  });
});
