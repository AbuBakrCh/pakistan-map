/**
 * What the seat resolver does when the cache is not what the build expects — the one thing a
 * good bundle cannot demonstrate, since in a good bundle all seven seats are there.
 */

import { describe, expect, it } from 'vitest';
import { type FirstLevelRelation, type SeatNode, resolveSeats } from './seats.ts';

const UNITS = [
  { code: 'PB', name: 'Punjab', kind: 'province' as const },
  { code: 'AJK', name: 'Azad Jammu & Kashmir', kind: 'territory' as const },
];

const NODES: SeatNode[] = [
  { id: 1, lat: 31.5656, lon: 74.3142, name: 'Lahore' },
  { id: 2, lat: 34.3727, lon: 73.471, name: 'Muzaffarabad' },
  { id: 9, lat: 34.0837, lon: 74.7973, name: 'Srinagar' },
];

const relation = (
  iso: string | undefined,
  ref: number | undefined,
  role = 'admin_centre',
): FirstLevelRelation => ({
  id: 100 + (ref ?? 0),
  iso,
  members: ref === undefined ? [] : [{ type: 'node', role, ref }],
});

describe('resolveSeats', () => {
  it('joins a dot to its unit through the relation’s own admin_centre, not through a name', () => {
    // OSM calls PK-JK "Azad Kashmir" and the roster calls it "Azad Jammu & Kashmir". A name match
    // would either fail or have to be talked into succeeding; the code is the identity.
    const { seats, missing } = resolveSeats(
      [relation('PK-PB', 1), relation('PK-JK', 2)],
      NODES,
      UNITS,
    );
    expect(missing).toEqual([]);
    expect(seats.map((seat) => `${seat.name} / ${seat.of} / ${seat.kind}`)).toEqual([
      'Lahore / Punjab / province',
      'Muzaffarabad / Azad Jammu & Kashmir / territory',
    ]);
    expect(seats[0]?.position).toEqual([74.3142, 31.5656]);
  });

  it('names the unit whose seat is missing rather than quietly drawing six dots', () => {
    // Seven dots are the whole of the city set, so one absent is a province with nothing on it —
    // which on screen is indistinguishable from a province whose capital is not major.
    expect(resolveSeats([relation('PK-PB', 1)], NODES, UNITS).missing).toEqual([
      'Azad Jammu & Kashmir',
    ]);
    expect(resolveSeats([relation('PK-PB', undefined)], NODES, UNITS).missing).toEqual([
      'Punjab',
      'Azad Jammu & Kashmir',
    ]);
  });

  it('refuses a node member that is not the admin_centre', () => {
    // Every one of these relations also carries a `label` node, which is a position chosen for
    // typography and not a city. Taking whichever node came first would put a dot in open country.
    const { missing } = resolveSeats([relation('PK-PB', 1, 'label')], NODES, UNITS);
    expect(missing).toEqual(['Punjab', 'Azad Jammu & Kashmir']);
  });

  it('refuses an admin_centre with no English name rather than drawing an unnamed dot', () => {
    const { missing } = resolveSeats(
      [relation('PK-PB', 1)],
      [{ id: 1, lat: 31.5656, lon: 74.3142, name: '' }],
      UNITS,
    );
    expect(missing).toContain('Punjab');
  });

  it('ignores the strays the area query brings back, without reporting them', () => {
    // Jammu and Kashmir, Ladakh, Kandahar and Nangarhar arrive in the same cache as Pakistan's
    // own first-level relations, exactly as they do for the boundary queries. Their seats are
    // somebody else's capitals, and neither drawing them nor complaining about them is right.
    const { seats, missing } = resolveSeats(
      [relation('PK-PB', 1), relation('IN-JK', 9), relation(undefined, 9)],
      NODES,
      [UNITS[0] as (typeof UNITS)[number]],
    );
    expect(seats.map((seat) => seat.name)).toEqual(['Lahore']);
    expect(missing).toEqual([]);
  });
});
