import { describe, expect, it } from 'vitest';
import { unitName, unitNames } from './unit-names.ts';

/**
 * What a rule-drawn unit is called.
 *
 * The rule is about **one city published as districts of its own name**, not about compass words:
 * Karachi's four quarters are administrative subdivisions of Karachi, and a proposed province
 * called *Karachi East* reads as a claim about the east side of the city. Everything else keeps
 * the district's name, North and South Waziristan included — the word leads there and is part of
 * the place's name rather than a quarter of another one.
 */
describe('unitName', () => {
  it('calls a unit built around one of Karachi’s quarters by the city’s name', () => {
    for (const quarter of ['Karachi East', 'Karachi West', 'Karachi South', 'Karachi Central']) {
      expect(unitName(quarter)).toBe('Karachi');
    }
  });

  it('leaves every other district’s name alone, compass word or not', () => {
    // The two Waziristans are districts in their own right, not quarters of a Waziristan; Upper and
    // Lower Chitral and the Kohistans are the same shape of name. A unit drawn around one of them
    // is a unit about that district, and shortening it would name a place the map does not draw.
    for (const district of [
      'South Waziristan',
      'North Waziristan',
      'Upper Chitral',
      'Lower Chitral',
      'Upper Kohistan',
      'Karachi', // the city itself, if a roster ever carries it whole
      'Korangi', // a Karachi district that does not carry the city's name
      'Keamari',
      'Malir',
    ]) {
      expect(unitName(district)).toBe(district);
    }
  });
});

describe('unitNames', () => {
  it('shortens the name where one unit wants it', () => {
    expect(unitNames(['Karachi East', 'Lahore', 'Quetta'])).toEqual(['Karachi', 'Lahore', 'Quetta']);
  });

  it('keeps both quarters’ full names where two units would share the short one', () => {
    // A tighter ceiling seats one unit at Karachi East and another at Karachi West. That map is a
    // good one and the rule that drew it said nothing wrong, so it is not refused — but two
    // provinces called Karachi could not be told apart in the key, the card or the map, and there
    // the quarter is the informative half of the name.
    expect(unitNames(['Karachi East', 'Karachi West', 'Lahore'])).toEqual([
      'Karachi East',
      'Karachi West',
      'Lahore',
    ]);
  });

  it('leaves the rest of the partition shortened when one city collides', () => {
    // The collision is local to the name it is about: a second Karachi says nothing about Hyderabad.
    expect(unitNames(['Karachi East', 'Karachi South', 'Hyderabad'])).toEqual([
      'Karachi East',
      'Karachi South',
      'Hyderabad',
    ]);
  });

  it('answers for the set and not for the unit, which is why it exists beside unitName', () => {
    // Same district, two partitions, two answers — the question is what the *other* units are.
    expect(unitNames(['Karachi East'])[0]).toBe('Karachi');
    expect(unitNames(['Karachi East', 'Karachi West'])[0]).toBe('Karachi East');
  });
});
