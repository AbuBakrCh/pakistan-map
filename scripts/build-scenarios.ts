/**
 * Validate the variants, dissolve their units, and bake both into the bundle (#14, #15).
 *
 *   npm run build:data:scenarios
 *
 * Emits two artifacts. `data/bundle/scenarios.json` is the variants **resolved** — claims stated
 * as their advocates state them, next to the 2023 districts this map actually draws them as, with
 * every fold recorded — keyed on the same district names the geography bundle draws and the
 * census join reports, so the three artifacts join on a string and nothing has to be matched at
 * runtime. `data/bundle/unit-outlines.json` is one outline per unit, dissolved out of those
 * districts' arcs (#15).
 *
 * Kept apart from the other two builds by the same rule as they are kept apart from each other:
 * failure mode. The geometry build fails on torn rings, the census join on names and arithmetic,
 * and this one fails on a *partition* — a district in two units, a district in none, a district
 * that does not exist, or a unit whose outline is not the union of the districts it claims. None
 * of those is discoverable by looking at a map, which is the point of failing here rather than on
 * screen.
 *
 * Neither artifact is a re-serialisation of the module for its own sake. The resolution and the
 * dissolve are the parts a reviewer needs to see, and committing them is what makes a change to a
 * proposal's territory a dated diff rather than something that happens between two page loads
 * (D19) — the outlines especially, which are the geometry the app draws a proposal as and would
 * otherwise be recomputed on every load from data nobody had reviewed.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MultiPolygon, Topology } from 'topojson-specification';
import {
  AREA_AGREEMENT,
  areaKm2,
  dissolve,
  outlineProblems,
  polygonsOf,
  type PolygonalGeometry,
} from './lib/unit-outlines.ts';
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
const GEOGRAPHY_FILE = resolve(ROOT, 'data/bundle/geography.topojson.json');
const OUTLINES_FILE = resolve(ROOT, 'data/bundle/unit-outlines.json');

/** How `unit-outlines.json` names the geometry its arc indices are into. */
const GEOGRAPHY_BUNDLE = 'data/bundle/geography.topojson.json';

