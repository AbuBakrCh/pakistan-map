/**
 * The city dots, and the one question they raise: what makes a city *major* (#8).
 *
 * There is no basemap (D11), so a reader orienting themselves on this map has only the boundaries
 * and whatever dots are on it. That is what the dots are for, and it is the whole of what they are
 * for — nothing on this map is argued from a city.
 *
 * **"Major" is answered administratively, because it cannot be answered demographically.** PBS
 * publishes the 2023 census by district; a city is not a district and several of these are seven
 * of them (Karachi) or none of them (Islamabad is the district). No city population exists at this
 * project's vintage, from this project's sources, at this project's tier — and the governing rule
 * is that data we do not have is not used. Ranking cities by population would mean reaching for
 * OSM's own `population` tags, which are a second lineage at an unstated vintage, or typing
 * figures out of a report nothing else here rests on. Either would put an unsourced number under
 * a dot.
 *
 * So the criterion is: **the seat of a first-level unit** — the four provincial capitals, the
 * federal capital, and the capital of each of the two territories. Seven dots, which is as sparse
 * as the brief asks for, and every one of them is where the reader already has a reason to look.
 * It is `official`, not `census`: the fact is constitutional, and the *position* is OSM's own
 * `admin_centre` — the node the province's own boundary relation names as its seat, so a dot is
 * joined to a unit by identity and not by a name that happens to match.
 *
 * The obvious cost is stated rather than hidden: Faisalabad, Rawalpindi, Gujranwala and Multan are
 * larger than three of the seven and are not drawn. A set that mixed "capital" with "large" would
 * be two criteria wearing one badge, and only one of them has a source.
 */

import type { Position } from './rings.ts';

/**
 * OSM's `ISO3166-2` on a first-level relation -> the roster's own code for that unit.
 *
 * Keyed on the code and not on the name, for the reason every other join in this pipeline is:
 * OSM calls PK-JK "Azad Kashmir" and the roster calls it "Azad Jammu & Kashmir", and a name match
 * would either fail or have to be talked into succeeding.
 */
export const FIRST_LEVEL_CODES: Readonly<Record<string, string>> = {
  'PK-BA': 'BA',
  'PK-GB': 'GB',
  'PK-IS': 'ICT',
  'PK-JK': 'AJK',
  'PK-KP': 'KP',
  'PK-PB': 'PB',
  'PK-SD': 'SD',
};

/** A first-level relation, as far as this module needs it. */
export interface FirstLevelRelation {
  readonly id: number;
  /** `ISO3166-2`, or undefined where OSM does not carry one — which fails the build. */
  readonly iso: string | undefined;
  /** Node members and their roles, in the order Overpass returned them. */
  readonly members: readonly { readonly type: string; readonly role?: string; readonly ref?: number }[];
}

/** An OSM node, as far as this module needs it. `name` is the English name and only that. */
export interface SeatNode {
  readonly id: number;
  readonly lat: number;
  readonly lon: number;
  readonly name: string;
}

export interface Seat {
  readonly name: string;
  /** The first-level unit this is the seat of, under the roster's name for it. */
  readonly of: string;
  readonly kind: 'province' | 'territory' | 'capital';
  readonly position: Position;
  readonly node: number;
}

export interface ResolvedSeats {
  readonly seats: Seat[];
  /**
   * First-level units with no seat, named. A dot missing is not a cosmetic loss: the seven are
   * the whole set, so one absent is a province with nothing on it, and it would look exactly like
   * a province whose capital is not major.
   */
  readonly missing: string[];
  /**
   * Units whose seat node is in the cache but carries no English name, with the node id to go and
   * look at. Reported apart from `missing` because the two are different upstream events with
   * different fixes — see `resolveSeats`. Both still fail the build; only the sentence differs.
   */
  readonly unnamed: { unit: string; node: number }[];
}

/**
 * Pair each first-level unit with the node its own relation names as its `admin_centre`.
 *
 * Relations outside the roster are ignored rather than reported — the bbox fetch caches Kandahar,
 * Nangarhar, Jammu and Kashmir and Ladakh as strays exactly as the boundary queries do, and their
 * seats are somebody else's capitals. Everything on the roster's side is compulsory: a unit with
 * no `admin_centre`, or one pointing at a node the cache does not hold, comes back in `missing`
 * and fails the build by name.
 */
export function resolveSeats(
  relations: readonly FirstLevelRelation[],
  nodes: readonly SeatNode[],
  units: readonly { readonly code: string; readonly name: string; readonly kind: Seat['kind'] }[],
): ResolvedSeats {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const byCode = new Map(units.map((unit) => [unit.code, unit]));
  const seats: Seat[] = [];
  const found = new Set<string>();
  const unnamed: { unit: string; node: number }[] = [];

  for (const relation of relations) {
    const code = relation.iso === undefined ? undefined : FIRST_LEVEL_CODES[relation.iso];
    if (code === undefined) continue;
    const unit = byCode.get(code);
    if (unit === undefined) continue;

    const member = relation.members.find(
      (candidate) => candidate.type === 'node' && candidate.role === 'admin_centre',
    );
    const node = member?.ref === undefined ? undefined : byId.get(member.ref);
    if (node === undefined) continue;
    // Two different upstream events, kept apart because they call for different work. No node at
    // all means the relation does not name its seat and the query has to change; a node with no
    // English name means OSM has the seat but not in the language this app displays, and the fix
    // is an alias. Folding them together would send a maintainer to read the wrong file.
    if (node.name === '') {
      unnamed.push({ unit: unit.name, node: node.id });
      continue;
    }

    found.add(unit.name);
    seats.push({
      name: node.name,
      of: unit.name,
      kind: unit.kind,
      position: [node.lon, node.lat],
      node: node.id,
    });
  }

  return {
    // Sorted by name so the artifact does not reshuffle with whatever order Overpass replied in.
    seats: seats.sort((a, b) => a.name.localeCompare(b.name)),
    missing: units
      .filter((unit) => !found.has(unit.name) && !unnamed.some((u) => u.unit === unit.name))
      .map((unit) => unit.name),
    unnamed,
  };
}
