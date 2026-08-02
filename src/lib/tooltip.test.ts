import { describe, expect, it } from 'vitest';
import bundle from '../../data/bundle/geography.topojson.json';
import statistics from '../../data/bundle/statistics.json';
import developmentIndex from '../../data/bundle/development-index.json';
import type { CensusStatistics, UnitKind } from '../bundle.ts';
import { readDistricts, type ProvinceKind } from './geography.ts';
import {
  districtTooltip,
  placeTooltip,
  spokenTooltip,
  type DistrictShading,
  type DistrictTooltip,
  type UnitMembership,
} from './tooltip.ts';
import type { DevelopmentIndexBundle } from './development.ts';
import { groupDigits } from './figures.ts';

const census = statistics as unknown as CensusStatistics;
const districts = readDistricts(bundle as never);
const kinds = new Map<string, ProvinceKind>(
  (
    bundle as unknown as {
      objects: { provinces: { geometries: { properties: { name: string; kind: ProvinceKind } }[] } };
    }
  ).objects.provinces.geometries.map((g) => [g.properties.name, g.properties.kind]),
);

const index = developmentIndex as unknown as DevelopmentIndexBundle;

/**
 * The Development basis's answer for one district, as `main.ts` assembles it from the committed
 * composite (#31). Null where the index does not reach the district, which is the twenty.
 */
const shadingFor = (name: string): DistrictShading | null => {
  const record = index.districts[name];
  if (record === undefined) return null;
  return {
    basis: 'development',
    score: record.score,
    bandLabel:
      index.provenance.bands.find((band) => band.id === record.band)?.label ?? record.band,
    formula: index.provenance.formula,
    badge: index.provenance.badge,
    components: index.provenance.components as DistrictShading['components'],
  };
};

const tooltipFor = (
  name: string,
  membership: UnitMembership | null = null,
  shading: DistrictShading | null = null,
): DistrictTooltip => {
  const feature = districts.features.find((f) => f.properties.name === name);
  if (feature === undefined) throw new Error(`${name} is not drawn`);
  const kind = kinds.get(feature.properties.province);
  if (kind === undefined) throw new Error(`${feature.properties.province} has no kind`);
  return districtTooltip(feature.properties, kind, census, membership, shading);
};

/** The active variant's answer, as `main.ts` assembles it from the scenario bundle. */
const inUnit = (
  name: string,
  kind: UnitKind,
  universe: 'drawn' | 'census' = 'drawn',
): UnitMembership => ({
  variant: 'South Punjab Secretariat',
  universe,
  unit: { name, kind },
});

const figure = (tooltip: DistrictTooltip, label: string) =>
  tooltip.figures.find((f) => f.label === label);

describe('districtTooltip — a district the census counted', () => {
  const lahore = tooltipFor('Lahore');

  it('names the district, its division and its province', () => {
    expect(lahore.name).toBe('Lahore');
    expect(lahore.division).toBe('Lahore');
    expect(lahore.province).toBe('Punjab');
    expect(lahore.standing).toBe('Province');
  });

  it('shows the published population exactly, grouped and never rounded', () => {
    // Typed from the artifact rather than read back through the code path under test. Exact,
    // never interpolated: a district population is a figure this app publishes about Pakistan.
    expect(figure(lahore, 'Population')?.value).toBe('13,004,135');
  });

  it('shows the dominant mother tongue with the share it actually holds', () => {
    const tongue = figure(lahore, 'Dominant mother tongue');
    expect(tongue?.value).toBe('Punjabi');
    // 0.735759 of the 12,978,661 Table 11 counted — not of the district's population, which is
    // a different and larger universe. The note says which, because the two do not agree.
    expect(tongue?.note).toBe('73.6% of the 12,978,661 the census counted');
  });

  it('cites a source for every figure it prints', () => {
    // No unsourced surface anywhere, tooltips included — and the two figures come from two
    // different PBS releases, so one badge over both would be wrong.
    expect(figure(lahore, 'Population')?.source).toBe('PBS 2023 Digital Census');
    expect(figure(lahore, 'Dominant mother tongue')?.source).toBe('PBS Census-2023 Table 11');

    // Both badges are the short form of the artifact's own citation, so a tooltip cannot come to
    // name a release the bundle was not built from.
    const sources = (statistics as unknown as { provenance: { sources: Record<string, string> } })
      .provenance.sources;
    expect(sources['census']).toMatch(/Census 2023 \(Digital Census\)/);
    expect(census.motherTongue.source.startsWith('PBS Census-2023 Table 11')).toBe(true);
  });

  it('says nothing about an absence, because there is none', () => {
    expect(lahore.coverage).toBe('counted');
    expect(lahore.absence).toBeNull();
  });
});

