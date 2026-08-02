/**
 * The scorecard's arithmetic, on a country small enough to add up by hand (#20).
 *
 * `bundle.test.ts` holds the figures that ship, re-derived from the committed census and the
 * committed partition. What the shipped set cannot show is everything the absences do: L1 is one
 * variant, every unit of it is either wholly inside the 2023 census or wholly outside it, and it
 * withholds nothing. So the states that void a figure are held here — a unit that takes in ground
 * the census does not cover, a variant that suppresses modern figures itself, a partition with one
 * counted unit and nothing to compare it against — and so is the rule that decides what "moved"
 * means, which is the only judgement in the module.
 *
 * Five districts in three first-level entities, one of them outside the census. Small enough that
 * every assertion below can be checked against the table rather than against the code that
 * produced it.
 */

import { describe, expect, it } from 'vitest';
import {
  districtsMoved,
  scorecardOf,
  unitPopulations,
  type ScorecardUnit,
} from './scorecard.ts';

/**
 * Five drawn districts in three first-level entities, of which Far is this fixture's AJK: drawn
 * and named, and in no census table. Populations chosen so every sum below is readable.
 */
const ORIGINS = new Map([
  ['Alpha', 'North'],
  ['Bravo', 'North'],
  ['Charlie', 'North'],
  ['Delta', 'South'],
  ['Echo', 'Far'],
]);

/** The census. Echo is absent from it, never present as zero — which is the whole distinction. */
const POPULATIONS = new Map([
  ['Alpha', 1_000_000],
  ['Bravo', 2_000_000],
  ['Charlie', 4_000_000],
  ['Delta', 8_000_000],
]);

const UNCOUNTED = 'Echo';

const unit = (name: string, districts: string[], kind: ScorecardUnit['kind'] = 'unchanged'): ScorecardUnit => ({
  id: name.toLowerCase().replace(/ /g, '-'),
  name,
  kind,
  districts,
});

const SHOWN = { modernFigures: true } as const;

describe('unit populations', () => {
  it('is the sum of the census rows under it, and nothing else', () => {
    const [north] = unitPopulations([unit('North', ['Alpha', 'Bravo', 'Charlie'])], POPULATIONS);
    expect(north?.population).toBe(7_000_000);
    expect(north?.uncounted).toEqual([]);
  });

  it('withholds a unit’s population rather than summing the districts it does have', () => {
    // The whole point of the null. 8,000,000 for a unit that also contains ground nobody counted
    // is a figure that is wrong by an unknowable amount and looks exactly like one that is right.
    const [south] = unitPopulations([unit('South', ['Delta', UNCOUNTED])], POPULATIONS);
    expect(south?.population).toBeNull();
    expect(south?.uncounted).toEqual(['Echo']);
  });

  it('names the districts the census does not reach, rather than counting them', () => {
    const [territory] = unitPopulations([unit('Territory', [UNCOUNTED])], POPULATIONS);
    expect(territory?.uncounted).toEqual(['Echo']);
  });
});

describe('districts moved', () => {
  it('counts a district that changes hands, and says what it came out of', () => {
    const moved = districtsMoved(
      [unit('New Charlie', ['Charlie'], 'proposed'), unit('North', ['Alpha', 'Bravo'])],
      ORIGINS,
    );
    expect(moved.count).toBe(1);
    expect(moved.of).toBe(3);
    expect(moved.byOrigin).toEqual([{ from: 'North', districts: 1 }]);
  });

  it('leaves the districts a shrinking province keeps where they are', () => {
    // The reading this rule exists to refuse: North loses one district and is still North. Calling
    // its remaining two "moved" would report a province that has gone nowhere as having moved.
    const moved = districtsMoved(
      [unit('New Charlie', ['Charlie'], 'proposed'), unit('North', ['Alpha', 'Bravo'])],
      ORIGINS,
    );
    expect(moved.byOrigin.map((from) => from.districts)).toEqual([1]);
  });

  it('moves nothing where a unit only changes standing, keeping its province’s name', () => {
    // A territory promoted to a province is the case that breaks every structural rule tried
    // instead: no ground changes hands, and counting all of it as moved would say it had.
    const promoted = districtsMoved([unit('Far', ['Echo'], 'proposed')], ORIGINS);
    expect(promoted.count).toBe(0);
    expect(promoted.byOrigin).toEqual([]);
  });

  it('reports everything a merged unit draws from, largest contributor first', () => {
    const merged = districtsMoved(
      [unit('Union', ['Alpha', 'Bravo', 'Charlie', 'Delta'], 'proposed'), unit('Far', ['Echo'])],
      ORIGINS,
    );
    expect(merged.count).toBe(4);
    expect(merged.byOrigin).toEqual([
      { from: 'North', districts: 3 },
      { from: 'South', districts: 1 },
    ]);
  });
});

