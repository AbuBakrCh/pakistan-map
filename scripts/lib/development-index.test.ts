/**
 * The composite at its own seam (#31) — the cases the committed census cannot show.
 *
 * What the real bundle demonstrates is held in `bundle.test.ts`, over the artifact that ships.
 * What is here is the arithmetic and the three refusals: a rate that is not a proportion, a score
 * with no band, and a set of bands that does not cover the range the index can produce. Every one
 * of them would otherwise reach the map as a colour rather than as a failure.
 */

import { describe, expect, it } from 'vitest';
import {
  INDEX_BANDS,
  INDEX_COMPONENTS,
  INDEX_FORMULA,
  NOT_A_POVERTY_MEASURE,
  bandOf,
  developmentIndex,
  indexDistricts,
  type PublishedRates,
} from './development-index.ts';

const rates = (literacy: number, improvedWater: number, flushToilet: number): PublishedRates => ({
  literacy,
  improvedWater,
  flushToilet,
});

describe('the composite', () => {
  it('is the unweighted mean of the three published rates, and nothing else', () => {
    expect(developmentIndex(rates(0.6, 0.9, 0.3))).toBeCloseTo(0.6, 10);
    // Equal weights are the claim: moving a tenth from one component to another leaves the index
    // exactly where it was, which is the whole content of "unweighted" and is what a reader who
    // disagrees with the weighting is entitled to check.
    expect(developmentIndex(rates(0.5, 0.9, 0.4))).toBeCloseTo(
      developmentIndex(rates(0.9, 0.5, 0.4)),
      10,
    );
  });

  it('averages the three components the module names, in the order it names them', () => {
    expect(INDEX_COMPONENTS.map((component) => component.key)).toEqual([
      'literacy',
      'improvedWater',
      'flushToilet',
    ]);
  });

  it('names its third component for the column PBS actually publishes', () => {
    // The one place the ticket's wording and the census part company. There is no
    // improved-sanitation column; the shaded share is flush toilets, and every surface says so.
    const sanitation = INDEX_COMPONENTS.find((component) => component.key === 'flushToilet');
    expect(sanitation?.label).toContain('flush toilet');
    expect(sanitation?.label.toLowerCase()).not.toContain('improved');
    expect(INDEX_FORMULA).toContain('flush toilet');
    expect(INDEX_FORMULA.toLowerCase()).not.toContain('improved sanitation');
  });

  it('says in words that it is not a poverty measure, and says what it is instead', () => {
    expect(NOT_A_POVERTY_MEASURE).toContain('not poverty');
    expect(NOT_A_POVERTY_MEASURE).toContain('service access');
    expect(NOT_A_POVERTY_MEASURE).toContain('synthesized');
  });

  it('refuses a rate that is not a proportion, rather than clamping it', () => {
    // Clamping would publish a plausible figure over a district whose data is wrong. The message
    // names the component, because which of the three is broken is where a maintainer has to go.
    expect(() => developmentIndex(rates(1.2, 0.5, 0.5))).toThrow(/Literacy/);
    expect(() => developmentIndex(rates(0.5, -0.1, 0.5))).toThrow(/drinking water/i);
    expect(() => developmentIndex(rates(0.5, 0.5, Number.NaN))).toThrow(/flush toilet/i);
  });
});

describe('the bands', () => {
  it('partition the range the index can produce, with no gap and no seam', () => {
    expect(INDEX_BANDS[0]?.from).toBe(0);
    for (const [i, band] of INDEX_BANDS.entries()) {
      const next = INDEX_BANDS[i + 1];
      if (next === undefined) continue;
      expect(band.to, `${band.id} meets ${next.id}`).toBe(next.from);
    }
    // Both ends of the range are a band, including exactly 1 — which is a real value (every
    // household and every person over ten, on all three counts) and not an overflow.
    expect(bandOf(0).id).toBe(INDEX_BANDS[0]?.id);
    expect(bandOf(1).id).toBe(INDEX_BANDS[INDEX_BANDS.length - 1]?.id);
  });

  it('put a score in the band whose lower edge it sits on, never the one below', () => {
    const second = INDEX_BANDS[1];
    if (second === undefined) throw new Error('the bands are gone');
    expect(bandOf(second.from).id).toBe(second.id);
    expect(bandOf(second.from - 1e-9).id).toBe(INDEX_BANDS[0]?.id);
  });

  it('refuse a score outside the range rather than shading it as the lowest', () => {
    expect(() => bandOf(1.5)).toThrow(/falls in none/);
    expect(() => bandOf(-0.1)).toThrow(/falls in none/);
  });
});

describe('indexing a scope', () => {
  it('orders by score and then by name, so a rebuild writes the same file', () => {
    const result = indexDistricts(
      new Map([
        ['Beta', rates(0.4, 0.4, 0.4)],
        ['Alpha', rates(0.4, 0.4, 0.4)],
        ['Gamma', rates(0.9, 0.9, 0.9)],
      ]),
    );
    expect(result.districts.map((d) => d.district)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('reports every broken district by name and indexes none of them', () => {
    const result = indexDistricts(
      new Map([
        ['Sound', rates(0.5, 0.5, 0.5)],
        ['Broken', rates(1.4, 0.5, 0.5)],
        ['Also broken', rates(0.5, 0.5, 2)],
      ]),
    );
    expect(result.districts).toEqual([]);
    expect(result.problems.join(' ')).toContain('Broken');
    expect(result.problems.join(' ')).toContain('Also broken');
    // Named, not counted: a build told "2 problems" sends a maintainer to diff a census by hand.
    expect(result.problems).toHaveLength(2);
  });
});
