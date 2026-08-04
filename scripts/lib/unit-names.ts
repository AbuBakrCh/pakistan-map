/**
 * What a rule-drawn unit is called, given the district it is named for.
 *
 * The two engines that draw their own boundaries (#28's A6 and #31's D1) have no source for a
 * name — nobody has proposed these units, so nobody has named them — and both answer the same way:
 * the unit takes the name of the district it is built around, its headquarters in one case and its
 * most populous district in the other. That is right everywhere but one city.
 *
 * **Karachi is published as four districts that carry the city's own name and a compass word.**
 * `Karachi East`, `Karachi West`, `Karachi South` and `Karachi Central` are administrative
 * quarters of one city, not four places called after it; a proposed *province* named `Karachi East`
 * reads as a claim about the east side of Karachi, which is not what the rule drew and not what
 * anybody would call it. So a unit named for one of the four is called **Karachi**, and the
 * district it was named for is still said on the card, where the provenance belongs.
 *
 * It is the city and not the compass words that this is about, which is why the rule is stated on
 * `Karachi` rather than on a list of directions: Pakistan has real places whose names begin with
 * one — North and South Waziristan among them, both districts in their own right — and a unit
 * drawn around South Waziristan is a unit about South Waziristan. Nothing here touches a district
 * name, a census join or a tooltip; this is the name over a *proposed unit* and nothing else.
 */

/** The one city published as districts of its own name. */
const CITY_DISTRICT_PREFIX = 'Karachi ';

/** The unit name for a unit built around `district`. */
export function unitName(district: string): string {
  return district.startsWith(CITY_DISTRICT_PREFIX) ? 'Karachi' : district;
}

/**
 * Every unit's name in one partition — shortened only where the short name belongs to one unit.
 *
 * Shortening can make two units share a name. A rule with a tighter ceiling seats one unit at
 * `Karachi East` and another at `Karachi West`, and calling both of them Karachi would draw two
 * provinces the key, the card and the map could not tell apart. The answer is not to refuse the
 * partition — that map is a perfectly good one and the rule that drew it said nothing wrong — so
 * where a short name would be shared, **every unit that would share it keeps its district's full
 * name**, and the rest of the partition is unaffected. Two units of one city are exactly the case
 * where the quarter is the informative half of the name.
 *
 * Decided over the whole partition rather than unit by unit, which is why this exists beside
 * `unitName` at all: whether *this* unit may be called Karachi is a fact about the other units.
 */
export function unitNames(districts: readonly string[]): readonly string[] {
  const shortened = districts.map(unitName);
  const count = new Map<string, number>();
  for (const name of shortened) count.set(name, (count.get(name) ?? 0) + 1);
  return shortened.map((name, index) => (count.get(name) === 1 ? name : (districts[index] as string)));
}
