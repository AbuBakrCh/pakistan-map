/**
 * Fill = data, on the basis whose data nobody published (#31).
 *
 * Held over the committed bundle, like `mother-tongue.test.ts` next door and for the same reason:
 * whether a district is shaded, and what it is shaded with, is a property of the artifact that
 * ships. What is different here is what the artifact *is* — a composite this project defines — so
 * two extra things are asserted that the language basis does not need. The band a district is
 * drawn in is re-derived from its score against the band cuts, so a fill can never disagree with
 * the number the tooltip prints beside it. And the score itself is re-derived from the three
 * published rates in `statistics.json`, which is what makes the badge on it honest: a composite
 * nothing re-computes is an opinion with a formula written under it.
 */

import { describe, expect, it } from 'vitest';
import bundle from '../../data/bundle/geography.topojson.json';
import statistics from '../../data/bundle/statistics.json';
import developmentIndex from '../../data/bundle/development-index.json';
import {
  INDEX_BANDS,
  bandOf,
  developmentIndex as composite,
} from '../../scripts/lib/development-index.ts';
import type { CensusStatistics } from '../bundle.ts';
import { developmentFills, developmentLegend, type DevelopmentIndexBundle } from './development.ts';
import { DEVELOPMENT_BAND_FILL } from './palette.ts';

const census = statistics as unknown as CensusStatistics;
const index = developmentIndex as unknown as DevelopmentIndexBundle;
const drawnDistricts = (
  bundle as unknown as {
    objects: { districts: { geometries: { properties: { name: string } }[] } };
  }
).objects.districts.geometries.map((g) => g.properties.name);

describe('the composite that shades the map', () => {
  it('is the mean of the three rates PBS published, re-derived district by district', () => {
    // The whole of what `synthesized` promises: the figure is ours, and it is reproducible from
    // figures that are not. Named, not counted — a drift of one district is a district shaded
    // wrongly, and the name is where a maintainer has to go.
    const wrong: string[] = [];
    for (const [name, record] of Object.entries(census.districts)) {
      const expected = composite({
        literacy: record.development.literacy.rate,
        improvedWater: record.development.water.improvedShare,
        flushToilet: record.development.sanitation.flushToiletShare,
      });
      const actual = index.districts[name]?.score;
      if (actual !== expected) wrong.push(`${name}: ${String(actual)} ≠ ${expected}`);
    }
    expect(wrong).toEqual([]);
  });

  it('reaches the 136 districts the census reaches, and no others', () => {
    expect(Object.keys(index.districts).sort()).toEqual(Object.keys(census.districts).sort());
    expect(Object.keys(index.districts)).toHaveLength(136);
    // The twenty are named as absent rather than left out silently, and the artifact says why.
    expect([...index.provenance.withoutIndex.districts].sort()).toEqual(
      [...census.withoutCensusData.districts].sort(),
    );
    expect(index.provenance.withoutIndex.reason).toContain('never zero');
  });

  it('carries the badge that says the figure is nobody else’s', () => {
    expect(index.provenance.badge).toBe('synthesized');
    expect(index.provenance.notPoverty).toContain('not poverty');
    expect(index.provenance.formula).toContain('unweighted mean');
  });

  it('was computed over the census join that ships beside it', () => {
    // A composite taken over a census that has since been rebuilt is undetectable from its own
    // contents — every score would still be a plausible mean, of rates the map no longer carries.
    expect(index.provenance.statistics.generated).toBe(census.provenance.generated);
  });
});

