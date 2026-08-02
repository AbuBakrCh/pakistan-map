/**
 * The "About the data" panel (#21), over the bundles that actually ship.
 *
 * The panel exists so that the app's central claim — no unsourced surface anywhere — is checkable
 * by a reader rather than only by us. That makes its own completeness a property worth holding:
 * a row with a source and no vintage, a badge with no gloss, or a discrepancy section that quietly
 * lost the one figure PBS does not explain would each turn the audit surface into a surface that
 * cannot be audited.
 *
 * Run against `data/bundle/` like the rest of the suite, so what is checked is the panel a reader
 * gets and not a panel assembled from fixtures.
 */

import { describe, expect, it } from 'vitest';
import geographyBundle from '../../data/bundle/geography.topojson.json';
import contextBundle from '../../data/bundle/context.topojson.json';
import statisticsBundle from '../../data/bundle/statistics.json';
import scenariosBundle from '../../data/bundle/scenarios.json';
import outlinesBundle from '../../data/bundle/unit-outlines.json';
import developmentIndex from '../../data/bundle/development-index.json';
import type {
  CensusStatistics,
  Provenance,
  ProvenanceBadge,
  ScenarioBundle,
  UnitOutlineBundle,
} from '../bundle.ts';
import { aboutTheData, readableDate, type AboutInputs } from './about.ts';
import { PROVENANCE_GLOSS } from './card.ts';
import { groupDigits } from './figures.ts';
import type { ContextProvenance } from './context.ts';
import type { DevelopmentIndexBundle } from './development.ts';

const inputs: AboutInputs = {
  geography: (geographyBundle as { provenance: unknown }).provenance as Provenance,
  context: (contextBundle as { provenance: unknown }).provenance as ContextProvenance,
  census: statisticsBundle as unknown as CensusStatistics,
  scenarios: scenariosBundle as unknown as ScenarioBundle,
  outlines: outlinesBundle as unknown as UnitOutlineBundle,
  index: developmentIndex as unknown as DevelopmentIndexBundle,
};

const about = aboutTheData(inputs);
const vocabulary = Object.keys(PROVENANCE_GLOSS) as ProvenanceBadge[];

describe('readableDate — one date, one face', () => {
  it('sets an ISO stamp as a date a reader can say out loud', () => {
    // Written out rather than left to `toLocaleDateString`, which answers to the browser's locale:
    // 01/08/2026 and 8/1/2026 are the same stamp naming two different days.
    expect(readableDate('2026-08-01T17:19:09.764Z')).toBe('1 August 2026');
    expect(readableDate('2023-03-01T00:00:00Z')).toBe('1 March 2023');
    expect(readableDate('2026-12-31T23:59:59Z')).toBe('31 December 2026');
  });

  it('hands back anything it cannot read, rather than inventing a date for it', () => {
    // A stamp is provenance. Guessing at an unreadable one would print a build date that no file
    // carries, which is worse on this panel than on any other.
    expect(readableDate('not a date')).toBe('not a date');
    expect(readableDate('2026-13-01')).toBe('2026-13-01');
    expect(readableDate('')).toBe('');
  });
});

