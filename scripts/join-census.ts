/**
 * Join the PBS 2023 Digital Census onto the 2023 district set (#9, #10, #11).
 *
 *   npm run build:data:census
 *
 * Emits `data/bundle/statistics.json`, keyed on the same district ids the geography bundle
 * draws, so the two artifacts join on a string and nothing has to be matched at runtime.
 *
 * Kept apart from the geometry build on purpose. The repo already splits its pipeline by
 * failure mode — network flakiness must not contaminate geometry work — and a census join is a
 * third mode: it fails on *names and arithmetic*, which is a different kind of wrong from a
 * torn ring and wants a different artifact and a different diff.
 *
 * The build stops on any of:
 *   - a census row that matches no district, or a district no census row covers;
 *   - a district population that does not sum to the division total published above it;
 *   - a province, or the national total, that the districts do not sum to;
 *   - a mother-tongue column that does not sum to the province figure PBS printed for it;
 *   - a development count — literate people, households, improved water, toilets — that does not
 *     sum to the province figure PBS printed for it.
 *
 * The totals check is the strongest one available: a fold that double-counts a district or a
 * name that resolved to the wrong one lands as an exact arithmetic difference rather than as a
 * plausible-looking number nobody queries. Its two tiers are not equally strong, and the
 * artifact says so per row. The five province totals and the national total are typed from PBS
 * Census-2023 Table 1 — outside the PakPC2023 package, so they check the package as well as the
 * join. The 31 division totals come from that same package's division table: a cross-table
 * consistency check, which would still pass if the package were wrong the same way twice. PBS
 * publishes no division tier in Table 1, so no external anchor exists at that tier.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CENSUS_LANGUAGES,
  RESIDUAL_CATEGORY,
  joinMotherTongue,
  sumLanguages,
  sumLanguagesByProvince,
  zeroedLanguages,
  type LanguageTotals,
  type MotherTongueRow,
} from './lib/mother-tongue.ts';
import {
  LITERACY_LITERATE_VAR,
  LITERACY_POPULATION_VAR,
  RECONCILED_FIELDS,
  householdDenominatorConflicts,
  joinDevelopment,
  sumDevelopmentByProvince,
  type FieldTotals,
  type LiteracyRow,
  type SanitationRow,
  type WaterRow,
} from './lib/development.ts';
import {
  joinCensus,
  reconcileTotals,
  resolveCensusDivision,
  resolveCensusProvince,
  sumBy,
  type CensusRow,
  type Discrepancy,
} from './lib/census.ts';
import {
  TABLE_1_POPULATION_DELTAS,
  joinAreas,
  reconcileTranscription,
  sumAreasByProvince,
  type AreaRow,
} from './lib/areas.ts';
import {
  CENSUS_DISTRICT_COUNT,
  POST_CENSUS_DISTRICT_FOLDS,
  POST_CENSUS_FOLD_TABLE,
  ROSTER,
  ROSTER_DISTRICT_COUNT,
} from './lib/roster.ts';
import districtAreas from '../data/reference/pbs-table-1-district-areas.json' with { type: 'json' };
import { decompressRData, readDataFrames, type Cell, type DataFrame } from './lib/rdata.ts';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const RAW_DIR = resolve(ROOT, 'data/raw');
const OUT_FILE = resolve(ROOT, 'data/bundle/statistics.json');

/**
 * The census cache, as published. PBS releases the 2023 results primarily as PDF; `PakPC2023`
 * (CRAN, GPL-2) is its structured republication, and these are that package's own `.RData`
 * tables committed byte-for-byte. Committing the upstream file rather than a transcription is
 * what makes the numbers checkable: nobody has to trust that a human copied 136 populations out
 * of a PDF correctly.
 */
const CACHE = {
  district: { file: 'pakpc2023-district.RData', frame: 'PakPC2023PakDist' },
  division: { file: 'pakpc2023-division.RData', frame: 'PakPC2023PakDiv' },
  province: { file: 'pakpc2023-province.RData', frame: 'PakPC2023Pak' },
  // Table 11 is the one table the package ships xz-compressed rather than gzip; `rdata.ts`
  // unwraps it, which is why reading the cache is asynchronous.
  motherTongue: { file: 'pakpc2023-table-11.RData', frame: 'TABLE_11' },
  // The three development indicators (#11), each its own published table and each, like Table
  // 11, tehsil-level only. All three ship xz-compressed for the same reason Table 11 does.
  literacy: { file: 'pakpc2023-table-12.RData', frame: 'TABLE_12' },
  water: { file: 'pakpc2023-table-23.RData', frame: 'TABLE_23' },
  sanitation: { file: 'pakpc2023-table-24.RData', frame: 'TABLE_24' },
} as const;

const SOURCE_URLS = {
  census: 'https://www.pbs.gov.pk — Pakistan Population Census 2023 (Digital Census)',
  censusPackage:
    'PakPC2023 0.2.0 (CRAN; https://github.com/myaseen208/PakPC2023) — structured republication',
  censusPackageLicence: 'GPL-2',
  publishedTotals:
    'https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_1_national.pdf' +
    ' — PBS Census-2023 Table 1 (national): area, population by sex, sex ratio, density, urban ' +
    'proportion, household size and growth rate',
  motherTongue:
    'PBS Census-2023 Table 11 — population by mother tongue, sex and rural/urban. Published at ' +
    'tehsil level in PakPC2023 (object TABLE_11); the province and national figures checked ' +
    'against are typed from https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/' +
    'table_11_national.pdf',
  development:
    'PBS Census-2023 Table 12 (literacy rate, enrolment and out-of-school population by sex and ' +
    'rural/urban), Table 23 (housing facilities by source of drinking water by region) and ' +
    'Table 24 (housing characteristics, facilities of toilet and washroom used by households, ' +
    'rural/urban). Published at tehsil level in PakPC2023 (objects TABLE_12, TABLE_23, ' +
    'TABLE_24); the province figures checked against are typed from ' +
    'https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_12_national.pdf, ' +
    'table_23_national.pdf and table_24_national.pdf',
  // Area is the one Table 1 column PakPC2023 does not republish (#49), so it is transcribed from
  // the province district tables PBS publishes Table 1 as, and committed. Same source, same table
  // and same vintage as the population beside it — reached a different way because the structured
  // release drops the column, which is stated here rather than left to be inferred from a
  // reference file appearing in the tree.
  areas: 'data/reference/pbs-table-1-district-areas.json — PBS Census-2023 Table 1, by province',
  folds: 'data/reference/post-census-district-folds.json',
  roster:
    'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf',
} as const;

/**
 * Province totals as PBS published them, typed from Census-2023 Table 1.
 *
 * Duplicated on purpose. Everything else in this build is reconciled against the `PakPC2023`
 * package's own division and province tables, which is a check on the join but not on the
 * package — if its district rows and its province rows were both wrong in the same way, they
 * would still agree with each other. These six figures come from PBS directly and are the one
 * place the pipeline is anchored outside the package.
 */
const PUBLISHED_PROVINCE_TOTALS: Readonly<Record<string, number>> = {
  Punjab: 127_688_922,
  Sindh: 55_696_147,
  'Khyber Pakhtunkhwa': 40_856_097,
  Balochistan: 14_894_402,
  'Islamabad Capital Territory': 2_363_863,
};
const PUBLISHED_NATIONAL_TOTAL = 241_499_431;