describe('districtTooltip — a district the census counted and could not answer for', () => {
  const upper = tooltipFor('Upper Chitral');
  const lower = tooltipFor('Lower Chitral');

  it('still carries the population, because that figure exists', () => {
    // The absence is in one column, not in the district. Dropping the population here would
    // make Chitral look uncounted, which is AJK's situation and not Chitral's.
    expect(upper.coverage).toBe('counted');
    expect(figure(upper, 'Population')?.value).toBe('195,528');
  });

  it('refuses to name a dominant language the census did not name', () => {
    const tongue = figure(upper, 'Dominant mother tongue');
    expect(tongue?.value).toBeNull();
    expect(tongue?.note).toBe(
      'The census names none: 99.8% of those counted fall under Others, which is a residual and ' +
        'not a language.',
    );
    // Handing the label to the largest named category would print "Upper Chitral: Urdu" over a
    // district where 150 people in 195,161 speak it.
    expect(tongue?.note).not.toContain('Urdu');
    expect(tongue?.value).not.toBe('Others');
  });

  it('quotes each district its own residual, rather than one sentence for both', () => {
    expect(figure(lower, 'Dominant mother tongue')?.note).toContain('87.8%');
  });
});

describe('districtTooltip — a district the census never reached', () => {
  const muzaffarabad = tooltipFor('Muzaffarabad');
  const gilgit = tooltipFor('Gilgit');

  it('names it and says the census does not cover it', () => {
    // D25. It must read as coverage, not as a zero and not as a load that failed.
    expect(muzaffarabad.name).toBe('Muzaffarabad');
    expect(muzaffarabad.province).toBe('Azad Jammu & Kashmir');
    expect(muzaffarabad.standing).toBe('Territory — not constitutionally a province');
    expect(muzaffarabad.coverage).toBe('not-counted');
    expect(muzaffarabad.absence).toMatch(/does not cover it/);
    expect(muzaffarabad.absence).toMatch(/PBS publishes no/);
  });

  it('prints no figure at all rather than an empty or zero one', () => {
    expect(muzaffarabad.figures).toEqual([]);
    expect(gilgit.figures).toEqual([]);
  });

  it('is a different absence from Chitral, and worded differently', () => {
    // One is a question the census did not ask here; the other an answer it could not file. A
    // single "N/A" over both would say the map knows less than it does.
    const chitral = figure(tooltipFor('Upper Chitral'), 'Dominant mother tongue')?.note;
    expect(chitral).not.toBe(muzaffarabad.absence);
    expect(chitral).not.toMatch(/does not cover/);
    expect(muzaffarabad.absence).not.toMatch(/residual/);
  });
});

