/**
 * The partition validator, exercised on hand-built variants rather than on the real content.
 *
 * The committed scenarios are checked in `bundle.test.ts`, against the artifact that ships. What
 * cannot be checked there is the *failure* behaviour: the real variants are valid, so nothing in
 * the bundle demonstrates that an invalid one would be caught, or that the message names the
 * district and both units rather than reporting a count. Those are the assertions here, and they
 * need variants that are deliberately wrong — which the bundle, by construction, never contains.
 */

import { describe, expect, it } from 'vitest';
import { CENSUS_DISTRICTS, ROSTER } from './roster.ts';
import {
  intactProvince,
  remainderOf,
  universeDistricts,
  validateScenarios,
  validateVariant,
  type Unit,
  type Variant,
} from './scenarios.ts';

/** A minimal but complete variant: one proposed unit, everything else left as it is. */
function variantOf(units: readonly Unit[], overrides: Partial<Variant> = {}): Variant {
  return {
    id: 'test',
    basis: 'language',
    name: 'Test variant',
    rationale: 'A variant that exists to be validated.',
    status: 'Fictional. Nobody proposes this.',
    advocacy: { kind: 'advocated', by: ['A test'] },
    opposedBy: ['Another test'],
    universe: 'drawn',
    composition: { kind: 'transcribed', from: 'this test file' },
    footnotes: [],
    sources: [{ label: 'scripts/lib/scenarios.test.ts' }],
    units: units as Variant['units'],
    ...overrides,
  };
}

/** Every drawn district except the ones a test's proposed unit takes. */
function everythingElse(taken: readonly string[]): Unit[] {
  return ROSTER.map((province) => intactProvince(province.name, taken));
}

const southPunjab: Unit = {
  id: 'south-punjab',
  name: 'South Punjab',
  kind: 'proposed',
  claims: ['Multan', 'Lodhran'],
};