describe('the population spread', () => {
  const units = [
    unit('Charlie', ['Charlie'], 'proposed'),
    unit('North', ['Alpha', 'Bravo']),
    unit('South', ['Delta']),
  ];
  const scorecard = scorecardOf(units, {
    populations: POPULATIONS,
    origins: ORIGINS,
    modernFigures: SHOWN,
  });

  it('names the largest and the smallest, and gives the ratio between them', () => {
    expect(scorecard.population?.largest).toEqual({
      unit: 'south',
      name: 'South',
      population: 8_000_000,
    });
    expect(scorecard.population?.smallest).toEqual({
      unit: 'north',
      name: 'North',
      population: 3_000_000,
    });
    // One decimal, which is the precision the card sets. Rounded once, here, so the artifact never
    // carries a figure that nothing on screen can show: 8 ÷ 3 is 2.666…, baked as 2.7 and printed
    // as `2.7 : 1`.
    expect(scorecard.population?.ratio).toBe(2.7);
    expect(scorecard.population?.total).toBe(15_000_000);
    expect(scorecard.populationWithheld).toBeNull();
  });

  it('sets a unit wholly outside the census aside by name, and keeps the rest of the figures', () => {
    // The census's own coverage, not a hole in the data (D25). The spread is over the units it
    // reaches, the one it does not is listed, and no figure is invented for it.
    const withTerritory = scorecardOf([...units, unit('Far', [UNCOUNTED], 'territory')], {
      populations: POPULATIONS,
      origins: ORIGINS,
      modernFigures: SHOWN,
    });
    expect(withTerritory.population?.units).toBe(3);
    expect(withTerritory.population?.total).toBe(15_000_000);
    expect(withTerritory.outsideTheCensus).toEqual([
      { unit: 'far', name: 'Far', districts: ['Echo'] },
    ]);
    expect(withTerritory.populationWithheld).toBeNull();
  });

  it('voids every population figure where a unit is only partly counted, naming it', () => {
    // A unit short by an unknowable amount cannot be the largest or the smallest of anything, and
    // a spread taken around it would be a comparison this app cannot support.
    const reaching = scorecardOf(
      [unit('Greater Charlie', ['Charlie', UNCOUNTED], 'proposed'), unit('North', ['Alpha', 'Bravo'])],
      { populations: POPULATIONS, origins: ORIGINS, modernFigures: SHOWN },
    );
    expect(reaching.population).toBeNull();
    expect(reaching.populationWithheld).toEqual({
      kind: 'incomplete',
      units: [{ unit: 'greater-charlie', name: 'Greater Charlie', uncounted: ['Echo'] }],
    });
    // And the figures that are not population survive it: districts do not stop being districts.
    expect(reaching.districtsMoved.count).toBe(2);
    expect(reaching.units).toBe(2);
  });

  it('withholds figures in the variant’s own words where the variant asks for it', () => {
    // H2 draws 1947's map (#30). Why 2023 figures do not belong on it is the variant's judgement,
    // and the reason travels with the withholding rather than being paraphrased downstream.
    const historical = scorecardOf(units, {
      populations: POPULATIONS,
      origins: ORIGINS,
      modernFigures: {
        modernFigures: false,
        reason: 'These are 1947’s boundaries; nobody was counted inside them in 2023.',
      },
    });
    expect(historical.population).toBeNull();
    expect(historical.populationWithheld).toEqual({
      kind: 'variant',
      reason: 'These are 1947’s boundaries; nobody was counted inside them in 2023.',
    });
    expect(historical.districtsMoved.of).toBe(4);
  });

  it('refuses a ratio where one unit carries figures, rather than reporting 1', () => {
    // 1 is a number, and a partition of one counted unit would read as perfectly even.
    const alone = scorecardOf([unit('North', ['Alpha']), unit('Far', [UNCOUNTED], 'territory')], {
      populations: POPULATIONS,
      origins: ORIGINS,
      modernFigures: SHOWN,
    });
    expect(alone.population?.units).toBe(1);
    expect(alone.population?.ratio).toBeNull();
    expect(alone.population?.largest.name).toBe('North');
  });

  it('says so where nothing at all is counted, rather than reporting an empty spread', () => {
    const nothing = scorecardOf([unit('Far', [UNCOUNTED], 'territory')], {
      populations: POPULATIONS,
      origins: ORIGINS,
      modernFigures: SHOWN,
    });
    expect(nothing.population).toBeNull();
    expect(nothing.populationWithheld).toEqual({ kind: 'uncounted' });
    expect(nothing.outsideTheCensus.map((found) => found.name)).toEqual(['Far']);
  });

  it('never carries both a spread and a reason for having none, or neither', () => {
    const cases = [
      scorecardOf(units, { populations: POPULATIONS, origins: ORIGINS, modernFigures: SHOWN }),
      scorecardOf(units, {
        populations: POPULATIONS,
        origins: ORIGINS,
        modernFigures: { modernFigures: false, reason: 'stated' },
      }),
      scorecardOf([unit('Far', [UNCOUNTED], 'territory')], {
        populations: POPULATIONS,
        origins: ORIGINS,
        modernFigures: SHOWN,
      }),
    ];
    // Exactly one of the two, always: a spread with a reason beside it says two different things
    // about the same figures, and neither one leaves the card with a silent gap where they were.
    for (const scored of cases) {
      expect(scored.population === null).toBe(scored.populationWithheld !== null);
    }
  });
});