const SOURCE_URLS = {
  content: 'scripts/lib/variants.ts — the typed scenario module, reviewed as a diff',
  roster:
    'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf',
  folds: 'data/reference/post-census-district-folds.json',
  geometry: `${GEOGRAPHY_BUNDLE} — the districts the outlines are dissolved from`,
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

/** The drawn districts of the committed geography bundle, by the name every artifact joins on. */
function drawnDistricts(topology: Topology): Map<string, PolygonalGeometry> {
  const object = topology.objects['districts'];
  if (object === undefined || object.type !== 'GeometryCollection') {
    fail(
      `${GEOGRAPHY_BUNDLE} has no \`districts\` geometry collection, so there is nothing to ` +
        `dissolve a unit out of. Run npm run build:data:normalize first.`,
    );
  }
  const found = new Map<string, PolygonalGeometry>();
  for (const geometry of object.geometries) {
    const name = (geometry.properties as Record<string, unknown> | undefined)?.['name'];
    if (typeof name !== 'string') continue;
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') continue;
    found.set(name, geometry);
  }
  return found;
}

/** One unit's outline, as `unit-outlines.json` carries it: arcs, plus who it belongs to. */
interface EmittedOutline extends MultiPolygon {
  readonly properties: {
    readonly variant: string;
    readonly unit: string;
    readonly name: string;
    readonly kind: string;
    readonly districts: number;
    readonly polygons: number;
    readonly areaKm2: number;
  };
}

/**
 * Dissolve every unit of every variant into one outline, and check each against the union of the
 * districts it came from (#15).
 *
 * Problems are collected across the whole set rather than thrown at the first one, so a bad
 * change is reported as everything it broke and not as whichever unit happens to sort first.
 */
function dissolveUnits(
  topology: Topology,
  validated: readonly { readonly variant: Variant; readonly partition: ResolvedPartition }[],
): Record<string, { type: 'GeometryCollection'; geometries: EmittedOutline[] }> {
  const districts = drawnDistricts(topology);
  const problems: string[] = [];
  const objects: Record<string, { type: 'GeometryCollection'; geometries: EmittedOutline[] }> = {};

  for (const { variant, partition } of validated) {
    const geometries: EmittedOutline[] = [];
    for (const unit of partition.units) {
      const label = `${variant.id} unit "${unit.name}"`;
      const members: PolygonalGeometry[] = [];
      const missing: string[] = [];
      for (const district of unit.districts) {
        const geometry = districts.get(district);
        if (geometry === undefined) missing.push(district);
        else members.push(geometry);
      }
      if (missing.length > 0) {
        // Named, not counted: the partition validator has already agreed these are districts, so
        // this can only be a district the geometry build does not draw — which is a fold table
        // and a fetch to look at, and the name is the whole of the lead.
        problems.push(
          `${label} claims ${missing.join(', ')}, which ${GEOGRAPHY_BUNDLE} does not draw. An ` +
            `outline cannot be dissolved out of ground that is not on the map.`,
        );
        continue;
      }

      const outline = dissolve(topology, members);
      problems.push(...outlineProblems(label, topology, members, outline));
      geometries.push({
        ...outline,
        properties: {
          variant: variant.id,
          unit: unit.id,
          name: unit.name,
          kind: unit.kind,
          districts: unit.districts.length,
          // Islands make pieces of their own, so this is a drawing fact and not a contiguity
          // one — see the note on `polygonsOf`. Carried because the renderer sizes a unit's
          // label off the largest piece, and #16 is where contiguity gets answered.
          polygons: polygonsOf(outline),
          areaKm2: Math.round(areaKm2(topology, outline)),
        },
      });
    }
    objects[variant.id] = { type: 'GeometryCollection', geometries };
  }

  if (problems.length > 0) {
    fail(
      `${problems.length} problem(s) dissolving units into outlines. A unit outline is exactly ` +
        `the union of its districts — a difference means the map would draw a proposal as ` +
        `ground its advocates did not claim:\n` +
        problems.map((p) => `    ${p}`).join('\n'),
    );
  }
  return objects;
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

  // ---- The dissolve (#15) --------------------------------------------------------------------
  console.log('\nDissolving each unit out of its districts’ arcs');

  const geography = JSON.parse(readFileSync(GEOGRAPHY_FILE, 'utf8')) as Topology & {
    readonly provenance?: { readonly generated?: string; readonly vintage?: string };
  };
  const objects = dissolveUnits(geography, variants);

  const outlines = {
    provenance: {
      generated: new Date().toISOString(),
      vintage: '2023 census (as on 01-03-2023) — geometry and statistics both, per ADR-0001',
      sources: SOURCE_URLS,
      method:
        'Each unit is the merge of its districts’ arcs, not a union of their polygons. The ' +
        'geography bundle draws all three administrative tiers out of one shared arc set, so two ' +
        'districts that share a border share the arc: an arc used by two of a unit’s districts ' +
        'is internal and is dropped, an arc used by one is on the outside edge and is kept. ' +
        'Nothing is recomputed and no vertex moves, which is what leaves no sliver and no seam ' +
        'where a district border used to be. A unit whose districts do not touch draws as one ' +
        'piece per group — contiguity is flagged, never blocked (D7) — and islands make pieces ' +
        'of their own, so `polygons` is a drawing fact and not a contiguity one.',
      // This file is *arc indices*, and an arc index means nothing on its own. It is written
      // without arcs of its own on purpose: copying them would duplicate 2 MB and, worse, allow
      // the copy to drift from the boundaries the app actually draws. The renderer reads these
      // geometries against the geography topology's arcs.
      arcsFrom: GEOGRAPHY_BUNDLE,
      geography: {
        // The stamp of the geometry these indices were cut against. Rebuilding the geography
        // without rebuilding the outlines leaves the two disagreeing here, which the suite reads
        // as the stale artifact it is — an arc index that has quietly come to mean another edge
        // is invisible on screen until a boundary is in the wrong place.
        generated: geography.provenance?.generated ?? null,
        arcs: geography.arcs.length,
        bbox: geography.bbox ?? null,
      },
      validation: {
        areaAgreement: AREA_AGREEMENT,
        note:
          'Every outline is checked against the union of the districts it came from, three ways: ' +
          'its arcs are exactly those its districts do not share, its area equals its districts’ ' +
          'total to floating point, and every ring closes. Any disagreement fails the build ' +
          'naming the unit.',
      },
      counts: {
        variants: Object.keys(objects).length,
        units: Object.values(objects).reduce((n, o) => n + o.geometries.length, 0),
        polygons: Object.values(objects).reduce(
          (n, o) => n + o.geometries.reduce((m, g) => m + g.properties.polygons, 0),
          0,
        ),
      },
    },
    objects,
  };

  writeFileSync(OUTLINES_FILE, `${JSON.stringify(outlines)}\n`);

  for (const [id, object] of Object.entries(objects)) {
    console.log(
      `  ${id.padEnd(4)} ${String(object.geometries.length).padStart(2)} outlines: ` +
        object.geometries
          .map((g) => `${g.properties.name} (${g.properties.polygons})`)
          .join(', '),
    );
  }

  const outlineBytes = readFileSync(OUTLINES_FILE).byteLength;
  console.log(
    `\n✓ ${OUTLINES_FILE.replace(`${ROOT}/`, '')} — ` +
      `${outlines.provenance.counts.units} unit outline(s), ` +
      `${(outlineBytes / 1024).toFixed(0)} KiB`,
  );
}

main();