describe('districtTooltip — a district under a variant that attaches no 2023 figures (#30)', () => {
  /** H2's own reason, as `main.ts` reads it off the bundle and hands it to the tooltip. */
  const REASON =
    'This map is the boundaries of 1947 to 1955. The 2023 census counted people inside districts ' +
    'that did not exist then, in states that had been abolished for sixty-eight years, so its ' +
    'figures describe none of the units drawn here.';
  const withholding = (name: string, kind: UnitKind = 'proposed'): UnitMembership => ({
    variant: 'Provinces and princely states',
    universe: 'drawn',
    unit: { name, kind },
    withholds: REASON,
  });

  const bahawalpur = tooltipFor('Bahawalpur', withholding('Bahawalpur'));

  it('prints no population, which is the whole of what the ticket forbids', () => {
    // The defect this exists to prevent: the tooltip's figures were variant-blind, so tapping a
    // district under H2 printed its 2023 count with the 1947 unit named beside it.
    expect(bahawalpur.figures).toEqual([]);
    expect(bahawalpur.coverage).toBe('withheld');
    expect(bahawalpur.absence).toBe(REASON);
  });

  it('drops the mother tongue with it, because that note quotes a headcount too', () => {
    // Decided rather than inherited: Table 11 is as much a 2023 measurement as Table 1, and the
    // dominant-tongue note states its share "of the N the census counted" — so printing it under
    // the sentence saying there are no figures would leave a 2023 headcount on screen.
    expect(figure(bahawalpur, 'Dominant mother tongue')).toBeUndefined();
    expect(figure(bahawalpur, 'Population')).toBeUndefined();
  });

  it('still names the district, its address and its unit — it withholds figures, not facts', () => {
    expect(bahawalpur.name).toBe('Bahawalpur');
    expect(bahawalpur.province).toBe('Punjab');
    expect(bahawalpur.unit?.value).toBe('Bahawalpur');
    // And the sentence a screen reader gets carries both the reason and the unit.
    const spoken = spokenTooltip(bahawalpur);
    expect(spoken).toContain('1947');
    expect(spoken).toContain('Bahawalpur');
  });

  it('is a third absence, worded apart from the two the tooltip already tells apart', () => {
    /*
     * The rule this module is built on: an absence is said in the words of whatever is missing it.
     * Three of them now, and no two may share a sentence —
     *   Muzaffarabad  the census never reached it (D25), true under every variant;
     *   Upper Chitral it reached it and named no dominant tongue;
     *   Bahawalpur    it reached it and *this variant* declines to attach the answer.
     */
    const muzaffarabad = tooltipFor('Muzaffarabad');
    const chitral = figure(tooltipFor('Upper Chitral'), 'Dominant mother tongue')?.note;
    expect(bahawalpur.absence).not.toBe(muzaffarabad.absence);
    expect(bahawalpur.absence).not.toBe(chitral);
    expect(bahawalpur.absence).not.toMatch(/does not cover|residual/);
    expect(muzaffarabad.absence).not.toMatch(/1947/);
  });

  it('defers to the census where the census never reached, so the reason stays true', () => {
    // Hunza is a unit of H2 *and* one of the twenty districts PBS published nothing for. There is
    // no figure here for a variant to withhold, and saying one was withheld would describe the
    // census as reaching ground it does not — the same order `card.ts` asks these two in.
    const hunza = tooltipFor('Hunza', withholding('Hunza'));
    expect(hunza.coverage).toBe('not-counted');
    expect(hunza.absence).toMatch(/does not cover it/);
    expect(hunza.figures).toEqual([]);
  });

  it('leaves every other variant’s tooltips exactly as they were', () => {
    // The change is keyed on the variant's own policy, so a membership without one is untouched.
    const underL1 = tooltipFor('Bahawalpur', inUnit('South Punjab', 'proposed'));
    expect(underL1.coverage).toBe('counted');
    expect(figure(underL1, 'Population')?.value).toBeTruthy();
    expect(figure(underL1, 'Dominant mother tongue')?.value).toBeTruthy();
  });
});

describe('districtTooltip — over the whole drawn set', () => {
  const all = districts.features.map((f) => tooltipFor(f.properties.name));

  it('answers for every one of the 156 drawn districts', () => {
    expect(all).toHaveLength(156);
    expect(all.filter((t) => t.name === '' || t.province === '')).toEqual([]);
  });

  it('treats exactly the twenty AJK and GB districts as uncounted, and names them', () => {
    const uncounted = all
      .filter((t) => t.coverage === 'not-counted')
      .map((t) => t.name)
      .sort();
    expect(uncounted).toEqual([...census.withoutCensusData.districts].sort());
    expect(uncounted).toHaveLength(20);
  });

  it('never prints a zero or a blank where a figure is missing', () => {
    // The failure mode this whole module exists to prevent: an absent population rendered as 0,
    // which is a claim about Azad Kashmir that PBS never made.
    const wrong = all.flatMap((t) =>
      t.figures.flatMap((f) =>
        f.value === '' || f.value === '0' ? [`${t.name}: ${f.label} = "${String(f.value)}"`] : [],
      ),
    );
    expect(wrong).toEqual([]);
  });

  it("never names Others as a district's dominant language", () => {
    const residual = all.filter((t) => figure(t, 'Dominant mother tongue')?.value === 'Others');
    expect(residual.map((t) => t.name)).toEqual([]);
  });

});

