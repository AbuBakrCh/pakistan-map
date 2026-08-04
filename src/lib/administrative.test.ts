/**
 * Fill = data, on the basis whose data is the plainest of the three (#14, D14).
 *
 * Held over the committed bundle, like `mother-tongue.test.ts` and `development.test.ts` beside it:
 * whether a district is shaded, and what it is shaded with, is a property of the artifact that
 * ships. What this file has to hold that the other two do not is the **banding** — the only decision
 * this module makes on top of a published figure. So a district's band is re-derived from its own
 * census population against the cuts, and the two things a banded count is most easily got wrong on
 * are asserted directly: nothing is shaded on a figure the census did not publish, and the twenty
 * districts it does not reach are an absence rather than the lowest band.
 */

import { describe, expect, it } from 'vitest';
import bundle from '../../data/bundle/geography.topojson.json';
import statistics from '../../data/bundle/statistics.json';
import type { CensusStatistics } from '../bundle.ts';
import {
  POPULATION_BANDS,
  bandOf,
  populationFills,
  populationLegend,
  populationPaint,
} from './administrative.ts';
import { POPULATION_BAND_FILL } from './palette.ts';

const census = statistics as unknown as CensusStatistics;
const drawnDistricts = (
  bundle as unknown as {
    objects: { districts: { geometries: { properties: { name: string } }[] } };
  }
).objects.districts.geometries.map((g) => g.properties.name);