/**
 * Table 11 as PBS printed it, typed from `table_11_national.pdf` — every category, for each
 * province and for Pakistan.
 *
 * This is the anchor that makes summing tehsils into districts safe. The package publishes
 * Table 11 at tehsil level only, so the district tier this project needs does not exist upstream
 * and has to be added up; adding up the wrong tehsil, or dropping one, would produce a district
 * distribution that looks entirely plausible. Checking the sums against these figures catches it
 * — and column by column rather than on the total, because a tehsil assigned to the wrong
 * district within a province moves whole languages while leaving the total untouched.
 *
 * Six rows of sixteen figures each, and they check each other: the fifteen categories sum to the
 * printed total in every row, and the five provinces sum to Pakistan in every column.
 */
const PUBLISHED_MOTHER_TONGUE: Readonly<Record<string, Readonly<LanguageTotals>>> = {
  Punjab: {
    Urdu: 9_143_466,
    Punjabi: 85_309_591,
    Sindhi: 352_686,
    Pushto: 2_387_378,
    Balochi: 1_063_324,
    Kashmiri: 155_088,
    Saraiki: 26_282_637,
    Hindko: 779_667,
    Brahvi: 3_506,
    Shina: 16_161,
    Balti: 12_922,
    Mewati: 1_035_687,
    Kalasha: 793,
    Kohiostani: 21_910,
    Others: 768_489,
  },
  Sindh: {
    Urdu: 12_409_745,
    Punjabi: 2_265_471,
    Sindhi: 33_462_299,
    Pushto: 2_955_893,
    Balochi: 1_208_147,
    Kashmiri: 53_249,
    Saraiki: 913_418,
    Hindko: 830_581,
    Brahvi: 265_769,
    Shina: 22_273,
    Balti: 27_193,
    Mewati: 57_059,
    Kalasha: 777,
    Kohiostani: 14_885,
    Others: 1_151_650,
  },
  'Khyber Pakhtunkhwa': {
    Urdu: 259_925,
    Punjabi: 99_485,
    Sindhi: 10_019,
    Pushto: 32_919_592,
    Balochi: 30_636,
    Kashmiri: 6_471,
    Saraiki: 1_288_200,
    Hindko: 3_815_327,
    Brahvi: 1_570,
    Shina: 70_140,
    Balti: 858,
    Mewati: 93,
    Kalasha: 5_632,
    Kohiostani: 996_182,
    Others: 1_136_990,
  },
  Balochistan: {
    Urdu: 77_249,
    Punjabi: 86_457,
    Sindhi: 555_198,
    Pushto: 4_955_245,
    Balochi: 5_811_185,
    Kashmiri: 7_352,
    Saraiki: 319_054,
    Hindko: 24_204,
    Brahvi: 2_507_157,
    Shina: 1_278,
    Balti: 846,
    Mewati: 285,
    Kalasha: 82,
    Kohiostani: 1_014,
    Others: 215_405,
  },
  'Islamabad Capital Territory': {
    Urdu: 358_922,
    Punjabi: 1_154_540,
    Sindhi: 21_362,
    Pushto: 415_838,
    Balochi: 4_503,
    Kashmiri: 51_920,
    Saraiki: 46_270,
    Hindko: 140_780,
    Brahvi: 668,
    Shina: 7_099,
    Balti: 10_315,
    Mewati: 1_095,
    Kalasha: 182,
    Kohiostani: 5_016,
    Others: 64_734,
  },
};

/**
 * Table 11's own universe: 240,458,089, which is **1,041,342 short of the census population**.
 *
 * Not an error, and not something this build reconciles. PBS prints the same universe for
 * Table 10 (nationality), so the two published tables agree with each other and disagree with
 * Table 1 by a figure PBS does not explain. Reported in the artifact as a stated difference
 * rather than closed by inventing a residual category — the shares this app shades by are shares
 * of the universe the table itself publishes.
 */
const PUBLISHED_MOTHER_TONGUE_NATIONAL: Readonly<LanguageTotals> = {
  Urdu: 22_249_307,
  Punjabi: 88_915_544,
  Sindhi: 34_401_564,
  Pushto: 43_633_946,
  Balochi: 8_117_795,
  Kashmiri: 274_080,
  Saraiki: 28_849_579,
  Hindko: 5_590_559,
  Brahvi: 2_778_670,
  Shina: 116_951,
  Balti: 52_134,
  Mewati: 1_094_219,
  Kalasha: 7_466,
  Kohiostani: 1_039_007,
  Others: 3_337_268,
};

/**
 * Tables 12, 23 and 24 as PBS printed them, typed from the three `*_national.pdf` files — every
 * count this join needs, for each province.
 *
 * Counts, never the published rates. A province literacy rate is not the mean of its districts'
 * rates but literate people over people, so the only way to check a district-summed rate against
 * a published one is to check both of its halves; and the published tehsil percentages could not
 * be checked at all, since PBS prints no district or province percentage in the structured
 * release. Everything here is `TOTAL` / `ALL LOCALITIES` — the rural and urban rows partition it.
 *
 * Like the mother-tongue anchors, these are typed from outside the `PakPC2023` package, so they
 * check the package as well as the join. They check each other too: `flushToilet`,
 * `nonFlushToilet` and `noToilet` sum to `households` in all five provinces, and the five
 * provinces sum to the national row in every column.
 */
const PUBLISHED_DEVELOPMENT: Readonly<Record<string, Readonly<FieldTotals>>> = {
  Punjab: {
    population10Plus: 93_413_721,
    literate10Plus: 61_882_702,
    households: 19_839_980,
    improvedWater: 19_160_917,
    flushToilet: 17_509_551,
    nonFlushToilet: 445_394,
    noToilet: 1_885_035,
    separateToilet: 14_841_995,
  },
  Sindh: {
    population10Plus: 38_984_258,
    literate10Plus: 22_431_392,
    households: 9_862_870,
    improvedWater: 9_163_579,
    flushToilet: 6_966_086,
    nonFlushToilet: 989_556,
    noToilet: 1_907_228,
    separateToilet: 5_787_942,
  },
  'Khyber Pakhtunkhwa': {
    population10Plus: 28_225_473,
    literate10Plus: 14_420_285,
    households: 5_861_457,
    improvedWater: 4_818_817,
    flushToilet: 4_758_147,
    nonFlushToilet: 512_441,
    noToilet: 590_869,
    separateToilet: 3_799_527,
  },
  Balochistan: {
    population10Plus: 9_294_080,
    literate10Plus: 3_904_799,
    households: 2_317_256,
    improvedWater: 1_654_052,
    flushToilet: 1_240_123,
    nonFlushToilet: 541_355,
    noToilet: 535_778,
    separateToilet: 1_206_153,
  },
  'Islamabad Capital Territory': {
    population10Plus: 1_797_000,
    literate10Plus: 1_508_916,
    households: 410_993,
    improvedWater: 397_065,
    flushToilet: 396_553,
    nonFlushToilet: 10_330,
    noToilet: 4_110,
    separateToilet: 371_815,
  },
};

const PUBLISHED_DEVELOPMENT_NATIONAL: Readonly<FieldTotals> = {
  population10Plus: 171_714_532,
  literate10Plus: 104_148_094,
  households: 38_292_556,
  improvedWater: 35_194_430,
  flushToilet: 30_870_460,
  nonFlushToilet: 2_499_076,
  noToilet: 4_923_020,
  separateToilet: 26_007_432,
};

