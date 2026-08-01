/**
 * Validate the variants and bake them into the bundle (#14).
 *
 *   npm run build:data:scenarios
 *
 * Emits `data/bundle/scenarios.json`, keyed on the same district ids the geography bundle draws
 * and the census join reports, so the three artifacts join on a string and nothing has to be
 * matched at runtime.
 *
 * Kept apart from the other two builds by the same rule as they are kept apart from each other:
 * failure mode. The geometry build fails on torn rings, the census join on names and arithmetic,
 * and this one fails on a *partition* — a district in two units, a district in none, a district
 * that does not exist. None of those is discoverable by looking at a map, which is the point of
 * failing here rather than on screen.
 *
 * The emitted artifact is not a re-serialisation of the module for its own sake. It carries the
 * variants **resolved**: claims stated as their advocates state them, next to the 2023 districts
 * this map actually draws them as, with every fold recorded. That resolution is the part a
 * reviewer needs to see, and committing it is what makes a change to a proposal's territory a
 * dated diff rather than something that happens between two page loads (D19).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BASES,
  TERRITORY_CLAIM_POLICY,
  universeDistricts,
  validateScenarios,
  type ResolvedPartition,
  type Variant,
} from './lib/scenarios.ts';
import { CENSUS_DISTRICT_COUNT, ROSTER_DISTRICT_COUNT } from './lib/roster.ts';
import { VARIANTS } from './lib/variants.ts';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT_FILE = resolve(ROOT, 'data/bundle/scenarios.json');

const SOURCE_URLS = {
  content: 'scripts/lib/variants.ts — the typed scenario module, reviewed as a diff',
  roster:
    'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf',
  folds: 'data/reference/post-census-district-folds.json',
} as const;

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

/** The card's own view of a variant, with the partition resolved onto drawn districts. */
function emit(variant: Variant, partition: ResolvedPartition) {
  const proposed = partition.units.filter((u) => u.kind === 'proposed');
  return {
    id: variant.id,
    basis: variant.basis,
    name: variant.name,
    tagline: variant.tagline ?? null,
    // Resolved here rather than at render time: a variant whose provenance differs from its
    // basis (L7 is synthesized where the Language basis is a proxy) must not depend on the
    // renderer remembering to check for an override.
    badges: variant.badges ?? BASES[variant.basis].badges,
    rationale: variant.rationale,
    status: variant.status,
    advocacy: variant.advocacy,
    opposedBy: variant.opposedBy,
    composition: variant.composition,
    footnotes: variant.footnotes,
    notes: variant.notes ?? [],
    sources: variant.sources,
    statistics: variant.statistics ?? { modernFigures: true },
    partition: {
      universe: partition.universe,
      districts: partition.districts,
      claimed: partition.claimed,
    },
    counts: {
      units: partition.units.length,
      proposedUnits: proposed.length,
      /** The claim's own count, and what this map draws it as. L1: 13 stated, 11 drawn. */
      claimedDistricts: proposed.reduce((n, u) => n + u.claimed.length, 0),
      drawnDistricts: proposed.reduce((n, u) => n + u.districts.length, 0),
    },
    units: partition.units.map((unit) => {
      const source = variant.units.find((u) => u.id === unit.id);
      return {
        id: unit.id,
        name: unit.name,
        alsoKnownAs: source?.alsoKnownAs ?? [],
        kind: unit.kind,
        note: source?.note ?? null,
        claimed: unit.claimed,
        districts: unit.districts,
        folded: unit.folded,
        excludes: unit.excludes,
      };
    }),
  };
}

function main(): void {
  console.log('Validating the scenario set as partitions of the 2023 district set');

  const { variants, problems } = validateScenarios(VARIANTS);
  if (problems.length > 0) {
    fail(
      `${problems.length} problem(s) in the scenario set. A variant is a complete partition — ` +
        `every district in exactly one unit, no gaps and no overlaps (D6) — and one that is not ` +
        `must never reach the bundle:\n` +
        problems.map((p) => `    ${p}`).join('\n'),
    );
  }
  if (variants.length !== VARIANTS.length) fail('a variant was validated away without a problem');

  const scenarios = {
    provenance: {
      generated: new Date().toISOString(),
      vintage: '2023 census (as on 01-03-2023) — geometry and statistics both, per ADR-0001',
      unit: 'district',
      joinsTo: 'data/bundle/geography.topojson.json, on the district `name` property',
      sources: SOURCE_URLS,
      counts: {
        variants: variants.length,
        bases: Object.keys(BASES).length,
        units: variants.reduce((n, v) => n + v.partition.units.length, 0),
      },
      universes: {
        drawn: universeDistricts('drawn').length,
        census: universeDistricts('census').length,
        note:
          `A variant declares which district set it partitions. \`drawn\` is all ` +
          `${ROSTER_DISTRICT_COUNT} districts on the map, so nothing is left uncoloured; ` +
          `\`census\` is the ${CENSUS_DISTRICT_COUNT} PBS published 2023 results for — the four ` +
          `provinces and ICT — leaving AJK and Gilgit-Baltistan outside the partition, drawn and ` +
          `named and in no unit. Both are complete partitions; they are complete over different ` +
          `ground, and a reader has to be told which.`,
      },
      territoryClaims: {
        policy: TERRITORY_CLAIM_POLICY,
        note:
          `Whether a unit that is not itself a territory may take an AJK or Gilgit-Baltistan ` +
          `district is an open product decision (CLAUDE.md open item 2b), and the build's ` +
          `current answer is "${TERRITORY_CLAIM_POLICY}". Those districts are drawn but carry no ` +
          `PBS statistic of any kind, so a unit containing one has a population short by an ` +
          `unknowable amount. Under "forbid" the build stops and names the district rather than ` +
          `publishing a province drawn across a ceasefire line.`,
      },
      claimVsDrawing:
        'A unit lists the districts its advocates name. Districts created after the census date ' +
        'have no population row and are not drawn, so each is folded into its 2023 parent and ' +
        'recorded in the unit\'s `folded` list. South Punjab is stated as 13 districts, was 11 ' +
        'before 2022, and draws as 11 — one piece of ground, three true counts.',
    },
    bases: BASES,
    variants: variants.map(({ variant, partition }) => emit(variant, partition)),
  };

  mkdirSync(resolve(OUT_FILE, '..'), { recursive: true });
  writeFileSync(OUT_FILE, `${JSON.stringify(scenarios, null, 2)}\n`);

  for (const { variant, partition } of variants) {
    const proposed = partition.units.filter((u) => u.kind === 'proposed');
    console.log(
      `  ${variant.id.padEnd(4)} ${variant.name.padEnd(32)} ${String(
        partition.units.length,
      ).padStart(2)} units, ${String(partition.districts).padStart(3)} districts ` +
        `(${proposed.length} proposed: ${proposed.map((u) => u.name).join(', ')})`,
    );
  }

  const bytes = readFileSync(OUT_FILE).byteLength;
  console.log(
    `\n✓ ${OUT_FILE.replace(`${ROOT}/`, '')} — ${variants.length} variant(s), ` +
      `${(bytes / 1024).toFixed(0)} KiB`,
  );
}

main();
