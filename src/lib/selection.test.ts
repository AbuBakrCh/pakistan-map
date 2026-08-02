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
const SHADEABLE = new Set<BasisId>(['language']);
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

  it('makes the language basis selectable, on the one variant that is written', () => {
    const language = choices.find((c) => c.basis.id === 'language');
    expect(language?.available).toBe(true);
    expect(language?.unavailable).toBeNull();
    expect(language?.variants.map((v) => v.id)).toEqual(['l1']);
    expect(language?.variants[0]?.tagline).toBe('the version that partly exists');
  });

  it('refuses the other three and says which half of them is missing', () => {
    // "Coming soon" is the one answer that tells a reader nothing. Both halves are real and
    // separate: the development tables are joined and unshaded, and no variant is written for
    // any of the three — so a reason naming only one of them would be half true.
    const refused = choices.filter((c) => !c.available);
    expect(refused.map((c) => c.basis.id)).toEqual(['administrative', 'historical', 'development']);
    for (const choice of refused) {
      expect(choice.unavailable).toContain(choice.basis.name);
      expect(choice.missing).toEqual(['no variant is written yet', 'no shading is built yet']);
    }
  });

  it('prints the refusal on screen, grouped by reason and naming every basis it applies to', () => {
    // On screen and not only in a `title`: a `title` needs a hovering mouse, a disabled control
    // takes no tap, and the hard bar is a 390px phone. Grouped, because three bases short of the
    // same two things are one sentence, not three.
    expect(refusalLines(choices)).toEqual([
      'Administrative, Historical and Development are not selectable yet — no variant is ' +
        'written yet, and no shading is built yet.',
    ]);
  });

  it('says "is" of a single refused basis, and nothing at all when none is refused', () => {
    const oneShort = basisChoices(bundle, new Set<BasisId>(['administrative']));
    expect(refusalLines(oneShort)).toContain(
      'Language / dialect is not selectable yet — no shading is built yet.',
    );
    expect(refusalLines(choices.filter((c) => c.available))).toEqual([]);
  });

  it('would still refuse a basis whose variants exist but whose shading does not', () => {
    // The case that will actually arrive: a variant lands on a basis before the fill does. It
    // must not be selectable, because a basis that fades the boundaries back and shades nothing
    // is a proposal drawn against no evidence at all (D14).
    const unshaded = basisChoices(bundle, new Set<BasisId>());
    const language = unshaded.find((c) => c.basis.id === 'language');
    expect(language?.available).toBe(false);
    expect(language?.variants).toHaveLength(1);
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
    // Louder than a silent baseline, which would look like a dead control.
    expect(() => selectBasis(choices, 'historical')).toThrow(/historical cannot be selected/);
    expect(() => selectBasis(choices, 'historical')).toThrow(/no variant is written/);
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