/**
 * The one column where PBS's two releases disagree with each other, per province.
 *
 * Seven of the eight counts above reconcile **exactly**: the tehsil rows of Tables 12, 23 and 24
 * sum to the province rows PBS printed, to the person and to the household. `improvedWater` does
 * not — the tehsil release counts 6,374 more improved-water households than the printed province
 * table does, spread across all five provinces.
 *
 * It is a classification difference, not a missing tehsil. Table 23's household totals reconcile
 * exactly, and its nine source columns (inside, outside, tap, motor pump, dug well, filtration
 * plant, bottled, other) each differ between the two releases by amounts that cancel to zero
 * within every province — PBS reclassified a few thousand households between sources and the
 * improved/not-improved line moved with them. Nothing here can say which release is right.
 *
 * So the difference is **pinned, not tolerated**. The build reconciles against the published
 * figure *plus these exact deltas* and fails on any other value, which is a stronger check than
 * an epsilon: a tehsil actually going missing changes the delta and stops the build, and a
 * future release that closes the gap does too, rather than passing quietly under a tolerance.
 * The artifact reports both figures and the difference. Same discipline as Table 11's universe:
 * state what upstream will not explain, never smooth it.
 */
const IMPROVED_WATER_TEHSIL_EXCESS: Readonly<Record<string, number>> = {
  Punjab: 2_226,
  Sindh: 1_458,
  'Khyber Pakhtunkhwa': 1_151,
  Balochistan: 1_513,
  'Islamabad Capital Territory': 26,
};
const IMPROVED_WATER_TEHSIL_EXCESS_NATIONAL = 6_374;

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

/**
 * Read one cached table, digesting the file exactly as committed.
 *
 * The digest is over the bytes on disk rather than the decompressed payload, because those are
 * the bytes CRAN publishes: `pakpc2023-table-11.RData` carries the MD5 the package's own manifest
 * lists for it, so the provenance is checkable in one command and rests on no conversion of ours.
 * Unwrapping the container is `rdata.ts`'s job.
 */
