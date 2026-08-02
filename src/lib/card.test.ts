import { describe, expect, it } from 'vitest';
import scenarios from '../../data/bundle/scenarios.json';
import type { ScenarioBundle, VariantRecord } from '../bundle.ts';
import { PROVENANCE_GLOSS, variantCard, type VariantCard } from './card.ts';

const bundle = scenarios as unknown as ScenarioBundle;

const variantNamed = (id: string): VariantRecord => {
  const found = bundle.variants.find((variant) => variant.id === id);
  if (found === undefined) throw new Error(`${id} is not a variant in the committed bundle`);
  return found;
};

/**
 * A variant the committed bundle does not contain — the states the build refuses to emit, and the
 * ones the other sixteen variants will bring (#24–#31). Written as an override of the real L1 so
 * that a schema change breaks this file rather than being quietly worked around by it.
 */
const like = (id: string, overrides: Partial<VariantRecord>): VariantRecord => ({
  ...variantNamed('l1'),
  id,
  ...overrides,
});

describe('variantCard — the header a reader meets first', () => {
  const card = variantCard(bundle, variantNamed('l1'));

  it('names the variant and keeps its editorial gloss', () => {
    expect(card.name).toBe('South Punjab Secretariat');
    expect(card.tagline).toBe('the version that partly exists');
  });

  it('badges the basis and the provenance as two different claims', () => {
    // The basis is what the shading argues from; the provenance is where this boundary came from.
    // One badge over both is the confusion the closed vocabulary exists to prevent.
    expect(card.basis.label).toBe('Language / dialect');
    expect(card.provenance.map((b) => b.label)).toEqual(['documented']);
  });

  it('glosses every provenance badge on the card itself, not in a hover title', () => {
    // The hard bar is a 390px phone, where a `title` is reachable by nothing.
    for (const badge of card.provenance) {
      expect(badge.gloss, badge.label).toBeTruthy();
      expect(badge.gloss, badge.label).toContain(badge.label);
    }
  });

  it("says why the variant's own badge disagrees with its basis's", () => {
    // L1 is a Language variant whose boundary is a secretariat's remit, not census analysis. A
    // reader comparing an outline against the shading beneath it is owed the reason the two
    // badges differ, or the discrepancy reads as a mistake.
    expect(card.provenanceNote).toContain('Language / dialect');
    expect(card.provenanceNote).toContain('census · proxy');
    expect(card.provenanceNote).toContain('documented');
  });

  it('says nothing about a divergence where the variant takes its basis at its word', () => {
    const basis = bundle.bases[variantNamed('l1').basis];
    const agreeing = variantCard(bundle, like('agrees', { badges: basis.badges }));
    expect(agreeing.provenanceNote).toBeNull();
  });

  it('refuses a badge outside the closed vocabulary, naming the variant and the word', () => {
    const strange = like('strange', { badges: ['plausible'] as never });
    expect(() => variantCard(bundle, strange)).toThrow(/strange.*plausible/s);
    expect(Object.keys(PROVENANCE_GLOSS)).toEqual([
      'official',
      'census',
      'proxy',
      'derived',
      'documented',
      'synthesized',
    ]);
  });
});

describe('variantCard — the counts', () => {
  const card = variantCard(bundle, variantNamed('l1'));

  it('says what the units are, not only how many', () => {
    // Seven of L1's eight units are the current map carried through. "8 units" alone invites the
    // reading that the proposal creates eight provinces.
    expect(card.summary).toContain('8 units');
    expect(card.summary).toContain('1 proposed province');
    expect(card.summary).toContain('5 carried through from the current map unchanged');
    expect(card.summary).toContain('2 territories left as they are');
    // Islamabad is one of those five and is not a province. The line says what is true of all of
    // them rather than calling the capital territory something it is not.
    expect(card.summary).not.toContain('current provinces');
  });

  it('prints both district counts wherever the claim and the map disagree', () => {
    // 13 stated, 11 drawn (ADR-0001). Either number alone reads as a miscount.
    expect(card.summary).toContain('stated as 13 districts and drawn as 11');
  });

  it('prints one count where there is only one', () => {
    const same = like('same', {
      counts: {
        units: 8,
        proposedUnits: 1,
        claimedDistricts: 11,
        drawnDistricts: 11,
        nonContiguousUnits: 0,
      },
    });
    expect(variantCard(bundle, same).summary).toContain('11 districts change province');
  });

  it('says which ground a drawn-universe partition covers', () => {
    expect(card.coverage).toContain('all 156 districts');
    expect(card.coverage).toContain('no ground is left uncoloured');
  });

  it('says a census-universe partition leaves the territories out on purpose', () => {
    // Otherwise a complete partition of the 136 looks like a partition with a hole in it.
    const censusSet = like('census-set', {
      partition: { universe: 'census', districts: 136, claimed: 136 },
    });
    const covered = variantCard(bundle, censusSet).coverage;
    expect(covered).toContain('136 districts');
    expect(covered).toContain('Gilgit-Baltistan are outside this partition');
    expect(covered).toContain('in no unit');
  });
});

