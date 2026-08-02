/**
 * The provenance assertions (#21) — the editorial rules, turned into things the build enforces.
 *
 * Everything held here was, until this file existed, a rule a maintainer had to remember: that a
 * basis carries a source and a date as well as a badge, that a badge comes only from the closed
 * vocabulary, that a boundary this build *computed* says so where it is drawn, and that there is
 * exactly one vintage on this map. The first three are content mistakes a reviewer would have to
 * catch by eye across seventeen variants; the fourth is ADR-0001, which is the difference between
 * a district drawn and counted as the same district and a district drawn at one date and counted
 * at another.
 *
 * Two halves, deliberately. The **source of truth** is `BASES` and `VARIANTS`, and that is where a
 * mistake is made and where a message has to name it — so the checks run there, on the modules a
 * content diff actually touches. The **committed bundle** is checked separately and more loosely,
 * because it is the artifact that ships and may have been baked before a schema field existed: it
 * is held to carrying what it carries, not to carrying what today's source module would emit.
 *
 * `bundle.test.ts` already holds the badge vocabulary, the non-empty "Opposed by" line and the
 * advocacy shape over the shipped variants. Those are not repeated. What is added is what was
 * missing: vintage as a field of its own, the four bases held to the same rule as the variants,
 * the derived-boundary rule, and the failure messages for each.
 */

import { describe, expect, it } from 'vitest';
import geography from '../../data/bundle/geography.topojson.json';
import statistics from '../../data/bundle/statistics.json';
import scenarios from '../../data/bundle/scenarios.json';
import outlines from '../../data/bundle/unit-outlines.json';
import adjacency from '../../data/bundle/adjacency.json';
import {
  BASES,
  DATA_VINTAGE,
  PROVENANCE_BADGES,
  badgesOf,
  intactProvince,
  validateBases,
  validateVariant,
  vintageOf,
  type Basis,
  type BasisId,
  type ProvenanceBadge,
  type Unit,
  type Variant,
} from './scenarios.ts';
import { ROSTER } from './roster.ts';
import { districtCentroids } from './centroids.ts';
import { dominantTongues, variantsFrom } from './variants.ts';

/**
 * The variants, derived the same way the build derives them (#26).
 *
 * Two of the ten have no published district list and are computed from the census and the district
 * borders, so the scenario module is a function of both and this test has to supply them. Both
 * come from the committed bundle this file already reads, which is the rule the whole suite
 * follows: what ships is what is asserted against.
 */
const districtStatistics = (
  statistics as { districts: Record<string, { population: number; motherTongue?: { dominant?: string | null } }> }
).districts;

const VARIANTS = variantsFrom({
  graph: new Map(Object.entries((adjacency as { neighbours: Record<string, string[]> }).neighbours)),
  dominant: dominantTongues({ districts: districtStatistics }),
  populations: new Map(
    Object.entries(districtStatistics).map(([district, record]) => [district, record.population]),
  ),
  centroids: districtCentroids(geography as never),
});

const basisEntries = Object.entries(BASES) as [BasisId, Basis][];

/** A complete, valid variant, so a test can break exactly one thing about it and nothing else. */
const southPunjab: Unit = {
  id: 'south-punjab',
  name: 'South Punjab',
  kind: 'proposed',
  claims: ['Multan', 'Lodhran'],
};

function variantOf(overrides: Partial<Variant> = {}): Variant {
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
    sources: [{ label: 'scripts/lib/provenance.test.ts' }],
    units: [
      southPunjab,
      ...ROSTER.map((province) => intactProvince(province.name, southPunjab.claims)),
    ] as Variant['units'],
    ...overrides,
  };
}

const problemsOf = (overrides: Partial<Variant>): string =>
  validateVariant(variantOf(overrides)).problems.join('\n');

