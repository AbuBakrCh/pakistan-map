/**
 * The footer band (#32, D22) — what the exported image says when it arrives with no page behind it.
 *
 * This is the surface with the least context around it in the whole app. A card can be read beside
 * the map, the colophon under it, the About panel one tap away; a PNG in a WhatsApp thread has none
 * of those, and whatever is not baked into the pixels is gone. So the assertions here are about
 * *presence and wording*, one per thing D22 requires, and they are made against the committed
 * bundle rather than against a fixture — a band that keys a colour the map no longer draws, or
 * dates a 1947 boundary by the 2023 census, is exactly the failure that would otherwise ship.
 */

import { describe, expect, it } from 'vitest';
import geography from '../../data/bundle/geography.topojson.json';
import scenarios from '../../data/bundle/scenarios.json';
import statistics from '../../data/bundle/statistics.json';
import type {
  CensusStatistics,
  Provenance,
  ScenarioBundle,
  VariantRecord,
} from '../bundle.ts';
import {
  BAND_HATCH,
  BAND_METRICS,
  BAND_STIPPLE,
  BAND_TYPE,
  EXPORT_FAILED,
  EXPORT_LABEL,
  EXPORT_TITLE,
  EXPORT_WORKING,
  NOT_OFFICIAL,
  exportFileName,
  bandAttribution,
  bandLegend,
  bandVintage,
  exportBand,
  layoutBand,
  swatchInk,
  type BandMeasurer,
  type BandPalette,
  type BandStyle,
} from './export-band.ts';
import developmentIndex from '../../data/bundle/development-index.json';
import { populationLegend } from './administrative.ts';
import { developmentLegend, type DevelopmentIndexBundle } from './development.ts';
import { motherTongueLegend } from './mother-tongue.ts';
import { figuresWithheld } from './tooltip.ts';
import { unitLegend } from './units.ts';

const bundle = scenarios as unknown as ScenarioBundle;
const census = statistics as unknown as CensusStatistics;
const provenance = (geography as { provenance: unknown }).provenance as Provenance;
const development = developmentIndex as unknown as DevelopmentIndexBundle;

const variantNamed = (id: string): VariantRecord => {
  const found = bundle.variants.find((variant) => variant.id === id);
  if (found === undefined) throw new Error(`${id} is not a variant in the committed bundle`);
  return found;
};

const band = (
  variant: VariantRecord | null,
  shadedBy: 'language' | 'development' | null = variant?.basis === 'language'
    ? 'language'
    : variant?.basis === 'development'
      ? 'development'
      : null,
) =>
  exportBand({
    scenarios: bundle,
    statistics: census,
    geography: provenance,
    variant,
    shadedBy,
    development,
  });

/**
 * A measurer that is arithmetic rather than a browser. The layout's job is to wrap and stack; what
 * it must not do is depend on a particular font being installed, which is exactly what a test
 * asserting real glyph widths would be doing.
 */
const measure: BandMeasurer = (text, style) => text.length * BAND_TYPE[style].size * 0.5;

const palette: BandPalette = {
  paper: '#faf7f1',
  ink: '#33291d',
  inkSoft: '#6d604d',
  inkFaint: '#948773',
  land: '#ece4d5',
  landHatch: '#d8ccb6',
  accent: '#9c3b2b',
  ruleUnit: '#4a3d2c',
  ruleProvince: '#8a7c65',
  ruleBoundary: '#6e7175',
  ruleDivision: '#bfb29b',
};