describe('variantCard — advocated by, and opposed by', () => {
  const card = variantCard(bundle, variantNamed('l1'));

  it('carries both lines, labelled as the spec labels them', () => {
    expect(card.advocacy.label).toBe('Advocated by');
    expect(card.opposition.label).toBe('Opposed by');
  });

  it('lists the real advocates and the real opponents', () => {
    expect(card.advocacy.items.length).toBeGreaterThan(0);
    expect(card.opposition.items.length).toBeGreaterThan(0);
    expect(card.advocacy.note).toBeNull();
    expect(card.opposition.note).toBeNull();
  });

  it('lets an unadvocated variant say so, rather than showing an empty list', () => {
    // L7 and D1 apply a rule to census data and no movement proposes the output. That is a state
    // the schema spells out, and the card prints the reason in place of the list.
    const unadvocated = like('unadvocated', {
      advocacy: {
        kind: 'unadvocated',
        note: 'Nobody proposes this partition; it is what the rule produces.',
      },
    });
    const said = variantCard(bundle, unadvocated).advocacy;
    expect(said.items).toEqual([]);
    expect(said.note).toBe('Nobody proposes this partition; it is what the rule produces.');
  });

  it('prints an opposition line even when the data has none, and calls it a gap', () => {
    // The build refuses an empty `opposedBy`, so this is a bundle that build did not write. The
    // card still prints something: dropping the line turns missing data into the claim that the
    // proposal is uncontested, which is exactly the reading the line exists to prevent.
    const silent = variantCard(bundle, like('silent', { opposedBy: [] })).opposition;
    expect(silent.label).toBe('Opposed by');
    expect(silent.items).toEqual([]);
    expect(silent.note).toContain('gap in this app’s data');
    expect(silent.note).not.toContain('nobody opposes');
  });

  it('never leaves either line with neither a list nor a sentence', () => {
    for (const variant of bundle.variants) {
      const built = variantCard(bundle, variant);
      for (const list of [built.advocacy, built.opposition]) {
        expect(list.items.length > 0 || list.note !== null, `${variant.id} ${list.label}`).toBe(
          true,
        );
      }
    }
  });
});

describe('variantCard — the units', () => {
  const card = variantCard(bundle, variantNamed('l1'));

  it('sets alternative names beside the advocates’ own name, never instead of it', () => {
    const south = card.units.find((unit) => unit.id === 'south-punjab');
    expect(south?.name).toBe('South Punjab');
    expect(south?.alsoKnownAs).toBe('also: Saraikistan, Saraiki Wasaib');
  });

  it('says nothing where a unit has no alternative name', () => {
    expect(card.units.find((unit) => unit.id === 'sindh')?.alsoKnownAs).toBeNull();
  });

  it('lists the proposal first, ahead of the provinces it is carved out of', () => {
    // The bundle's order is the order the partition was written in — remainders after the claim
    // they are the remainder of. A reader scanning eight units for the one that does not exist
    // should not have to.
    expect(card.units[0]?.id).toBe('south-punjab');
    expect(card.units.map((unit) => unit.kind).lastIndexOf('proposed')).toBe(0);
    expect(card.units.at(-1)?.kind).toBe('territory');
  });

  it('names each unit for what it is relative to the current map', () => {
    expect(card.units.find((u) => u.id === 'south-punjab')?.standing).toContain('not official');
    expect(card.units.find((u) => u.id === 'sindh')?.standing).toBe('Unchanged from the current map');
    // Islamabad is `unchanged` too and is not a province, so the standing never calls it one.
    expect(card.units.find((u) => u.id === 'islamabad-capital-territory')?.standing).toBe(
      'Unchanged from the current map',
    );
    expect(card.units.find((u) => u.id === 'gilgit-baltistan')?.standing).toContain(
      'not constitutionally a province',
    );
  });

  it('gives a unit both district counts, and names the folds that explain them', () => {
    expect(card.units.find((u) => u.id === 'south-punjab')?.districts).toBe(
      '13 districts as claimed, 11 as drawn (Taunsa inside Dera Ghazi Khan and Kot Addu inside ' +
        'Muzaffargarh)',
    );
  });

  it('gives a unit one count where the claim and the drawing agree', () => {
    expect(card.units.find((u) => u.id === 'sindh')?.districts).toBe('30 districts');
  });
});