describe('partition validation', () => {
  it('accepts a variant that covers every drawn district exactly once', () => {
    const result = validateVariant(
      variantOf([southPunjab, ...everythingElse(['Multan', 'Lodhran'])]),
    );
    expect(result.problems).toEqual([]);
    expect(result.partition?.districts).toBe(universeDistricts('drawn').length);
  });

  it('names a district that no unit claims, rather than reporting how many are missing', () => {
    const { problems } = validateVariant(
      variantOf([southPunjab, ...everythingElse(['Multan', 'Lodhran', 'Vehari'])]),
    );
    expect(problems.join('\n')).toMatch(/Vehari/);
    // The point of naming it: the count alone leaves the reader to diff 156 names by hand.
    expect(problems.join('\n')).not.toMatch(/^1 district\(s\) uncovered$/);
  });

  it('names the district and both units when two units claim the same ground', () => {
    const rival: Unit = {
      id: 'rival',
      name: 'Rival province',
      kind: 'proposed',
      claims: ['Lodhran'],
    };
    const { problems } = validateVariant(
      variantOf([southPunjab, rival, ...everythingElse(['Multan', 'Lodhran'])]),
    );
    const message = problems.join('\n');
    expect(message).toMatch(/Lodhran/);
    expect(message).toMatch(/South Punjab/);
    expect(message).toMatch(/Rival province/);
  });

  it('names a claimed district that is not a district at all', () => {
    const invented: Unit = {
      id: 'invented',
      name: 'Invented province',
      kind: 'proposed',
      claims: ['Saraikistan'],
    };
    const { problems } = validateVariant(variantOf([invented, ...everythingElse([])]));
    expect(problems.join('\n')).toMatch(/Saraikistan/);
    expect(problems.join('\n')).toMatch(/Invented province/);
  });

  it('resolves a post-census district onto the 2023 district that carries it', () => {
    // Advocates state South Punjab as 13 districts; two of them — Taunsa and Kot Addu — were
    // carved out in 2022 and have no census row, so ADR-0001 draws them inside their parents.
    // The claim is recorded as its advocates state it and resolved to what the map can draw.
    const claimed: Unit = {
      id: 'south-punjab',
      name: 'South Punjab',
      kind: 'proposed',
      claims: ['Dera Ghazi Khan', 'Taunsa', 'Muzaffargarh', 'Kot Addu'],
    };
    const result = validateVariant(
      variantOf([claimed, ...everythingElse(['Dera Ghazi Khan', 'Muzaffargarh'])]),
    );
    expect(result.problems).toEqual([]);
    const unit = result.partition?.units[0];
    expect(unit?.claimed).toHaveLength(4);
    expect(unit?.districts).toEqual(['Dera Ghazi Khan', 'Muzaffargarh']);
    expect(unit?.folded).toEqual([
      { from: 'Taunsa', into: 'Dera Ghazi Khan' },
      { from: 'Kot Addu', into: 'Muzaffargarh' },
    ]);
  });

  it('refuses the same district named twice inside one unit', () => {
    const doubled: Unit = {
      id: 'doubled',
      name: 'Doubled province',
      kind: 'proposed',
      claims: ['Multan', 'Multan'],
    };
    const { problems } = validateVariant(variantOf([doubled, ...everythingElse(['Multan'])]));
    expect(problems.join('\n')).toMatch(/Multan/);
    expect(problems.join('\n')).toMatch(/twice/);
  });

  it('refuses a unit whose own exclusion list contradicts its claim', () => {
    // L3 excludes the Waziristans explicitly. An exclusion that is also claimed is the card
    // saying one thing and the map drawing another.
    const contradictory: Unit = {
      id: 'contradictory',
      name: 'Contradictory province',
      kind: 'proposed',
      claims: ['Tank', 'Dera Ismail Khan'],
      excludes: ['Tank'],
    };
    const { problems } = validateVariant(
      variantOf([contradictory, ...everythingElse(['Tank', 'Dera Ismail Khan'])]),
    );
    expect(problems.join('\n')).toMatch(/Tank/);
    expect(problems.join('\n')).toMatch(/excludes/);
  });

  it('resolves two halves of one district to a single exclusion, and still catches a paste', () => {
    // L3's real case: the claim excludes Upper and Lower South Waziristan, which is how the two
    // districts are named today, and both fold onto the one district the census counted. The
    // resolved list says South Waziristan once — twice would read as two exclusions.
    const halves: Unit = {
      id: 'excluding-both-halves',
      name: 'Excluding province',
      kind: 'proposed',
      claims: ['Dera Ismail Khan'],
      excludes: ['Upper South Waziristan', 'Lower South Waziristan'],
    };
    const { partition, problems } = validateVariant(
      variantOf([halves, ...everythingElse(['Dera Ismail Khan'])]),
    );
    expect(problems).toEqual([]);
    expect(partition?.units.find((u) => u.id === 'excluding-both-halves')?.excludes).toEqual([
      'South Waziristan',
    ]);

    // Deduplicating a fold is not the same as tolerating a repeat. The same name twice is a
    // paste, and it is reported — otherwise the dedup above would hide it.
    const pasted: Unit = {
      ...halves,
      id: 'pasted',
      excludes: ['Upper South Waziristan', 'Upper South Waziristan'],
    };
    const repeated = validateVariant(variantOf([pasted, ...everythingElse(['Dera Ismail Khan'])]));
    expect(repeated.problems.join('\n')).toMatch(/Upper South Waziristan/);
    expect(repeated.problems.join('\n')).toMatch(/twice/);
  });

  it('names an exclusion that is not a district, so a typo cannot look deliberate', () => {
    const unit: Unit = {
      id: 'excluding',
      name: 'Excluding province',
      kind: 'proposed',
      claims: ['Dera Ismail Khan'],
      excludes: ['South Waziristan Agency Lower'],
    };
    const { problems } = validateVariant(
      variantOf([unit, ...everythingElse(['Dera Ismail Khan'])]),
    );
    expect(problems.join('\n')).toMatch(/South Waziristan Agency Lower/);
  });
});

describe('which district set a partition must cover', () => {
  it('holds a drawn-set variant to all 156 districts, AJK and GB included', () => {
    expect(universeDistricts('drawn')).toHaveLength(156);
    // Dropping the two territory units leaves twenty districts uncovered, and says which.
    const units = everythingElse([]).filter((u) => u.kind !== 'territory');
    const { problems } = validateVariant(variantOf(units));
    expect(problems.join('\n')).toMatch(/Muzaffarabad/);
    expect(problems.join('\n')).toMatch(/Skardu/);
  });

  it('holds a census-set variant to the 136 districts that carry statistics', () => {
    expect(universeDistricts('census')).toEqual(CENSUS_DISTRICTS);
    const units = everythingElse([]).filter((u) => u.kind !== 'territory');
    const { problems } = validateVariant(variantOf(units, { universe: 'census' }));
    expect(problems).toEqual([]);
  });

  it('refuses a census-set variant that reaches into a district it does not cover', () => {
    // Not a gap but its opposite: territory claimed from outside the set being partitioned.
    // Silently tolerating it would let a variant half-cover AJK — drawn, unshaded, and inside
    // a proposed province in one place and not in another.
    const overreaching: Unit = {
      id: 'overreaching',
      name: 'Overreaching province',
      kind: 'proposed',
      claims: ['Multan', 'Mirpur'],
    };
    const units = [
      overreaching,
      ...everythingElse(['Multan']).filter((u) => u.kind !== 'territory'),
    ];
    const { problems } = validateVariant(variantOf(units, { universe: 'census' }));
    expect(problems.join('\n')).toMatch(/Mirpur/);
    expect(problems.join('\n')).toMatch(/Azad Jammu & Kashmir/);
  });
});

