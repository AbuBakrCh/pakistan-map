/**
 * Validate the variants, dissolve their units, and bake both into the bundle (#14, #15).
 *
 *   npm run build:data:scenarios
 *
 * Emits three artifacts. `data/bundle/scenarios.json` is the variants **resolved** — claims stated
 * as their advocates state them, next to the 2023 districts this map actually draws them as, with
 * every fold recorded — keyed on the same district names the geography bundle draws and the
 * census join reports, so the artifacts join on a string and nothing has to be matched at
 * runtime. `data/bundle/unit-outlines.json` is one outline per unit, dissolved out of those
 * districts' arcs (#15). `data/bundle/adjacency.json` is which districts share a border, derived
 * from the same arcs in the same pass (#16).
 *
 * The graph is a fact about the geometry rather than about the scenarios, and it is built here
 * anyway, for two reasons. It is cut from the same arc set as the outlines and by the same
 * reasoning, so the two derivations belong in one place; and its only consumer is the contiguity
 * flag on the units below, which is written into `scenarios.json` in this same run. Building it in
 * `normalize-geometry.ts` instead would mean rewriting a 2.2 MB boundary artifact whose boundaries
 * had not changed — and the whole value of committing that file is that a diff in it means a
 * border moved.
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
  adjacencyProblems,
  buildAdjacency,
  contiguityOf,
  describeContiguity,
  edgeCount,
  isolatedDistricts,
  type AdjacencyGraph,
  type Contiguity,
} from './lib/adjacency.ts';
import {
  BASES,
  TERRITORY_CLAIM_POLICY,
  universeDistricts,
  validateScenarios,
  type ResolvedPartition,
  type Variant,
} from './lib/scenarios.ts';
import {
  scorecardOf,
  unitPopulations,
  type DistrictPopulations,
  type DistrictOrigins,
} from './lib/scorecard.ts';
import { CENSUS_DISTRICT_COUNT, ROSTER, ROSTER_DISTRICT_COUNT } from './lib/roster.ts';
import { districtCentroids } from './lib/centroids.ts';
import { dominantTongues, variantsFrom } from './lib/variants.ts';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT_FILE = resolve(ROOT, 'data/bundle/scenarios.json');
const GEOGRAPHY_FILE = resolve(ROOT, 'data/bundle/geography.topojson.json');
const STATISTICS_FILE = resolve(ROOT, 'data/bundle/statistics.json');
const OUTLINES_FILE = resolve(ROOT, 'data/bundle/unit-outlines.json');
const ADJACENCY_FILE = resolve(ROOT, 'data/bundle/adjacency.json');

/** How `unit-outlines.json` names the geometry its arc indices are into. */
const GEOGRAPHY_BUNDLE = 'data/bundle/geography.topojson.json';
/** Where every population on the scorecard comes from, district by district (#20). */
const STATISTICS_BUNDLE = 'data/bundle/statistics.json';

const SOURCE_URLS = {
  content: 'scripts/lib/variants.ts — the typed scenario module, reviewed as a diff',
  roster:
    'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf',
  folds: 'data/reference/post-census-district-folds.json',
  geometry: `${GEOGRAPHY_BUNDLE} — the districts the outlines are dissolved from`,
  statistics: `${STATISTICS_BUNDLE} — the 2023 census populations every scorecard figure sums`,
} as const;

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

/** What the scorecard is computed against: the census, and today's map. */
interface Census {
  readonly populations: DistrictPopulations;
  readonly origins: DistrictOrigins;
}