describe('the four bases carry a badge, a source and a vintage', () => {
  it('gives every basis all three, naming any that is short of one', () => {
    // Named per basis and per field: "a basis is missing something" leaves a reviewer to open
    // four objects and diff them by eye, which is the work this assertion exists to do.
    const missing = basisEntries.flatMap(([id, basis]) =>
      [
        basis.name.trim() === '' ? `${id}: no name` : null,
        basis.source.trim() === '' ? `${id}: no source` : null,
        basis.vintage.trim() === '' ? `${id}: no vintage` : null,
        basis.badges.length === 0 ? `${id}: no badge` : null,
      ].filter((problem): problem is string => problem !== null),
    );
    expect(missing).toEqual([]);
    expect(basisEntries.length).toBe(4);
  });

  it('badges every basis from the closed vocabulary and nothing else', () => {
    const strange = basisEntries.flatMap(([id, basis]) =>
      basis.badges
        .filter((word) => !PROVENANCE_BADGES.includes(word))
        .map((word) => `${id}: ${word}`),
    );
    expect(strange).toEqual([]);
    // The vocabulary itself, so widening it is a diff here rather than a word that quietly works.
    expect([...PROVENANCE_BADGES]).toEqual([
      'official',
      'census',
      'proxy',
      'derived',
      'documented',
      'synthesized',
    ]);
  });

  it('pins every census-shaded basis to the one vintage, and lets the documented one differ', () => {
    // ADR-0001 as an assertion. A basis badged `census` shades from PBS 2023 and must say so in
    // those words; the Historical basis stands on dated documents instead, and its vintage is the
    // date of each — exempt by its badge rather than by its name, so a fifth basis is governed by
    // the same rule without anyone remembering to add it here.
    for (const [id, basis] of basisEntries) {
      if (basis.badges.includes('census')) {
        expect(basis.vintage, id).toBe(DATA_VINTAGE);
      } else {
        expect(basis.vintage, id).not.toBe('');
      }
    }
    expect(BASES.historical.vintage).not.toBe(DATA_VINTAGE);
    expect(BASES.historical.vintage).toMatch(/1947/);
  });

  it('names the basis and the missing field when one is short', () => {
    // The states the real four cannot demonstrate, since all four are complete.
    const broken = validateBases({
      ...BASES,
      language: { ...BASES.language, source: '' },
      development: { ...BASES.development, vintage: '' },
      administrative: { ...BASES.administrative, badges: ['plausible'] as never },
      historical: { ...BASES.historical, badges: ['census'], vintage: '1947' },
    }).join('\n');
    expect(broken).toMatch(/basis language.*source/);
    expect(broken).toMatch(/basis development.*vintage/);
    expect(broken).toMatch(/basis administrative.*plausible/);
    // A basis badged `census` at a vintage that is not the census's — the ADR-0001 failure, which
    // is the one that would otherwise be invisible: every field is filled and every word is legal.
    expect(broken).toMatch(/basis historical.*1947.*ADR-0001/s);
    expect(validateBases()).toEqual([]);
  });
});

