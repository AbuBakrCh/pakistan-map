/**
 * Join the PBS 2023 Digital Census onto the 2023 district set (#9, #10).
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
 *   - a mother-tongue column that does not sum to the province figure PBS printed for it.
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
import xz from 'xz-decompress';
import {
  CENSUS_LANGUAGES,
  RESIDUAL_CATEGORY,
  joinMotherTongue,
  sumLanguagesByProvince,
  type CensusLanguage,
  type MotherTongueRow,
} from './lib/mother-tongue.ts';
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
  CENSUS_DISTRICT_COUNT,
  POST_CENSUS_DISTRICT_FOLDS,
  POST_CENSUS_FOLD_TABLE,
  ROSTER,
  ROSTER_DISTRICT_COUNT,
} from './lib/roster.ts';
import { readDataFrames, type Cell, type DataFrame } from './lib/rdata.ts';

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
  // Table 11 is the one the package ships xz-compressed rather than gzip; see `decompress`.
  motherTongue: { file: 'pakpc2023-table-11.RData', frame: 'TABLE_11' },
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
const PUBLISHED_MOTHER_TONGUE: Readonly<Record<string, Readonly<Record<CensusLanguage, number>>>> =
  {
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
const PUBLISHED_MOTHER_TONGUE_NATIONAL: Readonly<Record<CensusLanguage, number>> = {
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

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

/** `.xz` container magic, "\xFD7zXZ\0". */
const XZ_MAGIC = [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00];

/**
 * Unwrap the container an `.RData` file arrives in.
 *
 * `save()` writes gzip by default and `rdata.ts` handles that itself, but `PakPC2023` ships its
 * numbered tables — Table 11 among them — with `compress = "xz"`, which Node's `zlib` cannot
 * read. Decompressing here rather than committing a re-compressed file is what keeps the raw
 * cache byte-for-byte identical to the package as CRAN publishes it: the committed file's MD5 is
 * the one in the package's own `MD5` manifest, so the provenance is checkable in one command and
 * does not rest on trusting a conversion step of ours.
 */
async function decompress(bytes: Uint8Array): Promise<Uint8Array> {
  if (!XZ_MAGIC.every((byte, index) => bytes[index] === byte)) return bytes;
  const compressed = new Response(bytes as unknown as BodyInit).body;
  if (compressed === null) fail('could not stream the census cache for decompression');
  return new Uint8Array(await new Response(new xz.XzReadableStream(compressed)).arrayBuffer());
}

async function readCache(which: keyof typeof CACHE): Promise<{ frame: DataFrame; digest: string }> {
  const bytes = readFileSync(resolve(RAW_DIR, CACHE[which].file));
  const frame = readDataFrames(await decompress(bytes)).get(CACHE[which].frame);
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
        motherTongue.collisions.map((c) => `    ${c}`).join('\n'),
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
    .map((d) => ({
      district: d.district,
      counted: motherTongue.districts.get(d.district)?.total ?? 0,
      population: d.population,
    }))
    .filter((d) => d.counted > d.population)
    .map((d) => ({ ...d, excess: d.counted - d.population }))
    .sort((a, b) => b.excess - a.excess);

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
          return [
            d.district,
            {
              population: d.population,
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

  const bytes = readFileSync(OUT_FILE).byteLength;
  console.log(
    `\n✓ ${OUT_FILE.replace(`${ROOT}/`, '')} — ${districts.length} districts, ` +
      `${(bytes / 1024).toFixed(0)} KiB`,
  );
}

const sorted = (totals: ReadonlyMap<string, number>): Record<string, number> =>
  Object.fromEntries([...totals].sort(([a], [b]) => a.localeCompare(b)));

const zeroedLanguages = (): Record<CensusLanguage, number> =>
  Object.fromEntries(CENSUS_LANGUAGES.map((l) => [l, 0])) as Record<CensusLanguage, number>;

const sumLanguages = (totals: Readonly<Record<CensusLanguage, number>>): number =>
  CENSUS_LANGUAGES.reduce((sum, language) => sum + totals[language], 0);

await main();