describe('the six things D22 requires of the image', () => {
  const exported = band(variantNamed('l1'));

  it('names the scenario', () => {
    expect(exported.title).toBe('South Punjab Secretariat');
    expect(exported.tagline).toBe('the version that partly exists');
  });

  it('says the boundary is proposed and not official, in those words', () => {
    // The one line the whole ticket exists for. Not conditional prose and not a footnote: a
    // forwarded screenshot of a heavy accent outline over Pakistan is a claim, and this is what
    // makes it a captioned one.
    expect(exported.standing).toBe(NOT_OFFICIAL);
    expect(NOT_OFFICIAL).toContain('not official');
  });

  it('carries the provenance badge and glosses it in the image', () => {
    // A PNG has no hover, so a badge with its gloss one tap away is a badge with no gloss at all.
    expect(exported.provenance.map((b) => b.label)).toEqual(['documented']);
    for (const badge of exported.provenance) expect(badge.gloss).toContain(badge.label);
  });

  it('carries the basis the shading argues from, badged apart from the boundary', () => {
    expect(exported.basis?.label).toBe('Language / dialect');
  });

  it('carries a vintage', () => {
    expect(exported.vintage).toContain('2023');
  });

  it('carries the proposal’s own sources, and names OpenStreetMap once rather than twice', () => {
    // The documents that date and define the claim go on the Source line; the boundary pipeline's
    // Overpass endpoint does not, because the attribution line below already names OpenStreetMap
    // and its licence and a band is not wide enough to say it twice.
    expect(exported.sources.length).toBeGreaterThan(0);
    expect(exported.sources.join(' · ')).toContain('South Punjab Secretariat');
    expect(exported.sources.join(' · ')).not.toContain('overpass');
    expect(exported.attribution).toContain('OpenStreetMap');
    for (const source of exported.sources) expect(source.trim()).not.toBe('');
  });

  it('names the boundaries’ own source at the baseline, which cites no documents of its own', () => {
    const current = band(null, null);
    expect(current.sources.join(' · ')).toContain('OpenStreetMap');
  });

  it('carries the attribution the licence requires, since the pixels travel', () => {
    expect(exported.attribution).toContain('OpenStreetMap');
    expect(exported.attribution).toContain('ODbL');
    expect(exported.attribution).toContain('Pakistan Bureau of Statistics');
  });

  it('states every one of the six on every variant this build can draw', () => {
    // Named per variant rather than counted: a band that lost its vintage on one proposal and kept
    // it on five would otherwise pass on the average.
    for (const variant of bundle.variants) {
      const each = band(variant);
      expect(each.title, variant.id).toBeTruthy();
      expect(each.standing, variant.id).toBe(NOT_OFFICIAL);
      expect(each.provenance.length, variant.id).toBeGreaterThan(0);
      expect(each.vintage.trim(), variant.id).not.toBe('');
      expect(each.sources.length, variant.id).toBeGreaterThan(0);
      expect(each.legend.length, variant.id).toBeGreaterThan(0);
    }
  });
});

/*
 * The licence line is a provenance claim, and #49 found it making one for H2 that H2 disclaims:
 * every band credited its figures to the 2023 census and stamped the image "pinned to" that
 * vintage, on the one variant that publishes no figure at all because 2023 numbers do not describe
 * 1947 boundaries. Held per variant rather than once, for the reason the vintage block already
 * gives: a plausible line in the right place is a silent failure.
 */
describe('the attribution names no figure source the variant does not use (#49)', () => {
  it('credits the boundaries and the district set on every band, because every picture uses both', () => {
    // Not conditional, either half of it. The licence the boundaries come under requires the
    // attribution, so the answer to a withheld figure is never to drop the line; and the drawn
    // district set *is* the census's 2023 set under ADR-0001 whatever a boundary is dated, which is
    // why even H4 dates itself by the district set rather than by the province it argues for.
    for (const variant of [null, ...bundle.variants]) {
      const where = variant?.id ?? 'the baseline';
      const { attribution } = band(variant);
      expect(attribution, where).toContain('OpenStreetMap');
      expect(attribution, where).toContain('ODbL');
      expect(attribution, where).toContain('Pakistan Bureau of Statistics');
      expect(attribution, where).toContain('2023 Digital Census');
    }
  });

  it('credits no figures and no census vintage where the variant publishes none — per variant', () => {
    // Keyed on `figuresWithheld` (#48) rather than on H2 by name, so this holds for whatever
    // variant next declines its figures and the suite is asking the same predicate the card and the
    // tooltip ask. The vintage is asserted absent as the bundle's own string, since "pinned to" is
    // only half the claim — the date beside it is the other half.
    for (const variant of bundle.variants) {
      const { attribution } = band(variant);
      if (figuresWithheld(variant) !== null) {
        expect(attribution, variant.id).not.toContain('pinned to');
        expect(attribution, variant.id).not.toContain(census.provenance.vintage);
        expect(attribution, variant.id).not.toContain('figures: Pakistan Bureau of Statistics');
        expect(attribution, variant.id).toContain('district set');
        expect(attribution, variant.id).toContain('no census figures');
      } else {
        expect(attribution, variant.id).toContain('figures: Pakistan Bureau of Statistics');
        expect(attribution, variant.id).toContain(`pinned to ${census.provenance.vintage}`);
      }
    }
  });

  it('is exactly H2 that gets the withholding form in the shipped set', () => {
    // A form that never fires passes a test perfectly, and one that fires everywhere would strip
    // the census credit off sixteen bands that have earned it.
    const withholding = bundle.variants
      .filter((variant) => band(variant).attribution.includes('no census figures'))
      .map((variant) => variant.id);
    expect(withholding).toEqual(['h2']);
  });

  it('gives the baseline the ordinary form, which is what a held comparison gets too', () => {
    // The band describes the picture and never the selection: while compare is held the map has
    // been given the baseline whole, so the band built for it is the baseline's — and the baseline
    // is the census's own map, with nothing withheld from it.
    expect(band(null, null).attribution).toContain(`pinned to ${census.provenance.vintage}`);
    expect(bandAttribution(null, census.provenance.vintage)).toBe(band(null, null).attribution);
  });
});