/** The card's own view of a variant, with the partition resolved onto drawn districts. */
function emit(
  variant: Variant,
  partition: ResolvedPartition,
  graph: AdjacencyGraph,
  census: Census,
) {
  const proposed = partition.units.filter((u) => u.kind === 'proposed');
  const contiguity = new Map<string, Contiguity>(
    partition.units.map((unit) => [unit.id, contiguityOf(graph, unit.districts)]),
  );
  const statistics = variant.statistics ?? { modernFigures: true };
  const populations = new Map(
    unitPopulations(partition.units, census.populations).map((found) => [found.unit, found]),
  );
  return {
    id: variant.id,
    basis: variant.basis,
    name: variant.name,
    tagline: variant.tagline ?? null,
    // Resolved here rather than at render time: a variant whose provenance differs from its
    // basis (L7 is synthesized where the Language basis is a proxy) must not depend on the
    // renderer remembering to check for an override.
    badges: variant.badges ?? BASES[variant.basis].badges,
    /*
     * The other half of the provenance (#21), and it has to survive the bake.
     *
     * The schema has carried an optional `vintage` since it was written and the validator has
     * checked it, but this function never emitted it — so every variant reached the runtime dated
     * at its basis, and nothing went red, because until #32 nothing on screen printed a variant's
     * date. That is exactly the silence a badge without a date is: checkable in the module, absent
     * from the artifact.
     *
     * Written **only where the variant states one**. An absent field is the signal to read the
     * basis's, and filling it in here with the basis's value would erase the difference between a
     * variant that dated its own boundary and one that did not — which is the difference the
     * Historical basis exists on, since what it declares is a rule for finding a date rather than
     * a date.
     */
    ...(variant.vintage === undefined ? {} : { vintage: variant.vintage }),
    rationale: variant.rationale,
    status: variant.status,
    advocacy: variant.advocacy,
    opposedBy: variant.opposedBy,
    composition: variant.composition,
    footnotes: variant.footnotes,
    notes: variant.notes ?? [],
    sources: variant.sources,
    statistics,
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
      /**
       * The scorecard's contiguity line (#20), counted over **every** unit and not only the
       * proposed ones: a variant that leaves a province in two pieces has done that to a real
       * province, and hiding it behind "unchanged" would be the app choosing what counts as its
       * own doing.
       */
      nonContiguousUnits: partition.units.filter((u) => !contiguity.get(u.id)?.contiguous).length,
    },
    /**
     * The scorecard (#20) — unit count, population spread, largest:smallest, districts moved.
     *
     * The fifth line is not here on purpose: contiguity is answered once, off the adjacency graph,
     * and lives on the units and in `counts.nonContiguousUnits` above. A second derivation would be
     * a second answer, and the interesting failure is the one where the two disagree.
     */
    scorecard: scorecardOf(partition.units, {
      populations: census.populations,
      origins: census.origins,
      modernFigures: statistics,
    }),
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
        /**
         * The sum of its districts' 2023 census populations, and `null` where the census does not
         * reach all of them — the twenty AJK and Gilgit-Baltistan districts PBS published no
         * results for (D25). Never a partial sum wearing the look of a whole one, and the districts
         * that are missing are named rather than counted.
         *
         * `null` for **every** unit of a variant that withholds modern figures (H2, #30). The
         * scorecard voids its spread already, but a unit's own line is a second place a figure
         * appears, and 2023 populations printed against the princely states of 1947 would be the
         * exact claim the variant exists to refuse — one the card's voided total would not undo.
         * The rule is the variant's, so it is applied here rather than per unit.
         */
        population: statistics.modernFigures ? populations.get(unit.id)?.population ?? null : null,
        uncounted: populations.get(unit.id)?.uncounted ?? [],
        /**
         * Flagged, never blocked (D7). `detached` is every group but the largest, named — the
         * districts stranded away from the body of the unit are what a reader wants said, and the
         * body itself is already listed above. It is empty for a contiguous unit, so a card can
         * render it without asking first.
         */
        contiguity: {
          contiguous: contiguity.get(unit.id)?.contiguous ?? false,
          pieces: contiguity.get(unit.id)?.pieces ?? 0,
          detached: contiguity.get(unit.id)?.detached ?? [],
        },
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
  // ---- The adjacency graph (#16) -------------------------------------------------------------
  // Read first, for two reasons now. The contiguity flag written into `scenarios.json` below is
  // read off it — the graph is derived from the arcs the geometry build wrote, so a variant cannot
  // be flagged against a border it does not actually have — and the two derived Language variants
  // (#26) are *drawn* from it, since a region of one language is a connected group of districts
  // and there is nothing to connect them across until this exists.
  const geography = JSON.parse(readFileSync(GEOGRAPHY_FILE, 'utf8')) as Topology & {
    readonly provenance?: { readonly generated?: string; readonly vintage?: string };
  };
  const districtGeometries = drawnDistricts(geography);
  const named = [...districtGeometries].map(([name, geometry]) => ({ name, geometry }));
  const graph = buildAdjacency(named);

  const graphProblems = adjacencyProblems(graph, named);
  if (graphProblems.length > 0) {
    fail(
      `${graphProblems.length} problem(s) in the district adjacency graph. Every unit's ` +
        `contiguity is read off it, so a graph that is wrong reports proposals as broken that ` +
        `are not, and whole ones that are:\n` +
        graphProblems.map((p) => `    ${p}`).join('\n'),
    );
  }

  // ---- The census the scorecard sums (#20) ---------------------------------------------------
  // Read from the committed statistics artifact rather than from the census package, so a unit's
  // population is the same number the tooltip prints for the districts under it and the same one
  // `statistics.test.ts` reconciles against PBS Table 1. Two paths to one figure is two figures.
  const statistics = JSON.parse(readFileSync(STATISTICS_FILE, 'utf8')) as {
    readonly provenance?: { readonly generated?: string; readonly vintage?: string };
    readonly districts?: Record<
      string,
      {
        readonly population?: unknown;
        readonly motherTongue?: { readonly dominant?: unknown };
      }
    >;
  };
  const populations = new Map<string, number>();
  // District -> the census's dominant mother tongue, or `null` where it names none (#26). Only the
  // 136 the census reaches are in it at all, which is the distinction the rule engine's first
  // refusal turns on.
  const dominant = dominantTongues({ districts: statistics.districts ?? {} });
  for (const [district, record] of Object.entries(statistics.districts ?? {})) {
    if (typeof record.population !== 'number') {
      fail(
        `${STATISTICS_BUNDLE} carries ${district} with no population. Every scorecard figure is a ` +
          `sum of district populations; a district present without one would be added as nothing ` +
          `and read as a figure. Run npm run build:data:census first.`,
      );
    }
    populations.set(district, record.population);
  }
  // Named, never counted. "137 where 136 were expected" sends a maintainer to diff two artifacts
  // by hand; the district that is missing — or the one that should not be there — is the whole of
  // what the failure has to say.
  const expected = ROSTER.filter((entry) => entry.kind !== 'territory').flatMap(
    (entry) => entry.districts,
  );
  const missing = expected.filter((district) => !populations.has(district));
  const unexpected = [...populations.keys()].filter((district) => !expected.includes(district));
  if (missing.length > 0 || unexpected.length > 0) {
    fail(
      `${STATISTICS_BUNDLE} does not cover the ${CENSUS_DISTRICT_COUNT} districts of the 2023 ` +
        `census. A short census leaves units silently outside the figures rather than counted.` +
        (missing.length === 0 ? '' : ` Missing: ${missing.join(', ')}.`) +
        (unexpected.length === 0 ? '' : ` Not census districts: ${unexpected.join(', ')}.`),
    );
  }
  // Today's map, which "districts moved" is measured against, from the roster the geometry is
  // drawn from — so every drawn district has a first-level entity, AJK's and GB's twenty included.
  const origins = new Map<string, string>(
    ROSTER.flatMap((entry) => entry.districts.map((d) => [d, entry.name] as const)),
  );
  const census = { populations, origins };

  // ---- The variants (#26) --------------------------------------------------------------------
  // Eight of the ten are literals in `variants.ts`, because eight of them transcribe a line
  // somebody drew. L6 and L7 have no document behind them and are computed here, from the census
  // and the graph read above — which is why the scenario module hands back a function rather than
  // a constant. A derivation that threw would be a variant this build cannot draw at all, so it
  // is caught and reported like any other build failure rather than left as a stack trace.
  console.log('Validating the scenario set as partitions of the 2023 district set');
  let VARIANTS: readonly Variant[];
  try {
    VARIANTS = variantsFrom({
      graph,
      dominant,
      populations,
      // Taken from the geometry read above rather than from a table of our own: A4's rule is a
      // distance to a capital, and a centroid derived anywhere but from the drawn district would
      // measure a map this build does not publish.
      centroids: districtCentroids(geography),
    });
  } catch (error) {
    fail(
      `a variant could not be derived from the committed census and district borders. Six ` +
        `variants have no published district list and are drawn here — two Language ones from ` +
        `Table 11's dominant mother tongue (#26) and four Administrative ones from the rule ` +
        `engine (#27) — so a change to the census or to the borders can leave one of them ` +
        `undrawable:\n    ${error instanceof Error ? error.message : String(error)}`,
    );
  }

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
      contiguity: {
        from: 'data/bundle/adjacency.json',
        nonContiguousUnits: variants.reduce(
          (n, { partition }) =>
            n + partition.units.filter((u) => !contiguityOf(graph, u.districts).contiguous).length,
          0,
        ),
        note:
          'Every unit carries a `contiguity` block, read off the district adjacency graph rather ' +
          'than off the shape it draws as. Contiguity is flagged, never blocked (D7): a unit in ' +
          'two pieces is a legitimate proposal — several real ones are — and refusing to draw a ' +
          'claim is a stronger editorial act than drawing it with a note. It is not the same ' +
          'number as the outline’s `polygons`, which counts shapes on paper and so counts islands: ' +
          'South Punjab is one piece and three polygons.',
      },
      scorecard: {
        from: STATISTICS_BUNDLE,
        // The stamp of the census join these sums were taken from, on exactly the reasoning the
        // outlines and the adjacency graph carry the geometry's: a scorecard is *numbers*, and a
        // stale one is undetectable from its own contents — every figure would still add up, to a
        // census that had since been rebuilt.
        statistics: {
          generated: statistics.provenance?.generated ?? null,
          districts: populations.size,
        },
        method:
          'A unit’s population is the sum of its districts’ 2023 census populations and nothing ' +
          'else: the census publishes by district, every unit is composed of districts, and ' +
          'nothing between the two is interpolated or apportioned. Districts moved are those ' +
          'whose unit is not the one carrying their current province forward — the unit named ' +
          'Punjab is Punjab whatever it has lost, and South Punjab is not, however much of Punjab ' +
          'it is made of. Contiguity is not recomputed here; it is read off the adjacency graph ' +
          'and carried on each unit, because two derivations of one fact are two answers to it.',
        withheld:
          'PBS published the 2023 census for the four provinces and Islamabad — no district of ' +
          'Azad Jammu & Kashmir or Gilgit-Baltistan has a population figure (D25). A unit made ' +
          'entirely of those districts carries no population and is set aside from the spread by ' +
          'name; a unit that takes in some of them voids the variant’s population figures ' +
          'altogether, because a largest compared against a smallest that is missing people is ' +
          'worse than no comparison. A variant may also withhold modern figures itself, in its ' +
          'own words. Absence is never a zero.',
      },
      claimVsDrawing:
        'A unit lists the districts its advocates name. Districts created after the census date ' +
        'have no population row and are not drawn, so each is folded into its 2023 parent and ' +
        'recorded in the unit\'s `folded` list. South Punjab is stated as 13 districts, was 11 ' +
        'before 2022, and draws as 11 — one piece of ground, three true counts.',
    },
    bases: BASES,
    variants: variants.map(({ variant, partition }) => emit(variant, partition, graph, census)),
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
    // Read off what was just written, never computed a second time: a build log quoting its own
    // recomputation could agree with itself while disagreeing with the artifact, which is the one
    // failure a log is supposed to catch.
    const scorecard = scenarios.variants.find((emitted) => emitted.id === variant.id)?.scorecard;
    if (scorecard === undefined) continue;
    const spread =
      scorecard.population === null
        ? `no population figures (${scorecard.populationWithheld?.kind})`
        : `${scorecard.population.largest.name} largest, ${scorecard.population.smallest.name} ` +
          `smallest, ${scorecard.population.ratio ?? '—'}:1`;
    console.log(
      `       scorecard: ${scorecard.districtsMoved.count} of ${scorecard.districtsMoved.of} ` +
        `districts change hands; ${spread}`,
    );
  }

  const bytes = readFileSync(OUT_FILE).byteLength;
  console.log(
    `\n✓ ${OUT_FILE.replace(`${ROOT}/`, '')} — ${variants.length} variant(s), ` +
      `${(bytes / 1024).toFixed(0)} KiB`,
  );

  // ---- The adjacency artifact (#16) ----------------------------------------------------------
  const isolated = isolatedDistricts(graph);
  const adjacency = {
    provenance: {
      generated: new Date().toISOString(),
      vintage: '2023 census (as on 01-03-2023) — geometry and statistics both, per ADR-0001',
      sources: SOURCE_URLS,
      unit: 'district',
      method:
        'Two districts are neighbours iff they share an arc. The geography bundle draws all ' +
        'three administrative tiers out of one shared arc set, so where two districts touch the ' +
        'edge between them is one arc, used once from each side — adjacency is a set question ' +
        'about integers with an exact answer. Testing polygons for intersection would ask the ' +
        'same question of coordinates and answer it to whatever tolerance a clipper worked to, ' +
        'and two districts left a millimetre apart by simplification would come out strangers. ' +
        'An arc index and its reverse (`~i`) are the one border they are.',
      arcsFrom: GEOGRAPHY_BUNDLE,
      geography: {
        // The same stamp `unit-outlines.json` carries, for the same reason: this file is district
        // *names*, so a stale one is not detectable from its own contents — the names would all
        // still resolve, against a topology in which the borders had moved.
        generated: geography.provenance?.generated ?? null,
        arcs: geography.arcs.length,
        bbox: geography.bbox ?? null,
      },
      counts: {
        districts: graph.size,
        /** Shared borders, each counted once. */
        edges: edgeCount(graph),
        components: contiguityOf(graph, [...graph.keys()]).pieces,
        isolated: isolated.length,
      },
      isolated,
      coastline:
        'The coastline clip replaced only the seaward part of a coastal district’s ring, so the ' +
        'inland arcs its neighbours use survive it untouched and no district was cut loose. All ' +
        `${graph.size} drawn districts form a single connected component and none is isolated. ` +
        'Offshore islands are the mirror of that: they share no arc with anything, which is why ' +
        'the polygons a unit draws as and the pieces it consists of are two different numbers.',
    },
    /** District -> its neighbours, each named once, ascending. Symmetric. */
    neighbours: Object.fromEntries(
      [...graph]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, found]) => [name, found]),
    ),
  };

  writeFileSync(ADJACENCY_FILE, `${JSON.stringify(adjacency, null, 2)}\n`);
  console.log(
    `\n✓ ${ADJACENCY_FILE.replace(`${ROOT}/`, '')} — ${adjacency.provenance.counts.districts} ` +
      `districts, ${adjacency.provenance.counts.edges} shared borders, ` +
      `${adjacency.provenance.counts.components} connected component(s)`,
  );
  for (const { variant, partition } of variants) {
    for (const unit of partition.units) {
      const contiguity = contiguityOf(graph, unit.districts);
      if (!contiguity.contiguous) {
        console.log(`  ${describeContiguity(`${variant.id} unit "${unit.name}"`, contiguity)}`);
      }
    }
  }

  // ---- The dissolve (#15) --------------------------------------------------------------------
  console.log('\nDissolving each unit out of its districts’ arcs');

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