describe('variantCard — footnotes', () => {
  const card = variantCard(bundle, variantNamed('l1'));

  it('labels a district-count discrepancy as one, and keeps the text verbatim', () => {
    const first = card.footnotes[0];
    expect(first?.kind).toBe('district-count');
    expect(first?.label).toBe('District count');
    expect(first?.text).toContain('11 then, 13 now, 11 drawn');
  });

  it('sets the discrepancies before the asides', () => {
    // A reader counting districts on screen and getting a different number from the card has
    // found the most alarming-looking thing on it, and is owed the answer before the context.
    const mixed = like('mixed', {
      footnotes: [
        { kind: 'note', text: 'context' },
        { kind: 'contested-edge', text: 'the edge its own subjects reject' },
        { kind: 'derived-boundary', text: 'drawn from the census, not from a proposal' },
        { kind: 'omission', text: 'claimed and undrawable' },
        { kind: 'district-count', text: 'stated as 11, drawn as 13' },
      ],
    });
    expect(variantCard(bundle, mixed).footnotes.map((f) => f.kind)).toEqual([
      'district-count',
      'derived-boundary',
      'omission',
      'contested-edge',
      'note',
    ]);
  });

  it('labels every kind the schema allows, so none renders unheaded', () => {
    const mixed = like('mixed', {
      footnotes: [
        { kind: 'derived-boundary', text: 'a' },
        { kind: 'omission', text: 'b' },
        { kind: 'contested-edge', text: 'c' },
        { kind: 'note', text: 'd' },
      ],
    });
    expect(variantCard(bundle, mixed).footnotes.map((f) => f.label)).toEqual([
      'Boundary derived from data',
      'Claimed and not drawn',
      'Contested edge',
      'Note',
    ]);
  });

  it('refuses a footnote kind it has no heading for, naming the variant', () => {
    const strange = like('strange', { footnotes: [{ kind: 'caveat', text: 'a' }] });
    expect(() => variantCard(bundle, strange)).toThrow(/strange.*caveat/s);
  });
});

describe('variantCard — provenance of the boundary itself', () => {
  it('says a transcribed boundary was transcribed, and from what', () => {
    const card = variantCard(bundle, variantNamed('l1'));
    expect(card.composition).toContain('Transcribed from');
    expect(card.composition).toContain('secretariat');
  });

  it('says out loud that a derived boundary was drawn from data rather than proposed', () => {
    // The one kind of line on this map that nobody published. The rule that produced it is the
    // whole of its provenance, so the card states the rule and calls the boundary derived.
    const derived = like('derived', {
      composition: {
        kind: 'derived',
        rule: 'districts grouped by their dominant mother tongue',
        from: 'PBS 2023 Census Table 11',
      },
    });
    const said = variantCard(bundle, derived).composition;
    expect(said).toContain('Derived from data rather than transcribed from a proposal');
    expect(said).toContain('districts grouped by their dominant mother tongue');
    expect(said).toContain('PBS 2023 Census Table 11');
  });

  it('carries the status, the rationale and every source through unedited', () => {
    const card = variantCard(bundle, variantNamed('l1'));
    const l1 = variantNamed('l1');
    expect(card.rationale).toBe(l1.rationale);
    expect(card.status).toBe(l1.status);
    expect(card.sources.map((s) => s.label)).toEqual(l1.sources.map((s) => s.label));
    expect(card.sources.every((s) => s.label.length > 0)).toBe(true);
  });

  it('says why a variant withholds modern figures, rather than showing an empty scorecard', () => {
    expect(variantCard(bundle, variantNamed('l1')).figuresWithheld).toBeNull();
    const historical = like('historical', {
      statistics: {
        modernFigures: false,
        reason: 'These are 1947’s boundaries; 2023 figures would describe ground that had ceased ' +
          'to be one unit long before anyone was counted.',
      },
    });
    expect(variantCard(bundle, historical).figuresWithheld).toContain('1947');
  });

});