describe('the vintage, and whether there is one to print at all', () => {
  const projectVintage = bundle.provenance.vintage;

  it('prints the variant’s own date where it states one', () => {
    const dated = bandVintage(
      { ...variantNamed('h1'), vintage: 'The map of 14 August 1947' },
      bundle.bases['historical'],
      projectVintage,
    );
    expect(dated).toEqual({ kind: 'own', vintage: 'The map of 14 August 1947' });
  });

  it('says a date was read at the basis rather than printing it flat', () => {
    // A boundary dated by a census the boundary has nothing to do with is the exact failure #21
    // exists to prevent, and it is invisible unless the resolution says which of the two it is.
    const exported = band(variantNamed('l1'));
    expect(exported.vintage).toContain(bundle.bases['language'].vintage);
    expect(exported.vintage).toContain('states none of its own');
    expect(exported.vintage).toContain('Language / dialect');
  });

  /*
   * The three Historical variants now date their own boundaries, which is the right fix and not
   * this module's: a proposal's date is scenario content, and the band was only ever the surface
   * that made the gap visible. What is asserted here is that each carries a *real* date and none
   * of them carries the basis's deferral — "the date of each demarcation, 1947 onward, stated per
   * variant, not shared", which is the rule for finding a date and not a date.
   */
  it('prints each Historical variant’s own demarcation date — H1 to H4', () => {
    const deferral = bundle.bases['historical'].vintage;
    expect(deferral).not.toBe(projectVintage);

    for (const [id, year] of [
      ['h1', '1955'],
      // H2 (#30) is the oldest map in the app and the one whose date is a period rather than a
      // day: the accessions run to March 1948 and the abolitions from 1955, so the band prints the
      // span. A variant that stated none would print the deferral, which is the failure this whole
      // block exists to catch.
      ['h2', '1947'],
      ['h3', '1970'],
      ['h4', '2023'],
    ] as const) {
      const exported = band(variantNamed(id));
      expect(exported.vintage, id).toContain(year);
      expect(exported.vintage, id).not.toContain(deferral);
      expect(exported.vintage, id).not.toContain('states none of its own');
    }
  });

  it('dates H4 by the district set, because H4’s boundary is not the historical one', () => {
    // The one Historical variant whose *boundary* is present-day: what is drawn is Bahawalpur
    // Division as PBS publishes it today, and the 1947–1955 province is the claim's history. A
    // vintage of 1947 here would say the app had drawn the 1947 state, which it has not — so the
    // date is the district set's, and the band says which of the two it is.
    const exported = band(variantNamed('h4'));
    expect(exported.vintage).toContain('2023');
    expect(exported.vintage).toContain('as it stands today');
    expect(exported.vintage).toContain('not its geometry');
  });

  it('still refuses a deferral for a Historical variant that states no date of its own', () => {
    // The state the shipped set can no longer demonstrate, and the one H2 will arrive in if it
    // lands undated. Written as an override of a real variant so a schema change breaks this case
    // rather than being quietly worked around by it.
    const undated = { ...variantNamed('h1') };
    delete (undated as { vintage?: string }).vintage;
    const exported = band(undated);
    expect(exported.vintage).not.toContain(bundle.bases['historical'].vintage);
    expect(exported.vintage).toContain("this proposal's own source");
  });

  it('never prints the census’s year against a boundary the census did not draw', () => {
    // Held over every Historical variant, since the failure is silent: a plausible date in the
    // right place. H4 is the stated exception and says why in its own words — it is dated by the
    // district set because that is where its line actually comes from.
    for (const variant of bundle.variants) {
      if (variant.basis !== 'historical' || variant.id === 'h4') continue;
      expect(band(variant).vintage, variant.id).not.toContain('2023 census');
    }
  });

  it('refuses to guess a date for a basis the bundle cannot name', () => {
    const orphan = { ...variantNamed('l1'), basis: 'sectarian' } as unknown as VariantRecord;
    delete (orphan as { vintage?: string }).vintage;
    expect(() => bandVintage(orphan, undefined, projectVintage)).toThrow(/sectarian/);
  });
});

