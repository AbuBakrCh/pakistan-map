/**
 * Compute the development composite and bake it (#31).
 *
 *   npm run build:data:development
 *
 * Emits `data/bundle/development-index.json`: one score and one band per census district, the
 * formula that produced them, and the bands they fall in.
 *
 * **A separate artifact from the census join, deliberately.** `statistics.json` is PBS's own
 * figures and nothing else — the three development rates in it are published columns over
 * published denominators — and this file is the one figure in the whole app that nobody published.
 * Writing it in there would put a `synthesized` number inside an artifact every other surface
 * reads as `census`, one field away from the rates it is a mean of; `join-census.ts` says so in
 * its own header and has said so since #11. So the composite lives where a reader can see that it
 * was computed, with the rule beside it and its own build date on it.
 *
 * **And it is baked rather than computed on the page**, on the scorecard's reasoning (#20): a
 * figure the runtime derived is a figure nobody reviewed, and it would be derived twice besides —
 * once to shade a district and once to draw D1's boundary — which is two answers to one number.
 * The suite re-derives the whole file from the committed census on every run, which is what makes
 * the badge honest.
 *
 * Fails on a census district with no development block, on a rate that is not a proportion, and on
 * a district set that is not the 136 the census covers — each naming the district.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INDEX_BANDS,
  INDEX_COMPONENTS,
  INDEX_FORMULA,
  NOT_A_POVERTY_MEASURE,
  indexDistricts,
  type PublishedRates,
} from './lib/development-index.ts';
import { CENSUS_DISTRICTS, CENSUS_DISTRICT_COUNT, ROSTER } from './lib/roster.ts';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const STATISTICS_FILE = resolve(ROOT, 'data/bundle/statistics.json');
const OUT_FILE = resolve(ROOT, 'data/bundle/development-index.json');

const STATISTICS_BUNDLE = 'data/bundle/statistics.json';

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

interface StatisticsFile {
  readonly provenance?: { readonly generated?: string; readonly vintage?: string };
  readonly development?: { readonly source?: string };
  readonly districts?: Record<
    string,
    {
      readonly development?: {
        readonly literacy?: { readonly rate?: unknown };
        readonly water?: { readonly improvedShare?: unknown };
        readonly sanitation?: { readonly flushToiletShare?: unknown };
      };
    }
  >;
}

function main(): void {
  const statistics = JSON.parse(readFileSync(STATISTICS_FILE, 'utf8')) as StatisticsFile;
  const districts = statistics.districts ?? {};

  // Named, never counted, exactly as `build-scenarios.ts` does it: "135 where 136 were expected"
  // sends a maintainer to diff two artifacts by hand, and the district that is missing is the
  // whole of what the failure has to say.
  const missing = CENSUS_DISTRICTS.filter((district) => districts[district] === undefined);
  const unexpected = Object.keys(districts).filter(
    (district) => !CENSUS_DISTRICTS.includes(district),
  );
  if (missing.length > 0 || unexpected.length > 0) {
    fail(
      `${STATISTICS_BUNDLE} does not cover the ${CENSUS_DISTRICT_COUNT} districts of the 2023 ` +
        `census, so the composite would be computed over a different Pakistan from the one the ` +
        `map draws.` +
        (missing.length === 0 ? '' : ` Missing: ${missing.join(', ')}.`) +
        (unexpected.length === 0 ? '' : ` Not census districts: ${unexpected.join(', ')}.`),
    );
  }

  const rates = new Map<string, PublishedRates>();
  const withoutRates: string[] = [];
  for (const district of CENSUS_DISTRICTS) {
    const development = districts[district]?.development;
    const literacy = development?.literacy?.rate;
    const improvedWater = development?.water?.improvedShare;
    const flushToilet = development?.sanitation?.flushToiletShare;
    if (
      typeof literacy !== 'number' ||
      typeof improvedWater !== 'number' ||
      typeof flushToilet !== 'number'
    ) {
      withoutRates.push(district);
      continue;
    }
    rates.set(district, { literacy, improvedWater, flushToilet });
  }
  if (withoutRates.length > 0) {
    fail(
      `${withoutRates.length} census district(s) carry no development rates in ` +
        `${STATISTICS_BUNDLE}, so no composite can be taken over them and they would be shaded ` +
        `as an absence the census does not have: ${withoutRates.join(', ')}. Run ` +
        `npm run build:data:census first.`,
    );
  }

  const { districts: indexed, problems } = indexDistricts(rates);
  if (problems.length > 0) {
    fail(
      `${problems.length} problem(s) computing the development composite. Every rate it averages ` +
        `is a published count over its own published denominator, so a value outside 0–1 is not a ` +
        `low score but a broken one:\n` +
        problems.map((problem) => `    ${problem}`).join('\n'),
    );
  }

  const lowest = indexed[0];
  const highest = indexed[indexed.length - 1];
  if (lowest === undefined || highest === undefined) fail('the composite came out over no district');

  const byBand = Object.fromEntries(
    INDEX_BANDS.map((band) => [band.id, indexed.filter((d) => d.band === band.id).length]),
  );
  const empty = INDEX_BANDS.filter((band) => byBand[band.id] === 0);
  if (empty.length > 0) {
    // Not fatal, and said out loud: a band nothing falls in is a legend entry keying nothing, and
    // a reader matching swatches to the map is entitled to know which one that is.
    console.log(
      `  note: ${empty.map((band) => band.label).join(', ')} — no district falls in this band`,
    );
  }

  const territories = ROSTER.filter((entry) => entry.kind === 'territory');

  const artifact = {
    provenance: {
      generated: new Date().toISOString(),
      vintage: '2023 census (as on 01-03-2023) — geometry and statistics both, per ADR-0001',
      unit: 'district',
      joinsTo: `${STATISTICS_BUNDLE} and data/bundle/geography.topojson.json, on the district \`name\` property`,
      // The one badge in the app that means "this project's own figure". It is not `census`: PBS
      // publishes the three rates and publishes no index over them, and a composite wearing a
      // census badge would be our arithmetic passed off as somebody's published statistic.
      badge: 'synthesized',
      what:
        'The composite the Development basis shades districts by. One number per district, ' +
        'derived from three rates PBS published and from nothing else.',
      formula: INDEX_FORMULA,
      notPoverty: NOT_A_POVERTY_MEASURE,
      components: INDEX_COMPONENTS,
      bands: INDEX_BANDS.map((band) => ({ ...band, districts: byBand[band.id] ?? 0 })),
      bandMethod:
        'Fixed cuts at round numbers, not quantiles. Quantile bands would make a district’s ' +
        'colour a function of every other district’s score — one district moving would repaint ' +
        'another — and would make the legend a property of the distribution rather than of the ' +
        'figure. Fixed cuts mean the legend says the same thing at every vintage. Four bands and ' +
        'not five, because a sequential ramp on this paper has about 0.14 of OKLab lightness to ' +
        'spend between the tone an unshaded district keeps and the point where a unit outline ' +
        'stops reading over it.',
      range: {
        lowest: { district: lowest.district, score: lowest.score },
        highest: { district: highest.district, score: highest.score },
      },
      counts: { districts: indexed.length, byBand },
      withoutIndex: {
        reason:
          `PBS published the 2023 census for ${CENSUS_DISTRICT_COUNT} districts — the four ` +
          `provinces and Islamabad — and for no district of ` +
          `${territories.map((entry) => entry.name).join(' or ')} (D25). None of the three rates ` +
          `exists for them, so none of them has a composite: absent, never zero, which would ` +
          `shade twenty districts as the least served in Pakistan on all three counts at once.`,
        districts: territories.flatMap((entry) => entry.districts),
      },
      statistics: {
        // The stamp of the census join these scores were taken from, on the reasoning the outlines
        // and the adjacency graph carry the geometry's: this file is *numbers*, and a stale one is
        // undetectable from its own contents — every score would still be a plausible mean, of
        // rates that had since been rebuilt.
        generated: statistics.provenance?.generated ?? null,
        districts: Object.keys(districts).length,
      },
      sources: {
        rates: statistics.development?.source ?? '',
        statistics: `${STATISTICS_BUNDLE} — the three published rates this composite is the mean of`,
        formula: 'scripts/lib/development-index.ts — the rule, stated once and read by every surface',
      },
    },
    /** District -> its composite and its band. Ascending by score, as `indexDistricts` sorts them. */
    districts: Object.fromEntries(
      indexed.map((district) => [district.district, { score: district.score, band: district.band }]),
    ),
  };

  mkdirSync(resolve(OUT_FILE, '..'), { recursive: true });
  writeFileSync(OUT_FILE, `${JSON.stringify(artifact, null, 2)}\n`);

  console.log(
    `\n✓ ${OUT_FILE.replace(`${ROOT}/`, '')} — ${indexed.length} districts, ` +
      `${lowest.district} lowest at ${lowest.score.toFixed(3)}, ` +
      `${highest.district} highest at ${highest.score.toFixed(3)}`,
  );
  for (const band of INDEX_BANDS) {
    console.log(`  ${band.label.padEnd(14)} ${String(byBand[band.id] ?? 0).padStart(3)} districts`);
  }
}

main();