describe('variantCard — the scorecard (#20)', () => {
  const card = variantCard(bundle, variantNamed('l1'));
  const line = (built: VariantCard, label: string) =>
    built.scorecard.lines.find((found) => found.label === label);

  it('gives the five figures a proposal is judged on, in a fixed order', () => {
    // Fixed because a reader comparing two proposals reads down this column: a card that ordered
    // its figures by which of them happened to exist would be a different card per variant.
    expect(card.scorecard.lines.map((found) => found.label)).toEqual([
      'Units',
      'Population spread',
      'Largest to smallest',
      'Districts moved',
      'Contiguity',
    ]);
  });

  it('prints census populations in full, grouped, and never rounded to a headline', () => {
    // The census counted people one at a time and publishes the count. "87.3 m" is this app
    // interpolating a figure it was given exactly.
    const spread = line(card, 'Population spread');
    expect(spread?.value).toContain('Punjab 87,311,346 at the largest');
    expect(spread?.value).toContain('Islamabad Capital Territory 2,363,863 at the smallest');
    expect(spread?.value).not.toMatch(/million|\bm\b/);
  });

  it('says which units the total is over, and names the ones outside it', () => {
    // 241,499,431 described as the country's while two territories are missing from it is a wrong
    // number. The qualification travels with the figure rather than sitting in a footnote.
    const spread = line(card, 'Population spread');
    expect(spread?.note).toContain('241,499,431 people across the 6 units');
    expect(spread?.note).toContain('Azad Jammu & Kashmir and Gilgit-Baltistan are outside');
    expect(spread?.note).toContain('PBS published no 2023 results for their districts');
  });

  it('gives the ratio between the ends, at the precision it states', () => {
    expect(line(card, 'Largest to smallest')?.value).toBe('36.9 : 1');
  });

  it('refuses a ratio where one unit carries figures, rather than printing 1', () => {
    // 1 is a number, and a partition of one counted unit would read as perfectly even.
    const alone = variantCard(
      bundle,
      like('alone', {
        scorecard: {
          ...variantNamed('l1').scorecard,
          population: {
            units: 1,
            total: 2_363_863,
            largest: { unit: 'islamabad', name: 'Islamabad', population: 2_363_863 },
            smallest: { unit: 'islamabad', name: 'Islamabad', population: 2_363_863 },
            ratio: null,
          },
        },
      }),
    );
    expect(line(alone, 'Largest to smallest')?.value).toBe('Not given');
    expect(line(alone, 'Largest to smallest')?.note).toContain('nothing to compare it against');
  });

  it('says how much ground changes hands, and out of where', () => {
    // Keyed on the districts the map draws, not the thirteen the claim names: eleven of Punjab's.
    expect(line(card, 'Districts moved')?.value).toBe('11 of 156');
    expect(line(card, 'Districts moved')?.note).toBe('11 out of Punjab.');
  });

  it('reads contiguity off #16 rather than answering it a second way', () => {
    // All eight of L1's units hang together, and the line says so — a scorecard that printed
    // nothing where a proposal is whole would leave the reader unable to tell "checked and fine"
    // from "not checked".
    expect(line(card, 'Contiguity')?.value).toBe('All 8 units in one piece');
    expect(line(card, 'Contiguity')?.note).toBeNull();
  });

  it('names the stranded districts of a broken unit rather than counting them', () => {
    // Flagged, never blocked (D7). The districts cut off from the body of a proposal are the whole
    // of what the line is for; "1 of 8 units" alone tells a reader nothing they can check.
    const l1 = variantNamed('l1');
    const broken = variantCard(
      bundle,
      like('broken', {
        counts: { ...l1.counts, nonContiguousUnits: 1 },
        units: l1.units.map((unit) =>
          unit.id === 'south-punjab'
            ? { ...unit, contiguity: { contiguous: false, pieces: 2, detached: [['Layyah']] } }
            : unit,
        ),
      }),
    );
    expect(line(broken, 'Contiguity')?.value).toBe('1 of 8 in more than one piece');
    expect(line(broken, 'Contiguity')?.note).toContain('South Punjab is in 2 pieces');
    expect(line(broken, 'Contiguity')?.note).toContain('Layyah touching none of the rest of it');
    expect(line(broken, 'Contiguity')?.note).toContain('Flagged, not refused');
  });

  it('says nothing is withheld where nothing is', () => {
    expect(card.scorecard.withheld).toBeNull();
  });

  it('voids the population lines where a variant withholds figures, and states its reason once', () => {
    // H2 draws 1947's map (#30). The reason is the variant's judgement, quoted rather than
    // paraphrased, and the lines that do not depend on the census survive it.
    const l1 = variantNamed('l1');
    const reason = 'These are 1947’s boundaries; nobody was counted inside them in 2023.';
    const historical = variantCard(
      bundle,
      like('historical', {
        statistics: { modernFigures: false, reason },
        scorecard: {
          ...l1.scorecard,
          population: null,
          populationWithheld: { kind: 'variant', reason },
        },
      }),
    );
    expect(historical.scorecard.withheld).toContain('No population figures');
    expect(historical.scorecard.lines.map((found) => found.label)).toEqual([
      'Units',
      'Districts moved',
      'Contiguity',
    ]);

    // Once, and only once. The variant's own words belong to the argument column, where the card
    // has carried them since #19; repeating them over the scorecard would set the same sentence
    // twice on one card and read as though there were two reasons rather than one.
    expect(historical.figuresWithheld).toBe(reason);
    const wherever = [historical.figuresWithheld, historical.scorecard.withheld].filter((line) =>
      line?.includes('nobody was counted inside them in 2023'),
    );
    expect(wherever).toHaveLength(1);
  });

  it('names the unit and the districts where a census gap voids the comparison', () => {
    // The other way figures go missing, and it is not the same claim: this one is a proposal
    // reaching into ground PBS did not publish, not an editorial decision about vintage.
    const l1 = variantNamed('l1');
    const reaching = variantCard(
      bundle,
      like('reaching', {
        scorecard: {
          ...l1.scorecard,
          population: null,
          populationWithheld: {
            kind: 'incomplete',
            units: [{ unit: 'greater-punjab', name: 'Greater Punjab', uncounted: ['Mirpur'] }],
          },
        },
      }),
    );
    expect(reaching.scorecard.withheld).toContain('Greater Punjab takes in Mirpur');
    expect(reaching.scorecard.withheld).toContain('short by an unknown amount');
  });

  it('says a unit’s population, or says why it has none — never a zero and never a blank', () => {
    expect(card.units.find((unit) => unit.id === 'south-punjab')?.population).toBe(
      '40,377,576 people',
    );
    // The twenty AJK and Gilgit-Baltistan districts (D25). Said as coverage, not as a failure.
    expect(card.units.find((unit) => unit.id === 'gilgit-baltistan')?.population).toBe(
      'The 2023 census does not cover its districts, so it carries no population figure',
    );
    for (const unit of card.units) {
      expect(unit.population, unit.name).toBeTruthy();
      expect(unit.population, unit.name).not.toMatch(/\b0 people\b/);
    }
  });
});