describe('the baseline is a view, not the absence of one', () => {
  const exported = band(null, null);

  it('names the current map and never calls it a proposal', () => {
    // An export of the real provinces stamped "not official" would be this app disclaiming the
    // government's own geography, which is the opposite of what the disclaimer is for.
    expect(exported.title).toContain('Pakistan');
    expect(exported.standing).not.toContain('not official');
    expect(exported.standing).toContain('official');
    expect(exported.provenance.map((b) => b.label)).toEqual(['official']);
  });

  it('does not spend the accent on a map with nothing proposed on it', () => {
    // The accent means "proposed" everywhere else in this app. Setting the sentence "this is the
    // official map" in it would say the opposite of what the colour means.
    expect(exported.proposed).toBe(false);
    for (const variant of bundle.variants) expect(band(variant).proposed, variant.id).toBe(true);
  });

  it('shades nothing, so it badges no basis', () => {
    expect(exported.basis).toBeNull();
  });

  it('keys the tiers the baseline actually draws', () => {
    expect(exported.legend.map((entry) => entry.label)).toEqual([
      'Province',
      'Territory — not constitutionally a province',
      'Division',
      'Line of Control — ceasefire line, not an international border',
    ]);
  });
});

describe('the legend is derived from the map, never transcribed beside it', () => {
  it('keys every unit kind the variant contains, in the page’s own words', () => {
    for (const variant of bundle.variants) {
      const keyed = bandLegend(census, variant, null, development).map((entry) => entry.label);
      for (const entry of unitLegend(variant)) expect(keyed, variant.id).toContain(entry.label);
    }
  });

  it('keys every category the shading actually draws, and both absences', () => {
    const { onTheMap, absences } = motherTongueLegend(census);
    const keyed = bandLegend(census, variantNamed('l1'), 'language', development).map((entry) => entry.label);
    for (const entry of [...onTheMap, ...absences]) expect(keyed).toContain(entry.label);
  });

  it('keys the population ramp under the basis whose fill is a published count', () => {
    // The second of the two ramps, and it must key its own four bands rather than the other's:
    // both are four swatches in the same shape, so a band that reached for the wrong legend would
    // produce a picture that looks right and says the wrong figures under it.
    const legend = populationLegend(census);
    const keyed = bandLegend(census, variantNamed('a6'), 'administrative', development).map(
      (entry) => entry.label,
    );
    for (const entry of [...legend.bands, ...legend.absences]) expect(keyed).toContain(entry.label);
    expect(keyed).not.toContain(legend.lead);
    // And not the other ramp's rows, which is the failure this is really guarding.
    for (const entry of developmentLegend(development).bands) expect(keyed).not.toContain(entry.label);
  });

  it('keys the development ramp under the basis whose fill nobody published', () => {
    // Three of the four bases have a fill and the band derives each from the same function the
    // screen's legend is built from. The lead sentence — that no published source states this
    // figure — is deliberately not a key entry: it is the badge's gloss, and the band prints that
    // under Provenance, where a reader looks for exactly that claim.
    const legend = developmentLegend(development);
    const keyed = bandLegend(census, variantNamed('d1'), 'development', development).map(
      (entry) => entry.label,
    );
    for (const entry of [...legend.bands, ...legend.absences]) expect(keyed).toContain(entry.label);
    expect(keyed).not.toContain(legend.lead);
  });

  it('leaves off the six categories that are dominant in no district, and only those', () => {
    // On the page they are grouped at the end and cost nothing. In a band they would be six
    // swatches a reader never has to match against the picture, pushing the nine that matter onto
    // a line of their own. Named here so the omission is a decision and not a slip.
    const { namedButNowhereDominant } = motherTongueLegend(census);
    const keyed = bandLegend(census, variantNamed('l1'), 'language', development).map((entry) => entry.label);
    expect(namedButNowhereDominant.length).toBeGreaterThan(0);
    for (const entry of namedButNowhereDominant) expect(keyed).not.toContain(entry.label);
  });

  it('refuses to key a basis it has no fill for, rather than printing the wrong key', () => {
    // Three of the four have a fill. A band that answered every shadeable basis with the
    // mother-tongue key would print the wrong legend under the right badge — checkable, and wrong,
    // on the copy that travels with no page. The fourth still fails by name.
    expect(() => bandLegend(census, variantNamed('h1'), 'historical', development)).toThrow(
      /historical/,
    );
    expect(() => bandLegend(census, variantNamed('h1'), 'historical', development)).toThrow(
      /has no key for it/,
    );
  });

  it('keys the ceasefire line under every basis and at the baseline', () => {
    // The dash means ceasefire line and the export is the copy that travels furthest from the
    // page that says so. An unkeyed dash is a line a reader is entitled to read as a border.
    const dashed = (variant: VariantRecord | null, shadedBy: 'language' | null) =>
      bandLegend(census, variant, shadedBy, development).filter((e) => e.swatch.kind === 'rule' && e.swatch.rule === 'dashed');
    expect(dashed(null, null)).toHaveLength(1);
    for (const variant of bundle.variants) expect(dashed(variant, 'language'), variant.id).toHaveLength(1);
  });
});