describe('whether a variant may claim AJK or Gilgit-Baltistan territory', () => {
  // CLAUDE.md open item 2b, undecided as a *product* question: L2 and H2 reference AJK
  // districts, which are drawn but carry no PBS statistics. Both answers are expressible; the
  // default is the conservative one, and it fails loudly rather than quietly redrawing a
  // ceasefire line. These two tests are the record of that, so whichever way the decision goes
  // arrives as a changed constant and a changed test, not as a discovery.
  const claimsAjk: Unit = {
    id: 'greater-kashmir',
    name: 'Greater Kashmir',
    kind: 'proposed',
    claims: ['Mirpur', 'Bhimber'],
  };
  const units = [
    claimsAjk,
    ...everythingElse([]).filter((u) => u.id !== 'azad-jammu-kashmir'),
    {
      id: 'azad-jammu-kashmir',
      name: 'Azad Jammu & Kashmir',
      kind: 'territory' as const,
      claims: remainderOf('Azad Jammu & Kashmir', ['Mirpur', 'Bhimber']),
    },
  ];

  it('refuses by default, naming the district and the unit that took it', () => {
    const { problems } = validateVariant(variantOf(units));
    expect(problems.join('\n')).toMatch(/Mirpur/);
    expect(problems.join('\n')).toMatch(/Greater Kashmir/);
    expect(problems.join('\n')).toMatch(/Azad Jammu & Kashmir/);
  });

  it('permits it under the opposite policy, so the decision is a setting and not a rewrite', () => {
    const { problems } = validateVariant(variantOf(units), { territoryClaims: 'allow' });
    expect(problems).toEqual([]);
  });

  it('always lets a territory stay itself, under either policy', () => {
    expect(validateVariant(variantOf(everythingElse([]))).problems).toEqual([]);
  });
});

describe('a territory promoted, which is a change of standing and not a claim (#28, A5)', () => {
  /** Gilgit-Baltistan as a province: the same ten districts, the same name, `proposed`. */
  const promotion = (overrides: Partial<Unit> = {}): Unit => ({
    id: 'gilgit-baltistan',
    name: 'Gilgit-Baltistan',
    kind: 'proposed',
    claims: remainderOf('Gilgit-Baltistan'),
    ...overrides,
  });

  const around = (unit: Unit): Unit[] => [
    unit,
    ...everythingElse([]).filter((u) => u.id !== 'gilgit-baltistan'),
  ];

  it('is admitted under `forbid`, because no ground changes hands and nothing is short', () => {
    // The reason 2b answers `forbid` is that a unit holding *some* uncounted districts has a
    // population short by an unknowable amount. A unit that is one whole territory has no such
    // population: it has none at all, which `scorecard.ts` sets aside by name. So the refusal
    // does not reach it, and A5 draws GB and AJK as provinces without the policy moving.
    const { partition, problems } = validateVariant(variantOf(around(promotion())));
    expect(problems).toEqual([]);
    expect(partition?.units.find((u) => u.id === 'gilgit-baltistan')?.districts).toHaveLength(10);
  });

  it('still refuses a unit that takes only part of a territory, naming the district', () => {
    // The case 2b is actually about, and the one the carve-out must not let through: nine of ten
    // is reaching in, and the tenth district is left to some other unit.
    const partial = promotion({
      id: 'nearly',
      name: 'Gilgit-Baltistan',
      claims: remainderOf('Gilgit-Baltistan', ['Skardu']),
    });
    const { problems } = validateVariant(
      variantOf([
        partial,
        {
          id: 'skardu-remainder',
          name: 'Gilgit-Baltistan remainder',
          kind: 'territory',
          claims: ['Skardu'],
        },
        ...everythingElse([]).filter((u) => u.id !== 'gilgit-baltistan'),
      ]),
    );
    expect(problems.join('\n')).toMatch(/Astore|Ghanche|Ghizer|Gilgit/);
    expect(problems.join('\n')).toMatch(/open product decision/);
  });

  it('still refuses a whole territory taken together with ground the census does count', () => {
    // Ten uncounted districts plus one counted one is exactly the arithmetic 2b refuses: the
    // unit's population would be Chitral's and would read as the province's.
    const swollen = promotion({
      id: 'greater-gilgit',
      name: 'Gilgit-Baltistan',
      claims: [...remainderOf('Gilgit-Baltistan'), 'Upper Chitral'],
    });
    const { problems } = validateVariant(
      variantOf([swollen, ...everythingElse(['Upper Chitral']).filter((u) => u.id !== 'gilgit-baltistan')]),
    );
    expect(problems.join('\n')).toMatch(/a district of Gilgit-Baltistan/);
  });

  it('refuses a whole territory renamed, because the scorecard would report ten districts moved', () => {
    // The third condition, and the one that is easiest to think unnecessary. "Districts moved" is
    // decided on the unit's name, so a territory promoted *and* renamed reads as its whole ground
    // changing hands when none of it has. Refused rather than counted wrongly — a variant meaning
    // both has to say so.
    const renamed = promotion({ id: 'northern-province', name: 'Northern Province' });
    const { problems } = validateVariant(variantOf(around(renamed)));
    expect(problems.join('\n')).toMatch(/Northern Province/);
    expect(problems.join('\n')).toMatch(/a district of Gilgit-Baltistan/);
  });

  it('refuses a whole territory renamed by a suffix, which `normalizeName` would have let past', () => {
    // The same condition as above, at the one spelling that nearly slips through it. Every other
    // name join in this repo goes through `normalizeName`, which strips `District`/`Division` as
    // noise; here the suffix is the rename. "Gilgit-Baltistan Division" is not the territory's own
    // name — it is a first-level entity restyled as a second-level one — and the scorecard would
    // report ten districts moved. So the comparison is exact, and this is the test that says so.
    const suffixed = promotion({ id: 'gb-division', name: 'Gilgit-Baltistan Division' });
    const { problems } = validateVariant(variantOf(around(suffixed)));
    expect(problems.join('\n')).toMatch(/Gilgit-Baltistan Division/);
    expect(problems.join('\n')).toMatch(/a district of Gilgit-Baltistan/);
  });

  it('refuses a whole territory held as `unchanged`, since a promotion is a proposal', () => {
    // The carve-out is for the variant that argues the standing should change; a unit holding the
    // same ground under the same name while claiming nothing about it is the current map, and
    // `intactProvince` already writes that unit as a `territory` so nothing calls it a province by
    // accident. Admitting `unchanged` here would let a variant take the ground and say nothing.
    const unchanged = promotion({ kind: 'unchanged' });
    const { problems } = validateVariant(variantOf(around(unchanged)));
    expect(problems.join('\n')).toMatch(/Gilgit-Baltistan/);
    expect(problems.join('\n')).toMatch(/a district of Gilgit-Baltistan/);
  });
});