describe('districtTooltip — the third thing a hover names', () => {
  it('says nothing about a unit at the baseline, where there is none', () => {
    expect(tooltipFor('Lahore').unit).toBeNull();
  });

  it('names a proposed province as proposed, twice over', () => {
    // Once in the label and once in the note. This is the only line in the app where a boundary
    // that does not exist is named in the same box as two that do, so it says which is which
    // rather than leaving a reader to infer it from a colour.
    const multan = tooltipFor('Multan', inUnit('South Punjab', 'proposed')).unit;
    expect(multan?.label).toBe('Proposed province');
    expect(multan?.value).toBe('South Punjab');
    expect(multan?.note).toBe('South Punjab Secretariat — proposed, not official');
    expect(multan?.kind).toBe('proposed');
  });

  it('says a province the variant leaves alone is unchanged', () => {
    // Without this, a reader hovering Lahore under an active variant cannot tell whether the
    // proposal moved it or left it — and the map looks identical either way.
    const lahore = tooltipFor('Lahore', inUnit('Punjab', 'unchanged')).unit;
    expect(lahore?.value).toBe('Punjab');
    expect(lahore?.note).toBe('Unchanged from the current map');
    expect(lahore?.label).not.toContain('Proposed');
  });

  it('keeps a territory a territory inside a variant', () => {
    const muzaffarabad = tooltipFor('Muzaffarabad', inUnit('Azad Jammu & Kashmir', 'territory'));
    expect(muzaffarabad.unit?.note).toBe(
      'Territory, unchanged — not constitutionally a province',
    );
    // The census absence and the unit line are two different statements and both are made.
    expect(muzaffarabad.absence).toMatch(/does not cover it/);
    expect(muzaffarabad.figures).toEqual([]);
  });

  it('says a census-universe variant leaves a district in no unit, rather than leaving a blank', () => {
    const outside = tooltipFor('Gilgit', {
      variant: 'South Punjab Secretariat',
      universe: 'census',
      unit: null,
    }).unit;
    expect(outside?.value).toBeNull();
    expect(outside?.kind).toBeNull();
    expect(outside?.note).toContain('In no unit');
    expect(outside?.note).toContain('136 districts');
  });

  it('calls a gap in a drawn-universe partition a gap, rather than a statement about the ground', () => {
    // Unreachable through a valid bundle — the partition validator refuses it — which is exactly
    // why the sentence has to exist: if it is ever seen, it must not read as an editorial claim
    // that this district belongs to nobody.
    const gap = tooltipFor('Gilgit', {
      variant: 'South Punjab Secretariat',
      universe: 'drawn',
      unit: null,
    }).unit;
    expect(gap?.note).toContain('gap in the partition');
    expect(gap?.note).not.toContain('136 districts');
  });
});

describe('spokenTooltip', () => {
  // `role="img"` on the map makes the live region the only hover surface a screen reader gets,
  // so these are not a convenience copy of the tooltip — they are what that reader is told.
  it('speaks the figures a district has', () => {
    const spoken = spokenTooltip(tooltipFor('Lahore'));
    expect(spoken).toContain('Lahore, Lahore division, Punjab');
    expect(spoken).toContain('Population');
    expect(spoken).toContain('Dominant mother tongue Punjabi');
  });

  it('speaks the reason a territory has none, rather than a label with nothing after it', () => {
    const spoken = spokenTooltip(tooltipFor('Muzaffarabad'));
    expect(spoken).toContain('The 2023 census does not cover it');
    expect(spoken).not.toMatch(/Population\s*\.?$/);
    expect(spoken).not.toContain('Population ');
  });

  it('speaks the unit last, after what the census counted', () => {
    const spoken = spokenTooltip(tooltipFor('Multan', inUnit('South Punjab', 'proposed')));
    expect(spoken).toContain('Proposed province South Punjab');
    expect(spoken.indexOf('Population')).toBeLessThan(spoken.indexOf('Proposed province'));
  });

  it('speaks the unit for a district with no figures at all', () => {
    // The twenty uncounted districts are the ones a reader is most likely to be checking a
    // proposal's edge against, so the absence branch must not swallow the unit line.
    const spoken = spokenTooltip(
      tooltipFor('Muzaffarabad', inUnit('Azad Jammu & Kashmir', 'territory')),
    );
    expect(spoken).toContain('The 2023 census does not cover it');
    expect(spoken).toContain('Azad Jammu & Kashmir');
  });

  it("speaks Chitral's absent dominant tongue as the note, never as a bare label", () => {
    const spoken = spokenTooltip(tooltipFor('Upper Chitral'));
    expect(spoken).toContain('The census names none');
    // The bug this guards: a null value printed as "Dominant mother tongue: " and then nothing.
    expect(spoken).not.toContain('Dominant mother tongue:');
  });
});

