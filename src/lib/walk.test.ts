/**
 * Walking the districts with the keyboard (#35), over the real bundle.
 *
 * The property that matters is coverage: a reader with no pointer reaches *every* district, in an
 * order that does not move under them. Everything else here is about the keys not being swallowed.
 */

import { describe, expect, it } from 'vitest';
import bundle from '../../data/bundle/geography.topojson.json';
import { readDistricts } from './geography.ts';
import { leavesWalk, walkOrder, walkTarget } from './walk.ts';

const districts = readDistricts(bundle as never).features.map((f) => ({
  name: f.properties.name,
  division: f.properties.division,
  province: f.properties.province,
}));

describe('walkOrder', () => {
  const order = walkOrder(districts);

  it('reaches every drawn district exactly once', () => {
    // The whole claim. A walk that skips a district leaves ground a reader with no pointer can
    // never ask about, and this map's twenty uncounted AJK and GB districts are exactly the ones
    // a reader checks a proposal's edge against.
    expect(order).toHaveLength(districts.length);
    expect(new Set(order.map((d) => d.name)).size).toBe(districts.length);
  });

  it('keeps a province together, and a division inside it', () => {
    // Bundle order is arc order — a fact about how the topology was built. Walked in it, a reader
    // would be put in Sindh, then Punjab, then Sindh again, with no way to know where they are.
    const provinces = order.map((d) => d.province);
    expect(provinces).toEqual([...provinces].sort((a, b) => a.localeCompare(b, 'en')));
    for (const province of new Set(provinces)) {
      const divisions = order.filter((d) => d.province === province).map((d) => d.division);
      expect(divisions, province).toEqual(
        [...divisions].sort((a, b) => a.localeCompare(b, 'en')),
      );
    }
  });

  it('does not depend on the order the districts arrive in', () => {
    const shuffled = [...districts].reverse();
    expect(walkOrder(shuffled).map((d) => d.name)).toEqual(order.map((d) => d.name));
  });
});

describe('walkTarget', () => {
  const count = 156;

  it('steps both ways, on both axes', () => {
    for (const key of ['ArrowRight', 'ArrowDown']) {
      expect(walkTarget(key, 10, count), key).toBe(11);
    }
    for (const key of ['ArrowLeft', 'ArrowUp']) {
      expect(walkTarget(key, 10, count), key).toBe(9);
    }
  });

  it('starts the walk on the first press, whichever way it goes', () => {
    // A reader who has just focused the map has no district yet. A first press that appeared to be
    // swallowed would be indistinguishable from a map that cannot be walked at all.
    expect(walkTarget('ArrowRight', null, count)).toBe(0);
    expect(walkTarget('ArrowLeft', null, count)).toBe(count - 1);
  });

  it('wraps at both ends and reaches them directly', () => {
    expect(walkTarget('ArrowRight', count - 1, count)).toBe(0);
    expect(walkTarget('ArrowLeft', 0, count)).toBe(count - 1);
    // 156 presses is not a way to reach the last district.
    expect(walkTarget('Home', 40, count)).toBe(0);
    expect(walkTarget('End', 40, count)).toBe(count - 1);
  });

  it('leaves Space alone, because compare has it', () => {
    /*
     * The map is exactly where a reader stands to hold `Space` (#22) — it carries `tabindex="0"`
     * for that reason. A reader walking the districts must still be able to hold the current map
     * up against the proposal without the walk eating the key.
     */
    for (const key of [' ', 'Spacebar', 'Enter', 'Tab', 'a', 'PageDown']) {
      expect(walkTarget(key, 10, count), key).toBeNull();
    }
  });

  it('answers nothing when there is nothing to walk', () => {
    expect(walkTarget('ArrowRight', null, 0)).toBeNull();
    expect(walkTarget('Home', null, 0)).toBeNull();
  });
});

describe('leavesWalk', () => {
  it('lets a reader put the readout away without moving the map', () => {
    expect(leavesWalk('Escape')).toBe(true);
    expect(leavesWalk('ArrowRight')).toBe(false);
    expect(leavesWalk(' ')).toBe(false);
  });
});