describe('the swatches are the map’s own ink', () => {
  it('spends the accent on proposed units and on nothing else', () => {
    const proposed = swatchInk({ kind: 'unit', unit: 'proposed' }, palette);
    expect(proposed).toEqual({ shape: 'rule', stroke: palette.accent, width: 1.4, dash: null });
    for (const unit of ['unchanged', 'territory'] as const) {
      const ink = swatchInk({ kind: 'unit', unit }, palette);
      expect(ink, unit).toMatchObject({ stroke: palette.ruleUnit });
    }
  });

  it('draws the ceasefire line’s swatch dashed, or it keys a line nobody can find', () => {
    const ink = swatchInk({ kind: 'rule', rule: 'dashed' }, palette);
    expect(ink).toMatchObject({ shape: 'rule', dash: '6.5 3.5' });
  });

  it('paints the two absences as the map paints them — a stipple and a hatch, never one grey', () => {
    // One is an answer the census could not file and the other a question it did not ask here. A
    // single fill for both would say the image knows less than it does.
    const stipple = swatchInk({ kind: 'stipple' }, palette);
    const hatch = swatchInk({ kind: 'hatch' }, palette);
    expect(stipple).toMatchObject({ shape: 'block', fill: `url(#${BAND_STIPPLE})` });
    expect(hatch).toMatchObject({ shape: 'block', fill: `url(#${BAND_HATCH})` });
    expect(stipple).not.toEqual(hatch);
  });

  it('keys them with the band’s own patterns, not the map’s zoom-counter-scaled ones', () => {
    // The map's hatch is counter-scaled by 1/k so its texture survives a 24× zoom, which is right
    // inside the zoomed group and wrong in a legend: exporting from a deep zoom would collapse the
    // pitch to a fraction of a pixel and leave a swatch that keys nothing. The band defines its own
    // at a fixed pitch, so the ids must differ — sharing them is the bug.
    for (const id of [BAND_HATCH, BAND_STIPPLE]) {
      expect(id).not.toBe('territory-hatch');
      expect(id).not.toBe('no-dominant-stipple');
    }
    const territory = swatchInk({ kind: 'rule', rule: 'territory' }, palette);
    expect(territory).toMatchObject({ fill: `url(#${BAND_HATCH})` });
  });

  it('gives every swatch the band can carry an ink, on every variant', () => {
    for (const variant of [null, ...bundle.variants]) {
      for (const entry of bandLegend(census, variant, 'language', development)) {
        expect(swatchInk(entry.swatch, palette), entry.label).toBeTruthy();
      }
    }
  });
});