describe('placeTooltip', () => {
  const bounds = { width: 900, height: 600 };
  const size = { width: 240, height: 120 };
  const options = { gap: 14, margin: 8 };
  const place = (x: number, y: number) => placeTooltip([x, y], size, bounds, options);

  it('sets the tooltip below and to the right of the pointer, clear of it', () => {
    expect(place(400, 300)).toEqual({ x: 414, y: 314, flippedX: false, flippedY: false });
  });

  it('flips to the left of the pointer rather than running off the right edge', () => {
    const placed = place(800, 300);
    expect(placed.flippedX).toBe(true);
    expect(placed.x).toBe(800 - 14 - 240);
    expect(placed.x + size.width).toBeLessThanOrEqual(bounds.width - options.margin);
  });

  it('flips above the pointer rather than running off the bottom edge', () => {
    const placed = place(400, 560);
    expect(placed.flippedY).toBe(true);
    expect(placed.y).toBe(560 - 14 - 120);
    expect(placed.y + size.height).toBeLessThanOrEqual(bounds.height - options.margin);
  });

  it('flips both ways in the bottom-right corner', () => {
    expect(place(880, 580)).toEqual({ x: 626, y: 446, flippedX: true, flippedY: true });
  });

  it('stays inside the frame wherever the pointer goes', () => {
    const escaped: string[] = [];
    for (let x = 0; x <= bounds.width; x += 25) {
      for (let y = 0; y <= bounds.height; y += 25) {
        const placed = place(x, y);
        if (
          placed.x < options.margin ||
          placed.y < options.margin ||
          placed.x + size.width > bounds.width - options.margin ||
          placed.y + size.height > bounds.height - options.margin
        ) {
          escaped.push(`${x},${y} → ${placed.x},${placed.y}`);
        }
      }
    }
    expect(escaped).toEqual([]);
  });

  it('clamps rather than disappearing when the tooltip is wider than the frame', () => {
    // 390px is the hard responsive bar, and a tooltip can be wider than the well it sits in.
    // Clamped to the margin is legible; placed off-screen is a tooltip that does not exist.
    const placed = placeTooltip([300, 20], { width: 420, height: 90 }, { width: 390, height: 300 }, options);
    expect(placed.x).toBe(options.margin);
    expect(placed.y).toBe(34);
  });
});