describe('developmentFills', () => {
  const fills = developmentFills(index, census);

  it('decides every district that is drawn, and names any it cannot', () => {
    // A district drawn with no decision behind it renders as bare land, which is the "no census
    // data" treatment — so a miss here would silently claim PBS published nothing about it.
    const undecided = drawnDistricts.filter((name) => !fills.has(name));
    expect(undecided).toEqual([]);
    expect(fills.size).toBe(drawnDistricts.length);
  });

  it('shades a district by its own composite, and by nothing else', () => {
    // Fill is data, never unit membership (D14). Re-derived from the score against the band cuts
    // rather than read back off the band the artifact wrote, so the colour on the map and the
    // number in the tooltip cannot come apart.
    const wrong: string[] = [];
    for (const [name, record] of Object.entries(index.districts)) {
      const expected = bandOf(record.score).id;
      const fill = fills.get(name);
      const actual = fill?.kind === 'band' ? fill.band : null;
      if (actual !== expected) wrong.push(`${name}: ${String(actual)} ≠ ${expected}`);
      if (fill?.kind === 'band' && fill.colour !== DEVELOPMENT_BAND_FILL[expected]) {
        wrong.push(`${name} is drawn in ${fill.colour}, not the ramp's ${expected}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('leaves all twenty AJK and GB districts unshaded, as the absence they are', () => {
    // D25. Absent, never zero: a zero would paint twenty districts as the least served in Pakistan
    // on all three counts at once, which is a claim about ground Pakistan administers that this
    // app has no figure to make.
    const absent = [...fills]
      .filter(([, fill]) => fill.kind === 'no-data')
      .map(([name]) => name)
      .sort();
    expect(absent).toEqual([...census.withoutCensusData.districts].sort());
    expect(absent).toHaveLength(20);
  });

  it('has no third state, unlike the language basis, and that is a difference not an omission', () => {
    // Chitral has no dominant mother tongue because Khowar has no column; a mean of three
    // published rates always has a value, so there is nothing here for a stipple to say.
    expect([...fills.values()].filter((fill) => fill.kind === 'no-dominant')).toEqual([]);
  });

  it('refuses a band the ramp has no colour for, rather than falling back to a neutral', () => {
    const invented = {
      ...index,
      districts: { Nowhere: { score: 0.5, band: 'middling' } },
    } as unknown as DevelopmentIndexBundle;
    expect(() => developmentFills(invented, census)).toThrow(/middling/);
  });
});

describe('developmentLegend', () => {
  const legend = developmentLegend(index);

  it('keys every band, in the order the scale is read', () => {
    expect(legend.bands).toHaveLength(INDEX_BANDS.length);
    for (const [i, band] of INDEX_BANDS.entries()) {
      expect(legend.bands[i]?.label, band.id).toContain(band.label);
      expect(legend.bands[i]?.swatch).toEqual({
        kind: 'colour',
        colour: DEVELOPMENT_BAND_FILL[band.id],
      });
    }
  });

  it('counts the districts in each band, and says so where a band is empty', () => {
    // A band nothing falls in is a swatch keying nothing, and a reader matching colours to the map
    // is owed that fact rather than left to hunt for it.
    const counted = legend.bands.map((entry) => entry.label);
    for (const band of INDEX_BANDS) {
      const districts = index.provenance.counts.byBand[band.id] ?? 0;
      const entry = counted.find((label) => label.startsWith(band.label));
      expect(entry, band.id).toBe(
        districts === 0 ? `${band.label} — no district falls in this band` : `${band.label} (${districts})`,
      );
    }
    // Every band is occupied on this census, so the empty-band wording is unreachable from the
    // artifact — which is exactly why it is asserted against the counts rather than assumed.
    expect(Object.values(index.provenance.counts.byBand).every((n) => n > 0)).toBe(true);
  });

  it('says on the legend that the figure is this project’s, and what it is not', () => {
    expect(legend.lead).toContain('no published source states it');
    expect(legend.formula).toBe(index.provenance.formula);
    expect(legend.notPoverty).toContain('not poverty');
    // The words are the artifact's, not retyped here: two copies of a formula drift the first time
    // one is edited, and the copy on the page is the one a reader checks the map against.
    expect(legend.notPoverty).toBe(index.provenance.notPoverty);
  });

  it('keys the one absence this basis has, hatched like the ground beneath it', () => {
    expect(legend.absences).toHaveLength(1);
    expect(legend.absences[0]?.swatch.kind).toBe('hatch');
    expect(legend.absences[0]?.label).toContain('Gilgit-Baltistan');
  });
});