describe('every variant carries a badge, a source and a vintage', () => {
  it('gives all three to every variant in the content module', () => {
    const missing = VARIANTS.flatMap((variant) =>
      [
        badgesOf(variant).length === 0 ? `${variant.id}: no badge` : null,
        variant.sources.length === 0 ? `${variant.id}: no source` : null,
        vintageOf(variant).vintage.trim() === '' ? `${variant.id}: no vintage` : null,
      ].filter((problem): problem is string => problem !== null),
    );
    expect(missing).toEqual([]);
    expect(VARIANTS.length).toBeGreaterThan(0);
  });

  it('badges every variant from the closed vocabulary, naming the variant and the word', () => {
    const strange = VARIANTS.flatMap((variant) =>
      badgesOf(variant)
        .filter((word) => !PROVENANCE_BADGES.includes(word))
        .map((word) => `${variant.id}: ${word}`),
    );
    expect(strange).toEqual([]);
    expect(problemsOf({ badges: ['plausible' as ProvenanceBadge] })).toMatch(/test.*plausible/s);
  });

  it('reads a variant at its own vintage where it has one, and says when it does not', () => {
    // The difference is the whole reason the resolution is reported rather than returned bare: a
    // variant with no date of its own is being read at its basis's, and a card that printed the
    // census's year against a 1947 boundary would badge a document with an arithmetic date.
    const own = vintageOf(variantOf({ vintage: 'The map of 14 August 1947' }));
    expect(own).toEqual({ vintage: 'The map of 14 August 1947', from: 'variant' });

    const inherited = vintageOf(variantOf());
    expect(inherited).toEqual({ vintage: BASES.language.vintage, from: 'basis' });
  });

  it('refuses a vintage that is asserted and blank, which is not the same as absent', () => {
    expect(problemsOf({ vintage: '   ' })).toMatch(/test.*vintage/s);
    expect(problemsOf({})).not.toMatch(/vintage/);
  });

  it('pins a census-badged variant to the one vintage', () => {
    // The same rule the bases are held to, one tier down: a variant reading published census
    // figures reads *this* census, whatever date it puts on itself.
    expect(problemsOf({ badges: ['census'], vintage: '1998 census' })).toMatch(
      /test.*1998 census.*ADR-0001/s,
    );
    expect(problemsOf({ badges: ['documented'], vintage: 'The map of 1947' })).toEqual('');
  });

  it('holds the constant against the vintage every committed artifact actually stamps', () => {
    // Anchored outside itself. `DATA_VINTAGE` is a string in a module and would agree with a test
    // that read it back; these are the five files that ship, each stamped by its own build.
    for (const [name, stamped] of [
      ['geography', geography.provenance.vintage],
      ['statistics', statistics.provenance.vintage],
      ['scenarios', scenarios.provenance.vintage],
      ['unit-outlines', outlines.provenance.vintage],
      ['adjacency', adjacency.provenance.vintage],
    ] as const) {
      expect(stamped, name).toBe(DATA_VINTAGE);
    }
  });
});

describe('every variant carries both an "Advocated by" and an "Opposed by" line', () => {
  it('gives every variant in the content module a side on each', () => {
    // The load-bearing pair for the app's own neutrality. `bundle.test.ts` holds them over the
    // shipped artifact; this holds them over the module a content diff edits, where the mistake
    // is actually made — and holds the *unadvocated* case as the stated state it is rather than
    // as an empty list somebody forgot to fill in (L7, D1).
    const silent = VARIANTS.flatMap((variant) => [
      ...(variant.opposedBy.length === 0 ? [`${variant.id}: no opposition`] : []),
      ...(variant.advocacy.kind === 'advocated' && variant.advocacy.by.length === 0
        ? [`${variant.id}: advocated by nobody named`]
        : []),
      ...(variant.advocacy.kind === 'unadvocated' && variant.advocacy.note.trim() === ''
        ? [`${variant.id}: unadvocated and silent about why`]
        : []),
    ]);
    expect(silent).toEqual([]);
  });

  it('names the variant when either line is missing', () => {
    expect(problemsOf({ opposedBy: [] as never })).toMatch(/test.*Opposed by/s);
    expect(problemsOf({ advocacy: { kind: 'advocated', by: [] as never } })).toMatch(
      /test.*names nobody/s,
    );
    expect(problemsOf({ advocacy: { kind: 'unadvocated', note: '' } })).toMatch(/test.*unadvocated/s);
    // Unadvocated *with* a note is a real variant and not a defect — L7 and D1 apply a rule to
    // census data and no movement proposes the output.
    expect(
      problemsOf({ advocacy: { kind: 'unadvocated', note: 'Nobody proposes the output of a rule.' } }),
    ).toEqual('');
  });
});

