/**
 * The composite the Development basis shades by (#31) — this project's own figure, and the only
 * one in the app that is.
 *
 * Everything else on this map is somebody else's number or somebody else's line. PBS publishes
 * literacy, improved drinking water and toilet facilities; it publishes no index over them, and
 * nobody else publishes one for Pakistan's districts at this vintage either. So the composite is
 * **defined here**, which is exactly what the `synthesized` badge is in the vocabulary for: a
 * figure this project states, over real data, under a rule printed wherever the figure is.
 *
 * ## The rule, entire
 *
 * The **unweighted mean of the three published rates**. Nothing else — no re-scaling, no
 * normalising against the range the census happens to show, no weighting.
 *
 * Each of those choices is a decision and each is made the same way: the census gives no basis for
 * the alternative, so taking the alternative would be our opinion wearing a census's clothes.
 *
 *  - **Unweighted, because nothing published ranks the three.** A weighted mean is a claim that
 *    literacy matters some stated amount more than a toilet, and there is no source for that
 *    number. Equal weights are also a claim; the difference is that this one is legible in a
 *    sentence and a reader can disagree with it by looking at the three components, which the
 *    tooltip prints beside it for that reason.
 *  - **Of the rates as PBS computes them, denominators and all.** The three do not share one —
 *    literacy is over population aged 10 and above, water and sanitation over the housing tables'
 *    households — so the mean is a mean of three proportions and not a proportion of anything.
 *    That is a real cost and it is why the figure is called an *index* and never a rate.
 *  - **Not re-scaled to the observed range.** A district's score would otherwise move because
 *    another district moved, and the legend would mean something different at each census.
 *
 * ## What it is not
 *
 * It is not poverty, and no surface in this app may call it that (#31, and `docs/research/
 * development-indicators.md` at length). The census sees **service access and attainment**: it
 * does not ask about income, consumption, child mortality or nutrition, and three access
 * indicators cannot carry the word. It is not comparable with anybody's published index, because
 * it is not anybody's.
 *
 * And its third component is **flush toilets, named as such**. PBS classifies drinking-water
 * sources as improved or not and prints the result; for toilets it prints only flush, non-flush
 * and none, and a non-flush toilet may be improved or not. There is therefore no
 * improved-*sanitation* column to average in, and adding flush to non-flush would be a definition
 * of ours inside a component of ours — a judgement squared, and invisible.
 *
 * Pure, like its neighbours: no filesystem, no bundle. The caller supplies the published rates.
 */

/** The three published rates a district's index is the mean of. Proportions in 0–1. */
export interface PublishedRates {
  /** Literate people aged 10+, over population aged 10+ (PBS Table 12). */
  readonly literacy: number;
  /** Households whose drinking-water source PBS classifies as improved (Table 23). */
  readonly improvedWater: number;
  /** Households with a flush toilet (Table 24). **Not** "improved sanitation" — see the header. */
  readonly flushToilet: number;
}

export type RateKey = keyof PublishedRates;

/** What each component is, where it comes from, and what it is a share of. Card and panel copy. */
export interface IndexComponent {
  readonly key: RateKey;
  /** As it is named on every surface. The third one is named for what PBS actually published. */
  readonly label: string;
  readonly table: string;
  readonly numerator: string;
  readonly denominator: string;
  /** What a reader would otherwise assume about this component and be wrong about. */
  readonly caveat?: string;
}

export const INDEX_COMPONENTS: readonly IndexComponent[] = [
  {
    key: 'literacy',
    label: 'Literacy (10+)',
    table: 'PBS Census-2023 Table 12',
    numerator: 'literate people aged 10 and above',
    denominator: 'people aged 10 and above',
    caveat:
      'PBS’s own denominator, which is not the district’s population — nationally it is about ' +
      'three people in ten smaller.',
  },
  {
    key: 'improvedWater',
    label: 'Improved drinking water',
    table: 'PBS Census-2023 Table 23',
    numerator: 'households whose drinking-water source PBS classifies as improved',
    denominator: 'households, as the housing tables count them',
    caveat:
      'The improved/not-improved line is the census’s own published column, not a rule of ours. ' +
      'The denominator is the housing tables’ household count, which is 48,010 below the district ' +
      'table’s in all 136 districts.',
  },
  {
    key: 'flushToilet',
    // Named for the column that exists. PBS publishes no improved-sanitation figure, and calling
    // this one by that name would be our definition wearing a `census` badge.
    label: 'Households with a flush toilet',
    table: 'PBS Census-2023 Table 24',
    numerator: 'households with a flush toilet',
    denominator: 'households, as the housing tables count them',
    caveat:
      'PBS publishes no improved-sanitation column: for toilets it prints only flush, non-flush ' +
      'and none, and a non-flush toilet may be improved or not. So this is the flush-toilet share ' +
      'and is named as such — adding flush to non-flush would be a definition of ours wearing a ' +
      'census badge.',
  },
];

/**
 * The formula in words — the sentence the card, the legend, the tooltip and the About panel all
 * print, so that the figure is never on screen without the rule that produced it.
 */
