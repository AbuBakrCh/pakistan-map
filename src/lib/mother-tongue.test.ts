import { describe, expect, it } from 'vitest';
import bundle from '../../data/bundle/geography.topojson.json';
import statistics from '../../data/bundle/statistics.json';
import type { CensusStatistics } from '../bundle.ts';
import { motherTongueFills, motherTongueLegend } from './mother-tongue.ts';
import { MOTHER_TONGUE_CATEGORIES, motherTongueFill } from './palette.ts';

const census = statistics as unknown as CensusStatistics;
const drawnDistricts = (bundle as unknown as {
  objects: { districts: { geometries: { properties: { name: string } }[] } };
}).objects.districts.geometries.map((g) => g.properties.name);

describe('motherTongueFills', () => {
  const fills = motherTongueFills(census);

  it('decides every district that is drawn, and names any it cannot', () => {
    // A district drawn with no decision behind it renders as bare land, which is the "no census
    // data" treatment — so a miss here would silently claim PBS published nothing about it.
    const undecided = drawnDistricts.filter((name) => !fills.has(name));
    expect(undecided).toEqual([]);
    expect(fills.size).toBe(drawnDistricts.length);
  });

  it('shades a district by its dominant mother tongue and nothing else', () => {
    // Fill is data, never unit membership (D14). The check that says so: every category fill
    // agrees with the census figure in the artifact, district by district.
    const wrong: string[] = [];
    for (const [name, record] of Object.entries(census.districts)) {
      const fill = fills.get(name);
      const expected = record.motherTongue.dominant;
      const actual = fill?.kind === 'category' ? fill.category : null;
      if (actual !== expected) wrong.push(`${name}: ${String(actual)} ≠ ${String(expected)}`);
    }
    expect(wrong).toEqual([]);
  });

  it('says the census names no dominant language in Chitral, rather than guessing one', () => {
    // Khowar has no column in Table 11, so `Others` holds 99.8% of Upper Chitral. Handing the
    // label to the largest named category would print "Upper Chitral: Urdu" over a district
    // where 150 people out of 195,161 speak it.
    const unnamed = [...fills]
      .filter(([, fill]) => fill.kind === 'no-dominant')
      .map(([name]) => name)
      .sort();
    expect(unnamed).toEqual(['Lower Chitral', 'Upper Chitral']);
    expect(unnamed).toEqual(
      census.motherTongue.districtsWithoutNamedDominant.map((d) => d.district).sort(),
    );
  });

  it('leaves all twenty AJK and GB districts unshaded, as a different absence', () => {
    // D25. Absent, not zero, and not the same absence as Chitral: one is a question the census
    // did not ask here, the other an answer it could not file.
    const absent = [...fills]
      .filter(([, fill]) => fill.kind === 'no-data')
      .map(([name]) => name)
      .sort();
    expect(absent).toEqual([...census.withoutCensusData.districts].sort());
    expect(absent).toHaveLength(20);
  });

  it('refuses a dominant category the palette has no colour for', () => {
    const invented = {
      ...census,
      districts: {
        Nowhere: { ...Object.values(census.districts)[0]!, motherTongue: {
          dominant: 'Khowar', dominantShare: 1, residualShare: 0, counted: 1, speakers: {},
        } },
      },
    } as unknown as CensusStatistics;
    expect(() => motherTongueFills(invented)).toThrow(/Khowar/);
  });
});

describe('motherTongueLegend', () => {
  const legend = motherTongueLegend(census);

  it('accounts for all fifteen categories between its two colour rows', () => {
    const shown = [...legend.onTheMap, ...legend.namedButNowhereDominant].map((e) =>
      e.label.split(' — ')[0],
    );
    expect(shown.sort()).toEqual([...MOTHER_TONGUE_CATEGORIES].sort());
  });

  it('puts every colour the map actually uses in the first row', () => {
    const used = new Set(
      [...motherTongueFills(census).values()].flatMap((f) =>
        f.kind === 'category' ? [f.category] : [],
      ),
    );
    expect(legend.onTheMap.map((e) => e.label).sort()).toEqual([...used].sort());
    // The nine the census names somewhere. `Others` can never be among them — the pipeline
    // excludes the residual from dominance — and neither can a language nobody's district leads.
    expect(legend.onTheMap).toHaveLength(9);
    expect(legend.namedButNowhereDominant.map((e) => e.label)).toContain(
      'Others — a residual, not a language',
    );
  });

  it('carries the right swatch colour for each category', () => {
    for (const entry of [...legend.onTheMap, ...legend.namedButNowhereDominant]) {
      const category = entry.label.split(' — ')[0] as keyof typeof motherTongueFill;
      expect(entry.swatch).toEqual({ kind: 'colour', colour: motherTongueFill[category] });
    }
  });

  it('gives each absence its own entry, and its own treatment', () => {
    expect(legend.absences.map((e) => e.swatch.kind)).toEqual(['stipple', 'hatch']);
    expect(legend.absences[0]?.label).toContain('Chitral');
    expect(legend.absences[1]?.label).toContain('Gilgit-Baltistan');
  });
});