describe('a boundary this build derived says so where it is drawn', () => {
  it('marks every derived or synthesized boundary in the content module', () => {
    const unmarked = VARIANTS.filter(
      (variant) =>
        variant.composition.kind === 'derived' &&
        !badgesOf(variant).some((word) => word === 'derived' || word === 'synthesized'),
    ).map((variant) => variant.id);
    expect(unmarked).toEqual([]);
  });

  it('claims nothing derived of a boundary somebody else published', () => {
    const overclaimed = VARIANTS.filter(
      (variant) =>
        variant.composition.kind === 'transcribed' &&
        badgesOf(variant).some((word) => word === 'derived' || word === 'synthesized'),
    ).map((variant) => variant.id);
    expect(overclaimed).toEqual([]);
  });

  it('refuses a derived boundary that wears no derived badge, naming the variant', () => {
    // The rule `scenarios.ts` has stated in prose since it was written: a line nobody published
    // must say on screen that it was drawn from data, or it reads as somebody's proposal.
    const problems = problemsOf({
      badges: ['documented'],
      composition: {
        kind: 'derived',
        rule: 'the largest contiguous group of districts above the national literacy rate',
        from: 'PBS 2023 Census Table 12',
      },
    });
    expect(problems).toMatch(/test.*derived.*synthesized/s);
    expect(problems).toMatch(/literacy rate/);
  });

  it('refuses a derived badge over a transcribed boundary, naming the badge', () => {
    // The other direction, and it says something different: this credits a movement's own
    // published document to our arithmetic.
    expect(problemsOf({ badges: ['census', 'derived'] })).toMatch(/test.*derived.*transcribed/s);
    expect(problemsOf({ badges: ['synthesized'] })).toMatch(/test.*synthesized.*transcribed/s);
  });

  it('accepts a derived boundary that is badged as one', () => {
    expect(
      problemsOf({
        badges: ['census', 'derived'],
        composition: {
          kind: 'derived',
          rule: 'equal population within a 10% band',
          from: 'PBS 2023 Census Table 1',
        },
      }),
    ).toEqual('');
    expect(
      problemsOf({
        badges: ['synthesized'],
        composition: {
          kind: 'derived',
          rule: 'a composite of the three published development rates',
          from: 'PBS 2023 Census Tables 12, 23 and 24',
        },
      }),
    ).toEqual('');
  });
});

/**
 * The artifact that ships, held to what it carries.
 *
 * Looser than the module checks above on purpose: `vintage` is a field this build added, and a
 * bundle baked one commit earlier does not have it. Requiring it here would fail the suite on a
 * committed artifact that is not wrong, only older — so what is asserted is that whatever is
 * there is honest, and that the fields the card has always rendered are all present.
 */
describe('the committed bundle carries its own provenance', () => {
  const bases = Object.entries(scenarios.bases) as [string, Record<string, unknown>][];
  const variants = scenarios.variants as {
    id: string;
    badges: string[];
    vintage?: string;
    sources: unknown[];
    opposedBy: unknown[];
  }[];

  it('gives every basis in the bundle a name, a source and badges from the vocabulary', () => {
    const problems = bases.flatMap(([id, basis]) => [
      ...(String(basis['name'] ?? '').trim() === '' ? [`${id}: no name`] : []),
      ...(String(basis['source'] ?? '').trim() === '' ? [`${id}: no source`] : []),
      ...((basis['badges'] as string[] | undefined) ?? []).length === 0 ? [`${id}: no badge`] : [],
      ...(((basis['badges'] as string[] | undefined) ?? []).filter(
        (word) => !PROVENANCE_BADGES.includes(word as ProvenanceBadge),
      ).map((word) => `${id}: ${word}`)),
    ]);
    expect(problems).toEqual([]);
    expect(bases.length).toBe(4);
  });

  it('states the project vintage wherever it states one at all', () => {
    // Never blank, and never a second one. A basis or a variant that names a vintage names either
    // the census's or, for a documented boundary, its own document's — and a bundle that shipped
    // an empty string would be saying it has a date and declining to give it.
    const blank = [
      ...bases.map(([id, basis]) => ({ id, vintage: basis['vintage'] as string | undefined })),
      ...variants.map((variant) => ({ id: variant.id, vintage: variant.vintage })),
    ].filter((row) => row.vintage !== undefined && row.vintage.trim() === '');
    expect(blank).toEqual([]);
    expect(scenarios.provenance.vintage).toBe(DATA_VINTAGE);
  });

  it('gives every variant in the bundle a badge, a source and an opposition line', () => {
    const problems = variants.flatMap((variant) => [
      ...(variant.badges.length === 0 ? [`${variant.id}: no badge`] : []),
      ...(variant.sources.length === 0 ? [`${variant.id}: no source`] : []),
      ...(variant.opposedBy.length === 0 ? [`${variant.id}: no opposition`] : []),
    ]);
    expect(problems).toEqual([]);
  });
});