describe('the fields a variant card renders', () => {
  it('refuses a variant with no opposition line', () => {
    // Also refused by the type — `opposedBy` is a non-empty tuple — but a JSON edit or a cast
    // gets past the type, and a card with no "Opposed by" reads as the app advocating.
    const { problems } = validateVariant(
      variantOf(everythingElse([]), { opposedBy: [] as unknown as Variant['opposedBy'] }),
    );
    expect(problems.join('\n')).toMatch(/Opposed by/i);
  });

  it('accepts a variant nobody advocates, provided it says so', () => {
    // L7 and D1 apply a rule to census data; they have no advocate, and inventing one would be
    // attributing someone's politics to an algorithm.
    const { problems } = validateVariant(
      variantOf(everythingElse([]), {
        advocacy: { kind: 'unadvocated', note: 'A rule applied to census data, not a proposal.' },
      }),
    );
    expect(problems).toEqual([]);
  });

  it('refuses a suppression of modern figures that gives no reason', () => {
    // H2 draws 1947 boundaries and must carry no 2023 population. The reason is card copy.
    const { problems } = validateVariant(
      variantOf(everythingElse([]), {
        statistics: { modernFigures: false, reason: '' },
      }),
    );
    expect(problems.join('\n')).toMatch(/reason/i);
  });

  it('refuses a note pointing at a variant that does not exist', () => {
    const variants = [
      variantOf(everythingElse([]), {
        notes: [{ label: 'Collision', text: 'Rejects being folded in.', relatedVariants: ['h4'] }],
      }),
    ];
    expect(validateScenarios(variants).problems.join('\n')).toMatch(/h4/);
  });
});

describe('scenario set', () => {
  it('refuses two variants sharing an id, since the deep link would be ambiguous', () => {
    const variants = [variantOf(everythingElse([])), variantOf(everythingElse([]))];
    expect(validateScenarios(variants).problems.join('\n')).toMatch(/test/);
  });

  it('refuses two units inside one variant sharing an id', () => {
    const twin: Unit = { id: 'punjab', name: 'Twin', kind: 'proposed', claims: ['Multan'] };
    const { problems } = validateVariant(variantOf([twin, ...everythingElse(['Multan'])]));
    expect(problems.join('\n')).toMatch(/punjab/);
  });

  it('reports every problem it finds, not only the first', () => {
    const broken: Unit = {
      id: 'broken',
      name: 'Broken province',
      kind: 'proposed',
      claims: ['Nowhere', 'Elsewhere'],
    };
    const { problems } = validateVariant(variantOf([broken, ...everythingElse([])]));
    expect(problems.join('\n')).toMatch(/Nowhere/);
    expect(problems.join('\n')).toMatch(/Elsewhere/);
  });
});