describe('the layout, whose height is a result and never a setting', () => {
  const laid = layoutBand(band(variantNamed('l1')), { width: 900, measure });

  it('sets every row inside the band it was laid out in', () => {
    for (const row of laid.rows) {
      if (row.kind === 'rule') continue;
      expect(row.x, JSON.stringify(row)).toBeGreaterThanOrEqual(BAND_METRICS.padding);
      expect(row.y).toBeLessThanOrEqual(laid.height);
    }
  });

  it('wraps rather than running off the edge', () => {
    const narrow = layoutBand(band(variantNamed('l1')), { width: 390, measure });
    for (const row of narrow.rows) {
      if (row.kind === 'text') {
        expect(measure(row.text, row.style)).toBeLessThanOrEqual(390 - BAND_METRICS.padding * 2);
      }
      if (row.kind === 'legend') {
        // A single legend label may be wider than a 390px band — "Proposed — …" names every unit
        // — and is set on its own line rather than truncated. What must not happen is a *second*
        // item packed onto a line that is already over.
        expect(row.x).toBeLessThan(390 - BAND_METRICS.padding);
      }
    }
  });

  it('grows taller as it grows narrower, since nothing may be clipped off the bottom', () => {
    const wide = layoutBand(band(variantNamed('l1')), { width: 1100, measure });
    const narrow = layoutBand(band(variantNamed('l1')), { width: 390, measure });
    expect(narrow.height).toBeGreaterThan(wide.height);
  });

  it('lays out every row the band asked for, losing none of them', () => {
    const content = band(variantNamed('l1'));
    const text = laid.rows.flatMap((row) => (row.kind === 'text' ? [row.text] : [])).join(' ');
    expect(text).toContain(content.title);
    expect(text).toContain(NOT_OFFICIAL);
    expect(text).toContain('Vintage:');
    expect(text).toContain('Source:');
    expect(laid.rows.filter((row) => row.kind === 'legend')).toHaveLength(content.legend.length);
  });

  it('sets the standing line above the small print, where a reader who stops reading has met it', () => {
    const text = laid.rows.filter((row) => row.kind === 'text');
    const standing = text.find((row) => row.text === NOT_OFFICIAL);
    const attribution = text[text.length - 1];
    expect(standing).toBeDefined();
    expect(standing?.y).toBeLessThan((attribution as { y: number }).y);
    // And above the key, which is the block that varies most in height.
    for (const row of laid.rows.filter((r) => r.kind === 'legend')) {
      expect((standing as { y: number }).y).toBeLessThan(row.y);
    }
  });

  it('separates the band from the map with a hairline at its very top', () => {
    const rule = laid.rows.filter((row) => row.kind === 'rule');
    expect(rule).toHaveLength(1);
    expect(rule[0]?.y).toBe(0);
  });

  it('leaves the legend labels room for their swatches', () => {
    for (const row of laid.rows) {
      if (row.kind !== 'legend') continue;
      expect(row.labelX - row.x).toBe(BAND_METRICS.swatchWidth + BAND_METRICS.swatchGap);
    }
  });

  it('survives a band with nothing to wrap and a style scale with no gaps in it', () => {
    const styles: BandStyle[] = ['title', 'tagline', 'standing', 'meta', 'legend', 'fine'];
    for (const style of styles) expect(BAND_TYPE[style].leading).toBeGreaterThanOrEqual(BAND_TYPE[style].size);
    const empty = layoutBand({ ...band(null, null), tagline: null, legend: [] }, { width: 900, measure });
    expect(empty.height).toBeGreaterThan(0);
  });
});

describe('what the reader meets before the image opens', () => {
  it('says what lands on the machine, since the screenshot key is what this competes with', () => {
    // "Download PNG" rather than "Share" or "Export": a reader who knows they are getting an image
    // file will use this instead of the screenshot key, which is the whole argument for the feature.
    expect(EXPORT_LABEL).toContain('PNG');
    expect(EXPORT_WORKING).not.toBe(EXPORT_LABEL);
    // The title names what is baked in, so the promise is on the control and not only in the file.
    for (const promised of ['name', 'key', 'sources', 'vintage']) {
      expect(EXPORT_TITLE, promised).toContain(promised);
    }
    // Never silence: a button that does nothing reads as a broken page rather than a failed export.
    expect(EXPORT_FAILED.trim()).not.toBe('');
    expect(EXPORT_FAILED).toContain('map itself is unaffected');
  });

  it('names the file after the proposal, and the baseline after what it is', () => {
    expect(exportFileName(variantNamed('l1'))).toBe('pakistan-l1-south-punjab-secretariat.png');
    expect(exportFileName(null)).toBe('pakistan-current-provinces.png');
  });

  it('gives every variant a distinct, safe file name', () => {
    // A folder of these is the point — two proposals sharing a name would silently overwrite, and a
    // slug carrying a slash or a space is a download that fails on someone else's operating system.
    const names = bundle.variants.map(exportFileName);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name, name).toMatch(/^[a-z0-9-]+\.png$/);
  });
});