export const INDEX_FORMULA =
  'The unweighted mean of three rates the 2023 census publishes: literacy among people aged 10 ' +
  'and above, the share of households with an improved drinking-water source, and the share of ' +
  'households with a flush toilet. Each of the three keeps the denominator PBS gave it — the ' +
  'first is over people, the other two over households — so the mean is a mean of three ' +
  'proportions and not a proportion of anything, which is why it is called an index and never a ' +
  'rate. The three are weighted equally because no published source ranks them, and the figure is ' +
  'not re-scaled to the range the census happens to show, so a district’s score does not move ' +
  'because another district moved.';

/** Said wherever the index is, because the one thing it must never be read as is a poverty figure. */
export const NOT_A_POVERTY_MEASURE =
  'This is service access and attainment, not poverty. The census does not ask about income, ' +
  'consumption, child mortality or nutrition, and three access indicators cannot carry that word. ' +
  'No published index states this figure: it is defined by this project, from published census ' +
  'rates, and is badged synthesized for exactly that reason.';

/** One shading band. `to` is exclusive, so the four partition 0–1 with no district on a seam. */
export interface IndexBand {
  readonly id: string;
  readonly from: number;
  readonly to: number;
  /** The legend's own words. Percentages, because a mean of three shares reads as one. */
  readonly label: string;
}

/**
 * Four bands, at round numbers chosen once.
 *
 * **Fixed cuts and not quantiles**, which is the decision here. Quantile bands would make a
 * district's colour a function of every other district's score — Bahawalpur would change band
 * because Gwadar moved — and would make the legend a property of the distribution rather than of
 * the figure. Fixed cuts mean the legend says the same thing at every vintage and a reader can
 * hold two censuses up against each other.
 *
 * Four and not five, and that is a constraint rather than a preference: a sequential ramp on this
 * paper has about 0.14 of OKLab lightness to spend between the tone an unshaded district keeps and
 * the point where a unit outline stops reading over it (`palette.ts`), and five steps inside that
 * window are not four steps a reader can tell apart.
 */
export const INDEX_BANDS: readonly IndexBand[] = [
  { id: 'under-50', from: 0, to: 0.5, label: 'Under 50%' },
  { id: '50-65', from: 0.5, to: 0.65, label: '50% to 65%' },
  { id: '65-80', from: 0.65, to: 0.8, label: '65% to 80%' },
  // The top band is closed at 1 inclusive, since a score of exactly 1 is a real value and not an
  // overflow: it would mean every household and every person over ten, on all three counts.
  { id: '80-plus', from: 0.8, to: 1.0000001, label: '80% and above' },
];

/** Six places, the convention the census join already emits every share at. */
const round = (value: number): number => Math.round(value * 1e6) / 1e6;

/**
 * The index for one district.
 *
 * Throws on a rate outside 0–1 rather than clamping it. A share above 1 is a count larger than the
 * universe it is part of, which the census join already refuses by name; arriving here means it
 * came from somewhere else, and an index quietly averaging it would publish a plausible-looking
 * figure over a district whose data is wrong.
 */
export function developmentIndex(rates: PublishedRates): number {
  const values = INDEX_COMPONENTS.map((component) => rates[component.key]);
  for (const [i, value] of values.entries()) {
    const component = INDEX_COMPONENTS[i];
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(
        `${component?.label ?? 'a component'} is ${value}, which is not a proportion in 0–1. ` +
          `Every rate this index averages is a published count over its own published ` +
          `denominator; a value outside the range is not a low score, it is a broken one.`,
      );
    }
  }
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/**
 * Which band a score falls in.
 *
 * Refuses rather than defaulting to the nearest. The bands partition 0–1 by construction, so a
 * score with no band is a score outside the range the index can produce, and a fill chosen by
 * falling off the end of a list is a district shaded as the worst in Pakistan for an arithmetic
 * reason nobody would ever see.
 */
export function bandOf(score: number): IndexBand {
  const found = INDEX_BANDS.find((band) => score >= band.from && score < band.to);
  if (found === undefined) {
    throw new Error(
      `a development index of ${score} falls in none of the ${INDEX_BANDS.length} bands, which ` +
        `run from ${INDEX_BANDS[0]?.from} to 1. The index is a mean of three proportions and ` +
        `cannot leave that range.`,
    );
  }
  return found;
}

export interface IndexedDistrict {
  readonly district: string;
  readonly score: number;
  readonly band: string;
  readonly rates: PublishedRates;
}

export interface IndexResult {
  /** Ascending by score, ties on the district name — so a rebuild writes the same file. */
  readonly districts: readonly IndexedDistrict[];
  /** Every problem found, each naming its district. `districts` is empty when there are any. */
  readonly problems: readonly string[];
}

/**
 * Index a whole scope, collecting every problem rather than throwing at the first.
 *
 * A bad census is reported as everything wrong with it and not as whichever district happens to
 * sort first — the same discipline `joinDevelopment` and the partition validator work under.
 */
export function indexDistricts(rates: ReadonlyMap<string, PublishedRates>): IndexResult {
  const problems: string[] = [];
  const districts: IndexedDistrict[] = [];

  for (const district of [...rates.keys()].sort((a, b) => a.localeCompare(b))) {
    const published = rates.get(district);
    if (published === undefined) continue;
    try {
      const score = developmentIndex(published);
      districts.push({ district, score, band: bandOf(score).id, rates: published });
    } catch (error) {
      problems.push(`${district}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (problems.length > 0) return { districts: [], problems };
  return {
    districts: districts.sort((a, b) => a.score - b.score || a.district.localeCompare(b.district)),
    problems,
  };
}
