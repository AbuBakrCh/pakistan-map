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
  offeredBases,
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

  it('withholds Historical from the menu, and keeps it in the bundle it was withheld from', () => {
    // The one basis this build does not offer. Hiding it is a decision about the menu and about
    // nothing else: the variants are still written, still under their basis here, and still on the
    // audit panel — so a reader who follows an old link or reads `about.ts` finds the basis
    // accounted for rather than vanished.
    const historical = choices.find((c) => c.basis.id === 'historical');
    expect(historical?.hidden).toBe(true);
    expect(historical?.available).toBe(false);
    expect(historical?.variants.map((v) => v.id)).toEqual(['h1', 'h2', 'h3', 'h4']);
    // What it is short of stays on the record. The withholding is not a claim about the data, so
    // hiding a basis must not quietly erase the reason it could not be drawn either.
    expect(historical?.missing).toEqual(['no shading is built yet']);
    expect(historical?.unavailable).toBe('Historical: not offered in this build.');

    expect(offeredBases(choices).map((c) => c.basis.id)).toEqual([
      'language',
      'administrative',
      'development',
    ]);
    expect(offeredBases(choices).every((c) => c.available)).toBe(true);
  });

  it('prints no refusal line at all, since every basis on the strip can be pressed', () => {
    // A refusal line exists to say why a dimmed chip is dimmed, and the only basis that had one is
    // now off the strip entirely. Advertising the withholding here would put the gap in the one
    // place a reader can do nothing about it.
    expect(refusalLines(choices)).toEqual([]);
    expect(choices.filter((c) => !c.available && !c.hidden)).toEqual([]);
  });

  it('says "are" of several refused bases, and nothing at all when none is refused', () => {
    // Held on a stub, since no shipped basis is refused on screen any more: the sentence still has
    // to agree with itself in number, and Historical is excluded from it by being hidden rather
    // than by being drawable — which is exactly the confusion this test now guards.
    const pair = basisChoices(bundle, new Set<BasisId>(['development']));
    expect(refusalLines(pair)).toEqual([
      'Language / dialect and Administrative are not selectable yet — no shading is built yet.',
    ]);
    expect(refusalLines(choices.filter((c) => c.available))).toEqual([]);
  });

  it('refuses a basis whose variants exist but whose shading does not', () => {
    // The rule Historical used to be the live case of, and it is held over an offered basis rather
    // than a hidden one so that it keeps testing the shading and not the withholding: a basis that
    // fades the boundaries back and shades nothing is a proposal drawn against no evidence at all
    // (D14), whether or not this build happens to offer it.
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
    const unshadedLanguage = basisChoices(bundle, new Set<BasisId>());
    expect(() => selectBasis(unshadedLanguage, 'language')).toThrow(/language cannot be selected/);
    expect(() => selectBasis(unshadedLanguage, 'language')).toThrow(/no shading is built/);

    const unwritten = basisChoices(
      { ...bundle, variants: bundle.variants.filter((v) => v.basis !== 'development') },
      SHADEABLE,
    );
    expect(() => selectBasis(unwritten, 'development')).toThrow(/development cannot be selected/);
    expect(() => selectBasis(unwritten, 'development')).toThrow(/no variant is written/);
  });

  it('refuses a withheld basis by name rather than answering with a baseline', () => {
    // The panel gives it no chip and `readRoute` gives it no route, so arriving here means a
    // caller went round both. A silent baseline would hide that — and would look, from the
    // outside, exactly like a basis that had been drawn and found empty.
    expect(() => selectBasis(choices, 'historical')).toThrow(/historical cannot be selected/);
    expect(() => selectBasis(choices, 'historical')).toThrow(/not offered in this build/);
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