describe('variantCard — over every variant the bundle ships', () => {
  it('builds a complete card for each, with no field left blank', () => {
    for (const variant of bundle.variants) {
      const card = variantCard(bundle, variant);
      expect(card.name, variant.id).toBeTruthy();
      expect(card.rationale, variant.id).toBeTruthy();
      expect(card.status, variant.id).toBeTruthy();
      expect(card.summary, variant.id).toBeTruthy();
      expect(card.coverage, variant.id).toBeTruthy();
      expect(card.composition, variant.id).toBeTruthy();
      expect(card.provenance.length, variant.id).toBeGreaterThan(0);
      expect(card.units.length, variant.id).toBe(variant.units.length);
      expect(card.sources.length, variant.id).toBeGreaterThan(0);
      expect(card.opposition.items.length, variant.id).toBeGreaterThan(0);
    }
  });

  it('names every unit of every variant, with no unit dropped or duplicated', () => {
    for (const variant of bundle.variants) {
      const card = variantCard(bundle, variant);
      expect([...card.units.map((u) => u.id)].sort(), variant.id).toEqual(
        [...variant.units.map((u) => u.id)].sort(),
      );
    }
  });

  it('refuses a variant argued on a basis the bundle cannot name', () => {
    const orphan = like('orphan', { basis: 'sectarian' as never });
    expect(() => variantCard(bundle, orphan)).toThrow(/orphan.*sectarian/s);
  });
});