async function readCache(which: keyof typeof CACHE): Promise<{ frame: DataFrame; digest: string }> {
  const bytes = readFileSync(resolve(RAW_DIR, CACHE[which].file));
  const frame = readDataFrames(await decompressRData(bytes)).get(CACHE[which].frame);
  if (frame === undefined) fail(`${CACHE[which].file} holds no table named ${CACHE[which].frame}`);
  return { frame, digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}` };
}

/** Read a published population out of a census row, refusing anything that is not a count. */
function count(row: Readonly<Record<string, Cell>>, column: string): number {
  const value = row[column];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail(`census row has no usable ${column}: ${JSON.stringify(row)}`);
  }
  return value;
}

/**
 * Read a published count that PBS may have left empty.
 *
 * Table 11 prints a cell for every language in every tehsil, most of them blank, and blank there
 * means nobody rather than unknown. Kept apart from `count` so that a blank cannot pass for a
 * figure anywhere the census does publish one.
 */
function optionalCount(row: Readonly<Record<string, Cell>>, column: string): number | null {
  const value = row[column];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail(`census row has no usable ${column}: ${JSON.stringify(row)}`);
  }
  return value;
}

function text(row: Readonly<Record<string, Cell>>, column: string): string {
  const value = row[column];
  if (typeof value !== 'string' || value.length === 0) {
    fail(`census row has no usable ${column}: ${JSON.stringify(row)}`);
  }
  return value;
}

function report(tier: string, discrepancies: readonly Discrepancy[]): void {
  if (discrepancies.length === 0) return;
  fail(
    `${discrepancies.length} ${tier} total(s) do not match the published figure. A district was ` +
      `dropped, double-counted, or matched to the wrong ${tier}:\n` +
      discrepancies
        .map(
          (d) =>
            `    ${d.name.padEnd(28)} summed ${format(d.summed)}  published ${format(d.published)}` +
            (d.delta === null ? '' : `  delta ${d.delta > 0 ? '+' : ''}${d.delta}`),
        )
        .join('\n'),
  );
}

const format = (value: number | null): string =>
  value === null ? '—'.padStart(13) : value.toLocaleString('en-US').padStart(13);

async function main(): Promise<void> {
  console.log('Joining the 2023 census onto the 2023 district set');

  const districtTable = await readCache('district');
  const divisionTable = await readCache('division');
  const provinceTable = await readCache('province');
  const motherTongueTable = await readCache('motherTongue');
  const literacyTable = await readCache('literacy');
  const waterTable = await readCache('water');
  const sanitationTable = await readCache('sanitation');

  // ---- 1. Census rows -> districts -----------------------------------------------------------
  const rows: CensusRow[] = districtTable.frame.rows.map((row) => ({
    region: text(row, 'Region'),
    division: text(row, 'Division'),
    district: text(row, 'District'),
    population: count(row, 'Pop2023'),
    households: count(row, 'Households'),
    // The table also carries Pop2017. Deliberately not read: ADR-0001 pins this project to a
    // single vintage, and a 2017 column in the bundle is an invitation to the cross-vintage
    // comparison that rule exists to prevent — an intercensal growth rate nothing here can
    // source, on a district set that was reorganised in between.
  }));

  const join = joinCensus(rows);

  if (join.unmatched.length > 0) {
    fail(
      `${join.unmatched.length} census row(s) matched no district in the 2023 roster. Every row ` +
        `must be placed — a skipped row is a province quietly short by one district's ` +
        `population. Add an alias in scripts/lib/census.ts or fix the roster:\n` +
        join.unmatched.map((r) => `    ${r.region} / ${r.division} / ${r.district}`).join('\n'),
    );
  }
  if (join.missing.length > 0) {
    fail(
      `${join.missing.length} census district(s) have no population row: ` +
        `${join.missing.join(', ')}`,
    );
  }
  if (join.districts.size !== CENSUS_DISTRICT_COUNT) {
    fail(`joined ${join.districts.size} districts, expected ${CENSUS_DISTRICT_COUNT}`);
  }

  const districts = [...join.districts.values()];
  console.log(
    `  districts: ${rows.length} census rows → ${districts.length} districts ` +
      `(${join.withoutCensusData.length} drawn without census data)`,
  );

  // ---- 1a. Table 1's areas -> districts (#49) -------------------------------------------------
  // Transcribed rather than read out of the cache, because the package republishes no area column.
  // Everything below is the population join's own discipline applied to the transcription: no row
  // dropped, no district left without one, and the sums checked against the totals PBS printed
  // above them — plus the printed population beside each area, which is what makes a *swap*
  // between two neighbours detectable at all.
  const areaRows = districtAreas.districts as readonly AreaRow[];
  const areaJoin = joinAreas(areaRows);
  if (areaJoin.unmatched.length > 0) {
    fail(
      `${areaJoin.unmatched.length} Table 1 area row(s) matched no district in the 2023 roster. ` +
        `Every row must be placed — a skipped row is a district with no published area, and a ` +
        `unit containing it would carry no area at all. Add an alias in scripts/lib/census.ts:\n` +
        areaJoin.unmatched.map((r) => `    ${r.province} / ${r.district}`).join('\n'),
    );
  }
  if (areaJoin.collisions.length > 0) {
    fail(
      `two Table 1 area rows resolved to one district, so another district now has no area:\n` +
        areaJoin.collisions
          .map((c) => `    ${c.district.padEnd(28)} ← ${c.publishedNames.join(', ')}`)
          .join('\n'),
    );
  }
  if (areaJoin.misplaced.length > 0) {
    fail(
      `${areaJoin.misplaced.length} Table 1 area row(s) name a province the roster disagrees ` +
        `with; one of the two names resolved to the wrong district:\n` +
        areaJoin.misplaced
          .map((m) => `    ${m.district.padEnd(28)} published ${m.published}, roster ${m.roster}`)
          .join('\n'),
    );
  }
  if (areaJoin.missing.length > 0) {
    fail(
      `${areaJoin.missing.length} census district(s) have no published area: ` +
        `${areaJoin.missing.join(', ')}`,
    );
  }
  report(
    'district population against Table 1 (transcription check)',
    reconcileTranscription(
      areaRows,
      new Map(districts.map((d) => [d.district, d.population])),
    ),
  );
  const areasByProvince = sumAreasByProvince(areaJoin.areas);
  report(
    'province area (PBS Table 1)',
    reconcileTotals(
      areasByProvince,
      new Map(Object.entries(districtAreas.published.provinces)),
    ),
  );
  const nationalArea = [...areasByProvince.values()].reduce((sum, km2) => sum + km2, 0);
  if (nationalArea !== districtAreas.published.pakistan) {
    fail(
      `district areas sum to ${nationalArea.toLocaleString('en-US')} km², but PBS published ` +
        `${districtAreas.published.pakistan.toLocaleString('en-US')} km² for Pakistan`,
    );
  }
  console.log(
    `  areas: ${areaRows.length} Table 1 rows → ${areaJoin.areas.size} districts, ` +
      `${nationalArea.toLocaleString('en-US')} km² over ${areasByProvince.size} provinces`,
  );

  // ---- 1b. Table 11 -> districts (#10) --------------------------------------------------------
  // Summed from tehsils: PakPC2023 republishes Table 11 at tehsil level only, so the district
  // tier this project shades by does not exist upstream and is added up here — under the
  // province-by-language reconciliation below, which is what makes adding it up safe.
  const motherTongueRows: MotherTongueRow[] = motherTongueTable.frame.rows.map((row) => ({
    district: text(row, 'DISTRICT'),
    tehsil: text(row, 'TEHSIL'),
    language: text(row, 'LANGUAGE'),
    speakers: optionalCount(row, 'ALL_SEXES_OVERALL'),
    // The table also carries male, female, transgender and rural/urban splits. Not read: nothing
    // in this app shades by them, and an unused column in the bundle is a figure nobody checks.
  }));

  const motherTongue = joinMotherTongue(motherTongueRows);

  if (motherTongue.unknownCategories.length > 0) {
    fail(
      `Table 11 publishes ${motherTongue.unknownCategories.length} mother-tongue category(ies) ` +
        `this build does not know: ${motherTongue.unknownCategories.join(', ')}. Add them to ` +
        `CENSUS_LANGUAGES in scripts/lib/mother-tongue.ts — never let one fall into Others, ` +
        `which would publish a distribution silently missing a language PBS chose to name.`,
    );
  }
  if (motherTongue.unmatched.length > 0) {
    fail(
      `${motherTongue.unmatched.length} Table 11 district(s) matched no district in the 2023 ` +
        `roster: ${motherTongue.unmatched.join(', ')}`,
    );
  }
  if (motherTongue.collisions.length > 0) {
    fail(
      `two Table 11 district names resolved to one district, so their tehsils were summed ` +
        `together and some other district is now missing:\n` +
        motherTongue.collisions
          .map((c) => `    ${c.district.padEnd(28)} ← ${c.publishedNames.join(', ')}`)
          .join('\n'),
    );
  }
  if (motherTongue.missing.length > 0) {
    fail(
      `${motherTongue.missing.length} census district(s) have no mother-tongue rows: ` +
        `${motherTongue.missing.join(', ')}`,
    );
  }
  if (motherTongue.empty.length > 0) {
    fail(
      `${motherTongue.empty.length} district(s) carry Table 11 rows with every figure empty: ` +
        `${motherTongue.empty.join(', ')}. That is a district with no data wearing the shape of ` +
        `a distribution; shading it would paint whichever language sorts first.`,
    );
  }
  console.log(
    `  mother tongue: ${motherTongueRows.length} published cells → ` +
      `${motherTongue.districts.size} districts × ${CENSUS_LANGUAGES.length} categories`,
  );

  // ---- 1c. Tables 12, 23 and 24 -> districts (#11) --------------------------------------------
  // Summed from tehsils for the same reason Table 11 is: all three are published at tehsil level
  // only. Rates are computed from the summed counts and never averaged across tehsils, and each
  // indicator keeps the denominator PBS gave it — population 10+ for literacy, households for
  // water and sanitation, and those households are not the district table's household figure.
  const literacyRows: LiteracyRow[] = literacyTable.frame.rows.flatMap((row) => {
    const indicator = text(row, 'VARS');
    // Thirteen of the fifteen published indicators are enrolment and out-of-school figures this
    // app does not shade by, and one of those thirteen — `Literate %` — is not a count at all.
    // Filtered here rather than after reading, so that `optionalCount` keeps refusing anything
    // non-integral everywhere it is used instead of being loosened to admit a percentage.
    if (indicator !== LITERACY_POPULATION_VAR && indicator !== LITERACY_LITERATE_VAR) return [];
    return [
      {
        district: text(row, 'DISTRICT'),
        // All three of DISTRICT, TEHSIL and ADMIN_UNIT: two published units share a district-and-
        // tehsil name and differ only in the third (Rajanpur, published as both a TEHSIL and a
        // DE-EXCLUDED_AREA), so a two-part key silently drops one of them.
        unit: `${text(row, 'DISTRICT')} | ${text(row, 'TEHSIL')} | ${text(row, 'ADMIN_UNIT')}`,
        indicator,
        people: optionalCount(row, 'ALL_SEXES_OVERALL'),
        // The table also carries male, female, transgender and rural/urban splits. Not read:
        // nothing in this app shades by them.
      },
    ];
  });

  const waterRows: WaterRow[] = waterTable.frame.rows.map((row) => ({
    district: text(row, 'DISTRICT'),
    region: text(row, 'REGION'),
    households: optionalCount(row, 'HOUSEHOLDS'),
    improved: optionalCount(row, 'DRINK_WTR_IMPROVE'),
    // The nine source columns — inside, outside, tap, motor pump, dug well, filtration plant,
    // bottled, other — are deliberately not carried. `DRINK_WTR_IMPROVE` is PBS's own
    // improved/not-improved classification and is the indicator; the rest would be nine more
    // figures in the bundle that nothing reads and nobody checks.
  }));

  const sanitationRows: SanitationRow[] = sanitationTable.frame.rows.map((row) => ({
    district: text(row, 'DISTRICT'),
    region: text(row, 'REGION'),
    households: optionalCount(row, 'HOUSEHOLDS'),
    flushToilet: optionalCount(row, 'TOILET_FLUSH'),
    nonFlushToilet: optionalCount(row, 'TOILET_NON_FLUSH'),
    noToilet: optionalCount(row, 'TOILET_NONE'),
    separateToilet: optionalCount(row, 'TOILET_SEPARATE'),
  }));

  const development = joinDevelopment(literacyRows, waterRows, sanitationRows);

  if (development.unmatched.length > 0) {
    fail(
      `${development.unmatched.length} development-table district(s) matched no district in the ` +
        `2023 roster: ${development.unmatched.join(', ')}`,
    );
  }
  if (development.collisions.length > 0) {
    fail(
      `two published district names resolved to one district, so their tehsils were summed ` +
        `together and some other district is now missing:\n` +
        development.collisions
          .map((c) => `    ${c.district.padEnd(28)} ← ${c.publishedNames.join(', ')}`)
          .join('\n'),
    );
  }
  if (development.missing.length > 0) {
    fail(
      `${development.missing.length} census district(s) are not covered by a development table:\n` +
        development.missing.map((m) => `    ${m.district.padEnd(28)} ${m.table}`).join('\n'),
    );
  }
  if (development.impossible.length > 0) {
    fail(
      `${development.impossible.length} published figure(s) are larger than the universe they ` +
        `are part of, or sit over an empty one. A share of them would be a rate above 1 or a ` +
        `division by zero, both of which look like data once they are a fill colour:\n` +
        development.impossible
          .map(
            (i) =>
              `    ${i.district.padEnd(28)} ${i.what.padEnd(26)} ${format(i.counted)} of ` +
              `${format(i.outOf)}`,
          )
          .join('\n'),
    );
  }
  if (development.unpartitioned.length > 0) {
    fail(
      `${development.unpartitioned.length} district(s) whose flush, non-flush and no-toilet ` +
        `counts do not add up to their own household total: ` +
        `${development.unpartitioned.join(', ')}. The three are a partition of every household ` +
        `Table 24 publishes; where they are not, a share over that denominator is a share of ` +
        `something upstream cannot account for.`,
    );
  }
  const householdConflicts = householdDenominatorConflicts(development.districts.values());
  if (householdConflicts.length > 0) {
    fail(
      `${householdConflicts.length} district(s) where Tables 23 and 24 disagree on how many ` +
        `households there are, so the water and sanitation shares would be taken over different ` +
        `denominators without saying so:\n` +
        householdConflicts
          .map((c) => `    ${c.district.padEnd(28)} water ${format(c.water)}  sanitation ${format(c.sanitation)}`)
          .join('\n'),
    );
  }
  console.log(
    `  development: ${literacyRows.length + waterRows.length + sanitationRows.length} published ` +
      `rows → ${development.districts.size} districts × 3 indicators`,
  );

  // ---- 2. Do the districts still add up? -----------------------------------------------------
  const byProvince = sumBy(districts, 'province');
  const byDivision = sumBy(districts, 'division');

  const publishedDivisions = new Map(
    divisionTable.frame.rows.map((row) => [
      resolveCensusDivision(text(row, 'Division')),
      count(row, 'Pop2023'),
    ]),
  );
  const publishedProvinces = new Map(
    provinceTable.frame.rows
      .filter((row) => row['Area'] === 'All' && row['Region'] !== 'Pakistan')
      .map((row) => {
        const province = resolveCensusProvince(text(row, 'Region'));
        if (province === null) fail(`census province total names an unknown region: ${row['Region']}`);
        return [province, count(row, 'Pop2023')];
      }),
  );

  // Package-internal: both sides come from PakPC2023, so these catch a bad join, not a bad package.
  report('division (PakPC2023)', reconcileTotals(byDivision, publishedDivisions));
  report('province (PakPC2023)', reconcileTotals(byProvince, publishedProvinces));
  // Anchored outside the package: these six figures are typed from the PBS table itself.
  report('province (PBS Table 1)', reconcileTotals(byProvince, new Map(Object.entries(PUBLISHED_PROVINCE_TOTALS))));

  // Table 11, column by column. Anchored outside the package: every figure on the right is typed
  // from the PBS PDF, so this checks the package as well as the join.
  const motherTongueByProvince = sumLanguagesByProvince(motherTongue.districts.values());
  const motherTongueNational = zeroedLanguages();
  for (const language of CENSUS_LANGUAGES) {
    const summed = new Map(
      [...motherTongueByProvince].map(([province, totals]) => [province, totals[language]]),
    );
    const published = new Map(
      Object.entries(PUBLISHED_MOTHER_TONGUE).map(([province, totals]) => [
        province,
        totals[language],
      ]),
    );
    report(`province ${language} (PBS Table 11)`, reconcileTotals(summed, published));
    motherTongueNational[language] = [...summed.values()].reduce((sum, n) => sum + n, 0);
    if (motherTongueNational[language] !== PUBLISHED_MOTHER_TONGUE_NATIONAL[language]) {
      fail(
        `districts sum to ${motherTongueNational[language].toLocaleString('en-US')} ${language} ` +
          `speakers, but PBS published ` +
          `${PUBLISHED_MOTHER_TONGUE_NATIONAL[language].toLocaleString('en-US')}`,
      );
    }
  }

  // Tables 12, 23 and 24, count by count. Same shape as the mother-tongue check and for the same
  // reason: the district tier is summed from tehsils, so every numerator and every denominator is
  // checked against the province figure PBS printed, not just their ratio. A rate can be right
  // for the wrong reason — two tehsils swapped between districts leave both totals intact.
  const developmentByProvince = sumDevelopmentByProvince(development.districts.values());
  const developmentNational = Object.fromEntries(
    RECONCILED_FIELDS.map((f) => [f, 0]),
  ) as FieldTotals;
  for (const field of RECONCILED_FIELDS) {
    const summed = new Map(
      [...developmentByProvince].map(([province, totals]) => [province, totals[field]]),
    );
    const published = new Map(
      Object.entries(PUBLISHED_DEVELOPMENT).map(([province, totals]) => [
        province,
        // The one pinned difference between PBS's two releases; every other field is exact.
        totals[field] + (field === 'improvedWater' ? IMPROVED_WATER_TEHSIL_EXCESS[province] ?? 0 : 0),
      ]),
    );
    report(`province ${field} (PBS Table 12/23/24)`, reconcileTotals(summed, published));
    developmentNational[field] = [...summed.values()].reduce((sum, n) => sum + n, 0);
    const expected =
      PUBLISHED_DEVELOPMENT_NATIONAL[field] +
      (field === 'improvedWater' ? IMPROVED_WATER_TEHSIL_EXCESS_NATIONAL : 0);
    if (developmentNational[field] !== expected) {
      fail(
        `districts sum to ${developmentNational[field].toLocaleString('en-US')} for ${field}, ` +
          `but PBS published ${PUBLISHED_DEVELOPMENT_NATIONAL[field].toLocaleString('en-US')}` +
          (field === 'improvedWater'
            ? ` and the tehsil rows are known to exceed that by exactly ` +
              `${IMPROVED_WATER_TEHSIL_EXCESS_NATIONAL.toLocaleString('en-US')}`
            : ''),
      );
    }
  }

  const national = districts.reduce((sum, d) => sum + d.population, 0);
  if (national !== PUBLISHED_NATIONAL_TOTAL) {
    fail(
      `districts sum to ${national.toLocaleString('en-US')}, but PBS published ` +
        `${PUBLISHED_NATIONAL_TOTAL.toLocaleString('en-US')} for Pakistan`,
    );
  }

  // A published table cannot count more people than live there. Where it does, upstream disagrees
  // with itself; the build records which districts and by how much rather than smoothing it away.
  const countedAbovePopulation = districts
    .map((d) => {
      // Every census district has a distribution by here — `motherTongue.missing` stopped the
      // build otherwise. Defaulting a missing one to zero would quietly drop it from this check
      // instead, which is the one place a hole could still hide.
      const counted = motherTongue.districts.get(d.district);
      if (counted === undefined) fail(`${d.district} has no mother-tongue distribution`);
      return { district: d.district, counted: counted.total, population: d.population };
    })
    .filter((d) => d.counted > d.population)
    .map((d) => ({ ...d, excess: d.counted - d.population }))
    .sort((a, b) => b.excess - a.excess);

  const developmentRanked = [...development.districts.values()].map((d) => ({
    district: d.district,
    literacy: d.literacy.rate,
    water: d.water.improvedShare,
    sanitation: d.sanitation.flushToiletShare,
  }));

  // ---- 3. Emit -------------------------------------------------------------------------------
  const statistics = {
    provenance: {
      generated: new Date().toISOString(),
      vintage: '2023 census (as on 01-03-2023) — geometry and statistics both, per ADR-0001',
      unit: 'district',
      joinsTo: 'data/bundle/geography.topojson.json, on the district `name` property',
      sources: SOURCE_URLS,
      cacheDigests: {
        district: districtTable.digest,
        division: divisionTable.digest,
        province: provinceTable.digest,
        motherTongue: motherTongueTable.digest,
        literacy: literacyTable.digest,
        water: waterTable.digest,
        sanitation: sanitationTable.digest,
      },
      counts: {
        censusDistricts: join.districts.size,
        drawnDistricts: ROSTER_DISTRICT_COUNT,
        districtsWithoutCensusData: join.withoutCensusData.length,
        divisions: byDivision.size,
        provinces: byProvince.size,
        postCensusFolds: Object.keys(POST_CENSUS_DISTRICT_FOLDS).length,
      },
      // The three coexisting counts, spelled out, because any one alone makes the others read
      // as a bug: 136 counted, 156 drawn, and the ~170 current-day relations OSM returns.
      note:
        `${CENSUS_DISTRICT_COUNT} districts carry census statistics (four provinces and ICT); ` +
        `${ROSTER_DISTRICT_COUNT} are drawn. The difference is AJK and Gilgit-Baltistan, which ` +
        `PBS's 2023 results do not cover.`,
    },
    districts: Object.fromEntries(
      districts
        .slice()
        .sort((a, b) => a.district.localeCompare(b.district))
        .map((d) => {
          const languages = motherTongue.districts.get(d.district);
          if (languages === undefined) fail(`${d.district} has no mother-tongue distribution`);
          const indicators = development.districts.get(d.district);
          if (indicators === undefined) fail(`${d.district} has no development indicators`);
          return [
            d.district,
            {
              population: d.population,
              // PBS's published figure, never this project's geometry (#49). The drawn polygons
              // are clipped to OSM's coastline and disagree with PBS by thousands of km² on the
              // Indus delta; measuring them would put our own number under a `census` badge.
              areaSqKm: areaJoin.areas.get(d.district) ?? fail(`${d.district} has no area`),
              households: d.households,
              division: d.division,
              province: d.province,
              motherTongue: {
                // `null` where the residual outweighs every named language — the census names no
                // majority tongue for this district, and the map has to be able to say so.
                dominant: languages.dominant,
                // Rounded to six places: the app shows one decimal of a percentage, and a full
                // float here would churn the committed diff on every rebuild for no reader.
                dominantShare:
                  languages.dominantShare === null
                    ? null
                    : Number(languages.dominantShare.toFixed(6)),
                residualShare: Number(languages.residualShare.toFixed(6)),
                // Table 11's own universe for this district, not its population — the two differ
                // nationally by 1,041,342 and district by district by more. See `counted` below.
                counted: languages.total,
                speakers: languages.speakers,
              },
              /**
               * The three published rates, kept apart and kept as published (#11). Not combined:
               * a composite of literacy, water and sanitation is this project's own index, not
               * a census figure, and belongs behind a `synthesized` badge (#31).
               *
               * Every share is a **proportion in 0–1**, rounded to six places for the same
               * reason `dominantShare` is — the app shows one decimal of a percentage, and a
               * full float would churn the committed diff on every rebuild for no reader.
               * Numerators and denominators are emitted beside them, so nothing downstream has
               * to guess which universe a share was taken over.
               */
              development: {
                literacy: {
                  population10Plus: indicators.literacy.population10Plus,
                  literate10Plus: indicators.literacy.literate10Plus,
                  rate: Number(indicators.literacy.rate.toFixed(6)),
                },
                water: {
                  households: indicators.water.households,
                  improved: indicators.water.improved,
                  improvedShare: Number(indicators.water.improvedShare.toFixed(6)),
                },
                sanitation: {
                  households: indicators.sanitation.households,
                  flushToilet: indicators.sanitation.flushToilet,
                  nonFlushToilet: indicators.sanitation.nonFlushToilet,
                  noToilet: indicators.sanitation.noToilet,
                  separateToilet: indicators.sanitation.separateToilet,
                  flushToiletShare: Number(indicators.sanitation.flushToiletShare.toFixed(6)),
                  noToiletShare: Number(indicators.sanitation.noToiletShare.toFixed(6)),
                },
              },
            },
          ];
        }),
    ),
    withoutCensusData: {
      reason:
        'Drawn and named, never shaded and never counted (D25). PBS published the 2023 census ' +
        'results for 136 districts — the four provinces and ICT only — so no district of Azad ' +
        'Jammu & Kashmir or Gilgit-Baltistan has a population, literacy, water or sanitation ' +
        'figure from PBS. AJK population exists only as relayed by the AJK Bureau of ' +
        'Statistics, never direct from PBS, and is out of scope here. Absent, not zero.',
      districts: join.withoutCensusData,
    },
    motherTongue: {
      source: SOURCE_URLS.motherTongue,
      unit: 'district — summed from the tehsil rows PakPC2023 publishes',
      /**
       * The categories, in the census's own order and the census's own spelling — `Kohiostani`
       * included, which is how PBS prints Kohistani. Nothing merged, nothing renamed: which
       * tongues are one language and which are two is a live argument in Pakistan, and this app
       * reports the census's answer rather than adjudicating (D4/D5).
       */
      categories: CENSUS_LANGUAGES,
      residualCategory: RESIDUAL_CATEGORY,
      dominance:
        `The largest category excluding ${RESIDUAL_CATEGORY}, which is a residual and not a ` +
        `language: shading a district by it would assert a mother tongue the census did not ` +
        `record. Where ${RESIDUAL_CATEGORY} outweighs every named category the dominant ` +
        `language is null instead — the census names no majority tongue there, and handing the ` +
        `label to the largest remaining category would print a false claim. Ties go to the ` +
        `category the census prints first.`,
      /**
       * Districts with no census-nameable majority tongue. Both are in Chitral, where Khowar has
       * no column of its own: 194,851 of Upper Chitral's 195,161 people are counted under
       * `Others`, against 150 Urdu speakers. Listed so the omission is a documented property of
       * the source rather than a hole a reader discovers in the fill.
       */
      districtsWithoutNamedDominant: [...motherTongue.districts.values()]
        .filter((d) => d.dominant === null)
        .map((d) => ({ district: d.district, residualShare: Number(d.residualShare.toFixed(6)) }))
        .sort((a, b) => b.residualShare - a.residualShare),
      universe: {
        counted: sumLanguages(motherTongueNational),
        population: PUBLISHED_NATIONAL_TOTAL,
        difference: sumLanguages(motherTongueNational) - PUBLISHED_NATIONAL_TOTAL,
        note:
          'Table 11 counts 240,458,089 people, 1,041,342 fewer than the 241,499,431 of Table 1. ' +
          'PBS prints the same universe for Table 10 (nationality), so the two tables agree with ' +
          'each other and differ from Table 1 by an amount PBS does not explain. Stated here ' +
          'rather than reconciled: shares are shares of the universe the table itself publishes, ' +
          'and no residual has been invented to close the gap. The difference is not spread ' +
          'evenly — see districtsCountedAbovePopulation and, for the largest shortfalls, ' +
          'docs/research/mother-tongue-table-11.md.',
      },
      /**
       * Districts where Table 11 counts *more* people than Table 1 publishes as living there.
       * A published table cannot cover more than everybody, so this is upstream disagreeing with
       * itself — most likely a tehsil attributed to a neighbouring district. Named rather than
       * smoothed: the province columns all reconcile exactly, so whatever moved stayed inside its
       * province, and a reader comparing this app to PBS should find the same oddity.
       */
      districtsCountedAbovePopulation: countedAbovePopulation,
      reconciliation: {
        method:
          'District sums checked against PBS Table 11 (national) column by column — every one ' +
          'of the fifteen categories, for each of the five provinces and for Pakistan. Column ' +
          'by column rather than on the total because a tehsil summed into the wrong district ' +
          'inside a province moves whole languages while leaving the total untouched. The ' +
          'figures are typed from the PBS PDF, i.e. from outside the PakPC2023 package, so this ' +
          'checks the package as well as the join.',
        source: SOURCE_URLS.motherTongue,
        national: Object.fromEntries(
          CENSUS_LANGUAGES.map((language) => [
            language,
            {
              summed: motherTongueNational[language],
              published: PUBLISHED_MOTHER_TONGUE_NATIONAL[language],
            },
          ]),
        ),
        provinces: [...motherTongueByProvince.keys()].sort().map((name) => ({
          name,
          summed: motherTongueByProvince.get(name),
          published: PUBLISHED_MOTHER_TONGUE[name] ?? null,
        })),
      },
    },
    development: {
      source: SOURCE_URLS.development,
      unit: 'district — summed from the tehsil rows PakPC2023 publishes',
      /**
       * Named *Development*, not *Poverty*. The census sees service access; it does not see
       * income, consumption, child mortality or nutrition, and a basis called poverty would be
       * claiming three indicators can carry a word they cannot.
       */
      indicators: {
        literacy: {
          table: 'PBS Census-2023 Table 12',
          numerator: LITERACY_LITERATE_VAR,
          denominator: LITERACY_POPULATION_VAR,
          note:
            'Literate people aged 10 and above over population aged 10 and above — PBS\'s own ' +
            'definition and PBS\'s own denominator, which is not the district population. The ' +
            'rate is computed once from the summed counts, so it is population-weighted; ' +
            'averaging the 591 published tehsil percentages would weight a tehsil of 6,000 like ' +
            'a city of millions. Table 12 does print a Literate % per tehsil, and it agrees ' +
            'with the counts to within 0.005 percentage points across all 591 units.',
        },
        water: {
          table: 'PBS Census-2023 Table 23',
          numerator: 'DRINK_WTR_IMPROVE',
          denominator: 'HOUSEHOLDS',
          note:
            "Households whose drinking-water source PBS classifies as improved. The " +
            'improved/not-improved line is the census\'s own published column, not a rule of ' +
            'ours. The denominator is the household count Tables 23 and 24 publish — 38,292,556 ' +
            'nationally, which is 48,010 fewer than the 38,340,566 the district table carries, ' +
            'a difference present in all 136 districts and unexplained by PBS.',
        },
        sanitation: {
          table: 'PBS Census-2023 Table 24',
          numerator: 'TOILET_FLUSH',
          denominator: 'HOUSEHOLDS',
          note:
            'PBS publishes no improved-sanitation column. For drinking water it classifies ' +
            'sources as improved or not and prints the result; for toilets it prints only ' +
            'flush, non-flush and none, and a non-flush toilet may be improved (a pit latrine ' +
            'with a slab) or not (an open pit) — the census does not say which. So there is no ' +
            'improved-sanitation figure to join, and adding flush to non-flush would be this ' +
            "project's own definition wearing a census badge. The four published counts are " +
            'carried as published; the shaded share is flush toilets, and noToiletShare is ' +
            'carried beside it as the one category nobody can misread. Any composite is #31, ' +
            'badged synthesized. separateToilet — a toilet not shared with another household — ' +
            'is orthogonal to the other three, not a fourth category.',
        },
      },
      shares:
        'Proportions in 0–1, never percentages, and rounded to six places. Each is emitted ' +
        'beside its own numerator and denominator, because the three do not share one: literacy ' +
        'is over population aged 10 and above, water and sanitation over households.',
      reconciliation: {
        method:
          'District sums checked against PBS Tables 12, 23 and 24 (national) count by count — ' +
          'every numerator and every denominator, for each of the five provinces and for ' +
          'Pakistan. Counts rather than rates, because a province rate is population-weighted ' +
          'and cannot be recovered from district rates, and because a rate can be right for the ' +
          'wrong reason: two tehsils swapped between districts leave both halves intact. The ' +
          'figures are typed from the PBS PDFs, i.e. from outside the PakPC2023 package, so ' +
          'this checks the package as well as the join. Seven of the eight counts reconcile ' +
          'exactly; see improvedWaterDifference for the one that does not.',
        source: SOURCE_URLS.development,
        national: Object.fromEntries(
          RECONCILED_FIELDS.map((field) => [
            field,
            {
              summed: developmentNational[field],
              published: PUBLISHED_DEVELOPMENT_NATIONAL[field],
            },
          ]),
        ),
        provinces: [...developmentByProvince.keys()].sort().map((name) => ({
          name,
          summed: developmentByProvince.get(name),
          published: PUBLISHED_DEVELOPMENT[name] ?? null,
        })),
      },
      /**
       * The one column PBS's two releases disagree about, stated rather than closed.
       *
       * Table 23's tehsil rows count 6,374 more improved-water households than Table 23's own
       * printed province rows. Household totals reconcile exactly, and the nine source columns
       * differ between the releases by amounts that cancel to zero within each province — so
       * this is a few thousand households reclassified between sources, carrying the
       * improved/not-improved line with them, not a tehsil gone missing. The build pins the
       * per-province deltas and fails if any of them changes; nothing here can say which of the
       * two PBS releases is right, and 6,374 is 0.017% of the households in question.
       */
      improvedWaterDifference: {
        summed: developmentNational.improvedWater,
        published: PUBLISHED_DEVELOPMENT_NATIONAL.improvedWater,
        difference: IMPROVED_WATER_TEHSIL_EXCESS_NATIONAL,
        byProvince: IMPROVED_WATER_TEHSIL_EXCESS,
        note:
          "PBS's tehsil-level release of Table 23 counts 6,374 more improved-drinking-water " +
          "households than PBS's own printed province table for the same table. The household " +
          'totals agree exactly, and the nine drinking-water source columns differ between the ' +
          'two releases by amounts that cancel within every province, so this is a ' +
          'reclassification between sources rather than a missing unit. Pinned per province and ' +
          'failed on if it changes, rather than absorbed into a tolerance. Not smoothed: the ' +
          'shares here are shares of the tehsil rows the district tier is summed from.',
      },
      extremes: {
        note:
          'The lowest and highest district on each indicator, so a reader can sanity-check the ' +
          'fill against a figure rather than against a colour.',
        ...Object.fromEntries(
          (
            [
              ['literacyRate', (d: (typeof developmentRanked)[number]) => d.literacy],
              ['improvedWaterShare', (d: (typeof developmentRanked)[number]) => d.water],
              ['flushToiletShare', (d: (typeof developmentRanked)[number]) => d.sanitation],
            ] as const
          ).map(([name, read]) => {
            const sorted = [...developmentRanked].sort((a, b) => read(a) - read(b));
            const at = (d: (typeof developmentRanked)[number]) => ({
              district: d.district,
              value: Number(read(d).toFixed(6)),
            });
            return [name, { lowest: at(sorted[0]!), highest: at(sorted[sorted.length - 1]!) }];
          }),
        ),
      },
    },
    folds: {
      reason:
        'Districts created after the census date. A unit with no census row cannot carry a ' +
        'population, so it is neither drawn nor counted on its own: its people stay with the ' +
        '2023 district it was carved out of. Look a post-census district up here to reach the ' +
        'district that carries it.',
      source: SOURCE_URLS.folds,
      into: POST_CENSUS_DISTRICT_FOLDS,
      table: POST_CENSUS_FOLD_TABLE,
    },
    totals: {
      pakistan: national,
      provinces: sorted(byProvince),
      divisions: sorted(byDivision),
    },
    /**
     * The published areas, kept as their own block (#49).
     *
     * A section of its own rather than a column folded into the reconciliation above, because the
     * area tier is anchored differently from the population one: there is no division total to
     * check against — PBS publishes none — and the transcription carries a check the cached tables
     * do not need, since nobody had to copy those out of a PDF.
     */
    area: {
      source: SOURCE_URLS.areas,
      unit: districtAreas.unit,
      note:
        'Published per district by PBS, never measured off this project\'s geometry. The drawn ' +
        'districts are clipped to OSM\'s coastline and knowingly disagree with these figures — ' +
        'see the geometry bundle\'s own limitations — so a measured area would be a number of ' +
        'ours wearing the census\'s badge.',
      pakistan: nationalArea,
      provinces: Object.fromEntries([...areasByProvince].sort(([a], [b]) => a.localeCompare(b))),
      published: districtAreas.published,
      withoutPublishedArea: {
        reason:
          'PBS published Table 1 for the four provinces and the capital. AJK and ' +
          'Gilgit-Baltistan have no row in it, so their twenty districts have no published area ' +
          'exactly as they have no published population (D25) — and, exactly as there, the ' +
          'absence is stated rather than filled in with a measurement.',
        districts: join.withoutCensusData,
      },
      transcription: {
        method:
          'Every row carries the population Table 1 prints beside the area. It is not read into ' +
          'this artifact — the populations here are the PakPC2023 cache\'s — and exists so that ' +
          'a row can be shown to be the district it claims to be: two areas swapped between ' +
          'neighbours sum to their province correctly and would otherwise pass.',
        agreesWithPackage: areaRows.length - Object.keys(TABLE_1_POPULATION_DELTAS).length,
        differences: {
          note:
            'Table 1\'s district populations minus the package\'s. Eight districts, in four pairs of ' +
            'neighbours: PBS\'s PDF and PBS\'s structured release put a tehsil\'s worth of people ' +
            'on different sides of a district line, and each pair\'s difference cancels within its ' +
            'province — which is why both agree to the person at province and national level.',
          byDistrict: TABLE_1_POPULATION_DELTAS,
        },
      },
    },
    reconciliation: {
      method:
        'District populations summed and compared against the total for the tier above them. ' +
        'The build fails on any difference. The two tiers are anchored differently, and the ' +
        '`source` on each row says which: province and national totals are typed from PBS ' +
        'Census-2023 Table 1, i.e. from outside the PakPC2023 package; division totals come ' +
        "from that package's own division table, so they are a cross-table consistency check " +
        'on the district rows, not an independent source. PBS publishes no division tier in ' +
        'Table 1.',
      national: {
        summed: national,
        published: PUBLISHED_NATIONAL_TOTAL,
        source: SOURCE_URLS.publishedTotals,
      },
      provinces: [...byProvince.keys()].sort().map((name) => ({
        name,
        summed: byProvince.get(name) ?? null,
        published: PUBLISHED_PROVINCE_TOTALS[name] ?? null,
        source: SOURCE_URLS.publishedTotals,
      })),
      divisions: [...byDivision.keys()].sort().map((name) => ({
        name,
        summed: byDivision.get(name) ?? null,
        published: publishedDivisions.get(name) ?? null,
        source: SOURCE_URLS.censusPackage,
      })),
    },
  };

  mkdirSync(resolve(OUT_FILE, '..'), { recursive: true });
  writeFileSync(OUT_FILE, `${JSON.stringify(statistics, null, 2)}\n`);

  // ---- 4. Report -----------------------------------------------------------------------------
  console.log('\nPopulation by province (summed from districts, against published)');
  for (const province of ROSTER) {
    const summed = byProvince.get(province.name);
    if (summed === undefined) {
      console.log(`  ${province.name.padEnd(28)} ${'—'.padStart(13)}  no census data`);
      continue;
    }
    console.log(
      `  ${province.name.padEnd(28)} ${format(summed)}  = ${format(
        PUBLISHED_PROVINCE_TOTALS[province.name] ?? null,
      )}`,
    );
  }
  console.log(`  ${'Pakistan'.padEnd(28)} ${format(national)}  = ${format(PUBLISHED_NATIONAL_TOTAL)}`);
  console.log(
    `\n  divisions reconciled: ${byDivision.size}/${publishedDivisions.size}` +
      `   folds: ${Object.keys(POST_CENSUS_DISTRICT_FOLDS).length}`,
  );

  console.log('\nMother tongue (summed from tehsils, against PBS Table 11 national)');
  for (const language of CENSUS_LANGUAGES) {
    console.log(
      `  ${language.padEnd(28)} ${format(motherTongueNational[language])}  = ` +
        `${format(PUBLISHED_MOTHER_TONGUE_NATIONAL[language])}`,
    );
  }
  console.log(
    `  ${'counted'.padEnd(28)} ${format(sumLanguages(motherTongueNational))}  ` +
      `vs ${format(PUBLISHED_NATIONAL_TOTAL)} population — Table 11's own universe`,
  );
  if (countedAbovePopulation.length > 0) {
    console.log(
      `\n  ${countedAbovePopulation.length} district(s) counted above their population by PBS:`,
    );
    for (const d of countedAbovePopulation) {
      console.log(`    ${d.district.padEnd(28)} +${d.excess.toLocaleString('en-US')}`);
    }
  }

  console.log('\nDevelopment (summed from tehsils, against PBS Tables 12/23/24 national)');
  for (const field of RECONCILED_FIELDS) {
    const excess = field === 'improvedWater' ? IMPROVED_WATER_TEHSIL_EXCESS_NATIONAL : 0;
    console.log(
      `  ${field.padEnd(28)} ${format(developmentNational[field])}  = ` +
        `${format(PUBLISHED_DEVELOPMENT_NATIONAL[field])}` +
        (excess === 0 ? '' : `  + ${excess.toLocaleString('en-US')} pinned upstream difference`),
    );
  }
  console.log(
    `  ${'literacy rate'.padEnd(28)} ` +
      `${((developmentNational.literate10Plus / developmentNational.population10Plus) * 100).toFixed(2)}%` +
      `   improved water ` +
      `${((developmentNational.improvedWater / developmentNational.households) * 100).toFixed(2)}%` +
      `   flush toilet ` +
      `${((developmentNational.flushToilet / developmentNational.households) * 100).toFixed(2)}%`,
  );

  const bytes = readFileSync(OUT_FILE).byteLength;
  console.log(
    `\n✓ ${OUT_FILE.replace(`${ROOT}/`, '')} — ${districts.length} districts, ` +
      `${(bytes / 1024).toFixed(0)} KiB`,
  );
}

const sorted = (totals: ReadonlyMap<string, number>): Record<string, number> =>
  Object.fromEntries([...totals].sort(([a], [b]) => a.localeCompare(b)));

await main();
