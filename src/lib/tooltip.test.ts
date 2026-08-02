import { describe, expect, it } from 'vitest';
import bundle from '../../data/bundle/geography.topojson.json';
import statistics from '../../data/bundle/statistics.json';
import type { CensusStatistics, UnitKind } from '../bundle.ts';
import { readDistricts, type ProvinceKind } from './geography.ts';
import {
  districtTooltip,
  placeTooltip,
  spokenTooltip,
  type DistrictTooltip,
  type UnitMembership,
} from './tooltip.ts';

const census = statistics as unknown as CensusStatistics;
const districts = readDistricts(bundle as never);
const kinds = new Map<string, ProvinceKind>(
  (
    bundle as unknown as {
      objects: { provinces: { geometries: { properties: { name: string; kind: ProvinceKind } }[] } };
    }
  ).objects.provinces.geometries.map((g) => [g.properties.name, g.properties.kind]),
);

const tooltipFor = (name: string, membership: UnitMembership | null = null): DistrictTooltip => {
  const feature = districts.features.find((f) => f.properties.name === name);
  if (feature === undefined) throw new Error(`${name} is not drawn`);
  const kind = kinds.get(feature.properties.province);
  if (kind === undefined) throw new Error(`${feature.properties.province} has no kind`);
  return districtTooltip(feature.properties, kind, census, membership);
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