describe('the Development basis explains its own fill on hover (#31)', () => {
  const lahore = tooltipFor('Lahore', null, shadingFor('Lahore'));
  const record = census.districts['Lahore'];
  if (record === undefined) throw new Error('Lahore is not in the census');

  it('shows the composite and all three components, so the composite is never alone', () => {
    // The acceptance criterion, and the reason for it: the composite is the one figure in this app
    // that nobody published, and a number defined by us with only a colour to explain it is the
    // exact shape of unsourced surface the working agreement forbids.
    expect(lahore.figures.map((f) => f.label)).toEqual([
      'Population',
      'Development index',
      'Literacy (10+)',
      'Improved drinking water',
      'Households with a flush toilet',
      'Dominant mother tongue',
    ]);
  });

  it('quotes each component against its own denominator, which the three do not share', () => {
    // Literacy is over people aged 10 and above; the other two are over the housing tables'
    // households. A share quoted against the wrong denominator is a wrong share.
    expect(figure(lahore, 'Literacy (10+)')?.note).toContain(
      groupDigits(record.development.literacy.population10Plus),
    );
    expect(figure(lahore, 'Improved drinking water')?.note).toContain(
      groupDigits(record.development.water.households),
    );
    expect(figure(lahore, 'Households with a flush toilet')?.note).toContain(
      groupDigits(record.development.sanitation.households),
    );
    expect(figure(lahore, 'Literacy (10+)')?.value).toBe(
      `${(record.development.literacy.rate * 100).toFixed(1)}%`,
    );
  });

  it('names the third component for the column PBS actually publishes', () => {
    // The one place the ticket's wording and the census part company. There is no
    // improved-sanitation column, and the tooltip says so where the figure is rather than leaving
    // the correction to a card the reader may never open.
    const sanitation = figure(lahore, 'Households with a flush toilet');
    expect(sanitation?.note).toContain('no improved-sanitation column');
    expect(lahore.figures.map((f) => f.label).join(' ')).not.toContain('Improved sanitation');
  });

  it('sources the composite as ours and each component as the census’s', () => {
    // No unsourced surface anywhere, and the composite's source is the honest one: it has none but
    // this project. Each rate keeps the PBS table it was published in.
    expect(figure(lahore, 'Development index')?.source).toContain('synthesized');
    expect(figure(lahore, 'Development index')?.source).toContain('no published figure states it');
    expect(figure(lahore, 'Literacy (10+)')?.source).toBe('PBS Census-2023 Table 12');
    expect(figure(lahore, 'Improved drinking water')?.source).toBe('PBS Census-2023 Table 23');
    expect(figure(lahore, 'Households with a flush toilet')?.source).toBe('PBS Census-2023 Table 24');
  });

  it('prints the formula and the band on the composite’s own line', () => {
    const composite = figure(lahore, 'Development index');
    expect(composite?.value).toBe(`${(index.districts['Lahore']!.score * 100).toFixed(1)}%`);
    expect(composite?.note).toContain('on the map');
    expect(composite?.note).toContain('unweighted mean');
  });

  it('never calls it poverty, on any district', () => {
    // #31's last acceptance criterion, held over every district the basis shades rather than over
    // one: the census sees service access, and a tooltip that used the other word would be this
    // app publishing a claim about income it has no figure for.
    for (const name of Object.keys(index.districts)) {
      const words = tooltipFor(name, null, shadingFor(name))
        .figures.map((f) => `${f.label} ${f.note ?? ''} ${f.source ?? ''}`)
        .join(' ');
      expect(words.toLowerCase(), name).not.toContain('poverty');
      expect(words.toLowerCase(), name).not.toContain('poor');
    }
  });

  it('says the census does not reach the twenty, rather than shading them zero', () => {
    // The shading is null for these because the index does not reach them, and the tooltip's
    // census-coverage branch answers first — so a reader hovering Neelum under this basis is told
    // about the census's coverage and not about a composite that was never taken.
    const neelum = tooltipFor('Neelum', null, shadingFor('Neelum'));
    expect(shadingFor('Neelum')).toBeNull();
    expect(neelum.coverage).toBe('not-counted');
    expect(neelum.figures).toEqual([]);
    expect(neelum.absence).toContain('census');
  });

  it('leaves every other basis’s tooltip exactly as it was', () => {
    // Additive, and checked to be: the development figures arrive only when the development basis
    // is shading, so a reader on the language basis sees the two lines they have always seen.
    const plain = tooltipFor('Lahore');
    expect(plain.figures.map((f) => f.label)).toEqual(['Population', 'Dominant mother tongue']);
  });

  it('is dropped whole where the variant withholds figures, like every other figure', () => {
    // A variant that attaches no 2023 figures attaches none of these either — the composite is a
    // mean of 2023 rates, and three of them beside a boundary of 1947 would be the same claim the
    // withholding exists to refuse.
    const withheld = tooltipFor(
      'Lahore',
      { ...inUnit('Punjab', 'proposed'), withholds: 'this map is older than the census' },
      shadingFor('Lahore'),
    );
    expect(withheld.coverage).toBe('withheld');
    expect(withheld.figures).toEqual([]);
  });
});
