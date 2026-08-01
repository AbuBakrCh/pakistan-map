/**
 * Join the PBS 2023 Digital Census onto the 2023 district set (#9).
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
 *   - a province, or the national total, that the districts do not sum to.
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

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function readCache(which: keyof typeof CACHE): { frame: DataFrame; digest: string } {
  const bytes = readFileSync(resolve(RAW_DIR, CACHE[which].file));
  const frame = readDataFrames(bytes).get(CACHE[which].frame);
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

function main(): void {
  console.log('Joining the 2023 census onto the 2023 district set');

  const districtTable = readCache('district');
  const divisionTable = readCache('division');
  const provinceTable = readCache('province');

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

  const national = districts.reduce((sum, d) => sum + d.population, 0);
  if (national !== PUBLISHED_NATIONAL_TOTAL) {
    fail(
      `districts sum to ${national.toLocaleString('en-US')}, but PBS published ` +
        `${PUBLISHED_NATIONAL_TOTAL.toLocaleString('en-US')} for Pakistan`,
    );
  }

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
        .map((d) => [
          d.district,
          {
            population: d.population,
            households: d.households,
            division: d.division,
            province: d.province,
          },
        ]),
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

  const bytes = readFileSync(OUT_FILE).byteLength;
  console.log(
    `\n✓ ${OUT_FILE.replace(`${ROOT}/`, '')} — ${districts.length} districts, ` +
      `${(bytes / 1024).toFixed(0)} KiB`,
  );
}

const sorted = (totals: ReadonlyMap<string, number>): Record<string, number> =>
  Object.fromEntries([...totals].sort(([a], [b]) => a.localeCompare(b)));

main();