describe('the bands', () => {
  it('covers every figure from zero upward, with no gap and no overlap', () => {
    // Half-open, `from` inclusive and `to` exclusive. The boundary figure itself is the case worth
    // asserting: 500,000 people is the second band's floor and not the first band's ceiling, and a
    // pair of cuts that both claimed it would shade a district on whichever the search hit first.
    expect(POPULATION_BANDS[0]?.from).toBe(0);
    expect(POPULATION_BANDS[POPULATION_BANDS.length - 1]?.to).toBe(Infinity);
    for (const [i, band] of POPULATION_BANDS.entries()) {
      const next = POPULATION_BANDS[i + 1];
      if (next === undefined) continue;
      expect(next.from, `${band.id} → ${next.id}`).toBe(band.to);
      expect(bandOf(band.to, 'the cut itself').id).toBe(next.id);
      expect(bandOf(band.to - 1, 'one below the cut').id).toBe(band.id);
    }
  });

  it('is fixed rather than a quantile of this census, which is the whole of its stability', () => {
    // The cuts are round numbers, not percentiles: a district's colour must not move because
    // another district's population did. Asserted as the arithmetic property rather than as a
    // comment — every cut is a round hundred thousand, which no quantile of 136 figures would be.
    for (const band of POPULATION_BANDS) {
      if (band.to === Infinity) continue;
      expect(band.to % 100_000, band.id).toBe(0);
    }
  });

  it('refuses a figure that is not a population, rather than clamping it into a band', () => {
    expect(() => bandOf(-1, 'Nowhere')).toThrow(/Nowhere/);
  });

  it('refuses a band the ramp has no colour for, naming the surface that asked', () => {
    expect(() => populationPaint('most-of-them', "the legend's row")).toThrow(/the legend's row/);
    expect(() => populationPaint('most-of-them', 'Lahore')).toThrow(/no colour for/);
  });
});

describe('populationFills', () => {
  const fills = populationFills(census);

  it('decides every district that is drawn, and names any it cannot', () => {
    // A district drawn with no decision behind it renders as bare land, which is the "no census
    // data" treatment — so a miss here would silently claim PBS published nothing about it.
    const undecided = drawnDistricts.filter((name) => !fills.has(name));
    expect(undecided).toEqual([]);
    expect(fills.size).toBe(drawnDistricts.length);
  });

  it('shades a district by its own published population, and by nothing else', () => {
    // Fill is data, never unit membership (D14). Re-derived from the census figure against the
    // cuts rather than read back off what the module wrote, so the colour on the map and the
    // number the tooltip prints beside it cannot come apart.
    const wrong: string[] = [];
    for (const [name, record] of Object.entries(census.districts)) {
      const expected = bandOf(record.population, name).id;
      const fill = fills.get(name);
      const actual = fill?.kind === 'band' ? fill.band : null;
      if (actual !== expected) wrong.push(`${name}: ${String(actual)} ≠ ${expected}`);
      if (fill?.kind === 'band' && fill.colour !== POPULATION_BAND_FILL[expected]) {
        wrong.push(`${name} is drawn in ${fill.colour}, not the ramp's ${expected}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('leaves all twenty AJK and GB districts unshaded, as the absence they are', () => {
    // D25, and the failure mode this basis is most exposed to: the lowest band is *under 500,000*,
    // and twenty districts with no census row painted into it would read as the emptiest ground in
    // Pakistan on the strength of a question PBS never asked there.
    const absent = [...fills]
      .filter(([, fill]) => fill.kind === 'no-data')
      .map(([name]) => name)
      .sort();
    expect(absent).toEqual([...census.withoutCensusData.districts].sort());
    expect(absent).toHaveLength(20);
    for (const name of absent) expect(fills.get(name)?.kind, name).not.toBe('band');
  });

  it('has no third state, unlike the language basis, and that is a difference not an omission', () => {
    // Chitral has no dominant mother tongue because Khowar has no column; a published population
    // always has a value, so there is nothing here for a stipple to say.
    expect([...fills.values()].filter((fill) => fill.kind === 'no-dominant')).toEqual([]);
  });

  it('puts a district in every band, so no swatch keys ground the map does not paint', () => {
    // Not a target — the cuts are fixed and the spread is whatever the census puts inside them —
    // but worth holding: if a future census emptied one, the legend says so in words rather than
    // the ramp quietly reading as three even steps.
    const counts = new Map<string, number>();
    for (const fill of fills.values()) {
      if (fill.kind === 'band') counts.set(fill.band, (counts.get(fill.band) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual(POPULATION_BANDS.map((b) => b.id).sort());
    expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(136);
  });
});

describe('populationLegend', () => {
  const legend = populationLegend(census);

  it('keys every band, in the order the scale is read', () => {
    expect(legend.bands).toHaveLength(POPULATION_BANDS.length);
    for (const [i, band] of POPULATION_BANDS.entries()) {
      expect(legend.bands[i]?.label, band.id).toContain(band.label);
      expect(legend.bands[i]?.swatch).toEqual({
        kind: 'colour',
        colour: POPULATION_BAND_FILL[band.id],
      });
    }
  });

  it('counts the districts in each band, off the fills it is keying', () => {
    const fills = populationFills(census);
    for (const band of POPULATION_BANDS) {
      const districts = [...fills.values()].filter(
        (fill) => fill.kind === 'band' && fill.band === band.id,
      ).length;
      const entry = legend.bands.find((row) => row.label.startsWith(band.label));
      expect(entry?.label, band.id).toBe(
        districts === 0
          ? `${band.label} — no district falls in this band`
          : `${band.label} (${districts})`,
      );
    }
  });

  it('names the two ends off the artifact, in full digits and never abbreviated', () => {
    // The lead is the sentence that makes the shading checkable: a reader who knows the extremes
    // knows what the darkest band is doing. Grouped, never "13.0 m" — the census counted people one
    // at a time (see `figures.ts`).
    const populations = Object.values(census.districts).map((record) => record.population);
    const [lowest, highest] = [Math.min(...populations), Math.max(...populations)];
    const named = (value: number): string =>
      Object.entries(census.districts).find(([, r]) => r.population === value)?.[0] ?? '';
    expect(legend.lead).toContain(named(lowest));
    expect(legend.lead).toContain(named(highest));
    expect(legend.lead).toContain('13,004,135');
    expect(legend.lead).not.toMatch(/\d\s?m\b/);
  });

  it('says which figure it is, because a banded count is read as a density otherwise', () => {
    expect(legend.lead).toContain('not a density');
    expect(legend.lead).toContain('PBS Census-2023 Table 1');
  });

  it('keys the one absence this basis has, hatched like the ground beneath it', () => {
    expect(legend.absences).toHaveLength(1);
    expect(legend.absences[0]?.swatch.kind).toBe('hatch');
    expect(legend.absences[0]?.label).toContain('Gilgit-Baltistan');
  });
});