describe('the bundle generation date, per artifact', () => {
  it('stamps every committed artifact the runtime reads, and none it does not', () => {
    // Six files are imported by `bundle.ts` and drawn from; each is baked by its own build and
    // carries its own date, which is the whole reason they are listed apart rather than summed
    // into one "generated" line. The last is the development composite (#31), which has a build of
    // its own precisely because it is not the census.
    expect(about.built.stamps.map((stamp) => stamp.iso)).toEqual([
      inputs.geography.generated,
      inputs.context.generated,
      inputs.census.provenance.generated,
      inputs.scenarios.provenance.generated,
      inputs.outlines.provenance.generated,
      inputs.index.provenance.generated,
    ]);
  });

  it('gives every stamp a label and both forms of its date', () => {
    for (const stamp of about.built.stamps) {
      expect(stamp.label, stamp.iso).toBeTruthy();
      // The exact stamp is what matches the file; the readable one is what matches the reader.
      expect(stamp.date, stamp.iso).toBe(readableDate(stamp.iso));
      expect(stamp.iso, stamp.label).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
});

describe('every basis on the panel carries a badge, a source and a vintage', () => {
  it('offers all four and leaves none of the three blank', () => {
    expect(about.bases.items).toHaveLength(4);
    const missing = about.bases.items.flatMap((basis) => [
      ...(basis.source.trim() === '' ? [`${basis.name}: no source`] : []),
      ...(basis.vintage.trim() === '' ? [`${basis.name}: no vintage`] : []),
      ...(basis.badges.length === 0 ? [`${basis.name}: no badge`] : []),
    ]);
    expect(missing).toEqual([]);
  });

  it('glosses every basis badge on the panel itself, never in a hover title', () => {
    // The hard bar is a 390px phone, where a `title` is reachable by nothing — and the panel that
    // explains the badges is the last surface allowed to hide one behind a hover.
    for (const basis of about.bases.items) {
      for (const badge of basis.badges) {
        expect(vocabulary, `${basis.name}: ${badge.label}`).toContain(badge.label);
        expect(badge.gloss, badge.label).toContain(badge.label);
      }
    }
  });
});

describe('every source on the panel carries a badge, a source and a vintage', () => {
  it('leaves none of the three blank on any row, naming the row', () => {
    const missing = about.sources.items.flatMap((row) => [
      ...(row.what.trim() === '' ? ['a row with no subject'] : []),
      ...(row.source.trim() === '' ? [`${row.what}: no source`] : []),
      ...(row.vintage.trim() === '' ? [`${row.what}: no vintage`] : []),
      ...(row.badges.length === 0 ? [`${row.what}: no badge`] : []),
    ]);
    expect(missing).toEqual([]);
  });

  it('reaches every surface the map draws', () => {
    // Named rather than counted: a row lost to a renamed key in the bundle would leave a drawn
    // surface unsourced, which is the one thing this panel exists to make impossible.
    const rows = about.sources.items.map((row) => row.what).join('\n');
    for (const surface of [
      'Provinces, territories and divisions',
      'District boundaries',
      'Coastline',
      'Line of Control',
      'Neighbour silhouettes',
      'City dots',
      'Population',
      'District areas',
      'Mother tongue',
      'Development',
      'Development index',
      'Proposed unit outlines',
    ]) {
      expect(rows, surface).toContain(surface);
    }
  });

  it('is the one row on the panel that is not somebody else’s figure, and says so (#31)', () => {
    // Every other source here is a document or a published table. The composite is this project's
    // own, and the panel that exists to let a reader check the "no unsourced surface" claim is the
    // last place it could be allowed to look like the census's.
    const index = about.sources.items.find((row) => row.what.startsWith('Development index'));
    expect(index?.badges.map((badge) => badge.label)).toEqual(['synthesized']);
    expect(index?.caveat).toContain('unweighted mean');
    expect(index?.caveat).toContain('not poverty');
    // Dated by the census it is a function of, never by the day the arithmetic ran.
    expect(index?.vintage).toBe(inputs.census.provenance.vintage);
    // And it appears again among the discrepancies, because the failure it invites is not a
    // disagreement between sources but a reader taking it for one.
    const stated = about.discrepancies.items.find((item) =>
      item.label.includes('this project’s figure'),
    );
    expect(stated?.text).toContain('not poverty');
  });

  it('says the district areas are published rather than measured off the map (#49)', () => {
    // The row a card now prints from, on the one variant that withholds its populations. This
    // build measures its own polygons and knows they disagree with PBS — the clip took half of
    // Gwadar — so a reader has to be able to see which of the two a printed figure is.
    const areas = about.sources.items.find((row) => row.what.startsWith('District areas'));
    expect(areas?.badges.map((badge) => badge.label)).toEqual(['census']);
    expect(areas?.caveat).toMatch(/never measured/i);
    expect(areas?.source).toContain('Table 1');
    expect(areas?.vintage).toBe(inputs.census.provenance.vintage);
  });

  it('badges every row from the closed vocabulary and glosses each on the panel', () => {
    for (const row of about.sources.items) {
      for (const badge of row.badges) {
        expect(vocabulary, `${row.what}: ${badge.label}`).toContain(badge.label);
        expect(badge.gloss, badge.label).toContain(badge.label);
      }
    }
  });

  it('badges the Line of Control derived, because nobody published it as a line', () => {
    // It is a segment of a boundary this map already draws, selected by identity (#7, D12).
    // `documented` would claim a source that does not exist for it.
    const loc = about.sources.items.find((row) => row.what.startsWith('Line of Control'));
    expect(loc?.badges.map((badge) => badge.label)).toEqual(['derived']);
    expect(loc?.source).toContain('Jammu and Kashmir');
    expect(loc?.caveat).toMatch(/ceasefire line/);
    // The two things about it that are most often got wrong, said rather than left to be assumed.
    expect(loc?.caveat).toMatch(/Working Boundary/);
    expect(loc?.caveat).toMatch(/Siachen/);
  });

  it('dates a boundary by OpenStreetMap and a figure by the census, never one by the other', () => {
    // The vintage on a row is the vintage of the *data*. OSM's own edit dates and PBS's census are
    // years apart, and printing the census's under a boundary would say the border was surveyed by
    // a census.
    const boundaries = about.sources.items.find((row) =>
      row.what.startsWith('Provinces, territories'),
    );
    const population = about.sources.items.find((row) => row.what.startsWith('Population'));
    expect(boundaries?.vintage).toContain('OpenStreetMap as at');
    expect(boundaries?.vintage).toBe(
      `OpenStreetMap as at ${readableDate(inputs.geography.osmBaseTimestamp['province'] ?? '')}`,
    );
    expect(population?.vintage).toBe(inputs.census.provenance.vintage);
    expect(boundaries?.vintage).not.toBe(population?.vintage);
  });

  it('never dates a source by the date the bundle was built', () => {
    // The two are printed in different sections for a reason, and confusing them would say a
    // census was taken on the afternoon somebody ran the build.
    const built = about.built.stamps.map((stamp) => stamp.date);
    for (const row of about.sources.items) {
      for (const date of built) {
        expect(row.vintage, row.what).not.toBe(date);
      }
    }
  });
});

describe('the discrepancies, which are the point of the panel', () => {
  const text = about.discrepancies.items.map((item) => `${item.label} ${item.figure} ${item.text}`).join('\n');

  it('states the gap between Table 11 and Table 1 in people, not in prose alone', () => {
    // 240,458,089 against 241,499,431 — a difference PBS shares with Table 10 and does not
    // explain. Read off the artifact, and asserted as the figure a reader would see.
    const gap = about.discrepancies.items.find((item) => item.label.includes('Table 11'));
    expect(gap?.figure).toBe('1,041,342 people');
    expect(gap?.figure).toBe(
      `${groupDigits(
        inputs.census.motherTongue.universe.population -
          inputs.census.motherTongue.universe.counted,
      )} people`,
    );
    expect(gap?.text).toMatch(/does not explain|not reconciled|Stated here/);
  });

  it('states the improved-water difference in households, exactly rather than tolerated', () => {
    const water = about.discrepancies.items.find((item) => item.label.includes('improved water'));
    expect(water?.figure).toBe('6,374 households');
    expect(inputs.census.development.improvedWaterDifference.difference).toBe(6374);
  });

  it('says there is no improved-sanitation column, so the shaded share is flush toilets', () => {
    expect(text).toMatch(/no improved-sanitation/i);
    expect(text).toMatch(/flush/);
  });

  it('says the rates do not share a denominator, and by how many households', () => {
    // 48,010 fewer households in the housing tables than in the district table, in all 136
    // districts. Quoted from the artifact rather than retyped, so the figure has one home.
    expect(text).toContain('48,010');
  });

  it('says where PBS’s own two releases put people in different districts', () => {
    // Found by transcribing Table 1's areas (#49): its populations disagree with the census
    // package's in eight districts, four cancelling pairs of neighbours. It changes no figure this
    // app publishes, which is exactly why it could have been left off — and a panel that listed
    // the tables and hid where they disagree is the failure this section exists to prevent.
    const both = about.discrepancies.items.find((item) => item.label.includes('Table 1 and its'));
    expect(both?.figure).toBe('8 districts');
    expect(both?.text).toContain('cancels within its province');
    expect(Object.keys(inputs.census.area.transcription.differences.byDistrict)).toHaveLength(8);
  });

  it('says the division totals are a cross-check and not a second source', () => {
    // The strongest-looking check in the project and the weakest: a division figure wrong in the
    // package would agree with itself and pass. A panel that listed it beside the Table 1 anchors
    // without saying so would overstate what has been verified.
    expect(text).toMatch(/division/i);
    expect(text).toMatch(/cross-table|cross-check|not an independent source/i);
  });

  it("carries the geometry's own disagreements with PBS's published areas", () => {
    // The Indus delta and the de-facto line in Kashmir — the two places the drawn area and the
    // published area measure different things, in the build's own words rather than summarised.
    expect(text).toMatch(/Indus delta|creek/);
    expect(text).toMatch(/line of control|de-facto/i);
    for (const limitation of inputs.geography.knownLimitations) {
      expect(text).toContain(limitation);
    }
  });

  it('gives every discrepancy a label and a body, and a figure only where one is published', () => {
    for (const item of about.discrepancies.items) {
      expect(item.label, item.label).toBeTruthy();
      expect(item.text, item.label).toBeTruthy();
      // Never an estimate and never a rounding: a figure here is one an artifact carries.
      if (item.figure !== null) expect(item.figure, item.label).toMatch(/^[\d,]+ \w+$/);
    }
  });
});

describe('what the panel says about itself', () => {
  it('states the claim it exists to let a reader check', () => {
    expect(about.lead).toMatch(/unsourced/);
    // The zero-network property (D19) is half of what makes the audit meaningful: these files are
    // what shipped, and a boundary cannot move between two page loads.
    expect(about.lead).toMatch(/committed|no network|not fetched/i);
  });

  it('states the one vintage, and what it knowingly costs', () => {
    expect(about.vintage.statement).toBe(inputs.geography.vintage);
    // The map is stale on purpose and says so, rather than being caught at it.
    expect(about.vintage.consequence).toMatch(/8 July 2026/);
    expect(about.vintage.consequence).toMatch(/ADR-0001/);
    // The twenty districts with no census row at all, counted off the artifact.
    expect(about.vintage.consequence).toContain(
      String(inputs.census.withoutCensusData.districts.length),
    );
  });

  it('says what it leaves off and where the rest of it is', () => {
    // A panel that quietly omitted the reconciliation tables would be doing the thing it accuses
    // a source list of doing. Named, with the file they are in.
    expect(about.omitted).toMatch(/SHA-256|digest/i);
    expect(about.omitted).toMatch(/reconcil/i);
    expect(about.omitted).toContain('data/bundle/statistics.json');
  });

  it('attributes every lineage it draws from', () => {
    const licences = about.licences.join('\n');
    expect(licences).toMatch(/OpenStreetMap/);
    expect(licences).toMatch(/ODbL/);
    expect(licences).toMatch(/GPL-2/);
    expect(licences).toMatch(/pbs\.gov\.pk|Bureau of Statistics/);
  });
});

describe('the panel when a bundle is short of something', () => {
  it('reports a missing source key as a gap rather than throwing on it', () => {
    // The panel is the surface a reader reaches for when something looks wrong. Refusing to
    // render because one key of one artifact is absent would answer that with a blank page — and
    // the emptiness is caught by the completeness assertions above, on the real bundle, which is
    // where a missing key is a defect.
    const stripped: AboutInputs = {
      ...inputs,
      geography: { ...inputs.geography, sources: {} },
    };
    expect(() => aboutTheData(stripped)).not.toThrow();
    const rows = aboutTheData(stripped).sources.items;
    expect(rows).toHaveLength(about.sources.items.length);
  });

  it('prints each basis’s own vintage rather than the bundle header’s, which is not the same string', () => {
    // This replaced a test that asserted the opposite. `basis.vintage` was briefly optional with a
    // fallback to `provenance.vintage`, and the fallback was a silent wrong answer rather than a
    // graceful one: the header carries the *census* vintage, and Historical's boundaries are
    // documented demarcations from 1947 onward, which is explicitly not the census. A basis short
    // of the field now fails to typecheck against the bundle rather than rendering a confident
    // date nobody baked. The panel exists so a reader can audit us; a guess defeats the whole
    // surface.
    const baked = new Map(
      Object.values(inputs.scenarios.bases).map((basis) => [basis.name, basis.vintage]),
    );
    for (const basis of about.bases.items) {
      expect(basis.vintage, basis.name).toBeTruthy();
      expect(basis.vintage, basis.name).toBe(baked.get(basis.name));
    }

    const historical = inputs.scenarios.bases['historical'];
    expect(historical.vintage).not.toBe(inputs.scenarios.provenance.vintage);
    expect(about.bases.items.find((basis) => basis.name === historical.name)?.vintage).toBe(
      historical.vintage,
    );
  });
});
